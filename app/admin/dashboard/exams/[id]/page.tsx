'use client'

import { useActionState } from 'react'; // React 19 hook
import { createQuestion } from '@/app/lib/actions'; 
import { useState, useEffect } from 'react';

// NOTE: Since this is a client component for the form logic, 
// we normally fetch data in a parent Server Component. 
// For simplicity in this specific "Single Page" feel, we can keep it simple.

export default function ExamBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Unwrap the params (Next.js 15 requirement)
  const [examId, setExamId] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setExamId(p.id));
  }, [params]);

  if (!examId) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header for this specific content area */}
      <div className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Exam Builder</h1>
        <p className="text-gray-500">Add questions to your exam ID: {examId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: The Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h2 className="font-bold text-lg mb-4">Add New Question</h2>
           <AddQuestionForm examId={examId} />
        </div>

        {/* RIGHT: The Preview (Static for now) */}
        <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 text-center">
           <p className="text-gray-400 mt-10">Questions you add will appear here.</p>
           <p className="text-sm text-gray-400">(We will connect the live list next)</p>
        </div>
      </div>
    </div>
  );
}

// --- The Form Component ---
function AddQuestionForm({ examId }: { examId: string }) {
  const createQuestionWithId = createQuestion.bind(null, examId);
  const [state, dispatch, isPending] = useActionState(createQuestionWithId, undefined);

  return (
    <form action={dispatch} className="space-y-4">
      {/* Question Text */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Question Text</label>
        <textarea name="question" required rows={3} className="w-full p-2 border rounded-md" placeholder="e.g. What is 2+2?" />
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Options & Correct Answer</label>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="radio" name="correctOption" value={i} required />
            <input type="text" name={`option${i}`} placeholder={`Option ${i+1}`} className="flex-1 p-2 border rounded-md text-sm" required={i < 2} />
          </div>
        ))}
      </div>

      {/* Marks */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Marks</label>
        <input type="number" name="marks" defaultValue={1} className="w-20 p-2 border rounded-md" />
      </div>

      <button disabled={isPending} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
        {isPending ? 'Saving...' : 'Save Question'}
      </button>

      {state?.message && <p className="text-center text-sm mt-2 text-blue-600">{state.message}</p>}
    </form>
  )
}