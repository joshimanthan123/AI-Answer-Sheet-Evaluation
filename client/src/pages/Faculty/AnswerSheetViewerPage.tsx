import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AnswerSheetViewer } from '../../components/AnswerSheetViewer';
import answerSheetService from '../../services/answerSheet.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const FacultyAnswerSheetViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    answerSheetService.getFacultySheetDetail(id)
      .then((res: any) => {
        if (res.success && res.data) {
          setSheet(res.data);
        } else if (res && !res.success && res.data) {
          setSheet(res.data);
        } else if (res && res.id) {
          setSheet(res);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;
  if (!id) return null;

  const examId = sheet?.exam?._id || sheet?.exam;
  const examTitle = sheet?.exam?.title || 'Exam';

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-4">
      {/* Breadcrumbs & Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 text-left">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs text-outline font-semibold select-none">
            <Link to="/faculty/exams" className="hover:text-primary">Exams</Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            {examId && (
              <>
                <Link to={`/faculty/exams/${examId}`} className="hover:text-primary font-bold">{examTitle}</Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <Link to={`/faculty/exams/${examId}/answer-sheets`} className="hover:text-primary font-bold">Answer Sheets</Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              </>
            )}
            <span className="text-on-surface">Answer Sheet Scan</span>
          </div>
          <h2 className="text-xl font-black text-on-surface font-display mt-0.5">
            {sheet?.studentIdentifier || 'Student Draft'} - {sheet?.uploadedFileName || 'Scan View'}
          </h2>
        </div>
        <button
          onClick={() => {
            if (examId) {
              navigate(`/faculty/exams/${examId}/answer-sheets`);
            } else {
              window.history.back();
            }
          }}
          className="px-3.5 py-1.5 border border-outline-variant/35 text-on-surface hover:bg-surface-container-low text-xs font-bold rounded-xl transition flex items-center gap-1 active:scale-95"
        >
          <span className="material-symbols-outlined text-xs">arrow_back</span>
          Back to Sheets
        </button>
      </div>

      <AnswerSheetViewer sheetId={id} isFaculty={true} />
    </div>
  );
};

export default FacultyAnswerSheetViewerPage;
