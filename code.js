// Brand Guidelines Checker - Figma Plugin Code (FIXED)
figma.showUI(__html__, { width: 450, height: 650, themeColors: true });

let brandGuidelines = null;

// Helper function to convert Uint8Array to base64
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert RGB to Hex
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

figma.ui.onmessage = async (msg) => {
  
  // === GRADE FRAME WITH IMAGE ANALYSIS ===
  if (msg.type === 'grade-frame') {
    try {
      console.log('🤖 Processing grade request with image analysis...');
      
      const { frameData, guidelinesContent, aiUnderstanding, colors, typography, spacing, apiKey, endpoint } = msg;
      
      // Clean endpoint URL
      let cleanEndpoint = endpoint.trim();
      if (cleanEndpoint.endsWith('/')) {
        cleanEndpoint = cleanEndpoint.slice(0, -1);
      }
      
      console.log('📤 Sending to:', cleanEndpoint + '/api/compliance-grade');
      console.log('📸 Screenshot included:', !!frameData.screenshot);
      
      // Make the API call from the plugin (server-side, not from iframe)
      const response = await fetch(`${cleanEndpoint}/api/compliance-grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frameData: frameData,
          guidelinesContent: guidelinesContent,
          aiUnderstanding: aiUnderstanding,
          colors: colors,
          typography: typography,
          spacing: spacing,
          apiKey: apiKey
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      
      console.log('✅ Grade response received:', data);
      figma.ui.postMessage({
        type: 'grade-complete',
        data: data.success ? data.data : null,
        error: data.success ? null : (data.message || 'Failed to grade')
      });
      
    } catch (error) {
      console.error('❌ Grade API error:', error);
      figma.ui.postMessage({
        type: 'grade-complete',
        data: null,
        error: error.message
      });
    }
  }

  // === CAPTURE GRADE DATA WITH SCREENSHOT ===
  if (msg.type === 'capture-grade-data') {
    try {
      console.log('📊 Capturing grade data with screenshot...');
      
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.ui.postMessage({ 
          type: 'error', 
          message: 'Please select a frame to grade' 
        });
        return;
      }

      const node = selection[0];
      const gradeData = {
        frameName: node.name,
        frameType: node.type,
        colors: [],
        fonts: [],
        images: [],
        textContent: [],
        dimensions: {
          width: node.width,
          height: node.height
        },
        properties: {},
        screenshot: null
      };

      // Extract colors from node and children
      function extractColors(element) {
        const colors = [];
        
        if ('fills' in element && element.fills !== figma.mixed) {
          const solidFills = element.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
          solidFills.forEach(fill => {
            const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
            if (!colors.some(c => c.hex === hex)) {
              colors.push({
                hex: hex,
                name: 'Color',
                rgb: `rgb(${Math.round(fill.color.r * 255)}, ${Math.round(fill.color.g * 255)}, ${Math.round(fill.color.b * 255)})`
              });
            }
          });
        }

        if ('children' in element) {
          element.children.forEach(child => {
            colors.push(...extractColors(child));
          });
        }

        return colors;
      }

      // Extract fonts from text elements
      function extractFonts(element) {
        const fonts = [];
        
        if (element.type === 'TEXT' && element.fontName !== figma.mixed) {
          const fontFamily = element.fontName.family;
          if (!fonts.includes(fontFamily)) {
            fonts.push(fontFamily);
          }
        }

        if ('children' in element) {
          element.children.forEach(child => {
            fonts.push(...extractFonts(child));
          });
        }

        return fonts;
      }

      // Extract text content
      function extractText(element) {
        const texts = [];
        
        if (element.type === 'TEXT') {
          texts.push({
            content: element.characters,
            fontSize: element.fontSize,
            fontFamily: element.fontName === figma.mixed ? 'Mixed' : element.fontName.family
          });
        }

        if ('children' in element) {
          element.children.forEach(child => {
            texts.push(...extractText(child));
          });
        }

        return texts;
      }

      // Count images
      function countImages(element) {
        let count = 0;
        
        if (element.type === 'IMAGE') {
          count++;
        }

        if ('children' in element) {
          element.children.forEach(child => {
            count += countImages(child);
          });
        }

        return count;
      }

      gradeData.colors = extractColors(node);
      gradeData.fonts = extractFonts(node);
      gradeData.textContent = extractText(node);
      gradeData.images = new Array(countImages(node)).fill('Image element detected');

      // === CRITICAL: Capture screenshot with HIGHER resolution ===
      try {
        console.log('📸 Exporting frame as PNG...');
        const bytes = await node.exportAsync({ 
          format: 'PNG', 
          constraint: { type: 'SCALE', value: 2 } // Higher quality for AI analysis
        });
        
        console.log('✅ Export successful, size:', bytes.length, 'bytes');
        
        // Convert to base64
        const base64 = uint8ArrayToBase64(bytes);
        gradeData.screenshot = `data:image/png;base64,${base64}`;
        
        console.log('✅ Screenshot converted to base64, length:', base64.length);
      } catch (e) {
        console.error('❌ Screenshot error:', e.message);
        figma.ui.postMessage({ 
          type: 'error', 
          message: 'Failed to capture screenshot: ' + e.message
        });
        return;
      }

      // Get layout properties
      gradeData.properties = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        opacity: 'opacity' in node ? node.opacity : 1,
        cornerRadius: 'cornerRadius' in node ? node.cornerRadius : 0,
        rotation: 'rotation' in node ? node.rotation : 0
      };

      console.log('✅ Grade data captured with screenshot');

      figma.ui.postMessage({ 
        type: 'grade-data-captured',
        frameData: gradeData
      });

    } catch (error) {
      console.error('❌ Grade capture error:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to capture grade data: ' + error.message
      });
    }
  }

  // === ANALYZE SELECTION WITH IMAGES ===
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Please select a frame or element to analyze' 
      });
      return;
    }

    if (!brandGuidelines) {
      try {
        brandGuidelines = await figma.clientStorage.getAsync('brand-guidelines');
      } catch (error) {
        console.error('Error loading guidelines:', error);
      }
    }

    if (!brandGuidelines) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Please upload and parse brand guidelines first' 
      });
      return;
    }

    try {
      console.log('🔍 Analyzing selection with image export...');
      
      // Export selected frames as images
      const frameImages = [];
      
      for (const node of selection) {
        try {
          console.log('📸 Exporting:', node.name);
          const bytes = await node.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 }
          });
          
          const base64 = uint8ArrayToBase64(bytes);
          frameImages.push({
            name: node.name,
            type: node.type,
            base64: base64,
            width: node.width,
            height: node.height
          });
          
          console.log('✅ Exported:', node.name);
        } catch (error) {
          console.error('Export error for', node.name, ':', error);
        }
      }

      console.log(`✅ Exported ${frameImages.length} frames`);

      // Send complete data to UI for AI analysis
      figma.ui.postMessage({ 
        type: 'analysis-ready-for-ai',
        frameImages: frameImages,
        guidelines: brandGuidelines,
        selectionCount: selection.length
      });
      
    } catch (error) {
      console.error('Analysis error:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to analyze element: ' + error.message
      });
    }
  }

  // === SAVE API KEY ===
  if (msg.type === 'save-api-key') {
    try {
      await figma.clientStorage.setAsync('anthropic-api-key', msg.apiKey);
      console.log('✅ API key saved');
    } catch (error) {
      console.error('❌ Error saving API key:', error);
    }
  }

  // === SAVE API ENDPOINT ===
  if (msg.type === 'save-api-endpoint') {
    try {
      await figma.clientStorage.setAsync('api-endpoint', msg.endpoint);
      console.log('✅ API endpoint saved:', msg.endpoint);
    } catch (error) {
      console.error('❌ Error saving API endpoint:', error);
    }
  }

  // === LOAD API KEY ===
  if (msg.type === 'load-api-key') {
    try {
      const apiKey = await figma.clientStorage.getAsync('anthropic-api-key');
      figma.ui.postMessage({ 
        type: 'api-key-loaded', 
        apiKey: apiKey 
      });
    } catch (error) {
      console.error('Error loading API key:', error);
      figma.ui.postMessage({ 
        type: 'api-key-loaded', 
        apiKey: null 
      });
    }
  }

  // === LOAD API ENDPOINT ===
  if (msg.type === 'load-api-endpoint') {
    try {
      const endpoint = await figma.clientStorage.getAsync('api-endpoint');
      figma.ui.postMessage({ 
        type: 'api-endpoint-loaded', 
        endpoint: endpoint 
      });
    } catch (error) {
      console.error('Error loading API endpoint:', error);
      figma.ui.postMessage({ 
        type: 'api-endpoint-loaded', 
        endpoint: null 
      });
    }
  }

  // === PARSE GUIDELINES ===
  if (msg.type === 'parse-guidelines') {
    try {
      console.log('📄 Starting parse, content length:', msg.content ? msg.content.length : 0);
      
      if (!msg.content || typeof msg.content !== 'string') {
        figma.ui.postMessage({ 
          type: 'error', 
          message: 'Invalid file content. Please upload a valid text or PDF file.' 
        });
        return;
      }

      if (msg.content.trim().length === 0) {
        figma.ui.postMessage({ 
          type: 'error', 
          message: 'File is empty. Please upload a file with content.' 
        });
        return;
      }

      console.log('✅ Content valid, parsing...');
      const guidelines = parseGuidelinesFromText(msg.content);
      
      // Add AI understanding if provided
      if (msg.aiUnderstanding) {
        guidelines.aiUnderstanding = msg.aiUnderstanding;
        console.log('✅ AI understanding added');
      }
      
      // Store raw content for AI analysis
      guidelines.rawContent = msg.content.substring(0, 10000);
      
      console.log('✅ Parse complete');
      
      if (!guidelines || typeof guidelines !== 'object') {
        throw new Error('Failed to parse guidelines structure');
      }

      console.log('💾 Saving to storage...');
      await figma.clientStorage.setAsync('brand-guidelines', guidelines);
      brandGuidelines = guidelines;
      
      console.log('✅ Parse successful!');
      figma.ui.postMessage({ 
        type: 'parse-success', 
        guidelines: guidelines
      });
    } catch (error) {
      console.error('❌ Parse error:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to parse guidelines: ' + (error && error.message ? error.message : 'Unknown parsing error')
      });
    }
  }

  // === LOAD GUIDELINES ===
  if (msg.type === 'load-guidelines') {
    try {
      const guidelines = await figma.clientStorage.getAsync('brand-guidelines');
      brandGuidelines = guidelines || null;
      figma.ui.postMessage({ 
        type: 'guidelines-loaded', 
        guidelines: guidelines 
      });
    } catch (error) {
      console.error('Load error:', error);
      figma.ui.postMessage({ 
        type: 'guidelines-loaded', 
        guidelines: null 
      });
    }
  }

  // === CLOSE PLUGIN ===
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

// === HELPER FUNCTIONS ===

function parseGuidelinesFromText(content) {
  const guidelines = {
    colors: [],
    typography: { fonts: [], sizes: [] },
    spacing: { unit: 'px', scale: [] },
    dimensions: {},
    rawContent: content.substring(0, 1000)
  };

  // Extract hex colors
  const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  const hexMatches = content.match(hexRegex);
  if (hexMatches) {
    const uniqueColors = [...new Set(hexMatches)];
    uniqueColors.forEach(hex => {
      guidelines.colors.push({
        name: 'Color',
        hex: hex.toUpperCase(),
        source: 'text'
      });
    });
  }

  // Defaults if nothing found
  if (guidelines.colors.length === 0) {
    guidelines.colors.push({ name: 'Primary', hex: '#667EEA', source: 'default' });
  }

  if (guidelines.typography.fonts.length === 0) {
    guidelines.typography.fonts.push({ family: 'Inter' });
  }

  if (guidelines.spacing.scale.length === 0) {
    guidelines.spacing.scale = [4, 8, 12, 16, 24, 32, 48, 64];
  }

  return guidelines;
}

function analyzeMultipleElements(nodes, guidelines) {
  return { 
    elementType: 'Multiple', 
    name: 'Section', 
    selectionCount: nodes.length,
    violations: [], 
    goodPractices: [], 
    suggestions: [],
    frameImages: [] // Will be populated
  };
}

function analyzeElement(node, guidelines) {
  const analysis = {
    elementType: node.type,
    name: node.name,
    selectionCount: 1,
    violations: [],
    goodPractices: [],
    suggestions: [],
    frameImages: [] // Will be populated
  };

  if (node.type === 'TEXT') {
    analysis.goodPractices.push('✓ Text element detected: ' + node.characters.substring(0, 50));
  }

  if ('fills' in node && node.fills !== figma.mixed) {
    const solidFills = node.fills.filter(f => f.type === 'SOLID');
    if (solidFills.length > 0) {
      analysis.goodPractices.push('✓ ' + solidFills.length + ' fill color(s) applied');
    }
  }

  return analysis;
}