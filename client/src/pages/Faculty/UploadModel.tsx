import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { facultyService } from '../../services/faculty.service';
import { useNotifications } from '../../context/NotificationContext';
import { Subject } from '../../types';
import Dropdown from '../../components/ui/Dropdown';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface RubricQuestion {
  questionNumber: number;
  questionText: string;
  expectedAnswer: string;
  keywords: string;
  weight: number;
}

export const FacultyUploadModel: React.FC = () => {
  const { addToast } = useNotifications();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExam, setSelectedExam] = useState('exam-mid');
  const [file, setFile] = useState<File | null>(null);

  const [questions, setQuestions] = useState<RubricQuestion[]>([
    { questionNumber: 1, questionText: 'Define Binary Search Tree and analyze its search time complexity.', expectedAnswer: 'A binary tree where left children are smaller and right children larger than the parent. Average search complexity is O(log n), worst case is O(n) for skewed cases.', keywords: 'binary tree, left smaller, right larger, O(log n), O(n)', weight: 10 }
  ]);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService.getSubjects().then(data => {
      setSubjects(data);
      if (data.length > 0) setSelectedSubject(data[0].id);
      setLoading(false);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    setQuestions(prev => [
      ...prev,
      { questionNumber: nextNum, questionText: '', expectedAnswer: '', keywords: '', weight: 5 }
    ]);
  };

  const handleQuestionChange = (index: number, field: keyof RubricQuestion, value: any) => {
    setQuestions(prev => prev.map((q, idx) => {
      if (idx === index) {
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, idx) => idx !== index).map((q, idx) => ({ ...q, questionNumber: idx + 1 })));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject || !file) {
      addToast('Upload a model answer key document.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await facultyService.uploadModelAnswer(
        file,
        selectedSubject,
        selectedExam,
        questions
      );
      addToast('Model solution key schema successfully active!', 'success');
      setFile(null);
    } catch (err) {
      addToast('Error saving schema configurations.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" className="py-20" />;

  const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.code} - ${s.name}` }));
  const examOptions = [
    { value: 'exam-mid', label: 'Mid-Term Examination' },
    { value: 'exam-final', label: 'Final End-Semester Examination' }
  ];

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Configure Model Answer Sheets</h2>
        <p className="text-sm text-on-surface-variant mt-1">Upload course coordinator grading keys and customize keyword weights.</p>
      </div>

      <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 flex flex-col gap-6">
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Dropdown 
              label="Select Subject" 
              options={subjectOptions} 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
            />

            <Dropdown 
              label="Evaluation scope" 
              options={examOptions} 
              value={selectedExam} 
              onChange={(e) => setSelectedExam(e.target.value)}
            />
          </div>

          {/* Model PDF File Zone */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Model Answers PDF schema</span>
            <div className="flex items-center gap-4 p-4 border border-outline-variant/30 bg-surface-container-low rounded-xl">
              <input 
                type="file" 
                accept=".pdf" 
                id="modelKeyFile"
                onChange={handleFileChange}
                className="hidden"
              />
              <label 
                htmlFor="modelKeyFile" 
                className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl cursor-pointer hover:bg-primary/95 text-center active:scale-95"
              >
                Choose PDF file
              </label>
              <span className="text-xs text-on-surface-variant font-medium select-none truncate">
                {file ? file.name : 'No reference sheet elected.'}
              </span>
            </div>
          </div>

          {/* Questions array mapper list */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Grading rubrics mapped ({questions.length})</span>
              <button 
                type="button" 
                onClick={handleAddQuestion}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span> Add Question
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={idx} className="p-4 bg-surface-container-low border border-outline-variant/25 rounded-2xl flex flex-col gap-4 text-left relative">
                  <button 
                    type="button"
                    onClick={() => handleRemoveQuestion(idx)}
                    className="absolute top-4 right-4 text-outline hover:text-error cursor-pointer"
                    title="Remove Question"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <Input 
                        label="Question Number" 
                        type="number"
                        value={q.questionNumber}
                        onChange={(e) => handleQuestionChange(idx, 'questionNumber', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        label="Evaluation Weight" 
                        type="number"
                        value={q.weight}
                        onChange={(e) => handleQuestionChange(idx, 'weight', Number(e.target.value))}
                        helperText="Available points for this item."
                        required
                      />
                    </div>
                  </div>

                  <Input 
                    label="Question Prompt" 
                    value={q.questionText}
                    onChange={(e) => handleQuestionChange(idx, 'questionText', e.target.value)}
                    placeholder="Enter the exam question text..."
                    required
                  />

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Expected Model Response Answer</label>
                    <textarea 
                      value={q.expectedAnswer}
                      onChange={(e) => handleQuestionChange(idx, 'expectedAnswer', e.target.value)}
                      placeholder="Input the reference response students will be matched against..."
                      className="px-4 py-2 border border-outline-variant/60 rounded-xl bg-white dark:bg-surface-container text-xs text-on-surface focus:outline-none focus:border-primary transition-colors min-h-[60px]"
                      required
                    />
                  </div>

                  <Input 
                    label="Rubrics keywords (comma segregated)" 
                    value={q.keywords}
                    onChange={(e) => handleQuestionChange(idx, 'keywords', e.target.value)}
                    placeholder="O(log n), index, tree, left smaller"
                    helperText="Crucial concept tags representing automated grade validations points."
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" isLoading={saving} className="w-full">
            Publish Answer Rubrics Map
          </Button>
        </form>
      </div>
    </div>
  );
};

export default FacultyUploadModel;
