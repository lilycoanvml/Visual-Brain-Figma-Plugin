import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Figma
app.use(cors({
  origin: '*', // In production, restrict this to Figma domains
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Brand Guidelines API is running!' });
});

// Analyze brand guidelines endpoint
app.post('/api/analyze-guidelines', async (req, res) => {
  try {
    const { content, images, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

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

Respond in JSON format with these exact keys: brandPersonality, visualStyle, coreValues, targetAudience, colorPsychology, typographyCharacter, imageryStyle, designPrinciples, brandEssence`;

    const messages = [
      {
        role: 'user',
        content: []
      }
    ];

    // Add text content
    messages[0].content.push({
      type: 'text',
      text: prompt
    });

    // Add images if provided
    if (images && images.length > 0) {
      images.slice(0, 3).forEach(imageData => {
        const base64Data = imageData.split(',')[1];
        messages[0].content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64Data
          }
        });
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: messages
    });

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from AI');
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json({ success: true, data: parsed });
    } else {
      throw new Error('Could not parse AI response as JSON');
    }

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }

    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'Messages required' });
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: messages
    });

    const textContent = response.content.find(c => c.type === 'text');
    
    if (!textContent) {
      throw new Error('No text response from AI');
    }

    res.json({ success: true, data: textContent.text });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Chat failed', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Brand Guidelines API running on port ${PORT}`);
});