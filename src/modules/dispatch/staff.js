/* DISPATCH - STAFF MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Staff panel rendering, availability management, role-based organization,
   assignment tracking, and driver status control
   Total lines: 380
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive staff management from sparse extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { debounceRender, PERFORMANCE } from '../core/utils.js';

// =============================================================================
// STAFF RENDERING SYSTEM
// =============================================================================

// Helper function to format staff names as "First Initial Last Name"
function formatStaffDisplayName(staff) {
    // Handle different name formats
    if (staff.firstName && staff.lastName) {
        // Use firstName and lastName if available
        const firstInitial = staff.firstName.charAt(0).toUpperCase();
        return `${firstInitial}. ${staff.lastName}`;
    } else if (staff.name && staff.name.includes(' ')) {
        // Parse from full name if firstName/lastName not available
        const nameParts = staff.name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        const firstInitial = firstName.charAt(0).toUpperCase();
        return `${firstInitial}. ${lastName}`;
    } else {
        // Fallback to full name if can't parse
        return staff.name || staff.firstName || staff.lastName || 'Unknown';
    }
}

function renderStaffPanel() {
    console.log('👥 Rendering staff panel...');
    
    // Early exit if already rendering or no data
    if (PERFORMANCE.isRendering || !STATE.data || !STATE.data.staff) {
        if (!STATE.data || !STATE.data.staff) {
            console.error('❌ No staff data available');
        }
        return;
    }
    
    PERFORMANCE.isRendering = true;
    
    try {
        const outList = document.getElementById('staff-out-list');
        const availableList = document.getElementById('staff-available-list');
        
        if (!outList || !availableList) {
            console.error('❌ Staff panel elements not found');
            return;
        }
        
        // Use document fragments to minimize DOM reflows
        const outFragment = document.createDocumentFragment();
        const availableFragment = document.createDocumentFragment();
        
        // Get available staff (not in staffOut list AND not assigned to any routes)
        const availableStaff = STATE.data.staff.filter(staff => {
            // Exclude if staff is out of service
            const isOut = STATE.staffOut.some(outStaff => outStaff.name === staff.name);
            if (isOut) return false;
            
            // Exclude if staff is assigned to any route
            const isAssigned = isStaffAssigned(staff.name);
            return !isAssigned;
        });
        
        // Render staff out list
        renderStaffOutList(outFragment);
        
        // Render available staff list
        renderAvailableStaffList(availableFragment, availableStaff);
        
        // Update DOM in batches
        outList.innerHTML = '';
        availableList.innerHTML = '';
        outList.appendChild(outFragment);
        availableList.appendChild(availableFragment);
        
        // Update summary counters
        updateStaffSummary(availableStaff);
        
        console.log(`✅ Staff panel rendered: ${availableStaff.length} available, ${STATE.staffOut.length} out`);
        
    } catch (error) {
        console.error('❌ Staff panel error:', error);
        eventBus.emit('staff:renderError', { error });
        
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

function renderStaffOutList(fragment) {
    if (STATE.staffOut.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-gray-500 text-center py-4';
        emptyDiv.textContent = 'No staff currently out of service';
        fragment.appendChild(emptyDiv);
        return;
    }
    
    STATE.staffOut.forEach(staffOut => {
        const staffData = STATE.data.staff.find(s => s.name === staffOut.name) || { name: staffOut.name, role: 'Driver' };
        const staffElement = createStaffOutElement(staffData);
        fragment.appendChild(staffElement);
    });
}

function renderAvailableStaffList(fragment, availableStaff) {
    if (availableStaff.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-gray-500 text-center py-4';
        emptyDiv.textContent = 'No available staff';
        fragment.appendChild(emptyDiv);
        return;
    }
    
    // Group staff by role for better organization
    const staffByRole = groupStaffByRole(availableStaff);
    
    // Render each role group
    Object.entries(staffByRole).forEach(([role, staffList]) => {
        if (staffList.length > 0) {
            // Add role header
            const roleHeader = document.createElement('div');
            roleHeader.className = 'role-header font-semibold text-sm text-gray-700 mb-2 mt-4 first:mt-0';
            roleHeader.textContent = `${role} (${staffList.length})`;
            fragment.appendChild(roleHeader);
            
            // Add staff in this role
            staffList.forEach(staff => {
                const staffElement = createAvailableStaffElement(staff);
                fragment.appendChild(staffElement);
            });
        }
    });
}

function createStaffOutElement(staff) {
    const div = document.createElement('div');
    div.className = 'p-2 mb-2 bg-red-50 rounded border border-red-200';
    
    const displayName = formatStaffDisplayName(staff);
    
    div.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex-1">
                <div class="font-bold text-red-800">${displayName}</div>
                <div class="text-sm text-red-600">${staff.role}</div>
                ${staff.reason ? `<div class="text-xs text-red-500">${staff.reason}</div>` : ''}
            </div>
            <button class="staff-back-btn px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                    data-staff-name="${staff.name}">
                In Service
            </button>
        </div>
    `;
    
    return div;
}

function createAvailableStaffElement(staff) {
    const div = document.createElement('div');
    div.className = 'p-2 mb-2 bg-green-50 rounded border border-green-200';
    
    // Get role color and formatted display name
    const displayName = formatStaffDisplayName(staff);
    
    div.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex-1">
                <div class="font-bold text-green-800">${displayName}</div>
                <div class="text-xs text-green-600">${staff.role}</div>
            </div>
            <button class="staff-out-btn px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                    data-staff-name="${staff.name}">
                Out Of Service
            </button>
        </div>
    `;
    
    return div;
}

// =============================================================================
// STAFF MANAGEMENT FUNCTIONS
// =============================================================================

function markStaffOut(staffName, reason = '') {
    console.log(`🔴 Marking ${staffName} as out of service`);
    
    // Check if staff exists in data
    const staffMember = STATE.data.staff.find(s => s.name === staffName);
    if (!staffMember) {
        console.error(`❌ Staff member ${staffName} not found`);
        return false;
    }
    
    // Check if already out
    if (STATE.staffOut.some(s => s.name === staffName)) {
        console.warn(`⚠️ ${staffName} is already marked as out`);
        return false;
    }
    
    // Add to out list
    STATE.staffOut.push({ 
        name: staffName, 
        reason: reason,
        timestamp: new Date().toISOString()
    });
    
    // Clear any current assignments
    clearStaffAssignments(staffName);
    
    // Save state and re-render
    saveToLocalStorage();
    debounceRender('renderStaffPanel');
    
    // Broadcast event
    eventBus.emit('staff:markedOut', { staffName, reason });
    
    console.log(`✅ ${staffName} marked as out of service`);
    return true;
}

function markStaffAvailable(staffName) {
    console.log(`🟢 Marking ${staffName} as available`);
    
    // Remove from out list
    const originalLength = STATE.staffOut.length;
    STATE.staffOut = STATE.staffOut.filter(s => s.name !== staffName);
    
    if (STATE.staffOut.length === originalLength) {
        console.warn(`⚠️ ${staffName} was not in the out list`);
        return false;
    }
    
    // Save state and re-render
    saveToLocalStorage();
    debounceRender('renderStaffPanel');
    
    // Broadcast event
    eventBus.emit('staff:markedAvailable', { staffName });
    
    console.log(`✅ ${staffName} marked as available`);
    return true;
}

function clearStaffAssignments(staffName) {
    console.log(`🧹 Clearing assignments for ${staffName}`);
    
    let assignmentsCleared = 0;
    
    // Clear route assignments
    Object.keys(STATE.assignments).forEach(runKey => {
        const assignment = STATE.assignments[runKey];
        if (assignment.driver === staffName) {
            delete assignment.driver;
            assignmentsCleared++;
            console.log(`🗑️ Cleared driver assignment for ${runKey}`);
        }
        
        // Clear escort assignments
        if (assignment.escorts && assignment.escorts.includes(staffName)) {
            assignment.escorts = assignment.escorts.filter(name => name !== staffName);
            assignmentsCleared++;
            console.log(`🗑️ Cleared escort assignment for ${runKey}`);
        }
    });
    
    // Clear field trip assignments
    if (STATE.data.fieldTrips) {
        STATE.data.fieldTrips.forEach(trip => {
            if (trip.driver === staffName) {
                trip.driver = '';
                assignmentsCleared++;
                console.log(`🗑️ Cleared field trip driver for ${trip.id}`);
            }
            if (trip.escort === staffName) {
                trip.escort = '';
                assignmentsCleared++;
                console.log(`🗑️ Cleared field trip escort for ${trip.id}`);
            }
        });
    }
    
    if (assignmentsCleared > 0) {
        console.log(`✅ Cleared ${assignmentsCleared} assignments for ${staffName}`);
        eventBus.emit('staff:assignmentsCleared', { staffName, count: assignmentsCleared });
    }
    
    return assignmentsCleared;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function groupStaffByRole(staff) {
    return staff.reduce((groups, member) => {
        const role = member.role || 'Driver';
        if (!groups[role]) {
            groups[role] = [];
        }
        groups[role].push(member);
        return groups;
    }, {});
}

function getRoleColor(role) {
    const defaultColors = {
        'Driver': '#3b82f6',           // Blue
        'Supervisor': '#10b981',       // Green
        'Mechanic': '#f59e0b',         // Orange
        'Monitor': '#8b5cf6',          // Purple
        'Substitute': '#6b7280',       // Gray
        'Trainer': '#ef4444'           // Red
    };
    
    // Check if custom role colors exist in state
    if (STATE.data?.colors?.roles?.[role]) {
        return STATE.data.colors.roles[role];
    }
    
    return defaultColors[role] || defaultColors['Driver'];
}

/**
 * Set a color for a role and persist it to STATE. Emits 'colors:changed'.
 * @param {string} role
 * @param {string} color
 */
function setRoleColor(role, color) {
    if (!role) return;
    if (!STATE.data) STATE.data = {};
    if (!STATE.data.colors) STATE.data.colors = {};
    if (!STATE.data.colors.roles) STATE.data.colors.roles = {};

    STATE.data.colors.roles[role] = color;
    try {
        saveToLocalStorage();
    } catch (e) {
        console.warn('Could not save role color to localStorage', e);
    }

    // Notify other parts of the UI
    try {
        eventBus.emit('colors:changed', { role, color });
    } catch (e) {
        console.warn('Could not emit colors:changed', e);
    }

    return color;
}

function isStaffAssigned(staffName) {
    // Check route assignments
    for (const assignment of Object.values(STATE.assignments)) {
        if (assignment.driver === staffName || 
            (assignment.escorts && assignment.escorts.includes(staffName))) {
            return true;
        }
    }
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        for (const trip of STATE.data.fieldTrips) {
            if (trip.driver === staffName || trip.escort === staffName) {
                return true;
            }
        }
    }
    
    return false;
}

function getStaffAssignmentInfo(staffName) {
    const assignments = [];
    
    // Check route assignments
    Object.entries(STATE.assignments).forEach(([runKey, assignment]) => {
        if (assignment.driver === staffName) {
            const routeName = runKey.split('_')[0];
            assignments.push(`Driver on ${routeName}`);
        }
        if (assignment.escorts && assignment.escorts.includes(staffName)) {
            const routeName = runKey.split('_')[0];
            assignments.push(`Escort on ${routeName}`);
        }
    });
    
    // Check field trip assignments
    if (STATE.data?.fieldTrips) {
        STATE.data.fieldTrips.forEach(trip => {
            if (trip.driver === staffName) {
                assignments.push(`Driver for ${trip.name || 'Field Trip'}`);
            }
            if (trip.escort === staffName) {
                assignments.push(`Escort for ${trip.name || 'Field Trip'}`);
            }
        });
    }
    
    return assignments.join(', ') || 'Available';
}

// Returns a human-friendly status label for staff badges (used in staff cards)
function getStaffStatusBadgeLabel(status) {
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'active':
        case 'available':
            return 'Available';
        case 'on leave':
        case 'on_leave':
            return 'On Leave';
        case 'inactive':
            return 'Inactive';
        case 'training':
            return 'Training';
        default:
            return status || 'Status';
    }
}

// Build the current-assignment block HTML for a staff card (mirrors fleet behavior)
function getStaffCurrentAssignmentBlock(staffName) {
    const assignmentText = getStaffAssignmentInfo(staffName);
    if (!assignmentText || assignmentText === 'Available') {
        return `
            <div class="mt-3 p-2 bg-green-50 rounded border-l-4 border-green-400">
                <div class="text-xs font-medium text-green-800">Available for Assignment</div>
            </div>
        `;
    }

    return `
        <div class="mt-3 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
            <div class="text-xs font-medium text-blue-800">Currently Assigned</div>
            <div class="text-sm text-blue-700">${assignmentText}</div>
        </div>
    `;
}

function updateStaffSummary(availableStaff) {
    // Update staff summary counters with simple text that fits the badge
    const staffOutSummary = document.getElementById('staff-out-summary');
    const staffAvailableSummary = document.getElementById('staff-available-summary');
    
    if (STATE.data && STATE.data.staff) {
        const totalStaff = STATE.data.staff.length;
        const outCount = STATE.staffOut.length;
        const availableUnassignedCount = availableStaff.length; // These are truly available (not out, not assigned)
        
        // Calculate assigned staff (not out of service, but assigned to routes)
        const assignedStaff = STATE.data.staff.filter(staff => {
            const isOut = STATE.staffOut.some(outStaff => outStaff.name === staff.name);
            if (isOut) return false;
            return isStaffAssigned(staff.name);
        });
        const assignedCount = assignedStaff.length;
        
        // Individual section badges
        if (staffOutSummary) {
            staffOutSummary.textContent = `${outCount}`;
        }
        
        if (staffAvailableSummary) {
            staffAvailableSummary.textContent = `${availableUnassignedCount} unassigned`;
        }
        
        console.log(`📊 Staff Summary: ${totalStaff} total, ${availableUnassignedCount} available, ${assignedCount} assigned, ${outCount} out`);
    }
}

function getAvailableStaffByRole(role) {
    if (!STATE.data?.staff) return [];
    
    return STATE.data.staff.filter(staff => {
        if (staff.role !== role) return false;
        
        // Exclude if staff is out of service
        const isOut = STATE.staffOut.some(outStaff => outStaff.name === staff.name);
        if (isOut) return false;
        
        // Exclude if staff is assigned to any route
        const isAssigned = isStaffAssigned(staff.name);
        return !isAssigned;
    });
}

function getStaffByName(staffName) {
    return STATE.data?.staff?.find(staff => staff.name === staffName);
}

function exportStaffData() {
    const availableStaff = STATE.data.staff.filter(staff => {
        // Exclude if staff is out of service
        const isOut = STATE.staffOut.some(outStaff => outStaff.name === staff.name);
        if (isOut) return false;
        
        // Exclude if staff is assigned to any route
        const isAssigned = isStaffAssigned(staff.name);
        return !isAssigned;
    });
    
    return {
        total: STATE.data.staff.length,
        available: availableStaff.map(staff => ({
            name: staff.name,
            role: staff.role,
            assigned: isStaffAssigned(staff.name),
            assignments: getStaffAssignmentInfo(staff.name)
        })),
        outOfService: STATE.staffOut.map(staff => ({
            ...staff,
            duration: Date.now() - new Date(staff.timestamp).getTime()
        }))
    };
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

function handleStaffPanelClick(event) {
    const target = event.target;
    
    // Handle staff out button
    if (target.classList.contains('staff-out-btn')) {
        const staffName = target.dataset.staffName;
        markStaffOut(staffName, ''); // No reason required
        return;
    }
    
    // Handle staff back button
    if (target.classList.contains('staff-back-btn')) {
        const staffName = target.dataset.staffName;
        markStaffAvailable(staffName);
        return;
    }
    
    // Handle edit out reason button
    if (target.classList.contains('staff-edit-out-btn')) {
        const staffName = target.dataset.staffName;
        const currentStaffOut = STATE.staffOut.find(s => s.name === staffName);
        const currentReason = currentStaffOut?.reason || '';
        const newReason = prompt(`Edit reason for ${staffName}:`, currentReason);
        
        if (newReason !== null && currentStaffOut) {
            currentStaffOut.reason = newReason.trim();
            saveToLocalStorage();
            debounceRender('renderStaffPanel');
        }
        return;
    }
    
    // Handle staff details button
    if (target.classList.contains('staff-details-btn')) {
        const staffName = target.dataset.staffName;
        showStaffDetails(staffName);
        return;
    }
}

function showStaffDetails(staffName) {
    const staff = getStaffByName(staffName);
    if (!staff) return;
    
    const assignmentInfo = getStaffAssignmentInfo(staffName);
    const isOut = STATE.staffOut.some(s => s.name === staffName);
    
    eventBus.emit('ui:showModal', {
        title: `Staff Details - ${staffName}`,
        content: `
            <div class="space-y-4">
                <div><strong>Name:</strong> ${staff.name}</div>
                <div><strong>Role:</strong> ${staff.role}</div>
                <div><strong>Status:</strong> ${isOut ? 'Out of Service' : 'Available'}</div>
                <div><strong>Current Assignment:</strong> ${assignmentInfo}</div>
                ${staff.certifications ? `<div><strong>Certifications:</strong> ${staff.certifications.join(', ')}</div>` : ''}
                ${staff.phone ? `<div><strong>Phone:</strong> ${staff.phone}</div>` : ''}
                ${staff.email ? `<div><strong>Email:</strong> ${staff.email}</div>` : ''}
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

// Set up event listeners
document.addEventListener('click', (event) => {
    if (event.target.closest('#staff-out-list') || event.target.closest('#staff-available-list')) {
        handleStaffPanelClick(event);
    }
});

// Listen for state changes
eventBus.on('state:dataUpdated', () => {
    debounceRender('renderStaffPanel');
});

eventBus.on('assignments:changed', () => {
    debounceRender('renderStaffPanel');
});

function addSampleStaffForTesting() {
    // Sample staff members based on your CSV format
    const sampleStaff = [
        { employeeId: '011425742', firstName: 'Lacey', lastName: 'Zaruba', position: 'Driver', department: 'Transportation', status: 'Active' },
        { employeeId: '015318888', firstName: 'Carlton', lastName: 'Robertson', position: 'Driver', department: 'Transportation', status: 'Active' },
        { employeeId: '14311', firstName: 'John', lastName: 'Davis', position: 'Dispatcher', department: 'Dispatch', status: 'Active' },
        { employeeId: '15297', firstName: 'Annissa', lastName: 'McCoy', position: 'Driver', department: 'Transportation', status: 'On Leave' }
    ];
    
    console.log('🧪 Adding sample staff for testing name formatting...');
    
    sampleStaff.forEach(staff => {
        try {
            addNewStaffMember(staff);
            console.log(`✅ Added sample staff: ${formatStaffDisplayName(staff)}`);
        } catch (error) {
            console.error('❌ Error adding sample staff:', error);
        }
    });
    
    console.log('🧪 Sample staff added successfully');
}

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.markStaffOut = markStaffOut;
    window.markStaffAvailable = markStaffAvailable;
    window.renderStaffPanel = renderStaffPanel;
    window.formatStaffDisplayName = formatStaffDisplayName;
    window.refreshStaffListModal = refreshStaffListModal;
    window.addNewStaffMember = addNewStaffMember;
    window.removeStaffMember = removeStaffMember;
    window.editStaffMember = editStaffMember;
    window.exportStaffListAsCSV = exportStaffListAsCSV;
    window.handleStaffCSVImport = handleStaffCSVImport;
    window.addSampleStaffForTesting = addSampleStaffForTesting;
    // Render function for separate staff details page
    if (typeof renderStaffDetailsPage === 'function') {
        window.renderStaffDetailsPage = renderStaffDetailsPage;
    }

    // Expose role color setter for settings UI
    window.setRoleColor = setRoleColor;
    window.getRoleColor = getRoleColor;

    // Modal edit helpers for staff-details page (only if UI doesn't provide add form)
    window.showStaffEditModal = function(staffId) {
        const staff = STATE.data.staff.find(s => s.id === staffId || s.name === staffId);
        if (!staff) return;
        const modal = document.getElementById('staff-modal');
        if (!modal) return;
        const title = modal.querySelector('#modal-title');
        const content = modal.querySelector('#modal-content');
        title.textContent = `Edit Staff - ${staff.name}`;
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-sm">First Name</label>
                    <input id="edit-staff-first-name" class="w-full p-2 border rounded" value="${staff.firstName || ''}" />
                </div>
                <div>
                    <label class="text-sm">Last Name</label>
                    <input id="edit-staff-last-name" class="w-full p-2 border rounded" value="${staff.lastName || ''}" />
                </div>
                <div>
                    <label class="text-sm">Role</label>
                    <input id="edit-staff-role" class="w-full p-2 border rounded" value="${staff.position || staff.role || ''}" />
                </div>
                <div>
                    <label class="text-sm">Employee ID</label>
                    <input id="edit-staff-employee-id" class="w-full p-2 border rounded" value="${staff.employeeId || ''}" />
                </div>
                <div>
                    <label class="text-sm">Phone</label>
                    <input id="edit-staff-phone" class="w-full p-2 border rounded" value="${staff.phone || ''}" />
                </div>
                <div>
                    <label class="text-sm">Email</label>
                    <input id="edit-staff-email" class="w-full p-2 border rounded" value="${staff.email || ''}" />
                </div>
                <div class="md:col-span-2">
                    <label class="text-sm">Notes</label>
                    <textarea id="edit-staff-notes" class="w-full p-2 border rounded">${staff.notes || ''}</textarea>
                </div>
            </div>
            <div class="flex justify-end gap-3 mt-4">
                <button id="edit-staff-cancel" class="px-3 py-2 border rounded">Cancel</button>
                <button id="edit-staff-save" class="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
        `;

        modal.classList.remove('hidden');

        // Wire up buttons
        modal.querySelector('#edit-staff-cancel').addEventListener('click', closeStaffEditModal);
        modal.querySelector('#edit-staff-save').addEventListener('click', () => saveStaffEdit(staff.id || staff.name));
    };

    window.closeStaffEditModal = function() {
        const modal = document.getElementById('staff-modal');
        if (!modal) return;
        modal.classList.add('hidden');
    };

    window.saveStaffEdit = function(staffId) {
        const staff = STATE.data.staff.find(s => s.id === staffId || s.name === staffId);
        if (!staff) return;
        staff.firstName = document.getElementById('edit-staff-first-name').value.trim();
        staff.lastName = document.getElementById('edit-staff-last-name').value.trim();
        staff.position = document.getElementById('edit-staff-role').value.trim();
        staff.employeeId = document.getElementById('edit-staff-employee-id').value.trim();
        staff.phone = document.getElementById('edit-staff-phone').value.trim();
        staff.email = document.getElementById('edit-staff-email').value.trim();
        staff.notes = document.getElementById('edit-staff-notes').value.trim();

        saveToLocalStorage();
        // Refresh UI
        debounceRender('renderStaffPanel');
        if (typeof window.renderStaffDetailsPage === 'function') window.renderStaffDetailsPage('staff-cards-container', {});
        closeStaffEditModal();
    };
}

// =============================================================================
// STAFF MODAL MANAGEMENT FUNCTIONS
// =============================================================================

function refreshStaffListModal() {
    console.log('👥 Refreshing staff list modal...');
    
    const staffListModal = document.getElementById('staff-list-modal');
    if (!staffListModal) {
        console.error('❌ Staff list modal element not found');
        return;
    }
    
    // Clear existing content
    staffListModal.innerHTML = '';
    
    if (!STATE.data || !STATE.data.staff || STATE.data.staff.length === 0) {
        staffListModal.innerHTML = '<div class="text-gray-500 text-center py-4">No staff members found</div>';
        return;
    }
    
    // Create staff list items
    STATE.data.staff.forEach(staff => {
        const staffItem = createStaffModalItem(staff);
        staffListModal.appendChild(staffItem);
    });
}

function createStaffModalItem(staff) {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100';
    
    const statusColor = getStaffStatusColor(staff.status || 'Active');
    const displayName = formatStaffDisplayName(staff);
    
    item.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="w-3 h-3 rounded-full ${statusColor}"></div>
            <div>
                <div class="font-medium text-gray-900">${displayName}</div>
                <div class="text-sm text-gray-500">${staff.position || staff.role || 'Staff'} • ${staff.department || 'Transportation'}</div>
                ${staff.employeeId ? `<div class="text-xs text-gray-400">ID: ${staff.employeeId}</div>` : ''}
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(staff.status || 'Active')}">${staff.status || 'Active'}</span>
            <button onclick="editStaffMember('${staff.id || staff.name}')" class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
            <button onclick="removeStaffMember('${staff.id || staff.name}')" class="text-red-600 hover:text-red-800 text-sm">Remove</button>
        </div>
    `;
    
    return item;
}

function getStaffStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'active': return 'bg-green-500';
        case 'inactive': return 'bg-gray-500';
        case 'on leave': return 'bg-yellow-500';
        case 'training': return 'bg-blue-500';
        default: return 'bg-gray-500';
    }
}

function getStatusBadgeColor(status) {
    switch (status.toLowerCase()) {
        case 'active': return 'bg-green-100 text-green-800';
        case 'inactive': return 'bg-gray-100 text-gray-800';
        case 'on leave': return 'bg-yellow-100 text-yellow-800';
        case 'training': return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function addNewStaffMember(staffData) {
    console.log('👥 Adding new staff member:', staffData);
    
    if (!STATE.data) {
        STATE.data = {};
    }
    if (!STATE.data.staff) {
        STATE.data.staff = [];
    }
    
    // Generate unique ID if not provided
    const id = staffData.id || `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newStaff = {
        id: id,
        name: `${staffData.firstName} ${staffData.lastName}`,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        employeeId: staffData.employeeId || '',
        position: staffData.position || '',
        role: staffData.position || 'Driver',
        department: staffData.department || 'Transportation',
        status: staffData.status || 'Active',
        phone: staffData.phone || '',
        email: staffData.email || '',
        notes: staffData.notes || '',
        dateAdded: new Date().toISOString()
    };
    
    STATE.data.staff.push(newStaff);
    saveToLocalStorage();
    
    // Refresh the modal and main panel
    refreshStaffListModal();
    renderStaffPanel();
    
    // Emit event
    eventBus.emit('staff:added', { staff: newStaff });
    
    console.log(`✅ Staff member added: ${newStaff.name}`);
    return newStaff;
}

// =============================================================================
// STAFF DETAILS PAGE RENDERER
// =============================================================================
/**
 * Render a grid of staff cards into a container element. This is used by
 * staff-details.html so the details page can reuse the core staff module
 * logic and data.
 *
 * @param {string|HTMLElement} container - element id or DOM node to render into
 * @param {object} opts - { search, role, status }
 */
function renderStaffDetailsPage(container, opts = {}) {
    try {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        if (!STATE || !STATE.data || !Array.isArray(STATE.data.staff) || STATE.data.staff.length === 0) {
            el.innerHTML = '<div class="text-gray-500 text-center py-8">No staff found</div>';
            return;
        }

        const search = (opts.search || '').toString().trim().toLowerCase();
        const roleFilter = (opts.role || '').toString().trim().toLowerCase();
        const statusFilter = (opts.status || '').toString().trim().toLowerCase();

        const staffList = STATE.data.staff.slice();

        const filtered = staffList.filter(s => {
            const name = `${s.firstName || ''} ${s.lastName || s.name || ''}`.toLowerCase();
            const role = (s.position || s.role || '').toLowerCase();
            const status = (s.status || '').toLowerCase();

            if (search) {
                const idMatch = (s.employeeId || '').toLowerCase().includes(search);
                if (!name.includes(search) && !idMatch) return false;
            }
            if (roleFilter && role !== roleFilter) return false;
            if (statusFilter && status !== statusFilter) return false;
            return true;
        });

        if (filtered.length === 0) {
            el.innerHTML = '<div class="text-gray-500 text-center py-8">No staff match the filters</div>';
            return;
        }

        const frag = document.createDocumentFragment();
        filtered.forEach(staff => {
            const displayName = formatStaffDisplayName(staff);
            const assignmentInfo = getStaffAssignmentInfo(staff.name || staff.id);
            const status = (staff.status || 'Active').toLowerCase().replace(/\s+/g, '-');

            // Build a fleet-like card for staff for visual parity
            const cardHtml = `
                <div class="fleet-card staff ${status} bg-white rounded-lg shadow-sm p-6" onclick="if(event) event.stopPropagation(); if(typeof window.showStaffDetails === 'function'){ window.showStaffDetails('${staff.name || staff.id}'); }">
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-xl font-bold text-gray-900">${displayName}</h3>
                            <p class="text-sm text-gray-500">${staff.position || staff.role || 'Staff'}</p>
                        </div>
                        <span class="status-indicator status-${status}">${getStaffStatusBadgeLabel(staff.status || 'Active')}</span>
                    </div>

                    <!-- Key Info -->
                    <div class="space-y-3">
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600">Employee ID:</span>
                            <span class="text-sm text-gray-900">${staff.employeeId || 'N/A'}</span>
                        </div>

                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600">Role:</span>
                            <span class="text-sm text-gray-900">${staff.position || staff.role || 'Staff'}</span>
                        </div>

                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600">Contact:</span>
                            <span class="text-sm text-gray-900">${staff.phone || '—'}</span>
                        </div>

                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600">Status:</span>
                            <span class="text-sm text-gray-900">${staff.status || 'Active'}</span>
                        </div>

                        ${assignmentInfo ? `
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-medium text-gray-600">Assignment:</span>
                            <span class="text-sm text-gray-900">${assignmentInfo}</span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Current Assignment -->
                    ${getStaffCurrentAssignmentBlock(staff.name || staff.id)}

                    <!-- Actions -->
                    <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                        <button onclick="event.stopPropagation(); if(typeof window.editStaffMember === 'function') editStaffMember('${staff.id || staff.name}');" class="flex-1 text-sm bg-blue-50 text-blue-600 py-2 px-3 rounded hover:bg-blue-100">Edit Details</button>
                    </div>
                </div>
            `;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = cardHtml;
            frag.appendChild(wrapper.firstElementChild);
        });

        // Clear and append
        el.innerHTML = '';
        el.appendChild(frag);
    } catch (error) {
        console.error('❌ Error rendering staff details page:', error);
    }
}

// Ensure renderer is available globally (some environments run window-registering block earlier)
if (typeof window !== 'undefined') {
    window.renderStaffDetailsPage = renderStaffDetailsPage;
}


function removeStaffMember(staffId) {
    console.log('👥 Removing staff member:', staffId);
    
    if (!STATE.data || !STATE.data.staff) {
        console.error('❌ No staff data available');
        return;
    }
    
    const staffIndex = STATE.data.staff.findIndex(staff => 
        staff.id === staffId || staff.name === staffId
    );
    
    if (staffIndex === -1) {
        console.error('❌ Staff member not found:', staffId);
        return;
    }
    
    const removedStaff = STATE.data.staff.splice(staffIndex, 1)[0];
    
    // Also remove from staffOut list if present
    const outIndex = STATE.staffOut.findIndex(staff => 
        staff.name === removedStaff.name
    );
    if (outIndex !== -1) {
        STATE.staffOut.splice(outIndex, 1);
    }
    
    saveToLocalStorage();
    
    // Refresh the modal and main panel
    refreshStaffListModal();
    renderStaffPanel();
    
    // Emit event
    eventBus.emit('staff:removed', { staff: removedStaff });
    
    console.log(`✅ Staff member removed: ${removedStaff.name}`);
}

function editStaffMember(staffId) {
    console.log('👥 Editing staff member:', staffId);
    
    const staff = STATE.data.staff.find(s => s.id === staffId || s.name === staffId);
    if (!staff) {
        console.error('❌ Staff member not found:', staffId);
        return;
    }
    
    // Populate the form with existing data
    const form = document.getElementById('add-staff-form');
    if (form) {
        // If the global add/edit form exists on the page, populate it (existing behavior)
        document.getElementById('staff-first-name').value = staff.firstName || '';
        document.getElementById('staff-last-name').value = staff.lastName || '';
        document.getElementById('staff-employee-id').value = staff.employeeId || '';
        document.getElementById('staff-position').value = staff.position || '';
        document.getElementById('staff-department').value = staff.department || '';
        document.getElementById('staff-status').value = staff.status || '';
        document.getElementById('staff-phone').value = staff.phone || '';
        document.getElementById('staff-email').value = staff.email || '';
        document.getElementById('staff-notes').value = staff.notes || '';

        // Store the ID for updating
        form.dataset.editingId = staff.id || staff.name;

        // Change button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Update Staff Member';
            submitBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700';
        }
        return;
    }

    // Fallback: if no global form, use the in-page modal editor we expose (for staff-details page)
    if (typeof window.showStaffEditModal === 'function') {
        window.showStaffEditModal(staff.id || staff.name);
        return;
    }

    console.warn('No edit UI available for staff; please open the staff add/edit form or implement a modal.');
}

function exportStaffListAsCSV() {
    console.log('👥 Exporting staff list as CSV...');
    
    if (!STATE.data || !STATE.data.staff || STATE.data.staff.length === 0) {
        alert('No staff data available to export');
        return;
    }
    
    // Create CSV content
    const headers = ['First Name', 'Last Name', 'Employee ID', 'Position', 'Department', 'Status', 'Phone', 'Email', 'Notes'];
    const csvContent = [headers.join(',')];
    
    STATE.data.staff.forEach(staff => {
        const row = [
            staff.firstName || '',
            staff.lastName || '',
            staff.employeeId || '',
            staff.position || '',
            staff.department || '',
            staff.status || '',
            staff.phone || '',
            staff.email || '',
            (staff.notes || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
        ];
        csvContent.push(row.map(field => `"${field}"`).join(','));
    });
    
    // Create and download file
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff_list_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Staff list exported as CSV');
}

function handleStaffCSVImport(file) {
    console.log('👥 Processing staff CSV import:', file.name);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n').filter(line => line.trim());
                
                if (lines.length < 2) {
                    reject(new Error('CSV file must contain headers and at least one data row'));
                    return;
                }
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const staffData = [];
                let importCount = 0;
                
                // Get default values from form
                const defaultStatus = document.getElementById('bulk-default-staff-status')?.value || 'Active';
                const defaultDepartment = document.getElementById('bulk-default-department')?.value || 'Transportation';
                
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                    
                    if (values.length < headers.length) continue;
                    
                    const staff = {};
                    headers.forEach((header, index) => {
                        const value = values[index] || '';
                        
                        switch (header.toLowerCase()) {
                            case 'first name':
                            case 'firstname':
                                staff.firstName = value;
                                break;
                            case 'last name':
                            case 'lastname':
                                staff.lastName = value;
                                break;
                            case 'employee id':
                            case 'employeeid':
                            case 'id':
                                staff.employeeId = value;
                                break;
                            case 'position':
                            case 'role':
                            case 'title':
                                staff.position = value;
                                break;
                            case 'department':
                                staff.department = value || defaultDepartment;
                                break;
                            case 'status':
                                staff.status = value || defaultStatus;
                                break;
                            case 'phone':
                            case 'telephone':
                                staff.phone = value;
                                break;
                            case 'email':
                                staff.email = value;
                                break;
                            case 'notes':
                            case 'comments':
                                staff.notes = value;
                                break;
                        }
                    });
                    
                    // Validate required fields
                    if (staff.firstName && staff.lastName) {
                        // Set defaults if not provided
                        staff.department = staff.department || defaultDepartment;
                        staff.status = staff.status || defaultStatus;
                        
                        addNewStaffMember(staff);
                        staffData.push(staff);
                        importCount++;
                    }
                }
                
                resolve({ 
                    imported: importCount, 
                    total: lines.length - 1,
                    data: staffData 
                });
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    renderStaffPanel,
    markStaffOut,
    markStaffAvailable,
    clearStaffAssignments,
    groupStaffByRole,
    getRoleColor,
    isStaffAssigned,
    getStaffAssignmentInfo,
    updateStaffSummary,
    getAvailableStaffByRole,
    getStaffByName,
    exportStaffData,
    handleStaffPanelClick,
    showStaffDetails,
    formatStaffDisplayName,
    // Modal management functions
    refreshStaffListModal,
    addNewStaffMember,
    removeStaffMember,
    editStaffMember,
    exportStaffListAsCSV,
    handleStaffCSVImport
    , renderStaffDetailsPage
};
