import React, { useState, useEffect } from "react";
import referenceAnswerService, {
  ReferenceAnswerItem,
  ReferenceQuestion,
} from "../../services/referenceAnswer.service";
import { examService, Exam } from "../../services/exam.service";
import { subjectService } from "../../services/subject.service";
import { Subject } from "../../types";
import { useNotifications } from "../../context/NotificationContext";

export const ReferenceAnswersPage: React.FC = () => {
  const { addToast } = useNotifications();

  // Primary Data State
  const [references, setReferences] = useState<ReferenceAnswerItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filter State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [examFilter, setExamFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [procStatusFilter, setProcStatusFilter] = useState<string>("");
  const [verifStatusFilter, setVerifStatusFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [academicYearInput, setAcademicYearInput] = useState<string>("2024-25");
  const [descriptionInput, setDescriptionInput] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Verification & Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [activeReference, setActiveReference] = useState<ReferenceAnswerItem | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingQuestionData, setEditingQuestionData] = useState<Partial<ReferenceQuestion>>({});
  const [newKeywordInput, setNewKeywordInput] = useState<string>("");
  const [newConceptInput, setNewConceptInput] = useState<string>("");
  const [updatingQuestion, setUpdatingQuestion] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>("");
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);

  // Debounce search term to prevent rapid API requests on typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load initial dropdown options
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [examsList, subjectsList] = await Promise.all([
          examService.getExams(),
          subjectService.getSubjects(),
        ]);
        setExams(examsList || []);
        setSubjects(subjectsList || []);
      } catch (err: any) {
        console.error("Failed to load exams/subjects list:", err);
      }
    };
    loadDropdownData();
  }, []);

  // Fetch references list with filters
  const fetchReferences = async (overrideExamId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const targetExamId = overrideExamId !== undefined ? overrideExamId : (examFilter || undefined);
      const res = await referenceAnswerService.getReferences({
        examId: targetExamId,
        subjectId: subjectFilter || undefined,
        academicYear: yearFilter || undefined,
        processingStatus: procStatusFilter || undefined,
        verificationStatus: verifStatusFilter || undefined,
        search: debouncedSearchTerm || undefined,
        page,
        limit: 10,
      });

      const dataObj = res?.data || res;
      if (dataObj) {
        setReferences(dataObj.references || []);
        if (dataObj.pagination) {
          setTotalPages(dataObj.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to fetch reference answers";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, [examFilter, subjectFilter, yearFilter, procStatusFilter, verifStatusFilter, debouncedSearchTerm, page]);

  // Handle Exam selection in upload form
  const handleExamSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const examId = e.target.value;
    setSelectedExamId(examId);
    const matchedExam = exams.find((ex) => ex.id === examId || (ex as any)._id === examId);
    if (matchedExam) {
      const subId = typeof matchedExam.subject === "object" ? matchedExam.subject._id || matchedExam.subject.id : matchedExam.subject;
      if (subId) setSelectedSubjectId(subId);
    }
  };

  // Upload Reference Answer Form Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedExamId) {
      setUploadError("Please select an exam.");
      return;
    }
    if (!academicYearInput.trim()) {
      setUploadError("Please enter academic year.");
      return;
    }
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    // Client-side file size validation (max 25MB)
    if (uploadFile.size > 25 * 1024 * 1024) {
      setUploadError("File size exceeds 25 MB limit.");
      return;
    }

    setUploading(true);
    setUploadProgress(25);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("examId", selectedExamId);
      if (selectedSubjectId) formData.append("subjectId", selectedSubjectId);
      formData.append("academicYear", academicYearInput.trim());
      formData.append("description", descriptionInput.trim());

      setUploadProgress(60);
      await referenceAnswerService.uploadReference(formData);
      setUploadProgress(100);

      addToast("Reference answer sheet uploaded and queued for OCR processing successfully!", "success");
      setUploadModalOpen(false);

      // Sync filter to the uploaded exam so the newly created sheet is immediately visible
      const uploadedExamId = selectedExamId;
      setExamFilter(uploadedExamId);
      setPage(1);

      setSelectedExamId("");
      setSelectedSubjectId("");
      setDescriptionInput("");
      setUploadFile(null);
      fetchReferences(uploadedExamId);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to upload reference answer sheet";
      setUploadError(msg);
      addToast(msg, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Open Reference Details Modal
  const openReferenceDetail = async (refItem: ReferenceAnswerItem) => {
    try {
      const res = await referenceAnswerService.getReferenceById(refItem._id);
      const detailObj = res?.data || res;
      setActiveReference(detailObj?._id ? detailObj : refItem);
    } catch (err) {
      setActiveReference(refItem);
    }
    setEditingQuestionIndex(null);
    setShowRejectInput(false);
    setRejectReasonInput("");
    setDetailModalOpen(true);
  };

  // Start editing a question in verification interface
  const startEditingQuestion = (index: number, q: ReferenceQuestion) => {
    setEditingQuestionIndex(index);
    setEditingQuestionData({
      questionText: q.questionText,
      answerText: q.answerText,
      maximumMarks: q.maximumMarks,
      awardedMarks: q.awardedMarks,
      keywords: [...(q.keywords || [])],
      concepts: [...(q.concepts || [])],
      partialCreditPoints: [...(q.partialCreditPoints || [])],
      facultyComment: q.facultyComment || "",
      verificationStatus: q.verificationStatus || "pending",
    });
  };

  // Save question edit
  const saveQuestionEdit = async (questionSubIdOrNum: string | number) => {
    if (!activeReference) return;
    setUpdatingQuestion(true);
    try {
      const res = await referenceAnswerService.updateQuestion(
        activeReference._id,
        questionSubIdOrNum.toString(),
        editingQuestionData
      );
      const updatedObj = res?.data || res;
      if (updatedObj && (updatedObj._id || res?.success)) {
        setActiveReference(updatedObj._id ? updatedObj : activeReference);
        addToast("Question reference data updated successfully", "success");
        setEditingQuestionIndex(null);
        fetchReferences();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update question data";
      addToast(msg, "error");
    } finally {
      setUpdatingQuestion(false);
    }
  };

  // Approve entire reference answer
  const handleApproveReference = async () => {
    if (!activeReference) return;
    setActionLoading(true);
    try {
      const res = await referenceAnswerService.approveReference(activeReference._id);
      const approvedObj = res?.data || res;
      if (approvedObj && (approvedObj._id || res?.success)) {
        setActiveReference(approvedObj._id ? approvedObj : activeReference);
        addToast("Reference answer sheet approved successfully! It is now available as evaluation evidence.", "success");
        fetchReferences();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to approve reference";
      addToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject reference answer
  const handleRejectReference = async () => {
    if (!activeReference) return;
    setActionLoading(true);
    try {
      const res = await referenceAnswerService.rejectReference(activeReference._id, rejectReasonInput);
      const rejectedObj = res?.data || res;
      if (rejectedObj && (rejectedObj._id || res?.success)) {
        setActiveReference(rejectedObj._id ? rejectedObj : activeReference);
        addToast("Reference answer sheet marked as REJECTED.", "info");
        setShowRejectInput(false);
        fetchReferences();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to reject reference";
      addToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Retry processing through OCR
  const handleRetryProcessing = async (refId: string) => {
    setActionLoading(true);
    try {
      const res = await referenceAnswerService.processReference(refId);
      const reprocessedObj = res?.data || res;
      addToast("OCR re-processing completed successfully!", "success");
      if (activeReference && activeReference._id === refId && reprocessedObj?._id) {
        setActiveReference(reprocessedObj);
      }
      fetchReferences();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "OCR processing failed";
      addToast(msg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete reference answer
  const handleDeleteReference = async (refId: string) => {
    if (!window.confirm("Are you sure you want to delete this reference answer sheet?")) return;
    try {
      await referenceAnswerService.deleteReference(refId);
      addToast("Reference answer sheet deleted successfully.", "success");
      if (activeReference && activeReference._id === refId) {
        setDetailModalOpen(false);
        setActiveReference(null);
      }
      fetchReferences();
    } catch (err: any) {
      addToast(err.response?.data?.message || "Failed to delete reference", "error");
    }
  };

  // Helper status color classes
  const getProcStatusBadge = (status: string) => {
    switch (status) {
      case "UPLOADED":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
      case "PROCESSING":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 animate-pulse";
      case "PROCESSED":
      case "VERIFICATION_PENDING":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300";
      case "FAILED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getVerifStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "approved":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "REJECTED":
      case "rejected":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in max-w-7xl mx-auto py-6">
      {/* Header section with Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-surface-container p-6 rounded-3xl border border-outline-variant/20 shadow-xs">
        <div>
          <span className="text-[10px] text-secondary font-black uppercase tracking-widest block">
            Phase 7A — Reference Answer Intelligence
          </span>
          <h1 className="text-2xl font-black text-on-surface font-display mt-0.5">
            Reference Answers Repository
          </h1>
          <p className="text-xs text-outline mt-1 max-w-2xl">
            Upload and process previously evaluated reference answer sheets. Approved reference evidence will guide adaptive AI evaluation in Phase 7B.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReferences()}
            className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            <span>Upload Reference Sheet</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white dark:bg-surface-container p-5 rounded-2xl border border-outline-variant/20 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs">
        {/* Search */}
        <div className="md:col-span-2">
          <label className="font-bold text-outline block mb-1">Search</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
              search
            </span>
            <input
              type="text"
              placeholder="Search filename, year, OCR answer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Exam Filter */}
        <div>
          <label className="font-bold text-outline block mb-1">Exam</label>
          <select
            value={examFilter}
            onChange={(e) => {
              setExamFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium cursor-pointer focus:outline-none"
          >
            <option value="">All Exams</option>
            {exams.map((ex) => (
              <option key={ex.id || (ex as any)._id} value={ex.id || (ex as any)._id}>
                {ex.title}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <label className="font-bold text-outline block mb-1">Subject</label>
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium cursor-pointer focus:outline-none"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year Filter */}
        <div>
          <label className="font-bold text-outline block mb-1">Academic Year</label>
          <input
            type="text"
            placeholder="e.g. 2024-25"
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none"
          />
        </div>

        {/* Verification Status Filter */}
        <div>
          <label className="font-bold text-outline block mb-1">Verification Status</label>
          <select
            value={verifStatusFilter}
            onChange={(e) => {
              setVerifStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium cursor-pointer focus:outline-none"
          >
            <option value="">All Verification</option>
            <option value="PENDING">Pending Verification</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-surface-container rounded-3xl border border-outline-variant/20 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-outline text-xs flex justify-center items-center gap-2 font-semibold">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading reference answer sheets...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-error text-xs font-bold">{error}</div>
        ) : references.length === 0 ? (
          <div className="p-12 text-center text-outline space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline/40">
              verified_user
            </span>
            <p className="text-sm font-extrabold text-on-surface">No Reference Answer Sheets Found</p>
            <p className="text-xs">
              Upload previously evaluated reference answer sheets to extract questions, marks, and knowledge concepts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20 text-outline uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="p-4">Reference File / Description</th>
                  <th className="p-4">Exam & Subject</th>
                  <th className="p-4">Academic Year</th>
                  <th className="p-4">Questions</th>
                  <th className="p-4">Processing Status</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {references.map((ref) => {
                  const examObj = ref.examId;
                  const subjectObj = ref.subjectId;
                  const examTitle = (typeof examObj === "object" && examObj !== null) ? (examObj.title || "Exam") : (typeof examObj === "string" ? examObj : "Exam");
                  const subjectName = (typeof subjectObj === "object" && subjectObj !== null) ? (subjectObj.name || "") : (typeof subjectObj === "string" ? subjectObj : "");
                  const qCount = ref.questions ? ref.questions.length : 0;

                  return (
                    <tr key={ref._id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="p-4 space-y-1 max-w-xs">
                        <div className="font-extrabold text-on-surface flex items-center gap-1.5 truncate">
                          <span className="material-symbols-outlined text-base text-primary">
                            description
                          </span>
                          <span className="truncate">{ref.sourceFile?.filename || "Reference Sheet"}</span>
                        </div>
                        {ref.description && (
                          <p className="text-[11px] text-outline line-clamp-1 italic">{ref.description}</p>
                        )}
                      </td>

                      <td className="p-4 space-y-0.5">
                        <div className="font-bold text-on-surface">{examTitle}</div>
                        {subjectName && (
                          <div className="text-[11px] text-outline font-medium">{subjectName}</div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="font-mono font-bold text-on-surface px-2 py-1 bg-surface-container-low rounded-lg border border-outline-variant/20">
                          {ref.academicYear}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-black text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg border border-secondary/20">
                          {qCount} {qCount === 1 ? "Question" : "Questions"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${getProcStatusBadge(
                            ref.processingStatus
                          )}`}
                        >
                          {ref.processingStatus === "PROCESSING" && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                          )}
                          <span>{ref.processingStatus.replace("_", " ")}</span>
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${getVerifStatusBadge(
                            ref.verificationStatus
                          )}`}
                        >
                          <span>{ref.verificationStatus}</span>
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openReferenceDetail(ref)}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                            title="Verify & Edit Details"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            <span>Verify & Edit</span>
                          </button>

                          {ref.processingStatus === "FAILED" && (
                            <button
                              type="button"
                              onClick={() => handleRetryProcessing(ref._id)}
                              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                              title="Retry Processing"
                            >
                              <span className="material-symbols-outlined text-sm">refresh</span>
                              <span>Retry</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteReference(ref._id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer active:scale-95"
                            title="Delete Reference"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/20 flex justify-between items-center text-xs font-bold text-outline bg-surface-container-low">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-lg hover:bg-surface-container-high disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-white dark:bg-surface-container border border-outline-variant/30 rounded-lg hover:bg-surface-container-high disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-container card p-6 max-w-lg w-full rounded-3xl shadow-2xl space-y-4 text-left border border-outline-variant/30 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 text-primary font-black">
                <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                <h3 className="text-base text-on-surface">Upload Reference Answer Sheet</h3>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* Exam Selection */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">
                  Exam <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedExamId}
                  onChange={handleExamSelect}
                  required
                  className="w-full px-3.5 py-2.5 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Exam</option>
                  {exams.map((ex) => (
                    <option key={ex.id || (ex as any)._id} value={ex.id || (ex as any)._id}>
                      {ex.title} ({ex.examType || "Exam"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject (Auto-populated or selectable) */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Subject (Optional)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">
                  Academic Year <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2024-25"
                  value={academicYearInput}
                  onChange={(e) => setAcademicYearInput(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Reference Type (Readonly) */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">Reference Type</label>
                <input
                  type="text"
                  value="Previous Year Evaluated Answer Sheet"
                  disabled
                  className="w-full px-3.5 py-2.5 border border-outline-variant/30 rounded-xl bg-surface-container-highest text-outline font-bold cursor-not-allowed"
                />
              </div>

              {/* File Upload Input */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">
                  Evaluated Answer Sheet File <span className="text-rose-500">*</span>
                </label>
                <div className="border-2 border-dashed border-outline-variant/40 hover:border-primary/60 rounded-2xl p-4 text-center bg-surface-container-low transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    required
                    className="hidden"
                    id="reference-file-input"
                  />
                  <label htmlFor="reference-file-input" className="cursor-pointer space-y-1 block">
                    <span className="material-symbols-outlined text-3xl text-primary">
                      upload_file
                    </span>
                    <p className="font-bold text-on-surface">
                      {uploadFile ? uploadFile.name : "Click to select file or drag & drop"}
                    </p>
                    <p className="text-[10px] text-outline">Supported: PDF, PNG, JPG, JPEG (Max 25MB)</p>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-extrabold text-on-surface block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional reference description (e.g. Top scorer sheet 2024)"
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Progress Indicator */}
              {uploading && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-bold text-primary">
                    <span>Uploading & Triggering OCR...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      <span>Upload & Process</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERIFICATION & DETAIL MODAL */}
      {detailModalOpen && activeReference && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-container card p-6 max-w-4xl w-full rounded-3xl shadow-2xl space-y-5 text-left border border-outline-variant/30 max-h-[92vh] overflow-y-auto animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-outline-variant/20 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl text-primary">
                    fact_check
                  </span>
                  <h3 className="text-lg font-black text-on-surface font-display">
                    Reference Answer Verification & Intelligence
                  </h3>
                </div>
                <p className="text-xs text-outline mt-0.5">
                  File: <span className="font-bold text-on-surface">{activeReference.sourceFile?.filename}</span> • Academic Year: <span className="font-bold text-on-surface">{activeReference.academicYear}</span>
                </p>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Lifecycle Status Row */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 flex flex-wrap justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Processing Status</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${getProcStatusBadge(activeReference.processingStatus)}`}>
                    {activeReference.processingStatus.replace("_", " ")}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Verification Status</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${getVerifStatusBadge(activeReference.verificationStatus)}`}>
                    {activeReference.verificationStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRetryProcessing(activeReference._id)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>Retry OCR</span>
                </button>

                {activeReference.verificationStatus !== "APPROVED" ? (
                  <button
                    onClick={handleApproveReference}
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Approve Reference</span>
                  </button>
                ) : (
                  <span className="px-3 py-1 bg-emerald-500/15 text-emerald-600 font-extrabold text-xs rounded-xl border border-emerald-500/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>Approved Evidence</span>
                  </span>
                )}
              </div>
            </div>

            {/* Questions Breakdown Section */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-on-surface flex items-center justify-between">
                <span>Extracted Question Breakdown ({activeReference.questions?.length || 0})</span>
                <span className="text-[11px] font-normal text-outline">
                  Review extracted questions, marks, and knowledge concepts before approval.
                </span>
              </h4>

              {(!activeReference.questions || activeReference.questions.length === 0) ? (
                <div className="p-6 text-center bg-surface-container-low rounded-2xl border border-outline-variant/20 text-xs space-y-2">
                  {activeReference.processingError ? (
                    <div className="text-error font-medium">
                      ⚠️ OCR Processing Issue: {activeReference.processingError}
                    </div>
                  ) : (
                    <div className="text-outline">
                      No question segments extracted yet. Click "Retry OCR" to re-process.
                    </div>
                  )}
                  <button
                    onClick={() => handleRetryProcessing(activeReference._id)}
                    disabled={actionLoading}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${actionLoading ? "animate-spin" : ""}`}>refresh</span>
                    Retry OCR & Segmentation
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeReference.questions.map((q, idx) => {
                    const isEditing = editingQuestionIndex === idx;

                    return (
                      <div
                        key={q._id || idx}
                        className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/25 space-y-3"
                      >
                        {/* Question Header & Marks Bar */}
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-outline-variant/15 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-primary/15 text-primary rounded-lg font-mono font-black text-xs">
                              Q{q.questionNumber}
                            </span>
                            <span className="font-extrabold text-on-surface text-sm">
                              {q.questionText || `Question ${q.questionNumber}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <div className="bg-secondary/10 px-3 py-1 rounded-xl border border-secondary/20">
                              <span className="text-[10px] font-bold text-outline block uppercase">Marks</span>
                              <span className="font-mono font-black text-secondary text-sm">
                                {q.awardedMarks} / {q.maximumMarks}
                              </span>
                            </div>

                            {q.ocrConfidence && (
                              <span className="text-[10px] font-bold text-outline">
                                OCR Confidence: <span className="font-mono font-black text-on-surface">{(q.ocrConfidence * 100).toFixed(0)}%</span>
                              </span>
                            )}

                            {!isEditing ? (
                              <button
                                onClick={() => startEditingQuestion(idx, q)}
                                className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg cursor-pointer"
                              >
                                Edit
                              </button>
                            ) : (
                              <button
                                onClick={() => saveQuestionEdit(q._id || q.questionNumber)}
                                disabled={updatingQuestion}
                                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1"
                              >
                                {updatingQuestion ? "Saving..." : "Save"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Question Details View / Edit Mode */}
                        {!isEditing ? (
                          <div className="space-y-3 text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-outline uppercase block mb-1">
                                OCR Extracted Answer Text
                              </span>
                              <div className="p-3 bg-white dark:bg-surface-container rounded-xl border border-outline-variant/20 italic font-serif leading-relaxed text-on-surface whitespace-pre-wrap">
                                {q.answerText || "No answer text extracted."}
                              </div>
                            </div>

                            {/* Extracted Concepts & Keywords */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <span className="text-[10px] font-bold text-outline uppercase block mb-1">
                                  Concepts
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {q.concepts && q.concepts.length > 0 ? (
                                    q.concepts.map((c, ci) => (
                                      <span
                                        key={ci}
                                        className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold text-[11px] rounded-md border border-primary/20"
                                      >
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-outline italic">No concepts tagged</span>
                                  )}
                                </div>
                              </div>

                              <div>
                                <span className="text-[10px] font-bold text-outline uppercase block mb-1">
                                  Keywords
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {q.keywords && q.keywords.length > 0 ? (
                                    q.keywords.map((kw, ki) => (
                                      <span
                                        key={ki}
                                        className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant font-mono font-medium text-[11px] rounded border border-outline-variant/30"
                                      >
                                        #{kw}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-outline italic">No keywords tagged</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {q.facultyComment && (
                              <div>
                                <span className="text-[10px] font-bold text-outline uppercase block mb-0.5">
                                  Faculty Comment
                                </span>
                                <p className="p-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] border border-amber-500/20">
                                  {q.facultyComment}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* EDIT FORM MODE */
                          <div className="space-y-3 text-xs pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="font-bold text-outline block mb-1">Question Text</label>
                                <input
                                  type="text"
                                  value={editingQuestionData.questionText || ""}
                                  onChange={(e) =>
                                    setEditingQuestionData({
                                      ...editingQuestionData,
                                      questionText: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-1.5 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container"
                                />
                              </div>

                              <div>
                                <label className="font-bold text-outline block mb-1">Awarded Marks</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={editingQuestionData.maximumMarks || 10}
                                  step={0.5}
                                  value={editingQuestionData.awardedMarks ?? 0}
                                  onChange={(e) =>
                                    setEditingQuestionData({
                                      ...editingQuestionData,
                                      awardedMarks: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-3 py-1.5 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container font-mono font-bold"
                                />
                              </div>

                              <div>
                                <label className="font-bold text-outline block mb-1">Maximum Marks</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editingQuestionData.maximumMarks ?? 5}
                                  onChange={(e) =>
                                    setEditingQuestionData({
                                      ...editingQuestionData,
                                      maximumMarks: parseFloat(e.target.value) || 1,
                                    })
                                  }
                                  className="w-full px-3 py-1.5 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container font-mono font-bold"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="font-bold text-outline block mb-1">Answer Text</label>
                              <textarea
                                rows={3}
                                value={editingQuestionData.answerText || ""}
                                onChange={(e) =>
                                  setEditingQuestionData({
                                    ...editingQuestionData,
                                    answerText: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container font-serif"
                              />
                            </div>

                            {/* Keywords Editor */}
                            <div>
                              <label className="font-bold text-outline block mb-1">Keywords</label>
                              <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {(editingQuestionData.keywords || []).map((kw, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded flex items-center gap-1"
                                  >
                                    <span>#{kw}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (editingQuestionData.keywords || []).filter(
                                          (_, i) => i !== idx
                                        );
                                        setEditingQuestionData({ ...editingQuestionData, keywords: updated });
                                      }}
                                      className="hover:text-rose-500 cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Add keyword..."
                                  value={newKeywordInput}
                                  onChange={(e) => setNewKeywordInput(e.target.value)}
                                  className="px-3 py-1 border border-outline-variant/40 rounded-lg text-xs bg-white dark:bg-surface-container"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newKeywordInput.trim()) {
                                      setEditingQuestionData({
                                        ...editingQuestionData,
                                        keywords: [...(editingQuestionData.keywords || []), newKeywordInput.trim()],
                                      });
                                      setNewKeywordInput("");
                                    }
                                  }}
                                  className="px-3 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-lg border border-outline-variant/30 cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Concepts Editor */}
                            <div>
                              <label className="font-bold text-outline block mb-1">Concepts</label>
                              <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {(editingQuestionData.concepts || []).map((c, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2.5 py-0.5 bg-secondary/15 text-secondary font-bold rounded flex items-center gap-1"
                                  >
                                    <span>{c}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (editingQuestionData.concepts || []).filter(
                                          (_, i) => i !== idx
                                        );
                                        setEditingQuestionData({ ...editingQuestionData, concepts: updated });
                                      }}
                                      className="hover:text-rose-500 cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Add concept phrase..."
                                  value={newConceptInput}
                                  onChange={(e) => setNewConceptInput(e.target.value)}
                                  className="px-3 py-1 border border-outline-variant/40 rounded-lg text-xs bg-white dark:bg-surface-container"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newConceptInput.trim()) {
                                      setEditingQuestionData({
                                        ...editingQuestionData,
                                        concepts: [...(editingQuestionData.concepts || []), newConceptInput.trim()],
                                      });
                                      setNewConceptInput("");
                                    }
                                  }}
                                  className="px-3 py-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-lg border border-outline-variant/30 cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Faculty Comment */}
                            <div>
                              <label className="font-bold text-outline block mb-1">Faculty Evaluation Comment</label>
                              <input
                                type="text"
                                placeholder="Add faculty comment for reference evaluation..."
                                value={editingQuestionData.facultyComment || ""}
                                onChange={(e) =>
                                  setEditingQuestionData({
                                    ...editingQuestionData,
                                    facultyComment: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-1.5 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Approval / Rejection Actions */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 space-y-3 pt-3">
              {showRejectInput && (
                <div className="space-y-2 p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <label className="font-bold text-rose-600 dark:text-rose-400 block text-xs">
                    Rejection Reason
                  </label>
                  <input
                    type="text"
                    placeholder="Enter reason for rejecting reference sheet..."
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    className="w-full px-3 py-2 border border-rose-500/30 rounded-xl bg-white dark:bg-surface-container text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-1 text-outline font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectReference}
                      disabled={actionLoading}
                      className="px-4 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDeleteReference(activeReference._id)}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs rounded-xl border border-rose-500/20 cursor-pointer active:scale-95"
                >
                  Delete Reference
                </button>

                <div className="flex items-center gap-2">
                  {!showRejectInput && activeReference.verificationStatus !== "REJECTED" && (
                    <button
                      type="button"
                      onClick={() => setShowRejectInput(true)}
                      className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 cursor-pointer"
                    >
                      Reject Reference
                    </button>
                  )}

                  {activeReference.verificationStatus !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={handleApproveReference}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Approve & Save Reference</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceAnswersPage;
