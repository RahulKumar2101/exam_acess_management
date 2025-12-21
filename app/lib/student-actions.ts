'use server'

import { prisma } from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { getTranslation } from '@/app/lib/translator';

// ✅ Helper: Delay function to prevent overwhelming the translation API
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- 1. SEND EMAIL NOTIFICATION ---
export async function sendAdminNotification(formData: FormData) {
  try {
    const name = formData.get('fullName') as string;
    const company = formData.get('companyName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    
    // Capture Supervisor Details
    const supName = formData.get('supName') as string || 'N/A';
    const supEmail = formData.get('supEmail') as string || 'N/A';

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Exam Portal" <${process.env.SMTP_USER}>`, 
      to: process.env.ADMIN_EMAIL, 
      subject: `🔔 New Student Registration: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">New Student Registration</h2>
          <p><strong>${name}</strong> has just filled out the registration form.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr><td style="padding: 8px; color: #666;">Company:</td><td style="padding: 8px; font-weight: bold;">${company}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Email:</td><td style="padding: 8px; font-weight: bold;">${email}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Phone:</td><td style="padding: 8px; font-weight: bold;">${phone}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Supervisor:</td><td style="padding: 8px; font-weight: bold;">${supName} (${supEmail})</td></tr>
          </table>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    return { success: true }; 
  }
}

// --- 2. VALIDATE & REGISTER ---
export async function validateAndRegisterStudent(formData: FormData) {
  try {
    const code = formData.get('accessCode') as string;
    const name = formData.get('fullName') as string;
    const inputCompanyName = formData.get('companyName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const supName = formData.get('supName') as string;
    const supEmail = formData.get('supEmail') as string;

    const accessRecord = await prisma.examAccess.findUnique({
      where: { accessCode: code },
    });

    if (!accessRecord) {
      return { success: false, message: 'Invalid Access Code.' };
    }
    
    // ✅ BLOCK LOGIC: Return 'isCompleted' flag
    if (accessRecord.status === 'COMPLETED') {
        return { success: false, isCompleted: true, message: 'This exam has already been completed.' };
    }

    if (accessRecord.status !== 'ACTIVE' && accessRecord.status !== 'STARTED') {
      return { success: false, message: 'This code has expired.' };
    }

    const dbCompany = accessRecord.companyName?.trim().toLowerCase();
    const userCompany = inputCompanyName?.trim().toLowerCase();

    if (dbCompany !== userCompany) {
      return { success: false, message: `Access code mismatch.` };
    }

    await prisma.examAccess.update({
      where: { id: accessRecord.id },
      data: {
        studentName: name,
        studentEmail: email,
        studentPhone: phone,
        supervisorName: supName,
        supervisorEmail: supEmail,
        status: 'STARTED', 
        sentAt: new Date()
      }
    });

    return { success: true };

  } catch (error) {
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

// --- 3. GET ALL AVAILABLE EXAMS ---
export async function getAvailableExams() {
  try {
    const exams = await prisma.exam.findMany({
      where: { isActive: true }, 
      select: {
        id: true, title: true, durationMin: true, language: true,
        _count: { select: { questions: true } }
      }
    });
    return { success: true, exams };
  } catch (error) {
    return { success: false, exams: [] };
  }
}

// --- 4. FETCH EXAM CONTENT ---
export async function fetchExamContent(accessCode: string, specificExamId?: string, targetLang?: string) {
  try {
    const record = await prisma.examAccess.findUnique({ where: { accessCode } });
    if (!record) return { success: false, message: 'Access Code not found.' };

    // ✅ BLOCK LOGIC: Check completion status
    if (record.status === 'COMPLETED') {
        return { success: false, isCompleted: true, message: 'Exam already completed.' };
    }

    const examIdToLoad = specificExamId || record.examId;
    if (!examIdToLoad) return { success: false, message: 'No Question Bank Selected.' };

    const examData = await prisma.exam.findUnique({
        where: { id: examIdToLoad },
        select: {
            id: true, title: true, durationMin: true, language: true,
            questions: { select: { id: true, text: true, options: true, marks: true } }
        }
    });

    if (!examData) return { success: false, message: 'Exam data not found.' };

    // ✅ ROBUST SEQUENTIAL TRANSLATION
    let processedQuestions: any[] = [];
    const originalQuestions = examData.questions;

    if (targetLang && targetLang !== 'English') {
        for (const q of originalQuestions) {
            try {
                // Add delay to ensure stability
                await delay(200);

                // 1. Translate Question Text
                const transText = await getTranslation(q.text, targetLang);
                
                // 2. Translate Options
                const transOptions: string[] = [];
                let optionsValid = true;
                
                for (const opt of q.options) {
                    const tOpt = await getTranslation(opt, targetLang);
                    if (!tOpt) { optionsValid = false; break; }
                    transOptions.push(tOpt);
                }

                processedQuestions.push({
                    ...q,
                    text: q.text, // Keep English
                    options: q.options, // Keep English
                    translatedText: transText || undefined,
                    translatedOptions: optionsValid ? transOptions : undefined
                });

            } catch (err) {
                // Fallback to original on failure
                processedQuestions.push(q);
            }
        }
    } else {
        processedQuestions = originalQuestions;
    }

    return { 
      success: true, 
      exam: { ...examData, questions: processedQuestions } 
    };

  } catch (error) {
    return { success: false, message: 'Failed to load exam.' };
  }
}

// --- 5. SUBMIT EXAM ---
export async function submitExam(accessCode: string, answers: Record<string, number>, examId: string) {
  try {
    const accessRecord = await prisma.examAccess.findUnique({ where: { accessCode } });
    if (!accessRecord) return { success: false };

    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } });
    if (!exam) return { success: false };

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;

    exam.questions.forEach((q) => {
        totalMarks += q.marks;
        if (answers[q.id] === q.correctOption) {
            score += q.marks;
            correctCount++;
        } else {
            wrongCount++;
        }
    });

    // Save Score & Mark as COMPLETED
    await prisma.examAccess.update({
        where: { id: accessRecord.id },
        data: {
            status: 'COMPLETED',
            submittedAt: new Date(),
            score: score, 
            examId: examId 
        }
    });

    return { success: true, score, totalMarks, correctCount, wrongCount };

  } catch (error) {
    return { success: false };
  }
}

// --- 6. GET EXAM RESULT ---
export async function getExamResult(accessCode: string) {
    try {
        const record = await prisma.examAccess.findUnique({
            where: { accessCode },
            include: { exam: true }
        });

        if (!record || record.status !== 'COMPLETED' || !record.exam) {
            return { success: false };
        }

        const totalQuestions = await prisma.question.count({
            where: { examId: record.examId! }
        });
        
        // Calculate stats
        const score = record.score || 0;
        const correctAnswers = score; // Assuming 1 mark/question
        const wrongAnswers = totalQuestions - correctAnswers;
        
        const isPass = score >= (totalQuestions * 0.4); 

        return { 
            success: true,
            data: {
                studentName: record.studentName,
                studentEmail: record.studentEmail,
                studentPhone: record.studentPhone,
                supervisorName: record.supervisorName,
                supervisorEmail: record.supervisorEmail,
                examTitle: record.exam.title,
                submittedAt: record.submittedAt,
                score: score,
                totalQuestions: totalQuestions,
                correctAnswers: correctAnswers, // ✅
                wrongAnswers: wrongAnswers,     // ✅
                status: isPass ? 'Pass' : 'Fail'
            }
        };
    } catch (error) {
        return { success: false };
    }
}