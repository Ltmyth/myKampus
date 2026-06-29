'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    try {
      setLoading(true);
      const [usersData, invitesData] = await Promise.all([
        api.get('/admin/users/').catch(() => []),
        api.get('/invitations/').catch(() => [])
      ]);
      setUsers(usersData);
      setInvitations(invitesData);
    } catch (err) {
      setErrorMsg('Failed to load admin resources.');
    } finally {
      setLoading(false);
    }
  }

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
      loadAdminData(); // reload
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
        role: editRole
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-800">System Admin Control Center</h2>
        <p className="text-slate-500 text-xs font-medium">Create role-based registration tokens and manage current user databases.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Users Database Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Registered Users ({users.length})</h3>
            
            <div className="overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-550 border-b border-slate-100 text-slate-450 uppercase font-semibold">
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-650">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-bold text-slate-800">{u.username}</td>
                      <td className="px-4 py-3.5">{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-3.5">{u.email}</td>
                      <td className="px-4 py-3.5 capitalize">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : u.role === 'student' ? 'bg-slate-50 text-slate-700 border-slate-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {u.role}
                        </span>
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
                          className="text-red-550 hover:text-red-750 font-bold transition-all"
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

        {/* Right Column: Invite Creator and Active Invites List */}
        <div className="space-y-6">
          
          {/* Create Invite */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate Role Invite</h3>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Invitee Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="recipient@mykampus.edu"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
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

          {/* Active Invitations List */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Invitation Links</h3>
            
            {invitations.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">No active tokens.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{inv.email}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border capitalize ${inv.is_used ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {inv.is_used ? 'Used' : 'Active'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span>Role: <strong className="capitalize text-slate-700">{inv.role}</strong></span>
                      <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {!inv.is_used && (
                      <div className="flex items-center space-x-1 mt-1 pt-1.5 border-t border-slate-200/50">
                        <input
                          type="text"
                          readOnly
                          value={inv.id}
                          className="flex-1 bg-white border border-slate-200 px-2 py-1 rounded text-[9px] text-slate-500 font-mono focus:outline-none cursor-text select-all"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inv.id);
                            alert('Code copied to clipboard!');
                          }}
                          className="px-2 py-1 bg-brand-light text-white text-[9px] font-bold rounded hover:bg-brand-medium active:scale-[0.98] transition-all"
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
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 relative animate-scale-up">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-605 rounded-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-800">Edit User Details</h3>
              <p className="text-xs text-slate-500 font-medium">Modify credentials, contact information, and role assignments.</p>
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
                <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">System Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light transition-all"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="dean">School Dean</option>
                  <option value="dvc">Chancellor (DVC)</option>
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
