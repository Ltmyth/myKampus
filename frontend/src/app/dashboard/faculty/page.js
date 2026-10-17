'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getApiBaseUrl } from '@/lib/api';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function FacultyManagementPage() {
  const { user } = useAuth();
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseUnits, setCourseUnits] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [deans, setDeans] = useState([]);
  const [secretaries, setSecretaries] = useState([]);
  const [students, setStudents] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'timetables', 'faculties', 'assignments', 'students'
  const [activeTab, setActiveTab] = useState('timetables');

  // Form State (Assign Lecturer to Unit)
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Student Enrollment Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [targetFacultyId, setTargetFacultyId] = useState('');
  const [targetCourseIds, setTargetCourseIds] = useState([]);
  const [targetYearOfStudy, setTargetYearOfStudy] = useState(1);
  const [targetSemester, setTargetSemester] = useState(1);
  const [selectedStudentAllocIds, setSelectedStudentAllocIds] = useState([]);
  const [showSingleAllocModal, setShowSingleAllocModal] = useState(false);
  const [showBulkAllocModal, setShowBulkAllocModal] = useState(false);
  const [bulkAllocFacultyId, setBulkAllocFacultyId] = useState('');
  const [bulkAllocYearOfStudy, setBulkAllocYearOfStudy] = useState(1);
  const [bulkAllocSemester, setBulkAllocSemester] = useState(1);
  const [bulkAllocCourseIds, setBulkAllocCourseIds] = useState([]);

  // Class Promotion State
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionFacultyId, setPromotionFacultyId] = useState('All');
  const [promotionEntryYear, setPromotionEntryYear] = useState('All');
  const [promotionIntake, setPromotionIntake] = useState('All');
  const [promotionCourseId, setPromotionCourseId] = useState('');
  const [promotionCurrentYear, setPromotionCurrentYear] = useState(1);
  const [promotionTargetYear, setPromotionTargetYear] = useState(2);
  const [promotionMode, setPromotionMode] = useState('next_semester');
  const [promotionTargetSemester, setPromotionTargetSemester] = useState(1);
  const [selectedStudentPromotionIds, setSelectedStudentPromotionIds] = useState([]);
  const [studentOverrides, setStudentOverrides] = useState({});

  // Student Directory Filter & Pagination State
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFacultyFilter, setStudentFacultyFilter] = useState('All');
  const [studentYearFilter, setStudentYearFilter] = useState('All');
  const [studentSemesterFilter, setStudentSemesterFilter] = useState('All');
  const [studentGenderFilter, setStudentGenderFilter] = useState('All');
  const [studentEntryYearFilter, setStudentEntryYearFilter] = useState('All');
  const [studentIntakeFilter, setStudentIntakeFilter] = useState('All');
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(10);

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

  // Form State (Create/Edit Course)
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseFormData, setCourseFormData] = useState({
    faculty: '',
    name: '',
    code: '',
    description: '',
    department: '',
    duration_years: 3
  });

  // Bulk Deletion & Assignment State for Courses & Course Units
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [bulkLecturerSearch, setBulkLecturerSearch] = useState('');
  const [bulkSelectedLecturerId, setBulkSelectedLecturerId] = useState('');
  const [singleLecturerSearch, setSingleLecturerSearch] = useState('');

  // Lecturer-Centric Course Assignment Console State
  const [consoleLecturerSearch, setConsoleLecturerSearch] = useState('');
  const [consoleSelectedLecturerId, setConsoleSelectedLecturerId] = useState('');
  const [consoleUnitSearch, setConsoleUnitSearch] = useState('');
  const [consoleSelectedUnitIds, setConsoleSelectedUnitIds] = useState([]);
  const [consoleYearFilter, setConsoleYearFilter] = useState('All');
  const [consoleSemesterFilter, setConsoleSemesterFilter] = useState('All');
  const [consoleFacultyFilter, setConsoleFacultyFilter] = useState('All');
  const [consoleAssigning, setConsoleAssigning] = useState(false);

  // Course Filtering & List Expansion State
  const [courseFacultyFilter, setCourseFacultyFilter] = useState('All');
  const [courseSearchName, setCourseSearchName] = useState('');
  const [expandedCourseIds, setExpandedCourseIds] = useState([]);

  const toggleExpandCourse = (courseId) => {
    setExpandedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  // Form State (Create/Edit Course Unit)
  const [showCourseUnitModal, setShowCourseUnitModal] = useState(false);
  const [editingCourseUnit, setEditingCourseUnit] = useState(null);
  const [unitFormData, setUnitFormData] = useState({
    course: '',
    name: '',
    code: '',
    credit_units: 3,
    year_of_study: 1,
    semester: 1,
    lecturers: []
  });
  const [selectedUnitYearFilter, setSelectedUnitYearFilter] = useState('All');
  const [selectedUnitSemesterFilter, setSelectedUnitSemesterFilter] = useState('All');
  const [selectedUnitFacultyFilter, setSelectedUnitFacultyFilter] = useState('All');
  const [selectedUnitLecturerFilter, setSelectedUnitLecturerFilter] = useState('All');
  const [studentCourseFilter, setStudentCourseFilter] = useState('All');

  // Course Units Review & Attachment Modal State
  const [showUnitsReviewModal, setShowUnitsReviewModal] = useState(false);
  const [selectedReviewCourse, setSelectedReviewCourse] = useState(null);
  const [reviewUnitsList, setReviewUnitsList] = useState([]);
  const [loadingReviewUnits, setLoadingReviewUnits] = useState(false);
  const [reviewSearchTerm, setReviewSearchTerm] = useState('');
  const [reviewYearFilter, setReviewYearFilter] = useState('All');
  const [attachExistingUnitId, setAttachExistingUnitId] = useState('');
  const [showInlineAddUnit, setShowInlineAddUnit] = useState(false);
  const [newUnitInlineData, setNewUnitInlineData] = useState({
    code: '',
    name: '',
    credit_units: 3,
    year_of_study: 1,
    semester: 1
  });

  // Course Units Import State (Excel & CSV)
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [csvTargetCourse, setCsvTargetCourse] = useState('');
  const [csvTargetFaculty, setCsvTargetFaculty] = useState('');

  // Form State (Create Class Timetable)
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [ttFormData, setTtFormData] = useState({
    faculty: '',
    course: '',
    course_unit: '',
    lecturer: '',
    class_date: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '11:00',
    room: 'Lecture Hall A',
    class_type: 'lecture'
  });
  
  // Filtering
  const [selectedDayFilter, setSelectedDayFilter] = useState('All');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All');
  
  // Course Unit Search and Program Filter
  const [unitSearchText, setUnitSearchText] = useState('');
  const [selectedUnitCourseFilter, setSelectedUnitCourseFilter] = useState('All');

  // Bulk Student CSV Allocation State
  const [showStudentCsvModal, setShowStudentCsvModal] = useState(false);
  const [studentCsvFile, setStudentCsvFile] = useState(null);
  const [studentCsvText, setStudentCsvText] = useState('');

  // UI Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isAdmin = (user?.role === 'admin' || user?.role === 'platform_coordinator') && !isExecutiveReadOnly;
  const isSecretaryOrStaff = ['faculty_admin', 'admin', 'platform_coordinator'].includes(user?.role) && !isExecutiveReadOnly;
  const isStudent = user?.role === 'student';
  const isLecturer = user?.role === 'lecturer';
  const canAssignLecturer = ['admin', 'faculty_admin', 'platform_coordinator'].includes(user?.role) && !isExecutiveReadOnly;
  const canBulkManage = isSecretaryOrStaff;
  const isStrictSystemAdmin = user?.role === 'admin';

  useEffect(() => {
    loadFacultyData();
  }, []);

  async function loadFacultyData() {
    try {
      setLoading(true);
      const [facs, crs, units, users, timetables] = await Promise.all([
        api.get('/faculties/').catch(() => []),
        api.get('/courses/').catch(() => []),
        api.get('/course-units/').catch(() => []),
        api.get('/admin/users/').catch(() => []),
        api.get('/class-timetables/').catch(() => [])
      ]);
      setFaculties(facs || []);
      setCourses(crs || []);
      setCourseUnits(units || []);
      setSelectedCourseIds(prev => prev.filter(id => (crs || []).some(c => c.id === id)));
      setSelectedUnitIds(prev => prev.filter(id => (units || []).some(u => u.id === id)));
      const userList = users || [];
      setLecturers(userList.filter(u => u.role === 'lecturer'));
      setDeans(userList.filter(u => u.role === 'dean'));
      setSecretaries(userList.filter(u => u.role === 'faculty_admin'));
      setStudents(userList.filter(u => u.role === 'student'));
      setClassTimetables(timetables || []);
      
      if (facs.length > 0 && !ttFormData.faculty) {
        setTtFormData(prev => ({ ...prev, faculty: facs[0].id }));
      }
      if (crs.length > 0 && !csvTargetCourse) {
        setCsvTargetCourse(crs[0].code);
      }
    } catch (err) {
      setErrorMsg('Failed to load faculty datasets.');
    } finally {
      setLoading(false);
    }
  }

  const handleAssignStudentToFaculty = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !targetFacultyId) {
      setErrorMsg('Please select a student and a target faculty.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post(`/faculties/${targetFacultyId}/assign_student/`, {
        student_id: parseInt(selectedStudentId),
        course_ids: targetCourseIds.map(id => parseInt(id)),
        year_of_study: parseInt(targetYearOfStudy || 1),
        semester: parseInt(targetSemester || 1)
      });
      setSuccessMsg(res.detail || 'Student assigned to faculty, year of study, semester, and courses successfully!');
      setShowSingleAllocModal(false);
      setSelectedStudentId('');
      setTargetCourseIds([]);
      setTargetYearOfStudy(1);
      setTargetSemester(1);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign student to faculty.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkStudentAllocSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudentAllocIds.length === 0) {
      setErrorMsg('Please select at least one student user account.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/users/bulk_assign_year_and_courses/', {
        user_ids: selectedStudentAllocIds,
        year_of_study: parseInt(bulkAllocYearOfStudy || 1),
        semester: parseInt(bulkAllocSemester || 1),
        faculty_id: bulkAllocFacultyId ? parseInt(bulkAllocFacultyId) : null,
        course_ids: bulkAllocCourseIds ? bulkAllocCourseIds.map(id => parseInt(id)) : []
      });
      setSuccessMsg(res.detail || `Bulk student allocation completed for ${selectedStudentAllocIds.length} accounts!`);
      setShowBulkAllocModal(false);
      setSelectedStudentAllocIds([]);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to apply bulk student allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecutePromotion = async (e) => {
    e.preventDefault();
    if (selectedStudentPromotionIds.length === 0) {
      setErrorMsg('Please select at least one student account for class promotion.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post('/admin/users/promote_class/', {
        promotion_target: promotionMode, // 'next_semester' | 'next_year' | 'custom'
        target_year: parseInt(promotionTargetYear),
        target_semester: parseInt(promotionTargetSemester || 1),
        student_ids: selectedStudentPromotionIds.map(id => parseInt(id)),
        entry_year: promotionEntryYear !== 'All' ? parseInt(promotionEntryYear) : null,
        intake: promotionIntake !== 'All' ? promotionIntake : null,
        overrides: studentOverrides
      });
      setSuccessMsg(res.detail || `Class/Individual promotion executed successfully for ${selectedStudentPromotionIds.length} students!`);
      setShowPromotionModal(false);
      setSelectedStudentPromotionIds([]);
      setStudentOverrides({});
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to execute class promotion.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStudentFromFaculty = (facultyId, studentId) => {
    showConfirm({
      title: 'Remove Student from Faculty',
      description: 'Are you sure you want to remove this student from the faculty? Their faculty link will be disassociated.',
      confirmText: 'Remove Student',
      variant: 'warning',
      icon: '⚠️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await api.post(`/faculties/${facultyId}/remove_student/`, {
            student_id: parseInt(studentId)
          });
          setSuccessMsg(res?.detail || 'Student removed from faculty.');
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to remove student from faculty.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // --- CSV Upload Handler ---
  const handleUploadCsvUnits = async (e) => {
    e.preventDefault();
    if (!csvFile && !csvText.trim()) {
      setErrorMsg('Please select a CSV file or paste CSV unit data.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (csvFile) {
        formData.append('file', csvFile);
      } else {
        formData.append('csv_text', csvText);
      }
      if (csvTargetCourse) {
        formData.append('course_code', csvTargetCourse);
      }
      if (csvTargetFaculty) {
        formData.append('faculty_code', csvTargetFaculty);
      }

      const res = await api.post('/course-units/bulk_upload/', formData);
      setSuccessMsg(res.detail || 'Course units imported successfully!');
      setShowCsvModal(false);
      setCsvFile(null);
      setCsvText('');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import course units.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleCourseUnits = async (format = 'xlsx') => {
    try {
      const tokensStr = localStorage.getItem('ciu_tokens');
      let token = '';
      if (tokensStr) {
        try { token = JSON.parse(tokensStr).access; } catch (e) {}
      }
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/course-units/sample_file/?format=${format}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'xlsx' ? 'sample_course_units.xlsx' : 'sample_course_units.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      downloadSampleCsv('curriculum');
    }
  };

  const downloadSampleCsv = (type = 'curriculum') => {
    let sample = '';
    let filename = '';
    if (type === 'curriculum') {
      sample = "Year,Semester,Course Code,Course Name,Credit Units\nYear 1,Semester 1,BML 1101-T,ENGLISH LANGUAGE AND SCIENTIFIC WRITING,3\nYear 1,Semester 1,BML 1102-T,HUMAN ANATOMY I,3\nYear 1,Semester 1,BML 1103-T,MEDICAL PHYSIOLOGY I,3\nYear 1,Semester 1,BML 1104-T,MEDICAL BIOCHEMISTRY I,4";
      filename = "sample_curriculum_units.csv";
    } else {
      sample = "code,name,credit_units,course_code\nBIT2104,Cloud Infrastructure Systems,4,BIT2026\nBIT2105,Cybersecurity & Cryptography Principles,3,BIT2026\nBSE2203,DevOps & Continuous Integration,4,BSE2026\nBSN1103,Pharmacology & Medical Admin,4,BSN2026";
      filename = "sample_course_units.csv";
    }
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleUploadStudentCsv = async (e) => {
    e.preventDefault();
    if (!studentCsvFile && !studentCsvText.trim()) {
      setErrorMsg('Please select a CSV file or paste raw CSV text.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (studentCsvFile) {
        formData.append('file', studentCsvFile);
      } else {
        formData.append('csv_text', studentCsvText);
      }
      const res = await api.post('/admin/users/bulk_allocate_csv/', formData);
      setSuccessMsg(res.detail || `Allocations processed successfully! ${res.updated || 0} student(s) updated.`);
      setShowStudentCsvModal(false);
      setStudentCsvFile(null);
      setStudentCsvText('');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process bulk student allocations.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleStudentCsv = () => {
    const sample = "username,registration_number,faculty_code,course_code,year_of_study,semester\nstd_albert,2026BACTFT-A001,FST,BIT2026,2,1\nstd_brenda,2026BACTFT-A002,FST,BSE2026,1,2\nstd_charles,2026BACTFT-A003,FBMS,BML2026,3,1\nstd_diana,2026BACTFT-A004,FBMS,BML2026,2,2";
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_student_allocations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // --- Faculty CRUD Handlers (Admin) ---
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
      const payload = {
        name: facultyFormData.name,
        code: facultyFormData.code,
        description: facultyFormData.description,
        dean: facultyFormData.dean ? parseInt(facultyFormData.dean) : null,
        secretary: facultyFormData.secretary ? parseInt(facultyFormData.secretary) : null
      };

      if (editingFaculty) {
        await api.patch(`/faculties/${editingFaculty.id}/`, payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} updated successfully!`);
      } else {
        await api.post('/faculties/', payload);
        setSuccessMsg(`Faculty ${facultyFormData.code} created successfully!`);
      }
      setShowFacultyModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save faculty details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaculty = (facultyId, facultyCode) => {
    showConfirm({
      title: 'Delete Faculty Department',
      description: (
        <span>
          Are you sure you want to permanently delete Faculty <strong className="text-slate-900 font-bold">{facultyCode}</strong>? This will remove all associated faculty records.
        </span>
      ),
      confirmText: `Delete Faculty ${facultyCode}`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await api.delete(`/faculties/${facultyId}/`);
          setSuccessMsg(`Faculty ${facultyCode} deleted successfully.`);
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete faculty.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleAssignDeanAction = async (facultyId, deanId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_dean/`, {
        dean_id: deanId ? parseInt(deanId) : null
      });
      setSuccessMsg(res.detail || 'Dean assignment updated.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Dean assignment.');
    }
  };

  const handleAssignSecretaryAction = async (facultyId, secretaryId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/faculties/${facultyId}/assign_secretary/`, {
        secretary_id: secretaryId ? parseInt(secretaryId) : null
      });
      setSuccessMsg(res.detail || 'Faculty Secretary assignment updated.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update Faculty Secretary assignment.');
    }
  };

  // --- Course CRUD Handlers ---
  const handleOpenCourseModal = (crs = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (crs) {
      setEditingCourse(crs);
      setCourseFormData({
        faculty: crs.faculty || (faculties[0]?.id || ''),
        name: crs.name,
        code: crs.code,
        description: crs.description || '',
        department: crs.department || '',
        duration_years: crs.duration_years || 3
      });
    } else {
      setEditingCourse(null);
      setCourseFormData({
        faculty: faculties[0]?.id || '',
        name: '',
        code: '',
        description: '',
        department: '',
        duration_years: 3
      });
    }
    setShowCourseModal(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseFormData.name || !courseFormData.code || !courseFormData.faculty) {
      setErrorMsg('Faculty, Course Name, and Course Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        faculty: parseInt(courseFormData.faculty),
        name: courseFormData.name,
        code: courseFormData.code,
        description: courseFormData.description,
        department: courseFormData.department,
        duration_years: parseInt(courseFormData.duration_years || 3)
      };

      if (editingCourse) {
        await api.patch(`/courses/${editingCourse.id}/`, payload);
        setSuccessMsg(`Course ${courseFormData.code} updated successfully!`);
      } else {
        await api.post('/courses/', payload);
        setSuccessMsg(`Course ${courseFormData.code} created successfully!`);
      }
      setShowCourseModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save course details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = (courseId, courseCode) => {
    showConfirm({
      title: 'Delete Degree Course',
      description: (
        <span>
          Are you sure you want to permanently delete Course <strong className="text-slate-900 font-bold">{courseCode}</strong>? This will also remove all linked course units.
        </span>
      ),
      confirmText: `Delete Course ${courseCode}`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await api.delete(`/courses/${courseId}/`);
          setSuccessMsg(`Course ${courseCode} deleted successfully.`);
          setSelectedCourseIds(prev => prev.filter(id => id !== courseId));
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete course.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleToggleSelectCourse = (courseId) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const handleToggleSelectAllCourses = () => {
    if (selectedCourseIds.length >= courses.length && courses.length > 0) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(courses.map(c => c.id));
    }
  };

  const filteredCourses = courses.filter(c => {
    if (isStudent) {
      const studentFacCode = user?.faculty_code;
      const studentFacId = user?.faculty;
      if (studentFacCode && c.faculty_code && c.faculty_code !== studentFacCode) return false;
      if (studentFacId && c.faculty && String(c.faculty) !== String(studentFacId)) return false;
      const assignedIds = user?.assigned_courses || [];
      const assignedCodes = user?.assigned_course_codes || [];
      if (assignedIds.length > 0 || assignedCodes.length > 0) {
        if (!assignedIds.includes(c.id) && !assignedCodes.includes(c.code)) return false;
      }
    }
    if (courseFacultyFilter !== 'All') {
      const targetFac = faculties.find(f => String(f.id) === String(courseFacultyFilter) || f.code === courseFacultyFilter);
      if (targetFac) {
        if (c.faculty !== targetFac.id && c.faculty_code !== targetFac.code) return false;
      } else if (String(c.faculty) !== String(courseFacultyFilter) && c.faculty_code !== courseFacultyFilter) {
        return false;
      }
    }
    if (courseSearchName.trim()) {
      const q = courseSearchName.toLowerCase().trim();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchCode = c.code?.toLowerCase().includes(q);
      const matchDept = c.department?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDept) return false;
    }
    return true;
  });

  const handleToggleSelectAllFilteredCourses = () => {
    const targetIds = filteredCourses.map(c => c.id);
    if (targetIds.length > 0 && targetIds.every(id => selectedCourseIds.includes(id))) {
      setSelectedCourseIds(prev => prev.filter(id => !targetIds.includes(id)));
    } else {
      setSelectedCourseIds(prev => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  const handleToggleSelectAllFacCourses = (facId) => {
    const facCourses = courses.filter(c => c.faculty === facId);
    const facCourseIds = facCourses.map(c => c.id);
    const allFacSelected = facCourseIds.length > 0 && facCourseIds.every(id => selectedCourseIds.includes(id));
    if (allFacSelected) {
      setSelectedCourseIds(prev => prev.filter(id => !facCourseIds.includes(id)));
    } else {
      setSelectedCourseIds(prev => Array.from(new Set([...prev, ...facCourseIds])));
    }
  };

  const handleBulkDeleteCourses = () => {
    if (selectedCourseIds.length === 0) return;
    const count = selectedCourseIds.length;
    showConfirm({
      title: 'Bulk Delete Degree Courses',
      description: (
        <span>
          Are you sure you want to permanently delete <strong className="text-red-700 font-bold">{count}</strong> selected course(s)?
          <br />
          <span className="text-xs text-red-600 block mt-2 font-medium">
            ⚠️ Warning: This action cannot be reversed. Associated course units, class timetables, and assessments will also be permanently deleted.
          </span>
        </span>
      ),
      confirmText: `Delete ${count} Course(s)`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await api.post('/courses/bulk_delete/', {
            course_ids: selectedCourseIds
          });
          setSuccessMsg(res?.detail || `Successfully deleted ${count} selected course(s).`);
          setSelectedCourseIds([]);
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete selected courses.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleBulkDeleteFacultyCourses = (fac) => {
    const facCourses = courses.filter(c => c.faculty === fac.id);
    if (facCourses.length === 0) return;
    const count = facCourses.length;
    showConfirm({
      title: `Bulk Delete Courses in ${fac.code}`,
      description: (
        <span>
          Are you sure you want to permanently delete all <strong className="text-red-700 font-bold">{count}</strong> course(s) under <strong className="text-slate-800">{fac.name} ({fac.code})</strong>?
          <br />
          <span className="text-xs text-red-600 block mt-2 font-medium">
            ⚠️ Warning: This will permanently remove all associated course units, timetables, and assessments.
          </span>
        </span>
      ),
      confirmText: `Delete ${count} Course(s)`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await api.post('/courses/bulk_delete/', {
            faculty_id: fac.id
          });
          setSuccessMsg(res?.detail || `Successfully deleted courses for ${fac.code}.`);
          setSelectedCourseIds(prev => prev.filter(id => !facCourses.map(c => c.id).includes(id)));
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete faculty courses.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // --- Course Units Review & Attachment Handlers ---
  const handleOpenReviewUnitsModal = async (course) => {
    setSelectedReviewCourse(course);
    setReviewSearchTerm('');
    setReviewYearFilter('All');
    setAttachExistingUnitId('');
    setShowInlineAddUnit(false);
    setShowUnitsReviewModal(true);
    setLoadingReviewUnits(true);
    try {
      const units = await api.get(`/courses/${course.id}/units/`);
      setReviewUnitsList(units || []);
    } catch {
      const fallback = courseUnits.filter(u => u.course === course.id || u.course_code === course.code);
      setReviewUnitsList(fallback);
    } finally {
      setLoadingReviewUnits(false);
    }
  };

  const handleAttachExistingUnit = async () => {
    if (!attachExistingUnitId || !selectedReviewCourse) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await api.post(`/courses/${selectedReviewCourse.id}/attach_units/`, {
        unit_ids: [parseInt(attachExistingUnitId)]
      });
      setSuccessMsg(res?.detail || 'Course unit attached successfully.');
      setAttachExistingUnitId('');
      const updatedUnits = await api.get(`/courses/${selectedReviewCourse.id}/units/`).catch(() => null);
      if (updatedUnits) setReviewUnitsList(updatedUnits);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to attach unit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndAttachUnit = async (e) => {
    e.preventDefault();
    if (!newUnitInlineData.code || !newUnitInlineData.name || !selectedReviewCourse) return;
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await api.post(`/courses/${selectedReviewCourse.id}/attach_units/`, {
        code: newUnitInlineData.code,
        name: newUnitInlineData.name,
        credit_units: newUnitInlineData.credit_units,
        year_of_study: newUnitInlineData.year_of_study,
        semester: newUnitInlineData.semester || 1
      });
      setSuccessMsg(res?.detail || 'New unit created and attached.');
      setNewUnitInlineData({ code: '', name: '', credit_units: 3, year_of_study: 1, semester: 1 });
      setShowInlineAddUnit(false);
      const updatedUnits = await api.get(`/courses/${selectedReviewCourse.id}/units/`).catch(() => null);
      if (updatedUnits) setReviewUnitsList(updatedUnits);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to create unit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetachUnitFromCourse = (unit) => {
    if (!selectedReviewCourse) return;
    showConfirm({
      title: 'Detach / Remove Unit',
      description: (
        <span>
          Are you sure you want to detach unit <strong className="text-red-700 font-bold">[{unit.code}] {unit.name}</strong> from <strong>{selectedReviewCourse.code}</strong>?
        </span>
      ),
      confirmText: 'Detach Unit',
      variant: 'danger',
      icon: '✂️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.post(`/courses/${selectedReviewCourse.id}/attach_units/`, {
            action: 'detach',
            unit_ids: [unit.id]
          });
          setSuccessMsg(`Detached unit ${unit.code} successfully.`);
          const updatedUnits = await api.get(`/courses/${selectedReviewCourse.id}/units/`).catch(() => null);
          if (updatedUnits) setReviewUnitsList(updatedUnits);
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to detach unit.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // --- Course Unit CRUD Handlers ---
  const handleOpenCourseUnitModal = (unit = null) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (unit && user?.role !== 'admin') {
      setErrorMsg('Permission Denied: Course unit edits can only be performed by the System Administrator.');
      return;
    }
    if (unit) {
      setEditingCourseUnit(unit);
      setUnitFormData({
        course: unit.course || (courses[0]?.id || ''),
        name: unit.name,
        code: unit.code,
        credit_units: unit.credit_units || 3,
        year_of_study: unit.year_of_study || 1,
        semester: unit.semester || 1,
        lecturers: unit.lecturers || (unit.lecturer_details ? unit.lecturer_details.map(l => l.id) : [])
      });
    } else {
      setEditingCourseUnit(null);
      setUnitFormData({
        course: courses[0]?.id || '',
        name: '',
        code: '',
        credit_units: 3,
        year_of_study: 1,
        semester: 1,
        lecturers: []
      });
    }
    setShowCourseUnitModal(true);
  };

  const handleSaveCourseUnit = async (e) => {
    e.preventDefault();
    if (editingCourseUnit && user?.role !== 'admin') {
      setErrorMsg('Permission Denied: Course unit edits can only be performed by the System Administrator.');
      return;
    }
    if (!unitFormData.name || !unitFormData.code || !unitFormData.course) {
      setErrorMsg('Target Course, Unit Name, and Unit Code are required.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        course: parseInt(unitFormData.course),
        name: unitFormData.name,
        code: unitFormData.code,
        credit_units: parseInt(unitFormData.credit_units || 3),
        year_of_study: parseInt(unitFormData.year_of_study || 1),
        semester: parseInt(unitFormData.semester || 1),
        lecturers: unitFormData.lecturers ? unitFormData.lecturers.map(id => parseInt(id)) : []
      };

      if (editingCourseUnit) {
        await api.patch(`/course-units/${editingCourseUnit.id}/`, payload);
        setSuccessMsg(`Course Unit ${unitFormData.code} updated successfully!`);
      } else {
        await api.post('/course-units/', payload);
        setSuccessMsg(`Course Unit ${unitFormData.code} created successfully!`);
      }
      setShowCourseUnitModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save course unit details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourseUnit = (unitId, unitCode) => {
    if (user?.role !== 'admin') {
      setErrorMsg('Permission Denied: Course unit deletion can only be performed by the System Administrator.');
      return;
    }
    showConfirm({
      title: 'Delete Course Unit',
      description: (
        <span>
          Are you sure you want to permanently delete Course Unit <strong className="text-slate-900 font-bold">{unitCode}</strong>?
        </span>
      ),
      confirmText: `Delete Unit ${unitCode}`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          await api.delete(`/course-units/${unitId}/`);
          setSuccessMsg(`Course Unit ${unitCode} deleted successfully.`);
          setSelectedUnitIds(prev => prev.filter(id => id !== unitId));
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete course unit.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleToggleSelectUnit = (unitId) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const handleToggleSelectAllFilteredUnits = (unitsToToggle = filteredCourseUnits) => {
    const targetList = Array.isArray(unitsToToggle) && unitsToToggle.length > 0 ? unitsToToggle : filteredCourseUnits;
    const targetIds = targetList.map(u => u.id);
    const allSelected = targetIds.length > 0 && targetIds.every(id => selectedUnitIds.includes(id));
    if (allSelected) {
      setSelectedUnitIds(prev => prev.filter(id => !targetIds.includes(id)));
    } else {
      setSelectedUnitIds(prev => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  const handleBulkDeleteCourseUnits = () => {
    if (user?.role !== 'admin') {
      setErrorMsg('Permission Denied: Bulk course unit deletion can only be performed by the System Administrator.');
      return;
    }
    if (selectedUnitIds.length === 0) return;
    const count = selectedUnitIds.length;
    showConfirm({
      title: 'Bulk Delete Course Units',
      description: (
        <span>
          Are you sure you want to permanently delete <strong className="text-red-700 font-bold">{count}</strong> selected course unit(s)?
          <br />
          <span className="text-xs text-red-600 block mt-2 font-medium">
            ⚠️ Warning: This action cannot be reversed. Linked lecturer allocations, timetable records, and assessment questions will also be permanently removed.
          </span>
        </span>
      ),
      confirmText: `Delete ${count} Course Unit(s)`,
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await api.post('/course-units/bulk_delete/', {
            unit_ids: selectedUnitIds
          });
          setSuccessMsg(res?.detail || `Successfully deleted ${count} selected course unit(s).`);
          setSelectedUnitIds([]);
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete selected course units.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  const handleBulkAssignLecturer = async (actionType = 'assign') => {
    if (!bulkSelectedLecturerId) {
      setErrorMsg('Please select a lecturer to bulk assign the selected course units.');
      return;
    }
    if (selectedUnitIds.length === 0) {
      setErrorMsg('Please select at least one course unit.');
      return;
    }
    setBulkAssigning(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/course-units/bulk_assign_lecturer/', {
        unit_ids: selectedUnitIds,
        lecturer_id: bulkSelectedLecturerId,
        action: actionType
      });
      setSuccessMsg(res?.detail || 'Successfully updated lecturer allocations!');
      setSelectedUnitIds([]);
      setBulkSelectedLecturerId('');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to bulk assign course units to lecturer.');
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleConsoleAssignSelected = async (actionType = 'assign') => {
    if (!consoleSelectedLecturerId) {
      setErrorMsg('Please select a lecturer from the search list.');
      return;
    }
    if (consoleSelectedUnitIds.length === 0) {
      setErrorMsg('Please select at least one course unit to assign.');
      return;
    }
    setConsoleAssigning(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post('/course-units/bulk_assign_lecturer/', {
        unit_ids: consoleSelectedUnitIds,
        lecturer_id: parseInt(consoleSelectedLecturerId),
        action: actionType
      });
      setSuccessMsg(res?.detail || `Successfully ${actionType === 'assign' ? 'assigned' : 'unassigned'} course units!`);
      setConsoleSelectedUnitIds([]);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to update course unit assignments.');
    } finally {
      setConsoleAssigning(false);
    }
  };

  const handleConsoleSingleUnitAssign = async (unitId, actionType = 'assign') => {
    if (!consoleSelectedLecturerId) {
      setErrorMsg('Please select a lecturer first.');
      return;
    }
    setConsoleAssigning(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/course-units/${unitId}/assign_lecturer/`, {
        lecturer_id: parseInt(consoleSelectedLecturerId),
        action: actionType
      });
      setSuccessMsg(res?.detail || `Successfully ${actionType === 'assign' ? 'assigned' : 'unassigned'} course unit!`);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to update unit assignment.');
    } finally {
      setConsoleAssigning(false);
    }
  };

  // --- Lecturer Assignment & Timetable Handlers ---
  const handleAssignLecturer = async (e) => {
    e.preventDefault();
    if (!selectedUnit || !selectedLecturerId) {
      setErrorMsg('Please select a course unit and a lecturer.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await api.post(`/course-units/${selectedUnit.id}/assign_lecturer/`, {
        lecturer_id: parseInt(selectedLecturerId),
        action: 'assign'
      });
      setSuccessMsg(res.detail || 'Lecturer assigned successfully!');
      setSelectedUnit(null);
      setSelectedLecturerId('');
      setShowAssignModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign lecturer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignLecturer = async (unitId, lecturerId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/course-units/${unitId}/assign_lecturer/`, {
        lecturer_id: parseInt(lecturerId),
        action: 'unassign'
      });
      setSuccessMsg(res.detail || 'Lecturer unassigned.');
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to unassign lecturer.');
    }
  };

  const handleCreateTimetable = async (e) => {
    e.preventDefault();
    if (!ttFormData.faculty || !ttFormData.course || !ttFormData.lecturer) {
      setErrorMsg('Faculty, Course, and Lecturer are required for timetabling.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        faculty: parseInt(ttFormData.faculty),
        course: parseInt(ttFormData.course),
        course_unit: ttFormData.course_unit ? parseInt(ttFormData.course_unit) : null,
        lecturer: parseInt(ttFormData.lecturer),
        class_date: ttFormData.class_date || null,
        day_of_week: ttFormData.day_of_week,
        start_time: ttFormData.start_time.length === 5 ? `${ttFormData.start_time}:00` : ttFormData.start_time,
        end_time: ttFormData.end_time.length === 5 ? `${ttFormData.end_time}:00` : ttFormData.end_time,
        room: ttFormData.room,
        class_type: ttFormData.class_type
      };

      await api.post('/class-timetables/', payload);
      setSuccessMsg('Class timetable slot published successfully!');
      setShowTimetableModal(false);
      loadFacultyData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create class timetable slot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTimetable = (id) => {
    showConfirm({
      title: 'Delete Class Timetable Slot',
      description: 'Are you sure you want to delete this timetable entry? This schedule entry will be removed permanently.',
      confirmText: 'Delete Slot',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete(`/class-timetables/${id}/`);
          setSuccessMsg('Class timetable slot removed.');
          closeConfirm();
          loadFacultyData();
        } catch (err) {
          setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete timetable slot.');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      }
    });
  };

  // Filter timetables according to day filter and course filter
  const filteredTimetables = classTimetables.filter(tt => {
    if (selectedDayFilter !== 'All' && tt.day_of_week !== selectedDayFilter) return false;
    if (selectedCourseFilter !== 'All' && tt.course_code !== selectedCourseFilter) return false;
    if (isStudent) {
      if (user?.faculty_code && tt.faculty_code && tt.faculty_code !== user.faculty_code) return false;
      const assignedCodes = user?.assigned_course_codes || [];
      if (assignedCodes.length > 0 && !assignedCodes.includes(tt.course_code)) return false;
    }
    if (isLecturer) {
      if (user?.faculty_code && tt.faculty_code && tt.faculty_code !== user.faculty_code && !tt.lecturer_name?.includes(user.username)) return false;
    }
    return true;
  });

  // Students & Lecturers ONLY see their designated faculty & leadership
  const visibleFaculties = (isStudent || isLecturer)
    ? faculties.filter(fac => {
        if (user?.faculty && (fac.id === user.faculty || String(fac.id) === String(user.faculty))) return true;
        if (user?.faculty_code && fac.code === user.faculty_code) return true;
        if (user?.faculty_name && fac.name === user.faculty_name) return true;
        if (isLecturer) {
          if (Array.isArray(user?.assigned_faculties) && user.assigned_faculties.some(f => f === fac.id || f?.id === fac.id)) return true;
          if (Array.isArray(user?.assigned_faculty_details) && user.assigned_faculty_details.some(f => f.id === fac.id || f.code === fac.code)) return true;
          if (courses.some(c => (c.faculty === fac.id || c.faculty_code === fac.code)) || courseUnits.some(u => (u.faculty_id === fac.id || u.faculty_code === fac.code))) return true;
        }
        return false;
      })
    : faculties;

  // Filter course units according to faculty, year filter, program filter, lecturer filter, and search text
  const filteredCourseUnits = courseUnits.filter(u => {
    if (isStudent) {
      const studentFacCode = user?.faculty_code;
      if (studentFacCode && u.faculty_code && u.faculty_code !== studentFacCode) return false;
      const assignedCodes = user?.assigned_course_codes || [];
      const assignedIds = user?.assigned_courses || [];
      if (assignedCodes.length > 0 || assignedIds.length > 0) {
        const matchesUnit = assignedCodes.includes(u.course_code) || assignedIds.includes(u.course);
        if (!matchesUnit) return false;
      }
    }
    if (isLecturer) {
      const assignedFacCodes = [
        user?.faculty_code,
        ...(Array.isArray(user?.assigned_faculty_details) ? user.assigned_faculty_details.map(f => f.code) : [])
      ].filter(Boolean);
      const isAssignedUnit = u.lecturer_details?.some(l => l.id === user.id) || u.lecturers?.includes(user.id);
      if (assignedFacCodes.length > 0 && u.faculty_code && !assignedFacCodes.includes(u.faculty_code) && !isAssignedUnit) return false;
    }
    const matchesFaculty = selectedUnitFacultyFilter === 'All' ||
      u.faculty_code === selectedUnitFacultyFilter ||
      String(u.faculty_id) === String(selectedUnitFacultyFilter) ||
      courses.some(c => (c.id === u.course || c.code === u.course_code) && (String(c.faculty) === String(selectedUnitFacultyFilter) || c.faculty_code === selectedUnitFacultyFilter));
    const matchesYear = selectedUnitYearFilter === 'All' || (u.year_of_study || 1) === parseInt(selectedUnitYearFilter);
    const matchesSemester = selectedUnitSemesterFilter === 'All' || (u.semester || 1) === parseInt(selectedUnitSemesterFilter);
    const matchesCourse = selectedUnitCourseFilter === 'All' || u.course_code === selectedUnitCourseFilter;
    const matchesLecturer = selectedUnitLecturerFilter === 'All' ||
      (u.lecturer_details && u.lecturer_details.some(l => String(l.id) === String(selectedUnitLecturerFilter) || l.username === selectedUnitLecturerFilter));
    const s = unitSearchText.toLowerCase().trim();
    const matchesSearch = !s ||
      (u.code && u.code.toLowerCase().includes(s)) ||
      (u.name && u.name.toLowerCase().includes(s)) ||
      (u.course_code && u.course_code.toLowerCase().includes(s)) ||
      (u.lecturer_details && u.lecturer_details.some(l =>
        (l.first_name && l.first_name.toLowerCase().includes(s)) ||
        (l.last_name && l.last_name.toLowerCase().includes(s)) ||
        (l.username && l.username.toLowerCase().includes(s))
      ));
    return matchesFaculty && matchesYear && matchesSemester && matchesCourse && matchesLecturer && matchesSearch;
  });

  const filteredReviewUnits = (reviewUnitsList || []).filter(u => {
    const s = reviewSearchTerm.toLowerCase().trim();
    const matchesSearch = !s ||
      (u.code && u.code.toLowerCase().includes(s)) ||
      (u.name && u.name.toLowerCase().includes(s));
    const matchesYear = reviewYearFilter === 'All' || String(u.year_of_study || 1) === String(reviewYearFilter);
    return matchesSearch && matchesYear;
  });

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
          <h2 className="text-xl font-bold text-slate-850">
            {isStudent ? 'My Course Class Timetable' : 'Faculty & Class Timetabling Portal'}
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            {isStudent ? 'Weekly schedule for your designated course program.' : 'Faculty Administration, Course assignments, Leadership allocation, and timetable management.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSecretaryOrStaff && (
            <button
              onClick={() => setShowCsvModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              📤 Upload CSV Units Package
            </button>
          )}
          {isSecretaryOrStaff && (
            <button
              onClick={() => handleOpenCourseModal(null)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
            >
              <span>🎓 Add Course</span>
            </button>
          )}
          {isSecretaryOrStaff && (
            <button
              onClick={() => handleOpenCourseUnitModal(null)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1"
            >
              <span>📚 Add Course Unit</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleOpenFacultyModal(null)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create New Faculty
            </button>
          )}
          {isSecretaryOrStaff && (
            <button
              onClick={() => setShowTimetableModal(true)}
              className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create Class Timetable Slot
            </button>
          )}
          <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs text-indigo-800 font-bold uppercase">
            {user.role === 'faculty_admin' ? 'Faculty Secretary' : user.role.replace('_', ' ')}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded-xl text-red-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <div className="flex items-center space-x-2">
            <span>⚠️ {errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-900 font-bold text-xs">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between shadow-sm animate-slide-up">
          <div className="flex items-center space-x-2">
            <span>✅ {successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('timetables')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'timetables' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📅 Class Timetables ({filteredTimetables.length})
        </button>
        <button
          onClick={() => setActiveTab('faculties')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'faculties' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          🏛️ {(isStudent || isLecturer) ? 'My Faculty & Leadership' : 'Faculties & Leadership'} ({visibleFaculties.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'assignments' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          👨‍🏫 Course Units & Lecturers ({courseUnits.length})
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'courses' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          📚 Courses by Faculty ({courses.length})
        </button>
        {isSecretaryOrStaff && (
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'students' ? 'border-brand-light text-brand-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            🎓 Student Allocations ({students.length})
          </button>
        )}
      </div>

      {/* TAB: COURSES BY FACULTY (HIGH-DENSITY LIST FORMAT WITH FILTERING, BULK ACTIONS, AND EXPAND/PREVIEW) */}
      {activeTab === 'courses' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Header Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center space-x-2">
                <span>Degree Programs & Courses Directory</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {filteredCourses.length} Programs
                </span>
              </h3>
              <p className="text-slate-500 text-xs font-medium">
                Comprehensive list view of academic programs with faculty filtering, bulk actions, and expandable unit curriculum previews.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {canBulkManage && filteredCourses.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllFilteredCourses}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Select or deselect all courses matching current filters"
                >
                  <span>
                    {filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.id))
                      ? '✕ Deselect Filtered'
                      : `☑️ Select Filtered (${filteredCourses.length})`}
                  </span>
                </button>
              )}
              {isSecretaryOrStaff && (
                <button
                  onClick={() => {
                    setEditingCourse(null);
                    setCourseFormData({
                      faculty: faculties[0]?.id || '',
                      name: '',
                      code: '',
                      description: '',
                      department: '',
                      duration_years: 3
                    });
                    setShowCourseModal(true);
                  }}
                  className="px-4 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <span>➕ Add New Course</span>
                </button>
              )}
            </div>
          </div>

          {/* Sticky Bulk Action Bar for Courses */}
          {canBulkManage && selectedCourseIds.length > 0 && (
            <div className="sticky top-2 z-20 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-3.5 rounded-2xl shadow-xl border border-red-500/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold shadow-inner">
                  📚
                </span>
                <div>
                  <p className="text-xs font-black tracking-wide uppercase">
                    {selectedCourseIds.length} Course{selectedCourseIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-red-100 font-medium">
                    Ready for bulk administrative deletion. Linked course units, timetables, and assessments will also be removed.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds([])}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteCourses}
                  className="px-4 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-black shadow-md hover:shadow transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>🗑️ Delete Selected Courses ({selectedCourseIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Filter Toolbar: Filter Courses by Faculty Using Course Names */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto flex-1">
              {/* Faculty Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Filter by Faculty {(isStudent || isLecturer) && (user?.faculty || user?.faculty_code) && <span className="text-amber-700 font-bold text-[10px]">🔒 Locked</span>}
                </label>
                <select
                  value={(isStudent || isLecturer) && (user?.faculty || user?.faculty_code) ? (user.faculty || user.faculty_code) : courseFacultyFilter}
                  disabled={(isStudent || isLecturer) && Boolean(user?.faculty || user?.faculty_code)}
                  onChange={(e) => setCourseFacultyFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-light disabled:opacity-85"
                >
                  <option value="All">🏛️ All Faculties ({faculties.length})</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.code}] {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Name Search Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Filter Course Name / Code</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by course name, code, or department..."
                    value={courseSearchName}
                    onChange={(e) => setCourseSearchName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-1 focus:ring-brand-light"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end pt-2 md:pt-4">
              {(courseFacultyFilter !== 'All' || courseSearchName) && (
                <button
                  type="button"
                  onClick={() => {
                    setCourseFacultyFilter('All');
                    setCourseSearchName('');
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  ✕ Clear Filters
                </button>
              )}
              <span className="text-[11px] font-semibold text-slate-500">
                Showing <strong className="text-slate-800">{filteredCourses.length}</strong> of {courses.length} courses
              </span>
            </div>
          </div>

          {/* Courses High-Density List Table */}
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
              <span className="text-3xl block">📚</span>
              <p className="text-slate-700 font-bold text-sm">No courses matching your criteria</p>
              <p className="text-slate-500 text-xs">Try selecting a different faculty or adjusting your course name search filter.</p>
              {(courseFacultyFilter !== 'All' || courseSearchName) && (
                <button
                  type="button"
                  onClick={() => { setCourseFacultyFilter('All'); setCourseSearchName(''); }}
                  className="mt-2 px-4 py-1.5 bg-brand-light text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      {canBulkManage && (
                        <th className="px-3 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.id))}
                            onChange={handleToggleSelectAllFilteredCourses}
                            className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                            title="Select / deselect all filtered courses"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">Course Code & Name</th>
                      <th className="px-3 py-3">Faculty</th>
                      <th className="px-3 py-3">Duration & Dept</th>
                      <th className="px-3 py-3 text-center">Curriculum Units</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCourses.map((c) => {
                      const isSelected = selectedCourseIds.includes(c.id);
                      const isExpanded = expandedCourseIds.includes(c.id);
                      const fac = faculties.find(f => f.id === c.faculty || f.code === c.faculty_code);
                      const attachedUnits = courseUnits.filter(u => u.course === c.id || u.course_code === c.code);
                      const unitsCount = c.units_count || attachedUnits.length;

                      return (
                        <Fragment key={c.id}>
                          <tr
                            className={`transition-all ${
                              isSelected
                                ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-l-red-500'
                                : isExpanded
                                ? 'bg-emerald-50/30 border-l-4 border-l-brand-light'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {canBulkManage && (
                              <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectCourse(c.id)}
                                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                                  title={`Select ${c.code}`}
                                />
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 bg-brand-light/10 text-brand-dark font-mono font-black text-xs rounded border border-brand-light/20 shrink-0">
                                  {c.code}
                                </span>
                                <div>
                                  <span className="font-extrabold text-slate-900 block leading-tight">{c.name}</span>
                                  {c.description && (
                                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{c.description}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200">
                                {fac?.code || c.faculty_code || 'Faculty'}
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[150px]">
                                {fac?.name || ''}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-700">
                              <div className="flex items-center space-x-1.5">
                                <span className="px-1.5 py-0.2 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10px] font-bold">
                                  ⏱️ {c.duration_years || 3} Yrs
                                </span>
                                {c.department && (
                                  <span className="text-[11px] text-slate-600 truncate max-w-[120px]">{c.department}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenReviewUnitsModal(c)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-lg border border-emerald-200 transition-all inline-flex items-center space-x-1 cursor-pointer"
                                title="Review attached course units"
                              >
                                <span>📚 {unitsCount} Units</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandCourse(c.id)}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center space-x-1 ${
                                    isExpanded
                                      ? 'bg-brand-dark text-white border-brand-dark shadow-xs'
                                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                  title="Expand preview of course units and details"
                                >
                                  <span>{isExpanded ? '▲ Hide' : '🔍 Preview'}</span>
                                </button>
                                {isSecretaryOrStaff && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCourse(c);
                                        setCourseFormData({
                                          faculty: c.faculty || fac?.id || '',
                                          name: c.name,
                                          code: c.code,
                                          description: c.description || '',
                                          department: c.department || '',
                                          duration_years: c.duration_years || 3
                                        });
                                        setShowCourseModal(true);
                                      }}
                                      className="px-2 py-1 bg-white hover:bg-emerald-50 text-brand-medium font-bold text-xs rounded-lg border border-emerald-200 transition-all cursor-pointer"
                                      title="Edit course program"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCourse(c.id, c.code)}
                                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-lg border border-red-200 transition-all cursor-pointer"
                                      title="Delete course program"
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
                              <td colSpan={canBulkManage ? 6 : 5} className="px-6 py-4">
                                <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-3 text-xs">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
                                    <div className="space-y-0.5">
                                      <h5 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                                        <span>Curriculum Units Preview: {c.name} ({c.code})</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                          {attachedUnits.length} Units Attached
                                        </span>
                                      </h5>
                                      <p className="text-slate-500 text-[11px]">
                                        {c.description || 'No detailed course description provided.'}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReviewUnitsModal(c)}
                                      className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl text-xs transition-all shadow-2xs flex items-center space-x-1 cursor-pointer shrink-0"
                                    >
                                      <span>📖 Open Units Curriculum Manager</span>
                                    </button>
                                  </div>

                                  {attachedUnits.length === 0 ? (
                                    <div className="py-4 text-center text-slate-400 italic">
                                      No course units attached yet to this degree program. Click &apos;Open Units Curriculum Manager&apos; to link units.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                                          <tr>
                                            <th className="px-3 py-2">Unit Code</th>
                                            <th className="px-3 py-2">Unit Name</th>
                                            <th className="px-3 py-2 text-center">Year & Semester</th>
                                            <th className="px-3 py-2 text-center">Credit Units</th>
                                            <th className="px-3 py-2">Assigned Lecturer(s)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                          {attachedUnits.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                              <td className="px-3 py-2 font-mono font-bold text-brand-dark">{u.code}</td>
                                              <td className="px-3 py-2 font-bold text-slate-850">{u.name}</td>
                                              <td className="px-3 py-2 text-center">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                                  Year {u.year_of_study || 1} · Sem {u.semester || 1}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-center font-bold">{u.credit_units || 3} CU</td>
                                              <td className="px-3 py-2">
                                                {u.lecturer_details && u.lecturer_details.length > 0 ? (
                                                  <div className="flex flex-wrap gap-1">
                                                    {u.lecturer_details.map(l => (
                                                      <span key={l.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                        👨‍🏫 {l.first_name || l.username} {l.last_name}
                                                      </span>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
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
      )}

      {/* TAB 1: CLASS TIMETABLES */}
      {activeTab === 'timetables' && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Day:</span>
                {['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(day)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${selectedDayFilter === day ? 'bg-brand-dark text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Course Program Filter Dropdown */}
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Course Program:</span>
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="All">All Course Programs</option>
                  {(isStudent
                    ? courses.filter(c => (user?.assigned_courses || []).includes(c.id) || (user?.assigned_course_codes || []).includes(c.code) || (!user?.assigned_courses?.length && (c.faculty === user?.faculty || c.faculty_code === user?.faculty_code)))
                    : isLecturer
                    ? courses.filter(c => courseUnits.some(u => u.course_code === c.code && u.lecturer_details?.some(l => l.id === user.id)) || (user?.faculty && (c.faculty === user.faculty || c.faculty_code === user.faculty_code)))
                    : courses
                  ).map(c => (
                    <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredTimetables.length}</span> schedule entries
            </div>
          </div>

          {/* Timetable Cards / Grid */}
          {filteredTimetables.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm font-medium">No class timetables scheduled for this day or course selection.</p>
              {isSecretaryOrStaff && (
                <button
                  onClick={() => setShowTimetableModal(true)}
                  className="mt-4 px-4 py-2 bg-brand-light text-white text-xs font-bold rounded-xl"
                >
                  + Add First Schedule Entry
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTimetables.map((tt) => (
                <div key={tt.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-emerald/10 text-brand-dark border border-brand-emerald/20">
                        {tt.class_date ? `${tt.class_date} (${tt.day_of_week})` : tt.day_of_week}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {tt.class_type}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-850 text-base leading-tight">{tt.course_code}: {tt.course_name}</h4>
                    {tt.course_unit_name && (
                      <p className="text-xs text-brand-medium font-semibold pt-1">Unit: {tt.course_unit_name}</p>
                    )}

                    <div className="pt-3 space-y-1 text-xs text-slate-600 font-medium">
                      <p className="flex items-center space-x-1.5">
                        <span>⏰ Time:</span>
                        <span className="font-bold text-slate-800">{tt.start_time} - {tt.end_time}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>📍 Room / Venue:</span>
                        <span className="font-bold text-slate-800">{tt.room}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>👨‍🏫 Lecturer:</span>
                        <span className="font-bold text-slate-800">{tt.lecturer_name || 'Assigned Lecturer'}</span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <span>🏛️ Faculty:</span>
                        <span className="font-bold text-slate-800">{tt.faculty_code}</span>
                      </p>
                    </div>
                  </div>

                  {isSecretaryOrStaff && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleDeleteTimetable(tt.id)}
                        className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Delete Slot
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: FACULTIES & LEADERSHIP */}
      {activeTab === 'faculties' && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="flex justify-between items-center bg-purple-50 p-4 rounded-2xl border border-purple-100">
              <div>
                <h3 className="font-bold text-purple-900 text-sm">System Admin Faculty Controls</h3>
                <p className="text-purple-700 text-xs">Create, update, and delete faculties or allocate Faculty Deans and Faculty Secretaries.</p>
              </div>
              <button
                onClick={() => handleOpenFacultyModal(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                + Create New Faculty
              </button>
            </div>
          )}

          {/* Sticky Bulk Action Bar for Courses in Faculties Tab */}
          {isAdmin && selectedCourseIds.length > 0 && (
            <div className="sticky top-2 z-20 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-3.5 rounded-2xl shadow-xl border border-red-500/50 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold shadow-inner">
                  📚
                </span>
                <div>
                  <p className="text-xs font-black tracking-wide uppercase">
                    {selectedCourseIds.length} Course{selectedCourseIds.length > 1 ? 's' : ''} Selected
                  </p>
                  <p className="text-[11px] text-red-100 font-medium">
                    Ready for bulk administrative deletion.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds([])}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20"
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteCourses}
                  className="px-4 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-black shadow-md hover:shadow transition-all flex items-center space-x-1.5"
                >
                  <span>🗑️ Delete Selected Courses ({selectedCourseIds.length})</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleFaculties.map((fac) => (
              <div key={fac.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-light/10 text-brand-dark border border-brand-light/20">
                      {fac.code}
                    </span>
                    {isAdmin && (
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
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-850 leading-tight">{fac.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{fac.description || 'No description provided.'}</p>
                  
                  {/* Leadership Info */}
                  <div className="pt-2 text-xs space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Dean</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.dean_name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Secretary</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-bold text-slate-800">{fac.secretary_name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Degree Courses in this Faculty */}
                  <div className="pt-2 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Degree Courses & Duration</span>
                      {isSecretaryOrStaff && (
                        <button
                          onClick={() => {
                            setEditingCourse(null);
                            setCourseFormData({
                              faculty: fac.id,
                              name: '',
                              code: '',
                              description: '',
                              department: '',
                              duration_years: 3
                            });
                            setShowCourseModal(true);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                        >
                          + Add Course
                        </button>
                      )}
                    </div>
                    {courses.filter(c => c.faculty === fac.id || c.faculty_code === fac.code).length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No courses added yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                        {courses.filter(c => c.faculty === fac.id || c.faculty_code === fac.code).map(c => {
                          const isSelected = selectedCourseIds.includes(c.id);
                          return (
                            <div key={c.id} className={`p-2 rounded-lg border flex items-center justify-between text-xs transition-all ${
                              isSelected ? 'bg-red-50/60 border-red-300 ring-1 ring-red-300' : 'bg-blue-50/50 border-blue-100'
                            }`}>
                              <div className="flex items-center space-x-2">
                                {isAdmin && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectCourse(c.id)}
                                    className="w-3.5 h-3.5 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                                    title={`Select ${c.code}`}
                                  />
                                )}
                                <div>
                                  <span className="font-bold text-slate-800">{c.code}</span> - <span className="text-slate-600">{c.name}</span>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">⏱️ {c.duration_years || 3} Years</span>
                                    <span>📚 {c.units_count || courseUnits.filter(u => u.course === c.id || u.course_code === c.code).length} Units</span>
                                  </div>
                                </div>
                              </div>
                              {isSecretaryOrStaff && (
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleOpenCourseModal(c)}
                                    className="text-[10px] text-slate-600 hover:text-blue-600 font-bold px-1"
                                    title="Edit course details"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCourse(c.id, c.code)}
                                    className="text-[10px] text-red-500 hover:text-red-700 font-bold px-1"
                                    title="Delete course"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Dean</label>
                        <select
                          value={fac.dean || ''}
                          onChange={(e) => handleAssignDeanAction(fac.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">-- Unassigned --</option>
                          {deans.map(d => (
                            <option key={d.id} value={d.id}>{d.first_name || d.username} {d.last_name} ({d.email})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Assign / Change Faculty Secretary</label>
                        <select
                          value={fac.secretary || ''}
                          onChange={(e) => handleAssignSecretaryAction(fac.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">-- Unassigned --</option>
                          {secretaries.map(s => (
                            <option key={s.id} value={s.id}>{s.first_name || s.username} {s.last_name} ({s.email})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COURSE UNITS & LECTURERS */}
      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Units Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">Faculty Course Units & Assigned Lecturers</h3>
              <div className="flex items-center gap-2">
                {(canAssignLecturer || isStrictSystemAdmin) && filteredCourseUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAllFilteredUnits(filteredCourseUnits)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center space-x-1"
                    title="Select or deselect all currently filtered course units"
                  >
                    <span>{filteredCourseUnits.length > 0 && filteredCourseUnits.every(u => selectedUnitIds.includes(u.id)) ? '✕ Deselect Units' : `☑️ Select Filtered (${filteredCourseUnits.length})`}</span>
                  </button>
                )}
                {isSecretaryOrStaff && (
                  <button
                    onClick={() => handleOpenCourseUnitModal(null)}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    📚 Add Course Unit
                  </button>
                )}
                {isSecretaryOrStaff && (
                  <button
                    onClick={() => setShowCsvModal(true)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all"
                  >
                    📤 CSV Import
                  </button>
                )}
              </div>
            </div>

            {/* Sticky Bulk Action Bar for Course Units */}
            {(canAssignLecturer || isStrictSystemAdmin) && selectedUnitIds.length > 0 && (
              <div className="sticky top-2 z-20 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center space-x-3">
                  <span className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-sm font-bold shadow-inner">
                    📚
                  </span>
                  <div>
                    <p className="text-xs font-black tracking-wide uppercase text-emerald-300">
                      {selectedUnitIds.length} Course Unit{selectedUnitIds.length > 1 ? 's' : ''} Selected
                    </p>
                    <p className="text-[11px] text-emerald-100 font-medium">
                      Filter lecturers by name & bulk assign at a single button click.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Lecturer filter by name or username */}
                  <input
                    type="text"
                    placeholder="🔍 Filter lecturer name..."
                    value={bulkLecturerSearch}
                    onChange={(e) => setBulkLecturerSearch(e.target.value)}
                    className="w-40 sm:w-48 px-3 py-1.5 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 rounded-xl border border-white/20 placeholder-white/60 focus:placeholder-slate-400 text-xs font-medium outline-none transition-all"
                  />

                  {/* Lecturer Selector */}
                  <select
                    value={bulkSelectedLecturerId}
                    onChange={(e) => setBulkSelectedLecturerId(e.target.value)}
                    className="px-3 py-1.5 bg-white text-slate-900 font-bold rounded-xl border border-white/30 text-xs outline-none shadow-sm max-w-[210px]"
                  >
                    <option value="">-- Choose Lecturer --</option>
                    {lecturers
                      .filter(l => {
                        if (!bulkLecturerSearch.trim()) return true;
                        const term = bulkLecturerSearch.toLowerCase().trim();
                        const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
                        const uname = (l.username || '').toLowerCase();
                        return fullName.includes(term) || uname.includes(term);
                      })
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.first_name || l.username} {l.last_name || ''} (@{l.username})
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    disabled={bulkAssigning || !bulkSelectedLecturerId}
                    onClick={() => handleBulkAssignLecturer('assign')}
                    className="px-4 py-1.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl text-xs font-black shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                    title="Bulk assign selected units to this lecturer at a single button click"
                  >
                    <span>⚡ {bulkAssigning ? 'Assigning...' : `Bulk Assign (${selectedUnitIds.length})`}</span>
                  </button>

                  <button
                    type="button"
                    disabled={bulkAssigning || !bulkSelectedLecturerId}
                    onClick={() => handleBulkAssignLecturer('unassign')}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 disabled:opacity-50 cursor-pointer"
                    title="Bulk unassign selected units from this lecturer"
                  >
                    ✕ Unassign
                  </button>

                  {isStrictSystemAdmin && (
                    <button
                      type="button"
                      onClick={handleBulkDeleteCourseUnits}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                      title="Permanently delete selected course units"
                    >
                      🗑️ Delete
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setSelectedUnitIds([]); setBulkSelectedLecturerId(''); }}
                    className="px-2.5 py-1.5 text-white/70 hover:text-white text-xs font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Search Course Units</label>
                <input
                  type="text"
                  placeholder="Search code, name, lecturer..."
                  value={unitSearchText}
                  onChange={(e) => setUnitSearchText(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-medium rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-brand-light"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Filter Faculty {(isStudent || isLecturer) && (user?.faculty_code || user?.faculty) && <span className="text-amber-700 font-bold text-[10px]">🔒 Locked</span>}
                </label>
                <select
                  value={(isStudent || isLecturer) && (user?.faculty_code || user?.faculty) ? (user.faculty_code || String(user.faculty)) : selectedUnitFacultyFilter}
                  disabled={(isStudent || isLecturer) && Boolean(user?.faculty_code || user?.faculty)}
                  onChange={(e) => { setSelectedUnitFacultyFilter(e.target.value); setSelectedUnitCourseFilter('All'); }}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light disabled:opacity-85"
                >
                  <option value="All">All Faculties ({faculties.length})</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Filter Program</label>
                <select
                  value={selectedUnitCourseFilter}
                  onChange={(e) => setSelectedUnitCourseFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Course Programs</option>
                  {courses
                    .filter(c => {
                      if (isStudent) {
                        const isAssigned = (user?.assigned_courses || []).includes(c.id) || (user?.assigned_course_codes || []).includes(c.code);
                        const isFac = user?.faculty && (c.faculty === user.faculty || c.faculty_code === user.faculty_code);
                        if (!isAssigned && !(!user?.assigned_courses?.length && isFac)) return false;
                      }
                      return selectedUnitFacultyFilter === 'All' || c.faculty_code === selectedUnitFacultyFilter || String(c.faculty) === String(selectedUnitFacultyFilter);
                    })
                    .map(c => (
                      <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned Lecturer</label>
                <select
                  value={selectedUnitLecturerFilter}
                  onChange={(e) => setSelectedUnitLecturerFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Lecturers ({lecturers.length})</option>
                  {lecturers.map(l => (
                    <option key={l.id} value={l.id}>{l.first_name || l.username} {l.last_name || ''} (@{l.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Year of Study</label>
                <select
                  value={selectedUnitYearFilter}
                  onChange={(e) => setSelectedUnitYearFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Academic Years</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Semester</label>
                <select
                  value={selectedUnitSemesterFilter}
                  onChange={(e) => setSelectedUnitSemesterFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Semesters</option>
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </div>
            </div>

            {filteredCourseUnits.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center italic bg-slate-50/50 rounded-xl border border-slate-100">
                {courseUnits.length === 0 ? 'No course units registered yet.' : 'No course units match the selected filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      {(canAssignLecturer || isStrictSystemAdmin) && (
                        <th className="px-3 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredCourseUnits.length > 0 && filteredCourseUnits.every(u => selectedUnitIds.includes(u.id))}
                            onChange={() => handleToggleSelectAllFilteredUnits(filteredCourseUnits)}
                            className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                            title="Select / deselect all visible units"
                          />
                        </th>
                      )}
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Unit Name</th>
                      <th className="px-3 py-3">Course Program</th>
                      <th className="px-3 py-3 text-center">Year & Sem</th>
                      <th className="px-3 py-3 text-center">Credits</th>
                      <th className="px-3 py-3">Assigned Lecturers</th>
                      {canAssignLecturer && <th className="px-3 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCourseUnits.map((unit) => {
                      const isSelected = selectedUnitIds.includes(unit.id);
                      return (
                        <tr
                          key={unit.id}
                          className={`transition-all ${
                            isSelected ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-l-red-500' : 'hover:bg-slate-50'
                          }`}
                        >
                          {(canAssignLecturer || isStrictSystemAdmin) && (
                            <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectUnit(unit.id)}
                                className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-400 cursor-pointer"
                                title={`Select ${unit.code}`}
                              />
                            </td>
                          )}
                          <td className="px-3 py-3 font-extrabold text-brand-dark">{unit.code}</td>
                          <td className="px-3 py-3 font-bold text-slate-850">{unit.name}</td>
                          <td className="px-3 py-3">{unit.course_code}</td>
                          <td className="px-3 py-3 text-center font-bold">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                              Year {unit.year_of_study || 1} · Sem {unit.semester || 1}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-bold">{unit.credit_units} CU</td>
                          <td className="px-3 py-3">
                            {unit.lecturer_details && unit.lecturer_details.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {unit.lecturer_details.map(l => (
                                  <span key={l.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
                                    <span>{l.first_name || l.username} {l.last_name}</span>
                                    {canAssignLecturer && (
                                      <button
                                        onClick={() => handleUnassignLecturer(unit.id, l.id)}
                                        className="text-emerald-700 hover:text-red-600 font-bold ml-1"
                                        title="Unassign lecturer"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                            )}
                          </td>
                          {canAssignLecturer && (
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => {
                                    setSelectedUnit(unit);
                                    setSelectedLecturerId('');
                                    setShowAssignModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded-lg hover:bg-brand-medium shadow-sm transition-all"
                                  title="Assign lecturer"
                                >
                                  ⚡ Assign
                                </button>
                                {isStrictSystemAdmin && (
                                  <>
                                    <button
                                      onClick={() => handleOpenCourseUnitModal(unit)}
                                      className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold rounded-lg transition-all"
                                      title="Edit unit (System Admin Only)"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCourseUnit(unit.id, unit.code)}
                                      className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded-lg transition-all"
                                      title="Delete unit (System Admin Only)"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Search Lecturers by Name & Course Assignment Console */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5 h-fit">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-wider flex items-center gap-2">
                <span>👨‍🏫 Lecturer Course Unit Assignment Console</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Search existing lecturers by name, inspect their assigned faculties & units, and manage single or bulk course unit assignment with 1-click.
              </p>
            </div>

            {canAssignLecturer ? (
              <div className="space-y-4">
                {/* Optional Selected Unit Banner from Table */}
                {selectedUnit && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-[10px] uppercase tracking-wider">Table Unit Selected</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUnit(null)}
                        className="text-amber-700 hover:text-amber-950 font-bold text-[10px]"
                      >
                        ✕ Clear
                      </button>
                    </div>
                    <p className="font-extrabold text-slate-850 text-xs">{selectedUnit.code} - {selectedUnit.name}</p>
                    <p className="text-slate-500 text-[10px]">Program: {selectedUnit.course_code} · Yr {selectedUnit.year_of_study}, Sem {selectedUnit.semester}</p>
                    {consoleSelectedLecturerId && (
                      <button
                        type="button"
                        disabled={consoleAssigning}
                        onClick={() => handleConsoleSingleUnitAssign(selectedUnit.id, 'assign')}
                        className="mt-1.5 w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all flex items-center justify-center space-x-1"
                      >
                        <span>⚡ Assign This Unit to Selected Lecturer</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 1. Search Lecturer by Name */}
                <div>
                  <label className="block text-slate-700 text-xs font-bold uppercase mb-1">
                    🔍 Search Existing Lecturer by Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type lecturer's first or last name, username, or email..."
                      value={consoleLecturerSearch}
                      onChange={(e) => setConsoleLecturerSearch(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-light/30 focus:border-brand-light outline-none transition-all"
                    />
                    {consoleLecturerSearch && (
                      <button
                        type="button"
                        onClick={() => setConsoleLecturerSearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Lecturer Select list / quick picker */}
                  <div className="mt-2">
                    <select
                      value={consoleSelectedLecturerId}
                      onChange={(e) => {
                        setConsoleSelectedLecturerId(e.target.value);
                        setConsoleSelectedUnitIds([]);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Lecturer ({lecturers.filter(l => {
                        if (!consoleLecturerSearch.trim()) return true;
                        const term = consoleLecturerSearch.toLowerCase().trim();
                        const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
                        const uname = (l.username || '').toLowerCase();
                        const mail = (l.email || '').toLowerCase();
                        return fullName.includes(term) || uname.includes(term) || mail.includes(term);
                      }).length} matching) --</option>
                      {lecturers
                        .filter(l => {
                          if (!consoleLecturerSearch.trim()) return true;
                          const term = consoleLecturerSearch.toLowerCase().trim();
                          const fullName = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
                          const uname = (l.username || '').toLowerCase();
                          const mail = (l.email || '').toLowerCase();
                          return fullName.includes(term) || uname.includes(term) || mail.includes(term);
                        })
                        .map(l => (
                          <option key={l.id} value={l.id}>
                            {l.first_name || l.username} {l.last_name || ''} (@{l.username}) {l.faculty_code ? `· [${l.faculty_code}]` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* If Lecturer is Selected: Show Profile Card, Currently Assigned Units, and Course Assignment Picker */}
                {(() => {
                  const selLecturer = lecturers.find(l => String(l.id) === String(consoleSelectedLecturerId));
                  if (!selLecturer) {
                    return (
                      <div className="p-6 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                        <span className="text-2xl">👨‍🏫</span>
                        <p className="text-xs font-bold text-slate-750">No Lecturer Selected</p>
                        <p className="text-[11px] text-slate-400">
                          Search by name above and choose a lecturer to inspect their assigned units and manage single or bulk course unit assignment.
                        </p>
                      </div>
                    );
                  }

                  // Find course units currently taught by this lecturer
                  const currentlyAssignedUnits = courseUnits.filter(u =>
                    (u.lecturers || []).some(lecId => String(lecId) === String(selLecturer.id)) ||
                    (u.lecturer_details || []).some(ld => String(ld.id) === String(selLecturer.id))
                  );

                  // Find available course units that can be assigned (or all units filtered)
                  const filteredUnitsForLecturer = courseUnits.filter(u => {
                    const matchesSearch = !consoleUnitSearch.trim() ||
                      (u.name || '').toLowerCase().includes(consoleUnitSearch.toLowerCase()) ||
                      (u.code || '').toLowerCase().includes(consoleUnitSearch.toLowerCase()) ||
                      (u.course_code || '').toLowerCase().includes(consoleUnitSearch.toLowerCase()) ||
                      (u.course_name || '').toLowerCase().includes(consoleUnitSearch.toLowerCase());
                    const matchesYear = consoleYearFilter === 'All' || String(u.year_of_study) === String(consoleYearFilter);
                    const matchesSem = consoleSemesterFilter === 'All' || String(u.semester) === String(consoleSemesterFilter);
                    const matchesFac = consoleFacultyFilter === 'All' || String(u.faculty_id) === String(consoleFacultyFilter) || u.faculty_code === consoleFacultyFilter;
                    return matchesSearch && matchesYear && matchesSem && matchesFac;
                  });

                  return (
                    <div className="space-y-4 animate-fade-in">
                      {/* Lecturer Profile Badge */}
                      <div className="p-3.5 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-xl text-white space-y-2 shadow-sm border border-emerald-800/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-emerald-300 text-xs">
                              {selLecturer.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">
                                {selLecturer.first_name || selLecturer.username} {selLecturer.last_name || ''}
                              </p>
                              <p className="text-[10px] text-emerald-300 font-mono">@{selLecturer.username} {selLecturer.email ? `· ${selLecturer.email}` : ''}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-brand-emerald text-brand-dark rounded text-[10px] font-black uppercase">
                            Lecturer
                          </span>
                        </div>
                        {selLecturer.assigned_faculty_details && selLecturer.assigned_faculty_details.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1">
                            <span className="text-[10px] text-emerald-200/70 font-semibold mr-1">Faculties:</span>
                            {selLecturer.assigned_faculty_details.map(f => (
                              <span key={f.id || f.code} className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-bold text-white">
                                [{f.code}] {f.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Currently Assigned Course Units */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Currently Assigned Units ({currentlyAssignedUnits.length})
                          </span>
                        </div>
                        {currentlyAssignedUnits.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                            No course units currently assigned to this lecturer.
                          </p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                            {currentlyAssignedUnits.map(u => (
                              <div key={u.id} className="flex items-center justify-between p-2 bg-emerald-50/60 border border-emerald-200/60 rounded-lg text-xs">
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-slate-800 text-[11px] truncate">{u.code} - {u.name}</p>
                                  <p className="text-[10px] text-slate-500">Yr {u.year_of_study}, Sem {u.semester} · {u.course_code || 'Course'}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={consoleAssigning}
                                  onClick={() => handleConsoleSingleUnitAssign(u.id, 'unassign')}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 text-[10px] font-bold rounded border border-red-200 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                                  title="Unassign this course unit from lecturer"
                                >
                                  ✕ Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Course Unit Selection for Single or Bulk Assignment */}
                      <div className="border-t border-slate-100 pt-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-700 text-xs font-bold uppercase">
                            Assign Units (Single or Bulk)
                          </label>
                          <div className="flex items-center gap-1.5">
                            {filteredUnitsForLecturer.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const unassignedFiltered = filteredUnitsForLecturer
                                    .filter(u => !(u.lecturers || []).some(lecId => String(lecId) === String(selLecturer.id)))
                                    .map(u => u.id);
                                  const allSelected = unassignedFiltered.length > 0 && unassignedFiltered.every(id => consoleSelectedUnitIds.includes(id));
                                  if (allSelected) {
                                    setConsoleSelectedUnitIds(prev => prev.filter(id => !unassignedFiltered.includes(id)));
                                  } else {
                                    setConsoleSelectedUnitIds(prev => Array.from(new Set([...prev, ...unassignedFiltered])));
                                  }
                                }}
                                className="text-[10px] text-teal-700 hover:text-teal-900 font-bold px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 cursor-pointer"
                              >
                                {filteredUnitsForLecturer
                                  .filter(u => !(u.lecturers || []).some(lecId => String(lecId) === String(selLecturer.id)))
                                  .every(u => consoleSelectedUnitIds.includes(u.id))
                                  ? 'Deselect All'
                                  : 'Select All Unassigned'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Search & Filters for Course Units */}
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="🔍 Filter course units by code or title..."
                            value={consoleUnitSearch}
                            onChange={(e) => setConsoleUnitSearch(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:bg-white outline-none"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              value={consoleYearFilter}
                              onChange={(e) => setConsoleYearFilter(e.target.value)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                            >
                              <option value="All">All Years</option>
                              <option value="1">Year 1</option>
                              <option value="2">Year 2</option>
                              <option value="3">Year 3</option>
                              <option value="4">Year 4</option>
                            </select>
                            <select
                              value={consoleSemesterFilter}
                              onChange={(e) => setConsoleSemesterFilter(e.target.value)}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                            >
                              <option value="All">All Semesters</option>
                              <option value="1">Semester 1</option>
                              <option value="2">Semester 2</option>
                            </select>
                          </div>
                        </div>

                        {/* Units List */}
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                          {filteredUnitsForLecturer.length === 0 ? (
                            <p className="text-[11px] text-slate-400 text-center py-3">No matching course units found.</p>
                          ) : (
                            filteredUnitsForLecturer.map(u => {
                              const isAlreadyAssigned = (u.lecturers || []).some(lecId => String(lecId) === String(selLecturer.id));
                              const isChecked = consoleSelectedUnitIds.includes(u.id);

                              return (
                                <div
                                  key={u.id}
                                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all border ${
                                    isAlreadyAssigned
                                      ? 'bg-slate-100/60 border-slate-200/60 opacity-60'
                                      : isChecked
                                      ? 'bg-emerald-50 border-emerald-300 font-bold'
                                      : 'bg-white border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  <label className="flex items-center space-x-2 cursor-pointer flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      disabled={isAlreadyAssigned || consoleAssigning}
                                      checked={isChecked}
                                      onChange={() => {
                                        setConsoleSelectedUnitIds(prev =>
                                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                        );
                                      }}
                                      className="rounded text-brand-emerald focus:ring-brand-emerald cursor-pointer"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-slate-800 truncate">
                                        {u.code} - {u.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        Yr {u.year_of_study}, Sem {u.semester} · {u.course_code || 'Course'}
                                      </p>
                                    </div>
                                  </label>

                                  <div className="ml-2 shrink-0">
                                    {isAlreadyAssigned ? (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                        ✓ Assigned
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={consoleAssigning}
                                        onClick={() => handleConsoleSingleUnitAssign(u.id, 'assign')}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-xs transition-all cursor-pointer"
                                        title="Quick assign single unit"
                                      >
                                        + Assign
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Bulk Assign Action Bar */}
                        {consoleSelectedUnitIds.length > 0 && (
                          <div className="pt-2 animate-slide-up">
                            <button
                              type="button"
                              disabled={consoleAssigning}
                              onClick={() => handleConsoleAssignSelected('assign')}
                              className="w-full py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-brand-dark rounded-xl text-xs font-black shadow-md transition-all active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer"
                            >
                              <span>⚡ {consoleAssigning ? 'Assigning Units...' : `Bulk Assign ${consoleSelectedUnitIds.length} Selected Unit(s)`}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                🔒 Lecturer assignments are managed exclusively by System Administrators and Faculty Secretaries.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STUDENT FACULTY & COURSE ENROLLMENT */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          
          {/* Students Directory */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            {(() => {
              const filteredStudents = students.filter(st => {
                const matchesSearch = !studentSearch || 
                  (st.first_name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.last_name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.username || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.email || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                  (st.reg_number || st.registration_number || '').toLowerCase().includes(studentSearch.toLowerCase());
                const matchesFaculty = studentFacultyFilter === 'All' || (st.faculty_code === studentFacultyFilter || String(st.faculty) === String(studentFacultyFilter));
                const matchesCourse = studentCourseFilter === 'All' ||
                  (st.assigned_courses || []).map(String).includes(studentCourseFilter) ||
                  (st.assigned_course_codes || []).map(c => c.toUpperCase()).includes(studentCourseFilter.toUpperCase());
                const matchesYear = studentYearFilter === 'All' || String(st.year_of_study || 1) === String(studentYearFilter);
                const matchesSemester = studentSemesterFilter === 'All' || String(st.semester || 1) === String(studentSemesterFilter);
                const matchesGender = studentGenderFilter === 'All' || (st.gender || '').toLowerCase() === studentGenderFilter.toLowerCase();
                const matchesEntryYear = studentEntryYearFilter === 'All' || String(st.entry_year || 2026) === String(studentEntryYearFilter);
                const matchesIntake = studentIntakeFilter === 'All' || (st.intake || '').toLowerCase().includes(studentIntakeFilter.toLowerCase());
                return matchesSearch && matchesFaculty && matchesCourse && matchesYear && matchesSemester && matchesGender && matchesEntryYear && matchesIntake;
              });

              const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
              const safeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages);
              const paginatedStudents = filteredStudents.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);

              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-850 uppercase tracking-wider">
                      Registered Student Allocations ({filteredStudents.length} of {students.length})
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (students.length > 0) {
                            const firstSt = students[0];
                            setSelectedStudentId(firstSt.id);
                            setTargetFacultyId(firstSt.faculty || (faculties[0]?.id || ''));
                            setTargetCourseIds(firstSt.assigned_courses || []);
                            setTargetYearOfStudy(firstSt.year_of_study || 1);
                            setTargetSemester(firstSt.semester || 1);
                          }
                          setShowSingleAllocModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                      >
                        <span>🎓 + Allocate Student Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowStudentCsvModal(true)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                      >
                        <span>📥 Bulk CSV Allocation</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const targetSts = filteredStudents.length > 0 ? filteredStudents : students;
                          setSelectedStudentPromotionIds(targetSts.map(s => s.id));
                          setShowPromotionModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                      >
                        <span>🚀 Class Promotion Manager</span>
                      </button>

                      {selectedStudentAllocIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowBulkAllocModal(true)}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
                        >
                          <span>⚡ Bulk Assign Selected ({selectedStudentAllocIds.length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search and Filters Toolbar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Search</label>
                      <input
                        type="text"
                        placeholder="Search student..."
                        value={studentSearch}
                        onChange={(e) => { setStudentSearch(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-medium rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-light"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Faculty</label>
                      <select
                        value={studentFacultyFilter}
                        onChange={(e) => { setStudentFacultyFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Faculties</option>
                        {faculties.map(f => (
                          <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Course</label>
                      <select
                        value={studentCourseFilter}
                        onChange={(e) => { setStudentCourseFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Courses</option>
                        {courses
                          .filter(c => studentFacultyFilter === 'All' || c.faculty_code === studentFacultyFilter || String(c.faculty) === String(studentFacultyFilter))
                          .map(c => (
                            <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Year</label>
                      <select
                        value={studentYearFilter}
                        onChange={(e) => { setStudentYearFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Years</option>
                        <option value="1">Year 1</option>
                        <option value="2">Year 2</option>
                        <option value="3">Year 3</option>
                        <option value="4">Year 4</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Semester</label>
                      <select
                        value={studentSemesterFilter}
                        onChange={(e) => { setStudentSemesterFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Semesters</option>
                        <option value="1">Sem 1</option>
                        <option value="2">Sem 2</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Gender</label>
                      <select
                        value={studentGenderFilter}
                        onChange={(e) => { setStudentGenderFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Entry Year</label>
                      <select
                        value={studentEntryYearFilter}
                        onChange={(e) => { setStudentEntryYearFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All Entries</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                        <option value="2022">2022</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Intake</label>
                      <select
                        value={studentIntakeFilter}
                        onChange={(e) => { setStudentIntakeFilter(e.target.value); setStudentPage(1); }}
                        className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-brand-light"
                      >
                        <option value="All">All 12 Intakes</option>
                        <option value="January Intake">January Intake</option>
                        <option value="February Intake">February Intake</option>
                        <option value="March Intake">March Intake</option>
                        <option value="April Intake">April Intake</option>
                        <option value="May Intake">May Intake</option>
                        <option value="June Intake">June Intake</option>
                        <option value="July Intake">July Intake</option>
                        <option value="August Intake">August Intake</option>
                        <option value="September Intake">September Intake</option>
                        <option value="October Intake">October Intake</option>
                        <option value="November Intake">November Intake</option>
                        <option value="December Intake">December Intake</option>
                      </select>
                    </div>
                  </div>
                  
                  {filteredStudents.length === 0 ? (
                    <p className="text-slate-400 text-xs py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No student accounts match your filter criteria.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                              <th className="px-3 py-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={filteredStudents.length > 0 && selectedStudentAllocIds.length === filteredStudents.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudentAllocIds(filteredStudents.map(s => s.id));
                                    } else {
                                      setSelectedStudentAllocIds([]);
                                    }
                                  }}
                                  className="rounded text-brand-light cursor-pointer"
                                />
                              </th>
                              <th className="px-4 py-3">Student Name & Reg No</th>
                              <th className="px-4 py-3 text-center">Year & Semester</th>
                              <th className="px-4 py-3">Assigned Faculty</th>
                              <th className="px-4 py-3">Enrolled Course Programs</th>
                              <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedStudents.map((st) => (
                              <tr key={st.id} className="hover:bg-slate-50 transition-all">
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedStudentAllocIds.includes(st.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedStudentAllocIds(prev => [...prev, st.id]);
                                      } else {
                                        setSelectedStudentAllocIds(prev => prev.filter(id => id !== st.id));
                                      }
                                    }}
                                    className="rounded text-brand-light cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-850">
                                  <div className="flex items-center flex-wrap gap-1">
                                    <span>{st.first_name || st.username} {st.last_name}</span>
                                    {st.gender && (
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${st.gender === 'female' ? 'bg-pink-50 text-pink-700 border border-pink-200' : st.gender === 'male' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                        {st.gender === 'female' ? '♀ Female' : st.gender === 'male' ? '♂ Male' : '⚥ ' + (st.gender_display || st.gender)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-[10px] text-slate-400 font-normal">{st.email}</span>
                                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    📅 {st.entry_year || 2026} · {st.intake || 'August Intake'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                                    Year {st.year_of_study || 1} · Sem {st.semester || 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {st.faculty_code ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                      {st.faculty_code} - {st.faculty_name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {st.assigned_course_codes && st.assigned_course_codes.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {st.assigned_course_codes.map(cCode => (
                                        <span key={cCode} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                          {cCode}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">No specific courses</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedStudentId(st.id);
                                      setTargetFacultyId(st.faculty || (faculties[0]?.id || ''));
                                      setTargetCourseIds(st.assigned_courses || []);
                                      setTargetYearOfStudy(st.year_of_study || 1);
                                      setTargetSemester(st.semester || 1);
                                      setShowSingleAllocModal(true);
                                    }}
                                    className="px-2.5 py-1 bg-brand-light text-white text-[10px] font-bold rounded hover:bg-brand-medium shadow-xs transition-all"
                                  >
                                    ✏️ Allocate / Edit
                                  </button>
                                  {st.faculty && (
                                    <button
                                      onClick={() => handleRemoveStudentFromFaculty(st.faculty, st.id)}
                                      className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 text-[10px] font-bold rounded"
                                      title="Remove student from faculty"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls Bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-500 font-semibold border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span>Showing {(safeStudentPage - 1) * studentPageSize + 1} - {Math.min(safeStudentPage * studentPageSize, filteredStudents.length)} of {filteredStudents.length} students</span>
                          <select
                            value={studentPageSize}
                            onChange={(e) => { setStudentPageSize(Number(e.target.value)); setStudentPage(1); }}
                            className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 font-bold text-slate-700"
                          >
                            <option value={10}>10 per page</option>
                            <option value={20}>20 per page</option>
                            <option value={50}>50 per page</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => setStudentPage(1)}
                            disabled={safeStudentPage <= 1}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            « First
                          </button>
                          <button
                            onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                            disabled={safeStudentPage <= 1}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            ‹ Prev
                          </button>
                          <span className="px-3 py-1 font-bold text-slate-800">
                            Page {safeStudentPage} of {totalStudentPages}
                          </span>
                          <button
                            onClick={() => setStudentPage(prev => Math.min(totalStudentPages, prev + 1))}
                            disabled={safeStudentPage >= totalStudentPages}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            Next ›
                          </button>
                          <button
                            onClick={() => setStudentPage(totalStudentPages)}
                            disabled={safeStudentPage >= totalStudentPages}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-40"
                          >
                            Last »
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

        </div>
      )}

      {/* SINGLE STUDENT ALLOCATION POPUP MODAL */}
      {showSingleAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">🎓 Allocate Student Profile</h3>
                <p className="text-slate-500 text-xs">Assign target Faculty, Academic Year of Study, and Course Programs.</p>
              </div>
              <button onClick={() => setShowSingleAllocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleAssignStudentToFaculty} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select Student Account</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value);
                    const st = students.find(s => s.id === parseInt(e.target.value));
                    if (st) {
                      setTargetFacultyId(st.faculty || (faculties[0]?.id || ''));
                      setTargetCourseIds(st.assigned_courses || []);
                      setTargetYearOfStudy(st.year_of_study || 1);
                      setTargetSemester(st.semester || 1);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
                  required
                >
                  <option value="">Select Student Account...</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.first_name || st.username} {st.last_name} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Year of Study</label>
                  <select
                    value={targetYearOfStudy}
                    onChange={(e) => setTargetYearOfStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Semester</label>
                  <select
                    value={targetSemester}
                    onChange={(e) => setTargetSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Target Faculty</label>
                  <select
                    value={targetFacultyId}
                    onChange={(e) => setTargetFacultyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
                    required
                  >
                    <option value="">Select Faculty...</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Enrolled Course Programs (Multiple)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {courses.filter(c => !targetFacultyId || c.faculty === parseInt(targetFacultyId)).map((c) => {
                    const isChecked = targetCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 font-medium text-slate-700 text-xs cursor-pointer hover:bg-white p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetCourseIds(prev => [...prev, c.id]);
                            } else {
                              setTargetCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-brand-light cursor-pointer"
                        />
                        <span className="font-bold text-slate-850">[{c.code}]</span>
                        <span className="text-slate-600">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSingleAllocModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                >
                  {submitting ? 'Saving...' : 'Save Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK STUDENT ALLOCATION MODAL */}
      {showBulkAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">🎓 Bulk Assign Year, Semester & Courses ({selectedStudentAllocIds.length} Students)</h3>
                <p className="text-slate-500 text-xs">Assign selected student accounts to Faculty, Year of Study, Semester, and Course Programs at once.</p>
              </div>
              <button onClick={() => setShowBulkAllocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleBulkStudentAllocSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Academic Year</label>
                  <select
                    value={bulkAllocYearOfStudy}
                    onChange={(e) => setBulkAllocYearOfStudy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Semester</label>
                  <select
                    value={bulkAllocSemester}
                    onChange={(e) => setBulkAllocSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Target Faculty</label>
                  <select
                    value={bulkAllocFacultyId}
                    onChange={(e) => setBulkAllocFacultyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value="">-- Keep Current --</option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.id}>[{f.code}] {f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Enrolled Degree Course Programs</label>
                <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2.5 bg-slate-50 space-y-1.5">
                  {courses.filter(c => !bulkAllocFacultyId || c.faculty === parseInt(bulkAllocFacultyId)).map(c => {
                    const isChecked = bulkAllocCourseIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkAllocCourseIds(prev => [...prev, c.id]);
                            } else {
                              setBulkAllocCourseIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-brand-light cursor-pointer"
                        />
                        <span className="font-bold text-slate-850">[{c.code}]</span>
                        <span className="text-slate-600">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkAllocModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-sm transition-all text-xs"
                >
                  {submitting ? 'Applying Bulk Allocations...' : `Apply to ${selectedStudentAllocIds.length} Students`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INLINE LECTURER ASSIGNMENT MODAL (Zero Scrolling Needed!) */}
      {showAssignModal && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Assign Lecturer to Course Unit</h3>
              <button onClick={() => { setShowAssignModal(false); setSelectedUnit(null); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleAssignLecturer} className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 space-y-1">
                <p className="font-bold text-slate-850 text-sm">{selectedUnit.name}</p>
                <p className="text-slate-500 font-medium">Code: <strong className="text-brand-dark">{selectedUnit.code}</strong> · Program: {selectedUnit.course_code}</p>
                <p className="text-slate-500 font-medium">Credits: {selectedUnit.credit_units} CU</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1.5">Select Lecturer to Assign</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850"
                  required
                >
                  <option value="">Select Lecturer...</option>
                  {lecturers.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      {lec.first_name || lec.username} {lec.last_name || ''} (@{lec.username}) {lec.email ? `· ${lec.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowAssignModal(false); setSelectedUnit(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md transition-all"
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD COURSE UNITS (EXCEL & CSV) */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">Bulk Upload Course Units</h3>
                <p className="text-[11px] text-slate-500 font-medium">Auto-link units to their respective Courses & Faculties from Excel (.xlsx, .xls) or CSV</p>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadCsvUnits} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-800">
                <p className="font-bold">Supported Header Formats (Excel & CSV):</p>
                <div className="space-y-1 font-mono text-[11px]">
                  <code className="block bg-white px-2 py-0.5 rounded border border-emerald-200">Unit Code, Unit Name, Course Code, Faculty Code, Year of Study, Credit Units, Lecturer Email</code>
                  <code className="block bg-white px-2 py-0.5 rounded border border-emerald-200">Year, Semester, Course Code, Course Name, Credit Units</code>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Fallback Faculty (Optional)</label>
                  <select
                    value={csvTargetFaculty}
                    onChange={(e) => setCsvTargetFaculty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  >
                    <option value="">-- Auto-detect from file --</option>
                    {faculties.map(f => (
                      <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Fallback Course (Optional)</label>
                  <select
                    value={csvTargetCourse}
                    onChange={(e) => setCsvTargetCourse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs"
                  >
                    <option value="">-- Auto-detect from file --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.code}>[{c.code}] {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select Excel (.xlsx, .xls) or CSV File</label>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-light/10 file:text-brand-dark hover:file:bg-brand-light/20"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase font-bold">Or Paste Raw CSV</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Unit Code,Unit Name,Course Code,Faculty Code,Year of Study,Credit Units&#10;BIT2104,Cloud Infrastructure Systems,BIT2026,FST,2,4&#10;BSN1101,Foundations of Nursing Care,BSN2026,FHS,1,3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => downloadSampleCourseUnits('xlsx')}
                    className="text-brand-dark hover:text-brand-medium text-[11px] font-bold underline flex items-center space-x-1"
                  >
                    <span>📥 Sample Excel (.xlsx)</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => downloadSampleCourseUnits('csv')}
                    className="text-brand-light hover:text-brand-medium text-[11px] font-bold underline flex items-center space-x-1"
                  >
                    <span>📄 Sample CSV (.csv)</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Importing...' : 'Upload & Import Units'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT FACULTY (ADMIN) */}
      {showFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
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
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingFaculty ? 'Save Changes' : 'Create Faculty'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CLASS TIMETABLE */}
      {showTimetableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">Publish Class Timetable Slot</h3>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateTimetable} className="space-y-4 text-xs">
              
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

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Unit (Optional)</label>
                  <select
                    value={ttFormData.course_unit}
                    onChange={(e) => setTtFormData({ ...ttFormData, course_unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select Unit...</option>
                    {courseUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assigned Lecturer</label>
                <select
                  value={ttFormData.lecturer}
                  onChange={(e) => setTtFormData({ ...ttFormData, lecturer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Lecturer...</option>
                  {lecturers.map(l => (
                    <option key={l.id} value={l.id}>{l.first_name || l.username} {l.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={ttFormData.class_date}
                    onChange={(e) => setTtFormData({ ...ttFormData, class_date: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Day</label>
                  <select
                    value={ttFormData.day_of_week}
                    onChange={(e) => setTtFormData({ ...ttFormData, day_of_week: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Room / Venue</label>
                  <input
                    type="text"
                    value={ttFormData.room}
                    onChange={(e) => setTtFormData({ ...ttFormData, room: e.target.value })}
                    placeholder="e.g. Hall A, Lab 2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Class Type</label>
                  <select
                    value={ttFormData.class_type}
                    onChange={(e) => setTtFormData({ ...ttFormData, class_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="lab">Practical Lab</option>
                    <option value="workshop">Workshop</option>
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
                  className="px-5 py-2 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Publishing...' : 'Publish Timetable Slot'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT COURSE */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingCourse ? `Edit Course ${editingCourse.code}` : 'Add New Course to Faculty'}
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assigned Faculty</label>
                <select
                  value={courseFormData.faculty}
                  onChange={(e) => setCourseFormData({ ...courseFormData, faculty: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Faculty...</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.code} - {f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Code</label>
                  <input
                    type="text"
                    value={courseFormData.code}
                    onChange={(e) => setCourseFormData({ ...courseFormData, code: e.target.value })}
                    placeholder="e.g. BIT2026, BSN2026"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Course Duration (Years)</label>
                  <select
                    value={courseFormData.duration_years}
                    onChange={(e) => setCourseFormData({ ...courseFormData, duration_years: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    required
                  >
                    <option value={1}>1 Year (Certificate/Diploma)</option>
                    <option value={2}>2 Years (Associate Degree)</option>
                    <option value={3}>3 Years (Standard Degree)</option>
                    <option value={4}>4 Years (Engineering/Honors)</option>
                    <option value={5}>5 Years (Medicine/Surgery)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Full Course Name</label>
                <input
                  type="text"
                  value={courseFormData.name}
                  onChange={(e) => setCourseFormData({ ...courseFormData, name: e.target.value })}
                  placeholder="e.g. Bachelor of Information Technology"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Description</label>
                <textarea
                  value={courseFormData.description}
                  onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                  placeholder="Summary of course structure and goals..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT COURSE UNIT */}
      {showCourseUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-850">
                {editingCourseUnit ? `Edit Course Unit ${editingCourseUnit.code}` : 'Add Course Unit to Course Program'}
              </h3>
              <button onClick={() => setShowCourseUnitModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCourseUnit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Target Course Program</label>
                <select
                  value={unitFormData.course}
                  onChange={(e) => setUnitFormData({ ...unitFormData, course: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                >
                  <option value="">Select Course Program...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Unit Code</label>
                  <input
                    type="text"
                    value={unitFormData.code}
                    onChange={(e) => setUnitFormData({ ...unitFormData, code: e.target.value })}
                    placeholder="e.g. BIT2104"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Credit Units</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={unitFormData.credit_units}
                    onChange={(e) => setUnitFormData({ ...unitFormData, credit_units: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase mb-1">Year of Study</label>
                  <select
                    value={unitFormData.year_of_study}
                    onChange={(e) => setUnitFormData({ ...unitFormData, year_of_study: e.target.value })}
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
                  <label className="block text-slate-700 font-bold uppercase mb-1">Semester</label>
                  <select
                    value={unitFormData.semester || 1}
                    onChange={(e) => setUnitFormData({ ...unitFormData, semester: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                    required
                  >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Course Unit Name</label>
                <input
                  type="text"
                  value={unitFormData.name}
                  onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
                  placeholder="e.g. Cloud Infrastructure Systems"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Assign Lecturers (Optional)</label>
                <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                  {lecturers.map((lec) => {
                    const isChecked = unitFormData.lecturers.includes(lec.id);
                    return (
                      <label key={lec.id} className="flex items-center space-x-2 p-1 hover:bg-white rounded cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUnitFormData(prev => ({ ...prev, lecturers: [...prev.lecturers, lec.id] }));
                            } else {
                              setUnitFormData(prev => ({ ...prev, lecturers: prev.lecturers.filter(id => id !== lec.id) }));
                            }
                          }}
                          className="rounded text-brand-dark focus:ring-brand-light"
                        />
                        <span className="font-semibold text-slate-800">{lec.first_name || lec.username} {lec.last_name}</span>
                        <span className="text-slate-400 text-[10px]">({lec.email})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCourseUnitModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : editingCourseUnit ? 'Save Changes' : 'Create Course Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLASS PROMOTION MANAGER */}
      {showPromotionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-indigo-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-850 flex items-center space-x-2">
                  <span>🚀 Class Promotion Manager</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Advance class cohorts to the next semester/year with individual student overrides.
                </p>
              </div>
              <button
                onClick={() => setShowPromotionModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecutePromotion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Promotion Type *
                  </label>
                  <select
                    value={promotionMode}
                    onChange={(e) => setPromotionMode(e.target.value)}
                    className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-xl px-3 py-2"
                  >
                    <option value="next_semester">⏩ Promote to Next Semester (Sem 1 → Sem 2)</option>
                    <option value="next_year">🎓 Promote to Next Academic Year (Year X → Year X+1)</option>
                    <option value="custom">⚙️ Custom Target Year & Semester</option>
                  </select>
                </div>

                {promotionMode === 'custom' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Target Academic Year
                      </label>
                      <select
                        value={promotionTargetYear}
                        onChange={(e) => setPromotionTargetYear(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-xl px-3 py-2"
                      >
                        <option value={1}>Year 1</option>
                        <option value={2}>Year 2</option>
                        <option value={3}>Year 3</option>
                        <option value={4}>Year 4</option>
                        <option value={5}>🎓 Graduate Class</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Target Semester
                      </label>
                      <select
                        value={promotionTargetSemester}
                        onChange={(e) => setPromotionTargetSemester(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-xl px-3 py-2"
                      >
                        <option value={1}>Semester 1</option>
                        <option value={2}>Semester 2</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="flex flex-col justify-center text-[11px] text-slate-600 font-medium sm:col-span-3">
                  <p>Targeting <strong className="text-indigo-900 font-extrabold">{selectedStudentPromotionIds.length} student account(s)</strong> for promotion.</p>
                </div>
              </div>

              {/* Cohort Filters for Promotion */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                    🎯 Filter & Target Cohort (e.g. 2026 August Intake)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const matching = students.filter(st => {
                          const matchesFac = promotionFacultyId === 'All' || (st.faculty_code === promotionFacultyId || String(st.faculty) === String(promotionFacultyId));
                          const matchesEY = promotionEntryYear === 'All' || String(st.entry_year || 2026) === String(promotionEntryYear);
                          const matchesIn = promotionIntake === 'All' || (st.intake || 'August Intake').toLowerCase().includes(promotionIntake.toLowerCase());
                          return matchesFac && matchesEY && matchesIn;
                        });
                        setSelectedStudentPromotionIds(matching.map(s => s.id));
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm"
                    >
                      ✓ Select Filtered Cohort
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentPromotionIds([])}
                      className="text-[10px] font-bold px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-all"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Faculty</label>
                    <select
                      value={promotionFacultyId}
                      onChange={(e) => setPromotionFacultyId(e.target.value)}
                      className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="All">All Faculties ({faculties.length})</option>
                      {faculties.map(f => (
                        <option key={f.id} value={f.code}>[{f.code}] {f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Entry Year</label>
                    <select
                      value={promotionEntryYear}
                      onChange={(e) => setPromotionEntryYear(e.target.value)}
                      className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="All">All Entry Years</option>
                      <option value="2026">2026 Entry</option>
                      <option value="2025">2025 Entry</option>
                      <option value="2024">2024 Entry</option>
                      <option value="2023">2023 Entry</option>
                      <option value="2022">2022 Entry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Intake</label>
                    <select
                      value={promotionIntake}
                      onChange={(e) => setPromotionIntake(e.target.value)}
                      className="w-full bg-white border border-slate-200 font-bold text-slate-800 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="All">All 12 Intakes</option>
                      <option value="January Intake">January Intake</option>
                      <option value="February Intake">February Intake</option>
                      <option value="March Intake">March Intake</option>
                      <option value="April Intake">April Intake</option>
                      <option value="May Intake">May Intake</option>
                      <option value="June Intake">June Intake</option>
                      <option value="July Intake">July Intake</option>
                      <option value="August Intake">August Intake</option>
                      <option value="September Intake">September Intake</option>
                      <option value="October Intake">October Intake</option>
                      <option value="November Intake">November Intake</option>
                      <option value="December Intake">December Intake</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Roster Table with Overrides */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="px-3 py-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const matching = students.filter(st => {
                              const matchesFac = promotionFacultyId === 'All' || (st.faculty_code === promotionFacultyId || String(st.faculty) === String(promotionFacultyId));
                              const matchesEY = promotionEntryYear === 'All' || String(st.entry_year || 2026) === String(promotionEntryYear);
                              const matchesIn = promotionIntake === 'All' || (st.intake || 'August Intake').toLowerCase().includes(promotionIntake.toLowerCase());
                              return matchesFac && matchesEY && matchesIn;
                            });
                            return matching.length > 0 && matching.every(s => selectedStudentPromotionIds.includes(s.id));
                          })()}
                          onChange={(e) => {
                            const matching = students.filter(st => {
                              const matchesFac = promotionFacultyId === 'All' || (st.faculty_code === promotionFacultyId || String(st.faculty) === String(promotionFacultyId));
                              const matchesEY = promotionEntryYear === 'All' || String(st.entry_year || 2026) === String(promotionEntryYear);
                              const matchesIn = promotionIntake === 'All' || (st.intake || 'August Intake').toLowerCase().includes(promotionIntake.toLowerCase());
                              return matchesFac && matchesEY && matchesIn;
                            });
                            if (e.target.checked) {
                              const matchingIds = matching.map(s => s.id);
                              setSelectedStudentPromotionIds(prev => Array.from(new Set([...prev, ...matchingIds])));
                            } else {
                              const matchingIds = new Set(matching.map(s => s.id));
                              setSelectedStudentPromotionIds(prev => prev.filter(id => !matchingIds.has(id)));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-2">Student Name & Reg No</th>
                      <th className="px-3 py-2 text-center">Current Class</th>
                      <th className="px-3 py-2">Target Year Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(() => {
                      const displayedStudents = students.filter(st => {
                        const matchesFac = promotionFacultyId === 'All' || (st.faculty_code === promotionFacultyId || String(st.faculty) === String(promotionFacultyId));
                        const matchesEY = promotionEntryYear === 'All' || String(st.entry_year || 2026) === String(promotionEntryYear);
                        const matchesIn = promotionIntake === 'All' || (st.intake || 'August Intake').toLowerCase().includes(promotionIntake.toLowerCase());
                        return matchesFac && matchesEY && matchesIn;
                      });

                      if (displayedStudents.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                              No students match the chosen cohort filter ({promotionEntryYear !== 'All' ? promotionEntryYear : ''} {promotionIntake !== 'All' ? promotionIntake : ''}).
                            </td>
                          </tr>
                        );
                      }

                      return displayedStudents.map((st) => {
                        const isSelected = selectedStudentPromotionIds.includes(st.id);
                        const currentYr = st.year_of_study || 1;
                        const customTarget = studentOverrides[st.id] !== undefined ? studentOverrides[st.id] : promotionTargetYear;

                        return (
                          <tr key={st.id} className={isSelected ? 'bg-indigo-50/40' : 'opacity-60'}>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentPromotionIds(prev => [...prev, st.id]);
                                  } else {
                                    setSelectedStudentPromotionIds(prev => prev.filter(id => id !== st.id));
                                  }
                                }}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-bold text-slate-850">{st.first_name || st.username} {st.last_name}</p>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-500 font-mono font-bold">{st.reg_number || st.registration_number || `@${st.username}`}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {st.entry_year || 2026} · {st.intake || 'August Intake'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-extrabold text-slate-700">
                              Year {currentYr} (Sem {st.semester || 1})
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={customTarget}
                                onChange={(e) => setStudentOverrides(prev => ({ ...prev, [st.id]: Number(e.target.value) }))}
                                className="bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2 py-1 text-xs"
                              >
                                <option value={1}>Repeat Year 1</option>
                                <option value={2}>Advance to Year 2</option>
                                <option value={3}>Advance to Year 3</option>
                                <option value={4}>Advance to Year 4</option>
                                <option value={5}>🎓 Graduate (Alumni)</option>
                              </select>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPromotionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedStudentPromotionIds.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Executing Promotion...' : `🚀 Execute Class Promotion (${selectedStudentPromotionIds.length})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK CSV STUDENT ALLOCATION */}
      {showStudentCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-850">Bulk Student Allocations via CSV</h3>
                <p className="text-xs text-slate-500 font-medium">Batch allocate faculty, course, academic year and semester</p>
              </div>
              <button onClick={() => setShowStudentCsvModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUploadStudentCsv} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-800">
                <p className="font-bold flex items-center justify-between">
                  <span>Supported Column Headers:</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-extrabold">Duplicates Auto-Ignored</span>
                </p>
                <div className="space-y-1 font-mono text-[11px]">
                  <code className="block bg-white px-2 py-0.5 rounded border border-emerald-200">username,registration_number,faculty_code,course_code,year_of_study,semester</code>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Tip: Identifier can be <strong>username</strong>, <strong>registration_number</strong>, or <strong>email</strong>. Duplicate student rows in the batch or matching existing database state are automatically deduplicated.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Select Excel (.xlsx, .xls) or CSV File</label>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(e) => setStudentCsvFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-light/10 file:text-brand-dark hover:file:bg-brand-light/20"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase font-bold">Or Paste Raw CSV</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={studentCsvText}
                  onChange={(e) => setStudentCsvText(e.target.value)}
                  placeholder="username,registration_number,faculty_code,course_code,year_of_study,semester&#10;std_albert,2026BACTFT-A001,FST,BIT2026,2,1&#10;std_brenda,2026BACTFT-A002,FST,BSE2026,1,2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={downloadSampleStudentCsv}
                  className="text-brand-light hover:text-brand-medium text-[11px] font-bold underline flex items-center space-x-1"
                >
                  <span>📥 Download Sample CSV</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowStudentCsvModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Allocating...' : 'Process Student Allocations'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVIEW & ATTACH COURSE UNITS FOR SELECTED COURSE */}
      {showUnitsReviewModal && selectedReviewCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 bg-brand-light/10 text-brand-dark font-mono font-extrabold text-xs rounded-lg border border-brand-light/20">
                    {selectedReviewCourse.code}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded border border-slate-200">
                    ⏱️ {selectedReviewCourse.duration_years || 3} Years
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold text-[10px] rounded border border-emerald-200">
                    {faculties.find(f => f.id === selectedReviewCourse.faculty)?.code || 'Faculty'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {selectedReviewCourse.name} - Attached Units Review
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review curriculum units, manage lecturer allocations, or attach / detach units for this degree program.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitsReviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm transition-all shrink-0 self-start sm:self-center"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Units</p>
                <p className="text-xl font-black text-slate-800">{reviewUnitsList.length}</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Total Credit Units</p>
                <p className="text-xl font-black text-emerald-800">
                  {reviewUnitsList.reduce((acc, u) => acc + (u.credit_units || 0), 0)} CU
                </p>
              </div>
              <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                <p className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">Assigned Lecturers</p>
                <p className="text-xl font-black text-indigo-800">
                  {new Set(reviewUnitsList.flatMap(u => (u.lecturer_details || []).map(l => l.id))).size}
                </p>
              </div>
              <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
                <p className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Unassigned Units</p>
                <p className="text-xl font-black text-amber-800">
                  {reviewUnitsList.filter(u => !u.lecturer_details || u.lecturer_details.length === 0).length}
                </p>
              </div>
            </div>

            {/* Action Bar: Search, Filters & Action Toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Filter unit code or name..."
                  value={reviewSearchTerm}
                  onChange={(e) => setReviewSearchTerm(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:ring-1 focus:ring-brand-light flex-1 min-w-[140px]"
                />
                <select
                  value={reviewYearFilter}
                  onChange={(e) => setReviewYearFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-brand-light"
                >
                  <option value="All">All Years</option>
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </div>

              {canBulkManage && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowInlineAddUnit(!showInlineAddUnit)}
                    className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1"
                  >
                    <span>{showInlineAddUnit ? '✕ Close Form' : '➕ Create New Unit'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Inline Unit Creator Form */}
            {showInlineAddUnit && canBulkManage && (
              <form onSubmit={handleCreateAndAttachUnit} className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 space-y-3 animate-slide-up text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-emerald-900 text-xs uppercase tracking-wide">
                    ➕ Quick Add New Unit to {selectedReviewCourse.code}
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-medium">Instantly attached to this course</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Unit Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CS102"
                      value={newUnitInlineData.code}
                      onChange={(e) => setNewUnitInlineData({ ...newUnitInlineData, code: e.target.value })}
                      required
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Unit Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Data Structures"
                      value={newUnitInlineData.name}
                      onChange={(e) => setNewUnitInlineData({ ...newUnitInlineData, name: e.target.value })}
                      required
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Credit Units</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={newUnitInlineData.credit_units}
                      onChange={(e) => setNewUnitInlineData({ ...newUnitInlineData, credit_units: parseInt(e.target.value) || 3 })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Year of Study</label>
                    <select
                      value={newUnitInlineData.year_of_study}
                      onChange={(e) => setNewUnitInlineData({ ...newUnitInlineData, year_of_study: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-slate-800 font-bold"
                    >
                      <option value={1}>Year 1</option>
                      <option value={2}>Year 2</option>
                      <option value={3}>Year 3</option>
                      <option value={4}>Year 4</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInlineAddUnit(false)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1 bg-brand-light hover:bg-brand-medium text-white font-bold rounded-lg shadow-2xs disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Save & Attach'}
                  </button>
                </div>
              </form>
            )}

            {/* Attach Existing Unit Selector */}
            {canBulkManage && (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🔗</span>
                  <div>
                    <p className="font-extrabold text-slate-800">Attach Existing Unit to {selectedReviewCourse.code}</p>
                    <p className="text-[11px] text-slate-500 font-medium">Reassign or transfer an existing course unit to this degree program.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={attachExistingUnitId}
                    onChange={(e) => setAttachExistingUnitId(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 min-w-[200px]"
                  >
                    <option value="">Select Existing Unit...</option>
                    {courseUnits
                      .filter(u => u.course !== selectedReviewCourse.id && u.course_code !== selectedReviewCourse.code)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          [{u.code}] {u.name} (from {u.course_code || 'Other'})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!attachExistingUnitId || submitting}
                    onClick={handleAttachExistingUnit}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl disabled:opacity-40 transition-all shrink-0"
                  >
                    {submitting ? 'Attaching...' : 'Attach to Course'}
                  </button>
                </div>
              </div>
            )}

            {/* Attached Units List Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Current Course Units ({filteredReviewUnits.length})
                </h4>
              </div>

              {loadingReviewUnits ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="w-6 h-6 border-2 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
                </div>
              ) : filteredReviewUnits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <p className="text-slate-500 text-xs font-medium italic">
                    {reviewUnitsList.length === 0
                      ? 'No course units attached to this degree program yet.'
                      : 'No course units match your search or year filter.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 font-extrabold text-slate-600 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5">Unit Name</th>
                        <th className="px-3 py-2.5 text-center">Year</th>
                        <th className="px-3 py-2.5 text-center">Credits</th>
                        <th className="px-4 py-2.5">Assigned Lecturer(s)</th>
                        {canBulkManage && <th className="px-4 py-2.5 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReviewUnits.map(unit => (
                        <tr key={unit.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-extrabold text-brand-dark">
                            {unit.code}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-850">
                            {unit.name}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              Year {unit.year_of_study || 1}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-slate-700">
                            {unit.credit_units} CU
                          </td>
                          <td className="px-4 py-3">
                            {unit.lecturer_details && unit.lecturer_details.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {unit.lecturer_details.map(l => (
                                  <span key={l.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    👨‍🏫 {l.first_name || l.username} {l.last_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                            )}
                          </td>
                          {canBulkManage && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUnit(unit);
                                    setSelectedLecturerId('');
                                    setShowAssignModal(true);
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-slate-100 text-brand-dark font-bold rounded-lg border border-slate-200 text-[10px] transition-all"
                                  title="Assign lecturer to this unit"
                                >
                                  ⚡ Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDetachUnitFromCourse(unit)}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg border border-red-200 text-[10px] transition-all"
                                  title="Detach unit from course"
                                >
                                  ✂️ Detach
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUnitsReviewModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Done Reviewing
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
