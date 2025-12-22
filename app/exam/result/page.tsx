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

  if (!result) return <div className="h-screen flex items-center justify-center font-bold text-gray-500">Generating Report...</div>;

  const isPass = result.status === 'Pass';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-6 font-sans">
       <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden border border-gray-200">
          
          {/* --- LEFT: QUESTION REVIEW LIST (Simulated) --- */}
          <div className="w-full md:w-1/2 p-8 bg-gray-50/50 border-r border-gray-100 flex flex-col">
             <h2 className="text-xl font-bold text-gray-800 mb-6">Question Analysis</h2>
             
             <div className="flex-1 overflow-y-auto pr-2 max-h-[500px] custom-scrollbar space-y-3">
                {Array.from({ length: result.totalQuestions }).map((_, i) => {
                    // Logic: Show Green for correct answers count, Red for the rest
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
                 <span>Total: {result.totalQuestions}</span>
                 <span>Score: {result.score}</span>
             </div>
          </div>

          {/* --- RIGHT: REPORT CARD & GENERATE BUTTON --- */}
          <div className="w-full md:w-1/2 p-8 flex flex-col justify-center items-center text-center bg-white">
             
             <div className="mb-8 w-full border-b border-gray-100 pb-6">
                <h1 className="text-2xl font-bold text-gray-900">Exam Result</h1>
                <p className="text-gray-500 text-sm mt-1">{result.examTitle}</p>
             </div>

             <div className={`w-28 h-28 rounded-full flex items-center justify-center text-6xl mb-6 shadow-md ${isPass ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {isPass ? '🏆' : '⚠️'}
             </div>

             <h1 className={`text-5xl font-extrabold mb-2 tracking-tight ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                {result.status.toUpperCase()}
             </h1>
             
             <p className="text-gray-500 text-lg mb-8">
                You scored <span className="font-bold text-gray-900">{result.score}</span> out of <span className="font-bold text-gray-900">{result.totalQuestions}</span>
             </p>

             {/* GENERATE REPORT BUTTON */}
             {isEmailSent ? (
                 <div className="w-full bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex flex-col items-center animate-fade-in">
                     <span className="text-2xl mb-2">📩</span>
                     <p className="font-bold">Report Sent Successfully!</p>
                     <p className="text-xs mt-1 opacity-80">Check your email (and spam folder).</p>
                 </div>
             ) : (
                 <button 
                    onClick={handleGenerateReport} 
                    disabled={isPending}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                    {isPending ? (
                        <span>Sending Report...</span>
                    ) : (
                        <>
                            <span className="text-xl">📄</span>
                            <span>Generate Report</span>
                        </>
                    )}
                 </button>
             )}
             
             {!isEmailSent && (
                 <p className="text-xs text-gray-400 mt-4 max-w-xs leading-relaxed">
                    Clicking this will send a detailed official report to You, your Supervisor, and the Admin.
                 </p>
             )}

             {/* Student Info Footer */}
             <div className="mt-auto w-full pt-8 text-sm text-gray-400 border-t border-gray-100 flex justify-between">
                 <span>Student: {result.studentName}</span>
                 <span>{new Date(result.submittedAt).toLocaleDateString()}</span>
             </div>
          </div>

       </div>
    </div>
  );
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center font-bold text-blue-600">Loading Result...</div>}>
            <ResultContent />
        </Suspense>
    )
}