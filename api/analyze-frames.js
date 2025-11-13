import Anthropic from '@anthropic-ai/sdk';

// Analyze frames endpoint
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { frameImages, apiKey, pdfBase64 } = req.body;
    if (!apiKey || !frameImages) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const maxFrames = 3;
    const framesToAnalyze = frameImages.slice(0, maxFrames);
    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    const messageContent = [];

    if (pdfBase64) {
      messageContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      });
      messageContent.push({ type: 'text', text: 'Brand guidelines PDF above.' });
    }

    messageContent.push({
      type: 'text',
      text: `Analyze these ${framesToAnalyze.length} design(s) against brand guidelines.

Provide JSON: {
  "summary": "description",
  "violations": ["issue1", "issue2"],
  "strengths": ["good1", "good2"],
  "suggestions": ["tip1", "tip2"]
}`,
    });

    for (const frame of framesToAnalyze) {
      messageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: frame.base64 },
      });
      messageContent.push({ type: 'text', text: `Frame: "${frame.name}"` });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: messageContent }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch[0]);

    res.status(200).json({ success: true, data: analysis });
  } catch (error) {
    console.error('❌ Analyze frames error:', error.message);
    if (error.message.includes('413') || error.message.includes('too large')) {
      res.status(413).json({
        success: false,
        error: 'Payload too large. Try selecting fewer frames or smaller designs.',
      });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
