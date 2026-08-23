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
  const [loading, setLoading] = useState(true);

  // Active Tab: 'exams', 'timetables'
  const [activeTab, setActiveTab] = useState('exams');

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

  useEffect(() => {
    loadExamData();
  }, []);

  async function loadExamData() {
    try {
      setLoading(true);
      const [examsData, coursesData, unitsData, attemptsData, timetablesData, facsData, usersData] = await Promise.all([
        api.get('/exams/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/attempts/').catch(() => []),
        api.get('/exam-timetables/').catch(() => []),
        api.get('/faculties/').catch(() => []),
        api.get('/admin/users/').catch(() => [])
      ]);

      setExams(examsData || []);
      setCourses(coursesData || []);
      setCourseUnits(unitsData || []);
      setExamTimetables(timetablesData || []);
      setFaculties(facsData || []);
      setLecturers((usersData || []).filter(u => u.role === 'lecturer'));
      
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
    ? courses.filter(c => {
        // Find if lecturer is in any unit belonging to this course
        return courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id));
      })
    : courses;

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examTitle || !selectedCourse) {
      setErrorMsg('Please specify an assessment title and select a course.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/exams/', {
        title: examTitle,
        course: parseInt(selectedCourse),
        course_unit: selectedCourseUnit ? parseInt(selectedCourseUnit) : null,
        duration_minutes: parseInt(duration)
      });
      setSuccessMsg('Exam assessment paper created successfully!');
      setExamTitle('');
      setSelectedCourse('');
      setSelectedCourseUnit('');
      setDuration(60);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Exam creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExamTimetable = async (e) => {
    e.preventDefault();
    if (!ttFormData.faculty || !ttFormData.course || !ttFormData.title || !ttFormData.exam_date) {
      setErrorMsg('Faculty, Course, Exam Title, and Date are required.');
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

      setSuccessMsg('Official Exam Timetable published!');
      setShowTimetableModal(false);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create exam timetable.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExamTimetable = async (id) => {
    if (!confirm('Are you sure you want to delete this exam timetable slot?')) return;
    try {
      await api.delete(`/exam-timetables/${id}/`);
      setSuccessMsg('Exam timetable slot removed.');
      loadExamData();
    } catch (err) {
      setErrorMsg('Failed to delete timetable slot.');
    }
  };

  const handleToggleActive = async (exam) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updated = await api.patch(`/exams/${exam.id}/`, {
        is_active: !exam.is_active
      });
      setSuccessMsg(`Exam status updated to: ${updated.is_active ? 'ACTIVE' : 'DRAFT'}`);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Status toggle failed.');
    }
  };

  const handleApproveExam = async (exam) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/exams/${exam.id}/approve_exam/`);
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Approval action failed.');
    }
  };

  const handleReleaseResults = async (exam) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/exams/${exam.id}/release_results/`);
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Release action failed.');
    }
  };

  const downloadExamCSV = (examId) => {
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://examiner.ciu.ac.ug/api';
    const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
    const tokensStr = localStorage.getItem('ciu_tokens');
    let token = '';
    if (tokensStr) {
      try { token = JSON.parse(tokensStr).access; } catch (e) {}
    }
    window.open(`${API_BASE_URL}/exams/${examId}/export_csv/?token=${token}`, '_blank');
  };

  const handleSelectExamForQuestions = async (exam) => {
    setSelectedExam(exam);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const qData = await api.get(`/exams/${exam.id}/questions/`);
      setQuestions(qData || []);
    } catch (err) {
      setErrorMsg('Failed to fetch exam questions.');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!qText || !optA || !optB || !optC || !optD) {
      setErrorMsg('Please fill in question text and all 4 options.');
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
      setCorrectOpt('A');
      
      const qData = await api.get(`/exams/${selectedExam.id}/questions/`);
      setQuestions(qData || []);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to append question.');
    } finally {
      setSubmitting(false);
    }
  };

  const startStudentExam = async (examId) => {
    setErrorMsg('');
    try {
      await api.post(`/exams/${examId}/start_attempt/`);
      router.push(`/dashboard/exams/${examId}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to launch exam.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  const isStaff = ['lecturer', 'admin', 'faculty_admin', 'dean', 'registrar', 'dvc'].includes(user.role);
  const isDean = ['dean', 'admin', 'dvc'].includes(user.role);
  const isRegistrar = ['registrar', 'admin'].includes(user.role);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-850">CIU Examination Board & Timetabling Portal</h2>
          <p className="text-slate-500 text-xs font-medium">Official university examinations, Academic Registrar Exam Timetables, Dean approvals, and Tab Security.</p>
        </div>

        <div className="flex items-center space-x-3">
          {isRegistrar && (
            <button
              onClick={() => setShowTimetableModal(true)}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
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

      {/* Tabs */}
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
          📅 Academic Registrar Exam Timetables ({examTimetables.length})
        </button>
      </div>

      {/* TAB 1: EXAM PAPERS & SUBMISSIONS */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Side: Exam List & Submissions */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Exam listings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Registered Examination Papers</h3>
              
              {exams.length === 0 ? (
                <p className="text-slate-400 text-xs py-8 text-center">No exams registered in course syllabus.</p>
              ) : (
                <div className="space-y-4">
                  {exams.map((ex) => {
                    const studentAttempt = attempts.find(att => att.exam === ex.id);
                    return (
                      <div key={ex.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-850">{ex.title}</h4>
                            <span className="text-xs text-slate-400 font-medium">({ex.course_code})</span>
                            
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${ex.is_approved_by_dean ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {ex.is_approved_by_dean ? 'DEAN APPROVED' : 'PENDING DEAN APPROVAL'}
                            </span>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${ex.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {ex.is_results_released ? 'RESULTS RELEASED' : 'RESULTS LOCKED'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500">Duration: {ex.duration_minutes} mins · Lecturer: {ex.lecturer_name} · Questions: <span className="font-semibold text-slate-700">{ex.questions_count}</span></p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                          {isStaff ? (
                            <>
                              {isDean && (
                                <button
                                  onClick={() => handleApproveExam(ex)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${ex.is_approved_by_dean ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                  {ex.is_approved_by_dean ? 'Unapprove' : 'Approve Exam'}
                                </button>
                              )}

                              {isRegistrar && (
                                <button
                                  onClick={() => handleReleaseResults(ex)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${ex.is_results_released ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                                >
                                  {ex.is_results_released ? 'Lock Results' : 'Release Results'}
                                </button>
                              )}

                              <button
                                onClick={() => handleSelectExamForQuestions(ex)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-all"
                              >
                                Questions
                              </button>

                              <button
                                onClick={() => handleToggleActive(ex)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${ex.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-brand-light hover:bg-brand-medium text-white'}`}
                              >
                                {ex.is_active ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => downloadExamCSV(ex.id)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                title="Export Exam CSV"
                              >
                                📊 CSV
                              </button>
                            </>
                          ) : (
                            studentAttempt ? (
                              studentAttempt.completed_at ? (
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block font-semibold">Grade Status</span>
                                  {studentAttempt.results_released ? (
                                    <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${studentAttempt.score >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                      Score: {studentAttempt.score}%
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      🔒 Pending Registrar Release
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => router.push(`/dashboard/exams/${ex.id}`)}
                                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                                >
                                  Resume Taking
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => startStudentExam(ex.id)}
                                disabled={ex.questions_count === 0}
                                className="px-4 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                              >
                                Start Exam
                              </button>
                            )
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Staff Submissions Table */}
            {isStaff && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Student Graded Submissions</h3>
                
                {allAttempts.length === 0 ? (
                  <p className="text-slate-400 text-xs py-8 text-center">No student exam attempts registered yet.</p>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Exam Paper</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3">Submitted At</th>
                          <th className="px-4 py-3 text-center">Grade Score</th>
                          <th className="px-4 py-3 text-center">Tab Switches</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {allAttempts.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50 transition-all">
                            <td className="px-4 py-3 font-bold text-slate-850">{att.student_name}</td>
                            <td className="px-4 py-3">{att.exam_title}</td>
                            <td className="px-4 py-3 font-semibold">{att.exam_course_code}</td>
                            <td className="px-4 py-3">
                              {att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In Progress'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {att.completed_at ? (
                                <span className={`px-2 py-0.5 rounded font-bold border ${att.score >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                  {att.score}%
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Incomplete</span>
                              )}
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

          </div>

          {/* Right Side Control Panel */}
          <div className="space-y-6">
            
            {isStaff ? (
              <>
                {selectedExam ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 animate-slide-up">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-850">Add Exam Question</h4>
                        <p className="text-[10px] text-slate-500">Exam: {selectedExam.title}</p>
                      </div>
                      <button
                        onClick={() => setSelectedExam(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                      >
                        Close Editor
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {questions.length === 0 ? (
                        <p className="text-slate-400 text-center text-[10px] py-4">No questions added yet.</p>
                      ) : (
                        questions.map((q, idx) => (
                          <div key={q.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                            <p className="font-bold text-slate-800">Q{idx + 1}: {q.question_text}</p>
                            <p className="text-slate-500 font-medium">A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}</p>
                            <span className="font-extrabold text-brand-medium">Correct Option: {q.correct_option}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddQuestion} className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Question Text</label>
                        <input
                          type="text"
                          value={qText}
                          onChange={(e) => setQText(e.target.value)}
                          placeholder="Type question text..."
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Option A</label>
                          <input type="text" value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="Option A" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                        </div>
                        <div>
                          <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Option B</label>
                          <input type="text" value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="Option B" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                        </div>
                        <div>
                          <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Option C</label>
                          <input type="text" value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="Option C" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                        </div>
                        <div>
                          <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Option D</label>
                          <input type="text" value={optD} onChange={(e) => setOptD(e.target.value)} placeholder="Option D" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-[10px] font-bold uppercase mb-0.5">Correct Option</label>
                        <select value={correctOpt} onChange={(e) => setCorrectOpt(e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs">
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                      >
                        {submitting ? 'Adding...' : 'Add Question'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Create Course Exam</h3>
                    
                    {user.role === 'lecturer' && assignedCourses.length === 0 && (
                      <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-800 text-xs font-semibold">
                        Notice: You are currently not assigned to any course units. Please contact your Faculty Secretary to assign your course units.
                      </div>
                    )}

                    <form onSubmit={handleCreateExam} className="space-y-3">
                      <div>
                        <label className="block text-slate-700 text-xs font-semibold uppercase mb-1">Select Course Program</label>
                        <select
                          value={selectedCourse}
                          onChange={(e) => setSelectedCourse(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-brand-light"
                          required
                        >
                          <option value="">Select Course...</option>
                          {assignedCourses.map((c) => (
                            <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-semibold uppercase mb-1">Course Unit (Optional)</label>
                        <select
                          value={selectedCourseUnit}
                          onChange={(e) => setSelectedCourseUnit(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs"
                        >
                          <option value="">Select Unit...</option>
                          {courseUnits.map((u) => (
                            <option key={u.id} value={u.id}>[{u.code}] {u.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-semibold uppercase mb-1">Exam Title</label>
                        <input
                          type="text"
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          placeholder="e.g. End of Semester Examination"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:ring-1 focus:ring-brand-light"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-semibold uppercase mb-1">Duration (Minutes)</label>
                        <input
                          type="number"
                          min={10}
                          max={180}
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850 text-xs focus:ring-1 focus:ring-brand-light"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        {submitting ? 'Creating...' : 'Create Exam Paper'}
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gradient-to-br from-[#0d3d24]/5 to-[#1a5c38]/5 rounded-2xl p-6 border border-[#1a5c38]/10 space-y-4">
                <h3 className="text-sm font-bold text-brand-dark uppercase tracking-wider">Exam Security & Release Policy</h3>
                <div className="text-xs text-slate-650 space-y-3 leading-relaxed">
                  <p>1. **Academic Registrar Release**: Exam results are kept strictly confidential upon submission and can only be accessed once released by the Academic Registrar.</p>
                  <p>2. **1/3 Duration Cutoff**: Late entry policy prohibits starting an exam after 1/3 of the allocated duration has passed.</p>
                  <p>3. **Tab Switch Monitoring**: Leaving or minimizing the examination window triggers automatic tracking and security lockout after 3 violations.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: ACADEMIC REGISTRAR EXAM TIMETABLES */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Official Examination Timetable Schedules</h3>
              {isRegistrar && (
                <button
                  onClick={() => setShowTimetableModal(true)}
                  className="px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-xl shadow-sm hover:bg-brand-medium"
                >
                  + Publish Exam Schedule
                </button>
              )}
            </div>

            {examTimetables.length === 0 ? (
              <p className="text-slate-400 text-xs py-10 text-center">No official exam timetables published by the Academic Registrar yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {examTimetables.map((tt) => (
                  <div key={tt.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                          📅 {tt.exam_date}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 text-teal-800 border border-teal-200">
                          {tt.faculty_code}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-850 text-base leading-tight">{tt.title}</h4>
                      <p className="text-xs font-semibold text-brand-dark pt-1">Course: {tt.course_code} - {tt.course_name}</p>

                      <div className="pt-3 space-y-1 text-xs text-slate-600 font-medium">
                        <p className="flex items-center space-x-1.5">
                          <span>⏰ Start / End Time:</span>
                          <span className="font-bold text-slate-800">{tt.start_time} - {tt.end_time}</span>
                        </p>
                        <p className="flex items-center space-x-1.5">
                          <span>📍 Examination Hall / Venue:</span>
                          <span className="font-bold text-slate-800">{tt.venue}</span>
                        </p>
                        <p className="flex items-center space-x-1.5">
                          <span>👨‍🏫 Invigilator:</span>
                          <span className="font-bold text-slate-800">{tt.invigilator_name || 'Chief Invigilator'}</span>
                        </p>
                      </div>
                    </div>

                    {isRegistrar && (
                      <div className="pt-3 border-t border-slate-200 flex justify-end">
                        <button
                          onClick={() => handleDeleteExamTimetable(tt.id)}
                          className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Delete Schedule
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE EXAM TIMETABLE (ACADEMIC REGISTRAR) */}
      {showTimetableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Publish Official Exam Timetable Slot</h3>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateExamTimetable} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Exam Title</label>
                <input
                  type="text"
                  value={ttFormData.title}
                  onChange={(e) => setTtFormData({ ...ttFormData, title: e.target.value })}
                  placeholder="e.g. Final Examination: Data Structures"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Exam Date</label>
                  <input
                    type="date"
                    value={ttFormData.exam_date}
                    onChange={(e) => setTtFormData({ ...ttFormData, exam_date: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={ttFormData.start_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={ttFormData.end_time}
                    onChange={(e) => setTtFormData({ ...ttFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Examination Hall / Venue</label>
                <input
                  type="text"
                  value={ttFormData.venue}
                  onChange={(e) => setTtFormData({ ...ttFormData, venue: e.target.value })}
                  placeholder="e.g. Main Auditorium - Complex A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
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
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Publishing...' : 'Publish Exam Schedule'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
