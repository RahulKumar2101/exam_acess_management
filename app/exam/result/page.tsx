'use client'

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // ✅ Added useRouter
import { getExamResult, sendReportEmail } from '@/app/lib/student-actions';

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter(); // ✅ Initialize Router
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

  // ✅ Button Handler with Redirect Logic
  const handleGenerateReport = () => {
      startTransition(async () => {
          const res = await sendReportEmail(accessCode!);
          if(res.success) {
              setIsEmailSent(true);
              
              // ⏳ Redirect to Home after 5 seconds
              setTimeout(() => {
                  router.push('/');
              }, 5000);
              
          } else {
              alert("Failed to queue report. Please try again.");
          }
      });
  };

  if (!result) return <div className="h-screen flex items-center justify-center font-bold text-gray-500">Generating Result...</div>;

  const isPass = result.status === 'Pass';
  const percentage = Math.round((result.correctAnswers / result.totalQuestions) * 100) || 0;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-6 font-sans">
       <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* --- LEFT: PERFORMANCE SUMMARY --- */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 flex flex-col justify-center items-center h-full">
              <h2 className="text-xl font-bold text-gray-800 mb-8">Performance Summary</h2>
              
              <div className="grid grid-cols-2 gap-6 w-full mb-8">
                  <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-center shadow-sm">
                     <div className="text-4xl font-extrabold text-green-600 mb-1">{result.correctAnswers}</div>
                     <div className="text-xs text-green-800 font-bold uppercase tracking-wide">Correct</div>
                  </div>
                  <div className="p-6 bg-red-50 rounded-2xl border border-red-100 text-center shadow-sm">
                     <div className="text-4xl font-extrabold text-red-600 mb-1">{result.wrongAnswers}</div>
                     <div className="text-xs text-red-800 font-bold uppercase tracking-wide">Wrong</div>
                  </div>
              </div>
              
              <div className="w-full mb-2">
                 <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                     <span>Score Progress</span>
                     <span>{percentage}%</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-1000 ease-out ${isPass ? 'bg-green-500' : 'bg-red-500'}`} 
                        style={{ width: `${percentage}%` }}
                     />
                 </div>
              </div>
              <p className="text-center text-sm text-gray-400 mt-6">
                 You answered {result.correctAnswers} out of {result.totalQuestions} questions correctly.
              </p>
          </div>

          {/* --- RIGHT: OFFICIAL REPORT CARD --- */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
              
              <div className="text-center p-8 border-b border-gray-100 bg-gray-50/50">
                 <h1 className="text-2xl font-bold text-gray-900">Exam Result</h1>
                 <p className="text-gray-500 text-sm mt-1">{result.examTitle}</p>
              </div>

              <div className="p-8 flex flex-col items-center flex-1 justify-center">
                 <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-sm ${isPass ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {isPass ? '🏆' : '⚠️'}
                 </div>
                 
                 <h2 className={`text-4xl font-extrabold tracking-tight mb-2 ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                    {result.status.toUpperCase()}
                 </h2>
                 
                 <div className="flex items-center gap-2 mt-2 mb-8">
                    <span className="text-gray-500 text-lg">Total Score:</span>
                    <span className="text-2xl font-bold text-gray-900">{result.score} <span className="text-gray-400 text-lg">/ {result.totalQuestions}</span></span>
                 </div>

                 {/* ✅ GENERATE REPORT BUTTON with Redirect Logic */}
                 {isEmailSent ? (
                     <div className="w-full bg-blue-50 border border-blue-100 text-blue-700 p-4 rounded-xl flex flex-col items-center animate-fade-in text-center">
                         <span className="text-2xl mb-1">📩</span>
                         <p className="font-bold">Report Sent!</p>
                         <p className="text-xs mt-1 opacity-80">Redirecting to Home in 5s...</p>
                     </div>
                 ) : (
                     <button 
                        onClick={handleGenerateReport} 
                        disabled={isPending}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                     >
                        {isPending ? (
                            <span>Sending...</span>
                        ) : (
                            <>
                                <span>📄 Generate Detailed Report</span>
                            </>
                        )}
                     </button>
                 )}
              </div>

              <div className="bg-gray-50 p-6 text-sm text-gray-600 space-y-3 border-t border-gray-100">
                 <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-400 font-medium">Student</span> 
                    <span className="font-bold text-gray-800">{result.studentName}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-400 font-medium">ID</span> 
                    <span className="font-bold text-gray-800 font-mono">{accessCode}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Date</span> 
                    <span className="font-bold text-gray-800">{new Date(result.submittedAt).toLocaleDateString()}</span>
                 </div>
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