# Healthcare Appointment & Follow-up Manager

A comprehensive healthcare appointment platform with separate portals for patients, doctors, and admins. It handles appointment booking, prevents double-booking, manages doctor leaves, sends notifications (Email & Google Calendar), and leverages AI (LLMs) to generate pre-visit and post-visit summaries.

## Documentation Reference
Detailed documentation is stored in the `/docs` directory:
- [Architecture Design](./docs/Architecture_Design.md)
- [System Design](./docs/System_Design.md) (Double-booking prevention, leave conflict handling, reliability)
- [Database Schema](./docs/DB_Schema.md)
- [API Documentation](./docs/API_Docs.md)
- [Google Calendar Setup Guide](./docs/Calendar_Setup.md)

## Tech Stack
- **Backend:** Node.js, Express, TypeScript, Prisma (ORM), PostgreSQL, Redis, BullMQ
- **Frontend:** Next.js, React, TailwindCSS
- **Integrations:** OpenAI API (LLM), Google Calendar API, Nodemailer/SendGrid (Email)

## Setup Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) & Docker Compose (for PostgreSQL and Redis)
- Git

### 2. Clone and Install
```bash
# Clone the repository
git clone https://github.com/your-username/unthink-implement.git
cd unthink-implement

# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 3. Environment Variables
You need to set up environment variables for both the backend and frontend.

```bash
# Setup backend environment variables
cd backend
cp .env.example .env

# Setup frontend environment variables
cd ../frontend
cp .env.example .env
```
Fill in the necessary credentials in your `backend/.env` file (Database, Redis, JWT Secret, OpenAI API Key, SMTP configuration) and `frontend/.env` file (`NEXT_PUBLIC_API_URL`).

### 4. Start Infrastructure (Database & Redis)
Use the provided `docker-compose.yml` to spin up PostgreSQL and Redis.
```bash
# From the project root
docker-compose up -d
```

### 5. Database Setup
Initialize the database schema using Prisma.
```bash
# In the backend directory
npx prisma generate
npx prisma db push
```

### 6. Run the Application
Start the backend and worker processes:
```bash
# In the backend directory
npm run dev
```
Start the frontend development server:
```bash
# In the frontend directory
npm run dev
```
The backend API will be available at `http://localhost:3000` and the frontend application at `http://localhost:3001`.

## LLM Usage Guidance (Prompts)

The system integrates with an LLM (e.g., OpenAI) to summarize patient symptoms before a visit and doctor notes after a visit. The backend workers (`llmQueue`) use the following structured prompts:

### Pre-visit Summary Prompt
> "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"

### Post-visit Summary Prompt
> "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
