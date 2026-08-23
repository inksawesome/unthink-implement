import { Queue } from 'bullmq';
import { redisClient } from '../config/redis';

// Export queues to be used by controllers
export const emailQueue = new Queue('email', { connection: redisClient });
export const calendarQueue = new Queue('calendar', { connection: redisClient });
export const llmQueue = new Queue('llm', { connection: redisClient });
