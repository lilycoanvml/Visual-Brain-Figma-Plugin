import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { frameData, apiKey, pdfBase64 } = req.body;
    if (!apiKey || !frameData) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    const messageContent = [];

    if (pdfBase64) {
      messageContent.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
      });
      messageContent.push({
        type: 'text',
        text: 'Brand guidelines PDF above. Grade design against these.',
      });
    }

    messageContent.push({
      type: 'text',
      text: `Grade this design against brand guidelines.

Frame: ${frameData.frameName}
Colors: ${frameData.colors?.map(c => c.hex).join(', ') || 'None'}
Fonts: ${frameData.fonts?.join(', ') || 'None'}

Check: Accessibility, Colors, Typography, Layout, Brand Assets, Imagery, Graphics, Brand Feel

Respond with JSON array:
[{category, check, severity (critical/warning/pass), reason}, ...]`,
    });

    if (frameData.screenshot) {
      let imageBase64 = frameData.screenshot;
      if (imageBase64.includes('base64,')) {
        imageBase64 = imageBase64.split('base64,')[1];
      }

      messageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: messageContent }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse JSON');

    const json = JSON.parse(jsonMatch[0]);
    const organized = {
      violations: json.filter(i => i.severity === 'critical'),
      warnings: json.filter(i => i.severity === 'warning'),
      passed: json.filter(i => i.severity === 'pass'),
    };

    res.status(200).json({ success: true, data: organized });
  } catch (error) {
    console.error('Grade error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}
