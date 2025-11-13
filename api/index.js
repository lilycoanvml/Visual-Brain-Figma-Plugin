export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  res.status(200).json({
    status: 'Brand Guidelines API - v2',
    version: '2.0.0',
    endpoints: [
      '/api/chat-with-pdf',
      '/api/compliance-grade',
      '/api/analyze-guidelines',
      '/api/analyze-frames'
    ]
  });
}
