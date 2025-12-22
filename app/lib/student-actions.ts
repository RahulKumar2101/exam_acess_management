'use server'

import { prisma } from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { getTranslation } from '@/app/lib/translator';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- 1. SEND REGISTRATION EMAILS ---
export async function sendRegistrationEmails(formData: FormData) {
  try {
    // Get values safely
    const name = (formData.get('fullName') as string) || '';
    const company = (formData.get('companyName') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const supName = (formData.get('supName') as string) || '';
    const supEmail = (formData.get('supEmail') as string) || '';

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, 
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const style = "font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;";

    // 1. Email to ADMIN
    if (process.env.ADMIN_EMAIL) {
        await transporter.sendMail({
            from: `"Exam Portal" <${process.env.SMTP_USER}>`, 
            to: process.env.ADMIN_EMAIL, 
            subject: `🔔 New Registration: ${name}`,
            html: `<div style="${style}"><h2 style="color:#2563eb">New Registration</h2><p><strong>${name}</strong> (${company}) registered.</p><p>Phone: ${phone}</p><p>Supervisor: ${supName} (${supEmail})</p></div>`,
        });
    }

    // 2. Email to STUDENT
    if (email) {
        await transporter.sendMail({
            from: `"Exam Portal" <${process.env.SMTP_USER}>`, 
            to: email, 
            subject: `✅ Registration Successful - ${company}`,
            html: `<div style="${style}"><h2 style="color:#16a34a">Registration Confirmed</h2><p>Hi ${name},</p><p>You have successfully registered for the <strong>${company}</strong> exam.</p><p>Please proceed to select your language and question bank.</p></div>`,
        });
    }

    // 3. Email to SUPERVISOR (✅ UPDATED HERE)
    if (supEmail) {
        await transporter.sendMail({
            from: `"Exam Portal" <${process.env.SMTP_USER}>`, 
            to: supEmail, 
            subject: `📢 Student Registered: ${name}`,
            html: `
              <div style="${style}">
                <h2 style="color:#ca8a04">Student Registration Alert</h2>
                <p>Hello <strong>${supName}</strong>,</p>
                <p>Your student, <strong>${name}</strong> (${email}), has just registered for the exam under <strong>${company}</strong>.</p>
                <p style="font-size:12px; color:#666; margin-top:20px;">Please ensure they have the correct Access Code to proceed.</p>
              </div>
            `,
        });
    }

    return { success: true };
  } catch (error) {
    console.error("Email Error:", error);
    return { success: true }; 
  }
}

// ... (Keep the rest of the file: verifyAndStartExam, getAvailableExams, fetchExamContent, submitExam, getExamResult, sendReportEmail exactly as they were) ...
// ... Copy the rest from the previous correct version ...

// --- 2. VERIFY CODE & START EXAM ---
export async function verifyAndStartExam(formData: FormData) {
  try {
    const code = (formData.get('accessCode') as string) || '';
    const examId = (formData.get('examId') as string) || '';
    
    const name = (formData.get('fullName') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const supName = (formData.get('supName') as string) || '';
    const supEmail = (formData.get('supEmail') as string) || '';
    const inputCompany = (formData.get('companyName') as string) || '';

    const accessRecord = await prisma.examAccess.findUnique({ where: { accessCode: code } });

    if (!accessRecord) return { success: false, message: 'Invalid Access Code.' };
    if (accessRecord.status === 'COMPLETED') return { success: false, isCompleted: true, message: 'Exam already completed.' };

    if (accessRecord.companyName?.trim().toLowerCase() !== inputCompany?.trim().toLowerCase()) {
      return { success: false, message: `Code does not belong to ${inputCompany}.` };
    }

    await prisma.examAccess.update({
      where: { id: accessRecord.id },
      data: {
        studentName: name, studentEmail: email, studentPhone: phone,
        supervisorName: supName, supervisorEmail: supEmail,
        examId: examId, status: 'STARTED', sentAt: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, message: 'Verification failed.' };
  }
}

// --- 3. GET EXAMS ---
export async function getAvailableExams() {
  try {
    const exams = await prisma.exam.findMany({
      where: { isActive: true }, 
      select: { id: true, title: true, durationMin: true, language: true, _count: { select: { questions: true } } }
    });
    return { success: true, exams };
  } catch (error) { return { success: false, exams: [] }; }
}

// --- 4. FETCH CONTENT ---
export async function fetchExamContent(accessCode: string, specificExamId?: string, targetLang?: string) {
  try {
    const record = await prisma.examAccess.findUnique({ where: { accessCode } });
    if (!record) return { success: false, message: 'Invalid Code' };
    if (record.status === 'COMPLETED') return { success: false, isCompleted: true };

    const examIdToLoad = specificExamId || record.examId;
    if (!examIdToLoad) return { success: false, message: 'No Exam Selected' };

    const examData = await prisma.exam.findUnique({
        where: { id: examIdToLoad },
        select: { id: true, title: true, durationMin: true, language: true, questions: { select: { id: true, text: true, options: true, marks: true } } }
    });

    if (!examData) return { success: false, message: 'Exam Data Missing' };

    let processedQuestions: any[] = [];
    const originalQuestions = examData.questions;

    if (targetLang && targetLang !== 'English') {
        for (const q of originalQuestions) {
            try {
                await delay(200);
                const transText = await getTranslation(q.text, targetLang);
                const transOptions: string[] = [];
                let valid = true;
                for (const opt of q.options) {
                    const t = await getTranslation(opt, targetLang);
                    if (!t) { valid = false; break; }
                    transOptions.push(t);
                }
                processedQuestions.push({ ...q, text: q.text, options: q.options, translatedText: transText || undefined, translatedOptions: valid ? transOptions : undefined });
            } catch (e) { processedQuestions.push(q); }
        }
    } else { processedQuestions = originalQuestions; }

    return { success: true, exam: { ...examData, questions: processedQuestions } };
  } catch (error) { return { success: false, message: 'Load Failed' }; }
}

// --- 5. SUBMIT EXAM ---
export async function submitExam(accessCode: string, answers: Record<string, number>, examId: string) {
  try {
    const record = await prisma.examAccess.findUnique({ where: { accessCode } });
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } });
    if (!record || !exam) return { success: false };

    let score = 0, totalMarks = 0;
    exam.questions.forEach(q => {
        totalMarks += q.marks;
        if (answers[q.id] === q.correctOption) score += q.marks;
    });

    await prisma.examAccess.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', submittedAt: new Date(), score, examId }
    });

    return { success: true, score, totalMarks };
  } catch (error) { return { success: false }; }
}

// --- 6. GET RESULT ---
export async function getExamResult(accessCode: string) {
    try {
        const record = await prisma.examAccess.findUnique({ where: { accessCode }, include: { exam: true } });
        if (!record || record.status !== 'COMPLETED' || !record.exam) return { success: false };

        const totalQ = await prisma.question.count({ where: { examId: record.examId! } });
        const score = record.score || 0;
        
        return { 
            success: true,
            data: {
                studentName: record.studentName, studentEmail: record.studentEmail,
                supervisorName: record.supervisorName, supervisorEmail: record.supervisorEmail,
                examTitle: record.exam.title, submittedAt: record.submittedAt,
                score, totalQuestions: totalQ,
                correctAnswers: score, wrongAnswers: totalQ - score,
                status: (score >= totalQ * 0.4) ? 'Pass' : 'Fail'
            }
        };
    } catch (e) { return { success: false }; }
}

// --- 7. SEND REPORT EMAIL ---
export async function sendReportEmail(accessCode: string) {
    try {
        const res = await getExamResult(accessCode);
        if(!res.success || !res.data) return { success: false };
        const d = res.data;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: true, 
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const html = `
            <div style="font-family:sans-serif;padding:30px;border:1px solid #ddd;border-radius:10px;max-width:600px;margin:auto;">
                <h2 style="color:#2563eb;text-align:center;">Exam Report Card</h2>
                <hr style="margin:20px 0;border:0;border-top:1px solid #eee;">
                <p><strong>Student:</strong> ${d.studentName}</p>
                <p><strong>Exam:</strong> ${d.examTitle}</p>
                <div style="background:#f3f4f6;padding:15px;text-align:center;border-radius:8px;margin:20px 0;">
                    <h1 style="color:${d.status === 'Pass' ? 'green' : 'red'};margin:0;">${d.status.toUpperCase()}</h1>
                    <p>Score: ${d.score} / ${d.totalQuestions}</p>
                </div>
                <p>Correct: ${d.correctAnswers} | Wrong: ${d.wrongAnswers}</p>
            </div>`;

        // Filter out nulls to satisfy TypeScript
        const recipients = [
            d.studentEmail, 
            d.supervisorEmail, 
            process.env.ADMIN_EMAIL
        ].filter((e): e is string => !!e && e.length > 0);

        if (recipients.length > 0) {
            await Promise.all(recipients.map(e => 
                transporter.sendMail({ 
                    from: process.env.SMTP_USER, 
                    to: e, 
                    subject: `📄 Exam Result: ${d.studentName}`, 
                    html 
                })
            ));
        }

        return { success: true };
    } catch (e) { 
        console.error(e);
        return { success: false }; 
    }
}