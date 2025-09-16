/* DISPATCH - ROUTE CARDS MODULE
   Transportation Dispatch Dashboard - Route Card Management System
   
   Functions included: Route card rendering, assignment management, filtering by type,
   driver/asset/safety escort assignments, notes management
   Created: 2025-09-13
   Purpose: Comprehensive route card system for General Ed, Special Ed, Miscellaneous, and Field Trips
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { debounceRender, PERFORMANCE } from '../core/utils.js';

// =============================================================================
// ROUTE CARD DATA STRUCTURE
// =============================================================================

// Route types configuration
const ROUTE_TYPES = {
    GENERAL_ED: {
        id: 'general-education',
        label: 'General Education',
        color: '#3b82f6', // blue
        icon: '🎒'
    },
    SPECIAL_ED: {
        id: 'special-education', 
        label: 'Special Education',
        color: '#f59e0b', // amber
        icon: '🌟'
    },
    MISCELLANEOUS: {
        id: 'miscellaneous',
        label: 'Miscellaneous',
        color: '#10b981', // emerald
        icon: '📋'
    },
    FIELD_TRIPS: {
        id: 'field-trips',
        label: 'Field Trips',
        color: '#8b5cf6', // violet
        icon: '🚌'
    },
    INACTIVE: {
        id: 'inactive',
        label: 'Inactive',
        color: '#6b7280', // gray
        icon: '⏸️'
    }
};

// Route schedule options
const ROUTE_SCHEDULES = {
    AM: {
        id: 'am',
        label: 'AM Only',
        icon: '🌅'
    },
    PM: {
        id: 'pm', 
        label: 'PM Only',
        icon: '🌆'
    },
    BOTH: {
        id: 'both',
        label: 'AM & PM',
        icon: '🔄'
    },
    NONE: {
        id: 'none',
        label: 'No Schedule',
        icon: '⏸️'
    }
};

// Route card data structure template
function createRouteTemplate(routeNumber, routeType, schedule = 'none') {
    return {
        id: `route-${routeNumber}`,
        routeNumber: routeNumber, // 1-100
        type: routeType, // one of ROUTE_TYPES keys
        name: `Route ${routeNumber}`, // display name
        schedule: schedule, // one of ROUTE_SCHEDULES keys (am, pm, both, none)
        
        // Single assignments
        driver: null, // { name, id } or null
        asset: null, // { name, number, type } or null
        trailer: null, // { name, number, type } or null (field trips only)
        
        // Multiple assignments (safety escorts)
        safetyEscorts: [], // array of { name, id }, max 5
        
        // Route details
        notes: '', // text notes
        destination: routeType === 'field-trips' ? '' : null, // field trips only
        status: 'unassigned', // unassigned, 10-8, 10-7, 10-11
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Get the role color for the driver assigned to a route (if any).
 * Falls back to the route type color if no driver or role color available.
 */
function getDriverRoleColorForRoute(route) {
    try {
        const assignmentKey = `${route.name}_${STATE.currentView}`;
        const assignment = STATE.assignments?.[assignmentKey] || {};
        const driverName = assignment.driver || (route.driver && route.driver.name) || null;
        if (!driverName) return ROUTE_TYPES[Object.keys(ROUTE_TYPES).find(k => ROUTE_TYPES[k].id === route.type)]?.color || '#6b7280';

        // Find staff entry
        const staff = STATE.data?.staff?.find(s => s.name === driverName || s.id === driverName);
        const role = (staff && (staff.position || staff.role)) || null;
        if (role && typeof window.getRoleColor === 'function') {
            return window.getRoleColor(role);
        }

        // Fallback to staff module getter if present
        if (window.staffModule && typeof window.staffModule.getRoleColor === 'function') {
            return window.staffModule.getRoleColor(role || 'Driver');
        }

        // Default route type color
        const typeKey = Object.keys(ROUTE_TYPES).find(k => ROUTE_TYPES[k].id === route.type);
        return ROUTE_TYPES[typeKey]?.color || '#6b7280';
    } catch (e) {
        console.warn('getDriverRoleColorForRoute error', e);
        return '#6b7280';
    }
}

/**
 * Given a hex color, return readable text color and subtle panel colors
 */
function computeContrastColors(hex) {
    // Normalize hex
    try {
        if (!hex) hex = '#6b7280';
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0,2), 16);
        const g = parseInt(clean.substring(2,4), 16);
        const b = parseInt(clean.substring(4,6), 16);
        // Relative luminance
        const luminance = (0.2126 * (r/255) + 0.7152 * (g/255) + 0.0722 * (b/255));
        // Choose text color: light text on dark bg
        const textColor = luminance < 0.5 ? '#ffffff' : '#111827';
        // Panel backgrounds/borders (subtle translucent overlays)
        if (textColor === '#ffffff') {
            return {
                textColor,
                panelBg: 'rgba(255,255,255,0.08)',
                panelBorder: 'rgba(255,255,255,0.16)'
            };
        }
        return {
            textColor,
            panelBg: 'rgba(0,0,0,0.06)',
            panelBorder: 'rgba(0,0,0,0.12)'
        };
    } catch (e) {
        return { textColor: '#111827', panelBg: 'rgba(0,0,0,0.06)', panelBorder: 'rgba(0,0,0,0.12)' };
    }
}

// =============================================================================
// ROUTE MANAGEMENT FUNCTIONS
// =============================================================================

function createRoute(routeNumber, routeType, schedule = 'none') {
    console.log(`📝 Creating route ${routeNumber} as ${routeType} with ${schedule} schedule`);
    
    if (!ROUTE_TYPES[routeType.toUpperCase().replace('-', '_')]) {
        console.error('❌ Invalid route type:', routeType);
        return null;
    }
    
    if (!ROUTE_SCHEDULES[schedule.toUpperCase()]) {
        console.error('❌ Invalid route schedule:', schedule);
        return null;
    }
    
    const route = createRouteTemplate(routeNumber, routeType, schedule);
    
    // Initialize routes array if needed
    if (!Array.isArray(STATE.data.routes)) {
        STATE.data.routes = [];
    }
    
    // Replace existing route with same number or add new
    const existingIndex = STATE.data.routes.findIndex(r => r.routeNumber === routeNumber);
    if (existingIndex >= 0) {
        // Preserve existing assignments when updating route
        const existingRoute = STATE.data.routes[existingIndex];
        route.driver = existingRoute.driver;
        route.asset = existingRoute.asset;
        route.safetyEscorts = existingRoute.safetyEscorts;
        route.notes = existingRoute.notes;
        route.status = existingRoute.status;
        
        STATE.data.routes[existingIndex] = route;
    } else {
        STATE.data.routes.push(route);
    }
    
    saveToLocalStorage();
    
    eventBus.emit('routes:created', { route });
    return route;
}

/**
 * Remove duplicate routes with the same route number
 * Keeps the most recently updated route for each number
 */
function deduplicateRoutes() {
    if (!STATE.data?.routes || !Array.isArray(STATE.data.routes)) {
        return;
    }
    
    console.log(`🔧 Deduplicating routes... Found ${STATE.data.routes.length} routes`);
    
    const seenRouteNumbers = new Map();
    const uniqueRoutes = [];
    
    // Sort by updatedAt desc so we process the newest routes first
    const sortedRoutes = [...STATE.data.routes].sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    
    sortedRoutes.forEach(route => {
        // Use unique identifier for deduplication
        // For field trips, use the unique ID; for regular routes, use route number
        const identifier = route.type === 'field-trips' ? route.id : route.routeNumber;
        
        if (!seenRouteNumbers.has(identifier)) {
            seenRouteNumbers.set(identifier, true);
            uniqueRoutes.push(route);
        } else {
            console.log(`⚠️ Removing duplicate route ${identifier} (${route.name})`);
        }
    });
    
    // Sort unique routes by route number in ascending order (1, 2, 3, etc.)
    uniqueRoutes.sort((a, b) => {
        // Handle field trip route numbers (FT1, FT2, etc.)
        if (a.type === 'field-trips' && b.type === 'field-trips') {
            // For field trips, extract number from route number (FT1 -> 1)
            const numA = parseInt(a.routeNumber.replace('FT', '')) || 0;
            const numB = parseInt(b.routeNumber.replace('FT', '')) || 0;
            return numA - numB;
        }
        
        // Handle mixed types - field trips come after regular routes
        if (a.type === 'field-trips' && b.type !== 'field-trips') return 1;
        if (a.type !== 'field-trips' && b.type === 'field-trips') return -1;
        
        // Handle regular route numbers
        const numA = parseInt(a.routeNumber) || 0;
        const numB = parseInt(b.routeNumber) || 0;
        return numA - numB;
    });
    
    // Update STATE with deduplicated and sorted routes
    STATE.data.routes = uniqueRoutes;
    saveToLocalStorage();
    
    console.log(`✅ Deduplication complete. Kept ${uniqueRoutes.length} unique routes`);
    return uniqueRoutes.length;
}

/**
 * Initialize all 100 routes with default inactive status
 * Can be called to set up the route system initially
 */
function initializeAllRoutes() {
    console.log('🚌 Initializing all 100 routes...');
    
    for (let i = 1; i <= 100; i++) {
        createRoute(i, 'inactive', 'none');
    }
    
    console.log('✅ All 100 routes initialized as inactive');
}

/**
 * Update route configuration (type and schedule)
 * Used by the route management interface
 */
function updateRouteConfig(routeNumber, routeType, schedule) {
    console.log(`🔧 Updating route ${routeNumber}: ${routeType}, ${schedule}`);
    
    const existingRoute = STATE.data.routes.find(r => r.routeNumber === routeNumber);
    if (existingRoute) {
        // Update existing route while preserving assignments
        if (routeType !== null) {
            const wasInactive = existingRoute.type === 'inactive';
            existingRoute.type = routeType;
            
            // If route is being activated (changed from inactive to any other type)
            // and no specific schedule was provided, set default schedule to 'both'
            if (wasInactive && routeType !== 'inactive' && schedule === null) {
                console.log(`🔄 Route ${routeNumber} activated from inactive to ${routeType}, setting default schedule to 'both'`);
                existingRoute.schedule = 'both';
                
                // Show notification to user about automatic schedule setting
                if (typeof window !== 'undefined' && window.uiSystem) {
                    window.uiSystem.showNotification(
                        `Route ${routeNumber} activated! Schedule automatically set to AM & PM. You can change this in the configuration grid.`,
                        'success',
                        4000
                    );
                }
            }
            // If route is being deactivated (changed to inactive), set schedule to 'none'
            else if (routeType === 'inactive' && schedule === null) {
                console.log(`🔄 Route ${routeNumber} deactivated to inactive, setting schedule to 'none'`);
                existingRoute.schedule = 'none';
            }
        }
        
        if (schedule !== null) existingRoute.schedule = schedule;
        existingRoute.updatedAt = new Date().toISOString();
    } else {
        // Create new route
        // If creating a new active route without specifying schedule, default to 'both'
        if (routeType !== 'inactive' && schedule === null) {
            schedule = 'both';
        } else if (routeType === 'inactive' && schedule === null) {
            schedule = 'none';
        }
        createRoute(routeNumber, routeType, schedule);
    }
    
    saveToLocalStorage();
    eventBus.emit('routes:configUpdated', { routeNumber, routeType, schedule });
    
    // Re-render the main dashboard route cards to show the changes
    console.log(`🔄 Re-rendering route cards to show changes for route ${routeNumber}`);
    renderRouteCards();
    
    return true;
}

/**
 * Import route configuration from CSV data
 * Maps CSV format to our route system
 */
function importRoutesFromCSV(csvData) {
    console.log('📥 Importing routes from CSV data...');
    
    const typeMapping = {
        'Gen Ed': 'general-education',
        'SE': 'special-education', 
        'Miscellanesous': 'miscellaneous',
        'Miscellaneous': 'miscellaneous',
        'Not Runining': 'inactive',
        'Not Running': 'inactive'
    };
    
    csvData.forEach(row => {
        if (row.Route && row.Type) {
            const routeNumber = parseInt(row.Route);
            const routeType = typeMapping[row.Type] || 'inactive';
            const schedule = routeType === 'inactive' ? 'none' : 'both'; // Default active routes to both shifts
            
            if (routeNumber >= 1 && routeNumber <= 100) {
                updateRouteConfig(routeNumber, routeType, schedule);
            }
        }
    });
    
    console.log('✅ Route import complete');
}

function assignDriver(routeId, driverInfo) {
    console.log(`👨‍💼 Assigning driver to route ${routeId}:`, driverInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    // Remove driver from any other routes first
    if (driverInfo) {
        STATE.data.routes.forEach(r => {
            if (r.driver && r.driver.name === driverInfo.name) {
                r.driver = null;
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    route.driver = driverInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:driverAssigned', { routeId, driver: driverInfo });
    return true;
}

function assignAsset(routeId, assetInfo) {
    console.log(`🚌 Assigning asset to route ${routeId}:`, assetInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    // Remove asset from any other routes first
    if (assetInfo) {
        STATE.data.routes.forEach(r => {
            if (r.asset && r.asset.number === assetInfo.number) {
                r.asset = null;
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    route.asset = assetInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:assetAssigned', { routeId, asset: assetInfo });
    return true;
}

function assignTrailer(routeId, trailerInfo) {
    console.log(`🚛 Assigning trailer to route ${routeId}:`, trailerInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    // Remove trailer from any other routes first
    if (trailerInfo) {
        STATE.data.routes.forEach(r => {
            if (r.trailer && r.trailer.number === trailerInfo.number) {
                r.trailer = null;
                r.updatedAt = new Date().toISOString();
            }
        });
    }
    
    route.trailer = trailerInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:trailerAssigned', { routeId, trailer: trailerInfo });
    return true;
}

function addSafetyEscort(routeId, escortInfo) {
    console.log(`🛡️ Adding safety escort to route ${routeId}:`, escortInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    // Check if escort already assigned to this route
    if (route.safetyEscorts.some(escort => escort.name === escortInfo.name)) {
        console.warn('⚠️ Escort already assigned to this route:', escortInfo.name);
        return false;
    }
    
    // Check maximum escorts limit (5)
    if (route.safetyEscorts.length >= 5) {
        console.warn('⚠️ Maximum safety escorts (5) already assigned to route');
        return false;
    }
    
    // Remove escort from other routes
    STATE.data.routes.forEach(r => {
        r.safetyEscorts = r.safetyEscorts.filter(escort => escort.name !== escortInfo.name);
        if (r.safetyEscorts.length !== r.safetyEscorts.length) {
            r.updatedAt = new Date().toISOString();
        }
    });
    
    route.safetyEscorts.push(escortInfo);
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:safetyEscortAdded', { routeId, escort: escortInfo });
    return true;
}

function removeSafetyEscort(routeId, escortName) {
    console.log(`🛡️ Removing safety escort from route ${routeId}:`, escortName);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    const originalLength = route.safetyEscorts.length;
    route.safetyEscorts = route.safetyEscorts.filter(escort => escort.name !== escortName);
    
    if (route.safetyEscorts.length === originalLength) {
        console.warn('⚠️ Escort not found on route:', escortName);
        return false;
    }
    
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:safetyEscortRemoved', { routeId, escortName });
    return true;
}

function updateRouteNotes(routeId, notes) {
    console.log(`📝 Updating notes for route ${routeId}`);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    route.notes = notes;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:notesUpdated', { routeId, notes });
    return true;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function findRouteById(routeId) {
    if (!STATE.data?.routes) return null;
    return STATE.data.routes.find(route => route.id === routeId);
}

function getRoutesByType(routeType) {
    if (!STATE.data?.routes) return [];
    return STATE.data.routes.filter(route => route.type === routeType);
}

function getAvailableDrivers() {
    if (!STATE.data?.staff) return [];
    
    // Get all assigned drivers
    const assignedDrivers = STATE.data.routes
        .map(route => route.driver?.name)
        .filter(Boolean);
    
    // Return available staff (not assigned as drivers and not out of service)
    return STATE.data.staff.filter(staff => 
        !assignedDrivers.includes(staff.name) &&
        !STATE.staffOut.some(out => out.name === staff.name)
    );
}

function getAvailableAssets() {
    if (!STATE.data?.assets) return [];
    
    // Get all assigned assets
    const assignedAssets = STATE.data.routes
        .map(route => route.asset?.number)
        .filter(Boolean);
    
    // Return available assets (not assigned to routes and NOT trailers)
    return STATE.data.assets.filter(asset => 
        !assignedAssets.includes(asset.name) &&
        asset.status !== 'down' &&
        !(asset.type && asset.type.toLowerCase().includes('trailer'))
    );
}

function getAvailableTrailers() {
    if (!STATE.data?.assets) return [];
    
    // Get all assigned trailers
    const assignedTrailers = STATE.data.routes
        .map(route => route.trailer?.number)
        .filter(Boolean);
    
    // Return available trailers (trailer type assets not assigned to routes)
    return STATE.data.assets.filter(asset => 
        asset.type && asset.type.toLowerCase().includes('trailer') &&
        !assignedTrailers.includes(asset.name) &&
        asset.status !== 'down'
    );
}

function getAvailableSafetyEscorts(excludeRouteId = null) {
    if (!STATE.data?.staff) return [];
    
    // Get all assigned safety escorts (excluding current route)
    const assignedEscorts = STATE.data.routes
        .filter(route => route.id !== excludeRouteId)
        .flatMap(route => route.safetyEscorts.map(escort => escort.name));
    
    // Get assigned drivers
    const assignedDrivers = STATE.data.routes
        .map(route => route.driver?.name)
        .filter(Boolean);
    
    // Return available staff (not assigned elsewhere and not out of service)
    return STATE.data.staff.filter(staff => 
        !assignedEscorts.includes(staff.name) &&
        !assignedDrivers.includes(staff.name) &&
        !STATE.staffOut.some(out => out.name === staff.name)
    );
}

// =============================================================================
// ROUTE CARD RENDERING
// =============================================================================

function generateRouteCardHtml(route) {
    const routeType = ROUTE_TYPES[route.type.toUpperCase().replace('-', '_')] || ROUTE_TYPES.GENERAL_ED;
    const isFieldTrip = route.type === 'field-trips';
    const roleAccent = getDriverRoleColorForRoute(route);
    const contrast = computeContrastColors(roleAccent);
    
    return `
       <div class="route-card bg-white rounded-lg shadow-md border p-4 hover:shadow-lg transition-shadow" 
           data-route-id="${route.id}"
           data-route-type="${route.type}"
           style="background: ${roleAccent}; color: ${contrast.textColor}; border-left:6px solid ${roleAccent}; --panel-bg: ${contrast.panelBg}; --panel-border: ${contrast.panelBorder}; min-height: 400px; width: 300px;">
            
            <!-- Add CSS for collapsed state -->
            <style>
                .route-card {
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                /* Keep assignment/asset/escort panels white for readability */
                .route-card .driver-assignment,
                .route-card .asset-assignment .flex-1,
                .route-card .trailer-assignment .flex-1,
                .route-card .safety-escort-assignment > div,
                .route-card .notes-section,
                .route-card .route-actions,
                .route-card .assignment-section .p-2 {
                    background: #ffffff !important;
                    border-color: rgba(0,0,0,0.08) !important;
                    color: #111827 !important;
                }
                .route-card textarea {
                    background: transparent !important;
                    color: inherit !important;
                    border-color: var(--panel-border) !important;
                }
                /* Keep form controls white for readability */
                .route-card input[type="text"],
                .route-card input[type="number"],
                .route-card select,
                .route-card textarea {
                    background: #ffffff !important;
                    color: #111827 !important;
                    border: 1px solid rgba(0,0,0,0.08) !important;
                }
                .route-card.collapsed {
                    min-height: auto !important;
                    max-width: 300px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-left: 4px solid #3b82f6;
                    overflow: visible;
                }
                .route-card.collapsed:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                .collapsed-summary {
                    animation: fadeIn 0.3s ease-in-out;
                    width: 100%;
                    max-width: calc(300px - 2rem);
                    box-sizing: border-box;
                    position: relative;
                    z-index: 1;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            
            <!-- Route Header -->
            <div class="route-header flex items-center justify-between mb-4">
                <h3 class="font-bold text-lg text-gray-800">${route.name || 'Unnamed Route'}</h3>
                <div class="flex items-center gap-2">
                    ${isFieldTrip ? `
                        <button class="delete-field-trip-btn text-red-400 hover:text-red-600 transition-colors" 
                                onclick="handleDeleteFieldTrip('${route.id}')"
                                title="Delete Field Trip">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84L13.962 3.5H14.5a.5.5 0 0 0 0-1h-1.006a.58.58 0 0 0-.01 0H11ZM10 2.5H6v-1h4v1ZM4.915 3.5l.845 10.58a1 1 0 0 0 .997.92h6.486a1 1 0 0 0 .997-.92L15.085 3.5H4.915Z"/>
                                <path d="M6.5 5.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0v-6ZM8 5.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0v-6ZM9.5 5.5a.5.5 0 0 1 1 0v6a.5.5 0 0 1-1 0v-6Z"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="collapse-card-btn text-gray-400 hover:text-gray-600 transition-colors" 
                            onclick="toggleRouteCard('${route.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="collapse-icon transition-transform">
                            <path d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Collapsible Content -->
            <div id="route-content-${route.id}" class="route-card-content">
                <!-- Status Section -->
                <div class="status-section mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">STATUS:</label>
                    <div class="flex justify-between">
                        <label class="flex flex-col items-center cursor-pointer">
                            <input type="radio" name="status-${route.id}" value="10-8" 
                                   class="mb-1" ${route.status === '10-8' ? 'checked' : ''}
                                   onchange="updateRouteStatus('${route.id}', '10-8')">
                            <span class="text-xs font-medium text-green-600">10-8</span>
                        </label>
                        <label class="flex flex-col items-center cursor-pointer">
                            <input type="radio" name="status-${route.id}" value="10-7" 
                                   class="mb-1" ${route.status === '10-7' ? 'checked' : ''}
                                   onchange="updateRouteStatus('${route.id}', '10-7')">
                            <span class="text-xs font-medium text-red-600">10-7</span>
                        </label>
                        <label class="flex flex-col items-center cursor-pointer">
                            <input type="radio" name="status-${route.id}" value="10-11" 
                                   class="mb-1" ${route.status === '10-11' ? 'checked' : ''}
                                   onchange="updateRouteStatus('${route.id}', '10-11')">
                            <span class="text-xs font-medium text-orange-600">10-11</span>
                        </label>
                    </div>
                    <hr class="mt-3 border-gray-300">
                </div>

                ${isFieldTrip ? `
                    <!-- Destination (Field Trips Only) -->
                    <div class="destination-section mb-4">
                        <label class="block text-sm font-medium text-gray-600 mb-1">DESTINATION:</label>
                        <input type="text" 
                               class="w-full p-2 border border-gray-300 rounded text-sm"
                               placeholder="Enter destination"
                               value="${route.destination || ''}"
                               onchange="updateRouteDestination('${route.id}', this.value)">
                    </div>
                ` : ''}
            
            <!-- Driver Assignment -->
            <div class="assignment-section mb-3">
                <label class="block text-sm font-medium text-blue-600 mb-1">DRIVER:</label>
                <div class="driver-assignment p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                     onclick="handleAssignDriver('${route.id}')">
                    ${route.driver ? 
                        `<span class="text-sm text-gray-800">${route.driver.name}</span>` : 
                        `<span class="text-sm text-gray-500">Click to assign</span>`
                    }
                </div>
            </div>
            
            <!-- Asset Assignment -->
            <div class="assignment-section mb-3">
                <label class="block text-sm font-medium text-purple-600 mb-1">ASSET:</label>
                <div class="asset-assignment flex items-center">
                    <div class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAssignAsset('${route.id}')">
                        ${route.asset ? 
                            `<span class="text-sm text-gray-800">${route.asset.name}</span>` : 
                            `<span class="text-sm text-gray-500">Click to assign</span>`
                        }
                    </div>
                    ${isFieldTrip && route.asset ? `
                        <button class="ml-2 px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                                onclick="handleEditAsset('${route.id}')">
                            Edit
                        </button>
                    ` : ''}
                </div>
            </div>
            
            ${isFieldTrip ? `
            <!-- Trailer Assignment (Field Trips Only) -->
            <div class="assignment-section mb-3">
                <label class="block text-sm font-medium text-orange-600 mb-1">TRAILER: <span class="text-gray-400">(optional)</span></label>
                <div class="trailer-assignment flex items-center">
                    <div class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAssignTrailer('${route.id}')">
                        ${route.trailer ? 
                            `<span class="text-sm text-gray-800">${route.trailer.name}</span>` : 
                            `<span class="text-sm text-gray-500">Click to assign trailer</span>`
                        }
                    </div>
                    ${route.trailer ? `
                        <button class="ml-2 px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                                onclick="handleRemoveTrailer('${route.id}')">
                            Remove
                        </button>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <!-- Safety Escort Assignment -->
            <div class="assignment-section mb-4">
                <label class="block text-sm font-medium text-green-600 mb-1">
                    SAFETY ESCORT:${isFieldTrip ? ' <span class="text-gray-400">(optional)</span>' : ''}
                </label>
                <div class="safety-escort-assignment">
                    ${route.safetyEscorts && route.safetyEscorts.length > 0 ? `
                        <div class="space-y-1 mb-2">
                            ${route.safetyEscorts.map((escort, index) => `
                                <div class="flex items-center justify-between p-1 bg-green-50 rounded text-sm">
                                    <span class="text-gray-800">${escort.name}</span>
                                    <button class="remove-escort-btn text-red-500 hover:text-red-700 text-xs" 
                                            onclick="handleRemoveSafetyEscort('${route.id}', '${escort.name}')">
                                        ✕
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAddSafetyEscort('${route.id}')">
                        <span class="text-sm text-gray-500">
                            ${route.safetyEscorts && route.safetyEscorts.length > 0 ? 'Click to assign' : 'Click to assign'}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Notes Section -->
            <div class="notes-section mb-4">
                <label class="block text-sm font-medium text-gray-600 mb-1">NOTES:</label>
                <textarea class="w-full p-2 border border-gray-300 rounded text-sm resize-none" 
                          rows="3"
                          placeholder="Add notes..."
                          onchange="handleUpdateNotes('${route.id}', this.value)">${route.notes || ''}</textarea>
                </div>
                
                <!-- Reset Button -->
                <div class="route-actions">
                    <button class="reset-card-btn w-full py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors" 
                            onclick="handleResetCard('${route.id}')">
                        ${isFieldTrip ? 'Reset Field Trip' : 'Reset Card'}
                    </button>
                </div>
            </div> <!-- End collapsible content -->
        </div>
    `;
}

function renderRouteCards() {
    console.log('🚗 Rendering route cards...');
    
    // Use performance optimization
    if (PERFORMANCE.isRendering) {
        console.log('⏭️ Already rendering, skipping duplicate call');
        return;
    }
    
    PERFORMANCE.isRendering = true;
    
    try {
        const container = document.getElementById('route-cards-grid');
        if (!container) {
            console.error('❌ Route cards container not found');
            return;
        }
        
        // Initialize with sample data if no routes exist
        if (!STATE.data?.routes || STATE.data.routes.length === 0) {
            initializeSampleRoutes();
        }

        // Clean up any duplicate routes before rendering
        deduplicateRoutes();

        // Filter out inactive routes and filter by current view (AM/PM)
        const activeRoutes = STATE.data.routes.filter(route => {
            // Exclude inactive routes from dashboard
            if (route.type === 'inactive') return false;
            
            // Filter by current view (AM/PM) - show routes for current shift or both
            const routeSchedule = route.schedule || route.shift; // support both schedule and shift properties
            const currentView = STATE.currentView.toLowerCase(); // ensure lowercase comparison
            return routeSchedule === currentView || routeSchedule === 'both';
        });
        
        console.log(`🔍 Displaying ${activeRoutes.length} routes for ${STATE.currentView} shift`);
        
        // Sort routes by route number in ascending order (1, 2, 3, etc.)
        activeRoutes.sort((a, b) => {
            // Handle field trip route numbers (FT1, FT2, etc.)
            if (a.type === 'field-trips' && b.type === 'field-trips') {
                // Extract numbers from field trip names for more reliable sorting
                const nameA = a.name || '';
                const nameB = b.name || '';
                const matchA = nameA.match(/Field Trip (\d+)/);
                const matchB = nameB.match(/Field Trip (\d+)/);
                const numA = matchA ? parseInt(matchA[1]) : 0;
                const numB = matchB ? parseInt(matchB[1]) : 0;
                return numA - numB;
            }
            
            // Handle regular route numbers
            const numA = parseInt(a.routeNumber) || 0;
            const numB = parseInt(b.routeNumber) || 0;
            return numA - numB;
        });
        
        console.log(`🔍 Displaying ${activeRoutes.length} routes for ${STATE.currentView} shift (sorted by route number)`);
        
        // Group sorted routes by type
        const routesByType = {};
        Object.keys(ROUTE_TYPES).forEach(key => {
            const typeId = ROUTE_TYPES[key].id;
            if (typeId !== 'inactive') { // Skip inactive type for dashboard display
                routesByType[typeId] = activeRoutes.filter(route => route.type === typeId);
            }
        });
        
        // Generate HTML for each route type section (excluding inactive)
        const sectionsHtml = Object.entries(ROUTE_TYPES)
            .filter(([key, type]) => type.id !== 'inactive') // Don't show inactive section on dashboard
            .map(([key, type]) => {
            const routes = routesByType[type.id] || [];
            
            return `
                <div class="route-type-section mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span style="color: ${type.color}">${type.icon}</span>
                            ${type.label.toUpperCase()} ROUTES
                            <span class="text-sm font-normal text-gray-500 ml-2">(${routes.length})</span>
                        </h2>
                        <div class="flex items-center gap-2">
                            ${type.id === 'field-trips' ? `
                                <button class="add-field-trip-btn bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                                        onclick="addNewFieldTripRoute()">
                                    + Add Field Trip
                                </button>
                                ${routes.length > 0 ? `
                                    <button class="delete-all-field-trips-btn bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                                            onclick="deleteAllFieldTrips()">
                                        🗑️ Delete All
                                    </button>
                                ` : ''}
                            ` : ''}
                            <button class="collapse-section-btn text-gray-500 hover:text-gray-700 text-sm"
                                    onclick="toggleSection('${type.id}')">
                                Collapse All
                            </button>
                        </div>
                    </div>
                    
                    <div id="section-${type.id}" class="route-section-content">
                        ${routes.length > 0 ? `
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                                ${routes.map(route => generateRouteCardHtml(route)).join('')}
                            </div>
                        ` : `
                            <div class="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                                <p class="text-gray-500 mb-2">No ${type.label.toLowerCase()} routes configured</p>
                                <p class="text-sm text-gray-400">Use Route Management to configure routes</p>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = sectionsHtml;
        
        // Add event listeners
        setupRouteCardEventListeners();
        
        console.log('✅ Route cards rendered successfully');
        
    } catch (error) {
        console.error('❌ Error rendering route cards:', error);
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

// Re-render when role colors change
eventBus.on('colors:changed', (data) => {
    console.log('🎨 Role colors changed, re-rendering route cards', data);
    debounceRender('renderRouteCards');
});

// Initialize sample routes for demonstration
function initializeSampleRoutes() {
    console.log('🎯 Initializing sample route data...');
    
    if (!STATE.data) STATE.data = { routes: [], staff: [], assets: [] };
    if (!Array.isArray(STATE.data.routes)) STATE.data.routes = [];
    
    // Sample General Education routes
    const genEdRoutes = ['Route 2', 'Route 3', 'Route 4', 'Route 5', 'Route 6', 'Route 7'];
    genEdRoutes.forEach(name => {
        const route = createRouteTemplate('general-education');
        route.name = name;
        STATE.data.routes.push(route);
    });
    
    // Sample Special Education routes  
    const specEdRoutes = ['Route 86', 'Route 87', 'Route 88', 'Route 80', 'Route 81', 'Route 82'];
    specEdRoutes.forEach(name => {
        const route = createRouteTemplate('special-education');
        route.name = name;
        STATE.data.routes.push(route);
    });
    
    // Sample Miscellaneous route
    const miscRoute = createRouteTemplate('miscellaneous');
    miscRoute.name = 'Route 70';
    STATE.data.routes.push(miscRoute);
    
    // Note: No sample field trip - let users create their own starting from Field Trip 1
    
    saveToLocalStorage();
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

function setupRouteCardEventListeners() {
    const container = document.getElementById('route-cards-grid');
    if (!container) return;
    
    // Remove existing listeners
    container.removeEventListener('click', handleRouteCardClick);
    
    // Add new listener for create route buttons
    container.addEventListener('click', handleRouteCardClick);
}

function handleRouteCardClick(event) {
    const target = event.target;
    
    // Handle create route buttons
    if (target.classList.contains('create-route-btn')) {
        const routeType = target.dataset.routeType;
        handleCreateRoute(routeType);
        return;
    }
    
    // Note: Most other interactions are now handled via onclick attributes in HTML
    // This is to simplify the event handling for the complex route card interface
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

function handleCreateRoute(routeType) {
    console.log('Creating route of type:', routeType);
    const routeName = prompt(`Enter name for new ${ROUTE_TYPES[routeType.toUpperCase().replace('-', '_')].label}:`);
    if (routeName) {
        createRoute(routeType, routeName);
        debounceRender('renderRouteCards');
    }
}

function handleAssignDriver(routeId) {
    console.log('Assigning driver to route:', routeId);
    const availableDrivers = getAvailableDrivers();
    if (availableDrivers.length === 0) {
        alert('No available drivers');
        return;
    }
    
    showSelectionModal({
        title: 'Assign Driver',
        items: availableDrivers,
        itemDisplayKey: 'name',
        multiSelect: false,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                assignDriver(routeId, selectedItems[0]);
                debounceRender('renderRouteCards');
            }
        }
    });
}

function handleAssignAsset(routeId) {
    console.log('Assigning asset to route:', routeId);
    const availableAssets = getAvailableAssets();
    if (availableAssets.length === 0) {
        alert('No available assets');
        return;
    }
    
    showSelectionModal({
        title: 'Assign Asset',
        items: availableAssets,
        itemDisplayKey: 'name',
        itemIdKey: 'name', // Use name as the unique identifier for assets
        multiSelect: false,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                assignAsset(routeId, selectedItems[0]);
                debounceRender('renderRouteCards');
            }
        }
    });
}

function handleEditAsset(routeId) {
    console.log('Editing asset for route:', routeId);
    handleAssignAsset(routeId); // Use the same modal as assign
}

function handleAssignTrailer(routeId) {
    console.log('Assigning trailer to route:', routeId);
    const availableTrailers = getAvailableTrailers();
    if (availableTrailers.length === 0) {
        alert('No available trailers');
        return;
    }
    
    showSelectionModal({
        title: 'Assign Trailer',
        items: availableTrailers,
        itemDisplayKey: 'name',
        itemIdKey: 'name', // Use name as the unique identifier for trailers
        multiSelect: false,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                assignTrailer(routeId, selectedItems[0]);
                debounceRender('renderRouteCards');
            }
        }
    });
}

function handleRemoveTrailer(routeId) {
    console.log('Removing trailer from route:', routeId);
    const route = findRouteById(routeId);
    if (route) {
        route.trailer = null;
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
        debounceRender('renderRouteCards');
    }
}

function handleDeleteFieldTrip(routeId) {
    console.log('Deleting field trip:', routeId);
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return;
    }

    // Confirm deletion
    const routeName = route.name || 'this field trip';
    const confirmMessage = `Are you sure you want to delete "${routeName}"?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    // Check if route has assignments
    const hasAssignments = route.driver || route.asset || route.trailer || 
                          (route.safetyEscorts && route.safetyEscorts.length > 0);
    
    if (hasAssignments) {
        const warningMessage = `"${routeName}" has assignments (driver, vehicle, or escorts).\n\nDeleting this field trip will remove all assignments. Continue?`;
        if (!confirm(warningMessage)) {
            return;
        }
    }

    // Remove the route from the routes array
    const routeIndex = STATE.data.routes.findIndex(r => r.id === routeId);
    if (routeIndex !== -1) {
        STATE.data.routes.splice(routeIndex, 1);
        
        // Save and re-render
        saveToLocalStorage();
        debounceRender('renderRouteCards');
        
        // Emit event for other systems that might be listening
        eventBus.emit('routes:deleted', { routeId, route });
        
        console.log(`✅ Field trip "${routeName}" deleted successfully`);
        
        // Show success message
        showTemporaryMessage(`Field trip "${routeName}" has been deleted`, 'success');
    } else {
        console.error('❌ Could not find route to delete:', routeId);
    }
}

/**
 * Show a temporary message to the user
 */
function showTemporaryMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    
    messageDiv.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

/**
 * Delete all field trips with confirmation
 */
function deleteAllFieldTrips() {
    console.log('Delete all field trips requested');
    
    // Get all field trip routes
    const fieldTrips = getRoutesByType('field-trips');
    
    if (fieldTrips.length === 0) {
        showTemporaryMessage('No field trips to delete', 'info');
        return;
    }
    
    // Count field trips with assignments
    const fieldTripsWithAssignments = fieldTrips.filter(route => {
        return route.driver || route.asset || route.trailer || 
               (route.safetyEscorts && route.safetyEscorts.length > 0);
    });
    
    // Build confirmation message
    let confirmMessage = `Are you sure you want to delete ALL ${fieldTrips.length} field trips?\n\nThis action cannot be undone.`;
    
    if (fieldTripsWithAssignments.length > 0) {
        confirmMessage += `\n\nWarning: ${fieldTripsWithAssignments.length} field trip(s) have assignments (drivers, vehicles, or escorts) that will be removed.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Delete all field trips
    const deletedNames = fieldTrips.map(route => route.name || 'Unnamed Field Trip');
    
    // Remove all field trip routes from the routes array
    STATE.data.routes = STATE.data.routes.filter(route => route.type !== 'field-trips');
    
    // Save and re-render
    saveToLocalStorage();
    debounceRender('renderRouteCards');
    
    // Emit event for other systems that might be listening
    eventBus.emit('routes:bulkDeleted', { 
        type: 'field-trips', 
        count: fieldTrips.length,
        deletedRoutes: fieldTrips 
    });
    
    console.log(`✅ All ${fieldTrips.length} field trips deleted successfully`);
    
    // Show success message
    showTemporaryMessage(`All ${fieldTrips.length} field trips have been deleted`, 'success');
}

function handleAddSafetyEscort(routeId) {
    console.log('Adding safety escort to route:', routeId);
    const availableEscorts = getAvailableSafetyEscorts(routeId);
    if (availableEscorts.length === 0) {
        alert('No available safety escorts');
        return;
    }
    
    showSelectionModal({
        title: 'Assign Safety Escorts',
        items: availableEscorts,
        itemDisplayKey: 'name',
        multiSelect: true,
        maxSelections: 5,
        onConfirm: (selectedItems) => {
            selectedItems.forEach(escort => {
                addSafetyEscort(routeId, escort);
            });
            if (selectedItems.length > 0) {
                debounceRender('renderRouteCards');
            }
        }
    });
}

// =============================================================================
// SELECTION MODAL FUNCTIONALITY
// =============================================================================

/**
 * Show a selection modal for choosing drivers, assets, or safety escorts
 * @param {Object} options - Modal configuration
 * @param {string} options.title - Modal title
 * @param {Array} options.items - Array of items to choose from
 * @param {string} options.itemDisplayKey - Key to display for each item (e.g., 'name')
 * @param {string} options.itemIdKey - Key to use as unique identifier (defaults to 'id')
 * @param {boolean} options.multiSelect - Allow multiple selections
 * @param {number} options.maxSelections - Max selections for multi-select
 * @param {Function} options.onConfirm - Callback with selected items
 */
function showSelectionModal(options) {
    const modal = document.getElementById('assignment-modal');
    const title = document.getElementById('modal-title');
    const search = document.getElementById('modal-search');
    const list = document.getElementById('modal-list');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');
    
    if (!modal || !title || !search || !list || !cancelBtn || !confirmBtn) {
        console.error('❌ Selection modal elements not found');
        return;
    }
    
    // Set up identifier key - default to 'id' if not specified
    const idKey = options.itemIdKey || 'id';
    
    // Set title
    title.textContent = options.title;
    
    // Clear previous content
    search.value = '';
    list.innerHTML = '';
    
    // Track selected items
    let selectedItems = [];
    
    // Render items list
    function renderItems(filteredItems = options.items) {
        list.innerHTML = '';
        
        filteredItems.forEach(item => {
            const isSelected = selectedItems.some(selected => selected[idKey] === item[idKey]);
            const itemDiv = document.createElement('div');
            itemDiv.className = `p-3 border rounded cursor-pointer transition-colors ${
                isSelected 
                    ? 'bg-blue-100 border-blue-500 text-blue-700' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`;
            
            const displayText = item[options.itemDisplayKey] || item.name || item.toString();
            const subtitle = getItemSubtitle(item);
            
            itemDiv.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-medium">${displayText}</div>
                        ${subtitle ? `<div class="text-sm text-gray-600">${subtitle}</div>` : ''}
                    </div>
                    ${isSelected ? '<div class="text-blue-600">✓</div>' : ''}
                </div>
            `;
            
            itemDiv.addEventListener('click', () => {
                if (options.multiSelect) {
                    // Multi-select logic
                    if (isSelected) {
                        selectedItems = selectedItems.filter(selected => selected[idKey] !== item[idKey]);
                    } else {
                        if (!options.maxSelections || selectedItems.length < options.maxSelections) {
                            selectedItems.push(item);
                        } else {
                            alert(`Maximum ${options.maxSelections} selections allowed`);
                            return;
                        }
                    }
                } else {
                    // Single select logic
                    selectedItems = isSelected ? [] : [item];
                }
                renderItems(filteredItems);
                updateConfirmButton();
            });
            
            list.appendChild(itemDiv);
        });
    }
    
    // Get subtitle for different item types
    function getItemSubtitle(item) {
        if (item.role) return item.role; // Staff member
        if (item.type) return item.type; // Asset
        if (item.number) return `#${item.number}`; // Asset with number
        return null;
    }
    
    // Update confirm button state
    function updateConfirmButton() {
        confirmBtn.disabled = selectedItems.length === 0;
        confirmBtn.className = selectedItems.length === 0 
            ? 'px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed'
            : 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer';
        
        if (options.multiSelect) {
            confirmBtn.textContent = selectedItems.length === 0 
                ? 'Select Items' 
                : `Assign (${selectedItems.length})`;
        } else {
            confirmBtn.textContent = selectedItems.length === 0 ? 'Select Item' : 'Assign';
        }
    }
    
    // Search functionality
    search.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredItems = options.items.filter(item => {
            const displayText = item[options.itemDisplayKey] || item.name || '';
            return displayText.toLowerCase().includes(searchTerm);
        });
        renderItems(filteredItems);
    });
    
    // Event handlers
    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };
    
    confirmBtn.onclick = () => {
        if (selectedItems.length > 0 && options.onConfirm) {
            options.onConfirm(selectedItems);
        }
        modal.classList.add('hidden');
    };
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    };
    
    // Initial render
    renderItems();
    updateConfirmButton();
    
    // Show modal
    modal.classList.remove('hidden');
    search.focus();
}

// Make modal function globally available
window.showSelectionModal = showSelectionModal;

function handleRemoveSafetyEscort(routeId, escortName) {
    console.log('Removing safety escort from route:', routeId, escortName);
    removeSafetyEscort(routeId, escortName);
    debounceRender('renderRouteCards');
}

function handleUpdateNotes(routeId, notes) {
    console.log('Updating notes for route:', routeId);
    updateRouteNotes(routeId, notes);
    // Don't re-render on every keystroke, just save
}

function handleResetCard(routeId) {
    console.log('Resetting card for route:', routeId);
    if (confirm('Are you sure you want to reset this route? This will clear all assignments and notes.')) {
        const route = findRouteById(routeId);
        if (route) {
            route.driver = null;
            route.asset = null;
            route.safetyEscorts = [];
            route.notes = '';
            route.status = 'unassigned';
            if (route.destination !== null) route.destination = '';
            route.updatedAt = new Date().toISOString();
            saveToLocalStorage();
            debounceRender('renderRouteCards');
        }
    }
}

function handleEditRoute(routeId) {
    console.log('Editing route:', routeId);
    const route = findRouteById(routeId);
    if (route) {
        const newName = prompt('Enter new route name:', route.name);
        if (newName !== null) {
            route.name = newName;
            route.updatedAt = new Date().toISOString();
            saveToLocalStorage();
            debounceRender('renderRouteCards');
        }
    }
}

function handleDeleteRoute(routeId) {
    console.log('Deleting route:', routeId);
    if (confirm('Are you sure you want to delete this route?')) {
        STATE.data.routes = STATE.data.routes.filter(route => route.id !== routeId);
        saveToLocalStorage();
        debounceRender('renderRouteCards');
    }
}

// Global functions for onclick handlers in HTML
window.updateRouteStatus = function(routeId, status) {
    console.log('🔄 Updating route status:', routeId, 'to:', status);
    const route = findRouteById(routeId);
    if (route) {
        console.log('📊 Route found, old status:', route.status, '→ new status:', status);
        route.status = status;
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
        
        // Update collapsed summary if it exists
        const card = document.querySelector(`[data-route-id="${routeId}"]`);
        if (card && card.classList.contains('collapsed')) {
            console.log('🔄 Updating collapsed summary for route:', routeId);
            const existingSummary = card.querySelector('.collapsed-summary');
            if (existingSummary) {
                existingSummary.remove();
                createCollapsedSummary(routeId, card);
            }
        }
    } else {
        console.error('❌ Route not found for status update:', routeId);
    }
};

window.updateRouteDestination = function(routeId, destination) {
    console.log('Updating route destination:', routeId, destination);
    const route = findRouteById(routeId);
    if (route) {
        route.destination = destination;
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
    }
};

// =============================================================================
// FIELD TRIP MANAGEMENT
// =============================================================================

/**
 * Add a new field trip route
 */
function addNewFieldTripRoute() {
    console.log('🚌 Creating new field trip...');
    console.log('🔍 Current STATE.data:', STATE.data);
    console.log('🔍 Current STATE.currentView:', STATE.currentView);
    
    // Ensure routes array exists
    if (!Array.isArray(STATE.data.routes)) {
        STATE.data.routes = [];
    }
    
    // Clean up any sample field trips that might be interfering with numbering
    // Only run cleanup once per session to avoid removing legitimate field trips
    if (!window.fieldTripCleanupDone) {
        cleanupSampleFieldTrips();
        window.fieldTripCleanupDone = true;
    }
    
    // Find existing field trip routes to determine next number
    const existingFieldTrips = STATE.data.routes.filter(route => route.type === 'field-trips');
    console.log('🔍 Existing field trips after cleanup:', existingFieldTrips);
    
    // Smart numbering: find the lowest available number starting from 1
    let nextNumber = 1;
    if (existingFieldTrips.length > 0) {
        // Extract existing numbers from field trip names
        const existingNumbers = existingFieldTrips
            .map(ft => {
                console.log('🔍 Checking field trip:', ft.name, 'ID:', ft.id);
                // Try to extract number from name like "Field Trip 1", "Field Trip 2", etc.
                const match = ft.name.match(/Field Trip (\d+)/);
                const number = match ? parseInt(match[1]) : null;
                console.log('🔍 Extracted number:', number);
                return number;
            })
            .filter(num => num !== null)
            .sort((a, b) => a - b); // Sort numerically ascending
        
        console.log('🔍 Existing field trip numbers:', existingNumbers);
        
        // Find the first gap in the sequence, or use the next number after the highest
        for (let i = 1; i <= existingNumbers.length + 1; i++) {
            if (!existingNumbers.includes(i)) {
                nextNumber = i;
                break;
            }
        }
    }
    
    console.log(`🔍 Next field trip number will be: ${nextNumber}`);
    const fieldTripName = `Field Trip ${nextNumber}`;
    
    // Generate unique ID with timestamp to avoid conflicts
    const timestamp = Date.now();
    const uniqueId = `fieldtrip-${timestamp}`;
    
    // Create a new field trip route - use 'both' schedule so it appears on the board
    const fieldTrip = createRouteTemplate(uniqueId, 'field-trips', 'both');
    fieldTrip.name = fieldTripName;
    fieldTrip.id = uniqueId; // Override the default ID
    fieldTrip.routeNumber = `FT${nextNumber}`; // Use FT prefix for field trips
    fieldTrip.destination = ''; // Initialize empty destination
    
    console.log('🔍 Created field trip:', fieldTrip);
    
    // Add to routes array
    STATE.data.routes.push(fieldTrip);
    
    console.log(`🔍 Routes array after adding: ${STATE.data.routes.length} total routes`);
    console.log('🔍 Field trips in array:', STATE.data.routes.filter(r => r.type === 'field-trips'));
    
    // Save and re-render
    saveToLocalStorage();
    
    // Force immediate re-render
    console.log('🔄 Forcing immediate re-render...');
    PERFORMANCE.isRendering = false; // Reset the rendering flag
    renderRouteCards();
    
    eventBus.emit('routes:created', { route: fieldTrip });
    console.log(`✅ Field trip created successfully: ${fieldTripName} (ID: ${uniqueId})`);
    
    // Show success notification
    if (typeof window !== 'undefined' && window.uiSystem) {
        window.uiSystem.showNotification(
            `${fieldTripName} added to ${STATE.currentView} board`,
            'success',
            3000
        );
    }
}

/**
 * Clean up sample field trips that might interfere with numbering
 * Only removes field trips that are clearly leftover samples from initialization
 */
function cleanupSampleFieldTrips() {
    if (!Array.isArray(STATE.data.routes)) return;
    
    const beforeCount = STATE.data.routes.length;
    
    // Only remove field trips that are definitely samples:
    // - Named "Field Trip 1" 
    // - Have a route ID that starts with "route-" (not the timestamp-based IDs we create)
    // - Empty destination, no assignments, no notes
    // This prevents removal of legitimately created field trips
    STATE.data.routes = STATE.data.routes.filter(route => {
        if (route.type !== 'field-trips') return true; // Keep non-field-trips
        
        const isSample = (
            route.name === 'Field Trip 1' &&
            route.id && route.id.startsWith('route-') && // Sample routes have route-* IDs
            (!route.destination || route.destination.trim() === '') &&
            !route.driver &&
            !route.asset &&
            (!route.safetyEscorts || route.safetyEscorts.length === 0) &&
            (!route.notes || route.notes.trim() === '')
        );
        
        if (isSample) {
            console.log('🧹 Removing sample field trip:', route.name, 'ID:', route.id);
        }
        
        return !isSample; // Keep if NOT a sample
    });
    
    const afterCount = STATE.data.routes.length;
    if (beforeCount !== afterCount) {
        console.log(`🧹 Cleaned up ${beforeCount - afterCount} sample field trips`);
        saveToLocalStorage();
    }
}

/**
 * Clean up and renumber all field trips in sequential order
 * This function can be called to reset field trip numbering or clean up gaps
 */
function renumberFieldTrips() {
    console.log('🔢 Renumbering all field trips...');
    
    const fieldTrips = STATE.data.routes.filter(route => route.type === 'field-trips');
    
    if (fieldTrips.length === 0) {
        console.log('✅ No field trips to renumber');
        return;
    }
    
    // Sort field trips by their current numbers to maintain relative order
    fieldTrips.sort((a, b) => {
        const matchA = a.name.match(/Field Trip (\d+)/);
        const matchB = b.name.match(/Field Trip (\d+)/);
        const numA = matchA ? parseInt(matchA[1]) : 0;
        const numB = matchB ? parseInt(matchB[1]) : 0;
        return numA - numB;
    });
    
    // Renumber them sequentially starting from 1
    fieldTrips.forEach((fieldTrip, index) => {
        const newNumber = index + 1;
        const newName = `Field Trip ${newNumber}`;
        const newRouteNumber = `FT${newNumber}`;
        
        console.log(`🔄 Renumbering: "${fieldTrip.name}" → "${newName}"`);
        
        fieldTrip.name = newName;
        fieldTrip.routeNumber = newRouteNumber;
        fieldTrip.updatedAt = new Date().toISOString();
    });
    
    // Save changes
    saveToLocalStorage();
    
    // Re-render to show changes
    PERFORMANCE.isRendering = false;
    renderRouteCards();
    
    console.log(`✅ Renumbered ${fieldTrips.length} field trips`);
    
    // Show notification
    if (typeof window !== 'undefined' && window.uiSystem) {
        window.uiSystem.showNotification(
            `Field trips renumbered: ${fieldTrips.length} trips now in sequence`,
            'info',
            3000
        );
    }
}

/**
 * Check if field trip numbering needs cleanup and optionally auto-renumber
 */
function checkFieldTripNumbering(autoRenumber = false) {
    const fieldTrips = STATE.data.routes.filter(route => route.type === 'field-trips');
    
    if (fieldTrips.length === 0) {
        return { needsRenumbering: false, gaps: [], maxNumber: 0 };
    }
    
    const numbers = fieldTrips
        .map(ft => {
            const match = ft.name.match(/Field Trip (\d+)/);
            return match ? parseInt(match[1]) : null;
        })
        .filter(num => num !== null)
        .sort((a, b) => a - b);
    
    const gaps = [];
    const maxNumber = Math.max(...numbers);
    
    // Check for gaps in numbering
    for (let i = 1; i < maxNumber; i++) {
        if (!numbers.includes(i)) {
            gaps.push(i);
        }
    }
    
    const needsRenumbering = gaps.length > 0 || numbers[0] !== 1;
    
    if (autoRenumber && needsRenumbering) {
        renumberFieldTrips();
    }
    
    return { needsRenumbering, gaps, maxNumber, count: fieldTrips.length };
}

// =============================================================================
// CARD COLLAPSE FUNCTIONALITY
// =============================================================================

/**
 * Toggle collapse/expand state of a route card
 * @param {string} routeId - The ID of the route card to toggle
 */
function toggleRouteCard(routeId) {
    const content = document.getElementById(`route-content-${routeId}`);
    const button = document.querySelector(`[onclick="toggleRouteCard('${routeId}')"]`);
    const icon = button?.querySelector('.collapse-icon');
    const card = content?.closest('.route-card');
    
    if (!content || !button || !icon || !card) {
        console.error('❌ Could not find route card elements for:', routeId);
        return;
    }
    
    const isCollapsed = content.style.display === 'none';
    
    if (isCollapsed) {
        // Expand
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
        button.title = 'Collapse card';
        card.classList.remove('collapsed');
        
        // Remove collapsed summary if it exists
        const existingSummary = card.querySelector('.collapsed-summary');
        if (existingSummary) {
            existingSummary.remove();
        }
    } else {
        // Collapse
        content.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
        button.title = 'Expand card';
        card.classList.add('collapsed');
        
        // Add collapsed summary
        createCollapsedSummary(routeId, card);
    }
}

/**
 * Create a summary view for collapsed route cards
 * @param {string} routeId - The route ID
 * @param {Element} card - The route card element
 */
function createCollapsedSummary(routeId, card) {
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found for collapsed summary:', routeId);
        return;
    }
    
    console.log('📋 Creating collapsed summary for route:', routeId, 'status:', route.status);
    
    // Remove any existing summary
    const existingSummary = card.querySelector('.collapsed-summary');
    if (existingSummary) {
        existingSummary.remove();
    }
    
    // Create summary HTML
    const summaryHtml = `
        <div class="collapsed-summary mt-3 p-2 bg-gray-50 rounded border-l-4 border-blue-400" style="width: 100%; max-width: 100%; box-sizing: border-box;">
            <div class="flex flex-col gap-2 text-sm" style="width: 100%; overflow: hidden;">
                <!-- Status Row -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1 min-w-0 flex-1">
                        ${route.status && ['10-8', '10-7', '10-11'].includes(route.status) ? `
                        <span class="text-xs font-medium text-gray-500 shrink-0">Status:</span>
                        <span class="status-indicator ${getStatusColor(route.status)} px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                            ${route.status}
                        </span>
                        ` : ''}
                    </div>
                    ${route.notes && route.notes.trim() ? 
                        `<div class="flex items-center ml-2">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-blue-500">
                                <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1h12zM2 2.5V13L4.414 10.5A1.5 1.5 0 0 1 5.5 10H14V2H2z"/>
                                <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                            </svg>
                        </div>` : ''
                    }
                </div>
                
                <!-- Assignments Row -->
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1 min-w-0">
                        <span class="text-xs font-medium text-gray-500 shrink-0">Driver:</span>
                        <span class="text-xs ${route.driver ? 'text-green-600 font-medium' : 'text-gray-400'} truncate">
                            ${route.driver ? route.driver.name : 'Not assigned'}
                        </span>
                    </div>
                    
                    <div class="flex items-center gap-1 min-w-0">
                        <span class="text-xs font-medium text-gray-500 shrink-0">Vehicle:</span>
                        <span class="text-xs ${route.asset ? 'text-purple-600 font-medium' : 'text-gray-400'} truncate">
                            ${route.asset ? route.asset.name : 'Not assigned'}
                        </span>
                    </div>
                    
                    ${route.type === 'field-trip' && route.trailer ? `
                    <div class="flex items-center gap-1 min-w-0">
                        <span class="text-xs font-medium text-gray-500 shrink-0">Trailer:</span>
                        <span class="text-xs text-orange-600 font-medium truncate">
                            ${route.trailer.name}
                        </span>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Indicators Row -->
                ${route.safetyEscorts && route.safetyEscorts.length > 0 ? `
                <div class="flex items-center gap-2 mt-1">
                    <span class="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                        ${route.safetyEscorts.length} Escort${route.safetyEscorts.length > 1 ? 's' : ''}
                    </span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Insert summary after the route header
    const header = card.querySelector('.route-header');
    if (header) {
        header.insertAdjacentHTML('afterend', summaryHtml);
    }
}

/**
 * Get CSS classes for status color coding
 * @param {string} status - The route status
 * @returns {string} CSS classes
 */
function getStatusColor(status) {
    switch (status) {
        case '10-8': return 'bg-green-100 text-green-700';
        case '10-7': return 'bg-red-100 text-red-700';
        case '10-11': return 'bg-orange-100 text-orange-700';
        default: return 'bg-gray-100 text-gray-600';
    }
}

/**
 * Toggle collapse/expand state of all cards in a route type section
 * @param {string} sectionId - The section ID (route type)
 */
function toggleSection(sectionId) {
    const section = document.getElementById(`section-${sectionId}`);
    const button = document.querySelector(`[onclick="toggleSection('${sectionId}')"]`);
    
    if (!section || !button) {
        console.error('❌ Could not find section elements for:', sectionId);
        return;
    }
    
    // Find all route cards in this section
    const routeCards = section.querySelectorAll('.route-card');
    
    // Check if any cards are expanded (have visible content)
    let hasExpandedCards = false;
    routeCards.forEach(card => {
        const routeId = card.dataset.routeId;
        if (routeId) {
            const content = document.getElementById(`route-content-${routeId}`);
            if (content && content.style.display !== 'none') {
                hasExpandedCards = true;
            }
        }
    });
    
    if (hasExpandedCards) {
        // Collapse all individual cards in the section
        button.textContent = 'Expand All';
        
        routeCards.forEach(card => {
            const routeId = card.dataset.routeId;
            if (routeId) {
                const content = document.getElementById(`route-content-${routeId}`);
                const collapseBtn = card.querySelector('.collapse-card-btn');
                const icon = collapseBtn?.querySelector('.collapse-icon');
                
                if (content && content.style.display !== 'none') {
                    // Collapse this individual card
                    content.style.display = 'none';
                    if (icon) icon.style.transform = 'rotate(-90deg)';
                    card.classList.add('collapsed');
                    
                    // Add collapsed summary
                    createCollapsedSummary(routeId, card);
                }
            }
        });
    } else {
        // Expand all individual cards in the section
        button.textContent = 'Collapse All';
        
        routeCards.forEach(card => {
            const routeId = card.dataset.routeId;
            if (routeId) {
                const content = document.getElementById(`route-content-${routeId}`);
                const collapseBtn = card.querySelector('.collapse-card-btn');
                const icon = collapseBtn?.querySelector('.collapse-icon');
                
                if (content && content.style.display === 'none') {
                    // Expand this individual card
                    content.style.display = 'block';
                    if (icon) icon.style.transform = 'rotate(0deg)';
                    card.classList.remove('collapsed');
                    
                    // Remove collapsed summary
                    const existingSummary = card.querySelector('.collapsed-summary');
                    if (existingSummary) existingSummary.remove();
                }
            }
        });
    }
}

window.handleAssignDriver = handleAssignDriver;
window.handleAssignAsset = handleAssignAsset;
window.handleEditAsset = handleEditAsset;
window.handleAssignTrailer = handleAssignTrailer;
window.handleRemoveTrailer = handleRemoveTrailer;
window.handleDeleteFieldTrip = handleDeleteFieldTrip;
window.deleteAllFieldTrips = deleteAllFieldTrips;
window.handleAddSafetyEscort = handleAddSafetyEscort;
window.handleRemoveSafetyEscort = handleRemoveSafetyEscort;
window.handleUpdateNotes = handleUpdateNotes;
window.handleResetCard = handleResetCard;
window.toggleRouteCard = toggleRouteCard;
window.toggleSection = toggleSection;
window.addNewFieldTripRoute = addNewFieldTripRoute;
window.deduplicateRoutes = deduplicateRoutes;

// =============================================================================
// RESET FUNCTIONALITY
// =============================================================================

/**
 * Reset all route data and clear the route board
 * Clears all routes from STATE and re-renders empty board
 */
function resetRouteBoard() {
    try {
        console.log('🔄 Resetting route board...');
        
        // Clear all route data from STATE
        if (STATE.data) {
            STATE.data.routes = [];
        }
        
        // Save empty state to localStorage
        saveToLocalStorage();
        
        // Clear the UI container
        const container = document.getElementById('route-cards-grid');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="text-gray-500 text-lg">
                        <div class="mb-4">🔄</div>
                        <div>Route board has been reset</div>
                        <div class="text-sm mt-2">Click "Add Route" to start adding routes</div>
                    </div>
                </div>
            `;
        }
        
        // Emit reset event
        eventBus.emit('routeBoard:reset');
        
        console.log('✅ Route board reset complete');
        
    } catch (error) {
        console.error('❌ Error resetting route board:', error);
    }
}

// =============================================================================
// ROUTE CONFIGURATION GRID INTERFACE
// =============================================================================

/**
 * Render the route configuration grid (for management modal)
 * Shows all 100 routes with inline editing capabilities
 */
function renderRouteConfigGrid() {
    console.log('🛠️ Rendering route configuration grid...');
    
    const gridContainer = document.getElementById('route-config-grid');
    if (!gridContainer) {
        console.error('❌ Route config grid container not found');
        return;
    }
    
    // Ensure all 100 routes exist
    ensureAllRoutesExist();
    
    // Get all routes sorted by route number
    const allRoutes = STATE.data.routes
        .filter(route => route.routeNumber >= 1 && route.routeNumber <= 100)
        .sort((a, b) => a.routeNumber - b.routeNumber);
    
    // Fill in missing routes
    const routeMap = new Map(allRoutes.map(route => [route.routeNumber, route]));
    for (let i = 1; i <= 100; i++) {
        if (!routeMap.has(i)) {
            const newRoute = createRoute(i, 'inactive', 'none');
            routeMap.set(i, newRoute);
        }
    }
    
    // Generate grid HTML
    let gridHtml = '';
    for (let i = 1; i <= 100; i++) {
        const route = routeMap.get(i);
        const typeColor = getRouteTypeColor(route.type);
        const assignments = getRouteAssignmentSummary(route);
        
        gridHtml += `
            <tr class="border-t hover:bg-gray-50" data-route-number="${i}">
                <td class="px-3 py-2 font-mono font-medium">${i}</td>
                <td class="px-3 py-2">
                    <select class="route-type-select w-full px-2 py-1 border rounded text-sm" 
                            data-route-number="${i}" 
                            style="border-left: 4px solid ${typeColor};">
                        <option value="general-education" ${route.type === 'general-education' ? 'selected' : ''}>General Education</option>
                        <option value="special-education" ${route.type === 'special-education' ? 'selected' : ''}>Special Education</option>
                        <option value="miscellaneous" ${route.type === 'miscellaneous' ? 'selected' : ''}>Miscellaneous</option>
                        <option value="inactive" ${route.type === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </td>
                <td class="px-3 py-2">
                    <select class="route-schedule-select w-full px-2 py-1 border rounded text-sm" 
                            data-route-number="${i}">
                        <option value="am" ${route.schedule === 'am' ? 'selected' : ''}>🌅 AM Only</option>
                        <option value="pm" ${route.schedule === 'pm' ? 'selected' : ''}>🌆 PM Only</option>
                        <option value="both" ${route.schedule === 'both' ? 'selected' : ''}>🔄 AM & PM</option>
                        <option value="none" ${route.schedule === 'none' ? 'selected' : ''}>⏸️ No Schedule</option>
                    </select>
                </td>
                <td class="px-3 py-2 text-xs text-gray-600">
                    ${assignments}
                </td>
                <td class="px-3 py-2">
                    <button class="clear-route-btn px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs" 
                            data-route-number="${i}" title="Clear assignments">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }
    
    gridContainer.innerHTML = gridHtml;
    
    // Setup event listeners for inline editing
    setupRouteConfigEventListeners();
    
    // Populate bulk action dropdowns
    populateBulkActionDropdowns();
    
    console.log('✅ Route configuration grid rendered');
}

/**
 * Ensure all 100 routes exist in STATE
 */
function ensureAllRoutesExist() {
    if (!STATE.data) STATE.data = { routes: [], staff: [], assets: [] };
    if (!Array.isArray(STATE.data.routes)) STATE.data.routes = [];
    
    for (let i = 1; i <= 100; i++) {
        const existingRoute = STATE.data.routes.find(r => r.routeNumber === i);
        if (!existingRoute) {
            createRoute(i, 'inactive', 'none');
        }
    }
}

/**
 * Get color for route type
 */
function getRouteTypeColor(routeType) {
    const typeKey = Object.keys(ROUTE_TYPES).find(key => 
        ROUTE_TYPES[key].id === routeType
    );
    return typeKey ? ROUTE_TYPES[typeKey].color : '#6b7280';
}

/**
 * Get assignment summary for a route
 */
function getRouteAssignmentSummary(route) {
    const parts = [];
    if (route.driver) parts.push(`👤 ${route.driver.name}`);
    if (route.asset) parts.push(`🚌 ${route.asset.number}`);
    if (route.safetyEscorts && route.safetyEscorts.length > 0) {
        parts.push(`👮 ${route.safetyEscorts.length}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'No assignments';
}

/**
 * Setup event listeners for route configuration grid
 */
function setupRouteConfigEventListeners() {
    // Route type change handlers
    document.querySelectorAll('.route-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const routeNumber = parseInt(e.target.dataset.routeNumber);
            const newType = e.target.value;
            updateRouteConfig(routeNumber, newType, null);
            
            // Update border color
            const typeColor = getRouteTypeColor(newType);
            e.target.style.borderLeft = `4px solid ${typeColor}`;
            
            // Refresh the configuration grid to show any automatic schedule changes
            setTimeout(() => {
                renderRouteConfigGrid();
            }, 100);
        });
    });
    
    // Route schedule change handlers
    document.querySelectorAll('.route-schedule-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const routeNumber = parseInt(e.target.dataset.routeNumber);
            const newSchedule = e.target.value;
            updateRouteConfig(routeNumber, null, newSchedule);
        });
    });
    
    // Clear route handlers
    document.querySelectorAll('.clear-route-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const routeNumber = parseInt(e.target.dataset.routeNumber);
            clearRouteAssignments(routeNumber);
        });
    });
}

/**
 * Clear all assignments for a route
 */
function clearRouteAssignments(routeNumber) {
    console.log(`🗑️ Clearing assignments for route ${routeNumber}`);
    
    const route = STATE.data.routes.find(r => r.routeNumber === routeNumber);
    if (route) {
        route.driver = null;
        route.asset = null;
        route.safetyEscorts = [];
        route.notes = '';
        route.status = 'unassigned';
        route.updatedAt = new Date().toISOString();
        
        saveToLocalStorage();
        
        // Update the assignments display
        const row = document.querySelector(`tr[data-route-number="${routeNumber}"]`);
        if (row) {
            const assignmentCell = row.querySelector('td:nth-child(4)');
            if (assignmentCell) {
                assignmentCell.innerHTML = '<span class="text-gray-500 text-xs">No assignments</span>';
            }
        }
        
        // Re-render dashboard if needed
        renderRouteCards();
    }
}

/**
 * Populate bulk action dropdown options
 */
function populateBulkActionDropdowns() {
    const startSelect = document.getElementById('bulk-route-range-start');
    const endSelect = document.getElementById('bulk-route-range-end');
    
    if (startSelect && endSelect) {
        // Clear existing options
        startSelect.innerHTML = '';
        endSelect.innerHTML = '';
        
        // Populate 1-100
        for (let i = 1; i <= 100; i++) {
            startSelect.innerHTML += `<option value="${i}">${i}</option>`;
            endSelect.innerHTML += `<option value="${i}" ${i === 100 ? 'selected' : ''}>${i}</option>`;
        }
    }
}

/**
 * Apply bulk changes to route range
 */
function applyBulkRouteChanges() {
    const startRange = parseInt(document.getElementById('bulk-route-range-start')?.value) || 1;
    const endRange = parseInt(document.getElementById('bulk-route-range-end')?.value) || 100;
    const bulkType = document.getElementById('bulk-route-type')?.value;
    const bulkSchedule = document.getElementById('bulk-route-schedule')?.value;
    
    if (!bulkType && !bulkSchedule) {
        alert('Please select a type or schedule to apply');
        return;
    }
    
    console.log(`🔧 Applying bulk changes: Routes ${startRange}-${endRange}, Type: ${bulkType}, Schedule: ${bulkSchedule}`);
    
    let changedCount = 0;
    for (let i = startRange; i <= endRange; i++) {
        const existingRoute = STATE.data.routes.find(r => r.routeNumber === i);
        if (existingRoute) {
            if (bulkType) existingRoute.type = bulkType;
            if (bulkSchedule) existingRoute.schedule = bulkSchedule;
            existingRoute.updatedAt = new Date().toISOString();
            changedCount++;
        }
    }
    
    saveToLocalStorage();
    
    // Re-render the grid
    renderRouteConfigGrid();
    
    // Re-render dashboard
    renderRouteCards();
    
    alert(`✅ Updated ${changedCount} routes`);
}

/**
 * Export route configuration to CSV
 */
function exportRouteConfigCSV() {
    console.log('📤 Exporting route configuration to CSV...');
    
    ensureAllRoutesExist();
    
    const routes = STATE.data.routes
        .filter(route => route.routeNumber >= 1 && route.routeNumber <= 100)
        .sort((a, b) => a.routeNumber - b.routeNumber);
    
    // Create CSV content
    let csvContent = 'Route,Type\n';
    routes.forEach(route => {
        const typeMap = {
            'general-education': 'Gen Ed',
            'special-education': 'SE', 
            'miscellaneous': 'Miscellaneous',
            'inactive': 'Not Running'
        };
        const typeLabel = typeMap[route.type] || route.type;
        csvContent += `${route.routeNumber},${typeLabel}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-configuration-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Route configuration exported');
}

/**
 * Handle CSV import for route configuration
 */
function handleRouteCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📥 Importing route configuration from CSV...');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            const lines = csvText.split('\n').filter(line => line.trim());
            
            // Skip header if present
            const dataLines = lines[0].toLowerCase().includes('route') ? lines.slice(1) : lines;
            
            let importedCount = 0;
            dataLines.forEach(line => {
                const [routeStr, typeStr] = line.split(',').map(s => s.trim());
                const routeNumber = parseInt(routeStr);
                
                if (routeNumber >= 1 && routeNumber <= 100 && typeStr) {
                    const typeMap = {
                        'Gen Ed': 'general-education',
                        'SE': 'special-education',
                        'Miscellaneous': 'miscellaneous', 
                        'Miscellanesous': 'miscellaneous', // Handle typo from user's CSV
                        'Not Running': 'inactive',
                        'Not Runining': 'inactive' // Handle typo from user's CSV
                    };
                    
                    const routeType = typeMap[typeStr] || 'inactive';
                    const schedule = routeType === 'inactive' ? 'none' : 'both';
                    
                    updateRouteConfig(routeNumber, routeType, schedule);
                    importedCount++;
                }
            });
            
            // Re-render grid and dashboard
            renderRouteConfigGrid();
            renderRouteCards();
            
            alert(`✅ Imported ${importedCount} routes from CSV`);
            console.log(`✅ Successfully imported ${importedCount} routes`);
            
        } catch (error) {
            console.error('❌ Error importing CSV:', error);
            alert('❌ Error importing CSV file. Please check the format.');
        }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

/**
 * Reset all routes to inactive
 */
function resetAllRoutes() {
    if (!confirm('Are you sure you want to reset all 100 routes to inactive? This will clear all route configurations but preserve assignments.')) {
        return;
    }
    
    console.log('🔄 Resetting all routes to inactive...');
    
    ensureAllRoutesExist();
    
    STATE.data.routes.forEach(route => {
        if (route.routeNumber >= 1 && route.routeNumber <= 100) {
            route.type = 'inactive';
            route.schedule = 'none';
            route.updatedAt = new Date().toISOString();
        }
    });
    
    saveToLocalStorage();
    
    // Re-render grid and dashboard
    renderRouteConfigGrid();
    renderRouteCards();
    
    alert('✅ All routes reset to inactive');
}

/**
 * Setup route management modal event listeners
 */
function setupRouteManagementModal() {
    // Import CSV button
    const importBtn = document.getElementById('import-csv-btn');
    const csvInput = document.getElementById('csv-import-input');
    
    if (importBtn && csvInput) {
        importBtn.addEventListener('click', () => csvInput.click());
        csvInput.addEventListener('change', handleRouteCSVImport);
    }
    
    // Export CSV button
    const exportBtn = document.getElementById('export-routes-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportRouteConfigCSV);
    }
    
    // Reset all routes button
    const resetBtn = document.getElementById('reset-all-routes-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllRoutes);
    }
    
    // Apply bulk changes button
    const applyBulkBtn = document.getElementById('apply-bulk-changes-btn');
    if (applyBulkBtn) {
        applyBulkBtn.addEventListener('click', applyBulkRouteChanges);
    }
    
    console.log('✅ Route management modal event listeners setup');
}

// Make reset function globally available
window.resetRouteBoard = resetRouteBoard;

// Make route management functions globally available
window.renderRouteConfigGrid = renderRouteConfigGrid;
window.setupRouteManagementModal = setupRouteManagementModal;
window.ensureAllRoutesExist = ensureAllRoutesExist;

// Make field trip functions globally available
window.addNewFieldTripRoute = addNewFieldTripRoute;
window.renumberFieldTrips = renumberFieldTrips;
window.checkFieldTripNumbering = checkFieldTripNumbering;
window.cleanupSampleFieldTrips = cleanupSampleFieldTrips;

// =============================================================================
// EXPORT
// =============================================================================

export {
    ROUTE_TYPES,
    ROUTE_SCHEDULES,
    createRoute,
    initializeAllRoutes,
    updateRouteConfig,
    importRoutesFromCSV,
    assignDriver,
    assignAsset,
    addSafetyEscort,
    removeSafetyEscort,
    updateRouteNotes,
    findRouteById,
    getRoutesByType,
    getAvailableDrivers,
    getAvailableAssets,
    getAvailableSafetyEscorts,
    renderRouteCards,
    generateRouteCardHtml,
    resetRouteBoard,
    renderRouteConfigGrid,
    setupRouteManagementModal,
    ensureAllRoutesExist,
    addNewFieldTripRoute,
    deleteAllFieldTrips,
    renumberFieldTrips,
    checkFieldTripNumbering,
    cleanupSampleFieldTrips
};