/**
 * HTML STRUCTURE EXTRACTOR
 * 
 * Analyzes JavaScript modules to find required DOM elements
 * and extracts corresponding HTML from monolith files
 */

const fs = require('fs');
const path = require('path');

class HTMLExtractor {
  constructor() {
    this.requiredElements = new Set();
    this.htmlContent = new Map();
    this.moduleFiles = [];
  }

  /**
   * Analyze JavaScript modules to find required DOM elements
   */
  analyzeJSModules(modulesDir) {
    console.log('🔍 Analyzing JavaScript modules for DOM requirements...');
    
    const files = this.getAllJSFiles(modulesDir);
    this.moduleFiles = files;
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      this.extractDOMRequirements(content, file);
    });
    
    console.log(`📋 Found ${this.requiredElements.size} required DOM elements:`);
    Array.from(this.requiredElements).sort().forEach(id => {
      console.log(`   - ${id}`);
    });
  }

  /**
   * Extract DOM requirements from JavaScript content
   */
  extractDOMRequirements(content, filePath) {
    // Look for getElementById calls
    const getElementMatches = content.match(/getElementById\(['"`]([^'"`]+)['"`]\)/g);
    if (getElementMatches) {
      getElementMatches.forEach(match => {
        const id = match.match(/getElementById\(['"`]([^'"`]+)['"`]\)/)[1];
        this.requiredElements.add(id);
      });
    }

    // Look for querySelector with IDs
    const querySelectorMatches = content.match(/querySelector\(['"`]#([^'"`\s]+)['"`]\)/g);
    if (querySelectorMatches) {
      querySelectorMatches.forEach(match => {
        const id = match.match(/querySelector\(['"`]#([^'"`\s]+)['"`]\)/)[1];
        this.requiredElements.add(id);
      });
    }

    // Look for class selectors that might be important
    const classMatches = content.match(/querySelector\(['"`]\.([^'"`\s]+)['"`]\)/g);
    if (classMatches) {
      classMatches.forEach(match => {
        const className = match.match(/querySelector\(['"`]\.([^'"`\s]+)['"`]\)/)[1];
        // Add classes with special prefixes that indicate they're structural
        if (['route-', 'staff-', 'asset-', 'fleet-', 'dispatch-'].some(prefix => className.startsWith(prefix))) {
          this.requiredElements.add('.' + className);
        }
      });
    }
  }

  /**
   * Search for HTML elements in monolith files
   */
  searchMonolithHTML(searchDirs) {
    console.log('\n🔍 Searching for HTML elements in monolith files...');
    
    searchDirs.forEach(dir => {
      const htmlFiles = this.getHTMLFiles(dir);
      htmlFiles.forEach(file => {
        console.log(`📄 Analyzing: ${path.relative(process.cwd(), file)}`);
        this.extractHTMLElements(file);
      });
    });
  }

  /**
   * Extract HTML elements from a file
   */
  extractHTMLElements(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    Array.from(this.requiredElements).forEach(elementId => {
      if (elementId.startsWith('.')) {
        // Class selector
        const className = elementId.substring(1);
        const classRegex = new RegExp(`<[^>]*class=[^>]*\\b${className}\\b[^>]*>.*?</[^>]+>`, 'gs');
        const matches = content.match(classRegex);
        if (matches) {
          this.htmlContent.set(elementId, {
            file: filePath,
            elements: matches
          });
        }
      } else {
        // ID selector
        const idRegex = new RegExp(`<[^>]*id=['"]\s*${elementId}\s*['"][^>]*>.*?</[^>]+>`, 'gs');
        const matches = content.match(idRegex);
        if (matches) {
          this.htmlContent.set(elementId, {
            file: filePath,
            elements: matches
          });
        }
        
        // Also look for self-closing tags
        const selfClosingRegex = new RegExp(`<[^>]*id=['"]\s*${elementId}\s*['"][^>]*/>`, 'g');
        const selfClosingMatches = content.match(selfClosingRegex);
        if (selfClosingMatches) {
          if (this.htmlContent.has(elementId)) {
            this.htmlContent.get(elementId).elements.push(...selfClosingMatches);
          } else {
            this.htmlContent.set(elementId, {
              file: filePath,
              elements: selfClosingMatches
            });
          }
        }
      }
    });
  }

  /**
   * Generate HTML structure for missing elements
   */
  generateMissingHTML() {
    console.log('\n🔧 Generating HTML for missing elements...');
    
    const missing = Array.from(this.requiredElements).filter(id => !this.htmlContent.has(id));
    
    if (missing.length === 0) {
      console.log('✅ All required elements found in existing HTML files!');
      return;
    }

    console.log(`📝 Missing elements (${missing.length}):`);
    missing.forEach(id => {
      console.log(`   - ${id}`);
      console.log(`     ${this.generateHTMLForElement(id)}`);
    });
  }

  /**
   * Generate HTML for a missing element
   */
  generateHTMLForElement(elementId) {
    if (elementId.startsWith('.')) {
      const className = elementId.substring(1);
      return `<div class="${className}"><!-- ${className} content --></div>`;
    }

    // Generate based on element ID patterns
    if (elementId.includes('container')) {
      return `<div id="${elementId}" class="space-y-2"><!-- ${elementId} content --></div>`;
    } else if (elementId.includes('list')) {
      return `<div id="${elementId}" class="space-y-1"><!-- ${elementId} items --></div>`;
    } else if (elementId.includes('modal')) {
      return `<div id="${elementId}" class="modal hidden"><!-- ${elementId} content --></div>`;
    } else if (elementId.includes('form')) {
      return `<form id="${elementId}"><!-- ${elementId} fields --></form>`;
    } else if (elementId.includes('btn') || elementId.includes('button')) {
      return `<button id="${elementId}" class="btn"><!-- ${elementId} --></button>`;
    } else if (elementId.includes('input') || elementId.includes('search')) {
      return `<input id="${elementId}" type="text" class="form-input">`;
    } else if (elementId.includes('select')) {
      return `<select id="${elementId}" class="form-select"><!-- ${elementId} options --></select>`;
    } else {
      return `<div id="${elementId}"><!-- ${elementId} content --></div>`;
    }
  }

  /**
   * Create updated HTML file
   */
  createUpdatedHTML(outputPath) {
    console.log('\n🔧 Creating updated HTML file...');
    
    // Find the best base HTML file
    const baseFile = this.findBestBaseHTML();
    if (!baseFile) {
      console.log('❌ No suitable base HTML file found');
      return;
    }

    console.log(`📄 Using base file: ${path.relative(process.cwd(), baseFile)}`);
    
    let htmlContent = fs.readFileSync(baseFile, 'utf8');
    
    // Add missing elements to the HTML
    const missing = Array.from(this.requiredElements).filter(id => !this.htmlContent.has(id));
    
    if (missing.length > 0) {
      // Find a good place to insert missing elements (before closing body tag)
      const insertionPoint = htmlContent.lastIndexOf('</body>');
      if (insertionPoint !== -1) {
        let additionalHTML = '\n    <!-- Additional elements required by modules -->\n';
        missing.forEach(id => {
          additionalHTML += `    ${this.generateHTMLForElement(id)}\n`;
        });
        additionalHTML += '\n    ';
        
        htmlContent = htmlContent.substring(0, insertionPoint) + additionalHTML + htmlContent.substring(insertionPoint);
      }
    }
    
    // Write the updated HTML
    fs.writeFileSync(outputPath, htmlContent);
    console.log(`✅ Updated HTML written to: ${outputPath}`);
  }

  /**
   * Find the best base HTML file to use
   */
  findBestBaseHTML() {
    // Prioritize files that have the most required elements
    let bestFile = null;
    let maxMatches = 0;
    
    for (const [elementId, data] of this.htmlContent) {
      const matches = Array.from(this.htmlContent.keys()).filter(id => 
        this.htmlContent.get(id).file === data.file
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestFile = data.file;
      }
    }
    
    return bestFile;
  }

  /**
   * Generate a comprehensive report
   */
  generateReport() {
    console.log('\n📊 HTML EXTRACTION REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n🔍 Analyzed ${this.moduleFiles.length} JavaScript modules`);
    console.log(`📋 Found ${this.requiredElements.size} required DOM elements`);
    console.log(`✅ Located ${this.htmlContent.size} elements in existing HTML files`);
    
    const missing = Array.from(this.requiredElements).filter(id => !this.htmlContent.has(id));
    console.log(`❌ Missing ${missing.length} elements`);
    
    console.log('\n📋 REQUIRED ELEMENTS:');
    Array.from(this.requiredElements).sort().forEach(id => {
      const status = this.htmlContent.has(id) ? '✅' : '❌';
      const source = this.htmlContent.has(id) ? 
        ` (found in ${path.basename(this.htmlContent.get(id).file)})` : ' (missing)';
      console.log(`   ${status} ${id}${source}`);
    });
    
    if (this.htmlContent.size > 0) {
      console.log('\n📄 HTML SOURCES:');
      const sources = new Set();
      for (const data of this.htmlContent.values()) {
        sources.add(data.file);
      }
      sources.forEach(file => {
        const count = Array.from(this.htmlContent.values()).filter(d => d.file === file).length;
        console.log(`   📄 ${path.relative(process.cwd(), file)} (${count} elements)`);
      });
    }
  }

  /**
   * Get all JavaScript files recursively
   */
  getAllJSFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllJSFiles(fullPath));
      } else if (item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Get all HTML files in a directory
   */
  getHTMLFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile() && item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
}

// Main execution
if (require.main === module) {
  const extractor = new HTMLExtractor();
  
  // Configuration
  const modulesDir = './src/modules';
  const searchDirs = [
    '../standalone',
    '../archive',
    '.'
  ];
  const outputFile = './index-complete.html';
  
  console.log('🚀 HTML STRUCTURE EXTRACTOR');
  console.log('='.repeat(40));
  
  // Step 1: Analyze JavaScript modules
  extractor.analyzeJSModules(modulesDir);
  
  // Step 2: Search for HTML in monolith files
  extractor.searchMonolithHTML(searchDirs);
  
  // Step 3: Generate missing HTML
  extractor.generateMissingHTML();
  
  // Step 4: Create updated HTML file
  extractor.createUpdatedHTML(outputFile);
  
  // Step 5: Generate report
  extractor.generateReport();
  
  console.log('\n✅ HTML extraction complete!');
  console.log(`📄 Check the generated file: ${outputFile}`);
}

module.exports = HTMLExtractor;
