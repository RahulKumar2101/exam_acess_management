'use client'

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getExamResult, sendReportEmail } from '@/app/lib/student-actions';

function ResultContent() {
  const searchParams = useSearchParams();
  const accessCode = searchParams.get('code');
  
  const [result, setResult] = useState<any>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 1. Fetch Result on Load
  useEffect(() => {
    if(!accessCode) return;
    async function fetchResult() {
        const res = await getExamResult(accessCode!);
        if(res.success) {
            setResult(res.data);
        }
    }
    fetchResult();
  }, [accessCode]);

  // 2. Handle "Generate Report" Click
  const handleGenerateReport = () => {
      startTransition(async () => {
          const res = await sendReportEmail(accessCode!);
          if(res.success) {
              setIsEmailSent(true);
          } else {
              alert("Failed to send report. Please try again.");
          }
      });
  };

  if (!result) return <div className="h-screen flex items-center justify-center font-bold text-blue-600">Loading Result...</div>;

  const isPass = result.status === 'Pass';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-6 font-sans">
       <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden border border-gray-200">
          
          {/* --- LEFT: VISUAL SUMMARY --- */}
          <div className="w-full md:w-1/2 p-8 bg-gray-50/50 border-r border-gray-100 flex flex-col">
             <h2 className="text-xl font-bold text-gray-800 mb-6">Performance Summary</h2>
             
             {/* Scrollable list of Question Results (Visual Representation) */}
             <div className="flex-1 overflow-y-auto pr-2 max-h-[500px] custom-scrollbar space-y-3">
                {Array.from({ length: result.totalQuestions }).map((_, i) => {
                    // Visual Logic: Display green checks for the number of correct answers
                    const isCorrect = i < result.correctAnswers;
                    return (
                        <div key={i} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <span className="font-bold text-gray-700">Question {i + 1}</span>
                            {isCorrect ? (
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                    <span className="text-lg">✓</span> 
                                    <span className="text-xs font-bold uppercase tracking-wide">Correct</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                                    <span className="text-lg">✕</span> 
                                    <span className="text-xs font-bold uppercase tracking-wide">Wrong</span>
                                </div>
                            )}
                        </div>
                    );
                })}
             </div>
             
             <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
                 <span>Total Questions: {result.totalQuestions}</span>
                 <span>Your Score: {result.score}</span>
             </div>
          </div>

          {/* --- RIGHT: REPORT CARD & ACTION --- */}
          <div className="w-full md:w-1/2 p-8 flex flex-col justify-center items-center text-center bg-white">
             
             <div className="mb-8 w-full border-b border-gray-100 pb-6">
                <h1 className="text-3xl font-extrabold text-gray-900">Exam Result</h1>
                <p className="text-gray-500 text-sm mt-2">{result.examTitle}</p>
             </div>

             <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl mb-6 shadow-xl transition-all ${isPass ? 'bg-green-100 text-green-600 ring-8 ring-green-50' : 'bg-red-100 text-red-600 ring-8 ring-red-50'}`}>
                {isPass ? '🏆' : '⚠️'}
             </div>

             <h1 className={`text-6xl font-black mb-2 tracking-tight ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                {result.status.toUpperCase()}
             </h1>
             
             <p className="text-gray-500 text-lg mb-8 font-medium">
                You scored <span className="font-bold text-gray-900">{result.score}</span> / <span className="font-bold text-gray-900">{result.totalQuestions}</span>
             </p>

             {/* GENERATE REPORT BUTTON */}
             {isEmailSent ? (
                 <div className="w-full bg-green-50 border border-green-200 text-green-700 p-6 rounded-2xl flex flex-col items-center animate-fade-in shadow-inner">
                     <span className="text-3xl mb-2">📩</span>
                     <p className="font-bold text-lg">Report Sent!</p>
                     <p className="text-sm mt-1 opacity-80">Check your email for the detailed breakdown.</p>
                 </div>
             ) : (
                 <button 
                    onClick={handleGenerateReport} 
                    disabled={isPending}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                 >
                    {isPending ? (
                        <span>Sending Report...</span>
                    ) : (
                        <>
                            <span className="text-2xl">📄</span>
                            <span>Generate Detailed Report</span>
                        </>
                    )}
                 </button>
             )}
             
             {!isEmailSent && (
                 <p className="text-xs text-gray-400 mt-6 max-w-xs leading-relaxed">
                    Clicking this will send a detailed PDF-style report to You, your Supervisor, and the Admin.
                 </p>
             )}

             {/* Footer Info */}
             <div className="mt-auto w-full pt-8 text-xs text-gray-400 border-t border-gray-100 flex justify-between uppercase tracking-wider font-semibold">
                 <span>{result.studentName}</span>
                 <span>{new Date(result.submittedAt).toLocaleDateString()}</span>
             </div>
          </div>

       </div>
    </div>
  );
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold text-blue-600">Loading...</div>}>
            <ResultContent />
        </Suspense>
    )
}