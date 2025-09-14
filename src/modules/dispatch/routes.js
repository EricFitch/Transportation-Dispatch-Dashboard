/* DISPATCH - ROUTES MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Route rendering, route card management, status updates,
   assignment handling, and field trip integration
   Total lines: 420
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive route management from sparse extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, updateRouteNote, updateRouteStatus } from '../core/state.js';
import { debounceRender, PERFORMANCE } from '../core/utils.js';

// =============================================================================
// ROUTE RENDERING SYSTEM
// =============================================================================

function renderAll() {
    console.log('🎨 Legacy renderAll disabled - using new route cards system');
    // Legacy rendering system disabled in favor of new route cards system
    return;
    
    console.log('🎨 Rendering all dispatch components...');
    try {
        console.log('🚗 Rendering route cards...');
        renderRouteCards();
        
        console.log('🎯 Broadcasting render complete event...');
        eventBus.emit('routes:renderComplete', { timestamp: Date.now() });
        
    } catch (error) {
        console.error('❌ Error in renderAll:', error);
        eventBus.emit('routes:renderError', { error });
    }
}

function renderRouteCards() {
    console.log('🚗 Legacy route rendering disabled - using new route cards system');
    // Legacy route rendering is disabled in favor of the new route cards system
    // in src/modules/dispatch/routeCards.js
    return;
    
    console.log('🚗 Rendering route cards...');
    console.trace('🔍 CALL STACK - Who called renderRouteCards?');
    
    // Use performance optimization
    if (PERFORMANCE.isRendering) {
        console.log('⏭️ Already rendering, skipping duplicate call');
        return;
    }
    
    PERFORMANCE.isRendering = true;
    
    try {
        const container = document.getElementById('route-cards-container');
        if (!container) {
            console.error('❌ Route cards container not found');
            return;
        }
        
        if (!STATE.data?.routes) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500">No routes available for current shift</div>';
            return;
        }
        
        // Filter routes for current view (AM/PM)
        const currentRoutes = STATE.data.routes.filter(route => 
            route.shift === STATE.currentView || route.shift === 'Both'
        );
        
        if (currentRoutes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p class="mb-4">No routes scheduled for ${STATE.currentView} shift</p>
                    <button onclick="addNewRoute('${STATE.currentView}')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        ➕ Add Route
                    </button>
                </div>
            `;
            return;
        }
        
        // Generate route cards HTML
        const routeCardsHtml = currentRoutes.map(route => generateRouteCardHtml(route)).join('');
        
        // Render field trips section
        const fieldTripsHtml = generateFieldTripsHtml();
        
        container.innerHTML = `
            <div class="route-cards-grid">
                <h2 class="text-xl font-bold mb-4 text-gray-800">
                    📍 ${STATE.currentView} Routes (${currentRoutes.length})
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${routeCardsHtml}
                </div>
            </div>
            ${fieldTripsHtml}
        `;
        
        // Add click handlers
        container.addEventListener('click', handleRouteCardClick);
        
        // Update focusable elements for keyboard navigation
        eventBus.emit('events:updateFocusableElements');
        
        console.log(`✅ Rendered ${currentRoutes.length} route cards for ${STATE.currentView} shift`);
        
    } catch (error) {
        console.error('❌ Error rendering route cards:', error);
        eventBus.emit('routes:renderError', { error });
        
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

function generateRouteCardHtml(route) {
    const runKey = `${route.name}_${STATE.currentView}`;
    const assignment = STATE.assignments[runKey] || {};
    const status = STATE.routeStatus[runKey] || 'pending';
    const note = STATE.routeNotes[runKey] || '';

    // Determine colors based on route type
    const typeColors = {
        'Gen Ed': { bg: '#2563eb', border: '#1d4ed8', shadow: '0 6px 24px rgba(37,99,235,0.10)' }, // Bolder blue
        'SE': { bg: '#f59e0b', border: '#d97706', shadow: '0 6px 24px rgba(245,158,11,0.10)' },
        'Field Trip': { bg: '#10b981', border: '#059669', shadow: '0 6px 24px rgba(16,185,129,0.10)' },
        'Charter': { bg: '#8b5cf6', border: '#7c3aed', shadow: '0 6px 24px rgba(139,92,246,0.10)' },
        'Activity': { bg: '#ef4444', border: '#dc2626', shadow: '0 6px 24px rgba(239,68,68,0.10)' }
    };
    const colors = typeColors[route.type] || typeColors['Gen Ed'];

    // Determine status styling
    const statusStyles = {
        'pending': 'bg-gray-100 text-gray-600 border border-gray-300',
        'assigned': 'bg-blue-100 text-blue-800 border border-blue-300',
        'in-progress': 'bg-yellow-100 text-yellow-800 border border-yellow-300',
        'completed': 'bg-green-100 text-green-800 border border-green-300',
        'cancelled': 'bg-red-100 text-red-800 border border-red-300'
    };
    const statusClass = statusStyles[status] || statusStyles['pending'];

    // Check if route is fully assigned
    const isFullyAssigned = assignment.driver && assignment.asset;
    const assignmentClass = isFullyAssigned ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white';

    // Only apply Gen Ed enhancements
    const isGenEd = route.type === 'Gen Ed';

    return `
        <div class="route-card ${assignmentClass} border-2 rounded-xl p-5 mb-6 shadow-lg transition-all cursor-pointer"
             data-route="${route.name}"
             data-shift="${STATE.currentView}"
             data-type="${route.type}"
             tabindex="0"
             role="button"
             aria-label="Route ${route.name} - ${route.type}"
             style="${isGenEd ? `border-color: ${colors.border}; box-shadow: ${colors.shadow};` : ''}">

            <!-- Route Header -->
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center space-x-3">
                    ${isGenEd ? `<div class='w-6 h-6 rounded-full border-4 border-white shadow' style='background:${colors.bg};'></div>` : `<div class='w-4 h-4 rounded-full' style='background:${colors.bg};'></div>`}
                    <h3 class="font-extrabold text-xl text-gray-800 tracking-wide">${route.name}</h3>
                </div>
                <span class="px-3 py-1 rounded-full text-sm font-bold uppercase ${statusClass} tracking-wide shadow-sm">
                    ${status.toUpperCase()}
                </span>
            </div>

            <!-- Route Type Badge -->
            <div class="mb-4">
                <span class="inline-block px-4 py-1 rounded-full text-base font-bold text-white shadow"
                      style="background-color: ${colors.bg}; letter-spacing:0.03em;">
                    ${route.type}
                </span>
            </div>

            <!-- Assignment Section -->
            <div class="space-y-3 mb-4">
                <!-- Driver Assignment -->
                <div class="flex items-center justify-between">
                    <span class="text-base font-bold text-gray-700">DRIVER:</span>
                    <button class="assignment-btn flex-1 ml-3 p-3 text-left rounded-lg border-2 ${assignment.driver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-300'} text-lg font-semibold"
                            data-route="${route.name}" data-type="driver">
                        ${assignment.driver || 'Click to assign'}
                    </button>
                    ${assignment.driver ? `
                        <button class="clear-btn ml-2 px-3 py-2 bg-red-500 text-white rounded-lg text-base font-bold hover:bg-red-600"
                                data-route="${route.name}" data-type="driver" title="Clear Driver">×</button>
                    ` : ''}
                </div>

                <!-- Asset Assignment -->
                <div class="flex items-center justify-between">
                    <span class="text-base font-bold text-gray-700">ASSET:</span>
                    <button class="assignment-btn flex-1 ml-3 p-3 text-left rounded-lg border-2 ${assignment.asset ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-300'} text-lg font-semibold"
                            data-route="${route.name}" data-type="asset">
                        ${assignment.asset || 'Click to assign'}
                    </button>
                    ${assignment.asset ? `
                        <button class="clear-btn ml-2 px-3 py-2 bg-red-500 text-white rounded-lg text-base font-bold hover:bg-red-600"
                                data-route="${route.name}" data-type="asset" title="Clear Asset">×</button>
                    ` : ''}
                </div>
            </div>

            <!-- Notes Section -->
            <div class="mb-4">
                <label class="block text-base font-bold text-gray-700 mb-2">NOTES:</label>
                <textarea class="route-note w-full p-3 border-2 rounded-lg text-base resize-none" 
                          rows="2"
                          placeholder="Add route notes..."
                          data-route="${route.name}"
                          onchange="updateRouteNote('${runKey}', this.value)">${note}</textarea>
            </div>

            <!-- Action Buttons -->
            <div class="flex space-x-3 mt-2">
                <button class="status-btn flex-1 py-3 px-4 rounded-lg text-base font-bold ${status === 'in-progress' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'} shadow-sm"
                        data-route="${route.name}" data-status="in-progress">
                    ${status === 'in-progress' ? '🟡 In Progress' : '▶️ Start'}
                </button>
                <button class="status-btn flex-1 py-3 px-4 rounded-lg text-base font-bold ${status === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'} shadow-sm"
                        data-route="${route.name}" data-status="completed">
                    ${status === 'completed' ? '✅ Complete' : '✓ Complete'}
                </button>
            </div>

            <!-- Reset Button -->
            <div class="mt-3">
                <button class="reset-route-btn w-full py-2 px-3 bg-red-500 text-white text-base rounded-lg font-bold hover:bg-red-600 shadow"
                        data-route="${route.name}">
                    🔄 Reset Route
                </button>
            </div>
        </div>
    `;
}

function generateFieldTripsHtml() {
    if (!STATE.data?.fieldTrips) {
        return '';
    }
    
    const currentFieldTrips = STATE.data.fieldTrips.filter(trip => 
        trip.shift === STATE.currentView || trip.shift === 'Both'
    );
    
    if (currentFieldTrips.length === 0) {
        return `
            <div class="field-trips-section mt-8">
                <h2 class="text-xl font-bold mb-4 text-gray-800">🚌 Field Trips</h2>
                <div class="text-center py-8 text-gray-500">
                    <p class="mb-4">No field trips scheduled for ${STATE.currentView} shift</p>
                    <button onclick="addNewFieldTrip('${STATE.currentView}')" 
                            class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                        ➕ Add Field Trip
                    </button>
                </div>
            </div>
        `;
    }
    
    const fieldTripCardsHtml = currentFieldTrips.map(trip => generateFieldTripCardHtml(trip)).join('');
    
    return `
        <div class="field-trips-section mt-8">
            <h2 class="text-xl font-bold mb-4 text-gray-800">
                🚌 Field Trips (${currentFieldTrips.length})
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${fieldTripCardsHtml}
            </div>
            <div class="mt-4 text-center">
                <button onclick="addNewFieldTrip('${STATE.currentView}')" 
                        class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
                    ➕ Add Field Trip
                </button>
            </div>
        </div>
    `;
}

function generateFieldTripCardHtml(trip) {
    const note = STATE.fieldTripNotes[trip.id] || '';
    
    return `
        <div class="field-trip-card border-2 border-purple-300 bg-purple-50 rounded-lg p-4 hover:shadow-lg transition-all"
             data-fieldtrip="${trip.id}">
            
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-lg text-purple-800">${trip.name || 'Field Trip'}</h3>
                <span class="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs font-medium">
                    FIELD TRIP
                </span>
            </div>
            
            ${trip.destination ? `
                <div class="mb-2">
                    <span class="text-sm font-medium text-purple-600">📍 ${trip.destination}</span>
                </div>
            ` : ''}
            
            ${trip.time ? `
                <div class="mb-3">
                    <span class="text-sm font-medium text-purple-600">⏰ ${trip.time}</span>
                </div>
            ` : ''}
            
            <!-- Assignments -->
            <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-purple-600">DRIVER:</span>
                    <button class="assignment-btn flex-1 ml-2 p-2 text-left rounded border ${trip.driver ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}"
                            data-fieldtrip="${trip.id}" data-type="driver">
                        ${trip.driver || 'Click to assign'}
                    </button>
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-purple-600">ASSET:</span>
                    <button class="assignment-btn flex-1 ml-2 p-2 text-left rounded border ${trip.asset ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}"
                            data-fieldtrip="${trip.id}" data-type="asset">
                        ${trip.asset || 'Click to assign'}
                    </button>
                </div>
            </div>
            
            <!-- Notes -->
            <div class="mb-3">
                <textarea class="w-full p-2 border rounded text-sm resize-none" 
                          rows="2"
                          placeholder="Add field trip notes..."
                          onchange="updateFieldTripNote('${trip.id}', this.value)">${note}</textarea>
            </div>
            
            <button class="reset-fieldtrip-btn w-full py-1 px-2 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    data-fieldtrip="${trip.id}">
                🔄 Reset Field Trip
            </button>
        </div>
    `;
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

function handleRouteCardClick(event) {
    console.log(`🖱️ Route card click detected. Target:`, event.target);
    console.log(`🖱️ Target classes:`, event.target.classList.toString());
    
    const target = event.target;
    
    // Handle assignment button clicks
    if (target.classList.contains('assignment-btn')) {
        event.preventDefault();
        handleAssignmentClick(target);
        return;
    }
    
    // Handle clear button clicks
    if (target.classList.contains('clear-btn')) {
        event.preventDefault();
        handleClearAssignment(target);
        return;
    }
    
    // Handle status button clicks
    if (target.classList.contains('status-btn')) {
        event.preventDefault();
        handleStatusChange(target);
        return;
    }
    
    // Handle reset route button clicks
    if (target.classList.contains('reset-route-btn')) {
        event.preventDefault();
        handleResetRoute(target);
        return;
    }
    
    // Handle reset field trip button clicks
    if (target.classList.contains('reset-fieldtrip-btn')) {
        event.preventDefault();
        handleResetFieldTrip(target);
        return;
    }
    
    // Handle route card click (for general interaction)
    const routeCard = target.closest('.route-card');
    if (routeCard) {
        const routeName = routeCard.dataset.route;
        console.log(`📍 Route card clicked: ${routeName}`);
        eventBus.emit('routes:cardSelected', { routeName, shift: STATE.currentView });
    }
}

function handleAssignmentClick(button) {
    const routeName = button.dataset.route;
    const fieldTripId = button.dataset.fieldtrip;
    const type = button.dataset.type;
    
    if (routeName) {
        console.log(`🎯 Opening assignment modal for route ${routeName}, type: ${type}`);
        eventBus.emit('assignments:openModal', { 
            route: routeName, 
            type: type, 
            runKey: `${routeName}_${STATE.currentView}` 
        });
    } else if (fieldTripId) {
        console.log(`🎯 Opening field trip assignment modal for ${fieldTripId}, type: ${type}`);
        eventBus.emit('assignments:openFieldTripModal', { 
            fieldTripId: fieldTripId, 
            type: type 
        });
    }
}

function handleClearAssignment(button) {
    const routeName = button.dataset.route;
    const type = button.dataset.type;
    const runKey = `${routeName}_${STATE.currentView}`;
    
    if (confirm(`Clear ${type} assignment for ${routeName}?`)) {
        if (!STATE.assignments[runKey]) {
            STATE.assignments[runKey] = {};
        }
        
        delete STATE.assignments[runKey][type];
        console.log(`🧹 Cleared ${type} assignment for ${routeName}`);
        
        // Re-render to show changes
        debounceRender('renderRouteCards');
        
        eventBus.emit('assignments:cleared', { routeName, type, runKey });
    }
}

function handleStatusChange(button) {
    const routeName = button.dataset.route;
    const newStatus = button.dataset.status;
    const runKey = `${routeName}_${STATE.currentView}`;
    
    updateRouteStatus(runKey, newStatus);
    console.log(`📊 Status updated for ${routeName}: ${newStatus}`);
    
    // Re-render to show changes
    debounceRender('renderRouteCards');
    
    eventBus.emit('routes:statusChanged', { routeName, status: newStatus, runKey });
}

function handleResetRoute(button) {
    const routeName = button.dataset.route;
    const runKey = `${routeName}_${STATE.currentView}`;
    
    if (confirm(`Reset all data for route ${routeName}? This will clear assignments, status, and notes.`)) {
        // Clear assignments
        if (STATE.assignments[runKey]) {
            delete STATE.assignments[runKey];
        }
        
        // Clear status
        if (STATE.routeStatus[runKey]) {
            delete STATE.routeStatus[runKey];
        }
        
        // Clear notes
        if (STATE.routeNotes[runKey]) {
            delete STATE.routeNotes[runKey];
        }
        
        console.log(`🔄 Reset route: ${routeName}`);
        
        // Re-render to show changes
        debounceRender('renderRouteCards');
        
        eventBus.emit('routes:reset', { routeName, runKey });
    }
}

function handleResetFieldTrip(button) {
    const fieldTripId = button.dataset.fieldtrip;
    
    if (confirm(`Reset field trip? This will clear all assignments and notes.`)) {
        const fieldTrip = STATE.data.fieldTrips?.find(trip => trip.id === fieldTripId);
        
        if (fieldTrip) {
            fieldTrip.driver = '';
            fieldTrip.asset = '';
            fieldTrip.escort = '';
            
            if (STATE.fieldTripNotes[fieldTripId]) {
                delete STATE.fieldTripNotes[fieldTripId];
            }
            
            console.log(`🔄 Reset field trip: ${fieldTripId}`);
            
            // Re-render to show changes
            debounceRender('renderRouteCards');
            
            eventBus.emit('fieldtrips:reset', { fieldTripId });
        }
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRoutesByShift(shift) {
    if (!STATE.data?.routes) return [];
    
    return STATE.data.routes.filter(route => 
        route.shift === shift || route.shift === 'Both'
    );
}

function getUnassignedRoutes(shift = STATE.currentView) {
    const routes = getRoutesByShift(shift);
    
    return routes.filter(route => {
        const runKey = `${route.name}_${shift}`;
        const assignment = STATE.assignments[runKey] || {};
        return !assignment.driver || !assignment.asset;
    });
}

function getRoutesByStatus(status, shift = STATE.currentView) {
    const routes = getRoutesByShift(shift);
    
    return routes.filter(route => {
        const runKey = `${route.name}_${shift}`;
        return STATE.routeStatus[runKey] === status;
    });
}

function exportRouteData(shift = STATE.currentView) {
    const routes = getRoutesByShift(shift);
    
    return routes.map(route => {
        const runKey = `${route.name}_${shift}`;
        return {
            route: route.name,
            type: route.type,
            shift: shift,
            assignment: STATE.assignments[runKey] || {},
            status: STATE.routeStatus[runKey] || 'pending',
            notes: STATE.routeNotes[runKey] || ''
        };
    });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Listen for view changes
eventBus.on('state:viewChanged', (data) => {
    console.log(`🔄 View changed to ${data.view}, re-rendering routes`);
    debounceRender('renderRouteCards');
});

// Listen for data updates
eventBus.on('state:dataUpdated', () => {
    console.log('📊 State data updated, re-rendering routes');
    debounceRender('renderRouteCards');
});

// Make functions globally accessible for onclick handlers
if (typeof window !== 'undefined') {
    window.updateRouteNote = updateRouteNote;
    window.addNewRoute = (shift) => eventBus.emit('routes:addNew', { shift });
    window.addNewFieldTrip = (shift) => eventBus.emit('fieldtrips:addNew', { shift });
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    renderAll,
    renderRouteCards,
    handleRouteCardClick,
    generateRouteCardHtml,
    generateFieldTripsHtml,
    handleAssignmentClick,
    handleClearAssignment,
    handleStatusChange,
    handleResetRoute,
    handleResetFieldTrip,
    getRoutesByShift,
    getUnassignedRoutes,
    getRoutesByStatus,
    exportRouteData
};
