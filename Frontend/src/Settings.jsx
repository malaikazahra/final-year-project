import React, { useEffect, useState } from 'react';
import { ErrorState, PageLoader } from './components/StateBlocks';
import { appService } from './services/appService';
import { getVoiceSettings, saveVoiceSettings } from './utils/voiceAlerts';

const defaultValues = {
  alertThreshold: 5,
  alertThresholdUnit: 'minutes',
  enableAlerts: true,
  alertSound: true,
  alertNotifications: true,
  theme: 'dark',
  fontSize: 'medium',
  compactMode: false,
  dataCollection: true,
  browserNotifications: true,
  cameraEnabled: false,
};

const SettingRow = ({ title, desc, children }) => (
  <div className="st-row">
    <div className="st-row-left">
      <div className="st-row-title">{title}</div>
      <div className="st-row-desc">{desc}</div>
    </div>
    <div className="st-row-right">{children}</div>
  </div>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <label className="st-toggle">
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
    <span className="st-toggle-track">
      <span className="st-toggle-thumb" />
    </span>
  </label>
);

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [voice, setVoice] = useState(() => {
    const s = getVoiceSettings();
    return {
      voiceAlerts: s.voiceAlerts !== false,
      voiceVolume: typeof s.voiceVolume === 'number' ? s.voiceVolume : 0.9,
    };
  });

  const updateVoice = (patch) => {
    setVoice(prev => {
      const next = { ...prev, ...patch };
      saveVoiceSettings(next);
      return next;
    });
  };

  const testVoice = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('PostureGuard voice alerts are working.');
    u.rate = 0.88; u.pitch = 1.0; u.volume = voice.voiceVolume;
    window.speechSynthesis.speak(u);
  };

  const loadSettings = async () => {
    setIsLoading(true); setError('');
    try { setSettings(await appService.getSettings()); }
    catch (e) { setError(e.message || 'Unable to load settings.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => {
    if (!settings) return;
    document.body.dataset.theme    = settings.theme;
    document.body.dataset.fontSize = settings.fontSize;
    document.body.dataset.compact  = settings.compactMode ? 'on' : 'off';
  }, [settings]);

  const toggle = (key) => setSettings(p => ({ ...p, [key]: !p[key] }));
  const change = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setIsSaving(true); setError(''); setSuccess('');
    try {
      setSettings(await appService.updateSettings(settings));
      setSuccess('Settings saved successfully.');
    } catch (e) { setError(e.message || 'Unable to save settings.'); }
    finally { setIsSaving(false); }
  };

  const handleReset = async () => {
    setSettings(await appService.updateSettings(defaultValues));
    setSuccess('Settings reset to defaults.');
  };

  if (isLoading) return <PageLoader message="Loading your settings..." />;
  if (error && !settings) return <ErrorState message={error} onRetry={loadSettings} />;

  return (
    <div className="pg-page">
      <div className="pg-header">
        <div>
          <h1 className="pg-title">Settings</h1>
          <p className="pg-subtitle">Customize your PostureGuard experience</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="st-btn-reset" onClick={handleReset}>Reset to default</button>
          <button className="st-btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </div>

      {error   ? <div className="pg-alert pg-alert-error">{error}</div>   : null}
      {success ? <div className="pg-alert pg-alert-success">{success}</div> : null}

      {/* Alerts */}
      <div className="pg-card">
        <div className="pg-card-header">
          <span className="pg-card-title">Alerts &amp; notifications</span>
        </div>
        <div className="st-card-body">
          <SettingRow title="Alert threshold" desc="Alert me when bad posture is detected for more than:">
            <div className="st-threshold">
              <input type="number" min="1" value={settings.alertThreshold}
                onChange={e => change('alertThreshold', Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="st-number-input" />
              <select value={settings.alertThresholdUnit}
                onChange={e => change('alertThresholdUnit', e.target.value)}
                className="st-select">
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </SettingRow>
          <SettingRow title="Enable alerts" desc="Show alerts when bad posture is detected.">
            <Toggle checked={settings.enableAlerts} onChange={() => toggle('enableAlerts')} />
          </SettingRow>
          <SettingRow title="Alert sound" desc="Play a sound when a posture alert is triggered.">
            <Toggle checked={settings.alertSound} onChange={() => toggle('alertSound')}
              disabled={!settings.enableAlerts} />
          </SettingRow>
          <SettingRow title="Desktop notifications" desc="Show desktop notifications for posture alerts.">
            <Toggle checked={settings.alertNotifications} onChange={() => toggle('alertNotifications')}
              disabled={!settings.enableAlerts} />
          </SettingRow>
        </div>
      </div>

      {/* Voice Alerts */}
      <div className="pg-card">
        <div className="pg-card-header">
          <span className="pg-card-title">Voice alerts</span>
        </div>
        <div className="st-card-body">
          <SettingRow title="Enable voice alerts" desc="Speak a correction out loud when bad posture is detected.">
            <Toggle checked={voice.voiceAlerts} onChange={() => updateVoice({ voiceAlerts: !voice.voiceAlerts })} />
          </SettingRow>
          <SettingRow title="Alert volume" desc="How loud the voice alert should be.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={voice.voiceVolume}
                onChange={e => updateVoice({ voiceVolume: parseFloat(e.target.value) })}
                disabled={!voice.voiceAlerts}
                style={{ width: 120, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 34 }}>
                {Math.round(voice.voiceVolume * 100)}%
              </span>
            </div>
          </SettingRow>
          <SettingRow title="Test voice" desc="Play a sample voice alert to check your speaker.">
            <button
              className="st-btn-reset"
              onClick={testVoice}
              disabled={!voice.voiceAlerts}
            >
              ▶ Test
            </button>
          </SettingRow>
        </div>
      </div>

      {/* Display */}
      <div className="pg-card">
        <div className="pg-card-header">
          <span className="pg-card-title">Display</span>
        </div>
        <div className="st-card-body">
          <SettingRow title="Theme" desc="Choose your preferred app theme.">
            <select value={settings.theme} onChange={e => change('theme', e.target.value)} className="st-select">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto</option>
            </select>
          </SettingRow>
          <SettingRow title="Font size" desc="Adjust text size for better readability.">
            <select value={settings.fontSize} onChange={e => change('fontSize', e.target.value)} className="st-select">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </SettingRow>
          <SettingRow title="Compact mode" desc="Show more content with less spacing.">
            <Toggle checked={settings.compactMode} onChange={() => toggle('compactMode')} />
          </SettingRow>
        </div>
      </div>

      {/* Privacy */}
      <div className="pg-card">
        <div className="pg-card-header">
          <span className="pg-card-title">Privacy &amp; data</span>
        </div>
        <div className="st-card-body">
          <SettingRow title="Data collection" desc="Allow posture session data to be saved for analysis.">
            <Toggle checked={settings.dataCollection} onChange={() => toggle('dataCollection')} />
          </SettingRow>
          <SettingRow title="Browser notifications" desc="Show browser notifications for posture alerts.">
            <Toggle checked={settings.browserNotifications} onChange={() => toggle('browserNotifications')} />
          </SettingRow>
        </div>
      </div>
    </div>
  );
};

export default Settings;
