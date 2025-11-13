// Brand Guidelines Checker - Figma Plugin Code
figma.showUI(__html__, { width: 450, height: 650, themeColors: true });

let brandGuidelines = null;

// CRITICAL: Base64 conversion for large images
function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) =>
    String.fromCharCode(byte)
  ).join("");
  return btoa(binString);
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

figma.ui.onmessage = async (msg) => {
  
  // === CHAT WITH PDF (BYPASS CORS) ===
  if (msg.type === 'chat-with-pdf') {
    try {
      console.log('💬 Chat request from UI');
      
      const { messages, apiKey, pdfBase64, pdfName, endpoint } = msg;
      
      let cleanEndpoint = endpoint.trim().replace(/\/$/, '');
      
      console.log('📤 Calling:', cleanEndpoint + '/api/chat-with-pdf');
      
      const response = await fetch(`${cleanEndpoint}/api/chat-with-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          apiKey: apiKey,
          pdfBase64: pdfBase64,
          pdfName: pdfName
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Chat failed');
      }
      
      console.log('✅ Chat response received');
      
      figma.ui.postMessage({
        type: 'chat-response',
        response: data.data
      });
      
    } catch (error) {
      console.error('❌ Chat error:', error.message);
      figma.ui.postMessage({
        type: 'chat-error',
        error: error.message
      });
    }
  }
  
  // === GRADE FRAME ===
  if (msg.type === 'grade-frame') {
    try {
      console.log('📊 Grade frame request');
      
      const { frameData, guidelinesContent, aiUnderstanding, apiKey, endpoint, pdfBase64 } = msg;
      
      let cleanEndpoint = endpoint.trim().replace(/\/$/, '');
      
      console.log('📤 Calling:', cleanEndpoint + '/api/compliance-grade');
      
      const response = await fetch(`${cleanEndpoint}/api/compliance-grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameData: frameData,
          guidelinesContent: guidelinesContent,
          aiUnderstanding: aiUnderstanding,
          apiKey: apiKey,
          pdfBase64: pdfBase64
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Grading failed');
      }
      
      console.log('✅ Grade complete');
      
      figma.ui.postMessage({
        type: 'grade-complete',
        data: data.data
      });
      
    } catch (error) {
      console.error('❌ Grade error:', error.message);
      figma.ui.postMessage({
        type: 'grade-complete',
        error: error.message
      });
    }
  }

  // === CAPTURE GRADE DATA ===
  if (msg.type === 'capture-grade-data') {
    try {
      console.log('📊 Capturing grade data');
      
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
        textContent: [],
        dimensions: { width: node.width, height: node.height },
        properties: {},
        screenshot: null
      };

      // Extract data
      function extractColors(element) {
        const colors = [];
        if ('fills' in element && element.fills !== figma.mixed) {
          const solidFills = element.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
          solidFills.forEach(fill => {
            const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
            if (!colors.some(c => c.hex === hex)) {
              colors.push({ hex: hex, name: 'Color' });
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

      gradeData.colors = extractColors(node);
      gradeData.fonts = extractFonts(node);
      gradeData.textContent = extractText(node);

      // Capture screenshot
      try {
        console.log('📸 Exporting frame');
        const bytes = await node.exportAsync({ 
          format: 'PNG', 
          constraint: { type: 'SCALE', value: 1 }
        });
        
        console.log('✅ Export complete:', bytes.length, 'bytes');
        
        const base64 = bytesToBase64(bytes);
        gradeData.screenshot = `data:image/png;base64,${base64}`;
        
        console.log('✅ Base64 conversion complete');
      } catch (e) {
        console.error('❌ Screenshot error:', e);
      }

      gradeData.properties = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      };

      console.log('✅ Grade data captured');

      figma.ui.postMessage({ 
        type: 'grade-data-captured',
        frameData: gradeData
      });

    } catch (error) {
      console.error('❌ Capture error:', error.message);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to capture: ' + error.message
      });
    }
  }

  // === ANALYZE SELECTION ===
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Please select frames to analyze' 
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
        message: 'Please upload brand guidelines first' 
      });
      return;
    }

    try {
      console.log('🔍 Analyzing selection');
      
      const frameImages = [];
      
      for (const node of selection) {
        try {
          console.log('📸 Exporting:', node.name);
          const bytes = await node.exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 1 }
          });
          
          const base64 = bytesToBase64(bytes);
          
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
        message: 'Failed to analyze: ' + error.message
      });
    }
  }

  // === STORAGE ===
  if (msg.type === 'save-api-key') {
    await figma.clientStorage.setAsync('anthropic-api-key', msg.apiKey);
  }

  if (msg.type === 'save-api-endpoint') {
    await figma.clientStorage.setAsync('api-endpoint', msg.endpoint);
  }

  if (msg.type === 'load-api-key') {
    const apiKey = await figma.clientStorage.getAsync('anthropic-api-key');
    figma.ui.postMessage({ type: 'api-key-loaded', apiKey: apiKey });
  }

  if (msg.type === 'load-api-endpoint') {
    const endpoint = await figma.clientStorage.getAsync('api-endpoint');
    figma.ui.postMessage({ type: 'api-endpoint-loaded', endpoint: endpoint });
  }

  if (msg.type === 'parse-guidelines') {
    try {
      const guidelines = parseGuidelinesFromText(msg.content);
      
      if (msg.aiUnderstanding) {
        guidelines.aiUnderstanding = msg.aiUnderstanding;
      }
      
      guidelines.rawContent = msg.content.substring(0, 10000);
      
      await figma.clientStorage.setAsync('brand-guidelines', guidelines);
      brandGuidelines = guidelines;
      
      figma.ui.postMessage({ 
        type: 'parse-success', 
        guidelines: guidelines
      });
    } catch (error) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to parse: ' + error.message
      });
    }
  }

  if (msg.type === 'load-guidelines') {
    const guidelines = await figma.clientStorage.getAsync('brand-guidelines');
    brandGuidelines = guidelines || null;
    figma.ui.postMessage({ 
      type: 'guidelines-loaded', 
      guidelines: guidelines 
    });
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

function parseGuidelinesFromText(content) {
  const guidelines = {
    colors: [],
    typography: { fonts: [], sizes: [] },
    spacing: { unit: 'px', scale: [] },
    rawContent: content.substring(0, 1000)
  };

  const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  const hexMatches = content.match(hexRegex);
  if (hexMatches) {
    const uniqueColors = [...new Set(hexMatches)];
    uniqueColors.forEach(hex => {
      guidelines.colors.push({ name: 'Color', hex: hex.toUpperCase(), source: 'text' });
    });
  }

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