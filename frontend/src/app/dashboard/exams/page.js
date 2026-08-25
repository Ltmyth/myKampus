'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ExamsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseUnits, setCourseUnits] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [examTimetables, setExamTimetables] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [proctoringSetting, setProctoringSetting] = useState({ is_proctoring_enabled: true });
  const [loading, setLoading] = useState(true);

  // Active Tab: 'exams', 'timetables'
  const [activeTab, setActiveTab] = useState('exams');

  // Fee Gate Alert Modal
  const [showFeeGateModal, setShowFeeGateModal] = useState(false);
  const [feeGateMessage, setFeeGateMessage] = useState('');

  // Form states (Lecturer create Exam)
  const [examTitle, setExamTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseUnit, setSelectedCourseUnit] = useState('');
  const [duration, setDuration] = useState(60);
  
  // Manage Questions states (Lecturer)
  const [selectedExam, setSelectedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');

  // Form state (Academic Registrar Exam Timetable)
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [ttFormData, setTtFormData] = useState({
    faculty: '',
    course: '',
    course_unit: '',
    title: '',
    exam_date: '',
    start_time: '09:00',
    end_time: '12:00',
    venue: 'Main Examination Hall',
    invigilator: ''
  });

  // UI notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isRegistrarOrStaff = ['registrar', 'admin'].includes(user?.role);
  const isDeanOrStaff = ['dean', 'admin', 'dvc'].includes(user?.role);

  useEffect(() => {
    loadExamData();
  }, []);

  async function loadExamData() {
    try {
      setLoading(true);
      const [examsData, coursesData, unitsData, attemptsData, timetablesData, facsData, usersData, procData] = await Promise.all([
        api.get('/exams/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/attempts/').catch(() => []),
        api.get('/exam-timetables/').catch(() => []),
        api.get('/faculties/').catch(() => []),
        api.get('/admin/users/').catch(() => []),
        api.get('/proctoring-settings/').catch(() => ({ is_proctoring_enabled: true }))
      ]);

      setExams(examsData || []);
      setCourses(coursesData || []);
      setCourseUnits(unitsData || []);
      setExamTimetables(timetablesData || []);
      setFaculties(facsData || []);
      setLecturers((usersData || []).filter(u => u.role === 'lecturer'));
      setProctoringSetting(procData || { is_proctoring_enabled: true });
      
      if (user.role === 'student') {
        setAttempts(attemptsData || []);
      } else {
        setAllAttempts(attemptsData || []);
      }

      if (facsData.length > 0 && !ttFormData.faculty) {
        setTtFormData(prev => ({ ...prev, faculty: facsData[0].id }));
      }
    } catch (err) {
      setErrorMsg('Failed to load exams data.');
    } finally {
      setLoading(false);
    }
  }

  // Filter assigned courses for Lecturers
  const assignedCourses = user.role === 'lecturer' 
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : courses;

  const handleToggleProctoring = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/proctoring-settings/toggle/');
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle proctoring.');
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examTitle || !selectedCourse) {
      setErrorMsg('Please enter an exam title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const created = await api.post('/exams/', {
        title: examTitle,
        course: parseInt(selectedCourse),
        course_unit: selectedCourseUnit ? parseInt(selectedCourseUnit) : null,
        duration_minutes: parseInt(duration),
        is_active: false
      });
      setSuccessMsg('Exam paper created successfully! Select it below to add questions.');
      setExamTitle('');
      setSelectedCourse('');
      setSelectedCourseUnit('');
      loadExamData();
      setSelectedExam(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create exam paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectExamForQuestions = async (exam) => {
    setSelectedExam(exam);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const qData = await api.get(`/exams/${exam.id}/questions/`);
      setQuestions(qData || []);
    } catch (err) {
      setErrorMsg('Failed to load questions for selected exam.');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!qText || !optA || !optB || !optC || !optD) {
      setErrorMsg('All question text and options A, B, C, D are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post(`/exams/${selectedExam.id}/questions/`, {
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correctOpt
      });
      setSuccessMsg('Question added successfully!');
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');

      const qData = await api.get(`/exams/${selectedExam.id}/questions/`);
      setQuestions(qData || []);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add question.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveExam = async (examId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/exams/${examId}/approve_exam/`);
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Approval action failed.');
    }
  };

  const handleReleaseExamResults = async (examId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/exams/${examId}/release_results/`);
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Results release toggle failed.');
    }
  };

  const handleCreateExamTimetable = async (e) => {
    e.preventDefault();
    if (!ttFormData.faculty || !ttFormData.course || !ttFormData.title || !ttFormData.exam_date) {
      setErrorMsg('Faculty, Course, Title, and Exam Date are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/exam-timetables/', {
        faculty: parseInt(ttFormData.faculty),
        course: parseInt(ttFormData.course),
        course_unit: ttFormData.course_unit ? parseInt(ttFormData.course_unit) : null,
        title: ttFormData.title,
        exam_date: ttFormData.exam_date,
        start_time: ttFormData.start_time.length === 5 ? `${ttFormData.start_time}:00` : ttFormData.start_time,
        end_time: ttFormData.end_time.length === 5 ? `${ttFormData.end_time}:00` : ttFormData.end_time,
        venue: ttFormData.venue,
        invigilator: ttFormData.invigilator ? parseInt(ttFormData.invigilator) : null
      });
      setSuccessMsg('Exam timetable entry published successfully!');
      setShowTimetableModal(false);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to publish exam timetable slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExamTimetable = async (id) => {
    if (!confirm('Are you sure you want to delete this exam timetable slot?')) return;
    try {
      await api.delete(`/exam-timetables/${id}/`);
      setSuccessMsg('Exam timetable entry removed.');
      loadExamData();
    } catch (err) {
      setErrorMsg('Failed to remove exam timetable entry.');
    }
  };

  const startExam = async (examId) => {
    setErrorMsg('');
    
    // Tuition Fee Gate Check: Must have 100% full tuition clearance for exams!
    const tuitionPaid = user?.tuition_paid_percentage ?? 100.0;
    if (user?.role === 'student' && tuitionPaid < 100.0) {
      setFeeGateMessage(`Exam Access Barred: 100% full tuition clearance required to sit for final examinations. Your current clearance is ${tuitionPaid}%. Please visit the Bursar / Finance Office to clear your outstanding fees balance.`);
      setShowFeeGateModal(true);
      return;
    }

    try {
      await api.post(`/exams/${examId}/start_attempt/`);
      router.push(`/dashboard/exams/${examId}`);
    } catch (err) {
      if (err.message && err.message.includes('100%')) {
        setFeeGateMessage(err.message);
        setShowFeeGateModal(true);
      } else {
        setErrorMsg(err.message || 'Failed to start exam.');
      }
    }
  };

  const downloadResultsCSV = (examId) => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
    const tokensStr = localStorage.getItem('ciu_tokens');
    let token = '';
    if (tokensStr) {
      try { token = JSON.parse(tokensStr).access; } catch (e) {}
    }
    window.open(`${API_BASE_URL}/exams/${examId}/export_csv/?token=${token}`, '_blank');
  };

  const isLecturer = ['lecturer', 'admin'].includes(user.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">CIU Final Examination & Proctoring Center</h2>
          <p className="text-slate-500 text-xs font-medium">Academic Registrar timetables, Dean approvals, live anti-cheat proctoring, and fee gates.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Live Proctoring: ACTIVE' : 'Live Proctoring: OFF'}
            </span>
            {isAdmin && (
              <button
                onClick={handleToggleProctoring}
                className="ml-2 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded hover:bg-slate-700"
              >
                Toggle
              </button>
            )}
          </div>

          {isRegistrarOrStaff && (
            <button
              onClick={() => setShowTimetableModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Publish Exam Timetable Slot
            </button>
          )}

          <div className="bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl text-xs text-teal-800 font-bold uppercase">
            {user.role.replace('_', ' ')}
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('exams')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'exams' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📝 Examination Papers ({exams.length})
        </button>
        <button
          onClick={() => setActiveTab('timetables')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'timetables' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📅 Academic Registrar Exam Timetable ({examTimetables.length})
        </button>
      </div>

      {/* TAB 1: EXAM PAPERS & MANAGEMENT */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Scheduled Exam Papers</h3>
              
              {exams.length === 0 ? (
                <p className="text-slate-400 text-xs py-8 text-center">No active examination papers scheduled.</p>
              ) : (
                <div className="space-y-4">
                  {exams.map((examItem) => {
                    const myAttempt = attempts.find(a => a.exam === examItem.id);
                    return (
                      <div key={examItem.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] bg-brand-light/10 text-brand-medium font-bold px-2.5 py-0.5 rounded border border-brand-light/20">
                              {examItem.course_code}
                            </span>
                            {examItem.course_unit_name && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                                {examItem.course_unit_name}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${examItem.is_approved_by_dean ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {examItem.is_approved_by_dean ? 'DEAN APPROVED' : 'PENDING DEAN APPROVAL'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${examItem.is_results_released ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                              {examItem.is_results_released ? 'RELEASED' : 'WITHHELD'}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-850 text-base">{examItem.title}</h4>
                          <p className="text-xs text-slate-500">Duration: <strong className="text-slate-800">{examItem.duration_minutes} mins</strong> · Questions: <strong className="text-slate-800">{examItem.questions_count}</strong> · Lecturer: <strong className="text-slate-800">{examItem.lecturer_name}</strong></p>
                          <p className="text-[11px] text-red-600 font-medium pt-0.5">💰 Fee Gate: 100% Full Tuition Clearance Required</p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isLecturer && (
                            <button
                              onClick={() => handleSelectExamForQuestions(examItem)}
                              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl transition-all"
                            >
                              Questions ({examItem.questions_count})
                            </button>
                          )}

                          {isDeanOrStaff && (
                            <button
                              onClick={() => handleApproveExam(examItem.id)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${examItem.is_approved_by_dean ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-600 text-white'}`}
                            >
                              {examItem.is_approved_by_dean ? 'Revoke Approval' : 'Approve Exam'}
                            </button>
                          )}

                          {isRegistrarOrStaff && (
                            <button
                              onClick={() => handleReleaseExamResults(examItem.id)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${examItem.is_results_released ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-teal-600 text-white'}`}
                            >
                              {examItem.is_results_released ? 'Hide Scores' : 'Release Scores'}
                            </button>
                          )}

                          {user.role === 'student' && (
                            myAttempt ? (
                              myAttempt.completed_at ? (
                                examItem.is_results_released ? (
                                  <button
                                    onClick={() => router.push(`/dashboard/exams/${examItem.id}/results?attemptId=${myAttempt.id}`)}
                                    className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700"
                                  >
                                    View Scorecard ({myAttempt.score}%)
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                    🔒 Results Withheld
                                  </span>
                                )
                              ) : (
                                <button
                                  onClick={() => startExam(examItem.id)}
                                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl"
                                >
                                  Resume Exam
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => startExam(examItem.id)}
                                disabled={!examItem.is_active || examItem.questions_count === 0}
                                className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                              >
                                Launch Exam
                              </button>
                            )
                          )}

                          {(isLecturer || isRegistrarOrStaff) && (
                            <button
                              onClick={() => downloadResultsCSV(examItem.id)}
                              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                              title="Export Results CSV"
                            >
                              📊 CSV
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column Form: Create Exam / Question Editor */}
          <div className="space-y-6">
            
            {isLecturer && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Draft New Examination</h3>
                <form onSubmit={handleCreateExam} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Course Program</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      required
                    >
                      <option value="">Select Course...</option>
                      {assignedCourses.map((c) => (
                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Course Unit (Optional)</label>
                    <select
                      value={selectedCourseUnit}
                      onChange={(e) => setSelectedCourseUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">Select Course Unit...</option>
                      {courseUnits.map((u) => (
                        <option key={u.id} value={u.id}>[{u.code}] {u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Exam Title</label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g. End of Semester Final Examination 2026"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Duration (Minutes)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                  >
                    {submitting ? 'Drafting...' : 'Save & Build Questions'}
                  </button>
                </form>
              </div>
            )}

            {/* Question Editor */}
            {selectedExam && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 animate-slide-up">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase">Question Bank ({selectedExam.title})</h3>
                  <button onClick={() => setSelectedExam(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 text-xs space-y-1">
                      <p className="font-bold text-slate-800">Q{idx + 1}: {q.question_text}</p>
                      <p className="text-slate-500 text-[11px]">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                      <p className="text-emerald-700 font-bold text-[10px]">Key: Option {q.correct_option}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddQuestion} className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <textarea
                    rows={2}
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Type question prompt..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Option A" value={optA} onChange={(e) => setOptA(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" required />
                    <input type="text" placeholder="Option B" value={optB} onChange={(e) => setOptB(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" required />
                    <input type="text" placeholder="Option C" value={optC} onChange={(e) => setOptC(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" required />
                    <input type="text" placeholder="Option D" value={optD} onChange={(e) => setOptD(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" required />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-[10px] font-bold uppercase text-slate-700">Correct Key:</label>
                    <select value={correctOpt} onChange={(e) => setCorrectOpt(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs">
                      <option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                    </select>
                  </div>
                  <button type="submit" disabled={submitting} className="w-full py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg">
                    Add Exam Question
                  </button>
                </form>
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: EXAM TIMETABLE (Academic Registrar) */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Official Academic Registrar Examination Timetables</h3>
              <p className="text-slate-500 text-xs">Scheduled dates, exam venues, and assigned chief invigilators.</p>
            </div>
            {isRegistrarOrStaff && (
              <button
                onClick={() => setShowTimetableModal(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                + Publish Exam Timetable Slot
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examTimetables.map((tt) => (
              <div key={tt.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-50 text-teal-800 border border-teal-200">
                      {tt.exam_date}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{tt.faculty_code}</span>
                  </div>

                  <h4 className="font-bold text-slate-850 text-base leading-tight">{tt.title}</h4>
                  <p className="text-xs text-slate-500">Course Program: <span className="font-bold text-slate-800">[{tt.course_code}] {tt.course_name}</span></p>

                  <div className="pt-2 text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                    <p>⏰ Time: <strong className="text-slate-800">{tt.start_time} - {tt.end_time}</strong></p>
                    <p>📍 Exam Hall / Venue: <strong className="text-slate-800">{tt.venue}</strong></p>
                    <p>👨‍🏫 Chief Invigilator: <strong className="text-slate-800">{tt.invigilator_name || 'Assigned Invigilator'}</strong></p>
                  </div>
                </div>

                {isRegistrarOrStaff && (
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleDeleteExamTimetable(tt.id)}
                      className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 text-[10px] font-bold rounded-lg"
                    >
                      Remove Slot
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CREATE EXAM TIMETABLE (Academic Registrar) */}
      {showTimetableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Publish Exam Timetable Entry</h3>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateExamTimetable} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Faculty</label>
                <select
                  value={ttFormData.faculty}
                  onChange={(e) => setTtFormData({ ...ttFormData, faculty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Faculty...</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Course Program</label>
                <select
                  value={ttFormData.course}
                  onChange={(e) => setTtFormData({ ...ttFormData, course: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Examination Title</label>
                <input
                  type="text"
                  value={ttFormData.title}
                  onChange={(e) => setTtFormData({ ...ttFormData, title: e.target.value })}
                  placeholder="e.g. BIT2101 Web Apps Final Exam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={ttFormData.exam_date}
                    onChange={(e) => setTtFormData({ ...ttFormData, exam_date: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={ttFormData.start_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, start_time: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={ttFormData.end_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, end_time: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Exam Hall / Venue</label>
                  <input
                    type="text"
                    value={ttFormData.venue}
                    onChange={(e) => setTtFormData({ ...ttFormData, venue: e.target.value })}
                    placeholder="e.g. Main Complex Hall A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Chief Invigilator</label>
                  <select
                    value={ttFormData.invigilator}
                    onChange={(e) => setTtFormData({ ...ttFormData, invigilator: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select Invigilator...</option>
                    {lecturers.map(l => (
                      <option key={l.id} value={l.id}>{l.first_name || l.username} {l.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Publishing...' : 'Publish Timetable Slot'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* FEE GATE MODAL */}
      {showFeeGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-red-100 space-y-5 text-center relative animate-scale-up">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⛔
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">100% Tuition Clearance Required</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Final Examination Clearance Policy</p>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 space-y-2 text-left">
              <p className="font-semibold">{feeGateMessage}</p>
              <div className="pt-2 border-t border-red-200/60 text-[11px] text-red-700 space-y-1 font-mono">
                <p>• Final Exam Requirement: <strong>100% Full Clearance</strong></p>
                <p>• Your Current Clearance: <strong>{user?.tuition_paid_percentage ?? 0}%</strong></p>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowFeeGateModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
              >
                Close & Contact Bursar Office
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
