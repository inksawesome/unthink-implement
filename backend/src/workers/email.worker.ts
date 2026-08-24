import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailWorker = new Worker('email', async (job: Job) => {
  const { to, subject, body, html } = job.data;
  console.log(`[EmailWorker] Sending email to ${to}...`);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Clinic" <no-reply@clinic.com>',
    to,
    subject,
    text: body,
    html: html || undefined,
  });
  console.log(`[EmailWorker] Email sent to ${to}`);
}, { connection: redisClient });
