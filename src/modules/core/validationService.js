/* CORE - VALIDATION SERVICE MODULE
   Transportation Dispatch Dashboard
   Centralized validation for staff and asset assignments
   
   This service eliminates ~200 lines of duplicate validation logic
   across assignDriver, assignAsset, addSafetyEscort, and modal rendering.
*/

import { STATE } from './state.js';
import { Logger } from './logger.js';
import { ASSET_STATUS, DYNAMIC_STATUS } from './constants.js';

export class ValidationService {
    /**
     * Validate if staff member can be assigned
     * @param {string} staffName - Name of staff member
     * @param {string} currentRouteId - Route ID to exclude from check (optional)
     * @returns {Object} { valid: boolean, reason: string, type: string, assignment?: Object }
     */
    static canAssignStaff(staffName, currentRouteId = null) {
        Logger.debug('Validating staff assignment:', { staffName, currentRouteId });
        
        // Check if staff is marked as out of service
        if (STATE.staffOut?.some(out => out?.name === staffName)) {
            return { 
                valid: false, 
                reason: `${staffName} is marked Out of Service`,
                type: 'out-of-service'
            };
        }
        
        // Check if staff is already assigned elsewhere
        const activeAssignment = this.findStaffActiveAssignment(staffName, currentRouteId);
        if (activeAssignment) {
            const routeName = activeAssignment.route.name || activeAssignment.route.id;
            return { 
                valid: false, 
                reason: `${staffName} is already assigned as ${activeAssignment.role} on ${routeName}. Unassign them first.`,
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
     * @returns {Object} { valid: boolean, reason: string, type: string, assignment?: Object }
     */
    static canAssignAsset(assetName, currentRouteId = null) {
        Logger.debug('Validating asset assignment:', { assetName, currentRouteId });
        
        // Check if asset is marked as down
        if (this.isAssetDown(assetName)) {
            const reason = this.getAssetDownReason(assetName);
            return { 
                valid: false, 
                reason: `${assetName} is currently Down${reason ? ': ' + reason : ''}`,
                type: 'down'
            };
        }
        
        // Check if asset is already assigned elsewhere
        const activeAssignment = this.findAssetActiveAssignment(assetName, currentRouteId);
        if (activeAssignment) {
            const routeName = activeAssignment.route.name || activeAssignment.route.id;
            return { 
                valid: false, 
                reason: `${assetName} is already assigned to ${routeName}. Unassign it first.`,
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
     * @param {string} staffName - Name of staff member
     * @param {string} excludeRouteId - Route ID to exclude from search
     * @returns {Object|null} { route, role } or null if not assigned
     */
    static findStaffActiveAssignment(staffName, excludeRouteId = null) {
        const routes = STATE.data?.routes || [];
        
        for (const route of routes) {
            if (excludeRouteId && route.id === excludeRouteId) continue;
            
            // Check driver
            if (route.driver?.name === staffName) {
                return { route, role: 'Driver' };
            }
            
            // Check safety escorts
            if (route.safetyEscorts?.some(escort => escort.name === staffName)) {
                return { route, role: 'Safety Escort' };
            }
        }
        
        return null;
    }
    
    /**
     * Find if asset has active assignment (excluding specified route)
     * @param {string} assetName - Name/ID of asset
     * @param {string} excludeRouteId - Route ID to exclude from search
     * @returns {Object|null} { route } or null if not assigned
     */
    static findAssetActiveAssignment(assetName, excludeRouteId = null) {
        const routes = STATE.data?.routes || [];
        
        for (const route of routes) {
            if (excludeRouteId && route.id === excludeRouteId) continue;
            
            // Check asset
            if (route.asset?.name === assetName) {
                return { route };
            }
            
            // Check trailer
            if (route.trailer?.name === assetName) {
                return { route };
            }
        }
        
        return null;
    }
    
    /**
     * Check if asset is marked as down
     * @param {string} assetName - Name/ID of asset
     * @returns {boolean} True if asset is down
     */
    static isAssetDown(assetName) {
        // Check dynamic status first (user marked down in dashboard)
        const dynamicDown = STATE.assetStatus?.[assetName] === DYNAMIC_STATUS.DOWN;
        
        // Check static status (permanent status in data)
        const asset = STATE.data?.assets?.find(a => a.name === assetName);
        const staticDown = asset && [
            ASSET_STATUS.DOWN, 
            ASSET_STATUS.MAINTENANCE, 
            ASSET_STATUS.RETIRED
        ].includes(asset.status);
        
        return dynamicDown || staticDown;
    }
    
    /**
     * Get reason why asset is down
     * @param {string} assetName - Name/ID of asset
     * @returns {string} Reason for down status or empty string
     */
    static getAssetDownReason(assetName) {
        return STATE.assetDownReasons?.[assetName]?.reason || '';
    }
    
    /**
     * Get validation status display for UI
     * Returns object with display properties for showing validation state
     * @param {string} itemName - Name of staff/asset
     * @param {string} mode - 'driver', 'escort', 'asset', 'trailer'
     * @param {string} currentRouteId - Current route ID (optional)
     * @returns {Object} { isDisabled: boolean, disabledReason: string, canQuickReassign: boolean }
     */
    static getValidationDisplay(itemName, mode, currentRouteId = null) {
        let validation;
        
        if (mode === 'driver' || mode === 'escort') {
            validation = this.canAssignStaff(itemName, currentRouteId);
        } else if (mode === 'asset' || mode === 'trailer') {
            validation = this.canAssignAsset(itemName, currentRouteId);
        } else {
            return { isDisabled: false, disabledReason: '', canQuickReassign: false };
        }
        
        return {
            isDisabled: !validation.valid,
            disabledReason: validation.reason || '',
            canQuickReassign: validation.type === 'already-assigned',
            assignment: validation.assignment
        };
    }
}

// Make globally accessible for debugging
if (typeof window !== 'undefined') {
    window.ValidationService = ValidationService;
}

export default ValidationService;
