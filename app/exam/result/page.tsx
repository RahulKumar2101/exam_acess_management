'use client'

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getExamResult } from '@/app/lib/student-actions'; // You need to add this to student-actions

function ResultContent() {
  const searchParams = useSearchParams();
  const accessCode = searchParams.get('code');
  const [result, setResult] = useState<any>(null);

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

  if (!result) return <div className="h-screen flex items-center justify-center font-bold text-gray-500">Generating Report...</div>;

  const isPass = result.status === 'Pass';

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-6">
       <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden">
          
          {/* Header */}
          <div className="text-center p-8 border-b border-gray-100">
             <h1 className="text-2xl font-bold text-gray-900">Exam Report Card</h1>
             <p className="text-gray-500 text-sm mt-1">Official Exam Results Certificate</p>
          </div>

          <div className="p-8 space-y-8">
             
             {/* Student Info */}
             <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Student Information</h3>
                <div className="bg-gray-50 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Name</p>
                      <p className="font-semibold text-gray-800">{result.studentName}</p>
                   </div>
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Email</p>
                      <p className="font-semibold text-gray-800">{result.studentEmail}</p>
                   </div>
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Phone</p>
                      <p className="font-semibold text-gray-800">{result.studentPhone}</p>
                   </div>
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Submitted At</p>
                      <p className="font-semibold text-gray-800">{new Date(result.submittedAt).toLocaleString()}</p>
                   </div>
                </div>
             </div>

             {/* Exam Details */}
             <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Exam Details</h3>
                <div className="bg-gray-50 rounded-xl p-5 flex justify-between text-sm">
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Question Bank</p>
                      <p className="font-semibold text-gray-800">{result.examTitle}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {isPass ? 'COMPLETED' : 'FAILED'}
                      </span>
                   </div>
                </div>
             </div>

             {/* Results Summary */}
             <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Results Summary</h3>
                <div className={`rounded-xl p-6 border-2 ${isPass ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex justify-center mb-4">
                       {isPass ? (
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl">✓</div>
                       ) : (
                          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl">✕</div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center mb-6">
                       <div>
                          <p className="text-gray-500 text-xs font-bold uppercase">Score</p>
                          <p className={`text-2xl font-bold ${isPass ? 'text-green-600' : 'text-red-600'}`}>{result.score}</p>
                       </div>
                       <div>
                          <p className="text-gray-500 text-xs font-bold uppercase">Questions</p>
                          <p className="text-2xl font-bold text-gray-700">{result.totalQuestions}</p>
                       </div>
                       <div>
                          <p className="text-gray-500 text-xs font-bold uppercase">Grade</p>
                          <p className={`text-2xl font-bold ${isPass ? 'text-green-600' : 'text-red-600'}`}>
                             {isPass ? 'Pass' : 'Fail'}
                          </p>
                       </div>
                    </div>
                    
                    <div className="text-center">
                        <span className={`px-6 py-2 rounded-lg font-bold text-white ${isPass ? 'bg-green-600' : 'bg-red-600'}`}>
                           Final Status: {isPass ? 'PASS' : 'FAIL'}
                        </span>
                    </div>
                </div>
             </div>

             {/* Supervisor Info */}
             <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Supervisor Information</h3>
                <div className="bg-gray-50 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Supervisor Name</p>
                      <p className="font-semibold text-gray-800">{result.supervisorName || 'N/A'}</p>
                   </div>
                   <div>
                      <p className="text-gray-400 text-xs uppercase font-bold mb-1">Supervisor Email</p>
                      <p className="font-semibold text-gray-800">{result.supervisorEmail || 'N/A'}</p>
                   </div>
                </div>
             </div>

             <div className="text-center pt-8 border-t border-gray-100">
                <p className="text-xs text-gray-400">Generated on: {new Date().toLocaleString()}</p>
                <p className="text-xs text-gray-400">Powered by ExamPortal</p>
             </div>

          </div>
       </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div>Loading Report...</div>}>
      <ResultContent />
    </Suspense>
  )
}