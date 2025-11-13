import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { content, apiKey, pdfBase64 } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Missing apiKey' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    const messageContent = [];

    if (pdfBase64) {
      messageContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      });
    }

    messageContent.push({
      type: 'text',
      text: `Analyze brand guidelines. Extract: brandEssence, brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples.

${content ? content.substring(0, 8000) : ''}

Respond ONLY with JSON.`,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: messageContent }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const json = JSON.parse(jsonMatch[0]);

    res.status(200).json({ success: true, data: json });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
