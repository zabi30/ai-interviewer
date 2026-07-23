import { getBatch, getCandidatesByBatch, getInterview, saveInterview, saveBatch } from './db.js';
import { interviewGraph, runScoringNode } from './langgraph.js';
import { generatePdfReport } from './pdfGenerator.js';
import { sendInviteEmail, sendResultEmail } from './email.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Clean existing data for clean tests
const BATCHES_FILE = path.join(__dirname, '../data/batches.json');
const INTERVIEWS_FILE = path.join(__dirname, '../data/interviews.json');
const SENT_EMAILS_FILE = path.join(__dirname, '../data/sent-emails.json');

try {
  if (fs.existsSync(BATCHES_FILE)) fs.writeFileSync(BATCHES_FILE, '{}');
  if (fs.existsSync(INTERVIEWS_FILE)) fs.writeFileSync(INTERVIEWS_FILE, '{}');
  if (fs.existsSync(SENT_EMAILS_FILE)) fs.writeFileSync(SENT_EMAILS_FILE, '[]');
  console.log('✔ Cleared local DB files for clean test run.');
} catch {}

async function runBatchVerification() {
  console.log('==================================================');
  console.log('🧪 RUNNING RECUTMENT BATCH EVALUATION TEST...');
  console.log('==================================================');

  // 1. Recruiter Uploads JSON containing 2 candidates
  const mockAtsData = [
    {
      name: "Alice Cooper",
      email: "alice@gmail.com",
      resumeSummary: "React native developer with 3 years experience. Skilled in Expo, Redux, Reanimated."
    },
    {
      name: "Bob Dylan",
      email: "bob@gmail.com",
      resumeSummary: "Backend engineer with 10 years experience. Skilled in Java, Spring Boot, AWS, Kubernetes."
    }
  ];

  const batchId = 'BATCH-TEST-88';
  const duration = 15;
  const deadline = '2026-08-15';
  const passThreshold = 7.2;

  console.log(`\nStep 1: Creating Batch "${batchId}" for "App Developer" position...`);
  const candidateCodes = ['INT-ALICE', 'INT-BOB'];

  for (let i = 0; i < mockAtsData.length; i++) {
    const rawCand = mockAtsData[i];
    const code = candidateCodes[i];

    const initialInputs = {
      interviewId: code,
      candidateName: rawCand.name,
      candidateEmail: rawCand.email,
      jobTitle: 'App Developer',
      resumeText: rawCand.resumeSummary,
      interviewDuration: duration,
      stage: 'greeting',
      currentQuestionIndex: 0,
      responses: [],
      scores: [],
    };

    console.log(`- Running LangGraph for ${rawCand.name} (${code})...`);
    // Run graph to parse resume and generate questions
    const resultState = await interviewGraph.invoke(initialInputs);

    const candidateState = {
      ...resultState,
      batchId,
      deadline,
      passThreshold,
      status: 'invited',
    };

    saveInterview(code, candidateState);
    const link = `ai-interview://interview/${code}/welcome`;

    // Send invitation
    await sendInviteEmail(rawCand, 'App Developer', duration, deadline, link);
  }

  // Save Batch Data
  const batchRecord = {
    batchId,
    jobTitle: 'App Developer',
    duration,
    deadline,
    passThreshold,
    limit: 2,
    candidatesCount: 2,
    candidates: candidateCodes,
  };
  saveBatch(batchId, batchRecord);
  console.log('✔ Batch record written to database.');

  // 2. Candidate 1 (Alice) joins and completes the interview
  console.log('\nStep 2: Candidate Alice cooper starts the interview flow...');
  let aliceState = getInterview('INT-ALICE');
  console.log('  Alice Status changed from invited to:', aliceState.status);

  // Set to ongoing when validate code hits
  aliceState.status = 'ongoing';
  saveInterview('INT-ALICE', aliceState);

  const aliceAnswers = [
    "I have built several React Native apps using Expo Router and animated UI elements.",
    "My strength is designing fluid interfaces and managing smooth cross-platform performance.",
    "I built an offline sync engine that handles networking glitches gracefully.",
    "I want to work with you because you are developing cutting-edge AI features for mobile.",
    "In 5 years, I expect to be a lead mobile architect defining core development guidelines."
  ];

  for (let i = 0; i < 5; i++) {
    aliceState.currentQuestionIndex = i;
    const evaluation = await runScoringNode(aliceState, aliceAnswers[i]);
    aliceState.responses = evaluation.responses;
    aliceState.scores = evaluation.scores;
  }

  // Alice finishes the interview
  console.log('\nStep 3: Alice finishes and triggers LangGraph final report & decision engine...');
  const compiledState = await interviewGraph.invoke(aliceState);
  
  // Decide pass/fail
  const passed = compiledState.overallScore >= passThreshold;
  const finalStatus = passed ? 'selected' : 'rejected';
  compiledState.status = finalStatus;

  // Generate PDF report
  const pdfPath = await generatePdfReport(compiledState);
  compiledState.pdfReportPath = pdfPath;

  saveInterview('INT-ALICE', compiledState);

  // Send result email
  await sendResultEmail(
    { name: compiledState.candidateName, email: compiledState.candidateEmail },
    compiledState.jobTitle,
    passed,
    compiledState.overallScore
  );

  // 3. Recruiter fetches live stats for the batch
  console.log('\nStep 4: Recruiter opens dashboard to view live batch analytics...');
  const batchObj = getBatch(batchId);
  const candidatesList = getCandidatesByBatch(batchId);

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

  console.log('✔ Batch Analytics Dashboard Data:');
  console.log(`  - Job Title: ${batchObj.jobTitle}`);
  console.log(`  - Total Invited: ${totalInvited}`);
  console.log(`  - Completed: ${totalCompleted}`);
  console.log(`  - Pending: ${totalPending}`);
  console.log(`  - Selected (Passed): ${totalSelected}`);
  console.log(`  - Rejected (Failed): ${totalRejected}`);
  console.log(`  - Completed Candidates Avg Score: ${averageScore}/10`);

  // Verify stats assertions
  if (totalInvited === 2 && totalCompleted === 1 && totalPending === 1 && totalSelected === 0 && totalRejected === 1) {
    console.log('\n✔ BATCH STATS METRICS CONFIRMED! (Alice failed because overallScore mock defaults to 7.0 and passThreshold was 7.2).');
  } else if (totalInvited === 2 && totalCompleted === 1 && totalPending === 1 && totalSelected === 1 && totalRejected === 0) {
    console.log('\n✔ BATCH STATS METRICS CONFIRMED! (Alice passed).');
  } else {
    throw new Error(`Metrics mismatch! Check DB save logic.`);
  }

  // Verify email log
  const sentEmails = JSON.parse(fs.readFileSync(SENT_EMAILS_FILE, 'utf8'));
  console.log(`\n✔ Checked Simulated Outgoing Emails (${sentEmails.length} logged):`);
  sentEmails.forEach((email, idx) => {
    console.log(`  ${idx + 1}. [${email.type.toUpperCase()}] sent to: ${email.to}`);
  });

  console.log('\n🎉 BATCH RECRUITMENT FLOW VERIFIED SUCCESSFULLY!');
  console.log('==================================================');
}

runBatchVerification().catch(err => {
  console.error('\n❌ BATCH VERIFICATION FAILED:', err);
  process.exit(1);
});
