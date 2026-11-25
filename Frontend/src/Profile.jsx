import React, { useEffect, useState } from 'react';
import { ErrorState, PageLoader } from './components/StateBlocks';
import { appService } from './services/appService';

const ACHIEVEMENTS = [
  { id: 1, icon: '🏁', name: 'First Session',   desc: 'Complete your first posture session.',      unlock: s => s.totalSessions >= 1  },
  { id: 2, icon: '⚡', name: 'Week Warrior',     desc: 'Track your posture for 7 sessions in a row.', unlock: s => s.streak >= 7        },
  { id: 3, icon: '💯', name: 'Perfect Day',      desc: 'Achieve a 100% good-posture score.',        unlock: s => s.bestScore >= 100    },
  { id: 4, icon: '🎯', name: 'Dedication',       desc: 'Complete 30 posture sessions.',             unlock: s => s.totalSessions >= 30 },
  { id: 5, icon: '🏋️', name: 'Exercise Master', desc: 'Complete all 21 exercises.',                 unlock: s => s.completedExercises >= 21 },
  { id: 6, icon: '🌟', name: 'Consistency Star', desc: 'Maintain a 75%+ average score.',            unlock: s => s.averageScore >= 75       },
];

const fmt = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
};

const Field = ({ label, value }) => (
  <div className="pf-field">
    <span className="pf-field-label">{label}</span>
    <span className="pf-field-value">{value || '—'}</span>
  </div>
);

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [editData, setEditData]       = useState(null);
  const [dashData, setDashData]       = useState(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState('');
  const [toast, setToast]             = useState('');

  const loadProfile = async () => {
    setIsLoading(true); setError('');
    try {
      const [profile, dash] = await Promise.all([
        appService.getProfile(),
        appService.getDashboardData().catch(() => null),
      ]);
      setProfileData(profile); setEditData(profile); setDashData(dash);
    } catch (e) { setError(e.message || 'Unable to load your profile.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    setIsSaving(true); setError('');
    try {
      const updated = await appService.updateProfile(editData);
      setProfileData(updated); setEditData(updated);
      setIsEditing(false);
      setToast('Profile updated successfully.');
      setTimeout(() => setToast(''), 3000);
    } catch (e) { setError(e.message || 'Unable to save changes.'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <PageLoader message="Loading your profile..." />;
  if (error && !profileData) return <ErrorState message={error} onRetry={loadProfile} />;

  const summary  = dashData?.summary || {};
  const totalSessions = summary.totalSessions ?? 0;
  const totalSeconds  = summary.totalMonitoredSeconds ?? 0;
  const bestScore     = summary.latestCompletedScore ?? summary.averageScore ?? 0;
  const streak        = totalSessions;
  const completedExercises = summary.completedExercises ?? 0;
  const averageScore       = summary.averageScore ?? 0;
  const achievementStats   = { totalSessions, bestScore, streak, completedExercises, averageScore };

  const initials = (profileData.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="pg-page">
      <div className="pg-header">
        <div>
          <h1 className="pg-title">Your Profile</h1>
          <p className="pg-subtitle">Manage your account and view your achievements</p>
        </div>
      </div>

      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}

      {/* Profile card */}
      <div className="pg-card pf-profile-card">
        <div className="pf-avatar-col">
          <div className="pf-avatar">{initials}</div>
          {!isEditing && (
            <button className="pf-edit-btn" onClick={() => setIsEditing(true)}>Edit profile</button>
          )}
        </div>

        {!isEditing ? (
          <div className="pf-info-col">
            <div className="pf-name">{profileData.name}</div>
            <div className="pf-email">{profileData.email}</div>
            <div className="pf-fields">
              <Field label="Phone"        value={profileData.phone}    />
              <Field label="City"         value={profileData.city}     />
              <Field label="Country"      value={profileData.country}  />
              <Field label="Member since" value={profileData.joinDate} />
            </div>
          </div>
        ) : (
          <div className="pf-edit-col">
            <div className="pf-form-grid">
              {[
                { id: 'name',     label: 'Full name', type: 'text',  key: 'name'     },
                { id: 'email',    label: 'Email',     type: 'email', key: 'email'    },
                { id: 'phone',    label: 'Phone',     type: 'tel',   key: 'phone'    },
                { id: 'city',     label: 'City',      type: 'text',  key: 'city'     },
                { id: 'country',  label: 'Country',   type: 'text',  key: 'country'  },
              ].map(f => (
                <div key={f.id} className="pf-form-field">
                  <label htmlFor={f.id}>{f.label}</label>
                  <input id={f.id} type={f.type} value={editData[f.key] || ''}
                    onChange={e => setEditData({ ...editData, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="pf-form-actions">
              <button className="st-btn-save" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button className="st-btn-reset" onClick={() => { setEditData(profileData); setIsEditing(false); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="pg-stats-row pg-stats-4">
        {[
          { label: 'Total sessions',  value: totalSessions,               color: '#2563eb' },
          { label: 'Best score',      value: bestScore ? `${bestScore}%` : '—', color: '#10b981' },
          { label: 'Sessions streak', value: streak,                       color: '#06b6d4' },
          { label: 'Total time',      value: totalSeconds ? fmt(totalSeconds) : '—', color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="pg-stat-card">
            <div className="pg-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="pg-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Achievements */}
      <div className="pg-card">
        <div className="pg-card-header"><span className="pg-card-title">Achievements</span></div>
        <div className="pg-card-body">
          <div className="pf-achievements">
            {ACHIEVEMENTS.map(a => {
              const unlocked = a.unlock(achievementStats);
              return (
                <div key={a.id} className={`pf-achievement${unlocked ? ' pf-unlocked' : ''}`}>
                  <div className="pf-ach-icon">{a.icon}</div>
                  <div className="pf-ach-name">{a.name}</div>
                  <div className="pf-ach-desc">{a.desc}</div>
                  {!unlocked && <div className="pf-locked-badge">Locked</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Account settings */}
      <div className="pg-card">
        <div className="pg-card-header"><span className="pg-card-title">Account settings</span></div>
        <div className="st-card-body">
          {[
            { title: 'Change password',         desc: 'Update your account password.',          label: 'Coming soon',  danger: false },
            { title: 'Two-factor authentication', desc: 'Add an extra layer of security.',       label: 'Planned',      danger: false },
            { title: 'Delete account',           desc: 'Permanently delete your account and data.', label: 'Restricted', danger: true  },
          ].map(item => (
            <div key={item.title} className="st-row">
              <div className="st-row-left">
                <div className="st-row-title">{item.title}</div>
                <div className="st-row-desc">{item.desc}</div>
              </div>
              <div className="st-row-right">
                <button className={`pf-acct-btn${item.danger ? ' pf-acct-danger' : ''}`}>{item.label}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="demo-toast">
          {toast}
          <button onClick={() => setToast('')}>×</button>
        </div>
      )}
    </div>
  );
};

export default Profile;
