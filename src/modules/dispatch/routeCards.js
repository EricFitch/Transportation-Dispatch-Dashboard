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
import { ROUTE_TYPES as ROUTE_TYPE_IDS, ROUTE_SCHEDULES as ROUTE_SCHEDULE_IDS } from '../core/constants.js';
import { ValidationService } from '../core/validationService.js';
import { Logger } from '../core/logger.js';
import { ErrorHandler } from '../core/errorHandler.js';
import { ModalService } from '../ui/modalService.js';

// =============================================================================
// ROUTE CARD DATA STRUCTURE
// =============================================================================

// Route types configuration
const ROUTE_TYPES = {
    GENERAL_ED: {
        id: 'general-education',
        label: 'General Education',
        color: '#3b82f6', // blue
        icon: '🎒',
        iconImage: 'assets/icons/GenED.png'
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

function renderRouteTypeIcon(type) {
    if (!type) return '';

    const label = type.label || 'Route';
    const imagePath = type.iconImage || (typeof type.icon === 'string' && /\.(png|jpe?g|svg|webp)$/i.test(type.icon) ? type.icon : null);

    if (imagePath) {
        return `<img src="${imagePath}" class="route-type-icon" alt="${label} icon" loading="lazy">`;
    }

    if (type.icon) {
        return `<span class="route-type-emoji" style="color: ${type.color || '#111827'}">${type.icon}</span>`;
    }

    return '';
}

const STATUS_SEGMENTS = [
    {
        code: '10-8',
        shortLabel: '10-8',
        label: 'In Service',
        description: 'Active / In Service',
        toneClass: 'status-10-8'
    },
    {
        code: '10-7',
        shortLabel: '10-7',
        label: 'Out of Service',
        description: 'Down / Out of Service',
        toneClass: 'status-10-7'
    },
    {
        code: '10-11',
        shortLabel: '10-11',
        label: 'Delayed',
        description: 'On Hold / Delayed',
        toneClass: 'status-10-11'
    }
];

const STATUS_CODES = STATUS_SEGMENTS.map(segment => segment.code);

function getStatusPillContainerClass(status) {
    if (!status || !STATUS_CODES.includes(status)) {
        return 'status-pill-neutral';
    }
    return `status-pill-${status}`;
}

function getAllStatusPillContainerClasses() {
    return ['status-pill-neutral', ...STATUS_CODES.map(code => `status-pill-${code}`)];
}

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
        
        console.log(`🎨 Getting color for route ${route.id}:`, { driverName, routeDriver: route.driver });
        
        if (!driverName) return ROUTE_TYPES[Object.keys(ROUTE_TYPES).find(k => ROUTE_TYPES[k].id === route.type)]?.color || '#6b7280';

        // Find staff entry
        const staff = STATE.data?.staff?.find(s => s.name === driverName || s.id === driverName);
        const role = staff?.role || null;
        
        console.log(`🎨 Staff found:`, { name: driverName, role: staff?.role, finalRole: role });
        
        if (role && typeof window.getRoleColor === 'function') {
            const color = window.getRoleColor(role);
            console.log(`🎨 Role color for "${role}":`, color);
            return color;
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

function renderStatusSegments(route) {
    return STATUS_SEGMENTS.map(segment => renderStatusSegment(route, segment)).join('');
}

function getStatusMetadata(code) {
    return STATUS_SEGMENTS.find(segment => segment.code === code) || null;
}

function renderStatusSegment(route, segment) {
    const isActive = route.status === segment.code;
    const classes = ['status-pill-button', segment.toneClass, isActive ? 'is-active' : ''];

    return `
    <button type="button"
        class="${classes.filter(Boolean).join(' ')}"
        aria-pressed="${isActive}"
        aria-label="${segment.description}"
        data-status-code="${segment.code}"
                onclick="updateRouteStatus('${route.id}', '${segment.code}')">
            <span class="status-code">${segment.shortLabel}</span>
            <span class="status-label">${segment.label}</span>
        </button>
    `;
}

function updateStatusPillUI(routeId, status) {
    const card = document.querySelector(`[data-route-id="${routeId}"]`);
    if (!card) return;

    const buttons = card.querySelectorAll('.status-pill-button');
    buttons.forEach(button => {
        const code = button.getAttribute('data-status-code');
        const isSelected = code === status;
        button.setAttribute('aria-pressed', String(isSelected));
        button.classList.toggle('is-active', isSelected);
    });

    const pill = card.querySelector('.status-pill');
    if (pill) {
        pill.classList.remove(...getAllStatusPillContainerClasses());
        pill.classList.add(getStatusPillContainerClass(status));
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
            const wasInactive = existingRoute.type === ROUTE_TYPE_IDS.INACTIVE;
            existingRoute.type = routeType;
            
            // If route is being activated (changed from inactive to any other type)
            // and no specific schedule was provided, set default schedule to 'both'
            if (wasInactive && routeType !== ROUTE_TYPE_IDS.INACTIVE && schedule === null) {
                console.log(`🔄 Route ${routeNumber} activated from inactive to ${routeType}, setting default schedule to 'both'`);
                existingRoute.schedule = ROUTE_SCHEDULE_IDS.BOTH;
                
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
            else if (routeType === ROUTE_TYPE_IDS.INACTIVE && schedule === null) {
                console.log(`🔄 Route ${routeNumber} deactivated to inactive, setting schedule to 'none'`);
                existingRoute.schedule = ROUTE_SCHEDULE_IDS.NONE;
            }
        }
        
        if (schedule !== null) existingRoute.schedule = schedule;
        existingRoute.updatedAt = new Date().toISOString();
    } else {
        // Create new route
        // If creating a new active route without specifying schedule, default to 'both'
        if (routeType !== ROUTE_TYPE_IDS.INACTIVE && schedule === null) {
            schedule = ROUTE_SCHEDULE_IDS.BOTH;
        } else if (routeType === ROUTE_TYPE_IDS.INACTIVE && schedule === null) {
            schedule = ROUTE_SCHEDULE_IDS.NONE;
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
 * Update route departure sequence
 */
function updateRouteDepartureSequence(routeNumber, sequence) {
    console.log(`🚦 Updating route ${routeNumber} departure sequence to:`, sequence);
    
    const route = STATE.data.routes.find(r => r.routeNumber === routeNumber);
    if (route) {
        // Handle departureSequence as number or null
        const num = parseInt(sequence);
        route.departureSequence = isNaN(num) || num < 1 ? null : num;
        route.updatedAt = new Date().toISOString();
        
        saveToLocalStorage();
        
        // Re-render route cards to show updated departure badge
        renderRouteCards();
        
        console.log(`✅ Route ${routeNumber} departure sequence updated to:`, route.departureSequence);
    }
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
    Logger.info('Assigning driver to route:', routeId, driverInfo?.name);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Validate driver assignment using ValidationService
    if (driverInfo) {
        const validation = ValidationService.canAssignStaff(driverInfo.name, route.id);
        if (!validation.valid) {
            notify(validation.reason, 'warning');
            return false;
        }
    }
    
    route.driver = driverInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:driverAssigned', { routeId, driver: driverInfo });
    return true;
}

function assignAsset(routeId, assetInfo) {
    Logger.info('Assigning asset to route:', routeId, assetInfo?.name);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Validate asset assignment using ValidationService
    if (assetInfo) {
        const validation = ValidationService.canAssignAsset(assetInfo.name, route.id);
        if (!validation.valid) {
            notify(validation.reason, 'warning');
            return false;
        }
    }
    
    route.asset = assetInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:assetAssigned', { routeId, asset: assetInfo });
    return true;
}

function assignTrailer(routeId, trailerInfo) {
    Logger.info('Assigning trailer to route:', routeId, trailerInfo?.name);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Validate trailer assignment using ValidationService
    if (trailerInfo) {
        const validation = ValidationService.canAssignTrailer(trailerInfo.name, route.id);
        if (!validation.valid) {
            notify(validation.reason, 'warning');
            return false;
        }
    }
    
    route.trailer = trailerInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:trailerAssigned', { routeId, trailer: trailerInfo });
    return true;
}

function addSafetyEscort(routeId, escortInfo) {
    Logger.info('Adding safety escort to route:', routeId, escortInfo?.name);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Check if escort already assigned to this route
    if (route.safetyEscorts.some(escort => escort.name === escortInfo.name)) {
        Logger.warn('Escort already assigned to this route:', escortInfo.name);
        return false;
    }
    
    // Check maximum escorts limit (5)
    if (route.safetyEscorts.length >= 5) {
        notify('Maximum 5 safety escorts allowed per route', 'warning');
        return false;
    }
    
    // Validate escort assignment using ValidationService
    const validation = ValidationService.canAssignStaff(escortInfo.name, route.id);
    if (!validation.valid) {
        notify(validation.reason, 'warning');
        return false;
    }
    
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

function resolveRouteFromKey(routeKey) {
    if (!STATE.data?.routes) return null;
    if (routeKey === null || routeKey === undefined) return null;

    const rawKey = String(routeKey).trim();
    if (!rawKey) return null;

    const candidates = new Set([rawKey]);

    if (rawKey.includes('_')) {
        candidates.add(rawKey.split('_')[0].trim());
    }

    const digits = rawKey.replace(/[^0-9]/g, '');
    if (digits) {
        candidates.add(digits);
        candidates.add(`route-${digits}`);
        candidates.add(`Route ${digits}`);
    }

    for (const candidate of candidates) {
        const exactMatch = STATE.data.routes.find(route => route.id === candidate);
        if (exactMatch) return exactMatch;
    }

    for (const candidate of candidates) {
        const lowerCandidate = candidate.toLowerCase();
        const nameMatch = STATE.data.routes.find(route => route.name && route.name.toLowerCase() === lowerCandidate);
        if (nameMatch) return nameMatch;
    }

    for (const candidate of candidates) {
        const digitsOnly = candidate.replace(/[^0-9]/g, '');
        if (!digitsOnly) continue;
        const numberMatch = STATE.data.routes.find(route => String(route.routeNumber) === digitsOnly);
        if (numberMatch) return numberMatch;
    }

    return null;
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
    // Get all assigned safety escorts (cannot be driver simultaneously)
    const assignedEscorts = STATE.data.routes
        .flatMap(route => (route.safetyEscorts || []).map(e => e.name))
        .filter(Boolean);
    
    // Return available staff (not assigned as drivers and not out of service)
    return STATE.data.staff.filter(staff => 
        !assignedDrivers.includes(staff.name) &&
        !assignedEscorts.includes(staff.name) &&
        !STATE.staffOut.some(out => out.name === staff.name)
    );
}

function getAvailableAssets() {
    console.log('🔍 getAvailableAssets called');
    console.log('🔍 STATE.data?.assets:', STATE.data?.assets);
    
    if (!STATE.data?.assets) {
        console.log('❌ No assets in STATE.data');
        return [];
    }
    
    console.log('📊 Total assets in system:', STATE.data.assets.length);
    
    // Get all assigned assets
    const assignedAssets = STATE.data.routes
        .map(route => route.asset?.name)
        .filter(Boolean);
    
    console.log('📊 Assigned assets:', assignedAssets);
    
    // Return available assets (not assigned to routes and NOT trailers)
    const available = STATE.data.assets.filter(asset => {
        const dynamicDown = STATE.assetStatus?.[asset.name] === 'Down';
        const isTrailer = asset.type && asset.type.toLowerCase().includes('trailer');
        const isDown = asset.status === 'down';
        const isAssigned = assignedAssets.includes(asset.name);
        
        console.log(`🔍 Asset ${asset.name}: assigned=${isAssigned}, down=${isDown}, dynamicDown=${dynamicDown}, trailer=${isTrailer}`);
        
        return !isAssigned && !isDown && !dynamicDown && !isTrailer;
    });
    
    console.log('✅ Available assets:', available);
    return available;
}

function getAvailableTrailers() {
    if (!STATE.data?.assets) return [];
    
    // Get all assigned trailers
    const assignedTrailers = STATE.data.routes
        .map(route => route.trailer?.name)
        .filter(Boolean);
    
    // Return available trailers (trailer type assets not assigned to routes)
    return STATE.data.assets.filter(asset => {
        const isTrailer = asset.type && asset.type.toLowerCase().includes('trailer');
        const dynamicDown = STATE.assetStatus?.[asset.name] === 'Down';
        return isTrailer && !assignedTrailers.includes(asset.name) && asset.status !== 'down' && !dynamicDown;
    });
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
// ASSIGNMENT VALIDATION HELPERS
// =============================================================================

function notify(message, type = 'warning', duration = 3000) {
    try {
        if (typeof window !== 'undefined' && window.uiSystem && typeof window.uiSystem.showNotification === 'function') {
            window.uiSystem.showNotification(message, type, duration);
        } else {
            alert(message);
        }
    } catch (e) {
        try { alert(message); } catch (_) {}
    }
}

function findStaffActiveAssignment(staffName, currentRouteId = null) {
    const routes = (STATE.data && Array.isArray(STATE.data.routes)) ? STATE.data.routes : [];
    for (const r of routes) {
        if (currentRouteId && r.id === currentRouteId) continue;
        if (r.driver && r.driver.name === staffName) return { role: 'Driver', route: r };
        const escorts = Array.isArray(r.safetyEscorts) ? r.safetyEscorts : [];
        if (escorts.some(e => e && e.name === staffName)) return { role: 'Safety Escort', route: r };
    }
    return null;
}

// Asset status functions moved to ValidationService - use:
// - ValidationService.isAssetDown(assetName)
// - ValidationService.findAssetActiveAssignment(assetName, currentRouteId)
// - ValidationService.getAssetDownReason(assetName)

// =============================================================================
// UNASSIGNMENT HELPERS
// =============================================================================

function unassignStaffFromRouteByName(route, staffName) {
    if (!route) return false;
    let changed = false;
    if (route.driver && route.driver.name === staffName) {
        route.driver = null;
        changed = true;
        eventBus.emit('routes:driverUnassigned', { routeId: route.id, staffName });
    }
    const before = Array.isArray(route.safetyEscorts) ? route.safetyEscorts.length : 0;
    route.safetyEscorts = (route.safetyEscorts || []).filter(e => e && e.name !== staffName);
    if (Array.isArray(route.safetyEscorts) && route.safetyEscorts.length !== before) {
        changed = true;
        eventBus.emit('routes:safetyEscortRemoved', { routeId: route.id, escortName: staffName });
    }
    if (changed) {
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
    }
    return changed;
}

function unassignAssetByName(route, assetName) {
    if (!route) return false;
    let changed = false;
    if (route.asset && route.asset.name === assetName) {
        route.asset = null;
        changed = true;
        eventBus.emit('routes:assetUnassigned', { routeId: route.id, assetName });
    }
    if (route.trailer && route.trailer.name === assetName) {
        route.trailer = null;
        changed = true;
        eventBus.emit('routes:trailerUnassigned', { routeId: route.id, assetName });
    }
    if (changed) {
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
    }
    return changed;
}

// =============================================================================
// ROUTE CARD RENDERING
// =============================================================================

/**
 * Get departure sequence text (1st Out, 2nd Out, etc.)
 */
function getDepartureText(sequence) {
    if (!sequence) return '';
    const suffix = ['th', 'st', 'nd', 'rd'];
    const value = sequence % 100;
    return sequence + (suffix[(value - 20) % 10] || suffix[value] || suffix[0]) + ' Out';
}

/**
 * Get asset parking space for display with icon
 */
function getAssetParkingSpace(asset) {
    console.log('🅿️ getAssetParkingSpace called with asset:', asset);
    if (!asset) {
        console.log('🅿️ No asset provided');
        return '';
    }
    if (!asset.details) {
        console.log('🅿️ Asset has no details:', asset);
        return '';
    }
    if (!asset.details.parkingSpace) {
        console.log('🅿️ Asset details has no parkingSpace:', asset.details);
        return '';
    }
    console.log('🅿️ Parking space found:', asset.details.parkingSpace);
    return ` <span class="parking-indicator" style="display: inline-flex; align-items: center; gap: 4px;"><img src="assets/icons/ParkingButton.png" class="parking-icon" alt="Parking" /> ${asset.details.parkingSpace}</span>`;
}

function generateRouteCardHtml(route) {
    const routeType = ROUTE_TYPES[route.type.toUpperCase().replace('-', '_')] || ROUTE_TYPES.GENERAL_ED;
    const isFieldTrip = route.type === 'field-trips';
    const roleAccent = getDriverRoleColorForRoute(route);
    const contrast = computeContrastColors(roleAccent);
    const statusPillClass = getStatusPillContainerClass(route.status);
    
    // Extract route number or use full name for field trips
    const displayName = isFieldTrip 
        ? route.name || 'Unnamed Field Trip'
        : (route.routeNumber || route.name?.replace(/^Route\s*/i, '') || 'N/A');
    
    return `
       <div class="route-card bg-white rounded-lg shadow-md border p-4 hover:shadow-lg transition-shadow" 
           data-route-id="${route.id}"
           data-route-type="${route.type}"
           style="background: white; color: #111827; border-left: 6px solid ${roleAccent}; --panel-bg: ${contrast.panelBg}; --panel-border: ${contrast.panelBorder}; --accent-color: ${roleAccent}; --accent-text-color: ${contrast.textColor}; width: 300px;">
            
            
            <!-- Route Header -->
            <div class="route-header flex items-center justify-between mb-4 gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <h3 class="route-number-display flex-shrink-0" style="color: ${roleAccent};">${displayName}</h3>
                    ${route.departureSequence ? `<span class="departure-badge flex-shrink-0">${getDepartureText(route.departureSequence)}</span>` : ''}
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    ${!isFieldTrip ? `
                        <button type="button" class="combine-route-btn" 
                                onclick="handleCombineRoute('${route.id}', '${route.routeNumber}')"
                                title="Combine Route" aria-label="Combine Route">
                            <img src="assets/icons/MergeButton.png" class="header-action-icon" alt="" aria-hidden="true" />
                        </button>
                    ` : ''}
                    ${isFieldTrip ? `
                        <button type="button" class="delete-field-trip-btn"
                                onclick="handleDeleteFieldTrip('${route.id}')"
                                title="Delete Field Trip" aria-label="Delete Field Trip">
                            <img src="assets/icons/DeleteButton.png" class="header-action-icon" alt="" aria-hidden="true" />
                        </button>
                    ` : ''}
                    ${!isFieldTrip ? `
                        <button type="button" class="delete-route-btn"
                                onclick="handleDeleteRoute('${route.id}')"
                                title="Delete Route" aria-label="Delete Route">
                            <img src="assets/icons/DeleteButton.png" class="header-action-icon" alt="" aria-hidden="true" />
                        </button>
                    ` : ''}
                    <button type="button" class="collapse-card-btn text-gray-400 hover:text-gray-600 transition-colors" 
                            data-route-toggle="${route.id}"
                            aria-expanded="true"
                            aria-controls="route-content-${route.id}"
                            title="Collapse card"
                            onclick="toggleRouteCard('${route.id}')">
                        <img src="assets/icons/CollapseButton.png" class="toggle-icon header-action-icon transition-transform" alt="" aria-hidden="true" />
                    </button>
                </div>
            </div>
            
            <!-- Collapsible Content -->
            <div id="route-content-${route.id}" class="route-card-content">
                <!-- Status Section -->
                <div class="status-section mb-4">
                    <div class="status-pill ${statusPillClass}" role="group" aria-label="Route status">
                        ${renderStatusSegments(route)}
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
                <div class="driver-assignment flex items-center gap-2">
                    <div class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAssignDriver('${route.id}')">
                        ${route.driver ? 
                            `<span class="text-sm text-gray-800">${route.driver.name}</span>` : 
                            `<span class="text-sm text-gray-500">Click to assign</span>`
                        }
                    </div>
                    ${route.driver ? `
                        <button type="button" class="unassign-btn" 
                                onclick="event.stopPropagation(); handleUnassignDriver('${route.id}');"
                                title="Unassign Driver" 
                                aria-label="Unassign Driver">
                            <img src="assets/icons/DeleteButton.png" class="unassign-icon" alt="" aria-hidden="true" />
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <!-- Asset Assignment -->
            <div class="assignment-section mb-3">
                <label class="block text-sm font-medium text-purple-600 mb-1">ASSET:</label>
                <div class="asset-assignment flex items-center gap-2">
                    <div class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAssignAsset('${route.id}')">
                        ${route.asset ? 
                            `<span class="text-sm text-gray-800">${route.asset.name}${getAssetParkingSpace(route.asset)}</span>` : 
                            `<span class="text-sm text-gray-500">Click to assign</span>`
                        }
                    </div>
                    ${route.asset ? `
                        <button type="button" class="unassign-btn" 
                                onclick="event.stopPropagation(); handleUnassignAsset('${route.id}');"
                                title="Unassign Asset" 
                                aria-label="Unassign Asset">
                            <img src="assets/icons/DeleteButton.png" class="unassign-icon" alt="" aria-hidden="true" />
                        </button>
                    ` : ''}
                </div>
            </div>
            
            ${isFieldTrip ? `
            <!-- Trailer Assignment (Field Trips Only) -->
            <div class="assignment-section mb-3">
                <label class="block text-sm font-medium text-orange-600 mb-1">TRAILER: <span class="text-gray-400">(optional)</span></label>
                <div class="trailer-assignment flex items-center gap-2">
                    <div class="flex-1 p-2 border border-gray-300 rounded-md bg-gray-50 cursor-pointer"
                         onclick="handleAssignTrailer('${route.id}')">
                        ${route.trailer ? 
                            `<span class="text-sm text-gray-800">${route.trailer.name}</span>` : 
                            `<span class="text-sm text-gray-500">Click to assign trailer</span>`
                        }
                    </div>
                    ${route.trailer ? `
                        <button type="button" class="unassign-btn" 
                                onclick="event.stopPropagation(); handleUnassignTrailer('${route.id}');"
                                title="Unassign Trailer" 
                                aria-label="Unassign Trailer">
                            <img src="assets/icons/DeleteButton.png" class="unassign-icon" alt="" aria-hidden="true" />
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
                                    <button type="button" class="unassign-btn" 
                                            onclick="event.stopPropagation(); handleRemoveSafetyEscort('${route.id}', '${escort.name}');"
                                            title="Remove Safety Escort" 
                                            aria-label="Remove ${escort.name}">
                                        <img src="assets/icons/DeleteButton.png" class="unassign-icon" alt="" aria-hidden="true" />
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

// =============================================================================
// ROUTE SORTING STATE
// =============================================================================

// Track sort preference for each route type (default: 'routeNumber', option: 'rollout')
const ROUTE_SORT_STATE = {
    'general-ed': 'routeNumber',
    'special-ed': 'routeNumber',
    'pre-k': 'routeNumber',
    'field-trips': 'routeNumber'
};

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

        // Filter out inactive or hidden routes and filter by current view (AM/PM)
        const activeRoutes = STATE.data.routes.filter(route => {
            // Exclude routes intentionally hidden (e.g., combined into another route)
            if (route.hidden === true) return false;
            // Exclude inactive routes from dashboard
            if (route.type === 'inactive') return false;
            
            // Filter by current view (AM/PM) - show routes for current shift or both
            const routeSchedule = route.schedule || route.shift; // support both schedule and shift properties
            const currentView = STATE.currentView.toLowerCase(); // ensure lowercase comparison
            return routeSchedule === currentView || routeSchedule === 'both';
        });
        
        console.log(`🔍 Displaying ${activeRoutes.length} routes for ${STATE.currentView} shift`);
        
        // Group routes by type first (before sorting, as each type has its own sort preference)
        const routesByType = {};
        Object.keys(ROUTE_TYPES).forEach(key => {
            const typeId = ROUTE_TYPES[key].id;
            if (typeId !== 'inactive') { // Skip inactive type for dashboard display
                routesByType[typeId] = activeRoutes.filter(route => route.type === typeId);
            }
        });
        
        // Sort each route type independently based on its sort preference
        Object.keys(routesByType).forEach(typeId => {
            const sortBy = ROUTE_SORT_STATE[typeId] || 'routeNumber';
            const routes = routesByType[typeId];
            
            routes.sort((a, b) => {
                if (sortBy === 'rollout') {
                    // Sort by departure sequence (roll out)
                    const seqA = a.departureSequence || 999; // Routes without sequence go to end
                    const seqB = b.departureSequence || 999;
                    if (seqA !== seqB) return seqA - seqB;
                    // If same sequence, fall back to route number
                    return (parseInt(a.routeNumber) || 0) - (parseInt(b.routeNumber) || 0);
                } else {
                    // Sort by route number (default)
                    if (typeId === 'field-trips') {
                        // Extract numbers from field trip names
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
                }
            });
        });
        
        console.log(`🔍 Routes sorted per type preferences:`, ROUTE_SORT_STATE);
        
        // Generate HTML for each route type section (excluding inactive)
        const sectionsHtml = Object.entries(ROUTE_TYPES)
            .filter(([key, type]) => type.id !== 'inactive') // Don't show inactive section on dashboard
            .map(([key, type]) => {
            const routes = routesByType[type.id] || [];
            
            return `
                <div class="route-type-section mb-8">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            ${renderRouteTypeIcon(type)}
                            ${type.label.toUpperCase()} ROUTES
                            <span class="text-sm font-normal text-gray-500 ml-2">(${routes.length})</span>
                        </h2>
                        <div class="flex items-center gap-2">
                            ${routes.length > 0 ? `
                                <div class="sort-toggle-container flex items-center gap-2 mr-2">
                                    <span class="text-xs text-gray-500 font-medium">Sort:</span>
                                    <button class="sort-toggle-btn ${ROUTE_SORT_STATE[type.id] === 'routeNumber' ? 'active' : ''}"
                                            onclick="toggleRouteSort('${type.id}', 'routeNumber')"
                                            title="Sort by Route Number">
                                        #
                                    </button>
                                    <button class="sort-toggle-btn ${ROUTE_SORT_STATE[type.id] === 'rollout' ? 'active' : ''}"
                                            onclick="toggleRouteSort('${type.id}', 'rollout')"
                                            title="Sort by Roll Out (Departure Sequence)">
                                        🚦
                                    </button>
                                </div>
                            ` : ''}
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
        
        // Initialize note tooltips
        initializeNoteTooltips();
        
        // Emit event for other systems
        eventBus.emit('routes:rendered');
        
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

/**
 * Toggle route sort order for a specific route type
 * @param {string} routeType - The route type ID (e.g., 'general-ed')
 * @param {string} sortBy - Sort method: 'routeNumber' or 'rollout'
 */
function toggleRouteSort(routeType, sortBy) {
    console.log(`🔄 Toggling sort for ${routeType} to ${sortBy}`);
    ROUTE_SORT_STATE[routeType] = sortBy;
    renderRouteCards();
}

// Expose to global scope for onclick handlers
window.toggleRouteSort = toggleRouteSort;

/**
 * Initialize sample routes for demonstration and testing purposes
 * 
 * This function is automatically called when STATE.data.routes is empty,
 * providing new users with example routes to understand the system.
 * 
 * Creates:
 * - 6 General Education routes (Routes 2-7)
 * - 6 Special Education routes (Routes 80-82, 86-88)
 * - 1 Miscellaneous route (Route 70)
 * 
 * Note: Remove this function if demo routes are no longer needed in production
 */
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
        mode: 'driver',
        routeId,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                const ok = assignDriver(routeId, selectedItems[0]);
                if (ok) debounceRender('renderRouteCards');
            }
        }
    });
}

function handleAssignAsset(routeId) {
    console.log('🚛 Assigning asset to route:', routeId);
    console.log('📊 STATE.data.assets:', STATE.data?.assets);
    console.log('📊 Assets count:', STATE.data?.assets?.length || 0);
    
    const availableAssets = getAvailableAssets();
    console.log('✅ Available assets:', availableAssets);
    console.log('✅ Available assets count:', availableAssets.length);
    
    // Show helpful message if no assets exist at all
    if (!STATE.data?.assets || STATE.data.assets.length === 0) {
        if (confirm('No assets in the system. Would you like to open Fleet Management to add assets?')) {
            // Open Fleet Management modal/interface
            const fleetDetailsBtn = document.getElementById('fleet-details-btn');
            if (fleetDetailsBtn) {
                fleetDetailsBtn.click();
            } else {
                alert('Please use the "Fleet Details" button in the Fleet Status section to manage assets.');
            }
        }
        return;
    }
    
    // Show message if assets exist but none are available
    if (availableAssets.length === 0) {
        alert(`No available assets. All assets are either:\n• Already assigned to routes\n• Marked as down/maintenance\n• Configured as trailers\n\nTip: You can unassign assets using the 🗑️ buttons, or use "Fleet Details" to add new assets.`);
        return;
    }
    
    showSelectionModal({
        title: 'Assign Asset',
        items: availableAssets,
        itemDisplayKey: 'name',
        itemIdKey: 'name', // Use name as the unique identifier for assets
        multiSelect: false,
        mode: 'asset',
        routeId,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                const ok = assignAsset(routeId, selectedItems[0]);
                if (ok) debounceRender('renderRouteCards');
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
        mode: 'trailer',
        routeId,
        onConfirm: (selectedItems) => {
            if (selectedItems.length > 0) {
                const ok = assignTrailer(routeId, selectedItems[0]);
                if (ok) debounceRender('renderRouteCards');
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
        mode: 'escort',
        routeId,
        maxSelections: 5,
        onConfirm: (selectedItems) => {
            let successCount = 0;
            selectedItems.forEach(escort => {
                if (addSafetyEscort(routeId, escort)) successCount++;
            });
            if (successCount > 0) {
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
            
            // Use ValidationService for consistent validation
            const name = item.name || '';
            const validationDisplay = ValidationService.getValidationDisplay(name, options.mode, options.routeId);
            const isDisabled = validationDisplay.isDisabled;
            const disabledReason = validationDisplay.disabledReason;
            const itemDiv = document.createElement('div');
            itemDiv.className = `p-3 border rounded transition-colors ${
                isDisabled
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : isSelected
                        ? 'bg-blue-100 border-blue-500 text-blue-700 cursor-pointer'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
            }`;
            
            const displayText = item[options.itemDisplayKey] || item.name || item.toString();
            const subtitleBase = getItemSubtitle(item);
            const subtitle = disabledReason ? `${subtitleBase ? subtitleBase + ' • ' : ''}${disabledReason}` : subtitleBase;
            
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
                if (isDisabled) return; // Ignore clicks on disabled items
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

            // Provide a quick "Unassign & Assign" action if the item is disabled due to being assigned elsewhere
            if (isDisabled && disabledReason.startsWith('Assigned')) {
                const actionsRow = document.createElement('div');
                actionsRow.className = 'mt-2 flex gap-2';
                const unassignBtn = document.createElement('button');
                unassignBtn.type = 'button';
                unassignBtn.textContent = 'Unassign & Assign';
                unassignBtn.className = 'px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300';
                unassignBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        const active = (options.mode === 'asset' || options.mode === 'trailer')
                            ? ValidationService.findAssetActiveAssignment(name, options.routeId)
                            : findStaffActiveAssignment(name, options.routeId);
                        if (!active || !active.route) return;
                        // Unassign from the active route
                        if (options.mode === 'asset' || options.mode === 'trailer') {
                            unassignAssetByName(active.route, name);
                        } else {
                            unassignStaffFromRouteByName(active.route, name);
                        }
                        // Assign to the current route
                        let assigned = false;
                        if (options.mode === 'asset') {
                            assigned = assignAsset(options.routeId, item);
                        } else if (options.mode === 'trailer') {
                            assigned = assignTrailer(options.routeId, item);
                        } else if (options.mode === 'driver') {
                            assigned = assignDriver(options.routeId, item);
                        } else if (options.mode === 'escort') {
                            assigned = addSafetyEscort(options.routeId, item);
                        }
                        if (assigned) {
                            // Update UI quickly
                            debounceRender('renderRouteCards');
                            // Close modal automatically on single-select modes
                            if (!options.multiSelect) {
                                ModalService.close('assignment-modal');
                            } else {
                                // For multi-select, refresh list and selection state
                                selectedItems = [];
                                renderItems(options.items);
                                updateConfirmButton();
                            }
                        }
                    } catch (err) {
                        console.error('Unassign & Assign failed:', err);
                    }
                });
                actionsRow.appendChild(unassignBtn);
                itemDiv.appendChild(actionsRow);
            }
            
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
    
    // Event handlers using ModalService
    cancelBtn.onclick = () => {
        ModalService.close('assignment-modal');
    };
    
    confirmBtn.onclick = () => {
        if (selectedItems.length > 0 && options.onConfirm) {
            options.onConfirm(selectedItems);
        }
        ModalService.close('assignment-modal');
    };
    
    // Initial render
    renderItems();
    updateConfirmButton();
    
    // Show modal using ModalService (handles backdrop clicks and ESC key)
    ModalService.open('assignment-modal', () => {
        search.focus();
    });
}

// =============================================================================
// GLOBAL EXPOSURE - Assignment Modal & Unassign Handlers
// Required for HTML onclick attributes and modal interactions
// =============================================================================
window.showSelectionModal = showSelectionModal;
window.handleUnassignDriver = handleUnassignDriver;
window.handleUnassignAsset = handleUnassignAsset;
window.handleUnassignTrailer = handleUnassignTrailer;

function handleUnassignDriver(routeId) {
    console.log('Unassigning driver from route:', routeId);
    const route = findRouteById(routeId);
    if (route && route.driver) {
        const driverName = route.driver.name;
        if (confirm(`Unassign ${driverName} from ${route.name}?`)) {
            route.driver = null;
            route.updatedAt = new Date().toISOString();
            saveToLocalStorage();
            debounceRender('renderRouteCards');
            eventBus.emit('routes:driverUnassigned', { routeId, driverName });
        }
    }
}

function handleUnassignAsset(routeId) {
    console.log('Unassigning asset from route:', routeId);
    const route = findRouteById(routeId);
    if (route && route.asset) {
        const assetName = route.asset.name;
        if (confirm(`Unassign ${assetName} from ${route.name}?`)) {
            route.asset = null;
            route.updatedAt = new Date().toISOString();
            saveToLocalStorage();
            debounceRender('renderRouteCards');
            eventBus.emit('routes:assetUnassigned', { routeId, assetName });
        }
    }
}

function handleUnassignTrailer(routeId) {
    console.log('Unassigning trailer from route:', routeId);
    const route = findRouteById(routeId);
    if (route && route.trailer) {
        const trailerName = route.trailer.name;
        if (confirm(`Unassign ${trailerName} from ${route.name}?`)) {
            route.trailer = null;
            route.updatedAt = new Date().toISOString();
            saveToLocalStorage();
            debounceRender('renderRouteCards');
            eventBus.emit('routes:trailerUnassigned', { routeId, trailerName });
        }
    }
}

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

    const route = findRouteById(routeId);
    if (!route) {
        alert('Route not found. Please refresh and try again.');
        return;
    }

    const hasAssignments = Boolean(
        route.driver ||
        route.asset ||
        (route.safetyEscorts && route.safetyEscorts.length > 0) ||
        route.trailer ||
        (route.notes && route.notes.trim().length > 0)
    );

    const childRoutes = Array.isArray(route.combinedChildren)
        ? route.combinedChildren
            .map(childId => STATE.data.routes.find(r => r.id === childId))
            .filter(Boolean)
        : [];

    const parentRoute = route.combinedInto
        ? STATE.data.routes.find(r => r.id === route.combinedInto)
        : null;

    const messageLines = [];
    const routeLabel = route.name || (route.routeNumber ? `Route ${route.routeNumber}` : 'this route');
    messageLines.push(`Are you sure you want to delete ${routeLabel}?`);

    if (hasAssignments) {
        messageLines.push('This will remove its driver, vehicle, escorts, trailer, and notes.');
    }

    if (childRoutes.length > 0) {
        const childLabels = childRoutes
            .map(child => child.name || (child.routeNumber ? `Route ${child.routeNumber}` : child.id))
            .join('\n• ');
        messageLines.push(`The following combined routes will be restored as separate cards:\n• ${childLabels}`);
    }

    if (parentRoute) {
        const parentLabel = parentRoute.name || (parentRoute.routeNumber ? `Route ${parentRoute.routeNumber}` : parentRoute.id);
        messageLines.push(`${routeLabel} is currently combined into ${parentLabel} and will be removed from that card.`);
    }

    messageLines.push('This action cannot be undone.');

    const confirmation = confirm(messageLines.join('\n\n'));
    if (!confirmation) {
        return;
    }

    // Detach from parent route if currently combined
    if (parentRoute) {
        detachRouteFromParent(parentRoute, route.id);
        updatePrimaryRouteCombinationDisplay(parentRoute);
        parentRoute.updatedAt = new Date().toISOString();
    }

    // Restore any combined child routes before deletion
    if (childRoutes.length > 0) {
        const childIds = [...(route.combinedChildren || [])];
        childIds.forEach(childId => detachRouteFromParent(route, childId));
    }

    // Remove any route-specific metadata from global state stores
    if (STATE.routeStatus && routeId in STATE.routeStatus) {
        delete STATE.routeStatus[routeId];
    }
    if (STATE.routeNotes && routeId in STATE.routeNotes) {
        delete STATE.routeNotes[routeId];
    }

    const deletedRouteName = route.name || routeLabel;

    STATE.data.routes = STATE.data.routes.filter(r => r.id !== routeId);
    saveToLocalStorage();
    debounceRender('renderRouteCards');

    showTemporaryMessage(`${deletedRouteName} deleted`, 'success');
}

// Global functions for onclick handlers in HTML
function handleRouteStatusUpdate(routeKey, status) {
    console.log('🔄 Updating route status:', routeKey, 'to:', status);
    const route = resolveRouteFromKey(routeKey);
    if (!route) {
        console.error('❌ Route not found for status update:', routeKey);
        return;
    }

    const routeId = route.id;
    const previousStatus = route.status;
    if (previousStatus !== status) {
        console.log('📊 Route found, old status:', previousStatus, '→ new status:', status);
    }

    route.status = status;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    updateStatusPillUI(routeId, status);

    const card = document.querySelector(`[data-route-id="${routeId}"]`);
    if (card && card.classList.contains('collapsed')) {
        console.log('🔄 Updating collapsed summary for route:', routeId);
        removeCollapsedSummary(card);
        createCollapsedSummary(routeId, card);
    }
}

// =============================================================================
// GLOBAL EXPOSURE - Route Status & Destination Handlers
// Required for HTML onclick attributes
// =============================================================================
window.routeCardsHandleStatusUpdate = handleRouteStatusUpdate;

if (typeof window.updateRouteStatus !== 'function') {
    window.updateRouteStatus = handleRouteStatusUpdate;
}

window.updateRouteDestination = function(routeId, destination) {
    console.log('Updating route destination:', routeId, destination);
    const route = findRouteById(routeId);
    if (route) {
        route.destination = destination;
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
    }
};

window.updateDepartureSequence = function(routeId, sequence) {
    console.log('Updating departure sequence:', routeId, sequence);
    const route = findRouteById(routeId);
    if (route) {
        const num = parseInt(sequence);
        route.departureSequence = isNaN(num) || num < 1 ? null : num;
        route.updatedAt = new Date().toISOString();
        saveToLocalStorage();
        renderRouteCards(); // Re-render to show updated badge
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

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
        }
    });
}

function getToggleIconSource(isExpanded) {
    return isExpanded ? 'assets/icons/CollapseButton.png' : 'assets/icons/ExpandButton.png';
}

function refreshToggleIcon(icon, src) {
    // Reset any rotation applied by previous states and refresh the src to bust cache
    icon.style.transform = '';
    icon.src = src;

    if (icon.complete) {
        icon.src = `${src}?v=${Date.now()}`;
    }
}

function syncRouteToggleButtons(card, routeId, isExpanded) {
    const buttons = card.querySelectorAll(`[data-route-toggle="${routeId}"]`);
    const icons = Array.from(buttons)
        .map(button => button.querySelector('.toggle-icon'))
        .filter(Boolean);

    console.log(`🔄 Syncing ${icons.length} toggle button(s) for route ${routeId}, expanded: ${isExpanded}`);

    buttons.forEach(button => {
        button.title = isExpanded ? 'Collapse card' : 'Expand card';
        button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });

    const newSrc = getToggleIconSource(isExpanded);
    icons.forEach(icon => refreshToggleIcon(icon, newSrc));
}

function removeCollapsedSummary(card) {
    const existingSummary = card.querySelector('.collapsed-summary');
    if (existingSummary) {
        existingSummary.remove();
    }
}

function getStatusDotColor(status) {
    switch (status) {
        case '10-8': return '#16a34a'; // green
        case '10-7': return '#dc2626'; // red
        case '10-11': return '#f97316'; // orange
        default: return '#6b7280'; // gray
    }
}

/**
 * Toggle collapse/expand state of a route card
 * @param {string} routeId - The ID of the route card to toggle
 */
function toggleRouteCard(routeId) {
    const card = document.querySelector(`.route-card[data-route-id="${routeId}"]`);
    const content = document.getElementById(`route-content-${routeId}`);
    
    if (!content || !card) {
        console.error('❌ Could not find route card elements for:', routeId);
        return;
    }

    const isCurrentlyCollapsed = card.classList.contains('collapsed');

    // Ensure legacy inline display styles don't interfere
    content.style.removeProperty('display');

    const shouldCollapse = !isCurrentlyCollapsed;

    if (shouldCollapse) {
        card.classList.add('collapsed');
        content.hidden = true;
        createCollapsedSummary(routeId, card);
    } else {
        card.classList.remove('collapsed');
        content.hidden = false;
        removeCollapsedSummary(card);
    }

    syncRouteToggleButtons(card, routeId, !shouldCollapse);
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

    removeCollapsedSummary(card);

    const header = card.querySelector('.route-header');
    if (!header) {
        console.warn('⚠️ Route card header not found when creating collapsed summary:', routeId);
        return;
    }

    const isFieldTrip = route.type === 'field-trips';
    const hasNotes = Boolean(route.notes && route.notes.trim());
    const driverName = route.driver ? escapeHtml(route.driver.name) : 'No driver';
    const parkingSpace = route.asset && route.asset.details && route.asset.details.parkingSpace 
        ? `<span class="parking-indicator"><img src="assets/icons/ParkingButton.png" class="parking-icon" alt="Parking" /> ${escapeHtml(route.asset.details.parkingSpace)}</span>` 
        : '';
    const vehicleName = route.asset ? escapeHtml(route.asset.name) + (parkingSpace ? ' ' + parkingSpace : '') : 'No vehicle';
    const trailerName = isFieldTrip && route.trailer ? escapeHtml(route.trailer.name) : null;
    const escortCount = Array.isArray(route.safetyEscorts) ? route.safetyEscorts.length : 0;

    const safeRouteId = escapeHtml(route.id);
    const safeRouteNumber = route.routeNumber ? escapeHtml(route.routeNumber) : '';
    // Extract route number or use full name for field trips (remove "Route" prefix for regular routes)
    const displayName = isFieldTrip 
        ? route.name || 'Unnamed Field Trip'
        : (route.routeNumber || route.name?.replace(/^Route\s*/i, '') || 'N/A');
    const routeName = escapeHtml(displayName);
    const noteContent = hasNotes ? escapeHtml(route.notes) : '';

    const notesMarkup = hasNotes
        ? `<span class="note-icon-container" data-note="${noteContent}" title="Click to view note"><img src="assets/icons/NoteButton.png" alt="Notes" class="note-icon" /></span>`
        : '';

    const trailerMarkup = trailerName
        ? `<span class="collapsed-summary-trailer">${trailerName}</span>`
        : '';

    const escortMarkup = escortCount > 0
        ? `<span class="collapsed-summary-escorts">${escortCount} Escort${escortCount > 1 ? 's' : ''}</span>`
        : '';

    const actionButtonsHtml = [
        !isFieldTrip
            ? `<button type="button" class="collapsed-summary-action-btn" onclick="handleCombineRoute('${safeRouteId}', '${safeRouteNumber}')" title="Combine Route"><img src="assets/icons/MergeButton.png" alt="" /></button>`
            : '',
        isFieldTrip
            ? `<button type="button" class="collapsed-summary-action-btn" onclick="handleDeleteFieldTrip('${safeRouteId}')" title="Delete Field Trip"><img src="assets/icons/DeleteButton.png" alt="" /></button>`
            : `<button type="button" class="collapsed-summary-action-btn" onclick="handleDeleteRoute('${safeRouteId}')" title="Delete Route"><img src="assets/icons/DeleteButton.png" alt="" /></button>`,
        `<button type="button" class="collapsed-summary-toggle" data-route-toggle="${safeRouteId}" aria-expanded="false" aria-controls="route-content-${safeRouteId}" title="Expand card" onclick="toggleRouteCard('${safeRouteId}')"><img src="${getToggleIconSource(false)}" class="toggle-icon" alt="" loading="eager" /></button>`
    ].filter(Boolean).join('');

    const summaryHtml = `
        <div class="collapsed-summary" data-route-id="${safeRouteId}">
            <div class="collapsed-summary-top-row">
                <div class="collapsed-summary-route-info">
                    <span class="collapsed-summary-route-name">${routeName}</span>
                    ${route.departureSequence ? `<span class="departure-badge">${getDepartureText(route.departureSequence)}</span>` : ''}
                    ${route.status ? `<span class="collapsed-summary-status-dot" style="background-color: ${getStatusDotColor(route.status)};"></span>` : ''}
                </div>
                <div class="collapsed-summary-top-actions">
                    ${actionButtonsHtml}
                </div>
            </div>
            <div class="collapsed-summary-bottom-row">
                <span class="collapsed-summary-driver ${route.driver ? 'assigned' : 'unassigned'}">${driverName}</span>
                <span class="collapsed-summary-asset ${route.asset ? 'assigned' : 'unassigned'}">${vehicleName}</span>
                ${notesMarkup}
                ${trailerMarkup}
                ${escortMarkup}
            </div>
        </div>
    `;

    header.insertAdjacentHTML('afterend', summaryHtml);
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
        if (!card.classList.contains('collapsed')) {
            hasExpandedCards = true;
        }
    });
    
    if (hasExpandedCards) {
        // Collapse all individual cards in the section
        button.textContent = 'Expand All';
        
        routeCards.forEach(card => {
            const routeId = card.dataset.routeId;
            if (routeId && !card.classList.contains('collapsed')) {
                toggleRouteCard(routeId);
            }
        });
    } else {
        // Expand all individual cards in the section
        button.textContent = 'Collapse All';
        
        routeCards.forEach(card => {
            const routeId = card.dataset.routeId;
            if (routeId && card.classList.contains('collapsed')) {
                toggleRouteCard(routeId);
            }
        });
    }
}

// =============================================================================
// NOTE TOOLTIP FUNCTIONALITY
// =============================================================================

/**
 * Initialize note tooltip functionality for all note icons
 */
function initializeNoteTooltips() {
    // Remove existing listeners to prevent duplicates
    document.removeEventListener('mouseover', handleNoteIconHover);
    document.removeEventListener('mouseout', handleNoteIconLeave);
    
    // Add event listeners using event delegation
    document.addEventListener('mouseover', handleNoteIconHover);
    document.addEventListener('mouseout', handleNoteIconLeave);
}

/**
 * Handle hover over note icon
 */
function handleNoteIconHover(event) {
    const noteIcon = event.target.closest('.note-icon-container');
    if (!noteIcon) return;
    
    const noteContent = noteIcon.getAttribute('data-note');
    if (!noteContent) return;
    
    showNoteTooltip(noteIcon, noteContent);
}

/**
 * Handle mouse leave from note icon
 */
function handleNoteIconLeave(event) {
    const noteIcon = event.target.closest('.note-icon-container');
    if (!noteIcon) return;
    
    hideNoteTooltip();
}

/**
 * Show note tooltip with smart positioning
 */
function showNoteTooltip(container, noteContent) {
    // Remove any existing tooltip
    hideNoteTooltip();
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'note-tooltip';
    tooltip.id = 'note-tooltip';
    tooltip.textContent = noteContent;
    
    // Add to container
    container.appendChild(tooltip);
    
    // Calculate best position
    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let position = 'top'; // default
    let left = 0;
    let top = 0;
    
    // Determine best vertical position
    const spaceAbove = containerRect.top;
    const spaceBelow = viewportHeight - containerRect.bottom;
    const tooltipHeight = tooltipRect.height || 60; // estimate if not available
    
    if (spaceAbove >= tooltipHeight + 10) {
        position = 'top';
        top = -tooltipHeight - 12;
    } else if (spaceBelow >= tooltipHeight + 10) {
        position = 'bottom';
        top = container.offsetHeight + 12;
    } else {
        // Use side positioning if not enough vertical space
        const spaceLeft = containerRect.left;
        const spaceRight = viewportWidth - containerRect.right;
        const tooltipWidth = tooltipRect.width || 200; // estimate
        
        if (spaceRight >= tooltipWidth + 10) {
            position = 'right';
            left = container.offsetWidth + 12;
            top = -container.offsetHeight / 2;
        } else if (spaceLeft >= tooltipWidth + 10) {
            position = 'left';
            left = -tooltipWidth - 12;
            top = -container.offsetHeight / 2;
        } else {
            // Fallback to top with adjusted position
            position = 'top';
            top = -tooltipHeight - 12;
        }
    }
    
    // For top/bottom positioning, center horizontally
    if (position === 'top' || position === 'bottom') {
        left = (container.offsetWidth / 2) - (tooltipRect.width / 2);
        
        // Adjust if tooltip would go off screen horizontally
        const tooltipLeft = containerRect.left + left;
        const tooltipRight = tooltipLeft + tooltipRect.width;
        
        if (tooltipLeft < 10) {
            left = 10 - containerRect.left;
        } else if (tooltipRight > viewportWidth - 10) {
            left = (viewportWidth - 10) - containerRect.left - tooltipRect.width;
        }
    }
    
    // Apply positioning
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add(`position-${position}`);
    
    // Show tooltip with animation
    requestAnimationFrame(() => {
        tooltip.classList.add('visible');
    });
}

/**
 * Hide note tooltip
 */
function hideNoteTooltip() {
    const tooltip = document.getElementById('note-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Initialize tooltips when route cards are rendered
eventBus.on('routes:rendered', initializeNoteTooltips);

// =============================================================================
// GLOBAL EXPOSURE - Route Card Action Handlers
// Required for HTML onclick attributes in route card templates
// Organized in Phase 2 Task 2.4 for better maintainability
// =============================================================================
window.handleAssignDriver = handleAssignDriver;           // Assignment actions
window.handleAssignAsset = handleAssignAsset;
window.handleEditAsset = handleEditAsset;
window.handleAssignTrailer = handleAssignTrailer;
window.handleRemoveTrailer = handleRemoveTrailer;
window.handleAddSafetyEscort = handleAddSafetyEscort;
window.handleRemoveSafetyEscort = handleRemoveSafetyEscort;

window.handleUpdateNotes = handleUpdateNotes;             // Route management
window.handleResetCard = handleResetCard;
window.toggleRouteCard = toggleRouteCard;
window.toggleSection = toggleSection;

window.handleDeleteFieldTrip = handleDeleteFieldTrip;     // Field trip actions
window.deleteAllFieldTrips = deleteAllFieldTrips;
window.addNewFieldTripRoute = addNewFieldTripRoute;

window.deduplicateRoutes = deduplicateRoutes;             // Utility functions

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
                <td class="px-3 py-2">
                    <input type="number" 
                           class="route-departure-input w-full px-2 py-1 border rounded text-sm" 
                           data-route-number="${i}"
                           placeholder="-"
                           value="${route.departureSequence || ''}"
                           min="1"
                           max="99"
                           style="width: 60px;">
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
    
    // Departure sequence change handlers
    document.querySelectorAll('.route-departure-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const routeNumber = parseInt(e.target.dataset.routeNumber);
            const newDeparture = e.target.value;
            updateRouteDepartureSequence(routeNumber, newDeparture);
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

// Route combining functionality
function handleCombineRoute(routeId, routeNumber) {
    console.log(`🔀 Opening route combination modal for Route ${routeNumber}`);

    if (!Array.isArray(STATE.data?.routes)) {
        alert('Route data is unavailable. Please try again after reloading the dashboard.');
        return;
    }

    const sourceRoute = STATE.data.routes.find(route => route.id === routeId);
    if (!sourceRoute) {
        alert('Route not found. Please refresh and try again.');
        return;
    }

    initializeRouteCombinationMetadata(sourceRoute);

    // Include routes that are not field trips and either uncombined or already combined into this source route
    const candidateRoutes = STATE.data.routes
        .filter(route => route.id !== routeId && route.type !== 'field-trips')
        .filter(route => !route.combinedInto || route.combinedInto === sourceRoute.id);

    if (candidateRoutes.length === 0) {
        alert('No other routes are available to combine right now.');
        return;
    }

    showRouteCombineModal(sourceRoute, candidateRoutes);
}

function initializeRouteCombinationMetadata(route) {
    if (!route) return;
    if (!route.baseName) {
        const fallback = route.routeNumber ? `Route ${route.routeNumber}` : (route.name || 'Route');
        route.baseName = route.name || fallback;
    }
    if (route.combinedWith) {
        delete route.combinedWith;
    }
    if (!Array.isArray(route.combinedChildren)) {
        route.combinedChildren = [];
    }
    if (!route.combinationDetails) {
        route.combinationDetails = {};
    }
}

function showRouteCombineModal(sourceRoute, availableRoutes) {
    const modal = document.createElement('div');
    modal.id = 'route-combine-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const selectedIds = new Set(sourceRoute.combinedChildren || []);
    const sortedRoutes = [...availableRoutes].sort(sortRoutesByNumber);

    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Combine Routes for ${sourceRoute.baseName || sourceRoute.name}</h3>
                <p class="text-sm text-gray-600 mt-1">Select one or more routes to merge into this card. Unchecking a route will restore it as a separate card.</p>
            </div>
            
            <div class="px-6 py-4 max-h-[55vh] overflow-y-auto">
                <div class="space-y-2">
                    ${sortedRoutes.map(route => {
                        const isSelected = selectedIds.has(route.id);
                        const isDisabled = route.combinedInto && route.combinedInto !== sourceRoute.id;
                        const checkboxAttributes = [
                            'type="checkbox"',
                            'name="target-route"',
                            `value="${route.id}"`,
                            isSelected ? 'checked' : '',
                            isDisabled ? 'disabled' : ''
                        ].filter(Boolean).join(' ');
                        const combinedBadge = route.combinedInto && route.combinedInto !== sourceRoute.id
                            ? '<div class="text-xs text-red-500">Already combined with another route</div>'
                            : '';
                        return `
                            <label class="flex items-start gap-3 p-3 rounded-lg border ${isSelected ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'} hover:bg-gray-100 transition-colors cursor-pointer">
                                <input ${checkboxAttributes} class="mt-1">
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-gray-900">Route ${route.routeNumber || route.name || route.id}</div>
                                    <div class="text-sm text-gray-600 truncate">${route.name || 'Unnamed Route'}</div>
                                    ${route.driver ? `<div class="text-xs text-gray-500 mt-1">Driver: ${route.driver.name}</div>` : ''}
                                    ${combinedBadge}
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="px-6 py-4 border-t border-gray-200 flex justify-between items-center gap-3">
                <button type="button" onclick="closeRouteCombineModal()" 
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                    Cancel
                </button>
                <button type="button" onclick="applyRouteCombinationSelections('${sourceRoute.id}')" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Save &amp; Apply
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeRouteCombineModal();
        }
    });

    // Focus first checkbox for accessibility
    requestAnimationFrame(() => {
        const firstCheckbox = modal.querySelector('input[name="target-route"]');
        if (firstCheckbox) {
            firstCheckbox.focus();
        }
    });
}

function sortRoutesByNumber(a, b) {
    const labelA = a.routeNumber || a.name || '';
    const labelB = b.routeNumber || b.name || '';
    const numA = parseInt(labelA, 10);
    const numB = parseInt(labelB, 10);

    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
    }

    return String(labelA).localeCompare(String(labelB), undefined, { numeric: true, sensitivity: 'base' });
}

function applyRouteCombinationSelections(sourceRouteId) {
    const modal = document.getElementById('route-combine-modal');
    if (!modal) {
        console.error('Route combine modal not found when attempting to apply selections.');
        return;
    }

    const selectedIds = Array.from(modal.querySelectorAll('input[name="target-route"]:checked'))
        .map(input => input.value);

    applyRouteCombinationChanges(sourceRouteId, selectedIds);
}

function applyRouteCombinationChanges(sourceRouteId, selectedIds) {
    if (!Array.isArray(STATE.data?.routes)) {
        alert('Route data is unavailable. Please try again later.');
        return;
    }

    const sourceRoute = STATE.data.routes.find(route => route.id === sourceRouteId);
    if (!sourceRoute) {
        alert('Route not found. Please refresh and try again.');
        return;
    }

    initializeRouteCombinationMetadata(sourceRoute);

    const previousSet = new Set(sourceRoute.combinedChildren || []);
    const nextSet = new Set(selectedIds);

    const toAdd = [...nextSet].filter(id => !previousSet.has(id));
    const toRemove = [...previousSet].filter(id => !nextSet.has(id));

    toAdd.forEach(childId => attachRouteToParent(sourceRoute, childId));
    toRemove.forEach(childId => detachRouteFromParent(sourceRoute, childId));

    updatePrimaryRouteCombinationDisplay(sourceRoute);

    sourceRoute.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    renderRouteCards();
    closeRouteCombineModal();

    showTemporaryMessage(`Updated combined routes for ${sourceRoute.name}`, 'success');
}

function attachRouteToParent(sourceRoute, childId) {
    const childRoute = STATE.data.routes.find(route => route.id === childId);
    if (!childRoute) {
        console.warn('Cannot combine routes: target route not found', childId);
        return;
    }

    if (childRoute.combinedInto && childRoute.combinedInto !== sourceRoute.id) {
        console.warn(`Route ${childRoute.routeNumber} is already combined with another route.`);
        return;
    }

    initializeRouteCombinationMetadata(sourceRoute);

    if (!sourceRoute.combinedChildren.includes(childId)) {
        sourceRoute.combinedChildren.push(childId);
    }

    const noteText = generateCombinationNote(childRoute);
    if (!sourceRoute.combinationDetails) {
        sourceRoute.combinationDetails = {};
    }

    const previousNote = sourceRoute.combinationDetails[childId];
    if (previousNote && previousNote !== noteText) {
        removeCombinationNoteFromRoute(sourceRoute, previousNote);
    }

    sourceRoute.combinationDetails[childId] = noteText;
    ensureCombinationNoteOnRoute(sourceRoute, noteText);

    childRoute.combinedInto = sourceRoute.id;
    childRoute.hidden = true;
    childRoute.hiddenReason = 'combined';
    childRoute.hiddenAt = new Date().toISOString();
    childRoute.updatedAt = new Date().toISOString();
}

function detachRouteFromParent(sourceRoute, childId) {
    const childRoute = STATE.data.routes.find(route => route.id === childId);
    if (!childRoute) {
        console.warn('Cannot uncombine routes: target route not found', childId);
        return;
    }

    sourceRoute.combinedChildren = (sourceRoute.combinedChildren || []).filter(id => id !== childId);

    if (sourceRoute.combinationDetails && sourceRoute.combinationDetails[childId]) {
        removeCombinationNoteFromRoute(sourceRoute, sourceRoute.combinationDetails[childId]);
        delete sourceRoute.combinationDetails[childId];
    }

    childRoute.hidden = false;
    childRoute.hiddenReason = null;
    childRoute.hiddenAt = null;
    childRoute.combinedInto = null;
    childRoute.updatedAt = new Date().toISOString();
}

function updatePrimaryRouteCombinationDisplay(route) {
    if (!route) return;
    initializeRouteCombinationMetadata(route);

    const childRoutes = (route.combinedChildren || [])
        .map(childId => STATE.data.routes.find(r => r.id === childId))
        .filter(Boolean);

    if (childRoutes.length === 0) {
        route.name = route.baseName;
        return;
    }

    const sortedChildren = childRoutes.slice().sort(sortRoutesByNumber);
    const childNames = sortedChildren.map(child => child.name || (child.routeNumber ? `Route ${child.routeNumber}` : child.id));

    route.name = `${route.baseName} + ${childNames.join(' + ')}`;
}

function generateCombinationNote(route) {
    const label = route.routeNumber ? `Route ${route.routeNumber}` : (route.name || route.id);
    return `Combined with ${label} on ${new Date().toLocaleString()}`;
}

function ensureCombinationNoteOnRoute(route, noteText) {
    const currentNotes = route.notes || '';
    const lines = currentNotes.split('\n');
    const alreadyPresent = lines.some(line => line.trim() === noteText);
    if (alreadyPresent) return;

    route.notes = currentNotes.trim().length > 0
        ? `${currentNotes.trimEnd()}\n${noteText}`
        : noteText;
}

function removeCombinationNoteFromRoute(route, noteText) {
    if (!route.notes) return;
    const filteredLines = route.notes
        .split('\n')
        .filter(line => line.trim() !== noteText);
    route.notes = filteredLines.join('\n').trim();
}

function closeRouteCombineModal() {
    const modal = document.getElementById('route-combine-modal');
    if (modal) {
        modal.remove();
    }
}

// Make functions globally available for onclick handlers
window.handleCombineRoute = handleCombineRoute;
window.applyRouteCombinationSelections = applyRouteCombinationSelections;
window.closeRouteCombineModal = closeRouteCombineModal;
window.handleDeleteRoute = handleDeleteRoute;