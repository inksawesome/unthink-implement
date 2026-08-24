/**
 * simulate-traffic.js
 * 
 * Runs a single iteration of traffic simulation.
 * Logs in with provided credentials to obtain a JWT token, 
 * then randomly hits an authenticated or unauthenticated endpoint.
 */

const targetUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const email = process.env.SIM_EMAIL;
const password = process.env.SIM_PASSWORD;

async function run() {
  console.log(`[${new Date().toISOString()}] Starting traffic simulation for ${targetUrl}`);
  let token = null;

  // 1. Attempt Login if credentials are provided
  if (email && password) {
    try {
      const loginRes = await fetch(`${targetUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Organic-Traffic/1.0' },
        body: JSON.stringify({ email, password })
      });
      
      if (loginRes.ok) {
        const data = await loginRes.json();
        // Assuming your auth response returns { token: "..." } or similar
        token = data.token || data.accessToken;
        console.log('✅ Login successful, obtained auth token.');
      } else {
        console.log(`⚠️ Login failed (${loginRes.status}). Ensure the account is registered.`);
      }
    } catch (e) {
      console.log('❌ Failed to reach login endpoint:', e.message);
    }
  } else {
    console.log('ℹ️ No credentials provided, skipping login.');
  }

  // 2. Define endpoints
  const endpoints = [
    { method: 'GET', path: '/health', auth: false },
    { method: 'GET', path: '/api/doctors', auth: true },
    { method: 'GET', path: '/api/appointments', auth: true },
    { method: 'GET', path: '/api/doctors/1/slots', auth: true }, // Will likely return empty/404 but generates traffic
    // You can add more endpoints here over time
  ];

  // If we don't have a token, only hit unauthenticated routes
  const validEndpoints = token ? endpoints : endpoints.filter(e => !e.auth);
  const endpoint = validEndpoints[Math.floor(Math.random() * validEndpoints.length)];

  const url = `${targetUrl.replace(/\/$/, '')}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } // spoof real browser agent
  };

  if (endpoint.auth && token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. Send Simulated Request
  console.log(`🚀 Simulating request: ${endpoint.method} ${endpoint.path}`);
  try {
    const res = await fetch(url, options);
    console.log(`📬 Response: ${res.status} ${res.statusText}`);
  } catch(e) {
    console.log(`❌ Request failed: ${e.message}`);
  }
}

run();
