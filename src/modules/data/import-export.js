/**
 * DATA IMPORT/EXPORT MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive data import/export system for:
 * - CSV file import with validation
 * - Data export in multiple formats
 * - Bulk data operations
 * - Template generation
 * - Data backup and restore
 * - Import validation and error handling
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class DataImportExport {
  constructor() {
    this.supportedFormats = ['csv', 'json', 'excel'];
    this.importHistory = [];
    this.exportHistory = [];
    this.templates = new Map();
    this.validationRules = new Map();
    
    this.init();
  }

  /**
   * Initialize import/export system
   */
  init() {
    this.setupEventListeners();
    this.setupImportExport();
    this.loadTemplates();
    this.setupValidationRules();
    
    console.log('📊 Data Import/Export initialized');
    eventBus.emit('import-export-ready');
  }

  /**
   * Setup import/export functionality
   */
  setupImportExport() {
    // Setup file input handlers
    this.setupFileHandlers();
    
    // Setup drag and drop
    this.setupDragAndDrop();
    
    // Setup export buttons
    this.setupExportButtons();
    
    console.log('📊 Import/Export setup complete');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for import/export requests
    eventBus.on('import-data', (data) => this.handleImportRequest(data));
    eventBus.on('export-data', (data) => this.handleExportRequest(data));
    eventBus.on('generate-template', (data) => this.generateTemplate(data));
    
    // Listen for UI requests
    eventBus.on('open-import-modal', () => this.openImportModal());
    eventBus.on('open-export-modal', () => this.openExportModal());
    
    // Listen for data validation requests
    eventBus.on('validate-import-data', (data) => this.validateImportData(data));
  }

  // ===== FILE IMPORT =====

  /**
   * Handle file import
   */
  async handleFileImport(file, options = {}) {
    console.log('📊 Importing file:', file.name);
    
    if (!file) {
      uiSystem.showNotification('No file selected', 'error');
      return false;
    }

    // Validate file type
    const fileType = this.getFileType(file);
    if (!this.supportedFormats.includes(fileType)) {
      uiSystem.showNotification(`Unsupported file type: ${fileType}`, 'error');
      return false;
    }

    try {
      // Show loading notification
      const loadingId = uiSystem.showNotification('Importing data...', 'info', 0);
      
      // Read file content
      const content = await this.readFileContent(file);
      
      // Parse content based on file type
      let data;
      switch (fileType) {
        case 'csv':
          data = this.parseCSV(content);
          break;
        case 'json':
          data = JSON.parse(content);
          break;
        default:
          throw new Error(`Parser not implemented for ${fileType}`);
      }
      
      // Validate data
      const validation = this.validateImportData(data, options.dataType);
      if (!validation.valid) {
        uiSystem.dismissNotification(loadingId);
        uiSystem.showNotification(`Import validation failed: ${validation.message}`, 'error');
        return false;
      }
      
      // Process import
      const result = await this.processImportData(data, options);
      
      // Record import in history
      this.recordImport({
        fileName: file.name,
        fileType: fileType,
        dataType: options.dataType,
        recordsProcessed: result.processed,
        recordsSkipped: result.skipped,
        timestamp: new Date().toISOString()
      });
      
      // Dismiss loading and show success
      uiSystem.dismissNotification(loadingId);
      uiSystem.showNotification(
        `Import complete: ${result.processed} records processed, ${result.skipped} skipped`, 
        'success'
      );
      
      // Emit event
      eventBus.emit('data-imported', result);
      
      return true;
      
    } catch (error) {
      console.error('Import error:', error);
      uiSystem.showNotification(`Import failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Parse CSV content
   */
  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = this.parseCSVLine(lines[0]);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index].trim();
        });
        data.push(row);
      }
    }
    
    return data;
  }

  /**
   * Parse individual CSV line handling quotes and commas
   */
  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current.trim());
    return fields;
  }

  /**
   * Process imported data
   */
  async processImportData(data, options) {
    const { dataType, mergeStrategy = 'append' } = options;
    let processed = 0;
    let skipped = 0;
    
    console.log(`📊 Processing ${data.length} records of type: ${dataType}`);
    
    switch (dataType) {
      case 'staff':
        const staffResult = await this.importStaffData(data, mergeStrategy);
        processed += staffResult.processed;
        skipped += staffResult.skipped;
        break;
        
      case 'routes':
        const routesResult = await this.importRoutesData(data, mergeStrategy);
        processed += routesResult.processed;
        skipped += routesResult.skipped;
        break;
        
      case 'assets':
        const assetsResult = await this.importAssetsData(data, mergeStrategy);
        processed += assetsResult.processed;
        skipped += assetsResult.skipped;
        break;
        
      case 'mixed':
        // Auto-detect data types and import accordingly
        const mixedResult = await this.importMixedData(data, mergeStrategy);
        processed += mixedResult.processed;
        skipped += mixedResult.skipped;
        break;
        
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
    
    // Update displays
    eventBus.emit('data-updated');
    
    return { processed, skipped };
  }

  /**
   * Import staff data
   */
  async importStaffData(data, mergeStrategy) {
    let processed = 0;
    let skipped = 0;
    
    for (const row of data) {
      try {
        // Validate required fields
        if (!row.name || !row.role) {
          skipped++;
          continue;
        }
        
        // Check if staff already exists
        const existingStaff = STATE.staff.find(s => s.name === row.name);
        
        if (existingStaff && mergeStrategy === 'skip') {
          skipped++;
          continue;
        }
        
        // Create or update staff record
        const staffData = {
          id: existingStaff ? existingStaff.id : this.generateId('staff'),
          name: row.name,
          role: row.role,
          status: row.status || 'available',
          phone: row.phone || '',
          email: row.email || '',
          canDrive: this.parseBoolean(row.canDrive),
          certifications: row.certifications ? row.certifications.split(';') : []
        };
        
        if (existingStaff) {
          // Update existing
          Object.assign(existingStaff, staffData);
        } else {
          // Add new
          STATE.staff.push(staffData);
        }
        
        processed++;
        
      } catch (error) {
        console.error('Error processing staff row:', row, error);
        skipped++;
      }
    }
    
    eventBus.emit('staff-updated');
    return { processed, skipped };
  }

  /**
   * Import routes data
   */
  async importRoutesData(data, mergeStrategy) {
    let processed = 0;
    let skipped = 0;
    
    for (const row of data) {
      try {
        // Validate required fields
        if (!row.name || !row.type) {
          skipped++;
          continue;
        }
        
        // Check if route already exists
        const routeKey = `${row.name}_${row.shift || 'AM'}`;
        const existingRoute = STATE.routes.find(r => r.name === row.name && r.shift === (row.shift || 'AM'));
        
        if (existingRoute && mergeStrategy === 'skip') {
          skipped++;
          continue;
        }
        
        // Create or update route record
        const routeData = {
          id: existingRoute ? existingRoute.id : this.generateId('route'),
          name: row.name,
          type: row.type,
          shift: row.shift || 'AM',
          status: row.status || 'inactive',
          description: row.description || '',
          estimatedTime: row.estimatedTime || '',
          stops: row.stops ? row.stops.split(';') : []
        };
        
        if (existingRoute) {
          // Update existing
          Object.assign(existingRoute, routeData);
        } else {
          // Add new
          STATE.routes.push(routeData);
        }
        
        processed++;
        
      } catch (error) {
        console.error('Error processing route row:', row, error);
        skipped++;
      }
    }
    
    eventBus.emit('routes-updated');
    return { processed, skipped };
  }

  /**
   * Import assets data
   */
  async importAssetsData(data, mergeStrategy) {
    let processed = 0;
    let skipped = 0;
    
    for (const row of data) {
      try {
        // Validate required fields
        if (!row.number || !row.type) {
          skipped++;
          continue;
        }
        
        // Check if asset already exists
        const existingAsset = STATE.assets.find(a => a.number === row.number);
        
        if (existingAsset && mergeStrategy === 'skip') {
          skipped++;
          continue;
        }
        
        // Create or update asset record
        const assetData = {
          id: existingAsset ? existingAsset.id : this.generateId('asset'),
          number: row.number,
          type: row.type,
          status: row.status || 'available',
          location: row.location || '',
          capacity: parseInt(row.capacity) || 0,
          mileage: parseInt(row.mileage) || 0,
          lastMaintenance: row.lastMaintenance || null,
          notes: row.notes || ''
        };
        
        if (existingAsset) {
          // Update existing
          Object.assign(existingAsset, assetData);
        } else {
          // Add new
          STATE.assets.push(assetData);
        }
        
        processed++;
        
      } catch (error) {
        console.error('Error processing asset row:', row, error);
        skipped++;
      }
    }
    
    eventBus.emit('assets-updated');
    return { processed, skipped };
  }

  // ===== DATA EXPORT =====

  /**
   * Export data to file
   */
  exportData(dataType, format = 'csv', options = {}) {
    console.log(`📊 Exporting ${dataType} data in ${format} format`);
    
    try {
      // Get data to export
      const data = this.getExportData(dataType, options);
      
      if (!data || data.length === 0) {
        uiSystem.showNotification('No data to export', 'warning');
        return false;
      }
      
      // Generate content based on format
      let content, mimeType, extension;
      
      switch (format) {
        case 'csv':
          content = this.generateCSV(data);
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          content = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      // Create and download file
      const filename = `${dataType}-export-${this.formatDateForFilename(new Date())}.${extension}`;
      this.downloadFile(content, filename, mimeType);
      
      // Record export in history
      this.recordExport({
        dataType,
        format,
        filename,
        recordCount: data.length,
        timestamp: new Date().toISOString()
      });
      
      uiSystem.showNotification(`${dataType} data exported successfully`, 'success');
      eventBus.emit('data-exported', { dataType, format, filename });
      
      return true;
      
    } catch (error) {
      console.error('Export error:', error);
      uiSystem.showNotification(`Export failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get data for export
   */
  getExportData(dataType, options = {}) {
    const { includeIds = false, filterStatus = null } = options;
    
    let data = [];
    
    switch (dataType) {
      case 'staff':
        data = STATE.staff.map(staff => ({
          ...(includeIds && { id: staff.id }),
          name: staff.name,
          role: staff.role,
          status: staff.status,
          phone: staff.phone || '',
          email: staff.email || '',
          canDrive: staff.canDrive || false,
          certifications: (staff.certifications || []).join(';')
        }));
        break;
        
      case 'routes':
        data = STATE.routes.map(route => ({
          ...(includeIds && { id: route.id }),
          name: route.name,
          type: route.type,
          shift: route.shift,
          status: route.status,
          description: route.description || '',
          estimatedTime: route.estimatedTime || '',
          stops: (route.stops || []).join(';')
        }));
        break;
        
      case 'assets':
        data = STATE.assets.map(asset => ({
          ...(includeIds && { id: asset.id }),
          number: asset.number,
          type: asset.type,
          status: asset.status,
          location: asset.location || '',
          capacity: asset.capacity || 0,
          mileage: asset.mileage || 0,
          lastMaintenance: asset.lastMaintenance || '',
          notes: asset.notes || ''
        }));
        break;
        
      case 'assignments':
        data = this.getAssignmentsExportData();
        break;
        
      case 'fieldTrips':
        data = this.getFieldTripsExportData();
        break;
        
      case 'all':
        return {
          staff: this.getExportData('staff', options),
          routes: this.getExportData('routes', options),
          assets: this.getExportData('assets', options),
          assignments: this.getExportData('assignments', options),
          fieldTrips: this.getExportData('fieldTrips', options)
        };
        
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
    
    // Apply filters
    if (filterStatus) {
      data = data.filter(item => item.status === filterStatus);
    }
    
    return data;
  }

  /**
   * Generate CSV content from data
   */
  generateCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  // ===== TEMPLATE GENERATION =====

  /**
   * Generate import template
   */
  generateTemplate(dataType) {
    console.log(`📊 Generating template for: ${dataType}`);
    
    const templates = {
      staff: [
        { name: 'John Doe', role: 'Driver', status: 'available', phone: '555-0123', email: 'john@example.com', canDrive: 'true', certifications: 'CDL;First Aid' },
        { name: 'Jane Smith', role: 'Aide', status: 'available', phone: '555-0124', email: 'jane@example.com', canDrive: 'false', certifications: 'First Aid' }
      ],
      routes: [
        { name: '1', type: 'Gen Ed', shift: 'AM', status: 'active', description: 'Elementary Route 1', estimatedTime: '45 min', stops: 'Stop A;Stop B;Stop C' },
        { name: '2', type: 'Gen Ed', shift: 'PM', status: 'active', description: 'Elementary Route 2', estimatedTime: '50 min', stops: 'Stop D;Stop E;Stop F' }
      ],
      assets: [
        { number: '101', type: 'Bus', status: 'available', location: 'Yard', capacity: '72', mileage: '45000', lastMaintenance: '2024-01-15', notes: 'Good condition' },
        { number: '102', type: 'Van', status: 'available', location: 'Yard', capacity: '15', mileage: '32000', lastMaintenance: '2024-02-01', notes: 'Recently serviced' }
      ]
    };
    
    const templateData = templates[dataType];
    if (!templateData) {
      uiSystem.showNotification(`No template available for: ${dataType}`, 'error');
      return false;
    }
    
    // Generate CSV template
    const csv = this.generateCSV(templateData);
    const filename = `${dataType}-import-template.csv`;
    this.downloadFile(csv, filename, 'text/csv');
    
    uiSystem.showNotification(`Template downloaded: ${filename}`, 'success');
    return true;
  }

  // ===== VALIDATION =====

  /**
   * Validate import data
   */
  validateImportData(data, dataType) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { valid: false, message: 'No data provided or data is not an array' };
    }
    
    // Get validation rules for data type
    const rules = this.validationRules.get(dataType);
    if (!rules) {
      return { valid: false, message: `No validation rules defined for: ${dataType}` };
    }
    
    // Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const validation = this.validateRow(row, rules, i + 1);
      if (!validation.valid) {
        return validation;
      }
    }
    
    return { valid: true, message: 'Data validation passed' };
  }

  /**
   * Validate individual row
   */
  validateRow(row, rules, rowNumber) {
    // Check required fields
    for (const field of rules.required) {
      if (!row[field] || row[field].toString().trim() === '') {
        return { 
          valid: false, 
          message: `Row ${rowNumber}: Required field '${field}' is missing or empty` 
        };
      }
    }
    
    // Check field formats
    for (const [field, format] of Object.entries(rules.formats || {})) {
      if (row[field] && !format.test(row[field])) {
        return { 
          valid: false, 
          message: `Row ${rowNumber}: Field '${field}' has invalid format` 
        };
      }
    }
    
    // Check enum values
    for (const [field, allowedValues] of Object.entries(rules.enums || {})) {
      if (row[field] && !allowedValues.includes(row[field])) {
        return { 
          valid: false, 
          message: `Row ${rowNumber}: Field '${field}' must be one of: ${allowedValues.join(', ')}` 
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * Setup validation rules
   */
  setupValidationRules() {
    this.validationRules.set('staff', {
      required: ['name', 'role'],
      enums: {
        role: ['Driver', 'Aide', 'Supervisor', 'Mechanic'],
        status: ['available', 'out', 'on-route']
      },
      formats: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^\d{3}-\d{4}$|^\(\d{3}\)\s\d{3}-\d{4}$/
      }
    });
    
    this.validationRules.set('routes', {
      required: ['name', 'type'],
      enums: {
        type: ['Gen Ed', 'SE', 'Miscellaneous'],
        shift: ['AM', 'PM'],
        status: ['active', 'inactive']
      }
    });
    
    this.validationRules.set('assets', {
      required: ['number', 'type'],
      enums: {
        type: ['Bus', 'Van', 'Trailer'],
        status: ['available', 'in-service', 'maintenance', 'out-of-service']
      }
    });
  }

  // ===== UI MODALS =====

  /**
   * Open import modal
   */
  openImportModal() {
    const modalContent = `
      <form class="import-form">
        <div class="form-group">
          <label for="import-data-type">Data Type:</label>
          <select id="import-data-type" required>
            <option value="">Select data type...</option>
            <option value="staff">Staff</option>
            <option value="routes">Routes</option>
            <option value="assets">Assets</option>
            <option value="mixed">Mixed (Auto-detect)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="import-file">Select File:</label>
          <input type="file" id="import-file" accept=".csv,.json" required>
          <small class="form-help">Supported formats: CSV, JSON</small>
        </div>
        
        <div class="form-group">
          <label for="merge-strategy">If record exists:</label>
          <select id="merge-strategy">
            <option value="skip">Skip (keep existing)</option>
            <option value="update">Update (overwrite existing)</option>
            <option value="append">Append (create duplicate)</option>
          </select>
        </div>
        
        <div class="template-actions">
          <h4>Need a template?</h4>
          <button type="button" class="btn btn-sm btn-secondary" 
                  onclick="dataImportExport.generateTemplate('staff')">Staff Template</button>
          <button type="button" class="btn btn-sm btn-secondary" 
                  onclick="dataImportExport.generateTemplate('routes')">Routes Template</button>
          <button type="button" class="btn btn-sm btn-secondary" 
                  onclick="dataImportExport.generateTemplate('assets')">Assets Template</button>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Import Data</button>
        </div>
      </form>
    `;
    
    const modal = uiSystem.createModal('import-modal', 'Import Data', modalContent);
    uiSystem.openModal('import-modal');
    
    this.setupImportModalHandlers();
  }

  /**
   * Open export modal
   */
  openExportModal() {
    const modalContent = `
      <form class="export-form">
        <div class="form-group">
          <label for="export-data-type">Data Type:</label>
          <select id="export-data-type" required>
            <option value="staff">Staff</option>
            <option value="routes">Routes</option>
            <option value="assets">Assets</option>
            <option value="assignments">Assignments</option>
            <option value="fieldTrips">Field Trips</option>
            <option value="all">All Data</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="export-format">Format:</label>
          <select id="export-format">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="include-ids">
            Include internal IDs
          </label>
        </div>
        
        <div class="form-group">
          <label for="filter-status">Filter by status (optional):</label>
          <select id="filter-status">
            <option value="">All statuses</option>
            <option value="available">Available only</option>
            <option value="active">Active only</option>
            <option value="completed">Completed only</option>
          </select>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Export Data</button>
        </div>
      </form>
    `;
    
    const modal = uiSystem.createModal('export-modal', 'Export Data', modalContent);
    uiSystem.openModal('export-modal');
    
    this.setupExportModalHandlers();
  }

  // ===== UTILITY METHODS =====

  /**
   * Setup file handlers
   */
  setupFileHandlers() {
    document.addEventListener('change', (e) => {
      if (e.target.matches('#import-file')) {
        // Could add preview functionality here
      }
    });
  }

  /**
   * Setup drag and drop
   */
  setupDragAndDrop() {
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // Handle dropped file
        this.handleDroppedFile(files[0]);
      }
    });
  }

  /**
   * Setup export buttons
   */
  setupExportButtons() {
    // Could add quick export buttons to panels
  }

  /**
   * Setup import modal handlers
   */
  setupImportModalHandlers() {
    const form = document.querySelector('.import-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleImportFormSubmission(form);
      });
    }
  }

  /**
   * Setup export modal handlers
   */
  setupExportModalHandlers() {
    const form = document.querySelector('.export-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleExportFormSubmission(form);
      });
    }
  }

  /**
   * Handle import form submission
   */
  async handleImportFormSubmission(form) {
    const dataType = form.querySelector('#import-data-type').value;
    const file = form.querySelector('#import-file').files[0];
    const mergeStrategy = form.querySelector('#merge-strategy').value;
    
    if (!dataType || !file) {
      uiSystem.showNotification('Please select data type and file', 'error');
      return;
    }
    
    const success = await this.handleFileImport(file, { dataType, mergeStrategy });
    if (success) {
      uiSystem.closeCurrentModal();
    }
  }

  /**
   * Handle export form submission
   */
  handleExportFormSubmission(form) {
    const dataType = form.querySelector('#export-data-type').value;
    const format = form.querySelector('#export-format').value;
    const includeIds = form.querySelector('#include-ids').checked;
    const filterStatus = form.querySelector('#filter-status').value;
    
    const options = {
      includeIds,
      filterStatus: filterStatus || null
    };
    
    const success = this.exportData(dataType, format, options);
    if (success) {
      uiSystem.closeCurrentModal();
    }
  }

  /**
   * Read file content
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Get file type from file object
   */
  getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return extension;
  }

  /**
   * Generate unique ID
   */
  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse boolean string
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  }

  /**
   * Format date for filename
   */
  formatDateForFilename(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Record import in history
   */
  recordImport(importData) {
    this.importHistory.unshift(importData);
    
    // Keep only last 50 imports
    if (this.importHistory.length > 50) {
      this.importHistory = this.importHistory.slice(0, 50);
    }
  }

  /**
   * Record export in history
   */
  recordExport(exportData) {
    this.exportHistory.unshift(exportData);
    
    // Keep only last 50 exports
    if (this.exportHistory.length > 50) {
      this.exportHistory = this.exportHistory.slice(0, 50);
    }
  }

  /**
   * Handle dropped file
   */
  handleDroppedFile(file) {
    // Could open import modal with file pre-selected
    console.log('📊 File dropped:', file.name);
  }

  /**
   * Load templates
   */
  loadTemplates() {
    // Could load custom templates from storage
    console.log('📊 Loading import/export templates');
  }

  /**
   * Get assignments export data
   */
  getAssignmentsExportData() {
    // Implementation would export assignment data
    return [];
  }

  /**
   * Get field trips export data
   */
  getFieldTripsExportData() {
    // Implementation would export field trip data
    return [];
  }

  /**
   * Handle import request
   */
  handleImportRequest(data) {
    this.openImportModal();
  }

  /**
   * Handle export request
   */
  handleExportRequest(data) {
    this.openExportModal();
  }
}

// Create and export singleton instance
const dataImportExport = new DataImportExport();

// Make available globally for inline event handlers
window.dataImportExport = dataImportExport;

export { dataImportExport };
