import React from 'react';
import { useParams } from 'react-router-dom';
import { AnswerSheetViewer } from '../../components/AnswerSheetViewer';

export const FacultyAnswerSheetViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  
  return (
    <div className="max-w-5xl mx-auto py-4">
      <AnswerSheetViewer sheetId={id} isFaculty={true} />
    </div>
  );
};

export default FacultyAnswerSheetViewerPage;
