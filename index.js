import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    endpoints: [
      'GET /',
      'GET /health',
      'POST /api/analyze-guidelines',
      'POST /api/compliance-grade',
      'POST /api/chat'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ test: 'working' });
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
      model: 'claude-opus-4-1-20250805',
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

// Compliance grade - THIS IS THE ENDPOINT THAT WAS MISSING
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

    const prompt = `Grade this Figma design against brand guidelines. Create a compliance report.

BRAND GUIDELINES:
${guidelinesContent.substring(0, 6000)}

BRAND PERSONALITY: ${aiUnderstanding?.brandPersonality || 'Unknown'}

DESIGN:
- Frame: ${frameData.frameName}
- Colors: ${frameData.colors?.map(c => c.hex).join(', ') || 'None'}
- Fonts: ${frameData.fonts?.join(', ') || 'None'}

Check these categories:
1. Accessibility
2. Color Palette
3. Typography
4. Layout
5. Brand Assets
6. Imagery
7. Graphic Elements
8. Overall Brand Feel

For each check provide: category, check, severity (critical/warning/pass), reason

Respond ONLY with JSON array of objects with: {category, check, severity, reason}`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const text = response.content[0]?.text || '';
    const json = JSON.parse(text.match(/\[[\s\S]*\]/)[0]);

    const organized = {
      violations: json.filter(i => i.severity === 'critical'),
      warnings: json.filter(i => i.severity === 'warning'),
      passed: json.filter(i => i.severity === 'pass')
    };

    res.json({ 
      success: true, 
      data: organized
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat
app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Chat request');
    const { messages, apiKey } = req.body;

    if (!apiKey || !messages) {
      return res.status(400).json({ success: false, error: 'Missing apiKey or messages' });
    }

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
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