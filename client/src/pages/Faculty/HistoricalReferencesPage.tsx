import React, { useState, useEffect } from 'react';
import historicalEvaluationService, { HistoricalEvaluationRecord } from '../../services/historicalEvaluation.service';

export const HistoricalReferencesPage: React.FC = () => {
  const [references, setReferences] = useState<HistoricalEvaluationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [qNumFilter, setQNumFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Detail & Action Modal State
  const [selectedRef, setSelectedRef] = useState<HistoricalEvaluationRecord | null>(null);
  const [actionStatus, setActionStatus] = useState<'approved' | 'rejected' | 'archived' | null>(null);
  const [statusComment, setStatusComment] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await historicalEvaluationService.getReferences({
        subjectId: subjectFilter || undefined,
        academicYear: yearFilter || undefined,
        referenceStatus: statusFilter || undefined,
        questionNumber: qNumFilter || undefined,
        page,
        limit: 15,
      });

      if (res.data) {
        setReferences(res.data.references || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch historical evaluation references';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, [subjectFilter, yearFilter, statusFilter, qNumFilter, page]);

  const handleUpdateStatus = async (status: 'approved' | 'rejected' | 'archived') => {
    if (!selectedRef) return;
    setUpdating(true);
    setActionError(null);
    try {
      const res = await historicalEvaluationService.updateStatus(selectedRef._id, status, statusComment);
      if (res.data || res.success) {
        setSelectedRef(null);
        setActionStatus(null);
        setStatusComment('');
        fetchReferences();
      } else {
        throw new Error(res.message || 'Failed to update reference status');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Status update failed';
      setActionError(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-surface-container p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
        <div>
          <span className="text-[10px] text-secondary font-black uppercase tracking-widest block">Phase 3F — Faculty Curated Reference Repository</span>
          <h1 className="text-2xl font-black text-on-surface font-display mt-0.5">Historical Evaluation References</h1>
          <p className="text-xs text-outline mt-1 font-body-sm">
            Curate, review, and approve high-quality evaluation references to serve as evidence for future AI evaluation pipelines.
          </p>
        </div>

        <button
          onClick={fetchReferences}
          className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-extrabold text-xs rounded-xl border border-outline-variant/30 flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-surface-container p-5 rounded-2xl border border-outline-variant/20 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="font-bold text-outline block mb-1">Subject</label>
          <input
            type="text"
            placeholder="e.g. Data Structures or CS101"
            value={subjectFilter}
            onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium"
          />
        </div>

        <div>
          <label className="font-bold text-outline block mb-1">Academic Year</label>
          <input
            type="text"
            placeholder="e.g. 2025-26"
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium"
          />
        </div>

        <div>
          <label className="font-bold text-outline block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium"
          >
            <option value="">All Statuses</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="font-bold text-outline block mb-1">Question Number</label>
          <input
            type="number"
            placeholder="e.g. 1"
            value={qNumFilter}
            onChange={(e) => { setQNumFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-surface-container-low text-on-surface font-medium"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-surface-container rounded-3xl border border-outline-variant/20 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-outline text-xs flex justify-center items-center gap-2 font-semibold">
            <span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <span>Loading historical reference repository records...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-error text-xs font-bold">
            {error}
          </div>
        ) : references.length === 0 ? (
          <div className="p-12 text-center text-outline space-y-2">
            <span className="material-symbols-outlined text-4xl text-outline/50">bookmarks</span>
            <p className="text-sm font-extrabold text-on-surface">No Historical Evaluation References Found</p>
            <p className="text-xs">Try adjusting filters or select finalized answer sheet questions in AnswerSheetViewer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/20 text-outline uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="p-4">Question & Text</th>
                  <th className="p-4">Subject / Exam</th>
                  <th className="p-4">Marks</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Audit Info</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {references.map((ref) => {
                  const statusColors: { [k: string]: string } = {
                    pending_review: 'bg-warning/15 text-warning border-warning/30',
                    approved: 'bg-success/15 text-success border-success/30',
                    rejected: 'bg-error/15 text-error border-error/30',
                    archived: 'bg-surface-container-highest text-outline border-outline-variant/30',
                  };

                  return (
                    <tr key={ref._id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="p-4 space-y-1 max-w-xs">
                        <div className="font-extrabold text-on-surface flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-secondary/15 text-secondary rounded font-mono text-[11px] font-black">
                            Q{ref.questionNumber}
                          </span>
                          <span className="truncate">{ref.questionText}</span>
                        </div>
                        <p className="text-[11px] text-outline line-clamp-1 italic font-serif">
                          "{ref.studentAnswer || ref.ocrText || 'No student answer'}"
                        </p>
                      </td>

                      <td className="p-4 space-y-0.5">
                        <div className="font-bold text-on-surface">{ref.subject?.name || 'Subject'}</div>
                        <div className="text-[11px] text-outline font-medium">
                          {ref.exam?.name || ref.examName || 'Exam'} • {ref.academicYear}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-mono font-black text-sm text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg border border-secondary/20">
                          {ref.marksAwarded} / {ref.maxMarks}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${statusColors[ref.referenceStatus] || 'bg-outline/10 text-outline'}`}>
                          <span>{ref.referenceStatus.replace('_', ' ')}</span>
                        </span>
                      </td>

                      <td className="p-4 text-[11px] text-outline">
                        {ref.referenceStatus === 'approved' && ref.approvedBy ? (
                          <div>
                            Appr: <span className="font-bold text-on-surface">{ref.approvedBy?.name || 'Faculty'}</span>
                            <div className="text-[10px]">{ref.approvedAt ? new Date(ref.approvedAt).toLocaleDateString() : ''}</div>
                          </div>
                        ) : (
                          <div>
                            Created: <span className="font-bold text-on-surface">{ref.createdBy?.name || 'Faculty'}</span>
                            <div className="text-[10px]">{new Date(ref.createdAt).toLocaleDateString()}</div>
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRef(ref);
                            setActionStatus(null);
                            setStatusComment('');
                            setActionError(null);
                          }}
                          className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>View Details</span>
                        </button>
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
            <span>Page {page} of {totalPages}</span>
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

      {/* Reference Detail & Approval Modal */}
      {selectedRef && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-container card p-6 max-w-2xl w-full rounded-2xl shadow-xl space-y-4 text-left border border-outline-variant/30 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/15 pb-3">
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined text-2xl">bookmarks</span>
                <h3 className="text-base font-black text-on-surface">Historical Evaluation Reference Details</h3>
              </div>
              <button
                onClick={() => setSelectedRef(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-error/10 text-error text-xs rounded-xl font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{actionError}</span>
              </div>
            )}

            {/* Reference Data Snapshot */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-secondary/10 p-3 rounded-xl border border-secondary/20">
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Question Q{selectedRef.questionNumber}</span>
                  <span className="font-extrabold text-on-surface text-sm">{selectedRef.questionText}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-outline uppercase block">Faculty Final Marks</span>
                  <span className="font-mono font-black text-secondary text-base">{selectedRef.marksAwarded} / {selectedRef.maxMarks}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-outline uppercase block mb-1">Student Recognized Answer / OCR Text</span>
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 italic font-serif leading-relaxed text-on-surface">
                  "{selectedRef.studentAnswer || selectedRef.ocrText || 'No student answer recorded.'}"
                </div>
              </div>

              {selectedRef.modelAnswer && (
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block mb-1">Model Answer Snapshot</span>
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 font-sans leading-relaxed text-on-surface">
                    {selectedRef.modelAnswer}
                  </div>
                </div>
              )}

              {selectedRef.rubric && Array.isArray(selectedRef.rubric) && selectedRef.rubric.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block mb-1">Rubric Criteria Snapshot</span>
                  <div className="space-y-1.5">
                    {selectedRef.rubric.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-surface-container-low rounded-lg border border-outline-variant/15 text-[11px]">
                        <span className="font-medium text-on-surface">{item.criterion || item.description}</span>
                        <span className="font-bold text-secondary font-mono">
                          {item.marksAwarded ?? item.maxMarks ?? 0} / {item.maxMarks}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Comment & Workflow Section */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface">Current Status:</span>
                  <span className="font-black uppercase text-secondary px-2.5 py-0.5 rounded bg-secondary/15">
                    {selectedRef.referenceStatus.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-outline uppercase block mb-1">Optional Status / Review Comment</label>
                  <input
                    type="text"
                    placeholder="e.g. Approved as high quality reference for CS101 final exam"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant/40 rounded-xl bg-white dark:bg-surface-container text-xs"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-outline-variant/15">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus('archived')}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 cursor-pointer disabled:opacity-50"
                  >
                    Archive
                  </button>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus('rejected')}
                    className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error font-bold text-xs rounded-xl border border-error/20 cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStatus('approved')}
                    className="px-5 py-2 bg-success text-on-success font-extrabold text-xs rounded-xl shadow-md hover:bg-success/90 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {updating ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Approve Reference</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalReferencesPage;
