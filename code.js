// Brand Guidelines Checker - Figma Plugin Code
figma.showUI(__html__, { width: 450, height: 650 });

let brandGuidelines = null;

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'capture-grade-data') {
    try {
      console.log('📊 Capturing grade data...');
      
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
        properties: {}
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

      // Capture screenshot
      try {
        const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } });
        const base64 = btoa(String.fromCharCode.apply(null, bytes));
        gradeData.screenshot = `data:image/png;base64,${base64}`;
        console.log('✅ Screenshot captured');
      } catch (e) {
        console.error('Screenshot error:', e.message);
        console.log('⚠️ Screenshot failed, continuing without preview');
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

      console.log('✅ Grade data captured:', gradeData);

      figma.ui.postMessage({ 
        type: 'grade-data-captured',
        frameData: gradeData
      });

    } catch (error) {
      console.error('Grade capture error:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to capture grade data: ' + error.message
      });
    }
  }

  if (msg.type === 'save-api-key') {
    try {
      await figma.clientStorage.setAsync('anthropic-api-key', msg.apiKey);
      console.log('API key saved');
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  }

  if (msg.type === 'save-api-endpoint') {
    try {
      await figma.clientStorage.setAsync('api-endpoint', msg.endpoint);
      console.log('API endpoint saved');
    } catch (error) {
      console.error('Error saving API endpoint:', error);
    }
  }

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

  if (msg.type === 'parse-guidelines') {
    try {
      console.log('Starting parse, content length:', msg.content ? msg.content.length : 0);
      
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

      console.log('Content valid, parsing...');
      const guidelines = parseGuidelinesFromText(msg.content);
      
      if (msg.aiUnderstanding) {
        guidelines.aiUnderstanding = msg.aiUnderstanding;
      }
      
      guidelines.rawContent = msg.content.substring(0, 10000);
      
      console.log('Parse complete, guidelines:', guidelines);
      
      if (!guidelines || typeof guidelines !== 'object') {
        throw new Error('Failed to parse guidelines structure');
      }

      console.log('Saving to storage...');
      await figma.clientStorage.setAsync('brand-guidelines', guidelines);
      brandGuidelines = guidelines;
      
      console.log('Parse successful!');
      figma.ui.postMessage({ 
        type: 'parse-success', 
        guidelines: guidelines
      });
    } catch (error) {
      console.error('Parse error details:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to parse guidelines: ' + (error && error.message ? error.message : 'Unknown parsing error')
      });
    }
  }

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
      let analysis;
      
      if (selection.length > 1) {
        analysis = analyzeMultipleElements(selection, brandGuidelines);
      } else {
        analysis = analyzeElement(selection[0], brandGuidelines);
      }
      
      figma.ui.postMessage({ 
        type: 'analysis-complete', 
        analysis: analysis 
      });
    } catch (error) {
      console.error('Analysis error:', error);
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Failed to analyze element: ' + error.message
      });
    }
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
    dimensions: {},
    rawContent: content.substring(0, 1000)
  };

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
    suggestions: [] 
  };
}

function analyzeElement(node, guidelines) {
  const analysis = {
    elementType: node.type,
    name: node.name,
    selectionCount: 1,
    violations: [],
    goodPractices: [],
    suggestions: []
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

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}