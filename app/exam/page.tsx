'use client'

import { useState, useTransition } from 'react';
import { validateAndRegisterStudent, sendAdminNotification, getAvailableExams } from '@/app/lib/student-actions';
import { useRouter } from 'next/navigation';

export default function StudentExamPortal() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  
  // ✅ State includes Supervisor fields
  const [formData, setFormData] = useState({
    fullName: '', 
    companyName: '', 
    email: '', 
    phone: '', 
    supName: '', 
    supEmail: '' 
  });
  
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [selectedLang, setSelectedLang] = useState('English');
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  
  const [isPending, startTransition] = useTransition();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // STEP 1: Info & Email
  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.phone || !formData.companyName) {
        setError("Please fill in all required fields.");
        return;
    }
    setError('');
    setIsSendingEmail(true);

    startTransition(async () => {
        const payload = new FormData();
        Object.entries(formData).forEach(([k, v]) => payload.append(k, v));
        
        await sendAdminNotification(payload);

        setIsSendingEmail(false);
        setStep(2); 
    });
  };

  // STEP 2: Verify Code
  const handleCodeSubmit = async () => {
    setError('');
    startTransition(async () => {
        const payload = new FormData();
        payload.append('accessCode', accessCode);
        payload.append('companyName', formData.companyName); 
        Object.entries(formData).forEach(([k, v]) => payload.append(k, v));

        const result = await validateAndRegisterStudent(payload);

        if (!result.success) {
            setError(result.message || 'Error validating code');
        } else {
            const examList = await getAvailableExams();
            if(examList.success) setAvailableExams(examList.exams);
            setStep(3); // Go to Language
        }
    });
  };

  const handleLanguageSelect = (lang: string) => {
     setSelectedLang(lang);
     setStep(4);
  };

  const handleStartExam = (examId: string) => {
     router.push(`/exam/start?code=${accessCode}&lang=${selectedLang}&examId=${examId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-blue-600 flex items-center gap-2 justify-center tracking-tight">
            <span className="text-4xl">🛡️</span> ExamPortal
        </h1>
      </div>

      <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full transition-all duration-500 ${step === 4 ? 'max-w-6xl p-8' : 'max-w-lg p-8'}`}>
        
        {/* --- STEP 1: PERSONAL DETAILS --- */}
        {step === 1 && (
          <form onSubmit={handleInfoSubmit} className="space-y-5">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Personal Details</h2>
                <p className="text-gray-500 text-sm mt-1">Please provide your details before starting.</p>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>}
            
            <div className="space-y-4">
                {/* Standard Fields */}
                <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Full Name *</label><input name="fullName" value={formData.fullName} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Company Name *</label><input name="companyName" value={formData.companyName} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Email Address *</label><input name="email" type="email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Phone Number *</label><input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                
                {/* ✅ SUPERVISOR FIELDS RESTORED HERE ✅ */}
                <div className="pt-4 border-t border-gray-100 mt-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Supervisor Information (Optional)</h3>
                    <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Supervisor Name</label>
                           <input name="supName" value={formData.supName} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. John Doe" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Supervisor Email</label>
                           <input name="supEmail" type="email" value={formData.supEmail} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. supervisor@company.com" />
                        </div>
                    </div>
                </div>
            </div>

            <button type="submit" disabled={isSendingEmail} className={`w-full text-white py-3.5 rounded-xl font-bold mt-6 transition-all ${isSendingEmail ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSendingEmail ? 'Sending Details...' : 'Next: Exam Access'}
            </button>
          </form>
        )}

        {/* --- STEP 2: ACCESS CODE --- */}
        {step === 2 && (
          <div className="text-center space-y-6">
             <div className="flex justify-center mb-4"><div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl">🔒</div></div>
             <h2 className="text-2xl font-bold text-gray-900">Exam Access</h2>
             {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}
             <input value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-mono tracking-widest uppercase focus:ring-2 focus:ring-blue-500 outline-none" placeholder="XYZ-12345" />
             <div className="space-y-3">
                <button onClick={handleCodeSubmit} disabled={isPending} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all">{isPending ? 'Verifying...' : 'Access Exam'}</button>
                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
             </div>
          </div>
        )}

        {/* --- STEP 3: LANGUAGE SELECTION --- */}
        {step === 3 && (
           <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Language</h2>
              <p className="text-gray-500 text-sm mb-8">Questions will be shown in English + Your Choice.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                 {['English', 'Hindi', 'Marathi', 'Bangla', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'].map((lang) => (
                    <button key={lang} onClick={() => handleLanguageSelect(lang)} className="p-3 rounded-xl border hover:border-blue-500 hover:bg-blue-50 font-semibold text-gray-700 text-sm transition-all">
                        {lang}
                    </button>
                 ))}
              </div>
              <div className="pt-6 border-t border-gray-100">
                 <button onClick={() => handleLanguageSelect('English')} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700">Continue with English Only</button>
              </div>
           </div>
        )}

        {/* --- STEP 4: DASHBOARD --- */}
        {step === 4 && (
           <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Question Bank</h2>
              <p className="text-gray-500 text-sm mb-8">Choose an assessment to begin.</p>

              {availableExams.length === 0 ? (
                  <div className="py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-400 font-medium">No Question Banks Available.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 text-left">
                    {availableExams.map((exam) => (
                        <div key={exam.id} className="group relative bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden">
                            {/* Top Accent Line */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                                <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                                    Active
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{exam.title}</h3>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 mt-auto pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-1.5">
                                    <span>⏱️</span>
                                    <span className="font-medium">{exam.durationMin} Min</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span>❓</span>
                                    <span className="font-medium">{exam._count?.questions || 0} Questions</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleStartExam(exam.id)}
                                className="w-full bg-gray-50 text-gray-700 hover:bg-blue-600 hover:text-white py-3 rounded-xl font-bold transition-all shadow-sm hover:shadow-lg active:scale-95"
                            >
                                Start Exam
                            </button>
                        </div>
                    ))}
                  </div>
              )}
           </div>
        )}

      </div>
    </div>
  );
}