import React, { useEffect, useState } from 'react';
import { ErrorState, PageLoader } from './components/StateBlocks';
import { appService } from './services/appService';

/* ─── tiny helpers ─────────────────────────────────────────── */
const scoreColor = (s) => (s >= 80 ? 'var(--success)' : s >= 60 ? '#f59e0b' : 'var(--error)');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/* ─── stat card ────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="adm-stat-card">
    <div className="adm-stat-icon" style={{ background: color + '22', color }}>
      {icon}
    </div>
    <div className="adm-stat-body">
      <div className="adm-stat-value">{value}</div>
      <div className="adm-stat-label">{label}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  </div>
);

/* ─── confirm modal ────────────────────────────────────────── */
const ConfirmModal = ({ title, message, confirmLabel, danger, onConfirm, onCancel }) => (
  <div className="adm-modal-overlay" onClick={onCancel}>
    <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
      <h3 className="adm-modal-title">{title}</h3>
      <p className="adm-modal-message">{message}</p>
      <div className="adm-modal-actions">
        <button className="adm-btn adm-btn-ghost" onClick={onCancel}>Cancel</button>
        <button className={`adm-btn ${danger ? 'adm-btn-danger' : 'adm-btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

/* ─── Overview Tab ─────────────────────────────────────────── */
const OverviewTab = ({ stats, recentSessions }) => (
  <div className="adm-tab-content">
    {/* stat cards */}
    <div className="adm-stats-grid">
      <StatCard icon="👥" label="Total Users" value={stats.totalUsers} sub={`${stats.activeUsers} active`} color="#2563eb" />
      <StatCard icon="📊" label="Total Sessions" value={stats.totalSessions} color="#06b6d4" />
      <StatCard icon="⏱️" label="Hours Monitored" value={`${stats.totalMonitoredHours} hr`} color="#10b981" />
      <StatCard icon="🎯" label="Avg Posture Score" value={`${stats.avgPostureScore}%`} color={scoreColor(stats.avgPostureScore)} />
      <StatCard icon="🔔" label="Total Alerts" value={stats.totalAlerts} color="#f59e0b" />
      <StatCard icon="❌" label="Inactive Users" value={stats.totalUsers - stats.activeUsers} color="#ef4444" />
    </div>

    {/* recent sessions table */}
    <div className="card adm-section-card">
      <div className="card-header">
        <h3>Recent Sessions</h3>
        <span className="adm-badge">Last 5</span>
      </div>
      <div className="card-body adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Score</th>
              <th>Good %</th>
              <th>Bad %</th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="adm-user-cell">
                    <div className="adm-avatar">{s.userName[0]}</div>
                    <div>
                      <div className="adm-user-name">{s.userName}</div>
                      <div className="adm-user-email">{s.userEmail}</div>
                    </div>
                  </div>
                </td>
                <td>{fmtDate(s.date)}</td>
                <td>{s.duration}</td>
                <td>
                  <span className="adm-score-badge" style={{ color: scoreColor(s.score), borderColor: scoreColor(s.score) + '55', background: scoreColor(s.score) + '15' }}>
                    {s.score}
                  </span>
                </td>
                <td>
                  <div className="adm-bar-wrap">
                    <div className="adm-bar adm-bar-good" style={{ width: `${s.goodPct}%` }} />
                    <span>{s.goodPct}%</span>
                  </div>
                </td>
                <td>
                  <div className="adm-bar-wrap">
                    <div className="adm-bar adm-bar-bad" style={{ width: `${s.badPct}%` }} />
                    <span>{s.badPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

/* ─── Users Tab ────────────────────────────────────────────── */
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [confirm, setConfirm] = useState(null); // { type, userId, payload, label }
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await appService.getAdminUsers();
      setUsers(data);
    } catch (e) {
      setError(e.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const doAction = async () => {
    if (!confirm) return;
    setActionLoading(confirm.userId);
    setConfirm(null);
    try {
      if (confirm.type === 'status') {
        const updated = await appService.updateUserStatus(confirm.userId, confirm.payload);
        setUsers((prev) => prev.map((u) => (u.id === confirm.userId ? { ...u, is_active: updated.is_active } : u)));
        showToast(`User ${updated.is_active ? 'activated' : 'deactivated'} successfully.`);
      } else if (confirm.type === 'role') {
        const updated = await appService.updateUserRole(confirm.userId, confirm.payload);
        setUsers((prev) => prev.map((u) => (u.id === confirm.userId ? { ...u, role: updated.role } : u)));
        showToast(`Role changed to ${updated.role}.`);
      } else if (confirm.type === 'delete') {
        await appService.deleteAdminUser(confirm.userId);
        setUsers((prev) => prev.filter((u) => u.id !== confirm.userId));
        showToast('User deleted.');
      }
    } catch (e) {
      showToast('Action failed: ' + (e.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <PageLoader message="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="adm-tab-content">
      {toast && <div className="adm-toast">{toast}</div>}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={doAction}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* filters */}
      <div className="adm-filters">
        <input
          className="adm-search"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select className="adm-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="adm-filter-count">{filtered.length} of {users.length} users</span>
      </div>

      {/* table */}
      <div className="card adm-section-card">
        <div className="card-body adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Sessions</th>
                <th>Avg Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No users match your filters.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className={actionLoading === u.id ? 'adm-row-loading' : ''}>
                  <td>
                    <div className="adm-user-cell">
                      <div className="adm-avatar" style={{ background: u.role === 'admin' ? '#7c3aed33' : '#2563eb33', color: u.role === 'admin' ? '#a78bfa' : '#60a5fa' }}>
                        {(u.name?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <div className="adm-user-name">{u.name}</div>
                        <div className="adm-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`adm-role-badge adm-role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`adm-status-dot ${u.is_active ? 'adm-status-active' : 'adm-status-inactive'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>{u.sessions}</td>
                  <td>
                    {u.avgScore != null && u.avgScore > 0 ? (
                      <span style={{ color: scoreColor(u.avgScore), fontWeight: 600 }}>{u.avgScore}%</span>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="adm-actions">
                      {/* activate / deactivate */}
                      <button
                        className={`adm-btn-sm ${u.is_active ? 'adm-btn-sm-warn' : 'adm-btn-sm-success'}`}
                        disabled={actionLoading === u.id}
                        onClick={() => setConfirm({
                          type: 'status', userId: u.id, payload: !u.is_active,
                          title: u.is_active ? 'Deactivate User' : 'Activate User',
                          message: `Are you sure you want to ${u.is_active ? 'deactivate' : 'activate'} ${u.name}?`,
                          label: u.is_active ? 'Deactivate' : 'Activate',
                          danger: u.is_active,
                        })}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* promote / demote */}
                      <button
                        className="adm-btn-sm adm-btn-sm-purple"
                        disabled={actionLoading === u.id}
                        onClick={() => setConfirm({
                          type: 'role', userId: u.id, payload: u.role === 'admin' ? 'user' : 'admin',
                          title: u.role === 'admin' ? 'Demote to User' : 'Promote to Admin',
                          message: `Change ${u.name}'s role to ${u.role === 'admin' ? 'user' : 'admin'}?`,
                          label: u.role === 'admin' ? 'Demote' : 'Promote',
                          danger: false,
                        })}
                      >
                        {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>

                      {/* delete */}
                      <button
                        className="adm-btn-sm adm-btn-sm-danger"
                        disabled={actionLoading === u.id}
                        onClick={() => setConfirm({
                          type: 'delete', userId: u.id,
                          title: 'Delete User',
                          message: `Permanently delete ${u.name}? This cannot be undone.`,
                          label: 'Delete',
                          danger: true,
                        })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Exercise Form Modal ──────────────────────────────────── */
const CATEGORIES = ['Neck', 'Shoulders', 'Upper Back', 'Back', 'Lower Back', 'Chest'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const emptyForm = { name: '', category: 'Neck', duration: '3 min', difficulty: 'Easy', description: '', instructions: '', benefits: '', icon: '' };

const ExerciseFormModal = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState(initial ? {
    ...initial,
    instructions: (initial.instructions || []).join('\n'),
    benefits: (initial.benefits || []).join('\n'),
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (!form.category.trim()) { setErr('Category is required.'); return; }
    setSaving(true);
    setErr('');
    const payload = {
      ...form,
      instructions: form.instructions.split('\n').map((s) => s.trim()).filter(Boolean),
      benefits: form.benefits.split('\n').map((s) => s.trim()).filter(Boolean),
      icon: form.icon.trim() || form.name.slice(0, 2).toUpperCase(),
    };
    try { await onSave(payload); } catch (e) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal adm-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="adm-modal-title">{initial ? 'Edit Exercise' : 'Add New Exercise'}</h3>

        <div className="adm-form-grid">
          <div className="adm-form-group adm-form-full">
            <label>Exercise Name *</label>
            <input className="adm-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Shoulder Rolls" />
          </div>
          <div className="adm-form-group">
            <label>Category *</label>
            <select className="adm-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="adm-form-group">
            <label>Difficulty</label>
            <select className="adm-select" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="adm-form-group">
            <label>Duration</label>
            <input className="adm-input" value={form.duration} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 3 min" />
          </div>
          <div className="adm-form-group">
            <label>Icon (2–4 letters)</label>
            <input className="adm-input" value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="e.g. SR" maxLength={4} />
          </div>
          <div className="adm-form-group adm-form-full">
            <label>Description</label>
            <textarea className="adm-input adm-textarea" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description of the exercise" />
          </div>
          <div className="adm-form-group adm-form-full">
            <label>Instructions <span className="adm-label-hint">(one per line)</span></label>
            <textarea className="adm-input adm-textarea" rows={4} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder={"Stand tall with feet shoulder-width apart.\nHold the band with both hands..."} />
          </div>
          <div className="adm-form-group adm-form-full">
            <label>Benefits <span className="adm-label-hint">(one per line)</span></label>
            <textarea className="adm-input adm-textarea" rows={3} value={form.benefits} onChange={(e) => set('benefits', e.target.value)} placeholder={"Improves posture\nStrengthens upper back..."} />
          </div>
        </div>

        {err && <p className="adm-form-error">{err}</p>}

        <div className="adm-modal-actions">
          <button className="adm-btn adm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Exercise'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Exercises Tab ────────────────────────────────────────── */
const ExercisesTab = () => {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', exercise?: obj }
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true); setError('');
    try { setExercises(await appService.getAdminExercises()); }
    catch (e) { setError(e.message || 'Failed to load exercises.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const filtered = exercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleSave = async (payload) => {
    if (modal?.mode === 'edit') {
      const updated = await appService.updateAdminExercise(modal.exercise.id, payload);
      setExercises((prev) => prev.map((e) => e.id === modal.exercise.id ? { ...e, ...updated } : e));
      showToast('Exercise updated.');
    } else {
      const created = await appService.createAdminExercise(payload);
      setExercises((prev) => [...prev, created]);
      showToast('Exercise added.');
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await appService.deleteAdminExercise(confirm.id);
      setExercises((prev) => prev.filter((e) => e.id !== confirm.id));
      showToast('Exercise deleted.');
    } catch (e) { showToast('Delete failed: ' + (e.message || '')); }
    finally { setConfirm(null); }
  };

  const diffColor = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' };

  if (loading) return <PageLoader message="Loading exercises…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="adm-tab-content">
      {toast && <div className="adm-toast">{toast}</div>}
      {modal && <ExerciseFormModal initial={modal.exercise} onSave={handleSave} onClose={() => setModal(null)} />}
      {confirm && (
        <ConfirmModal
          title="Delete Exercise"
          message={`Permanently delete "${confirm.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* toolbar */}
      <div className="adm-filters">
        <input className="adm-search" type="text" placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="adm-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="adm-filter-count">{filtered.length} of {exercises.length} exercises</span>
        <button className="adm-btn adm-btn-primary adm-btn-add" onClick={() => setModal({ mode: 'add' })}>
          + Add Exercise
        </button>
      </div>

      {/* grid */}
      <div className="adm-ex-grid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>No exercises match your filters.</div>
        ) : filtered.map((ex) => (
          <div key={ex.id} className={`adm-ex-card ${!ex.is_active ? 'adm-ex-card-inactive' : ''}`}>
            <div className="adm-ex-header">
              <div className="adm-ex-icon">{ex.icon || ex.name.slice(0, 2).toUpperCase()}</div>
              <div className="adm-ex-meta">
                <div className="adm-ex-name">{ex.name}</div>
                <div className="adm-ex-tags">
                  <span className="adm-ex-cat">{ex.category}</span>
                  <span className="adm-ex-diff" style={{ color: diffColor[ex.difficulty] || '#94a3b8', borderColor: (diffColor[ex.difficulty] || '#94a3b8') + '44' }}>{ex.difficulty}</span>
                  <span className="adm-ex-dur">{ex.duration}</span>
                </div>
              </div>
            </div>
            {ex.description && <p className="adm-ex-desc">{ex.description}</p>}
            {ex.benefits && ex.benefits.length > 0 && (
              <ul className="adm-ex-benefits">
                {ex.benefits.slice(0, 2).map((b, i) => <li key={i}>{b}</li>)}
                {ex.benefits.length > 2 && <li className="adm-ex-more">+{ex.benefits.length - 2} more</li>}
              </ul>
            )}
            <div className="adm-ex-actions">
              <button className="adm-btn-sm adm-btn-sm-purple" onClick={() => setModal({ mode: 'edit', exercise: ex })}>Edit</button>
              <button className="adm-btn-sm adm-btn-sm-danger" onClick={() => setConfirm({ id: ex.id, name: ex.name })}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Main Admin Component ─────────────────────────────────── */
const TABS = [
  { id: 'overview',  label: '📊 Overview' },
  { id: 'users',     label: '👥 User Management' },
  { id: 'exercises', label: '🏋️ Exercises' },
];

const Admin = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadAdminData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const adminData = await appService.getAdminData();
      setData(adminData);
    } catch (e) {
      setError(e.message || 'Unable to load admin data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);

  if (isLoading) return <PageLoader message="Loading admin workspace…" />;
  if (error) return <ErrorState message={error} onRetry={loadAdminData} />;

  return (
    <div className="dashboard-container">
      {/* header */}
      <div className="dashboard-header">
        <div>
          <h1>Admin Control Center</h1>
          <p>Manage users, sessions, and platform-wide metrics from one place.</p>
        </div>
        <span className="adm-admin-badge">Admin</span>
      </div>

      {/* tab nav */}
      <div className="adm-tab-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`adm-tab-btn ${activeTab === t.id ? 'adm-tab-btn-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* tab panels */}
      {activeTab === 'overview' && (
        <OverviewTab stats={data.stats} recentSessions={data.recentSessions} />
      )}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'exercises' && <ExercisesTab />}
    </div>
  );
};

export default Admin;
