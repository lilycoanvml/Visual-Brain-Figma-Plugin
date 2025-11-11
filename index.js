import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    version: '1.0.0',
    endpoints: ['/api/analyze-guidelines', '/api/chat'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ healthy: true, timestamp: new Date().toISOString() });
});

// Analyze brand guidelines endpoint
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    console.log('='.repeat(50));
    console.log('📥 Analyze guidelines request received');
    console.log('Timestamp:', new Date().toISOString());
    
    const { content, images, apiKey } = req.body;

    // Validation
    if (!apiKey) {
      console.log('❌ Missing API key');
      return res.status(400).json({ 
        success: false,
        error: 'API key is required'
      });
    }

    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      console.log('❌ Invalid API key format');
      return res.status(400).json({ 
        success: false,
        error: 'API key must be a non-empty string'
      });
    }

    if (!content) {
      console.log('❌ Missing content');
      return res.status(400).json({ 
        success: false,
        error: 'Content is required'
      });
    }

    if (typeof content !== 'string') {
      console.log('❌ Content is not a string');
      return res.status(400).json({ 
        success: false,
        error: 'Content must be a string'
      });
    }

    console.log('✅ Request validated');
    console.log('📝 Content length:', content.length, 'characters');
    console.log('🖼️ Images:', images ? images.length : 0);
    console.log('🔑 API Key length:', apiKey.length);

    // Initialize Anthropic client with the provided API key
    console.log('🔐 Initializing Anthropic client...');
    const anthropic = new Anthropic({ 
      apiKey: apiKey.trim()
    });

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

Respond ONLY with valid JSON (no markdown, no code blocks, no explanation) with these exact keys: brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples, brandEssence`;

    const messageContent = [
      {
        type: 'text',
        text: prompt
      }
    ];

    // Add images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      console.log('🖼️ Processing', images.length, 'images...');
      for (let i = 0; i < Math.min(images.length, 2); i++) {
        try {
          const imageData = images[i];
          let base64Data = imageData;
          
          // Handle data URLs
          if (typeof imageData === 'string' && imageData.includes('data:image')) {
            base64Data = imageData.split(',')[1];
          }

          if (!base64Data) {
            console.warn(`⚠️ Image ${i + 1}: No valid base64 data`);
            continue;
          }
          
          messageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data
            }
          });
          console.log(`✅ Image ${i + 1} added (${base64Data.length} chars)`);
        } catch (e) {
          console.error(`❌ Error processing image ${i + 1}:`, e.message);
        }
      }
    }

    console.log('🤖 Calling Anthropic API with', messageContent.length, 'content blocks...');
    console.log('Model: claude-3-5-sonnet-20241022');
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ]
    });

    console.log('✅ API response received');
    console.log('Response status:', response.stop_reason);

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      console.error('❌ No text in response');
      throw new Error('No text response from Claude');
    }

    console.log('📋 Response text length:', textContent.text.length, 'characters');
    console.log('First 200 chars:', textContent.text.substring(0, 200));

    // Extract and parse JSON
    let parsed;
    try {
      // First try direct JSON parse
      parsed = JSON.parse(textContent.text);
      console.log('✅ Direct JSON parse successful');
    } catch (e) {
      console.log('⚠️ Direct parse failed, trying to extract JSON...');
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in response');
        }
        
        parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Extracted JSON parse successful');
      } catch (parseError) {
        console.error('❌ JSON extraction failed:', parseError.message);
        console.error('Full response text:', textContent.text);
        
        // Fallback response
        parsed = {
          brandPersonality: 'Analysis received but JSON parsing failed',
          visualStyle: textContent.text.substring(0, 500),
          coreValues: 'See raw response above',
          targetAudience: 'Please retry',
          colorPsychology: 'Please retry',
          typographyCharacter: 'Please retry',
          imageryStyle: 'Please retry',
          designPrinciples: 'Please retry',
          brandEssence: 'Analysis pending'
        };
      }
    }

    console.log('✅ Response JSON keys:', Object.keys(parsed));
    console.log('='.repeat(50));
    
    res.status(200).json({ 
      success: true, 
      data: parsed 
    });

  } catch (error) {
    console.error('='.repeat(50));
    console.error('❌ ERROR in /api/analyze-guidelines');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error status:', error.status);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Response data:', error.response?.data);
    }
    console.error('Stack:', error.stack);
    console.error('='.repeat(50));
    
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed', 
      message: error.message,
      errorType: error.name,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    available: ['/api/analyze-guidelines', '/api/chat', '/health', '/']
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Brand Guidelines API running on http://localhost:${PORT}`);
    console.log(`📝 API Key format: sk-ant-...`);
  });
}

export default app;