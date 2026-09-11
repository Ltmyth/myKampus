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
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
  const [loading, setLoading] = useState(true);

  // Tabs: 'users', 'temp_clearance', 'excel_onboarding', 'proctoring_monitor', 'ciu_cleared', 'invites', 'logs'
  const [activeTab, setActiveTab] = useState('users');

  // Temporary Clearance State
  const [tempClearances, setTempClearances] = useState([]);
  const [loadingTempClearances, setLoadingTempClearances] = useState(false);
  const [selectedStudentForClearance, setSelectedStudentForClearance] = useState('');
  const [clearanceScope, setClearanceScope] = useState('both');
  const [clearanceDurationDays, setClearanceDurationDays] = useState('7');
  const [clearanceReason, setClearanceReason] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [bulkClearanceFile, setBulkClearanceFile] = useState(null);
  const [uploadingBulkClearance, setUploadingBulkClearance] = useState(false);

  // Excel / Single Student Onboarding State
  const [onboardingMode, setOnboardingMode] = useState('single'); // 'single' or 'excel'
  const [singleRegNumber, setSingleRegNumber] = useState('');
  const [singleFullName, setSingleFullName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleFaculty, setSingleFaculty] = useState('');
  const [singleInitialPassword, setSingleInitialPassword] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [customDefaultPass, setCustomDefaultPass] = useState('');
  const [onboardingResults, setOnboardingResults] = useState([]);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  // Bulk User Selection & Deletion State
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // User Directory Grouping, Filtering & Pagination State
  const [userGroupFilter, setUserGroupFilter] = useState('all'); // 'all', 'students', 'staff'
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userClearanceFilter, setUserClearanceFilter] = useState('ALL'); // 'ALL', 'cleared', 'barred'
  const [userFacultyFilter, setUserFacultyFilter] = useState('ALL');
  const [userCourseFilter, setUserCourseFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Live Proctoring State
  const [liveProctorFeeds, setLiveProctorFeeds] = useState([]);
  const [loadingProctorFeeds, setLoadingProctorFeeds] = useState(false);

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
  const [courses, setCourses] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('student');
  const [editTuitionPaid, setEditTuitionPaid] = useState(100.0);
  const [editRegNumber, setEditRegNumber] = useState('');
  const [editYearOfStudy, setEditYearOfStudy] = useState(1);
  const [editFaculty, setEditFaculty] = useState('');
  const [editAssignedCourses, setEditAssignedCourses] = useState([]);

  // Bulk Student Allocation State
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkYearOfStudy, setBulkYearOfStudy] = useState(1);
  const [bulkFacultyId, setBulkFacultyId] = useState('');
  const [bulkCourseIds, setBulkCourseIds] = useState([]);

  // Form state (Reset Password)
  const [resetUserObj, setResetUserObj] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Cleared Faculty Data
  const [clearedFacultyData, setClearedFacultyData] = useState(null);
  const [loadingCleared, setLoadingCleared] = useState(false);

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    try {
      setLoading(true);
      const [usersData, invitesData, logsData, facsData, crsData, procData] = await Promise.all([
        api.get('/admin/users/').catch(() => []),
        api.get('/invitations/').catch(() => []),
        api.get('/system-logs/').catch(() => []),
        api.get('/faculties/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);
      setUsers(Array.isArray(usersData) ? usersData : (usersData?.results || []));
      setInvitations(Array.isArray(invitesData) ? invitesData : (invitesData?.results || []));
      setSystemLogs(Array.isArray(logsData) ? logsData : (logsData?.results || []));
      setFaculties(Array.isArray(facsData) ? facsData : (facsData?.results || []));
      setCourses(Array.isArray(crsData) ? crsData : (crsData?.results || []));
      setProctoringSetting(procData || { is_proctoring_enabled: true });
    } catch (err) {
      setErrorMsg('Failed to load admin resources.');
    } finally {
      setLoading(false);
    }
  }

  const loadTemporaryClearances = async () => {
    setLoadingTempClearances(true);
    try {
      const res = await api.get('/temporary-clearances/');
      const list = Array.isArray(res) ? res : (res?.results || []);
      setTempClearances(list);
    } catch (err) {
      setErrorMsg('Failed to load temporary clearance records.');
    } finally {
      setLoadingTempClearances(false);
    }
  };

  const fetchLiveProctorFeeds = async () => {
    setLoadingProctorFeeds(true);
    try {
      const res = await api.get('/proctoring-monitor/live_feeds/');
      setLiveProctorFeeds(res || []);
    } catch (err) {
      setErrorMsg('Failed to load live proctoring feeds.');
    } finally {
      setLoadingProctorFeeds(false);
    }
  };

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
    if (activeTab === 'temp_clearance') {
      loadTemporaryClearances();
    } else if (activeTab === 'proctoring_monitor') {
      fetchLiveProctorFeeds();
      const interval = setInterval(fetchLiveProctorFeeds, 10000);
      return () => clearInterval(interval);
    } else if (activeTab === 'ciu_cleared') {
      fetchClearedFacultyData();
    }
  }, [activeTab]);

  const handleGrantTemporaryClearance = async (e) => {
    e.preventDefault();
    if (!selectedStudentForClearance) {
      setErrorMsg('Please select a student for temporary clearance.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/temporary-clearances/', {
        student: parseInt(selectedStudentForClearance),
        clearance_type: clearanceScope,
        duration_days: parseInt(clearanceDurationDays),
        reason: clearanceReason || 'Financial arrangement approved by administration'
      });
      setSuccessMsg('Temporary exam/test clearance granted successfully!');
      setSelectedStudentForClearance('');
      setClearanceReason('');
      loadTemporaryClearances();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to grant temporary clearance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkTempClearanceExcelUpload = async (e) => {
    e.preventDefault();
    if (!bulkClearanceFile) {
      setErrorMsg('Please select an Excel (.xlsx/.xls) or CSV file for bulk clearance.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setUploadingBulkClearance(true);

    try {
      const formData = new FormData();
      formData.append('file', bulkClearanceFile);
      formData.append('duration_days', clearanceDurationDays);
      formData.append('clearance_type', clearanceScope);
      formData.append('reason', clearanceReason || 'Excel Batch Temporary Clearance');

      const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
      const tokensStr = localStorage.getItem('ciu_tokens');
      let token = '';
      if (tokensStr) {
        try { token = JSON.parse(tokensStr).access; } catch (e) {}
      }

      const res = await fetch(`${API_BASE_URL}/temporary-clearances/upload_bulk_clearance/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.detail || `Granted bulk temporary clearance for ${data.count} students!`);
        setBulkClearanceFile(null);
        loadTemporaryClearances();
      } else {
        setErrorMsg(data.detail || 'Failed to process bulk temporary clearance Excel file.');
      }
    } catch (err) {
      setErrorMsg('Failed to process bulk temporary clearance file.');
    } finally {
      setUploadingBulkClearance(false);
    }
  };

  const handleRevokeClearance = async (id) => {
    if (!confirm('Are you sure you want to revoke this temporary clearance?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.post(`/temporary-clearances/${id}/revoke/`);
      setSuccessMsg('Temporary clearance revoked.');
      loadTemporaryClearances();
    } catch (err) {
      setErrorMsg('Failed to revoke temporary clearance.');
    }
  };

  const handleExtendClearance = async (id, days) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/temporary-clearances/${id}/extend/`, { days });
      setSuccessMsg(res.detail || `Clearance extended by ${days} days.`);
      loadTemporaryClearances();
    } catch (err) {
      setErrorMsg('Failed to extend temporary clearance.');
    }
  };

  const handleExcelOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setErrorMsg('Please select an Excel (.xlsx/.xls) or CSV file to upload.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setUploadingExcel(true);

    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      if (customDefaultPass.trim()) {
        formData.append('default_password', customDefaultPass.trim());
      }
      
      const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
      const tokensStr = localStorage.getItem('ciu_tokens');
      let token = '';
      if (tokensStr) {
        try { token = JSON.parse(tokensStr).access; } catch (e) {}
      }

      const res = await fetch(`${API_BASE_URL}/admin/users/upload_students/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.detail || 'Batch student onboarding complete!');
        setOnboardingResults(data.students || []);
        loadAdminData();
      } else {
        setErrorMsg(data.detail || 'Failed to process Excel onboarding file.');
      }
    } catch (err) {
      setErrorMsg('Failed to process Excel file.');
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleToggleSelectUser = (id) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUserIds.length} selected user account(s)?`)) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await api.post('/admin/users/bulk_delete/', { user_ids: selectedUserIds });
      setSuccessMsg(res.detail || `Deleted ${selectedUserIds.length} selected user account(s).`);
      setSelectedUserIds([]);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete selected users.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkResetPasswords = async () => {
    if (selectedUserIds.length === 0) return;
    const newPass = prompt(`Enter a new password to apply to all ${selectedUserIds.length} selected user account(s):`, 'CIU2026Password!');
    if (!newPass) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await api.post('/admin/users/bulk_reset_passwords/', {
        user_ids: selectedUserIds,
        new_password: newPass.trim()
      });
      setSuccessMsg(res.detail || `Successfully reset passwords for ${selectedUserIds.length} selected user account(s)!`);
      setSelectedUserIds([]);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset passwords for selected users.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleStudentOnboarding = async (e) => {
    e.preventDefault();
    if (!singleRegNumber || !singleFullName) {
      setErrorMsg('Registration Number and Student Full Name are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      const csvHeader = "Registration No,Full Name,Email,Faculty,One Time Password\n";
      const csvRow = `"${singleRegNumber.trim()}","${singleFullName.trim()}","${singleEmail.trim() || `student_${Date.now()}@ciu.ac.ug`}","${singleFaculty || 'SOBAT'}","${singleInitialPassword.trim()}"\n`;
      const blob = new Blob([csvHeader + csvRow], { type: 'text/csv' });
      formData.append('file', blob, 'single_student.csv');
      if (singleInitialPassword.trim()) {
        formData.append('default_password', singleInitialPassword.trim());
      }

      const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
      const tokensStr = localStorage.getItem('ciu_tokens');
      let token = '';
      if (tokensStr) {
        try { token = JSON.parse(tokensStr).access; } catch (e) {}
      }

      const res = await fetch(`${API_BASE_URL}/admin/users/upload_students/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Single student '${singleFullName}' onboarded successfully with One-Time Password!`);
        setOnboardingResults(data.students || []);
        setSingleRegNumber('');
        setSingleFullName('');
        setSingleEmail('');
        setSingleInitialPassword('');
        loadAdminData();
      } else {
        setErrorMsg(data.detail || 'Failed to onboard single student.');
      }
    } catch (err) {
      setErrorMsg('Failed to process single student onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueProctorWarning = async (studentId, actionType) => {
    const msg = prompt(
      actionType === 'terminate'
        ? 'Enter reason for terminating candidate exam attempt:'
        : 'Enter warning alert message for candidate:',
      actionType === 'terminate' ? 'Violation of proctoring rules' : 'Please remain visible in front of webcam stream'
    );
    if (!msg) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/proctoring-monitor/issue_warning/', {
        student_id: studentId,
        message: msg,
        action: actionType
      });
      setSuccessMsg(res.detail);
      fetchLiveProctorFeeds();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to issue proctor warning.');
    }
  };

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
      if (activeTab === 'ciu_cleared') fetchClearedFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sync CIU Cleared Students API.');
    } finally {
      setSubmitting(false);
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
    setEditYearOfStudy(u.year_of_study || 1);
    setEditFaculty(u.faculty || '');
    setEditAssignedCourses(u.assigned_courses || []);
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
      const payload = {
        username: editUsername,
        email: editEmail,
        first_name: editFirstName,
        last_name: editLastName,
        phone: editPhone,
        role: editRole,
        tuition_paid_percentage: parseFloat(editTuitionPaid),
        reg_number: editRegNumber,
        year_of_study: parseInt(editYearOfStudy || 1),
        faculty: editFaculty ? parseInt(editFaculty) : null,
        assigned_courses: editAssignedCourses ? editAssignedCourses.map(id => parseInt(id)) : []
      };

      await api.patch(`/admin/users/${editingUser.id}/`, payload);
      setSuccessMsg('User details, year of study & course assignments updated successfully!');
      setEditingUser(null);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAssignYearAndCourses = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      setErrorMsg('Please select at least one student user account.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/users/bulk_assign_year_and_courses/', {
        user_ids: selectedUserIds,
        year_of_study: parseInt(bulkYearOfStudy || 1),
        faculty_id: bulkFacultyId ? parseInt(bulkFacultyId) : null,
        course_ids: bulkCourseIds ? bulkCourseIds.map(id => parseInt(id)) : []
      });
      setSuccessMsg(res.detail || `Bulk student allocation completed for ${selectedUserIds.length} accounts!`);
      setShowBulkAssignModal(false);
      setSelectedUserIds([]);
      loadAdminData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to apply bulk student allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resetUserObj || !newPasswordInput.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await api.post(`/admin/users/${resetUserObj.id}/reset_password/`, {
        new_password: newPasswordInput.trim()
      });
      setSuccessMsg(res.detail || `Password for ${resetUserObj.username} has been reset successfully!`);
      setResetUserObj(null);
      setNewPasswordInput('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset user password.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filtered students for dropdown
  const allStudentUsers = users.filter(u => u.role === 'student');
  const filteredStudentOptions = allStudentUsers.filter(u => {
    const term = studentSearchTerm.toLowerCase();
    return !term || 
      u.username.toLowerCase().includes(term) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.reg_number && u.reg_number.toLowerCase().includes(term)) ||
      (u.first_name && u.first_name.toLowerCase().includes(term)) ||
      (u.last_name && u.last_name.toLowerCase().includes(term));
  });

  // Group Counts
  const studentUsersCount = users.filter(u => u.role === 'student').length;
  const staffUsersCount = users.filter(u => u.role !== 'student').length;

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    // 1. Group filter
    if (userGroupFilter === 'students' && u.role !== 'student') return false;
    if (userGroupFilter === 'staff' && u.role === 'student') return false;

    // 2. Role filter
    if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;

    // 3. Clearance filter (for students)
    if (userClearanceFilter === 'cleared' && (u.role !== 'student' || u.tuition_paid_percentage < 100)) return false;
    if (userClearanceFilter === 'barred' && u.role === 'student' && u.tuition_paid_percentage >= 100) return false;

    // 4. Search filter (Name, Username, Email, Reg Number)
    if (userSearchTerm.trim()) {
      const term = userSearchTerm.toLowerCase().trim();
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const regNumber = (u.reg_number || u.registration_number || '').toLowerCase();
      if (!fullName.includes(term) && !username.includes(term) && !email.includes(term) && !regNumber.includes(term)) {
        return false;
      }
    }

    // 5. Faculty filter
    if (userFacultyFilter !== 'ALL') {
      const facId = String(u.faculty);
      const facCode = u.faculty_code || '';
      if (facId !== userFacultyFilter && facCode !== userFacultyFilter) return false;
    }

    // 6. Course filter
    if (userCourseFilter !== 'ALL') {
      const assignedIds = (u.assigned_courses || []).map(c => String(c));
      const assignedCodes = u.assigned_course_codes || [];
      if (!assignedIds.includes(userCourseFilter) && !assignedCodes.includes(userCourseFilter)) return false;
    }

    return true;
  });

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  const handleToggleSelectAllPaginated = () => {
    const pageIds = paginatedUsers.map(u => u.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedUserIds.includes(id));
    if (allPageSelected) {
      setSelectedUserIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Filtered logs
  const filteredLogs = systemLogs.filter((log) => {
    const matchesLevel = logLevelFilter === 'ALL' || log.level === logLevelFilter;
    const matchesSearch = log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
                          (log.details && log.details.toLowerCase().includes(logSearch.toLowerCase())) ||
                          (log.username && log.username.toLowerCase().includes(logSearch.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">Manage Users & Invites</h2>
          <p className="text-slate-500 text-xs font-medium">Manage user accounts, temporary exam clearances, student onboarding, invitations, and system audit logs.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncCIUClearance}
            disabled={submitting}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
          >
            <span>⚡ Sync CIU API</span>
          </button>

          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Proctoring: ACTIVE' : 'Proctoring: OFF'}
            </span>
            <button
              onClick={handleToggleProctoring}
              className="ml-2 px-2 py-0.5 bg-brand-dark text-white text-[10px] font-bold rounded hover:bg-brand-medium transition-all"
            >
              Toggle
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-xl text-red-700 text-xs font-semibold animate-slide-up">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-brand-emerald rounded-xl text-brand-medium text-xs font-semibold animate-slide-up">
          {successMsg}
        </div>
      )}

      {/* Navigation Tabs - Note: 'faculties' tab removed as requested */}
      <div className="flex space-x-4 border-b border-slate-200 pb-3 flex-wrap gap-y-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'users' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👥 User Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('temp_clearance')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'temp_clearance' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          ⏳ Temporary Clearance Manager
        </button>
        <button
          onClick={() => setActiveTab('excel_onboarding')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'excel_onboarding' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📥 Student Onboarding
        </button>
        <button
          onClick={() => setActiveTab('proctoring_monitor')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'proctoring_monitor' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🎥 Live Proctoring Monitor
        </button>
        <button
          onClick={() => setActiveTab('ciu_cleared')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'ciu_cleared' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🎓 Cleared Students
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

      {/* TAB 1: USERS DIRECTORY WITH USER GROUPS, SEARCH & ROLE FILTERS, PAGINATION & BULK DELETE */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Group Navigation Segmented Pills */}
            <div className="flex items-center justify-between bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => { setUserGroupFilter('all'); setCurrentPage(1); }}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all ${userGroupFilter === 'all' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  🌐 All Accounts ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setUserGroupFilter('students'); setCurrentPage(1); }}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 ${userGroupFilter === 'students' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <span>🎓 Students</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${userGroupFilter === 'students' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                    {studentUsersCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUserGroupFilter('staff'); setCurrentPage(1); }}
                  className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 ${userGroupFilter === 'staff' ? 'bg-brand-dark text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <span>👔 Staff & Executives</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${userGroupFilter === 'staff' ? 'bg-brand-medium text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {staffUsersCount}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSyncCIUClearance}
                disabled={submitting}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1 hidden sm:flex"
              >
                <span>⚡ Refresh Clearance Levels</span>
              </button>
            </div>

            {/* Filter Controls Bar */}
            <div className="green-card rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                
                {/* Search Input */}
                <div className="sm:col-span-2 md:col-span-1">
                  <label className="block text-slate-600 font-bold uppercase mb-1 text-[10px]">Search User</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Name, email, reg no..."
                      value={userSearchTerm}
                      onChange={(e) => { setUserSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-7 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-light focus:bg-white transition-all"
                    />
                    <span className="absolute left-2 top-2.5 text-slate-400 text-xs">🔍</span>
                  </div>
                </div>

                {/* Faculty Filter Dropdown */}
                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1 text-[10px]">Filter Faculty</label>
                  <select
                    value={userFacultyFilter}
                    onChange={(e) => { setUserFacultyFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                  >
                    <option value="ALL">All Faculties</option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.code}>{f.code} - {f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Course Filter Dropdown */}
                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1 text-[10px]">Filter Course</label>
                  <select
                    value={userCourseFilter}
                    onChange={(e) => { setUserCourseFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                  >
                    <option value="ALL">All Courses</option>
                    <option value="BIT2026">BIT - IT</option>
                    <option value="BBA2026">BBA - Business</option>
                    <option value="BCN2026">BCN - Nursing</option>
                    <option value="BPH2026">BPH - Pharmacy</option>
                  </select>
                </div>

                {/* Role Filter Dropdown */}
                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1 text-[10px]">Filter Role</label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => { setUserRoleFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                  >
                    <option value="ALL">All Roles</option>
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

                {/* Clearance Filter Dropdown */}
                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1 text-[10px]">Clearance Status</label>
                  <select
                    value={userClearanceFilter}
                    onChange={(e) => { setUserClearanceFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white"
                  >
                    <option value="ALL">All Clearance</option>
                    <option value="cleared">100% Cleared</option>
                    <option value="barred">0% Barred</option>
                  </select>
                </div>
              </div>
            </div>

            {/* User Directory Main Table Card */}
            <div className="green-card rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {userGroupFilter === 'students' ? '🎓 Registered Students' : userGroupFilter === 'staff' ? '👔 Staff & Executive Roster' : 'Registered System Accounts'}
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {filteredUsers.length} Match{filteredUsers.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  {selectedUserIds.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setBulkYearOfStudy(1);
                          setBulkFacultyId(faculties[0]?.id || '');
                          setBulkCourseIds([]);
                          setShowBulkAssignModal(true);
                        }}
                        disabled={submitting}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
                      >
                        <span>🎓 Bulk Assign Year & Courses ({selectedUserIds.length})</span>
                      </button>
                      <button
                        onClick={handleBulkResetPasswords}
                        disabled={submitting}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
                      >
                        <span>🔑 Reset Passwords ({selectedUserIds.length})</span>
                      </button>
                      <button
                        onClick={handleBulkDeleteUsers}
                        disabled={submitting}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
                      >
                        <span>🗑️ Delete Selected ({selectedUserIds.length})</span>
                      </button>
                    </div>
                  )}

                  {/* Page Size Selector */}
                  <div className="flex items-center space-x-1 text-xs font-bold text-slate-600">
                    <span>Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-3 py-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u.id))}
                          onChange={handleToggleSelectAllPaginated}
                          className="rounded border-slate-300 text-brand-dark focus:ring-brand-light cursor-pointer"
                          title="Select / Deselect Page Users"
                        />
                      </th>
                      <th className="px-4 py-3">User & Registration</th>
                      <th className="px-4 py-3">Role & Permissions</th>
                      <th className="px-4 py-3 text-center">Clearance Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-slate-500 font-medium">
                          No users match the selected group, filters, or search criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((u) => (
                        <tr key={u.id} className={`hover:bg-slate-50/80 transition-all ${selectedUserIds.includes(u.id) ? 'bg-emerald-50/50' : ''}`}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => handleToggleSelectUser(u.id)}
                              className="rounded border-slate-300 text-brand-dark focus:ring-brand-light cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-850">
                            <div className="font-bold text-slate-900">{u.first_name || u.username} {u.last_name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{u.email}</div>
                            {u.role === 'student' && (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {(u.reg_number || u.registration_number) && (
                                  <span className="text-[10px] text-brand-medium font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Reg: {u.reg_number || u.registration_number}
                                  </span>
                                )}
                                <span className="text-[10px] text-teal-800 font-extrabold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                  Year {u.year_of_study || 1}
                                </span>
                                {u.faculty_code && (
                                  <span className="text-[10px] text-blue-800 font-extrabold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                    {u.faculty_code}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${u.role === 'student' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : u.role === 'admin' ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {u.role === 'student' ? (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border shadow-2xs inline-flex items-center space-x-1 ${u.tuition_paid_percentage >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : u.tuition_paid_percentage >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                <span>{u.tuition_paid_percentage >= 100 ? '✅ 100% Cleared' : u.tuition_paid_percentage >= 50 ? `⚠️ ${u.tuition_paid_percentage}% Partial` : '🚫 0% Barred'}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-extrabold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                Staff Bypass
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center space-x-1">
                            <button
                              onClick={() => handleStartEdit(u)}
                              className="px-2.5 py-1 bg-white border border-emerald-200 hover:bg-emerald-50 text-slate-800 text-[11px] font-bold rounded-lg transition-all shadow-2xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setResetUserObj(u); setNewPasswordInput(''); }}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition-all shadow-2xs"
                            >
                              Reset Pass
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg border border-red-200 transition-all shadow-2xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
                <div className="text-slate-500 font-medium text-[11px]">
                  Showing <span className="font-bold text-slate-800">{filteredUsers.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-bold text-slate-800">{Math.min(startIndex + pageSize, filteredUsers.length)}</span> of <span className="font-bold text-slate-800">{filteredUsers.length}</span> user accounts {filteredUsers.length !== users.length && `(filtered from ${users.length} total)`}
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold transition-all"
                  >
                    « First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold transition-all"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-extrabold border border-emerald-200 rounded-lg text-[11px]">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold transition-all"
                  >
                    Next ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-bold transition-all"
                  >
                    Last »
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="green-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Generate User Invitation</h3>
              <form onSubmit={handleCreateInvite} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Invitee Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@ciu.ac.ug"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
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
                  className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {submitting ? 'Sending...' : 'Generate & Send Invite'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEMPORARY EXAM / TEST CLEARANCE MANAGER WITH EXCEL BULK UPLOAD */}
      {activeTab === 'temp_clearance' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Single Student Grant Form */}
            <div className="green-card rounded-2xl p-6 space-y-4">
              <div className="border-b border-emerald-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Grant Single Student Temporary Clearance</h3>
                <p className="text-[11px] text-slate-500 font-medium">Select an individual student to temporarily override exam/test fee clearance.</p>
              </div>

              <form onSubmit={handleGrantTemporaryClearance} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Search & Select Student</label>
                  <input
                    type="text"
                    placeholder="Search by Reg No, Name, or Email..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-2"
                  />
                  <select
                    value={selectedStudentForClearance}
                    onChange={(e) => setSelectedStudentForClearance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    required
                  >
                    <option value="">-- Choose Student Account --</option>
                    {filteredStudentOptions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.reg_number || s.registration_number} - {s.first_name} {s.last_name} ({s.tuition_paid_percentage}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Clearance Scope</label>
                  <select
                    value={clearanceScope}
                    onChange={(e) => setClearanceScope(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="both">Both Tests & Exams (50% & 100% Gates)</option>
                    <option value="tests">Tests Only (50% Fee Gate Bypass)</option>
                    <option value="exams">Exams Only (100% Fee Gate Bypass)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Duration Presets</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '3 Days', days: '3' },
                      { label: '1 Week', days: '7' },
                      { label: '2 Weeks', days: '14' },
                      { label: '3 Weeks', days: '21' },
                      { label: '1 Month', days: '30' },
                      { label: '60 Days', days: '60' },
                    ].map(p => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => setClearanceDurationDays(p.days)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${clearanceDurationDays === p.days ? 'bg-brand-dark text-white border-brand-dark shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Reason / Note</label>
                  <input
                    type="text"
                    value={clearanceReason}
                    onChange={(e) => setClearanceReason(e.target.value)}
                    placeholder="e.g. Dean Special Approval"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1"
                >
                  <span>⚡ Grant Single Temporary Clearance</span>
                </button>
              </form>
            </div>

            {/* Excel / CSV Bulk Temporary Clearance Upload Form */}
            <div className="green-card rounded-2xl p-6 space-y-4 border border-emerald-300">
              <div className="border-b border-emerald-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">📥 Multiple Student Excel Bulk Clearance</h3>
                <p className="text-[11px] text-slate-500 font-medium">Upload an Excel (.xlsx / .csv) file of student registration numbers to grant temporary clearance in bulk.</p>
              </div>

              <form onSubmit={handleBulkTempClearanceExcelUpload} className="space-y-4 text-xs">
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center bg-slate-50/50 transition-all">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setBulkClearanceFile(e.target.files[0])}
                    className="hidden"
                    id="bulk_clearance_file_input"
                  />
                  <label htmlFor="bulk_clearance_file_input" className="cursor-pointer font-bold text-brand-dark hover:underline text-xs block">
                    {bulkClearanceFile ? `Selected: ${bulkClearanceFile.name}` : 'Click to select Excel (.xlsx) or CSV file'}
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1">Header required: reg_number, registration_number, or student_no</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Scope</label>
                    <select
                      value={clearanceScope}
                      onChange={(e) => setClearanceScope(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    >
                      <option value="both">Both Tests & Exams</option>
                      <option value="tests">Tests Only</option>
                      <option value="exams">Exams Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Duration Days</label>
                    <select
                      value={clearanceDurationDays}
                      onChange={(e) => setClearanceDurationDays(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    >
                      <option value="3">3 Days</option>
                      <option value="7">1 Week (7 Days)</option>
                      <option value="14">2 Weeks (14 Days)</option>
                      <option value="21">3 Weeks (21 Days)</option>
                      <option value="30">1 Month (30 Days)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploadingBulkClearance || !bulkClearanceFile}
                  className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {uploadingBulkClearance ? 'Processing Excel File...' : '⚡ Upload Excel & Grant Bulk Clearance'}
                </button>
              </form>
            </div>

          </div>

          {/* Active Clearances Table */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active & Historical Temporary Clearances</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                Total Active: {tempClearances.filter(c => c.is_currently_valid).length}
              </span>
            </div>

            {loadingTempClearances ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : tempClearances.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Student & Reg No.</th>
                      <th className="px-4 py-3">Scope</th>
                      <th className="px-4 py-3">Status / Expiry</th>
                      <th className="px-4 py-3">Granted By</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tempClearances.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{c.student_name}</div>
                          <div className="text-[11px] font-mono text-brand-medium font-bold">{c.student_reg_number}</div>
                          <div className="text-[10px] text-slate-400 font-medium italic">{c.reason}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-cyan-50 text-cyan-800 border border-cyan-200">
                            {c.clearance_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.is_currently_valid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                              🟢 Active (Expires {new Date(c.expires_at).toLocaleDateString()})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 inline-block">
                              🔴 Expired / Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {c.granted_by_username || 'Admin'}
                        </td>
                        <td className="px-4 py-3 text-center space-x-1">
                          <button
                            onClick={() => handleExtendClearance(c.id, 7)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-200 transition-all"
                          >
                            +7 Days
                          </button>
                          {c.is_active && (
                            <button
                              onClick={() => handleRevokeClearance(c.id)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded border border-red-200 transition-all"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold space-y-2">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold border border-emerald-200">
                  ⏳
                </div>
                <p className="font-bold text-slate-800 text-sm">No Temporary Clearance Records Found</p>
                <p className="text-[11px] text-slate-400 font-medium">Total Active Overrides Count: 0 | Total Clearance History: 0</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT ONBOARDING (SINGLE & BATCH EXCEL) */}
      {activeTab === 'excel_onboarding' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="green-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">🎓 Student Onboarding Portal</h3>
                <p className="text-slate-500 text-xs mt-0.5">Onboard single students or import batch student registration files with One-Time Passwords.</p>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setOnboardingMode('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${onboardingMode === 'single' ? 'bg-brand-dark text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  👤 Single Student
                </button>
                <button
                  onClick={() => setOnboardingMode('excel')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${onboardingMode === 'excel' ? 'bg-brand-dark text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  📥 Batch Excel / CSV
                </button>
              </div>
            </div>

            {/* SINGLE STUDENT ONBOARDING FORM */}
            {onboardingMode === 'single' ? (
              <form onSubmit={handleSingleStudentOnboarding} className="space-y-4 text-xs animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Registration Number *</label>
                    <input
                      type="text"
                      value={singleRegNumber}
                      onChange={(e) => setSingleRegNumber(e.target.value)}
                      placeholder="e.g. 2026SOBAT-A001"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      value={singleFullName}
                      onChange={(e) => setSingleFullName(e.target.value)}
                      placeholder="e.g. John Doe Kakungulu"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)}
                      placeholder="e.g. j.doe@student.ciu.ac.ug"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1">Assigned Faculty</label>
                    <select
                      value={singleFaculty}
                      onChange={(e) => setSingleFaculty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="">-- Choose Faculty --</option>
                      {faculties.map(f => (
                        <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Initial One-Time Password (Optional)</label>
                  <input
                    type="text"
                    value={singleInitialPassword}
                    onChange={(e) => setSingleInitialPassword(e.target.value)}
                    placeholder="e.g. CIU2026! (Leave blank to generate random OTP)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                    🔒 Student will be prompted to set a new permanent password on first login. Default tuition clearance is set to 0.0%.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  <span>⚡ Onboard Single Student & Issue OTP</span>
                </button>
              </form>
            ) : (
              /* BATCH EXCEL ONBOARDING FORM */
              <form onSubmit={handleExcelOnboardingSubmit} className="space-y-4 text-xs animate-fade-in">
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/50 transition-all">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setExcelFile(e.target.files[0])}
                    className="hidden"
                    id="excel_upload_input"
                  />
                  <label htmlFor="excel_upload_input" className="cursor-pointer font-bold text-brand-dark hover:underline text-xs">
                    {excelFile ? `Selected: ${excelFile.name}` : 'Click to choose Excel (.xlsx / .xls) or CSV file'}
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Headers required: reg_number, full_name, email, faculty</p>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Batch Initial Password (Optional)</label>
                  <input
                    type="text"
                    value={customDefaultPass}
                    onChange={(e) => setCustomDefaultPass(e.target.value)}
                    placeholder="e.g. CIU2026! (Leave blank to generate random OTP per student)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                    🔒 All onboarded students are flagged to set a new password on first login. Default tuition clearance is set to 0.0%.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={uploadingExcel || !excelFile}
                  className="w-full py-3 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {uploadingExcel ? 'Processing Batch Import...' : '⚡ Onboard Students & Generate Passwords'}
                </button>
              </form>
            )}
          </div>

          {onboardingResults.length > 0 && (
            <div className="green-card rounded-2xl p-6 space-y-4 animate-slide-up">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                <h4 className="text-sm font-bold text-slate-800">Generated Credentials Report ({onboardingResults.length} Students)</h4>
                <button
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," + 
                      ["Registration Number,Full Name,Email,Faculty,One Time Password"]
                        .concat(onboardingResults.map(s => `"${s.reg_number}","${s.full_name}","${s.email}","${s.faculty}","${s.one_time_password}"`))
                        .join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Student_Credentials_${new Date().toISOString().slice(0,10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  📥 Download Credentials CSV
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-4 py-3">Reg No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-center">Faculty</th>
                      <th className="px-4 py-3 font-mono text-center">One-Time Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {onboardingResults.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-2 font-mono font-bold text-brand-medium">{s.reg_number}</td>
                        <td className="px-4 py-2 font-bold text-slate-900">{s.full_name}</td>
                        <td className="px-4 py-2 text-slate-500">{s.email}</td>
                        <td className="px-4 py-2 text-center font-bold">{s.faculty}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-xs inline-block">
                            {s.one_time_password}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE EXAM PROCTORING MONITOR GRID */}
      {activeTab === 'proctoring_monitor' && (
        <div className="space-y-6">
          <div className="green-card p-5 rounded-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-850 text-base">🎥 Live Exam Candidate Proctoring Monitor</h3>
              <p className="text-slate-500 text-xs">Real-time candidate camera feeds and tab-switching surveillance for ongoing exams/tests.</p>
            </div>
            <button
              onClick={fetchLiveProctorFeeds}
              className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              {loadingProctorFeeds ? 'Refreshing...' : '🔄 Refresh Camera Feeds'}
            </button>
          </div>

          {liveProctorFeeds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveProctorFeeds.map((feed) => (
                <div key={feed.id} className="green-card rounded-2xl p-4 space-y-3 border border-slate-200">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {feed.image_data ? (
                      <img src={feed.image_data} alt={feed.student_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-500 text-xs font-bold">No Video Signal</div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-white text-[10px] font-bold flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>LIVE</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{feed.student_name}</h4>
                      <p className="text-[10px] font-mono text-brand-medium font-bold">{feed.student_reg_number}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${feed.tab_switches_count >= 3 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                      Tab Switches: {feed.tab_switches_count}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleIssueProctorWarning(feed.student, 'warning')}
                      className="flex-1 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200 transition-all"
                    >
                      ⚠️ Warn Candidate
                    </button>
                    <button
                      onClick={() => handleIssueProctorWarning(feed.student, 'terminate')}
                      className="flex-1 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg border border-red-200 transition-all"
                    >
                      🛑 Terminate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold">
              No active candidates taking exams with camera feeds currently streaming.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CLEARED STUDENTS */}
      {activeTab === 'ciu_cleared' && (
        <div className="space-y-6">
          <div className="green-card p-5 rounded-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-850 text-base">Faculty Cleared Students Directory</h3>
              <p className="text-slate-500 text-xs">Students organized by Faculties with live API validation status.</p>
            </div>
            <button
              onClick={fetchClearedFacultyData}
              disabled={loadingCleared}
              className="px-3 py-1 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              {loadingCleared ? 'Refreshing...' : 'Refresh Feed'}
            </button>
          </div>

          {loadingCleared ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {clearedFacultyData?.faculties && Object.keys(clearedFacultyData.faculties).length > 0 ? (
                Object.entries(clearedFacultyData.faculties).map(([facName, facData]) => (
                  <div key={facName} className="green-card rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 bg-brand-light/10 text-brand-dark border border-brand-light/20 text-xs font-black rounded uppercase">
                          {facData.code}
                        </span>
                        <h4 className="font-bold text-slate-850 text-sm">{facName}</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500">Students: {facData.students?.length || 0}</span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3">Registration Number</th>
                            <th className="px-4 py-3 text-center">Exam Gate (100%)</th>
                            <th className="px-4 py-3 text-center">Test Gate (50%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {facData.students?.map((st) => (
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

              {clearedFacultyData && (
                <div className="green-card rounded-2xl p-6 space-y-4 border border-cyan-200">
                  <div className="flex justify-between items-center border-b border-cyan-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-850 text-sm">⚡ External CIU API Live Payload Records</h4>
                      <p className="text-[11px] text-slate-500">Live records retrieved directly from https://eadmin.ciu.ac.ug/API/ClearedStudentsAPI.aspx</p>
                    </div>
                    <span className="text-xs font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-xl border border-cyan-200">
                      Total Live Records: {clearedFacultyData.all_payload_records?.length || 0}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                          <th className="px-4 py-3">Registration No</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Program</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(clearedFacultyData.all_payload_records || []).map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50 transition-all">
                            <td className="px-4 py-2 font-mono font-bold text-brand-medium">{rec.reg_number}</td>
                            <td className="px-4 py-2 font-bold text-slate-900">{rec.student_name}</td>
                            <td className="px-4 py-2 text-slate-600">{rec.program}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 6: INVITATIONS (WITH DELETE INVITATION ACTION) */}
      {activeTab === 'invites' && (
        <div className="green-card rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dispatched User Invitations</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="px-4 py-3">Invitee Email</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Created At</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-4 py-3 font-bold text-slate-900">{inv.email}</td>
                    <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-600">{inv.role}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${inv.is_used ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                        {inv.is_used ? 'REDEEMED' : 'ACTIVE TOKEN'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(inv.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteInvite(inv.id)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200 transition-all"
                        title="Delete invitation token"
                      >
                        🗑️ Delete Invite
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="green-card rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">🛡️ Security & System Audit Trail</h3>
              <p className="text-slate-500 text-xs">Tracking test starts, submissions, clearance grants, and exam approvals.</p>
            </div>
            <button
              onClick={downloadAuditLogsCSV}
              className="px-3.5 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              📥 Export Audit CSV
            </button>
          </div>

          <div className="flex space-x-3">
            <input
              type="text"
              placeholder="Search audit trail by event action or user..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
            <select
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
            >
              <option value="ALL">All Levels</option>
              <option value="AUDIT">AUDIT</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Event Action</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${log.level === 'AUDIT' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : log.level === 'WARNING' ? 'bg-amber-50 text-amber-800 border-amber-200' : log.level === 'ERROR' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {log.username || 'System'}
                    </td>
                    <td className="px-4 py-3 font-bold text-brand-medium">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-[11px]">
                      {log.details || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL DIALOG */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">✏️ Edit Account: {editingUser.username}</h3>
                <p className="text-slate-500 text-xs">Update profile information, assigned role, and fee clearance status.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
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
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Registration Number</label>
                  <input
                    type="text"
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    placeholder="e.g. 2026BACTFT-A001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              {editRole === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Academic Year of Study</label>
                      <select
                        value={editYearOfStudy}
                        onChange={(e) => setEditYearOfStudy(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                      >
                        <option value={1}>Year 1</option>
                        <option value={2}>Year 2</option>
                        <option value={3}>Year 3</option>
                        <option value={4}>Year 4</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Assigned Faculty</label>
                      <select
                        value={editFaculty}
                        onChange={(e) => setEditFaculty(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                      >
                        <option value="">-- No Faculty --</option>
                        {faculties.map(f => (
                          <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Enrolled Degree Courses</label>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                      {courses.map(c => {
                        const isChecked = editAssignedCourses.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditAssignedCourses(prev => [...prev, c.id]);
                                } else {
                                  setEditAssignedCourses(prev => prev.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                            />
                            <span className="font-bold text-slate-800">{c.code}</span>
                            <span className="text-slate-600">({c.name})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Tuition Paid / Clearance Level (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={editTuitionPaid}
                      onChange={(e) => setEditTuitionPaid(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-brand-dark"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">50% clears student for Tests; 100% clears student for Exams.</p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Save User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL DIALOG */}
      {resetUserObj && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">🔑 Reset Password</h3>
                <p className="text-slate-500 text-xs">Reset password for <span className="font-bold text-brand-dark">{resetUserObj.first_name || resetUserObj.username} {resetUserObj.last_name}</span>.</p>
              </div>
              <button
                type="button"
                onClick={() => setResetUserObj(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">New User Password</label>
                <input
                  type="password"
                  placeholder="Enter strong new password..."
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full px-3 me-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetUserObj(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-sm"
                >
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* BULK STUDENT ALLOCATION MODAL */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">🎓 Bulk Student Allocation</h3>
                <p className="text-slate-500 text-xs">Assign Year of Study, Faculty, and Courses to <span className="font-bold text-brand-dark">{selectedUserIds.length} selected student(s)</span>.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAssignModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkAssignYearAndCourses} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Target Academic Year of Study</label>
                  <select
                    value={bulkYearOfStudy}
                    onChange={(e) => setBulkYearOfStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    required
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Target Faculty</label>
                  <select
                    value={bulkFacultyId}
                    onChange={(e) => setBulkFacultyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="">-- Keep Current / No Change --</option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1 text-[10px]">Assign Enrolled Degree Courses</label>
                <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                  {courses.map(c => {
                    const isChecked = bulkCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkCourseIds(prev => [...prev, c.id]);
                            } else {
                              setBulkCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-brand-dark focus:ring-brand-light cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">{c.code}</span>
                        <span className="text-slate-600">({c.name})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkAssignModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md"
                >
                  {submitting ? 'Applying...' : `Confirm Bulk Allocation (${selectedUserIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
