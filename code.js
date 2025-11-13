// Brand Guidelines Checker - Figma Plugin Code
figma.showUI(__html__, { width: 450, height: 650, themeColors: true });

let brandGuidelines = null;

// CRITICAL: Base64 conversion for plugin environment
function bytesToBase64(bytes) {
  let binary = "";
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Export node to base64 JPG
async function exportNodeAsBase64(node, maxDim = 400) {
  const nodeMax = Math.max(node.width, node.height);
  let scale = 0.15;
  if (nodeMax > 2000) scale = maxDim / nodeMax;

  const bytes = await node.exportAsync({
    format: 'JPG',
    constraint: { type: 'SCALE', value: scale }
  });

  return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
}

// Helper: RGB to HEX
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

figma.ui.onmessage = async (msg) => {

  // === CHAT WITH PDF ===
  if (msg.type === 'chat-with-pdf') {
    try {
      const { messages, apiKey, pdfBase64, pdfName, endpoint } = msg;
      let cleanEndpoint = endpoint.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanEndpoint}/api/chat-with-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, apiKey, pdfBase64, pdfName })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Chat failed');
      figma.ui.postMessage({ type: 'chat-response', response: data.data });
    } catch (error) {
      figma.ui.postMessage({ type: 'chat-error', error: error.message });
    }
  }

  // === GRADE FRAME ===
  if (msg.type === 'grade-frame') {
    try {
      const { frameData, guidelinesContent, aiUnderstanding, apiKey, endpoint, pdfBase64 } = msg;
      let cleanEndpoint = endpoint.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanEndpoint}/api/compliance-grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameData, guidelinesContent, aiUnderstanding, apiKey, pdfBase64 })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Grading failed');
      figma.ui.postMessage({ type: 'grade-complete', data: data.data });
    } catch (error) {
      figma.ui.postMessage({ type: 'grade-complete', error: error.message });
    }
  }

  // === CAPTURE GRADE DATA ===
  if (msg.type === 'capture-grade-data') {
    try {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.ui.postMessage({ type: 'error', message: 'Please select a frame to grade' });
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

      // Extract colors recursively
      function extractColors(element) {
        const colors = [];
        if ('fills' in element && element.fills !== figma.mixed) {
          const solidFills = element.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
          solidFills.forEach(fill => {
            const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
            if (!colors.some(c => c.hex === hex)) colors.push({ hex, name: 'Color' });
          });
        }
        if ('children' in element) {
          element.children.forEach(child => colors.push(...extractColors(child)));
        }
        return colors;
      }

      // Extract fonts recursively
      function extractFonts(element) {
        const fonts = [];
        if (element.type === 'TEXT' && element.fontName !== figma.mixed) {
          const fontFamily = element.fontName.family;
          if (!fonts.includes(fontFamily)) fonts.push(fontFamily);
        }
        if ('children' in element) element.children.forEach(child => fonts.push(...extractFonts(child)));
        return fonts;
      }

      // Extract text recursively
      function extractText(element) {
        const texts = [];
        if (element.type === 'TEXT') {
          texts.push({
            content: element.characters,
            fontSize: element.fontSize,
            fontFamily: element.fontName === figma.mixed ? 'Mixed' : element.fontName.family
          });
        }
        if ('children' in element) element.children.forEach(child => texts.push(...extractText(child)));
        return texts;
      }

      gradeData.colors = extractColors(node);
      gradeData.fonts = extractFonts(node);
      gradeData.textContent = extractText(node);

      // Capture screenshot
      try {
        gradeData.screenshot = await exportNodeAsBase64(node);
      } catch (e) {
        console.error('Screenshot error:', e);
      }

      gradeData.properties = { x: node.x, y: node.y, width: node.width, height: node.height };
      figma.ui.postMessage({ type: 'grade-data-captured', frameData: gradeData });

    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: 'Failed to capture: ' + error.message });
    }
  }

  // === ANALYZE SELECTION ===
  if (msg.type === 'analyze-selection') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Please select frames to analyze' });
      return;
    }
    if (!brandGuidelines) brandGuidelines = await figma.clientStorage.getAsync('brand-guidelines');
    if (!brandGuidelines) {
      figma.ui.postMessage({ type: 'error', message: 'Please upload brand guidelines first' });
      return;
    }

    try {
      const frameImages = [];
      const framesToAnalyze = selection.slice(0, 3);
      for (const node of framesToAnalyze) {
        try {
          const base64 = await exportNodeAsBase64(node);
          frameImages.push({ name: node.name, type: node.type, base64, width: node.width, height: node.height });
        } catch (error) {
          console.error('Export error for', node.name, error);
        }
      }
      figma.ui.postMessage({ type: 'analysis-ready-for-ai', frameImages, guidelines: brandGuidelines, selectionCount: selection.length });
    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: 'Failed to analyze: ' + error.message });
    }
  }

  // === STORAGE ===
  if (msg.type === 'save-api-key') await figma.clientStorage.setAsync('anthropic-api-key', msg.apiKey);
  if (msg.type === 'save-api-endpoint') await figma.clientStorage.setAsync('api-endpoint', msg.endpoint);
  if (msg.type === 'load-api-key') figma.ui.postMessage({ type: 'api-key-loaded', apiKey: await figma.clientStorage.getAsync('anthropic-api-key') });
  if (msg.type === 'load-api-endpoint') figma.ui.postMessage({ type: 'api-endpoint-loaded', endpoint: await figma.clientStorage.getAsync('api-endpoint') });

  if (msg.type === 'parse-guidelines') {
    try {
      const guidelines = parseGuidelinesFromText(msg.content);
      if (msg.aiUnderstanding) guidelines.aiUnderstanding = msg.aiUnderstanding;
      guidelines.rawContent = msg.content.substring(0, 10000);
      await figma.clientStorage.setAsync('brand-guidelines', guidelines);
      brandGuidelines = guidelines;
      figma.ui.postMessage({ type: 'parse-success', guidelines });
    } catch (error) {
      figma.ui.postMessage({ type: 'error', message: 'Failed to parse: ' + error.message });
    }
  }

  if (msg.type === 'load-guidelines') {
    brandGuidelines = await figma.clientStorage.getAsync('brand-guidelines') || null;
    figma.ui.postMessage({ type: 'guidelines-loaded', guidelines: brandGuidelines });
  }

  if (msg.type === 'close') figma.closePlugin();
};

// === GUIDELINES PARSER ===
function parseGuidelinesFromText(content) {
  const guidelines = { colors: [], typography: { fonts: [], sizes: [] }, spacing: { unit: 'px', scale: [] }, rawContent: content.substring(0, 1000) };
  const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  const hexMatches = content.match(hexRegex);
  if (hexMatches) [...new Set(hexMatches)].forEach(hex => guidelines.colors.push({ name: 'Color', hex: hex.toUpperCase(), source: 'text' }));
  if (!guidelines.colors.length) guidelines.colors.push({ name: 'Primary', hex: '#667EEA', source: 'default' });
  if (!guidelines.typography.fonts.length) guidelines.typography.fonts.push({ family: 'Inter' });
  if (!guidelines.spacing.scale.length) guidelines.spacing.scale = [4,8,12,16,24,32,48,64];
  return guidelines;
}
