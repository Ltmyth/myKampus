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
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState('All');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');

  // Fee Gate Alert Modal
  const [showFeeGateModal, setShowFeeGateModal] = useState(false);
  const [feeGateMessage, setFeeGateMessage] = useState('');

  // Form states (Lecturer create Exam)
  const [examTitle, setExamTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseUnit, setSelectedCourseUnit] = useState('');
  const [duration, setDuration] = useState(60);
  
  // Manage Questions states (Lecturer/Staff)
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
  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isStaff = ['lecturer', 'admin', 'faculty_admin', 'registrar', 'dean', 'dvc', 'vc'].includes(user?.role);
  const isLecturer = user?.role === 'lecturer';

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

  // Filter assigned courses and faculties for Lecturers
  const assignedCourses = isLecturer
    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)))
    : courses;

  const scopedFaculties = isLecturer
    ? faculties.filter(f => assignedCourses.some(c => c.faculty === f.id || c.faculty_code === f.code))
    : faculties;

  const handleToggleProctoring = async () => {
    if (isExecutiveReadOnly) return;
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

  const [scheduledStart, setScheduledStart] = useState('');

  // Edit Exam Modal State
  const [editingExamModal, setEditingExamModal] = useState(null);
  const [editExamTitle, setEditExamTitle] = useState('');
  const [editExamDuration, setEditExamDuration] = useState(60);
  const [editExamScheduledStart, setEditExamScheduledStart] = useState('');
  const [editExamIsActive, setEditExamIsActive] = useState(true);

  const handleDeleteExam = async (examItem) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && examItem.is_approved_by_dean) {
      setErrorMsg('Permission Denied: Approved exams cannot be deleted by the lecturer.');
      return;
    }
    if (!confirm('Are you sure you want to delete this exam paper?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.delete(`/exams/${examItem.id}/`);
      setSuccessMsg('Exam paper deleted successfully.');
      if (selectedExam?.id === examItem.id) setSelectedExam(null);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete exam paper.');
    }
  };

  const handleOpenEditExamModal = (exam) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && exam.is_approved_by_dean) {
      setErrorMsg('Permission Denied: Approved exams cannot be edited by the lecturer.');
      return;
    }
    setEditingExamModal(exam);
    setEditExamTitle(exam.title);
    setEditExamDuration(exam.duration_minutes || 60);
    setEditExamScheduledStart(exam.scheduled_start ? new Date(exam.scheduled_start).toISOString().slice(0, 16) : '');
    setEditExamIsActive(exam.is_active);
  };

  const handleSaveEditExam = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly || !editingExamModal) return;
    if (isLecturer && editingExamModal.is_approved_by_dean) {
      setErrorMsg('Permission Denied: Approved exams cannot be edited by the lecturer.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: editExamTitle,
        duration_minutes: parseInt(editExamDuration),
        is_active: editExamIsActive,
        scheduled_start: editExamScheduledStart ? new Date(editExamScheduledStart).toISOString() : null
      };

      await api.patch(`/exams/${editingExamModal.id}/`, payload);
      setSuccessMsg(`Exam paper '${editExamTitle}' updated successfully!`);
      setEditingExamModal(null);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update exam paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly) return;
    if (!examTitle || !selectedCourse) {
      setErrorMsg('Please enter an exam title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: examTitle,
        course: parseInt(selectedCourse),
        course_unit: selectedCourseUnit ? parseInt(selectedCourseUnit) : null,
        duration_minutes: parseInt(duration),
        is_active: true
      };
      if (scheduledStart) {
        payload.scheduled_start = new Date(scheduledStart).toISOString();
      }
      const created = await api.post('/exams/', payload);
      setSuccessMsg('Exam paper created successfully! Select it below to add questions.');
      setExamTitle('');
      setSelectedCourse('');
      setSelectedCourseUnit('');
      setScheduledStart('');
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
    if (isExecutiveReadOnly) return;
    if (isLecturer && selectedExam?.is_approved_by_dean) {
      setErrorMsg('Permission Denied: Approved exams cannot be modified by the lecturer.');
      return;
    }
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

  const handleReleaseExamResults = async (examId) => {
    if (isExecutiveReadOnly) return;
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
    if (isExecutiveReadOnly) return;
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
    if (isExecutiveReadOnly) return;
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
    
    // Tuition Fee Gate Check: Must have 100% full tuition clearance or CIU API clearance!
    const tuitionPaid = user?.tuition_paid_percentage ?? 100.0;
    const isExamCleared = user?.is_exam_cleared ?? (tuitionPaid >= 100.0);
    
    if (user?.role === 'student' && !isExamCleared) {
      setFeeGateMessage(`Exam Access Barred: 100% tuition clearance or CIU Cleared Students API verification is required to sit for final examinations. Your current clearance level is ${tuitionPaid}%. Please visit the Bursar / Finance Office to clear your outstanding fees balance.`);
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

  // Group Exams under Scoped Faculties for Staff
  const activeFacultiesList = isLecturer ? scopedFaculties : faculties;
  
  const examsFiltered = exams.filter(e => {
    if (selectedFacultyFilter === 'All') return true;
    const fCode = e.faculty_code || (courses.find(c => c.id === e.course)?.faculty_code);
    return fCode === selectedFacultyFilter;
  });

  const facultyGroups = activeFacultiesList.map(fac => {
    const facExams = examsFiltered.filter(e => {
      const fCode = e.faculty_code || (courses.find(c => c.id === e.course)?.faculty_code);
      return fCode === fac.code;
    });
    return { faculty: fac, exams: facExams };
  });

  const unassignedExams = examsFiltered.filter(e => {
    const fCode = e.faculty_code || (courses.find(c => c.id === e.course)?.faculty_code);
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
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">CIU Final Examination & Proctoring Center</h2>
          <p className="text-slate-500 text-xs font-medium">Academic Registrar timetables, faculty exam papers, live anti-cheat proctoring, and fee gates.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-2 ${proctoringSetting.is_proctoring_enabled ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="text-xs font-extrabold uppercase">
              {proctoringSetting.is_proctoring_enabled ? 'Live Proctoring: ACTIVE' : 'Live Proctoring: OFF'}
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

          {isRegistrarOrStaff && !isExecutiveReadOnly && (
            <button
              onClick={() => setShowTimetableModal(true)}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Publish Exam Timetable Slot
            </button>
          )}

          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-800 font-bold uppercase">
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

      {/* Navigation Tabs & Faculty Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex space-x-4">
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

        {/* Staff Faculty & Course Filter */}
        {isStaff && activeTab === 'exams' && (
          <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200/80 shadow-sm">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Faculty:</span>
              <select
                value={selectedFacultyFilter}
                onChange={(e) => setSelectedFacultyFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="All">All Faculties ({activeFacultiesList.length})</option>
                {activeFacultiesList.map(f => (
                  <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Course:</span>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-light"
              >
                <option value="All">All Courses</option>
                {assignedCourses.map(c => (
                  <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: EXAM PAPERS & MANAGEMENT */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List Organized Under Faculties */}
          <div className="lg:col-span-2 space-y-6">
            
            {user.role === 'student' ? (
              <div className="green-card rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Scheduled Exam Papers</h3>
                
                {exams.length === 0 ? (
                  <p className="text-slate-400 text-xs py-8 text-center">No active examination papers scheduled.</p>
                ) : (
                  <div className="space-y-4">
                    {exams.map((examItem) => {
                      const myAttempt = attempts.find(a => a.exam === examItem.id);
                      return (
                        <div key={examItem.id} className="p-5 bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl border border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${examItem.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                {examItem.is_results_released ? 'RELEASED' : 'WITHHELD'}
                              </span>
                            </div>

                            <h4 className="font-bold text-slate-850 text-base">{examItem.title}</h4>
                            <p className="text-xs text-slate-500 font-medium">Duration: <strong className="text-slate-800">{examItem.duration_minutes} mins</strong> · Questions: <strong className="text-slate-800">{examItem.questions_count}</strong></p>
                            <p className="text-xs text-slate-600 font-medium pt-1">
                              📅 Scheduled Start: <strong className="text-slate-800">{examItem.scheduled_start ? new Date(examItem.scheduled_start).toLocaleString([], {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Open Anytime'}</strong>
                            </p>
                            <p className="text-[11px] text-emerald-700 font-medium pt-0.5">💰 Fee Gate: 100% Full Tuition Clearance Required</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {myAttempt ? (
                              myAttempt.completed_at ? (
                                examItem.is_results_released ? (
                                  <button
                                    onClick={() => router.push(`/dashboard/exams/${examItem.id}/results?attemptId=${myAttempt.id}`)}
                                    className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-sm"
                                  >
                                    View Scorecard ({myAttempt.score}%)
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    🔒 Results Withheld
                                  </span>
                                )
                              ) : (
                                <button
                                  onClick={() => startExam(examItem.id)}
                                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm"
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* STAFF FACULTY ORGANIZED EXAMS VIEW */
              <div className="space-y-6">
                
                {facultyGroups.map(({ faculty, exams: facExams }) => {
                  if (selectedFacultyFilter !== 'All' && faculty.code !== selectedFacultyFilter) return null;
                  return (
                    <div key={faculty.id} className="green-card rounded-2xl p-6 space-y-4">
                      
                      {/* Faculty Group Header */}
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 bg-brand-light/10 text-brand-dark font-black text-xs rounded-lg border border-brand-light/20 uppercase">
                            {faculty.code}
                          </span>
                          <h3 className="text-base font-bold text-slate-850">{faculty.name}</h3>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                          {facExams.length} Exams Set
                        </span>
                      </div>

                      {/* Faculty Exams List */}
                      {facExams.length === 0 ? (
                        <p className="text-slate-400 text-xs py-4 text-center italic">No exams set for {faculty.name} yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {facExams.map((examItem) => {
                            const isMyExam = (isLecturer && (examItem.lecturer === user.id || examItem.lecturer_name === user.username || examItem.lecturer_name === user.first_name));
                            const isApproved = Boolean(examItem.is_approved_by_dean);
                            const isLockedForLecturer = isLecturer && isApproved;

                            return (
                              <div key={examItem.id} className="p-4 bg-gradient-to-r from-white via-white to-emerald-50/20 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-300 transition-all">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] bg-brand-light/10 text-brand-medium font-bold px-2 py-0.5 rounded border border-brand-light/20">
                                      {examItem.course_code}
                                    </span>
                                    {examItem.course_unit_name && (
                                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                                        {examItem.course_unit_name}
                                      </span>
                                    )}

                                    {/* Dean Approval Status Badge */}
                                    {isApproved ? (
                                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        ✅ Approved by Dean
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                        ⏳ Approval Pending
                                      </span>
                                    )}

                                    {isLockedForLecturer && (
                                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                        🔒 Locked (Cannot Edit)
                                      </span>
                                    )}

                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${examItem.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                      {examItem.is_results_released ? 'RELEASED' : 'WITHHELD'}
                                    </span>
                                  </div>

                                  <h4 className="font-bold text-slate-850 text-sm">{examItem.title}</h4>
                                  <p className="text-xs text-slate-500 font-medium">Duration: <strong className="text-slate-800">{examItem.duration_minutes} mins</strong> · Questions: <strong className="text-slate-800">{examItem.questions_count}</strong> · Lecturer: <strong className="text-slate-800">{examItem.lecturer_name}</strong></p>
                                </div>

                                {/* Staff Actions */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleSelectExamForQuestions(examItem)}
                                    className="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-slate-800 text-xs font-bold rounded-xl transition-all"
                                  >
                                    Questions ({examItem.questions_count})
                                  </button>

                                  {!isExecutiveReadOnly && (
                                    <>
                                      {(isAdmin || (isLecturer && !isLockedForLecturer)) && (
                                        <>
                                          <button
                                            onClick={() => handleOpenEditExamModal(examItem)}
                                            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-all"
                                            title="Edit exam details"
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteExam(examItem)}
                                            className="px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-all"
                                            title="Delete exam paper"
                                          >
                                            🗑️ Delete
                                          </button>
                                        </>
                                      )}

                                      {isRegistrarOrStaff && (
                                        <button
                                          onClick={() => handleReleaseExamResults(examItem.id)}
                                          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${examItem.is_results_released ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-brand-light text-white'}`}
                                        >
                                          {examItem.is_results_released ? 'Hide Scores' : 'Release Scores'}
                                        </button>
                                      )}
                                    </>
                                  )}

                                  <button
                                    onClick={() => downloadResultsCSV(examItem.id)}
                                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                                    title="Export Results CSV"
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

                {/* Unassigned / General Exams */}
                {unassignedExams.length > 0 && (
                  <div className="green-card rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">General / Unassigned Faculty Exams</h3>
                    <div className="space-y-3">
                      {unassignedExams.map((examItem) => (
                        <div key={examItem.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="font-bold text-slate-850 text-sm">{examItem.title}</h4>
                            <p className="text-xs text-slate-500 font-medium">Course: {examItem.course_code} · Lecturer: {examItem.lecturer_name}</p>
                          </div>
                          <button
                            onClick={() => handleSelectExamForQuestions(examItem)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl"
                          >
                            Questions ({examItem.questions_count})
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Right Column Form: Create Exam / Question Editor */}
          <div className="space-y-6">
            
            {isLecturer && !isExecutiveReadOnly && (
              <div className="green-card rounded-2xl p-6 space-y-4">
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

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Scheduled Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={(e) => setScheduledStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                  >
                    {submitting ? 'Drafting...' : 'Save & Build Questions'}
                  </button>
                </form>
              </div>
            )}

            {/* Question Bank Viewer / Editor */}
            {selectedExam && (
              <div className="green-card rounded-2xl p-6 space-y-4 animate-slide-up">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase">Question Bank ({selectedExam.title})</h3>
                  <button onClick={() => setSelectedExam(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">✕ Close</button>
                </div>

                {isLecturer && selectedExam.is_approved_by_dean && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-bold text-center">
                    🔒 Approved by Dean: Question Bank Locked for Editing
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {questions.length === 0 ? (
                    <p className="text-slate-400 text-xs py-4 text-center">No questions in this paper yet.</p>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={q.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-150 text-xs space-y-1">
                        <p className="font-bold text-slate-800">Q{idx + 1}: {q.question_text}</p>
                        <p className="text-slate-500 text-[11px]">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                        <p className="text-emerald-700 font-bold text-[10px]">Key: Option {q.correct_option}</p>
                      </div>
                    ))
                  )}
                </div>

                {isLecturer && !isExecutiveReadOnly && !selectedExam.is_approved_by_dean && (
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
                    <button type="submit" disabled={submitting} className="w-full py-1.5 bg-brand-light text-white text-xs font-bold rounded-lg shadow-sm">
                      Add Exam Question
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: EXAM TIMETABLE (Academic Registrar) */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          <div className="green-card p-4 rounded-2xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Official Academic Registrar Examination Timetables</h3>
              <p className="text-slate-500 text-xs">Scheduled dates, exam venues, and assigned chief invigilators.</p>
            </div>
            {isRegistrarOrStaff && !isExecutiveReadOnly && (
              <button
                onClick={() => setShowTimetableModal(true)}
                className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                + Publish Exam Timetable Slot
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examTimetables.map((tt) => (
              <div key={tt.id} className="green-card rounded-2xl p-6 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
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

                {isRegistrarOrStaff && !isExecutiveReadOnly && (
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
      {showTimetableModal && !isExecutiveReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-emerald-200">
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
                    <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Exam Slot Title</label>
                <input
                  type="text"
                  value={ttFormData.title}
                  onChange={(e) => setTtFormData({ ...ttFormData, title: e.target.value })}
                  placeholder="e.g. Final Examination Morning Session"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
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
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={ttFormData.end_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, end_time: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Venue / Hall</label>
                  <input
                    type="text"
                    value={ttFormData.venue}
                    onChange={(e) => setTtFormData({ ...ttFormData, venue: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Invigilator</label>
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

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl"
                >
                  Publish Slot
                </button>
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EXAM */}
      {editingExamModal && !isExecutiveReadOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-emerald-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-850">Edit Exam Paper</h3>
              <button onClick={() => setEditingExamModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditExam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Exam Title</label>
                <input
                  type="text"
                  value={editExamTitle}
                  onChange={(e) => setEditExamTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  value={editExamDuration}
                  onChange={(e) => setEditExamDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Scheduled Start</label>
                <input
                  type="datetime-local"
                  value={editExamScheduledStart}
                  onChange={(e) => setEditExamScheduledStart(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-brand-light text-white text-xs font-bold rounded-lg">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingExamModal(null)} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">
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
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-red-200 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-600 border border-red-200 rounded-full flex items-center justify-center mx-auto text-2xl">
              🚫
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-850 uppercase">Tuition Fee Gate Access Lock</h3>
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
