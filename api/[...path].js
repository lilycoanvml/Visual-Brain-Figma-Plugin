import Anthropic from '@anthropic-ai/sdk';

// Brand Guidelines API Handler - v2.0
export default async function handler(req, res) {
  // CORS headers for ALL responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Normalize path - remove query string
  // In catch-all routes, req.url will be like '/chat-with-pdf' not '/api/chat-with-pdf'
  let path = req.url.split('?')[0];

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  console.log('📍 Request:', req.method, path, 'Query:', req.query);

  // ===== HEALTH CHECK =====
  if (req.method === 'GET' && (path === '/' || path === '/api' || path === '/api/')) {
    res.status(200).json({ 
      status: 'API Running',
      endpoints: [
        '/api/chat-with-pdf',
        '/api/compliance-grade',
        '/api/analyze-guidelines',
        '/api/analyze-frames'
      ]
    });
    return;
  }

  // ===== CHAT WITH PDF =====
  if (path === '/chat-with-pdf' && req.method === 'POST') {
    try {
      console.log('💬 Chat request');
      const { messages, apiKey, pdfBase64, pdfName } = req.body;

      if (!apiKey || !messages || !pdfBase64) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: apiKey.trim() });
      
      const messageContent = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
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
      conversationMessages.push({
        role: 'user',
        content: messageContent
      });

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

  // ===== COMPLIANCE GRADE =====
  if (path === '/compliance-grade' && req.method === 'POST') {
    try {
      console.log('📊 Compliance grade');
      const { frameData, guidelinesContent, aiUnderstanding, apiKey, pdfBase64 } = req.body;

      if (!apiKey || !frameData) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: apiKey.trim() });

      const messageContent = [];
      
      // Add PDF
      if (pdfBase64) {
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        });
        messageContent.push({
          type: 'text',
          text: 'Brand guidelines PDF above. Grade design against these.'
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
[{category, check, severity (critical/warning/pass), reason}, ...]`
      });

      // Add screenshot
      if (frameData.screenshot) {
        let imageBase64 = frameData.screenshot;
        if (imageBase64.includes('base64,')) {
          imageBase64 = imageBase64.split('base64,')[1];
        }
        
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: imageBase64
          }
        });
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: messageContent
        }]
      });

      const text = response.content[0]?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON');
      }
      
      const json = JSON.parse(jsonMatch[0]);

      const organized = {
        violations: json.filter(i => i.severity === 'critical'),
        warnings: json.filter(i => i.severity === 'warning'),
        passed: json.filter(i => i.severity === 'pass')
      };

      res.status(200).json({ success: true, data: organized });

    } catch (error) {
      console.error('Grade error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }

  // ===== ANALYZE GUIDELINES =====
  if (path === '/analyze-guidelines' && req.method === 'POST') {
    try {
      const { content, apiKey, pdfBase64 } = req.body;

      if (!apiKey) {
        res.status(400).json({ success: false, error: 'Missing apiKey' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: apiKey.trim() });
      
      const messageContent = [];
      
      if (pdfBase64) {
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        });
      }
      
      messageContent.push({
        type: 'text',
        text: `Analyze brand guidelines. Extract: brandEssence, brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples.

${content ? content.substring(0, 8000) : ''}

Respond ONLY with JSON.`
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: messageContent }]
      });

      const text = response.content[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const json = JSON.parse(jsonMatch[0]);
      
      res.status(200).json({ success: true, data: json });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }

  // ===== ANALYZE FRAMES =====
  if (path === '/analyze-frames' && req.method === 'POST') {
    try {
      const { frameImages, guidelines, apiKey, pdfBase64 } = req.body;

      if (!apiKey || !frameImages) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const anthropic = new Anthropic({ apiKey: apiKey.trim() });

      const messageContent = [];
      
      if (pdfBase64) {
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        });
        messageContent.push({
          type: 'text',
          text: 'Brand guidelines PDF above.'
        });
      }
      
      messageContent.push({
        type: 'text',
        text: `Analyze these designs against brand guidelines.

Provide JSON: {
  "summary": "description",
  "violations": ["issue1", "issue2"],
  "strengths": ["good1", "good2"],
  "suggestions": ["tip1", "tip2"]
}`
      });

      for (const frame of frameImages) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: frame.base64
          }
        });
        messageContent.push({
          type: 'text',
          text: `Frame: "${frame.name}"`
        });
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: messageContent }]
      });

      const text = response.content[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const analysis = JSON.parse(jsonMatch[0]);
      
      res.status(200).json({ success: true, data: analysis });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }

  // 404
  console.log('❌ 404 - No route matched for:', req.method, path);
  res.status(404).json({ error: 'Not found', path: path, method: req.method });
}