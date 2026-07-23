import { StateGraph, Annotation } from "@langchain/langgraph";
import { getChatCompletion } from "./llm.js";
import { aggregateProctorFrames } from "./visionProctor.js";

// Define the state schema (Annotation)
export const InterviewStateAnnotation = Annotation.Root({
  interviewId: Annotation(),
  candidateName: Annotation(),
  candidateEmail: Annotation(),
  jobTitle: Annotation(),
  jobDescription: Annotation(),
  resumeText: Annotation(),
  resumeSkillsSummary: Annotation(),
  interviewDuration: Annotation(),
  questions: Annotation(),
  currentQuestionIndex: Annotation(),
  responses: Annotation(),
  scores: Annotation(),
  overallFeedback: Annotation(),
  overallScore: Annotation(),
  stage: Annotation(),
  pdfReportPath: Annotation(),
  tabSwitchCount: Annotation(),      // Browser tab-switch proctor
  proctorFrames: Annotation(),       // Vision AI frame analysis results
});

// NODE 1: Resume Parser Agent
async function resumeParserNode(state) {
  if (state.resumeSkillsSummary && state.resumeSkillsSummary.trim() !== '') {
    console.log(`[Agent: ResumeParser] Skills summary already present. Skipping.`);
    return {};
  }

  console.log(`[Agent: ResumeParser] Extracting skills for candidate: ${state.candidateName}`);
  if (!state.resumeText || state.resumeText.trim() === '') {
    return { resumeSkillsSummary: "No resume provided. Using standard profile." };
  }

  const prompt = [
    {
      role: 'system',
      content: 'You are an expert HR recruitment parser. Analyze the candidate\'s resume text and summarize their core technical skills, frameworks, platforms, and years of experience into a structured profile summary. Keep it concise (under 250 words).'
    },
    {
      role: 'user',
      content: `Candidate: ${state.candidateName}\nRole: ${state.jobTitle}\n\nResume Text:\n${state.resumeText}`
    }
  ];

  try {
    const summary = await getChatCompletion(prompt);
    return { resumeSkillsSummary: summary };
  } catch (err) {
    console.error('Resume Parser Agent failed:', err);
    return { resumeSkillsSummary: "Error parsing resume. Using general qualifications." };
  }
}

// NODE 2: Question Generator Agent
async function questionGeneratorNode(state) {
  if (state.questions && state.questions.length === 5) {
    console.log(`[Agent: QuestionGenerator] Questions already generated. Skipping.`);
    return {};
  }

  console.log(`[Agent: QuestionGenerator] Generating questions for role: ${state.jobTitle}`);
  
  const userContent = state.jobDescription && state.jobDescription.trim() !== ''
    ? `Target Role: ${state.jobTitle}\nJob Description:\n${state.jobDescription}\n\nCandidate Skills Summary:\n${state.resumeSkillsSummary}`
    : `Target Role: ${state.jobTitle}\n\nCandidate Skills Summary:\n${state.resumeSkillsSummary}`;

  const prompt = [
    {
      role: 'system',
      content: 'You are an expert technical interviewer. Generate exactly 5 custom interview questions for a candidate. Combine technical skills matching their resume profile and technical requirements/responsibilities matching their target job title and job description. Return ONLY a valid JSON array of strings containing exactly 5 questions. Do not write any markdown code fences, headers, comments, or intro text.'
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  try {
    const responseText = await getChatCompletion(prompt);
    // Sanitize JSON response just in case the LLM wrapped it in markdown
    const sanitized = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const questions = JSON.parse(sanitized);
    
    if (Array.isArray(questions) && questions.length === 5) {
      return { questions, stage: 'interviewing', currentQuestionIndex: 0 };
    }
    throw new Error('Invalid questions structure generated');
  } catch (err) {
    console.error('Question Generator Agent failed, falling back to defaults:', err);
    // Standard default fallback questions
    const fallbacks = [
      `What technical skills and experience make you a great fit for the ${state.jobTitle} position?`,
      "Tell me about a challenging project you built recently. What obstacles did you face?",
      "How do you stay updated with the latest trends and practices in this industry?",
      "Describe a scenario where you had a conflict with a teammate or stakeholder. How did you resolve it?",
      "Why are you interested in this position and what do you hope to accomplish here?"
    ];
    return { questions: fallbacks, stage: 'interviewing', currentQuestionIndex: 0 };
  }
}

// NODE 3: Scoring Agent
export async function runScoringNode(state, responseText) {
  const index = state.currentQuestionIndex;
  const questionText = state.questions[index];
  
  console.log(`[Agent: ScoringAgent] Evaluating response for Q${index + 1}: "${questionText}"`);

  // 🤐 If responseText is empty or mock placeholder, grade as 0 immediately!
  if (!responseText || responseText.trim() === '' || responseText.trim() === 'No response recorded.') {
    console.log(`[Agent: ScoringAgent] Q${index + 1}: Empty response detected. Grading as 0.`);
    const updatedResponses = [...(state.responses || [])];
    updatedResponses[index] = 'No response recorded.';

    const updatedScores = [...(state.scores || [])];
    updatedScores[index] = {
      relevance: 0,
      clarity: 0,
      completeness: 0,
      score: 0,
      feedback: "No response was recorded for this question."
    };

    return {
      responses: updatedResponses,
      scores: updatedScores,
    };
  }

  const systemPrompt = `You are an elite Senior Principal Technical Interviewer evaluating a candidate's answer for a "${state.jobTitle}" role.
Evaluate the candidate's answer based on the following strict rules:
1. Technical Accuracy (1-10): Verify if details, concepts, API names, syntax, or architecture references are correct.
2. Depth & Practical Detail (1-10): Look for real-world details, specific technologies/approaches used, or concrete examples instead of brief textbook definitions.
3. Answer Completeness (1-10): Determine if the candidate completely addressed all sub-parts of the question.

Do not grade leniently. Be direct and constructive. Write a short, single-paragraph feedback summary highlighting any gaps or technical errors.
Calculate the overall score out of 10 representing the average quality of the answer.

Return ONLY a valid JSON object matching this structure:
{
  "relevance": <number 1-10>,
  "clarity": <number 1-10>,
  "completeness": <number 1-10>,
  "score": <number 1-10>,
  "feedback": "<concise constructive technical review>"
}`;

  const prompt = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: `Question: ${questionText}\nCandidate Answer: ${responseText}`
    }
  ];

  try {
    const responseJson = await getChatCompletion(prompt);
    const sanitized = responseJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    const scoreData = JSON.parse(sanitized);

    const updatedResponses = [...(state.responses || [])];
    updatedResponses[index] = responseText;

    const updatedScores = [...(state.scores || [])];
    updatedScores[index] = {
      relevance: Number(scoreData.relevance) || 6,
      clarity: Number(scoreData.clarity) || 6,
      completeness: Number(scoreData.completeness) || 6,
      score: Number(scoreData.score) || Number(scoreData.relevance) || 6,
      feedback: scoreData.feedback || "Answer parsed."
    };

    return {
      responses: updatedResponses,
      scores: updatedScores,
    };
  } catch (err) {
    console.error('Scoring Agent failed:', err);
    const updatedResponses = [...(state.responses || [])];
    updatedResponses[index] = responseText;

    const updatedScores = [...(state.scores || [])];
    updatedScores[index] = {
      relevance: 7,
      clarity: 7,
      completeness: 7,
      feedback: "Answer received and recorded."
    };

    return {
      responses: updatedResponses,
      scores: updatedScores,
    };
  }
}

// NODE 4: Report Generator Agent
async function reportGeneratorNode(state) {
  console.log(`[Agent: ReportGenerator] Generating final feedback for candidate: ${state.candidateName}`);

  const performanceSummary = state.questions.map((q, idx) => {
    const ans = state.responses[idx] || "No response";
    const sc = state.scores[idx] || { relevance: 0, clarity: 0, completeness: 0, feedback: "N/A" };
    return `Q${idx + 1}: ${q}\nAnswer: ${ans}\nScores: Relevance=${sc.relevance}, Clarity=${sc.clarity}, Completeness=${sc.completeness}\nFeedback: ${sc.feedback}`;
  }).join('\n\n');

  // Build proctor context from vision AI frame analysis
  const { summary: proctorSummary, severity: proctorSeverity } = aggregateProctorFrames(state.proctorFrames || []);
  const tabSwitches = state.tabSwitchCount || 0;
  const proctorContext = [
    `Tab Switch Count: ${tabSwitches} (${tabSwitches === 0 ? 'none detected' : 'violations logged'})`,
    `Visual Proctoring: ${proctorSummary}`,
    `Behavioral Severity: ${proctorSeverity.toUpperCase()}`,
  ].join('\n');

  const prompt = [
    {
      role: 'system',
      content: 'You are an executive HR consultant. Provide a professional, high-impact final interview feedback report. Group your feedback into 1) Core Strengths, 2) Areas for Development, and 3) A clear overall hiring recommendation. Also include a 4) Behavioral Integrity section based on the proctoring data provided. If there are significant integrity concerns, factor them into your hiring recommendation. Return a clean, structured feedback summary.'
    },
    {
      role: 'user',
      content: `Candidate: ${state.candidateName}\nJob Title: ${state.jobTitle}\n\nPerformance summary:\n${performanceSummary}\n\n--- PROCTORING DATA ---\n${proctorContext}`
    }
  ];

  try {
    const overallFeedback = await getChatCompletion(prompt);
    
    let totalPoints = 0;
    let counts = 0;
    state.scores.forEach(s => {
      if (s && typeof s === 'object') {
        const scoreVal = typeof s.score === 'number' ? s.score : (((s.relevance || 7) + (s.clarity || 7) + (s.completeness || 7)) / 3);
        totalPoints += scoreVal;
      } else if (typeof s === 'number') {
        totalPoints += s;
      } else {
        totalPoints += 7.0; // default fallback
      }
      counts += 1;
    });
    const overallScore = counts > 0 ? parseFloat((totalPoints / counts).toFixed(1)) : 0;

    return {
      overallFeedback,
      overallScore,
      stage: 'completed'
    };
  } catch (err) {
    console.error('Report Generator Agent failed:', err);
    return {
      overallFeedback: "Failed to generate comprehensive feedback report. Candidate completed all stages successfully.",
      overallScore: 7.5,
      stage: 'completed'
    };
  }
}

// Conditional Router function
function shouldContinue(state) {
  const numQuestions = state.questions ? state.questions.length : 0;
  const numResponses = state.responses ? state.responses.length : 0;
  
  if (numQuestions > 0 && numResponses === numQuestions) {
    console.log(`[Router] Candidate answered all ${numQuestions} questions. Directing to reportGenerator Node.`);
    return "reportGenerator";
  }
  
  console.log(`[Router] Interview ongoing. Halting execution.`);
  return "__end__";
}

// Construct and compile State Graph
const workflow = new StateGraph(InterviewStateAnnotation)
  .addNode("resumeParser", resumeParserNode)
  .addNode("questionGenerator", questionGeneratorNode)
  .addNode("reportGenerator", reportGeneratorNode)
  
  .addEdge("__start__", "resumeParser")
  .addEdge("resumeParser", "questionGenerator")
  .addConditionalEdges("questionGenerator", shouldContinue)
  .addEdge("reportGenerator", "__end__");

export const interviewGraph = workflow.compile();

/**
 * Generate next dynamic counter-question based on interview history
 */
export async function generateNextDynamicQuestion(state, currentIndex, lastAnswer) {
  const history = state.questions.slice(0, currentIndex + 1).map((q, idx) => {
    const ans = state.responses && state.responses[idx] ? state.responses[idx] : (idx === currentIndex ? lastAnswer : '');
    return `AI: ${q}\nCandidate: ${ans}`;
  }).join('\n\n');

  const systemPrompt = `You are a professional AI interviewer conducting a technical screen for a "${state.jobTitle}" role.
Job Description:
${state.jobDescription || 'N/A'}

Candidate Resume Summary:
${state.resumeSkillsSummary || 'N/A'}

Below is the transcript of the interview conversation so far:
${history}

Generate the next question (Question ${currentIndex + 2} of 5). 
Based on the candidate's last response, formulate a technical follow-up counter-question probing their depth in what they just described, OR transition to a new skill topic listed in the Job Description.
If the candidate's last answer was brief, generic, or incomplete, ask them to elaborate or give a specific example of how they used that technology.
Return ONLY the single question string. Do not include any tags, headers, numbering, or introductory chatter (e.g. do not say "For your next question...", just ask the question directly).`;

  const response = await getChatCompletion([
    { role: 'system', content: systemPrompt }
  ]);
  
  return response.trim();
}
