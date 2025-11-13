import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();

// Middleware - INCREASED LIMITS FOR PDF + IMAGES
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Handle OPTIONS preflight
app.options('*', cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    endpoints: [
      'GET /',
      'GET /health',
      'POST /api/analyze-guidelines',
      'POST /api/analyze-frames',
      'POST /api/compliance-grade',
      'POST /api/chat-with-pdf (NEW)',
      'POST /api/chat'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

// Analyze guidelines - extracts brand info from PDF
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    console.log('📥 Analyze guidelines');
    const { content, apiKey, pdfBase64 } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Missing apiKey' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    
    // Build message with PDF if provided
    const messageContent = [];
    
    if (pdfBase64) {
      console.log('📄 Including PDF in analysis');
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
      text: `Analyze this brand guidelines document and extract ALL important information.

${content ? 'Text content:\n' + content.substring(0, 8000) : ''}

Provide a comprehensive JSON response with:
- brandEssence: One sentence capturing the brand's core identity
- brandPersonality: Detailed brand character and tone
- visualStyle: Complete visual design approach
- coreValues: Key brand values
- targetAudience: Who the brand serves
- colorPsychology: How colors are used and why
- typographyCharacter: Font choices and their meaning
- imageryStyle: Photo/illustration style guidelines
- designPrinciples: Core design rules

Respond ONLY with valid JSON.`
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from response');
    }
    const json = JSON.parse(jsonMatch[0]);
    
    res.json({ success: true, data: json });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Chat with PDF document
app.post('/api/chat-with-pdf', async (req, res) => {
  try {
    console.log('💬 Chat with PDF request');
    const { messages, apiKey, pdfBase64, pdfName } = req.body;

    if (!apiKey || !messages) {
      return res.status(400).json({ success: false, error: 'Missing apiKey or messages' });
    }

    if (!pdfBase64) {
      return res.status(400).json({ success: false, error: 'PDF required for chat' });
    }

    console.log('📄 PDF:', pdfName, 'Size:', Math.round(pdfBase64.length / 1024) + 'KB');

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    
    // Build message with PDF
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
        text: `This is the brand guidelines PDF: "${pdfName}". Please read and understand all content including text and images.`
      }
    ];
    
    // Add conversation history
    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage.content === 'string') {
      messageContent.push({
        type: 'text',
        text: lastMessage.content
      });
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
    console.log('✅ Chat response generated');
    res.json({ success: true, data: text });

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze frames with images
app.post('/api/analyze-frames', async (req, res) => {
  try {
    console.log('🖼️ Analyze frames with images');
    const { frameImages, guidelines, apiKey, pdfBase64 } = req.body;

    if (!apiKey || !frameImages || !guidelines) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    // Build message with PDF first, then images
    const messageContent = [];
    
    // Add PDF if provided
    if (pdfBase64) {
      console.log('📄 Including PDF in frame analysis');
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
        text: 'Brand guidelines PDF provided above. Use this as reference.'
      });
    }
    
    messageContent.push({
      type: 'text',
      text: `Analyze these Figma designs against the brand guidelines.

BRAND CONTEXT:
${guidelines.aiUnderstanding?.brandEssence || 'See PDF above'}

Analyze the images below and provide:
1. Summary of what you see
2. Violations of brand guidelines
3. Strengths that align with brand
4. Improvement suggestions

Respond with JSON: {
  "summary": "description",
  "violations": ["issue1", "issue2"],
  "strengths": ["good1", "good2"],
  "suggestions": ["tip1", "tip2"]
}`
    });

    // Add all frame images
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
        text: `Frame: "${frame.name}" (${frame.width}x${frame.height})`
      });
    }

    console.log(`📸 Analyzing ${frameImages.length} images with PDF context`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: analysis });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compliance grade with PDF and screenshot
app.post('/api/compliance-grade', async (req, res) => {
  try {
    console.log('📊 Compliance grade');
    const { frameData, guidelinesContent, aiUnderstanding, apiKey, pdfBase64 } = req.body;

    if (!apiKey || !frameData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    const messageContent = [];
    
    // Add PDF if available
    if (pdfBase64) {
      console.log('📄 Including PDF in grading');
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
        text: 'Brand guidelines PDF above. Grade design against these guidelines.'
      });
    }
    
    messageContent.push({
      type: 'text',
      text: `Grade this design against brand guidelines.

DESIGN INFO:
- Frame: ${frameData.frameName}
- Colors: ${frameData.colors?.map(c => c.hex).join(', ') || 'None'}
- Fonts: ${frameData.fonts?.join(', ') || 'None'}

Check: Accessibility, Colors, Typography, Layout, Brand Assets, Imagery, Graphics, Brand Feel

For each check respond with JSON array:
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
      console.log('📸 Screenshot included');
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
      throw new Error('Could not parse JSON array');
    }
    
    const json = JSON.parse(jsonMatch[0]);

    const organized = {
      violations: json.filter(i => i.severity === 'critical'),
      warnings: json.filter(i => i.severity === 'warning'),
      passed: json.filter(i => i.severity === 'pass')
    };

    res.json({ success: true, data: organized });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple chat (fallback without PDF)
app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Simple chat request');
    const { messages, apiKey } = req.body;

    if (!apiKey || !messages) {
      return res.status(400).json({ success: false, error: 'Missing apiKey or messages' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: messages
    });

    const text = response.content[0]?.text || '';
    res.json({ success: true, data: text });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Export for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
  });
}

export default app;

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    endpoints: [
      'GET /',
      'GET /health',
      'POST /api/analyze-guidelines',
      'POST /api/compliance-grade',
      'POST /api/analyze-frames (NEW)',
      'POST /api/chat'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

// Analyze guidelines
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    console.log('📥 Analyze guidelines');
    const { content, apiKey } = req.body;

    if (!apiKey || !content) {
      return res.status(400).json({ success: false, error: 'Missing apiKey or content' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze this brand document and provide: brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples, brandEssence. Respond ONLY with JSON.

${content.substring(0, 8000)}`
      }]
    });

    const text = response.content[0]?.text || '';
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
    res.json({ success: true, data: json });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW ENDPOINT: Analyze frames with images
app.post('/api/analyze-frames', async (req, res) => {
  try {
    console.log('🖼️ Analyze frames with images');
    const { frameImages, guidelines, apiKey } = req.body;

    if (!apiKey || !frameImages || !guidelines) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    // Build message with text and images
    const messageContent = [
      {
        type: 'text',
        text: `You are a brand compliance expert. Analyze these Figma designs against the brand guidelines.

BRAND GUIDELINES:
Brand Essence: ${guidelines.aiUnderstanding?.brandEssence || 'Not specified'}
Brand Personality: ${guidelines.aiUnderstanding?.brandPersonality || 'Not specified'}
Visual Style: ${guidelines.aiUnderstanding?.visualStyle || 'Not specified'}
Colors: ${guidelines.colors?.map(c => c.hex).join(', ') || 'Not specified'}
Fonts: ${guidelines.typography?.fonts?.map(f => f.family).join(', ') || 'Not specified'}

Analyze the images and provide:
1. A brief summary of what you see
2. Any violations of the brand guidelines (be specific)
3. Strengths that align well with the brand
4. Suggestions for improvement

Respond with JSON: {
  "summary": "brief description",
  "violations": ["issue 1", "issue 2"],
  "strengths": ["good 1", "good 2"],
  "suggestions": ["tip 1", "tip 2"]
}`
      }
    ];

    // Add all frame images
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
        text: `Frame: "${frame.name}" (${frame.width}x${frame.height})`
      });
    }

    console.log(`📸 Sending ${frameImages.length} images to Claude...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    });

    const text = response.content[0]?.text || '';
    console.log('📥 Claude response:', text.substring(0, 200));
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);

    res.json({ 
      success: true, 
      data: analysis
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compliance grade with images
app.post('/api/compliance-grade', async (req, res) => {
  try {
    console.log('📊 Compliance grade request');
    const { frameData, guidelinesContent, aiUnderstanding, apiKey } = req.body;

    if (!apiKey || !frameData || !guidelinesContent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    // Build message content with text and image
    const messageContent = [
      {
        type: 'text',
        text: `Grade this Figma design against brand guidelines. Create a detailed compliance report.

BRAND GUIDELINES:
${guidelinesContent.substring(0, 6000)}

BRAND PERSONALITY: ${aiUnderstanding?.brandPersonality || 'Unknown'}
VISUAL STYLE: ${aiUnderstanding?.visualStyle || 'Unknown'}

DESIGN PROPERTIES:
- Frame: ${frameData.frameName}
- Detected Colors: ${frameData.colors?.map(c => c.hex).join(', ') || 'None'}
- Detected Fonts: ${frameData.fonts?.join(', ') || 'None'}
- Text content: ${frameData.textContent?.map(t => t.content.substring(0, 50)).join('; ') || 'None'}

I'm also providing a screenshot of the actual design. Please analyze BOTH the visual design AND the properties.

Check these categories:
1. Accessibility
2. Color Palette
3. Typography
4. Layout & Spacing
5. Brand Assets
6. Imagery
7. Graphic Elements
8. Overall Brand Feel

For each check provide: category, check, severity (critical/warning/pass), reason

Respond ONLY with JSON array: [{category, check, severity, reason}, ...]`
      }
    ];

    // Add screenshot if available
    if (frameData.screenshot) {
      try {
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
        console.log('📸 Screenshot included in analysis');
      } catch (e) {
        console.log('⚠️ Could not add screenshot:', e.message);
      }
    } else {
      console.log('⚠️ No screenshot provided');
    }

    console.log('🤖 Calling Claude API...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: messageContent
      }]
    });

    const text = response.content[0]?.text || '';
    console.log('📥 Claude response received:', text.substring(0, 200));
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON array from response');
    }
    
    const json = JSON.parse(jsonMatch[0]);

    const organized = {
      violations: json.filter(i => i.severity === 'critical'),
      warnings: json.filter(i => i.severity === 'warning'),
      passed: json.filter(i => i.severity === 'pass')
    };

    console.log('✅ Grade complete:', {
      violations: organized.violations.length,
      warnings: organized.warnings.length,
      passed: organized.passed.length
    });

    res.json({ 
      success: true, 
      data: organized
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat with optional PDF context
app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Chat request');
    const { messages, apiKey, pdfBase64, pdfName, guidelinesContext } = req.body;

    if (!apiKey || !messages) {
      return res.status(400).json({ success: false, error: 'Missing apiKey or messages' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    
    // Build message content
    const messageContent = [];
    
    // Add PDF document if provided (optional - may be too large)
    if (pdfBase64 && pdfName) {
      try {
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
          text: `I've uploaded the brand guidelines PDF: "${pdfName}". Please reference this document when answering questions.`
        });
        console.log('📄 PDF included in chat:', pdfName);
      } catch (e) {
        console.log('⚠️ Could not include PDF (might be too large):', e.message);
      }
    }
    
    // Add the conversation messages
    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage.content === 'string') {
      messageContent.push({
        type: 'text',
        text: lastMessage.content
      });
    } else {
      messageContent.push(...lastMessage.content);
    }
    
    // Prepare conversation history
    const conversationMessages = messages.slice(0, -1);
    
    // If we have content to add, update last message
    if (messageContent.length > 0) {
      conversationMessages.push({
        role: 'user',
        content: messageContent
      });
    } else {
      conversationMessages.push(lastMessage);
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: conversationMessages
    });

    const text = response.content[0]?.text || '';
    res.json({ success: true, data: text });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// Export for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
  });
}

export default app;