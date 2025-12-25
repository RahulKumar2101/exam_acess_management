'use server'

import { prisma } from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { renderToStream } from '@react-pdf/renderer'; 
import ExamReportPDF from '@/app/components/ExamReportPDF'; 
import React from 'react';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

// ✅ FIXED: Type changed to 'any' to resolve "ReadableStream not assignable to Readable" error
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// --- 1. SEND REGISTRATION EMAILS (UPDATED WITH FULL DETAILS) ---
export async function sendRegistrationEmails(formData: FormData) {
  try {
    const name = (formData.get('fullName') as string) || '';
    const company = (formData.get('companyName') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const supName = (formData.get('supName') as string) || '';
    const supEmail = (formData.get('supEmail') as string) || '';

    const transporter = createTransporter();
    
    // Styles for clean email presentation
    const containerStyle = "font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 600px; margin: auto; color: #374151;";
    const headerStyle = "color: #2563eb; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 20px;";
    const sectionStyle = "background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 10px 0;";
    const labelStyle = "font-weight: bold; color: #111827; display: inline-block; width: 140px;";
    const btnStyle = "display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px; text-align: center;";

    // 1. ADMIN EMAIL (Full Data)
    if (process.env.ADMIN_EMAIL) {
      await transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🔔 Full Registration Data: ${name}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="${headerStyle}">New Portal Registration</h2>
            <div style="${sectionStyle}">
              <p style="margin: 5px 0;"><span style="${labelStyle}">Student Name:</span> ${name}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Student Email:</span> ${email}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Student Phone:</span> ${phone}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Company:</span> ${company}</p>
            </div>
            <div style="${sectionStyle}">
              <p style="margin: 5px 0;"><span style="${labelStyle}">Supervisor:</span> ${supName}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Sup. Email:</span> ${supEmail}</p>
            </div>
          </div>`,
      }).catch(() => {});
    }

    // 2. STUDENT EMAIL (Details + Link)
    if (email) {
      await transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `✅ Registration Successful - ${company}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="${headerStyle}">Registration Successful</h2>
            <p>Hi ${name}, you are registered for the <strong>${company}</strong> exam.</p>
            <div style="${sectionStyle}">
              <p style="margin: 5px 0;"><span style="${labelStyle}">Your Email:</span> ${email}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Your Phone:</span> ${phone}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Supervisor:</span> ${supName} (${supEmail})</p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || '#'}" style="${btnStyle}">Start Your Exam Now</a>
          </div>`,
      });
    }

    // 3. SUPERVISOR EMAIL (Full Student Details)
    if (supEmail) {
      await transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: supEmail,
        subject: `📢 Student Registered: ${name}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="color: #ca8a04; margin-bottom: 20px;">Supervisor Notification</h2>
            <p>Hello ${supName}, your student has registered for an exam.</p>
            <div style="${sectionStyle}">
              <h3 style="margin-top: 0; font-size: 16px;">Student Details:</h3>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Full Name:</span> ${name}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Email:</span> ${email}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Phone:</span> ${phone}</p>
              <p style="margin: 5px 0;"><span style="${labelStyle}">Company:</span> ${company}</p>
            </div>
          </div>`,
      });
    }

    return { success: true };
  } catch (error) {
    return { success: true }; 
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
    
    if (accessRecord.status === 'COMPLETED') {
        return { success: false, message: '⚠️ This code has already been used.' };
    }

    if (accessRecord.status === 'STARTED') {
        return { success: false, message: '⚠️ This code is currently active.' };
    }

    if (accessRecord.companyName?.trim().toLowerCase() !== inputCompany?.trim().toLowerCase()) {
      return { success: false, message: `Code does not belong to ${inputCompany}.` };
    }

    await prisma.examAccess.update({
      where: { id: accessRecord.id },
      data: {
        studentName: name, studentEmail: email, studentPhone: phone,
        supervisorName: supName, supervisorEmail: supEmail,
        examId: examId, 
        status: 'STARTED', 
        sentAt: new Date() 
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
        include: { 
            questions: {
                include: {
                    translations: {
                        where: { language: targetLang || 'English' } 
                    }
                }
            } 
        }
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

    const cleanExam = { ...examData, questions: processedQuestions };
    return { success: true, exam: cleanExam };
  } catch (error) { 
      return { success: false, message: 'Load Failed' }; 
  }
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
  } catch (error) { 
    return { success: false }; 
  }
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
            if (Number(userAnswer) === q.correctOption) {
                status = 'correct';
            } else {
                status = 'wrong';
            }
        }

        return {
            id: q.id,
            number: index + 1,
            questionText: q.text,
            status: status 
        };
    });

    return {
      success: true,
      data: {
        studentName: record.studentName,
        studentEmail: record.studentEmail,
        supervisorName: record.supervisorName,
        supervisorEmail: record.supervisorEmail,
        examTitle: record.exam.title,
        submittedAt: record.submittedAt,
        score,
        totalQuestions: totalMaxMarks,
        questionCount: questions.length, 
        correctAnswers: breakdown.filter(b => b.status === 'correct').length,
        wrongAnswers: breakdown.filter(b => b.status === 'wrong').length,
        skippedAnswers: breakdown.filter(b => b.status === 'skipped').length,
        status: isPass ? 'Pass' : 'Fail',
        breakdown: breakdown
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

    if (!record || !record.exam) return { success: false };

    const studentAnswers = (record.answers as Record<string, number>) || {};
    const questions = record.exam.questions;
    const totalMaxMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = record.score || 0;
    const isPass = score >= (totalMaxMarks * 0.5); 

    const safeStudentName = record.studentName || 'Student';
    const safeSupervisorName = record.supervisorName || 'Supervisor';

    const pdfData = {
        student: { 
            name: safeStudentName,
            email: record.studentEmail || 'N/A', 
            phone: record.studentPhone || 'N/A',
            company: record.companyName || 'N/A'
        },
        supervisor: { name: safeSupervisorName },
        exam: { 
            title: record.exam.title,
            date: record.submittedAt ? new Date(record.submittedAt).toLocaleDateString() : new Date().toLocaleDateString(),
            id: record.accessCode
        },
        result: {
            score,
            totalMarks: totalMaxMarks,
            percentage: Math.round((score / totalMaxMarks) * 100),
            status: isPass ? 'PASS' : 'FAIL',
            answers: questions.map((q, i) => ({
                index: i + 1,
                questionText: q.text,
                isCorrect: studentAnswers[q.id] === q.correctOption,
                status: studentAnswers[q.id] === q.correctOption ? 'Correct' : 'Wrong'
            }))
        }
    };

    const pdfStream = await renderToStream(React.createElement(ExamReportPDF, pdfData as any));
    const pdfBuffer = await streamToBuffer(pdfStream);
    const transporter = createTransporter();
    
    const recipients = [record.studentEmail, record.supervisorEmail, process.env.ADMIN_EMAIL]
      .filter((e): e is string => !!e && e.length > 0);

    if (recipients.length > 0) {
        for (const email of recipients) {
            await transporter.sendMail({
                from: `"Exam Portal" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `📄 Official Exam Report: ${safeStudentName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">Exam Result Notification</h2>
                    <p>Hello,</p>
                    <p>The official examination report for <strong>${safeStudentName}</strong> (${record.companyName || 'Company'}) is attached.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${isPass ? '#22c55e' : '#ef4444'};">
                        <p style="margin: 0; font-size: 14px; color: #64748b;">Result Status: <strong>${isPass ? 'PASSED' : 'FAILED'}</strong></p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #475569;">Score: ${score} / ${totalMaxMarks} (${Math.round((score / totalMaxMarks) * 100)}%)</p>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">This is an automated message. Please do not reply.</p>
                    </div>
                `,
                attachments: [{
                    filename: `ExamReport_${safeStudentName.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBuffer,
                }]
            });
        }
    }
    return { success: true };
  } catch (e) { return { success: false }; }
}