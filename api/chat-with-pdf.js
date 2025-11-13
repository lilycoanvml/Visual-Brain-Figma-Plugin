import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { messages, apiKey, pdfBase64, pdfName } = req.body;
      if (!apiKey || !messages || !pdfBase64) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: apiKey.trim() });

      const messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
        },
        {
          type: 'text',
          text: `Brand guidelines PDF: "${pdfName}". Answer questions based on this document.`
        }
      ];

      const lastMessage = messages[messages.length - 1];
      if (typeof lastMessage.content === 'string') {
        messageContent.push({ type: 'text', text: lastMessage.content });
      }

      const conversationMessages = messages.slice(0, -1);
      conversationMessages.push({ role: 'user', content: messageContent });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: conversationMessages
      });

      const text = response.content[0]?.text || '';
      res.status(200).json({ success: true, data: text });
    } catch (error) {
      console.error('Chat error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
