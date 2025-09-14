/**
 * FLEET SERVICE MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive fleet service and maintenance tracking system:
 * - Fleet service status monitoring
 * - Down list management (out-of-service assets)
 * - Spare assets tracking
 * - Service history and maintenance logs
 * - Service truck status and location
 * - Integration with asset management
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class FleetServiceManager {
  constructor() {
    this.serviceStatus = 'In Yard';
    this.downList = new Map();
    this.sparesList = new Map();
    this.serviceHistory = [];
    this.maintenanceLog = [];
    this.serviceLocation = null;
    this.serviceNotes = '';
    
    this.statusOptions = [
      'In Yard',
      'On Route',
      'At Service Call',
      'Returning',
      'Off Duty'
    ];
    
    // Don't initialize immediately - wait for explicit init call
    this.initialized = false;
  }

  /**
   * Initialize fleet service system
   */
  init() {
    if (this.initialized) {
      console.log('🔧 Fleet Service Manager already initialized');
      return;
    }
    
    this.setupEventListeners();
    this.loadServiceData();
    this.setupServiceModal();
    this.updateServiceDisplays();
    
    this.initialized = true;
    console.log('🔧 Fleet Service Manager initialized');
    eventBus.emit('fleet-service-ready');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for service status changes
    eventBus.on('update-fleet-service-status', (data) => this.updateFleetServiceStatus(data.status, data.notes));
    eventBus.on('set-service-location', (data) => this.setServiceLocation(data.location));
    
    // Listen for asset status changes
    eventBus.on('asset-status-changed', (data) => this.handleAssetStatusChange(data));
    eventBus.on('asset-down', (data) => this.addToDownList(data));
    eventBus.on('asset-repaired', (data) => this.removeFromDownList(data.assetId));
    
    // Listen for maintenance events
    eventBus.on('log-maintenance', (data) => this.logMaintenance(data));
    eventBus.on('schedule-maintenance', (data) => this.scheduleMaintenance(data));
    
    // Listen for service UI requests
    eventBus.on('open-fleet-service-modal', () => this.openFleetServiceModal());
    eventBus.on('open-maintenance-log-modal', () => this.openMaintenanceLogModal());
    
    // Listen for data updates
    eventBus.on('assets-updated', () => this.updateServiceDisplays());
    eventBus.on('routes-updated', () => this.updateSparesList());
  }

  // ===== FLEET SERVICE STATUS =====

  /**
   * Update fleet service status
   */
  updateFleetServiceStatus(status, notes = '') {
    console.log('🔧 Updating fleet service status to:', status);
    
    if (!this.statusOptions.includes(status)) {
      uiSystem.showNotification('Invalid service status', 'error');
      return false;
    }

    const oldStatus = this.serviceStatus;
    this.serviceStatus = status;
    this.serviceNotes = notes;
    
    // Record status change
    this.recordStatusChange(oldStatus, status, notes);
    
    // Update state
    this.updateServiceInState();
    
    // Show notification
    uiSystem.showNotification(`Fleet service status updated to: ${status}`, 'success');
    
    // Emit event
    eventBus.emit('fleet-service-status-changed', { 
      oldStatus, 
      newStatus: status, 
      notes 
    });
    
    // Update displays
    this.updateServiceDisplays();
    
    return true;
  }

  /**
   * Set service location
   */
  setServiceLocation(location) {
    console.log('🔧 Setting service location:', location);
    
    this.serviceLocation = location;
    this.updateServiceInState();
    
    eventBus.emit('fleet-service-location-changed', { location });
    this.updateServiceDisplays();
  }

  /**
   * Record status change in history
   */
  recordStatusChange(oldStatus, newStatus, notes) {
    const change = {
      id: Date.now().toString(),
      oldStatus,
      newStatus,
      notes,
      timestamp: new Date().toISOString(),
      user: 'System' // Would be actual user in real system
    };
    
    this.serviceHistory.unshift(change);
    
    // Keep only last 100 entries
    if (this.serviceHistory.length > 100) {
      this.serviceHistory = this.serviceHistory.slice(0, 100);
    }
  }

  // ===== DOWN LIST MANAGEMENT =====

  /**
   * Add asset to down list
   */
  addToDownList({ assetId, reason, severity = 'medium', estimatedRepairTime = null }) {
    console.log('🔧 Adding asset to down list:', assetId, reason);
    
    const asset = STATE.assets.find(a => a.id === assetId);
    if (!asset) {
      uiSystem.showNotification('Asset not found', 'error');
      return false;
    }

    const downEntry = {
      assetId,
      asset: asset,
      reason,
      severity,
      estimatedRepairTime,
      dateAdded: new Date().toISOString(),
      status: 'down',
      serviceTicket: this.generateServiceTicket(),
      notes: ''
    };
    
    this.downList.set(assetId, downEntry);
    
    // Update asset status
    asset.status = 'maintenance';
    asset.maintenanceReason = reason;
    
    // Log maintenance entry
    this.logMaintenance({
      assetId,
      type: 'breakdown',
      description: reason,
      severity,
      status: 'open'
    });
    
    // Update state and displays
    this.updateServiceInState();
    eventBus.emit('asset-added-to-down-list', { assetId, downEntry });
    this.updateServiceDisplays();
    
    uiSystem.showNotification(`Asset ${asset.number} added to down list`, 'warning');
    
    return true;
  }

  /**
   * Remove asset from down list
   */
  removeFromDownList(assetId) {
    console.log('🔧 Removing asset from down list:', assetId);
    
    const downEntry = this.downList.get(assetId);
    if (!downEntry) {
      uiSystem.showNotification('Asset not found in down list', 'error');
      return false;
    }

    const asset = STATE.assets.find(a => a.id === assetId);
    if (asset) {
      asset.status = 'available';
      asset.maintenanceReason = null;
    }
    
    // Record repair completion
    downEntry.dateRepaired = new Date().toISOString();
    downEntry.status = 'repaired';
    
    // Log maintenance completion
    this.logMaintenance({
      assetId,
      type: 'repair-completed',
      description: `Repair completed for: ${downEntry.reason}`,
      status: 'completed',
      serviceTicket: downEntry.serviceTicket
    });
    
    // Move to service history instead of deleting
    this.serviceHistory.unshift({
      id: Date.now().toString(),
      type: 'asset-repaired',
      assetId,
      asset: downEntry.asset,
      originalReason: downEntry.reason,
      downTime: this.calculateDownTime(downEntry.dateAdded, downEntry.dateRepaired),
      timestamp: new Date().toISOString()
    });
    
    this.downList.delete(assetId);
    
    // Update state and displays
    this.updateServiceInState();
    eventBus.emit('asset-removed-from-down-list', { assetId });
    this.updateServiceDisplays();
    
    uiSystem.showNotification(`Asset ${asset?.number || assetId} repaired and returned to service`, 'success');
    
    return true;
  }

  /**
   * Update down list entry
   */
  updateDownListEntry(assetId, updates) {
    const downEntry = this.downList.get(assetId);
    if (!downEntry) return false;
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        downEntry[key] = updates[key];
      }
    });
    
    downEntry.lastModified = new Date().toISOString();
    this.updateServiceInState();
    this.updateServiceDisplays();
    
    return true;
  }

  // ===== SPARES LIST MANAGEMENT =====

  /**
   * Update spares list
   */
  updateSparesList() {
    console.log('🔧 Updating spares list...');
    
    // Get all assets
    const allAssets = STATE.assets || [];
    
    // Get assigned assets from routes and field trips
    const assignedAssets = new Set();
    
    // Check route assignments
    if (STATE.routes) {
      STATE.routes.forEach(route => {
        if (route.asset) assignedAssets.add(route.asset);
        if (route.trailer) assignedAssets.add(route.trailer);
      });
    }
    
    // Check field trip assignments
    if (STATE.fieldTrips) {
      STATE.fieldTrips.forEach(ft => {
        if (ft.asset) assignedAssets.add(ft.asset);
        if (ft.trailer) assignedAssets.add(ft.trailer);
      });
    }
    
    // Find spare assets (available and not assigned)
    const spareAssets = allAssets.filter(asset => {
      return asset.status === 'available' && !assignedAssets.has(asset.id);
    });
    
    // Update spares map
    this.sparesList.clear();
    spareAssets.forEach(asset => {
      this.sparesList.set(asset.id, {
        asset,
        addedToSpares: new Date().toISOString(),
        lastMaintenance: asset.lastMaintenance || null
      });
    });
    
    eventBus.emit('spares-list-updated', { 
      spareCount: spareAssets.length,
      spareAssets 
    });
  }

  // ===== MAINTENANCE LOGGING =====

  /**
   * Log maintenance activity
   */
  logMaintenance({ assetId, type, description, severity = 'medium', status = 'open', serviceTicket = null }) {
    console.log('🔧 Logging maintenance:', assetId, type, description);
    
    const logEntry = {
      id: Date.now().toString(),
      assetId,
      type,
      description,
      severity,
      status,
      serviceTicket: serviceTicket || this.generateServiceTicket(),
      timestamp: new Date().toISOString(),
      completedAt: null,
      technician: null,
      parts: [],
      cost: null,
      notes: ''
    };
    
    this.maintenanceLog.unshift(logEntry);
    
    // Keep only last 500 entries
    if (this.maintenanceLog.length > 500) {
      this.maintenanceLog = this.maintenanceLog.slice(0, 500);
    }
    
    this.updateServiceInState();
    eventBus.emit('maintenance-logged', { logEntry });
    
    return logEntry;
  }

  /**
   * Complete maintenance entry
   */
  completeMaintenance(entryId, { technician = null, parts = [], cost = null, notes = '' }) {
    const entry = this.maintenanceLog.find(e => e.id === entryId);
    if (!entry) return false;
    
    entry.status = 'completed';
    entry.completedAt = new Date().toISOString();
    entry.technician = technician;
    entry.parts = parts;
    entry.cost = cost;
    entry.notes = notes;
    
    this.updateServiceInState();
    eventBus.emit('maintenance-completed', { entry });
    
    return true;
  }

  /**
   * Schedule maintenance
   */
  scheduleMaintenance({ assetId, type, description, scheduledDate, notes = '' }) {
    const maintenanceEntry = this.logMaintenance({
      assetId,
      type: 'scheduled',
      description: `Scheduled ${type}: ${description}`,
      status: 'scheduled'
    });
    
    maintenanceEntry.scheduledDate = scheduledDate;
    maintenanceEntry.notes = notes;
    
    uiSystem.showNotification(`Maintenance scheduled for asset`, 'success');
    
    return maintenanceEntry;
  }

  // ===== ASSET STATUS HANDLING =====

  /**
   * Handle asset status changes
   */
  handleAssetStatusChange({ assetId, newStatus, oldStatus, reason }) {
    console.log('🔧 Handling asset status change:', assetId, oldStatus, '->', newStatus);
    
    if (newStatus === 'maintenance' || newStatus === 'out-of-service') {
      // Add to down list if not already there
      if (!this.downList.has(assetId)) {
        this.addToDownList({
          assetId,
          reason: reason || 'Status changed to maintenance',
          severity: newStatus === 'out-of-service' ? 'high' : 'medium'
        });
      }
    } else if (oldStatus === 'maintenance' || oldStatus === 'out-of-service') {
      // Remove from down list if status improved
      if (this.downList.has(assetId)) {
        this.removeFromDownList(assetId);
      }
    }
    
    // Log status change
    this.logMaintenance({
      assetId,
      type: 'status-change',
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      status: 'completed'
    });
  }

  // ===== RENDERING =====

  /**
   * Render down list
   */
  renderDownList() {
    console.log('🔧 Rendering down list...');
    
    const downListContainer = document.getElementById('down-list');
    if (!downListContainer) {
      console.error('❌ Down list element not found');
      return;
    }

    const downAssets = Array.from(this.downList.values());
    
    if (downAssets.length === 0) {
      downListContainer.innerHTML = '<div class="text-gray-500 text-center py-4 text-base">No assets down</div>';
      return;
    }

    downListContainer.innerHTML = downAssets.map(entry => `
      <div class="down-asset-item severity-${entry.severity}" data-asset-id="${entry.assetId}">
        <div class="asset-info">
          <div class="asset-header">
            <span class="asset-number">Asset ${entry.asset.number}</span>
            <span class="severity-badge severity-${entry.severity}">${entry.severity.toUpperCase()}</span>
          </div>
          <div class="asset-details">
            <div class="asset-type">${entry.asset.type}</div>
            <div class="down-reason">${entry.reason}</div>
            <div class="down-time">Down: ${this.formatDownTime(entry.dateAdded)}</div>
            ${entry.estimatedRepairTime ? `<div class="estimated-repair">ETA: ${entry.estimatedRepairTime}</div>` : ''}
          </div>
        </div>
        
        <div class="down-actions">
          <button class="btn btn-sm btn-secondary" 
                  onclick="fleetServiceManager.openDownAssetModal('${entry.assetId}')">
            Details
          </button>
          <button class="btn btn-sm btn-success" 
                  onclick="fleetServiceManager.removeFromDownList('${entry.assetId}')">
            Repair Complete
          </button>
        </div>
        
        <div class="service-ticket">
          Ticket: ${entry.serviceTicket}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render spares list
   */
  renderSparesList() {
    console.log('🔧 Rendering spares list...');
    
    const sparesListContainer = document.getElementById('spares-list');
    if (!sparesListContainer) {
      console.error('❌ Spares list element not found');
      return;
    }

    const spareAssets = Array.from(this.sparesList.values());
    
    if (spareAssets.length === 0) {
      sparesListContainer.innerHTML = '<div class="text-gray-500 text-center py-4 text-base">No spare assets</div>';
      return;
    }

    sparesListContainer.innerHTML = spareAssets.map(entry => `
      <div class="spare-asset-item" data-asset-id="${entry.asset.id}">
        <div class="asset-info">
          <div class="asset-header">
            <span class="asset-number">Asset ${entry.asset.number}</span>
            <span class="availability-badge">Available</span>
          </div>
          <div class="asset-details">
            <div class="asset-type">${entry.asset.type}</div>
            <div class="spare-time">Spare: ${this.formatSpareTime(entry.addedToSpares)}</div>
            ${entry.lastMaintenance ? `<div class="last-maintenance">Last Service: ${this.formatDate(entry.lastMaintenance)}</div>` : ''}
          </div>
        </div>
        
        <div class="spare-actions">
          <button class="btn btn-sm btn-primary" 
                  onclick="fleetServiceManager.assignSpareAsset('${entry.asset.id}')">
            Assign
          </button>
          <button class="btn btn-sm btn-secondary" 
                  onclick="fleetServiceManager.scheduleMaintenanceModal('${entry.asset.id}')">
            Schedule Service
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render fleet service status
   */
  renderFleetService() {
    console.log('🔧 Rendering fleet service status...');
    
    const fleetServiceContainer = document.getElementById('fleet-service');
    if (!fleetServiceContainer) {
      console.error('❌ Fleet service element not found');
      return;
    }

    const statusClass = this.getServiceStatusClass(this.serviceStatus);
    const statusColor = this.getServiceStatusColor(this.serviceStatus);
    
    fleetServiceContainer.innerHTML = `
      <div class="fleet-service-status ${statusClass}">
        <div class="service-header">
          <h3>Fleet Service</h3>
          <button class="btn btn-sm btn-secondary" 
                  onclick="fleetServiceManager.openFleetServiceModal()">
            Update Status
          </button>
        </div>
        
        <div class="service-content">
          <div class="status-display">
            <div class="status-indicator" style="background-color: ${statusColor}"></div>
            <div class="status-text">
              <div class="current-status">${this.serviceStatus}</div>
              ${this.serviceLocation ? `<div class="service-location">Location: ${this.serviceLocation}</div>` : ''}
              ${this.serviceNotes ? `<div class="service-notes">Notes: ${this.serviceNotes}</div>` : ''}
            </div>
          </div>
          
          <div class="service-summary">
            <div class="summary-item">
              <span class="summary-label">Down Assets:</span>
              <span class="summary-value">${this.downList.size}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Spare Assets:</span>
              <span class="summary-value">${this.sparesList.size}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Open Tickets:</span>
              <span class="summary-value">${this.getOpenMaintenanceCount()}</span>
            </div>
          </div>
          
          <div class="service-actions">
            <button class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.openMaintenanceLogModal()">
              View Maintenance Log
            </button>
            <button class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.openServiceHistoryModal()">
              Service History
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ===== MODAL OPERATIONS =====

  /**
   * Open fleet service modal
   */
  openFleetServiceModal() {
    console.log('🔧 Opening fleet service modal');
    
    const modalContent = `
      <form class="fleet-service-form">
        <div class="form-group">
          <label for="service-status">Service Status:</label>
          <select id="service-status" required>
            ${this.statusOptions.map(status => `
              <option value="${status}" ${status === this.serviceStatus ? 'selected' : ''}>
                ${status}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="service-location">Current Location:</label>
          <input type="text" id="service-location" 
                 value="${this.serviceLocation || ''}" 
                 placeholder="Enter current location...">
        </div>
        
        <div class="form-group">
          <label for="service-notes">Notes:</label>
          <textarea id="service-notes" rows="3" 
                    placeholder="Status update notes...">${this.serviceNotes || ''}</textarea>
        </div>
        
        <div class="service-quick-actions">
          <h4>Quick Actions:</h4>
          <div class="quick-actions-grid">
            <button type="button" class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.setQuickStatus('On Route', 'Dispatched to service call')">
              Dispatch to Call
            </button>
            <button type="button" class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.setQuickStatus('Returning', 'Returning to yard')">
              Returning to Yard
            </button>
            <button type="button" class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.setQuickStatus('At Service Call', 'Arrived at location')">
              At Service Call
            </button>
            <button type="button" class="btn btn-sm btn-secondary" 
                    onclick="fleetServiceManager.setQuickStatus('Off Duty', 'Service completed for day')">
              End of Day
            </button>
          </div>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Status</button>
        </div>
      </form>
    `;
    
    const modal = uiSystem.createModal('fleet-service-modal', 'Fleet Service Status', modalContent);
    uiSystem.openModal('fleet-service-modal');
    
    this.setupFleetServiceModalHandlers();
  }

  /**
   * Close fleet service modal
   */
  closeFleetServiceModal() {
    console.log('🔧 Closing fleet service modal');
    uiSystem.closeCurrentModal();
  }

  /**
   * Select fleet service status (for quick actions)
   */
  selectFleetServiceStatus(status) {
    console.log('🔧 Selected fleet service status:', status);
    
    const statusSelect = document.getElementById('service-status');
    if (statusSelect) {
      statusSelect.value = status;
    }
  }

  /**
   * Set quick status
   */
  setQuickStatus(status, notes) {
    this.updateFleetServiceStatus(status, notes);
    this.closeFleetServiceModal();
  }

  /**
   * Setup fleet service modal handlers
   */
  setupServiceModal() {
    document.addEventListener('submit', (e) => {
      if (e.target.matches('.fleet-service-form')) {
        e.preventDefault();
        this.handleFleetServiceFormSubmission(e.target);
      }
    });
  }

  /**
   * Handle fleet service form submission
   */
  handleFleetServiceFormSubmission(form) {
    const status = form.querySelector('#service-status').value;
    const location = form.querySelector('#service-location').value;
    const notes = form.querySelector('#service-notes').value;
    
    this.updateFleetServiceStatus(status, notes);
    if (location) {
      this.setServiceLocation(location);
    }
    
    uiSystem.closeCurrentModal();
  }

  // ===== UTILITY METHODS =====

  /**
   * Update all service displays
   */
  updateServiceDisplays() {
    this.renderFleetService();
    this.renderDownList();
    this.updateSparesList();
    this.renderSparesList();
  }

  /**
   * Generate service ticket number
   */
  generateServiceTicket() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = date.getTime().toString().slice(-4);
    
    return `ST${year}${month}${day}${time}`;
  }

  /**
   * Calculate down time
   */
  calculateDownTime(startTime, endTime = null) {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else {
      return `${diffHours}h`;
    }
  }

  /**
   * Format down time for display
   */
  formatDownTime(startTime) {
    return this.calculateDownTime(startTime);
  }

  /**
   * Format spare time for display
   */
  formatSpareTime(startTime) {
    return this.calculateDownTime(startTime);
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  /**
   * Get service status CSS class
   */
  getServiceStatusClass(status) {
    const statusClasses = {
      'In Yard': 'status-idle',
      'On Route': 'status-active',
      'At Service Call': 'status-busy',
      'Returning': 'status-active',
      'Off Duty': 'status-offline'
    };
    return statusClasses[status] || 'status-unknown';
  }

  /**
   * Get service status color
   */
  getServiceStatusColor(status) {
    const statusColors = {
      'In Yard': '#6B7280',
      'On Route': '#3B82F6',
      'At Service Call': '#EF4444',
      'Returning': '#10B981',
      'Off Duty': '#374151'
    };
    return statusColors[status] || '#6B7280';
  }

  /**
   * Get count of open maintenance tickets
   */
  getOpenMaintenanceCount() {
    return this.maintenanceLog.filter(entry => 
      entry.status === 'open' || entry.status === 'in-progress'
    ).length;
  }

  /**
   * Update service data in state
   */
  updateServiceInState() {
    STATE.fleetService = {
      status: this.serviceStatus,
      location: this.serviceLocation,
      notes: this.serviceNotes,
      downList: Object.fromEntries(this.downList),
      sparesList: Object.fromEntries(this.sparesList),
      serviceHistory: this.serviceHistory,
      maintenanceLog: this.maintenanceLog
    };
    
    eventBus.emit('state-updated', { module: 'fleetService' });
  }

  /**
   * Load service data from state
   */
  loadServiceData() {
    const serviceData = STATE.fleetService || {};
    
    this.serviceStatus = serviceData.status || 'In Yard';
    this.serviceLocation = serviceData.location || null;
    this.serviceNotes = serviceData.notes || '';
    this.serviceHistory = serviceData.serviceHistory || [];
    this.maintenanceLog = serviceData.maintenanceLog || [];
    
    if (serviceData.downList) {
      this.downList = new Map(Object.entries(serviceData.downList));
    }
    
    if (serviceData.sparesList) {
      this.sparesList = new Map(Object.entries(serviceData.sparesList));
    }
    
    console.log(`🔧 Loaded fleet service data: ${this.downList.size} down, ${this.sparesList.size} spare`);
  }

  /**
   * Additional modal operations
   */
  openMaintenanceLogModal() {
    console.log('🔧 Opening maintenance log modal...');
    // Implementation for maintenance log modal
  }

  openServiceHistoryModal() {
    console.log('🔧 Opening service history modal...');
    // Implementation for service history modal
  }

  openDownAssetModal(assetId) {
    console.log('🔧 Opening down asset details modal for:', assetId);
    // Implementation for down asset details modal
  }

  assignSpareAsset(assetId) {
    console.log('🔧 Assigning spare asset:', assetId);
    // Integration with assignment system
    eventBus.emit('open-assignment-modal', {
      targetId: assetId,
      targetType: 'asset',
      assignmentType: 'asset',
      itemType: 'asset'
    });
  }

  scheduleMaintenanceModal(assetId) {
    console.log('🔧 Opening schedule maintenance modal for:', assetId);
    // Implementation for maintenance scheduling modal
  }
}

// Create and export singleton instance
const fleetServiceManager = new FleetServiceManager();

// Make available globally for inline event handlers
window.fleetServiceManager = fleetServiceManager;

export { fleetServiceManager };
