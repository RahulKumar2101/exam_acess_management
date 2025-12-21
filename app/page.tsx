import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Home() {
  const session = await auth();

  // 1. Convenience: If an Admin is already logged in, send them to Dashboard immediately.
  if (session?.user) {
    redirect('/admin/dashboard');
  }

  // 2. Otherwise, show the Landing Page (Selection Screen)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col justify-center items-center p-6">
      
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-blue-900 tracking-tight mb-4">
          Exam<span className="text-blue-600">Portal</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Secure, automated examination management system for organizations and candidates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        {/* OPTION 1: STUDENT PORTAL */}
        <div className="bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-blue-100 flex flex-col items-center text-center group">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
            🎓
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Portal</h2>
          <p className="text-gray-500 mb-8">
            Enter your access code to start your assigned exam.
          </p>
          <Link 
            href="/exam" 
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            Start Exam
          </Link>
        </div>

        {/* OPTION 2: ADMIN LOGIN */}
        <div className="bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-indigo-100 flex flex-col items-center text-center group">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
            🛡️
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h2>
          <p className="text-gray-500 mb-8">
            Manage exams, generate codes, and view results.
          </p>
          <Link 
            href="/login" 
            className="w-full bg-white text-indigo-600 border-2 border-indigo-100 py-4 rounded-xl font-bold text-lg hover:border-indigo-600 hover:bg-indigo-50 transition-all active:scale-95"
          >
            Login to Dashboard
          </Link>
        </div>

      </div>

      <div className="mt-16 text-gray-400 text-sm font-medium">
        &copy; {new Date().getFullYear()} ExamSystem. All rights reserved.
      </div>
    </div>
  );
}