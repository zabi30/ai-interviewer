import { OpenAI, AzureOpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let openai = null;
let azureOpenAI = null;
let genAI = null;

if (process.env.AZURE_OPENAI_KEY) {
  console.log('📡 Azure OpenAI credentials detected. Initializing Azure client.');
  azureOpenAI = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
  });
}

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Perform a chat completion request using the available LLM.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
export async function getChatCompletion(messages) {
  // 1. Try Azure OpenAI
  if (azureOpenAI) {
    try {
      const response = await azureOpenAI.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        messages,
        temperature: 0.7,
      });
      return response.choices[0].message.content || '';
    } catch (err) {
      console.error('Azure OpenAI Chat Completion Error:', err);
    }
  }

  // 2. Try Standard OpenAI
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      });
      return response.choices[0].message.content || '';
    } catch (err) {
      console.error('OpenAI Chat Completion Error:', err);
    }
  }

  // 3. Try Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      // Format messages for Gemini
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const result = await model.generateContent({ contents });
      return result.response.text() || '';
    } catch (err) {
      console.error('Gemini Chat Completion Error:', err);
    }
  }

  // 4. Dev Mock Fallback
  console.warn('⚠️ No active API keys found. Running in Mock Dev Mode.');
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  
  if (lastUserMsg.toLowerCase().includes('generate')) {
    return JSON.stringify([
      "Tell me about yourself.",
      "What is your biggest strength?",
      "Describe a challenge you faced at work and how you overcame it.",
      "Why do you want to join our company?",
      "Where do you see yourself in 5 years?"
    ]);
  }
  
  if (lastUserMsg.toLowerCase().includes('evaluate') || lastUserMsg.toLowerCase().includes('score')) {
    return JSON.stringify({
      relevance: 9,
      clarity: 8,
      completeness: 8,
      feedback: "Great structured answer. Well explained with a solid approach."
    });
  }

  return "This is a mock response because no OpenAI or Gemini keys are configured in your backend .env file.";
}

/**
 * Transcribes audio using either Whisper or Gemini inline audio understanding.
 * @param {string} filePath - Absolute path to audio file.
 * @returns {Promise<string>}
 */
export async function transcribeAudioFile(filePath) {
  // 0. Try Groq Whisper (extremely fast!)
  if (process.env.GROQ_API_KEY) {
    try {
      const groqClient = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      const transcription = await groqClient.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-large-v3',
      });
      console.log('[STT] Successfully transcribed audio via Groq Whisper');
      return transcription.text || '';
    } catch (err) {
      console.error('[STT] Groq Whisper Transcribe Error:', err.message);
    }
  }

  // 1. Try Gemini Inline Audio Understanding (highly cost-effective / free-tier friendly)
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const audioBuffer = fs.readFileSync(filePath);
      const base64Data = audioBuffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/ogg',
            data: base64Data,
          },
        },
        {
          text: 'Please transcribe this interview response audio into plain text. Output only the transcription. Do not add metadata, comments, or pleasantries.',
        },
      ]);
      return result.response.text()?.trim() || '';
    } catch (err) {
      console.error('Gemini Inline Transcribe Error:', err);
    }
  }

  // 2. Try OpenAI Whisper (Standard)
  if (openai) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });
      return transcription.text || '';
    } catch (err) {
      console.error('OpenAI Whisper Transcribe Error:', err);
    }
  }

  // 3. Mock Fallback
  console.warn('⚠️ No active API keys for transcription. Running in Mock Dev Mode.');
  return "This is a simulated transcript since API keys are missing in the server's .env file.";
}

/**
 * Generate Text-to-Speech audio buffer using Azure Cognitive Services (Arjun) or OpenAI.
 */
export async function generateTTSAudio(text) {
  // 1. Try Azure Speech Service REST API (ArjunNeural)
  const key = process.env.AZURE_SPEECH_KEY || process.env.AZURE_OPENAI_KEY;
  if (key) {
    try {
      const url = 'https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1';
      const ssml = `<speak version='1.0' xml:lang='hi-IN'><voice xml:lang='hi-IN' name='hi-IN-ArjunNeural'>${text}</voice></speak>`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'ai-interviewer'
        },
        body: ssml
      });

      if (response.ok) {
        console.log(`[TTS] Successfully generated Azure Speech (Arjun)`);
        return Buffer.from(await response.arrayBuffer());
      }
      console.warn(`[TTS] Azure Speech REST API returned status: ${response.status}`);
    } catch (azureErr) {
      console.warn('[TTS] Azure Speech REST API call failed:', azureErr.message);
    }
  }

  // 2. Try OpenAI TTS fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const mp3 = await client.audio.speech.create({
        model: "tts-1",
        voice: "onyx",
        input: text,
      });
      console.log(`[TTS] Successfully generated OpenAI Speech (Onyx)`);
      return Buffer.from(await mp3.arrayBuffer());
    } catch (openaiErr) {
      console.error('[TTS] OpenAI Speech failed:', openaiErr.message);
    }
  }

  throw new Error('No Speech API configuration available or all calls failed.');
}
