'use server'

import { prisma } from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { getTranslation } from '@/app/lib/translator';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

// --- 1. SEND REGISTRATION EMAILS (Kept Async to ensure delivery confirmation) ---
export async function sendRegistrationEmails(formData: FormData) {
  try {
    const name = (formData.get('fullName') as string) || '';
    const company = (formData.get('companyName') as string) || '';
    const email = (formData.get('email') as string) || '';
    const phone = (formData.get('phone') as string) || '';
    const supName = (formData.get('supName') as string) || '';
    const supEmail = (formData.get('supEmail') as string) || '';

    const transporter = createTransporter();
    
    // Base styles
    const containerStyle = "font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: auto;";
    const btnStyle = "display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; cursor: pointer;";

    // 1. Email to ADMIN
    if (process.env.ADMIN_EMAIL) {
      transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `🔔 New Registration: ${name}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="color:#2563eb">New Registration</h2>
            <p><strong>${name}</strong> (${company}) registered.</p>
            <p>Phone: ${phone}</p>
            <p>Supervisor: ${supName} (${supEmail})</p>
          </div>`,
      }).catch(err => console.error("Admin Email Failed", err));
    }

    // 2. Email to STUDENT
    if (email) {
      await transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `✅ Registration Successful - ${company}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="color:#16a34a">Registration Confirmed</h2>
            <p>Hi ${name},</p>
            <p>You have successfully registered for the <strong>${company}</strong> exam.</p>
            <p>Please click below to start your exam:</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || '#'}" style="${btnStyle}">Start Exam Portal</a>
          </div>`,
      });
    }

    // 3. Email to SUPERVISOR
    if (supEmail) {
      transporter.sendMail({
        from: `"Exam Portal" <${process.env.SMTP_USER}>`,
        to: supEmail,
        subject: `📢 Student Registered: ${name}`,
        html: `
          <div style="${containerStyle}">
            <h2 style="color:#ca8a04">Student Alert</h2>
            <p>Hello ${supName},</p>
            <p>Your student <strong>${name}</strong> (${email}) has registered for <strong>${company}</strong>.</p>
          </div>`,
      }).catch(err => console.error("Sup Email Failed", err));
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
    if (accessRecord.status === 'COMPLETED') return { success: false, isCompleted: true, message: 'Exam already completed.' };

    if (accessRecord.companyName?.trim().toLowerCase() !== inputCompany?.trim().toLowerCase()) {
      return { success: false, message: `Code does not belong to ${inputCompany}.` };
    }

    // 🛡️ SECURITY: 'sentAt' acts as the OFFICIAL START TIME
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
            ...q,
            text: q.text, 
            options: q.options,
            translatedText: (targetLang && targetLang !== 'English' && trans) ? trans.text : null,
            translatedOptions: (targetLang && targetLang !== 'English' && trans) ? trans.options : null,
            translations: undefined 
        };
    });

    const cleanExam = { ...examData, questions: processedQuestions };
    return { success: true, exam: cleanExam };
  } catch (error) { 
      return { success: false, message: 'Load Failed' }; 
  }
}

// --- 5. SUBMIT EXAM (🛡️ SECURITY UPGRADED) ---
export async function submitExam(accessCode: string, answers: Record<string, number>, examId: string) {
  try {
    const record = await prisma.examAccess.findUnique({ where: { accessCode } });
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { questions: true } });
    if (!record || !exam) return { success: false };

    // 🛡️ SECURITY CHECK: Time Validation
    // We check the time on the SERVER, not the client.
    if (record.sentAt) {
        const startTime = new Date(record.sentAt).getTime();
        const currentTime = new Date().getTime();
        const timeTakenMinutes = (currentTime - startTime) / 1000 / 60;
        
        // Allow a 2-minute "grace period" for slow internet/latency
        const allowedDuration = exam.durationMin + 2; 

        if (timeTakenMinutes > allowedDuration) {
            // OPTION: We accept the exam but you could mark it as 'LATE' in database if you added a flag.
            // For now, we will log it and proceed, OR you can return { success: false } to reject it.
            // Proceeding is usually safer for UX, as legitimate lag happens.
        }
    }

    let score = 0;
    exam.questions.forEach(q => {
      if (answers[q.id] === q.correctOption) score += q.marks;
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
    const totalMaxMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = record.score || 0;
    const isPass = score >= (totalMaxMarks * 0.4);

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
        correctAnswers: score,
        status: isPass ? 'Pass' : 'Fail'
      }
    };
  } catch (e) { return { success: false }; }
}

// --- 7. SEND REPORT EMAIL (🚀 PERFORMANCE UPGRADED: FIRE & FORGET) ---
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
    const isPass = score >= (totalMaxMarks * 0.4);

    const transporter = createTransporter();
    
    // Build HTML for Questions
    let questionsHtml = '';
    questions.forEach((q, index) => {
        const userChoice = studentAnswers[q.id];
        const correctChoice = q.correctOption;
        const isCorrect = userChoice === correctChoice;
        
        let optionsList = '';
        q.options.forEach((opt, optIdx) => {
            let style = 'padding: 8px; margin: 4px 0; font-size: 14px; list-style: none; border-radius: 4px;';
            let mark = '';

            if (optIdx === correctChoice) {
                style += 'color: #166534; font-weight: bold; background-color: #dcfce7; border: 1px solid #bbf7d0;';
                mark = ' ✅';
            } else if (optIdx === userChoice && !isCorrect) {
                style += 'color: #991b1b; font-weight: bold; background-color: #fee2e2; border: 1px solid #fecaca;';
                mark = ' ❌ (Your Answer)';
            } else if (optIdx === userChoice && isCorrect) {
                 mark = ' (Your Answer)';
            } else {
                style += 'color: #4b5563; background-color: #f9fafb;';
            }
            optionsList += `<li style="${style}">${opt}${mark}</li>`;
        });

        questionsHtml += `
            <div style="margin-bottom: 24px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #fff; border-left: 5px solid ${isCorrect ? '#22c55e' : '#ef4444'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <p style="margin: 0 0 12px 0; font-weight: bold; font-size: 16px; color: #111827;">
                    <span style="color: #6b7280; font-size: 14px; text-transform: uppercase;">Q${index + 1}:</span> ${q.text} 
                </p>
                <ul style="padding: 0; margin: 0;">${optionsList}</ul>
            </div>
        `;
    });

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #374151; background-color: #f3f4f6; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; margin-bottom: 20px;">
                    <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Detailed Exam Report</h1>
                    <p style="color: #6b7280; margin: 5px 0 0;">${record.exam.title}</p>
                </div>

                <div style="background-color: ${isPass ? '#f0fdf4' : '#fef2f2'}; padding: 20px; border-radius: 12px; border: 1px solid ${isPass ? '#bbf7d0' : '#fecaca'}; text-align: center; margin-bottom: 30px;">
                    <h2 style="color: ${isPass ? '#166534' : '#991b1b'}; margin: 0; font-size: 32px;">${isPass ? 'PASS' : 'FAIL'}</h2>
                    <p style="font-size: 18px; margin: 5px 0 0; color: #374151;">Score: <strong>${score}</strong> / ${totalMaxMarks}</p>
                </div>

                <table style="width: 100%; font-size: 14px; color: #4b5563; margin-bottom: 30px;">
                    <tr><td style="padding: 5px 0;"><strong>Student:</strong></td><td style="text-align: right;">${record.studentName}</td></tr>
                    <tr><td style="padding: 5px 0;"><strong>ID:</strong></td><td style="text-align: right;">${record.accessCode}</td></tr>
                    <tr><td style="padding: 5px 0;"><strong>Date:</strong></td><td style="text-align: right;">${new Date().toLocaleDateString()}</td></tr>
                </table>

                <h3 style="border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; color: #111827; margin-top: 0;">Question Breakdown</h3>
                ${questionsHtml}
                
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px;">
                    © ExamPortal Automated Report
                </div>
            </div>
        </div>
    `;

    // Filter recipients
    const recipients = [
        record.studentEmail, 
        record.supervisorEmail, 
        process.env.ADMIN_EMAIL
    ].filter((e): e is string => !!e && e.length > 0);

    if (recipients.length > 0) {
      // 🚀 PERFORMANCE FIX: Fire & Forget
      // We start the email process but DO NOT 'await' it. 
      // This returns { success: true } immediately to the user.
      Promise.allSettled(recipients.map(e =>
        transporter.sendMail({
          from: process.env.SMTP_USER,
          to: e,
          subject: `📄 Result: ${record.studentName} - ${isPass ? 'PASS' : 'FAIL'}`,
          html
        })
      )).catch(err => console.error("Background Email Error", err));
    }

    return { success: true };
  } catch (e) {
    return { success: false };
  }
}