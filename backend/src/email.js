import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SENT_EMAILS_FILE = path.join(__dirname, '../data/sent-emails.json');

// Helper to record simulated emails locally
function recordMockEmail(emailData) {
  try {
    const dir = path.dirname(SENT_EMAILS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let records = [];
    if (fs.existsSync(SENT_EMAILS_FILE)) {
      const raw = fs.readFileSync(SENT_EMAILS_FILE, 'utf8');
      records = JSON.parse(raw || '[]');
    }

    records.push({
      timestamp: new Date().toISOString(),
      ...emailData,
    });

    fs.writeFileSync(SENT_EMAILS_FILE, JSON.stringify(records, null, 2));
  } catch (err) {
    console.error('Failed to log mock email:', err);
  }
}

// Check SMTP configurations
const isSmtpConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;

if (isSmtpConfigured) {
  console.log('📬 SMTP Configured. Initializing Nodemailer transporter.');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.log('⚠️ SMTP Credentials missing in backend .env. Emails will run in MOCK MODE.');
}

/**
 * Send an interview invitation email.
 */
export async function sendInviteEmail(candidate, jobTitle, duration, deadline, link) {
  const subject = `Invitation: AI Interview for ${jobTitle}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 8px;">
      <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">AI Interview Invitation</h2>
      <p>Hello <strong>${candidate.name}</strong>,</p>
      <p>You have been shortlisted by our recruitment team for the <strong>${jobTitle}</strong> position. We would like to invite you to complete your official interview using our AI Interviewer platform.</p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0;"><strong>Interview Configuration:</strong></p>
        <p style="margin: 0 0 5px 0;">⏰ <strong>Duration:</strong> ${duration} Minutes</p>
        <p style="margin: 0 0 5px 0;">📅 <strong>Deadline:</strong> ${deadline || 'N/A'}</p>
      </div>
      
      <p>Please click the button below to open the application and start your interview:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start My Interview</a>
      </div>
      
      <p style="font-size: 13px; color: #64748b; margin-top: 30px;">
        If you are on mobile, this link will open your installed AI Interviewer app. Make sure you are in a quiet room with active camera/mic permissions before starting.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Powered by Zabi Techs AI Recruitment Platform</p>
    </div>
  `;

  if (isSmtpConfigured && transporter) {
    try {
      await transporter.sendMail({
        from: `"${jobTitle} Hiring Team" <${process.env.SMTP_USER}>`,
        to: candidate.email,
        subject,
        html: htmlContent,
      });
      console.log(`✉ Invitation email sent successfully to ${candidate.email}`);
    } catch (err) {
      console.error(`Failed to send invitation email to ${candidate.email}:`, err);
    }
  } else {
    console.log(`\n================== SIMULATED OUTGOING EMAIL ==================`);
    console.log(`TO: ${candidate.name} <${candidate.email}>`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`LINK: ${link}`);
    console.log(`==============================================================\n`);
    recordMockEmail({
      to: candidate.email,
      name: candidate.name,
      type: 'invitation',
      subject,
      link,
    });
  }
}

/**
 * Send an interview selection/status result email.
 */
export async function sendResultEmail(candidate, jobTitle, passed, score) {
  const statusLabel = passed ? 'Selected' : 'Not Selected';
  const subject = `AI Interview Result - ${jobTitle}`;
  
  const selectedHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 8px;">
      <h2 style="color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 10px;">Congratulations! 🎉</h2>
      <p>Hello <strong>${candidate.name}</strong>,</p>
      <p>Thank you for completing the AI interview for the <strong>${jobTitle}</strong> role.</p>
      <p>Our evaluation system has finalized your score. We are pleased to inform you that you have **passed** the interview threshold!</p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 5px 0;">📈 <strong>Evaluation Score:</strong> ${score} / 10</p>
        <p style="margin: 0 0 0 0;">✨ <strong>Status:</strong> Shortlisted for next rounds</p>
      </div>
      
      <p>Our recruitment team will contact you shortly to schedule the final technical/cultural fit calls.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Powered by Zabi Techs AI Recruitment Platform</p>
    </div>
  `;

  const rejectedHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; borderRadius: 8px;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">Interview Feedback</h2>
      <p>Hello <strong>${candidate.name}</strong>,</p>
      <p>Thank you for taking the time to complete the AI interview for the <strong>${jobTitle}</strong> position.</p>
      <p>Our evaluation system has reviewed your responses. Unfortunately, your performance did not meet the required threshold for this role on this occasion.</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 5px 0;">📈 <strong>Evaluation Score:</strong> ${score} / 10</p>
        <p style="margin: 0 0 0 0;">❌ <strong>Status:</strong> Not Shortlisted</p>
      </div>
      
      <p>We appreciate your interest in our team and encourage you to keep learning and applying for other openings in the future.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Powered by Zabi Techs AI Recruitment Platform</p>
    </div>
  `;

  const htmlContent = passed ? selectedHtml : rejectedHtml;

  if (isSmtpConfigured && transporter) {
    try {
      await transporter.sendMail({
        from: `"${jobTitle} Hiring Team" <${process.env.SMTP_USER}>`,
        to: candidate.email,
        subject,
        html: htmlContent,
      });
      console.log(`✉ Result (${statusLabel}) email sent successfully to ${candidate.email}`);
    } catch (err) {
      console.error(`Failed to send result email to ${candidate.email}:`, err);
    }
  } else {
    console.log(`\n================== SIMULATED OUTGOING EMAIL ==================`);
    console.log(`TO: ${candidate.name} <${candidate.email}>`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`STATUS: ${statusLabel} (Score: ${score}/10)`);
    console.log(`==============================================================\n`);
    recordMockEmail({
      to: candidate.email,
      name: candidate.name,
      type: 'result',
      subject,
      status: statusLabel,
      score,
    });
  }
}
