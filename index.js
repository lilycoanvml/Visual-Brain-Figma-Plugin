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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Brand Guidelines API is running!',
    endpoints: ['/api/analyze-guidelines', '/api/chat']
  });
});

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

// Analyze brand guidelines endpoint
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    console.log('📥 Analyze guidelines request received');
    
    const { content, images, apiKey } = req.body;

    // Validation
    if (!apiKey) {
      console.log('❌ Missing API key');
      return res.status(400).json({ 
        success: false,
        error: 'API key required' 
      });
    }

    if (!content) {
      console.log('❌ Missing content');
      return res.status(400).json({ 
        success: false,
        error: 'Content required' 
      });
    }

    console.log('✅ Request validated');
    console.log('📝 Content length:', content.length);
    console.log('🖼️ Images:', images ? images.length : 0);

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey });

    const prompt = `You are a brand design expert analyzing brand guidelines. Read and deeply understand this brand guidelines document.

DOCUMENT CONTENT:
${content.substring(0, 8000)}

Please analyze and provide a comprehensive understanding including:

1. **Brand Personality**: What is the overall feeling, tone, and personality of this brand? (e.g., playful, professional, luxurious, minimal, bold)

2. **Visual Style**: Describe the visual aesthetic and design direction. What emotions should designs evoke?

3. **Core Values**: What values and principles does this brand stand for?

4. **Target Audience**: Who is this brand designed for? What demographic and psychographic characteristics?

5. **Color Psychology**: Beyond just hex codes, what do the colors represent? What feelings should they evoke?

6. **Typography Character**: What personality do the fonts convey? How should text feel?

7. **Imagery Style**: What kind of images align with this brand? (photography style, illustration style, etc.)

8. **Design Dos and Don'ts**: Key principles for what should and shouldn't be done

9. **Brand Essence**: In one sentence, what is the essence of this brand?

Respond ONLY with valid JSON (no markdown, no explanation) with these exact keys: brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples, brandEssence`;

    const messageContent = [
      {
        type: 'text',
        text: prompt
      }
    ];

    // Add images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      console.log('🖼️ Processing images...');
      images.slice(0, 2).forEach((imageData, index) => {
        try {
          let base64Data = imageData;
          
          // Handle data URLs
          if (imageData.includes('data:image')) {
            base64Data = imageData.split(',')[1];
          }
          
          messageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data
            }
          });
          console.log(`✅ Image ${index + 1} added`);
        } catch (e) {
          console.error(`❌ Error processing image ${index + 1}:`, e.message);
        }
      });
    }

    console.log('🤖 Calling Anthropic API...');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ]
    });

    console.log('✅ API response received');

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from AI');
    }

    console.log('📋 Response text length:', textContent.text.length);

    // Extract JSON from response
    let parsed;
    try {
      // Try to find and parse JSON
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      console.error('Response text:', textContent.text.substring(0, 500));
      
      // Return a structured default response if parsing fails
      parsed = {
        brandPersonality: 'Unable to parse - please check guidelines',
        visualStyle: textContent.text.substring(0, 200),
        coreValues: 'Analysis pending',
        targetAudience: 'Unknown',
        colorPsychology: 'Unknown',
        typographyCharacter: 'Unknown',
        imageryStyle: 'Unknown',
        designPrinciples: 'See raw response',
        brandEssence: 'Check guidelines document'
      };
    }

    res.status(200).json({ 
      success: true, 
      data: parsed 
    });

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
    console.error('Error details:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Analysis failed', 
      message: error.message,
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
        error: 'API key required' 
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Messages array required' 
      });
    }

    console.log('✅ Request validated');
    console.log('📨 Messages:', messages.length);

    const anthropic = new Anthropic({ apiKey });

    console.log('🤖 Calling Anthropic Chat API...');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: messages
    });

    console.log('✅ API response received');

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from AI');
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
    method: req.method
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Brand Guidelines API running on http://localhost:${PORT}`);
  });
}

export default app;