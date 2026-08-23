import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { GoogleGenAI } from '@google/genai';
import prisma from '../db/prisma';

export const llmWorker = new Worker('llm', async (job: Job) => {
  const { appointmentId, symptoms } = job.data;
  console.log(`[LlmWorker] Generating summary for appointment ${appointmentId}...`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[LlmWorker] GEMINI_API_KEY not set. Skipping summary generation.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Analyze these symptoms and return a JSON object with: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const preVisitSummary = JSON.parse(response.text || '{}');
    
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { preVisitSummary },
    });
    console.log(`[LlmWorker] Updated appointment ${appointmentId} with pre-visit summary.`);
  } catch (err) {
    console.error(`[LlmWorker] Failed to generate or parse summary:`, err);
    throw err;
  }
}, { connection: redisClient });
