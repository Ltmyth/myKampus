'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, formatUgandanTime, getUgandanISOString, toUgandanDatetimeLocal, getUgandanNowDatetimeLocal } from '@/lib/api';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function TestPortalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseUnits, setCourseUnits] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
  const [loading, setLoading] = useState(true);

  // Universal Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
    icon: null,
    onConfirm: null,
    loading: false
  });

  const showConfirm = ({
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    icon = null,
    onConfirm
  }) => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      confirmText,
      cancelText,
      variant,
      icon,
      onConfirm,
      loading: false
    });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, loading: false }));
  };

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'builder', 'analytics', 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [selectedCourseUnitFilter, setSelectedCourseUnitFilter] = useState('');
  const [selectedTestStatusFilter, setSelectedTestStatusFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState('All');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('All');
  const [selectedAcademicYearFilter, setSelectedAcademicYearFilter] = useState('All');
  // Bulk Actions & Expansion State for Tests
  const [selectedTestIds, setSelectedTestIds] = useState([]);
  const [expandedTestIds, setExpandedTestIds] = useState([]);

  const toggleExpandTest = (testId) => {
    setExpandedTestIds(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  const handleToggleSelectTest = (testId) => {
    setSelectedTestIds(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  const handleToggleSelectAllTests = () => {
    if (selectedTestIds.length >= filteredTests.length && filteredTests.length > 0) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(filteredTests.map(t => t.id));
    }
  };

  const handleBulkDeleteTests = () => {
    if (selectedTestIds.length === 0) return;
    const count = selectedTestIds.length;
    showConfirm({
      title: 'Bulk Delete Tests',
      description: `Are you sure you want to permanently delete ${count} selected test(s)? All student attempts, scores, and questions will be permanently removed.`,
      confirmText: `Delete ${count} Tests`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await api.post('/tests/bulk_delete/', { test_ids: selectedTestIds });
          setSuccessMsg(res?.detail || `Deleted ${count} tests successfully.`);
          setSelectedTestIds([]);
          closeConfirm();
          loadPortalData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete selected tests.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleBulkPublishTests = async (publishStatus) => {
    if (selectedTestIds.length === 0) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/tests/bulk_publish/', {
        test_ids: selectedTestIds,
        is_published: publishStatus
      });
      setSuccessMsg(res?.detail || `Successfully ${publishStatus ? 'published' : 'unpublished'} selected tests.`);
      setSelectedTestIds([]);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to update publication status.');
    }
  };

  // Submissions Tab Filter & Pagination States
  const [selectedTestFilter, setSelectedTestFilter] = useState('All');
  const [selectedCourseSubFilter, setSelectedCourseSubFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(10);

  // Fee Gate Alert Modal
  const [showFeeGateModal, setShowFeeGateModal] = useState(false);
  const [feeGateMessage, setFeeGateMessage] = useState('');

  // Test Builder State
  const [title, setTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [targetCourseIds, setTargetCourseIds] = useState([]);
  const [targetYears, setTargetYears] = useState([]);
  const [selectedCourseUnit, setSelectedCourseUnit] = useState('');
  const [targetCourseUnitIds, setTargetCourseUnitIds] = useState([]);
  const [category, setCategory] = useState('quiz');
  const [duration, setDuration] = useState(30);
  const [passPercentage, setPassPercentage] = useState(50);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [yearOfStudy, setYearOfStudy] = useState(0); // 0 = All Years, 1-4 = Year X
  const [description, setDescription] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [testSemester, setTestSemester] = useState('0');
  const [testAcademicYear, setTestAcademicYear] = useState('2026/2027');

  // Edit Test Modal State
  const [editingTestModal, setEditingTestModal] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editPassPercentage, setEditPassPercentage] = useState(50);
  const [editAllowedAttempts, setEditAllowedAttempts] = useState(1);
  const [editScheduledStart, setEditScheduledStart] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAdditionalCourseUnits, setEditAdditionalCourseUnits] = useState([]);

  // Live Attempting Students Modal State
  const [liveStudentsModal, setLiveStudentsModal] = useState({
    isOpen: false,
    test: null,
    loading: false,
    data: null,
    statusFilter: 'All',
    search: '',
    groupBy: 'none'
  });

  const openLiveStudentsModal = async (testItem) => {
    setLiveStudentsModal({
      isOpen: true,
      test: testItem,
      loading: true,
      data: null,
      statusFilter: 'All',
      search: '',
      groupBy: 'none'
    });
    try {
      const data = await api.get(`/tests/${testItem.id}/live_students/`);
      setLiveStudentsModal(prev => ({ ...prev, loading: false, data }));
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to load live students data.');
      setLiveStudentsModal(prev => ({ ...prev, loading: false }));
    }
  };

  const closeLiveStudentsModal = () => {
    setLiveStudentsModal(prev => ({ ...prev, isOpen: false, test: null, data: null }));
  };

  // Question Builder State
  const [selectedTest, setSelectedTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState('mcq');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [points, setPoints] = useState(1.0);
  const [explanation, setExplanation] = useState('');

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Aiken TXT Upload Modal State
  const [showTxtModal, setShowTxtModal] = useState(false);
  const [txtMode, setTxtMode] = useState('new'); // 'new' | 'append'
  const [txtFile, setTxtFile] = useState(null);
  const [txtText, setTxtText] = useState('');
  const [txtTitle, setTxtTitle] = useState('');
  const [txtCourseUnit, setTxtCourseUnit] = useState('');
  const [txtDuration, setTxtDuration] = useState(60);
  const [txtScheduledStart, setTxtScheduledStart] = useState('');
  const [txtDueDate, setTxtDueDate] = useState('');
  const [txtCategory, setTxtCategory] = useState('unit_test');

  // Scorecard Preview Modal State
  const [scorecardPreviewData, setScorecardPreviewData] = useState(null);
  const [loadingScorecardPreview, setLoadingScorecardPreview] = useState(false);
  const [editingQId, setEditingQId] = useState(null);
  const [showScorecardAddQ, setShowScorecardAddQ] = useState(false);
  const [qEditForm, setQEditForm] = useState({
    question_text: '',
    question_type: 'mcq',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    points: 1.0,
    explanation: ''
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'platform_coordinator';
  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isStaff = ['lecturer', 'admin', 'platform_coordinator', 'faculty_admin', 'dean', 'registrar', 'dvc', 'vc'].includes(user?.role);
  const isLecturer = user?.role === 'lecturer';
  const canBuildTest = ['lecturer', 'admin', 'platform_coordinator'].includes(user?.role) && !['faculty_admin', 'dean', 'registrar', 'dvc', 'vc'].includes(user?.role);

  useEffect(() => {
    loadPortalData();
  }, []);

  async function loadPortalData() {
    try {
      setLoading(true);
      const [testsData, coursesData, unitsData, facsData, attemptsData, procData] = await Promise.all([
        api.get('/tests/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/faculties/').catch(() => []),
        api.get('/test-attempts/').catch(() => []),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);
      setTests(testsData || []);
      setCourses(coursesData || []);
      setCourseUnits(unitsData || []);
      setFaculties(facsData || []);
      setAttempts(attemptsData || []);
      setProctoringSetting(procData || { is_proctoring_enabled: true });
    } catch (err) {
      setErrorMsg('Failed to fetch test portal datasets.');
    } finally {
      setLoading(false);
    }
  }

  // Filter assigned courses and course units based on user role
  const assignedCourses = isLecturer
    ? courses.filter(c => courseUnits.some(u => (u.course_code === c.code || u.course === c.id) && (u.lecturer_details?.some(l => l.id === user.id) || u.lecturers?.includes(user.id))))
    : user?.role === 'student'
    ? courses.filter(c => (user?.assigned_courses || []).includes(c.id) || (user?.assigned_course_codes || []).includes(c.code) || (!user?.assigned_courses?.length && (c.faculty === user?.faculty || c.faculty_code === user?.faculty_code)))
    : courses;

  const assignedCourseUnits = isLecturer
    ? courseUnits.filter(u => u.lecturer_details?.some(l => l.id === user.id) || u.lecturers?.includes(user.id))
    : isAdmin
    ? courseUnits
    : courseUnits.filter(u => (assignedCourses || []).some(c => c.code === u.course_code || c.id === u.course));

  const scopedFaculties = isLecturer
    ? faculties.filter(f => (assignedCourses || []).some(c => c.faculty === f.id || c.faculty_code === f.code) || (user?.faculty && (f.id === user.faculty || String(f.id) === String(user.faculty))) || (user?.faculty_code && f.code === user.faculty_code))
    : user?.role === 'student'
    ? faculties.filter(f => (user?.faculty && (f.id === user.faculty || String(f.id) === String(user.faculty))) || (user?.faculty_code && f.code === user.faculty_code) || (assignedCourses || []).some(c => c.faculty === f.id || c.faculty_code === f.code))
    : faculties;

  // Filtered Submissions Logic
  const filteredSubmissions = attempts.filter((att) => {
    if (selectedTestFilter !== 'All' && String(att.test) !== String(selectedTestFilter)) return false;
    if (selectedCourseSubFilter !== 'All' && String(att.test_course_id || att.course) !== String(selectedCourseSubFilter) && att.test_course_code !== selectedCourseSubFilter) return false;
    if (selectedStatusFilter === 'passed' && !att.passed) return false;
    if (selectedStatusFilter === 'failed' && att.passed) return false;
    if (submissionSearch) {
      const q = submissionSearch.toLowerCase();
      const sName = (att.student_name || '').toLowerCase();
      const sUser = (att.student_username || '').toLowerCase();
      const sReg = (att.student_reg_number || '').toLowerCase();
      const tTitle = (att.test_title || '').toLowerCase();
      if (!sName.includes(q) && !sUser.includes(q) && !sReg.includes(q) && !tTitle.includes(q)) return false;
    }
    return true;
  });

  const subTotalCount = filteredSubmissions.length;
  const subPassedCount = filteredSubmissions.filter(a => a.passed).length;
  const subPassRate = subTotalCount > 0 ? ((subPassedCount / subTotalCount) * 100).toFixed(1) : '0.0';
  const subAvgScore = subTotalCount > 0 ? (filteredSubmissions.reduce((acc, a) => acc + (a.score || 0), 0) / subTotalCount).toFixed(1) : '0.0';

  const handleSelectCourseUnit = (unitId) => {
    setSelectedCourseUnit(unitId);
    if (unitId) {
      const u = courseUnits.find(item => item.id === parseInt(unitId));
      if (u) {
        const parentC = courses.find(c => c.code === u.course_code || c.id === u.course);
        if (parentC) setSelectedCourse(parentC.id);
        if (u.year_of_study) setYearOfStudy(u.year_of_study);
        if (u.semester) setTestSemester(String(u.semester));
      }
    }
  };

  const handleDeleteTest = (testItem) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && testItem.lecturer !== user.id && testItem.lecturer_name !== user.username) {
      setErrorMsg('Permission Denied: You can only delete tests created by you.');
      return;
    }
    showConfirm({
      title: 'Delete Test Paper',
      description: `Are you sure you want to delete "${testItem.title || 'this test'}"? Student submissions and score records will be permanently removed.`,
      confirmText: 'Delete Test',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await api.delete(`/tests/${testItem.id}/`);
          setSuccessMsg('Test paper deleted successfully.');
          if (selectedTest?.id === testItem.id) setSelectedTest(null);
          closeConfirm();
          loadPortalData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete test paper.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleOpenEditTestModal = (testItem) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && testItem.lecturer !== user.id && testItem.lecturer_name !== user.username) {
      setErrorMsg('Permission Denied: You can only edit tests created by you.');
      return;
    }
    setEditingTestModal(testItem);
    setEditTitle(testItem.title);
    setEditDuration(testItem.duration_minutes || 30);
    setEditPassPercentage(testItem.pass_percentage || 50);
    setEditAllowedAttempts(testItem.allowed_attempts || 1);
    setEditScheduledStart(toUgandanDatetimeLocal(testItem.scheduled_start));
    setEditDueDate(toUgandanDatetimeLocal(testItem.due_date));
  };

  const handleSaveEditTest = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly || !editingTestModal) return;
    if (editScheduledStart && new Date(editScheduledStart).getTime() < Date.now() - 60000) {
      setErrorMsg('Validation Error: Test start date & time cannot be in the past. Ugandan time (EAT) is strictly enforced.');
      return;
    }
    if (editDueDate) {
      if (new Date(editDueDate).getTime() < Date.now() - 60000) {
        setErrorMsg('Validation Error: Test stop date & time cannot be in the past. Ugandan time (EAT) is strictly enforced.');
        return;
      }
      if (editScheduledStart && new Date(editDueDate).getTime() <= new Date(editScheduledStart).getTime()) {
        setErrorMsg('Validation Error: Stop date & time must be strictly after the start date & time.');
        return;
      }
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: editTitle,
        duration_minutes: parseInt(editDuration),
        pass_percentage: parseFloat(editPassPercentage),
        allowed_attempts: parseInt(editAllowedAttempts),
        scheduled_start: getUgandanISOString(editScheduledStart),
        due_date: getUgandanISOString(editDueDate),
        additional_course_units: editAdditionalCourseUnits.map(id => parseInt(id))
      };

      await api.patch(`/tests/${editingTestModal.id}/`, payload);
      setSuccessMsg(`Test paper '${editTitle}' updated successfully!`);
      setEditingTestModal(null);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update test paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly) return;
    const finalCourseIds = targetCourseIds.length > 0 ? targetCourseIds : (selectedCourse ? [parseInt(selectedCourse)] : []);
    if (!title || (finalCourseIds.length === 0 && !selectedCourseUnit)) {
      setErrorMsg('Please specify a test title, course unit, and course program(s).');
      return;
    }
    if (!isAdmin && yearOfStudy === 0 && !selectedCourseUnit) {
      setErrorMsg('Only System Administrators can set tests for All Course Units & All Years (Year 0). Please select an assigned course unit.');
      return;
    }
    if (scheduledStart && new Date(scheduledStart).getTime() < Date.now() - 60000) {
      setErrorMsg('Validation Error: Test start date & time cannot be in the past. Ugandan time (EAT) is strictly enforced.');
      return;
    }
    if (dueDate) {
      if (new Date(dueDate).getTime() < Date.now() - 60000) {
        setErrorMsg('Validation Error: Test stop date & time cannot be in the past. Ugandan time (EAT) is strictly enforced.');
        return;
      }
      if (scheduledStart && new Date(dueDate).getTime() <= new Date(scheduledStart).getTime()) {
        setErrorMsg('Validation Error: Stop date & time must be strictly after the start date & time.');
        return;
      }
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title,
        course: selectedCourse ? parseInt(selectedCourse) : (finalCourseIds[0] || null),
        target_course_ids: finalCourseIds.map(id => parseInt(id)),
        course_unit: selectedCourseUnit ? parseInt(selectedCourseUnit) : null,
        additional_course_units: targetCourseUnitIds.map(id => parseInt(id)),
        category,
        duration_minutes: parseInt(duration),
        pass_percentage: parseFloat(passPercentage),
        allowed_attempts: parseInt(allowedAttempts),
        year_of_study: parseInt(yearOfStudy),
        target_years: targetYears.length > 0 ? targetYears.map(y => parseInt(y)) : [parseInt(yearOfStudy || 1)],
        description,
        semester: parseInt(testSemester || 0),
        academic_year: testAcademicYear || '2026/2027',
        is_published: true,
        scheduled_start: getUgandanISOString(scheduledStart),
        due_date: getUgandanISOString(dueDate)
      };

      const created = await api.post('/tests/', payload);
      setSuccessMsg('Test paper(s) created successfully! You can manage questions below.');
      setTitle('');
      setSelectedCourse('');
      setTargetCourseIds([]);
      setTargetYears([]);
      setSelectedCourseUnit('');
      setTargetCourseUnitIds([]);
      setDescription('');
      setScheduledStart('');
      setDueDate('');
      setTestSemester('0');
      setTestAcademicYear('2026/2027');
      loadPortalData();
      if (created && !Array.isArray(created)) setSelectedTest(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create test paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadTxtTest = async (e) => {
    e.preventDefault();
    if (!txtFile && !txtText.trim()) {
      setErrorMsg('Please select a .txt file or paste Aiken formatted text.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (txtFile) {
        formData.append('file', txtFile);
      } else {
        formData.append('txt_text', txtText);
      }

      if (txtMode === 'append' && selectedTest) {
        const res = await api.post(`/tests/${selectedTest.id}/import_txt_questions/`, formData);
        setSuccessMsg(res.detail || `Successfully imported ${res.questions_imported || 0} questions into test!`);
        setShowTxtModal(false);
        setTxtFile(null);
        setTxtText('');
        const qData = await api.get(`/test-questions/?test_id=${selectedTest.id}`);
        setQuestions(qData || []);
        loadPortalData();
      } else {
        if (!txtCourseUnit) {
          setErrorMsg('Please select a Course Unit for the new test.');
          setSubmitting(false);
          return;
        }
        formData.append('title', txtTitle || 'Aiken Imported Test');
        formData.append('course_unit', txtCourseUnit);
        formData.append('category', txtCategory);
        formData.append('duration_minutes', txtDuration);
        formData.append('semester', testSemester || '0');
        formData.append('academic_year', testAcademicYear || '2026/2027');
        if (txtScheduledStart) formData.append('scheduled_start', txtScheduledStart);
        if (txtDueDate) formData.append('due_date', txtDueDate);

        const res = await api.post('/tests/create_from_txt/', formData);
        setSuccessMsg(res.detail || `Test "${res.title}" created with ${res.questions_count || 0} questions!`);
        setShowTxtModal(false);
        setTxtFile(null);
        setTxtText('');
        loadPortalData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import .txt test paper. Check Aiken formatting.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleAiken = () => {
    const sample = `A patient correctly states their name but cannot identify the hospital or date. How should this be documented?
A. Alert and oriented ×3
B. Alert and oriented ×2
C. Disoriented
D. Confused
ANSWER: B

A patient opens eyes only when painful stimuli is applied. This level of consciousness is:
A. Lethargic
B. Obtunded
C. Stuporous
D. Comatose
ANSWER: C

Double vision (diplopia) indicates dysfunction of:
A. CN I
B. CN II
C. CN III, IV, or VI
D. CN VIII
ANSWER: C`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_aiken_questions.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleTogglePublish = async (testItem) => {
    if (isExecutiveReadOnly) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/tests/${testItem.id}/publish/`);
      setSuccessMsg(res.detail);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Publication status toggle failed.');
    }
  };

  const handlePreviewScorecard = async (testItem) => {
    try {
      setLoadingScorecardPreview(true);
      const data = await api.get(`/tests/${testItem.id}/preview_scorecard/`);
      setScorecardPreviewData(data);
      setEditingQId(null);
      setShowScorecardAddQ(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load scorecard preview.');
    } finally {
      setLoadingScorecardPreview(false);
    }
  };

  const handleSaveScorecardQuestion = async (testId, qId = null) => {
    try {
      if (qId) {
        await api.patch(`/test-questions/${qId}/`, qEditForm);
        setSuccessMsg('Question updated successfully inside scorecard!');
      } else {
        await api.post(`/tests/${testId}/questions/`, qEditForm);
        setSuccessMsg('New question added to scorecard!');
      }
      setEditingQId(null);
      setShowScorecardAddQ(false);
      const updated = await api.get(`/tests/${testId}/preview_scorecard/`);
      setScorecardPreviewData(updated);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save question.');
    }
  };

  const handleDeleteScorecardQuestion = (testId, qId) => {
    showConfirm({
      title: 'Delete Question',
      description: 'Are you sure you want to delete this question from the scorecard?',
      confirmText: 'Delete Question',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/test-questions/${qId}/`);
          setSuccessMsg('Question deleted from scorecard.');
          const updated = await api.get(`/tests/${testId}/preview_scorecard/`);
          setScorecardPreviewData(updated);
          closeConfirm();
          loadPortalData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete question.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleToggleResultsRelease = async (testItem) => {
    if (isExecutiveReadOnly) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/tests/${testItem.id}/release_results/`);
      setSuccessMsg(res.detail);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle test results release status.');
    }
  };

  const handleToggleProctoring = async () => {
    if (isExecutiveReadOnly) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/proctoring-settings/toggle/');
      setSuccessMsg(res.detail);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle proctoring.');
    }
  };

  const handleSelectTestForQuestions = async (testItem) => {
    setSelectedTest(testItem);
    setActiveTab('builder');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const qData = await api.get(`/tests/${testItem.id}/questions/`);
      setQuestions(qData || []);
    } catch (err) {
      setErrorMsg('Failed to fetch questions for selected test.');
    }
  };

  const handleStartNewTestBuilder = () => {
    setSelectedTest(null);
    setQuestions([]);
    setTitle('');
    setSelectedCourse('');
    setTargetCourseIds([]);
    setTargetYears([]);
    setSelectedCourseUnit('');
    setTargetCourseUnitIds([]);
    setDescription('');
    setScheduledStart('');
    setDueDate('');
    setTestSemester('0');
    setTestAcademicYear('2026/2027');
    setActiveTab('builder');
  };

  const hasActiveCatalogFilters = Boolean(
    searchQuery.trim() ||
    (selectedFacultyFilter !== 'All') ||
    (selectedTestStatusFilter !== 'All') ||
    selectedCourseFilter ||
    selectedCourseUnitFilter ||
    selectedCategoryFilter ||
    (selectedSemesterFilter !== 'All') ||
    (selectedAcademicYearFilter !== 'All')
  );

  const handleResetCatalogFilters = () => {
    setSearchQuery('');
    setSelectedFacultyFilter('All');
    setSelectedTestStatusFilter('All');
    setSelectedCourseFilter('');
    setSelectedCourseUnitFilter('');
    setSelectedCategoryFilter('');
    setSelectedSemesterFilter('All');
    setSelectedAcademicYearFilter('All');
  };

  const renderSubmissionTypeBadge = (type, reason) => {
    const t = (type || '').toLowerCase();
    if (t === 'security logs' || (reason && (reason.toLowerCase().includes('security') || reason.toLowerCase().includes('tab switch') || reason.toLowerCase().includes('lockdown')))) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300">
          <span>🛡️</span>
          <span>Security Logs</span>
        </span>
      );
    }
    if (t === 'system' || (reason && (reason.toLowerCase().includes('duration') || reason.toLowerCase().includes('timeout') || reason.toLowerCase().includes('window closed')))) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
          <span>⏱️</span>
          <span>System Auto</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
        <span>✅</span>
        <span>Manual</span>
      </span>
    );
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly) return;
    if (!qText || !correctAnswer) {
      setErrorMsg('Please enter question text and specify correct answer.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post(`/tests/${selectedTest.id}/questions/`, {
        question_text: qText,
        question_type: qType,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_answer: correctAnswer,
        points: parseFloat(points) || 1.0,
        explanation
      });
      setSuccessMsg('Question added successfully!');
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setExplanation('');

      const qData = await api.get(`/tests/${selectedTest.id}/questions/`);
      setQuestions(qData || []);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Question addition failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSeedQuestions = async (testId) => {
    if (isExecutiveReadOnly) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/tests/${testId}/bulk_add_questions/`);
      setSuccessMsg(res.detail);
      if (selectedTest && selectedTest.id === testId) {
        const qData = await api.get(`/tests/${testId}/questions/`);
        setQuestions(qData || []);
      }
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to seed sample questions.');
    }
  };

  const startTestAttempt = async (testId) => {
    setErrorMsg('');
    
    // Tuition Fee Gate Check: Must have at least 50% tuition clearance (TESTS API, EXAMS API, manual >= 50%, or temporary override)!
    const tuitionPaid = Number(user?.tuition_paid_percentage ?? user?.effective_tuition_percentage ?? 0);
    const isTestCleared = Boolean(user?.is_test_cleared) || (tuitionPaid >= 50.0) || Boolean(user?.is_temp_cleared);

    if (user?.role === 'student' && !isTestCleared) {
      setFeeGateMessage(`Test Access Barred: Continuous assessment quizzes require at least 50% tuition fee clearance or CIU Cleared Students API verification. Your current clearance is ${tuitionPaid}%. Please visit the Bursar / Finance Office to clear your fees.`);
      setShowFeeGateModal(true);
      return;
    }

    try {
      await api.post(`/tests/${testId}/start_attempt/`);
      router.push(`/dashboard/tests/${testId}`);
    } catch (err) {
      if (err.message && err.message.includes('50%')) {
        setFeeGateMessage(err.message);
        setShowFeeGateModal(true);
      } else {
        setErrorMsg(err.message || 'Failed to launch test.');
      }
    }
  };

  const downloadResultsCSV = (testId) => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
    const tokensStr = localStorage.getItem('ciu_tokens');
    let token = '';
    if (tokensStr) {
      try { token = JSON.parse(tokensStr).access; } catch (e) {}
    }
    window.open(`${API_BASE_URL}/tests/${testId}/export_csv/?token=${token}`, '_blank');
  };

  // Filtered Tests
  const filteredTests = tests.filter((t) => {
    const fCode = t.faculty_code || (courses.find(c => c.id === t.course)?.faculty_code);
    if (user?.role === 'student') {
      const studentFacCode = user?.faculty_code;
      if (studentFacCode && fCode && fCode !== studentFacCode) return false;
      const assignedIds = user?.assigned_courses || [];
      const assignedCodes = user?.assigned_course_codes || [];
      if (assignedIds.length > 0 || assignedCodes.length > 0) {
        const matchesPrimaryOrExtra = assignedIds.includes(t.course) ||
          assignedCodes.includes(t.course_code) ||
          (t.additional_courses && t.additional_courses.some(id => assignedIds.includes(id)));
        if (!matchesPrimaryOrExtra) return false;
      }
    }

    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.lecturer_name && t.lecturer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCourse = selectedCourseFilter ? (
      t.course === parseInt(selectedCourseFilter) ||
      (t.additional_courses && t.additional_courses.includes(parseInt(selectedCourseFilter)))
    ) : true;

    const matchesCourseUnit = selectedCourseUnitFilter ? (
      t.course_unit === parseInt(selectedCourseUnitFilter) ||
      (t.additional_course_units && t.additional_course_units.includes(parseInt(selectedCourseUnitFilter)))
    ) : true;

    const matchesStatus = selectedTestStatusFilter === 'All' ? true : (() => {
      const s = t.status || (
        t.due_date && new Date(t.due_date).getTime() < Date.now() ? 'Ended' :
        t.scheduled_start && new Date(t.scheduled_start).getTime() > Date.now() ? 'Scheduled' : 'In Progress'
      );
      return s.toLowerCase() === selectedTestStatusFilter.toLowerCase();
    })();

    const matchesCategory = selectedCategoryFilter ? t.category === selectedCategoryFilter : true;
    const matchesFaculty = selectedFacultyFilter === 'All' ? true : fCode === selectedFacultyFilter;
    const matchesSemester = selectedSemesterFilter === 'All' ? true : (
      t.semester === parseInt(selectedSemesterFilter) ||
      t.course_unit_semester === parseInt(selectedSemesterFilter) ||
      t.semester === 0
    );
    const matchesAcademicYear = selectedAcademicYearFilter === 'All' ? true : (
      !t.academic_year || t.academic_year === 'All' || t.academic_year.toLowerCase() === selectedAcademicYearFilter.toLowerCase()
    );
    return matchesSearch && matchesCourse && matchesCourseUnit && matchesStatus && matchesCategory && matchesFaculty && matchesSemester && matchesAcademicYear;
  });

  // Calculate Metrics
  const activeTestsCount = user?.role === 'student'
    ? filteredTests.filter(t => t.is_published).length
    : tests.filter(t => t.is_published).length;
  const totalSubmissions = attempts.filter(a => a.completed_at).length;
  const passRate = attempts.length > 0 ? ((attempts.filter(a => a.passed).length / attempts.length) * 100).toFixed(1) : '0';

  // Group Tests under Faculties for Staff
  const activeFacultiesList = isLecturer || user?.role === 'student' ? scopedFaculties : faculties;
  
  const testFacultyGroups = activeFacultiesList.map(fac => {
    const facTests = filteredTests.filter(t => {
      const fCode = t.faculty_code || (courses.find(c => c.id === t.course)?.faculty_code);
      return fCode === fac.code;
    });
    return { faculty: fac, tests: facTests };
  });

  const unassignedTests = filteredTests.filter(t => {
    const fCode = t.faculty_code || (courses.find(c => c.id === t.course)?.faculty_code);
    return !activeFacultiesList.some(f => f.code === fCode);
  });

  const studentTuitionPaid = Number(user?.tuition_paid_percentage ?? user?.effective_tuition_percentage ?? 0);
  const isStudentTestCleared = Boolean(user?.is_test_cleared) || (studentTuitionPaid >= 50.0) || Boolean(user?.is_temp_cleared);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">CIU Continuous Assessment & Test Portal</h2>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Timed tests, automatic score release controls, live proctoring, and question banks.</p>
        </div>

        {/* Quick Metrics Bar & Proctoring Badge */}
        <div className="flex flex-wrap items-center gap-3">

          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Proctoring: ACTIVE' : 'Proctoring: OFF'}
            </span>
            {isAdmin && !isExecutiveReadOnly && (
              <button
                onClick={handleToggleProctoring}
                className="ml-2 px-2 py-0.5 bg-brand-dark text-white text-[10px] font-bold rounded hover:bg-brand-medium"
              >
                Toggle
              </button>
            )}
          </div>

          <div className="green-card px-3.5 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Tests</span>
            <span className="text-sm font-extrabold text-brand-dark">{activeTestsCount}</span>
          </div>
          <div className="green-card px-3.5 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submissions</span>
            <span className="text-sm font-extrabold text-brand-medium">{totalSubmissions}</span>
          </div>
          <div className="green-card px-3.5 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pass Rate</span>
            <span className="text-sm font-extrabold text-emerald-600">{passRate}%</span>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
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

      {/* Primary Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Left: Section Tabs */}
        <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-brand-light text-brand-dark'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>📋 Test Catalog</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'catalog' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {filteredTests.length}
            </span>
          </button>

          {canBuildTest && (
            <button
              onClick={() => setActiveTab('builder')}
              className={`pb-3 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'builder'
                  ? 'border-brand-light text-brand-dark'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>🛠️ Test Builder & Studio</span>
              {selectedTest ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 truncate max-w-[140px]">
                  {selectedTest.course_code || selectedTest.code || selectedTest.title}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  New
                </span>
              )}
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'border-brand-light text-brand-dark'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>📊 Submissions & Results</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'analytics' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {totalSubmissions}
              </span>
            </button>
          )}

          {!isStaff && (
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'history'
                  ? 'border-brand-light text-brand-dark'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>📈 My Performance</span>
            </button>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {canBuildTest && activeTab === 'catalog' && (
            <>
              <button
                type="button"
                onClick={handleStartNewTestBuilder}
                className="px-3.5 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                title="Create a new test paper from scratch in Test Builder"
              >
                <span>➕ Create New Test</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxtMode('new');
                  setTxtTitle('');
                  setTxtCourseUnit(selectedCourseUnit || (assignedCourseUnits[0]?.id || ''));
                  setTxtScheduledStart(getUgandanNowDatetimeLocal());
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  setTxtDueDate(toUgandanDatetimeLocal(d.toISOString()));
                  setShowTxtModal(true);
                }}
                className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                title="Upload an Aiken format .txt file to build a test automatically"
              >
                <span>📄 Upload .TXT</span>
              </button>
            </>
          )}

          {activeTab === 'builder' && (
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Return to the Test Catalog"
            >
              <span>← View Test Catalog</span>
            </button>
          )}
        </div>
      </div>

      {/* Catalog Filter Toolbar (Organized & Rendered ONLY for Catalog Tab) */}
      {activeTab === 'catalog' && (
        <div className="green-card p-4 rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Filter & Search Catalog
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({filteredTests.length} tests matching)
              </span>
            </div>

            {hasActiveCatalogFilters && (
              <button
                type="button"
                onClick={handleResetCatalogFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
              >
                <span>✕ Reset All Filters</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search bar */}
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="Search tests, courses, lecturers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-52 focus:outline-none focus:ring-1 focus:ring-brand-light"
              />
            </div>

            {/* Staff Faculty Filter */}
            {isStaff && (
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase">Faculty:</span>
                <select
                  value={['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role) && (user?.faculty_code || user?.faculty) ? (user?.faculty_code || (typeof user?.faculty === 'object' ? user?.faculty?.code : String(user?.faculty))) : selectedFacultyFilter}
                  disabled={['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role) && Boolean(user?.faculty_code || user?.faculty)}
                  onChange={(e) => setSelectedFacultyFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-light disabled:opacity-85"
                >
                  <option value="All">All Faculties ({activeFacultiesList.length})</option>
                  {activeFacultiesList.map((f) => (
                    <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                  ))}
                </select>
                {['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role) && (user?.faculty_code || user?.faculty) && (
                  <span className="text-[10px] text-amber-700 font-bold">🔒 Locked</span>
                )}
              </div>
            )}

            {/* Test Status Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Status:</span>
              <select
                value={selectedTestStatusFilter}
                onChange={(e) => setSelectedTestStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="All">All Statuses</option>
                <option value="In Progress">🟢 In Progress</option>
                <option value="Scheduled">⏳ Scheduled</option>
                <option value="Ended">🔴 Ended</option>
              </select>
            </div>

            {/* Course filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Course:</span>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-light max-w-[180px] truncate"
              >
                <option value="">All Courses ({assignedCourses.length})</option>
                {assignedCourses.map((c) => (
                  <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                ))}
              </select>
            </div>

            {/* Course Unit filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Unit:</span>
              <select
                value={selectedCourseUnitFilter}
                onChange={(e) => setSelectedCourseUnitFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-light max-w-[180px] truncate"
              >
                <option value="">All Units ({assignedCourseUnits.length})</option>
                {assignedCourseUnits.map((u) => (
                  <option key={u.id} value={u.id}>[{u.code}] {u.name}</option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Type:</span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="">All Categories</option>
                <option value="quiz">Quiz</option>
                <option value="practice">Practice Test</option>
                <option value="unit_test">Unit Test</option>
                <option value="midterm">Midterm Test</option>
                <option value="assignment">Assignment Test</option>
              </select>
            </div>

            {/* Semester filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Sem:</span>
              <select
                value={selectedSemesterFilter}
                onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="All">All Sems</option>
                <option value="1">Sem 1</option>
                <option value="2">Sem 2</option>
              </select>
            </div>

            {/* Academic Year filter */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Year:</span>
              <select
                value={selectedAcademicYearFilter}
                onChange={(e) => setSelectedAcademicYearFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="All">All Years</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: CATALOG (Organized by Faculty for Staff) */}
      {activeTab === 'catalog' && (
        user.role === 'student' ? (
          /* Student Well-Presented High-Density Tests List View */
          <div className="space-y-4">
            
            {/* Student Clearance Status Banner */}
            {isStudentTestCleared ? (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/50 p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <span className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    ✓
                  </span>
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider flex items-center space-x-2">
                      <span>Tuition Clearance Gate (50%+ Cleared)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Active & Eligible
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {user?.clearance_source || (user?.is_temp_cleared ? 'Active Accounts Temporary Clearance' : (studentTuitionPaid >= 50.0 ? `Cleared via ${studentTuitionPaid}% Tuition Record` : 'Verified via CIU Cleared Students API (50% Tuition Gate)'))}. You are cleared to take all Continuous Assessment Tests.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Assessment Gate</span>
                  <span className="font-extrabold text-xs text-emerald-800 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs inline-block">
                    50% Clearance Required
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-100/40 p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <span className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                    ⚠️
                  </span>
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-xs uppercase tracking-wider flex items-center space-x-2">
                      <span>50% Tuition Fee Clearance Required for Tests</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        Action Required
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      To launch continuous assessment tests, you must have cleared at least 50% tuition via the CIU TESTS API or obtain an Accounts Temporary Clearance override.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tuition Gate</span>
                  <span className="font-extrabold text-xs text-amber-800 bg-white px-2.5 py-1 rounded-xl border border-amber-200 shadow-2xs inline-block">
                    50% Required
                  </span>
                </div>
              </div>
            )}

            {/* List Header Summary */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider">
                  Continuous Assessment Tests
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {filteredTests.length} Tests
                </span>
              </div>
              <span className="text-slate-500 text-[11px]">
                Showing scheduled quizzes, midterms, and tests for your assigned course units.
              </span>
            </div>

            {/* High-Density Student Tests Table */}
            {filteredTests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                <span className="text-3xl block">📝</span>
                <p className="text-slate-700 font-bold text-sm">No tests match your active filter criteria</p>
                <p className="text-slate-500 text-xs">There are currently no active tests scheduled for your units.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        <th className="px-4 py-3">Test Title & Category</th>
                        <th className="px-3 py-3">Course & Unit</th>
                        <th className="px-3 py-3">Schedule (EAT)</th>
                        <th className="px-3 py-3 text-center">Duration & Pass</th>
                        <th className="px-3 py-3 text-center">Questions</th>
                        <th className="px-3 py-3 text-center">Status & Score</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredTests.map((testItem) => {
                        const myAttempt = attempts.find(a => a.test === testItem.id);
                        const isExpanded = expandedTestIds.includes(testItem.id);

                        return (
                          <Fragment key={testItem.id}>
                            <tr
                              className={`transition-all ${
                                isExpanded
                                  ? 'bg-emerald-50/30 border-l-4 border-l-brand-light'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {testItem.category.replace('_', ' ')}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                      {testItem.semester === 1 ? 'Sem 1' : testItem.semester === 2 ? 'Sem 2' : 'All Sems'}
                                    </span>
                                    {testItem.academic_year && testItem.academic_year !== 'All' && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {testItem.academic_year}
                                      </span>
                                    )}
                                    <span className="font-extrabold text-slate-900 leading-tight block">
                                      {testItem.title}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block">
                                    Lecturer: <strong className="text-slate-700">{testItem.lecturer_name || 'Assigned Lecturer'}</strong>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-mono font-bold text-brand-dark block">
                                  [{testItem.course_code}]
                                </span>
                                <span className="text-[11px] text-slate-600 truncate max-w-[160px] block">
                                  {testItem.course_name}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[11px]">
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    🟢 Start: {formatUgandanTime(testItem.scheduled_start)}
                                  </span>
                                  {testItem.due_date && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-50 text-red-800 border border-red-300">
                                      🔴 Stop: {formatUgandanTime(testItem.due_date)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 block">
                                  ⏱️ {testItem.duration_minutes}m
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                  🎯 {testItem.pass_percentage}% Pass
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="font-bold text-slate-800 text-xs">
                                  ❓ {testItem.questions_count} Qs
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {myAttempt ? (
                                  myAttempt.completed_at ? (
                                    testItem.is_results_released ? (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block ${myAttempt.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                        {myAttempt.score}% ({myAttempt.passed ? 'PASSED' : 'FAILED'})
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 block">
                                        🔒 Results Withheld
                                      </span>
                                    )
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 block">
                                      🔄 In Progress
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 block">
                                    Not Attempted
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTest(testItem.id)}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                      isExpanded
                                        ? 'bg-brand-dark text-white border-brand-dark shadow-xs'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                    title="Expand details preview"
                                  >
                                    <span>{isExpanded ? '▲ Hide' : '🔍 Preview'}</span>
                                  </button>

                                  {myAttempt ? (
                                    myAttempt.completed_at ? (
                                      testItem.is_results_released ? (
                                        <button
                                          onClick={() => router.push(`/dashboard/tests/${testItem.id}/results?attemptId=${myAttempt.id}`)}
                                          className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded-lg hover:bg-brand-medium transition-all shadow-xs cursor-pointer"
                                        >
                                          Scorecard
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-medium italic">Pending</span>
                                      )
                                    ) : (
                                      <button
                                        onClick={() => router.push(`/dashboard/tests/${testItem.id}`)}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                                      >
                                        Resume
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      onClick={() => startTestAttempt(testItem.id)}
                                      disabled={testItem.questions_count === 0}
                                      className="px-2.5 py-1 bg-brand-light hover:bg-brand-medium text-white text-[10px] font-bold rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                      Launch
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expand / Preview Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 border-b border-emerald-100 animate-fade-in">
                                <td colSpan={7} className="px-6 py-4">
                                  <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-3 text-xs">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
                                      <div>
                                        <h5 className="font-extrabold text-slate-900 text-sm">
                                          {testItem.title}
                                        </h5>
                                        <p className="text-slate-500 text-[11px]">
                                          Course: [{testItem.course_code}] {testItem.course_name}
                                        </p>
                                      </div>
                                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Fee Gate: 50% Tuition Clearance (CIU TESTS API Gate)
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                                        <span className="font-bold text-slate-800">{testItem.duration_minutes} Minutes</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Pass Score</span>
                                        <span className="font-bold text-slate-800">{testItem.pass_percentage}%</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Allowed Attempts</span>
                                        <span className="font-bold text-slate-800">{testItem.allowed_attempts || 1} Attempt(s)</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Questions</span>
                                        <span className="font-bold text-slate-800">{testItem.questions_count}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STAFF HIGH-DENSITY TESTS LIST FORMAT WITH BULK ACTIONS, EDIT, DELETE, AND EXPAND/PREVIEW */
          <div className="space-y-4">
            
            {/* Sticky Bulk Action Bar for Tests */}
            {selectedTestIds.length > 0 && !isExecutiveReadOnly && (
              <div className="sticky top-2 z-20 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-3.5 rounded-2xl shadow-xl border border-red-500/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold shadow-inner">
                    📝
                  </span>
                  <div>
                    <p className="text-xs font-black tracking-wide uppercase">
                      {selectedTestIds.length} Test{selectedTestIds.length > 1 ? 's' : ''} Selected
                    </p>
                    <p className="text-[11px] text-red-100 font-medium">
                      Manage selected Continuous Assessment Tests in bulk.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTestIds([])}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPublishTests(true)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <span>🚀 Bulk Publish</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPublishTests(false)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <span>📁 Bulk Unpublish</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeleteTests}
                    className="px-4 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-black shadow-md hover:shadow transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>🗑️ Delete Selected ({selectedTestIds.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* List Controls Summary */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider">
                  Continuous Assessment Tests Directory
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {filteredTests.length} Tests
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {!isExecutiveReadOnly && filteredTests.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAllTests}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                  >
                    {selectedTestIds.length >= filteredTests.length && filteredTests.length > 0
                      ? '✕ Deselect All'
                      : `☑️ Select All (${filteredTests.length})`}
                  </button>
                )}
                {canBuildTest && (
                  <button
                    type="button"
                    onClick={handleStartNewTestBuilder}
                    className="px-3.5 py-1.5 bg-brand-light hover:bg-brand-medium text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    title="Launch Test Builder with a blank test form"
                  >
                    ➕ Create New Test
                  </button>
                )}
              </div>
            </div>

            {/* High-Density Tests List Table */}
            {filteredTests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
                <span className="text-3xl block">📝</span>
                <p className="text-slate-700 font-bold text-sm">No tests match your active filter criteria</p>
                <p className="text-slate-500 text-xs">Try selecting a different faculty or clearing your search term.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        {!isExecutiveReadOnly && (
                          <th className="px-3 py-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={filteredTests.length > 0 && filteredTests.every(t => selectedTestIds.includes(t.id))}
                              onChange={handleToggleSelectAllTests}
                              className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                              title="Select / deselect all filtered tests"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3">Test Title & Category</th>
                        <th className="px-3 py-3">Course & Unit</th>
                        <th className="px-3 py-3">Schedule (EAT)</th>
                        <th className="px-3 py-3 text-center">Duration & Pass</th>
                        <th className="px-3 py-3 text-center">Questions</th>
                        <th className="px-3 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredTests.map((testItem) => {
                        const isSelected = selectedTestIds.includes(testItem.id);
                        const isExpanded = expandedTestIds.includes(testItem.id);
                        const canManageThisTest = isAdmin || (isLecturer && (testItem.lecturer === user.id || testItem.lecturer_name === user.username));
                        const testAttemptsCount = attempts.filter(a => a.test === testItem.id).length;

                        return (
                          <Fragment key={testItem.id}>
                            <tr
                              className={`transition-all ${
                                isSelected
                                  ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-l-red-500'
                                  : isExpanded
                                  ? 'bg-emerald-50/30 border-l-4 border-l-brand-light'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {!isExecutiveReadOnly && (
                                <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectTest(testItem.id)}
                                    className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                                    title={`Select ${testItem.title}`}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {testItem.category.replace('_', ' ')}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                      {testItem.semester === 1 ? 'Sem 1' : testItem.semester === 2 ? 'Sem 2' : 'All Sems'}
                                    </span>
                                    {testItem.academic_year && testItem.academic_year !== 'All' && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {testItem.academic_year}
                                      </span>
                                    )}
                                    <span className="font-extrabold text-slate-900 leading-tight block">
                                      {testItem.title}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block">
                                    Lecturer: <strong className="text-slate-700">{testItem.lecturer_name || 'Unassigned'}</strong>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-mono font-bold text-brand-dark block">
                                  [{testItem.course_code}]
                                </span>
                                <span className="text-[11px] text-slate-600 truncate max-w-[160px] block">
                                  {testItem.course_name}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[11px]">
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    🟢 Start: {formatUgandanTime(testItem.scheduled_start)}
                                  </span>
                                  {testItem.due_date && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-50 text-red-800 border border-red-300">
                                      🔴 Stop: {formatUgandanTime(testItem.due_date)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 block">
                                  ⏱️ {testItem.duration_minutes}m
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                  🎯 {testItem.pass_percentage}% Pass
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSelectTestForQuestions(testItem)}
                                  className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-brand-dark border border-emerald-300 font-black rounded-lg text-[10px] transition-all inline-flex items-center space-x-1 cursor-pointer shadow-xs"
                                  title="Open Question Studio in Test Builder for this test"
                                >
                                  <span>❓ {testItem.questions_count} Qs</span>
                                </button>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="space-y-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border block ${
                                    (testItem.status === 'In Progress' || (!testItem.status && (!testItem.due_date || new Date(testItem.due_date) > new Date())))
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                      : testItem.status === 'Scheduled'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-red-100 text-red-900 border-red-300'
                                  }`}>
                                    {testItem.status || 'Active'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block ${testItem.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {testItem.is_published ? 'PUBLISHED' : 'DRAFT'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => openLiveStudentsModal(testItem)}
                                    className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                                    title="View attempting students live status (Started, Pending, Submitted)"
                                  >
                                    <span>👥 Candidates</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTest(testItem.id)}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                      isExpanded
                                        ? 'bg-brand-dark text-white border-brand-dark shadow-xs'
                                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                    title="Expand details and management preview"
                                  >
                                    <span>{isExpanded ? '▲ Hide' : '🔍 Preview'}</span>
                                  </button>
                                  {!isExecutiveReadOnly && canManageThisTest && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectTestForQuestions(testItem)}
                                      className="px-2 py-1 bg-brand-light hover:bg-brand-medium text-white border border-brand-light text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
                                      title="Open Test Builder & Question Studio for this test"
                                    >
                                      <span>🛠️ Studio</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handlePreviewScorecard(testItem)}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                    title="Preview scorecard layout"
                                  >
                                    👁️
                                  </button>
                                  {!isExecutiveReadOnly && canManageThisTest && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditTestModal(testItem)}
                                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg transition-all border border-emerald-200 cursor-pointer"
                                        title="Edit test paper"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTest(testItem)}
                                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold rounded-lg transition-all border border-red-200 cursor-pointer"
                                        title="Delete test paper"
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expand / Preview Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 border-b border-emerald-100 animate-fade-in">
                                <td colSpan={!isExecutiveReadOnly ? 8 : 7} className="px-6 py-4">
                                  <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-3 text-xs">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
                                      <div className="space-y-0.5">
                                        <h5 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                                          <span>{testItem.title}</span>
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                            {testItem.questions_count} Questions · {testAttemptsCount} Submissions
                                          </span>
                                        </h5>
                                        <p className="text-slate-500 text-[11px]">
                                          Course: [{testItem.course_code}] {testItem.course_name} · Faculty: {testItem.faculty_code || 'N/A'}
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedTestFilter(String(testItem.id));
                                            setActiveTab('analytics');
                                          }}
                                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
                                        >
                                          📊 View Submissions ({testAttemptsCount})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => downloadResultsCSV(testItem.id)}
                                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
                                        >
                                          📥 Export CSV
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Pass Requirement</span>
                                        <span className="font-bold text-slate-800">{testItem.pass_percentage}% Score</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Allowed Attempts</span>
                                        <span className="font-bold text-slate-800">{testItem.allowed_attempts || 1} Attempt(s)</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Tuition Fee Gate</span>
                                        <span className="font-bold text-emerald-700">50%+ Cleared (CIU TESTS API)</span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
                                        <span className="font-bold text-slate-800">{testItem.duration_minutes} Minutes</span>
                                      </div>
                                    </div>

                                    {/* Action Shortcuts */}
                                    {!isExecutiveReadOnly && canManageThisTest && (
                                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePublish(testItem)}
                                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                            testItem.is_published
                                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                              : 'bg-brand-light text-white hover:bg-brand-medium'
                                          }`}
                                        >
                                          {testItem.is_published ? '📁 Unpublish Test' : '🚀 Publish Test'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleResultsRelease(testItem)}
                                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                            testItem.is_results_released
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                          }`}
                                        >
                                          {testItem.is_results_released ? '🔒 Withhold Results' : '📢 Release Results to Students'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handlePreviewScorecard(testItem)}
                                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                        >
                                          👁️ Scorecard Preview
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSelectTestForQuestions(testItem)}
                                          className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                                          title="Open Question Studio in Test Builder"
                                        >
                                          <span>🛠️ Question Studio ({testItem.questions_count || 0})</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditTestModal(testItem)}
                                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-all border border-emerald-200 cursor-pointer"
                                        >
                                          ✏️ Edit Test Details
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTest(testItem)}
                                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-all border border-red-200 cursor-pointer"
                                        >
                                          🗑️ Delete Test
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 2: TEST BUILDER & QUESTION EDITOR (Staff) */}
      {canBuildTest && activeTab === 'builder' && (
        <div className="space-y-6 animate-fade-in">
          {/* Test Builder & Studio Header Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-dark to-brand-light flex items-center justify-center text-white text-lg shadow-sm shrink-0">
                🛠️
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    Test Paper Builder &amp; Question Studio
                  </h2>
                  {selectedTest ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Managing: [{selectedTest.course_code}] {selectedTest.title}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Drafting New Paper
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedTest
                    ? `Authoring ${questions.length} questions for ${selectedTest.title} (${selectedTest.duration_minutes}m duration)`
                    : 'Fill out the form on the left to create a new Continuous Assessment Test, or choose an existing test to edit questions.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Test Switcher Dropdown */}
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
                <label htmlFor="studio-test-switcher" className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  Test:
                </label>
                <select
                  id="studio-test-switcher"
                  value={selectedTest?.id || ''}
                  onChange={(e) => {
                    const tId = e.target.value;
                    if (!tId) {
                      handleStartNewTestBuilder();
                    } else {
                      const found = tests.find(t => String(t.id) === String(tId));
                      if (found) handleSelectTestForQuestions(found);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[190px] truncate"
                >
                  <option value="">➕ [Draft New Test Paper]</option>
                  {tests.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.course_code}] {t.title} ({t.questions_count || 0} Qs)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleStartNewTestBuilder}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center space-x-1"
                title="Reset form to draft a new test paper from scratch"
              >
                <span>➕ Blank Form</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1"
                title="Return to the Test Catalog"
              >
                <span>📋 Test Catalog</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Test Form */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Create New Test</h3>
              <button
                type="button"
                onClick={() => {
                  setTxtMode('new');
                  setTxtTitle('');
                  setTxtCourseUnit(selectedCourseUnit || (assignedCourseUnits[0]?.id || ''));
                  setTxtScheduledStart(getUgandanNowDatetimeLocal());
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  setTxtDueDate(toUgandanDatetimeLocal(d.toISOString()));
                  setShowTxtModal(true);
                }}
                className="px-2.5 py-1 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-bold rounded-lg transition-all flex items-center space-x-1"
                title="Translate a .txt Aiken format file into a test paper"
              >
                <span>📄 Upload .TXT Paper</span>
              </button>
            </div>

            <form onSubmit={handleCreateTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Select Course Unit *</label>
                <select
                  value={selectedCourseUnit}
                  onChange={(e) => handleSelectCourseUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="">{isAdmin ? '-- All Course Units (System Admin Default) --' : '-- Select Assigned Course Unit --'}</option>
                  {assignedCourseUnits.map((u) => (
                    <option key={u.id} value={u.id}>[{u.code}] {u.name} (Year {u.year_of_study || 1})</option>
                  ))}
                </select>
              </div>

              {assignedCourseUnits.length > 1 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Additional Assigned Units (Cross-Unit Setting)
                  </label>
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1 text-xs">
                    {assignedCourseUnits.filter(u => String(u.id) !== String(selectedCourseUnit)).map((u) => (
                      <label key={u.id} className="flex items-center space-x-2 font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={targetCourseUnitIds.includes(u.id) || targetCourseUnitIds.includes(String(u.id))}
                          onChange={(e) => {
                            const uId = u.id;
                            if (e.target.checked) {
                              setTargetCourseUnitIds(prev => [...prev.filter(id => id !== uId), uId]);
                            } else {
                              setTargetCourseUnitIds(prev => prev.filter(id => id !== uId));
                            }
                          }}
                          className="rounded text-brand-light focus:ring-brand-light"
                        />
                        <span>[{u.code}] {u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Course Program(s) *</label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1 text-xs">
                  {assignedCourses.map((c) => (
                    <label key={c.id} className="flex items-center space-x-2 font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetCourseIds.includes(String(c.id)) || targetCourseIds.includes(c.id) || selectedCourse === String(c.id)}
                        onChange={(e) => {
                          const idStr = String(c.id);
                          if (e.target.checked) {
                            setTargetCourseIds(prev => [...prev.filter(i => String(i) !== idStr), idStr]);
                            setSelectedCourse(idStr);
                          } else {
                            setTargetCourseIds(prev => prev.filter(i => String(i) !== idStr));
                          }
                        }}
                        className="rounded text-brand-light focus:ring-brand-light"
                      />
                      <span>[{c.code}] {c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Year(s) of Study (1-4)</label>
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                  {[1, 2, 3, 4].map((yr) => (
                    <label key={yr} className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={targetYears.includes(yr)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetYears(prev => [...prev, yr]);
                            setYearOfStudy(yr);
                          } else {
                            setTargetYears(prev => prev.filter(y => y !== yr));
                          }
                        }}
                        className="rounded text-brand-light focus:ring-brand-light"
                      />
                      <span>Year {yr}</span>
                    </label>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setTargetYears([1, 2, 3, 4]); setYearOfStudy(0); }}
                      className="text-[10px] text-brand-medium hover:underline font-extrabold"
                    >
                      Select All Years
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Test Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 1: Data Structures"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-light"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="practice">Practice Test</option>
                    <option value="unit_test">Unit Test</option>
                    <option value="midterm">Midterm Test</option>
                    <option value="assignment">Assignment Test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Pass Mark %</label>
                  <input
                    type="number"
                    value={passPercentage}
                    onChange={(e) => setPassPercentage(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Max Attempts</label>
                  <input
                    type="number"
                    value={allowedAttempts}
                    onChange={(e) => setAllowedAttempts(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Semester</label>
                  <select
                    value={testSemester}
                    onChange={(e) => setTestSemester(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800"
                  >
                    <option value="0">All Semesters (0)</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Academic Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026/2027"
                    value={testAcademicYear}
                    onChange={(e) => setTestAcademicYear(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Scheduled Start & Due Date</label>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    🕒 Ugandan Time (UTC+3, EAT)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl border-2 border-emerald-400 bg-emerald-50/30">
                    <label className="block text-[10px] text-emerald-800 font-extrabold mb-1 flex items-center space-x-1">
                      <span>🟢</span>
                      <span>Start Date & Time (EAT)</span>
                    </label>
                    <input
                      type="datetime-local"
                      min={getUgandanNowDatetimeLocal()}
                      value={scheduledStart}
                      onChange={(e) => setScheduledStart(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded text-xs font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="p-2 rounded-xl border-2 border-red-400 bg-red-50/30">
                    <label className="block text-[10px] text-red-800 font-extrabold mb-1 flex items-center space-x-1">
                      <span>🔴</span>
                      <span>Stop Date & Time (EAT)</span>
                    </label>
                    <input
                      type="datetime-local"
                      min={scheduledStart || getUgandanNowDatetimeLocal()}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-red-300 rounded text-xs font-bold text-red-950 focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setScheduledStart(getUgandanNowDatetimeLocal())}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 text-[10px] font-bold rounded border border-slate-200 transition-all"
                  >
                    ⚡ Start Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setDueDate(toUgandanDatetimeLocal(d.toISOString()));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 text-[10px] font-bold rounded border border-slate-200 transition-all"
                  >
                    📅 Due +1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setDueDate(toUgandanDatetimeLocal(d.toISOString()));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 text-[10px] font-bold rounded border border-slate-200 transition-all"
                  >
                    📅 Due +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScheduledStart(''); setDueDate(''); }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-red-50 text-slate-600 text-[10px] font-bold rounded border border-slate-200 transition-all"
                  >
                    ❌ Clear
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Description & Instructions</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes for students..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-extrabold uppercase tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <span>💾 Save Test Paper & Build Questions</span>
              </button>
            </form>
          </div>

          {/* Question Builder & Question Paper Scorecard Preview */}
          <div className="lg:col-span-2 green-card rounded-2xl p-6 space-y-4">
            {selectedTest ? (
              <div className="space-y-4">
                
                {/* Scorecard Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-850 flex items-center space-x-2">
                      <span>📋 Question Paper Scorecard Preview & Editor</span>
                    </h3>
                    <p className="text-xs text-brand-medium font-semibold mt-0.5">
                      Test: {selectedTest.title} ({selectedTest.course_code}) · Questions: {questions.length}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isExecutiveReadOnly && (
                      <>
                        <button
                          onClick={() => handleOpenEditTestModal(selectedTest)}
                          className="px-3 py-1.5 bg-brand-light text-white hover:bg-brand-medium text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1"
                          title="Save and edit test dates, title, duration"
                        >
                          <span>💾 Save Details</span>
                        </button>
                        <button
                          onClick={() => handleBulkSeedQuestions(selectedTest.id)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                        >
                          ⚡ Seed Sample Package
                        </button>
                        <button
                          onClick={() => {
                            setTxtMode('append');
                            setShowTxtModal(true);
                          }}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center space-x-1"
                          title="Import questions from .txt Aiken file into this test"
                        >
                          <span>📄 Import .TXT</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedTest(null)}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      Close Editor
                    </button>
                  </div>
                </div>

                {/* Scorecard Questions Preview */}
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                  {questions.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No questions added to this test yet. Click &quot;Seed Sample Package&quot; or fill the form below.
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={q.id} className="p-4 bg-white rounded-2xl border border-emerald-200/80 shadow-sm space-y-2.5">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-brand-light text-white font-extrabold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-850 text-xs">{q.question_text}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-extrabold border border-emerald-200 uppercase">
                              {q.question_type.toUpperCase()} · {q.points} Points
                            </span>
                          </div>
                        </div>

                        {/* Options A, B, C, D Scorecard Display */}
                        {q.question_type === 'mcq' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_answer === 'A' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <span><strong className="text-slate-900 mr-1.5">A:</strong> {q.option_a}</span>
                              {q.correct_answer === 'A' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                            </div>

                            <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_answer === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <span><strong className="text-slate-900 mr-1.5">B:</strong> {q.option_b}</span>
                              {q.correct_answer === 'B' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                            </div>

                            <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_answer === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <span><strong className="text-slate-900 mr-1.5">C:</strong> {q.option_c}</span>
                              {q.correct_answer === 'C' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                            </div>

                            <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_answer === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <span><strong className="text-slate-900 mr-1.5">D:</strong> {q.option_d}</span>
                              {q.correct_answer === 'D' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                            </div>
                          </div>
                        )}

                        {q.question_type !== 'mcq' && (
                          <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900">
                            Answer Key: {q.correct_answer}
                          </div>
                        )}

                        {q.explanation && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                            💡 Explanation: {q.explanation}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Question Form */}
                {!isExecutiveReadOnly && (
                  <form onSubmit={handleAddQuestion} className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Question Prompt</label>
                      <textarea
                        rows={2}
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="Type question prompt..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Question Type</label>
                        <select value={qType} onChange={(e) => setQType(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold">
                          <option value="mcq">Multiple Choice</option>
                          <option value="tf">True / False</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Points</label>
                        <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold" />
                      </div>
                    </div>

                    {qType === 'mcq' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Option A" value={optA} onChange={(e) => setOptA(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium" required />
                        <input type="text" placeholder="Option B" value={optB} onChange={(e) => setOptB(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium" required />
                        <input type="text" placeholder="Option C" value={optC} onChange={(e) => setOptC(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium" required />
                        <input type="text" placeholder="Option D" value={optD} onChange={(e) => setOptD(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium" required />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Correct Answer / Key</label>
                      <input type="text" placeholder="e.g. A, B, C, D, True, or False" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" required />
                    </div>

                    <button type="submit" disabled={submitting} className="w-full py-2 bg-brand-light text-white text-xs font-bold rounded-lg shadow-sm">
                      Add Question to Test Paper
                    </button>
                  </form>
                )}

              </div>
            ) : (
              <div className="p-8 text-center space-y-6">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-brand-dark flex items-center justify-center text-2xl border border-emerald-200 shadow-xs">
                    📝
                  </div>
                  <h4 className="text-base font-extrabold text-slate-850">
                    Question Studio Ready
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    No test paper is currently loaded into the question studio. Create a new test paper using the form on the left or select an existing draft below to start adding questions.
                  </p>
                </div>

                {/* Workflow Guidance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                      <span>1️⃣</span>
                      <span>Draft on Left</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Configure title, unit, academic year (2026/2027), and schedule. Click <strong>Save Test Paper</strong> to launch question authoring.
                    </p>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                      <span>2️⃣</span>
                      <span>Bulk Upload</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Have an Aiken formatted file? Click <strong>Upload .TXT Paper</strong> on the left to parse and create instantly.
                    </p>
                  </div>
                </div>

                {/* Quick Select Existing Tests */}
                {tests.length > 0 && (
                  <div className="pt-4 border-t border-emerald-100 max-w-xl mx-auto space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                        Quick Load Existing Test Papers ({tests.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('catalog')}
                        className="text-brand-dark hover:underline font-bold text-[11px] cursor-pointer"
                      >
                        Browse all in Catalog →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                      {tests.slice(0, 4).map((testItem) => (
                        <div
                          key={testItem.id}
                          className="p-3 bg-white hover:bg-emerald-50/50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-xs block truncate">
                              {testItem.title}
                            </span>
                            <span className="text-[10px] font-mono text-brand-dark block">
                              [{testItem.course_code}] · {testItem.questions_count || 0} Questions
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectTestForQuestions(testItem)}
                            className="px-2.5 py-1 bg-brand-light hover:bg-brand-medium text-white text-[10px] font-bold rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
                          >
                            🛠️ Load
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    )}

      {/* TAB 3: SUBMISSIONS ANALYTICS (Staff) */}
      {isStaff && activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Active Filter Banner when navigated from catalog card */}
          {selectedTestFilter !== 'All' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-950">
                <span>📌 Filtered Submissions for Test:</span>
                <span className="bg-emerald-700 text-white px-2.5 py-1 rounded-lg">
                  {tests.find(t => String(t.id) === String(selectedTestFilter))?.title || `Test #${selectedTestFilter}`}
                </span>
              </div>
              <button
                onClick={() => setSelectedTestFilter('All')}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-sm transition-all self-start sm:self-auto"
              >
                ✕ Clear Filter (Show All Tests)
              </button>
            </div>
          )}

          {/* Summary Analytics Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Submissions</span>
              <span className="text-2xl font-black text-slate-850 mt-1 block">{subTotalCount}</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Passed Attempts</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{subPassedCount}</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pass Rate Percentage</span>
              <span className="text-2xl font-black text-brand-dark mt-1 block">{subPassRate}%</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Class Average Score</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">{subAvgScore}%</span>
            </div>
          </div>

          {/* Filter Toolbar & Data Table */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">
                Student Assessment Attempt Audit ({filteredSubmissions.length})
              </h3>
              
              {(selectedTestFilter !== 'All' || selectedCourseSubFilter !== 'All' || selectedStatusFilter !== 'All' || submissionSearch) && (
                <button
                  onClick={() => {
                    setSelectedTestFilter('All');
                    setSelectedCourseSubFilter('All');
                    setSelectedStatusFilter('All');
                    setSubmissionSearch('');
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg transition-all"
                >
                  ✕ Reset All Filters
                </button>
              )}
            </div>

            {/* Filter Dropdowns & Search Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter by Test Paper</label>
                <select
                  value={selectedTestFilter}
                  onChange={(e) => setSelectedTestFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Test Papers ({tests.length})</option>
                  {tests.map(t => (
                    <option key={t.id} value={t.id}>[{t.course_code}] {t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter by Course Program</label>
                <select
                  value={selectedCourseSubFilter}
                  onChange={(e) => setSelectedCourseSubFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Course Programs ({assignedCourses.length})</option>
                  {assignedCourses.map(c => (
                    <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Grade Status</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Attempts (Passed & Failed)</option>
                  <option value="passed">Passed Submissions Only</option>
                  <option value="failed">Failed Submissions Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Student / Title</label>
                <input
                  type="text"
                  placeholder="Student name, reg no, or title..."
                  value={submissionSearch}
                  onChange={(e) => setSubmissionSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-brand-light"
                />
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No student test attempt submissions match your selected filter criteria.
              </div>
            ) : (
              (() => {
                const totalSubPages = Math.max(1, Math.ceil(filteredSubmissions.length / subPageSize));
                const safeSubPage = Math.min(Math.max(1, subPage), totalSubPages);
                const paginatedSubmissions = filteredSubmissions.slice((safeSubPage - 1) * subPageSize, safeSubPage * subPageSize);

                return (
                  <>
                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                            <th className="px-4 py-3">Student Name &amp; Reg No</th>
                            <th className="px-4 py-3">Test Paper Title</th>
                            <th className="px-3 py-3 text-center">Score %</th>
                            <th className="px-3 py-3 text-center">Status</th>
                            <th className="px-3 py-3">Student Started (EAT)</th>
                            <th className="px-3 py-3">Submitted At (EAT)</th>
                            <th className="px-3 py-3 text-center">Submission Type</th>
                            <th className="px-3 py-3 text-center">Proctoring Logs</th>
                            <th className="px-4 py-3 text-right">Scorecard Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {paginatedSubmissions.map((att) => (
                            <tr key={att.id} className="hover:bg-slate-50/80 transition-all">
                              <td className="px-4 py-3">
                                <p className="font-extrabold text-slate-850">{att.student_name || att.student_username}</p>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono font-bold">{att.student_reg_number || `@${att.student_username}`}</span>
                                  {att.year_of_study && (
                                    <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-bold border border-slate-200">
                                      Yr {att.year_of_study}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800">{att.test_title}</p>
                                <span className="text-[10px] font-bold text-brand-medium">Course: {att.test_course_code}</span>
                              </td>
                              <td className="px-3 py-3 text-center font-black text-sm text-slate-850">
                                {att.score !== null && att.score !== undefined ? `${att.score}%` : 'N/A'}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${att.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {att.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
                                  🟢 {formatUgandanTime(att.started_at || att.start_time)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-600 font-medium text-[11px] whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
                                  🔴 {att.completed_at || att.submission_time ? formatUgandanTime(att.completed_at || att.submission_time) : <span className="text-amber-600 font-bold">In Progress</span>}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                {renderSubmissionTypeBadge(att.submission_type, att.auto_submitted_reason)}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${att.tab_switches_count > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                  {att.tab_switches_count > 0 ? `⚠️ ${att.tab_switches_count} Switches` : 'Clean'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => router.push(`/dashboard/tests/${att.test}/results?attemptId=${att.id}`)}
                                  className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                >
                                  📋 View Scorecard
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Submissions Pagination Controls Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500 font-semibold border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span>Showing {(safeSubPage - 1) * subPageSize + 1} - {Math.min(safeSubPage * subPageSize, filteredSubmissions.length)} of {filteredSubmissions.length} submissions</span>
                        <select
                          value={subPageSize}
                          onChange={(e) => { setSubPageSize(Number(e.target.value)); setSubPage(1); }}
                          className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-slate-700"
                        >
                          <option value={10}>10 per page</option>
                          <option value={20}>20 per page</option>
                          <option value={50}>50 per page</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setSubPage(1)}
                          disabled={safeSubPage <= 1}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          « First
                        </button>
                        <button
                          onClick={() => setSubPage(prev => Math.max(1, prev - 1))}
                          disabled={safeSubPage <= 1}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          ‹ Prev
                        </button>
                        <span className="px-3 py-1 font-bold text-slate-800">
                          Page {safeSubPage} of {totalSubPages}
                        </span>
                        <button
                          onClick={() => setSubPage(prev => Math.min(totalSubPages, prev + 1))}
                          disabled={safeSubPage >= totalSubPages}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          Next ›
                        </button>
                        <button
                          onClick={() => setSubPage(totalSubPages)}
                          disabled={safeSubPage >= totalSubPages}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          Last »
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT TEST (Staff) */}
      {editingTestModal && !isExecutiveReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-emerald-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-850">Edit Test Paper Details</h3>
              <button onClick={() => setEditingTestModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditTest} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Test Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Pass Mark %</label>
                  <input
                    type="number"
                    value={editPassPercentage}
                    onChange={(e) => setEditPassPercentage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl border-2 border-emerald-400 bg-emerald-50/30">
                  <label className="block text-[10px] text-emerald-800 font-extrabold mb-1 flex items-center space-x-1">
                    <span>🟢</span>
                    <span>Start Date & Time (EAT)</span>
                  </label>
                  <input
                    type="datetime-local"
                    min={getUgandanNowDatetimeLocal()}
                    value={editScheduledStart}
                    onChange={(e) => setEditScheduledStart(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded text-xs font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="p-2 rounded-xl border-2 border-red-400 bg-red-50/30">
                  <label className="block text-[10px] text-red-800 font-extrabold mb-1 flex items-center space-x-1">
                    <span>🔴</span>
                    <span>Stop Date & Time (EAT)</span>
                  </label>
                  <input
                    type="datetime-local"
                    min={editScheduledStart || getUgandanNowDatetimeLocal()}
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-red-300 rounded text-xs font-bold text-red-950 focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {assignedCourseUnits.length > 1 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Additional Assigned Units (Cross-Unit Setting)
                  </label>
                  <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1 text-xs">
                    {assignedCourseUnits.filter(u => String(u.id) !== String(editingTestModal.course_unit)).map((u) => (
                      <label key={u.id} className="flex items-center space-x-2 font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAdditionalCourseUnits.includes(u.id) || editAdditionalCourseUnits.includes(String(u.id))}
                          onChange={(e) => {
                            const uId = u.id;
                            if (e.target.checked) {
                              setEditAdditionalCourseUnits(prev => [...prev.filter(id => id !== uId), uId]);
                            } else {
                              setEditAdditionalCourseUnits(prev => prev.filter(id => id !== uId));
                            }
                          }}
                          className="rounded text-brand-light focus:ring-brand-light"
                        />
                        <span>[{u.code}] {u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-brand-light text-white text-xs font-bold rounded-lg">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingTestModal(null)} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FEE GATE ALERT */}
      {showFeeGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-amber-200 text-center">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-850 uppercase">Tuition Fee Gate Access Notice</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{feeGateMessage}</p>
            </div>
            <button
              onClick={() => setShowFeeGateModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md"
            >
              Understand & Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* SCORE CARD LAYOUT PREVIEW MODAL */}
      {scorecardPreviewData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Header Banner */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full">
                  📋 Score Card Layout Preview (Lecturer / Admin Draft View)
                </span>
                <h3 className="text-xl font-black text-slate-850 mt-2">{scorecardPreviewData.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Course: {scorecardPreviewData.course_code} ({scorecardPreviewData.course_name}) · Category: {scorecardPreviewData.category_display}
                </p>
              </div>
              <button
                onClick={() => setScorecardPreviewData(null)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Scorecard Header Card Simulation */}
            <div className={`rounded-2xl p-6 text-white text-center space-y-3 ${scorecardPreviewData.is_published ? 'bg-gradient-to-r from-emerald-900 to-slate-900' : 'bg-gradient-to-r from-amber-950 to-slate-900'}`}>
              <div className="flex items-center justify-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${scorecardPreviewData.is_published ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                  {scorecardPreviewData.is_published ? '🟢 PUBLISHED (Visible to Students)' : '🟡 DRAFT (Unpublished - Hidden from Students)'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20 p-4 rounded-xl border border-white/10 text-xs mt-4">
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Pass Target</span>
                  <span className="font-extrabold text-emerald-300">{scorecardPreviewData.pass_percentage}%</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Duration</span>
                  <span className="font-extrabold text-white">{scorecardPreviewData.duration_minutes} Mins</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Questions</span>
                  <span className="font-extrabold text-white">{scorecardPreviewData.total_questions} Questions</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Target Year</span>
                  <span className="font-extrabold text-amber-300">{scorecardPreviewData.year_of_study === 0 ? 'All Years' : `Year ${scorecardPreviewData.year_of_study}`}</span>
                </div>
              </div>
            </div>

            {/* Simulated Candidate Identity & Audit Banner Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase text-brand-dark bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Scorecard Layout Preview: Candidate Header & Audit Verification
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span>✅</span>
                  <span>Manual Submission</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Full Name</span>
                  <span className="font-extrabold text-slate-850 block">Sarah Namubiru (Sample)</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Registration Number</span>
                  <span className="font-mono font-bold text-brand-dark block">CIU/2026/BIT/042</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Student Started (EAT)</span>
                  <span className="font-mono text-slate-700 block">🟢 13 Oct 2026, 09:00 EAT</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Submitted At (EAT)</span>
                  <span className="font-mono text-slate-700 block">🔴 13 Oct 2026, 09:45 EAT</span>
                </div>
              </div>
            </div>

            {/* Questions Breakdown & Editing */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Scorecard Answer Key & Questions Editor</h4>
                
                {!isExecutiveReadOnly && canBuildTest && (
                  <button
                    onClick={() => {
                      setEditingQId(null);
                      setQEditForm({
                        question_text: '',
                        question_type: 'mcq',
                        option_a: '',
                        option_b: '',
                        option_c: '',
                        option_d: '',
                        correct_answer: 'A',
                        points: 1.0,
                        explanation: ''
                      });
                      setShowScorecardAddQ(true);
                    }}
                    className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    ➕ Add Question to Score Card
                  </button>
                )}
              </div>

              {/* Add New Question Form */}
              {showScorecardAddQ && (
                <div className="p-4 bg-purple-50/70 border-2 border-purple-200 rounded-2xl space-y-3 animate-fade-in text-xs">
                  <h5 className="font-extrabold text-purple-950 uppercase text-xs">Add New Question to Score Card</h5>
                  
                  <textarea
                    placeholder="Type question text..."
                    value={qEditForm.question_text}
                    onChange={(e) => setQEditForm({ ...qEditForm, question_text: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl"
                    rows={2}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Option A"
                      value={qEditForm.option_a}
                      onChange={(e) => setQEditForm({ ...qEditForm, option_a: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option B"
                      value={qEditForm.option_b}
                      onChange={(e) => setQEditForm({ ...qEditForm, option_b: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option C"
                      value={qEditForm.option_c}
                      onChange={(e) => setQEditForm({ ...qEditForm, option_c: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option D"
                      value={qEditForm.option_d}
                      onChange={(e) => setQEditForm({ ...qEditForm, option_d: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-[10px] text-purple-900 uppercase mb-0.5">Correct Option</label>
                      <select
                        value={qEditForm.correct_answer}
                        onChange={(e) => setQEditForm({ ...qEditForm, correct_answer: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl font-bold"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-[10px] text-purple-900 uppercase mb-0.5">Points</label>
                      <input
                        type="number"
                        step="0.5"
                        value={qEditForm.points}
                        onChange={(e) => setQEditForm({ ...qEditForm, points: parseFloat(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl font-bold"
                      />
                    </div>
                  </div>

                  <textarea
                    placeholder="Lecturer explanation (optional)..."
                    value={qEditForm.explanation}
                    onChange={(e) => setQEditForm({ ...qEditForm, explanation: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    rows={1}
                  />

                  <div className="flex space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveScorecardQuestion(scorecardPreviewData.id)}
                      className="px-4 py-1.5 bg-brand-light text-white font-bold rounded-xl text-xs"
                    >
                      💾 Save Question
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScorecardAddQ(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {(!scorecardPreviewData.questions || scorecardPreviewData.questions.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs italic">
                  No questions added to this test yet. Click &quot;Add Question to Score Card&quot; above to set questions.
                </div>
              ) : (
                <div className="space-y-4">
                  {scorecardPreviewData.questions.map((q, idx) => {
                    const isEditing = editingQId === q.id;

                    if (isEditing) {
                      return (
                        <div key={q.id} className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-3 text-xs animate-fade-in">
                          <div className="flex items-center justify-between font-extrabold text-amber-950">
                            <span>Editing Q{idx + 1}</span>
                            <button onClick={() => setEditingQId(null)} className="text-slate-500 hover:text-slate-800">✕</button>
                          </div>

                          <textarea
                            value={qEditForm.question_text}
                            onChange={(e) => setQEditForm({ ...qEditForm, question_text: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold"
                            rows={2}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Option A"
                              value={qEditForm.option_a}
                              onChange={(e) => setQEditForm({ ...qEditForm, option_a: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option B"
                              value={qEditForm.option_b}
                              onChange={(e) => setQEditForm({ ...qEditForm, option_b: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option C"
                              value={qEditForm.option_c}
                              onChange={(e) => setQEditForm({ ...qEditForm, option_c: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option D"
                              value={qEditForm.option_d}
                              onChange={(e) => setQEditForm({ ...qEditForm, option_d: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-[10px] text-amber-900 uppercase mb-0.5">Correct Option</label>
                              <select
                                value={qEditForm.correct_answer}
                                onChange={(e) => setQEditForm({ ...qEditForm, correct_answer: e.target.value })}
                                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold"
                              >
                                <option value="A">Option A</option>
                                <option value="B">Option B</option>
                                <option value="C">Option C</option>
                                <option value="D">Option D</option>
                              </select>
                            </div>

                            <div>
                              <label className="block font-bold text-[10px] text-amber-900 uppercase mb-0.5">Points</label>
                              <input
                                type="number"
                                step="0.5"
                                value={qEditForm.points}
                                onChange={(e) => setQEditForm({ ...qEditForm, points: parseFloat(e.target.value) })}
                                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold"
                              />
                            </div>
                          </div>

                          <textarea
                            placeholder="Lecturer explanation..."
                            value={qEditForm.explanation}
                            onChange={(e) => setQEditForm({ ...qEditForm, explanation: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            rows={1}
                          />

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => handleSaveScorecardQuestion(scorecardPreviewData.id, q.id)}
                                className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs"
                              >
                                💾 Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingQId(null)}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteScorecardQuestion(scorecardPreviewData.id, q.id)}
                              className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 font-bold rounded-xl text-xs"
                            >
                              🗑️ Delete Question
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={q.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-slate-800 text-xs">
                            Q{idx + 1}: {q.question_text}
                          </span>
                          
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              {q.points || 1} Point(s)
                            </span>

                            {!isExecutiveReadOnly && canBuildTest && (
                              <button
                                onClick={() => {
                                  setEditingQId(q.id);
                                  setShowScorecardAddQ(false);
                                  setQEditForm({
                                    question_text: q.question_text || '',
                                    question_type: q.question_type || 'mcq',
                                    option_a: q.option_a || '',
                                    option_b: q.option_b || '',
                                    option_c: q.option_c || '',
                                    option_d: q.option_d || '',
                                    correct_answer: q.correct_answer || 'A',
                                    points: q.points || 1.0,
                                    explanation: q.explanation || ''
                                  });
                                }}
                                className="px-2 py-0.5 bg-amber-100 text-amber-800 hover:bg-amber-200 text-[10px] font-extrabold rounded border border-amber-300"
                              >
                                ✏️ Edit
                              </button>
                            )}
                          </div>
                        </div>

                        {q.question_type === 'mcq' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium">
                            {['A', 'B', 'C', 'D'].map((optKey) => {
                              const optText = q[`option_${optKey.toLowerCase()}`];
                              const isCorrect = String(q.correct_answer).toUpperCase() === optKey;
                              if (!optText) return null;
                              return (
                                <div key={optKey} className={`p-2.5 rounded-xl border flex items-center space-x-2 ${isCorrect ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                    {optKey}
                                  </span>
                                  <span>{optText}</span>
                                  {isCorrect && <span className="ml-auto text-xs text-emerald-700 font-bold">✓ Official Key</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <p className="text-[11px] text-slate-600 italic bg-white p-2.5 rounded-xl border border-slate-200">
                            💡 <strong>Lecturer Explanation:</strong> {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setScorecardPreviewData(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                Close Preview
              </button>

              {!isExecutiveReadOnly && (
                <button
                  onClick={async () => {
                    await handleTogglePublish(scorecardPreviewData);
                    const updated = await api.get(`/tests/${scorecardPreviewData.id}/preview_scorecard/`);
                    setScorecardPreviewData(updated);
                  }}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${scorecardPreviewData.is_published ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {scorecardPreviewData.is_published ? 'Unpublish Test' : 'Publish Test Now'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: AIKEN TXT IMPORT & TRANSLATION */}
      {showTxtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">
                  {txtMode === 'append' ? `Import Questions into "${selectedTest?.title}"` : 'Translate .TXT File into Test Paper'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Standard Aiken Format Parser (Questions, Options A-D, ANSWER: X)</p>
              </div>
              <button onClick={() => setShowTxtModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadTxtTest} className="space-y-3 text-xs">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1.5 text-teal-900">
                <p className="font-bold flex items-center justify-between">
                  <span>Aiken Format Structure:</span>
                  <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-extrabold">Instant Auto-Translation</span>
                </p>
                <div className="font-mono text-[10.5px] bg-white p-2 rounded-lg border border-teal-200 text-slate-700 leading-relaxed">
                  Question text goes here on line 1<br/>
                  A. First option<br/>
                  B. Second option<br/>
                  C. Third option<br/>
                  D. Fourth option<br/>
                  ANSWER: B
                </div>
              </div>

              {txtMode === 'new' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Course Unit *</label>
                      <select
                        value={txtCourseUnit}
                        onChange={(e) => setTxtCourseUnit(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        required
                      >
                        <option value="">-- Select Course Unit --</option>
                        {assignedCourseUnits.map(u => (
                          <option key={u.id} value={u.id}>[{u.code}] {u.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Category</label>
                      <select
                        value={txtCategory}
                        onChange={(e) => setTxtCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      >
                        <option value="unit_test">Unit Test</option>
                        <option value="quiz">Quiz</option>
                        <option value="practice">Practice Test</option>
                        <option value="midterm">Midterm Test</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Test Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Neurology Clinical Assessment Test"
                      value={txtTitle}
                      onChange={(e) => setTxtTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Duration (mins)</label>
                      <input
                        type="number"
                        value={txtDuration}
                        onChange={(e) => setTxtDuration(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Start Time (EAT)</label>
                      <input
                        type="datetime-local"
                        value={txtScheduledStart}
                        onChange={(e) => setTxtScheduledStart(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Due Date (EAT)</label>
                      <input
                        type="datetime-local"
                        value={txtDueDate}
                        onChange={(e) => setTxtDueDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select .txt File (e.g. neuro.txt)</label>
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => setTxtFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase font-bold">Or Paste Aiken Content</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={txtText}
                  onChange={(e) => setTxtText(e.target.value)}
                  placeholder="Paste question text, options A-D, and ANSWER: X here..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={downloadSampleAiken}
                  className="text-teal-700 hover:text-teal-800 text-[11px] font-bold underline flex items-center space-x-1"
                >
                  <span>📥 Download Sample Aiken .txt</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTxtModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Translating...' : txtMode === 'append' ? 'Translate & Append' : 'Translate & Create Test'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LIVE ATTEMPTING STUDENTS MONITOR */}
      {liveStudentsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">👥</span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Candidate Monitoring: {liveStudentsModal.test?.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                    liveStudentsModal.data?.test_status === 'In Progress'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : liveStudentsModal.data?.test_status === 'Scheduled'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-red-100 text-red-900 border-red-300'
                  }`}>
                    {liveStudentsModal.data?.test_status || 'Assessment'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Course: <strong className="text-slate-700">[{liveStudentsModal.test?.course_code}]</strong> {liveStudentsModal.test?.course_name} · Lecturer: {liveStudentsModal.test?.lecturer_name || 'Assigned Lecturer'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLiveStudentsModal}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Metrics & Filter Bar */}
            <div className="p-5 border-b border-slate-100 space-y-4">
              {/* Counts */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-100/70 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Candidates</span>
                  <span className="text-lg font-black text-slate-900">{liveStudentsModal.data?.counts?.total ?? '...'}</span>
                </div>
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">🟢 Started / Taking</span>
                  <span className="text-lg font-black text-blue-900">{liveStudentsModal.data?.counts?.started ?? '...'}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">✅ Submitted</span>
                  <span className="text-lg font-black text-emerald-900">{liveStudentsModal.data?.counts?.submitted ?? '...'}</span>
                </div>
                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">⏳ Pending</span>
                  <span className="text-lg font-black text-amber-900">{liveStudentsModal.data?.counts?.pending ?? '...'}</span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-500">Status:</span>
                  {['All', 'Started', 'Pending', 'Submitted'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setLiveStudentsModal(prev => ({ ...prev, statusFilter: st }))}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        liveStudentsModal.statusFilter === st
                          ? 'bg-brand-dark text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-500">Group By:</span>
                    <select
                      value={liveStudentsModal.groupBy}
                      onChange={(e) => setLiveStudentsModal(prev => ({ ...prev, groupBy: e.target.value }))}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="faculty">Faculty</option>
                      <option value="course_unit">Course Unit</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    placeholder="Search candidate name or reg no..."
                    value={liveStudentsModal.search}
                    onChange={(e) => setLiveStudentsModal(prev => ({ ...prev, search: e.target.value }))}
                    className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs w-56 focus:outline-none focus:ring-1 focus:ring-brand-light"
                  />
                </div>
              </div>
            </div>

            {/* Students List / Grouped View */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {liveStudentsModal.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
                </div>
              ) : (
                (() => {
                  let filtered = (liveStudentsModal.data?.students || []).filter(s => {
                    if (liveStudentsModal.statusFilter !== 'All' && s.status !== liveStudentsModal.statusFilter) return false;
                    if (liveStudentsModal.search) {
                      const q = liveStudentsModal.search.toLowerCase();
                      const matchName = (s.student_name || '').toLowerCase().includes(q);
                      const matchReg = (s.reg_number || '').toLowerCase().includes(q);
                      if (!matchName && !matchReg) return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-500 font-semibold text-xs">
                        No candidate records found matching current status filter.
                      </div>
                    );
                  }

                  // Render grouped or flat table
                  const renderTable = (items) => (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                          <th className="px-3 py-2.5">Candidate Details</th>
                          <th className="px-3 py-2.5">Faculty & Unit</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="px-3 py-2.5">Start Time (EAT)</th>
                          <th className="px-3 py-2.5">Submission (EAT)</th>
                          <th className="px-3 py-2.5 text-center">Score</th>
                          <th className="px-3 py-2.5 text-center">Tab Switches</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(std => (
                          <tr key={std.student_id} className="hover:bg-slate-50/70 transition-all">
                            <td className="px-3 py-2.5">
                              <span className="font-bold text-slate-900 block">{std.student_name}</span>
                              <span className="font-mono text-[11px] text-slate-500 font-bold block">{std.reg_number || 'No Reg No'}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-slate-800 font-semibold block">{std.faculty || 'General'}</span>
                              <span className="text-[10px] text-slate-500 block">{std.course_unit || 'Assigned Unit'}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                std.status === 'Submitted'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : std.status === 'Started'
                                  ? 'bg-blue-100 text-blue-900 border-blue-300 animate-pulse'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}>
                                {std.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[11px] font-mono text-slate-700">
                              {std.started_at ? formatUgandanTime(std.started_at) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] font-mono text-slate-700">
                              {std.completed_at ? (
                                <div>
                                  <span>{formatUgandanTime(std.completed_at)}</span>
                                  <div className="mt-0.5">
                                    {renderSubmissionTypeBadge(std.submission_type, std.auto_submitted_reason || std.auto_reason)}
                                  </div>
                                </div>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold">
                              {std.score !== null && std.score !== undefined ? `${std.score}%` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-mono font-bold text-xs ${std.tab_switches > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                {std.tab_switches || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );

                  if (liveStudentsModal.groupBy === 'faculty') {
                    const groups = {};
                    filtered.forEach(s => {
                      const f = s.faculty || 'General Faculty';
                      if (!groups[f]) groups[f] = [];
                      groups[f].push(s);
                    });
                    return Object.entries(groups).map(([facName, sList]) => (
                      <div key={facName} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="bg-slate-100 px-4 py-2 font-extrabold text-xs text-slate-800 flex items-center justify-between">
                          <span>🏛️ {facName}</span>
                          <span className="bg-white px-2 py-0.5 rounded text-[10px] text-slate-700 border border-slate-200">{sList.length} Students</span>
                        </div>
                        {renderTable(sList)}
                      </div>
                    ));
                  }

                  if (liveStudentsModal.groupBy === 'course_unit') {
                    const groups = {};
                    filtered.forEach(s => {
                      const u = s.course_unit || 'Default Unit';
                      if (!groups[u]) groups[u] = [];
                      groups[u].push(s);
                    });
                    return Object.entries(groups).map(([uName, sList]) => (
                      <div key={uName} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="bg-slate-100 px-4 py-2 font-extrabold text-xs text-slate-800 flex items-center justify-between">
                          <span>📚 {uName}</span>
                          <span className="bg-white px-2 py-0.5 rounded text-[10px] text-slate-700 border border-slate-200">{sList.length} Students</span>
                        </div>
                        {renderTable(sList)}
                      </div>
                    ));
                  }

                  return (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      {renderTable(filtered)}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[11px] text-slate-500 font-medium">
                🕒 All start and completion timestamps rendered strictly in Ugandan Time (EAT, UTC+3)
              </span>
              <button
                type="button"
                onClick={closeLiveStudentsModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Close Monitor
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Universal Fluid Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        icon={confirmModal.icon}
        loading={confirmModal.loading}
      />

    </div>
  );
}
