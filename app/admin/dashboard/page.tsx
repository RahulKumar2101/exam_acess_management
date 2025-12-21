import { auth } from '@/auth';
import { redirect } from 'next/navigation'; // Import redirect
import { prisma } from '@/app/lib/prisma';
import DashboardClient from './DashboardClient'; 

export default async function DashboardPage() {
  // 1. Check Session
  const session = await auth();

  // 🔴 SECURITY GUARD: If not logged in, force redirect to Login
  if (!session || !session.user) {
    redirect('/login');
  }

  // 2. Fetch Stats (Only runs if logged in)
  const examCount = await prisma.exam.count();
  const questionCount = await prisma.question.count();

  // 3. Fetch Recent Exams
  const recentExams = await prisma.exam.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      _count: {
        select: { questions: true }
      }
    }
  });

  return (
    <DashboardClient 
      initialStats={{ exams: examCount, questions: questionCount }}
      recentExams={recentExams}
      userEmail={session.user.email || 'Admin'}
    />
  );
}