import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of Gemini client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Robust helper to retry on temporary/demand errors (like 503/429) and fall back to alternative models if needed
async function generateContentWithFallback(
  contents: any,
  config: any
): Promise<any> {
  const modelsToTry = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let retries = 2;
    let delay = 800;
    while (retries >= 0) {
      try {
        const ai = getGemini();
        console.log(`Attempting Gemini generation with model: ${modelName} (${retries} retries remaining)`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error)) || '';
        const errStatus = error?.status || error?.code || 0;
        const isTemporary = errStatus === 503 || 
                            errStatus === 429 ||
                            errMsg.includes('503') || 
                            errMsg.includes('429') || 
                            errMsg.includes('temporary') || 
                            errMsg.includes('demand') || 
                            errMsg.includes('UNAVAILABLE') ||
                            errMsg.includes('Resource has been exhausted');
        
        if (isTemporary && retries > 0) {
          // If it's a 503 / high demand error, switch immediately to the next model to avoid delaying the user with retries
          if (errStatus === 503 || errMsg.includes('503') || errMsg.includes('demand') || errMsg.includes('UNAVAILABLE')) {
            console.warn(`Gemini API 503 high-demand hit for model ${modelName}. Rotating to fallback model immediately.`);
            break; 
          }
          console.warn(`Gemini API temporary error with model ${modelName}: ${errMsg}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries--;
          delay *= 1.5;
        } else {
          console.warn(`Gemini API failed or non-retryable error with model ${modelName}: ${errMsg}. Moving on...`);
          break; // move to next model
        }
      }
    }
  }
  throw lastError || new Error('All attempt models failed to generate content.');
}

// 1. API route to generate 5 engineering flashcards
app.post('/api/flashcards/generate', async (req, res) => {
  try {
    const { subject, recentTopics, difficulty } = req.body;
    if (!subject) {
      return res.status(400).json({ error: 'Subject or technical topic is required.' });
    }

    const ai = getGemini();

    const avoidancePrompt = recentTopics && recentTopics.length > 0
      ? `Avoid duplicate questions. Do NOT generate cards similar to these existing topics/questions: ${recentTopics.slice(-10).join(', ')}.`
      : '';

    const prompt = `Generate an array of exactly 5 rigorous, technical engineering flashcards on the subject: "${subject}".
Difficulty requested: ${difficulty || 'Medium'}.
${avoidancePrompt}

Each flashcard should test high-level conceptual definitions, formula recall, mathematical derivations, or quick physical calculation reasoning.
The audience is engineering students preparing for rigorous board/professional exams (such as FE, PE, or GRE Subject Tests).
Make sure questions are clear, with professional terminology and specific notation (such as LaTeX style if needed, e.g., ∂T/∂P or dH = TdS + VdP).
`;

    const response = await generateContentWithFallback(prompt, {
      systemInstruction: "You are a distinguished engineering professor and chairman of a professional licensing board. You compile intense conceptual or numerical exam questions in fields like Chemical, Mechanical, Civil, Electrical, Aerospace, or Materials Engineering. You respond strictly with a valid JSON array matching the provided schema.",
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY' as any,
        items: {
          type: 'OBJECT' as any,
          properties: {
            id: { type: 'STRING' as any, description: 'Short unique identifier (e.g., fc_1)' },
            subject: { type: 'STRING' as any, description: 'The engineering subject area' },
            topic: { type: 'STRING' as any, description: 'The specific subtopic, e.g., Joule-Thomson effect, Maxwell equations' },
            question: { type: 'STRING' as any, description: 'Clear, rigorous technical question or problem statement.' },
            expectedAnswerSummary: { type: 'STRING' as any, description: 'The complete, precise correct answer including formula, assumptions, and mechanical definition.' },
            tips: {
              type: 'ARRAY' as any,
              items: { type: 'STRING' as any },
              description: '2-3 conceptual hints, core assumptions, or unit checks to help solve it.'
            },
            difficulty: { type: 'STRING' as any, description: 'Difficulty level (Fundamental, Intermediate, Advanced)' },
            formulaReference: { type: 'STRING' as any, description: 'Key equation or relation name, e.g., dG = VdP - SdT' }
          },
          required: ['id', 'subject', 'topic', 'question', 'expectedAnswerSummary', 'tips', 'difficulty', 'formulaReference']
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Emply response returned from Gemini.');
    }

    const parsed = JSON.parse(responseText.trim());
    return res.json({ flashcards: parsed });
  } catch (error: any) {
    console.error('Error generating flashcards:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate flashcards.' });
  }
});

// 2. API route to evaluate a student's answer
app.post('/api/flashcards/evaluate', async (req, res) => {
  try {
    const { card, userAnswer } = req.body;
    if (!card || userAnswer === undefined) {
      return res.status(400).json({ error: 'Card details and user answer are required.' });
    }

    const ai = getGemini();

    const prompt = `You are evaluating a student's answer to an engineering flashcard.

Flashcard under test:
- Subject: ${card.subject}
- Sub-Topic: ${card.topic}
- Core Equation: ${card.formulaReference}
- Question: ${card.question}
- Expected Rigorous Answer: ${card.expectedAnswerSummary}

The student's typed answer is:
"""
${userAnswer}
"""

Conduct a high-thinking engineering assessment.
1. Assign an accuracy score from 0 (completely wrong / absent) to 100 (flawless, precise, hits all parameters). Give partial credit for correct logic, equations, or correct qualitative descriptors even if the numerical calculation is omitted or partially incorrect.
2. Provide critical but encouraging appraisal of their answer in "technicalAccuracy". Explain exactly what is right, what is missing, and what was incorrect.
3. Elaborate a deep, step-by-step reasoning breakdown showing the underlying physical mechanism, math, and variables in "stepByStepBreakdown".
4. Call out "commonPitfalls" why engineering candidates usually miss points on this (e.g. ignoring negative signs, unit inconsistencies, or invalid state assumptions).
5. State an elegant "keyTakeaway" for exam day.
`;

    const response = await generateContentWithFallback(prompt, {
      systemInstruction: "You are an encouraging and pedantic academic engineering evaluator. You analyze STEM explanations, derivations, and calculations. You highlight and deconstruct common conceptual pitfalls and mathematical errors. You format your output strictly as a JSON object matching the schema.",
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT' as any,
        properties: {
          score: { type: 'INTEGER' as any, description: 'Evaluation score out of 100.' },
          correct: { type: 'BOOLEAN' as any, description: 'Fundamentally correct (usually score >= 70).' },
          technicalAccuracy: { type: 'STRING' as any, description: 'Clear critique of their answer, explaining what is correct or missing.' },
          stepByStepBreakdown: { type: 'STRING' as any, description: 'An educational, step-by-step scientific/mathematical derivation and logical overview.' },
          commonPitfalls: { type: 'STRING' as any, description: 'Standard errors or assumptions that students trip over on this type of question.' },
          keyTakeaway: { type: 'STRING' as any, description: 'One clear, concise sentence to remember for the exam.' }
        },
        required: ['score', 'correct', 'technicalAccuracy', 'stepByStepBreakdown', 'commonPitfalls', 'keyTakeaway']
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty evaluation response returned from Gemini.');
    }

    const evaluation = JSON.parse(responseText.trim());
    return res.json({ evaluation });
  } catch (error: any) {
    console.error('Error evaluating answer:', error);
    return res.status(500).json({ error: error.message || 'Failed to evaluate answer.' });
  }
});

// Serve frontend build static files or connect Vite Dev Server middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // production mode
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
