# 🔧 Phase 2: Core Refactoring (3-5 days)

**Status:** ⏳ Waiting for Phase 1  
**Expected Time:** 3-5 days  
**Impact:** Major code reduction and consistency improvements

---

## Prerequisites

✅ Phase 1 must be complete:
- Constants file created
- Logger utility implemented
- Error handling standardized
- Dead code removed

---

## Overview

Phase 2 focuses on eliminating major code duplication through service-oriented utilities. This phase will reduce your codebase by 400+ lines while making it more maintainable and testable.

**Benefits:**
- 📉 Reduce code by ~400 lines (20% reduction in module code)
- ✅ Consistent validation across all assignment operations
- ✅ Unified modal management
- ✅ Simplified asset status logic
- ✅ Better organized global function exposure

---

## Task 2.1: Create ValidationService ⭐ HIGHEST IMPACT

**Estimated Time:** 2 hours  
**Difficulty:** Medium  
**Impact:** Very High - Eliminates ~200 lines of duplicate code

### What You're Fixing
Assignment validation logic is duplicated in 4 places:
1. `assignDriver()` function
2. `assignAsset()` function
3. `addSafetyEscort()` function
4. `showSelectionModal()` item rendering

### Action Steps

#### Step 1: Create ValidationService File
**File:** `src/modules/core/validationService.js`

```javascript
/* CORE - VALIDATION SERVICE MODULE
   Transportation Dispatch Dashboard
   Centralized validation for staff and asset assignments
*/

import { STATE } from './state.js';
import { Logger } from './logger.js';
import { DYNAMIC_STATUS } from './constants.js';

export class ValidationService {
    /**
     * Validate if staff member can be assigned
     * @param {string} staffName - Name of staff member
     * @param {string} currentRouteId - Route ID to exclude from check (optional)
     * @returns {Object} { valid: boolean, reason: string }
     */
    static canAssignStaff(staffName, currentRouteId = null) {
        Logger.debug('Validating staff assignment:', { staffName, currentRouteId });
        
        // Check if staff is marked as out of service
        if (STATE.staffOut?.some(out => out?.name === staffName)) {
            return { 
                valid: false, 
                reason: 'Out of Service',
                type: 'out-of-service'
            };
        }
        
        // Check if staff is already assigned elsewhere
        const activeAssignment = this.findStaffActiveAssignment(staffName, currentRouteId);
        if (activeAssignment) {
            const routeName = activeAssignment.route.name || activeAssignment.route.id;
            return { 
                valid: false, 
                reason: `Already assigned as ${activeAssignment.role} on ${routeName}`,
                type: 'already-assigned',
                assignment: activeAssignment
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate if asset can be assigned
     * @param {string} assetName - Name/ID of asset
     * @param {string} currentRouteId - Route ID to exclude from check (optional)
     * @returns {Object} { valid: boolean, reason: string }
     */
    static canAssignAsset(assetName, currentRouteId = null) {
        Logger.debug('Validating asset assignment:', { assetName, currentRouteId });
        
        // Check if asset is marked as down
        if (this.isAssetDown(assetName)) {
            const reason = this.getAssetDownReason(assetName);
            return { 
                valid: false, 
                reason: `Asset is Down${reason ? ': ' + reason : ''}`,
                type: 'down'
            };
        }
        
        // Check if asset is already assigned elsewhere
        const activeAssignment = this.findAssetActiveAssignment(assetName, currentRouteId);
        if (activeAssignment) {
            const routeName = activeAssignment.route.name || activeAssignment.route.id;
            const role = activeAssignment.role || 'Asset';
            return { 
                valid: false, 
                reason: `Already assigned as ${role} to ${routeName}`,
                type: 'already-assigned',
                assignment: activeAssignment
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate if trailer can be assigned (similar to asset but specific to trailers)
     * @param {string} trailerName - Name/ID of trailer
     * @param {string} currentRouteId - Route ID to exclude from check (optional)
     * @returns {Object} { valid: boolean, reason: string }
     */
    static canAssignTrailer(trailerName, currentRouteId = null) {
        // Trailers use same validation as assets
        return this.canAssignAsset(trailerName, currentRouteId);
    }
    
    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    
    /**
     * Find if staff member has active assignment (excluding specified route)
     */
    static findStaffActiveAssignment(staffName, excludeRouteId = null) {
        const routes = STATE.data?.routes || [];
        
        for (const route of routes) {
            if (excludeRouteId && route.id === excludeRouteId) continue;
            
            // Check if assigned as driver
            if (route.driver && route.driver.name === staffName) {
                return { role: 'Driver', route };
            }
            
            // Check if assigned as safety escort
            const escorts = Array.isArray(route.safetyEscorts) ? route.safetyEscorts : [];
            if (escorts.some(e => e && e.name === staffName)) {
                return { role: 'Safety Escort', route };
            }
        }
        
        return null;
    }
    
    /**
     * Find if asset has active assignment (excluding specified route)
     */
    static findAssetActiveAssignment(assetName, excludeRouteId = null) {
        const routes = STATE.data?.routes || [];
        
        for (const route of routes) {
            if (excludeRouteId && route.id === excludeRouteId) continue;
            
            // Check if assigned as primary asset
            if (route.asset && route.asset.name === assetName) {
                return { role: 'Asset', route };
            }
            
            // Check if assigned as trailer
            if (route.trailer && route.trailer.name === assetName) {
                return { role: 'Trailer', route };
            }
        }
        
        return null;
    }
    
    /**
     * Check if asset is marked as down
     */
    static isAssetDown(assetName) {
        // Check dynamic status first
        const dynamicDown = STATE.assetStatus?.[assetName] === DYNAMIC_STATUS.DOWN;
        
        // Check static status
        const asset = STATE.data?.assets?.find(a => a.name === assetName);
        const staticDown = asset && ['down', 'maintenance', 'retired'].includes(asset.status);
        
        return dynamicDown || staticDown;
    }
    
    /**
     * Get reason why asset is down
     */
    static getAssetDownReason(assetName) {
        return STATE.assetDownReasons?.[assetName]?.reason || '';
    }
}

export default ValidationService;
```

#### Step 2: Update routeCards.js - Replace assignDriver validation
**File:** `src/modules/dispatch/routeCards.js`

Add import:
```javascript
import { ValidationService } from '../core/validationService.js';
```

**Find the `assignDriver` function (around line 500) and replace validation:**

```javascript
// OLD CODE (DELETE):
function assignDriver(routeId, driverInfo) {
    console.log(`👨‍💼 Assigning driver to route ${routeId}:`, driverInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        console.error('❌ Route not found:', routeId);
        return false;
    }
    
    // Validation: staff cannot be assigned if out-of-service or already assigned in any role
    if (driverInfo) {
        if (STATE.staffOut && STATE.staffOut.some(out => out && out.name === driverInfo.name)) {
            notify(`Cannot assign ${driverInfo.name}: marked Out of Service.`, 'warning');
            return false;
        }
        const active = findStaffActiveAssignment(driverInfo.name, route.id);
        if (active) {
            notify(`${driverInfo.name} is already assigned as ${active.role} on ${active.route.name || active.route.id}. Unassign them first.`, 'warning');
            return false;
        }
    }
    
    // ... rest of function
}

// NEW CODE:
function assignDriver(routeId, driverInfo) {
    Logger.info('Assigning driver to route:', routeId, driverInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Validate driver assignment
    if (driverInfo) {
        const validation = ValidationService.canAssignStaff(driverInfo.name, route.id);
        if (!validation.valid) {
            ErrorHandler.assignmentFailed(driverInfo.name, validation.reason);
            return false;
        }
    }
    
    route.driver = driverInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:driverAssigned', { routeId, driver: driverInfo });
    return true;
}
```

#### Step 3: Update routeCards.js - Replace assignAsset validation

```javascript
// Replace assignAsset function validation:
function assignAsset(routeId, assetInfo) {
    Logger.info('Assigning asset to route:', routeId, assetInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Validate asset assignment
    if (assetInfo) {
        const validation = ValidationService.canAssignAsset(assetInfo.name, route.id);
        if (!validation.valid) {
            ErrorHandler.assignmentFailed(assetInfo.name, validation.reason);
            return false;
        }
    }
    
    route.asset = assetInfo;
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:assetAssigned', { routeId, asset: assetInfo });
    return true;
}
```

#### Step 4: Update routeCards.js - Replace addSafetyEscort validation

```javascript
function addSafetyEscort(routeId, escortInfo) {
    Logger.info('Adding safety escort to route:', routeId, escortInfo);
    
    const route = findRouteById(routeId);
    if (!route) {
        ErrorHandler.notFound('Route', routeId);
        return false;
    }
    
    // Check if escort already on this route
    if (route.safetyEscorts.some(escort => escort.name === escortInfo.name)) {
        Logger.warn('Escort already assigned to this route:', escortInfo.name);
        return false;
    }
    
    // Check maximum escorts limit (5)
    if (route.safetyEscorts.length >= 5) {
        ErrorHandler.validationFailed('Maximum 5 safety escorts allowed per route');
        return false;
    }
    
    // Validate escort assignment
    const validation = ValidationService.canAssignStaff(escortInfo.name, route.id);
    if (!validation.valid) {
        ErrorHandler.assignmentFailed(escortInfo.name, validation.reason);
        return false;
    }
    
    route.safetyEscorts.push(escortInfo);
    route.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    
    eventBus.emit('routes:safetyEscortAdded', { routeId, escort: escortInfo });
    return true;
}
```

#### Step 5: Update showSelectionModal - Replace inline validation

**Find the item rendering section in `showSelectionModal` and update:**

```javascript
// In renderItems function, around line 1200:
function renderItems(filteredItems = options.items) {
    list.innerHTML = '';
    
    filteredItems.forEach(item => {
        const isSelected = selectedItems.some(selected => selected[idKey] === item[idKey]);
        
        // NEW: Use ValidationService for status checks
        let isDisabled = false;
        let disabledReason = '';
        const name = item.name || '';
        
        if (options.mode === 'driver' || options.mode === 'escort') {
            const validation = ValidationService.canAssignStaff(name, options.routeId);
            if (!validation.valid) {
                isDisabled = true;
                disabledReason = validation.reason;
            }
        } else if (options.mode === 'asset' || options.mode === 'trailer') {
            const validation = ValidationService.canAssignAsset(name, options.routeId);
            if (!validation.valid) {
                isDisabled = true;
                disabledReason = validation.reason;
            }
        }
        
        // ... rest of rendering code
    });
}
```

### Testing Checklist
- [ ] Try assigning driver who is already assigned - see proper validation
- [ ] Try assigning asset that is down - see proper validation
- [ ] Try assigning staff who is out of service - see proper validation
- [ ] Verify modal shows disabled state with reasons
- [ ] Check "Unassign & Assign" quick action works
- [ ] Verify validation works for safety escorts

### Success Criteria
✅ ~200 lines of duplicate code removed  
✅ Consistent validation across all assignment operations  
✅ All validation tests pass  
✅ Better error messages to users

---

## Task 2.2: Implement ModalService

**Estimated Time:** 1.5 hours  
**Difficulty:** Medium  
**Impact:** High - Eliminates ~150 lines of duplicate modal code

### What You're Fixing
Modal open/close/backdrop logic is duplicated across 6+ modals in app.js

### Action Steps

#### Step 1: Create ModalService File
**File:** `src/modules/ui/modalService.js`

```javascript
/* UI - MODAL SERVICE MODULE
   Transportation Dispatch Dashboard
   Centralized modal management
*/

import { Logger } from '../core/logger.js';

export class ModalService {
    static activeModals = new Set();
    static escHandlers = new Map();
    
    /**
     * Open a modal
     * @param {string} modalId - ID of modal element
     * @param {Object} options - Configuration options
     * @returns {HTMLElement|null} - Modal element or null if not found
     */
    static open(modalId, options = {}) {
        const {
            closeOnBackdrop = true,
            closeOnEsc = true,
            onOpen = null,
            onClose = null,
            focusElement = null
        } = options;
        
        const modal = document.getElementById(modalId);
        if (!modal) {
            Logger.warn('Modal not found:', modalId);
            return null;
        }
        
        Logger.debug('Opening modal:', modalId);
        
        // Show modal
        modal.classList.remove('hidden');
        this.activeModals.add(modalId);
        
        // Setup backdrop click handling
        if (closeOnBackdrop) {
            const backdropHandler = (e) => {
                if (e.target === modal) {
                    this.close(modalId);
                }
            };
            modal.addEventListener('click', backdropHandler);
            modal.dataset.backdropHandler = 'attached';
        }
        
        // Setup ESC key handling
        if (closeOnEsc) {
            const escHandler = (e) => {
                if (e.key === 'Escape' && this.activeModals.has(modalId)) {
                    this.close(modalId);
                }
            };
            document.addEventListener('keydown', escHandler);
            this.escHandlers.set(modalId, escHandler);
        }
        
        // Store onClose callback
        if (onClose) {
            modal.dataset.onCloseCallback = 'attached';
            modal._onCloseCallback = onClose;
        }
        
        // Call onOpen callback
        if (onOpen && typeof onOpen === 'function') {
            onOpen(modal);
        }
        
        // Focus specified element or first input
        if (focusElement) {
            const element = modal.querySelector(focusElement);
            if (element) element.focus();
        } else {
            const firstInput = modal.querySelector('input, textarea, select, button');
            if (firstInput) firstInput.focus();
        }
        
        return modal;
    }
    
    /**
     * Close a modal
     * @param {string} modalId - ID of modal element
     */
    static close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            Logger.warn('Modal not found:', modalId);
            return;
        }
        
        Logger.debug('Closing modal:', modalId);
        
        // Hide modal
        modal.classList.add('hidden');
        this.activeModals.delete(modalId);
        
        // Remove ESC handler
        if (this.escHandlers.has(modalId)) {
            document.removeEventListener('keydown', this.escHandlers.get(modalId));
            this.escHandlers.delete(modalId);
        }
        
        // Call onClose callback if exists
        if (modal._onCloseCallback && typeof modal._onCloseCallback === 'function') {
            modal._onCloseCallback(modal);
            delete modal._onCloseCallback;
        }
    }
    
    /**
     * Close all active modals
     */
    static closeAll() {
        const modalIds = Array.from(this.activeModals);
        modalIds.forEach(modalId => this.close(modalId));
    }
    
    /**
     * Check if modal is currently open
     */
    static isOpen(modalId) {
        return this.activeModals.has(modalId);
    }
    
    /**
     * Setup standard close button handlers for a modal
     * @param {string} modalId - ID of modal element
     * @param {string[]} closeButtonIds - Array of close button IDs
     */
    static setupCloseButtons(modalId, closeButtonIds = []) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        // Setup provided close button IDs
        closeButtonIds.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => this.close(modalId));
            }
        });
        
        // Also setup any buttons with data-modal-close attribute
        const autoCloseButtons = modal.querySelectorAll('[data-modal-close]');
        autoCloseButtons.forEach(button => {
            button.addEventListener('click', () => this.close(modalId));
        });
    }
}

// Make globally accessible
if (typeof window !== 'undefined') {
    window.ModalService = ModalService;
}

export default ModalService;
```

#### Step 2: Update app.js - Replace Timestamp Report Modal

**Find and replace the timestamp modal handlers:**

```javascript
// OLD CODE (around line 850):
showTimestampReportModal() {
    const modal = document.getElementById('timestamp-report-modal');
    if (modal) {
        modal.classList.remove('hidden');
        this.setupTimestampReportModalHandlers();
        this.generateTimestampReport();
        console.log('📋 Timestamp report modal opened');
    }
}

setupTimestampReportModalHandlers() {
    const closeBtn = document.getElementById('timestamp-report-close');
    const cancelBtn = document.getElementById('timestamp-report-cancel');
    // ... lots of handler setup
}

// NEW CODE:
showTimestampReportModal() {
    ModalService.open('timestamp-report-modal', {
        closeOnBackdrop: true,
        closeOnEsc: true,
        onOpen: () => {
            this.generateTimestampReport();
            this.setupTimestampReportActions();
        }
    });
}

setupTimestampReportActions() {
    // Only setup action buttons (print, email, clear), not close buttons
    const printBtn = document.getElementById('print-current-day');
    const emailBtn = document.getElementById('email-report');
    const clearBtn = document.getElementById('clear-timestamps');
    
    if (printBtn) printBtn.onclick = () => this.printTimestampReport();
    if (emailBtn) emailBtn.onclick = () => this.emailTimestampReport();
    if (clearBtn) clearBtn.onclick = () => this.clearAllTimestamps();
}
```

#### Step 3: Setup Close Buttons Once in finalize

```javascript
// In finalizeInitialization method, add:
setupModalCloseButtons() {
    // Setup close buttons for all modals
    ModalService.setupCloseButtons('timestamp-report-modal', [
        'timestamp-report-close',
        'timestamp-report-cancel'
    ]);
    
    ModalService.setupCloseButtons('route-management-modal', [
        'route-modal-close'
    ]);
    
    ModalService.setupCloseButtons('staff-management-modal', [
        'staff-modal-close'
    ]);
    
    ModalService.setupCloseButtons('asset-management-modal', [
        'asset-modal-close'
    ]);
    
    ModalService.setupCloseButtons('assignment-modal', [
        'modal-cancel'
    ]);
}
```

### Testing Checklist
- [ ] All modals open correctly
- [ ] Clicking backdrop closes modal
- [ ] Pressing ESC closes modal
- [ ] Close buttons work
- [ ] Multiple modals can be managed
- [ ] Focus goes to first input when modal opens

### Success Criteria
✅ ~150 lines of duplicate modal code removed  
✅ Consistent modal behavior across application  
✅ Easier to add new modals in future

---

## Task 2.3: Create AssetStatusService

**Estimated Time:** 45 minutes  
**Difficulty:** Easy  
**Impact:** Medium - Simplifies asset status logic

See full implementation in the file...

---

## Task 2.4: Global Registry

**Estimated Time:** 1 hour  
**Difficulty:** Medium  
**Impact:** Medium - Better organization

See full implementation in the file...

---

## Phase 2 Completion Checklist

- [ ] **Task 2.1:** ValidationService implemented ✅
- [ ] **Task 2.2:** ModalService implemented ✅
- [ ] **Task 2.3:** AssetStatusService implemented ✅
- [ ] **Task 2.4:** GlobalRegistry implemented ✅

**Expected Code Reduction:** ~400 lines removed

---

**Next:** Phase 3 - Template Refactoring
