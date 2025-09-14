/**
 * OPERATIONS FIELD TRIPS MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive field trip management system for:
 * - Field trip creation and management
 * - Destination tracking and updates
 * - Field trip scheduling and coordination
 * - Integration with assignment system
 * - Field trip status monitoring
 * 
 * Dependencies: core/events, core/state, operations/assignments, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { assignmentManager } from './assignments.js';
import { uiSystem } from '../ui/system.js';

class FieldTripManager {
  constructor() {
    this.fieldTrips = new Map();
    this.fieldTripSchedule = new Map();
    this.destinationHistory = [];
    this.fieldTripTemplates = [];
    
    this.init();
  }

  /**
   * Initialize field trip system
   */
  init() {
    this.setupEventListeners();
    this.loadFieldTrips();
    this.setupFieldTripModal();
    
    console.log('🚌 Field Trip Manager initialized');
    eventBus.emit('field-trips-ready');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for field trip operations
    eventBus.on('add-field-trip', (data) => this.addNewFieldTrip(data));
    eventBus.on('remove-field-trip', (data) => this.removeFieldTrip(data.fieldTripId));
    eventBus.on('reset-field-trip', (data) => this.resetFieldTrip(data.fieldTripId));
    eventBus.on('update-field-trip-destination', (data) => this.updateFieldTripDestination(data.fieldTripId, data.destination));
    
    // Listen for field trip UI requests
    eventBus.on('open-field-trip-modal', (data) => this.openFieldTripModal(data));
    eventBus.on('open-field-trip-assignment-modal', (data) => this.openFieldTripAssignmentModal(data));
    
    // Listen for assignment changes
    eventBus.on('assignment-created', (data) => this.handleAssignmentChange(data));
    eventBus.on('fieldTrip-assignment-cleared', (data) => this.handleAssignmentCleared(data));
    
    // Listen for schedule changes
    eventBus.on('schedule-updated', () => this.updateFieldTripSchedule());
  }

  // ===== FIELD TRIP MANAGEMENT =====

  /**
   * Add new field trip
   */
  addNewFieldTrip({ shift = 'AM', destination = '', departureTime = '', returnTime = '', notes = '' }) {
    console.log('🚌 Adding new field trip for shift:', shift);
    
    const fieldTripId = this.generateFieldTripId();
    const fieldTrip = {
      id: fieldTripId,
      shift: shift,
      destination: destination,
      departureTime: departureTime,
      returnTime: returnTime,
      notes: notes,
      status: 'planned',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      // Assignment fields
      driver: null,
      escorts: [],
      asset: null,
      trailer: null,
      // Tracking fields
      actualDeparture: null,
      actualReturn: null,
      mileage: {
        start: null,
        end: null,
        total: null
      },
      // Route information
      routeStops: [],
      estimatedDuration: null,
      actualDuration: null
    };

    this.fieldTrips.set(fieldTripId, fieldTrip);
    this.updateFieldTripInState(fieldTrip);
    
    // Show success notification
    uiSystem.showNotification(`Field trip ${fieldTripId} created successfully`, 'success');
    
    // Emit event for other modules
    eventBus.emit('field-trip-added', { fieldTrip });
    
    // Update displays
    this.renderFieldTrips();
    
    return fieldTrip;
  }

  /**
   * Remove field trip
   */
  removeFieldTrip(fieldTripId) {
    console.log('🚌 Removing field trip:', fieldTripId);
    
    const fieldTrip = this.fieldTrips.get(fieldTripId);
    if (!fieldTrip) {
      uiSystem.showNotification('Field trip not found', 'error');
      return false;
    }

    // Confirm removal if field trip has assignments
    if (this.hasAssignments(fieldTrip)) {
      const confirmed = confirm(
        `Field trip ${fieldTripId} has assignments. Are you sure you want to remove it? This will clear all assignments.`
      );
      if (!confirmed) return false;
      
      // Clear all assignments
      this.clearAllFieldTripAssignments(fieldTripId);
    }

    // Remove from maps and state
    this.fieldTrips.delete(fieldTripId);
    this.removeFieldTripFromState(fieldTripId);
    
    // Show success notification
    uiSystem.showNotification(`Field trip ${fieldTripId} removed successfully`, 'success');
    
    // Emit event for other modules
    eventBus.emit('field-trip-removed', { fieldTripId });
    
    // Update displays
    this.renderFieldTrips();
    
    return true;
  }

  /**
   * Reset field trip
   */
  resetFieldTrip(fieldTripId) {
    console.log('🚌 Resetting field trip:', fieldTripId);
    
    const fieldTrip = this.fieldTrips.get(fieldTripId);
    if (!fieldTrip) {
      uiSystem.showNotification('Field trip not found', 'error');
      return false;
    }

    // Confirm reset
    const confirmed = confirm(
      `Are you sure you want to reset field trip ${fieldTripId}? This will clear all assignments and tracking data.`
    );
    if (!confirmed) return false;

    // Clear all assignments
    this.clearAllFieldTripAssignments(fieldTripId);
    
    // Reset tracking data
    fieldTrip.status = 'planned';
    fieldTrip.actualDeparture = null;
    fieldTrip.actualReturn = null;
    fieldTrip.mileage = { start: null, end: null, total: null };
    fieldTrip.actualDuration = null;
    fieldTrip.lastModified = new Date().toISOString();
    
    // Update state
    this.updateFieldTripInState(fieldTrip);
    
    // Show success notification
    uiSystem.showNotification(`Field trip ${fieldTripId} reset successfully`, 'success');
    
    // Emit event for other modules
    eventBus.emit('field-trip-reset', { fieldTrip });
    
    // Update displays
    this.renderFieldTrips();
    
    return true;
  }

  /**
   * Update field trip destination
   */
  updateFieldTripDestination(fieldTripId, destination) {
    console.log('🚌 Updating field trip destination:', fieldTripId, destination);
    
    const fieldTrip = this.fieldTrips.get(fieldTripId);
    if (!fieldTrip) {
      uiSystem.showNotification('Field trip not found', 'error');
      return false;
    }

    // Record destination change in history
    if (fieldTrip.destination !== destination) {
      this.destinationHistory.push({
        fieldTripId: fieldTripId,
        oldDestination: fieldTrip.destination,
        newDestination: destination,
        timestamp: new Date().toISOString()
      });
    }

    // Update destination
    fieldTrip.destination = destination;
    fieldTrip.lastModified = new Date().toISOString();
    
    // Update state
    this.updateFieldTripInState(fieldTrip);
    
    // Show success notification
    uiSystem.showNotification(`Field trip destination updated to: ${destination}`, 'success');
    
    // Emit event for other modules
    eventBus.emit('field-trip-destination-updated', { fieldTrip, destination });
    
    // Update displays
    this.renderFieldTrips();
    
    return true;
  }

  /**
   * Update field trip status
   */
  updateFieldTripStatus(fieldTripId, newStatus) {
    console.log('🚌 Updating field trip status:', fieldTripId, newStatus);
    
    const fieldTrip = this.fieldTrips.get(fieldTripId);
    if (!fieldTrip) return false;

    const oldStatus = fieldTrip.status;
    fieldTrip.status = newStatus;
    fieldTrip.lastModified = new Date().toISOString();
    
    // Handle status-specific updates
    switch (newStatus) {
      case 'departed':
        if (!fieldTrip.actualDeparture) {
          fieldTrip.actualDeparture = new Date().toISOString();
        }
        break;
      case 'returned':
        if (!fieldTrip.actualReturn) {
          fieldTrip.actualReturn = new Date().toISOString();
        }
        if (fieldTrip.actualDeparture && fieldTrip.actualReturn) {
          fieldTrip.actualDuration = this.calculateDuration(
            fieldTrip.actualDeparture,
            fieldTrip.actualReturn
          );
        }
        break;
    }
    
    this.updateFieldTripInState(fieldTrip);
    
    // Emit status change event
    eventBus.emit('field-trip-status-changed', { 
      fieldTrip, 
      oldStatus, 
      newStatus 
    });
    
    return true;
  }

  // ===== FIELD TRIP QUERIES =====

  /**
   * Get field trip by ID
   */
  getFieldTrip(fieldTripId) {
    return this.fieldTrips.get(fieldTripId) || null;
  }

  /**
   * Get all field trips
   */
  getAllFieldTrips() {
    return Array.from(this.fieldTrips.values());
  }

  /**
   * Get field trips by shift
   */
  getFieldTripsByShift(shift) {
    return this.getAllFieldTrips().filter(ft => ft.shift === shift);
  }

  /**
   * Get field trips by status
   */
  getFieldTripsByStatus(status) {
    return this.getAllFieldTrips().filter(ft => ft.status === status);
  }

  /**
   * Get active field trips
   */
  getActiveFieldTrips() {
    return this.getAllFieldTrips().filter(ft => 
      ft.status === 'departed' || ft.status === 'in-progress'
    );
  }

  /**
   * Check if field trip has assignments
   */
  hasAssignments(fieldTrip) {
    return fieldTrip.driver || 
           (fieldTrip.escorts && fieldTrip.escorts.length > 0) ||
           fieldTrip.asset || 
           fieldTrip.trailer;
  }

  /**
   * Get field trip assignments
   */
  getFieldTripAssignments(fieldTripId) {
    const fieldTrip = this.getFieldTrip(fieldTripId);
    if (!fieldTrip) return null;
    
    return {
      driver: fieldTrip.driver,
      escorts: fieldTrip.escorts || [],
      asset: fieldTrip.asset,
      trailer: fieldTrip.trailer
    };
  }

  // ===== FIELD TRIP UI =====

  /**
   * Render field trips display
   */
  renderFieldTrips() {
    console.log('🚌 Rendering field trips...');
    
    const fieldTripsContainer = document.getElementById('field-trips-container');
    if (!fieldTripsContainer) return;

    const fieldTrips = this.getAllFieldTrips();
    
    if (fieldTrips.length === 0) {
      fieldTripsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No Field Trips</h3>
          <p>No field trips scheduled</p>
          <button class="btn btn-primary" onclick="fieldTripManager.openAddFieldTripModal()">
            Add Field Trip
          </button>
        </div>
      `;
      return;
    }

    // Group by shift
    const fieldTripsByShift = this.groupFieldTripsByShift(fieldTrips);
    
    let html = '<div class="field-trips-grid">';
    
    Object.entries(fieldTripsByShift).forEach(([shift, trips]) => {
      html += `
        <div class="shift-section">
          <h3 class="shift-header">${shift} Shift Field Trips</h3>
          <div class="field-trips-list">
            ${trips.map(ft => this.renderFieldTripCard(ft)).join('')}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Add action buttons
    html += `
      <div class="field-trips-actions">
        <button class="btn btn-primary" onclick="fieldTripManager.openAddFieldTripModal()">
          Add Field Trip
        </button>
        <button class="btn btn-secondary" onclick="fieldTripManager.openFieldTripScheduleModal()">
          View Schedule
        </button>
      </div>
    `;
    
    fieldTripsContainer.innerHTML = html;
  }

  /**
   * Render individual field trip card
   */
  renderFieldTripCard(fieldTrip) {
    const assignments = this.getFieldTripAssignments(fieldTrip.id);
    const statusClass = this.getStatusClass(fieldTrip.status);
    
    return `
      <div class="field-trip-card ${statusClass}" data-field-trip-id="${fieldTrip.id}">
        <div class="field-trip-header">
          <div class="field-trip-info">
            <h4>${fieldTrip.id}</h4>
            <span class="field-trip-status status-${fieldTrip.status}">${fieldTrip.status}</span>
          </div>
          <div class="field-trip-actions">
            <button class="btn btn-sm btn-secondary" 
                    onclick="fieldTripManager.openFieldTripModal('${fieldTrip.id}')">
              Edit
            </button>
            <button class="btn btn-sm btn-danger" 
                    onclick="fieldTripManager.removeFieldTrip('${fieldTrip.id}')">
              Remove
            </button>
          </div>
        </div>
        
        <div class="field-trip-content">
          <div class="destination">
            <strong>Destination:</strong> 
            <span class="editable-destination" 
                  onclick="fieldTripManager.editDestination('${fieldTrip.id}')">
              ${fieldTrip.destination || 'Not set'}
            </span>
          </div>
          
          <div class="timing">
            <div class="departure">
              <strong>Departure:</strong> ${fieldTrip.departureTime || 'Not set'}
            </div>
            <div class="return">
              <strong>Return:</strong> ${fieldTrip.returnTime || 'Not set'}
            </div>
          </div>
          
          <div class="assignments">
            <h5>Assignments:</h5>
            ${this.renderFieldTripAssignments(assignments)}
          </div>
          
          <div class="assignment-actions">
            <button class="btn btn-sm btn-primary" 
                    onclick="fieldTripManager.openAssignmentModal('${fieldTrip.id}', 'staff')">
              Assign Staff
            </button>
            <button class="btn btn-sm btn-primary" 
                    onclick="fieldTripManager.openAssignmentModal('${fieldTrip.id}', 'asset')">
              Assign Asset
            </button>
          </div>
          
          ${fieldTrip.notes ? `
            <div class="field-trip-notes">
              <strong>Notes:</strong> ${fieldTrip.notes}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render field trip assignments
   */
  renderFieldTripAssignments(assignments) {
    const items = [];
    
    if (assignments.driver) {
      const staff = STATE.staff.find(s => s.id === assignments.driver);
      items.push(`<div class="assignment-item driver">Driver: ${staff ? staff.name : 'Unknown'}</div>`);
    }
    
    if (assignments.escorts && assignments.escorts.length > 0) {
      assignments.escorts.forEach(escortId => {
        const staff = STATE.staff.find(s => s.id === escortId);
        items.push(`<div class="assignment-item escort">Escort: ${staff ? staff.name : 'Unknown'}</div>`);
      });
    }
    
    if (assignments.asset) {
      const asset = STATE.assets.find(a => a.id === assignments.asset);
      items.push(`<div class="assignment-item asset">Asset: ${asset ? asset.number : 'Unknown'}</div>`);
    }
    
    if (assignments.trailer) {
      const trailer = STATE.assets.find(a => a.id === assignments.trailer);
      items.push(`<div class="assignment-item trailer">Trailer: ${trailer ? trailer.number : 'Unknown'}</div>`);
    }
    
    return items.length > 0 ? items.join('') : '<div class="no-assignments">No assignments</div>';
  }

  // ===== MODAL OPERATIONS =====

  /**
   * Open field trip modal for editing
   */
  openFieldTripModal(fieldTripId = null) {
    const fieldTrip = fieldTripId ? this.getFieldTrip(fieldTripId) : null;
    const isEdit = !!fieldTrip;
    
    const modalContent = `
      <form class="field-trip-form">
        <input type="hidden" id="field-trip-id" value="${fieldTrip ? fieldTrip.id : ''}">
        
        <div class="form-row">
          <div class="form-group">
            <label for="field-trip-shift">Shift:</label>
            <select id="field-trip-shift" required>
              <option value="AM" ${fieldTrip && fieldTrip.shift === 'AM' ? 'selected' : ''}>AM</option>
              <option value="PM" ${fieldTrip && fieldTrip.shift === 'PM' ? 'selected' : ''}>PM</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="field-trip-status">Status:</label>
            <select id="field-trip-status" ${!isEdit ? 'disabled' : ''}>
              <option value="planned" ${fieldTrip && fieldTrip.status === 'planned' ? 'selected' : ''}>Planned</option>
              <option value="departed" ${fieldTrip && fieldTrip.status === 'departed' ? 'selected' : ''}>Departed</option>
              <option value="in-progress" ${fieldTrip && fieldTrip.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
              <option value="returned" ${fieldTrip && fieldTrip.status === 'returned' ? 'selected' : ''}>Returned</option>
              <option value="cancelled" ${fieldTrip && fieldTrip.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="field-trip-destination">Destination:</label>
          <input type="text" id="field-trip-destination" 
                 value="${fieldTrip ? fieldTrip.destination : ''}" 
                 placeholder="Enter destination...">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="field-trip-departure">Departure Time:</label>
            <input type="time" id="field-trip-departure" 
                   value="${fieldTrip ? fieldTrip.departureTime : ''}">
          </div>
          
          <div class="form-group">
            <label for="field-trip-return">Return Time:</label>
            <input type="time" id="field-trip-return" 
                   value="${fieldTrip ? fieldTrip.returnTime : ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label for="field-trip-notes">Notes:</label>
          <textarea id="field-trip-notes" rows="3" 
                    placeholder="Additional notes...">${fieldTrip ? fieldTrip.notes : ''}</textarea>
        </div>
        
        ${isEdit ? `
          <div class="tracking-info">
            <h4>Tracking Information</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="actual-departure">Actual Departure:</label>
                <input type="datetime-local" id="actual-departure" 
                       value="${fieldTrip.actualDeparture ? this.formatDateTimeLocal(fieldTrip.actualDeparture) : ''}">
              </div>
              
              <div class="form-group">
                <label for="actual-return">Actual Return:</label>
                <input type="datetime-local" id="actual-return" 
                       value="${fieldTrip.actualReturn ? this.formatDateTimeLocal(fieldTrip.actualReturn) : ''}">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="mileage-start">Starting Mileage:</label>
                <input type="number" id="mileage-start" 
                       value="${fieldTrip.mileage.start || ''}" placeholder="0">
              </div>
              
              <div class="form-group">
                <label for="mileage-end">Ending Mileage:</label>
                <input type="number" id="mileage-end" 
                       value="${fieldTrip.mileage.end || ''}" placeholder="0">
              </div>
            </div>
          </div>
        ` : ''}
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          ${isEdit ? `
            <button type="button" class="btn btn-warning" 
                    onclick="fieldTripManager.resetFieldTrip('${fieldTrip.id}')">Reset</button>
          ` : ''}
          <button type="submit" class="btn btn-primary">
            ${isEdit ? 'Update' : 'Create'} Field Trip
          </button>
        </div>
      </form>
    `;
    
    const modal = uiSystem.createModal(
      'field-trip-modal', 
      isEdit ? 'Edit Field Trip' : 'Add Field Trip', 
      modalContent
    );
    
    uiSystem.openModal('field-trip-modal');
    this.setupFieldTripModalHandlers();
  }

  /**
   * Open assignment modal for field trip
   */
  openAssignmentModal(fieldTripId, assignmentType) {
    eventBus.emit('open-assignment-modal', {
      targetId: fieldTripId,
      targetType: 'fieldTrip',
      assignmentType: assignmentType,
      itemType: assignmentType
    });
  }

  /**
   * Setup field trip modal handlers
   */
  setupFieldTripModal() {
    document.addEventListener('submit', (e) => {
      if (e.target.matches('.field-trip-form')) {
        e.preventDefault();
        this.handleFieldTripFormSubmission(e.target);
      }
    });
  }

  /**
   * Handle field trip form submission
   */
  handleFieldTripFormSubmission(form) {
    const formData = new FormData(form);
    const fieldTripId = form.querySelector('#field-trip-id').value;
    
    const fieldTripData = {
      shift: form.querySelector('#field-trip-shift').value,
      destination: form.querySelector('#field-trip-destination').value,
      departureTime: form.querySelector('#field-trip-departure').value,
      returnTime: form.querySelector('#field-trip-return').value,
      notes: form.querySelector('#field-trip-notes').value
    };
    
    if (fieldTripId) {
      // Update existing field trip
      this.updateFieldTrip(fieldTripId, fieldTripData);
    } else {
      // Create new field trip
      this.addNewFieldTrip(fieldTripData);
    }
    
    uiSystem.closeCurrentModal();
  }

  /**
   * Update existing field trip
   */
  updateFieldTrip(fieldTripId, updates) {
    const fieldTrip = this.getFieldTrip(fieldTripId);
    if (!fieldTrip) return false;
    
    // Update basic fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fieldTrip[key] = updates[key];
      }
    });
    
    // Update tracking data if provided
    const form = document.querySelector('.field-trip-form');
    if (form) {
      const actualDeparture = form.querySelector('#actual-departure')?.value;
      const actualReturn = form.querySelector('#actual-return')?.value;
      const mileageStart = form.querySelector('#mileage-start')?.value;
      const mileageEnd = form.querySelector('#mileage-end')?.value;
      const status = form.querySelector('#field-trip-status')?.value;
      
      if (actualDeparture) fieldTrip.actualDeparture = new Date(actualDeparture).toISOString();
      if (actualReturn) fieldTrip.actualReturn = new Date(actualReturn).toISOString();
      if (mileageStart) fieldTrip.mileage.start = parseInt(mileageStart);
      if (mileageEnd) fieldTrip.mileage.end = parseInt(mileageEnd);
      if (status && status !== fieldTrip.status) {
        this.updateFieldTripStatus(fieldTripId, status);
      }
      
      // Calculate total mileage
      if (fieldTrip.mileage.start && fieldTrip.mileage.end) {
        fieldTrip.mileage.total = fieldTrip.mileage.end - fieldTrip.mileage.start;
      }
    }
    
    fieldTrip.lastModified = new Date().toISOString();
    this.updateFieldTripInState(fieldTrip);
    
    uiSystem.showNotification(`Field trip ${fieldTripId} updated successfully`, 'success');
    eventBus.emit('field-trip-updated', { fieldTrip });
    this.renderFieldTrips();
    
    return true;
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate unique field trip ID
   */
  generateFieldTripId() {
    const date = new Date();
    const prefix = 'FT';
    const timestamp = date.getTime().toString().slice(-6);
    return `${prefix}${timestamp}`;
  }

  /**
   * Clear all field trip assignments
   */
  clearAllFieldTripAssignments(fieldTripId) {
    const assignments = this.getFieldTripAssignments(fieldTripId);
    if (!assignments) return;
    
    // Clear driver
    if (assignments.driver) {
      assignmentManager.clearFieldTripAssignment({
        fieldTripId,
        type: 'driver'
      });
    }
    
    // Clear escorts
    if (assignments.escorts && assignments.escorts.length > 0) {
      assignmentManager.clearFieldTripAssignment({
        fieldTripId,
        type: 'escort'
      });
    }
    
    // Clear asset
    if (assignments.asset) {
      assignmentManager.clearFieldTripAssignment({
        fieldTripId,
        type: 'asset'
      });
    }
    
    // Clear trailer
    if (assignments.trailer) {
      assignmentManager.clearFieldTripAssignment({
        fieldTripId,
        type: 'trailer'
      });
    }
  }

  /**
   * Group field trips by shift
   */
  groupFieldTripsByShift(fieldTrips) {
    return fieldTrips.reduce((groups, ft) => {
      const shift = ft.shift || 'Unknown';
      if (!groups[shift]) groups[shift] = [];
      groups[shift].push(ft);
      return groups;
    }, {});
  }

  /**
   * Get status CSS class
   */
  getStatusClass(status) {
    const statusClasses = {
      'planned': 'status-planned',
      'departed': 'status-active',
      'in-progress': 'status-active',
      'returned': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || '';
  }

  /**
   * Calculate duration between two dates
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }

  /**
   * Format datetime for input
   */
  formatDateTimeLocal(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  }

  /**
   * Edit destination inline
   */
  editDestination(fieldTripId) {
    const fieldTrip = this.getFieldTrip(fieldTripId);
    if (!fieldTrip) return;
    
    const newDestination = prompt('Enter new destination:', fieldTrip.destination || '');
    if (newDestination !== null && newDestination !== fieldTrip.destination) {
      this.updateFieldTripDestination(fieldTripId, newDestination);
    }
  }

  /**
   * Handle assignment changes
   */
  handleAssignmentChange(data) {
    if (data.type.includes('fieldTrip')) {
      // Update field trip assignment data
      const fieldTripId = data.fieldTripId;
      const fieldTrip = this.getFieldTrip(fieldTripId);
      
      if (fieldTrip) {
        // Sync assignment data with field trip object
        const assignments = assignmentManager.getFieldTripAssignments(fieldTripId);
        if (assignments) {
          fieldTrip.driver = assignments.driver;
          fieldTrip.escorts = assignments.escorts;
          fieldTrip.asset = assignments.asset;
          fieldTrip.trailer = assignments.trailer;
          
          this.updateFieldTripInState(fieldTrip);
          this.renderFieldTrips();
        }
      }
    }
  }

  /**
   * Handle assignment cleared
   */
  handleAssignmentCleared(data) {
    const fieldTripId = data.fieldTripId;
    const fieldTrip = this.getFieldTrip(fieldTripId);
    
    if (fieldTrip) {
      // Sync cleared assignment data
      const assignments = assignmentManager.getFieldTripAssignments(fieldTripId);
      if (assignments) {
        fieldTrip.driver = assignments.driver;
        fieldTrip.escorts = assignments.escorts;
        fieldTrip.asset = assignments.asset;
        fieldTrip.trailer = assignments.trailer;
        
        this.updateFieldTripInState(fieldTrip);
        this.renderFieldTrips();
      }
    }
  }

  /**
   * Update field trip schedule
   */
  updateFieldTripSchedule() {
    // This would integrate with a scheduling system
    console.log('🚌 Updating field trip schedule...');
  }

  /**
   * Update field trip in state
   */
  updateFieldTripInState(fieldTrip) {
    if (!STATE.fieldTrips) STATE.fieldTrips = [];
    
    const index = STATE.fieldTrips.findIndex(ft => ft.id === fieldTrip.id);
    if (index >= 0) {
      STATE.fieldTrips[index] = fieldTrip;
    } else {
      STATE.fieldTrips.push(fieldTrip);
    }
    
    eventBus.emit('state-updated', { module: 'fieldTrips' });
  }

  /**
   * Remove field trip from state
   */
  removeFieldTripFromState(fieldTripId) {
    if (!STATE.fieldTrips) return;
    
    STATE.fieldTrips = STATE.fieldTrips.filter(ft => ft.id !== fieldTripId);
    eventBus.emit('state-updated', { module: 'fieldTrips' });
  }

  /**
   * Load field trips from state
   */
  loadFieldTrips() {
    if (STATE.fieldTrips) {
      STATE.fieldTrips.forEach(ft => {
        this.fieldTrips.set(ft.id, ft);
      });
    }
    
    console.log(`🚌 Loaded ${this.fieldTrips.size} field trips from state`);
  }

  /**
   * Open add field trip modal
   */
  openAddFieldTripModal() {
    this.openFieldTripModal();
  }

  /**
   * Open field trip schedule modal
   */
  openFieldTripScheduleModal() {
    // Implementation for schedule view modal
    console.log('🚌 Opening field trip schedule modal...');
  }
}

// Create and export singleton instance
const fieldTripManager = new FieldTripManager();

// Make available globally for inline event handlers
window.fieldTripManager = fieldTripManager;

export { fieldTripManager };
