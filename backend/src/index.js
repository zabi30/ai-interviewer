import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { 
  getInterview, 
  saveInterview, 
  saveBatch, 
  getBatch, 
  getBatches, 
  getCandidatesByBatch,
  deleteBatch
} from './db.js';
import { interviewGraph, runScoringNode, generateNextDynamicQuestion } from './langgraph.js';
import { parsePdfResume } from './parser.js';
import { transcribeAudioFile, generateTTSAudio } from './llm.js';
import { generatePdfReport } from './pdfGenerator.js';
import { sendInviteEmail, sendResultEmail } from './email.js';
import { analyzeFrame } from './visionProctor.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 5000);

// Setup upload and reports directory
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const REPORTS_DIR = path.join(__dirname, '../reports');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large candidate payloads

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.ogg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage });

// HELPER: Generate a short random ID code
function generateId(prefix = 'INT') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

// --- CREATE BATCH REQUEST ROUTE RUNNER ENDPOINTS ---
app.post('/api/batch/create', async (req, res) => {
  console.log('--- CREATE BATCH REQUEST ---');
  try {
    const { batchId: requestedBatchId, jobTitle, duration, deadline, passThreshold, limit, jobDescription, candidates } = req.body;

    if (!jobTitle || !candidates || !Array.isArray(candidates)) {
      return res.status(400).json({ error: 'Missing batch configuration details or candidate list.' });
    }

    let batchId = requestedBatchId;
    let existingBatch = null;

    if (requestedBatchId) {
      existingBatch = getBatch(requestedBatchId);
      if (!existingBatch) {
        console.log(`[Ingest] Pasted Batch ID "${requestedBatchId}" does not exist in DB. Generating a new batch.`);
        batchId = generateId('BATCH');
      }
    } else {
      batchId = generateId('BATCH');
    }

    const inviteLimit = Number(limit) || candidates.length;
    const interviewDuration = Number(duration) || 15;
    const threshold = Number(passThreshold) || 7.0;

    // Shortlist top candidates based on the recruiter's limit
    const shortlistedCandidates = candidates.slice(0, inviteLimit);
    const candidateCodes = [];

    console.log(`Processing ingestion for batch ${batchId} with ${shortlistedCandidates.length} shortlisted candidates...`);

    for (const rawCand of shortlistedCandidates) {
      const code = generateId('INT');
      candidateCodes.push(code);

      // Extract resume details (can be summary or full text)
      const resumeText = rawCand.resumeSummary || rawCand.cv || 'General resume qualifications.';

      // Compile questions using LangGraph resume parsing node
      const initialInputs = {
        interviewId: code,
        candidateName: rawCand.name,
        candidateEmail: rawCand.email,
        jobTitle,
        jobDescription: jobDescription || '',
        resumeText,
        interviewDuration,
        stage: 'greeting',
        currentQuestionIndex: 0,
        responses: [],
        scores: [],
      };

      console.log(`Running LangGraph for candidate ${rawCand.name} (${code})...`);
      const resultState = await interviewGraph.invoke(initialInputs);

      // Save candidate session state in local JSON DB
      const candidateState = {
        ...resultState,
        batchId,
        deadline,
        passThreshold: threshold,
        status: 'invited', // status timeline: 'invited' -> 'ongoing' -> 'completed' -> 'selected'/'rejected'
        emailSent: false,
      };

      // Save interview
      saveInterview(code, candidateState);

      // Dynamic interview deep link mapping
      const interviewLink = `http://localhost:8081/interview?code=${code}`;

      // Trigger asynchronous invitation email only if not already sent
      if (!candidateState.emailSent) {
        sendInviteEmail(
          { name: rawCand.name, email: rawCand.email },
          jobTitle,
          interviewDuration,
          deadline,
          interviewLink
        ).then(() => {
          // Mark email as sent in DB
          const updated = getInterview(code) || {};
          updated.emailSent = true;
          saveInterview(code, updated);
        }).catch(err => console.error('Failed to send invite email:', err));
      }
    }

    if (existingBatch) {
      // Append candidates to existing batch
      existingBatch.candidates = [...existingBatch.candidates, ...candidateCodes];
      existingBatch.candidatesCount = existingBatch.candidates.length;
      saveBatch(batchId, existingBatch);
      console.log(`Successfully appended ${candidateCodes.length} candidates to existing batch ${batchId}.`);
    } else {
      // Save recruiter batch meta record
      const batchRecord = {
        batchId,
        jobTitle,
        duration: interviewDuration,
        deadline,
        passThreshold: threshold,
        limit: inviteLimit,
        jobDescription: jobDescription || '',
        candidatesCount: candidateCodes.length,
        candidates: candidateCodes,
      };
      saveBatch(batchId, batchRecord);
      console.log(`Batch ${batchId} generated successfully.`);
    }

    return res.status(200).json({
      success: true,
      batchId,
      message: `Successfully processed batch ingestion. Dispatched ${shortlistedCandidates.length} invitation emails.`,
    });
  } catch (err) {
    console.error('Error creating recruitment batch:', err);
    return res.status(500).json({ error: 'Failed to create recruitment batch.' });
  }
});



// 2. RECRUITER STATS ENDPOINT: Retrieve live statistics for a specific batch
app.get('/api/batch/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const batch = getBatch(id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    const candidatesList = getCandidatesByBatch(id);

    // Compute metrics
    const totalInvited = candidatesList.length;
    const completedList = candidatesList.filter(c => ['completed', 'selected', 'rejected'].includes(c.status));
    const totalCompleted = completedList.length;
    const totalPending = totalInvited - totalCompleted;
    
    const totalSelected = candidatesList.filter(c => c.status === 'selected').length;
    const totalRejected = candidatesList.filter(c => c.status === 'rejected').length;

    let totalScoreSum = 0;
    completedList.forEach(c => {
      totalScoreSum += c.overallScore || 0;
    });
    const averageScore = totalCompleted > 0 ? parseFloat((totalScoreSum / totalCompleted).toFixed(1)) : 0;

    return res.status(200).json({
      batch,
      stats: {
        totalInvited,
        totalCompleted,
        totalPending,
        totalSelected,
        totalRejected,
        averageScore,
      },
      candidates: candidatesList.map(c => ({
        interviewId: c.interviewId,
        name: c.candidateName,
        email: c.candidateEmail,
        status: c.status,
        score: c.overallScore || 0,
        pdfDownloadUrl: c.pdfReportPath ? `/api/interview/report/${c.interviewId}` : null,
      })),
    });
  } catch (err) {
    console.error('Error fetching batch statistics:', err);
    return res.status(500).json({ error: 'Server error fetching statistics.' });
  }
});

// 3. RECRUITER LIST ENDPOINT: Fetch list of all batches
app.get('/api/batches', (req, res) => {
  try {
    const list = getBatches();
    return res.status(200).json(list);
  } catch (err) {
    console.error('Error listing batches:', err);
    return res.status(500).json({ error: 'Server error listing batches.' });
  }
});

// DELETE BATCH ENDPOINT: Delete specific batch and its candidate records
app.delete('/api/batch/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteBatch(id);
    console.log(`[Delete] Deleted batch ${id} and all its candidate records.`);
    return res.status(200).json({ success: true, message: `Successfully deleted batch ${id}.` });
  } catch (err) {
    console.error('Error deleting batch:', err);
    return res.status(500).json({ error: 'Server error deleting batch.' });
  }
});

// RESEND INVITATION EMAIL ENDPOINT: Re-send invitation link for a given interview code
app.post('/api/interview/resend/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const interview = getInterview(code.trim());
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    const { candidateName, candidateEmail, jobTitle, interviewDuration, deadline } = interview;
    const interviewLink = `http://localhost:8081/interview?code=${code}`;
    await sendInviteEmail(
      { name: candidateName, email: candidateEmail },
      jobTitle,
      interviewDuration,
      deadline,
      interviewLink
    );
    return res.status(200).json({ success: true, message: 'Invitation email re-sent' });
  } catch (err) {
    console.error('Error resending invitation email:', err);
    return res.status(500).json({ error: 'Server error resending invitation.' });
  }
});

// 4. CANDIDATE ENDPOINT: Validate code before starting
app.post('/api/interview/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Missing code' });
    }

    const state = getInterview(code.trim());
    if (state) {
      // Expiration check for already completed interview sessions
      if (state.status === 'completed' || state.status === 'selected' || state.status === 'rejected') {
        return res.status(200).json({ valid: false, error: 'This interview link has expired as you have already completed the session.' });
      }

      // Update status to 'ongoing' if first time entering
      if (state.status === 'invited') {
        saveInterview(state.interviewId, { ...state, status: 'ongoing' });
      }
      return res.status(200).json({ valid: true });
    }

    return res.status(200).json({ valid: false, error: 'Invalid invitation code. Please check and try again.' });
  } catch (err) {
    console.error('Validation error:', err);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

// Helper: Fetch candidate details / questions
app.get('/api/interview/:id/questions', (req, res) => {
  const { id } = req.params;
  const state = getInterview(id);
  if (!state) {
    return res.status(404).json({ error: 'Interview not found' });
  }
  return res.status(200).json({ questions: state.questions || [] });
});

// 5. CANDIDATE ENDPOINT: Submit answer audio, transcribe, run Scoring node
app.post('/api/interview/submit-answer', upload.single('file'), async (req, res) => {
  try {
    const { questionIndex, interviewId, textAnswer } = req.body;
    
    if (!interviewId) {
      return res.status(400).json({ error: 'Missing interviewId' });
    }

    const index = Number(questionIndex);
    let transcriptText = '';

    if (req.file) {
      const audioFilePath = req.file.path;
      try {
        transcriptText = await transcribeAudioFile(audioFilePath);
      } finally {
        try { fs.unlinkSync(audioFilePath); } catch {}
      }
    } else if (textAnswer) {
      transcriptText = textAnswer;
    } else {
      return res.status(400).json({ error: 'No audio recording or text answer provided.' });
    }

    // Retrieve state
    const state = getInterview(interviewId);
    if (!state) {
      return res.status(404).json({ error: 'Interview session not found.' });
    }

    state.currentQuestionIndex = index;

    // Run scoring node to evaluate answer
    const scoringUpdates = await runScoringNode(state, transcriptText);

    // Update state collections
    const updatedResponses = [...state.responses];
    updatedResponses[index] = transcriptText;
    const updatedScores = [...state.scores];
    updatedScores[index] = scoringUpdates.scores[index] || 7.0;

    // Generate dynamic next question if not at the final question
    let nextQuestion = '';
    const updatedQuestions = [...state.questions];
    if (index < 4) {
      try {
        nextQuestion = await generateNextDynamicQuestion({
          ...state,
          responses: updatedResponses
        }, index, transcriptText);
        
        updatedQuestions[index + 1] = nextQuestion;
        console.log(`[DynamicInterviewer] Generated counter-question for Q${index + 2}: ${nextQuestion}`);
      } catch (qErr) {
        console.error('Error generating dynamic counter-question:', qErr);
        nextQuestion = state.questions[index + 1]; // fallback
      }
    }

    // Save intermediate updates
    const updatedState = saveInterview(interviewId, {
      ...state,
      questions: updatedQuestions,
      responses: updatedResponses,
      scores: updatedScores,
      status: 'ongoing',
    });

    return res.status(200).json({
      transcripts: {
        text: transcriptText,
      },
      score: updatedState.scores[index],
      nextQuestion: nextQuestion,
    });
  } catch (err) {
    console.error('Error submitting answer response:', err);
    return res.status(500).json({ error: 'Failed to process answer.' });
  }
});

// Proctor Warning Log Route
app.post('/api/interview/proctor-warning', async (req, res) => {
  try {
    const { interviewId } = req.body;
    if (!interviewId) {
      return res.status(400).json({ error: 'Missing interviewId' });
    }

    const state = getInterview(interviewId);
    if (!state) {
      return res.status(404).json({ error: 'Interview session not found.' });
    }

    const currentTabSwitches = state.tabSwitchCount || 0;
    const updatedState = saveInterview(interviewId, {
      ...state,
      tabSwitchCount: currentTabSwitches + 1,
    });

    console.log(`[Proctor] Warning logged for ${state.candidateName} (${interviewId}). Total switches: ${updatedState.tabSwitchCount}`);

    return res.status(200).json({
      success: true,
      tabSwitchCount: updatedState.tabSwitchCount,
    });
  } catch (err) {
    console.error('Error logging proctor warning:', err);
    return res.status(500).json({ error: 'Server error logging proctor warning.' });
  }
});

// Vision Proctor Frame Route — fire-and-forget, zero latency impact
app.post('/api/interview/proctor-frame', (req, res) => {
  const { interviewId, frameBase64 } = req.body;
  if (!interviewId || !frameBase64) {
    return res.status(400).json({ error: 'Missing interviewId or frameBase64' });
  }

  // Respond 202 IMMEDIATELY — HF analysis runs fully in background
  res.status(202).json({ accepted: true });

  // Non-blocking background analysis
  setImmediate(async () => {
    try {
      const state = getInterview(interviewId);
      if (!state) return;

      const result = await analyzeFrame(frameBase64);
      if (!result) return; // HF timeout or error — skip silently

      const proctorFrames = [...(state.proctorFrames || []), result];
      saveInterview(interviewId, { ...state, proctorFrames });

      if (result.flags.length > 0) {
        console.log(`[VisionProctor] 🚨 Flags for ${state.candidateName} (${interviewId}): ${result.flags.join(', ')}`);
      } else {
        console.log(`[VisionProctor] ✅ Clean frame for ${state.candidateName} (${interviewId})`);
      }
    } catch (err) {
      console.error('[VisionProctor] Background analysis error:', err.message);
    }
  });
});

// 6. CANDIDATE ENDPOINT: Finalize interview, execute LangGraph report generator, decide pass/fail threshold, email result
app.post('/api/interview/finish', async (req, res) => {
  console.log('--- FINISH INTERVIEW REQUEST ---');
  try {
    const { interviewId } = req.body;
    if (!interviewId) {
      return res.status(400).json({ error: 'Missing interviewId' });
    }

    const state = getInterview(interviewId);
    if (!state) {
      return res.status(404).json({ error: 'Interview session not found.' });
    }

    // 🔒 Idempotency Lock: If already evaluated/completed, skip processing and return saved results
    if (state.status === 'completed' || state.status === 'selected' || state.status === 'rejected') {
      console.log(`[Finish] Interview ${interviewId} is already completed. Skipping duplicate processing.`);
      return res.status(200).json({
        overallFeedback: state.overallFeedback || "Interview completed.",
        overallScore: state.overallScore || 0,
        pdfDownloadUrl: `http://localhost:${PORT}/api/interview/report/${interviewId}`,
      });
    }

    // Execute Report Generator Node in the LangGraph flow
    console.log(`Running Report Generator Node for ${state.candidateName}...`);
    const resultState = await interviewGraph.invoke(state);

    // Determine pass/fail based on customizable threshold
    const threshold = resultState.passThreshold || 7.0;
    const passed = resultState.overallScore >= threshold;
    const finalStatus = passed ? 'selected' : 'rejected';
    
    resultState.status = finalStatus;

    // Generate PDF report file
    console.log('Generating PDF evaluation report...');
    const pdfReportPath = await generatePdfReport(resultState);
    resultState.pdfReportPath = pdfReportPath;

    // Save final status
    saveInterview(interviewId, resultState);

    // Dispatch selection / rejection email notification
    sendResultEmail(
      { name: resultState.candidateName, email: resultState.candidateEmail },
      resultState.jobTitle,
      passed,
      resultState.overallScore
    );

    return res.status(200).json({
      overallFeedback: resultState.overallFeedback,
      overallScore: resultState.overallScore,
      pdfDownloadUrl: `http://localhost:${PORT}/api/interview/report/${interviewId}`,
    });
  } catch (err) {
    console.error('Error finishing interview session:', err);
    return res.status(500).json({ error: 'Failed to finalize interview session.' });
  }
});

// 7. DOWNLOAD ENDPOINT: Retrieve evaluation PDF report
app.get('/api/interview/report/:id', (req, res) => {
  try {
    const { id } = req.params;
    const reportPath = path.join(REPORTS_DIR, `report_${id}.pdf`);

    if (fs.existsSync(reportPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Interview_Report_${id}.pdf`);
      return res.sendFile(reportPath);
    }
    
    return res.status(404).json({ error: 'PDF report not found.' });
  } catch (err) {
    console.error('Error downloading report:', err);
    return res.status(500).json({ error: 'Failed to fetch report.' });
  }
});

// TTS Endpoint
app.post('/api/interview/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    const ttsFilename = `tts_${Date.now()}.mp3`;
    const ttsFilePath = path.join(REPORTS_DIR, ttsFilename);

    const audioBuffer = await generateTTSAudio(text);
    fs.writeFileSync(ttsFilePath, audioBuffer);

    return res.status(200).json({
      audioUrl: `/api/interview/tts-file/${ttsFilename}`
    });
  } catch (err) {
    console.error('Error generating speech:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to generate speech.' });
  }
});

// Serve generated TTS files
app.use('/api/interview/tts-file', express.static(REPORTS_DIR));

// Start Express Listener
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 LangGraph AI Interviewer Server running on port ${PORT}`);
  console.log(`==================================================`);
});
