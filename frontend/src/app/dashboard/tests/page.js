'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

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

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'builder', 'analytics', 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Fee Gate Alert Modal
  const [showFeeGateModal, setShowFeeGateModal] = useState(false);
  const [feeGateMessage, setFeeGateMessage] = useState('');

  // Test Builder State
  const [title, setTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [category, setCategory] = useState('quiz');
  const [duration, setDuration] = useState(30);
  const [passPercentage, setPassPercentage] = useState(50);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [description, setDescription] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Edit Test Modal State
  const [editingTestModal, setEditingTestModal] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editPassPercentage, setEditPassPercentage] = useState(50);
  const [editAllowedAttempts, setEditAllowedAttempts] = useState(1);
  const [editScheduledStart, setEditScheduledStart] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

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

  const isAdmin = user?.role === 'admin';
  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isStaff = ['lecturer', 'admin', 'faculty_admin', 'dean', 'registrar', 'dvc', 'vc'].includes(user?.role);
  const isLecturer = user?.role === 'lecturer';
  const canBuildTest = ['lecturer', 'admin', 'faculty_admin'].includes(user?.role) && !isExecutiveReadOnly;

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

  // Filter assigned courses and faculties for Lecturers
  const assignedCourses = isLecturer
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : courses;

  const scopedFaculties = isLecturer
    ? faculties.filter(f => assignedCourses.some(c => c.faculty === f.id || c.faculty_code === f.code))
    : faculties;

  const handleDeleteTest = async (testItem) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && testItem.lecturer !== user.id && testItem.lecturer_name !== user.username) {
      setErrorMsg('Permission Denied: You can only delete tests created by you.');
      return;
    }
    if (!confirm('Are you sure you want to delete this test paper?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.delete(`/tests/${testItem.id}/`);
      setSuccessMsg('Test paper deleted successfully.');
      if (selectedTest?.id === testItem.id) setSelectedTest(null);
      loadPortalData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete test paper.');
    }
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
    setEditScheduledStart(testItem.scheduled_start ? new Date(testItem.scheduled_start).toISOString().slice(0, 16) : '');
    setEditDueDate(testItem.due_date ? new Date(testItem.due_date).toISOString().slice(0, 16) : '');
  };

  const handleSaveEditTest = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly || !editingTestModal) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: editTitle,
        duration_minutes: parseInt(editDuration),
        pass_percentage: parseFloat(editPassPercentage),
        allowed_attempts: parseInt(editAllowedAttempts),
        scheduled_start: editScheduledStart ? new Date(editScheduledStart).toISOString() : null,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null
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
    if (!title || !selectedCourse) {
      setErrorMsg('Please specify a title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title,
        course: parseInt(selectedCourse),
        category,
        duration_minutes: parseInt(duration),
        pass_percentage: parseFloat(passPercentage),
        allowed_attempts: parseInt(allowedAttempts),
        description,
        is_published: true
      };
      if (scheduledStart) {
        payload.scheduled_start = new Date(scheduledStart).toISOString();
      }
      if (dueDate) {
        payload.due_date = new Date(dueDate).toISOString();
      }
      const created = await api.post('/tests/', payload);
      setSuccessMsg('Test created successfully! Select it below to add questions.');
      setTitle('');
      setSelectedCourse('');
      setDescription('');
      setScheduledStart('');
      setDueDate('');
      loadPortalData();
      setSelectedTest(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create test paper.');
    } finally {
      setSubmitting(false);
    }
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
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const qData = await api.get(`/tests/${testItem.id}/questions/`);
      setQuestions(qData || []);
    } catch (err) {
      setErrorMsg('Failed to fetch questions for selected test.');
    }
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
    
    // Tuition Fee Gate Check: Must have at least 50% tuition clearance or CIU API clearance!
    const tuitionPaid = user?.tuition_paid_percentage ?? 100.0;
    const isTestCleared = user?.is_test_cleared ?? (tuitionPaid >= 50.0);

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
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.course_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseFilter ? t.course === parseInt(selectedCourseFilter) : true;
    const matchesCategory = selectedCategoryFilter ? t.category === selectedCategoryFilter : true;
    const fCode = t.faculty_code || (courses.find(c => c.id === t.course)?.faculty_code);
    const matchesFaculty = selectedFacultyFilter === 'All' ? true : fCode === selectedFacultyFilter;
    return matchesSearch && matchesCourse && matchesCategory && matchesFaculty;
  });

  // Calculate Metrics
  const activeTestsCount = tests.filter(t => t.is_published).length;
  const totalSubmissions = attempts.filter(a => a.completed_at).length;
  const passRate = attempts.length > 0 ? ((attempts.filter(a => a.passed).length / attempts.length) * 100).toFixed(1) : '0';

  // Group Tests under Faculties for Staff
  const activeFacultiesList = isLecturer ? scopedFaculties : faculties;
  
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

      {/* Toolbar: Search, Faculty Filter, Course Filter, Category Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 green-card p-4 rounded-2xl">
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search tests or courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-brand-light"
          />

          {/* Staff Faculty Filter */}
          {isStaff && (
            <select
              value={selectedFacultyFilter}
              onChange={(e) => setSelectedFacultyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-light"
            >
              <option value="All">All Faculties ({activeFacultiesList.length})</option>
              {activeFacultiesList.map((f) => (
                <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
              ))}
            </select>
          )}

          {/* Course filter */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-light"
          >
            <option value="">All Courses ({assignedCourses.length})</option>
            {assignedCourses.map((c) => (
              <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-light"
          >
            <option value="">All Categories</option>
            <option value="quiz">Quiz</option>
            <option value="practice">Practice Test</option>
            <option value="unit_test">Unit Test</option>
            <option value="midterm">Midterm Test</option>
            <option value="assignment">Assignment Test</option>
          </select>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 bg-emerald-50/60 border border-emerald-200/60 p-1 rounded-xl w-full sm:w-auto justify-center">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'catalog' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Test Catalog
          </button>
          
          {canBuildTest && (
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'builder' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Test Builder
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Submissions
            </button>
          )}

          {!isStaff && (
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              My Performance
            </button>
          )}
        </div>

      </div>

      {/* TAB 1: CATALOG (Organized by Faculty for Staff) */}
      {activeTab === 'catalog' && (
        user.role === 'student' ? (
          /* Student Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.length === 0 ? (
              <div className="col-span-full py-16 green-card rounded-2xl text-center">
                <p className="text-slate-400 text-xs font-semibold">No tests match your active search or filter rules.</p>
              </div>
            ) : (
              filteredTests.map((testItem) => {
                const myAttempt = attempts.find(a => a.test === testItem.id);
                return (
                  <div key={testItem.id} className="green-card rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {testItem.category.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${testItem.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                          {testItem.is_results_released ? 'RESULTS RELEASED' : 'WITHHELD'}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-850 text-base leading-tight">{testItem.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">Course: <span className="font-semibold text-slate-800">[{testItem.course_code}] {testItem.course_name}</span></p>
                      
                      <div className="pt-2 text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                        <p>⏱️ Duration: <span className="font-bold text-slate-800">{testItem.duration_minutes} mins</span> | 🎯 Pass Mark: <span className="font-bold text-slate-800">{testItem.pass_percentage}%</span></p>
                        <p>📅 Scheduled Start: <span className="font-bold text-slate-800">{testItem.scheduled_start ? new Date(testItem.scheduled_start).toLocaleString([], {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Open Anytime'}</span></p>
                        {testItem.due_date && (
                          <p>⏳ Due Date (Deadline): <span className="font-bold text-amber-700">{new Date(testItem.due_date).toLocaleString([], {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span></p>
                        )}
                        <p>❓ Questions: <span className="font-bold text-slate-800">{testItem.questions_count}</span> | 💰 Fee Gate: <span className="font-bold text-emerald-700">50%+ Paid</span></p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      {myAttempt ? (
                        myAttempt.completed_at ? (
                          <div className="w-full flex items-center justify-between">
                            {testItem.is_results_released ? (
                              <>
                                <span className={`px-2.5 py-1 rounded text-xs font-bold border ${myAttempt.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  Score: {myAttempt.score}% ({myAttempt.passed ? 'PASSED' : 'FAILED'})
                                </span>
                                <button
                                  onClick={() => router.push(`/dashboard/tests/${testItem.id}/results?attemptId=${myAttempt.id}`)}
                                  className="px-3 py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg hover:bg-brand-medium transition-all"
                                >
                                  View Scorecard
                                </button>
                              </>
                            ) : (
                              <span className="w-full text-center px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                🔒 Results Pending Release by Lecturer
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => router.push(`/dashboard/tests/${testItem.id}`)}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all"
                          >
                            Resume Active Test
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => startTestAttempt(testItem.id)}
                          disabled={testItem.questions_count === 0}
                          className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                          Launch Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* STAFF FACULTY ORGANIZED TESTS VIEW */
          <div className="space-y-8">
            {testFacultyGroups.map(({ faculty, tests: facTests }) => {
              if (selectedFacultyFilter !== 'All' && faculty.code !== selectedFacultyFilter) return null;
              return (
                <div key={faculty.id} className="green-card rounded-2xl p-6 space-y-4">
                  
                  {/* Faculty Header */}
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 bg-brand-light/10 text-brand-dark font-black text-xs rounded-lg border border-brand-light/20 uppercase">
                        {faculty.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-850">{faculty.name}</h3>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      {facTests.length} Tests Published
                    </span>
                  </div>

                  {facTests.length === 0 ? (
                    <p className="text-slate-400 text-xs py-4 text-center italic">No tests created for {faculty.name} yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {facTests.map((testItem) => {
                        const canManageThisTest = isAdmin || (isLecturer && (testItem.lecturer === user.id || testItem.lecturer_name === user.username));
                        return (
                          <div key={testItem.id} className="bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl border border-emerald-200/80 p-5 shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {testItem.category.replace('_', ' ')}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${testItem.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {testItem.is_published ? 'PUBLISHED' : 'DRAFT'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${testItem.is_results_released ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                    {testItem.is_results_released ? 'RELEASED' : 'WITHHELD'}
                                  </span>
                                </div>
                              </div>

                              <h4 className="font-bold text-slate-850 text-base leading-tight">{testItem.title}</h4>
                              <p className="text-xs text-slate-500 font-medium">Course: <span className="font-semibold text-slate-800">[{testItem.course_code}] {testItem.course_name}</span></p>
                              <p className="text-xs text-slate-500">Lecturer: <span className="font-semibold text-slate-800">{testItem.lecturer_name}</span></p>
                              
                              <div className="pt-2 text-[11px] text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200 font-medium">
                                <p>⏱️ Duration: <span className="font-bold text-slate-800">{testItem.duration_minutes} mins</span> | 🎯 Pass Mark: <span className="font-bold text-slate-800">{testItem.pass_percentage}%</span></p>
                                <p>❓ Questions: <span className="font-bold text-slate-800">{testItem.questions_count}</span></p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1">
                              <button
                                onClick={() => handleSelectTestForQuestions(testItem)}
                                className="px-2 py-1 bg-white border border-emerald-200 hover:bg-emerald-50 text-slate-800 text-xs font-bold rounded-lg transition-all"
                              >
                                Questions ({testItem.questions_count})
                              </button>
                              
                              {!isExecutiveReadOnly && (
                                <>
                                  {canManageThisTest && (
                                    <>
                                      <button
                                        onClick={() => handleTogglePublish(testItem)}
                                        className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${testItem.is_published ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-brand-light text-white'}`}
                                      >
                                        {testItem.is_published ? 'Unpublish' : 'Publish'}
                                      </button>

                                      <button
                                        onClick={() => handleToggleResultsRelease(testItem)}
                                        className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${testItem.is_results_released ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-emerald-600 text-white'}`}
                                        title="Toggle student score release"
                                      >
                                        {testItem.is_results_released ? '🔒 Withhold' : '📢 Release'}
                                      </button>

                                      <button
                                        onClick={() => handleOpenEditTestModal(testItem)}
                                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition-all border border-emerald-200"
                                        title="Edit test paper details"
                                      >
                                        ✏️ Edit
                                      </button>

                                      <button
                                        onClick={() => handleDeleteTest(testItem)}
                                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-all border border-red-200"
                                        title="Delete test paper"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </>
                                  )}
                                </>
                              )}

                              <button
                                onClick={() => downloadResultsCSV(testItem.id)}
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                                title="Export Test Results CSV"
                              >
                                📊 CSV
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned Tests */}
            {unassignedTests.length > 0 && (
              <div className="green-card rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">General / Unassigned Faculty Tests</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unassignedTests.map((testItem) => (
                    <div key={testItem.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-850 text-sm">{testItem.title}</h4>
                      <p className="text-xs text-slate-500">Course: {testItem.course_code} · Lecturer: {testItem.lecturer_name}</p>
                      <button
                        onClick={() => handleSelectTestForQuestions(testItem)}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg"
                      >
                        Questions ({testItem.questions_count})
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 2: TEST BUILDER & QUESTION EDITOR (Staff) */}
      {canBuildTest && activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Test Form */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Create New Test</h3>

            <form onSubmit={handleCreateTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Select Course Program</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-brand-light"
                  required
                >
                  <option value="">Select Course...</option>
                  {assignedCourses.map((c) => (
                    <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Test Title</label>
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
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Scheduled Start</label>
                  <input
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
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
                className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
              >
                {submitting ? 'Creating...' : 'Save & Build Question Bank'}
              </button>
            </form>
          </div>

          {/* Question Builder */}
          <div className="lg:col-span-2 green-card rounded-2xl p-6 space-y-4">
            {selectedTest ? (
              <div className="space-y-4">
                
                {/* Header & Preset Seeder */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-850">Managing Question Bank</h3>
                    <p className="text-xs text-brand-medium font-semibold">Test: {selectedTest.title} ({selectedTest.course_code})</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!isExecutiveReadOnly && (
                      <button
                        onClick={() => handleBulkSeedQuestions(selectedTest.id)}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                      >
                        ⚡ Seed Sample Package
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTest(null)}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      Close Editor
                    </button>
                  </div>
                </div>

                {/* Existing Questions List */}
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {questions.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No questions added to this test yet. Click "Seed Sample Package" or fill the form below.
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-800">Q{idx + 1} ({q.question_type.toUpperCase()} · {q.points} pt): {q.question_text}</span>
                        </div>
                        {q.question_type === 'mcq' && (
                          <p className="text-slate-500 font-medium">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                        )}
                        <p className="text-emerald-700 font-bold">Answer Key: {q.correct_answer}</p>
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
                        <select value={qType} onChange={(e) => setQType(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <option value="mcq">Multiple Choice</option>
                          <option value="tf">True / False</option>
                          <option value="short">Short Answer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Points</label>
                        <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
                      </div>
                    </div>

                    {qType === 'mcq' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Option A" value={optA} onChange={(e) => setOptA(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" required />
                        <input type="text" placeholder="Option B" value={optB} onChange={(e) => setOptB(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" required />
                        <input type="text" placeholder="Option C" value={optC} onChange={(e) => setOptC(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" required />
                        <input type="text" placeholder="Option D" value={optD} onChange={(e) => setOptD(e.target.value)} className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" required />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Correct Answer / Key</label>
                      <input type="text" placeholder="A, B, C, D, True, False, or short answer text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" required />
                    </div>

                    <button type="submit" disabled={submitting} className="w-full py-2 bg-brand-light text-white text-xs font-bold rounded-lg shadow-sm">
                      Add Question to Test
                    </button>
                  </form>
                )}

              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                Select a test from the Test Catalog or create one using the builder form on the left.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: SUBMISSIONS ANALYTICS (Staff) */}
      {isStaff && activeTab === 'analytics' && (
        <div className="green-card rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Student Assessment Attempt Records</h3>
          
          {attempts.length === 0 ? (
            <p className="text-slate-400 text-xs py-8 text-center">No student test attempts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Test Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Score (%)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 font-bold text-slate-850">{att.student_name}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{att.test_title}</td>
                      <td className="px-4 py-3 capitalize">{att.test_category}</td>
                      <td className="px-4 py-3 text-center font-bold text-brand-dark">{att.score}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${att.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {att.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In Progress'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Scheduled Start</label>
                  <input
                    type="datetime-local"
                    value={editScheduledStart}
                    onChange={(e) => setEditScheduledStart(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

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

    </div>
  );
}
