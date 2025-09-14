/**
 * OPERATIONS ASSIGNMENTS MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive assignment management system for:
 * - Staff to route assignments
 * - Asset to route assignments
 * - Field trip assignments (staff, assets, trailers)
 * - Assignment validation and conflict resolution
 * - Assignment history and tracking
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class AssignmentManager {
  constructor() {
    this.assignments = {
      routes: new Map(), // routeId -> { driver, escorts: [], asset, trailer }
      fieldTrips: new Map(), // fieldTripId -> { driver, escorts: [], asset, trailer }
      staff: new Map(), // staffId -> { type: 'route'|'fieldTrip', assignmentId, role }
      assets: new Map() // assetId -> { type: 'route'|'fieldTrip', assignmentId }
    };
    
    this.assignmentHistory = [];
    this.conflictResolver = new ConflictResolver();
    this.validationRules = new AssignmentValidation();
    
    // Don't initialize immediately - wait for explicit init call
    this.initialized = false;
  }

  /**
   * Initialize assignment system
   */
  init() {
    if (this.initialized) {
      console.log('📋 Assignment Manager already initialized');
      return;
    }
    
    this.setupEventListeners();
    this.loadAssignments();
    this.setupAssignmentModal();
    
    this.initialized = true;
    console.log('📋 Assignment Manager initialized');
    eventBus.emit('assignments-ready');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for assignment requests
    eventBus.on('assign-staff-to-route', (data) => this.assignStaffToRoute(data));
    eventBus.on('assign-asset-to-route', (data) => this.assignAssetToRoute(data));
    eventBus.on('assign-to-field-trip', (data) => this.assignToFieldTrip(data));
    
    // Listen for assignment removals
    eventBus.on('clear-assignment', (data) => this.clearAssignment(data));
    eventBus.on('clear-field-trip-assignment', (data) => this.clearFieldTripAssignment(data));
    
    // Listen for data changes
    eventBus.on('routes-updated', () => this.validateAllAssignments());
    eventBus.on('staff-updated', () => this.validateAllAssignments());
    eventBus.on('assets-updated', () => this.validateAllAssignments());
    
    // Listen for assignment modal requests
    eventBus.on('open-assignment-modal', (data) => this.openAssignmentModal(data));
  }

  // ===== ROUTE ASSIGNMENTS =====

  /**
   * Assign staff member to route
   */
  assignStaffToRoute({ routeId, staffId, role = 'driver' }) {
    console.log(`📋 Assigning staff ${staffId} to route ${routeId} as ${role}`);
    
    // Validate assignment
    const validation = this.validationRules.validateStaffToRoute(staffId, routeId, role);
    if (!validation.valid) {
      uiSystem.showNotification(validation.message, 'error');
      return false;
    }

    // Check for conflicts
    const conflicts = this.conflictResolver.checkStaffConflicts(staffId, routeId, role);
    if (conflicts.length > 0) {
      return this.handleAssignmentConflicts(conflicts, {
        type: 'staff-to-route',
        staffId,
        routeId,
        role
      });
    }

    // Clear any existing assignment for this staff member
    this.clearStaffAssignment(staffId);

    // Make the assignment
    const assignment = this.getRouteAssignment(routeId);
    
    if (role === 'driver') {
      assignment.driver = staffId;
    } else if (role === 'escort') {
      if (!assignment.escorts) assignment.escorts = [];
      assignment.escorts.push(staffId);
    }

    // Update staff assignment tracking
    this.assignments.staff.set(staffId, {
      type: 'route',
      assignmentId: routeId,
      role: role
    });

    // Record in history
    this.recordAssignment({
      type: 'staff-to-route',
      staffId,
      routeId,
      role,
      timestamp: new Date().toISOString()
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('assignment-created', { type: 'staff-to-route', staffId, routeId, role });
    uiSystem.showNotification(`Staff assigned to route successfully`, 'success');
    
    return true;
  }

  /**
   * Assign asset to route
   */
  assignAssetToRoute({ routeId, assetId, assetType = 'bus' }) {
    console.log(`📋 Assigning asset ${assetId} to route ${routeId} as ${assetType}`);
    
    // Validate assignment
    const validation = this.validationRules.validateAssetToRoute(assetId, routeId, assetType);
    if (!validation.valid) {
      uiSystem.showNotification(validation.message, 'error');
      return false;
    }

    // Check for conflicts
    const conflicts = this.conflictResolver.checkAssetConflicts(assetId, routeId);
    if (conflicts.length > 0) {
      return this.handleAssignmentConflicts(conflicts, {
        type: 'asset-to-route',
        assetId,
        routeId,
        assetType
      });
    }

    // Clear any existing assignment for this asset
    this.clearAssetAssignment(assetId);

    // Make the assignment
    const assignment = this.getRouteAssignment(routeId);
    
    if (assetType === 'trailer') {
      assignment.trailer = assetId;
    } else {
      assignment.asset = assetId;
      // Clear trailer if changing primary asset
      assignment.trailer = null;
    }

    // Update asset assignment tracking
    this.assignments.assets.set(assetId, {
      type: 'route',
      assignmentId: routeId
    });

    // Record in history
    this.recordAssignment({
      type: 'asset-to-route',
      assetId,
      routeId,
      assetType,
      timestamp: new Date().toISOString()
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('assignment-created', { type: 'asset-to-route', assetId, routeId, assetType });
    uiSystem.showNotification(`Asset assigned to route successfully`, 'success');
    
    return true;
  }

  // ===== FIELD TRIP ASSIGNMENTS =====

  /**
   * Assign staff or asset to field trip
   */
  assignToFieldTrip({ fieldTripId, itemId, itemType, role = 'driver' }) {
    console.log(`📋 Assigning ${itemType} ${itemId} to field trip ${fieldTripId}`);
    
    if (itemType === 'staff') {
      return this.assignStaffToFieldTrip(fieldTripId, itemId, role);
    } else if (itemType === 'asset') {
      return this.assignAssetToFieldTrip(fieldTripId, itemId, role);
    }
    
    return false;
  }

  /**
   * Assign staff to field trip
   */
  assignStaffToFieldTrip(fieldTripId, staffId, role = 'driver') {
    // Validate assignment
    const validation = this.validationRules.validateStaffToFieldTrip(staffId, fieldTripId, role);
    if (!validation.valid) {
      uiSystem.showNotification(validation.message, 'error');
      return false;
    }

    // Check for conflicts
    const conflicts = this.conflictResolver.checkStaffConflicts(staffId, fieldTripId, role, 'fieldTrip');
    if (conflicts.length > 0) {
      return this.handleAssignmentConflicts(conflicts, {
        type: 'staff-to-fieldTrip',
        staffId,
        fieldTripId,
        role
      });
    }

    // Clear any existing assignment for this staff member
    this.clearStaffAssignment(staffId);

    // Make the assignment
    const assignment = this.getFieldTripAssignment(fieldTripId);
    
    if (role === 'driver') {
      assignment.driver = staffId;
    } else if (role === 'escort') {
      if (!assignment.escorts) assignment.escorts = [];
      assignment.escorts.push(staffId);
    }

    // Update staff assignment tracking
    this.assignments.staff.set(staffId, {
      type: 'fieldTrip',
      assignmentId: fieldTripId,
      role: role
    });

    // Record in history
    this.recordAssignment({
      type: 'staff-to-fieldTrip',
      staffId,
      fieldTripId,
      role,
      timestamp: new Date().toISOString()
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('assignment-created', { type: 'staff-to-fieldTrip', staffId, fieldTripId, role });
    uiSystem.showNotification(`Staff assigned to field trip successfully`, 'success');
    
    return true;
  }

  /**
   * Assign asset to field trip
   */
  assignAssetToFieldTrip(fieldTripId, assetId, assetType = 'bus') {
    // Validate assignment
    const validation = this.validationRules.validateAssetToFieldTrip(assetId, fieldTripId, assetType);
    if (!validation.valid) {
      uiSystem.showNotification(validation.message, 'error');
      return false;
    }

    // Check for conflicts
    const conflicts = this.conflictResolver.checkAssetConflicts(assetId, fieldTripId, 'fieldTrip');
    if (conflicts.length > 0) {
      return this.handleAssignmentConflicts(conflicts, {
        type: 'asset-to-fieldTrip',
        assetId,
        fieldTripId,
        assetType
      });
    }

    // Clear any existing assignment for this asset
    this.clearAssetAssignment(assetId);

    // Make the assignment
    const assignment = this.getFieldTripAssignment(fieldTripId);
    
    if (assetType === 'trailer') {
      assignment.trailer = assetId;
    } else {
      assignment.asset = assetId;
      // When assigning asset, clear trailer
      if (assetType === 'asset') {
        assignment.trailer = null;
      }
    }

    // Update asset assignment tracking
    this.assignments.assets.set(assetId, {
      type: 'fieldTrip',
      assignmentId: fieldTripId
    });

    // Record in history
    this.recordAssignment({
      type: 'asset-to-fieldTrip',
      assetId,
      fieldTripId,
      assetType,
      timestamp: new Date().toISOString()
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('assignment-created', { type: 'asset-to-fieldTrip', assetId, fieldTripId, assetType });
    uiSystem.showNotification(`Asset assigned to field trip successfully`, 'success');
    
    return true;
  }

  // ===== ASSIGNMENT CLEARING =====

  /**
   * Clear assignment from route
   */
  clearAssignment({ routeId, type, itemId = null }) {
    console.log(`📋 Clearing ${type} assignment from route ${routeId}`);
    
    const assignment = this.getRouteAssignment(routeId);
    if (!assignment) return false;

    let clearedItems = [];

    switch (type) {
      case 'driver':
        if (assignment.driver) {
          clearedItems.push({ type: 'staff', id: assignment.driver, role: 'driver' });
          this.assignments.staff.delete(assignment.driver);
          assignment.driver = null;
        }
        break;
        
      case 'escort':
        if (itemId && assignment.escorts) {
          const index = assignment.escorts.indexOf(itemId);
          if (index > -1) {
            assignment.escorts.splice(index, 1);
            clearedItems.push({ type: 'staff', id: itemId, role: 'escort' });
            this.assignments.staff.delete(itemId);
          }
        } else if (assignment.escorts) {
          // Clear all escorts
          assignment.escorts.forEach(escortId => {
            clearedItems.push({ type: 'staff', id: escortId, role: 'escort' });
            this.assignments.staff.delete(escortId);
          });
          assignment.escorts = [];
        }
        break;
        
      case 'asset':
        if (assignment.asset) {
          clearedItems.push({ type: 'asset', id: assignment.asset });
          this.assignments.assets.delete(assignment.asset);
          assignment.asset = null;
        }
        // Also clear trailer when clearing asset
        if (assignment.trailer) {
          clearedItems.push({ type: 'asset', id: assignment.trailer });
          this.assignments.assets.delete(assignment.trailer);
          assignment.trailer = null;
        }
        break;
        
      case 'trailer':
        if (assignment.trailer) {
          clearedItems.push({ type: 'asset', id: assignment.trailer });
          this.assignments.assets.delete(assignment.trailer);
          assignment.trailer = null;
        }
        break;
    }

    // Record clearance in history
    clearedItems.forEach(item => {
      this.recordAssignment({
        type: 'clear-assignment',
        routeId,
        itemType: item.type,
        itemId: item.id,
        role: item.role,
        timestamp: new Date().toISOString()
      });
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('assignment-cleared', { routeId, type, clearedItems });
    uiSystem.showNotification(`Assignment cleared successfully`, 'success');
    
    return true;
  }

  /**
   * Clear field trip assignment
   */
  clearFieldTripAssignment({ fieldTripId, type, itemId = null }) {
    console.log(`📋 Clearing ${type} assignment from field trip ${fieldTripId}`);
    
    const assignment = this.getFieldTripAssignment(fieldTripId);
    if (!assignment) return false;

    let clearedItems = [];

    switch (type) {
      case 'driver':
        if (assignment.driver) {
          clearedItems.push({ type: 'staff', id: assignment.driver, role: 'driver' });
          this.assignments.staff.delete(assignment.driver);
          assignment.driver = null;
        }
        break;
        
      case 'escort':
        if (itemId && assignment.escorts) {
          const index = assignment.escorts.indexOf(itemId);
          if (index > -1) {
            assignment.escorts.splice(index, 1);
            clearedItems.push({ type: 'staff', id: itemId, role: 'escort' });
            this.assignments.staff.delete(itemId);
          }
        } else if (assignment.escorts) {
          assignment.escorts.forEach(escortId => {
            clearedItems.push({ type: 'staff', id: escortId, role: 'escort' });
            this.assignments.staff.delete(escortId);
          });
          assignment.escorts = [];
        }
        break;
        
      case 'asset':
        if (assignment.asset) {
          clearedItems.push({ type: 'asset', id: assignment.asset });
          this.assignments.assets.delete(assignment.asset);
          assignment.asset = null;
        }
        // Also clear trailer when clearing asset
        if (assignment.trailer) {
          clearedItems.push({ type: 'asset', id: assignment.trailer });
          this.assignments.assets.delete(assignment.trailer);
          assignment.trailer = null;
        }
        break;
        
      case 'trailer':
        if (assignment.trailer) {
          clearedItems.push({ type: 'asset', id: assignment.trailer });
          this.assignments.assets.delete(assignment.trailer);
          assignment.trailer = null;
        }
        break;
    }

    // Record clearance in history
    clearedItems.forEach(item => {
      this.recordAssignment({
        type: 'clear-fieldTrip-assignment',
        fieldTripId,
        itemType: item.type,
        itemId: item.id,
        role: item.role,
        timestamp: new Date().toISOString()
      });
    });

    // Update state and notify
    this.saveAssignments();
    eventBus.emit('fieldTrip-assignment-cleared', { fieldTripId, type, clearedItems });
    uiSystem.showNotification(`Field trip assignment cleared successfully`, 'success');
    
    return true;
  }

  // ===== ASSIGNMENT QUERIES =====

  /**
   * Check if staff member is assigned
   */
  isStaffAssigned(staffId) {
    return this.assignments.staff.has(staffId);
  }

  /**
   * Check if asset is assigned
   */
  isAssetAssigned(assetId) {
    return this.assignments.assets.has(assetId);
  }

  /**
   * Get staff assignment details
   */
  getStaffAssignment(staffId) {
    return this.assignments.staff.get(staffId) || null;
  }

  /**
   * Get asset assignment details
   */
  getAssetAssignment(assetId) {
    return this.assignments.assets.get(assetId) || null;
  }

  /**
   * Check if item is currently assigned (with exclusions)
   */
  isItemCurrentlyAssigned(itemId, itemType, excludeAssignmentId = null, excludeType = null) {
    const assignment = itemType === 'staff' 
      ? this.getStaffAssignment(itemId)
      : this.getAssetAssignment(itemId);
      
    if (!assignment) return false;
    
    // Check if this assignment should be excluded
    if (excludeAssignmentId && assignment.assignmentId === excludeAssignmentId) {
      if (!excludeType || assignment.type === excludeType) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if item is assigned to specific field trip
   */
  isItemCurrentlyAssignedToFieldTrip(itemId, itemType, excludeFieldTripId = null) {
    const assignment = itemType === 'staff' 
      ? this.getStaffAssignment(itemId)
      : this.getAssetAssignment(itemId);
      
    if (!assignment || assignment.type !== 'fieldTrip') return false;
    
    // Exclude specific field trip if specified
    if (excludeFieldTripId && assignment.assignmentId === excludeFieldTripId) {
      return false;
    }
    
    return true;
  }

  /**
   * Get route assignment
   */
  getRouteAssignment(routeId) {
    if (!this.assignments.routes.has(routeId)) {
      this.assignments.routes.set(routeId, {
        driver: null,
        escorts: [],
        asset: null,
        trailer: null
      });
    }
    return this.assignments.routes.get(routeId);
  }

  /**
   * Get field trip assignment
   */
  getFieldTripAssignment(fieldTripId) {
    if (!this.assignments.fieldTrips.has(fieldTripId)) {
      this.assignments.fieldTrips.set(fieldTripId, {
        driver: null,
        escorts: [],
        asset: null,
        trailer: null
      });
    }
    return this.assignments.fieldTrips.get(fieldTripId);
  }

  /**
   * Get all assignments for specific route
   */
  getRouteAssignments(routeId) {
    return this.getRouteAssignment(routeId);
  }

  /**
   * Get all assignments for specific field trip
   */
  getFieldTripAssignments(fieldTripId) {
    return this.getFieldTripAssignment(fieldTripId);
  }

  // ===== ASSIGNMENT MODAL =====

  /**
   * Open assignment modal
   */
  openAssignmentModal({ targetId, targetType, assignmentType, itemType }) {
    console.log(`📋 Opening assignment modal: ${targetType} ${targetId}, ${assignmentType} ${itemType}`);
    
    const modalContent = this.generateAssignmentModalContent({
      targetId,
      targetType, 
      assignmentType,
      itemType
    });
    
    const modal = uiSystem.createModal('assignment-modal', 'Assignment', modalContent);
    uiSystem.openModal('assignment-modal');
    
    this.setupAssignmentModalHandlers(targetId, targetType, assignmentType, itemType);
  }

  /**
   * Generate assignment modal content
   */
  generateAssignmentModalContent({ targetId, targetType, assignmentType, itemType }) {
    const availableItems = this.getAvailableItems(itemType, targetId, targetType);
    const currentAssignments = targetType === 'route' 
      ? this.getRouteAssignment(targetId)
      : this.getFieldTripAssignment(targetId);
    
    return `
      <form class="assignment-form">
        <div class="form-group">
          <label for="assignment-select">Select ${itemType}:</label>
          <select id="assignment-select" required>
            <option value="">Choose ${itemType}...</option>
            ${availableItems.map(item => `
              <option value="${item.id}">
                ${item.name} ${item.details ? `(${item.details})` : ''}
              </option>
            `).join('')}
          </select>
        </div>
        
        ${assignmentType === 'staff' ? `
          <div class="form-group">
            <label for="staff-role">Role:</label>
            <select id="staff-role" required>
              <option value="driver">Driver</option>
              <option value="escort">Escort</option>
            </select>
          </div>
        ` : ''}
        
        ${assignmentType === 'asset' ? `
          <div class="form-group">
            <label for="asset-type">Asset Type:</label>
            <select id="asset-type" required>
              <option value="bus">Bus</option>
              <option value="trailer">Trailer</option>
            </select>
          </div>
        ` : ''}
        
        <div class="current-assignments">
          <h4>Current Assignments:</h4>
          ${this.renderCurrentAssignments(currentAssignments)}
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Assign</button>
        </div>
      </form>
    `;
  }

  /**
   * Setup assignment modal event handlers
   */
  setupAssignmentModal() {
    // Modal form submission
    document.addEventListener('submit', (e) => {
      if (e.target.matches('.assignment-form')) {
        e.preventDefault();
        this.handleAssignmentFormSubmission(e.target);
      }
    });
  }

  /**
   * Handle assignment form submission
   */
  handleAssignmentFormSubmission(form) {
    const formData = new FormData(form);
    const modal = form.closest('.modal-overlay');
    
    // Extract assignment data from modal data attributes or form
    const targetId = modal.dataset.targetId;
    const targetType = modal.dataset.targetType;
    const assignmentType = modal.dataset.assignmentType;
    
    const itemId = form.querySelector('#assignment-select').value;
    const role = form.querySelector('#staff-role')?.value || 'driver';
    const assetType = form.querySelector('#asset-type')?.value || 'bus';
    
    if (!itemId) {
      uiSystem.showNotification('Please select an item to assign', 'error');
      return;
    }
    
    // Perform assignment
    let success = false;
    
    if (targetType === 'route') {
      if (assignmentType === 'staff') {
        success = this.assignStaffToRoute({ routeId: targetId, staffId: itemId, role });
      } else if (assignmentType === 'asset') {
        success = this.assignAssetToRoute({ routeId: targetId, assetId: itemId, assetType });
      }
    } else if (targetType === 'fieldTrip') {
      success = this.assignToFieldTrip({ 
        fieldTripId: targetId, 
        itemId, 
        itemType: assignmentType,
        role: assignmentType === 'staff' ? role : assetType
      });
    }
    
    if (success) {
      uiSystem.closeCurrentModal();
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Clear staff assignment
   */
  clearStaffAssignment(staffId) {
    const currentAssignment = this.assignments.staff.get(staffId);
    if (!currentAssignment) return;
    
    if (currentAssignment.type === 'route') {
      this.clearAssignment({
        routeId: currentAssignment.assignmentId,
        type: currentAssignment.role,
        itemId: staffId
      });
    } else if (currentAssignment.type === 'fieldTrip') {
      this.clearFieldTripAssignment({
        fieldTripId: currentAssignment.assignmentId,
        type: currentAssignment.role,
        itemId: staffId
      });
    }
  }

  /**
   * Clear asset assignment
   */
  clearAssetAssignment(assetId) {
    const currentAssignment = this.assignments.assets.get(assetId);
    if (!currentAssignment) return;
    
    // Determine asset type by checking which field it's assigned to
    let assetType = 'asset';
    if (currentAssignment.type === 'route') {
      const routeAssignment = this.getRouteAssignment(currentAssignment.assignmentId);
      if (routeAssignment.trailer === assetId) assetType = 'trailer';
    } else if (currentAssignment.type === 'fieldTrip') {
      const fieldTripAssignment = this.getFieldTripAssignment(currentAssignment.assignmentId);
      if (fieldTripAssignment.trailer === assetId) assetType = 'trailer';
    }
    
    if (currentAssignment.type === 'route') {
      this.clearAssignment({
        routeId: currentAssignment.assignmentId,
        type: assetType,
        itemId: assetId
      });
    } else if (currentAssignment.type === 'fieldTrip') {
      this.clearFieldTripAssignment({
        fieldTripId: currentAssignment.assignmentId,
        type: assetType,
        itemId: assetId
      });
    }
  }

  /**
   * Get available items for assignment
   */
  getAvailableItems(itemType, excludeTargetId, excludeTargetType) {
    if (itemType === 'staff') {
      return STATE.staff
        .filter(staff => {
          // Include available staff and those assigned to the current target
          if (staff.status !== 'available' && !this.isStaffAssigned(staff.id)) return false;
          
          const assignment = this.getStaffAssignment(staff.id);
          if (assignment && assignment.assignmentId === excludeTargetId && assignment.type === excludeTargetType) {
            return true; // Include if already assigned to this target
          }
          
          return !this.isStaffAssigned(staff.id);
        })
        .map(staff => ({
          id: staff.id,
          name: staff.name,
          details: `${staff.role} - ${staff.status}`
        }));
    } else if (itemType === 'asset') {
      return STATE.assets
        .filter(asset => {
          // Exclude trailers from regular asset assignment
          if (asset.type && asset.type.toLowerCase().includes('trailer')) return false;
          
          // Include available assets and those assigned to the current target
          if (asset.status !== 'available' && !this.isAssetAssigned(asset.id)) return false;
          
          const assignment = this.getAssetAssignment(asset.id);
          if (assignment && assignment.assignmentId === excludeTargetId && assignment.type === excludeTargetType) {
            return true; // Include if already assigned to this target
          }
          
          return !this.isAssetAssigned(asset.id);
        })
        .map(asset => ({
          id: asset.id,
          name: asset.number,
          details: `${asset.type} - ${asset.status}`
        }));
    }
    
    return [];
  }

  /**
   * Render current assignments
   */
  renderCurrentAssignments(assignments) {
    const items = [];
    
    if (assignments.driver) {
      const staff = STATE.staff.find(s => s.id === assignments.driver);
      items.push(`<div class="assignment-item">Driver: ${staff ? staff.name : 'Unknown'}</div>`);
    }
    
    if (assignments.escorts && assignments.escorts.length > 0) {
      assignments.escorts.forEach(escortId => {
        const staff = STATE.staff.find(s => s.id === escortId);
        items.push(`<div class="assignment-item">Escort: ${staff ? staff.name : 'Unknown'}</div>`);
      });
    }
    
    if (assignments.asset) {
      const asset = STATE.assets.find(a => a.id === assignments.asset);
      items.push(`<div class="assignment-item">Asset: ${asset ? asset.number : 'Unknown'}</div>`);
    }
    
    if (assignments.trailer) {
      const trailer = STATE.assets.find(a => a.id === assignments.trailer);
      items.push(`<div class="assignment-item">Trailer: ${trailer ? trailer.number : 'Unknown'}</div>`);
    }
    
    return items.length > 0 ? items.join('') : '<div class="no-assignments">No current assignments</div>';
  }

  /**
   * Record assignment in history
   */
  recordAssignment(assignment) {
    this.assignmentHistory.push(assignment);
    
    // Keep only last 1000 entries
    if (this.assignmentHistory.length > 1000) {
      this.assignmentHistory = this.assignmentHistory.slice(-1000);
    }
  }

  /**
   * Handle assignment conflicts
   */
  handleAssignmentConflicts(conflicts, pendingAssignment) {
    const conflictMessages = conflicts.map(c => c.message).join('\n');
    const message = `Assignment conflicts detected:\n${conflictMessages}\n\nDo you want to proceed and clear conflicting assignments?`;
    
    if (confirm(message)) {
      // Clear conflicting assignments
      conflicts.forEach(conflict => {
        if (conflict.type === 'staff') {
          this.clearStaffAssignment(conflict.itemId);
        } else if (conflict.type === 'asset') {
          this.clearAssetAssignment(conflict.itemId);
        }
      });
      
      // Retry the assignment
      return this.retryAssignment(pendingAssignment);
    }
    
    return false;
  }

  /**
   * Retry assignment after clearing conflicts
   */
  retryAssignment(assignment) {
    switch (assignment.type) {
      case 'staff-to-route':
        return this.assignStaffToRoute(assignment);
      case 'asset-to-route':
        return this.assignAssetToRoute(assignment);
      case 'staff-to-fieldTrip':
        return this.assignStaffToFieldTrip(assignment.fieldTripId, assignment.staffId, assignment.role);
      case 'asset-to-fieldTrip':
        return this.assignAssetToFieldTrip(assignment.fieldTripId, assignment.assetId, assignment.assetType);
    }
    return false;
  }

  /**
   * Validate all assignments
   */
  validateAllAssignments() {
    // This would check for data inconsistencies and fix them
    console.log('📋 Validating all assignments...');
    
    // Implementation would go through all assignments and verify they're still valid
    // Remove assignments for non-existent routes, staff, or assets
    // This is called when data is updated to maintain consistency
  }

  /**
   * Load assignments from state
   */
  loadAssignments() {
    const savedAssignments = STATE.assignments || {};
    
    if (savedAssignments.routes) {
      this.assignments.routes = new Map(Object.entries(savedAssignments.routes));
    }
    if (savedAssignments.fieldTrips) {
      this.assignments.fieldTrips = new Map(Object.entries(savedAssignments.fieldTrips));
    }
    if (savedAssignments.staff) {
      this.assignments.staff = new Map(Object.entries(savedAssignments.staff));
    }
    if (savedAssignments.assets) {
      this.assignments.assets = new Map(Object.entries(savedAssignments.assets));
    }
    
    this.assignmentHistory = savedAssignments.history || [];
  }

  /**
   * Save assignments to state
   */
  saveAssignments() {
    STATE.assignments = {
      routes: Object.fromEntries(this.assignments.routes),
      fieldTrips: Object.fromEntries(this.assignments.fieldTrips),
      staff: Object.fromEntries(this.assignments.staff),
      assets: Object.fromEntries(this.assignments.assets),
      history: this.assignmentHistory
    };
    
    eventBus.emit('state-updated', { module: 'assignments' });
  }
}

/**
 * Assignment validation rules
 */
class AssignmentValidation {
  validateStaffToRoute(staffId, routeId, role) {
    const staff = STATE.staff.find(s => s.id === staffId);
    const route = STATE.routes.find(r => r.id === routeId);
    
    if (!staff) {
      return { valid: false, message: 'Staff member not found' };
    }
    
    if (!route) {
      return { valid: false, message: 'Route not found' };
    }
    
    if (staff.status === 'out') {
      return { valid: false, message: 'Staff member is currently out' };
    }
    
    if (role === 'driver' && !staff.canDrive) {
      return { valid: false, message: 'Staff member is not authorized to drive' };
    }
    
    return { valid: true };
  }
  
  validateAssetToRoute(assetId, routeId, assetType) {
    const asset = STATE.assets.find(a => a.id === assetId);
    const route = STATE.routes.find(r => r.id === routeId);
    
    if (!asset) {
      return { valid: false, message: 'Asset not found' };
    }
    
    if (!route) {
      return { valid: false, message: 'Route not found' };
    }
    
    if (asset.status === 'maintenance' || asset.status === 'out-of-service') {
      return { valid: false, message: 'Asset is not available for assignment' };
    }
    
    return { valid: true };
  }
  
  validateStaffToFieldTrip(staffId, fieldTripId, role) {
    // Similar validation for field trips
    return this.validateStaffToRoute(staffId, fieldTripId, role);
  }
  
  validateAssetToFieldTrip(assetId, fieldTripId, assetType) {
    // Similar validation for field trips
    return this.validateAssetToRoute(assetId, fieldTripId, assetType);
  }
}

/**
 * Conflict resolution system
 */
class ConflictResolver {
  checkStaffConflicts(staffId, targetId, role, targetType = 'route') {
    const conflicts = [];
    const staff = STATE.staff.find(s => s.id === staffId);
    
    if (!staff) return conflicts;
    
    // Check if staff is already assigned elsewhere
    const existingAssignment = assignmentManager.getStaffAssignment(staffId);
    if (existingAssignment && 
        !(existingAssignment.assignmentId === targetId && existingAssignment.type === targetType)) {
      conflicts.push({
        type: 'staff',
        itemId: staffId,
        message: `${staff.name} is already assigned to ${existingAssignment.type} ${existingAssignment.assignmentId}`
      });
    }
    
    return conflicts;
  }
  
  checkAssetConflicts(assetId, targetId, targetType = 'route') {
    const conflicts = [];
    const asset = STATE.assets.find(a => a.id === assetId);
    
    if (!asset) return conflicts;
    
    // Check if asset is already assigned elsewhere
    const existingAssignment = assignmentManager.getAssetAssignment(assetId);
    if (existingAssignment && 
        !(existingAssignment.assignmentId === targetId && existingAssignment.type === targetType)) {
      conflicts.push({
        type: 'asset',
        itemId: assetId,
        message: `${asset.number} is already assigned to ${existingAssignment.type} ${existingAssignment.assignmentId}`
      });
    }
    
    return conflicts;
  }
}

// Create and export singleton instance
const assignmentManager = new AssignmentManager();

export { assignmentManager };
