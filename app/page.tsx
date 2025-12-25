import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col justify-center items-center p-6">
      
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-blue-900 tracking-tight mb-4">
          Exam<span className="text-blue-600">Portal</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Secure, automated examination management system.
        </p>
      </div>

      <div className="w-full max-w-md">
        {/* STUDENT PORTAL ONLY */}
        <div className="bg-white p-10 rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-blue-100 flex flex-col items-center text-center group">
          <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-5xl mb-6 group-hover:scale-110 transition-transform">
            🎓
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Student Portal</h2>
          <p className="text-gray-500 mb-8 text-lg">
            Enter your access code to start your assigned exam.
          </p>
          <Link 
            href="/exam" 
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer block"
          >
            Start Exam
          </Link>
        </div>
      </div>

      <div className="mt-16 text-gray-400 text-sm font-medium">
        &copy; {new Date().getFullYear()} ExamSystem. All rights reserved.
      </div>
    </div>
  );
}