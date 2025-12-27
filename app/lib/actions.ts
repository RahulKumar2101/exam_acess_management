'use server'

import { signIn, auth, signOut } from '../../auth'
import { AuthError } from 'next-auth'
import { prisma } from '@/app/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getTranslation } from '@/app/lib/translator'; 

// Helper: Generate simple random string for fallback/reset Access IDs
function generateAccessCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result.match(/.{1,4}/g)?.join('-') || result;
}

// --- 1. LOGIN ACTION ---
export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', {
      ...Object.fromEntries(formData),
      redirectTo: '/admin/dashboard', 
    })
  } catch (error) {
    if ((error as Error).message.includes('NEXT_REDIRECT')) throw error;
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin': return 'Invalid credentials.';
        default: return 'Something went wrong.';
      }
    }
    throw error;
  }
}

// --- 2. CREATE EXAM ACTION ---
export async function createExam(prevState: any, formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.email) return { message: 'Unauthorized' };
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return { message: 'Admin account not found.' };

    const title = formData.get('title') as string;
    const duration = parseInt(formData.get('duration') as string) || 30;
    const language = formData.get('language') as string || 'English';
    const isActive = formData.get('isActive') === 'on'; 

    if (!title) return { message: 'Please enter a Form Name.' };

    const newExam = await prisma.exam.create({
      data: { title, durationMin: duration, language, isActive, creatorId: user.id },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', examId: newExam.id };
  } catch (error) { return { message: 'Database Error' }; }
}

// --- 3. DELETE EXAM ACTION ---
export async function deleteExam(examId: string) {
  try {
    await prisma.question.deleteMany({ where: { examId } });
    await prisma.exam.delete({ where: { id: examId } });
    revalidatePath('/admin/dashboard');
    return { message: 'Deleted' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 4. FETCH QUESTIONS ---
export async function getExamQuestions(examId: string) {
  try {
    return await prisma.question.findMany({ where: { examId }, orderBy: { id: 'asc' } });
  } catch (error) { return []; }
}

// --- 5. CREATE QUESTION ACTION ---
export async function createQuestion(examId: string, prevState: any, formData: FormData) {
  try {
    const text = formData.get('question') as string;
    const marks = parseInt(formData.get('marks') as string) || 1;
    const correctOptionIndex = parseInt(formData.get('correctOption') as string); 
    const options = [
      formData.get('option0') as string,
      formData.get('option1') as string,
      formData.get('option2') as string,
      formData.get('option3') as string,
    ];

    const newQuestion = await prisma.question.create({
      data: { text, marks, correctOption: correctOptionIndex, options, examId },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', question: newQuestion }; 
  } catch (error) { return { message: 'Failed' }; }
}

// --- 6. DELETE QUESTION ACTION ---
export async function deleteQuestion(questionId: string, examId: string) {
  try {
    await prisma.question.delete({ where: { id: questionId } });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 7. LOGOUT ACTION ---
export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}

// --- 8. UPDATE QUESTION ACTION ---
export async function updateQuestion(questionId: string, examId: string, prevState: any, formData: FormData) {
  try {
    const text = formData.get('question') as string;
    const marks = parseInt(formData.get('marks') as string) || 1;
    const correctOptionIndex = parseInt(formData.get('correctOption') as string); 
    const options = [
      formData.get('option0') as string,
      formData.get('option1') as string,
      formData.get('option2') as string,
      formData.get('option3') as string,
    ];

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: { text, marks, correctOption: correctOptionIndex, options },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', question: updatedQuestion };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 9. UPDATE EXAM ACTION ---
export async function updateExam(examId: string, prevState: any, formData: FormData) {
  try {
    const title = formData.get('title') as string;
    const duration = parseInt(formData.get('duration') as string) || 30;
    const language = formData.get('language') as string || 'English';
    const isActive = formData.get('isActive') === 'on'; 

    await prisma.exam.update({
      where: { id: examId },
      data: { title, durationMin: duration, language, isActive },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', examId };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 10. FETCH DATA FOR ACCESS DASHBOARD (MODIFIED FOR PREFIX DISPLAY) ---
export async function getExamAccessDashboard() {
  try {
    const activeCodesCount = await prisma.examAccess.count({ where: { status: 'ACTIVE' } });
    
    const rawBatches = await prisma.examAccess.findMany({
      where: { batchId: { not: null } },
      select: { batchId: true, companyName: true, createdAt: true, accessCode: true },
      orderBy: { createdAt: 'desc' }
    });

    const grouped: Record<string, any> = {};
    rawBatches.forEach(item => {
      const bId = item.batchId!;
      if (!grouped[bId]) {
        grouped[bId] = {
          batchId: bId,
          companyName: item.companyName,
          createdAt: item.createdAt,
          count: 0,
          prefix: item.accessCode.substring(0, 3).toUpperCase() 
        };
      }
      grouped[bId].count += 1;
    });

    return { 
      batches: Object.values(grouped), 
      stats: { companies: Object.keys(grouped).length, activeCodes: activeCodesCount } 
    };
  } catch (error) { return { batches: [], stats: { companies: 0, activeCodes: 0 } }; }
}

// --- 11. FETCH CODES FOR DOWNLOAD ---
export async function getBatchCodesForDownload(batchId: string) {
  try {
    return await prisma.examAccess.findMany({
      where: { batchId },
      select: { accessCode: true, companyName: true, status: true, studentName: true }
    });
  } catch (error) { return []; }
}

// --- 12. BULK GENERATE CODES (WITH UNIQUE PREFIX ALERT LOGIC) ---
export async function generateBulkCodes(prevState: any, formData: FormData) {
  try {
    const companyName = formData.get('companyName') as string;
    const customPrefix = formData.get('customPrefix') as string;
    const quantity = parseInt(formData.get('amount') as string) || 100;
    
    const prefix = customPrefix.replace(/\s/g, '').substring(0, 3).toUpperCase();

    // 🛑 STEP 1: Check if this prefix is already used in the database
    const existingPrefix = await prisma.examAccess.findFirst({
        where: { accessCode: { startsWith: prefix } }
    });

    if (existingPrefix) {
        return { message: 'PrefixExists' }; 
    }

    const batchId = crypto.randomUUID(); 
    const data = [];
    
    // Generate unique 6-digit random numbers for the entire batch
    const uniqueNumbers = new Set<number>();
    while(uniqueNumbers.size < quantity) {
      uniqueNumbers.add(Math.floor(100000 + Math.random() * 900000));
    }

    for (const num of uniqueNumbers) {
      data.push({
        companyName,
        accessCode: `${prefix}${num}`,
        batchId,
        status: 'ACTIVE' as const,
      });
    }

    // skipDuplicates: true ensures global uniqueness against existing DB records
    await prisma.examAccess.createMany({ data, skipDuplicates: true });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 13. RESET ACCESS CODE ---
export async function resetAccessCode(accessId: string) {
    try {
      const newCode = generateAccessCode();
      await prisma.examAccess.update({
        where: { id: accessId },
        data: { accessCode: newCode, status: 'ACTIVE', sentAt: null, submittedAt: null }
      });
      revalidatePath('/admin/dashboard');
      return { message: 'Success', newCode };
    } catch (error) { return { message: 'Failed' }; }
}

// --- 14. MARK AS SENT ---
export async function markAsSent(accessId: string) {
  try {
    await prisma.examAccess.update({ where: { id: accessId }, data: { sentAt: new Date() } });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 15. DELETE BATCH ---
export async function deleteBatch(batchId: string) {
  try {
    await prisma.examAccess.deleteMany({ where: { batchId } });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 16. UPDATE BATCH ---
export async function updateBatch(batchId: string, prevState: any, formData: FormData) {
  try {
    const companyName = formData.get('companyName') as string;
    await prisma.examAccess.updateMany({ where: { batchId }, data: { companyName } });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) { return { message: 'Failed' }; }
}

// --- 17. GENERATE TRANSLATIONS ---
const TARGET_LANGUAGES = ['Hindi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'];
export async function generateExamTranslations(examId: string) {
  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } });
    if (!exam) return { success: false, message: "No questions found." };

    for (const lang of TARGET_LANGUAGES) {
      for (const q of exam.questions) {
        const existing = await prisma.questionTranslation.findUnique({
            where: { questionId_language: { questionId: q.id, language: lang } }
        });
        if (existing) continue;

        const transText = await getTranslation(q.text, lang);
        const transOptions = await Promise.all(q.options.map(opt => getTranslation(opt, lang)));

        if (transText) {
          await prisma.questionTranslation.create({
            data: { questionId: q.id, language: lang, text: transText, options: transOptions as string[] }
          });
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
    return { success: true, message: "Done" };
  } catch (error) { return { success: false }; }
}

// --- 18. FETCH ALL EXAMS ---
export async function getAllExams() {
  try {
    return await prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, durationMin: true, createdAt: true, isActive: true, language: true, _count: { select: { questions: true } } }
    });
  } catch (error) { return []; }
}

// --- 19. FETCH EXAM RESPONSES ---
export async function getExamResponses(examId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.email) return [];
    const whereClause: any = { studentName: { not: null } };
    if (examId && examId !== 'all') whereClause.examId = examId;

    const responses = await prisma.examAccess.findMany({
      where: whereClause,
      include: {
        exam: { select: { title: true, questions: { select: { marks: true } } } }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return responses.map(r => {
      const totalPossible = r.exam?.questions.reduce((sum, q) => sum + q.marks, 0) || 1;
      const calculatedPercentage = Math.round(((r.score || 0) / totalPossible) * 100);
      return {
        id: r.id,
        studentName: r.studentName,
        email: r.studentEmail,
        studentPhone: (r as any).studentPhone || "N/A", 
        formTitle: r.exam?.title || 'Unknown Form',
        status: r.status === 'COMPLETED' ? 'Submitted' : 'Pending',
        score: r.score || 0,
        percentage: calculatedPercentage,
        accessCode: r.accessCode, 
        submissionDate: r.submittedAt ? r.submittedAt : r.createdAt, 
        supervisorName: session?.user?.name || "Admin Supervisor",
        supervisorEmail: session?.user?.email || "admin@aiclex.in"
      };
    });
  } catch (error) { return []; }
}