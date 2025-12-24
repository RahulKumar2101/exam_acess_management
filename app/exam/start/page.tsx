'use client'

import { useEffect, useState, useTransition, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchExamContent, submitExam } from '@/app/lib/student-actions';

type Question = { 
  id: string; 
  text: string; 
  options: string[]; 
  marks: number; 
  translatedText?: string | null; 
  translatedOptions?: string[] | null; 
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
  
  // ✅ NEW: Track visited questions to handle the "Red" logic
  const [visited, setVisited] = useState<number[]>([0]); 

  const [timeLeft, setTimeLeft] = useState(0); 
  const [isSubmitting, startTransition] = useTransition();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Exam Content
  useEffect(() => {
    if(!accessCode) return;
    
    async function load() {
        const result = await fetchExamContent(accessCode!, examId || undefined, lang || undefined);
        
        // @ts-ignore
        if (result.isCompleted) {
            router.push(`/exam/result?code=${accessCode}`);
            return;
        }

        if (result.success && result.exam) {
            // @ts-ignore
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

  // ✅ NEW: Update 'visited' array whenever current question changes
  useEffect(() => {
    if (!visited.includes(currentQIndex)) {
        setVisited(prev => [...prev, currentQIndex]);
    }
  }, [currentQIndex]);

  // 2. Timer Logic
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                handleForceSubmit(); 
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (qId: string, optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleForceSubmit = () => {
      if (!examId) return;
      startTransition(async () => {
          await submitExam(accessCode!, answers, examId);
          router.push(`/exam/result?code=${accessCode}`);
      });
  };

  const handleSubmit = async () => {
    if(!confirm("Are you sure you want to finish the exam?")) return;
    if (!examId) { alert("Error: Exam ID missing."); return; }

    startTransition(async () => {
        const result = await submitExam(accessCode!, answers, examId);
        if(result.success) {
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center font-sans">
       
       {/* Header */}
       <div className="w-full max-w-5xl flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
             <span className="text-xl">🛡️</span>
             <h1 className="font-bold text-gray-800 text-lg">ExamPortal</h1>
          </div>
          <div className={`px-4 py-2 rounded-lg font-mono font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
             {formatTime(timeLeft)}
          </div>
       </div>

       <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-6">
           
           {/* LEFT COLUMN: Question Card */}
           <div className="lg:col-span-3 flex flex-col">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
                  
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                     <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase">Question {currentQIndex + 1} of {examData.questions.length}</span>
                     <span className="text-blue-600 text-xs font-bold uppercase border border-blue-100 px-2 py-1 rounded">MCQ</span>
                  </div>

                  <div className="p-8 flex-1">
                     <h2 className="text-xl font-bold text-gray-900 leading-snug">
                        {currentQ.text}
                     </h2>

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

                  {/* Navigation Buttons (Prev/Next) */}
                  <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                     <button 
                        onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQIndex === 0}
                        className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-white disabled:opacity-50 cursor-pointer transition-colors"
                     >
                        Previous
                     </button>

                     {currentQIndex === examData.questions.length - 1 ? (
                         <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-95">
                            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                         </button>
                     ) : (
                         <button onClick={() => setCurrentQIndex(prev => prev + 1)} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 cursor-pointer transition-all active:scale-95">
                            Next
                         </button>
                     )}
                  </div>
               </div>
           </div>

           {/* RIGHT COLUMN: Question Palette */}
           <div className="lg:col-span-1">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sticky top-6">
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                       Question Palette
                       <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Total: {examData.questions.length}</span>
                   </h3>
                   
                   <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto pr-1">
                        {examData.questions.map((q, i) => {
                           const isAnswered = answers[q.id] !== undefined;
                           const isCurrent = i === currentQIndex;
                           const isVisited = visited.includes(i); // Check if we have been here
                           
                           // ✅ UPDATED COLOR LOGIC
                           // 1. Default: Not Visited (Gray)
                           let btnClass = 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'; 
                           
                           // 2. Visited but NOT Answered (Red)
                           if (isVisited && !isAnswered) {
                               btnClass = 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100';
                           }

                           // 3. Answered (Green - Overrides Red)
                           if (isAnswered) {
                               btnClass = 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200';
                           }
                           
                           // 4. Current (Blue - Overrides everything)
                           if (isCurrent) {
                               btnClass = 'bg-blue-600 text-white shadow-md ring-2 ring-blue-100 border-blue-600';
                           }

                           return (
                               <button 
                                  key={i} 
                                  onClick={() => setCurrentQIndex(i)}
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-all cursor-pointer ${btnClass}`}
                               >
                                  {i + 1}
                               </button>
                           );
                        })}
                   </div>

                   <div className="mt-6 space-y-2 border-t border-gray-100 pt-4">
                       <div className="flex items-center gap-2 text-xs text-gray-600">
                           <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div> Answered
                       </div>
                       <div className="flex items-center gap-2 text-xs text-gray-600">
                           <div className="w-4 h-4 rounded bg-red-50 border border-red-200"></div> Skipped / Not Answered
                       </div>
                       <div className="flex items-center gap-2 text-xs text-gray-600">
                           <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div> Not Visited
                       </div>
                       <div className="flex items-center gap-2 text-xs text-gray-600">
                           <div className="w-4 h-4 rounded bg-blue-600"></div> Current
                       </div>
                   </div>
               </div>
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