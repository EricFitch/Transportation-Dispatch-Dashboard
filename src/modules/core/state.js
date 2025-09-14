/* CORE - STATE MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: STATE object, loadData, saveToLocalStorage, resetGestureState, 
   updateRouteNote, updateFieldTripNote, updateRouteStatus, clearAllTimestamps, resetEntireBoard
   Total lines: 280
   Extracted: 2025-09-11_23-56
   Manual refinement: Organized state management, cleaned up fragmented code
*/

// Transportation Dispatch Dashboard Module Dependencies
import { PERFORMANCE } from './utils.js';

// =============================================================================
// GLOBAL STATE OBJECT
// =============================================================================

const STATE = {
    // Core data
    data: null, // will be initialized by loadData()
    currentView: 'AM',
    
    // Assignments and status
    assignments: {},
    routeStatus: {},
    assetStatus: {},
    staffOut: [],
    
    // Notes and tracking
    routeNotes: {},
    fieldTripNotes: {},
    statusTimestamps: {},
    
    // UI state
    selectedAssignment: null,
    selectedFieldTrip: null,
    
    // Performance tracking
    lastSaveTime: null,
    isDirty: false
};

// =============================================================================
// DATA MANAGEMENT FUNCTIONS

// Ensure STATE.data is always initialized on module load
loadData();
// =============================================================================

function getEmbeddedData() {
    return {
        routes: [
            {
                id: 'route-1-am',
                routeNumber: '1',
                type: 'gen-ed',
                name: 'Route 1',
                schedule: 'am',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'route-2-am',
                routeNumber: '2',
                type: 'gen-ed',
                name: 'Route 2',
                schedule: 'am',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'route-3-am',
                routeNumber: '3',
                type: 'gen-ed',
                name: 'Route 3',
                schedule: 'am',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'route-1-pm',
                routeNumber: '1',
                type: 'gen-ed',
                name: 'Route 1',
                schedule: 'pm',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'route-2-pm',
                routeNumber: '2',
                type: 'gen-ed',
                name: 'Route 2',
                schedule: 'pm',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'route-both-1',
                routeNumber: '99',
                type: 'gen-ed',
                name: 'Route 99',
                schedule: 'both',
                driver: null,
                asset: null,
                trailer: null,
                safetyEscorts: [],
                notes: '',
                destination: null,
                status: 'unassigned',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ],
        staff: [],
        assets: [],
        fieldTrips: [],
        colors: {
            'Gen Ed Bus': '#3b82f6',
            'SE Bus': '#f59e0b',
            'Van': '#10b981',
            'Suburban': '#8b5cf6',
            'Car': '#ef4444',
            out: '#ef4444',
            roles: {}
        }
    };
}

// =============================
// ASSET DATA MANAGEMENT
// =============================

/**
 * Add a new asset to STATE.data.assets
 * @param {Object} asset - { name, type, ... }
 * @returns {boolean} success
 */
function addAsset(asset) {
    if (!asset || !asset.name || !asset.type) {
        console.warn('❌ Asset must have name and type');
        return false;
    }
    if (!Array.isArray(STATE.data.assets)) STATE.data.assets = [];
    // Prevent duplicate asset names
    const exists = STATE.data.assets.some(a => a.name === asset.name);
    if (exists) {
        console.warn('❌ Asset already exists:', asset.name);
        return false;
    }
    STATE.data.assets.push(asset);
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('assets:dataChanged');
    }
    return true;
}

/**
 * Edit an existing asset (by name)
 * @param {string} name
 * @param {Object} updates - fields to update
 * @returns {boolean} success
 */
function editAsset(name, updates) {
    if (!Array.isArray(STATE.data.assets)) return false;
    const idx = STATE.data.assets.findIndex(a => a.name === name);
    if (idx === -1) return false;
    STATE.data.assets[idx] = { ...STATE.data.assets[idx], ...updates };
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('assets:dataChanged');
    }
    return true;
}

/**
 * Delete an asset (by name)
 * @param {string} name
 * @returns {boolean} success
 */
function deleteAsset(name) {
    if (!Array.isArray(STATE.data.assets)) return false;
    const idx = STATE.data.assets.findIndex(a => a.name === name);
    if (idx === -1) return false;
    STATE.data.assets.splice(idx, 1);
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('assets:dataChanged');
    }
    return true;
}
function loadData() {
    console.log('📊 Loading data...');
    
    try {
        // Always start with embedded data to ensure we have all the latest properties
        const embeddedData = getEmbeddedData();
        
        // Try to load saved configuration from localStorage
        const savedConfig = localStorage.getItem('dispatchConfig');
        
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            
            if (config.data) {
                // Start with embedded data but use saved routes if they exist
                // This preserves user deletions and additions
                STATE.data = {
                    ...embeddedData,
                    ...config.data,
                    // Use saved routes if available, otherwise fall back to embedded routes
                    routes: config.data.routes || embeddedData.routes
                };
            } else {
                STATE.data = embeddedData;
            }
            
            // Load other state data
            STATE.assignments = config.assignments || {};
            STATE.routeStatus = config.routeStatus || {};
            STATE.assetStatus = config.assetStatus || {};
            STATE.staffOut = config.staffOut || [];
            STATE.routeNotes = config.routeNotes || {};
            STATE.fieldTripNotes = config.fieldTripNotes || {};
            STATE.statusTimestamps = config.statusTimestamps || {};
            STATE.currentView = config.currentView || 'AM';
            
        } else {
            STATE.data = embeddedData;
        }
        
    } catch (error) {
        console.warn('⚠️ Error loading saved config, using embedded data:', error);
        STATE.data = embeddedData;
    }
    
    console.log('✅ Data loaded successfully');
    return STATE.data;
}

function saveToLocalStorage() {
    try {
        const config = {
            data: STATE.data,
            assignments: STATE.assignments,
            routeStatus: STATE.routeStatus,
            assetStatus: STATE.assetStatus,
            staffOut: STATE.staffOut,
            routeNotes: STATE.routeNotes,
            fieldTripNotes: STATE.fieldTripNotes,
            statusTimestamps: STATE.statusTimestamps,
            currentView: STATE.currentView,
            lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('dispatchConfig', JSON.stringify(config));
        STATE.lastSaveTime = Date.now();
        STATE.isDirty = false;
        
        console.log('💾 State saved to localStorage');
        return true;
        
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
        return false;
    }
}

// =============================================================================
// STATE UPDATE FUNCTIONS
// =============================================================================

function updateRouteNote(runKey, note) {
    STATE.routeNotes[runKey] = note;
    STATE.isDirty = true;
    
    // Auto-save after a delay
    if (PERFORMANCE.renderTimeouts.autoSave) {
        clearTimeout(PERFORMANCE.renderTimeouts.autoSave);
    }
    PERFORMANCE.renderTimeouts.autoSave = setTimeout(saveToLocalStorage, 2000);
}

function updateFieldTripNote(fieldTripId, note) {
    STATE.fieldTripNotes[fieldTripId] = note;
    STATE.isDirty = true;
    
    // Auto-save after a delay
    if (PERFORMANCE.renderTimeouts.autoSave) {
        clearTimeout(PERFORMANCE.renderTimeouts.autoSave);
    }
    PERFORMANCE.renderTimeouts.autoSave = setTimeout(saveToLocalStorage, 2000);
}

function updateRouteStatus(runKey, status) {
    STATE.routeStatus[runKey] = status;
    
    // Record timestamp for this status change
    if (!STATE.statusTimestamps[runKey]) {
        STATE.statusTimestamps[runKey] = [];
    }
    
    STATE.statusTimestamps[runKey].push({
        status: status,
        timestamp: new Date().toISOString(),
        user: 'system' // Could be enhanced to track actual users
    });
    
    STATE.isDirty = true;
    saveToLocalStorage(); // Status changes save immediately
}

function switchView(view) {
    console.log('🔄 Switching to view:', view);
    STATE.currentView = view;
    STATE.isDirty = true;
    saveToLocalStorage();
}

// =============================================================================
// RESET AND CLEANUP FUNCTIONS
// =============================================================================

function resetGestureState() {
    // This will be used by touch/gestures module
    console.log('🔄 Resetting gesture state');
    // Implementation will be in touch/gestures.js
}

function clearAllTimestamps() {
    STATE.statusTimestamps = {};
    STATE.isDirty = true;
    saveToLocalStorage();
    console.log('🧹 All timestamps cleared');
}

function resetEntireBoard() {
    console.log('🔄 Resetting entire board...');
    
    // Clear all assignments
    STATE.assignments = {};
    
    // Clear all status data
    STATE.routeStatus = {};
    
    // Clear all notes
    STATE.routeNotes = {};
    STATE.fieldTripNotes = {};
    
    // Clear all timestamps
    STATE.statusTimestamps = {};
    
    // Clear staff out list
    STATE.staffOut = [];
    
    // Clear asset status
    STATE.assetStatus = {};
    
    // Clear selected assignment
    STATE.selectedAssignment = null;
    STATE.selectedFieldTrip = null;
    
    STATE.isDirty = true;
    saveToLocalStorage();
    
    console.log('✅ Board reset complete');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getStateSnapshot() {
    return {
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(STATE))
    };
}

function restoreStateSnapshot(snapshot) {
    if (!snapshot || !snapshot.data) {
        console.error('❌ Invalid state snapshot');
        return false;
    }
    
    try {
        Object.assign(STATE, snapshot.data);
        saveToLocalStorage();
        console.log('✅ State restored from snapshot');
        return true;
    } catch (error) {
        console.error('❌ Error restoring state:', error);
        return false;
    }
}

function validateState() {
    const issues = [];
    
    if (!STATE.data) {
        issues.push('No data object');
    }
    
    if (!Array.isArray(STATE.data?.routes)) {
        issues.push('Routes is not an array');
    }
    
    if (!Array.isArray(STATE.data?.staff)) {
        issues.push('Staff is not an array');
    }
    
    if (!Array.isArray(STATE.data?.assets)) {
        issues.push('Assets is not an array');
    }
    
    return {
        isValid: issues.length === 0,
        issues: issues
    };
}

// =============================================================================
// AUTO-SAVE FUNCTIONALITY
// =============================================================================

// Auto-save every 30 seconds if state is dirty
setInterval(() => {
    if (STATE.isDirty && Date.now() - (STATE.lastSaveTime || 0) > 30000) {
        saveToLocalStorage();
    }
}, 30000);

// Save before page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (STATE.isDirty) {
            saveToLocalStorage();
        }
    });
}

/**
 * Generic state getter function
 */
function getState(key = null) {
    if (key === null) {
        return STATE;
    }
    return STATE[key];
}

/**
 * Generic state setter function
 */
function setState(key, value) {
    STATE[key] = value;
    STATE.isDirty = true;
    saveToLocalStorage();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    STATE,
    getState,
    setState,
    loadData,
    saveToLocalStorage,
    getEmbeddedData,
    updateRouteNote,
    updateFieldTripNote,
    updateRouteStatus,
    switchView,
    resetGestureState,
    clearAllTimestamps,
    resetEntireBoard,
    getStateSnapshot,
    restoreStateSnapshot,
    validateState,
    addAsset, editAsset, deleteAsset,
    addRoute
};

// =============================
// ROUTE DATA MANAGEMENT
// =============================

/**
 * Add a new route to STATE.data.routes
 * @param {Object} route - { name, type, shift, ... }
 * @returns {boolean} success
 */
function addRoute(route) {
    if (!route || !route.name || !route.type || !route.shift) {
        console.warn('❌ Route must have name, type, and shift');
        return false;
    }
    if (!Array.isArray(STATE.data.routes)) STATE.data.routes = [];
    // Prevent duplicate route names for same shift
    const exists = STATE.data.routes.some(r => r.name === route.name && r.shift === route.shift);
    if (exists) {
        console.warn('❌ Route already exists:', route.name, route.shift);
        return false;
    }
    STATE.data.routes.push(route);
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('routes:dataChanged');
    }
    return true;
}

/**
 * Edit an existing route (by name and shift)
 * @param {string} name
 * @param {string} shift
 * @param {Object} updates - fields to update
 * @returns {boolean} success
 */
function editRoute(name, shift, updates) {
    if (!Array.isArray(STATE.data.routes)) return false;
    const idx = STATE.data.routes.findIndex(r => r.name === name && r.shift === shift);
    if (idx === -1) return false;
    STATE.data.routes[idx] = { ...STATE.data.routes[idx], ...updates };
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('routes:dataChanged');
    }
    return true;
}

/**
 * Delete a route (by name and shift)
 * @param {string} name
 * @param {string} shift
 * @returns {boolean} success
 */
function deleteRoute(name, shift) {
    if (!Array.isArray(STATE.data.routes)) return false;
    const idx = STATE.data.routes.findIndex(r => r.name === name && r.shift === shift);
    if (idx === -1) return false;
    STATE.data.routes.splice(idx, 1);
    STATE.isDirty = true;
    saveToLocalStorage();
    if (typeof window !== 'undefined' && window.eventBus) {
        window.eventBus.emit('routes:dataChanged');
    }
    return true;
}
