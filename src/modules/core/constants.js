/* CORE - CONSTANTS MODULE
   Transportation Dispatch Dashboard
   Centralized constants to eliminate magic strings
*/

// View/Shift Constants
export const SHIFTS = {
    AM: 'AM',
    PM: 'PM',
    BOTH: 'BOTH',
    NONE: 'NONE'
};

// Asset Status Constants
export const ASSET_STATUS = {
    ACTIVE: 'active',
    DOWN: 'down',
    MAINTENANCE: 'maintenance',
    RETIRED: 'retired'
};

// Staff Status Constants
export const STAFF_STATUS = {
    AVAILABLE: 'available',
    OUT: 'out',
    ASSIGNED: 'assigned'
};

// Route Status Constants (10-codes)
export const ROUTE_STATUS = {
    UNASSIGNED: 'unassigned',
    IN_SERVICE: '10-8',      // Active/In Service
    OUT_OF_SERVICE: '10-7',  // Down/Out of Service
    DELAYED: '10-11'         // On Hold/Delayed
};

// Route Types
export const ROUTE_TYPES = {
    GENERAL_ED: 'general-education',
    SPECIAL_ED: 'special-education',
    MISCELLANEOUS: 'miscellaneous',
    FIELD_TRIPS: 'field-trips',
    INACTIVE: 'inactive'
};

// Route Schedules
export const ROUTE_SCHEDULES = {
    AM: 'am',
    PM: 'pm',
    BOTH: 'both',
    NONE: 'none'
};

// Dynamic Asset Status (for STATE.assetStatus object)
export const DYNAMIC_STATUS = {
    DOWN: 'Down',
    UP: 'Up'
};

// Export all constants as a single object for debugging
export const CONSTANTS = {
    SHIFTS,
    ASSET_STATUS,
    STAFF_STATUS,
    ROUTE_STATUS,
    ROUTE_TYPES,
    ROUTE_SCHEDULES,
    DYNAMIC_STATUS
};
