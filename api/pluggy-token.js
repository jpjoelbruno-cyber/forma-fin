// Vercel Serverless Function — FORMÁ Financiero
// Mantiene PLUGGY_ID y PLUGGY_SECRET en el servidor, nunca en el cliente

export default async function handler(req, res) {
  // Solo POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS: solo desde forma-fin.vercel.app
  const origin = req.headers.origin || '';
  const allowed = [
    'https://forma-fin.vercel.app',
    'https://forma-financiero.vercel.app',
    'http://localhost:3000'
  ];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const response = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.message || 'Error Pluggy' });
    }

    const data = await response.json();
    // Solo devuelve el apiKey, nunca las credenciales
    return res.status(200).json({ apiKey: data.apiKey });

  } catch (e) {
    return res.status(500).json({ error: 'Error interno: ' + e.message });
  }
}
