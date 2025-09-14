/**
 * UI SYSTEM MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive UI management system that handles:
 * - Modal dialogs and overlays
 * - Notifications and alerts  
 * - Settings interface
 * - Search functionality
 * - Summary displays
 * - Layout management
 * 
 * Dependencies: core/events, core/state, core/utils
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { debounce, formatTime, createElement } from '../core/utils.js';

class UISystem {
  constructor() {
    this.activeModal = null;
    this.searchState = {
      activeFilters: {
        global: '',
        staff: '',
        routes: '',
        assets: '',
        timeRange: { from: '', to: '' },
        options: {
          fuzzySearch: false,
          caseSensitive: false,
          wholeWords: false
        }
      },
      savedSearches: JSON.parse(localStorage.getItem('dispatch_saved_searches') || '[]'),
      results: []
    };
    this.notifications = new Map();
    this.settingsCache = null;
    this.layoutState = {
      focusedPanel: null,
      panelOrder: ['staff', 'routes', 'assets', 'fleet'],
      itemsPerRow: new Map()
    };
    
    this.init();
  }

  /**
   * Initialize UI System
   */
  init() {
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupModalSystem();
    this.setupSearchSystem();
    this.setupNotificationSystem();
    this.updateLayoutMetrics();
    this.restoreUserPreferences();
    
    console.log('🎨 UI System initialized');
    eventBus.emit('ui-system-ready');
  }

  // ===== MODAL SYSTEM =====

  /**
   * Setup modal system with event delegation
   */
  setupModalSystem() {
    // Modal overlay click handling
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeCurrentModal();
      }
    });

    // ESC key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen()) {
        this.closeCurrentModal();
      }
    });

    // Modal form submissions
    document.addEventListener('submit', (e) => {
      if (e.target.closest('.modal')) {
        e.preventDefault();
        this.handleModalSubmission(e.target);
      }
    });
  }

  /**
   * Check if any modal is currently open
   */
  isModalOpen() {
    return this.activeModal !== null;
  }

  /**
   * Close currently active modal
   */
  closeCurrentModal() {
    if (!this.activeModal) return;

    const modal = document.getElementById(this.activeModal);
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none'; // Force hide
      modal.setAttribute('aria-hidden', 'true');
    }

    this.activeModal = null;
    eventBus.emit('modal-closed');
    
    // Return focus to trigger element if available
    const triggerElement = document.querySelector('[data-modal-trigger]');
    if (triggerElement) {
      triggerElement.focus();
    }
  }

  /**
   * Open staff out dialog
   */
  openStaffOutDialog(staffId = null) {
    const availableStaff = STATE.staff.filter(s => s.status === 'available');
    
    const modal = this.createModal('staff-out-modal', 'Set Staff Out', `
      <form class="modal-form">
        <div class="form-group">
          <label for="staff-select">Select Staff Member:</label>
          <select id="staff-select" required>
            <option value="">Choose staff member...</option>
            ${availableStaff.map(staff => 
              `<option value="${staff.id}" ${staffId === staff.id ? 'selected' : ''}>
                ${staff.name} - ${staff.role}
              </option>`
            ).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="out-reason">Reason:</label>
          <select id="out-reason" required>
            <option value="">Select reason...</option>
            <option value="route">Assigned to Route</option>
            <option value="break">Break</option>
            <option value="lunch">Lunch</option>
            <option value="training">Training</option>
            <option value="maintenance">Vehicle Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="out-notes">Notes (optional):</label>
          <textarea id="out-notes" rows="3" placeholder="Additional details..."></textarea>
        </div>
        
        <div class="form-group">
          <label for="estimated-return">Estimated Return:</label>
          <input type="time" id="estimated-return">
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-danger">Set Out</button>
        </div>
      </form>
    `);

    this.openModal(modal.id);
  }

  /**
   * Open staff in dialog
   */
  openStaffInDialog(staffId = null) {
    const outStaff = STATE.staff.filter(s => s.status === 'out');
    
    const modal = this.createModal('staff-in-modal', 'Set Staff In', `
      <form class="modal-form">
        <div class="form-group">
          <label for="staff-in-select">Select Staff Member:</label>
          <select id="staff-in-select" required>
            <option value="">Choose staff member...</option>
            ${outStaff.map(staff => 
              `<option value="${staff.id}" ${staffId === staff.id ? 'selected' : ''}>
                ${staff.name} - ${staff.role} (Out: ${staff.outReason || 'Unknown'})
              </option>`
            ).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="return-notes">Return Notes (optional):</label>
          <textarea id="return-notes" rows="3" placeholder="Any issues or updates..."></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-success">Set In</button>
        </div>
      </form>
    `);

    this.openModal(modal.id);
  }

  /**
   * Open asset toggle dialog
   */
  openAssetToggleDialog(assetId = null) {
    const assets = STATE.assets || [];
    
    const modal = this.createModal('asset-toggle-modal', 'Toggle Asset Status', `
      <form class="modal-form">
        <div class="form-group">
          <label for="asset-select">Select Asset:</label>
          <select id="asset-select" required>
            <option value="">Choose asset...</option>
            ${assets.map(asset => 
              `<option value="${asset.id}" ${assetId === asset.id ? 'selected' : ''}>
                ${asset.number} - ${asset.type} (${asset.status})
              </option>`
            ).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="new-status">New Status:</label>
          <select id="new-status" required>
            <option value="">Select status...</option>
            <option value="available">Available</option>
            <option value="in-service">In Service</option>
            <option value="maintenance">Maintenance</option>
            <option value="out-of-service">Out of Service</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="status-reason">Reason:</label>
          <textarea id="status-reason" rows="3" placeholder="Reason for status change..."></textarea>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Status</button>
        </div>
      </form>
    `);

    this.openModal(modal.id);
  }

  /**
   * Open advanced search dialog
   */
  openAdvancedSearchDialog() {
    const modal = this.createModal('advanced-search-modal', 'Advanced Search', `
      <form class="modal-form search-form">
        <div class="search-tabs">
          <button type="button" class="tab-btn active" data-tab="general">General</button>
          <button type="button" class="tab-btn" data-tab="filters">Filters</button>
          <button type="button" class="tab-btn" data-tab="saved">Saved</button>
        </div>
        
        <div class="tab-content" id="general-tab">
          <div class="form-group">
            <label for="global-search">Global Search:</label>
            <input type="text" id="global-search" value="${this.searchState.activeFilters.global}" 
                   placeholder="Search across all data...">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="staff-search">Staff Search:</label>
              <input type="text" id="staff-search" value="${this.searchState.activeFilters.staff}" 
                     placeholder="Search staff...">
            </div>
            <div class="form-group">
              <label for="routes-search">Routes Search:</label>
              <input type="text" id="routes-search" value="${this.searchState.activeFilters.routes}" 
                     placeholder="Search routes...">
            </div>
          </div>
          
          <div class="form-group">
            <label for="assets-search">Assets Search:</label>
            <input type="text" id="assets-search" value="${this.searchState.activeFilters.assets}" 
                   placeholder="Search assets...">
          </div>
        </div>
        
        <div class="tab-content hidden" id="filters-tab">
          <div class="form-row">
            <div class="form-group">
              <label for="time-from">Time From:</label>
              <input type="time" id="time-from" value="${this.searchState.activeFilters.timeRange.from}">
            </div>
            <div class="form-group">
              <label for="time-to">Time To:</label>
              <input type="time" id="time-to" value="${this.searchState.activeFilters.timeRange.to}">
            </div>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="fuzzy-search" ${this.searchState.activeFilters.options.fuzzySearch ? 'checked' : ''}>
              Fuzzy Search (approximate matching)
            </label>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="case-sensitive" ${this.searchState.activeFilters.options.caseSensitive ? 'checked' : ''}>
              Case Sensitive
            </label>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="whole-words" ${this.searchState.activeFilters.options.wholeWords ? 'checked' : ''}>
              Whole Words Only
            </label>
          </div>
        </div>
        
        <div class="tab-content hidden" id="saved-tab">
          <div class="saved-searches-list">
            ${this.renderSavedSearches()}
          </div>
          
          <div class="form-group">
            <label for="save-search-name">Save Current Search:</label>
            <input type="text" id="save-search-name" placeholder="Enter search name...">
            <button type="button" class="btn btn-secondary" onclick="uiSystem.saveCurrentSearch()">Save</button>
          </div>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.clearAllSearches()">Clear All</button>
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Search</button>
        </div>
      </form>
    `);

    this.openModal(modal.id);
    this.setupSearchModalHandlers();
  }

  /**
   * Open settings dialog
   */
  openSettings() {
    const modal = this.createModal('settings-modal', 'Settings', `
      <div class="settings-content">
        <div class="settings-tabs">
          <button type="button" class="tab-btn active" data-tab="display">Display</button>
          <button type="button" class="tab-btn" data-tab="behavior">Behavior</button>
          <button type="button" class="tab-btn" data-tab="controls">Controls</button>
          <button type="button" class="tab-btn" data-tab="data">Data</button>
        </div>
        
        <div class="tab-content" id="display-tab">
          <form class="settings-form">
            <div class="form-group">
              <label for="theme-select">Theme:</label>
              <select id="theme-select">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (system)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="density-select">Display Density:</label>
              <select id="density-select">
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="panel-layout">Panel Layout:</label>
              <select id="panel-layout">
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="cards">Cards</option>
              </select>
            </div>
            
            <div class="color-settings">
              <h4>Status Colors</h4>
              ${this.renderColorSettings()}
            </div>
          </form>
        </div>
        
        <div class="tab-content hidden" id="behavior-tab">
          <form class="settings-form">
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="auto-refresh">
                Auto-refresh data (30 seconds)
              </label>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="sound-notifications">
                Sound notifications
              </label>
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="confirm-actions">
                Confirm destructive actions
              </label>
            </div>
            
            <div class="form-group">
              <label for="default-view">Default View on Load:</label>
              <select id="default-view">
                <option value="dashboard">Dashboard</option>
                <option value="staff">Staff Panel</option>
                <option value="routes">Routes Panel</option>
                <option value="assets">Assets Panel</option>
              </select>
            </div>
          </form>
        </div>
        
        <div class="tab-content hidden" id="controls-tab">
          ${this.renderKeyboardShortcuts()}
        </div>
        
        <div class="tab-content hidden" id="data-tab">
          <form class="settings-form">
            <div class="form-group">
              <label for="backup-frequency">Auto-backup Frequency:</label>
              <select id="backup-frequency">
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div class="form-group">
              <button type="button" class="btn btn-secondary" onclick="uiSystem.exportData()">Export Data</button>
              <button type="button" class="btn btn-secondary" onclick="uiSystem.importData()">Import Data</button>
            </div>
            
            <div class="form-group">
              <button type="button" class="btn btn-warning" onclick="uiSystem.clearCache()">Clear Cache</button>
              <button type="button" class="btn btn-danger" onclick="uiSystem.resetToDefaults()">Reset to Defaults</button>
            </div>
          </form>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="uiSystem.saveSettings()">Save Settings</button>
        </div>
      </div>
    `);

    this.openModal(modal.id);
    this.setupSettingsHandlers();
  }

  /**
   * Open keyboard shortcuts help
   */
  openShortcutsHelp() {
    this.openSettings();
    // Switch to controls tab
    setTimeout(() => {
      const controlsTab = document.querySelector('[data-tab="controls"]');
      if (controlsTab) {
        this.showSettingsTab('controls');
      }
    }, 100);
  }

  /**
   * Open Route Management modal dialog
   */
  openRouteManagementDialog() {
    const modal = this.createModal('route-management-modal', 'Route Management', `
      <div class="route-management-container">
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-blue-700 mb-4">📋 Manage Routes</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="route-form-section">
              <h4 class="font-medium text-gray-700 mb-3">Add New Route</h4>
              <form id="add-route-form" class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
                  <input type="text" id="route-name" class="w-full p-2 border rounded" placeholder="Route name" required>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select id="route-shift" class="w-full p-2 border rounded" required>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select id="route-status" class="w-full p-2 border rounded">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full">Add Route</button>
              </form>
            </div>
            <div class="route-list-section">
              <h4 class="font-medium text-gray-700 mb-3">Current Routes</h4>
              <div id="route-list-modal" class="space-y-2 max-h-64 overflow-y-auto">
                <!-- Routes will be populated here -->
              </div>
            </div>
          </div>
        </div>
        <div class="border-t pt-4">
          <div class="flex justify-between items-center">
            <div class="text-sm text-gray-600">
              <span id="route-count-modal">0</span> routes total
            </div>
            <div class="space-x-2">
              <button class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm" onclick="uiSystem.exportRoutes()">Export Routes</button>
              <input type="file" id="import-routes-modal" accept=".csv,.json" style="display: none">
              <button class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm" onclick="document.getElementById('import-routes-modal').click()">Import Routes</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.openModal(modal.id);
    this.setupRouteManagementHandlers();
  }

  /**
   * Open Asset Management modal dialog
   */
  openAssetManagementDialog() {
    const modal = this.createModal('asset-management-modal', 'Asset Management', `
      <div class="asset-management-container">
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-green-700 mb-4">🚛 Manage Assets</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="asset-form-section">
              <h4 class="font-medium text-gray-700 mb-3">Add New Asset</h4>
              <form id="add-asset-form-modal" class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Asset Name/ID</label>
                  <input type="text" id="asset-name-modal" class="w-full p-2 border rounded" placeholder="Asset name or ID" required>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select id="asset-type-modal" class="w-full p-2 border rounded" required>
                    <option value="Bus">Bus</option>
                    <option value="Van">Van</option>
                    <option value="Car">Car</option>
                    <option value="Suburban">Suburban</option>
                    <option value="Wheelchair Bus">Wheelchair Bus</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select id="asset-status-modal" class="w-full p-2 border rounded">
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Out of Service">Out of Service</option>
                  </select>
                </div>
                <button type="submit" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full">Add Asset</button>
              </form>
            </div>
            <div class="asset-list-section">
              <h4 class="font-medium text-gray-700 mb-3">Current Assets</h4>
              <div id="asset-list-modal" class="space-y-2 max-h-64 overflow-y-auto">
                <!-- Assets will be populated here -->
              </div>
            </div>
          </div>
        </div>
        <div class="border-t pt-4">
          <div class="flex justify-between items-center">
            <div class="text-sm text-gray-600">
              <span id="asset-count-modal">0</span> assets total
            </div>
            <div class="space-x-2">
              <button class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm" onclick="uiSystem.exportAssets()">Export Assets</button>
              <input type="file" id="import-assets-modal" accept=".csv,.json" style="display: none">
              <button class="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm" onclick="document.getElementById('import-assets-modal').click()">Import Assets</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.openModal(modal.id);
    this.setupAssetManagementHandlers();
  }

  /**
   * Create generic modal structure
   */
  createModal(id, title, content) {
    // Remove existing modal if present
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const modal = createElement('div', {
      id: id,
      className: 'modal-overlay hidden',
      'aria-hidden': 'true',
      'aria-labelledby': `${id}-title`,
      role: 'dialog'
    });

    modal.innerHTML = `
      <div class="modal-container">
        <div class="modal-header">
          <h3 id="${id}-title">${title}</h3>
          <button type="button" class="modal-close" onclick="uiSystem.closeCurrentModal()" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-content">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * Open modal by ID
   */
  openModal(modalId) {
    // Close any existing modal
    this.closeCurrentModal();

    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');
    // Force display style to override any CSS conflicts
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    this.activeModal = modalId;

    // Focus first focusable element
    setTimeout(() => {
      const firstFocusable = modal.querySelector('input, select, textarea, button');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }, 100);

    eventBus.emit('modal-opened', { modalId });
  }

  /**
   * Setup Route Management modal handlers
   */
  setupRouteManagementHandlers() {
    const form = document.getElementById('add-route-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const routeName = document.getElementById('route-name').value;
        const routeShift = document.getElementById('route-shift').value;
        const routeStatus = document.getElementById('route-status').value;
        
        if (routeName) {
          // Add route using the state management system
          const routeData = {
            name: routeName,
            shift: routeShift,
            status: routeStatus,
            assigned: false,
            driver: null,
            asset: null
          };
          
          eventBus.emit('route:add', routeData);
          form.reset();
          this.refreshRouteList();
          this.showNotification(`Route "${routeName}" added successfully`, 'success');
        }
      });
    }
    
    this.refreshRouteList();
  }

  /**
   * Setup Asset Management modal handlers  
   */
  setupAssetManagementHandlers() {
    const form = document.getElementById('add-asset-form-modal');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const assetName = document.getElementById('asset-name-modal').value;
        const assetType = document.getElementById('asset-type-modal').value;
        const assetStatus = document.getElementById('asset-status-modal').value;
        
        if (assetName) {
          // Add asset using the state management system
          const assetData = {
            name: assetName,
            type: assetType,
            status: assetStatus,
            assigned: false,
            route: null
          };
          
          eventBus.emit('asset:add', assetData);
          form.reset();
          this.refreshAssetList();
          this.showNotification(`Asset "${assetName}" added successfully`, 'success');
        }
      });
    }
    
    this.refreshAssetList();
  }

  /**
   * Refresh route list in modal
   */
  refreshRouteList() {
    const routeList = document.getElementById('route-list-modal');
    const routeCount = document.getElementById('route-count-modal');
    
    if (routeList && STATE.routes) {
      routeList.innerHTML = STATE.routes.map(route => `
        <div class="route-item bg-gray-50 p-3 rounded border flex justify-between items-center">
          <div>
            <span class="font-semibold">${route.name}</span>
            <span class="text-sm text-gray-600 ml-2">${route.shift}</span>
            <span class="status-badge ${route.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} ml-2">${route.status}</span>
          </div>
          <div class="space-x-1">
            <button class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" onclick="uiSystem.editRoute('${route.name}')">Edit</button>
            <button class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200" onclick="uiSystem.deleteRoute('${route.name}')">Delete</button>
          </div>
        </div>
      `).join('');
      
      if (routeCount) {
        routeCount.textContent = STATE.routes.length;
      }
    }
  }

  /**
   * Refresh asset list in modal
   */
  refreshAssetList() {
    const assetList = document.getElementById('asset-list-modal');
    const assetCount = document.getElementById('asset-count-modal');
    
    if (assetList && STATE.data && STATE.data.assets) {
      assetList.innerHTML = STATE.data.assets.map(asset => `
        <div class="asset-item bg-gray-50 p-3 rounded border flex justify-between items-center">
          <div>
            <span class="font-semibold">${asset.name}</span>
            <span class="text-sm text-gray-600 ml-2">${asset.type}</span>
            ${asset.capacity ? `<span class="text-xs text-blue-600 ml-2">${asset.capacity} seats</span>` : ''}
            <span class="status-badge ${asset.status === 'active' ? 'bg-green-100 text-green-700' : asset.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} ml-2">${asset.status}</span>
          </div>
          <div class="space-x-1">
            <button class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200" onclick="uiSystem.editAsset('${asset.name}')">Edit</button>
            <button class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200" onclick="uiSystem.deleteAsset('${asset.name}')">Delete</button>
          </div>
        </div>
      `).join('');
      
      if (assetCount) {
        assetCount.textContent = STATE.data.assets.length;
      }
    }
    
    // Also refresh the Resource Monitor panel asset list
    if (window.renderAssetPanel) {
      window.renderAssetPanel();
    }
  }

  // ===== SEARCH SYSTEM =====

  /**
   * Setup search system
   */
  setupSearchSystem() {
    // Debounced search handlers
    this.debouncedSearch = debounce(this.performSearch.bind(this), 300);
    
    // Search input listeners
    document.addEventListener('input', (e) => {
      if (e.target.matches('.search-input')) {
        this.handleSearchInput(e.target);
      }
    });
  }

  /**
   * Handle search input changes
   */
  handleSearchInput(input) {
    const searchType = input.dataset.searchType || 'global';
    const value = input.value.trim();
    
    this.searchState.activeFilters[searchType] = value;
    this.debouncedSearch();
  }

  /**
   * Perform comprehensive search
   */
  performSearch() {
    const filters = this.searchState.activeFilters;
    const options = filters.options;
    let results = [];

    console.log('🔍 Performing search with filters:', filters);

    // Search staff if global or staff-specific search
    if (filters.global || filters.staff) {
      const staffResults = this.searchStaff(filters.global || filters.staff, options);
      results.push(...staffResults.map(r => ({ ...r, type: 'staff' })));
    }

    // Search routes if global or route-specific search
    if (filters.global || filters.routes) {
      const routeResults = this.searchRoutes(filters.global || filters.routes, options);
      results.push(...routeResults.map(r => ({ ...r, type: 'route' })));
    }

    // Search assets if global or asset-specific search
    if (filters.global || filters.assets) {
      const assetResults = this.searchAssets(filters.global || filters.assets, options);
      results.push(...assetResults.map(r => ({ ...r, type: 'asset' })));
    }

    // Apply time range filter
    if (filters.timeRange.from || filters.timeRange.to) {
      results = this.filterByTimeRange(results, filters.timeRange);
    }

    this.searchState.results = results;
    this.updateSearchResults();
    this.filterDashboardPanels();
    this.highlightSearchTerms();

    eventBus.emit('search-performed', { 
      filters: filters, 
      results: results.length 
    });
  }

  /**
   * Search within staff data
   */
  searchStaff(searchTerm, options) {
    if (!searchTerm) return [];
    
    return STATE.staff.filter(staff => {
      return this.searchField(searchTerm, staff.name, options) ||
             this.searchField(searchTerm, staff.role, options) ||
             this.searchField(searchTerm, staff.status, options) ||
             this.searchField(searchTerm, staff.location || '', options);
    });
  }

  /**
   * Search within routes data
   */
  searchRoutes(searchTerm, options) {
    if (!searchTerm) return [];
    
    return STATE.routes.filter(route => {
      return this.searchField(searchTerm, route.name, options) ||
             this.searchField(searchTerm, route.status, options) ||
             this.searchField(searchTerm, route.driver || '', options) ||
             this.searchField(searchTerm, route.vehicle || '', options);
    });
  }

  /**
   * Search within assets data
   */
  searchAssets(searchTerm, options) {
    if (!searchTerm) return [];
    
    return STATE.assets.filter(asset => {
      return this.searchField(searchTerm, asset.number, options) ||
             this.searchField(searchTerm, asset.type, options) ||
             this.searchField(searchTerm, asset.status, options) ||
             this.searchField(searchTerm, asset.location || '', options);
    });
  }

  /**
   * Search within specific field with options
   */
  searchField(searchTerm, targetText, options = {}) {
    if (!targetText) return false;
    
    const { caseSensitive = false, fuzzySearch = false, wholeWords = false } = options;
    
    let term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    let text = caseSensitive ? targetText : targetText.toLowerCase();
    
    if (wholeWords) {
      const regex = new RegExp(`\\b${term}\\b`, caseSensitive ? 'g' : 'gi');
      return regex.test(text);
    }
    
    if (fuzzySearch) {
      return this.fuzzyMatch(term, text, caseSensitive) > 0.3;
    }
    
    return text.includes(term);
  }

  /**
   * Fuzzy matching algorithm
   */
  fuzzyMatch(pattern, text, caseSensitive = false) {
    if (!caseSensitive) {
      pattern = pattern.toLowerCase();
      text = text.toLowerCase();
    }
    
    const p = pattern.split('');
    const t = text.split('');
    let patternIndex = 0;
    let score = 0;
    
    for (let i = 0; i < t.length && patternIndex < p.length; i++) {
      if (t[i] === p[patternIndex]) {
        score += 1;
        patternIndex++;
      }
    }
    
    return patternIndex === p.length ? score / p.length * 0.8 : score / p.length * 0.3;
  }

  /**
   * Update search results display
   */
  updateSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    const results = this.searchState.results;
    
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
      return;
    }

    const groupedResults = this.groupResultsByType(results);
    let html = '<div class="search-results-summary">';
    html += `<h4>Found ${results.length} results</h4>`;
    html += '</div>';

    Object.entries(groupedResults).forEach(([type, items]) => {
      html += `<div class="result-group">`;
      html += `<h5>${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})</h5>`;
      html += '<ul class="result-list">';
      
      items.forEach(item => {
        html += `<li class="result-item" data-type="${type}" data-id="${item.id}">`;
        html += this.renderResultItem(item, type);
        html += '</li>';
      });
      
      html += '</ul></div>';
    });

    resultsContainer.innerHTML = html;
  }

  /**
   * Check if there's an active search
   */
  hasActiveSearch() {
    const filters = this.searchState.activeFilters;
    return filters.global || filters.staff || filters.routes || filters.assets ||
           filters.timeRange.from || filters.timeRange.to;
  }

  /**
   * Filter dashboard panels based on search
   */
  filterDashboardPanels() {
    if (!this.hasActiveSearch()) {
      // Show all panels
      document.querySelectorAll('.panel-item').forEach(item => {
        item.style.display = '';
      });
      return;
    }

    const results = this.searchState.results;
    const resultIds = new Set(results.map(r => `${r.type}-${r.id}`));

    document.querySelectorAll('.panel-item').forEach(item => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      const itemKey = `${type}-${id}`;
      
      if (resultIds.has(itemKey)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Highlight search terms in visible content
   */
  highlightSearchTerms() {
    // Remove existing highlights
    document.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });

    if (!this.hasActiveSearch()) return;

    const searchTerms = [
      this.searchState.activeFilters.global,
      this.searchState.activeFilters.staff,
      this.searchState.activeFilters.routes,
      this.searchState.activeFilters.assets
    ].filter(term => term && term.length > 0);

    if (searchTerms.length === 0) return;

    // Highlight terms in visible panel items
    document.querySelectorAll('.panel-item:not([style*="display: none"])').forEach(item => {
      this.highlightInElement(item, searchTerms);
    });
  }

  // ===== NOTIFICATION SYSTEM =====

  /**
   * Setup notification system
   */
  setupNotificationSystem() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('notification-container')) {
      const container = createElement('div', {
        id: 'notification-container',
        className: 'notification-container'
      });
      document.body.appendChild(container);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info', duration = 3000) {
    const id = Date.now().toString();
    const notification = createElement('div', {
      id: `notification-${id}`,
      className: `notification notification-${type}`
    });

    const icon = this.getNotificationIcon(type);
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="uiSystem.dismissNotification('${id}')">&times;</button>
      </div>
    `;

    const container = document.getElementById('notification-container');
    container.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismissNotification(id);
      }, duration);
    }

    this.notifications.set(id, { element: notification, type });
    return id;
  }

  /**
   * Dismiss notification
   */
  dismissNotification(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.element.classList.add('notification-hide');
    
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * Get icon for notification type
   */
  getNotificationIcon(type) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  // ===== LAYOUT SYSTEM =====

  /**
   * Update layout metrics
   */
  updateLayoutMetrics() {
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
      const panelType = panel.dataset.panel;
      if (panelType) {
        this.layoutState.itemsPerRow.set(panelType, this.calculateItemsPerRow(panel));
      }
    });
  }

  /**
   * Calculate items per row for a panel
   */
  calculateItemsPerRow(panel) {
    const containerWidth = panel.clientWidth;
    const items = panel.querySelectorAll('.panel-item');
    
    if (items.length === 0) return 1;
    
    const itemWidth = items[0].offsetWidth;
    const gap = parseInt(window.getComputedStyle(panel).gap) || 16;
    
    return Math.floor((containerWidth + gap) / (itemWidth + gap)) || 1;
  }

  /**
   * Focus specific panel
   */
  focusPanel(panelIndex) {
    const panels = document.querySelectorAll('.dashboard-panel');
    
    if (panels[panelIndex]) {
      this.layoutState.focusedPanel = panelIndex;
      
      // Update visual focus
      panels.forEach((panel, index) => {
        panel.classList.toggle('panel-focused', index === panelIndex);
      });
      
      // Scroll to panel
      this.scrollToPanel(panels[panelIndex]);
      
      eventBus.emit('panel-focused', { panelIndex });
    }
  }

  /**
   * Get next panel in sequence
   */
  getNextPanel(currentPanel) {
    const panels = document.querySelectorAll('.dashboard-panel');
    const currentIndex = Array.from(panels).indexOf(currentPanel);
    return panels[currentIndex + 1] || panels[0];
  }

  /**
   * Get previous panel in sequence
   */
  getPreviousPanel(currentPanel) {
    const panels = document.querySelectorAll('.dashboard-panel');
    const currentIndex = Array.from(panels).indexOf(currentPanel);
    return panels[currentIndex - 1] || panels[panels.length - 1];
  }

  /**
   * Scroll to specific panel
   */
  scrollToPanel(panel) {
    if (!panel) return;
    
    panel.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start',
      inline: 'nearest'
    });
  }

  // ===== SUMMARY SYSTEM =====

  /**
   * Update summary badges across all panels
   */
  updateSummaryBadges() {
    console.log('📊 Updating summary badges...');
    
    // Staff summary
    this.updateStaffSummary();
    
    // Routes summary
    this.updateRoutesSummary();
    
    // Assets summary
    this.updateAssetsSummary();
    
    // Fleet summary
    this.updateFleetSummary();
    
    eventBus.emit('summaries-updated');
  }

  /**
   * Update staff summary
   */
  updateStaffSummary() {
    const staffCounts = {
      total: STATE.staff.length,
      available: STATE.staff.filter(s => s.status === 'available').length,
      out: STATE.staff.filter(s => s.status === 'out').length,
      onRoute: STATE.staff.filter(s => s.status === 'on-route').length
    };

    this.updateBadgeCount('staff-total', staffCounts.total);
    this.updateBadgeCount('staff-available', staffCounts.available);
    this.updateBadgeCount('staff-out', staffCounts.out);
    this.updateBadgeCount('staff-on-route', staffCounts.onRoute);
  }

  /**
   * Update routes summary
   */
  updateRoutesSummary() {
    const routeCounts = {
      total: STATE.routes.length,
      active: STATE.routes.filter(r => r.status === 'active').length,
      inactive: STATE.routes.filter(r => r.status === 'inactive').length
    };

    this.updateBadgeCount('routes-total', routeCounts.total);
    this.updateBadgeCount('routes-active', routeCounts.active);
    this.updateBadgeCount('routes-inactive', routeCounts.inactive);
  }

  /**
   * Update assets summary
   */
  updateAssetsSummary() {
    const assetCounts = {
      total: STATE.assets.length,
      available: STATE.assets.filter(a => a.status === 'available').length,
      inService: STATE.assets.filter(a => a.status === 'in-service').length,
      maintenance: STATE.assets.filter(a => a.status === 'maintenance').length
    };

    this.updateBadgeCount('assets-total', assetCounts.total);
    this.updateBadgeCount('assets-available', assetCounts.available);
    this.updateBadgeCount('assets-in-service', assetCounts.inService);
    this.updateBadgeCount('assets-maintenance', assetCounts.maintenance);
  }

  /**
   * Update fleet summary
   */
  updateFleetSummary() {
    const fleetData = STATE.fleet || [];
    const fleetCounts = {
      total: fleetData.length,
      active: fleetData.filter(f => f.status === 'active').length,
      idle: fleetData.filter(f => f.status === 'idle').length,
      maintenance: fleetData.filter(f => f.status === 'maintenance').length
    };

    this.updateBadgeCount('fleet-total', fleetCounts.total);
    this.updateBadgeCount('fleet-active', fleetCounts.active);
    this.updateBadgeCount('fleet-idle', fleetCounts.idle);
    this.updateBadgeCount('fleet-maintenance', fleetCounts.maintenance);
  }

  /**
   * Update individual badge count
   */
  updateBadgeCount(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('badge-empty', count === 0);
      badge.classList.toggle('badge-warning', count > 10);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for data updates
    eventBus.on('staff-updated', () => this.updateSummaryBadges());
    eventBus.on('routes-updated', () => this.updateSummaryBadges());
    eventBus.on('assets-updated', () => this.updateSummaryBadges());
    eventBus.on('fleet-updated', () => this.updateSummaryBadges());
    
    // Listen for window resize
    window.addEventListener('resize', debounce(() => {
      this.updateLayoutMetrics();
    }, 250));
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when no modal is open
      if (this.isModalOpen()) return;
      
      // Handle keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            this.openAdvancedSearchDialog();
            break;
          case ',':
            e.preventDefault();
            this.openSettings();
            break;
          case '?':
            e.preventDefault();
            this.openShortcutsHelp();
            break;
        }
      }
      
      // Panel navigation (no modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key) {
          case 'ArrowLeft':
            if (this.layoutState.focusedPanel !== null) {
              e.preventDefault();
              const currentIndex = this.layoutState.focusedPanel;
              const newIndex = currentIndex > 0 ? currentIndex - 1 : 3;
              this.focusPanel(newIndex);
            }
            break;
          case 'ArrowRight':
            if (this.layoutState.focusedPanel !== null) {
              e.preventDefault();
              const currentIndex = this.layoutState.focusedPanel;
              const newIndex = currentIndex < 3 ? currentIndex + 1 : 0;
              this.focusPanel(newIndex);
            }
            break;
        }
      }
    });
  }

  /**
   * Save current search as named search
   */
  saveCurrentSearch() {
    const nameInput = document.getElementById('save-search-name');
    if (!nameInput || !nameInput.value.trim()) {
      this.showNotification('Please enter a name for the search', 'warning');
      return;
    }

    const search = {
      id: Date.now().toString(),
      name: nameInput.value.trim(),
      filters: JSON.parse(JSON.stringify(this.searchState.activeFilters)),
      created: new Date().toISOString()
    };

    this.searchState.savedSearches.push(search);
    localStorage.setItem('dispatch_saved_searches', JSON.stringify(this.searchState.savedSearches));
    
    nameInput.value = '';
    this.showNotification(`Search "${search.name}" saved`, 'success');
    
    // Update saved searches display
    const savedTab = document.getElementById('saved-tab');
    if (savedTab) {
      savedTab.querySelector('.saved-searches-list').innerHTML = this.renderSavedSearches();
    }
  }

  /**
   * Load saved search
   */
  loadSavedSearch(searchId) {
    const search = this.searchState.savedSearches.find(s => s.id === searchId);
    if (!search) return;

    this.searchState.activeFilters = JSON.parse(JSON.stringify(search.filters));
    this.updateSearchUI();
    this.performSearch();
    this.closeCurrentModal();
    
    this.showNotification(`Loaded search: ${search.name}`, 'success');
  }

  /**
   * Delete saved search
   */
  deleteSavedSearch(searchId) {
    this.searchState.savedSearches = this.searchState.savedSearches.filter(s => s.id !== searchId);
    localStorage.setItem('dispatch_saved_searches', JSON.stringify(this.searchState.savedSearches));
    
    // Update display
    const savedTab = document.getElementById('saved-tab');
    if (savedTab) {
      savedTab.querySelector('.saved-searches-list').innerHTML = this.renderSavedSearches();
    }
    
    this.showNotification('Search deleted', 'success');
  }

  /**
   * Clear all searches
   */
  clearAllSearches() {
    this.searchState.activeFilters = {
      global: '',
      staff: '',
      routes: '',
      assets: '',
      timeRange: { from: '', to: '' },
      options: {
        fuzzySearch: false,
        caseSensitive: false,
        wholeWords: false
      }
    };
    
    this.updateSearchUI();
    this.performSearch();
    this.showNotification('All searches cleared', 'success');
  }

  /**
   * Restore user preferences
   */
  restoreUserPreferences() {
    const preferences = JSON.parse(localStorage.getItem('dispatch_ui_preferences') || '{}');
    
    // Apply saved preferences
    if (preferences.theme) {
      document.documentElement.setAttribute('data-theme', preferences.theme);
    }
    
    if (preferences.density) {
      document.documentElement.setAttribute('data-density', preferences.density);
    }
  }

  /**
   * Save all settings
   */
  saveSettings() {
    const settings = this.gatherSettingsFromForm();
    localStorage.setItem('dispatch_ui_preferences', JSON.stringify(settings));
    
    // Apply settings immediately
    this.applySettings(settings);
    
    this.closeCurrentModal();
    this.showNotification('Settings saved successfully', 'success');
    eventBus.emit('settings-updated', settings);
  }

  // ===== HELPER METHODS =====

  /**
   * Render saved searches list
   */
  renderSavedSearches() {
    if (this.searchState.savedSearches.length === 0) {
      return '<div class="no-saved-searches">No saved searches</div>';
    }

    return this.searchState.savedSearches.map(search => `
      <div class="saved-search-item">
        <div class="search-info">
          <strong>${search.name}</strong>
          <small>Created: ${new Date(search.created).toLocaleDateString()}</small>
        </div>
        <div class="search-actions">
          <button type="button" class="btn btn-sm btn-secondary" 
                  onclick="uiSystem.loadSavedSearch('${search.id}')">Load</button>
          <button type="button" class="btn btn-sm btn-danger" 
                  onclick="uiSystem.deleteSavedSearch('${search.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render color settings
   */
  renderColorSettings() {
    const statusColors = {
      available: '#4CAF50',
      'in-service': '#2196F3',
      'out-of-service': '#F44336',
      maintenance: '#FF9800',
      active: '#4CAF50',
      inactive: '#9E9E9E'
    };

    return Object.entries(statusColors).map(([status, color]) => `
      <div class="color-setting">
        <label for="color-${status}">${status.replace('-', ' ').toUpperCase()}:</label>
        <input type="color" id="color-${status}" value="${color}">
      </div>
    `).join('');
  }

  /**
   * Render keyboard shortcuts
   */
  renderKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+F', action: 'Open Search' },
      { key: 'Ctrl+,', action: 'Open Settings' },
      { key: 'Ctrl+?', action: 'Show Shortcuts' },
      { key: 'Escape', action: 'Close Modal/Clear Search' },
      { key: '←/→', action: 'Navigate Panels' },
      { key: 'Tab', action: 'Navigate Items' },
      { key: 'Enter', action: 'Activate Item' },
      { key: 'Space', action: 'Select/Toggle' }
    ];

    return `
      <div class="shortcuts-list">
        <h4>Keyboard Shortcuts</h4>
        <table class="shortcuts-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${shortcuts.map(shortcut => `
              <tr>
                <td><kbd>${shortcut.key}</kbd></td>
                <td>${shortcut.action}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Setup search modal handlers
   */
  setupSearchModalHandlers() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.showSearchTab(tabName);
      });
    });

    // Form submission
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.updateFiltersFromForm();
        this.performSearch();
        this.closeCurrentModal();
      });
    }
  }

  /**
   * Show specific search tab
   */
  showSearchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
    });
  }

  /**
   * Setup settings handlers
   */
  setupSettingsHandlers() {
    // Tab switching
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.showSettingsTab(tabName);
      });
    });

    // Load current settings
    this.populateSettingsForm();
  }

  /**
   * Show specific settings tab
   */
  showSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
    });
  }

  /**
   * Populate settings form with current values
   */
  populateSettingsForm() {
    const preferences = JSON.parse(localStorage.getItem('dispatch_ui_preferences') || '{}');
    
    // Theme
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = preferences.theme || 'light';
    }

    // Density
    const densitySelect = document.getElementById('density-select');
    if (densitySelect) {
      densitySelect.value = preferences.density || 'normal';
    }

    // Layout
    const layoutSelect = document.getElementById('panel-layout');
    if (layoutSelect) {
      layoutSelect.value = preferences.layout || 'grid';
    }

    // Behavior settings
    const autoRefresh = document.getElementById('auto-refresh');
    if (autoRefresh) {
      autoRefresh.checked = preferences.autoRefresh || false;
    }

    const soundNotifications = document.getElementById('sound-notifications');
    if (soundNotifications) {
      soundNotifications.checked = preferences.soundNotifications || false;
    }

    const confirmActions = document.getElementById('confirm-actions');
    if (confirmActions) {
      confirmActions.checked = preferences.confirmActions !== false; // Default true
    }
  }

  /**
   * Gather settings from form
   */
  gatherSettingsFromForm() {
    const settings = {};

    // Display settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) settings.theme = themeSelect.value;

    const densitySelect = document.getElementById('density-select');
    if (densitySelect) settings.density = densitySelect.value;

    const layoutSelect = document.getElementById('panel-layout');
    if (layoutSelect) settings.layout = layoutSelect.value;

    // Behavior settings
    const autoRefresh = document.getElementById('auto-refresh');
    if (autoRefresh) settings.autoRefresh = autoRefresh.checked;

    const soundNotifications = document.getElementById('sound-notifications');
    if (soundNotifications) settings.soundNotifications = soundNotifications.checked;

    const confirmActions = document.getElementById('confirm-actions');
    if (confirmActions) settings.confirmActions = confirmActions.checked;

    const defaultView = document.getElementById('default-view');
    if (defaultView) settings.defaultView = defaultView.value;

    // Color settings
    const colorSettings = {};
    document.querySelectorAll('[id^="color-"]').forEach(input => {
      const status = input.id.replace('color-', '');
      colorSettings[status] = input.value;
    });
    settings.colors = colorSettings;

    return settings;
  }

  /**
   * Apply settings to the interface
   */
  applySettings(settings) {
    // Apply theme
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }

    // Apply density
    if (settings.density) {
      document.documentElement.setAttribute('data-density', settings.density);
    }

    // Apply layout
    if (settings.layout) {
      document.documentElement.setAttribute('data-layout', settings.layout);
    }

    // Apply color scheme
    if (settings.colors) {
      Object.entries(settings.colors).forEach(([status, color]) => {
        document.documentElement.style.setProperty(`--color-${status}`, color);
      });
    }
  }

  /**
   * Update filters from search form
   */
  updateFiltersFromForm() {
    // Get values from form inputs
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) this.searchState.activeFilters.global = globalSearch.value;

    const staffSearch = document.getElementById('staff-search');
    if (staffSearch) this.searchState.activeFilters.staff = staffSearch.value;

    const routesSearch = document.getElementById('routes-search');
    if (routesSearch) this.searchState.activeFilters.routes = routesSearch.value;

    const assetsSearch = document.getElementById('assets-search');
    if (assetsSearch) this.searchState.activeFilters.assets = assetsSearch.value;

    // Time range
    const timeFrom = document.getElementById('time-from');
    if (timeFrom) this.searchState.activeFilters.timeRange.from = timeFrom.value;

    const timeTo = document.getElementById('time-to');
    if (timeTo) this.searchState.activeFilters.timeRange.to = timeTo.value;

    // Options
    const fuzzySearch = document.getElementById('fuzzy-search');
    if (fuzzySearch) this.searchState.activeFilters.options.fuzzySearch = fuzzySearch.checked;

    const caseSensitive = document.getElementById('case-sensitive');
    if (caseSensitive) this.searchState.activeFilters.options.caseSensitive = caseSensitive.checked;

    const wholeWords = document.getElementById('whole-words');
    if (wholeWords) this.searchState.activeFilters.options.wholeWords = wholeWords.checked;
  }

  /**
   * Update search UI with current filters
   */
  updateSearchUI() {
    // Update main search inputs
    const globalInput = document.querySelector('[data-search-type="global"]');
    if (globalInput) globalInput.value = this.searchState.activeFilters.global;

    const staffInput = document.querySelector('[data-search-type="staff"]');
    if (staffInput) staffInput.value = this.searchState.activeFilters.staff;

    const routesInput = document.querySelector('[data-search-type="routes"]');
    if (routesInput) routesInput.value = this.searchState.activeFilters.routes;

    const assetsInput = document.querySelector('[data-search-type="assets"]');
    if (assetsInput) assetsInput.value = this.searchState.activeFilters.assets;
  }

  /**
   * Group search results by type
   */
  groupResultsByType(results) {
    return results.reduce((groups, result) => {
      const type = result.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(result);
      return groups;
    }, {});
  }

  /**
   * Render individual result item
   */
  renderResultItem(item, type) {
    switch (type) {
      case 'staff':
        return `
          <strong>${item.name}</strong>
          <span class="result-meta">${item.role} - ${item.status}</span>
        `;
      case 'route':
        return `
          <strong>${item.name}</strong>
          <span class="result-meta">${item.status} - Driver: ${item.driver || 'Unassigned'}</span>
        `;
      case 'asset':
        return `
          <strong>${item.number}</strong>
          <span class="result-meta">${item.type} - ${item.status}</span>
        `;
      default:
        return `<strong>${item.name || item.id}</strong>`;
    }
  }

  /**
   * Filter results by time range
   */
  filterByTimeRange(results, timeRange) {
    if (!timeRange.from && !timeRange.to) return results;

    return results.filter(result => {
      // This would need to be implemented based on how time data is stored
      // For now, just return all results
      return true;
    });
  }

  /**
   * Highlight search terms in element
   */
  highlightInElement(element, searchTerms) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      let text = textNode.textContent;
      let highlightedText = text;
      let hasHighlight = false;

      searchTerms.forEach(term => {
        if (term && term.length > 0) {
          const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
          if (regex.test(highlightedText)) {
            highlightedText = highlightedText.replace(regex, '<span class="search-highlight">$1</span>');
            hasHighlight = true;
          }
        }
      });

      if (hasHighlight) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        textNode.parentNode.replaceChild(wrapper, textNode);
      }
    });
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Handle modal form submission
   */
  handleModalSubmission(form) {
    const formData = new FormData(form);
    const modalId = form.closest('.modal-overlay').id;

    switch (modalId) {
      case 'staff-out-modal':
        this.handleStaffOutSubmission(formData);
        break;
      case 'staff-in-modal':
        this.handleStaffInSubmission(formData);
        break;
      case 'asset-toggle-modal':
        this.handleAssetToggleSubmission(formData);
        break;
    }
  }

  /**
   * Handle staff out form submission
   */
  handleStaffOutSubmission(formData) {
    const staffId = document.getElementById('staff-select').value;
    const reason = document.getElementById('out-reason').value;
    const notes = document.getElementById('out-notes').value;
    const estimatedReturn = document.getElementById('estimated-return').value;

    if (!staffId || !reason) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    eventBus.emit('staff-set-out', {
      staffId,
      reason,
      notes,
      estimatedReturn,
      timestamp: new Date().toISOString()
    });

    this.closeCurrentModal();
    this.showNotification('Staff member set out successfully', 'success');
  }

  /**
   * Handle staff in form submission
   */
  handleStaffInSubmission(formData) {
    const staffId = document.getElementById('staff-in-select').value;
    const notes = document.getElementById('return-notes').value;

    if (!staffId) {
      this.showNotification('Please select a staff member', 'error');
      return;
    }

    eventBus.emit('staff-set-in', {
      staffId,
      notes,
      timestamp: new Date().toISOString()
    });

    this.closeCurrentModal();
    this.showNotification('Staff member set in successfully', 'success');
  }

  /**
   * Handle asset toggle form submission
   */
  handleAssetToggleSubmission(formData) {
    const assetId = document.getElementById('asset-select').value;
    const newStatus = document.getElementById('new-status').value;
    const reason = document.getElementById('status-reason').value;

    if (!assetId || !newStatus) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    eventBus.emit('asset-status-changed', {
      assetId,
      newStatus,
      reason,
      timestamp: new Date().toISOString()
    });

    this.closeCurrentModal();
    this.showNotification('Asset status updated successfully', 'success');
  }

  /**
   * Data export functionality
   */
  exportData() {
    const data = {
      staff: STATE.staff,
      routes: STATE.routes,
      assets: STATE.assets,
      fleet: STATE.fleet,
      preferences: JSON.parse(localStorage.getItem('dispatch_ui_preferences') || '{}'),
      savedSearches: this.searchState.savedSearches,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('Data exported successfully', 'success');
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (confirm('Are you sure you want to clear all cached data? This action cannot be undone.')) {
      localStorage.removeItem('dispatch_ui_preferences');
      localStorage.removeItem('dispatch_saved_searches');
      localStorage.removeItem('dispatch_state');
      
      this.showNotification('Cache cleared successfully', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      localStorage.removeItem('dispatch_ui_preferences');
      
      // Apply default settings
      const defaults = {
        theme: 'light',
        density: 'normal',
        layout: 'grid',
        autoRefresh: false,
        soundNotifications: false,
        confirmActions: true
      };
      
      this.applySettings(defaults);
      this.populateSettingsForm();
      
      this.showNotification('Settings reset to defaults', 'success');
    }
  }
}

// Create and export singleton instance
const uiSystem = new UISystem();

// Make available globally for inline event handlers
window.uiSystem = uiSystem;

export { uiSystem };
