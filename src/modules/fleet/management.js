/* FLEET - MANAGEMENT MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Fleet service management, asset assignments, spare tracking,
   down list management, field trip assignments, and fleet status monitoring
   Total lines: 480
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive fleet system from fragmented extractions
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { debounceRender, PERFORMANCE } from '../core/utils.js';

// =============================================================================
// FLEET MANAGEMENT CONFIGURATION
// =============================================================================

const FLEET_CONFIG = {
    // Fleet service status options
    serviceStatuses: [
        'In Yard',
        'En Route',
        'On Scene',
        'Returning',
        'Out of Service'
    ],
    
    // Assignment types
    assignmentTypes: [
        'driver',
        'aide',
        'escort',
        'asset',
        'trailer'
    ],
    
    // Fleet operations
    operations: {
        autoRefresh: true,
        refreshInterval: 30000, // 30 seconds
        trackStatusChanges: true,
        enableNotifications: true
    },
    
    // Down asset categories
    downCategories: [
        'Mechanical',
        'Body Damage',
        'Electrical',
        'Inspection',
        'Scheduled Maintenance',
        'Emergency Repair',
        'Other'
    ]
};

// Track fleet state
const FLEET_STATE = {
    serviceStatus: 'In Yard',
    statusTimestamps: new Map(),
    activeAssignments: new Map(),
    downAssets: new Set(),
    spareAssets: new Set(),
    pendingAssignments: [],
    fleetServiceModal: null
};

// =============================================================================
// FLEET MANAGEMENT INITIALIZATION
// =============================================================================

function initializeFleetManagement() {
    console.log('🚛 Initializing fleet management system...');
    
    // Load fleet state from storage
    loadFleetState();
    
    // Set up fleet event listeners
    setupFleetListeners();
    
    // Initialize fleet UI components
    initializeFleetUI();
    
    // Start auto-refresh if enabled
    if (FLEET_CONFIG.operations.autoRefresh) {
        startAutoRefresh();
    }
    
    console.log('✅ Fleet management system initialized');
    eventBus.emit('fleet:initialized', {
        serviceStatus: FLEET_STATE.serviceStatus,
        totalAssets: STATE.data?.assets?.length || 0
    });
    
    return true;
}

function setupFleetListeners() {
    // Listen for data updates
    eventBus.on('state:dataUpdated', () => {
        debounceRender('renderFleetService');
        debounceRender('renderDownList');
        debounceRender('renderSparesList');
    });
    
    // Listen for assignment changes
    eventBus.on('assignments:changed', () => {
        updateFleetAssignments();
        debounceRender('renderSparesList');
    });
    
    // Listen for asset status changes
    eventBus.on('assets:markedDown', (data) => {
        handleAssetDown(data.assetName, data.reason);
    });
    
    eventBus.on('assets:repaired', (data) => {
        handleAssetRepaired(data.assetName);
    });
}

function initializeFleetUI() {
    // Set up fleet service modal if not exists
    createFleetServiceModal();
    
    // Initialize fleet panels
    renderFleetService();
    renderDownList();
    renderSparesList();
}

function startAutoRefresh() {
    setInterval(() => {
        if (FLEET_CONFIG.operations.autoRefresh) {
            refreshFleetData();
        }
    }, FLEET_CONFIG.operations.refreshInterval);
}

// =============================================================================
// FLEET SERVICE MANAGEMENT
// =============================================================================

function renderFleetService() {
    console.log('🚛 Rendering fleet service...');
    
    if (PERFORMANCE.isRendering) return;
    PERFORMANCE.isRendering = true;
    
    try {
        const fleetService = document.getElementById('fleet-service');
        if (!fleetService) {
            console.error('❌ Fleet service element not found');
            return;
        }
        
        const currentStatus = FLEET_STATE.serviceStatus;
        const lastUpdate = FLEET_STATE.statusTimestamps.get(currentStatus);
        const statusClass = getStatusClass(currentStatus);
        
        fleetService.innerHTML = `
            <div class="fleet-service-panel bg-white rounded-lg shadow-lg p-6">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">Fleet Service Truck</h3>
                    <button class="fleet-service-settings-btn text-gray-500 hover:text-gray-700 text-sm">
                        ⚙️ Settings
                    </button>
                </div>
                
                <div class="fleet-status-display mb-6">
                    <div class="flex items-center space-x-3 mb-3">
                        <div class="status-indicator w-4 h-4 rounded-full ${statusClass}"></div>
                        <div class="current-status text-xl font-semibold text-gray-800">
                            ${currentStatus}
                        </div>
                    </div>
                    
                    ${lastUpdate ? `
                        <div class="status-timestamp text-sm text-gray-500">
                            Since: ${formatTimestamp(lastUpdate)}
                        </div>
                    ` : ''}
                </div>
                
                <div class="fleet-actions grid grid-cols-2 gap-3 mb-6">
                    ${FLEET_CONFIG.serviceStatuses.map(status => `
                        <button class="fleet-status-btn px-4 py-3 rounded-lg font-medium transition-colors ${
                            status === currentStatus 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }"
                                data-status="${status}">
                            ${getStatusIcon(status)} ${status}
                        </button>
                    `).join('')}
                </div>
                
                <div class="fleet-summary">
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div class="summary-item">
                            <div class="text-2xl font-bold text-blue-600">${getActiveAssetsCount()}</div>
                            <div class="text-sm text-gray-600">Active</div>
                        </div>
                        <div class="summary-item">
                            <div class="text-2xl font-bold text-red-600">${FLEET_STATE.downAssets.size}</div>
                            <div class="text-sm text-gray-600">Down</div>
                        </div>
                        <div class="summary-item">
                            <div class="text-2xl font-bold text-green-600">${FLEET_STATE.spareAssets.size}</div>
                            <div class="text-sm text-gray-600">Spares</div>
                        </div>
                    </div>
                </div>
                
                <div class="fleet-quick-actions mt-6 pt-4 border-t">
                    <div class="flex space-x-3">
                        <button class="emergency-btn flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                            🚨 Emergency
                        </button>
                        <button class="fleet-report-btn flex-1 py-2 px-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium">
                            📊 Report
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        setupFleetServiceListeners(fleetService);
        
    } catch (error) {
        console.error('❌ Fleet service render error:', error);
        
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

function setupFleetServiceListeners(container) {
    // Status button clicks
    container.querySelectorAll('.fleet-status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            selectFleetServiceStatus(status);
        });
    });
    
    // Emergency button
    container.querySelector('.emergency-btn')?.addEventListener('click', () => {
        handleFleetEmergency();
    });
    
    // Report button
    container.querySelector('.fleet-report-btn')?.addEventListener('click', () => {
        generateFleetReport();
    });
    
    // Settings button
    container.querySelector('.fleet-service-settings-btn')?.addEventListener('click', () => {
        openFleetServiceModal();
    });
}

function selectFleetServiceStatus(status) {
    console.log('🚛 Selected fleet service status:', status);
    
    if (FLEET_CONFIG.serviceStatuses.includes(status)) {
        updateFleetServiceStatus(status);
        
        // Show confirmation
        eventBus.emit('ui:showToast', {
            message: `Fleet service status changed to: ${status}`,
            type: 'success',
            duration: 2000
        });
    }
}

function updateFleetServiceStatus(status) {
    console.log('🚛 Updating fleet service status to:', status);
    
    const previousStatus = FLEET_STATE.serviceStatus;
    FLEET_STATE.serviceStatus = status;
    
    // Record timestamp for this status change
    FLEET_STATE.statusTimestamps.set(status, new Date());
    
    // Update STATE for persistence
    STATE.fleetServiceStatus = status;
    STATE.statusTimestamps = Object.fromEntries(FLEET_STATE.statusTimestamps);
    
    // Save state
    saveToLocalStorage();
    
    // Re-render fleet service
    debounceRender('renderFleetService');
    
    // Emit status change event
    eventBus.emit('fleet:statusChanged', {
        from: previousStatus,
        to: status,
        timestamp: new Date()
    });
    
    // Handle status-specific actions
    handleStatusChange(previousStatus, status);
}

function handleStatusChange(from, to) {
    // Auto-notifications based on status
    if (to === 'Emergency' || to === 'Out of Service') {
        eventBus.emit('ui:showToast', {
            message: `⚠️ Fleet service is now ${to}`,
            type: 'warning',
            duration: 5000
        });
    }
    
    // Log status change
    console.log(`🚛 Fleet status changed: ${from} → ${to}`);
    
    // Additional status-specific logic can be added here
}

// =============================================================================
// DOWN ASSETS MANAGEMENT
// =============================================================================

function renderDownList() {
    const downList = document.getElementById('down-list') || document.getElementById('asset-down-list');
    
    if (!downList) {
        console.error('❌ Down list element not found');
        return;
    }
    
    // Get assets that are marked as down
    const downAssets = getDownAssets();
    
    if (downAssets.length === 0) {
        downList.innerHTML = '<div class="text-gray-500 text-center py-4 text-base">No assets down for maintenance</div>';
        return;
    }
    
    downList.innerHTML = downAssets.map(asset => {
        const reason = getAssetDownReason(asset.name);
        const timestamp = getAssetDownTimestamp(asset.name);
        const category = getAssetDownCategory(asset.name);
        
        return `
            <div class="down-asset-item flex justify-between items-center py-3 px-4 mb-3 rounded-lg bg-red-100 border-l-4 border-red-500">
                <div class="flex-1">
                    <div class="font-medium text-lg text-red-800">${asset.name}</div>
                    <div class="text-sm text-red-600">${asset.type} - Down for ${category || 'Maintenance'}</div>
                    ${reason ? `<div class="text-xs text-red-500 mt-1">Reason: ${reason}</div>` : ''}
                    ${timestamp ? `<div class="text-xs text-red-400 mt-1">Down since: ${formatTimestamp(new Date(timestamp))}</div>` : ''}
                </div>
                <div class="flex items-center space-x-2">
                    <button class="asset-repair-btn px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                            data-asset-name="${asset.name}">
                        ✅ Mark Repaired
                    </button>
                    <button class="asset-edit-reason-btn px-2 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                            data-asset-name="${asset.name}">
                        ✏️ Edit
                    </button>
                    <button class="asset-details-btn px-2 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            data-asset-name="${asset.name}">
                        📋 Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Update down assets set
    FLEET_STATE.downAssets.clear();
    downAssets.forEach(asset => FLEET_STATE.downAssets.add(asset.name));
}

function renderSparesList() {
    const sparesList = document.getElementById('spares-list') || document.getElementById('asset-spares-list');
    
    if (!sparesList) {
        console.error('❌ Spares list element not found');
        return;
    }
    
    // Get all assigned assets from routes and field trips
    const assignedAssets = getAllAssignedAssets();
    const downAssets = getDownAssets();
    
    // Get spare assets (available and not assigned)
    const spareAssets = getSpareAssets(assignedAssets, downAssets);
    
    if (spareAssets.length === 0) {
        sparesList.innerHTML = '<div class="text-gray-500 text-center py-4 text-base">No spare assets available</div>';
        return;
    }
    
    sparesList.innerHTML = spareAssets.map(asset => `
        <div class="spare-asset-item flex justify-between items-center py-3 px-3 bg-green-100 rounded border-l-4 border-green-500 mb-2">
            <div class="flex-1">
                <div class="font-medium text-green-700 text-base">${asset.name}</div>
                <div class="text-sm text-green-600">${asset.type}</div>
                ${asset.capacity ? `<div class="text-xs text-green-500">Capacity: ${asset.capacity}</div>` : ''}
            </div>
            <div class="flex items-center space-x-2">
                <span class="text-sm px-3 py-2 rounded bg-green-200 text-green-800 font-medium">
                    Available
                </span>
                <button class="assign-spare-btn px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        data-asset-name="${asset.name}">
                    🎯 Assign
                </button>
            </div>
        </div>
    `).join('');
    
    // Update spare assets set
    FLEET_STATE.spareAssets.clear();
    spareAssets.forEach(asset => FLEET_STATE.spareAssets.add(asset.name));
}

// =============================================================================
// ASSIGNMENT MANAGEMENT
// =============================================================================

function isStaffAssigned(staffName) {
    if (!staffName || !STATE.assignments) return false;
    
    // Check route assignments
    for (const assignment of Object.values(STATE.assignments)) {
        if (assignment.driver === staffName || 
            assignment.aide === staffName ||
            (assignment.escorts && assignment.escorts.includes(staffName))) {
            return true;
        }
    }
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        for (const fieldTrip of STATE.data.fieldTrips) {
            if (fieldTrip.driver === staffName || 
                fieldTrip.aide === staffName ||
                (fieldTrip.escorts && fieldTrip.escorts.includes(staffName))) {
                return true;
            }
        }
    }
    
    return false;
}

function isItemCurrentlyAssigned(item, type) {
    if (!item || !type) return false;
    
    // Check route assignments
    for (const assignment of Object.values(STATE.assignments)) {
        if (type === 'driver' || type === 'aide') {
            if (assignment[type] === item) return true;
        } else if (type === 'escort') {
            if (assignment.escorts && assignment.escorts.includes(item)) return true;
        } else if (type === 'asset') {
            if (assignment.asset === item) return true;
        }
    }
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        for (const fieldTrip of STATE.data.fieldTrips) {
            if (type === 'driver' || type === 'aide') {
                if (fieldTrip[type] === item) return true;
            } else if (type === 'escort') {
                if (fieldTrip.escorts && fieldTrip.escorts.includes(item)) return true;
            } else if (type === 'asset') {
                if (fieldTrip.asset === item || fieldTrip.trailer === item) return true;
            }
        }
    }
    
    return false;
}

function clearAssignment(route, type) {
    if (!route || !type || !STATE.assignments[route]) return false;
    
    const assignment = STATE.assignments[route];
    
    if (type === 'escorts' && assignment.escorts) {
        assignment.escorts = [];
    } else if (assignment[type]) {
        delete assignment[type];
    }
    
    // Save state and emit event
    saveToLocalStorage();
    eventBus.emit('assignments:changed', {
        route: route,
        type: type,
        action: 'cleared'
    });
    
    console.log(`🧹 Cleared ${type} assignment for ${route}`);
    return true;
}

function assignToFieldTrip(fieldTripId, type, itemName) {
    if (!fieldTripId || !type || !itemName) return false;
    
    const fieldTrip = STATE.data?.fieldTrips?.find(ft => ft.id === fieldTripId);
    if (!fieldTrip) {
        console.error('❌ Field trip not found:', fieldTripId);
        return false;
    }
    
    // Handle different assignment types
    if (type === 'escorts') {
        if (!fieldTrip.escorts) fieldTrip.escorts = [];
        if (!fieldTrip.escorts.includes(itemName)) {
            fieldTrip.escorts.push(itemName);
        }
    } else {
        fieldTrip[type] = itemName;
    }
    
    // Save state and emit event
    saveToLocalStorage();
    eventBus.emit('fieldTrips:assigned', {
        fieldTripId: fieldTripId,
        type: type,
        item: itemName
    });
    
    console.log(`🎯 Assigned ${itemName} as ${type} to field trip ${fieldTripId}`);
    return true;
}

function clearFieldTripAssignment(fieldTripId, type) {
    if (!fieldTripId || !type) return false;
    
    const fieldTrip = STATE.data?.fieldTrips?.find(ft => ft.id === fieldTripId);
    if (!fieldTrip) return false;
    
    if (type === 'escorts') {
        fieldTrip.escorts = [];
    } else if (fieldTrip[type]) {
        delete fieldTrip[type];
    }
    
    // Save state and emit event
    saveToLocalStorage();
    eventBus.emit('fieldTrips:assignmentCleared', {
        fieldTripId: fieldTripId,
        type: type
    });
    
    console.log(`🧹 Cleared ${type} assignment for field trip ${fieldTripId}`);
    return true;
}

function isItemCurrentlyAssignedToFieldTrip(item, type, excludeFieldTripId = null) {
    if (!item || !type || !STATE.data?.fieldTrips) return false;
    
    for (const fieldTrip of STATE.data.fieldTrips) {
        if (excludeFieldTripId && fieldTrip.id === excludeFieldTripId) continue;
        
        if (type === 'escorts') {
            if (fieldTrip.escorts && fieldTrip.escorts.includes(item)) return fieldTrip.id;
        } else if (fieldTrip[type] === item) {
            return fieldTrip.id;
        }
    }
    
    return false;
}

// =============================================================================
// FLEET SERVICE MODAL
// =============================================================================

function createFleetServiceModal() {
    if (document.getElementById('fleet-service-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'fleet-service-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">Fleet Service Settings</h3>
                <button class="close-modal text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            
            <div class="p-6">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Auto Refresh</label>
                        <label class="flex items-center">
                            <input type="checkbox" id="auto-refresh-checkbox" class="mr-2">
                            <span class="text-sm">Enable automatic refresh</span>
                        </label>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Refresh Interval (seconds)</label>
                        <input type="number" id="refresh-interval" min="10" max="300" value="30" 
                               class="w-full border rounded px-3 py-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Notifications</label>
                        <label class="flex items-center">
                            <input type="checkbox" id="notifications-checkbox" class="mr-2">
                            <span class="text-sm">Enable status change notifications</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end space-x-3 p-6 border-t">
                <button class="cancel-btn px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button class="save-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-modal').addEventListener('click', closeFleetServiceModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeFleetServiceModal);
    modal.querySelector('.save-btn').addEventListener('click', saveFleetServiceSettings);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFleetServiceModal();
    });
    
    FLEET_STATE.fleetServiceModal = modal;
}

function openFleetServiceModal() {
    console.log('🚛 Opening fleet service modal');
    
    const modal = document.getElementById('fleet-service-modal');
    if (!modal) {
        createFleetServiceModal();
        return openFleetServiceModal();
    }
    
    // Load current settings
    const autoRefreshCheckbox = modal.querySelector('#auto-refresh-checkbox');
    const refreshIntervalInput = modal.querySelector('#refresh-interval');
    const notificationsCheckbox = modal.querySelector('#notifications-checkbox');
    
    if (autoRefreshCheckbox) autoRefreshCheckbox.checked = FLEET_CONFIG.operations.autoRefresh;
    if (refreshIntervalInput) refreshIntervalInput.value = FLEET_CONFIG.operations.refreshInterval / 1000;
    if (notificationsCheckbox) notificationsCheckbox.checked = FLEET_CONFIG.operations.enableNotifications;
    
    modal.classList.remove('hidden');
}

function closeFleetServiceModal() {
    console.log('🚛 Closing fleet service modal');
    
    const modal = document.getElementById('fleet-service-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function saveFleetServiceSettings() {
    const modal = document.getElementById('fleet-service-modal');
    if (!modal) return;
    
    const autoRefreshCheckbox = modal.querySelector('#auto-refresh-checkbox');
    const refreshIntervalInput = modal.querySelector('#refresh-interval');
    const notificationsCheckbox = modal.querySelector('#notifications-checkbox');
    
    // Update configuration
    if (autoRefreshCheckbox) FLEET_CONFIG.operations.autoRefresh = autoRefreshCheckbox.checked;
    if (refreshIntervalInput) FLEET_CONFIG.operations.refreshInterval = parseInt(refreshIntervalInput.value) * 1000;
    if (notificationsCheckbox) FLEET_CONFIG.operations.enableNotifications = notificationsCheckbox.checked;
    
    // Save to state
    STATE.fleetConfig = FLEET_CONFIG;
    saveToLocalStorage();
    
    // Show confirmation
    eventBus.emit('ui:showToast', {
        message: 'Fleet service settings saved',
        type: 'success'
    });
    
    closeFleetServiceModal();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getDownAssets() {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => 
        STATE.assetStatus[asset.name] === 'Down'
    );
}

function getSpareAssets(assignedAssets = null, downAssets = null) {
    if (!STATE.data?.assets) return [];
    
    const assigned = assignedAssets || getAllAssignedAssets();
    const down = downAssets || getDownAssets();
    const downNames = new Set(down.map(asset => asset.name));
    
    return STATE.data.assets.filter(asset => 
        !assigned.has(asset.name) && 
        !downNames.has(asset.name)
    );
}

function getAllAssignedAssets() {
    const assigned = new Set();
    
    // Route assignments
    Object.values(STATE.assignments).forEach(assignment => {
        if (assignment.asset) assigned.add(assignment.asset);
    });
    
    // Field trip assignments
    if (STATE.data?.fieldTrips) {
        STATE.data.fieldTrips.forEach(trip => {
            if (trip.asset) assigned.add(trip.asset);
            if (trip.trailer) assigned.add(trip.trailer);
        });
    }
    
    return assigned;
}

function getActiveAssetsCount() {
    if (!STATE.data?.assets) return 0;
    
    const totalAssets = STATE.data.assets.length;
    const downCount = FLEET_STATE.downAssets.size;
    
    return totalAssets - downCount;
}

function getAssetDownReason(assetName) {
    return STATE.assetDownReasons?.[assetName]?.reason || '';
}

function getAssetDownTimestamp(assetName) {
    return STATE.assetDownReasons?.[assetName]?.timestamp || null;
}

function getAssetDownCategory(assetName) {
    return STATE.assetDownReasons?.[assetName]?.category || 'Maintenance';
}

function getStatusClass(status) {
    const statusClasses = {
        'In Yard': 'bg-blue-500',
        'En Route': 'bg-yellow-500',
        'On Scene': 'bg-green-500',
        'Returning': 'bg-orange-500',
        'Out of Service': 'bg-red-500'
    };
    
    return statusClasses[status] || 'bg-gray-500';
}

function getStatusIcon(status) {
    const statusIcons = {
        'In Yard': '🏠',
        'En Route': '🚛',
        'On Scene': '🔧',
        'Returning': '↩️',
        'Out of Service': '❌'
    };
    
    return statusIcons[status] || '📍';
}

function formatTimestamp(date) {
    if (!date) return '';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function handleAssetDown(assetName, reason) {
    FLEET_STATE.downAssets.add(assetName);
    debounceRender('renderFleetService');
    debounceRender('renderDownList');
    debounceRender('renderSparesList');
}

function handleAssetRepaired(assetName) {
    FLEET_STATE.downAssets.delete(assetName);
    debounceRender('renderFleetService');
    debounceRender('renderDownList');
    debounceRender('renderSparesList');
}

function handleFleetEmergency() {
    updateFleetServiceStatus('Out of Service');
    
    eventBus.emit('ui:showToast', {
        message: '🚨 Fleet service emergency activated',
        type: 'error',
        duration: 0 // Persistent
    });
}

function generateFleetReport() {
    const reportData = {
        timestamp: new Date().toISOString(),
        serviceStatus: FLEET_STATE.serviceStatus,
        totalAssets: STATE.data?.assets?.length || 0,
        activeAssets: getActiveAssetsCount(),
        downAssets: Array.from(FLEET_STATE.downAssets),
        spareAssets: Array.from(FLEET_STATE.spareAssets),
        assignments: Object.keys(STATE.assignments).length,
        statusHistory: Object.fromEntries(FLEET_STATE.statusTimestamps)
    };
    
    eventBus.emit('reports:generate', {
        type: 'fleet',
        data: reportData
    });
}

function refreshFleetData() {
    console.log('🔄 Refreshing fleet data...');
    
    // Re-render all fleet components
    renderFleetService();
    renderDownList();
    renderSparesList();
    
    eventBus.emit('fleet:dataRefreshed', {
        timestamp: new Date()
    });
}

function updateFleetAssignments() {
    // Update active assignments tracking
    FLEET_STATE.activeAssignments.clear();
    
    Object.entries(STATE.assignments).forEach(([route, assignment]) => {
        FLEET_STATE.activeAssignments.set(route, assignment);
    });
}

function loadFleetState() {
    // Load fleet service status
    if (STATE.fleetServiceStatus) {
        FLEET_STATE.serviceStatus = STATE.fleetServiceStatus;
    }
    
    // Load status timestamps
    if (STATE.statusTimestamps) {
        FLEET_STATE.statusTimestamps = new Map(Object.entries(STATE.statusTimestamps));
    }
    
    // Load fleet configuration
    if (STATE.fleetConfig) {
        Object.assign(FLEET_CONFIG, STATE.fleetConfig);
    }
}

// =============================================================================
// GLOBAL FUNCTIONS
// =============================================================================

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.selectFleetServiceStatus = selectFleetServiceStatus;
    window.openFleetServiceModal = openFleetServiceModal;
    window.closeFleetServiceModal = closeFleetServiceModal;
    window.clearAssignment = clearAssignment;
    window.assignToFieldTrip = assignToFieldTrip;
    window.clearFieldTripAssignment = clearFieldTripAssignment;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Set up click handlers for fleet operations
document.addEventListener('click', (event) => {
    const target = event.target;
    
    // Handle assign spare button clicks
    if (target.classList.contains('assign-spare-btn')) {
        const assetName = target.dataset.assetName;
        eventBus.emit('assets:assignSpare', { assetName });
    }
});

// =============================================================================
// EXPORTS
// =============================================================================

export {
    initializeFleetManagement,
    renderFleetService,
    renderDownList,
    renderSparesList,
    selectFleetServiceStatus,
    updateFleetServiceStatus,
    openFleetServiceModal,
    closeFleetServiceModal,
    isStaffAssigned,
    isItemCurrentlyAssigned,
    clearAssignment,
    assignToFieldTrip,
    clearFieldTripAssignment,
    isItemCurrentlyAssignedToFieldTrip,
    getDownAssets,
    getSpareAssets,
    getAllAssignedAssets,
    handleFleetEmergency,
    generateFleetReport,
    refreshFleetData,
    FLEET_CONFIG,
    FLEET_STATE
};
