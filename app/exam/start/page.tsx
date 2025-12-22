'use client'

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchExamContent, submitExam } from '@/app/lib/student-actions';

// Define shape including translation fields
type Question = { 
  id: string; 
  text: string; 
  options: string[]; 
  marks: number; 
  translatedText?: string; 
  translatedOptions?: string[] 
};

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const accessCode = searchParams.get('code');
  const examId = searchParams.get('examId');
  const lang = searchParams.get('lang'); 
  
  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState<{ title: string; durationMin: number; questions: Question[] } | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({}); 
  const [timeLeft, setTimeLeft] = useState(0); 
  const [isSubmitting, startTransition] = useTransition();

  // 1. Load Exam Content
  useEffect(() => {
    if(!accessCode) return;
    
    async function load() {
        // Fetch exam content with translation target language
        const result = await fetchExamContent(accessCode!, examId || undefined, lang || undefined);
        
        // ✅ SECURITY CHECK: If exam is already done, redirect to result immediately
        // @ts-ignore (ignoring strict type check for the dynamic flag)
        if (result.isCompleted) {
            router.push(`/exam/result?code=${accessCode}`);
            return;
        }

        if (result.success && result.exam) {
            setExamData(result.exam);
            setTimeLeft(result.exam.durationMin * 60); 
        } else {
            alert(result.message || "Failed to load exam.");
            router.push('/'); 
        }
        setLoading(false);
    }
    load();
  }, [accessCode, examId, lang, router]);

  // 2. Timer Logic
  useEffect(() => {
    if (!timeLeft || timeLeft <= 0) return;
    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                clearInterval(timer);
                handleSubmit(); 
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (qId: string, optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  // 3. Submit Handler -> Redirect to Report Card
  const handleSubmit = async () => {
    if(!confirm("Are you sure you want to finish the exam?")) return;
    if (!examId) { alert("Error: Exam ID missing."); return; }

    startTransition(async () => {
        const result = await submitExam(accessCode!, answers, examId);
        
        if(result.success) {
            // Redirect to the Result Page (Report Card)
            router.push(`/exam/result?code=${accessCode}`);
        } else {
            alert("Submission failed. Please try again.");
        }
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-blue-600 font-bold">Loading Assessment...</div>;
  if (!examData) return null;

  const currentQ = examData.questions[currentQIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
       
       {/* Header */}
       <div className="w-full max-w-4xl flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
             <span className="text-xl">🛡️</span>
             <h1 className="font-bold text-gray-800 text-lg">ExamPortal</h1>
          </div>
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-mono font-bold">
             {formatTime(timeLeft)}
          </div>
       </div>

       {/* Main Question Card */}
       <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-4xl overflow-hidden flex flex-col min-h-[500px]">
          
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
             <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase">Question {currentQIndex + 1} of {examData.questions.length}</span>
             <span className="text-blue-600 text-xs font-bold uppercase border border-blue-100 px-2 py-1 rounded">MCQ</span>
          </div>

          <div className="p-8 flex-1">
             {/* English Question */}
             <h2 className="text-xl font-bold text-gray-900 leading-snug">
                {currentQ.text}
             </h2>

             {/* Translated Question */}
             {currentQ.translatedText && (
                <h3 className="text-lg font-medium text-blue-700 mt-3 italic border-l-4 border-blue-200 pl-3">
                   {currentQ.translatedText}
                </h3>
             )}

             <div className="space-y-4 mt-8">
                {currentQ.options.map((opt, idx) => (
                   <div 
                      key={idx}
                      onClick={() => handleOptionSelect(currentQ.id, idx)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                         answers[currentQ.id] === idx 
                         ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' 
                         : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                   >
                      <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 mt-0.5 rounded-full border flex items-center justify-center shrink-0 ${
                             answers[currentQ.id] === idx ? 'border-blue-600' : 'border-gray-400'
                          }`}>
                             {answers[currentQ.id] === idx && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                          </div>
                          
                          <div className="flex flex-col w-full">
                              <span className={`font-medium ${answers[currentQ.id] === idx ? 'text-blue-900' : 'text-gray-700'}`}>
                                 {opt}
                              </span>
                              
                              {currentQ.translatedOptions && currentQ.translatedOptions[idx] && (
                                  <span className="text-sm text-blue-600 italic mt-1">
                                     {currentQ.translatedOptions[idx]}
                                  </span>
                              )}
                          </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Footer / Pagination */}
          <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
             <button 
                onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQIndex === 0}
                className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-white disabled:opacity-50"
             >
                Previous
             </button>

             {/* ✅ UPDATED PAGINATION LOGIC (Green = Answered, Yellow = Skipped, Blue = Current) */}
             <div className="flex gap-2 overflow-x-auto max-w-[200px] no-scrollbar px-2">
                {examData.questions.map((q, i) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isCurrent = i === currentQIndex;
                    
                    // Determine "Furthest Reached" to detect skips
                    // A question is skipped if it's empty AND index is < max(currentIndex, anyAnsweredIndex)
                    const answeredIndices = Object.keys(answers).map(k => examData.questions.findIndex(Eq => Eq.id === k));
                    const maxReached = Math.max(currentQIndex, ...answeredIndices, 0);
                    const isSkipped = !isAnswered && !isCurrent && i < maxReached;

                    let btnClass = 'bg-gray-200 text-gray-500'; // Default
                    
                    if (isCurrent) {
                        btnClass = 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-100';
                    } else if (isAnswered) {
                        btnClass = 'bg-green-100 text-green-700 border border-green-200';
                    } else if (isSkipped) {
                        btnClass = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                    }

                    return (
                        <button 
                           key={i} 
                           onClick={() => setCurrentQIndex(i)}
                           className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all ${btnClass}`}
                        >
                           {i + 1}
                        </button>
                    );
                })}
             </div>

             {currentQIndex === examData.questions.length - 1 ? (
                 <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                 </button>
             ) : (
                 <button onClick={() => setCurrentQIndex(prev => prev + 1)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                    Next
                 </button>
             )}
          </div>
       </div>

       {/* Exam Status Footer Alert */}
       <div className="mt-6 w-full max-w-4xl bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <div className="text-blue-600 mt-0.5">
             <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
             <h4 className="text-sm font-bold text-blue-900">Exam Status</h4>
             <p className="text-sm text-blue-700">You have answered {Object.keys(answers).length} out of {examData.questions.length} questions.</p>
          </div>
       </div>

    </div>
  );
}

export default function ExamInterface() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold text-blue-600">Loading Assessment...</div>}>
      <ExamContent />
    </Suspense>
  )
}