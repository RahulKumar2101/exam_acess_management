'use server'

import { signIn, auth, signOut } from '../../auth'
import { AuthError } from 'next-auth'
import { prisma } from '@/app/lib/prisma'
import { revalidatePath } from 'next/cache'

// Helper: Generate simple random string
function generateAccessCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result.match(/.{1,4}/g)?.join('-') || result;
}

// --- 1. LOGIN ACTION ---
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', {
      ...Object.fromEntries(formData),
      redirectTo: '/admin/dashboard', 
    })
  } catch (error) {
    if ((error as Error).message.includes('NEXT_REDIRECT')) {
        throw error;
    }
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.'
        default:
          return 'Something went wrong.'
      }
    }
    throw error
  }
}

// --- 2. CREATE EXAM ACTION ---
export async function createExam(prevState: any, formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { message: 'Unauthorized: You must be logged in.' };
    }

    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          password: 'temp-password-123', 
          name: 'Admin User'
        }
      });
    }

    const title = formData.get('title') as string;
    const duration = parseInt(formData.get('duration') as string) || 30;
    const language = formData.get('language') as string || 'English';
    const isActive = formData.get('isActive') === 'on'; 

    if (!title) {
      return { message: 'Please enter a Form Name.' };
    }

    const newExam = await prisma.exam.create({
      data: {
        title,
        durationMin: duration,
        language,
        isActive,
        creatorId: user.id,
      },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', examId: newExam.id };

  } catch (error) {
    return { message: 'Database Error: Failed to create form.' };
  }
}

// --- 3. DELETE EXAM ACTION ---
export async function deleteExam(examId: string) {
  try {
    await prisma.question.deleteMany({ where: { examId: examId } });
    await prisma.exam.delete({ where: { id: examId } });
    revalidatePath('/admin/dashboard');
    return { message: 'Deleted' };
  } catch (error) {
    return { message: 'Failed to delete' };
  }
}

// --- 4. FETCH QUESTIONS ---
export async function getExamQuestions(examId: string) {
  try {
    const questions = await prisma.question.findMany({
      where: { examId },
      orderBy: { id: 'asc' }
    });
    return questions;
  } catch (error) {
    return [];
  }
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

    if (!text) return { message: 'Question text is required.' };
    if (isNaN(correctOptionIndex)) return { message: 'Please select a correct answer.' };

    const newQuestion = await prisma.question.create({
      data: {
        text,
        marks,
        correctOption: correctOptionIndex,
        options, 
        examId,
      },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', question: newQuestion }; 

  } catch (error) {
    return { message: 'Failed to add question.' };
  }
}

// --- 6. DELETE QUESTION ACTION ---
export async function deleteQuestion(questionId: string, examId: string) {
  try {
    await prisma.question.delete({ where: { id: questionId } });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) {
    return { message: 'Failed' };
  }
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

    if (!text) return { message: 'Question text is required.' };
    if (isNaN(correctOptionIndex)) return { message: 'Please select a correct answer.' };

    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        text,
        marks,
        correctOption: correctOptionIndex,
        options,
      },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', question: updatedQuestion };

  } catch (error) {
    return { message: 'Failed to update question.' };
  }
}

// --- 9. UPDATE EXAM ACTION ---
export async function updateExam(examId: string, prevState: any, formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { message: 'Unauthorized' };
    }

    const title = formData.get('title') as string;
    const duration = parseInt(formData.get('duration') as string) || 30;
    const language = formData.get('language') as string || 'English';
    const isActive = formData.get('isActive') === 'on'; 

    if (!title) {
      return { message: 'Form Name is required.' };
    }

    const updatedExam = await prisma.exam.update({
      where: { id: examId },
      data: {
        title,
        durationMin: duration,
        language,
        isActive,
      },
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success', examId: updatedExam.id };

  } catch (error) {
    return { message: 'Failed to update form.' };
  }
}

// --- 10. FETCH DATA FOR ACCESS DASHBOARD (Grouped by Batch) ---
// ✅ UPDATED: Filters out null batchIds to prevent key errors
export async function getExamAccessDashboard() {
  try {
    const session = await auth();
    if (!session?.user?.email) return { batches: [], stats: { companies: 0, activeCodes: 0 } };

    // 1. Get total count of active codes
    const activeCodesCount = await prisma.examAccess.count({
      where: { status: 'ACTIVE' }
    });

    // 2. Group by Batch ID
    const groupedBatches = await prisma.examAccess.groupBy({
      by: ['batchId', 'companyName', 'createdAt'],
      _count: {
        accessCode: true 
      },
      where: {
        batchId: { not: null } // ✅ Important: Exclude null batch IDs
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map to cleaner structure
    const batches = groupedBatches.map(b => ({
      batchId: b.batchId as string, // Safe cast because of 'where' clause
      companyName: b.companyName,
      createdAt: b.createdAt,
      count: b._count.accessCode
    }));

    return {
      batches: batches,
      stats: {
        companies: batches.length, 
        activeCodes: activeCodesCount
      }
    };
  } catch (error) {
    return { batches: [], stats: { companies: 0, activeCodes: 0 } };
  }
}

// --- 11. FETCH CODES FOR A SPECIFIC BATCH (For Download) ---
export async function getBatchCodesForDownload(batchId: string) {
  try {
    const codes = await prisma.examAccess.findMany({
      where: { batchId: batchId },
      select: {
        accessCode: true,
        companyName: true,
        status: true,
        studentName: true 
      }
    });
    return codes;
  } catch (error) {
    return [];
  }
}

// --- 12. BULK GENERATE CODES ---
export async function generateBulkCodes(prevState: any, formData: FormData) {
  try {
    const session = await auth();
    if (!session) return { message: 'Unauthorized' };

    const companyName = formData.get('companyName') as string;
    const quantity = parseInt(formData.get('amount') as string) || 100;

    if (!companyName) return { message: 'Company Name is required.' };

    const prefix = companyName.replace(/\s/g, '').substring(0, 3).toUpperCase();
    const batchId = crypto.randomUUID(); 
    const data = [];
    
    for (let i = 0; i < quantity; i++) {
      const num = Math.floor(100000 + Math.random() * 900000);
      const code = `${prefix}${num}`; 
      
      data.push({
        companyName,
        accessCode: code,
        batchId: batchId,
        status: 'ACTIVE',
        examId: null,
        studentName: null, 
        studentEmail: null
      });
    }

    await prisma.examAccess.createMany({ data, skipDuplicates: true });
    
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };

  } catch (error) {
    return { message: 'Failed to generate codes.' };
  }
}

// --- 13. RESET ACCESS CODE ---
export async function resetAccessCode(accessId: string) {
    try {
      const newCode = generateAccessCode();
      await prisma.examAccess.update({
        where: { id: accessId },
        data: {
            accessCode: newCode,
            status: 'ACTIVE',
            sentAt: null, 
            submittedAt: null 
        }
      });
      revalidatePath('/admin/dashboard');
      return { message: 'Success', newCode };
    } catch (error) {
      return { message: 'Failed to reset' };
    }
}

// --- 14. MARK AS SENT ---
export async function markAsSent(accessId: string) {
  try {
    await prisma.examAccess.update({
      where: { id: accessId },
      data: { sentAt: new Date() }
    });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) {
    return { message: 'Failed' };
  }
}

// --- 15. DELETE BATCH ---
export async function deleteBatch(batchId: string) {
  try {
    await prisma.examAccess.deleteMany({
      where: { batchId: batchId }
    });
    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) {
    return { message: 'Failed to delete batch.' };
  }
}

// --- 16. UPDATE BATCH ---
export async function updateBatch(batchId: string, prevState: any, formData: FormData) {
  try {
    const companyName = formData.get('companyName') as string;

    if (!companyName) return { message: 'Company Name required' };

    await prisma.examAccess.updateMany({
      where: { batchId: batchId },
      data: {
        companyName: companyName,
      }
    });

    revalidatePath('/admin/dashboard');
    return { message: 'Success' };
  } catch (error) {
    return { message: 'Failed to update batch.' };
  }
}