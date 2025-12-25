'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { logoutAction } from '@/app/lib/actions'; 
import { 
  createExam, 
  updateExam, 
  deleteExam,      
  createQuestion, 
  updateQuestion, 
  deleteQuestion, 
  getExamQuestions,
  getExamAccessDashboard, 
  getBatchCodesForDownload, 
  generateBulkCodes, 
  deleteBatch, 
  updateBatch, 
  generateExamTranslations,
  getAllExams,
  getExamResponses // ✅ IMPORT NEW ACTION
} from '@/app/lib/actions'; 
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx'; 

// --- TYPES ---
type Exam = { id: string; title: string; durationMin: number; createdAt: Date; isActive: boolean; language: string; _count: { questions: number } };
type Question = { id: string; text: string; options: string[]; correctOption: number; marks: number; };

type BatchEntry = { 
  batchId: string; 
  companyName: string | null; 
  createdAt: Date;
  count: number;
};

// ✅ NEW TYPE FOR RESPONSE DATA
type ResponseData = {
  id: string;
  studentName: string | null;
  email: string | null;
  formTitle: string;
  status: string;
  score: number;
  submissionDate: Date | null;
};

// --- ICONS ---
const Icons = {
  Dashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
  Forms: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M8 15h8"/></svg>,
  QuestionBanks: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>,
  // ✅ NEW ICON FOR RESPONSES
  Responses: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
  Logout: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  Key: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>,
  Close: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>,
  Translate: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
};

// Define Action State
type ActionState = {
  message: string;
  examId?: string;
  question?: Question;
  codes?: any[];
} | undefined;

export default function DashboardClient({ 
  initialStats, 
  recentExams, 
  userEmail 
}: { 
  initialStats: { exams: number; questions: number };
  recentExams: Exam[];
  userEmail: string;
}) {
  const router = useRouter();
  
  // STATE
  // ✅ ADDED 'RESPONSES' to view state
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'CREATE_FORM' | 'Q_BANKS' | 'ADD_QUESTIONS' | 'EXAM_ACCESS' | 'RESPONSES'>('DASHBOARD');
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeExamTitle, setActiveExamTitle] = useState<string>('');
  
  const [allExams, setAllExams] = useState<Exam[]>(recentExams); 

  const [questionList, setQuestionList] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [batchList, setBatchList] = useState<BatchEntry[]>([]);
  const [accessStats, setAccessStats] = useState({ companies: 0, activeCodes: 0 });
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchEntry | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // ✅ NEW STATE FOR RESPONSES
  const [responseList, setResponseList] = useState<ResponseData[]>([]);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Load All Exams when needed (Used for Q_BANKS and RESPONSES filters)
  useEffect(() => {
    if (currentView === 'Q_BANKS' || currentView === 'RESPONSES') {
      startTransition(async () => {
        try {
          const exams = await getAllExams();
          setAllExams(exams);
        } catch (error) {
          console.error("Failed to fetch all exams", error);
        }
      });
    }
  }, [currentView]);

  // ✅ FETCH RESPONSES WHEN VIEW OR FILTER CHANGES
  useEffect(() => {
    if (currentView === 'RESPONSES') {
      startTransition(async () => {
        try {
           const data = await getExamResponses(selectedExamFilter);
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           setResponseList(data as any);
        } catch(e) { console.error(e); }
      });
    }
  }, [currentView, selectedExamFilter]);

  const fetchQuestions = useCallback(async (examId: string) => {
    try {
      const q = await getExamQuestions(examId);
      setQuestionList(q);
    } catch {}
  }, []);

  const fetchAccessData = useCallback(async () => {
    try {
       const data = await getExamAccessDashboard();
       setBatchList(data.batches as unknown as BatchEntry[]);
       setAccessStats(data.stats);
    } catch {}
  }, []);

  useEffect(() => {
    if (currentView === 'ADD_QUESTIONS' && activeExamId) {
      fetchQuestions(activeExamId);
      setEditingQuestion(null);
    }
    if (currentView === 'EXAM_ACCESS') {
        fetchAccessData();
        setIsCreatingAccess(false);
        setEditingBatch(null);
    }
  }, [currentView, activeExamId, fetchQuestions, fetchAccessData]);

  const handleViewChange = (view: typeof currentView) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  const handleDeleteExam = async (examId: string) => {
    if(!confirm('Delete this form?')) return;
    startTransition(async () => {
       await deleteExam(examId);
       setAllExams(prev => prev.filter(e => e.id !== examId));
       router.refresh();
    });
  };

  const handleDeleteQuestion = async (qId: string) => {
    if(!confirm('Delete this question?')) return;
    setQuestionList((prev) => prev.filter(q => q.id !== qId)); 
    await deleteQuestion(qId, activeExamId!);
    router.refresh(); 
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditExamClick = (exam: Exam) => {
    setEditingExam(exam);
    setCurrentView('CREATE_FORM');
  };

  const handleCreateNewClick = () => {
    setEditingExam(null);
    handleViewChange('CREATE_FORM');
  }

  const handleDeleteBatch = async (batchId: string) => {
    if(!confirm("Are you sure? This will delete ALL codes for this company.")) return;
    await deleteBatch(batchId);
    fetchAccessData(); 
  }

  const handleEditBatch = (batch: BatchEntry) => {
    setEditingBatch(batch);
    setIsCreatingAccess(true); 
  }

  const handleDownloadBatch = async (batchId: string, companyName: string) => {
    setIsDownloading(true);
    const codes = await getBatchCodesForDownload(batchId);
    if(codes && codes.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(codes);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Access Codes");
      XLSX.writeFile(workbook, `${companyName}_AccessCodes.xlsx`);
    } else {
      alert("No codes found for this batch.");
    }
    setIsDownloading(false);
  }

  // ✅ EXCEL DOWNLOAD FOR RESPONSES
  const handleDownloadResponses = () => {
    if(responseList.length === 0) return alert("No data to download");
    const worksheet = XLSX.utils.json_to_sheet(responseList.map(r => ({
      "Student Name": r.studentName,
      "Email": r.email,
      "Form": r.formTitle,
      "Status": r.status,
      "Score": r.score,
      "Date": r.submissionDate ? new Date(r.submissionDate).toLocaleDateString() : '-'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");
    XLSX.writeFile(workbook, `Exam_Responses_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const handleGenerateTranslations = async () => {
    if (!activeExamId) return;
    if (!confirm("This will auto-generate translations for 7 Indian languages.")) return;
    
    setIsTranslating(true);
    try {
        const res = await generateExamTranslations(activeExamId);
        if (res.success) {
            alert("✅ Translations Generated Successfully!");
        } else {
            alert("❌ Error: " + res.message);
        }
    } catch (error) {
        alert("Something went wrong.");
    }
    setIsTranslating(false);
  };

  // --- VIEWS ---

  // ✅ RENDER RESPONSES VIEW
  const renderResponses = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Responses & Tracking</h2>
              <p className="text-sm text-gray-500">View and manage all form submissions.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <select 
                    value={selectedExamFilter} 
                    onChange={(e) => setSelectedExamFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Forms</option>
                    {allExams.map(exam => (
                      <option key={exam.id} value={exam.id}>{exam.title}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-3 text-gray-400 pointer-events-none text-xs">▼</span>
               </div>
               <button 
                 onClick={handleDownloadResponses}
                 className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-all active:scale-95 whitespace-nowrap"
               >
                 <Icons.Download /> Download Excel
               </button>
            </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Student Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Form</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submission Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {responseList.length === 0 ? (
                 <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No responses found.</td></tr>
              ) : (
                responseList.map((response) => (
                  <tr key={response.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{response.studentName}</td>
                    <td className="px-6 py-4 text-gray-500">{response.email}</td>
                    <td className="px-6 py-4">{response.formTitle}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        response.status === 'Submitted' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {response.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {response.submissionDate ? new Date(response.submissionDate).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded transition-colors" title="View Details">
                         <Icons.Eye /> 
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-right text-xs text-gray-400">
            Total: {responseList.length} responses
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div><p className="text-gray-500 text-sm font-semibold mb-1">Total Forms</p><h3 className="text-3xl md:text-4xl font-bold text-gray-900">{initialStats.exams}</h3></div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl"><Icons.Forms /></div>
        </div>
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div><p className="text-gray-500 text-sm font-semibold mb-1">Total Questions</p><h3 className="text-3xl md:text-4xl font-bold text-gray-900">{initialStats.questions}</h3></div>
          <div className="p-4 bg-green-50 text-green-600 rounded-xl"><span className="text-xl font-bold">?</span></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Recent Forms</h3>
          <button onClick={() => setCurrentView('Q_BANKS')} className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer">View All →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[600px] md:min-w-full">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">Form Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Questions</th>
                <th className="px-6 py-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentExams.slice(0, 5).map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{exam.title}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${exam.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{exam.isActive ? 'Active' : 'Draft'}</span></td>
                  <td className="px-6 py-4">{exam.durationMin} mins</td>
                  <td className="px-6 py-4">{exam._count.questions}</td>
                  <td className="px-6 py-4">{new Date(exam.createdAt).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
               {recentExams.length === 0 && (<tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No forms found. Create one to get started.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-900">{editingExam ? 'Edit Form Details' : 'Create New Form'}</h2>
        <ExamForm key={editingExam ? editingExam.id : 'new-exam'} initialData={editingExam} onSuccess={(id, title) => { if(editingExam) { setCurrentView('Q_BANKS'); setEditingExam(null); } else { setActiveExamId(id); setActiveExamTitle(title); setCurrentView('ADD_QUESTIONS'); } }} onCancel={() => { setEditingExam(null); setCurrentView('Q_BANKS'); }} />
      </div>
    </div>
  );

  // ✅ 4. UPDATE Q_BANKS TO USE `allExams` INSTEAD OF `recentExams`
  const renderQBanks = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="text-lg font-bold text-gray-800">Question Banks</h3>
          <button onClick={handleCreateNewClick} className="text-sm bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2 cursor-pointer"><span>+</span> New Bank</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[700px] md:min-w-full">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
              <tr><th className="px-6 py-4">Bank Name</th><th className="px-6 py-4">Language</th><th className="px-6 py-4">Duration</th><th className="px-6 py-4">Questions</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Use allExams here */}
              {allExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{exam.title}</td>
                  <td className="px-6 py-4">{exam.language}</td>
                  <td className="px-6 py-4">{exam.durationMin} mins</td>
                  <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{exam._count.questions}</span></td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                    <button onClick={() => { setActiveExamId(exam.id); setActiveExamTitle(exam.title); setCurrentView('ADD_QUESTIONS'); }} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 text-xs font-bold border border-blue-100 cursor-pointer whitespace-nowrap">Manage Questions</button>
                    <button onClick={() => handleEditExamClick(exam)} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded transition-colors cursor-pointer"><Icons.Edit /></button>
                    <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors cursor-pointer"><Icons.Trash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );

  const renderAddQuestions = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCurrentView('Q_BANKS')} className="group text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors cursor-pointer"><span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Question Banks</button>
          
          <button 
            onClick={handleGenerateTranslations} 
            disabled={isTranslating}
            className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
             {isTranslating ? 'Translating...' : <><Icons.Translate /> Pre-generate Translations</>}
          </button>
      </div>

      <div className="space-y-8">
        <div className={`p-6 rounded-2xl shadow-sm border transition-all duration-300 ${editingQuestion ? 'bg-amber-50 border-amber-200 ring-4 ring-amber-50/50' : 'bg-white border-gray-200'}`}>
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
             <div><h3 className={`font-bold text-xl ${editingQuestion ? 'text-amber-800' : 'text-gray-800'}`}>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3></div>
             <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600 font-bold shadow-sm">Total: {questionList.length}</span>
           </div>
           <QuestionForm key={editingQuestion ? editingQuestion.id : 'new-form'} examId={activeExamId!} initialData={editingQuestion} onSuccess={(savedQuestion) => { if (editingQuestion) { setQuestionList(prev => prev.map(q => q.id === savedQuestion.id ? savedQuestion : q)); setEditingQuestion(null); } else { setQuestionList(prev => [...prev, savedQuestion]); } }} onCancel={() => setEditingQuestion(null)} />
        </div>
        <div><h3 className="font-bold text-gray-800 mb-4 px-1 text-lg flex items-center gap-2"><Icons.QuestionBanks /> Questions List</h3>
           <div className="space-y-4">
             {questionList.length === 0 ? (<div className="text-center py-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-gray-400"><p className="mb-2 text-3xl opacity-20">📝</p><p>No questions added yet.</p></div>) : (
               questionList.map((q, idx) => (
                 <div key={q.id} className="p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start bg-white border-gray-200 gap-4">
                   <div className="flex-1 w-full"><p className="font-semibold text-gray-900">{q.text}</p></div>
                   <div className="flex gap-1 self-end md:self-start">
                     <button onClick={() => handleEditClick(q)} className="text-gray-400 hover:text-blue-600 p-2"><Icons.Edit /></button>
                     <button onClick={() => handleDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-600 p-2"><Icons.Trash /></button>
                   </div>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>
    </div>
  );

  // ... (Keep renderExamAccess, SidebarItem, BulkGenerateForm, ExamForm, QuestionForm exactly as they were)
  const renderExamAccess = () => {
    return (
    <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div><p className="text-gray-500 text-sm font-semibold">Total Companies</p><h3 className="text-3xl font-bold text-gray-900 mt-1">{accessStats.companies}</h3></div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">🏢</div>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div><p className="text-gray-500 text-sm font-semibold">Active Codes</p><h3 className="text-3xl font-bold text-green-600 mt-1">{accessStats.activeCodes}</h3></div>
                <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Icons.Key /></div>
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-white gap-4">
                <h3 className="text-lg font-bold text-gray-800">Company Batches</h3>
                <button onClick={() => { setEditingBatch(null); setIsCreatingAccess(!isCreatingAccess); }} className="w-full md:w-auto text-sm bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow-sm flex justify-center items-center gap-2 cursor-pointer transition-all"><span>{isCreatingAccess ? 'Cancel' : '+ Generate New Batch'}</span></button>
             </div>
             
             {isCreatingAccess && (
                <div className="p-6 bg-gray-50 border-b border-gray-100">
                   <h4 className="text-sm font-bold text-gray-900 mb-4">{editingBatch ? 'Edit Batch Details' : 'Generate New Access Codes'}</h4>
                   <BulkGenerateForm 
                     key={editingBatch ? editingBatch.batchId : 'new-batch'}
                     initialData={editingBatch}
                     onSuccess={() => { setIsCreatingAccess(false); fetchAccessData(); setEditingBatch(null); }}
                     onCancel={() => { setIsCreatingAccess(false); setEditingBatch(null); }}
                   />
                </div>
             )}

             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-gray-600 min-w-[700px] md:min-w-full"> 
                 <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
                     <tr>
                     <th className="px-6 py-4">Company</th>
                     <th className="px-6 py-4">Total Codes</th>
                     <th className="px-6 py-4">Created Date</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                     {batchList.map((batch) => (
                     <tr key={batch.batchId} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4 font-bold text-gray-900 capitalize">{batch.companyName}</td>
                         <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-gray-700 font-bold">{batch.count}</span></td>
                         <td className="px-6 py-4 text-gray-500">{new Date(batch.createdAt).toLocaleDateString()}</td>
                         <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                             <button onClick={() => handleEditBatch(batch)} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded transition-colors cursor-pointer" title="Edit Batch"><Icons.Edit /></button>
                             <button onClick={() => batch.batchId && handleDeleteBatch(batch.batchId)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors cursor-pointer" title="Delete Batch"><Icons.Trash /></button>
                             <button onClick={() => batch.batchId && handleDownloadBatch(batch.batchId, batch.companyName || 'Batch')} disabled={isDownloading} className="ml-2 text-emerald-600 hover:bg-emerald-50 p-2 rounded flex items-center gap-2 text-xs font-bold border border-emerald-100 transition-colors cursor-pointer whitespace-nowrap" title="Download Excel"><Icons.Download /> Download</button>
                         </td>
                     </tr>
                     ))}
                     {batchList.length === 0 && !isCreatingAccess && (
                         <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No company batches found.</td></tr>
                     )}
                 </tbody>
                 </table>
             </div>
          </div>
      </div>
    )
  }

  // --- MAIN LAYOUT ---
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900 relative">
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR (Responsive) */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-gray-200 
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:fixed md:inset-y-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col
      `}>
        <div className="p-8 pb-6 flex justify-between items-center">
            <h1 className="text-2xl font-extrabold text-blue-600 flex items-center gap-3 tracking-tight">
                <span className="text-3xl">🛡️</span> ExamAdmin
            </h1>
            {/* Close button for mobile */}
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-500 hover:text-gray-700">
                <Icons.Close />
            </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <SidebarItem active={currentView === 'DASHBOARD'} onClick={() => handleViewChange('DASHBOARD')} icon={<Icons.Dashboard />} label="Dashboard" />
          <SidebarItem active={currentView === 'CREATE_FORM'} onClick={handleCreateNewClick} icon={<Icons.Forms />} label="Forms" />
          <SidebarItem active={currentView === 'Q_BANKS' || currentView === 'ADD_QUESTIONS'} onClick={() => handleViewChange('Q_BANKS')} icon={<Icons.QuestionBanks />} label="Question Banks" />
          <SidebarItem active={currentView === 'EXAM_ACCESS'} onClick={() => handleViewChange('EXAM_ACCESS')} icon={<Icons.Key />} label="Exam Access" />
          <SidebarItem active={currentView === 'RESPONSES'} onClick={() => handleViewChange('RESPONSES')} icon={<Icons.Responses />} label="Responses" />
        </nav>
        <div className="p-4 m-4 border-t border-gray-100">
            <button onClick={() => startTransition(() => logoutAction())} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold group cursor-pointer">
                <span className="group-hover:-translate-x-1 transition-transform"><Icons.Logout /></span> Sign Out
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-72 p-4 md:p-6 lg:p-12 overflow-hidden w-full flex flex-col">
        {/* MOBILE HEADER */}
        <div className="md:hidden flex justify-between items-center mb-6">
             <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-700 p-2 -ml-2">
                <Icons.Menu />
             </button>
             <h1 className="text-xl font-bold text-gray-900">ExamAdmin</h1>
             <div className="w-8"></div> {/* Spacer for alignment */}
        </div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              {currentView === 'DASHBOARD' ? 'Dashboard' : currentView === 'CREATE_FORM' ? 'Create Form' : currentView === 'Q_BANKS' ? 'Question Banks' : currentView === 'EXAM_ACCESS' ? 'Exam Access Management' : currentView === 'RESPONSES' ? 'Responses & Tracking' : 'Exam Builder'}
            </h2>
            <p className="text-gray-500 mt-2 font-medium text-sm md:text-base break-all">Welcome back, <span className="text-gray-800">{userEmail}</span></p>
          </div>
          {currentView === 'DASHBOARD' && (
            <button onClick={handleCreateNewClick} className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer">
                + Create New Form
            </button>
          )}
        </header>

        {currentView === 'DASHBOARD' && renderDashboard()}
        {currentView === 'CREATE_FORM' && renderCreateForm()}
        {currentView === 'Q_BANKS' && renderQBanks()}
        {currentView === 'ADD_QUESTIONS' && renderAddQuestions()}
        {currentView === 'EXAM_ACCESS' && renderExamAccess()}
        {currentView === 'RESPONSES' && renderResponses()}
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function SidebarItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 font-medium text-left cursor-pointer ${active ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span> {label}</button>
  )
}

function BulkGenerateForm({ 
  onSuccess, 
  onCancel,
  initialData 
}: { 
  onSuccess: () => void,
  onCancel?: () => void,
  initialData?: BatchEntry | null 
}) {
    const actionFn = initialData?.batchId 
      ? updateBatch.bind(null, initialData.batchId) 
      : generateBulkCodes;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [state, dispatch, isPending] = useActionState<ActionState, FormData>(actionFn as any, undefined);
    const formRef = useRef<HTMLFormElement>(null);
  
    useEffect(() => {
      if (state?.message === 'Success') {
         formRef.current?.reset();
         onSuccess();
      }
    }, [state, onSuccess]);
  
    return (
      <form ref={formRef} action={dispatch} className="flex flex-col md:flex-row items-end gap-4 w-full">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-700 mb-1">Company Name</label>
          <input 
            name="companyName" 
            type="text" 
            defaultValue={initialData?.companyName || ''} 
            required 
            className="w-full px-3 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="e.g. Tata Consultancy" 
          />
          {!initialData && <p className="text-[10px] text-gray-400 mt-1">First 3 letters will be used as prefix (e.g. TAT)</p>}
        </div>

        {/* Quantity (Create Only) */}
        {!initialData && (
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
            <input 
              name="amount" 
              type="number" 
              defaultValue={100} 
              min={1} 
              max={1000}
              className="w-full px-3 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
        )}
        
        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
          {onCancel && (
            <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-4 py-3 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 h-[48px]">
              Cancel
            </button>
          )}
          <button disabled={isPending} className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95 cursor-pointer h-[48px] flex items-center justify-center gap-2">
            {isPending ? 'Saving...' : initialData ? 'Update Batch' : 'Generate'}
          </button>
        </div>
      </form>
    )
  }

function ExamForm({ initialData, onSuccess, onCancel }: { initialData?: Exam | null, onSuccess: (id: string, title: string) => void, onCancel: () => void }) {
  const actionFn = initialData ? updateExam.bind(null, initialData.id) : createExam;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, dispatch, isPending] = useActionState<ActionState, FormData>(actionFn as any, undefined);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { if (state?.message === 'Success' && state.examId) { const titleInput = (document.querySelector('input[name="title"]') as HTMLInputElement)?.value || "New Exam"; onSuccessRef.current(state.examId, titleInput); } }, [state]);
  return (
    <form action={dispatch} className="space-y-6">
      <div><label className="block text-sm font-bold text-gray-700 mb-2">Form Name</label><input name="title" type="text" defaultValue={initialData?.title} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="e.g. Physics Mid-Term Final" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Language</label><div className="relative"><select name="language" defaultValue={initialData?.language || 'English'} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"><option value="English">English</option><option value="Spanish">Spanish</option><option value="Hindi">Hindi</option></select><span className="absolute right-4 top-3.5 text-gray-400 pointer-events-none">▼</span></div></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Duration (Min)</label><input name="duration" type="number" defaultValue={initialData?.durationMin || 60} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" /></div>
      </div>
      <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200"><div><span className="block text-sm font-bold text-gray-800">Form Status</span><span className="text-xs text-gray-500">Enable to make this form active immediately</span></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" name="isActive" defaultChecked={initialData ? initialData.isActive : true} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label></div>
      <div className="flex gap-4 mt-4">{initialData && (<button type="button" onClick={onCancel} className="flex-1 px-6 py-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>)}<button disabled={isPending} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] cursor-pointer">{isPending ? 'Saving...' : (initialData ? 'Update Form' : 'Create & Add Questions')}</button></div>
    </form>
  )
}

function QuestionForm({ examId, initialData, onSuccess, onCancel }: { examId: string, initialData?: Question | null, onSuccess: (q: Question) => void, onCancel: () => void }) {
  const actionFn = initialData ? updateQuestion.bind(null, initialData.id, examId) : createQuestion.bind(null, examId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, dispatch, isPending] = useActionState<ActionState, FormData>(actionFn as any, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { const returnedQ = state?.question; if (state?.message === 'Success' && returnedQ) { formRef.current?.reset(); onSuccessRef.current(returnedQ as Question); } }, [state]); 
  return (
    <form ref={formRef} action={dispatch} className="space-y-6">
      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Question Text</label><textarea name="question" defaultValue={initialData?.text || ''} required placeholder="Type your question here..." className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 text-lg font-medium" rows={3} /></div>
      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Options (Select the correct one)</label><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[0,1,2,3].map(i => (<div key={i} className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all cursor-pointer" onClick={() => (document.getElementsByName('correctOption')[i] as HTMLInputElement).click()}><input type="radio" name="correctOption" value={i} defaultChecked={initialData ? initialData.correctOption === i : false} required className="w-5 h-5 text-blue-600 accent-blue-600 cursor-pointer" onClick={(e) => e.stopPropagation()} /><input name={`option${i}`} defaultValue={initialData ? initialData.options[i] : ''} placeholder={`Option ${String.fromCharCode(65+i)}`} className="flex-1 bg-transparent text-sm outline-none font-medium text-gray-700 cursor-text" required={i<2} onClick={(e) => e.stopPropagation()} /></div>))}</div></div>
      <div className="flex flex-col md:flex-row items-center gap-4 pt-2 border-t border-gray-100 mt-4"><div className="w-full md:w-auto flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200"><span className="text-sm font-bold text-gray-600">Marks:</span><input type="number" name="marks" defaultValue={initialData ? initialData.marks : 1} className="w-12 bg-transparent text-center text-lg font-bold text-gray-900 outline-none" /></div><div className="w-full md:flex-1 flex gap-3 justify-end">{initialData && (<button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>)}<button disabled={isPending} className={`flex-1 md:flex-none px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 cursor-pointer ${initialData ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>{isPending ? 'Saving...' : (initialData ? 'Update Question' : 'Save Question')}</button></div></div>
    </form>
  )
}