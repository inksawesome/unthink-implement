# Google Calendar API Setup Guide

To enable Google Calendar synchronization for doctors, you need to configure an OAuth 2.0 application in the Google Cloud Console.

## 1. Create a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project dropdown at the top and select **New Project**.
3. Name your project (e.g., `Healthcare-Appointment-Manager`) and click **Create**.

## 2. Enable the Google Calendar API
1. In the Google Cloud Console dashboard, go to **APIs & Services > Library**.
2. Search for "Google Calendar API".
3. Click on the result and then click **Enable**.

## 3. Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select the **User Type** (Choose "External" for testing, or "Internal" if you have a Google Workspace organization).
3. Fill in the required App information (App name, User support email, Developer contact information).
4. Add the required scopes. You will need:
   - `https://www.googleapis.com/auth/calendar.events` (to read/write events).
5. Add test users if your app is in "Testing" status (e.g., add the email addresses of your test doctor accounts).

## 4. Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials** and select **OAuth client ID**.
3. Select **Web application** as the Application type.
4. Add a name (e.g., `Web Client 1`).
5. Under **Authorized redirect URIs**, add your backend callback URL. 
   - For local development: `http://localhost:3000/api/auth/google/callback`
   - For production, use your hosted domain URL.
6. Click **Create**.
7. You will be presented with a **Client ID** and **Client Secret**.

## 5. Update Environment Variables
Copy the Client ID and Client Secret into your `.env` file:
```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

## 6. Usage Flow in Application
1. A doctor logs in and visits their profile settings.
2. They click "Connect Google Calendar," redirecting them to the Google OAuth consent screen.
3. Upon approval, Google redirects back to your API with an authorization code.
4. The backend exchanges this code for a `refresh_token` and saves it to the doctor's database record.
5. Background workers (`calendarQueue`) use this refresh token to generate short-lived access tokens to create, update, and delete calendar events automatically when appointments change.
