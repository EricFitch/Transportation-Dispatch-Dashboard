/**
 * Fleet Management Module
 * Handles comprehensive fleet asset management
 */

import { eventBus } from '../core/utils.js';
import { STATE, getState, setState, saveToLocalStorage } from '../core/state.js';

export class FleetManagement {
    constructor() {
        this.assets = [];
        this.filteredAssets = [];
        this.currentFilters = {
            search: '',
            type: '',
            status: ''
        };
        this.init();
    }

    init() {
        this.loadAssets();
        this.setupEventListeners();
        this.renderFleetStats();
        this.renderFleetCards();
        console.log('🚛 Fleet Management initialized');
    }

    loadAssets() {
        try {
            this.assets = STATE.data?.assets || [];
            this.filteredAssets = [...this.assets];
            console.log(`📊 Loaded ${this.assets.length} fleet assets`);
        } catch (error) {
            console.error('❌ Error loading fleet assets:', error);
            this.assets = [];
            this.filteredAssets = [];
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('fleet-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilters.search = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Filter dropdowns
        const typeFilter = document.getElementById('type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentFilters.type = e.target.value;
                this.applyFilters();
            });
        }

        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentFilters.status = e.target.value;
                this.applyFilters();
            });
        }
    }

    applyFilters() {
        this.filteredAssets = this.assets.filter(asset => {
            const matchesSearch = !this.currentFilters.search || 
                asset.name.toLowerCase().includes(this.currentFilters.search) ||
                asset.type.toLowerCase().includes(this.currentFilters.search) ||
                (asset.status && asset.status.toLowerCase().includes(this.currentFilters.search));

            const matchesType = !this.currentFilters.type || asset.type === this.currentFilters.type;
            const matchesStatus = !this.currentFilters.status || asset.status === this.currentFilters.status;

            return matchesSearch && matchesType && matchesStatus;
        });

        this.renderFleetCards();
        console.log(`🔍 Filtered to ${this.filteredAssets.length} assets`);
    }

    renderFleetStats() {
        const statsContainer = document.getElementById('fleet-stats');
        if (!statsContainer) return;

        const stats = this.calculateFleetStats();
        
        const statsHtml = `
            <div class="text-center">
                <div class="text-3xl font-bold">${stats.total}</div>
                <div class="text-sm opacity-90">Total Assets</div>
            </div>
            <div class="text-center">
                <div class="text-3xl font-bold text-green-200">${stats.available}</div>
                <div class="text-sm opacity-90">Available</div>
            </div>
            <div class="text-center">
                <div class="text-3xl font-bold text-blue-200">${stats.inService}</div>
                <div class="text-sm opacity-90">In Service</div>
            </div>
            <div class="text-center">
                <div class="text-3xl font-bold text-red-200">${stats.down}</div>
                <div class="text-sm opacity-90">Down/Maintenance</div>
            </div>
        `;

        statsContainer.innerHTML = statsHtml;
    }

    calculateFleetStats() {
        const stats = {
            total: this.assets.length,
            available: 0,
            inService: 0,
            down: 0
        };

        this.assets.forEach(asset => {
            switch (asset.status) {
                case 'available':
                    stats.available++;
                    break;
                case 'in-service':
                    stats.inService++;
                    break;
                case 'down':
                case 'maintenance':
                    stats.down++;
                    break;
                default:
                    stats.available++; // Default to available
            }
        });

        return stats;
    }

    renderFleetCards() {
        const container = document.getElementById('fleet-cards-container');
        if (!container) return;

        if (this.filteredAssets.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="text-gray-400 text-lg">No assets found</div>
                    <div class="text-gray-500 text-sm mt-2">Try adjusting your search or filters</div>
                </div>
            `;
            return;
        }

        const cardsHtml = this.filteredAssets.map(asset => this.createAssetCard(asset)).join('');
        container.innerHTML = cardsHtml;
    }

    createAssetCard(asset) {
        const detailsData = this.getAssetDetails(asset);
        const status = asset.status || 'available';
        
        return `
            <div class="fleet-card ${status} bg-white rounded-lg shadow-sm p-6 cursor-pointer" 
                 onclick="openAssetDetails('${asset.name}')">
                <!-- Header -->
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-900">${asset.name}</h3>
                        <p class="text-sm text-gray-500">${asset.type || 'Unknown Type'}</p>
                    </div>
                    <span class="status-indicator status-${status}">
                        ${this.getStatusIcon(status)} ${this.getStatusLabel(status)}
                    </span>
                </div>

                <!-- Key Info -->
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-gray-600">Capacity:</span>
                        <span class="text-sm text-gray-900">${detailsData.capacity || 'N/A'}</span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-gray-600">Year:</span>
                        <span class="text-sm text-gray-900">${detailsData.year || 'N/A'}</span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-gray-600">Mileage:</span>
                        <span class="text-sm text-gray-900">${detailsData.mileage || 'N/A'}</span>
                    </div>

                    ${detailsData.nextService ? `
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-gray-600">Next Service:</span>
                        <span class="text-sm ${this.isServiceDue(detailsData.nextService) ? 'text-red-600 font-medium' : 'text-gray-900'}">
                            ${detailsData.nextService}
                        </span>
                    </div>
                    ` : ''}
                </div>

                <!-- Current Assignment -->
                ${this.getCurrentAssignment(asset.name)}

                <!-- Actions -->
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button onclick="event.stopPropagation(); editAsset('${asset.name}')" 
                            class="flex-1 text-sm bg-blue-50 text-blue-600 py-2 px-3 rounded hover:bg-blue-100">
                        Edit Details
                    </button>
                    <button onclick="event.stopPropagation(); toggleAssetStatus('${asset.name}')" 
                            class="flex-1 text-sm bg-gray-50 text-gray-600 py-2 px-3 rounded hover:bg-gray-100">
                        Change Status
                    </button>
                </div>
            </div>
        `;
    }

    getAssetDetails(asset) {
        // Get extended details from asset.details or create defaults
        const details = asset.details || {};
        return {
            capacity: details.capacity || this.getDefaultCapacity(asset.type),
            year: details.year || 'Unknown',
            mileage: details.mileage || 'Unknown',
            nextService: details.nextService || null,
            make: details.make || 'Unknown',
            model: details.model || 'Unknown',
            vin: details.vin || '',
            licensePlate: details.licensePlate || '',
            fuelType: details.fuelType || 'Unknown',
            lastService: details.lastService || null,
            notes: details.notes || ''
        };
    }

    getDefaultCapacity(type) {
        const capacities = {
            'Bus': '72 passengers',
            'Van': '12 passengers',
            'Truck': '2 passengers',
            'Trailer': 'N/A',
            'Other': 'Unknown'
        };
        return capacities[type] || 'Unknown';
    }

    getCurrentAssignment(assetName) {
        // Check if asset is assigned to any route
        const assignedRoute = STATE.data?.routes?.find(route => 
            route.asset?.name === assetName || route.trailer?.name === assetName
        );

        if (assignedRoute) {
            const isTrailer = assignedRoute.trailer?.name === assetName;
            return `
                <div class="mt-3 p-2 bg-blue-50 rounded border-l-4 border-blue-400">
                    <div class="text-xs font-medium text-blue-800">Currently Assigned</div>
                    <div class="text-sm text-blue-700">
                        ${assignedRoute.name || `Route ${assignedRoute.routeNumber}`}
                        ${isTrailer ? ' (Trailer)' : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="mt-3 p-2 bg-green-50 rounded border-l-4 border-green-400">
                <div class="text-xs font-medium text-green-800">Available for Assignment</div>
            </div>
        `;
    }

    getStatusIcon(status) {
        const icons = {
            'available': '✓',
            'in-service': '🚌',
            'down': '⚠️',
            'maintenance': '🔧'
        };
        return icons[status] || '•';
    }

    getStatusLabel(status) {
        const labels = {
            'available': 'Available',
            'in-service': 'In Service',
            'down': 'Down',
            'maintenance': 'Maintenance'
        };
        return labels[status] || 'Unknown';
    }

    isServiceDue(nextService) {
        if (!nextService) return false;
        const today = new Date();
        const serviceDate = new Date(nextService);
        const diffDays = (serviceDate - today) / (1000 * 60 * 60 * 24);
        return diffDays <= 30; // Due within 30 days
    }

    showAssetDetailsModal(assetName) {
        const asset = this.assets.find(a => a.name === assetName);
        if (!asset) return;

        const details = this.getAssetDetails(asset);
        const assignment = this.getCurrentAssignmentText(assetName);

        const modalContent = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
                    <div class="space-y-2">
                        <div><span class="font-medium text-gray-600">Asset Number:</span> ${asset.name}</div>
                        <div><span class="font-medium text-gray-600">Type:</span> ${asset.type}</div>
                        <div><span class="font-medium text-gray-600">Status:</span> <span class="status-indicator status-${asset.status || 'available'}">${this.getStatusLabel(asset.status || 'available')}</span></div>
                        <div><span class="font-medium text-gray-600">Make:</span> ${details.make}</div>
                        <div><span class="font-medium text-gray-600">Model:</span> ${details.model}</div>
                        <div><span class="font-medium text-gray-600">Year:</span> ${details.year}</div>
                        <div><span class="font-medium text-gray-600">Capacity:</span> ${details.capacity}</div>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Technical Details</h3>
                    <div class="space-y-2">
                        <div><span class="font-medium text-gray-600">VIN:</span> ${details.vin || 'Not specified'}</div>
                        <div><span class="font-medium text-gray-600">License Plate:</span> ${details.licensePlate || 'Not specified'}</div>
                        <div><span class="font-medium text-gray-600">Fuel Type:</span> ${details.fuelType}</div>
                        <div><span class="font-medium text-gray-600">Mileage:</span> ${details.mileage}</div>
                        <div><span class="font-medium text-gray-600">Last Service:</span> ${details.lastService || 'Not recorded'}</div>
                        <div><span class="font-medium text-gray-600">Next Service:</span> ${details.nextService || 'Not scheduled'}</div>
                    </div>
                </div>
                
                <div class="md:col-span-2 space-y-4">
                    <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Current Assignment</h3>
                    <div>${assignment}</div>
                    
                    ${details.notes ? `
                    <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Notes</h3>
                    <div class="bg-gray-50 p-3 rounded border">${details.notes}</div>
                    ` : ''}
                </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button onclick="closeAssetModal()" class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                    Close
                </button>
                <button onclick="editAsset('${assetName}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Edit Details
                </button>
            </div>
        `;

        this.showModal(`Asset Details - ${assetName}`, modalContent);
    }

    showEditAssetModal(assetName) {
        const asset = this.assets.find(a => a.name === assetName);
        if (!asset) return;

        const details = this.getAssetDetails(asset);

        const modalContent = `
            <form id="edit-asset-form" class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Asset Number</label>
                            <input type="text" name="name" value="${asset.name}" readonly 
                                   class="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select name="type" class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                                <option value="Bus" ${asset.type === 'Bus' ? 'selected' : ''}>Bus</option>
                                <option value="Van" ${asset.type === 'Van' ? 'selected' : ''}>Van</option>
                                <option value="Truck" ${asset.type === 'Truck' ? 'selected' : ''}>Truck</option>
                                <option value="Trailer" ${asset.type === 'Trailer' ? 'selected' : ''}>Trailer</option>
                                <option value="Other" ${asset.type === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Make</label>
                            <input type="text" name="make" value="${details.make}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
                            <input type="text" name="model" value="${details.model}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                            <input type="number" name="year" value="${details.year !== 'Unknown' ? details.year : ''}" 
                                   min="1990" max="2030" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                            <input type="text" name="capacity" value="${details.capacity}" placeholder="e.g., 72 passengers" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Technical Details</h3>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">VIN Number</label>
                            <input type="text" name="vin" value="${details.vin}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                            <input type="text" name="licensePlate" value="${details.licensePlate}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                            <select name="fuelType" class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                                <option value="Diesel" ${details.fuelType === 'Diesel' ? 'selected' : ''}>Diesel</option>
                                <option value="Gasoline" ${details.fuelType === 'Gasoline' ? 'selected' : ''}>Gasoline</option>
                                <option value="Electric" ${details.fuelType === 'Electric' ? 'selected' : ''}>Electric</option>
                                <option value="Hybrid" ${details.fuelType === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                                <option value="Unknown" ${details.fuelType === 'Unknown' ? 'selected' : ''}>Unknown</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Current Mileage</label>
                            <input type="text" name="mileage" value="${details.mileage !== 'Unknown' ? details.mileage : ''}" 
                                   placeholder="e.g., 125,000 miles" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Last Service Date</label>
                            <input type="date" name="lastService" value="${details.lastService || ''}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Next Service Due</label>
                            <input type="date" name="nextService" value="${details.nextService || ''}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-gray-900 border-b pb-2">Notes</h3>
                    <textarea name="notes" rows="4" placeholder="Enter any notes about this asset..." 
                              class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">${details.notes}</textarea>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeAssetModal()" 
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" 
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Save Changes
                    </button>
                </div>
            </form>
        `;

        this.showModal(`Edit Asset - ${assetName}`, modalContent);
        
        // Add form submit handler
        document.getElementById('edit-asset-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAssetDetails(assetName, new FormData(e.target));
        });
    }

    showStatusChangeModal(assetName) {
        const asset = this.assets.find(a => a.name === assetName);
        if (!asset) return;

        const currentStatus = asset.status || 'available';

        const modalContent = `
            <div class="space-y-4">
                <p class="text-gray-600">Change the status for <strong>${assetName}</strong></p>
                
                <div class="space-y-3">
                    <label class="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="status" value="available" ${currentStatus === 'available' ? 'checked' : ''} 
                               class="mr-3 text-blue-600">
                        <div class="flex items-center">
                            <span class="status-indicator status-available mr-2">✓ Available</span>
                            <span class="text-sm text-gray-600">Ready for assignment</span>
                        </div>
                    </label>
                    
                    <label class="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="status" value="in-service" ${currentStatus === 'in-service' ? 'checked' : ''} 
                               class="mr-3 text-blue-600">
                        <div class="flex items-center">
                            <span class="status-indicator status-in-service mr-2">🚌 In Service</span>
                            <span class="text-sm text-gray-600">Currently on a route</span>
                        </div>
                    </label>
                    
                    <label class="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="status" value="maintenance" ${currentStatus === 'maintenance' ? 'checked' : ''} 
                               class="mr-3 text-blue-600">
                        <div class="flex items-center">
                            <span class="status-indicator status-maintenance mr-2">🔧 Maintenance</span>
                            <span class="text-sm text-gray-600">Scheduled maintenance</span>
                        </div>
                    </label>
                    
                    <label class="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="status" value="down" ${currentStatus === 'down' ? 'checked' : ''} 
                               class="mr-3 text-blue-600">
                        <div class="flex items-center">
                            <span class="status-indicator status-down mr-2">⚠️ Down</span>
                            <span class="text-sm text-gray-600">Out of service</span>
                        </div>
                    </label>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <textarea id="status-reason" rows="3" placeholder="Enter reason for status change..." 
                              class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
                
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="closeAssetModal()" 
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onclick="window.fleetManager.saveAssetStatus('${assetName}')" 
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Update Status
                    </button>
                </div>
            </div>
        `;

        this.showModal(`Change Status - ${assetName}`, modalContent);
    }

    showModal(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('asset-modal').classList.remove('hidden');
    }

    getCurrentAssignmentText(assetName) {
        const assignedRoute = STATE.data?.routes?.find(route => 
            route.asset?.name === assetName || route.trailer?.name === assetName
        );

        if (assignedRoute) {
            const isTrailer = assignedRoute.trailer?.name === assetName;
            return `<div class="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                <div class="font-medium text-blue-800">Currently Assigned</div>
                <div class="text-blue-700">
                    ${assignedRoute.name || `Route ${assignedRoute.routeNumber}`}
                    ${isTrailer ? ' (as Trailer)' : ''}
                </div>
            </div>`;
        }

        return `<div class="p-3 bg-green-50 rounded border-l-4 border-green-400">
            <div class="font-medium text-green-800">Available for Assignment</div>
        </div>`;
    }

    saveAssetDetails(assetName, formData) {
        const asset = this.assets.find(a => a.name === assetName);
        if (!asset) return;

        // Basic validation
        const year = formData.get('year');
        if (year && (isNaN(year) || year < 1990 || year > 2030)) {
            alert('Please enter a valid year between 1990 and 2030');
            return;
        }

        const capacity = formData.get('capacity');
        if (!capacity || capacity.trim() === '') {
            alert('Please enter a capacity value');
            return;
        }

        // Update asset properties
        asset.type = formData.get('type');
        
        // Initialize details object if it doesn't exist
        if (!asset.details) {
            asset.details = {};
        }

        // Update details
        asset.details.make = formData.get('make') || 'Unknown';
        asset.details.model = formData.get('model') || 'Unknown';
        asset.details.year = formData.get('year') || 'Unknown';
        asset.details.capacity = formData.get('capacity') || this.getDefaultCapacity(asset.type);
        asset.details.vin = formData.get('vin') || '';
        asset.details.licensePlate = formData.get('licensePlate') || '';
        asset.details.fuelType = formData.get('fuelType') || 'Unknown';
        asset.details.mileage = formData.get('mileage') || 'Unknown';
        asset.details.lastService = formData.get('lastService') || null;
        asset.details.nextService = formData.get('nextService') || null;
        asset.details.notes = formData.get('notes') || '';

        // Add update timestamp to notes
        const timestamp = new Date().toLocaleString();
        const updateNote = `${timestamp}: Asset details updated`;
        asset.details.notes = asset.details.notes ? `${asset.details.notes}\n\n${updateNote}` : updateNote;

        // Save to localStorage
        saveToLocalStorage();
        
        // Refresh the page
        this.renderFleetCards();
        this.renderFleetStats();
        
        // Close modal
        closeAssetModal();
        
        // Show success message
        this.showSuccessMessage(`Asset ${assetName} details updated successfully`);
        
        console.log(`✅ Asset ${assetName} details updated successfully`);
    }

    saveAssetStatus(assetName) {
        const selectedStatus = document.querySelector('input[name="status"]:checked')?.value;
        const reason = document.getElementById('status-reason')?.value;
        
        if (!selectedStatus) {
            alert('Please select a status');
            return;
        }

        const asset = this.assets.find(a => a.name === assetName);
        if (!asset) return;

        asset.status = selectedStatus;
        
        // Add status change to notes if reason provided
        if (reason) {
            if (!asset.details) asset.details = {};
            const timestamp = new Date().toLocaleString();
            const statusNote = `${timestamp}: Status changed to ${this.getStatusLabel(selectedStatus)} - ${reason}`;
            asset.details.notes = asset.details.notes ? `${asset.details.notes}\n\n${statusNote}` : statusNote;
        }

        // Save to localStorage
        saveToLocalStorage();
        
        // Refresh the page
        this.renderFleetCards();
        this.renderFleetStats();
        
        // Close modal
        closeAssetModal();
        
        console.log(`✅ Asset ${assetName} status changed to ${selectedStatus}`);
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        // Remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
window.openAssetDetails = function(assetName) {
    console.log('Opening details for asset:', assetName);
    const fleetManager = window.fleetManager;
    if (fleetManager) {
        fleetManager.showAssetDetailsModal(assetName);
    }
};

window.editAsset = function(assetName) {
    console.log('Editing asset:', assetName);
    const fleetManager = window.fleetManager;
    if (fleetManager) {
        fleetManager.showEditAssetModal(assetName);
    }
};

window.toggleAssetStatus = function(assetName) {
    console.log('Toggling status for asset:', assetName);
    const fleetManager = window.fleetManager;
    if (fleetManager) {
        fleetManager.showStatusChangeModal(assetName);
    }
};

window.addNewAsset = function() {
    console.log('Adding new asset');
    // Will implement add new asset functionality
    alert('Add New Asset - Coming Soon!');
};

window.exportFleetData = function() {
    console.log('Exporting fleet data');
    // Will implement export functionality
    alert('Export Fleet Data - Coming Soon!');
};

window.resetFilters = function() {
    document.getElementById('fleet-search').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('status-filter').value = '';
    
    if (window.fleetManager) {
        window.fleetManager.currentFilters = { search: '', type: '', status: '' };
        window.fleetManager.applyFilters();
    }
};

window.closeAssetModal = function() {
    const modal = document.getElementById('asset-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fleetManager = new FleetManagement();
});

export default FleetManagement;