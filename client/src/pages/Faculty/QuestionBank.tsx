import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';

interface QuestionDetails {
  id: string;
  number: number;
  text: string;
  weight: number;
  expectedConcept: string;
  bloomsLevel: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export const QuestionBank: React.FC = () => {
  const { addToast } = useNotifications();
  const [questions, setQuestions] = useState<QuestionDetails[]>([
    { id: 'q-ds-1', number: 1, text: 'Define Time Complexity and give an example of O(n log n) runtime complexity.', weight: 10, expectedConcept: 'Computational time, Heap/Merge sort example', bloomsLevel: 'Remember', difficulty: 'Easy' },
    { id: 'q-ds-2', number: 2, text: 'Explain the structural differences between a Stack and a Queue.', weight: 10, expectedConcept: 'LIFO vs FIFO structures', bloomsLevel: 'Understand', difficulty: 'Easy' },
    { id: 'q-ds-3', number: 3, text: 'Write a pseudocode for Binary Search on a sorted array.', weight: 15, expectedConcept: 'Divide & Conquer binary search indices', bloomsLevel: 'Apply', difficulty: 'Medium' }
  ]);

  const [text, setText] = useState('');
  const [weight, setWeight] = useState(10);
  const [concept, setConcept] = useState('');
  const [blooms, setBlooms] = useState('Understand');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !concept.trim()) {
      addToast('Please input question body and expected AI concepts.', 'warning');
      return;
    }

    const newQ: QuestionDetails = {
      id: `q-gen-${questions.length + 1}`,
      number: questions.length + 1,
      text: text.trim(),
      weight,
      expectedConcept: concept.trim(),
      bloomsLevel: blooms,
      difficulty
    };

    setQuestions([...questions, newQ]);
    setText('');
    setConcept('');
    addToast('Question successfully registered in subject syllabus bank.', 'success');
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">Question Bank Editor</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure individual exam questions, assign weight variables, and define AI key concepts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left add question form */}
        <div className="glass-card p-6 rounded-2xl border border-outline-variant/20 h-fit">
          <h3 className="text-sm font-bold text-on-surface mb-4">Add New Question</h3>
          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Question Description Text *</label>
              <textarea 
                placeholder="Write your exam question detail..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Expected Key Concepts (for NLP Semantic Comparison) *</label>
              <input 
                type="text" 
                placeholder="Keywords, formulas, specific algorithm name"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Score weight</label>
                <input 
                  type="number" 
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Cognitive Level</label>
                <select
                  value={blooms}
                  onChange={(e) => setBlooms(e.target.value)}
                  className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
                >
                  <option value="Remember">Remember</option>
                  <option value="Understand">Understand</option>
                  <option value="Apply">Apply</option>
                  <option value="Analyze">Analyze</option>
                  <option value="Evaluate">Evaluate</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-outline uppercase tracking-wider">Difficulty Setting</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/30 text-xs focus:outline-none"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <button 
              type="submit"
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-xs font-black transition-all hover:bg-primary/95 active:scale-95 cursor-pointer"
            >
              Add to Active Bank
            </button>
          </form>
        </div>

        {/* Right lists */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant/20 overflow-hidden bg-white dark:bg-surface-container flex flex-col">
          <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low">
            <h3 className="font-bold text-sm">Subject Question Pool</h3>
          </div>
          
          <div className="divide-y divide-outline-variant/10">
            {questions.map((q) => (
              <div key={q.id} className="p-6 text-left flex gap-4 items-start hover:bg-slate-50 dark:hover:bg-surface-container-low transition-colors">
                <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  Q{q.number}
                </span>

                <div className="flex-grow space-y-2">
                  <h4 className="text-xs font-bold text-on-surface leading-relaxed">{q.text}</h4>
                  <p className="text-[10px] text-outline">
                    💡 <b>AI Expectation:</b> <span className="italic">{q.expectedConcept}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-[9px] font-extrabold uppercase mt-1">
                    <span className="px-2 py-0.5 bg-outline-variant/30 text-outline rounded">
                      {q.weight} Marks
                    </span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                      Bloom: {q.bloomsLevel}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${
                      q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuestionBank;
