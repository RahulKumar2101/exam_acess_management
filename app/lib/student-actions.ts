'use server'

import { prisma } from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { renderToStream } from '@react-pdf/renderer'; 
import ExamReportPDF from '@/app/components/ExamReportPDF'; 
import React from 'react';

// ✅ Robust Transporter Configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Optimize for serverless environments
    pool: true,
    maxConnections: 3,
  });
};

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// --- 1. SEND REGISTRATION EMAILS ---
export async function sendRegistrationEmails(formData: FormData) {
  try {
    const name = (formData.get('fullName') as string) || '';
    const company = (formData.get('companyName') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const supName = (formData.get('supName') as string) || '';
    const supEmail = (formData.get('supEmail') as string) || '';

    const transporter = createTransporter();
    
    const containerStyle = "font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 600px; margin: auto; color: #374151;";
    const headerStyle = "color: #2563eb; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 20px;";
    const sectionStyle = "background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 10px 0;";
    const labelStyle = "font-weight: bold; color: #111827; display: inline-block; width: 140px;";
    const btnStyle = "display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px; text-align: center;";

    // ✅ FIX: Create an array of promises so they run in parallel
    const emailPromises = [];

    // 1. Admin Email
    if (process.env.ADMIN_EMAIL) {
      emailPromises.push(transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🔔 Full Registration Data: ${name}`,
        html: `<div style="${containerStyle}"><h2 style="${headerStyle}">New Portal Registration</h2><div style="${sectionStyle}"><p><span style="${labelStyle}">Student:</span> ${name}</p><p><span style="${labelStyle}">Email:</span> ${email}</p><p><span style="${labelStyle}">Company:</span> ${company}</p></div></div>`,
      }));
    }

    // 2. Student Email
    if (email) {
      emailPromises.push(transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `✅ Registration Successful - ${company}`,
        html: `<div style="${containerStyle}"><h2 style="${headerStyle}">Registration Successful</h2><p>Hi ${name}, you are registered for ${company}.</p><a href="${process.env.NEXT_PUBLIC_BASE_URL || '#'}" style="${btnStyle}">Start Your Exam Now</a></div>`,
      }));
    }

    // 3. Supervisor Email
    if (supEmail) {
      emailPromises.push(transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: supEmail,
        subject: `📢 Student Registered: ${name}`,
        html: `<div style="${containerStyle}"><h2 style="color: #ca8a04; margin-bottom: 20px;">Supervisor Notification</h2><p>Hello ${supName}, your student ${name} has registered.</p></div>`,
      }));
    }

    // ✅ CRITICAL FIX: Use allSettled so one failure doesn't block the others
    await Promise.allSettled(emailPromises);

    return { success: true };
  } catch (error) {
    console.error("REGISTRATION_EMAIL_ERROR:", error);
    return { success: false, message: "Failed to send emails." }; 
  }
}

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
    if (accessRecord.status === 'COMPLETED') return { success: false, message: '⚠️ Code used.' };
    if (accessRecord.status === 'STARTED') return { success: false, message: '⚠️ Code active.' };

    if (accessRecord.companyName?.trim().toLowerCase() !== inputCompany?.trim().toLowerCase()) {
      return { success: false, message: `Code doesn't belong to ${inputCompany}.` };
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
        include: { questions: { include: { translations: { where: { language: targetLang || 'English' } } } } }
    });

    if (!examData) return { success: false, message: 'Exam Data Missing' };

    const processedQuestions = examData.questions.map(q => {
        const trans = q.translations[0];
        return {
            id: q.id,
            text: q.text, 
            options: q.options,
            marks: q.marks,
            translatedText: (targetLang && targetLang !== 'English' && trans) ? trans.text : null,
            translatedOptions: (targetLang && targetLang !== 'English' && trans) ? trans.options : null,
        };
    });

    return { success: true, exam: { ...examData, questions: processedQuestions } };
  } catch (error) { return { success: false, message: 'Load Failed' }; }
}

// --- 5. SUBMIT EXAM ---
export async function submitExam(accessCode: string, answers: Record<string, number>, examId: string) {
  try {
    const record = await prisma.examAccess.findUnique({ where: { accessCode } });
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } });
    if (!record || !exam) return { success: false };

    let score = 0;
    exam.questions.forEach(q => {
      if (answers[q.id] !== undefined && answers[q.id] === q.correctOption) {
          score += q.marks;
      }
    });

    await prisma.examAccess.update({
      where: { id: record.id },
      data: { status: 'COMPLETED', submittedAt: new Date(), score, examId, answers: answers as any }
    });

    return { success: true, score };
  } catch (error) { return { success: false }; }
}

// --- 6. GET RESULT ---
export async function getExamResult(accessCode: string) {
  try {
    const record = await prisma.examAccess.findUnique({
      where: { accessCode },
      include: { exam: { include: { questions: true } } }
    });

    if (!record || record.status !== 'COMPLETED' || !record.exam) return { success: false };

    const questions = record.exam.questions;
    const studentAnswers = (record.answers as Record<string, number>) || {}; 
    const totalMaxMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = record.score || 0;
    const isPass = score >= (totalMaxMarks * 0.5); 

    const breakdown = questions.map((q, index) => {
        const userAnswer = studentAnswers[q.id];
        let status = 'skipped';
        if (userAnswer !== undefined && userAnswer !== null) {
            status = Number(userAnswer) === q.correctOption ? 'correct' : 'wrong';
        }
        return { id: q.id, number: index + 1, questionText: q.text, status };
    });

    return {
      success: true,
      data: {
        studentName: record.studentName,
        submittedAt: record.submittedAt,
        score,
        totalQuestions: totalMaxMarks,
        correctAnswers: breakdown.filter(b => b.status === 'correct').length,
        wrongAnswers: breakdown.filter(b => b.status === 'wrong').length,
        skippedAnswers: breakdown.filter(b => b.status === 'skipped').length,
        status: isPass ? 'Pass' : 'Fail',
        breakdown
      }
    };
  } catch (e) { return { success: false }; }
}

// --- 7. SEND REPORT EMAIL ---
export async function sendReportEmail(accessCode: string) {
  try {
    const record = await prisma.examAccess.findUnique({ 
        where: { accessCode }, 
        include: { exam: { include: { questions: true } } } 
    });

    if (!record || !record.exam) return { success: false, message: "Record not found" };

    const studentAnswers = (record.answers as Record<string, number>) || {};
    const questions = record.exam.questions;
    const totalMaxMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = record.score || 0;
    const isPass = score >= (totalMaxMarks * 0.5); 

    const safeStudentName = record.studentName || 'Student';

    const pdfData = {
        student: { name: safeStudentName, email: record.studentEmail, phone: record.studentPhone, company: record.companyName },
        supervisor: { name: record.supervisorName },
        exam: { title: record.exam.title, date: new Date().toLocaleDateString(), id: record.accessCode },
        result: {
            score, totalMarks: totalMaxMarks, percentage: Math.round((score / totalMaxMarks) * 100),
            status: isPass ? 'PASS' : 'FAIL',
            answers: questions.map((q, i) => ({
                index: i + 1, questionText: q.text,
                status: studentAnswers[q.id] === q.correctOption ? 'Correct' : 'Wrong'
            }))
        }
    };

    const pdfStream = await renderToStream(React.createElement(ExamReportPDF, pdfData as any));
    const pdfBuffer = await streamToBuffer(pdfStream);
    const transporter = createTransporter();
    
    // ✅ FIX: Filter out empty emails and join with commas to send ONE email to all
    const recipients = [record.studentEmail, record.supervisorEmail, process.env.ADMIN_EMAIL]
      .filter((e): e is string => !!e && e.includes('@'));

    if (recipients.length > 0) {
        await transporter.sendMail({
            from: `"Exam Portal" <${process.env.SMTP_USER}>`,
            to: recipients.join(','), // Sends to everyone in one SMTP transaction
            subject: `📄 Official Exam Report: ${safeStudentName}`,
            html: `
                <div style="font-family: Arial; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #2563eb;">Exam Result Notification</h2>
                    <p>The official report for <strong>${safeStudentName}</strong> is attached.</p>
                    <p>Status: <strong>${isPass ? 'PASSED' : 'FAILED'}</strong></p>
                    <p>Score: ${score} / ${totalMaxMarks}</p>
                </div>`,
            attachments: [{
                filename: `ExamReport_${safeStudentName.replace(/\s+/g, '_')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }]
        });
    }

    return { success: true };
  } catch (error: any) { 
    console.error("REPORT_EMAIL_ERROR:", error.message);
    return { success: false, message: error.message }; 
  }
}