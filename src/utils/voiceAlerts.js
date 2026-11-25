const STORAGE_KEY = 'postureGuardVoiceSettings';

const ISSUE_MESSAGES = [
  { pattern: /forward head|head.*forward|neck.*forward/i, message: 'Head too far forward. Bring it back.' },
  { pattern: /chin.*up|look.*up/i,                        message: 'Lower your chin slightly.' },
  { pattern: /slouch|hunch|rounded.*back|round.*shoulder/i, message: 'Straighten your back.' },
  { pattern: /shoulder.*tilt|uneven.*shoulder/i,           message: 'Level your shoulders.' },
  { pattern: /lean.*left|lean.*right/i,                    message: 'Sit straight, avoid leaning.' },
  { pattern: /camera|visibility|landmark/i,                message: 'Adjust your camera position.' },
];

const resolveMessage = (issue = '') => {
  for (const { pattern, message } of ISSUE_MESSAGES) {
    if (pattern.test(issue)) return message;
  }
  return 'Please correct your posture.';
};

export const getVoiceSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const saveVoiceSettings = (patch) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getVoiceSettings(), ...patch }));
  } catch { /* ignore */ }
};

export const isVoiceEnabled = () => {
  const s = getVoiceSettings();
  return s.voiceAlerts !== false;
};

export const getVoiceVolume = () => {
  const s = getVoiceSettings();
  return typeof s.voiceVolume === 'number' ? s.voiceVolume : 0.9;
};

const getPreferredVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /google us english|samantha|karen|daniel|moira/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    null
  );
};

const doSpeak = (text) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate   = 0.88;
  utterance.pitch  = 1.0;
  utterance.volume = getVoiceVolume();
  const preferred = getPreferredVoice();
  if (preferred) utterance.voice = preferred;

  /* Chrome bug: if synthesis is stuck, resume it first */
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.resume();
    setTimeout(() => window.speechSynthesis.speak(utterance), 50);
  } else {
    window.speechSynthesis.speak(utterance);
  }
};

export const speakPostureAlert = (issue = '') => {
  if (!isVoiceEnabled()) return;
  if (!window.speechSynthesis) return;
  doSpeak(resolveMessage(issue));
};

export const speakMotivation = (message) => {
  if (!isVoiceEnabled()) return;
  if (!window.speechSynthesis) return;
  doSpeak(message);
};
