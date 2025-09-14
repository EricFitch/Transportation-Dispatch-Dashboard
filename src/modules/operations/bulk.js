/**
 * OPERATIONS BULK MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive bulk operations system for:
 * - Bulk route assignments and updates
 * - Mass staff scheduling operations
 * - Asset bulk management
 * - Route template generation and application
 * - Timestamp reports and bulk data operations
 * - Batch processing workflows
 * - Bulk validation and error handling
 * - Progress tracking for long operations
 * 
 * Dependencies: core/events, core/state, ui/system, data/import-export
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class OperationsBulk {
  constructor() {
    this.activeOperations = new Map();
    this.operationHistory = [];
    this.templates = new Map();
    this.batchSize = 50; // Process items in batches
    this.maxConcurrent = 3; // Maximum concurrent operations
    this.progressTrackers = new Map();
    
    this.init();
  }

  /**
   * Initialize bulk operations
   */
  init() {
    this.setupEventListeners();
    this.setupRouteTemplates();
    this.setupBulkActions();
    this.loadOperationHistory();
    
    console.log('🔄 Operations Bulk initialized');
    eventBus.emit('operations-bulk-ready');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Bulk operation requests
    eventBus.on('bulk-assign-routes', (data) => this.bulkAssignRoutes(data));
    eventBus.on('bulk-update-staff', (data) => this.bulkUpdateStaff(data));
    eventBus.on('bulk-update-assets', (data) => this.bulkUpdateAssets(data));
    eventBus.on('bulk-apply-template', (data) => this.bulkApplyTemplate(data));
    
    // Report generation
    eventBus.on('generate-timestamp-report', (data) => this.generateTimestampReport(data));
    eventBus.on('generate-bulk-report', (data) => this.generateBulkReport(data));
    
    // Template operations
    eventBus.on('create-route-template', (data) => this.createRouteTemplate(data));
    eventBus.on('apply-route-template', (data) => this.applyRouteTemplate(data));
    
    // UI requests
    eventBus.on('open-bulk-operations', () => this.openBulkOperationsModal());
    eventBus.on('open-template-manager', () => this.openTemplateManager());
  }

  // ===== BULK ROUTE OPERATIONS =====

  /**
   * Bulk assign routes to staff and assets
   */
  async bulkAssignRoutes({ assignments, options = {} }) {
    const operationId = this.startOperation('bulk-assign-routes', assignments.length);
    
    console.log(`🔄 Starting bulk route assignments: ${assignments.length} items`);
    
    try {
      const results = {
        processed: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };
      
      // Process in batches
      for (let i = 0; i < assignments.length; i += this.batchSize) {
        const batch = assignments.slice(i, i + this.batchSize);
        const batchResults = await this.processBatchAssignments(batch, options);
        
        // Merge results
        results.processed += batchResults.processed;
        results.failed += batchResults.failed;
        results.skipped += batchResults.skipped;
        results.errors.push(...batchResults.errors);
        
        // Update progress
        this.updateProgress(operationId, i + batch.length, assignments.length);
        
        // Small delay to prevent UI blocking
        await this.delay(10);
      }
      
      // Complete operation
      this.completeOperation(operationId, results);
      
      // Update UI
      eventBus.emit('routes-updated');
      eventBus.emit('assignments-updated');
      
      // Show results
      uiSystem.showNotification(
        `Bulk assignment complete: ${results.processed} processed, ${results.failed} failed`, 
        results.failed > 0 ? 'warning' : 'success'
      );
      
      return results;
      
    } catch (error) {
      this.failOperation(operationId, error);
      uiSystem.showNotification(`Bulk assignment failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Process batch of assignments
   */
  async processBatchAssignments(batch, options) {
    const results = { processed: 0, failed: 0, skipped: 0, errors: [] };
    
    for (const assignment of batch) {
      try {
        const success = await this.processRouteAssignment(assignment, options);
        if (success) {
          results.processed++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          assignment,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Process individual route assignment
   */
  async processRouteAssignment(assignment, options) {
    const { routeId, staffId, assetId, shift, date, overwrite = false } = assignment;
    
    // Validate assignment
    const validation = this.validateRouteAssignment(assignment);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Get route
    const route = STATE.routes.find(r => r.id === routeId);
    if (!route) {
      throw new Error(`Route not found: ${routeId}`);
    }
    
    // Check for existing assignment
    const existingAssignment = this.findExistingAssignment(routeId, shift, date);
    if (existingAssignment && !overwrite) {
      return false; // Skip without error
    }
    
    // Create or update assignment
    const assignmentData = {
      id: existingAssignment ? existingAssignment.id : this.generateId('assignment'),
      routeId,
      staffId,
      assetId,
      shift,
      date,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      assignedBy: options.assignedBy || 'bulk-operation'
    };
    
    if (existingAssignment) {
      // Update existing
      Object.assign(existingAssignment, assignmentData);
    } else {
      // Create new
      if (!STATE.assignments) STATE.assignments = [];
      STATE.assignments.push(assignmentData);
    }
    
    return true;
  }

  /**
   * Validate route assignment
   */
  validateRouteAssignment(assignment) {
    const { routeId, staffId, assetId, shift, date } = assignment;
    
    if (!routeId) {
      return { valid: false, message: 'Route ID is required' };
    }
    
    if (!shift) {
      return { valid: false, message: 'Shift is required' };
    }
    
    if (!date) {
      return { valid: false, message: 'Date is required' };
    }
    
    // Validate staff exists and is available
    if (staffId) {
      const staff = STATE.staff.find(s => s.id === staffId);
      if (!staff) {
        return { valid: false, message: `Staff not found: ${staffId}` };
      }
      if (staff.status === 'out') {
        return { valid: false, message: `Staff not available: ${staff.name}` };
      }
    }
    
    // Validate asset exists and is available
    if (assetId) {
      const asset = STATE.assets.find(a => a.id === assetId);
      if (!asset) {
        return { valid: false, message: `Asset not found: ${assetId}` };
      }
      if (asset.status === 'out-of-service' || asset.status === 'maintenance') {
        return { valid: false, message: `Asset not available: ${asset.number}` };
      }
    }
    
    return { valid: true };
  }

  // ===== BULK STAFF OPERATIONS =====

  /**
   * Bulk update staff information
   */
  async bulkUpdateStaff({ updates, options = {} }) {
    const operationId = this.startOperation('bulk-update-staff', updates.length);
    
    console.log(`🔄 Starting bulk staff updates: ${updates.length} items`);
    
    try {
      const results = { processed: 0, failed: 0, errors: [] };
      
      for (let i = 0; i < updates.length; i += this.batchSize) {
        const batch = updates.slice(i, i + this.batchSize);
        
        for (const update of batch) {
          try {
            await this.processStaffUpdate(update, options);
            results.processed++;
          } catch (error) {
            results.failed++;
            results.errors.push({ update, error: error.message });
          }
        }
        
        this.updateProgress(operationId, i + batch.length, updates.length);
        await this.delay(10);
      }
      
      this.completeOperation(operationId, results);
      eventBus.emit('staff-updated');
      
      uiSystem.showNotification(
        `Staff bulk update complete: ${results.processed} processed, ${results.failed} failed`,
        results.failed > 0 ? 'warning' : 'success'
      );
      
      return results;
      
    } catch (error) {
      this.failOperation(operationId, error);
      throw error;
    }
  }

  /**
   * Process staff update
   */
  async processStaffUpdate(update, options) {
    const { staffId, changes } = update;
    
    const staff = STATE.staff.find(s => s.id === staffId);
    if (!staff) {
      throw new Error(`Staff not found: ${staffId}`);
    }
    
    // Apply changes
    Object.assign(staff, changes);
    
    // Validate updated staff
    const validation = this.validateStaff(staff);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Record update
    staff.lastUpdated = new Date().toISOString();
    staff.updatedBy = options.updatedBy || 'bulk-operation';
  }

  // ===== BULK ASSET OPERATIONS =====

  /**
   * Bulk update asset information
   */
  async bulkUpdateAssets({ updates, options = {} }) {
    const operationId = this.startOperation('bulk-update-assets', updates.length);
    
    console.log(`🔄 Starting bulk asset updates: ${updates.length} items`);
    
    try {
      const results = { processed: 0, failed: 0, errors: [] };
      
      for (let i = 0; i < updates.length; i += this.batchSize) {
        const batch = updates.slice(i, i + this.batchSize);
        
        for (const update of batch) {
          try {
            await this.processAssetUpdate(update, options);
            results.processed++;
          } catch (error) {
            results.failed++;
            results.errors.push({ update, error: error.message });
          }
        }
        
        this.updateProgress(operationId, i + batch.length, updates.length);
        await this.delay(10);
      }
      
      this.completeOperation(operationId, results);
      eventBus.emit('assets-updated');
      
      uiSystem.showNotification(
        `Asset bulk update complete: ${results.processed} processed, ${results.failed} failed`,
        results.failed > 0 ? 'warning' : 'success'
      );
      
      return results;
      
    } catch (error) {
      this.failOperation(operationId, error);
      throw error;
    }
  }

  /**
   * Process asset update
   */
  async processAssetUpdate(update, options) {
    const { assetId, changes } = update;
    
    const asset = STATE.assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }
    
    // Apply changes
    Object.assign(asset, changes);
    
    // Validate updated asset
    const validation = this.validateAsset(asset);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    // Record update
    asset.lastUpdated = new Date().toISOString();
    asset.updatedBy = options.updatedBy || 'bulk-operation';
  }

  // ===== ROUTE TEMPLATES =====

  /**
   * Setup route templates
   */
  setupRouteTemplates() {
    // Define default templates
    this.templates.set('daily-gen-ed', {
      name: 'Daily Gen Ed Routes',
      description: 'Standard daily general education routes',
      routes: [
        { name: '1', type: 'Gen Ed', shift: 'AM', estimatedTime: '45 min' },
        { name: '2', type: 'Gen Ed', shift: 'AM', estimatedTime: '50 min' },
        { name: '3', type: 'Gen Ed', shift: 'AM', estimatedTime: '40 min' },
        { name: '1', type: 'Gen Ed', shift: 'PM', estimatedTime: '45 min' },
        { name: '2', type: 'Gen Ed', shift: 'PM', estimatedTime: '50 min' },
        { name: '3', type: 'Gen Ed', shift: 'PM', estimatedTime: '40 min' }
      ]
    });
    
    this.templates.set('se-routes', {
      name: 'Special Education Routes',
      description: 'Special education transportation routes',
      routes: [
        { name: 'SE1', type: 'SE', shift: 'AM', estimatedTime: '60 min' },
        { name: 'SE2', type: 'SE', shift: 'AM', estimatedTime: '55 min' },
        { name: 'SE1', type: 'SE', shift: 'PM', estimatedTime: '60 min' },
        { name: 'SE2', type: 'SE', shift: 'PM', estimatedTime: '55 min' }
      ]
    });
    
    console.log('🔄 Route templates loaded');
  }

  /**
   * Create route template
   */
  createRouteTemplate({ name, description, baseRoutes, options = {} }) {
    console.log(`🔄 Creating route template: ${name}`);
    
    const template = {
      id: this.generateId('template'),
      name,
      description,
      routes: baseRoutes.map(route => ({ ...route })),
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy || 'user',
      version: 1
    };
    
    this.templates.set(template.id, template);
    
    eventBus.emit('template-created', template);
    uiSystem.showNotification(`Template created: ${name}`, 'success');
    
    return template;
  }

  /**
   * Apply route template
   */
  async applyRouteTemplate({ templateId, date, options = {} }) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    console.log(`🔄 Applying template: ${template.name} for ${date}`);
    
    const operationId = this.startOperation('apply-template', template.routes.length);
    
    try {
      const results = { processed: 0, failed: 0, errors: [] };
      
      for (const [index, routeTemplate] of template.routes.entries()) {
        try {
          await this.createRouteFromTemplate(routeTemplate, date, options);
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({ route: routeTemplate, error: error.message });
        }
        
        this.updateProgress(operationId, index + 1, template.routes.length);
        await this.delay(5);
      }
      
      this.completeOperation(operationId, results);
      eventBus.emit('routes-updated');
      
      uiSystem.showNotification(
        `Template applied: ${results.processed} routes created, ${results.failed} failed`,
        results.failed > 0 ? 'warning' : 'success'
      );
      
      return results;
      
    } catch (error) {
      this.failOperation(operationId, error);
      throw error;
    }
  }

  /**
   * Create route from template
   */
  async createRouteFromTemplate(routeTemplate, date, options) {
    const routeId = this.generateId('route');
    
    const route = {
      id: routeId,
      name: routeTemplate.name,
      type: routeTemplate.type,
      shift: routeTemplate.shift,
      status: options.defaultStatus || 'inactive',
      description: routeTemplate.description || '',
      estimatedTime: routeTemplate.estimatedTime || '',
      stops: routeTemplate.stops || [],
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy || 'template',
      templateId: routeTemplate.templateId,
      date
    };
    
    // Check for existing route
    const existing = STATE.routes.find(r => 
      r.name === route.name && 
      r.shift === route.shift && 
      r.date === date
    );
    
    if (existing && !options.overwrite) {
      throw new Error(`Route already exists: ${route.name} ${route.shift}`);
    }
    
    if (existing) {
      // Update existing
      Object.assign(existing, route);
    } else {
      // Create new
      STATE.routes.push(route);
    }
  }

  // ===== BULK TEMPLATE APPLICATION =====

  /**
   * Bulk apply template to multiple dates
   */
  async bulkApplyTemplate({ templateId, dates, options = {} }) {
    const operationId = this.startOperation('bulk-apply-template', dates.length);
    
    console.log(`🔄 Bulk applying template to ${dates.length} dates`);
    
    try {
      const results = { processed: 0, failed: 0, errors: [] };
      
      for (const [index, date] of dates.entries()) {
        try {
          await this.applyRouteTemplate({ templateId, date, options });
          results.processed++;
        } catch (error) {
          results.failed++;
          results.errors.push({ date, error: error.message });
        }
        
        this.updateProgress(operationId, index + 1, dates.length);
        await this.delay(100); // Longer delay for template application
      }
      
      this.completeOperation(operationId, results);
      
      uiSystem.showNotification(
        `Bulk template application complete: ${results.processed} dates processed`,
        results.failed > 0 ? 'warning' : 'success'
      );
      
      return results;
      
    } catch (error) {
      this.failOperation(operationId, error);
      throw error;
    }
  }

  // ===== TIMESTAMP REPORTS =====

  /**
   * Generate timestamp report
   */
  async generateTimestampReport({ dateRange, includeTypes = [], options = {} }) {
    console.log('🔄 Generating timestamp report', dateRange);
    
    const operationId = this.startOperation('timestamp-report', 1);
    
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        dateRange,
        includeTypes,
        data: {}
      };
      
      // Collect assignment data
      if (includeTypes.includes('assignments') || includeTypes.length === 0) {
        report.data.assignments = this.getAssignmentTimestamps(dateRange);
      }
      
      // Collect route data
      if (includeTypes.includes('routes') || includeTypes.length === 0) {
        report.data.routes = this.getRouteTimestamps(dateRange);
      }
      
      // Collect staff data
      if (includeTypes.includes('staff') || includeTypes.length === 0) {
        report.data.staff = this.getStaffTimestamps(dateRange);
      }
      
      // Collect asset data
      if (includeTypes.includes('assets') || includeTypes.length === 0) {
        report.data.assets = this.getAssetTimestamps(dateRange);
      }
      
      this.completeOperation(operationId, report);
      
      // Export report if requested
      if (options.export) {
        this.exportTimestampReport(report, options.format || 'json');
      }
      
      return report;
      
    } catch (error) {
      this.failOperation(operationId, error);
      throw error;
    }
  }

  /**
   * Get assignment timestamps
   */
  getAssignmentTimestamps(dateRange) {
    return (STATE.assignments || [])
      .filter(assignment => this.isInDateRange(assignment.date, dateRange))
      .map(assignment => ({
        id: assignment.id,
        routeId: assignment.routeId,
        staffId: assignment.staffId,
        assetId: assignment.assetId,
        date: assignment.date,
        shift: assignment.shift,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        completedAt: assignment.completedAt,
        status: assignment.status
      }));
  }

  /**
   * Get route timestamps
   */
  getRouteTimestamps(dateRange) {
    return STATE.routes
      .filter(route => route.date && this.isInDateRange(route.date, dateRange))
      .map(route => ({
        id: route.id,
        name: route.name,
        type: route.type,
        shift: route.shift,
        date: route.date,
        status: route.status,
        createdAt: route.createdAt,
        activatedAt: route.activatedAt,
        completedAt: route.completedAt
      }));
  }

  /**
   * Get staff timestamps
   */
  getStaffTimestamps(dateRange) {
    return STATE.staff.map(staff => ({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      lastUpdated: staff.lastUpdated,
      statusChanges: staff.statusChanges?.filter(change => 
        this.isInDateRange(change.timestamp, dateRange)
      ) || []
    }));
  }

  /**
   * Get asset timestamps
   */
  getAssetTimestamps(dateRange) {
    return STATE.assets.map(asset => ({
      id: asset.id,
      number: asset.number,
      type: asset.type,
      status: asset.status,
      lastUpdated: asset.lastUpdated,
      lastMaintenance: asset.lastMaintenance,
      statusChanges: asset.statusChanges?.filter(change => 
        this.isInDateRange(change.timestamp, dateRange)
      ) || []
    }));
  }

  /**
   * Export timestamp report
   */
  exportTimestampReport(report, format) {
    const filename = `timestamp-report-${this.formatDateForFilename(new Date())}.${format}`;
    
    let content;
    let mimeType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(report, null, 2);
        mimeType = 'application/json';
        break;
      case 'csv':
        content = this.convertReportToCSV(report);
        mimeType = 'text/csv';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    this.downloadFile(content, filename, mimeType);
  }

  // ===== BULK OPERATIONS UI =====

  /**
   * Open bulk operations modal
   */
  openBulkOperationsModal() {
    const modalContent = `
      <div class="bulk-operations-container">
        <div class="operation-categories">
          <div class="category" data-category="routes">
            <h3>🚌 Route Operations</h3>
            <button class="btn btn-primary" onclick="operationsBulk.showBulkAssignments()">
              Bulk Route Assignments
            </button>
            <button class="btn btn-secondary" onclick="operationsBulk.showRouteTemplates()">
              Apply Route Templates
            </button>
          </div>
          
          <div class="category" data-category="staff">
            <h3>👥 Staff Operations</h3>
            <button class="btn btn-primary" onclick="operationsBulk.showBulkStaffUpdate()">
              Bulk Staff Updates
            </button>
            <button class="btn btn-secondary" onclick="operationsBulk.showStaffScheduling()">
              Mass Staff Scheduling
            </button>
          </div>
          
          <div class="category" data-category="assets">
            <h3>🚐 Asset Operations</h3>
            <button class="btn btn-primary" onclick="operationsBulk.showBulkAssetUpdate()">
              Bulk Asset Updates
            </button>
            <button class="btn btn-secondary" onclick="operationsBulk.showAssetMaintenance()">
              Mass Maintenance Scheduling
            </button>
          </div>
          
          <div class="category" data-category="reports">
            <h3>📊 Reports & Analysis</h3>
            <button class="btn btn-primary" onclick="operationsBulk.showTimestampReports()">
              Generate Timestamp Report
            </button>
            <button class="btn btn-secondary" onclick="operationsBulk.showBulkAnalysis()">
              Bulk Data Analysis
            </button>
          </div>
        </div>
        
        <div class="active-operations">
          <h4>Active Operations</h4>
          <div id="active-operations-list">
            ${this.renderActiveOperations()}
          </div>
        </div>
      </div>
    `;
    
    const modal = uiSystem.createModal('bulk-operations', 'Bulk Operations', modalContent, { size: 'large' });
    uiSystem.openModal('bulk-operations');
  }

  /**
   * Open template manager
   */
  openTemplateManager() {
    const modalContent = `
      <div class="template-manager">
        <div class="template-list">
          <h4>Route Templates</h4>
          ${this.renderTemplateList()}
        </div>
        
        <div class="template-actions">
          <button class="btn btn-primary" onclick="operationsBulk.createNewTemplate()">
            Create New Template
          </button>
          <button class="btn btn-secondary" onclick="operationsBulk.importTemplate()">
            Import Template
          </button>
        </div>
      </div>
    `;
    
    const modal = uiSystem.createModal('template-manager', 'Template Manager', modalContent);
    uiSystem.openModal('template-manager');
  }

  // ===== OPERATION TRACKING =====

  /**
   * Start operation
   */
  startOperation(type, totalItems) {
    const operationId = this.generateId('operation');
    
    const operation = {
      id: operationId,
      type,
      totalItems,
      processedItems: 0,
      status: 'running',
      startTime: Date.now(),
      progress: 0
    };
    
    this.activeOperations.set(operationId, operation);
    
    // Create progress tracker
    this.createProgressTracker(operationId, operation);
    
    eventBus.emit('operation-started', operation);
    
    return operationId;
  }

  /**
   * Update progress
   */
  updateProgress(operationId, processedItems, totalItems) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    operation.processedItems = processedItems;
    operation.progress = Math.round((processedItems / totalItems) * 100);
    
    // Update progress tracker
    this.updateProgressTracker(operationId, operation);
    
    eventBus.emit('operation-progress', operation);
  }

  /**
   * Complete operation
   */
  completeOperation(operationId, results) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    operation.status = 'completed';
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.results = results;
    operation.progress = 100;
    
    // Move to history
    this.operationHistory.unshift(operation);
    this.activeOperations.delete(operationId);
    
    // Remove progress tracker
    this.removeProgressTracker(operationId);
    
    eventBus.emit('operation-completed', operation);
  }

  /**
   * Fail operation
   */
  failOperation(operationId, error) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    operation.status = 'failed';
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.error = error.message;
    
    // Move to history
    this.operationHistory.unshift(operation);
    this.activeOperations.delete(operationId);
    
    // Remove progress tracker
    this.removeProgressTracker(operationId);
    
    eventBus.emit('operation-failed', operation);
  }

  // ===== UTILITY METHODS =====

  /**
   * Create progress tracker
   */
  createProgressTracker(operationId, operation) {
    const tracker = document.createElement('div');
    tracker.className = 'progress-tracker';
    tracker.id = `progress-${operationId}`;
    
    tracker.innerHTML = `
      <div class="progress-info">
        <span class="operation-type">${operation.type}</span>
        <span class="progress-text">0%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
    `;
    
    this.progressTrackers.set(operationId, tracker);
    
    // Add to UI if progress container exists
    const container = document.querySelector('.progress-container');
    if (container) {
      container.appendChild(tracker);
    }
  }

  /**
   * Update progress tracker
   */
  updateProgressTracker(operationId, operation) {
    const tracker = this.progressTrackers.get(operationId);
    if (!tracker) return;
    
    const progressText = tracker.querySelector('.progress-text');
    const progressFill = tracker.querySelector('.progress-fill');
    
    if (progressText) {
      progressText.textContent = `${operation.progress}%`;
    }
    
    if (progressFill) {
      progressFill.style.width = `${operation.progress}%`;
    }
  }

  /**
   * Remove progress tracker
   */
  removeProgressTracker(operationId) {
    const tracker = this.progressTrackers.get(operationId);
    if (tracker) {
      tracker.remove();
      this.progressTrackers.delete(operationId);
    }
  }

  /**
   * Validate staff
   */
  validateStaff(staff) {
    if (!staff.name || !staff.role) {
      return { valid: false, message: 'Name and role are required' };
    }
    return { valid: true };
  }

  /**
   * Validate asset
   */
  validateAsset(asset) {
    if (!asset.number || !asset.type) {
      return { valid: false, message: 'Number and type are required' };
    }
    return { valid: true };
  }

  /**
   * Find existing assignment
   */
  findExistingAssignment(routeId, shift, date) {
    return (STATE.assignments || []).find(a => 
      a.routeId === routeId && a.shift === shift && a.date === date
    );
  }

  /**
   * Generate unique ID
   */
  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if date is in range
   */
  isInDateRange(date, range) {
    if (!date || !range) return false;
    
    const dateObj = new Date(date);
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    
    return dateObj >= startDate && dateObj <= endDate;
  }

  /**
   * Format date for filename
   */
  formatDateForFilename(date) {
    return date.toISOString().split('T')[0];
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

  /**
   * Convert report to CSV
   */
  convertReportToCSV(report) {
    // Implementation for CSV conversion
    return JSON.stringify(report); // Simplified for now
  }

  /**
   * Render active operations
   */
  renderActiveOperations() {
    if (this.activeOperations.size === 0) {
      return '<p class="no-operations">No active operations</p>';
    }
    
    return Array.from(this.activeOperations.values())
      .map(op => `
        <div class="operation-item">
          <span class="operation-type">${op.type}</span>
          <span class="operation-progress">${op.progress}%</span>
          <span class="operation-status">${op.status}</span>
        </div>
      `).join('');
  }

  /**
   * Render template list
   */
  renderTemplateList() {
    if (this.templates.size === 0) {
      return '<p class="no-templates">No templates available</p>';
    }
    
    return Array.from(this.templates.values())
      .map(template => `
        <div class="template-item" data-template-id="${template.id}">
          <h5>${template.name}</h5>
          <p>${template.description}</p>
          <div class="template-actions">
            <button class="btn btn-sm btn-primary" 
                    onclick="operationsBulk.applyTemplate('${template.id}')">Apply</button>
            <button class="btn btn-sm btn-secondary" 
                    onclick="operationsBulk.editTemplate('${template.id}')">Edit</button>
          </div>
        </div>
      `).join('');
  }

  /**
   * Load operation history
   */
  loadOperationHistory() {
    // Could load from localStorage or server
    console.log('🔄 Loading operation history');
  }

  /**
   * Setup bulk actions
   */
  setupBulkActions() {
    // Setup bulk action handlers
    console.log('🔄 Setting up bulk actions');
  }
}

// Create and export singleton instance
const operationsBulk = new OperationsBulk();

// Make available globally for inline event handlers
window.operationsBulk = operationsBulk;

export { operationsBulk };
