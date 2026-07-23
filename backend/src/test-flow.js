import { interviewGraph, runScoringNode } from './langgraph.js';
import { generatePdfReport } from './pdfGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMockFlowTest() {
  console.log('==================================================');
  console.log('🧪 RUNNING END-TO-END LANGGRAPH EVALUATION TEST...');
  console.log('==================================================');

  // Input profile simulating a Web Developer candidate
  const inputs = {
    interviewId: 'TEST-SESSION-001',
    candidateName: 'Alex Mercer',
    candidateEmail: 'alex.mercer@gmail.com',
    jobTitle: 'Web Developer',
    resumeText: `
      Alex Mercer
      Senior Web Developer with 5 years experience in React, Node.js, and Cloud architectures.
      Built a distributed SaaS product using React, Next.js, and Tailwind CSS.
      Expert in Javascript, REST APIs, and responsive UI design.
    `,
    interviewDuration: 15,
    stage: 'greeting',
    currentQuestionIndex: 0,
    responses: [],
    scores: [],
  };

  // Node 1 & 2: Resume parsing and dynamic question generation
  console.log('\nStep 1: Invoking LangGraph for resume parsing & question generation...');
  const initializedState = await interviewGraph.invoke(inputs);
  
  console.log('✔ Questions Generated:');
  initializedState.questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  // Node 3: Simulation of Candidate answering 5 questions
  console.log('\nStep 2: Simulating candidate answer submissions...');
  const simulatedAnswers = [
    "I have been a Web Developer for 5 years, specializing in React and server-side JavaScript.",
    "My biggest strength is writing highly optimized components and solving complex algorithmic challenges.",
    "We had a production database leak, and I coordinated a rollback and patching process under high pressure.",
    "Your company is building the next generation of AI-driven applications, which aligns perfectly with my career path.",
    "In 5 years, I see myself leading engineering teams and designing core SaaS architectures."
  ];

  let stateTracker = { ...initializedState };

  for (let i = 0; i < 5; i++) {
    console.log(`\nEvaluating Answer ${i + 1}/${5}:`);
    console.log(`  Q: "${stateTracker.questions[i]}"`);
    console.log(`  A: "${simulatedAnswers[i]}"`);

    stateTracker.currentQuestionIndex = i;
    
    // Evaluate answer with the Scoring Agent
    const evaluation = await runScoringNode(stateTracker, simulatedAnswers[i]);
    stateTracker.responses = evaluation.responses;
    stateTracker.scores = evaluation.scores;

    console.log(`  ✔ Scores -> Relevance: ${stateTracker.scores[i].relevance}/10, Clarity: ${stateTracker.scores[i].clarity}/10, Completeness: ${stateTracker.scores[i].completeness}/10`);
    console.log(`  ✔ Feedback: "${stateTracker.scores[i].feedback}"`);
  }

  // Node 4: final assessment report compilation
  console.log('\nStep 3: Finishing session and triggering LangGraph compilation...');
  stateTracker = await interviewGraph.invoke(stateTracker);

  console.log('✔ Overall Score calculated:', stateTracker.overallScore);
  console.log('✔ Final Feedback Report compiled:\n', stateTracker.overallFeedback);

  // Step 4: PDF Report compiling
  console.log('\nStep 4: Compiling professional evaluation PDF...');
  const pdfPath = await generatePdfReport(stateTracker);
  
  if (fs.existsSync(pdfPath)) {
    console.log(`\n🎉 INTEGRATION TEST COMPLETED SUCCESSFULLY!`);
    console.log(`📄 PDF Report saved at: ${pdfPath}`);
  } else {
    throw new Error('PDF Generation failed: file not found on disk.');
  }
  console.log('==================================================');
}

runMockFlowTest().catch(err => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
