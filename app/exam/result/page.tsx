'use client'

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getExamResult, sendReportEmail } from '@/app/lib/student-actions';

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
              setTimeout(() => {
                  router.push('/');
              }, 5000);
          } else {
              alert("Failed to queue report. Please try again.");
          }
      });
  };

  if (!result) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Calculating Score...</p>
    </div>
  );

  const isPass = result.status === 'Pass';
  const percentage = Math.round((result.score / result.totalQuestions) * 100) || 0;
  const breakdown = result.breakdown || [];

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4 md:p-8 font-sans">
       <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* --- LEFT SIDE: STATS & ANALYSIS (Span 7) --- */}
          <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* 1. Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center">
                      <span className="text-3xl font-black text-green-600 mb-1">{result.correctAnswers}</span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Right</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center">
                      <span className="text-3xl font-black text-red-600 mb-1">{result.wrongAnswers}</span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Wrong</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center">
                      <span className="text-3xl font-black text-gray-400 mb-1">{result.skippedAnswers}</span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Blank</span>
                  </div>
              </div>

              {/* 2. Progress Bar (MOVED UP) */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                      <span>Performance Score</span>
                      <span>{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isPass ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} 
                        style={{ width: `${percentage}%` }}
                      />
                  </div>
              </div>

              {/* 3. Question Analysis List (MOVED DOWN) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden min-h-[400px]">
                  <div className="p-5 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span>📊</span> Question Analysis
                      </h3>
                      <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                        {breakdown.length} Questions
                      </span>
                  </div>
                  
                  <div className="overflow-y-auto p-3 space-y-2 flex-1 max-h-[500px] custom-scrollbar bg-gray-50/30">
                      {breakdown.length === 0 ? (
                          <div className="text-center py-10 text-gray-400">No question data available.</div>
                      ) : (
                          breakdown.map((item: any) => {
                              // Design Logic based on your request: "1. Right", "2. Wrong"
                              let statusText = "Blank";
                              let statusColor = "text-gray-500";
                              let cardClass = "bg-white border-gray-200";
                              let icon = "⚪";

                              if (item.status === 'correct') {
                                  statusText = "Right";
                                  statusColor = "text-green-600";
                                  cardClass = "bg-green-50/50 border-green-200";
                                  icon = "✅";
                              } else if (item.status === 'wrong') {
                                  statusText = "Wrong";
                                  statusColor = "text-red-600";
                                  cardClass = "bg-red-50/50 border-red-200";
                                  icon = "❌";
                              }

                              return (
                                  <div key={item.number} className={`flex items-center justify-between p-3.5 rounded-xl border ${cardClass} shadow-sm transition-all`}>
                                      <div className="flex items-center gap-4">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border bg-white ${statusColor}`}>
                                              {item.number}
                                          </div>
                                          
                                          {/* Question Text Truncated */}
                                          <div className="flex flex-col">
                                              <span className="text-sm font-semibold text-gray-800 truncate w-40 md:w-64">
                                                  {item.questionText || `Question ${item.number}`}
                                              </span>
                                          </div>
                                      </div>

                                      {/* Status Label (Right / Wrong / Blank) */}
                                      <div className="flex items-center gap-3">
                                          <span className={`text-xs font-black uppercase tracking-wider ${statusColor}`}>
                                              {statusText}
                                          </span>
                                          <span className="text-lg">{icon}</span>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>
          </div>

          {/* --- RIGHT SIDE: REPORT CARD (Span 5) --- */}
          <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col h-full relative sticky top-6">
                  
                  {/* Status Banner */}
                  <div className={`h-32 w-full flex items-center justify-center ${isPass ? 'bg-gradient-to-b from-green-500 to-green-600' : 'bg-gradient-to-b from-red-500 to-red-600'}`}>
                      <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                          <span className="text-6xl">{isPass ? '🏆' : '👎'}</span>
                      </div>
                  </div>

                  <div className="p-8 flex flex-col items-center flex-1 -mt-10">
                      
                      <div className="bg-white px-8 py-2 rounded-full shadow-lg border border-gray-100 mb-6">
                          <h2 className={`text-2xl font-black tracking-tight ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                             {result.status.toUpperCase()}
                          </h2>
                      </div>
                      
                      {/* Score Box */}
                      <div className="w-full bg-gray-50 rounded-2xl p-6 border border-gray-200 text-center mb-4">
                          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-2">Total Score</p>
                          <div className="flex items-baseline justify-center gap-1">
                              <span className="text-5xl font-extrabold text-gray-900">{result.score}</span>
                              <span className="text-2xl font-medium text-gray-400">/ {result.totalQuestions}</span>
                          </div>
                      </div>

                      {/* Percentage Box */}
                      <div className={`w-full p-5 rounded-xl border mb-8 text-center ${isPass ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                          <p className="text-xs font-bold uppercase opacity-70 mb-1">Your Percentage</p>
                          <p className="text-4xl font-black">{percentage}%</p>
                      </div>

                      {/* Generate Report Button */}
                      {isEmailSent ? (
                          <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl flex flex-col items-center animate-fade-in text-center shadow-sm">
                              <span className="text-2xl mb-1">📩</span>
                              <p className="font-bold">Report Sent Successfully!</p>
                              <p className="text-xs mt-1 opacity-80">Redirecting home...</p>
                          </div>
                      ) : (
                          <button 
                            onClick={handleGenerateReport} 
                            disabled={isPending}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 hover:shadow-xl transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer active:scale-95 group"
                          >
                            {isPending ? (
                                <span>Sending...</span> 
                            ) : (
                                <>
                                    <span>Generate Detailed Report</span>
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </>
                            )}
                          </button>
                      )}
                  </div>

                  {/* Footer Details */}
                  <div className="bg-gray-50 p-6 text-sm text-gray-600 space-y-3 border-t border-gray-200">
                      <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                         <span className="text-gray-400 font-medium">Student</span> 
                         <span className="font-bold text-gray-800">{result.studentName}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                         <span className="text-gray-400 font-medium">Access ID</span> 
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