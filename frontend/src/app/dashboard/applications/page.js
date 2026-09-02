'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states (Student)
  const [selectedCourse, setSelectedCourse] = useState('');
  const [transcriptDetails, setTranscriptDetails] = useState('');
  
  // Review states
  const [reviewingApp, setReviewingApp] = useState(null);
  const [reviewerFeedback, setReviewerFeedback] = useState('');
  
  // UI states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isExecutiveReadOnly = ['dvc', 'vc', 'dean'].includes(user?.role);
  const isReviewer = ['admin', 'faculty_admin'].includes(user?.role) && !isExecutiveReadOnly;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [appsData, coursesData] = await Promise.all([
        api.get('/applications/').catch(() => []),
        api.get('/courses/').catch(() => [])
      ]);
      setApplications(appsData);
      setCourses(coursesData);
    } catch (err) {
      setErrorMsg('Failed to load applications data.');
    } finally {
      setLoading(false);
    }
  }

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (isExecutiveReadOnly) return;
    if (!selectedCourse || !transcriptDetails) {
      setErrorMsg('Please select a course and enter academic details.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post('/applications/', {
        course: selectedCourse,
        transcript_details: transcriptDetails
      });
      setSuccessMsg('Course application submitted successfully!');
      setSelectedCourse('');
      setTranscriptDetails('');
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (status) => {
    if (isExecutiveReadOnly || !reviewingApp) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      await api.post(`/applications/${reviewingApp.id}/review/`, {
        status: status,
        reviewer_feedback: reviewerFeedback
      });
      setSuccessMsg(`Application has been successfully ${status}!`);
      setReviewingApp(null);
      setReviewerFeedback('');
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Review submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-light/20 border-t-brand-light rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Course Applications Portal</h2>
          <p className="text-slate-500 text-xs font-medium">Manage and review applicant filings for university academic courses.</p>
        </div>
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
        
        {/* Application List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Application Filings</h3>
            
            {applications.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">No applications filed yet.</p>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-850">{app.course_name}</span>
                        <span className="text-xs font-bold text-brand-medium">({app.course_code})</span>
                      </div>
                      <p className="text-xs text-slate-500">Applicant: <span className="font-semibold text-slate-700">{app.student_name}</span> · Date: {new Date(app.applied_at).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic mt-2">
                        "{app.transcript_details}"
                      </p>
                      {app.reviewer_feedback && (
                        <div className="text-xs text-emerald-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 mt-2 font-medium">
                          <span className="font-bold text-emerald-900">Reviewer Comment:</span> "{app.reviewer_feedback}"
                          <p className="text-[10px] text-emerald-700 mt-1">Reviewed by: {app.reviewed_by_name || 'Staff'}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col items-end gap-2 self-start md:self-center shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${app.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {app.status}
                      </span>
                      
                      {isReviewer && app.status === 'pending' && (
                        <button
                          onClick={() => {
                            setReviewingApp(app);
                            setReviewerFeedback(app.reviewer_feedback || '');
                          }}
                          className="px-3 py-1.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Review Now
                        </button>
                      )}

                      {isExecutiveReadOnly && (
                        <button
                          onClick={() => setReviewingApp(app)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {isExecutiveReadOnly ? (
            reviewingApp ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 sticky top-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase">Application Details</h3>
                  <button onClick={() => setReviewingApp(null)} className="text-xs text-slate-400 font-bold">✕ Close</button>
                </div>
                <div className="text-xs space-y-2 text-slate-700">
                  <p><strong>Applicant:</strong> {reviewingApp.student_name}</p>
                  <p><strong>Course:</strong> {reviewingApp.course_name} ({reviewingApp.course_code})</p>
                  <p><strong>Status:</strong> <span className="font-bold uppercase text-emerald-700">{reviewingApp.status}</span></p>
                  <p><strong>Transcript:</strong></p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 italic">
                    "{reviewingApp.transcript_details}"
                  </div>
                  {reviewingApp.reviewer_feedback && (
                    <>
                      <p><strong>Reviewer Comment:</strong></p>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 font-medium">
                        "{reviewingApp.reviewer_feedback}"
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs font-semibold shadow-sm">
                Select an application to view full transcript & feedback details in read-only mode.
              </div>
            )
          ) : isReviewer ? (
            reviewingApp ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 sticky top-6 animate-slide-up">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Review Applicant</h3>
                <div className="text-xs space-y-1 text-slate-600 border-b border-slate-100 pb-3">
                  <p><strong>Applicant:</strong> {reviewingApp.student_name}</p>
                  <p><strong>Course:</strong> {reviewingApp.course_name} ({reviewingApp.course_code})</p>
                </div>
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Feedback Comments</label>
                  <textarea
                    rows={4}
                    value={reviewerFeedback}
                    onChange={(e) => setReviewerFeedback(e.target.value)}
                    placeholder="Enter academic review, qualifications comments..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-brand-light transition-all resize-none"
                  />
                </div>
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => handleReviewSubmit('approved')}
                    disabled={submitting}
                    className="flex-1 py-2 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReviewSubmit('rejected')}
                    disabled={submitting}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    Reject
                  </button>
                </div>
                <button
                  onClick={() => setReviewingApp(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-xs font-semibold shadow-sm">
                Select an applicant to review their application details.
              </div>
            )
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">File Course Application</h3>
              
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Academic Course</label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-brand-light transition-all"
                  >
                    <option value="">Select a Course...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        [{course.code}] {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-semibold uppercase tracking-wider mb-1">Transcript & Details</label>
                  <textarea
                    rows={6}
                    value={transcriptDetails}
                    onChange={(e) => setTranscriptDetails(e.target.value)}
                    placeholder="Enter GPA, high school grades, subjects, why you wish to apply..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-brand-light transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-brand-light hover:bg-brand-medium text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
