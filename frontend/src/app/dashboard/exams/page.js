'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, formatUgandanTime, getUgandanISOString, toUgandanDatetimeLocal, getUgandanNowDatetimeLocal } from '@/lib/api';
import { useRouter } from 'next/navigation';
import ConfirmationModal from '@/components/ConfirmationModal';

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

  // Active Tab: 'exams', 'timetables', 'submissions'
  const [activeTab, setActiveTab] = useState('exams');
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState('All');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');

  // Submissions Tab Filter & Pagination States (Exams)
  const [selectedExamFilter, setSelectedExamFilter] = useState('All');
  const [selectedExamCourseSubFilter, setSelectedExamCourseSubFilter] = useState('All');
  const [selectedExamStatusFilter, setSelectedExamStatusFilter] = useState('All');
  const [examSubmissionSearch, setExamSubmissionSearch] = useState('');
  const [examSubPage, setExamSubPage] = useState(1);
  const [examSubPageSize, setExamSubPageSize] = useState(10);

  // Fee Gate Alert Modal
  const [showFeeGateModal, setShowFeeGateModal] = useState(false);
  const [feeGateMessage, setFeeGateMessage] = useState('');

  // Form states (Lecturer create Exam)
  const [examTitle, setExamTitle] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [targetCourseIds, setTargetCourseIds] = useState([]);
  const [targetYears, setTargetYears] = useState([]);
  const [selectedCourseUnit, setSelectedCourseUnit] = useState('');
  const [duration, setDuration] = useState(60);
  const [examYearOfStudy, setExamYearOfStudy] = useState(0); // 0 = All Years, 1-4 = Year X
  const [scheduledStart, setScheduledStart] = useState('');
  const [dueDate, setDueDate] = useState('');

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

  // Scorecard Preview Modal State
  const [examScorecardPreviewData, setExamScorecardPreviewData] = useState(null);
  const [editingExamQId, setEditingExamQId] = useState(null);
  const [showExamAddQ, setShowExamAddQ] = useState(false);
  const [examQEditForm, setExamQEditForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A'
  });

  // Aiken TXT Upload Modal State
  const [showExamTxtModal, setShowExamTxtModal] = useState(false);
  const [examTxtMode, setExamTxtMode] = useState('new'); // 'new' | 'append'
  const [examTxtFile, setExamTxtFile] = useState(null);
  const [examTxtText, setExamTxtText] = useState('');
  const [examTxtTitle, setExamTxtTitle] = useState('');
  const [examTxtCourseUnit, setExamTxtCourseUnit] = useState('');
  const [examTxtDuration, setExamTxtDuration] = useState(120);
  const [examTxtType, setExamTxtType] = useState('final');
  const [examTxtScheduledStart, setExamTxtScheduledStart] = useState('');
  const [examTxtDueDate, setExamTxtDueDate] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'platform_coordinator';
  const isRegistrarOrStaff = ['registrar', 'admin', 'platform_coordinator'].includes(user?.role);
  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isStaff = ['lecturer', 'admin', 'platform_coordinator', 'faculty_admin', 'registrar', 'dean', 'dvc', 'vc'].includes(user?.role);
  const isLecturer = user?.role === 'lecturer';
  const canBuildExam = ['lecturer', 'admin', 'platform_coordinator'].includes(user?.role) && !['faculty_admin', 'dean', 'registrar', 'dvc', 'vc'].includes(user?.role);

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

  // Filter assigned courses and course units based on user role
  const assignedCourses = isLecturer
    ? courses.filter(c => courseUnits.some(u => (u.course_code === c.code || u.course === c.id) && (u.lecturer_details?.some(l => l.id === user.id) || u.lecturers?.includes(user.id))))
    : courses;

  const assignedCourseUnits = isLecturer
    ? courseUnits.filter(u => u.lecturer_details?.some(l => l.id === user.id) || u.lecturers?.includes(user.id))
    : isAdmin
    ? courseUnits
    : courseUnits.filter(u => (assignedCourses || []).some(c => c.code === u.course_code || c.id === u.course));

  const scopedFaculties = isLecturer
    ? faculties.filter(f => (assignedCourses || []).some(c => c.faculty === f.id || c.faculty_code === f.code))
    : faculties;

  // Filtered Exam Submissions Logic
  const filteredExamSubmissions = (isStaff ? allAttempts : attempts).filter((att) => {
    if (selectedExamFilter !== 'All' && String(att.exam) !== String(selectedExamFilter)) return false;
    if (selectedExamCourseSubFilter !== 'All' && String(att.exam_course_id || att.course) !== String(selectedExamCourseSubFilter) && att.exam_course_code !== selectedExamCourseSubFilter) return false;
    const isPassed = (att.score || 0) >= 50.0;
    if (selectedExamStatusFilter === 'passed' && !isPassed) return false;
    if (selectedExamStatusFilter === 'failed' && isPassed) return false;
    if (examSubmissionSearch) {
      const q = examSubmissionSearch.toLowerCase();
      const sName = (att.student_name || '').toLowerCase();
      const sUser = (att.student_username || '').toLowerCase();
      const sReg = (att.student_reg_number || '').toLowerCase();
      const eTitle = (att.exam_title || '').toLowerCase();
      if (!sName.includes(q) && !sUser.includes(q) && !sReg.includes(q) && !eTitle.includes(q)) return false;
    }
    return true;
  });

  const examSubTotalCount = filteredExamSubmissions.length;
  const examSubPassedCount = filteredExamSubmissions.filter(a => (a.score || 0) >= 50.0).length;
  const examSubPassRate = examSubTotalCount > 0 ? ((examSubPassedCount / examSubTotalCount) * 100).toFixed(1) : '0.0';
  const examSubAvgScore = examSubTotalCount > 0 ? (filteredExamSubmissions.reduce((acc, a) => acc + (a.score || 0), 0) / examSubTotalCount).toFixed(1) : '0.0';

  const handleSelectCourseUnit = (unitId) => {
    setSelectedCourseUnit(unitId);
    if (unitId) {
      const u = courseUnits.find(item => item.id === parseInt(unitId));
      if (u) {
        const parentC = courses.find(c => c.code === u.course_code || c.id === u.course);
        if (parentC) setSelectedCourse(parentC.id);
        if (u.year_of_study) setExamYearOfStudy(u.year_of_study);
      }
    }
  };

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

  // Edit Exam Modal State
  const [editingExamModal, setEditingExamModal] = useState(null);
  const [editExamTitle, setEditExamTitle] = useState('');
  const [editExamDuration, setEditExamDuration] = useState(60);
  const [editExamScheduledStart, setEditExamScheduledStart] = useState('');
  const [editExamDueDate, setEditExamDueDate] = useState('');
  const [editExamIsActive, setEditExamIsActive] = useState(true);

  const handleDeleteExam = (examItem) => {
    if (isExecutiveReadOnly) return;
    if (isLecturer && examItem.is_approved_by_dean) {
      setErrorMsg('Permission Denied: Approved exams cannot be deleted by the lecturer.');
      return;
    }
    showConfirm({
      title: 'Delete Exam Paper',
      description: `Are you sure you want to delete "${examItem.title || 'this exam'}"? All scheduled slots and student attempts tied to this exam will be permanently removed.`,
      confirmText: 'Delete Exam',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await api.delete(`/exams/${examItem.id}/`);
          setSuccessMsg('Exam paper deleted successfully.');
          if (selectedExam?.id === examItem.id) setSelectedExam(null);
          closeConfirm();
          loadExamData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete exam paper.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
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
    setEditExamScheduledStart(toUgandanDatetimeLocal(exam.scheduled_start));
    setEditExamDueDate(toUgandanDatetimeLocal(exam.due_date));
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
        scheduled_start: getUgandanISOString(editExamScheduledStart),
        due_date: getUgandanISOString(editExamDueDate)
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

  const handleToggleExamPublish = async (examItem) => {
    if (isExecutiveReadOnly) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/exams/${examItem.id}/publish/`);
      setSuccessMsg(res.detail);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle exam publish status.');
    }
  };

  const handlePreviewExamScorecard = async (examItem) => {
    try {
      const data = await api.get(`/exams/${examItem.id}/preview_scorecard/`);
      setExamScorecardPreviewData(data);
      setEditingExamQId(null);
      setShowExamAddQ(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load exam scorecard preview.');
    }
  };

  const handleSaveExamScorecardQuestion = async (examId, qId = null) => {
    try {
      if (qId) {
        await api.patch(`/exam-questions/${qId}/`, examQEditForm);
        setSuccessMsg('Exam question updated successfully!');
      } else {
        await api.post(`/exams/${examId}/questions/`, examQEditForm);
        setSuccessMsg('New question added to exam scorecard!');
      }
      setEditingExamQId(null);
      setShowExamAddQ(false);
      const updated = await api.get(`/exams/${examId}/preview_scorecard/`);
      setExamScorecardPreviewData(updated);
      loadExamData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save exam question.');
    }
  };

  const handleDeleteExamScorecardQuestion = (examId, qId) => {
    showConfirm({
      title: 'Delete Question',
      description: 'Are you sure you want to delete this question from the exam paper?',
      confirmText: 'Delete Question',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/exam-questions/${qId}/`);
          setSuccessMsg('Question deleted from exam scorecard.');
          const updated = await api.get(`/exams/${examId}/preview_scorecard/`);
          setExamScorecardPreviewData(updated);
          closeConfirm();
          loadExamData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete question.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly || !canBuildExam) return;
    const finalCourseIds = targetCourseIds.length > 0 ? targetCourseIds : (selectedCourse ? [parseInt(selectedCourse)] : []);
    if (!examTitle || (finalCourseIds.length === 0 && !selectedCourseUnit)) {
      setErrorMsg('Please enter an exam title, course unit, and course program(s).');
      return;
    }
    if (!isAdmin && examYearOfStudy === 0 && !selectedCourseUnit) {
      setErrorMsg('Only System Administrators can set exams for All Course Units & All Years (Year 0). Please select an assigned course unit.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: examTitle,
        course: selectedCourse ? parseInt(selectedCourse) : (finalCourseIds[0] || null),
        target_course_ids: finalCourseIds.map(id => parseInt(id)),
        course_unit: selectedCourseUnit ? parseInt(selectedCourseUnit) : null,
        duration_minutes: parseInt(duration),
        year_of_study: parseInt(examYearOfStudy),
        target_years: targetYears.length > 0 ? targetYears.map(y => parseInt(y)) : [parseInt(examYearOfStudy || 1)],
        is_active: true,
        scheduled_start: getUgandanISOString(scheduledStart),
        due_date: getUgandanISOString(dueDate)
      };

      const created = await api.post('/exams/', payload);
      setSuccessMsg('Exam paper(s) created successfully! Manage questions below.');
      setExamTitle('');
      setSelectedCourse('');
      setTargetCourseIds([]);
      setTargetYears([]);
      setSelectedCourseUnit('');
      setScheduledStart('');
      setDueDate('');
      loadExamData();
      if (created && !Array.isArray(created)) setSelectedExam(created);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create exam paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadTxtExam = async (e) => {
    e.preventDefault();
    if (!examTxtFile && !examTxtText.trim()) {
      setErrorMsg('Please select a .txt file or paste Aiken formatted text.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (examTxtFile) {
        formData.append('file', examTxtFile);
      } else {
        formData.append('txt_text', examTxtText);
      }

      if (examTxtMode === 'append' && selectedExam) {
        const res = await api.post(`/exams/${selectedExam.id}/import_txt_questions/`, formData);
        setSuccessMsg(res.detail || `Successfully imported ${res.questions_imported || 0} questions into exam paper!`);
        setShowExamTxtModal(false);
        setExamTxtFile(null);
        setExamTxtText('');
        const qData = await api.get(`/exams/${selectedExam.id}/questions/`);
        setQuestions(qData || []);
        loadExamData();
      } else {
        if (!examTxtCourseUnit) {
          setErrorMsg('Please select a Course Unit for the new examination.');
          setSubmitting(false);
          return;
        }
        formData.append('title', examTxtTitle || 'Aiken Imported Examination');
        formData.append('course_unit', examTxtCourseUnit);
        formData.append('exam_type', examTxtType);
        formData.append('duration_minutes', examTxtDuration);
        if (examTxtScheduledStart) formData.append('scheduled_start', examTxtScheduledStart);
        if (examTxtDueDate) formData.append('due_date', examTxtDueDate);

        const res = await api.post('/exams/create_from_txt/', formData);
        setSuccessMsg(res.detail || `Examination "${res.title}" created with ${res.questions_count || 0} questions!`);
        setShowExamTxtModal(false);
        setExamTxtFile(null);
        setExamTxtText('');
        loadExamData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import .txt exam paper. Check formatting.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleAikenExam = () => {
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
    a.download = 'sample_neuro_aiken.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

  const handleDeleteExamTimetable = (id) => {
    if (isExecutiveReadOnly) return;
    showConfirm({
      title: 'Delete Exam Timetable Slot',
      description: 'Are you sure you want to delete this exam timetable slot?',
      confirmText: 'Delete Slot',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/exam-timetables/${id}/`);
          setSuccessMsg('Exam timetable entry removed.');
          closeConfirm();
          loadExamData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to remove exam timetable entry.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
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
            {user.role === 'faculty_admin' ? 'Faculty Secretary' : user.role.replace('_', ' ')}
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
          {isStaff && (
            <button
              onClick={() => setActiveTab('submissions')}
              className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'submissions' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              📊 Exam Submissions ({allAttempts.length})
            </button>
          )}
        </div>

        {/* Staff Faculty & Course Filter */}
        {isStaff && activeTab === 'exams' && (
          <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200/80 shadow-sm">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase">Faculty:</span>
              <select
                value={['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role) ? (user?.faculty_code || (typeof user?.faculty === 'object' ? user?.faculty?.code : (activeFacultiesList[0]?.code || selectedFacultyFilter))) : selectedFacultyFilter}
                disabled={['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role)}
                onChange={(e) => setSelectedFacultyFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-light disabled:opacity-85"
              >
                <option value="All">All Faculties ({activeFacultiesList.length})</option>
                {activeFacultiesList.map(f => (
                  <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                ))}
              </select>
              {['lecturer', 'student', 'faculty_admin', 'dean'].includes(user?.role) && (
                <span className="text-[10px] text-amber-700 font-bold">🔒 Locked to Faculty</span>
              )}
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
                
                {(() => {
                  const studentFacCode = user?.faculty_code;
                  const studentExams = exams.filter(e => {
                    if (!studentFacCode) return true;
                    const fCode = e.faculty_code || (courses.find(c => c.id === e.course)?.faculty_code);
                    return !fCode || fCode === studentFacCode;
                  });

                  return studentExams.length === 0 ? (
                    <p className="text-slate-400 text-xs py-8 text-center">No active examination papers scheduled for {user?.faculty_name || 'your assigned faculty'}.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {studentExams.map((examItem) => {
                        const myAttempt = attempts.find(a => a.exam === examItem.id);
                        return (
                          <div key={examItem.id} className="green-card rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-300 hover:shadow-md transition-all shadow-sm">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-light/10 text-brand-dark border border-brand-light/20">
                                  {examItem.course_code}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${examItem.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                  {examItem.is_results_released ? 'RESULTS RELEASED' : 'WITHHELD'}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-850 text-base leading-tight">{examItem.title}</h4>
                              <p className="text-xs text-slate-500 font-medium">
                                Unit: <span className="font-semibold text-slate-800">{examItem.course_unit_name || examItem.course_code}</span>
                              </p>

                              <div className="pt-2 text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
                                <p>⏱️ Duration: <span className="font-bold text-slate-800">{examItem.duration_minutes} mins</span> | ❓ Questions: <span className="font-bold text-slate-800">{examItem.questions_count}</span></p>
                                <p>📅 Scheduled Start (EAT): <span className="font-bold text-slate-800">{formatUgandanTime(examItem.scheduled_start)}</span></p>
                                {examItem.due_date && (
                                  <p>⏳ Due Date (EAT): <span className="font-bold text-amber-700">{formatUgandanTime(examItem.due_date)}</span></p>
                                )}
                                <p>💰 Fee Gate: <span className="font-bold text-emerald-700">100% Tuition Clearance</span></p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                              {myAttempt ? (
                                myAttempt.completed_at ? (
                                  examItem.is_results_released ? (
                                    <div className="flex items-center justify-between">
                                      <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Score: {myAttempt.score}%
                                      </span>
                                      <button
                                        onClick={() => router.push(`/dashboard/exams/${examItem.id}/results?attemptId=${myAttempt.id}`)}
                                        className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                                      >
                                        View Scorecard
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="w-full block text-center px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      🔒 Results Withheld
                                    </span>
                                  )
                                ) : (
                                  <button
                                    onClick={() => startExam(examItem.id)}
                                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                                  >
                                    Resume Exam
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={() => startExam(examItem.id)}
                                  disabled={!examItem.is_active || examItem.questions_count === 0}
                                  className="w-full py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                                >
                                  Launch Exam
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                );
              })()}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {facExams.map((examItem) => {
                            const isMyExam = (isLecturer && (examItem.lecturer === user.id || examItem.lecturer_name === user.username || examItem.lecturer_name === user.first_name));
                            const isApproved = Boolean(examItem.is_approved_by_dean);
                            const isLockedForLecturer = isLecturer && isApproved;
                            const canManageThisExam = isAdmin || (isLecturer && !isLockedForLecturer);

                            return (
                              <div key={examItem.id} className="bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl border border-emerald-200/80 p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {examItem.course_code}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                      {isApproved ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          ✅ Approved
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                          ⏳ Pending
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${examItem.is_results_released ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                        {examItem.is_results_released ? 'RELEASED' : 'WITHHELD'}
                                      </span>
                                    </div>
                                  </div>

                                  <h4 className="font-bold text-slate-850 text-base leading-tight">{examItem.title}</h4>
                                  <p className="text-xs text-slate-500 font-medium">
                                    Unit: <span className="font-semibold text-slate-800">{examItem.course_unit_name || examItem.course_code}</span>
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Lecturer: <span className="font-semibold text-slate-800">{examItem.lecturer_name}</span>
                                  </p>

                                  <div className="pt-2 text-[11px] text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200 font-medium">
                                    <p>⏱️ Duration: <span className="font-bold text-slate-800">{examItem.duration_minutes} mins</span> | ❓ Questions: <span className="font-bold text-slate-800">{examItem.questions_count}</span></p>
                                    <p>📅 Scheduled Start (EAT): <span className="font-bold text-slate-800">{formatUgandanTime(examItem.scheduled_start)}</span></p>
                                    {examItem.due_date && (
                                      <p>⏳ Due Date (EAT): <span className="font-bold text-amber-700">{formatUgandanTime(examItem.due_date)}</span></p>
                                    )}
                                    {isLockedForLecturer && (
                                      <p className="text-[10px] text-red-600 font-bold">🔒 Locked (Approved by Dean)</p>
                                    )}
                                  </div>
                                </div>

                                {/* Staff Actions Footer */}
                                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1">
                                  <button
                                    onClick={() => handleSelectExamForQuestions(examItem)}
                                    className="px-2 py-1 bg-white border border-emerald-200 hover:bg-emerald-50 text-slate-800 text-xs font-bold rounded-lg transition-all"
                                  >
                                    Questions ({examItem.questions_count})
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedExamFilter(String(examItem.id));
                                      setActiveTab('submissions');
                                    }}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                                    title="Filter student exam submissions and view scorecards"
                                  >
                                    📊 Submissions ({allAttempts.filter(a => a.exam === examItem.id).length})
                                  </button>

                                  <button
                                    onClick={() => handlePreviewExamScorecard(examItem)}
                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold rounded-lg transition-all"
                                    title="Preview exam paper and score card layout"
                                  >
                                    👁️ Preview
                                  </button>

                                  {!isExecutiveReadOnly && (
                                    <>
                                      {canManageThisExam && (
                                        <>
                                          <button
                                            onClick={() => handleToggleExamPublish(examItem)}
                                            className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${examItem.is_active || examItem.is_published ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-brand-light text-white'}`}
                                            title="Toggle exam publish status"
                                          >
                                            {examItem.is_active || examItem.is_published ? 'Unpublish' : 'Publish'}
                                          </button>
                                          <button
                                            onClick={() => handleOpenEditExamModal(examItem)}
                                            className="px-2 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg transition-all"
                                            title="Edit exam details"
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteExam(examItem)}
                                            className="px-2 py-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-all"
                                            title="Delete exam paper"
                                          >
                                            🗑️
                                          </button>
                                        </>
                                      )}

                                      {isRegistrarOrStaff && (
                                        <button
                                          onClick={() => handleReleaseExamResults(examItem.id)}
                                          className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${examItem.is_results_released ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-brand-light text-white'}`}
                                        >
                                          {examItem.is_results_released ? '🔒 Withhold' : '📢 Release'}
                                        </button>
                                      )}
                                    </>
                                  )}

                                  <button
                                    onClick={() => downloadResultsCSV(examItem.id)}
                                    className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unassignedExams.map((examItem) => (
                        <div key={examItem.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-3 shadow-sm hover:border-emerald-300 transition-all">
                          <div className="space-y-1.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                              {examItem.course_code}
                            </span>
                            <h4 className="font-bold text-slate-850 text-base leading-tight">{examItem.title}</h4>
                            <p className="text-xs text-slate-500 font-medium">Lecturer: <span className="font-semibold text-slate-800">{examItem.lecturer_name}</span></p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => handleSelectExamForQuestions(examItem)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg"
                            >
                              Questions ({examItem.questions_count})
                            </button>
                          </div>
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
            
            {canBuildExam && !isExecutiveReadOnly && (
              <div className="green-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Draft New Examination</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setExamTxtMode('new');
                      setExamTxtTitle('');
                      setExamTxtCourseUnit(selectedCourseUnit || (assignedCourseUnits[0]?.id || ''));
                      setExamTxtScheduledStart(getUgandanNowDatetimeLocal());
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      setExamTxtDueDate(toUgandanDatetimeLocal(d.toISOString()));
                      setShowExamTxtModal(true);
                    }}
                    className="px-2.5 py-1 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-bold rounded-lg transition-all flex items-center space-x-1"
                    title="Translate a .txt Aiken format file into an exam paper"
                  >
                    <span>📄 Upload .TXT Exam</span>
                  </button>
                </div>
                <form onSubmit={handleCreateExam} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Select Course Unit *</label>
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

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Target Course Program(s) *</label>
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
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Target Year(s) of Study (1-4)</label>
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800">
                      {[1, 2, 3, 4].map((yr) => (
                        <label key={yr} className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={targetYears.includes(yr)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTargetYears(prev => [...prev, yr]);
                                setExamYearOfStudy(yr);
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
                          onClick={() => { setTargetYears([1, 2, 3, 4]); setExamYearOfStudy(0); }}
                          className="text-[10px] text-brand-medium hover:underline font-extrabold"
                        >
                          Select All Years
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-bold uppercase mb-1">Exam Title *</label>
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

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase">Scheduled Start & Due Date</label>
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        🕒 Ugandan Time (UTC+3, EAT)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Start Date & Time (EAT)</label>
                        <input
                          type="datetime-local"
                          value={scheduledStart}
                          onChange={(e) => setScheduledStart(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Due Date & Time (EAT)</label>
                        <input
                          type="datetime-local"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
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

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-extrabold uppercase tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <span>💾 Save Exam Paper & Build Questions</span>
                  </button>
                </form>
              </div>
            )}

            {/* Question Bank Viewer & Scorecard Question Paper Preview */}
            {selectedExam && (
              <div className="green-card rounded-2xl p-6 space-y-4 animate-slide-up">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center space-x-2">
                    <span>📋 Exam Question Paper Scorecard Preview ({selectedExam.title})</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    {!isExecutiveReadOnly && (
                      <>
                        <button
                          onClick={() => handleOpenEditExamModal(selectedExam)}
                          className="px-2.5 py-1 bg-brand-light text-white hover:bg-brand-medium text-xs font-bold rounded-lg shadow-sm transition-all"
                          title="Save and edit exam dates, duration, title"
                        >
                          💾 Save Details
                        </button>
                        {(!isLecturer || !selectedExam.is_approved_by_dean) && (
                          <button
                            onClick={() => {
                              setExamTxtMode('append');
                              setShowExamTxtModal(true);
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1"
                            title="Import questions from .txt Aiken file into this exam paper"
                          >
                            <span>📄 Import .TXT</span>
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={() => setSelectedExam(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">✕ Close</button>
                  </div>
                </div>

                {isLecturer && selectedExam.is_approved_by_dean && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-bold text-center">
                    🔒 Approved by Dean: Question Bank Locked for Editing
                  </div>
                )}

                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                  {questions.length === 0 ? (
                    <p className="text-slate-400 text-xs py-4 text-center">No questions in this paper yet.</p>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={q.id} className="p-3.5 bg-white rounded-xl border border-emerald-200/80 shadow-sm text-xs space-y-2">
                        <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-850">Q{idx + 1}: {q.question_text}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_option === 'A' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                            <span><strong className="text-slate-900 mr-1.5">A:</strong> {q.option_a}</span>
                            {q.correct_option === 'A' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_option === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                            <span><strong className="text-slate-900 mr-1.5">B:</strong> {q.option_b}</span>
                            {q.correct_option === 'B' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_option === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                            <span><strong className="text-slate-900 mr-1.5">C:</strong> {q.option_c}</span>
                            {q.correct_option === 'C' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                          </div>
                          <div className={`p-2 rounded-xl border flex items-center justify-between ${q.correct_option === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                            <span><strong className="text-slate-900 mr-1.5">D:</strong> {q.option_d}</span>
                            {q.correct_option === 'D' && <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
                          </div>
                        </div>
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

      {/* TAB 3: EXAM SUBMISSIONS (Staff) */}
      {isStaff && activeTab === 'submissions' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Active Filter Alert Banner */}
          {selectedExamFilter !== 'All' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-950">
                <span>📌 Filtered Exam Submissions:</span>
                <span className="bg-emerald-700 text-white px-2.5 py-1 rounded-lg">
                  {exams.find(e => String(e.id) === String(selectedExamFilter))?.title || `Exam #${selectedExamFilter}`}
                </span>
              </div>
              <button
                onClick={() => setSelectedExamFilter('All')}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-sm transition-all self-start sm:self-auto"
              >
                ✕ Clear Filter (Show All Exams)
              </button>
            </div>
          )}

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Exam Submissions</span>
              <span className="text-2xl font-black text-slate-850 mt-1 block">{examSubTotalCount}</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Passed Examinations</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{examSubPassedCount}</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pass Rate Percentage</span>
              <span className="text-2xl font-black text-brand-dark mt-1 block">{examSubPassRate}%</span>
            </div>
            <div className="green-card rounded-2xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Class Average Score</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">{examSubAvgScore}%</span>
            </div>
          </div>

          {/* Filter Toolbar & Data Table */}
          <div className="green-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">
                Student Examination Attempts Audit ({filteredExamSubmissions.length})
              </h3>
              
              {(selectedExamFilter !== 'All' || selectedExamCourseSubFilter !== 'All' || selectedExamStatusFilter !== 'All' || examSubmissionSearch) && (
                <button
                  onClick={() => {
                    setSelectedExamFilter('All');
                    setSelectedExamCourseSubFilter('All');
                    setSelectedExamStatusFilter('All');
                    setExamSubmissionSearch('');
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg transition-all"
                >
                  ✕ Reset All Filters
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter by Examination</label>
                <select
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Examination Papers ({exams.length})</option>
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>[{e.course_code}] {e.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter by Course Program</label>
                <select
                  value={selectedExamCourseSubFilter}
                  onChange={(e) => setSelectedExamCourseSubFilter(e.target.value)}
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
                  value={selectedExamStatusFilter}
                  onChange={(e) => setSelectedExamStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Statuses (Passed & Failed)</option>
                  <option value="passed">Passed Exams Only</option>
                  <option value="failed">Failed Exams Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Student / Exam</label>
                <input
                  type="text"
                  placeholder="Student name, reg no, or exam..."
                  value={examSubmissionSearch}
                  onChange={(e) => setExamSubmissionSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-brand-light"
                />
              </div>
            </div>

            {filteredExamSubmissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No student examination submissions match your active filter criteria.
              </div>
            ) : (
              (() => {
                const totalExamSubPages = Math.max(1, Math.ceil(filteredExamSubmissions.length / examSubPageSize));
                const safeExamSubPage = Math.min(Math.max(1, examSubPage), totalExamSubPages);
                const paginatedExamSubmissions = filteredExamSubmissions.slice((safeExamSubPage - 1) * examSubPageSize, safeExamSubPage * examSubPageSize);

                return (
                  <>
                    <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                            <th className="px-4 py-3">Student Name & Reg No</th>
                            <th className="px-4 py-3">Exam Paper Title</th>
                            <th className="px-4 py-3 text-center">Score %</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Proctoring Logs</th>
                            <th className="px-4 py-3">Submitted At (EAT)</th>
                            <th className="px-4 py-3 text-right">Scorecard Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {paginatedExamSubmissions.map((att) => {
                            const isPassed = (att.score || 0) >= 50.0;
                            return (
                              <tr key={att.id} className="hover:bg-slate-50/80 transition-all">
                                <td className="px-4 py-3">
                                  <p className="font-extrabold text-slate-850">{att.student_name || att.student_username}</p>
                                  <span className="text-[10px] text-slate-500 font-mono font-bold">{att.student_reg_number || `@${att.student_username}`}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-bold text-slate-800">{att.exam_title}</p>
                                  <span className="text-[10px] font-bold text-brand-medium">Course: {att.exam_course_code}</span>
                                </td>
                                <td className="px-4 py-3 text-center font-black text-sm text-slate-850">
                                  {att.score !== null && att.score !== undefined ? `${att.score}%` : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${isPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {isPassed ? 'PASSED' : 'FAILED'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${att.tab_switches_count > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                    {att.tab_switches_count > 0 ? `⚠️ ${att.tab_switches_count} Tab Switches` : 'Clean'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-medium text-[11px]">
                                  {formatUgandanTime(att.completed_at || att.started_at)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => router.push(`/dashboard/exams/${att.exam}/results?attemptId=${att.id}`)}
                                    className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                                  >
                                    📋 View Scorecard
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Submissions Pagination Controls Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500 font-semibold border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span>Showing {(safeExamSubPage - 1) * examSubPageSize + 1} - {Math.min(safeExamSubPage * examSubPageSize, filteredExamSubmissions.length)} of {filteredExamSubmissions.length} submissions</span>
                        <select
                          value={examSubPageSize}
                          onChange={(e) => { setExamSubPageSize(Number(e.target.value)); setExamSubPage(1); }}
                          className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-slate-700"
                        >
                          <option value={10}>10 per page</option>
                          <option value={20}>20 per page</option>
                          <option value={50}>50 per page</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => setExamSubPage(1)}
                          disabled={safeExamSubPage <= 1}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          « First
                        </button>
                        <button
                          onClick={() => setExamSubPage(prev => Math.max(1, prev - 1))}
                          disabled={safeExamSubPage <= 1}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          ‹ Prev
                        </button>
                        <span className="px-3 py-1 font-bold text-slate-800">
                          Page {safeExamSubPage} of {totalExamSubPages}
                        </span>
                        <button
                          onClick={() => setExamSubPage(prev => Math.min(totalExamSubPages, prev + 1))}
                          disabled={safeExamSubPage >= totalExamSubPages}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                        >
                          Next ›
                        </button>
                        <button
                          onClick={() => setExamSubPage(totalExamSubPages)}
                          disabled={safeExamSubPage >= totalExamSubPages}
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Scheduled Start (EAT)</label>
                  <input
                    type="datetime-local"
                    value={editExamScheduledStart}
                    onChange={(e) => setEditExamScheduledStart(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Due Date (EAT)</label>
                  <input
                    type="datetime-local"
                    value={editExamDueDate}
                    onChange={(e) => setEditExamDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-extrabold uppercase rounded-lg shadow-sm">
                  💾 Save Changes
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

      {/* EXAM SCORE CARD LAYOUT PREVIEW MODAL */}
      {examScorecardPreviewData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Header Banner */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full">
                  🎓 Final Exam Score Card Layout Preview (Lecturer / Admin Draft View)
                </span>
                <h3 className="text-xl font-black text-slate-850 mt-2">{examScorecardPreviewData.title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Course: {examScorecardPreviewData.course_code} ({examScorecardPreviewData.course_name}) {examScorecardPreviewData.course_unit_name ? `· Unit: ${examScorecardPreviewData.course_unit_name}` : ''}
                </p>
              </div>
              <button
                onClick={() => setExamScorecardPreviewData(null)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Scorecard Header Card Simulation */}
            <div className={`rounded-2xl p-6 text-white text-center space-y-3 ${examScorecardPreviewData.is_published ? 'bg-gradient-to-r from-emerald-900 to-slate-900' : 'bg-gradient-to-r from-amber-950 to-slate-900'}`}>
              <div className="flex items-center justify-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${examScorecardPreviewData.is_published ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                  {examScorecardPreviewData.is_published ? '🟢 PUBLISHED (Visible to Students upon scheduled start)' : '🟡 DRAFT (Unpublished - Hidden from Students)'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20 p-4 rounded-xl border border-white/10 text-xs mt-4">
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Pass Grade Target</span>
                  <span className="font-extrabold text-emerald-300">50.0%</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Exam Duration</span>
                  <span className="font-extrabold text-white">{examScorecardPreviewData.duration_minutes} Mins</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Total Questions</span>
                  <span className="font-extrabold text-white">{examScorecardPreviewData.total_questions} Questions</span>
                </div>
                <div>
                  <span className="text-white/60 text-[10px] uppercase font-bold block">Target Year</span>
                  <span className="font-extrabold text-amber-300">{examScorecardPreviewData.year_of_study === 0 ? 'All Years' : `Year ${examScorecardPreviewData.year_of_study}`}</span>
                </div>
              </div>
            </div>

            {/* Questions Breakdown & Scorecard Editor */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Examination Scorecard Answer Key & Questions Editor</h4>
                
                {!isExecutiveReadOnly && canBuildExam && (
                  <button
                    onClick={() => {
                      setEditingExamQId(null);
                      setExamQEditForm({
                        question_text: '',
                        option_a: '',
                        option_b: '',
                        option_c: '',
                        option_d: '',
                        correct_option: 'A'
                      });
                      setShowExamAddQ(true);
                    }}
                    className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    ➕ Add Question to Score Card
                  </button>
                )}
              </div>

              {/* Add New Exam Question Form */}
              {showExamAddQ && (
                <div className="p-4 bg-purple-50/70 border-2 border-purple-200 rounded-2xl space-y-3 animate-fade-in text-xs">
                  <h5 className="font-extrabold text-purple-950 uppercase text-xs">Add New Examination Question</h5>
                  
                  <textarea
                    placeholder="Type exam question text..."
                    value={examQEditForm.question_text}
                    onChange={(e) => setExamQEditForm({ ...examQEditForm, question_text: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl"
                    rows={2}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Option A"
                      value={examQEditForm.option_a}
                      onChange={(e) => setExamQEditForm({ ...examQEditForm, option_a: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option B"
                      value={examQEditForm.option_b}
                      onChange={(e) => setExamQEditForm({ ...examQEditForm, option_b: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option C"
                      value={examQEditForm.option_c}
                      onChange={(e) => setExamQEditForm({ ...examQEditForm, option_c: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Option D"
                      value={examQEditForm.option_d}
                      onChange={(e) => setExamQEditForm({ ...examQEditForm, option_d: e.target.value })}
                      className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-purple-900 uppercase mb-0.5">Correct Option</label>
                    <select
                      value={examQEditForm.correct_option}
                      onChange={(e) => setExamQEditForm({ ...examQEditForm, correct_option: e.target.value })}
                      className="w-full max-w-xs px-3 py-1.5 bg-white border border-purple-200 rounded-xl font-bold"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>

                  <div className="flex space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveExamScorecardQuestion(examScorecardPreviewData.id)}
                      className="px-4 py-1.5 bg-brand-light text-white font-bold rounded-xl text-xs"
                    >
                      💾 Save Question
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowExamAddQ(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {(!examScorecardPreviewData.questions || examScorecardPreviewData.questions.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs italic">
                  No examination questions set yet. Click "Add Question to Score Card" above to set questions.
                </div>
              ) : (
                <div className="space-y-4">
                  {examScorecardPreviewData.questions.map((q, idx) => {
                    const isEditing = editingExamQId === q.id;

                    if (isEditing) {
                      return (
                        <div key={q.id} className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-3 text-xs animate-fade-in">
                          <div className="flex items-center justify-between font-extrabold text-amber-950">
                            <span>Editing Exam Q{idx + 1}</span>
                            <button onClick={() => setEditingExamQId(null)} className="text-slate-500 hover:text-slate-800">✕</button>
                          </div>

                          <textarea
                            value={examQEditForm.question_text}
                            onChange={(e) => setExamQEditForm({ ...examQEditForm, question_text: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold"
                            rows={2}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Option A"
                              value={examQEditForm.option_a}
                              onChange={(e) => setExamQEditForm({ ...examQEditForm, option_a: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option B"
                              value={examQEditForm.option_b}
                              onChange={(e) => setExamQEditForm({ ...examQEditForm, option_b: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option C"
                              value={examQEditForm.option_c}
                              onChange={(e) => setExamQEditForm({ ...examQEditForm, option_c: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Option D"
                              value={examQEditForm.option_d}
                              onChange={(e) => setExamQEditForm({ ...examQEditForm, option_d: e.target.value })}
                              className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[10px] text-amber-900 uppercase mb-0.5">Correct Option</label>
                            <select
                              value={examQEditForm.correct_option}
                              onChange={(e) => setExamQEditForm({ ...examQEditForm, correct_option: e.target.value })}
                              className="w-full max-w-xs px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-bold"
                            >
                              <option value="A">Option A</option>
                              <option value="B">Option B</option>
                              <option value="C">Option C</option>
                              <option value="D">Option D</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => handleSaveExamScorecardQuestion(examScorecardPreviewData.id, q.id)}
                                className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs"
                              >
                                💾 Save Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingExamQId(null)}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteExamScorecardQuestion(examScorecardPreviewData.id, q.id)}
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
                              1 Point
                            </span>

                            {!isExecutiveReadOnly && canBuildExam && (
                              <button
                                onClick={() => {
                                  setEditingExamQId(q.id);
                                  setShowExamAddQ(false);
                                  setExamQEditForm({
                                    question_text: q.question_text || '',
                                    option_a: q.option_a || '',
                                    option_b: q.option_b || '',
                                    option_c: q.option_c || '',
                                    option_d: q.option_d || '',
                                    correct_option: q.correct_option || 'A'
                                  });
                                }}
                                className="px-2 py-0.5 bg-amber-100 text-amber-800 hover:bg-amber-200 text-[10px] font-extrabold rounded border border-amber-300"
                              >
                                ✏️ Edit
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium">
                          {['A', 'B', 'C', 'D'].map((optKey) => {
                            const optText = q[`option_${optKey.toLowerCase()}`];
                            const isCorrect = String(q.correct_option).toUpperCase() === optKey;
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setExamScorecardPreviewData(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all"
              >
                Close Preview
              </button>

              {!isExecutiveReadOnly && (
                <button
                  onClick={async () => {
                    await handleToggleExamPublish(examScorecardPreviewData);
                    const updated = await api.get(`/exams/${examScorecardPreviewData.id}/preview_scorecard/`);
                    setExamScorecardPreviewData(updated);
                  }}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${examScorecardPreviewData.is_published ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {examScorecardPreviewData.is_published ? 'Unpublish Exam' : 'Publish Exam Now'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: AIKEN TXT EXAM IMPORT & TRANSLATION */}
      {showExamTxtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">
                  {examTxtMode === 'append' ? `Import Questions into "${selectedExam?.title}"` : 'Translate .TXT File into Exam Paper'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Standard Aiken Format Parser (Questions, Options A-D, ANSWER: X)</p>
              </div>
              <button onClick={() => setShowExamTxtModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadTxtExam} className="space-y-3 text-xs">
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

              {examTxtMode === 'new' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Target Course Unit *</label>
                      <select
                        value={examTxtCourseUnit}
                        onChange={(e) => setExamTxtCourseUnit(e.target.value)}
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
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Exam Type</label>
                      <select
                        value={examTxtType}
                        onChange={(e) => setExamTxtType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      >
                        <option value="final">Final Examination</option>
                        <option value="midterm">Midterm Examination</option>
                        <option value="supplementary">Supplementary Examination</option>
                        <option value="special">Special Examination</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Exam Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Neurology Clinical Comprehensive Examination"
                      value={examTxtTitle}
                      onChange={(e) => setExamTxtTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Duration (mins)</label>
                      <input
                        type="number"
                        value={examTxtDuration}
                        onChange={(e) => setExamTxtDuration(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Start Time (EAT)</label>
                      <input
                        type="datetime-local"
                        value={examTxtScheduledStart}
                        onChange={(e) => setExamTxtScheduledStart(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">Due Date (EAT)</label>
                      <input
                        type="datetime-local"
                        value={examTxtDueDate}
                        onChange={(e) => setExamTxtDueDate(e.target.value)}
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
                  onChange={(e) => setExamTxtFile(e.target.files[0])}
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
                  value={examTxtText}
                  onChange={(e) => setExamTxtText(e.target.value)}
                  placeholder="Paste question text, options A-D, and ANSWER: X here..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={downloadSampleAikenExam}
                  className="text-teal-700 hover:text-teal-800 text-[11px] font-bold underline flex items-center space-x-1"
                >
                  <span>📥 Download Sample Aiken .txt</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowExamTxtModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Translating...' : examTxtMode === 'append' ? 'Translate & Append' : 'Translate & Create Exam'}
                  </button>
                </div>
              </div>
            </form>
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
