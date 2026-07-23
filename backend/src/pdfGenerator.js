import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aggregateProctorFrames } from './visionProctor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generates a structured, professional PDF report for the interview.
 * @param {Object} state - The interview state graph data.
 * @returns {Promise<string>} - Absolute path to the generated PDF.
 */
export async function generatePdfReport(state) {
  const pdfDoc = await PDFDocument.create();
  
  // Choose standard Helvetica fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Setup pages
  let page = pdfDoc.addPage([600, 800]);
  let { width, height } = page.getSize();
  let y = height - 50;

  // Helper: Draw text and auto-wrap to prevent clipping
  function drawText(text, options = {}) {
    const baseFontSize = options.size || 11;
    const margin = options.margin || 50;
    const maxWidth = width - (margin * 2);
    
    // Split into paragraphs
    const paragraphs = String(text).split('\n');
    
    for (let para of paragraphs) {
      para = para.trim();
      if (para === '') {
        y -= 12; // Paragraph spacing
        continue;
      }

      if (y < 60) {
        // Add new page
        page = pdfDoc.addPage([600, 800]);
        y = height - 50;
      }

      // 1. Detect and parse horizontal divider "---"
      if (para === '---' || para.startsWith('---')) {
        page.drawLine({
          start: { x: margin, y: y - 4 },
          end: { x: width - margin, y: y - 4 },
          color: rgb(0.85, 0.88, 0.92),
          thickness: 0.8
        });
        y -= 16;
        continue;
      }

      let isHeader = false;
      let isListItem = false;
      let fontSize = baseFontSize;
      let font = options.font || fontRegular;
      let color = options.color || rgb(0.12, 0.16, 0.23); // slate-900

      // 2. Detect and parse headers (e.g. "### 1. Core Strengths")
      if (para.startsWith('#')) {
        isHeader = true;
        para = para.replace(/^#+\s*/, '');
        font = fontBold;
        fontSize = baseFontSize + 1.5;
        color = rgb(0.31, 0.27, 0.9); // Indigo theme for headers
        y -= 6; // Add top margin spacing
      }

      // 3. Detect and parse list items (e.g. "- Communication:")
      if (para.startsWith('- ') || para.startsWith('* ')) {
        isListItem = true;
        para = '• ' + para.substring(2);
      }

      // 4. Strip out bold markers "**"
      para = para.replace(/\*\*/g, '');

      const words = para.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const widthOfTest = font.widthOfTextAtSize(testLine, fontSize);
        
        if (widthOfTest > maxWidth) {
          page.drawText(currentLine, { x: isListItem ? margin + 12 : margin, y, size: fontSize, font, color });
          y -= (fontSize + 4);
          currentLine = word;

          if (y < 60) {
            page = pdfDoc.addPage([600, 800]);
            y = height - 50;
          }
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        page.drawText(currentLine, { x: isListItem ? margin + 12 : margin, y, size: fontSize, font, color });
        y -= (fontSize + (isHeader ? 10 : 6));
      }
    }
  }

  // --- Title & Header ---
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: rgb(0.31, 0.27, 0.9), // Primary Indigo
  });

  page.drawText('AI INTERVIEW REPORT', {
    x: 50,
    y: height - 60,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Detailed Candidate Evaluation Summary', {
    x: 50,
    y: height - 85,
    size: 12,
    font: fontRegular,
    color: rgb(0.8, 0.8, 1),
  });

  y = height - 150;

  // --- Candidate Info Metadata Box ---
  const tabSwitches = state.tabSwitchCount || 0;
  const proctorStatus = tabSwitches > 0 ? `WARNING (${tabSwitches} tab switches)` : 'PASSED (0 tab switches)';
  const proctorColor = tabSwitches > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0.09, 0.53, 0.23);

  // Visual proctor summary from HF frame analysis
  const { summary: vpSummary, severity: vpSeverity, details: vpDetails } = aggregateProctorFrames(state.proctorFrames || []);
  const vpColor = vpSeverity === 'high' ? rgb(0.86, 0.15, 0.15)
    : vpSeverity === 'medium' ? rgb(0.85, 0.45, 0.0)
    : vpSeverity === 'low' ? rgb(0.7, 0.6, 0.0)
    : rgb(0.09, 0.53, 0.23);
  const vpLabel = vpSeverity === 'high' ? 'HIGH RISK'
    : vpSeverity === 'medium' ? 'MEDIUM FLAGS'
    : vpSeverity === 'low' ? 'MINOR FLAGS'
    : vpSeverity === 'clean' ? 'CLEAN' : 'NO DATA';

  page.drawRectangle({
    x: 50,
    y: y - 115,
    width: 500,
    height: 110,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.88, 0.91, 0.95),
    borderWidth: 1,
  });

  page.drawText(`Candidate: ${state.candidateName}`, { x: 70, y: y - 22, size: 12, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
  page.drawText(`Email: ${state.candidateEmail}`, { x: 70, y: y - 40, size: 11, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText(`Target Role: ${state.jobTitle}`, { x: 70, y: y - 58, size: 11, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText(`Tab Switches: ${proctorStatus}`, { x: 70, y: y - 76, size: 10, font: fontBold, color: proctorColor });
  page.drawText(`Vision AI: ${vpLabel} — ${vpDetails.totalFrames || 0} frames analyzed`, { x: 70, y: y - 94, size: 10, font: fontBold, color: vpColor });

  // Score Badge in Info Box
  page.drawRectangle({
    x: 390,
    y: y - 100,
    width: 140,
    height: 75,
    color: rgb(0.9, 0.98, 0.93),
    borderColor: rgb(0.7, 0.9, 0.75),
    borderWidth: 1,
  });

  page.drawText('OVERALL SCORE', { x: 405, y: y - 50, size: 8, font: fontBold, color: rgb(0.02, 0.44, 0.2) });
  page.drawText(`${state.overallScore} / 10`, { x: 405, y: y - 75, size: 18, font: fontBold, color: rgb(0.02, 0.44, 0.2) });

  y -= 140;

  // --- Executive Performance Feedback ---
  page.drawText('Executive Summary & Feedback', { x: 50, y, size: 14, font: fontBold, color: rgb(0.31, 0.27, 0.9) });
  page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: width - 50, y: y - 4 }, color: rgb(0.8, 0.8, 0.9), thickness: 1 });
  y -= 25;

  drawText(state.overallFeedback, { size: 10.5 });
  y -= 20;

  // --- Detailed Question Responses ---
  page.drawText('Detailed Question Breakdown', { x: 50, y, size: 14, font: fontBold, color: rgb(0.31, 0.27, 0.9) });
  page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: width - 50, y: y - 4 }, color: rgb(0.8, 0.8, 0.9), thickness: 1 });
  y -= 25;

  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    const ans = state.responses[i] || "No response recorded.";
    const sc = state.scores[i] || { relevance: 0, clarity: 0, completeness: 0, feedback: "N/A" };

    if (y < 120) {
      page = pdfDoc.addPage([600, 800]);
      y = height - 50;
    }

    // Question header
    page.drawText(`Question ${i + 1}`, { x: 50, y, size: 11, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
    
    // Scores pill
    const scorePillText = `R: ${sc.relevance}/10  |  Cl: ${sc.clarity}/10  |  Co: ${sc.completeness}/10`;
    const pillWidth = fontBold.widthOfTextAtSize(scorePillText, 8) + 12;
    page.drawRectangle({
      x: width - 50 - pillWidth,
      y: y - 3,
      width: pillWidth,
      height: 14,
      color: rgb(0.92, 0.94, 0.98),
      borderColor: rgb(0.75, 0.8, 0.9),
      borderWidth: 0.5,
    });
    page.drawText(scorePillText, { x: width - 44 - pillWidth, y: y + 1, size: 8, font: fontBold, color: rgb(0.2, 0.3, 0.5) });

    y -= 16;

    // The question content
    drawText(`"${q}"`, { size: 10, font: fontBold, color: rgb(0.3, 0.35, 0.45) });
    y -= 4;

    // The answer content
    drawText(`Answer: ${ans}`, { size: 9.5, color: rgb(0.2, 0.2, 0.2) });
    y -= 4;

    // Evaluator feedback
    drawText(`Evaluator Feedback: ${sc.feedback}`, { size: 9.5, color: rgb(0.02, 0.44, 0.2) });
    y -= 15; // spacing between questions
  }

  // Footer on all pages
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawText(`Page ${i + 1} of ${totalPages}  |  AI Interviewer Report  |  Powered by Zabi Techs`, {
      x: 50,
      y: 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.6, 0.65, 0.7),
    });
  }

  // Save the report file
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `report_${state.interviewId}.pdf`);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(reportPath, pdfBytes);

  console.log(`[PDF Generator] Saved report to ${reportPath}`);
  return reportPath;
}
