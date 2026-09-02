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

  // Tabs: 'users', 'ciu_cleared', 'api_explorer', 'faculties', 'invites', 'logs'
  const [activeTab, setActiveTab] = useState('users');

  // Logs filters
  const [logLevelFilter, setLogLevelFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  // API Explorer filters
  const [apiSearch, setApiSearch] = useState('');
  const [apiFacultyFilter, setApiFacultyFilter] = useState('ALL');
  const [apiStatusFilter, setApiStatusFilter] = useState('ALL');

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
  const [editRegNumber, setEditRegNumber] = useState('');

  // Form state (Reset Password)
  const [resetUserObj, setResetUserObj] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Cleared Faculty Data
  const [clearedFacultyData, setClearedFacultyData] = useState(null);
  const [loadingCleared, setLoadingCleared] = useState(false);

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

  const fetchClearedFacultyData = async () => {
    setLoadingCleared(true);
    try {
      const res = await api.get('/admin/users/ciu_cleared_students/');
      setClearedFacultyData(res);
    } catch (err) {
      setErrorMsg('Failed to load CIU Cleared Students data.');
    } finally {
      setLoadingCleared(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ciu_cleared' || activeTab === 'api_explorer') {
      fetchClearedFacultyData();
    }
  }, [activeTab]);

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

  const handleSyncCIUClearance = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await api.post('/admin/users/sync_clearance/');
      setSuccessMsg(res.detail || 'Successfully synced CIU Cleared Students API!');
      loadAdminData();
      if (activeTab === 'ciu_cleared' || activeTab === 'api_explorer') fetchClearedFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sync CIU Cleared Students API.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPasswordInput) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await api.post(`/admin/users/${resetUserObj.id}/reset_password/`, {
        new_password: newPasswordInput
      });
      setSuccessMsg(res.detail || `Password reset successfully for ${resetUserObj.username}`);
      setResetUserObj(null);
      setNewPasswordInput('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset user password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvite = async (id) => {
    if (!confirm('Are you sure you want to delete this invitation token?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.delete(`/invitations/${id}/`);
      setSuccessMsg('Invitation token deleted successfully.');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete invitation token.');
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
      if (editingFaculty) {
        await api.put(`/faculties/${editingFaculty.id}/`, facultyFormData);
        setSuccessMsg(`Faculty ${facultyFormData.code} updated successfully.`);
      } else {
        await api.post('/faculties/', facultyFormData);
        setSuccessMsg(`Faculty ${facultyFormData.code} created successfully.`);
      }
      setShowFacultyModal(false);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save faculty.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaculty = async (id, code) => {
    if (!confirm(`Are you sure you want to delete Faculty ${code}?`)) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.delete(`/faculties/${id}/`);
      setSuccessMsg(`Faculty ${code} deleted.`);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete faculty.');
    }
  };

  const handleAssignDean = async (facultyId, deanId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_dean/`, {
        dean_id: deanId ? parseInt(deanId) : null
      });
      setSuccessMsg(res.detail || 'Faculty Dean assignment updated.');
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Dean assignment.');
    }
  };

  const handleAssignSecretary = async (facultyId, secretaryId) => {
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
      setSuccessMsg(`Invitation code generated and automated email dispatched to ${inviteEmail}! Code: ${newInvite.id}`);
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
    setEditRegNumber(u.reg_number || u.registration_number || '');
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
        tuition_paid_percentage: parseFloat(editTuitionPaid),
        reg_number: editRegNumber
      });
      setSuccessMsg('User details & tuition clearance updated successfully!');
      setEditingUser(null);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete(`/admin/users/${id}/`);
      setSuccessMsg('User deleted successfully.');
      loadAdminData();
    } catch (err) {
      setErrorMsg('Failed to delete user.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filtered logs
  const filteredLogs = systemLogs.filter((log) => {
    const matchesLevel = logLevelFilter === 'ALL' || log.level === logLevelFilter;
    const matchesSearch = log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
                          (log.username && log.username.toLowerCase().includes(logSearch.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  // Extract all API payload records and filter
  const payloadRecords = clearedFacultyData?.all_payload_records || [];
  
  const filteredPayloadRecords = payloadRecords.filter(rec => {
    const searchLower = apiSearch.toLowerCase();
    const matchesSearch = apiSearch === '' || 
      rec.student_name.toLowerCase().includes(searchLower) ||
      rec.reg_number.toLowerCase().includes(searchLower) ||
      rec.program.toLowerCase().includes(searchLower) ||
      (rec.db_student && (
        rec.db_student.username.toLowerCase().includes(searchLower) ||
        rec.db_student.email.toLowerCase().includes(searchLower) ||
        rec.db_student.full_name.toLowerCase().includes(searchLower)
      ));

    const matchesFaculty = apiFacultyFilter === 'ALL' || 
      rec.program.toUpperCase().includes(apiFacultyFilter.toUpperCase()) ||
      (rec.db_student && rec.db_student.faculty_code === apiFacultyFilter);

    let matchesStatus = true;
    if (apiStatusFilter === 'EXAM_CLEARED') {
      matchesStatus = rec.db_student ? rec.db_student.is_exam_cleared : (rec.status.toUpperCase() === 'CLEARED');
    } else if (apiStatusFilter === 'TEST_CLEARED') {
      matchesStatus = rec.db_student ? rec.db_student.is_test_cleared : (rec.status.toUpperCase() === 'CLEARED');
    } else if (apiStatusFilter === 'API_MATCHED') {
      matchesStatus = rec.is_db_matched;
    } else if (apiStatusFilter === 'UNMATCHED') {
      matchesStatus = !rec.is_db_matched;
    }

    return matchesSearch && matchesFaculty && matchesStatus;
  });

  const matchedCount = payloadRecords.filter(r => r.is_db_matched).length;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">System Administration & Audit Portal</h2>
          <p className="text-slate-500 text-xs font-medium">Manage accounts, invitations, faculties, cleared students, and audit logs.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncCIUClearance}
            disabled={submitting}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            ⚡ Sync CIU Cleared API
          </button>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Proctoring: ACTIVE' : 'Proctoring: OFF'}
            </span>
            <button
              onClick={handleToggleProctoring}
              className="ml-2 px-2 py-0.5 bg-brand-dark text-white text-[10px] font-bold rounded hover:bg-brand-medium"
            >
              Toggle
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs font-semibold animate-slide-up">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-brand-emerald rounded text-brand-medium text-xs font-semibold animate-slide-up">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-200 pb-3 flex-wrap gap-y-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'users' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👥 User Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('ciu_cleared')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'ciu_cleared' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🎓 Cleared Students by Faculty
        </button>
        <button
          onClick={() => setActiveTab('api_explorer')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'api_explorer' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          ⚡ Live CIU API Payload Explorer ({payloadRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('faculties')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'faculties' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🏛️ Faculties & Leadership ({faculties.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'invites' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          ✉️ Invitations ({invitations.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'logs' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🛡️ Audit Logs ({systemLogs.length})
        </button>
      </div>

      {/* TAB 1: USERS MANAGEMENT & FEE CLEARANCE */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="green-card rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Registered System Users</h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  Total: {users.length}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">User & Reg No.</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-center">Clearance %</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-semibold text-slate-850">
                          <div className="font-bold text-slate-900">{u.first_name || u.username} {u.last_name}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                          {u.role === 'student' && (
                            <div className="text-[10px] text-brand-medium font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                              Reg: {u.reg_number || u.registration_number}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-light/10 text-brand-dark border border-brand-light/20">
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.role === 'student' ? (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${u.tuition_paid_percentage >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : u.tuition_paid_percentage >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {u.tuition_paid_percentage}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center space-x-1">
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="px-2 py-1 bg-white border border-emerald-200 hover:bg-emerald-50 text-slate-800 text-[11px] font-bold rounded transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setResetUserObj(u); setNewPasswordInput(''); }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded border border-amber-200 transition-all"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded transition-all"
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
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate & Email User Invitation</h3>
              <form onSubmit={handleCreateInvite} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Invitee Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="student@ciu.ac.ug"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Designated Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
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
                  className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  {submitting ? 'Sending Email...' : 'Generate & Email Invite Code'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CLEARED STUDENTS ORGANIZED BY FACULTIES */}
      {activeTab === 'ciu_cleared' && (
        <div className="space-y-6">
          <div className="green-card p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-850 text-base">Faculty Cleared Students Directory</h3>
              <p className="text-slate-500 text-xs">Students organized by Faculties with live CIU Cleared API validation status.</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200">
                CIU API External Records: {clearedFacultyData?.external_api_count ?? 0}
              </span>
              <button
                onClick={fetchClearedFacultyData}
                disabled={loadingCleared}
                className="px-3 py-1 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                {loadingCleared ? 'Refreshing...' : 'Refresh Live Feed'}
              </button>
            </div>
          </div>

          {loadingCleared ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : clearedFacultyData?.faculties && Object.keys(clearedFacultyData.faculties).length > 0 ? (
            Object.entries(clearedFacultyData.faculties).map(([facName, facData]) => (
              <div key={facName} className="green-card rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-brand-light/10 text-brand-dark border border-brand-light/20 text-xs font-black rounded uppercase">
                      {facData.code}
                    </span>
                    <h4 className="font-bold text-slate-850 text-sm">{facName}</h4>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Students: {facData.students.length}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Registration Number</th>
                        <th className="px-4 py-3 text-center">Exam Gate (100%)</th>
                        <th className="px-4 py-3 text-center">Test Gate (50%)</th>
                        <th className="px-4 py-3 text-center">CIU API Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {facData.students.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50 transition-all">
                          <td className="px-4 py-3 font-bold text-slate-850">{st.full_name} ({st.username})</td>
                          <td className="px-4 py-3 font-mono font-bold text-brand-medium">{st.reg_number}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.is_exam_cleared ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {st.is_exam_cleared ? 'CLEARED' : 'BARRED'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.is_test_cleared ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              {st.is_test_cleared ? 'CLEARED' : 'BARRED'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${st.is_api_cleared ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {st.is_api_cleared ? '✓ CIU API Matched' : 'DB Percentage'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold">
              No faculty cleared student records found.
            </div>
          )}
        </div>
      )}

      {/* TAB: LIVE CIU API RECORDS EXPLORER */}
      {activeTab === 'api_explorer' && (
        <div className="space-y-6">
          <div className="green-card p-6 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-850 text-base">⚡ Live CIU Cleared Students API Payload Explorer</h3>
                <p className="text-slate-500 text-xs">Viewing all raw payload records from https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx cross-referenced with internal system student data.</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-cyan-50 text-cyan-800 text-xs font-bold rounded-xl border border-cyan-200">
                  Total Payload Records: {payloadRecords.length}
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                  Matched System Accounts: {matchedCount}
                </span>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Search Payload or Student</label>
                <input
                  type="text"
                  placeholder="Search by Reg No, Name, or Email..."
                  value={apiSearch}
                  onChange={(e) => setApiSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Filter by Faculty / Program</label>
                <select
                  value={apiFacultyFilter}
                  onChange={(e) => setApiFacultyFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">All Programs & Faculties</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.code}>{f.code} - {f.name}</option>
                  ))}
                  <option value="SOBAT">SOBAT</option>
                  <option value="FHS">FHS</option>
                  <option value="SONM">SONM</option>
                  <option value="FoST">FoST</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Filter by Match & Clearance Status</label>
                <select
                  value={apiStatusFilter}
                  onChange={(e) => setApiStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">All Records</option>
                  <option value="API_MATCHED">Matched Internal Accounts</option>
                  <option value="UNMATCHED">Unmatched API Records</option>
                  <option value="EXAM_CLEARED">100% Exam Cleared</option>
                  <option value="TEST_CLEARED">50% Test Cleared</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="px-4 py-3">External API Student Name & Reg No.</th>
                    <th className="px-4 py-3">Program / Session</th>
                    <th className="px-4 py-3 text-center">API Clearance</th>
                    <th className="px-4 py-3">Matched System Account</th>
                    <th className="px-4 py-3 text-center">System Fee Clearance</th>
                    <th className="px-4 py-3 text-center">Integration Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPayloadRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{rec.student_name}</div>
                        <div className="font-mono text-[11px] font-bold text-brand-medium">Reg: {rec.reg_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 uppercase">{rec.program}</div>
                        <div className="text-[10px] text-slate-500">Year: {rec.acad_year} | Sem {rec.semester}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {rec.db_student ? (
                          <div>
                            <div className="font-bold text-slate-900">{rec.db_student.full_name}</div>
                            <div className="text-[11px] text-slate-500">{rec.db_student.email} ({rec.db_student.username})</div>
                            <div className="text-[10px] text-brand-dark font-bold">Faculty: {rec.db_student.faculty_code}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No Registered System Account</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rec.db_student ? (
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block ${rec.db_student.is_exam_cleared ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              Exam (100%): {rec.db_student.is_exam_cleared ? 'CLEARED' : 'BARRED'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block ${rec.db_student.is_test_cleared ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              Test (50%): {rec.db_student.is_test_cleared ? 'CLEARED' : 'BARRED'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">API Verified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {rec.is_db_matched ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                            ✓ System Matched
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                            External Payload Only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPayloadRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                        No payload records match the selected search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FACULTIES & LEADERSHIP MANAGEMENT */}
      {activeTab === 'faculties' && (
        <div className="space-y-6">
          <div className="green-card p-4 rounded-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Faculty & Leadership Directory</h3>
              <p className="text-slate-500 text-xs">Create, modify, or remove faculties and assign/unassign Faculty Deans & Secretaries.</p>
            </div>
            <button
              onClick={() => handleOpenFacultyModal(null)}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create New Faculty
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faculties.map((fac) => (
              <div key={fac.id} className="green-card rounded-2xl p-6 space-y-4 flex flex-col justify-between">
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

                  <div>
                    <h4 className="font-bold text-slate-850 text-base">{fac.name}</h4>
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{fac.description || 'No description provided.'}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Faculty Dean</label>
                      <select
                        value={fac.dean || ''}
                        onChange={(e) => handleAssignDean(fac.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- Unassigned --</option>
                        {deans.map(d => (
                          <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Faculty Secretary</label>
                      <select
                        value={fac.secretary || ''}
                        onChange={(e) => handleAssignSecretary(fac.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- Unassigned --</option>
                        {secretaries.map(s => (
                          <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name}</option>
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

      {/* TAB 3: INVITATIONS */}
      {activeTab === 'invites' && (
        <div className="green-card rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Invitation Tokens</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="px-4 py-3">Invitee Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Invitation Code</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-4 py-3 font-bold text-slate-850">{inv.email}</td>
                    <td className="px-4 py-3 font-semibold capitalize">{inv.role.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-700">{inv.id}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${inv.is_used ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {inv.is_used ? 'REDEEMED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">{new Date(inv.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteInvite(inv.id)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded text-[11px] transition-all"
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
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="green-card rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">System Audit Trail</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search audit logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
              <button
                onClick={downloadAuditLogsCSV}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg"
              >
                📊 Export Logs CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Action Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-4 py-3 text-slate-500 text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{log.username || 'System'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.level === 'ERROR' ? 'bg-red-50 text-red-700 border-red-200' : log.level === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-850">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD (ADMIN) */}
      {resetUserObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                Reset Password: {resetUserObj.username}
              </h3>
              <button onClick={() => setResetUserObj(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">New Password</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (e.g. student123)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserObj(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newPasswordInput}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all"
                >
                  {submitting ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT FACULTY (ADMIN) */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-emerald-200">
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
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingFaculty ? 'Save Changes' : 'Create Faculty'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER & FEE CLEARANCE */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-emerald-200 space-y-6 relative animate-scale-up">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-800">Edit User & Fee Clearance</h3>
              <p className="text-xs text-slate-500 font-medium">Modify registration number, contact info, role, and tuition clearances.</p>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                  required
                />
              </div>

              {editRole === 'student' && (
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Official Registration Number</label>
                  <input
                    type="text"
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    placeholder="e.g. 2026SOBAT-A001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-brand-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Tuition Paid % (Clearance)</label>
                  {editRole === 'student' ? (
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={editTuitionPaid}
                      onChange={(e) => setEditTuitionPaid(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-brand-dark"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 text-xs italic font-medium">
                      N/A (Fees Not Applicable for Staff)
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">System Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
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
                  {submitting ? 'Saving...' : 'Save User & Clearance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
