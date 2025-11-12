import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    version: '1.0.0',
    endpoints: ['/api/analyze-guidelines', '/api/chat', '/api/compliance-grade'],
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ healthy: true, timestamp: new Date().toISOString() });
});

// Analyze brand guidelines endpoint
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    console.log('📥 Analyze guidelines request received');
    
    const { content, images, apiKey } = req.body;

    if (!apiKey) {
      console.log('❌ Missing API key');
      return res.status(400).json({ 
        success: false,
        error: 'API key is required'
      });
    }

    if (!content) {
      console.log('❌ Missing content');
      return res.status(400).json({ 
        success: false,
        error: 'Content is required'
      });
    }

    console.log('✅ Request validated');
    console.log('📝 Content length:', content.length);

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    const prompt = `You are a brand design expert analyzing brand guidelines. Read and deeply understand this brand guidelines document.

DOCUMENT CONTENT:
${content.substring(0, 8000)}

Please analyze and provide a comprehensive understanding including:

1. **Brand Personality**: What is the overall feeling, tone, and personality of this brand?
2. **Visual Style**: Describe the visual aesthetic and design direction.
3. **Core Values**: What values and principles does this brand stand for?
4. **Target Audience**: Who is this brand designed for?
5. **Color Psychology**: What do the colors represent and what feelings should they evoke?
6. **Typography Character**: What personality do the fonts convey?
7. **Imagery Style**: What kind of images align with this brand?
8. **Design Principles**: Key dos and don'ts
9. **Brand Essence**: In one sentence, what is the essence of this brand?

Respond ONLY with valid JSON (no markdown, no explanation) with these exact keys: brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples, brandEssence`;

    console.log('🤖 Calling Anthropic API...');
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    console.log('✅ API response received');

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    let parsed;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      
      parsed = {
        brandPersonality: 'Unable to parse',
        visualStyle: textContent.text.substring(0, 200),
        coreValues: 'Analysis pending',
        targetAudience: 'Unknown',
        colorPsychology: 'Unknown',
        typographyCharacter: 'Unknown',
        imageryStyle: 'Unknown',
        designPrinciples: 'See raw response',
        brandEssence: 'Check guidelines'
      };
    }

    res.status(200).json({ 
      success: true, 
      data: parsed 
    });

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed', 
      message: error.message
    });
  }
});

// Compliance grade endpoint
app.post('/api/compliance-grade', async (req, res) => {
  try {
    console.log('='.repeat(50));
    console.log('📊 Compliance grade request received');
    
    const { frameData, guidelinesContent, aiUnderstanding, colors, typography, spacing, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ 
        success: false,
        error: 'API key is required'
      });
    }

    if (!frameData) {
      return res.status(400).json({ 
        success: false,
        error: 'Frame data is required'
      });
    }

    if (!guidelinesContent) {
      return res.status(400).json({ 
        success: false,
        error: 'Guidelines content is required'
      });
    }

    console.log('✅ Request validated');
    console.log('📐 Frame:', frameData.frameName, frameData.frameType);
    console.log('🎨 Colors detected:', frameData.colors?.length || 0);
    console.log('✍️ Fonts detected:', frameData.fonts?.length || 0);

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    const gradePrompt = `You are an expert brand compliance auditor. Grade the following design based on the brand guidelines provided.

BRAND GUIDELINES DOCUMENT:
${guidelinesContent.substring(0, 6000)}

BRAND UNDERSTANDING:
${JSON.stringify(aiUnderstanding, null, 2)}

DESIGN FRAME DATA:
Frame Name: ${frameData.frameName}
Frame Type: ${frameData.frameType}
Dimensions: ${frameData.dimensions.width}x${frameData.dimensions.height}

Detected Colors:
${frameData.colors?.map(c => `- ${c.hex} (${c.rgb})`).join('\n') || 'None detected'}

Detected Fonts:
${frameData.fonts?.join(', ') || 'None detected'}

Text Content:
${frameData.textContent?.map(t => `- "${t.content.substring(0, 100)}" (${t.fontSize}px, ${t.fontFamily})`).join('\n') || 'No text detected'}

Images/Elements:
${frameData.images?.length || 0} images detected

Create a compliance grade report with these categories:
1. **Accessibility** - Text contrast, font sizes, readability
2. **Color Palette** - Color usage consistency, brand alignment
3. **Typography** - Font families, sizes, hierarchy, weight
4. **Layout** - Element alignment, spacing, visual hierarchy
5. **Brand Assets** - Logo usage, brand elements
6. **Imagery** - Image style, photography aesthetic
7. **Graphic Elements** - Icons, shapes, visual consistency
8. **Overall Brand Feel** - Does it feel on-brand?

For EACH check, provide:
- Category: The category name
- Check: Specific thing being checked
- Severity: "critical" (red), "warning" (yellow), or "pass" (green)
- Reason: Specific feedback on why it passes/fails/warns

CRITICAL = Major brand violation, must fix
WARNING = Minor issue or potential inconsistency, should address
PASS = Meets brand requirements perfectly

Be specific and actionable. Reference actual colors, fonts, and measurements detected.

Respond ONLY with valid JSON array. Each object must have: category, check, severity, reason`;

    console.log('🤖 Calling Anthropic for grading...');
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: gradePrompt
        }
      ]
    });

    const endTime = Date.now();
    console.log('⏱️ Grading took', (endTime - startTime) / 1000, 'seconds');
    console.log('✅ API response received');

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    console.log('📋 Response length:', textContent.text.length);

    let gradeReport;
    try {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found');
      }
      gradeReport = JSON.parse(jsonMatch[0]);
      console.log('✅ Grade report parsed:', gradeReport.length, 'items');
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      throw new Error('Failed to parse grade response: ' + e.message);
    }

    const organized = {
      violations: gradeReport.filter(item => item.severity === 'critical'),
      warnings: gradeReport.filter(item => item.severity === 'warning'),
      passed: gradeReport.filter(item => item.severity === 'pass')
    };

    console.log('Summary:');
    console.log('✓ Passed:', organized.passed.length);
    console.log('⚠ Warnings:', organized.warnings.length);
    console.log('✗ Critical:', organized.violations.length);
    console.log('='.repeat(50));

    res.status(200).json({ 
      success: true, 
      data: {
        violations: organized.violations,
        warnings: organized.warnings,
        passed: organized.passed,
        totalChecks: gradeReport.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Grade error:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Grading failed', 
      message: error.message
    });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    console.log('💬 Chat request received');
    
    const { messages, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ 
        success: false,
        error: 'API key is required'
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log('✅ Chat request validated');
    console.log('📨 Messages:', messages.length);

    const anthropic = new Anthropic({ apiKey: apiKey.trim() });

    console.log('🤖 Calling Anthropic Chat API...');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1500,
      messages: messages
    });

    console.log('✅ Chat response received');

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from Claude');
    }

    res.status(200).json({ 
      success: true, 
      data: textContent.text 
    });

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    
    res.status(500).json({ 
      success: false,
      error: 'Chat failed', 
      message: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Brand Guidelines API running on http://localhost:${PORT}`);
  });
}

export default app;