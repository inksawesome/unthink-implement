import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { GoogleGenAI } from '@google/genai';
import prisma from '../db/prisma';

export const llmWorker = new Worker('llm', async (job: Job) => {
  const { appointmentId, symptoms, notes } = job.data;
  
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[LlmWorker] GEMINI_API_KEY not set. Skipping summary generation.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    if (job.name === 'generate-pre-visit') {
      console.log(`[LlmWorker] Generating pre-visit summary for appointment ${appointmentId}...`);
      const prompt = `Analyze these symptoms and return a JSON object with: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
  
      const preVisitSummary = JSON.parse(response.text || '{}');
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { preVisitSummary },
      });
      console.log(`[LlmWorker] Updated appointment ${appointmentId} with pre-visit summary.`);
    } else if (job.name === 'generate-post-visit') {
      console.log(`[LlmWorker] Generating post-visit summary for appointment ${appointmentId}...`);
      const prompt = `Rewrite these doctor's notes into a patient-friendly summary without medical jargon. Extract any explicit medication bullet points. Notes: ${notes}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });

      const postVisitSummaryPatient = response.text || '';
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { postVisitSummaryPatient },
      });
      console.log(`[LlmWorker] Updated appointment ${appointmentId} with post-visit summary.`);
    }
  } catch (err) {
    console.error(`[LlmWorker] Failed to generate or parse summary:`, err);
    throw err;
  }
}, { connection: redisClient });
