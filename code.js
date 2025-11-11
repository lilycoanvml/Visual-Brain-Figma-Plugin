// Brand Guidelines Checker - Figma Plugin Code
figma.showUI(__html__, { width: 450, height: 650 });

let brandGuidelines = null;

figma.ui.onmessage = async (msg) => {
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
      console.log('Extracted colors:', msg.extractedColors ? msg.extractedColors.length : 0);
      console.log('AI Understanding:', msg.aiUnderstanding ? 'Yes' : 'No');
      
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
      const guidelines = parseGuidelinesFromText(msg.content, msg.extractedColors || []);
      
      // Add AI understanding if available
      if (msg.aiUnderstanding) {
        guidelines.aiUnderstanding = msg.aiUnderstanding;
      }
      
      // Add intelligent analysis of the guidelines document itself
      guidelines.documentAnalysis = analyzeGuidelinesDocument(msg.content, guidelines);
      
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
      console.error('Error stack:', error.stack);
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
      
      // Multi-selection analysis
      if (selection.length > 1) {
        analysis = await analyzeMultipleElements(selection, brandGuidelines);
      } else {
        analysis = await analyzeElement(selection[0], brandGuidelines);
      }
      
      // Add intelligent insights
      analysis.insights = generateIntelligentInsights(analysis, brandGuidelines);
      
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

function analyzeGuidelinesDocument(content, guidelines) {
  const analysis = {
    completeness: 0,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    score: 0
  };

  let completenessScore = 0;
  let maxScore = 100;

  // Check for color palette definition
  if (guidelines.colors.length > 0) {
    completenessScore += 20;
    if (guidelines.colors.length >= 5) {
      analysis.strengths.push('Comprehensive color palette with ' + guidelines.colors.length + ' defined colors');
      completenessScore += 5;
    } else {
      analysis.weaknesses.push('Limited color palette - consider defining primary, secondary, and accent colors');
    }
  } else {
    analysis.weaknesses.push('No colors defined in guidelines');
    analysis.recommendations.push('Add specific brand color definitions with hex codes');
  }

  // Check for typography guidelines
  if (guidelines.typography.fonts.length > 0) {
    completenessScore += 20;
    if (guidelines.typography.fonts.length >= 2) {
      analysis.strengths.push('Multiple font families defined for hierarchy');
      completenessScore += 5;
    }
    if (guidelines.typography.sizes.length >= 5) {
      analysis.strengths.push('Well-defined type scale with ' + guidelines.typography.sizes.length + ' sizes');
      completenessScore += 5;
    } else if (guidelines.typography.sizes.length > 0) {
      analysis.weaknesses.push('Type scale needs more sizes for proper hierarchy');
      analysis.recommendations.push('Define a complete type scale (e.g., 12, 14, 16, 20, 24, 32, 48px)');
    }
  } else {
    analysis.weaknesses.push('No typography guidelines found');
    analysis.recommendations.push('Specify primary and secondary font families');
  }

  // Check for spacing system
  if (guidelines.spacing.scale.length > 5) {
    completenessScore += 15;
    analysis.strengths.push('Consistent spacing system with ' + guidelines.spacing.scale.length + ' values');
    completenessScore += 5;
  } else if (guidelines.spacing.scale.length > 0) {
    completenessScore += 10;
    analysis.weaknesses.push('Spacing system could be more comprehensive');
    analysis.recommendations.push('Define a complete spacing scale (4, 8, 12, 16, 24, 32, 48, 64px)');
  }

  // Check for accessibility guidelines
  const hasAccessibility = /accessibility|wcag|contrast|aria/gi.test(content);
  if (hasAccessibility) {
    completenessScore += 15;
    analysis.strengths.push('Includes accessibility considerations');
  } else {
    analysis.weaknesses.push('No accessibility guidelines mentioned');
    analysis.recommendations.push('Add WCAG 2.1 AA contrast ratio requirements (4.5:1 for normal text)');
  }

  // Check for dimension/sizing guidelines
  if (guidelines.dimensions.minWidth || guidelines.dimensions.minHeight) {
    completenessScore += 10;
    analysis.strengths.push('Touch target and minimum size guidelines defined');
  } else {
    analysis.weaknesses.push('No minimum dimension guidelines');
    analysis.recommendations.push('Define minimum touch targets (44x44px for mobile)');
  }

  // Check for logo/branding guidelines
  const hasLogo = /logo|brand mark|trademark/gi.test(content);
  if (hasLogo) {
    completenessScore += 10;
    analysis.strengths.push('Logo usage guidelines included');
  } else {
    analysis.recommendations.push('Consider adding logo usage and clear space requirements');
  }

  // Check for usage examples
  const hasExamples = /example|sample|usage|do not|avoid/gi.test(content);
  if (hasExamples) {
    completenessScore += 10;
    analysis.strengths.push('Includes usage examples and best practices');
  } else {
    analysis.recommendations.push('Add visual examples of correct and incorrect usage');
  }

  // Check for responsive/breakpoint guidelines
  const hasResponsive = /responsive|mobile|tablet|desktop|breakpoint/gi.test(content);
  if (hasResponsive) {
    completenessScore += 10;
    analysis.strengths.push('Responsive design considerations documented');
  } else {
    analysis.recommendations.push('Add responsive design breakpoints and guidelines');
  }

  analysis.completeness = Math.min(completenessScore, maxScore);
  analysis.score = Math.round((completenessScore / maxScore) * 100);

  return analysis;
}

function generateIntelligentInsights(analysis, guidelines) {
  const insights = {
    overall: '',
    colorConsistency: '',
    typographyConsistency: '',
    designSystem: '',
    brandAlignment: '',
    improvements: [],
    bestPractices: []
  };

  const violationCount = analysis.violations.length;
  const goodCount = analysis.goodPractices.length;
  const totalChecks = violationCount + goodCount;
  const complianceRate = totalChecks > 0 ? Math.round((goodCount / totalChecks) * 100) : 0;

  // AI-Enhanced Overall Assessment
  if (guidelines.aiUnderstanding) {
    const ai = guidelines.aiUnderstanding;
    
    if (complianceRate >= 90) {
      insights.overall = 'Excellent! This design closely follows brand guidelines with ' + complianceRate + '% compliance. The design effectively embodies the brand\'s ' + (ai.brandPersonality || 'intended') + ' personality.';
    } else if (complianceRate >= 70) {
      insights.overall = 'Good adherence to brand guidelines (' + complianceRate + '% compliance). The design captures some aspects of the ' + (ai.brandPersonality || 'brand') + ' feel, but has room for improvement.';
    } else if (complianceRate >= 50) {
      insights.overall = 'Moderate compliance (' + complianceRate + '%). The design doesn\'t fully align with the brand\'s ' + (ai.visualStyle || 'intended visual style') + '. Significant adjustments needed.';
    } else {
      insights.overall = 'Low compliance (' + complianceRate + '%). This design significantly deviates from the brand essence: "' + (ai.brandEssence || 'brand guidelines') + '". Major revision required.';
    }
    
    // Brand Alignment Assessment
    if (ai.brandPersonality && ai.visualStyle) {
      insights.brandAlignment = 'Target brand feel: ' + ai.brandPersonality + '. Visual direction should reflect: ' + ai.visualStyle;
      
      if (complianceRate < 70) {
        insights.improvements.push('Realign design to match brand personality: ' + ai.brandPersonality);
      }
    }
    
    if (ai.targetAudience) {
      insights.bestPractices.push('Remember: This brand targets ' + ai.targetAudience);
    }
  } else {
    // Standard assessment without AI
    if (complianceRate >= 90) {
      insights.overall = 'Excellent! This design closely follows brand guidelines with ' + complianceRate + '% compliance.';
    } else if (complianceRate >= 70) {
      insights.overall = 'Good adherence to brand guidelines (' + complianceRate + '% compliance), with some areas for improvement.';
    } else if (complianceRate >= 50) {
      insights.overall = 'Moderate compliance (' + complianceRate + '%). Several elements need adjustment to match brand guidelines.';
    } else {
      insights.overall = 'Low compliance (' + complianceRate + '%). This design needs significant revision to align with brand standards.';
    }
  }

  // Color analysis with AI context
  const colorViolations = analysis.violations.filter(v => v.type === 'color');
  const ai = guidelines.aiUnderstanding;
  
  if (colorViolations.length === 0) {
    insights.colorConsistency = 'All colors match the brand palette. Great work maintaining color consistency!';
    if (ai && ai.colorPsychology) {
      insights.colorConsistency += ' The colors effectively support the brand message: ' + ai.colorPsychology.substring(0, 100) + '...';
    }
    insights.bestPractices.push('Consistent use of brand colors throughout the design');
  } else if (colorViolations.length <= 2) {
    insights.colorConsistency = 'Mostly consistent color usage with ' + colorViolations.length + ' off-brand color(s) detected.';
    if (ai && ai.colorPsychology) {
      insights.improvements.push('Remember the brand color purpose: ' + ai.colorPsychology.substring(0, 120));
    }
    insights.improvements.push('Replace off-brand colors with approved palette colors for better consistency');
  } else {
    insights.colorConsistency = 'Multiple off-brand colors detected (' + colorViolations.length + '). This undermines brand recognition.';
    if (ai && ai.colorPsychology) {
      insights.improvements.push('PRIORITY: Brand colors should convey: ' + ai.colorPsychology.substring(0, 100));
    }
    insights.improvements.push('PRIORITY: Audit all colors and replace with brand palette colors');
    insights.improvements.push('Create color styles in Figma to prevent future inconsistencies');
  }

  // Typography analysis with AI context
  const typoViolations = analysis.violations.filter(v => v.type === 'typography');
  if (typoViolations.length === 0) {
    insights.typographyConsistency = 'Typography follows brand guidelines perfectly. Font choices and sizes are on-brand.';
    if (ai && ai.typographyCharacter) {
      insights.typographyConsistency += ' The typography successfully conveys: ' + ai.typographyCharacter.substring(0, 100) + '...';
    }
    insights.bestPractices.push('Correct use of brand typography creates professional, cohesive design');
  } else {
    const highSeverityTypo = typoViolations.filter(v => v.severity === 'high');
    if (highSeverityTypo.length > 0) {
      insights.typographyConsistency = 'Critical typography issues: using non-brand fonts undermines brand identity.';
      if (ai && ai.typographyCharacter) {
        insights.improvements.push('URGENT: Typography should feel: ' + ai.typographyCharacter);
      }
      insights.improvements.push('URGENT: Replace all non-brand fonts with approved typefaces');
    } else {
      insights.typographyConsistency = 'Typography needs refinement. Font sizes should match the defined type scale.';
      insights.improvements.push('Adjust font sizes to match brand type scale for better hierarchy');
    }
  }

  // Design system maturity
  if (analysis.selectionCount && analysis.selectionCount > 1) {
    const hasMultipleColors = analysis.violations.filter(v => v.message.includes('different colors')).length > 0;
    const hasMultipleFonts = analysis.violations.filter(v => v.message.includes('different fonts')).length > 0;
    
    if (!hasMultipleColors && !hasMultipleFonts) {
      insights.designSystem = 'This section demonstrates strong design system principles with consistent styling.';
      insights.bestPractices.push('Section shows excellent use of design tokens and consistent styling');
    } else {
      insights.designSystem = 'Inconsistent styling within this section suggests gaps in design system implementation.';
      insights.improvements.push('Consider creating component variants to ensure consistency');
      insights.improvements.push('Document design patterns for this section type');
    }
  }

  // Spacing insights
  const spacingViolations = analysis.violations.filter(v => v.type === 'spacing');
  if (spacingViolations.length > 0) {
    insights.improvements.push('Use spacing tokens from the brand scale for better visual rhythm');
  }

  // Dimension insights
  const dimensionViolations = analysis.violations.filter(v => v.type === 'dimensions');
  if (dimensionViolations.length > 0) {
    insights.improvements.push('Ensure interactive elements meet minimum size requirements for accessibility');
    insights.bestPractices.push('Note: WCAG 2.1 requires 44x44px minimum for touch targets');
  }

  // Naming conventions
  if (analysis.suggestions.some(s => s.includes('descriptive name'))) {
    insights.improvements.push('Use descriptive layer names for better team collaboration and handoff');
  }

  // Add contextual recommendations based on element type
  if (analysis.elementType === 'TEXT') {
    insights.bestPractices.push('Pro tip: Create text styles in Figma to maintain consistency across designs');
  } else if (analysis.elementType === 'FRAME') {
    insights.bestPractices.push('Pro tip: Use auto-layout with spacing tokens for responsive designs');
  }
  
  // Add imagery guidance if available
  if (ai && ai.imageryStyle && (analysis.elementType === 'FRAME' || analysis.elementType === 'RECTANGLE')) {
    insights.bestPractices.push('Imagery guidance: ' + ai.imageryStyle.substring(0, 150));
  }

  return insights;
}

function parseGuidelinesFromText(content, extractedColors) {
  try {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content type');
    }

    console.log('Creating guidelines object...');
    const guidelines = {
      colors: [],
      typography: {
        fonts: [],
        sizes: []
      },
      spacing: {
        unit: 'px',
        scale: []
      },
      dimensions: {},
      rawContent: content.substring(0, 1000)
    };

    console.log('Parsing colors from text...');
    // Parse hex colors from text
    try {
      const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
      const hexMatches = content.match(hexRegex);
      if (hexMatches && Array.isArray(hexMatches)) {
        const uniqueColors = [...new Set(hexMatches)];
        uniqueColors.forEach(hex => {
          try {
            const escaped = hex.replace('#', '\\#');
            const colorRegex = new RegExp('([\\w\\s-]{1,30}).*?' + escaped, 'i');
            const match = content.match(colorRegex);
            const name = match && match[1] ? match[1].trim() : 'Color';
            
            guidelines.colors.push({
              name: name,
              hex: hex.toUpperCase(),
              source: 'text'
            });
          } catch (e) {
            console.error('Error parsing hex color:', e);
            guidelines.colors.push({
              name: 'Color',
              hex: hex.toUpperCase(),
              source: 'text'
            });
          }
        });
      }
    } catch (e) {
      console.error('Error in hex parsing:', e);
    }

    // Add extracted colors from PDF images
    if (extractedColors && Array.isArray(extractedColors) && extractedColors.length > 0) {
      console.log('Adding extracted colors from PDF:', extractedColors.length);
      extractedColors.forEach(hex => {
        if (!guidelines.colors.some(c => c.hex === hex.toUpperCase())) {
          guidelines.colors.push({
            name: 'Extracted Color',
            hex: hex.toUpperCase(),
            source: 'pdf-image'
          });
        }
      });
    }

    console.log('Parsing RGB colors...');
    // Parse RGB colors
    try {
      const rgbRegex = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
      const rgbMatches = [...content.matchAll(rgbRegex)];
      for (const match of rgbMatches) {
        try {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          const hex = rgbToHex(r / 255, g / 255, b / 255);
          
          if (!guidelines.colors.some(c => c.hex === hex)) {
            guidelines.colors.push({
              name: 'RGB(' + r + ',' + g + ',' + b + ')',
              hex: hex,
              source: 'text'
            });
          }
        } catch (e) {
          console.error('Error parsing RGB value:', e);
        }
      }
    } catch (e) {
      console.error('Error in RGB parsing:', e);
    }

    console.log('Parsing fonts...');
    // Parse fonts
    try {
      const commonFonts = [
        'Inter', 'Helvetica', 'Arial', 'Roboto', 'Open Sans', 'Lato',
        'Montserrat', 'Poppins', 'Raleway', 'Ubuntu', 'Nunito', 'Playfair',
        'Georgia', 'Times New Roman', 'Courier', 'Verdana', 'Tahoma',
        'Source Sans', 'Work Sans', 'DM Sans', 'Plus Jakarta', 'Manrope',
        'Proxima Nova', 'Avenir', 'Futura', 'Gotham', 'Circular'
      ];
      
      commonFonts.forEach(font => {
        try {
          const fontRegex = new RegExp('\\b' + font.replace(/\s+/g, '\\s+') + '\\b', 'gi');
          if (fontRegex.test(content)) {
            guidelines.typography.fonts.push({ family: font });
          }
        } catch (e) {
          console.error('Error testing font:', font, e);
        }
      });
    } catch (e) {
      console.error('Error in font parsing:', e);
    }

    console.log('Parsing font sizes...');
    // Parse font sizes
    try {
      const sizeRegex = /(\d+)\s*(px|pt|rem|em)/gi;
      const sizeMatches = [...content.matchAll(sizeRegex)];
      const sizes = new Set();
      
      for (const match of sizeMatches) {
        try {
          let size = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          
          if (unit === 'pt') {
            size = Math.round(size * 1.333);
          } else if (unit === 'rem' || unit === 'em') {
            size = size * 16;
          }
          
          if (size >= 8 && size <= 96) {
            sizes.add(size);
          }
        } catch (e) {
          console.error('Error parsing size value:', e);
        }
      }
      
      guidelines.typography.sizes = Array.from(sizes).sort((a, b) => a - b);
    } catch (e) {
      console.error('Error in size parsing:', e);
    }

    console.log('Parsing spacing...');
    // Parse spacing values
    try {
      const spacingRegex = /spacing[:\s]+(\d+(?:\s*,\s*\d+)*)/gi;
      const spacingMatch = content.match(spacingRegex);
      
      if (spacingMatch && spacingMatch[0]) {
        const numbers = spacingMatch[0].match(/\d+/g);
        if (numbers && Array.isArray(numbers)) {
          guidelines.spacing.scale = numbers.map(n => parseInt(n)).sort((a, b) => a - b);
        }
      }
      
      // Also look for margin/padding values
      const marginPaddingRegex = /(?:margin|padding)[:\s]+(\d+)(?:px)?/gi;
      const mpMatches = [...content.matchAll(marginPaddingRegex)];
      const spacingValues = new Set(guidelines.spacing.scale);
      
      mpMatches.forEach(match => {
        try {
          const val = parseInt(match[1]);
          if (val >= 4 && val <= 64) {
            spacingValues.add(val);
          }
        } catch (e) {
          console.error('Error parsing spacing value:', e);
        }
      });
      
      if (spacingValues.size === 0) {
        guidelines.spacing.scale = [4, 8, 12, 16, 24, 32, 48, 64];
      } else {
        guidelines.spacing.scale = Array.from(spacingValues).sort((a, b) => a - b);
      }
    } catch (e) {
      console.error('Error in spacing parsing:', e);
      guidelines.spacing.scale = [4, 8, 12, 16, 24, 32, 48, 64];
    }

    console.log('Parsing dimensions...');
    // Parse minimum dimensions
    try {
      const minWidthRegex = /min(?:imum)?\s*width[:\s]+(\d+)/gi;
      const minHeightRegex = /min(?:imum)?\s*height[:\s]+(\d+)/gi;
      
      const widthMatch = content.match(minWidthRegex);
      const heightMatch = content.match(minHeightRegex);
      
      if (widthMatch && widthMatch[0]) {
        const width = widthMatch[0].match(/\d+/);
        if (width && width[0]) {
          guidelines.dimensions.minWidth = parseInt(width[0]);
        }
      }
      
      if (heightMatch && heightMatch[0]) {
        const height = heightMatch[0].match(/\d+/);
        if (height && height[0]) {
          guidelines.dimensions.minHeight = parseInt(height[0]);
        }
      }
    } catch (e) {
      console.error('Error in dimensions parsing:', e);
    }

    console.log('Setting defaults...');
    // Set defaults if nothing found
    if (guidelines.colors.length === 0) {
      guidelines.colors.push({ 
        name: 'Primary', 
        hex: '#667EEA',
        source: 'default',
        note: 'Default - no colors found in document'
      });
    }
    
    if (guidelines.typography.fonts.length === 0) {
      guidelines.typography.fonts.push({ 
        family: 'Inter',
        note: 'Default - no fonts found in document'
      });
    }

    console.log('Parse complete, total colors:', guidelines.colors.length);
    return guidelines;
    
  } catch (error) {
    console.error('Fatal parsing error:', error);
    console.error('Error stack:', error.stack);
    throw new Error('Error parsing guidelines: ' + error.message);
  }
}

async function analyzeMultipleElements(nodes, guidelines) {
  const analysis = {
    elementType: 'Multiple Elements',
    name: 'Section Analysis',
    selectionCount: nodes.length,
    violations: [],
    goodPractices: [],
    suggestions: []
  };

  // Aggregate data from all selected nodes
  const colorMap = new Map();
  const fontMap = new Map();
  const sizeMap = new Map();
  
  for (const node of nodes) {
    await analyzeNodeRecursive(node, guidelines, colorMap, fontMap, sizeMap, analysis);
  }

  // Summarize findings
  const uniqueColors = colorMap.size;
  const uniqueFonts = fontMap.size;
  const uniqueSizes = sizeMap.size;

  if (uniqueColors > 5) {
    analysis.violations.push({
      type: 'color',
      message: 'Using ' + uniqueColors + ' different colors in this section - consider consolidating',
      severity: 'medium'
    });
  } else if (uniqueColors > 0) {
    analysis.goodPractices.push('✓ Using ' + uniqueColors + ' colors in this section - good color restraint');
  }

  if (uniqueFonts > 3) {
    analysis.violations.push({
      type: 'typography',
      message: 'Using ' + uniqueFonts + ' different fonts - brand guidelines recommend fewer font families',
      severity: 'high'
    });
  } else if (uniqueFonts > 0 && uniqueFonts <= 2) {
    analysis.goodPractices.push('✓ Excellent font discipline - using only ' + uniqueFonts + ' font families');
  }

  if (uniqueSizes > 8) {
    analysis.suggestions.push('Consider using fewer font sizes (' + uniqueSizes + ' detected) for better visual hierarchy');
  } else if (uniqueSizes >= 4 && uniqueSizes <= 7) {
    analysis.goodPractices.push('✓ Well-balanced type scale with ' + uniqueSizes + ' font sizes');
  }

  // Check color compliance
  colorMap.forEach((count, hexColor) => {
    const matchesBrand = guidelines.colors.some(bc => 
      bc.hex && bc.hex.toUpperCase() === hexColor.toUpperCase()
    );
    
    if (!matchesBrand) {
      analysis.violations.push({
        type: 'color',
        message: 'Color ' + hexColor + ' used ' + count + ' times is not in brand palette',
        severity: 'low'
      });
    }
  });

  if (analysis.violations.length === 0) {
    analysis.goodPractices.push('🎉 This section follows all brand guidelines perfectly!');
  }

  return analysis;
}

async function analyzeNodeRecursive(node, guidelines, colorMap, fontMap, sizeMap, analysis) {
  // Extract properties from current node
  if ('fills' in node && node.fills !== figma.mixed) {
    const solidFills = node.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
    solidFills.forEach(fill => {
      const hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
      colorMap.set(hexColor, (colorMap.get(hexColor) || 0) + 1);
    });
  }

  if (node.type === 'TEXT') {
    const fontName = node.fontName;
    const fontSize = node.fontSize;
    
    if (fontName !== figma.mixed) {
      fontMap.set(fontName.family, (fontMap.get(fontName.family) || 0) + 1);
    }
    
    if (fontSize !== figma.mixed) {
      sizeMap.set(fontSize, (sizeMap.get(fontSize) || 0) + 1);
    }
  }

  // Recursively analyze children
  if ('children' in node) {
    for (const child of node.children) {
      await analyzeNodeRecursive(child, guidelines, colorMap, fontMap, sizeMap, analysis);
    }
  }
}

async function analyzeElement(node, guidelines) {
  const analysis = {
    elementType: node.type,
    name: node.name,
    selectionCount: 1,
    violations: [],
    goodPractices: [],
    suggestions: []
  };

  const properties = extractProperties(node);

  if (guidelines.colors && properties.fills) {
    checkColors(properties.fills, guidelines.colors, analysis);
  }

  if (guidelines.colors && properties.strokes) {
    checkStrokeColors(properties.strokes, guidelines.colors, analysis);
  }

  if (guidelines.typography && node.type === 'TEXT') {
    await checkTypography(node, guidelines.typography, analysis);
  }

  if (guidelines.spacing && properties.spacing) {
    checkSpacing(properties.spacing, guidelines.spacing, analysis);
  }

  if (guidelines.dimensions) {
    checkDimensions(node, guidelines.dimensions, analysis);
  }

  addGeneralRecommendations(node, analysis);

  return analysis;
}

function extractProperties(node) {
  const properties = {};

  if ('fills' in node && node.fills !== figma.mixed) {
    properties.fills = node.fills;
  }

  if ('strokes' in node && node.strokes !== figma.mixed) {
    properties.strokes = node.strokes;
  }

  if ('cornerRadius' in node) {
    properties.cornerRadius = node.cornerRadius;
  }

  if ('opacity' in node) {
    properties.opacity = node.opacity;
  }

  if ('itemSpacing' in node) {
    properties.spacing = node.itemSpacing;
  }

  if ('paddingLeft' in node) {
    properties.padding = {
      left: node.paddingLeft,
      right: node.paddingRight,
      top: node.paddingTop,
      bottom: node.paddingBottom
    };
  }

  return properties;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16).toUpperCase();
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function checkColors(fills, brandColors, analysis) {
  const solidFills = fills.filter(f => f.type === 'SOLID' && f.visible !== false);
  
  solidFills.forEach(fill => {
    const hexColor = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
    const matchesBrand = brandColors.some(bc => 
      bc.hex && bc.hex.toUpperCase() === hexColor.toUpperCase()
    );

    if (!matchesBrand && brandColors.length > 0) {
      analysis.violations.push({
        type: 'color',
        message: 'Fill color ' + hexColor + ' is not in brand palette',
        severity: 'medium'
      });
      
      const suggestions = brandColors.slice(0, 3).map(c => c.name + ' (' + c.hex + ')').join(', ');
      analysis.suggestions.push('Consider using approved brand colors: ' + suggestions);
    } else if (matchesBrand) {
      const matchedColor = brandColors.find(bc => bc.hex.toUpperCase() === hexColor.toUpperCase());
      analysis.goodPractices.push('✓ Using brand fill color: ' + matchedColor.name + ' (' + hexColor + ')');
    }
  });
}

function checkStrokeColors(strokes, brandColors, analysis) {
  const solidStrokes = strokes.filter(s => s.type === 'SOLID' && s.visible !== false);
  
  solidStrokes.forEach(stroke => {
    const hexColor = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
    const matchesBrand = brandColors.some(bc => 
      bc.hex && bc.hex.toUpperCase() === hexColor.toUpperCase()
    );

    if (!matchesBrand && brandColors.length > 0) {
      analysis.violations.push({
        type: 'color',
        message: 'Stroke color ' + hexColor + ' is not in brand palette',
        severity: 'low'
      });
    } else if (matchesBrand) {
      const matchedColor = brandColors.find(bc => bc.hex.toUpperCase() === hexColor.toUpperCase());
      analysis.goodPractices.push('✓ Using brand stroke color: ' + matchedColor.name);
    }
  });
}

async function checkTypography(node, typography, analysis) {
  const fontSize = node.fontSize;
  const fontName = node.fontName;

  if (fontName === figma.mixed) {
    analysis.violations.push({
      type: 'typography',
      message: 'Text has mixed font families',
      severity: 'medium'
    });
    return;
  }

  if (typography.fonts && typography.fonts.length > 0) {
    const matchesFont = typography.fonts.some(f => 
      f.family && fontName.family.toLowerCase().includes(f.family.toLowerCase())
    );

    if (!matchesFont) {
      analysis.violations.push({
        type: 'typography',
        message: 'Font "' + fontName.family + '" is not a brand font',
        severity: 'high'
      });
      analysis.suggestions.push(
        'Use brand fonts: ' + typography.fonts.map(f => f.family).join(', ')
      );
    } else {
      analysis.goodPractices.push('✓ Using brand font: ' + fontName.family);
    }
  }

  if (fontSize !== figma.mixed && typography.sizes && typography.sizes.length > 0) {
    const matchesSize = typography.sizes.some(s => Math.abs(s - fontSize) < 1);
    
    if (!matchesSize) {
      analysis.violations.push({
        type: 'typography',
        message: 'Font size ' + fontSize + 'px is not in the type scale',
        severity: 'low'
      });
      
      const closest = typography.sizes.reduce((prev, curr) => 
        Math.abs(curr - fontSize) < Math.abs(prev - fontSize) ? curr : prev
      );
      analysis.suggestions.push('Closest approved size: ' + closest + 'px');
    } else {
      analysis.goodPractices.push('✓ Using approved font size: ' + fontSize + 'px');
    }
  }
}

function checkSpacing(spacing, brandSpacing, analysis) {
  if (brandSpacing.scale && brandSpacing.scale.length > 0) {
    const matchesScale = brandSpacing.scale.some(s => Math.abs(s - spacing) < 1);

    if (!matchesScale && spacing > 0) {
      analysis.violations.push({
        type: 'spacing',
        message: 'Spacing value ' + Math.round(spacing) + 'px doesn\'t match brand scale',
        severity: 'low'
      });
      
      const closest = brandSpacing.scale.reduce((prev, curr) => 
        Math.abs(curr - spacing) < Math.abs(prev - spacing) ? curr : prev
      );
      analysis.suggestions.push('Closest spacing value: ' + closest + 'px');
    } else if (matchesScale) {
      analysis.goodPractices.push('✓ Using brand spacing: ' + Math.round(spacing) + 'px');
    }
  }
}

function checkDimensions(node, dimensions, analysis) {
  if ('width' in node && 'height' in node) {
    if (dimensions.minWidth && node.width < dimensions.minWidth) {
      analysis.violations.push({
        type: 'dimensions',
        message: 'Width ' + Math.round(node.width) + 'px is below minimum ' + dimensions.minWidth + 'px',
        severity: 'medium'
      });
      analysis.suggestions.push('Increase width to at least ' + dimensions.minWidth + 'px for proper touch targets');
    }

    if (dimensions.minHeight && node.height < dimensions.minHeight) {
      analysis.violations.push({
        type: 'dimensions',
        message: 'Height ' + Math.round(node.height) + 'px is below minimum ' + dimensions.minHeight + 'px',
        severity: 'medium'
      });
      analysis.suggestions.push('Increase height to at least ' + dimensions.minHeight + 'px for proper touch targets');
    }

    if (dimensions.minWidth && dimensions.minHeight && 
        node.width >= dimensions.minWidth && node.height >= dimensions.minHeight) {
      analysis.goodPractices.push('✓ Dimensions meet minimum requirements');
    }
  }
}

function addGeneralRecommendations(node, analysis) {
  const defaultNames = ['rectangle', 'frame', 'group', 'ellipse', 'line', 'text'];
  const hasDefaultName = defaultNames.some(name => 
    node.name.toLowerCase().includes(name) && node.name.match(/\d+$/)
  );
  
  if (hasDefaultName) {
    analysis.suggestions.push('Give this element a descriptive name for better organization');
  }

  if ('opacity' in node && node.opacity < 1 && node.opacity > 0.9) {
    analysis.suggestions.push('Opacity ' + Math.round(node.opacity * 100) + '% is very close to 100% - consider full opacity');
  }

  if (analysis.violations.length === 0 && analysis.goodPractices.length > 0) {
    analysis.goodPractices.push('🎉 This element follows all brand guidelines!');
  }
}