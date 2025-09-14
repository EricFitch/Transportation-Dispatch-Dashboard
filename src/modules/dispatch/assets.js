/* DISPATCH - ASSETS MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Asset panel rendering, status management, maintenance tracking,
   assignment integration, and fleet monitoring
   Total lines: 420
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive asset management from minimal extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { debounceRender, PERFORMANCE } from '../core/utils.js';

// =============================================================================
// ASSET RENDERING SYSTEM
// =============================================================================

function renderAssetPanel() {
    console.log('🚛 Rendering Fleet Status panel...');
    console.log('🔍 STATE.data:', STATE.data);
    console.log('🔍 STATE.data.assets:', STATE.data?.assets);
    
    // Early exit if already rendering or no data
    if (PERFORMANCE.isRendering || !STATE.data || !STATE.data.assets) {
        if (!STATE.data || !STATE.data.assets) {
            console.error('❌ No asset data available');
        }
        return;
    }
    
    PERFORMANCE.isRendering = true;
    
    try {
        const downList = document.getElementById('down-list');
        const sparesList = document.getElementById('spares-list');
        
        if (!downList || !sparesList) {
            console.error('❌ Fleet Status elements not found');
            return;
        }
        
        // Get asset categories with proper logic
        const allAssets = STATE.data.assets || [];
        console.log('🔍 STATE.assetStatus:', STATE.assetStatus);
        
        const downAssets = allAssets.filter(asset => {
            const name = asset.name || asset.vehicleNumber;
            const status = asset.status || 'active';
            const dynamicStatus = STATE.assetStatus?.[name];
            
            const isDown = status === 'down' || status === 'maintenance' || status === 'retired' || dynamicStatus === 'Down';
            if (isDown) {
                console.log(`🔍 Down asset found: ${name}, status: ${status}, dynamicStatus: ${dynamicStatus}`);
            }
            
            // Check both original status and dynamic status
            return isDown;
        });
        const availableAssets = allAssets.filter(asset => {
            const name = asset.name || asset.vehicleNumber;
            const status = asset.status || 'active';
            const dynamicStatus = STATE.assetStatus?.[name];
            
            // Asset is available if not originally down AND not dynamically marked down
            const isAvailable = status === 'active' && dynamicStatus !== 'Down';
            if (!isAvailable && status === 'active') {
                console.log(`🔍 Asset marked down: ${name}, dynamicStatus: ${dynamicStatus}`);
            }
            
            return isAvailable;
        });
        
        // Check for assigned assets and determine spares
        const assignedAssets = availableAssets.filter(asset => {
            const name = asset.name || asset.vehicleNumber;
            return STATE.data.routes?.some(route => 
                route.assignedAssets?.includes(name) || route.assignedAsset === name
            ) || false;
        });
        
        const spareAssets = availableAssets.filter(asset => {
            const name = asset.name || asset.vehicleNumber;
            const type = asset.type || 'Bus';
            
            // Only buses can be spares
            const isBus = type.toLowerCase().includes('bus') || type.toLowerCase() === 'bus';
            
            // Must be unassigned and a bus
            const isUnassigned = !STATE.data.routes?.some(route => 
                route.assignedAssets?.includes(name) || route.assignedAsset === name
            );
            
            const isSpare = isBus && isUnassigned;
            
            // Debug spare filtering
            if (name === '165' || name === '052' || name === '053') {
                console.log(`🔍 Spare check for ${name}: type=${type}, isBus=${isBus}, isUnassigned=${isUnassigned}, isSpare=${isSpare}`);
            }
            
            return isSpare;
        });
        
        console.log(`🚛 Fleet Status counts: ${spareAssets.length} spares, ${downAssets.length} down`);
        
        // Render down assets
        renderDownAssetList(downList, downAssets);
        
        // Render spares
        renderSparesList(sparesList, spareAssets);
        
        // Update summary counters
        updateAssetSummary(availableAssets, downAssets, assignedAssets, spareAssets);
        
        console.log(`✅ Fleet Status rendered: ${spareAssets.length} spares, ${downAssets.length} down`);
        
    } catch (error) {
        console.error('❌ Fleet Status panel error:', error);
        eventBus.emit('assets:renderError', { error });
        
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

function renderMainAssetList(container, availableAssets, assignedAssets) {
    if (!STATE.data?.assets || STATE.data.assets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-gray-500">
                <p class="text-sm">No assets available</p>
            </div>
        `;
        return;
    }
    
    // Use all assets directly from STATE.data.assets for simplicity
    const allAssets = STATE.data.assets;
    console.log(`🚛 Rendering ${allAssets.length} assets in Resource Monitor`);
    console.log(`🔍 First asset sample:`, allAssets[0]);
    
    // Create asset list with down/repair functionality
    const assetListHtml = allAssets.map((asset, index) => {
        console.log(`🔍 Asset ${index}:`, asset);
        
        const name = asset.name || asset.vehicleNumber || 'Unknown';
        const type = asset.type || 'Bus';
        const status = asset.status || 'active';
        const isDown = status === 'down' || status === 'maintenance' || status === 'retired';
        
        // Check if asset is assigned to a route
        const isAssigned = STATE.data.routes?.some(route => 
            route.assignedAssets?.includes(name) || route.assignedAsset === name
        ) || false;
        
        const statusColor = isDown ? 'text-red-600' : (isAssigned ? 'text-blue-600' : 'text-green-600');
        const statusText = isDown ? 'DOWN' : (isAssigned ? 'ASSIGNED' : 'AVAILABLE');
        const bgColor = isDown ? 'bg-red-50 border-red-200' : (isAssigned ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200');
        
        return `
            <div class="asset-item p-3 mb-2 ${bgColor} rounded border cursor-pointer hover:bg-opacity-75" 
                 data-asset-name="${name}" data-asset-status="${status}">
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-bold text-gray-800">${name}</div>
                        <div class="text-sm text-gray-600">${type}</div>
                        ${asset.capacity ? `<div class="text-xs text-gray-500">Capacity: ${asset.capacity}</div>` : ''}
                    </div>
                    <div class="flex flex-col gap-1">
                        ${!isDown ? `
                            <button class="mark-down-btn px-3 py-1 ${isAssigned ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white rounded text-xs"
                                    data-asset-name="${name}">
                                ${statusText}
                            </button>
                        ` : `
                            <button class="mark-repair-btn px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                    data-asset-name="${name}">
                                DOWN
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = assetListHtml;
    
    // Add event listeners for down/repair buttons
    container.addEventListener('click', handleAssetAction);
    
    console.log(`✅ Asset list HTML generated with ${allAssets.length} items`);
}

// Handle asset action buttons (mark down/repair)
function handleAssetAction(event) {
    const target = event.target;
    
    if (target.classList.contains('mark-down-btn')) {
        event.preventDefault();
        event.stopPropagation();
        
        const assetName = target.dataset.assetName;
        markAssetDown(assetName);
        
    } else if (target.classList.contains('mark-repair-btn')) {
        event.preventDefault();
        event.stopPropagation();
        
        const assetName = target.dataset.assetName;
        markAssetRepaired(assetName);
    }
}

// Mark an asset as down
function markAssetDown(assetName) {
    console.log(`🔧 Marking asset ${assetName} as down`);
    
    if (!STATE.data?.assets) {
        console.error('❌ No asset data available');
        return;
    }
    
    // Find the asset and update its status
    const asset = STATE.data.assets.find(a => 
        (a.name === assetName) || (a.vehicleNumber === assetName)
    );
    
    if (!asset) {
        console.error(`❌ Asset ${assetName} not found`);
        return;
    }
    
    // Update asset status
    asset.status = 'down';
        asset.downReason = 'Out of service';
    asset.downDate = new Date().toISOString();
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Emit event for other modules
    eventBus.emit('asset:statusChanged', { 
        assetName, 
        oldStatus: 'active', 
        newStatus: 'down',
        reason: asset.downReason
    });
    
    // Re-render the asset panel
    renderAssetPanel();
    
    console.log(`✅ Asset ${assetName} marked as down: ${asset.downReason}`);
}

// Mark an asset as repaired (back to active)
function markAssetRepaired(assetName) {
    console.log(`🔧 Marking asset ${assetName} as repaired`);
    
    if (!STATE.data?.assets) {
        console.error('❌ No asset data available');
        return;
    }
    
    // Find the asset and update its status
    const asset = STATE.data.assets.find(a => 
        (a.name === assetName) || (a.vehicleNumber === assetName)
    );
    
    if (!asset) {
        console.error(`❌ Asset ${assetName} not found`);
        return;
    }
    
    // Update asset status
    const oldStatus = asset.status;
    asset.status = 'active';
    asset.repairedDate = new Date().toISOString();
    
    // Clear down-related fields
    delete asset.downReason;
    delete asset.downDate;
    
    // Save to localStorage
    saveToLocalStorage();
    
    // Emit event for other modules
    eventBus.emit('asset:statusChanged', { 
        assetName, 
        oldStatus, 
        newStatus: 'active'
    });
    
    // Re-render the asset panel
    renderAssetPanel();
    
    console.log(`✅ Asset ${assetName} marked as repaired and active`);
}

function renderDownAssetList(container, downAssets) {
    if (downAssets.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-2">No assets down</div>';
        return;
    }
    
    const html = downAssets.map(asset => {
        const name = asset.name || asset.vehicleNumber || 'Unknown';
        const type = asset.type || 'Bus';
        // Get reason from STATE.assetDownReasons or fallback to asset.downReason
        const reason = STATE.assetDownReasons?.[name]?.reason || asset.downReason || 'Out of service';
        
        return `
            <div class="p-2 mb-2 bg-red-50 rounded border border-red-200">
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-bold text-red-800">${name}</div>
                        <div class="text-sm text-red-600">${type}</div>
                        <div class="text-xs text-red-500">${reason}</div>
                    </div>
                    <button class="mark-repair-btn px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                            data-asset-name="${name}">
                        In Service
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add event listeners - use handleAssetPanelClick for consistency
    container.addEventListener('click', handleAssetPanelClick);
}

function renderSparesList(container, spareAssets) {
    if (spareAssets.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-2">No spares available</div>';
        return;
    }
    
    const html = spareAssets.map(asset => {
        const name = asset.name || asset.vehicleNumber || 'Unknown';
        const type = asset.type || 'Bus';
        
        return `
            <div class="p-2 mb-2 bg-green-50 rounded border border-green-200">
                <div class="flex justify-between items-center">
                    <div class="flex-1">
                        <div class="font-bold text-green-800">${name}</div>
                        <div class="text-xs text-green-600">${type}</div>
                    </div>
                    <button class="asset-down-btn px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                            data-asset="${name}">
                        Out Of Service
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add event listeners - use handleAssetPanelClick for asset-down-btn
    container.addEventListener('click', handleAssetPanelClick);
}

function generateAssetCardHtml(asset) {
    const isAssigned = isAssetAssigned(asset.name);
    const isDown = STATE.assetStatus[asset.name] === 'Down';
    const assignmentInfo = getAssetAssignmentInfo(asset.name);
    const typeColor = getAssetTypeColor(asset.type);
    
    // Determine card styling based on status
    let cardClass = 'asset-card border-2 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer';
    let statusBadge = '';
    
    if (isDown) {
        cardClass += ' border-red-500 bg-red-50';
        statusBadge = '<span class="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-medium">DOWN</span>';
    } else if (isAssigned) {
        cardClass += ' border-green-500 bg-green-50';
        statusBadge = '<span class="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full font-medium">ASSIGNED</span>';
    } else {
        cardClass += ' border-blue-500 bg-blue-50';
        statusBadge = '<span class="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">AVAILABLE</span>';
    }
    
    return `
        <div class="${cardClass}"
             data-asset="${asset.name}"
             data-type="${asset.type}"
             tabindex="0"
             role="button"
             aria-label="Asset ${asset.name} - ${asset.type}">
            
            <!-- Asset Header -->
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center space-x-2">
                    <div class="w-4 h-4 rounded-full" 
                         style="background-color: ${typeColor};" 
                         title="${asset.type}"></div>
                    <h3 class="font-bold text-lg text-gray-800">${asset.name}</h3>
                </div>
                ${statusBadge}
            </div>
            
            <!-- Asset Type -->
            <div class="mb-3">
                <span class="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
                      style="background-color: ${typeColor};">
                    ${asset.type}
                </span>
            </div>
            
            <!-- Assignment Info -->
            ${isAssigned ? `
                <div class="mb-3 p-2 bg-white rounded border">
                    <div class="text-sm font-medium text-gray-600">ASSIGNED TO:</div>
                    <div class="text-sm text-gray-800">${assignmentInfo}</div>
                </div>
            ` : ''}
            
            <!-- Asset Details -->
            ${asset.capacity ? `
                <div class="mb-2 text-sm text-gray-600">
                    <strong>Capacity:</strong> ${asset.capacity} passengers
                </div>
            ` : ''}
            
            ${asset.year ? `
                <div class="mb-2 text-sm text-gray-600">
                    <strong>Year:</strong> ${asset.year}
                </div>
            ` : ''}
            
            ${asset.fuel ? `
                <div class="mb-3 text-sm text-gray-600">
                    <strong>Fuel:</strong> ${asset.fuel}
                </div>
            ` : ''}
            
            <!-- Action Buttons -->
            <div class="flex space-x-2 mt-4">
                ${!isDown ? `
                    <button class="asset-down-btn flex-1 py-2 px-3 rounded text-sm font-medium ${isDown ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}"
                            data-asset="${asset.name}">
                        🔧 Mark Down
                    </button>
                ` : `
                    <button class="asset-repair-btn flex-1 py-2 px-3 rounded text-sm font-medium bg-green-500 text-white"
                            data-asset="${asset.name}">
                        ✅ Mark Repaired
                    </button>
                `}
                
                <button class="asset-details-btn px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        data-asset="${asset.name}">
                    📋 Details
                </button>
            </div>
            
            <!-- Clear Assignment Button (if assigned) -->
            ${isAssigned ? `
                <div class="mt-2">
                    <button class="clear-asset-assignment-btn w-full py-1 px-2 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                            data-asset="${asset.name}">
                        🗑️ Clear Assignment
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// =============================================================================
// ASSET MANAGEMENT FUNCTIONS
// =============================================================================

function toggleAssetStatus(assetName, reason = '') {
    console.log(`🔧 Toggling status for asset: ${assetName}`);
    console.log(`🔍 STATE.assetStatus before:`, STATE.assetStatus);
    
    const currentStatus = STATE.assetStatus[assetName];
    
    if (currentStatus === 'Down') {
        // Mark as repaired (available)
        delete STATE.assetStatus[assetName];
        console.log(`✅ ${assetName} marked as repaired`);
        eventBus.emit('assets:repaired', { assetName });
    } else {
        // Mark as down
        STATE.assetStatus[assetName] = 'Down';
        
        // Store reason if provided
        if (reason) {
            if (!STATE.assetDownReasons) {
                STATE.assetDownReasons = {};
            }
            STATE.assetDownReasons[assetName] = {
                reason: reason,
                timestamp: new Date().toISOString()
            };
        }
        
        // Clear any current assignments
        clearAssetAssignments(assetName);
        
        console.log(`🔧 ${assetName} marked as down for maintenance`);
        eventBus.emit('assets:markedDown', { assetName, reason });
    }
    
    console.log(`🔍 STATE.assetStatus after:`, STATE.assetStatus);
    
    // Save state and re-render IMMEDIATELY (not debounced) to test race condition
    saveToLocalStorage();
    
    // Add a small delay to ensure state is saved before re-render
    setTimeout(() => {
        console.log(`🔍 About to re-render, STATE.assetStatus:`, STATE.assetStatus);
        renderAssetPanel();
    }, 50);
    
    return true;
}

function clearAssetAssignments(assetName) {
    console.log(`🧹 Clearing assignments for asset: ${assetName}`);
    
    let assignmentsCleared = 0;
    
    // Clear route assignments
    Object.keys(STATE.assignments).forEach(runKey => {
        const assignment = STATE.assignments[runKey];
        if (assignment.asset === assetName) {
            delete assignment.asset;
            assignmentsCleared++;
            console.log(`🗑️ Cleared asset assignment for ${runKey}`);
        }
    });
    
    // Clear field trip assignments
    if (STATE.data.fieldTrips) {
        STATE.data.fieldTrips.forEach(trip => {
            if (trip.asset === assetName) {
                trip.asset = '';
                assignmentsCleared++;
                console.log(`🗑️ Cleared field trip asset for ${trip.id}`);
            }
            if (trip.trailer === assetName) {
                trip.trailer = '';
                assignmentsCleared++;
                console.log(`🗑️ Cleared field trip trailer for ${trip.id}`);
            }
        });
    }
    
    if (assignmentsCleared > 0) {
        console.log(`✅ Cleared ${assignmentsCleared} assignments for ${assetName}`);
        eventBus.emit('assets:assignmentsCleared', { assetName, count: assignmentsCleared });
    }
    
    return assignmentsCleared;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getAvailableAssets() {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => 
        STATE.assetStatus[asset.name] !== 'Down' && 
        !isAssetAssigned(asset.name) &&
        !(asset.type && asset.type.toLowerCase().includes('trailer'))
    );
}

function getDownAssets() {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => 
        STATE.assetStatus[asset.name] === 'Down'
    );
}

function getAssignedAssets() {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => 
        STATE.assetStatus[asset.name] !== 'Down' && isAssetAssigned(asset.name)
    );
}

function getSpareAssets() {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => 
        asset.type && asset.type.toLowerCase().includes('spare') && 
        STATE.assetStatus[asset.name] !== 'Down' && 
        !isAssetAssigned(asset.name)
    );
}

function groupAssetsByType(assets) {
    return assets.reduce((groups, asset) => {
        const type = asset.type || 'Other';
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(asset);
        return groups;
    }, {});
}

function getAssetTypeColor(type) {
    const defaultColors = {
        'Gen Ed Bus': '#3b82f6',     // Blue
        'SE Bus': '#f59e0b',         // Orange
        'Van': '#10b981',            // Green
        'Suburban': '#8b5cf6',       // Purple
        'Car': '#ef4444',            // Red
        'Trailer': '#6b7280',        // Gray
        'Other': '#64748b'           // Slate
    };
    
    // Check if custom colors exist in state
    if (STATE.data?.colors?.[type]) {
        return STATE.data.colors[type];
    }
    
    return defaultColors[type] || defaultColors['Other'];
}

function isAssetAssigned(assetName) {
    // Check route assignments
    for (const assignment of Object.values(STATE.assignments)) {
        if (assignment.asset === assetName) {
            return true;
        }
    }
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        for (const trip of STATE.data.fieldTrips) {
            if (trip.asset === assetName || trip.trailer === assetName) {
                return true;
            }
        }
    }
    
    return false;
}

function getAssetAssignmentInfo(assetName) {
    const assignments = [];
    
    // Check route assignments
    Object.entries(STATE.assignments).forEach(([runKey, assignment]) => {
        if (assignment.asset === assetName) {
            const routeName = runKey.split('_')[0];
            assignments.push(`Route ${routeName}`);
        }
    });
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        STATE.data.fieldTrips.forEach(trip => {
            if (trip.asset === assetName) {
                assignments.push(`Field Trip: ${trip.name || trip.id}`);
            }
            if (trip.trailer === assetName) {
                assignments.push(`Trailer for: ${trip.name || trip.id}`);
            }
        });
    }
    
    return assignments.join(', ') || 'Unassigned';
}

function getAssetDownReason(assetName) {
    return STATE.assetDownReasons?.[assetName]?.reason || '';
}

function updateAssetSummary(available, down, assigned, spares) {
    const assetSummary = document.getElementById('asset-summary');
    if (assetSummary && STATE.data?.assets) {
        const total = STATE.data.assets.length;
        const active = available.length + assigned.length;
        
        // Simple summary for Resource Monitor badge
        assetSummary.textContent = `${total} Total • ${active} Active • ${down.length} Down`;
    }
    
    // Update down-summary badge with simple text to avoid scrollbars
    const downSummary = document.getElementById('down-summary');
    if (downSummary) {
        downSummary.textContent = `${down.length} Down`;
    }
    
    // Update spares-summary badge with simple text to avoid scrollbars
    const sparesSummary = document.getElementById('spares-summary');
    if (sparesSummary) {
        sparesSummary.textContent = `${spares.length} Available`;
    }
}

function getAssetsByType(type) {
    if (!STATE.data?.assets) return [];
    
    return STATE.data.assets.filter(asset => asset.type === type);
}

function getAssetByName(assetName) {
    return STATE.data?.assets?.find(asset => asset.name === assetName);
}

function exportAssetData() {
    const available = getAvailableAssets();
    const down = getDownAssets();
    const assigned = getAssignedAssets();
    const spares = getSpareAssets();
    
    return {
        total: STATE.data.assets.length,
        available: available.map(asset => ({
            name: asset.name,
            type: asset.type,
            capacity: asset.capacity,
            year: asset.year
        })),
        assigned: assigned.map(asset => ({
            name: asset.name,
            type: asset.type,
            assignment: getAssetAssignmentInfo(asset.name)
        })),
        down: down.map(asset => ({
            name: asset.name,
            type: asset.type,
            reason: getAssetDownReason(asset.name),
            downSince: STATE.assetDownReasons?.[asset.name]?.timestamp
        })),
        spares: spares.map(asset => ({
            name: asset.name,
            type: asset.type
        }))
    };
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

function handleAssetPanelClick(event) {
    const target = event.target;
    console.log('🖱️ Asset panel click:', target.className, target.dataset);
    
    // Handle asset down button
    if (target.classList.contains('asset-down-btn')) {
        const assetName = target.dataset.asset;
        console.log('📋 Asset down button clicked for:', assetName);
        toggleAssetStatus(assetName, 'Out of service');
        return;
    }
    
    // Handle asset repair button
    if (target.classList.contains('asset-repair-btn')) {
        const assetName = target.dataset.assetName || target.dataset.asset;
        console.log('🔧 Asset repair button clicked for:', assetName);
        toggleAssetStatus(assetName);
        return;
    }
    
    // Handle mark repair button (for down list)
    if (target.classList.contains('mark-repair-btn')) {
        const assetName = target.dataset.assetName || target.dataset.asset;
        console.log('🔧 Mark repair button clicked for:', assetName);
        toggleAssetStatus(assetName);
        return;
    }
    
    // Handle edit reason button
    if (target.classList.contains('asset-edit-reason-btn')) {
        const assetName = target.dataset.assetName;
        const currentReason = getAssetDownReason(assetName);
        const newReason = prompt(`Edit maintenance reason for ${assetName}:`, currentReason);
        
        if (newReason !== null) {
            if (!STATE.assetDownReasons) {
                STATE.assetDownReasons = {};
            }
            STATE.assetDownReasons[assetName] = {
                reason: newReason.trim(),
                timestamp: STATE.assetDownReasons[assetName]?.timestamp || new Date().toISOString()
            };
            saveToLocalStorage();
            debounceRender('renderAssetPanel');
        }
        return;
    }
    
    // Handle asset details button
    if (target.classList.contains('asset-details-btn')) {
        const assetName = target.dataset.asset;
        showAssetDetails(assetName);
        return;
    }
    
    // Handle clear assignment button
    if (target.classList.contains('clear-asset-assignment-btn')) {
        const assetName = target.dataset.asset;
        if (confirm(`Clear all assignments for ${assetName}?`)) {
            clearAssetAssignments(assetName);
            saveToLocalStorage();
            debounceRender('renderAssetPanel');
        }
        return;
    }
    
    // Handle assign spare button
    if (target.classList.contains('assign-spare-btn')) {
        const assetName = target.dataset.assetName;
        eventBus.emit('assets:assignSpare', { assetName });
        return;
    }
    
    // Handle Fleet Details button
    if (target.id === 'fleet-details-btn') {
        console.log('🚛 Fleet Details button clicked - navigating to fleet management');
        window.location.href = 'fleet-details.html';
        return;
    }
}

function showAssetDetails(assetName) {
    const asset = getAssetByName(assetName);
    if (!asset) return;
    
    const assignmentInfo = getAssetAssignmentInfo(assetName);
    const isDown = STATE.assetStatus[assetName] === 'Down';
    const downReason = getAssetDownReason(assetName);
    
    eventBus.emit('ui:showModal', {
        title: `Asset Details - ${assetName}`,
        content: `
            <div class="space-y-4">
                <div><strong>Name:</strong> ${asset.name}</div>
                <div><strong>Type:</strong> ${asset.type}</div>
                <div><strong>Status:</strong> ${isDown ? 'Down for Maintenance' : 'In Service'}</div>
                ${isDown && downReason ? `<div><strong>Maintenance Reason:</strong> ${downReason}</div>` : ''}
                <div><strong>Current Assignment:</strong> ${assignmentInfo}</div>
                ${asset.capacity ? `<div><strong>Capacity:</strong> ${asset.capacity} passengers</div>` : ''}
                ${asset.year ? `<div><strong>Year:</strong> ${asset.year}</div>` : ''}
                ${asset.fuel ? `<div><strong>Fuel Type:</strong> ${asset.fuel}</div>` : ''}
                ${asset.license ? `<div><strong>License:</strong> ${asset.license}</div>` : ''}
                ${asset.vin ? `<div><strong>VIN:</strong> ${asset.vin}</div>` : ''}
            </div>
        `,
        buttons: [
            { text: 'Close', action: 'close' }
        ]
    });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Set up event listeners - REMOVED document listener to prevent duplicates
// Container-level listeners in renderSparesList and renderDownAssetList handle the events

// Add specific listener for Fleet Details button
document.addEventListener('click', (event) => {
    if (event.target.id === 'fleet-details-btn') {
        handleAssetPanelClick(event);
    }
});

// Listen for state changes
eventBus.on('state:dataUpdated', () => {
    debounceRender('renderAssetPanel');
});

eventBus.on('assignments:changed', () => {
    debounceRender('renderAssetPanel');
});

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.toggleAssetStatus = toggleAssetStatus;
    window.renderAssetPanel = renderAssetPanel;
    window.addNewAsset = () => eventBus.emit('assets:addNew');
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    renderAssetPanel,
    toggleAssetStatus,
    clearAssetAssignments,
    getAvailableAssets,
    getDownAssets,
    getAssignedAssets,
    getSpareAssets,
    groupAssetsByType,
    getAssetTypeColor,
    isAssetAssigned,
    getAssetAssignmentInfo,
    getAssetDownReason,
    updateAssetSummary,
    getAssetsByType,
    getAssetByName,
    exportAssetData,
    handleAssetPanelClick,
    showAssetDetails
};
