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
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'builder', 'analytics', 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Test Builder State
  const [title, setTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [category, setCategory] = useState('quiz');
  const [duration, setDuration] = useState(30);
  const [passPercentage, setPassPercentage] = useState(50);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [description, setDescription] = useState('');

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

  const isStaff = ['lecturer', 'admin', 'faculty_admin', 'dean', 'registrar', 'dvc'].includes(user?.role);

  useEffect(() => {
    loadPortalData();
  }, []);

  async function loadPortalData() {
    try {
      setLoading(true);
      const [testsData, coursesData, unitsData, attemptsData] = await Promise.all([
        api.get('/tests/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/test-attempts/').catch(() => [])
      ]);
      setTests(testsData || []);
      setCourses(coursesData || []);
      setCourseUnits(unitsData || []);
      setAttempts(attemptsData || []);
    } catch (err) {
      setErrorMsg('Failed to fetch test portal datasets.');
    } finally {
      setLoading(false);
    }
  }

  // Filter assigned courses for Lecturers
  const assignedCourses = user?.role === 'lecturer'
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : courses;

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!title || !selectedCourse) {
      setErrorMsg('Please specify a title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const created = await api.post('/tests/', {
        title,
        course: parseInt(selectedCourse),
        category,
        duration_minutes: parseInt(duration),
        pass_percentage: parseFloat(passPercentage),
        allowed_attempts: parseInt(allowedAttempts),
        description,
        is_published: false
      });
      setSuccessMsg('Test created successfully! Select it below to add questions.');
      setTitle('');
      setDescription('');
      setSelectedCourse('');
      loadPortalData();
      setSelectedTest(created);
    } catch (err) {
      setErrorMsg(err.message || 'Test creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (testItem) => {
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
    try {
      await api.post(`/tests/${testId}/start_attempt/`);
      router.push(`/dashboard/tests/${testId}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to launch test.');
    }
  };

  const downloadResultsCSV = (testId) => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://examiner.ciu.ac.ug/api';
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
    return matchesSearch && matchesCourse && matchesCategory;
  });

  // Calculate Metrics
  const activeTestsCount = tests.filter(t => t.is_published).length;
  const totalSubmissions = attempts.filter(a => a.completed_at).length;
  const avgScore = attempts.length > 0 ? (attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.length).toFixed(1) : '0';
  const passRate = attempts.length > 0 ? ((attempts.filter(a => a.passed).length / attempts.length) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">CIU Assessment & Test Portal</h2>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Seamlessly create, build question banks, conduct timed tests, and track class analytics.</p>
        </div>

        {/* Quick Metrics Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Tests</span>
            <span className="text-sm font-extrabold text-brand-dark">{activeTestsCount}</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submissions</span>
            <span className="text-sm font-extrabold text-brand-medium">{totalSubmissions}</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Avg. Score</span>
            <span className="text-sm font-extrabold text-indigo-600">{avgScore}%</span>
          </div>
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-center">
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

      {/* Toolbar: Search, Course Filter, Category Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-150 shadow-sm">
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search tests or courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full sm:w-48 focus:outline-none focus:ring-1 focus:ring-brand-light"
          />

          {/* Course filter */}
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-light"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
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
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-center">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'catalog' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Test Catalog
          </button>
          
          {isStaff && (
            <>
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'builder' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Test Builder
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Submissions
              </button>
            </>
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

      {/* TAB 1: CATALOG */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.length === 0 ? (
            <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-100 text-center">
              <p className="text-slate-400 text-xs font-semibold">No tests match your active search or filter rules.</p>
            </div>
          ) : (
            filteredTests.map((testItem) => {
              const myAttempt = attempts.find(a => a.test === testItem.id);
              return (
                <div key={testItem.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  
                  {/* Top card info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {testItem.category.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${testItem.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {testItem.is_published ? 'PUBLISHED' : 'DRAFT'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-850 text-base leading-tight">{testItem.title}</h3>
                    <p className="text-xs text-slate-500 font-medium">Course: <span className="font-semibold text-slate-800">[{testItem.course_code}] {testItem.course_name}</span></p>
                    
                    <div className="pt-2 text-[11px] text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p>⏱️ Duration: <span className="font-bold text-slate-700">{testItem.duration_minutes} mins</span></p>
                      <p>🎯 Pass Mark: <span className="font-bold text-slate-700">{testItem.pass_percentage}%</span></p>
                      <p>❓ Questions: <span className="font-bold text-slate-700">{testItem.questions_count}</span></p>
                      <p>🔒 Security: <span className="font-bold text-slate-700">Strict Tab Locking & Half-Time Cutoff</span></p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isStaff ? (
                      <>
                        <button
                          onClick={() => handleSelectTestForQuestions(testItem)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-all"
                        >
                          Questions ({testItem.questions_count})
                        </button>
                        <button
                          onClick={() => handleTogglePublish(testItem)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${testItem.is_published ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-brand-light text-white hover:bg-brand-medium'}`}
                        >
                          {testItem.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => downloadResultsCSV(testItem.id)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                          title="Export CSV"
                        >
                          📊 CSV
                        </button>
                      </>
                    ) : (
                      /* Student Actions */
                      myAttempt ? (
                        myAttempt.completed_at ? (
                          <div className="w-full flex items-center justify-between">
                            <span className={`px-2.5 py-1 rounded text-xs font-bold border ${myAttempt.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              Score: {myAttempt.score}% ({myAttempt.passed ? 'PASSED' : 'FAILED'})
                            </span>
                            <button
                              onClick={() => router.push(`/dashboard/tests/${testItem.id}/results?attemptId=${myAttempt.id}`)}
                              className="px-3 py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg hover:bg-brand-medium transition-all"
                            >
                              View Scorecard
                            </button>
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
                      )
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: TEST BUILDER & QUESTION EDITOR (Staff) */}
      {isStaff && activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Test Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Create New Test</h3>
            
            {user.role === 'lecturer' && assignedCourses.length === 0 && (
              <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-800 text-xs font-semibold">
                Notice: You are not assigned to any course units. Please contact your Faculty Secretary for assignment.
              </div>
            )}

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
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            {selectedTest ? (
              <div className="space-y-4">
                
                {/* Header & Preset Seeder */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-850">Managing Question Bank</h3>
                    <p className="text-xs text-brand-medium font-semibold">Test: {selectedTest.title} ({selectedTest.course_code})</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkSeedQuestions(selectedTest.id)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                    >
                      ⚡ Seed Sample Package
                    </button>
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
                        {q.explanation && <p className="text-slate-400 italic text-[11px]">Note: {q.explanation}</p>}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Question Form */}
                <form onSubmit={handleAddQuestion} className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-0.5">Question Text</label>
                      <input
                        type="text"
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="Type question text..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-0.5">Type</label>
                      <select
                        value={qType}
                        onChange={(e) => setQType(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                      >
                        <option value="mcq">Multiple Choice</option>
                        <option value="tf">True / False</option>
                        <option value="short">Short Answer</option>
                      </select>
                    </div>
                  </div>

                  {qType === 'mcq' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Option A" value={optA} onChange={(e) => setOptA(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                      <input type="text" placeholder="Option B" value={optB} onChange={(e) => setOptB(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                      <input type="text" placeholder="Option C" value={optC} onChange={(e) => setOptC(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                      <input type="text" placeholder="Option D" value={optD} onChange={(e) => setOptD(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-0.5">Correct Answer</label>
                      {qType === 'mcq' ? (
                        <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                        </select>
                      ) : qType === 'tf' ? (
                        <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <option value="True">True</option><option value="False">False</option>
                        </select>
                      ) : (
                        <input type="text" placeholder="Target word key..." value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-0.5">Points</label>
                      <input type="number" step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-0.5">Explanatory Note</label>
                      <input type="text" placeholder="Why this is correct..." value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {submitting ? 'Appending...' : 'Append Question'}
                  </button>
                </form>

              </div>
            ) : (
              <div className="py-24 text-center text-slate-400 text-xs font-semibold">
                👈 Select a test from the Test Catalog or create a new test to edit its question paper.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: SUBMISSIONS ANALYTICS (Staff) */}
      {isStaff && activeTab === 'analytics' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Student Test Submissions & Score Log</h3>
          </div>

          {attempts.length === 0 ? (
            <p className="text-slate-400 text-xs py-8 text-center">No student test attempts logged yet.</p>
          ) : (
            <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Test Title</th>
                    <th className="px-4 py-3">Course Code</th>
                    <th className="px-4 py-3">Attempt #</th>
                    <th className="px-4 py-3 text-center">Score %</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3 text-center">Tab Switches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-4 py-3 font-bold text-slate-800">{att.student_name}</td>
                      <td className="px-4 py-3 font-medium">{att.test_title}</td>
                      <td className="px-4 py-3">{att.test_course_code}</td>
                      <td className="px-4 py-3 font-semibold text-center">#{att.attempt_number}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">{att.score}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${att.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {att.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In Progress'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">{att.tab_switches_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY PERFORMANCE (Student) */}
      {!isStaff && activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">My Test Performance Log</h3>
          
          {attempts.length === 0 ? (
            <p className="text-slate-400 text-xs py-8 text-center">You have not completed any tests yet.</p>
          ) : (
            <div className="space-y-3">
              {attempts.map((att) => (
                <div key={att.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{att.test_title}</h4>
                    <p className="text-xs text-slate-500">Course: {att.test_course_code} · Attempt #{att.attempt_number} · Submitted: {att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In Progress'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded text-xs font-bold border ${att.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {att.score}% ({att.passed ? 'PASSED' : 'FAILED'})
                    </span>
                    <button
                      onClick={() => router.push(`/dashboard/tests/${att.test}/results?attemptId=${att.id}`)}
                      className="px-3 py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg hover:bg-brand-medium"
                    >
                      View Review Scorecard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
