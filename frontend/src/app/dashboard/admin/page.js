'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [deans, setDeans] = useState([]);
  const [secretaries, setSecretaries] = useState([]);
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
  const [loading, setLoading] = useState(true);

  // Tabs: 'users', 'faculties', 'logs', 'invites'
  const [activeTab, setActiveTab] = useState('users');

  // Logs filters
  const [logLevelFilter, setLogLevelFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Form states (Create Invite)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  
  // UI states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states (Edit User)
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('student');
  const [editTuitionPaid, setEditTuitionPaid] = useState(100.0);

  // Form State (Create/Edit Faculty)
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [facultyFormData, setFacultyFormData] = useState({
    name: '',
    code: '',
    description: '',
    dean: '',
    secretary: ''
  });

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    try {
      setLoading(true);
      const [usersData, invitesData, logsData, facsData, procData] = await Promise.all([
        api.get('/admin/users/').catch(() => []),
        api.get('/invitations/').catch(() => []),
        api.get('/system-logs/').catch(() => []),
        api.get('/faculties/').catch(() => []),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);
      const userList = usersData || [];
      setUsers(userList);
      setInvitations(invitesData || []);
      setSystemLogs(logsData || []);
      setFaculties(facsData || []);
      setDeans(userList.filter(u => u.role === 'dean'));
      setSecretaries(userList.filter(u => u.role === 'faculty_admin'));
      setProctoringSetting(procData || { is_proctoring_enabled: true });
    } catch (err) {
      setErrorMsg('Failed to load admin resources.');
    } finally {
      setLoading(false);
    }
  }

  const handleToggleProctoring = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/proctoring-settings/toggle/');
      setSuccessMsg(res.detail);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle proctoring.');
    }
  };

  const downloadAuditLogsCSV = () => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
    const tokensStr = localStorage.getItem('ciu_tokens');
    let token = '';
    if (tokensStr) {
      try { token = JSON.parse(tokensStr).access; } catch (e) {}
    }
    window.open(`${API_BASE_URL}/system-logs/export_csv/?token=${token}&level=${logLevelFilter}&search=${logSearch}`, '_blank');
  };

  // --- Faculty CRUD Handlers ---
  const handleOpenFacultyModal = (fac = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (fac) {
      setEditingFaculty(fac);
      setFacultyFormData({
        name: fac.name,
        code: fac.code,
        description: fac.description || '',
        dean: fac.dean || '',
        secretary: fac.secretary || ''
      });
    } else {
      setEditingFaculty(null);
      setFacultyFormData({
        name: '',
        code: '',
        description: '',
        dean: '',
        secretary: ''
      });
    }
    setShowFacultyModal(true);
  };

  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    if (!facultyFormData.name || !facultyFormData.code) {
      setErrorMsg('Faculty Name and Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        name: facultyFormData.name,
        code: facultyFormData.code,
        description: facultyFormData.description,
        dean: facultyFormData.dean ? parseInt(facultyFormData.dean) : null,
        secretary: facultyFormData.secretary ? parseInt(facultyFormData.secretary) : null
      };

      if (editingFaculty) {
        await api.patch(`/faculties/${editingFaculty.id}/`, payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} updated successfully!`);
      } else {
        await api.post('/faculties/', payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} created successfully!`);
      }
      setShowFacultyModal(false);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save faculty details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaculty = async (facultyId, facultyCode) => {
    if (!confirm(`Are you sure you want to delete Faculty ${facultyCode}?`)) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/faculties/${facultyId}/`);
      setSuccessMsg(`Faculty ${facultyCode} deleted successfully.`);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete faculty.');
    }
  };

  const handleAssignDeanAction = async (facultyId, deanId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_dean/`, {
        dean_id: deanId ? parseInt(deanId) : null
      });
      setSuccessMsg(res.detail || 'Dean assignment updated.');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Dean assignment.');
    }
  };

  const handleAssignSecretaryAction = async (facultyId, secretaryId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_secretary/`, {
        secretary_id: secretaryId ? parseInt(secretaryId) : null
      });
      setSuccessMsg(res.detail || 'Faculty Secretary assignment updated.');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Faculty Secretary assignment.');
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteRole) {
      setErrorMsg('Please specify email and role.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const newInvite = await api.post('/invitations/', {
        email: inviteEmail,
        role: inviteRole
      });
      setSuccessMsg(`Created invitation successfully! Code: ${newInvite.id}`);
      setInviteEmail('');
      setInviteRole('student');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (u) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditFirstName(u.first_name || '');
    setEditLastName(u.last_name || '');
    setEditPhone(u.phone || '');
    setEditRole(u.role);
    setEditTuitionPaid(u.tuition_paid_percentage ?? 100.0);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editUsername || !editEmail) {
      setErrorMsg('Username and email are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.patch(`/admin/users/${editingUser.id}/`, {
        username: editUsername,
        email: editEmail,
        first_name: editFirstName,
        last_name: editLastName,
        phone: editPhone,
        role: editRole,
        tuition_paid_percentage: parseFloat(editTuitionPaid)
      });
      setSuccessMsg('User details updated successfully!');
      setEditingUser(null);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user.id) {
      setErrorMsg('Cannot delete your own administrator account.');
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/admin/users/${userId}/`);
      setSuccessMsg('User successfully deleted from database.');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'User deletion failed.');
    }
  };

  const filteredLogs = systemLogs.filter(log => {
    if (logLevelFilter !== 'ALL' && log.level !== logLevelFilter) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchUser = log.username ? log.username.toLowerCase().includes(q) : false;
      const matchDetails = log.details ? log.details.toLowerCase().includes(q) : false;
      return matchAction || matchUser || matchDetails;
    }
    return true;
  });

  if (user?.role !== 'admin') {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">
        Access Denied. Only System Administrators can access this dashboard panel.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  const getLogLevelBadge = (level) => {
    switch (level) {
      case 'AUDIT': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'WARNING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ERROR': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">System Admin Control Center</h2>
          <p className="text-slate-500 text-xs font-medium">User management, Proctoring controls, System Audit Logs, and Tuition Gates.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global Proctoring Switch Card */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-800 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Live Proctoring: ACTIVE' : 'Live Proctoring: OFF'}
            </span>
            <button
              onClick={handleToggleProctoring}
              className="ml-2 px-2.5 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all"
            >
              Toggle Switch
            </button>
          </div>

          <button
            onClick={() => handleOpenFacultyModal(null)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            + New Faculty
          </button>
          <button
            onClick={loadAdminData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-brand-emerald rounded text-brand-medium text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'users' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👥 User Database ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('faculties')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'faculties' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🏛️ Faculties & Leadership ({faculties.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'logs' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🛡️ System Audit Logs ({systemLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'invites' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🔑 Invitations ({invitations.length})
        </button>
      </div>

      {/* TAB 1: USERS DATABASE */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Registered System Accounts ({users.length})</h3>
              
              <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-semibold">
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-center">Tuition Clearance</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-650">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-bold text-slate-800">{u.username}</td>
                        <td className="px-4 py-3.5">{u.first_name} {u.last_name}</td>
                        <td className="px-4 py-3.5 capitalize">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : u.role === 'student' ? 'bg-slate-50 text-slate-700 border-slate-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {u.role === 'student' ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] ${u.tuition_paid_percentage >= 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : u.tuition_paid_percentage >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {u.tuition_paid_percentage}% Paid
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center flex justify-center items-center space-x-3">
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="text-brand-light hover:text-brand-medium font-bold transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-500 hover:text-red-700 font-bold transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Quick Invitation Generator</h3>
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Invitee Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="recipient@mykampus.edu"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Designated Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="faculty_admin">Faculty Secretary</option>
                    <option value="registrar">Academic Registrar</option>
                    <option value="dean">School Dean</option>
                    <option value="dvc">Chancellor (DVC)</option>
                    <option value="vc">Vice-Chancellor (VC)</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                >
                  {submitting ? 'Generating...' : 'Generate Token'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FACULTIES & LEADERSHIP MANAGEMENT */}
      {activeTab === 'faculties' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Faculty & Leadership Directory</h3>
              <p className="text-slate-500 text-xs">Create, modify, or remove faculties and assign/unassign Faculty Deans & Secretaries.</p>
            </div>
            <button
              onClick={() => handleOpenFacultyModal(null)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create New Faculty
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faculties.map((fac) => (
              <div key={fac.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-light/10 text-brand-dark border border-brand-light/20">
                      {fac.code}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleOpenFacultyModal(fac)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteFaculty(fac.id, fac.code)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-850 leading-tight">{fac.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{fac.description || 'No description provided.'}</p>
                  
                  {/* Leadership Card */}
                  <div className="pt-2 text-xs space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Dean</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.dean_name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Secretary</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.secretary_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dropdowns for Assign / Change Leadership */}
                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Dean</label>
                      <select
                        value={fac.dean || ''}
                        onChange={(e) => handleAssignDeanAction(fac.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Unassigned --</option>
                        {deans.map(d => (
                          <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name} ({d.email})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Secretary</label>
                      <select
                        value={fac.secretary || ''}
                        onChange={(e) => handleAssignSecretaryAction(fac.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="">-- Unassigned --</option>
                        {secretaries.map(s => (
                          <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name} ({s.email})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          
          {/* Logs Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Log Level:</span>
              {['ALL', 'INFO', 'WARNING', 'ERROR', 'AUDIT'].map((level) => (
                <button
                  key={level}
                  onClick={() => setLogLevelFilter(level)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${logLevelFilter === level ? 'bg-brand-dark text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search logs by action or user..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-64"
              />
              <button
                onClick={downloadAuditLogsCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                title="Export System Audit Logs to CSV"
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">System Activity Audit Trail</h3>
              <span className="text-xs text-slate-400 font-medium">Showing <strong className="text-slate-800">{filteredLogs.length}</strong> log events</span>
            </div>

            {filteredLogs.length === 0 ? (
              <p className="text-slate-400 text-xs py-12 text-center">No system log entries recorded matching filter criteria.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">User & Role</th>
                      <th className="px-4 py-3">Action Event</th>
                      <th className="px-4 py-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-all font-sans">
                        <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getLogLevelBadge(log.level)}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.username ? (
                            <div>
                              <span className="font-bold text-slate-800">{log.username}</span>
                              <span className="text-[10px] text-slate-400 capitalize block">{log.user_role}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">System</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-850">{log.action}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate" title={log.details}>
                          {log.details || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: INVITATIONS */}
      {activeTab === 'invites' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active & Historical Registration Invitations</h3>
            
            {invitations.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No tokens generated.</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 text-sm">{inv.email}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${inv.is_used ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {inv.is_used ? 'Used' : 'Active'}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">Role Token: <strong className="capitalize text-slate-700">{inv.role.replace('_', ' ')}</strong> · Issued: {new Date(inv.created_at).toLocaleString()}</p>
                    </div>

                    {!inv.is_used && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          readOnly
                          value={inv.id}
                          className="bg-white border border-slate-200 px-3 py-1 rounded text-xs text-slate-600 font-mono"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inv.id);
                            alert('Invitation Token copied to clipboard!');
                          }}
                          className="px-3 py-1 bg-brand-light text-white text-xs font-bold rounded hover:bg-brand-medium"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate Role Token</h3>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Invitee Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="recipient@mykampus.edu"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Role Choice</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="faculty_admin">Faculty Secretary</option>
                  <option value="registrar">Academic Registrar</option>
                  <option value="dean">School Dean</option>
                  <option value="dvc">Chancellor (DVC)</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
              >
                {submitting ? 'Generating...' : 'Generate Token'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT FACULTY (ADMIN) */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingFaculty ? `Edit Faculty: ${editingFaculty.code}` : 'Create New Faculty'}
              </h3>
              <button onClick={() => setShowFacultyModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveFaculty} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Faculty Code</label>
                  <input
                    type="text"
                    value={facultyFormData.code}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, code: e.target.value })}
                    placeholder="e.g. FoST, FHS"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Faculty Name</label>
                  <input
                    type="text"
                    value={facultyFormData.name}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, name: e.target.value })}
                    placeholder="Faculty of Science & Technology"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={facultyFormData.description}
                  onChange={(e) => setFacultyFormData({ ...facultyFormData, description: e.target.value })}
                  placeholder="Optional description of the faculty..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Assign Faculty Dean</label>
                  <select
                    value={facultyFormData.dean}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, dean: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Unassigned --</option>
                    {deans.map(d => (
                      <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Assign Faculty Secretary</label>
                  <select
                    value={facultyFormData.secretary}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, secretary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">-- Unassigned --</option>
                    {secretaries.map(s => (
                      <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFacultyModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingFaculty ? 'Save Changes' : 'Create Faculty'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 relative animate-scale-up">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-605 rounded-lg"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-800">Edit User Details</h3>
              <p className="text-xs text-slate-500 font-medium">Modify credentials, contact information, role, and tuition clearances.</p>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Tuition Paid %</label>
                  {editRole === 'student' ? (
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={editTuitionPaid}
                      onChange={(e) => setEditTuitionPaid(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all font-bold"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 text-xs italic font-medium">
                      N/A (Fees Not Applicable for Staff)
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">System Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="faculty_admin">Faculty Secretary</option>
                  <option value="registrar">Academic Registrar</option>
                  <option value="dean">School Dean</option>
                  <option value="dvc">Chancellor (DVC)</option>
                  <option value="vc">Vice-Chancellor (VC)</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
