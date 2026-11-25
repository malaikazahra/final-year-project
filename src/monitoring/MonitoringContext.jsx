import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useAuth } from '../auth/AuthContext';
import { appService } from '../services/appService';
import { speakPostureAlert } from '../utils/voiceAlerts';

const ANALYZE_INTERVAL_MS = 350;
const STALE_STREAM_TIMEOUT_MS = 8000;
const NO_POSE_IDLE_TIMEOUT_MS = 60000;
const CALIBRATION_SAMPLE_TARGET = 20;
const CALIBRATION_STORAGE_KEY = 'postureGuardCalibrationBaseline';

const EMPTY_ANALYSIS = {
  posture: 'idle',
  postureScore: 0,
  summary: 'Enable the camera to start a real posture monitoring session.',
  issues: [],
  metrics: null,
  sessionDuration: 0,
  alertCount: 0,
  goodPercent: 0,
  visibilityIssue: false,
  cameraAlignmentIssue: false,
  deskPositionIssue: false,
};

const MonitoringContext = createContext(null);

const defaultMonitorSettings = {
  cameraEnabled: false,
  enableAlerts: true,
  alertSound: true,
  alertNotifications: true,
  browserNotifications: true,
  alertThreshold: 5,
  alertThresholdUnit: 'minutes',
};

const getAlertThresholdSeconds = (settings) => {
  const rawValue = Math.max(1, Number(settings?.alertThreshold || 1));
  const unit = settings?.alertThresholdUnit || 'minutes';

  if (unit === 'seconds') {
    return rawValue;
  }

  if (unit === 'hours') {
    return rawValue * 3600;
  }

  return rawValue * 60;
};

const shouldUseDesktopNotifications = (settings) =>
  Boolean(settings?.alertNotifications || settings?.browserNotifications);

const readStoredCalibration = () => {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const storeCalibration = (baseline) => {
  try {
    if (baseline) {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(baseline));
    } else {
      localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    }
  } catch (error) {
    // ignore storage issues
  }
};

const attachStreamToVideo = async (videoEl, stream) => {
  if (!videoEl) {
    return;
  }

  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream || null;
  }

  if (stream) {
    await videoEl.play().catch(() => {});
  }
};

const buildPayloadFromResult = (result) => {
  const poseLandmarks = result?.landmarks?.[0];
  if (!poseLandmarks) {
    return null;
  }

  const mapping = {
    nose: 0,
    left_eye: 2,
    right_eye: 5,
    left_ear: 7,
    right_ear: 8,
    mouth_left: 9,
    mouth_right: 10,
    left_shoulder: 11,
    right_shoulder: 12,
  };

  return {
    landmarks: Object.fromEntries(
      Object.entries(mapping).map(([key, index]) => {
        const point = poseLandmarks[index];
        return [
          key,
          {
            x: point.x,
            y: point.y,
            z: point.z,
            visibility: Math.max(point.visibility || 0, point.presence || 0, 0),
          },
        ];
      })
    ),
  };
};

const averageMetric = (samples, key) =>
  Number((samples.reduce((sum, sample) => sum + Number(sample[key] || 0), 0) / samples.length).toFixed(4));

const isCalibrationCandidate = (analysis) =>
  analysis?.posture === 'good' &&
  Number(analysis?.postureScore || 0) >= 85 &&
  !analysis?.visibilityIssue &&
  !analysis?.cameraAlignmentIssue &&
  !analysis?.deskPositionIssue &&
  analysis?.metrics;

export const MonitoringProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const hiddenVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const landmarkerRef = useRef(null);
  const loopTimerRef = useRef(null);
  const mountedStreamRef = useRef(null);
  const analyzingRef = useRef(false);
  const lastAnalyzedAtRef = useRef(0);
  const sessionRef = useRef(null);
  const sessionStartedAtRef = useRef(0);
  const sessionClockTimerRef = useRef(null);
  const lastEventAtRef = useRef(0);
  const lastFrameProcessedAtRef = useRef(0);
  const noPoseSinceRef = useRef(null);
  const badPostureSinceRef = useRef(null);
  const postureStabilityRef = useRef({ stablePosture: 'idle', candidatePosture: null, count: 0 });
  const lastAlertAtRef = useRef(0);
  const voiceSpokenForEpisodeRef = useRef(false);
  const activeNotificationRef = useRef(null);
  const monitorSettingsRef = useRef(defaultMonitorSettings);
  const isMonitoringRef = useRef(false);
  const isCalibratingRef = useRef(false);
  const calibrationBaselineRef = useRef(readStoredCalibration());
  const calibrationSamplesRef = useRef([]);
  const pendingResumeManualRestartRef = useRef(false);

  const [restartVersion, setRestartVersion] = useState(0);
  const [error, setError] = useState('');
  const [cameraAllowed, setCameraAllowed] = useState(defaultMonitorSettings.cameraEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState(() => ({
    ...EMPTY_ANALYSIS,
    calibrationActive: Boolean(calibrationBaselineRef.current),
  }));
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorSettings, setMonitorSettings] = useState(defaultMonitorSettings);
  const [alertToast, setAlertToast] = useState(null);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationBaseline, setCalibrationBaseline] = useState(calibrationBaselineRef.current);
  const [calibrationMessage, setCalibrationMessage] = useState(
    calibrationBaselineRef.current
      ? 'Calibration saved. Posture analysis is using your baseline.'
      : 'No calibration saved yet.'
  );

  const stopSessionClock = useCallback(() => {
    if (sessionClockTimerRef.current) {
      window.clearInterval(sessionClockTimerRef.current);
      sessionClockTimerRef.current = null;
    }
  }, []);

  const updateSessionClock = useCallback(() => {
    if (!sessionStartedAtRef.current) {
      return;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.round((Date.now() - sessionStartedAtRef.current) / 1000)
    );

    setAnalysis((current) => ({
      ...current,
      sessionDuration: elapsedSeconds,
    }));
  }, []);

  const startSessionClock = useCallback(() => {
    stopSessionClock();
    updateSessionClock();
    sessionClockTimerRef.current = window.setInterval(updateSessionClock, 1000);
  }, [stopSessionClock, updateSessionClock]);

  const stabilizePostureAnalysis = useCallback((nextAnalysis) => {
    const posture = nextAnalysis?.posture;
    if (!['good', 'bad'].includes(posture)) {
      postureStabilityRef.current = { stablePosture: posture || 'idle', candidatePosture: null, count: 0 };
      return nextAnalysis;
    }

    const state = postureStabilityRef.current;
    if (posture === state.stablePosture) {
      state.candidatePosture = null;
      state.count = 0;
      return nextAnalysis;
    }

    if (posture === state.candidatePosture) {
      state.count += 1;
    } else {
      state.candidatePosture = posture;
      state.count = 1;
    }

    const requiredFrames = posture === 'bad' ? 5 : 2;
    if (state.count >= requiredFrames) {
      state.stablePosture = posture;
      state.candidatePosture = null;
      state.count = 0;
      return nextAnalysis;
    }

    return {
      ...nextAnalysis,
      posture: state.stablePosture,
      summary:
        state.stablePosture === 'bad'
          ? 'Posture needs correction.'
          : state.stablePosture === 'good'
            ? 'Posture looks balanced.'
            : nextAnalysis.summary,
      issues: state.stablePosture === 'good' ? [] : nextAnalysis.issues,
    };
  }, []);

  const syncPreviewVideo = useCallback(async () => {
    const previewVideo = previewVideoRef.current;
    const stream = mountedStreamRef.current;

    if (!previewVideo) {
      return;
    }

    if (!stream) {
      if (previewVideo.srcObject) {
        previewVideo.srcObject = null;
      }
      return;
    }

    const hasLiveTrack = stream
      .getVideoTracks()
      .some((track) => track.readyState === 'live');

    if (!hasLiveTrack) {
      return;
    }

    const shouldReattach =
      previewVideo.srcObject !== stream ||
      previewVideo.ended ||
      previewVideo.paused ||
      previewVideo.readyState < 2;

    if (shouldReattach) {
      await attachStreamToVideo(previewVideo, stream);
    }
  }, []);

  const applyMonitorSettings = useCallback((settings) => {
    const nextSettings = { ...defaultMonitorSettings, ...settings };
    monitorSettingsRef.current = nextSettings;
    setMonitorSettings(nextSettings);
    setCameraAllowed(Boolean(nextSettings.cameraEnabled));
  }, []);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    isCalibratingRef.current = isCalibrating;
  }, [isCalibrating]);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtor();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume().catch(() => {});
    }

    return audioContextRef.current;
  }, []);

  const playAlertSound = useCallback(async () => {
    if (!monitorSettingsRef.current.alertSound) {
      return;
    }

    const audioContext = await ensureAudioContext();
    if (!audioContext) {
      return;
    }

    const startBeep = (startTime, frequency) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, startTime);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.16, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.24);
    };

    const baseTime = audioContext.currentTime;
    startBeep(baseTime, 880);
    startBeep(baseTime + 0.28, 980);
  }, [ensureAudioContext]);

  const teardownStream = useCallback(
    async ({ closeSession = true } = {}) => {
      if (loopTimerRef.current) {
        window.clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }

      analyzingRef.current = false;
      lastAnalyzedAtRef.current = 0;
      lastFrameProcessedAtRef.current = 0;
      noPoseSinceRef.current = null;
      setIsAnalyzing(false);

      if (landmarkerRef.current) {
        try {
          if (typeof landmarkerRef.current.close === 'function') {
            await landmarkerRef.current.close();
          }
        } catch (closeError) {
          // ignore cleanup issues
        } finally {
          landmarkerRef.current = null;
        }
      }

      if (closeSession && sessionRef.current) {
        try {
          await appService.stopMonitoringSession(sessionRef.current.id);
        } catch (sessionError) {
          // ignore stop failures during cleanup
        } finally {
          sessionRef.current = null;
          sessionStartedAtRef.current = 0;
          lastEventAtRef.current = 0;
          stopSessionClock();
        }
      }

      if (mountedStreamRef.current) {
        mountedStreamRef.current.getTracks().forEach((track) => track.stop());
        mountedStreamRef.current = null;
      }

      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = null;
      }

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
      }
    },
    [stopSessionClock]
  );

  const requestPipelineRestart = useCallback(
    async ({
      message = 'Camera connection changed. Reinitializing posture monitor.',
      requireManualRestart = false,
    } = {}) => {
      setRecoveryMessage(message);
      setError('');

      if (requireManualRestart) {
        setIsMonitoring(false);
        pendingResumeManualRestartRef.current = true;
      } else {
        pendingResumeManualRestartRef.current = false;
      }

      await teardownStream({ closeSession: true });
      setRestartVersion((current) => current + 1);
    },
    [teardownStream]
  );

  const registerPreviewVideo = useCallback(
    async (videoEl) => {
      previewVideoRef.current = videoEl;
      await syncPreviewVideo();
    },
    [syncPreviewVideo]
  );

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const settings = await appService.getSettings();
        if (!mounted) {
          return;
        }
        applyMonitorSettings(settings);
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || 'Unable to load camera preference.');
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [applyMonitorSettings]);

  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      applyMonitorSettings(event.detail || {});
    };

    window.addEventListener('postureguard:settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('postureguard:settings-updated', handleSettingsUpdated);
  }, [applyMonitorSettings]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsMonitoring(false);
      setAnalysis({
        ...EMPTY_ANALYSIS,
        calibrationActive: Boolean(calibrationBaselineRef.current),
      });
      setAlertToast(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!alertToast) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setAlertToast(null), 4500);
    return () => clearTimeout(timeoutId);
  }, [alertToast]);

  useEffect(() => {
    if (!cameraAllowed || !isAuthenticated) {
      return undefined;
    }

    const checkHealth = async () => {
      const stream = mountedStreamRef.current;
      const hiddenVideo = hiddenVideoRef.current;
      const tracks = stream?.getVideoTracks?.() || [];
      const hasLiveTrack = tracks.some((track) => track.readyState === 'live');
      const hasFreshFrames =
        !isMonitoringRef.current ||
        Date.now() - lastFrameProcessedAtRef.current <= STALE_STREAM_TIMEOUT_MS;

      if (!stream || !hasLiveTrack || !hiddenVideo || hiddenVideo.readyState < 2 || !hasFreshFrames) {
        await requestPipelineRestart({
          message:
            'Monitoring paused after your device or browser interrupted the camera. Start monitoring again when ready.',
          requireManualRestart: true,
        });
      }
    };

    const handleResumeSignal = () => {
      window.setTimeout(() => {
        checkHealth().catch(() => {});
      }, 900);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResumeSignal();
      }
    };

    window.addEventListener('focus', handleResumeSignal);
    window.addEventListener('pageshow', handleResumeSignal);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      if (isMonitoringRef.current) {
        checkHealth().catch(() => {});
      }
    }, 5000);

    return () => {
      window.removeEventListener('focus', handleResumeSignal);
      window.removeEventListener('pageshow', handleResumeSignal);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [cameraAllowed, isAuthenticated, requestPipelineRestart]);

  useEffect(() => {
    if (!cameraAllowed) {
      return undefined;
    }

    const keepPreviewHealthy = () => {
      syncPreviewVideo().catch(() => {});
    };

    const intervalId = window.setInterval(keepPreviewHealthy, 2500);
    window.addEventListener('focus', keepPreviewHealthy);
    document.addEventListener('visibilitychange', keepPreviewHealthy);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', keepPreviewHealthy);
      document.removeEventListener('visibilitychange', keepPreviewHealthy);
    };
  }, [cameraAllowed, syncPreviewVideo]);

  useEffect(() => {
    const hiddenVideo = hiddenVideoRef.current;
    let cancelled = false;

    const buildLandmarker = async () => {
      const resolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      return PoseLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: appService.getPostureModelUrl(),
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    };

    const maybeNotifyBrowser = async (message) => {
      if (!shouldUseDesktopNotifications(monitorSettingsRef.current) || !('Notification' in window)) {
        return;
      }
      if (activeNotificationRef.current) {
        return;
      }

      if (Notification.permission === 'granted') {
        const notification = new Notification('PostureGuard Alert', {
          body: message,
          requireInteraction: true,
          silent: !monitorSettingsRef.current.alertSound,
          tag: 'postureguard-alert',
        });
        activeNotificationRef.current = notification;
        notification.onclose = () => {
          if (activeNotificationRef.current === notification) {
            activeNotificationRef.current = null;
          }
        };
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const notification = new Notification('PostureGuard Alert', {
            body: message,
            requireInteraction: true,
            silent: !monitorSettingsRef.current.alertSound,
            tag: 'postureguard-alert',
          });
          activeNotificationRef.current = notification;
          notification.onclose = () => {
            if (activeNotificationRef.current === notification) {
              activeNotificationRef.current = null;
            }
          };
        }
      }
    };

    const maybeHandleAlert = async (nextAnalysis) => {
      if (!monitorSettingsRef.current.enableAlerts) {
        badPostureSinceRef.current = null;
        return false;
      }

      if (nextAnalysis.posture !== 'bad') {
        badPostureSinceRef.current = null;
        voiceSpokenForEpisodeRef.current = false;
        return false;
      }

      const thresholdSeconds = Math.max(2, getAlertThresholdSeconds(monitorSettingsRef.current));
      const now = Date.now();

      if (!badPostureSinceRef.current) {
        badPostureSinceRef.current = now;
        return false;
      }

      const persistedForSeconds = (now - badPostureSinceRef.current) / 1000;
      const secondsSinceLastAlert = (now - lastAlertAtRef.current) / 1000;

      const message = nextAnalysis.issues?.[0] || 'Posture needs correction.';

      /* Voice fires once per bad episode as soon as threshold is reached */
      if (persistedForSeconds >= thresholdSeconds && !voiceSpokenForEpisodeRef.current) {
        voiceSpokenForEpisodeRef.current = true;
        speakPostureAlert(message);
      }

      /* Beep + toast + notification fire on their own cooldown */
      if (persistedForSeconds >= thresholdSeconds && secondsSinceLastAlert >= thresholdSeconds) {
        lastAlertAtRef.current = now;
        setAlertToast({
          id: now,
          title: 'Posture alert',
          message,
        });
        await playAlertSound();
        await maybeNotifyBrowser(message);
        return true;
      }

      return false;
    };

    const maybeCollectCalibrationSample = (nextAnalysis) => {
      if (!isCalibratingRef.current) {
        return;
      }

      if (!isCalibrationCandidate(nextAnalysis)) {
        setCalibrationMessage('Hold a balanced posture with clear camera framing to continue calibration.');
        return;
      }

      calibrationSamplesRef.current.push({
        faceFrameOffset: nextAnalysis.metrics.faceFrameOffset,
        shoulderFrameOffset: nextAnalysis.metrics.shoulderFrameOffset,
        shoulderWidth: nextAnalysis.metrics.shoulderWidth,
        shoulderDepth: nextAnalysis.metrics.shoulderDepth,
        faceToShoulderDepth: nextAnalysis.metrics.faceToShoulderDepth,
      });

      const progress = Math.min(
        100,
        Math.round((calibrationSamplesRef.current.length / CALIBRATION_SAMPLE_TARGET) * 100)
      );
      setCalibrationProgress(progress);
      setCalibrationMessage(`Calibration in progress... ${calibrationSamplesRef.current.length}/${CALIBRATION_SAMPLE_TARGET}`);

      if (calibrationSamplesRef.current.length >= CALIBRATION_SAMPLE_TARGET) {
        const baseline = {
          faceFrameOffset: averageMetric(calibrationSamplesRef.current, 'faceFrameOffset'),
          shoulderFrameOffset: averageMetric(calibrationSamplesRef.current, 'shoulderFrameOffset'),
          shoulderWidth: averageMetric(calibrationSamplesRef.current, 'shoulderWidth'),
          shoulderDepth: averageMetric(calibrationSamplesRef.current, 'shoulderDepth'),
          faceToShoulderDepth: averageMetric(calibrationSamplesRef.current, 'faceToShoulderDepth'),
        };

        calibrationBaselineRef.current = baseline;
        calibrationSamplesRef.current = [];
        storeCalibration(baseline);
        setCalibrationBaseline(baseline);
        setCalibrationProgress(100);
        setCalibrationMessage('Calibration saved. The system is now using your baseline.');
        setIsCalibrating(false);
      }
    };

    const startCamera = async () => {
      setError('');
      setAnalysis({
        ...EMPTY_ANALYSIS,
        calibrationActive: Boolean(calibrationBaselineRef.current),
      });

      await teardownStream({ closeSession: false });

      if (!cameraAllowed || !isAuthenticated) {
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser.');
        return;
      }

      try {
        setIsInitializing(true);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        mountedStreamRef.current = mediaStream;

        if (hiddenVideo && !cancelled) {
          await attachStreamToVideo(hiddenVideo, mediaStream);
        }

        if (previewVideoRef.current && !cancelled) {
          await syncPreviewVideo();
        }

        if (cancelled) {
          return;
        }

        landmarkerRef.current = await buildLandmarker();
        if (cancelled || !hiddenVideo) {
          return;
        }

        if (pendingResumeManualRestartRef.current) {
          pendingResumeManualRestartRef.current = false;
          setRecoveryMessage(
            'Camera recovered after interruption. Please click Start Monitoring to begin a fresh session.'
          );
        } else {
          setRecoveryMessage('');
        }

        const analyzeFrame = async () => {
          if (cancelled || !hiddenVideo || !landmarkerRef.current) {
            return;
          }

          loopTimerRef.current = window.setTimeout(() => {
            analyzeFrame().catch(() => {});
          }, ANALYZE_INTERVAL_MS);

          if (hiddenVideo.readyState < 2) {
            return;
          }

          const now = performance.now();
          if (analyzingRef.current || now - lastAnalyzedAtRef.current < ANALYZE_INTERVAL_MS - 50) {
            return;
          }

          analyzingRef.current = true;
          lastAnalyzedAtRef.current = now;
          setIsAnalyzing(true);

          try {
            const result = landmarkerRef.current.detectForVideo(hiddenVideo, now);
            lastFrameProcessedAtRef.current = Date.now();
            const rawPayload = buildPayloadFromResult(result);

            if (!rawPayload) {
              if (!noPoseSinceRef.current) {
                noPoseSinceRef.current = Date.now();
              }

              const noPoseElapsedMs = Date.now() - noPoseSinceRef.current;
              const shouldGoIdle = noPoseElapsedMs >= NO_POSE_IDLE_TIMEOUT_MS;

              setAnalysis({
                posture: shouldGoIdle ? 'idle' : 'unclear',
                postureScore: 0,
                summary: shouldGoIdle
                  ? 'No posture has been detected for a while. Move back into view to continue monitoring.'
                  : 'No pose detected. Stay centered in front of the camera.',
                issues: shouldGoIdle
                  ? ['Monitoring is waiting for you to come back into the camera view.']
                  : ['No reliable face and shoulder landmarks were found.'],
                metrics: null,
                visibilityIssue: !shouldGoIdle,
                cameraAlignmentIssue: false,
                deskPositionIssue: false,
                calibrationActive: Boolean(calibrationBaselineRef.current),
              });
              return;
            }

            noPoseSinceRef.current = null;

            const rawAnalysis = await appService.analyzePosture({
              ...rawPayload,
              calibrationBaseline: calibrationBaselineRef.current || undefined,
            });
            const nextAnalysis = stabilizePostureAnalysis(rawAnalysis);

            maybeCollectCalibrationSample(nextAnalysis);
            const alertTriggered = isMonitoringRef.current ? await maybeHandleAlert(nextAnalysis) : false;

            setAnalysis((current) => ({
              ...nextAnalysis,
              sessionDuration: current.sessionDuration || 0,
              alertCount: current.alertCount || 0,
              goodPercent: current.goodPercent || 0,
              calibrationActive: Boolean(calibrationBaselineRef.current),
            }));

            if (sessionRef.current && isMonitoringRef.current) {
              const nowMs = Date.now();
              const durationSeconds = Math.max((nowMs - lastEventAtRef.current) / 1000, 0);
              lastEventAtRef.current = nowMs;
              const eventResult = await appService.recordMonitoringEvent(sessionRef.current.id, {
                posture: nextAnalysis.posture,
                postureScore: nextAnalysis.postureScore,
                issues: nextAnalysis.issues,
                metrics: nextAnalysis.metrics,
                durationSeconds,
                alertIncrement: alertTriggered ? 1 : 0,
              });
              const sessionData = eventResult?.session;
              if (sessionData) {
                setAnalysis((current) => ({
                  ...current,
                  sessionDuration: Math.round(Number(sessionData.totalDurationSeconds || 0)),
                  alertCount: Number(sessionData.alertCount || current.alertCount || 0),
                  goodPercent: sessionData.totalDurationSeconds
                    ? Math.round(
                        (Number(sessionData.goodPostureSeconds || 0) /
                          Number(sessionData.totalDurationSeconds || 1)) *
                          100
                      )
                    : current.goodPercent || 0,
                }));
              }
            }
          } catch (analysisError) {
            setError(analysisError.message || 'Unable to analyze posture in real time.');
          } finally {
            analyzingRef.current = false;
            setIsAnalyzing(false);
          }
        };

        analyzeFrame().catch(() => {});
      } catch (streamError) {
        setError(`Camera error: ${streamError.name} - ${streamError.message}`);
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    startCamera().catch((startError) => {
      setError(startError.message || 'Unable to start live monitoring.');
      setIsInitializing(false);
    });

    return () => {
      cancelled = true;
      teardownStream({ closeSession: true }).catch(() => {});
    };
  }, [
    cameraAllowed,
    isAuthenticated,
    playAlertSound,
    restartVersion,
    stabilizePostureAnalysis,
    syncPreviewVideo,
    teardownStream,
  ]);

  const handleCameraToggle = useCallback(async () => {
    const previousValue = cameraAllowed;
    const nextValue = !cameraAllowed;
    setCameraAllowed(nextValue);
    setIsSaving(true);
    setError('');
    setRecoveryMessage('');

    try {
      if (!nextValue) {
        setIsMonitoring(false);
        setIsCalibrating(false);
        calibrationSamplesRef.current = [];
        pendingResumeManualRestartRef.current = false;
        badPostureSinceRef.current = null;
        noPoseSinceRef.current = null;
        lastAlertAtRef.current = 0;
        setAlertToast(null);
        await teardownStream({ closeSession: true });
        setAnalysis({
          ...EMPTY_ANALYSIS,
          summary: 'Enable the camera to start a real posture monitoring session.',
          calibrationActive: Boolean(calibrationBaselineRef.current),
        });
      }

      const nextSettings = await appService.updateSettings({ cameraEnabled: nextValue });
      applyMonitorSettings(nextSettings);

      if (nextValue) {
        pendingResumeManualRestartRef.current = false;
        setRestartVersion((current) => current + 1);
      }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save your camera preference.');
      setCameraAllowed(previousValue);
    } finally {
      setIsSaving(false);
    }
  }, [applyMonitorSettings, cameraAllowed, teardownStream]);

  const startMonitoring = useCallback(async () => {
    setError('');
    setRecoveryMessage('');

    if (!cameraAllowed) {
      setError('Enable camera usage before starting monitoring.');
      return;
    }

    try {
      if (
        shouldUseDesktopNotifications(monitorSettingsRef.current) &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        await Notification.requestPermission().catch(() => {});
      }

      await ensureAudioContext();

      if (!sessionRef.current) {
        sessionRef.current = await appService.startMonitoringSession();
      }
      sessionStartedAtRef.current = Date.now();
      lastEventAtRef.current = Date.now();
      lastFrameProcessedAtRef.current = Date.now();
      noPoseSinceRef.current = null;
      badPostureSinceRef.current = null;
      lastAlertAtRef.current = 0;
      voiceSpokenForEpisodeRef.current = false;
      isMonitoringRef.current = true;
      setAnalysis((current) => ({
        ...current,
        sessionDuration: 0,
        alertCount: 0,
        goodPercent: 0,
      }));
      startSessionClock();
      setIsMonitoring(true);
    } catch (sessionError) {
      setError(sessionError.message || 'Unable to start monitoring session.');
    }
  }, [cameraAllowed, ensureAudioContext, startSessionClock]);

  const stopMonitoring = useCallback(async () => {
    isMonitoringRef.current = false;
    setIsMonitoring(false);
    badPostureSinceRef.current = null;
    stopSessionClock();

    try {
      if (sessionRef.current) {
        const stoppedSession = await appService.stopMonitoringSession(sessionRef.current.id);
        setAnalysis((current) => ({
          ...current,
          sessionDuration: Math.round(Number(stoppedSession?.totalDurationSeconds || current.sessionDuration || 0)),
          alertCount: Number(stoppedSession?.alertCount || current.alertCount || 0),
          goodPercent: stoppedSession?.totalDurationSeconds
            ? Math.round(
                (Number(stoppedSession.goodPostureSeconds || 0) /
                  Number(stoppedSession.totalDurationSeconds || 1)) *
                  100
              )
            : current.goodPercent || 0,
        }));
      }
    } catch (sessionError) {
      setError(sessionError.message || 'Unable to stop monitoring session.');
    } finally {
      sessionRef.current = null;
      sessionStartedAtRef.current = 0;
      lastEventAtRef.current = 0;
    }
  }, [stopSessionClock]);

  const startCalibration = useCallback(() => {
    if (!cameraAllowed) {
      setError('Enable camera usage before starting calibration.');
      return;
    }

    calibrationSamplesRef.current = [];
    setCalibrationProgress(0);
    setCalibrationMessage('Hold your best posture steady while calibration samples are collected.');
    setIsCalibrating(true);
  }, [cameraAllowed]);

  const clearCalibration = useCallback(() => {
    calibrationBaselineRef.current = null;
    calibrationSamplesRef.current = [];
    storeCalibration(null);
    setCalibrationBaseline(null);
    setCalibrationProgress(0);
    setIsCalibrating(false);
    setCalibrationMessage('Calibration cleared. Generic posture thresholds are active again.');
    setAnalysis((current) => ({ ...current, calibrationActive: false }));
  }, []);

  const value = {
    error,
    setError,
    cameraAllowed,
    isSaving,
    analysis,
    isInitializing,
    isAnalyzing,
    isMonitoring,
    hasActiveSession: Boolean(sessionRef.current),
    monitorSettings,
    alertToast,
    recoveryMessage,
    registerPreviewVideo,
    handleCameraToggle,
    startMonitoring,
    stopMonitoring,
    isCalibrating,
    calibrationProgress,
    calibrationBaseline,
    calibrationMessage,
    startCalibration,
    clearCalibration,
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
      {alertToast ? (
        <div className="monitor-alert-toast" role="status" aria-live="polite">
          <strong>{alertToast.title}</strong>
          <p>{alertToast.message}</p>
        </div>
      ) : null}
      <video
        ref={hiddenVideoRef}
        autoPlay
        playsInline
        muted
        className="background-monitor-video"
      />
    </MonitoringContext.Provider>
  );
};

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used inside MonitoringProvider');
  }
  return context;
};
