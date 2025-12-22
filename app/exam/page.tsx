'use client'

import { useState, useTransition, useEffect } from 'react';
import { sendRegistrationEmails, getAvailableExams, verifyAndStartExam } from '@/app/lib/student-actions';
import { useRouter } from 'next/navigation';

export default function StudentExamPortal() {
  // Steps: 1:Registration -> 2:Language -> 3:Question Bank -> 4:Access Code
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  
  const [formData, setFormData] = useState({
    fullName: '', 
    companyName: '', 
    email: '', 
    phone: '', 
    supName: '', 
    supEmail: '' 
  });
  
  const [accessCode, setAccessCode] = useState('');
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Load exams on mount so they are ready for Step 3
  useEffect(() => {
    getAvailableExams().then(res => { 
        if(res.success) setAvailableExams(res.exams); 
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- STEP 1: REGISTRATION ---
  const handleRegSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate ALL fields (Supervisor is now MANDATORY)
    if (!formData.fullName || !formData.companyName || !formData.email || !formData.phone || !formData.supName || !formData.supEmail) {
        setError("All fields, including Supervisor details, are mandatory.");
        return;
    }
    setError('');
    
    startTransition(async () => {
        const payload = new FormData();
        Object.entries(formData).forEach(([k, v]) => payload.append(k, v));
        
        // Send Emails (Student, Supervisor, Admin)
        await sendRegistrationEmails(payload);
        
        // Move to Language Step
        setStep(2); 
    });
  };

  // --- STEP 2: LANGUAGE ---
  const handleLanguageSelect = (lang: string) => {
     setSelectedLang(lang);
     setStep(3); // Go to Bank Selection
  };

  // --- STEP 3: SELECT BANK ---
  const handleBankSelect = (examId: string) => {
      setSelectedExamId(examId);
      setStep(4); // Go to Code Entry
  };

  // --- STEP 4: VERIFY CODE & START ---
  const handleFinalStart = async () => {
    if(!accessCode) { setError("Please enter Access Code"); return; }
    setError('');

    startTransition(async () => {
        const payload = new FormData();
        payload.append('accessCode', accessCode);
        payload.append('examId', selectedExamId);
        // Pass student details again to link them to the specific access code record
        Object.entries(formData).forEach(([k, v]) => payload.append(k, v));

        // @ts-ignore
        const result = await verifyAndStartExam(payload);

        // 1. Check if Exam is already completed
        if (result.isCompleted) {
             router.push(`/exam/result?code=${accessCode}`);
             return;
        }

        // 2. Handle Errors
        if (!result.success) {
            setError(result.message || 'Invalid Code');
        } else {
            // 3. Success! Redirect to Exam Interface
            router.push(`/exam/start?code=${accessCode}&lang=${selectedLang}&examId=${selectedExamId}`);
        }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans text-gray-900">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-blue-600 flex items-center gap-2 justify-center tracking-tight">
            <span className="text-4xl">🛡️</span> ExamPortal
        </h1>
      </div>

      <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full transition-all duration-500 ${step === 3 ? 'max-w-6xl p-8' : 'max-w-lg p-8'}`}>
        
        {/* --- STEP 1: REGISTRATION --- */}
        {step === 1 && (
          <form onSubmit={handleRegSubmit} className="space-y-5">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Student Registration</h2>
                <p className="text-gray-500 text-sm mt-1">Fill in your details to proceed.</p>
            </div>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>}
            
            <div className="space-y-4">
                {/* Inputs use text-gray-900 for high visibility on mobile */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Full Name *</label>
                    <input name="fullName" value={formData.fullName} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter your full name" />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Company Name *</label>
                    <input name="companyName" value={formData.companyName} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter company name" />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Email Address *</label>
                    <input name="email" type="email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter email address" />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Phone Number *</label>
                    <input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter phone number" />
                </div>
                
                {/* Supervisor Fields - Now Mandatory */}
                <div className="pt-4 border-t border-gray-100 mt-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Supervisor Name *</label>
                            <input name="supName" value={formData.supName} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. John Doe" />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Supervisor Email *</label>
                            <input name="supEmail" type="email" value={formData.supEmail} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. supervisor@company.com" />
                        </div>
                    </div>
                </div>
            </div>

            <button type="submit" disabled={isPending} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold mt-6 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">
                {isPending ? 'Processing...' : 'Next'}
            </button>
          </form>
        )}

        {/* --- STEP 2: LANGUAGE --- */}
        {step === 2 && (
           <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Language</h2>
              <p className="text-gray-500 text-sm mb-8">Questions will be shown in English + Your Choice.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mt-6">
                 {['English', 'Hindi', 'Marathi', 'Bangla', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'].map((lang) => (
                    <button key={lang} onClick={() => handleLanguageSelect(lang)} className="p-3 rounded-xl border hover:border-blue-500 hover:bg-blue-50 font-semibold text-gray-700 text-sm transition-all">
                        {lang}
                    </button>
                 ))}
              </div>
              <button onClick={() => setStep(1)} className="text-gray-500 text-sm hover:underline">← Back to Registration</button>
           </div>
        )}

        {/* --- STEP 3: QUESTION BANKS --- */}
        {step === 3 && (
           <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Question Bank</h2>
              <p className="text-gray-500 text-sm mb-8">Choose an assessment to unlock.</p>

              {availableExams.length === 0 ? (
                  <div className="py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-400 font-medium">No Exams Available.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 text-left mt-8">
                    {availableExams.map((exam) => (
                        <div key={exam.id} onClick={() => handleBankSelect(exam.id)} className="group relative bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{exam.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{exam.durationMin} Minutes • {exam._count.questions} Questions</p>
                            
                            <div className="mt-auto w-full bg-gray-50 text-gray-700 group-hover:bg-blue-600 group-hover:text-white py-3 rounded-xl font-bold text-center transition-all">
                                Select & Enter Code
                            </div>
                        </div>
                    ))}
                  </div>
              )}
              <div className="mt-8"><button onClick={() => setStep(2)} className="text-gray-500 text-sm hover:underline">← Back to Language</button></div>
           </div>
        )}

        {/* --- STEP 4: ACCESS CODE ENTRY --- */}
        {step === 4 && (
          <div className="text-center space-y-6">
             <div className="flex justify-center mb-4"><div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl">🔒</div></div>
             <h2 className="text-2xl font-bold text-gray-900">Enter Access Code</h2>
             <p className="text-gray-500 text-sm">Enter the code provided by your supervisor to start.</p>
             
             {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}
             
             <input 
                value={accessCode} 
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())} 
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-mono tracking-widest text-gray-900 uppercase focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="XYZ-12345" 
             />
             
             <div className="space-y-3">
                <button onClick={handleFinalStart} disabled={isPending} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">
                    {isPending ? 'Verifying...' : 'Start Exam'}
                </button>
                <button onClick={() => setStep(3)} className="text-sm text-gray-500 hover:text-gray-900 hover:underline">← Back to Selection</button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}