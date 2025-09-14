/**
 * OPERATIONS ROUTE MANAGEMENT MODULE
 * Transportation Dispatch Dashboard
 * 
 * Critical business logic functions for:
 * - Route management (add, remove, reset)
 * - Field trip management (add, remove, reset)
 * - Card operations and state management
 * - Assignment clearing and validation
 * 
 * Dependencies: core/state, core/events, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE, getState, setState, saveToLocalStorage } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class RouteManagementOperations {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize route management operations
   */
  init() {
    if (this.initialized) {
      console.log('🛣️ Route Management Operations already initialized');
      return;
    }
    
    this.setupEventListeners();
    this.initialized = true;
    console.log('🛣️ Route Management Operations initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    eventBus.on('route:reset', (data) => {
      this.resetCard(data.runKey);
    });

    eventBus.on('route:remove', (data) => {
      this.removeRoute(data.runKey);
    });

    eventBus.on('fieldTrip:add', (data) => {
      this.addNewFieldTrip(data.shift);
    });

    eventBus.on('fieldTrip:remove', (data) => {
      this.removeFieldTrip(data.fieldTripId);
    });

    eventBus.on('fieldTrip:reset', (data) => {
      this.resetFieldTrip(data.fieldTripId);
    });

    eventBus.on('assignment:clear', (data) => {
      this.clearAssignment(data.route, data.type);
    });
  }

  /**
   * Reset a route card (clear all assignments and data)
   */
  resetCard(runKey) {
    console.log(`🔄 Resetting card: ${runKey}`);
    
    if (!runKey || runKey.trim() === '') {
      console.error('❌ Invalid runKey provided to resetCard');
      return;
    }

    // Confirm with user before resetting
    if (!confirm('Are you sure you want to reset this card? This will clear all assignments, notes, and status.')) {
      return;
    }

    try {
      // Clear all assignments for this route
      delete STATE.assignments[runKey];
      
      // Clear route notes
      delete STATE.routeNotes[runKey];
      
      // Clear route status
      delete STATE.routeStatus[runKey];
      
      // Clear status timestamps
      delete STATE.statusTimestamps[runKey];
      
      // Save changes
      saveToLocalStorage();
      
      // Emit events to update UI
      eventBus.emit('route:updated', { runKey });
      eventBus.emit('assignments:changed');
      eventBus.emit('ui:showToast', {
        message: `Route ${runKey.split('_')[0]} has been reset`,
        type: 'success'
      });
      
      console.log(`✅ Route ${runKey} reset successfully`);
      
    } catch (error) {
      console.error('❌ Error resetting card:', error);
      uiSystem.showNotification('Error resetting route card', 'error');
    }
  }

  /**
   * Remove a route entirely from the system
   */
  removeRoute(runKey) {
    console.log(`🗑️ Removing route: ${runKey}`);
    
    if (!runKey || runKey.trim() === '') {
      console.error('❌ Invalid runKey provided to removeRoute');
      return;
    }

    if (!confirm('Delete this route? This action cannot be undone and will remove all assignments, notes, and status for this route.')) {
      return;
    }

    try {
      // Parse the runKey to get route name and shift
      const parts = runKey.split('_');
      
      if (parts.length < 2) {
        console.error('❌ Invalid runKey format:', runKey);
        return;
      }

      const routeName = parts[0];
      const shift = parts[parts.length - 1]; // Take the last part as shift

      // Find and remove the route from STATE.data.routes
      const routeIndex = STATE.data.routes.findIndex(r => 
        r.name === routeName && r.shift === shift
      );

      if (routeIndex !== -1) {
        const removedRoute = STATE.data.routes.splice(routeIndex, 1)[0];
        
        // Clear all related data
        delete STATE.assignments[runKey];
        delete STATE.routeNotes[runKey];
        delete STATE.routeStatus[runKey];
        delete STATE.statusTimestamps[runKey];
        
        // Save changes
        saveToLocalStorage();
        
        // Emit events to update UI
        eventBus.emit('route:removed', { runKey, route: removedRoute });
        eventBus.emit('assignments:changed');
        eventBus.emit('ui:showToast', {
          message: `Route ${removedRoute.name} (${removedRoute.type}, ${removedRoute.shift}) has been deleted`,
          type: 'success'
        });
        
        console.log(`✅ Route ${removedRoute.name} deleted successfully`);
        
      } else {
        console.error('❌ Route not found:', routeName, shift);
        uiSystem.showNotification('Route not found', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error removing route:', error);
      uiSystem.showNotification('Error removing route', 'error');
    }
  }

  /**
   * Add a new field trip
   */
  addNewFieldTrip(shift) {
    console.log(`➕ Adding new field trip for ${shift} shift`);
    
    if (!STATE.data || !STATE.data.fieldTrips) {
      STATE.data.fieldTrips = [];
    }

    try {
      // Generate a unique ID for the new field trip
      const existingIds = STATE.data.fieldTrips.map(ft => ft.id);
      let newId = 'ft1';
      let counter = 1;

      while (existingIds.includes(newId)) {
        counter++;
        newId = `ft${counter}`;
      }

      // Create new field trip
      const newFieldTrip = {
        id: newId,
        destination: 'New Field Trip',
        shift: shift,
        driver: null,
        escort: null,
        asset: null,
        trailer: null
      };

      STATE.data.fieldTrips.push(newFieldTrip);

      // Save and emit events
      saveToLocalStorage();
      eventBus.emit('fieldTrip:added', { fieldTrip: newFieldTrip });
      eventBus.emit('ui:showToast', {
        message: `Field Trip ${newId.replace('ft', '')} added for ${shift} shift`,
        type: 'success'
      });

      console.log(`✅ Added new field trip ${newId} for ${shift} shift`);
      
    } catch (error) {
      console.error('❌ Error adding field trip:', error);
      uiSystem.showNotification('Error adding field trip', 'error');
    }
  }

  /**
   * Remove a field trip
   */
  removeFieldTrip(fieldTripId) {
    console.log(`🗑️ Removing field trip: ${fieldTripId}`);
    
    if (!STATE.data || !STATE.data.fieldTrips) {
      console.error('❌ No field trips data available');
      return;
    }

    if (!confirm(`Delete Field Trip ${fieldTripId.replace('ft', '')}? This action cannot be undone.`)) {
      return;
    }

    try {
      const fieldTripIndex = STATE.data.fieldTrips.findIndex(ft => ft.id === fieldTripId);
      
      if (fieldTripIndex !== -1) {
        const removedFieldTrip = STATE.data.fieldTrips.splice(fieldTripIndex, 1)[0];
        
        // Clear field trip notes
        delete STATE.fieldTripNotes[fieldTripId];
        
        // Save changes
        saveToLocalStorage();
        
        // Emit events
        eventBus.emit('fieldTrip:removed', { fieldTripId, fieldTrip: removedFieldTrip });
        eventBus.emit('assignments:changed');
        eventBus.emit('ui:showToast', {
          message: `Field Trip ${fieldTripId.replace('ft', '')} has been deleted`,
          type: 'success'
        });
        
        console.log(`✅ Field trip ${fieldTripId} deleted successfully`);
        
      } else {
        console.error('❌ Field trip not found:', fieldTripId);
        uiSystem.showNotification('Field trip not found', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error removing field trip:', error);
      uiSystem.showNotification('Error removing field trip', 'error');
    }
  }

  /**
   * Reset a field trip (clear assignments but keep the trip)
   */
  resetFieldTrip(fieldTripId) {
    console.log(`🔄 Resetting field trip: ${fieldTripId}`);
    
    if (!STATE.data || !STATE.data.fieldTrips) {
      console.error('❌ No field trips data available');
      return;
    }

    if (!confirm('Are you sure you want to reset this field trip? This will clear all assignments and notes but keep the field trip.')) {
      return;
    }

    try {
      const fieldTrip = STATE.data.fieldTrips.find(ft => ft.id === fieldTripId);
      
      if (fieldTrip) {
        // Clear all assignments
        fieldTrip.driver = null;
        fieldTrip.escort = null;
        fieldTrip.asset = null;
        fieldTrip.trailer = null;
        
        // Clear field trip notes
        delete STATE.fieldTripNotes[fieldTripId];
        
        // Save changes
        saveToLocalStorage();
        
        // Emit events
        eventBus.emit('fieldTrip:reset', { fieldTripId });
        eventBus.emit('assignments:changed');
        eventBus.emit('ui:showToast', {
          message: `Field Trip ${fieldTripId.replace('ft', '')} has been reset`,
          type: 'success'
        });
        
        console.log(`✅ Field trip ${fieldTripId} reset successfully`);
        
      } else {
        console.error('❌ Field trip not found:', fieldTripId);
        uiSystem.showNotification('Field trip not found', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error resetting field trip:', error);
      uiSystem.showNotification('Error resetting field trip', 'error');
    }
  }

  /**
   * Update field trip destination
   */
  updateFieldTripDestination(fieldTripId, destination) {
    if (!STATE.data || !STATE.data.fieldTrips) {
      console.error('❌ No field trips data available');
      return;
    }

    try {
      const fieldTrip = STATE.data.fieldTrips.find(ft => ft.id === fieldTripId);
      if (fieldTrip) {
        fieldTrip.destination = destination;
        saveToLocalStorage();
        
        eventBus.emit('fieldTrip:updated', { fieldTripId, destination });
        console.log(`✅ Updated field trip ${fieldTripId} destination to: ${destination}`);
      }
    } catch (error) {
      console.error('❌ Error updating field trip destination:', error);
    }
  }

  /**
   * Clear assignment for a route
   */
  clearAssignment(route, type) {
    console.log(`🧹 Clearing ${type} assignment from route ${route}`);
    
    const typeLabels = {
      driver: 'Driver',
      escort: 'Safety Escort', 
      asset: 'Asset',
      trailer: 'Trailer'
    };

    const typeLabel = typeLabels[type] || type;
    const runKey = `${route}_${STATE.currentView}`;

    if (!confirm(`Clear ${typeLabel} from Route ${route}?`)) {
      return;
    }

    try {
      if (STATE.assignments[runKey] && STATE.assignments[runKey][type]) {
        delete STATE.assignments[runKey][type];
        
        // If assignment object is now empty, remove it entirely
        if (Object.keys(STATE.assignments[runKey]).length === 0) {
          delete STATE.assignments[runKey];
        }
        
        saveToLocalStorage();
        
        // Emit events
        eventBus.emit('assignment:cleared', { route, type, runKey });
        eventBus.emit('assignments:changed');
        eventBus.emit('ui:showToast', {
          message: `${typeLabel} cleared from Route ${route}`,
          type: 'success'
        });
        
        console.log(`✅ Cleared ${type} from ${runKey}`);
        
      } else {
        console.log(`ℹ️ No ${type} assignment found for ${runKey}`);
      }
      
    } catch (error) {
      console.error('❌ Error clearing assignment:', error);
      uiSystem.showNotification('Error clearing assignment', 'error');
    }
  }

  /**
   * Update route note
   */
  updateRouteNote(runKey, note) {
    STATE.routeNotes[runKey] = note;
    saveToLocalStorage();
    
    eventBus.emit('route:noteUpdated', { runKey, note });
    console.log(`✅ Updated route note for ${runKey}: ${note}`);
  }

  /**
   * Update field trip note
   */
  updateFieldTripNote(fieldTripId, note) {
    STATE.fieldTripNotes[fieldTripId] = note;
    saveToLocalStorage();
    
    eventBus.emit('fieldTrip:noteUpdated', { fieldTripId, note });
    console.log(`✅ Updated field trip note for ${fieldTripId}: ${note}`);
  }

  /**
   * Update route status
   */
  updateRouteStatus(runKey, status) {
    STATE.routeStatus[runKey] = status;

    // Record timestamp for this status change
    const timestamp = new Date();
    if (!STATE.statusTimestamps[runKey]) {
      STATE.statusTimestamps[runKey] = [];
    }

    STATE.statusTimestamps[runKey].push({
      status: status,
      timestamp: timestamp.toISOString(),
      timeString: timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }),
      dateString: timestamp.toLocaleDateString('en-US')
    });

    saveToLocalStorage();
    
    eventBus.emit('route:statusUpdated', { runKey, status, timestamp });
    
    console.log(`✅ Updated route status for ${runKey}: ${status} at ${timestamp.toLocaleTimeString()}`);

    // Special handling for emergency status
    if (status === '10-11') {
      uiSystem.showNotification(`Route ${runKey.split('_')[0]} marked as 10-11 (Emergency)`, 'warning');
    }
  }
}

// Create and export singleton instance
const routeManagementOperations = new RouteManagementOperations();

// Make functions globally accessible for inline event handlers
window.resetCard = (runKey) => routeManagementOperations.resetCard(runKey);
window.removeRoute = (runKey) => routeManagementOperations.removeRoute(runKey);
window.addNewFieldTrip = (shift) => routeManagementOperations.addNewFieldTrip(shift);
window.removeFieldTrip = (fieldTripId) => routeManagementOperations.removeFieldTrip(fieldTripId);
window.resetFieldTrip = (fieldTripId) => routeManagementOperations.resetFieldTrip(fieldTripId);
window.updateFieldTripDestination = (fieldTripId, destination) => routeManagementOperations.updateFieldTripDestination(fieldTripId, destination);
window.updateRouteNote = (runKey, note) => routeManagementOperations.updateRouteNote(runKey, note);
window.updateFieldTripNote = (fieldTripId, note) => routeManagementOperations.updateFieldTripNote(fieldTripId, note);
window.updateRouteStatus = (runKey, status) => routeManagementOperations.updateRouteStatus(runKey, status);

export { routeManagementOperations };