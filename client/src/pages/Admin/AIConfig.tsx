import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import Button from '../../components/ui/Button';

export const AdminAIConfig: React.FC = () => {
  const { addToast } = useNotifications();

  const [ocrConfidence, setOcrConfidence] = useState(85);
  const [gptTemperature, setGptTemperature] = useState(0.2);
  const [similarityThreshold, setSimilarityThreshold] = useState(25);
  
  const [saving, setSaving] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      addToast('AI evaluation neural parameters updated.', 'success');
    }, 600);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-on-surface font-display">AI Tuning Configuration</h2>
        <p className="text-sm text-on-surface-variant mt-1">Adjust stroke spline digitizer parameters, HWR confidence, and LLM semantic similarity margins.</p>
      </div>

      <div className="glass-card p-6 md:p-8 rounded-2xl border-outline-variant/30 flex flex-col gap-6 bg-white dark:bg-surface-container">
        <form onSubmit={handleSaveConfig} className="flex flex-col gap-6">
          
          {/* Slider 1 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold font-display select-none">
              <span className="text-on-surface uppercase">HWR Spline Stroke Precision</span>
              <span className="text-primary font-mono">{ocrConfidence}% Match</span>
            </div>
            <input 
              type="range" 
              min={50} 
              max={100} 
              value={ocrConfidence} 
              onChange={(e) => setOcrConfidence(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-outline-variant/30 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-outline">Minimum handwriting spline matching precision. Paths matching below this error bounds are flagged for verification.</p>
          </div>

          {/* Slider 2 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold font-display select-none">
              <span className="text-on-surface uppercase">LLM Grading Temperature variance</span>
              <span className="text-primary font-mono">T = {gptTemperature}</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={1} 
              step={0.1}
              value={gptTemperature} 
              onChange={(e) => setGptTemperature(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-outline-variant/30 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-outline">Controls scoring creativity. Lower temperatures check concepts and formulas strictly.</p>
          </div>

          {/* Slider 3 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold font-display select-none">
              <span className="text-on-surface uppercase">Semantic concept overlap threshold</span>
              <span className="text-primary font-mono">{similarityThreshold}% Overlap</span>
            </div>
            <input 
              type="range" 
              min={5} 
              max={90} 
              value={similarityThreshold} 
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-outline-variant/30 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-outline">Percentage overlap of designated keywords and parameters required to qualify for partial marks matching.</p>
          </div>

          <Button type="submit" isLoading={saving} className="w-full">
            Apply AI Hyperparameters
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminAIConfig;
