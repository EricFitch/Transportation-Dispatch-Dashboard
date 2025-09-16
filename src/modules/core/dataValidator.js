/* DATA VALIDATION UTILITY
   Transportation Dispatch Dashboard
   
   Utility functions to validate and clean localStorage data
*/

/**
 * Validate and clean dispatch configuration data
 */
export function validateDispatchConfig(config) {
    console.log('🔍 Validating dispatch configuration...');
    
    const cleanConfig = {
        data: {
            routes: [],
            staff: [],
            assets: [],
            fieldTrips: [],
            colors: {
                "Gen Ed Bus": "#3b82f6",
                "SE Bus": "#f59e0b",
                "Van": "#10b981",
                "Suburban": "#8b5cf6",
                "Car": "#ef4444",
                "out": "#ef4444",
                "roles": {}
            }
        },
        assignments: {},
        routeStatus: {},
        assetStatus: {},
        staffOut: [],
        routeNotes: {},
        fieldTripNotes: {},
        statusTimestamps: {},
        currentView: 'AM',
        lastSaved: new Date().toISOString()
    };

    if (!config || typeof config !== 'object') {
        console.warn('⚠️ Invalid config object, using defaults');
        return cleanConfig;
    }

    const data = config.data || config;

    // Validate routes
    if (data.routes && Array.isArray(data.routes)) {
        console.log(`📊 Validating ${data.routes.length} routes...`);
        
        data.routes.forEach((route, index) => {
            if (validateRoute(route)) {
                cleanConfig.data.routes.push(cleanRoute(route, index));
            } else {
                console.warn(`⚠️ Removed invalid route at index ${index}:`, route);
            }
        });
        
        console.log(`✅ Routes validated: ${cleanConfig.data.routes.length} valid routes`);
    }

    // Validate staff
    if (data.staff && Array.isArray(data.staff)) {
        console.log(`📊 Validating ${data.staff.length} staff members...`);
        
        data.staff.forEach((staff, index) => {
            if (validateStaff(staff)) {
                cleanConfig.data.staff.push(cleanStaff(staff));
            } else {
                console.warn(`⚠️ Removed invalid staff at index ${index}:`, staff);
            }
        });
        
        console.log(`✅ Staff validated: ${cleanConfig.data.staff.length} valid staff members`);
    }

    // Validate assets
    if (data.assets && Array.isArray(data.assets)) {
        console.log(`📊 Validating ${data.assets.length} assets...`);
        
        data.assets.forEach((asset, index) => {
            if (validateAsset(asset)) {
                cleanConfig.data.assets.push(cleanAsset(asset));
            } else {
                console.warn(`⚠️ Removed invalid asset at index ${index}:`, asset);
            }
        });
        
        console.log(`✅ Assets validated: ${cleanConfig.data.assets.length} valid assets`);
    }

    // Validate field trips
    if (data.fieldTrips && Array.isArray(data.fieldTrips)) {
        cleanConfig.data.fieldTrips = data.fieldTrips.filter(validateFieldTrip);
    } else {
        cleanConfig.data.fieldTrips = [
            { id: 'ft1', destination: 'New Field Trip', driver: null, escort: null, asset: null, trailer: null },
            { id: 'ft2', destination: 'New Field Trip', driver: null, escort: null, asset: null, trailer: null },
            { id: 'ft3', destination: 'New Field Trip', driver: null, escort: null, asset: null, trailer: null }
        ];
    }

    // Copy other valid properties
    if (config.assignments && typeof config.assignments === 'object') {
        cleanConfig.assignments = config.assignments;
    }
    
    if (config.routeStatus && typeof config.routeStatus === 'object') {
        cleanConfig.routeStatus = config.routeStatus;
    }
    
    if (config.assetStatus && typeof config.assetStatus === 'object') {
        cleanConfig.assetStatus = config.assetStatus;
    }
    
    if (config.staffOut && Array.isArray(config.staffOut)) {
        cleanConfig.staffOut = config.staffOut.filter(validateStaffOut);
    }
    
    if (config.routeNotes && typeof config.routeNotes === 'object') {
        cleanConfig.routeNotes = config.routeNotes;
    }
    
    if (config.fieldTripNotes && typeof config.fieldTripNotes === 'object') {
        cleanConfig.fieldTripNotes = config.fieldTripNotes;
    }
    
    if (config.statusTimestamps && typeof config.statusTimestamps === 'object') {
        cleanConfig.statusTimestamps = validateStatusTimestamps(config.statusTimestamps);
    }
    
    if (config.currentView && ['AM', 'PM'].includes(config.currentView)) {
        cleanConfig.currentView = config.currentView;
    }

    // Update colors if provided
    if (data.colors && typeof data.colors === 'object') {
        cleanConfig.data.colors = { ...cleanConfig.data.colors, ...data.colors };
    }

    console.log('✅ Dispatch configuration validation completed');
    return cleanConfig;
}

/**
 * Validate a single route object
 */
function validateRoute(route) {
    return route && 
           typeof route === 'object' && 
           typeof route.name === 'string' && 
           route.name.trim().length > 0 &&
           (typeof route.id === 'string' || typeof route.id === 'number');
}

/**
 * Clean and normalize a route object
 */
function cleanRoute(route, index) {
    return {
        id: route.id || `route-${index + 1}`,
        routeNumber: route.routeNumber || (index + 1),
        name: route.name.trim(),
        type: route.type || 'general-education',
        schedule: ['am', 'pm', 'both', 'none'].includes(route.schedule?.toLowerCase()) ? route.schedule : 'both',
        status: ['assigned', 'unassigned', 'inactive'].includes(route.status) ? route.status : 'unassigned',
        driver: route.driver || null,
        asset: route.asset || null,
        trailer: route.trailer || null,
        safetyEscorts: Array.isArray(route.safetyEscorts) ? route.safetyEscorts : [],
        notes: typeof route.notes === 'string' ? route.notes : '',
        destination: route.destination || null,
        createdAt: route.createdAt || new Date().toISOString(),
        updatedAt: route.updatedAt || new Date().toISOString()
    };
}

/**
 * Validate a single staff member object
 */
function validateStaff(staff) {
    return staff && 
           typeof staff === 'object' && 
           typeof staff.name === 'string' && 
           staff.name.trim().length > 0 &&
           (typeof staff.id === 'string' || typeof staff.id === 'number');
}

/**
 * Clean and normalize a staff member object
 */
function cleanStaff(staff) {
    const nameParts = staff.name.split(' ');
    return {
        id: staff.id,
        name: staff.name.trim(),
        firstName: staff.firstName || nameParts[0] || '',
        lastName: staff.lastName || nameParts.slice(1).join(' ') || '',
        employeeId: staff.employeeId || '',
        position: staff.position || '',
        role: staff.role || 'Driver',
        department: staff.department || 'Transportation',
        status: ['Active', 'Inactive'].includes(staff.status) ? staff.status : 'Active',
        phone: staff.phone || '',
        email: staff.email || '',
        notes: staff.notes || '',
        dateAdded: staff.dateAdded || new Date().toISOString()
    };
}

/**
 * Validate a single asset object
 */
function validateAsset(asset) {
    return asset && 
           typeof asset === 'object' && 
           typeof asset.name === 'string' && 
           asset.name.trim().length > 0;
}

/**
 * Clean and normalize an asset object
 */
function cleanAsset(asset) {
    return {
        name: asset.name.trim(),
        capacity: typeof asset.capacity === 'number' ? asset.capacity : 0,
        type: asset.type || 'Bus',
        status: ['active', 'inactive', 'maintenance'].includes(asset.status) ? asset.status : 'active',
        repairedDate: asset.repairedDate || null,
        details: asset.details || {
            make: 'Unknown',
            model: 'Unknown',
            year: 'Unknown',
            capacity: 'Unknown',
            vin: '',
            licensePlate: '',
            fuelType: 'Unknown',
            mileage: 'Unknown',
            lastService: null,
            nextService: null,
            notes: ''
        }
    };
}

/**
 * Validate a field trip object
 */
function validateFieldTrip(trip) {
    return trip && 
           typeof trip === 'object' && 
           typeof trip.id === 'string' && 
           typeof trip.destination === 'string';
}

/**
 * Validate a staff out entry
 */
function validateStaffOut(entry) {
    return entry && 
           typeof entry === 'object' && 
           typeof entry.name === 'string' && 
           entry.name.trim().length > 0;
}

/**
 * Validate and clean status timestamps
 */
function validateStatusTimestamps(timestamps) {
    const clean = {};
    
    if (typeof timestamps !== 'object') return clean;
    
    Object.entries(timestamps).forEach(([key, history]) => {
        if (Array.isArray(history)) {
            const validEntries = history.filter(entry => 
                entry && 
                typeof entry === 'object' && 
                typeof entry.status === 'string' && 
                typeof entry.timestamp === 'string'
            );
            
            if (validEntries.length > 0) {
                clean[key] = validEntries;
            }
        }
    });
    
    return clean;
}

/**
 * Remove unrelated localStorage data
 */
export function cleanUnrelatedData() {
    console.log('🧹 Cleaning unrelated localStorage data...');
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.includes('armageddon') || 
            key.includes('character_') ||
            key.startsWith('character_') ||
            key.includes('game_') ||
            key.includes('rpg_')
        )) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed unrelated data: ${key}`);
    });

    console.log(`✅ Removed ${keysToRemove.length} unrelated localStorage items`);
    return keysToRemove.length;
}

/**
 * Validate and repair localStorage data
 */
export function repairLocalStorageData() {
    console.log('🔧 Repairing localStorage data...');
    
    try {
        // Clean unrelated data first
        cleanUnrelatedData();
        
        // Get and validate dispatch configuration
        const configRaw = localStorage.getItem('dispatchConfig');
        if (configRaw) {
            const config = JSON.parse(configRaw);
            const cleanConfig = validateDispatchConfig(config);
            localStorage.setItem('dispatchConfig', JSON.stringify(cleanConfig));
            console.log('✅ Dispatch configuration repaired');
        } else {
            console.warn('⚠️ No dispatch configuration found in localStorage');
        }
        
        // Validate bus seater data
        const studentsRaw = localStorage.getItem('busSeaterStudents');
        if (studentsRaw) {
            const students = JSON.parse(studentsRaw);
            const cleanStudents = {};
            
            Object.entries(students).forEach(([id, student]) => {
                if (student && student.firstName && student.lastName) {
                    cleanStudents[id] = {
                        id: student.id || '',
                        firstName: student.firstName,
                        lastName: student.lastName,
                        grade: student.grade || 'N/A'
                    };
                }
            });
            
            localStorage.setItem('busSeaterStudents', JSON.stringify(cleanStudents));
            console.log(`✅ Bus seater students cleaned: ${Object.keys(cleanStudents).length} valid entries`);
        }
        
        console.log('✅ localStorage data repair completed');
        return true;
        
    } catch (error) {
        console.error('❌ Error repairing localStorage data:', error);
        return false;
    }
}

/**
 * Get localStorage usage statistics
 */
export function getStorageStats() {
    const stats = {
        totalItems: localStorage.length,
        totalSizeKB: 0,
        dispatch: { items: 0, sizeKB: 0 },
        busSeater: { items: 0, sizeKB: 0 },
        unrelated: { items: 0, sizeKB: 0, keys: [] }
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const sizeKB = (key.length + value.length) / 1024;
        
        stats.totalSizeKB += sizeKB;

        if (key.includes('dispatch') || key.includes('route') || key.includes('staff') || key.includes('asset')) {
            stats.dispatch.items++;
            stats.dispatch.sizeKB += sizeKB;
        } else if (key.includes('busSeater')) {
            stats.busSeater.items++;
            stats.busSeater.sizeKB += sizeKB;
        } else if (key.includes('armageddon') || key.includes('character') || key.includes('game') || key.includes('rpg')) {
            stats.unrelated.items++;
            stats.unrelated.sizeKB += sizeKB;
            stats.unrelated.keys.push(key);
        }
    }

    return stats;
}