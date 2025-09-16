/**
 * MODULAR DISPATCH DASHBOARD - MAIN APPLICATION ENTRY
 * Transportation Dispatch Dashboard
 *
 * This is the main application orchestrator that imports and initializes
 * all 17 JavaScript modules in the correct dependency order.
 *
 * Module Loading Order:
 *   1. Core Foundation (utils, state, events)
 *   2. UI System (system, utilities)
 *   3. Domain Modules (dispatch, touch, fleet, operations)
 *   4. Data Layer (import/export)
 *   5. Application Bootstrap
 *
 * @version 1.0.0
 * @author Modular Architecture Team
 * @created 2025-09-12

*/

import { 
    debounceRender, 
    batchUpdate, 
    PERFORMANCE, 
    eventBus,
    formatDate,
    generateId 
} from './modules/core/utils.js';

import { 
  validateDispatchConfig, 
  cleanUnrelatedData, 
  repairLocalStorageData,
  getStorageStats
} from './modules/core/dataValidator.js';

import { 
    STATE, 
    getState, 
    setState, 
    loadData, 
    saveToLocalStorage,
    addAsset,
    addRoute,
    switchView
} from './modules/core/state.js';

import { 
    initializeEvents,
    initializeKeyboardNavigation,
    initializeTouchGestures as initializeCoreTouch
} from './modules/core/events.js';

// ==========================================================================
// UI SYSTEM MODULES
// ==========================================================================

import { uiSystem } from './modules/ui/system.js';
import { uiUtilities } from './modules/ui/utilities.js';
import { cardManagement } from './modules/ui/cardManagement.js';
import { advancedSearchSystem } from './modules/ui/advancedSearch.js';
import { settingsSystem } from './modules/ui/settingsSystem.js';

// ==========================================================================
// DISPATCH MODULES
// ==========================================================================

import { 
  renderAll as renderAllRoutes,
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
} from './modules/dispatch/routes.js';

// Import new route cards system
import {
  renderRouteCards,
  ROUTE_TYPES,
  createRoute,
  assignDriver,
  assignAsset,
  addSafetyEscort,
  removeSafetyEscort,
  updateRouteNotes,
  resetRouteBoard
} from './modules/dispatch/routeCards.js';
import { 
  renderStaffPanel,
  markStaffOut,
  markStaffAvailable,
  clearStaffAssignments,
  groupStaffByRole,
  getRoleColor,
  isStaffAssigned as isStaffAssignedToRoute,
  getStaffAssignmentInfo,
  updateStaffSummary,
  getAvailableStaffByRole,
  getStaffByName,
  exportStaffData,
  handleStaffPanelClick,
  showStaffDetails,
  formatStaffDisplayName,
  refreshStaffListModal,
  addNewStaffMember,
  removeStaffMember,
  editStaffMember,
  exportStaffListAsCSV,
  handleStaffCSVImport
} from './modules/dispatch/staff.js';
import { 
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
} from './modules/dispatch/assets.js';

// ==========================================================================
// TOUCH INTERFACE MODULES
// ==========================================================================

import { 
  initializeTouchGestures as initializeTouchGestureSystem,
  showGestureTutorial,
  exportCurrentView,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleTouchCancel,
  handleTap,
  handleLongPress,
  handleSwipeLeft,
  handleSwipeRight,
  handleSwipeUp,
  handleSwipeDown,
  showContextMenu,
  hideContextMenu,
  addTouchFeedback,
  removeTouchFeedback,
  addLongPressFeedback,
  addSwipeIndicator,
  hideSwipeIndicator,
  getTouchDistance,
  getTouchCapabilities,
  resetGestureState,
  TOUCH_GESTURES
} from './modules/touch/gestures.js';
import { 
  initializeResponsiveSystem,
  setupCardCollapse,
  toggleCardCollapse,
  collapseAllCards,
  expandAllCards,
  performResponsiveSearch,
  clearSearchResults,
  updateResponsiveGrids,
  handleBreakpointChange,
  setupFieldTripGrid,
  generateFieldTripCardHtml,
  updateTouchTargets,
  applyResponsiveClasses,
  recalculateResponsiveLayout,
  RESPONSIVE_CONFIG,
  RESPONSIVE_STATE
} from './modules/touch/responsive.js';

// ==========================================================================
// FLEET MANAGEMENT MODULES
// ==========================================================================

import { 
  initializeFleetManagement,
  renderFleetService,
  renderDownList,
  renderSparesList,
  selectFleetServiceStatus,
  updateFleetServiceStatus,
  openFleetServiceModal,
  closeFleetServiceModal,
  isStaffAssigned as isStaffAssignedToFleet,
  isItemCurrentlyAssigned,
  clearAssignment as clearFleetAssignment,
  assignToFieldTrip,
  clearFieldTripAssignment,
  isItemCurrentlyAssignedToFieldTrip,
  getDownAssets as getFleetDownAssets,
  getSpareAssets as getFleetSpareAssets,
  getAllAssignedAssets,
  handleFleetEmergency,
  generateFleetReport,
  refreshFleetData,
  FLEET_CONFIG,
  FLEET_STATE
} from './modules/fleet/management.js';
import { fleetServiceManager } from './modules/fleet/service.js';

// ==========================================================================
// OPERATIONS MODULES
// ==========================================================================

import { assignmentManager } from './modules/operations/assignments.js';
import { FieldTripsManager, fieldTripsManager } from './modules/operations/fieldTrips.js';
import { operationsBulk } from './modules/operations/bulk.js';
import { routeManagementOperations } from './modules/operations/routeManagement.js';

// ==========================================================================
// DATA LAYER MODULE
// ==========================================================================

import { importExportManager } from './modules/data/importExport.js';

// ==========================================================================
// APPLICATION CLASS
// ==========================================================================

class ModularDispatchApp {

  constructor() {
    this.modules = new Map();
    this.initialized = false;
    this.startTime = performance.now();
    // Bind event handlers
    this.handleError = this.handleError.bind(this);
    this.handleUnload = this.handleUnload.bind(this);
    // Setup global error handling
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handleError);
    window.addEventListener('beforeunload', this.handleUnload);
  }

  /**
   * Initialize the application with all modules
   */
  async init() {
    try {
      console.log('🚀 Initializing Modular Dispatch Dashboard...');
      
      // Pre-flight data validation and cleanup
      await this.validateAndCleanData();
      
      // Phase 1: Initialize core foundation
      await this.initializeCoreModules();
      // Phase 2: Initialize UI system
      await this.initializeUIModules();
      // Ensure hamburger menu button works even if setup handlers missed attaching
      try {
        document.addEventListener('click', (e) => {
          const btn = e.target.closest && e.target.closest('#hamburger-menu-btn');
          if (btn) {
            if (window.settingsSystem && typeof window.settingsSystem.toggleHamburgerMenu === 'function') {
              window.settingsSystem.toggleHamburgerMenu();
            } else if (window.settingsSystem && typeof window.settingsSystem.openHamburgerMenu === 'function') {
              window.settingsSystem.openHamburgerMenu();
            } else if (window.settingsSystem === undefined && typeof settingsSystem !== 'undefined') {
              // fallback to imported singleton
              try { settingsSystem.toggleHamburgerMenu(); } catch (e) { try { settingsSystem.openHamburgerMenu(); } catch (err) {} }
            }
          }
        });
      } catch (e) {
        console.warn('Failed to attach hamburger fallback handler', e);
      }
      // Phase 3: Initialize domain modules
      await this.initializeDomainModules();
      // Phase 4: Initialize data layer
      await this.initializeDataModules();
      // Phase 5: Final application setup
      await this.finalizeInitialization();
      this.initialized = true;
      const loadTime = performance.now() - this.startTime;
      console.log(`✅ Application initialized successfully in ${loadTime.toFixed(2)}ms`);
      console.log(`📊 Loaded ${this.modules.size} modules`);
      // Show the main application
      this.showApplication();
      // Dispatch application ready event
      eventBus.emit('app:ready', {
        loadTime,
        moduleCount: this.modules.size,
        modules: Array.from(this.modules.keys())
      });
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Validate and clean localStorage data before app initialization
   */
  async validateAndCleanData() {
    console.log('🔍 Validating and cleaning data...');
    
    try {
      // Get storage statistics
      const stats = getStorageStats();
      console.log(`📊 Storage stats: ${stats.totalItems} items, ${stats.totalSizeKB.toFixed(2)}KB total`);
      
      if (stats.unrelated.items > 0) {
        console.warn(`⚠️ Found ${stats.unrelated.items} unrelated items:`, stats.unrelated.keys);
        const removedCount = cleanUnrelatedData();
        console.log(`✅ Cleaned ${removedCount} unrelated items`);
      }
      
      // Repair localStorage data
      const repairSuccess = repairLocalStorageData();
      if (repairSuccess) {
        console.log('✅ Data validation and cleanup completed');
      } else {
        console.warn('⚠️ Some data repair issues occurred');
      }
      
    } catch (error) {
      console.error('❌ Error during data validation:', error);
      // Continue initialization even if data validation fails
    }
  }

  /**
   * Phase 1: Initialize core foundation modules
   */
  async initializeCoreModules() {
    console.log('🔧 Initializing core modules...');
    
    // Core Utils - Load utilities (functions are already available after import)
    this.modules.set('CoreUtils', {
        debounceRender,
        batchUpdate,
        PERFORMANCE,
        eventBus,
        formatDate,
        generateId
    });
    
    // Core State - Load state management (functions are already available after import)
    this.modules.set('CoreState', {
        STATE,
        getState,
        setState,
        loadData,
        saveToLocalStorage
    });
    
    // Core Events - Initialize event handling
    await initializeEvents();
    this.modules.set('CoreEvents', {
        initializeEvents,
        initializeKeyboardNavigation,
        initializeTouchGestures: initializeCoreTouch,
        eventBus
    });
    
    console.log('✅ Core modules initialized');
  }

  /**
   * Phase 2: Initialize UI system modules
   */
  async initializeUIModules() {
    console.log('🎨 Initializing UI modules...');
    
    // UI System - Main UI management (singleton instance)
    this.modules.set('UISystem', uiSystem);
    
    // UI Utilities - UI helper functions (singleton instance)
    this.modules.set('UIUtilities', uiUtilities);
    
    // Card Management - Card collapse and visual management (singleton instance)
    await cardManagement.init();
    this.modules.set('UICardManagement', cardManagement);
    
    // Advanced Search System - Comprehensive search functionality (singleton instance)
    await advancedSearchSystem.init();
    this.modules.set('UIAdvancedSearch', advancedSearchSystem);
    
    // Settings System - Comprehensive settings and preferences (singleton instance)
    await settingsSystem.init();
    this.modules.set('UISettings', settingsSystem);
    
    console.log('✅ UI modules initialized');
  }

  /**
   * Phase 3: Initialize domain-specific modules
   */
  async initializeDomainModules() {
    console.log('🚛 Initializing domain modules...');
    
    // Dispatch modules - group functions into module objects
    const routesModule = {
      renderAll: renderAllRoutes,
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
    this.modules.set('DispatchRoutes', routesModule);
    
    const staffModule = {
      renderStaffPanel,
      markStaffOut,
      markStaffAvailable,
      clearStaffAssignments,
      groupStaffByRole,
      getRoleColor,
      isStaffAssigned: isStaffAssignedToRoute,
      getStaffAssignmentInfo,
      updateStaffSummary,
      getAvailableStaffByRole,
      getStaffByName,
      exportStaffData,
      handleStaffPanelClick,
      showStaffDetails
    };
    this.modules.set('DispatchStaff', staffModule);
    
    // Assets module exports functions, not a class
    const assetsModule = {
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
    this.modules.set('DispatchAssets', assetsModule);
    
    // Touch interface modules - group functions into module objects
    const gesturesModule = {
      initializeTouchGestures: initializeTouchGestureSystem,
      showGestureTutorial,
      exportCurrentView,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleTouchCancel,
      handleTap,
      handleLongPress,
      handleSwipeLeft,
      handleSwipeRight,
      handleSwipeUp,
      handleSwipeDown,
      showContextMenu,
      hideContextMenu,
      addTouchFeedback,
      removeTouchFeedback,
      addLongPressFeedback,
      addSwipeIndicator,
      hideSwipeIndicator,
      getTouchDistance,
      getTouchCapabilities,
      resetGestureState,
      TOUCH_GESTURES
    };
    this.modules.set('TouchGestures', gesturesModule);
    
    const responsiveModule = {
      initializeResponsiveSystem,
      setupCardCollapse,
      toggleCardCollapse,
      collapseAllCards,
      expandAllCards,
      performResponsiveSearch,
      clearSearchResults,
      updateResponsiveGrids,
      handleBreakpointChange,
      setupFieldTripGrid,
      generateFieldTripCardHtml,
      updateTouchTargets,
      applyResponsiveClasses,
      recalculateResponsiveLayout,
      RESPONSIVE_CONFIG,
      RESPONSIVE_STATE
    };
    this.modules.set('TouchResponsive', responsiveModule);
    
    // Fleet management modules - group functions into module object
    const fleetManagementModule = {
      initializeFleetManagement,
      renderFleetService,
      renderDownList,
      renderSparesList,
      selectFleetServiceStatus,
      updateFleetServiceStatus,
      openFleetServiceModal,
      closeFleetServiceModal,
      isStaffAssigned: isStaffAssignedToFleet,
      isItemCurrentlyAssigned,
      clearAssignment: clearFleetAssignment,
      assignToFieldTrip,
      clearFieldTripAssignment,
      isItemCurrentlyAssignedToFieldTrip,
      getDownAssets: getFleetDownAssets,
      getSpareAssets: getFleetSpareAssets,
      getAllAssignedAssets,
      handleFleetEmergency,
      generateFleetReport,
      refreshFleetData,
      FLEET_CONFIG,
      FLEET_STATE
    };
    this.modules.set('FleetManagement', fleetManagementModule);
    
    // Use the singleton instance exported from fleet service module
    // Initialize it explicitly now that DOM is ready
    await fleetServiceManager.init();
    this.modules.set('FleetService', fleetServiceManager);
    
    // Operations modules - mix of classes and singletons
    // Use the singleton instance exported from assignments module
    await assignmentManager.init();
    this.modules.set('OperationsAssignments', assignmentManager);
    
    // Use the singleton instance exported from fieldTrips module
    this.modules.set('OperationsFieldTrips', fieldTripsManager);
    
    // Use the singleton instance exported from route management module
    await routeManagementOperations.init();
    this.modules.set('OperationsRouteManagement', routeManagementOperations);
    
    // Use the singleton instance exported from bulk module
    this.modules.set('OperationsBulk', operationsBulk);
    
    console.log('✅ Domain modules initialized');
  }

  /**
   * Phase 4: Initialize data layer modules
   */
  async initializeDataModules() {
    console.log('💾 Initializing data modules...');
    
    // Use the singleton instance exported from the module
    this.modules.set('DataImportExport', importExportManager);
    
    console.log('✅ Data modules initialized');
  }

  /**
   * Phase 5: Finalize application initialization
   */
  async finalizeInitialization() {
    console.log('🏁 Finalizing application setup...');
    
    // Setup inter-module communication
    this.setupModuleCommunication();
    
    // Initialize application state
    this.initializeApplicationState();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup touch optimizations
    this.setupTouchOptimizations();
    
    // Setup auto-save functionality
    this.setupAutoSave();
    
    // Register service worker if available
    await this.registerServiceWorker();
    
    // Make critical functions globally available BEFORE initial renders
    this.exposeGlobalFunctions();
    
    // Initial render of Resource Monitor panels after everything is loaded
    // Use requestAnimationFrame for better performance
    if (window.renderAssetPanel) {
      requestAnimationFrame(() => {
        console.log('🚛 Initializing Resource Monitor asset panel...');
        try {
          window.renderAssetPanel();
        } catch (error) {
          console.error('❌ Error rendering asset panel:', error);
        }
      });
    } else {
      console.warn('⚠️ renderAssetPanel function not available');
    }
    
    if (window.renderStaffPanel) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log('👥 Initializing Resource Monitor staff panel...');
          try {
            window.renderStaffPanel();
          } catch (error) {
            console.error('❌ Error rendering staff panel:', error);
          }
        }, 50); // Small delay to ensure asset panel renders first
      });
    } else {
      console.warn('⚠️ renderStaffPanel function not available');
    }
    
    // Initialize route cards system
    setTimeout(() => {
      console.log('🚗 Initializing Route Cards system...');
      renderRouteCards();
    }, 140);
    
    // Setup route management modal
    setTimeout(() => {
      console.log('🛠️ Setting up Route Management modal...');
      if (window.setupRouteManagementModal) {
        window.setupRouteManagementModal();
      }
      if (window.ensureAllRoutesExist) {
        window.ensureAllRoutesExist();
      }
    }, 160);
    
    // Setup header button event listeners
    this.setupHeaderButtons();
    
    console.log('✅ Application setup finalized');
  }

  /**
   * Expose critical functions globally for modules and debugging
   */
  exposeGlobalFunctions() {
    // Make render functions globally available
    window.renderAssetPanel = renderAssetPanel;
    window.renderStaffPanel = renderStaffPanel;
    window.renderRouteCards = renderRouteCards;
    window.resetRouteBoard = resetRouteBoard;
    
    // Make uiSystem globally accessible for bulk entry functions
    window.uiSystem = this.getModule('UISystem');
    
    // Make state management functions available
    window.getState = getState;
    window.setState = setState;
    window.saveToLocalStorage = saveToLocalStorage;
    
    // Make route management functions available
    window.createRoute = createRoute;
    window.assignDriver = assignDriver;
    window.assignAsset = assignAsset;
    window.addSafetyEscort = addSafetyEscort;
    window.removeSafetyEscort = removeSafetyEscort;
    window.updateRouteNotes = updateRouteNotes;
    
    console.log('✅ Global functions exposed');
  }

  /**
   * Setup header button event listeners
   */
  setupHeaderButtons() {
    // Reset Board button
    const resetBoardBtn = document.getElementById('reset-board-btn');
    if (resetBoardBtn) {
      resetBoardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔄 Reset Board button clicked');
        
        // Confirm reset action
        if (confirm('Are you sure you want to reset the route board? This will clear all route data.')) {
          if (window.resetRouteBoard) {
            window.resetRouteBoard();
          } else {
            console.error('❌ resetRouteBoard function not available');
          }
        }
      });
      console.log('✅ Reset Board button event listener added');
    } else {
      console.warn('⚠️ Reset Board button not found');
    }

    // Status Report button
    const timestampReportBtn = document.getElementById('timestamp-report-btn');
    if (timestampReportBtn) {
      timestampReportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('📋 Status Report button clicked');
        this.showTimestampReportModal();
      });
      console.log('✅ Status Report button event listener added');
    } else {
      console.warn('⚠️ Status Report button not found');
    }

    // Search button
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    if (searchToggleBtn) {
      searchToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔍 Search button clicked');
        this.toggleSearchModal();
      });
      console.log('✅ Search button event listener added');
    } else {
      console.warn('⚠️ Search button not found');
    }

    // AM/PM Toggle buttons
    this.setupAmPmToggle();
  }

  /**
   * Setup AM/PM toggle functionality
   */
  setupAmPmToggle() {
    const amToggle = document.getElementById('am-toggle');
    const pmToggle = document.getElementById('pm-toggle');

    if (!amToggle || !pmToggle) {
      console.warn('⚠️ AM/PM toggle buttons not found');
      return;
    }

    // Initialize toggle state based on current view
    this.updateToggleState(STATE.currentView);

    // AM button click handler
    amToggle.addEventListener('click', () => {
      console.log('🌅 AM toggle clicked');
      this.switchToView('AM');
    });

    // PM button click handler
    pmToggle.addEventListener('click', () => {
      console.log('🌇 PM toggle clicked');
      this.switchToView('PM');
    });

    console.log('✅ AM/PM toggle event listeners added');
  }

  /**
   * Switch to specified view (AM or PM)
   */
  switchToView(view) {
    if (STATE.currentView === view) {
      console.log(`ℹ️ Already in ${view} view`);
      return;
    }

    console.log(`🔄 Switching from ${STATE.currentView} to ${view} view`);
    const previousView = STATE.currentView;
    
    // Update state
    switchView(view);
    
    // Update toggle button states
    this.updateToggleState(view);
    
    // Re-render route cards to show correct routes for the new view
    try {
      renderRouteCards();
      console.log(`🔄 Re-rendered route cards for ${view} view`);
    } catch (error) {
      console.error('❌ Error re-rendering route cards:', error);
    }

    // Emit event for other modules that might need to respond
    eventBus.emit('view:changed', { 
      previousView: previousView,
      currentView: view 
    });

    console.log(`✅ Successfully switched to ${view} view`);
  }

  /**
   * Update visual state of AM/PM toggle buttons
   */
  updateToggleState(currentView) {
    const amToggle = document.getElementById('am-toggle');
    const pmToggle = document.getElementById('pm-toggle');

    if (!amToggle || !pmToggle) return;

    if (currentView === 'AM') {
      // AM is active
      amToggle.className = 'px-3 py-1 rounded bg-blue-500 text-white text-sm font-semibold';
      pmToggle.className = 'px-3 py-1 rounded text-gray-700 text-sm font-semibold hover:bg-gray-100';
    } else {
      // PM is active
      amToggle.className = 'px-3 py-1 rounded text-gray-700 text-sm font-semibold hover:bg-gray-100';
      pmToggle.className = 'px-3 py-1 rounded bg-blue-500 text-white text-sm font-semibold';
    }

    console.log(`🎨 Updated toggle state for ${currentView} view`);
  }

  /**
   * Show the timestamp report modal
   */
  showTimestampReportModal() {
    const modal = document.getElementById('timestamp-report-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.setupTimestampReportModalHandlers();
      this.generateTimestampReport();
      console.log('📋 Timestamp report modal opened');
    } else {
      console.warn('⚠️ Timestamp report modal not found');
    }
  }

  /**
   * Toggle the search overlay
   */
  toggleSearchModal() {
    if (window.searchSystem && window.searchSystem.openSearchOverlay) {
      window.searchSystem.openSearchOverlay();
      console.log('🔍 Search overlay opened');
    } else {
      console.warn('⚠️ Search system not available');
    }
  }

  /**
   * Setup timestamp report modal handlers
   */
  setupTimestampReportModalHandlers() {
    const closeBtn = document.getElementById('timestamp-report-close');
    const cancelBtn = document.getElementById('timestamp-report-cancel');
    const printBtn = document.getElementById('print-current-day');
    const clearBtn = document.getElementById('clear-timestamps');

    const closeModal = () => {
      const modal = document.getElementById('timestamp-report-modal');
      if (modal) modal.classList.add('hidden');
    };

    if (closeBtn) {
      closeBtn.removeEventListener('click', closeModal);
      closeBtn.addEventListener('click', closeModal);
    }

    if (cancelBtn) {
      cancelBtn.removeEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);
    }

    if (printBtn) {
      printBtn.removeEventListener('click', this.printTimestampReport);
      printBtn.addEventListener('click', this.printTimestampReport.bind(this));
    }

    if (clearBtn) {
      clearBtn.removeEventListener('click', this.clearAllTimestamps);
      clearBtn.addEventListener('click', this.clearAllTimestamps.bind(this));
    }
  }

  /**
   * Generate timestamp report content
   */
  generateTimestampReport() {
    const content = document.getElementById('timestamp-report-content');
    const timestamp = document.getElementById('report-timestamp');
    
    if (!content) return;

    // Set generation timestamp
    if (timestamp) {
      timestamp.textContent = new Date().toLocaleString();
    }

    // Get all route status timestamps
    const timestamps = STATE.statusTimestamps || {};
    const routes = STATE.data.routes || [];

    if (Object.keys(timestamps).length === 0) {
      content.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <p>No status timestamps recorded yet.</p>
          <p class="text-sm mt-2">Status changes will appear here as they occur.</p>
        </div>
      `;
      return;
    }

    // Generate report HTML
    let reportHTML = `
      <div class="space-y-4">
        <div class="text-sm text-gray-600 mb-4">
          Complete route status and assignment history (most recent first)
        </div>
    `;

    Object.entries(timestamps).forEach(([runKey, statusHistory]) => {
      if (statusHistory && statusHistory.length > 0) {
        // Extract route identifier and schedule from runKey
        const routeIdentifier = runKey.replace(/_AM$|_PM$/, '');
        const schedule = runKey.includes('_AM') ? 'AM' : 'PM';
        
        // Find the current route data using comprehensive matching
        let currentRoute = routes.find(r => {
          // Direct ID match
          if (r.id === routeIdentifier) return true;
          // Direct name match
          if (r.name === routeIdentifier) return true;
          // Route number match
          if (r.routeNumber === routeIdentifier) return true;
          // Case-insensitive name match
          if (r.name && r.name.toLowerCase() === routeIdentifier.toLowerCase()) return true;
          // Case-insensitive ID match  
          if (r.id && r.id.toLowerCase() === routeIdentifier.toLowerCase()) return true;
          return false;
        });
        
        // Format route name for display (capitalize "Route")
        let displayName = currentRoute ? currentRoute.name : routeIdentifier;
        if (displayName && displayName.toLowerCase().startsWith('route ')) {
          displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        }
        
        reportHTML += `
          <div class="border rounded-lg p-4 bg-gray-50">
            <h4 class="font-bold text-gray-800 mb-3 text-lg">${displayName} (${schedule})</h4>
            
            <!-- Current Assignments -->
            <div class="mb-3 p-3 bg-white rounded border-l-4 border-blue-500">
              <h5 class="font-semibold text-gray-700 mb-2">Current Assignments:</h5>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        `;

        if (currentRoute) {
          // Driver assignment
          reportHTML += `
            <div><strong>Driver:</strong> ${currentRoute.driver || 'Not assigned'}</div>
            <div><strong>Asset:</strong> ${currentRoute.asset || 'Not assigned'}</div>
          `;
          
          // Safety escorts
          if (currentRoute.safetyEscorts && currentRoute.safetyEscorts.length > 0) {
            reportHTML += `
              <div class="md:col-span-2"><strong>Safety Escorts:</strong> ${currentRoute.safetyEscorts.join(', ')}</div>
            `;
          } else {
            reportHTML += `
              <div class="md:col-span-2"><strong>Safety Escorts:</strong> None assigned</div>
            `;
          }
          
          // Notes
          if (currentRoute.notes && currentRoute.notes.trim()) {
            reportHTML += `
              <div class="md:col-span-2"><strong>Notes:</strong> ${currentRoute.notes}</div>
            `;
          }
        } else {
          reportHTML += `
            <div class="md:col-span-2 text-gray-500 italic">Route data not found in current system</div>
          `;
        }

        reportHTML += `
              </div>
            </div>
            
            <!-- Status History -->
            <div>
              <h5 class="font-semibold text-gray-700 mb-2">Status Change History:</h5>
              <div class="space-y-2">
        `;

        // Sort by timestamp (most recent first)
        statusHistory
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const date = new Date(entry.timestamp).toLocaleDateString();
            const statusClass = entry.status === '10-8' ? 'text-green-600 bg-green-50' : 
                              entry.status === '10-7' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50';
            
            reportHTML += `
              <div class="flex justify-between items-center p-2 rounded ${statusClass}">
                <div class="flex items-center space-x-3">
                  <span class="font-bold text-lg">${entry.status}</span>
                  <span class="text-sm">${entry.user || 'System'}</span>
                </div>
                <div class="text-right text-sm">
                  <div class="font-medium">${time}</div>
                  <div class="text-xs opacity-75">${date}</div>
                </div>
              </div>
            `;
          });

        reportHTML += `
              </div>
            </div>
          </div>
        `;
      }
    });

    reportHTML += `</div>`;
    content.innerHTML = reportHTML;
  }

  /**
   * Print timestamp report
   */
  printTimestampReport() {
    const content = document.getElementById('timestamp-report-content');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Route Status Timestamp Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h4 { color: #1f2937; margin-top: 20px; margin-bottom: 10px; font-size: 1.2em; }
            h5 { color: #374151; margin: 10px 0 5px 0; font-size: 1em; }
            .route-section { 
              margin-bottom: 25px; 
              border: 1px solid #ddd; 
              padding: 15px; 
              page-break-inside: avoid;
            }
            .assignments-box { 
              background: #f8f9fa; 
              border-left: 4px solid #3b82f6; 
              padding: 10px; 
              margin: 10px 0; 
            }
            .status-entry { 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              padding: 8px; 
              margin: 4px 0;
              border-radius: 4px;
            }
            .status-10-8 { background: #f0fdf4; color: #16a34a; border-left: 4px solid #16a34a; }
            .status-10-7 { background: #fef2f2; color: #dc2626; border-left: 4px solid #dc2626; }
            .status-10-11 { background: #fff7ed; color: #ea580c; border-left: 4px solid #ea580c; }
            .status-text { font-weight: bold; font-size: 1.1em; }
            .time-text { font-size: 0.9em; }
            .assignment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .assignment-item { margin: 5px 0; }
            .assignment-full { grid-column: span 2; }
            @media print {
              .route-section { page-break-inside: avoid; }
              body { font-size: 12pt; }
            }
          </style>
        </head>
        <body>
          <h1>Route Status Timestamp Report</h1>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><em>Complete route status and assignment history</em></p>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  /**
   * Clear all timestamps
   */
  clearAllTimestamps() {
    if (confirm('Are you sure you want to clear all status timestamps? This action cannot be undone.')) {
      STATE.statusTimestamps = {};
      saveToLocalStorage();
      this.generateTimestampReport();
      console.log('🗑️ All timestamps cleared');
    }
  }

  /**
   * Setup communication between modules
   */
  setupModuleCommunication() {
    // Enable cross-module communication through events
    eventBus.emit('modules:loaded', {
      modules: Array.from(this.modules.keys())
    });

    // Setup module-specific event subscriptions
    this.modules.forEach((module, name) => {
      if (module.setupEventListeners) {
        module.setupEventListeners();
      }
    });
  }

  /**
   * Initialize application state from localStorage or defaults
   */
  initializeApplicationState() {
    const savedState = getState('appConfig');
    const defaultConfig = {
      theme: 'light',
      touchMode: this.detectTouchDevice(),
      autoSave: true,
      notifications: true,
      keyboardShortcuts: true
    };
    
    const appConfig = { ...defaultConfig, ...savedState };
    setState('appConfig', appConfig);
    
    // Apply configuration
    document.body.classList.toggle('touch-primary', appConfig.touchMode);
    document.body.classList.toggle('dark-theme', appConfig.theme === 'dark');
  }

  /**
   * Setup global keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const shortcuts = {
      'Ctrl+/': () => this.modules.get('UIUtilities')?.toggleShortcutHelp(),
      'Ctrl+S': (e) => {
        e.preventDefault();
        this.saveAllData();
      },
      'Escape': () => this.modules.get('UISystem')?.closeAllModals(),
      'Ctrl+F': (e) => {
        e.preventDefault();
        this.modules.get('UIUtilities')?.focusGlobalSearch();
      }
    };

    document.addEventListener('keydown', (e) => {
      const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
      if (shortcuts[key]) {
        shortcuts[key](e);
      }
    });
  }

  /**
   * Setup touch-specific optimizations
   */
  setupTouchOptimizations() {
    if (this.detectTouchDevice()) {
      // Enable touch gestures
      this.modules.get('TouchGestures')?.enableAllGestures();
      
      // Setup responsive breakpoints
      this.modules.get('TouchResponsive')?.setupBreakpoints();
      
      // Optimize UI for touch
      document.body.classList.add('touch-optimized');
    }
  }

  /**
   * Setup auto-save functionality
   */
  setupAutoSave() {
    let saveTimeout;
    
    eventBus.on('data:changed', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveAllData();
      }, 2000); // Auto-save after 2 seconds of inactivity
    });
  }

  /**
   * Register service worker for offline functionality
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('📱 Service Worker registered:', registration);
      } catch (error) {
        console.log('📱 Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Show the main application interface
   */
  showApplication() {
    const loadingScreen = document.getElementById('loading-screen');
    const appContainer = document.getElementById('app');
    
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    if (appContainer) {
      appContainer.classList.add('loaded');
    }
    
    console.log('🎨 Application interface shown');
  }

  /**
   * Detect if device supports touch
   */
  detectTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Save all application data
   */
  async saveAllData() {
    try {
      console.log('💾 Saving application data...');
      
      // Save data from all modules that support it
      const savePromises = [];
      
      this.modules.forEach((module, name) => {
        if (module.save) {
          savePromises.push(module.save());
        }
      });
      
      await Promise.all(savePromises);
      
      eventBus.emit('app:dataSaved', {
        timestamp: new Date().toISOString(),
        moduleCount: savePromises.length
      });
      
      console.log('✅ Application data saved');
      
    } catch (error) {
      console.error('❌ Error saving application data:', error);
      eventBus.emit('app:saveError', error);
    }
  }

  /**
   * Get a specific module instance
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Get all module instances
   */
  getAllModules() {
    return new Map(this.modules);
  }

  /**
   * Handle application errors
   */
  handleError(event) {
    console.error('🚨 Application Error:', event.error || event.reason);
    
    eventBus.emit('app:error', {
      error: event.error || event.reason,
      type: event.type,
      timestamp: new Date().toISOString()
    });
    
    // Show user-friendly error message
    this.modules.get('UISystem')?.showNotification({
      type: 'error',
      title: 'Application Error',
      message: 'An unexpected error occurred. The application will continue to function.',
      duration: 5000
    });
  }

  /**
   * Handle initialization errors
   */
  handleInitializationError(error) {
    document.body.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #fee2e2;
        color: #991b1b;
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;

      */
      </div>
    `;
  }

  /**
   * Handle application unload
   */
  handleUnload() {
    console.log('🔄 Application unloading...');
    
    // Save critical data before unload
    this.saveAllData();
    
    // Cleanup modules
    this.modules.forEach((module, name) => {
      if (module.cleanup) {
        module.cleanup();
      }
    });
    
    eventBus.emit('app:unload');
  }

  /**
   * Restart the application
   */
  async restart() {
    console.log('🔄 Restarting application...');
    
    // Cleanup existing modules
    this.handleUnload();
    
    // Clear modules
    this.modules.clear();
    this.initialized = false;
    
    // Reinitialize
    await this.init();
  }
}

// ==========================================================================
// APPLICATION BOOTSTRAP
// ==========================================================================

// Global app instance
let app;

/**
 * Initialize the application when DOM is ready
 */
async function bootstrap() {
  try {
    console.log('🌟 Bootstrapping Modular Dispatch Dashboard...');
    
    // Create and initialize application
    app = new ModularDispatchApp();
    await app.init();
    
    // Make app globally accessible for debugging
    window.DispatchApp = app;
    
    // Make uiSystem globally accessible for bulk entry functions
    window.uiSystem = app.getModule('UISystem');
    
    // Make route cards functions globally accessible
    window.resetRouteBoard = resetRouteBoard;
    
    // Setup development helpers (always enable in browser)
    setupDevelopmentHelpers();

    // === Route Import/Export/Bulk Entry UI ===
    const importExport = app.getModule('DataImportExport');
    // Export Routes
    const exportBtn = document.getElementById('export-routes-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          importExport.exportData('routes', 'csv');
          setBulkStatus('Routes exported as CSV.');
        } catch (err) {
          setBulkStatus('Export failed: ' + err.message, true);
        }
      });
    }
    // === Hamburger/Settings Slide-Out Logic ===
    const hamburgerBtn = document.getElementById('hamburger-menu-btn');
    const slideout = document.getElementById('settings-slideout');
    const slideoutClose = document.getElementById('settings-slideout-close');
    let slideoutOverlay = document.getElementById('settings-slideout-overlay');
    if (!slideoutOverlay) {
      slideoutOverlay = document.createElement('div');
      slideoutOverlay.id = 'settings-slideout-overlay';
      slideoutOverlay.className = 'fixed inset-0 bg-black bg-opacity-20 z-40 hidden';
      document.body.appendChild(slideoutOverlay);
    }
    function openSlideout() {
      if (slideout) {
        slideout.classList.remove('-translate-x-full');
        slideout.classList.add('translate-x-0');
        slideoutOverlay.classList.remove('hidden');
        // Always show main menu on open
        showSettingsMenu();
      }
    }
    function closeSlideout() {
      if (slideout) {
        slideout.classList.add('-translate-x-full');
        slideout.classList.remove('translate-x-0');
        slideoutOverlay.classList.add('hidden');
      }
    }
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', openSlideout);
    }
    if (slideoutClose) {
      slideoutClose.addEventListener('click', closeSlideout);
    }
    slideoutOverlay.addEventListener('click', closeSlideout);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && slideout && !slideout.classList.contains('-translate-x-full')) {
        closeSlideout();
      }
    });

    // === Settings Slide-Out Tab Logic ===
    const settingsMenu = document.getElementById('settings-main-menu');
    const openRouteBtn = document.getElementById('open-route-management');

    // Asset management button
    const openAssetBtn = document.getElementById('open-asset-management');

    // Staff management button
    const openStaffBtn = document.getElementById('open-staff-management');

    // Staff details button
    const staffDetailsBtn = document.getElementById('staff-details-btn');

    // Debug - check if buttons exist
    console.log('🔍 Button check completed');
    console.log('Route Management, Asset Management, and Staff Management buttons ready');

    // System functions

    function showSettingsMenu() {
      if (settingsMenu) settingsMenu.classList.remove('hidden');
    }
    if (openRouteBtn) {
      openRouteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSlideout();
        
        // Use same approach as Dashboard Settings - show existing modal
        const modal = document.getElementById('route-management-modal');
        if (modal) {
          modal.classList.remove('hidden');
          
          // Setup route management modal and render grid
          if (window.setupRouteManagementModal) {
            window.setupRouteManagementModal();
          }
          if (window.renderRouteConfigGrid) {
            window.renderRouteConfigGrid();
          }
        }
      });
    }
    // Add click handler for Staff Details button to navigate to staff-details.html
    if (staffDetailsBtn) {
      staffDetailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('👥 Staff Details button clicked - navigating to staff management');
        window.location.href = 'staff-details.html';
      });
    }

    if (openAssetBtn) {
      openAssetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSlideout();
        
        // Use same approach as Dashboard Settings - show existing modal
        const modal = document.getElementById('asset-management-modal');
        if (modal) {
          modal.classList.remove('hidden');
          // Refresh the asset list when modal opens
          if (window.refreshAssetListModal) {
            window.refreshAssetListModal();
          }
        }
      });
    }

    if (openStaffBtn) {
      openStaffBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSlideout();
        
        // Use same approach as Dashboard Settings - show existing modal
        const modal = document.getElementById('staff-management-modal');
        if (modal) {
          modal.classList.remove('hidden');
          // Refresh the staff list when modal opens
          if (window.refreshStaffListModal) {
            window.refreshStaffListModal();
          }
        }
      });
    }

    if (staffDetailsBtn) {
      staffDetailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Close slideout for a clean transition
        if (typeof closeSlideout === 'function') closeSlideout();
        console.log('👥 Staff Details button clicked - navigating to staff details page');
        // Navigate to the dedicated staff details page
        window.location.href = 'staff-details.html';
      });
    }

    // Close button handlers for modals
    const routeModalClose = document.getElementById('route-modal-close');
    if (routeModalClose) {
      routeModalClose.addEventListener('click', () => {
        const modal = document.getElementById('route-management-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const assetModalClose = document.getElementById('asset-modal-close');
    if (assetModalClose) {
      assetModalClose.addEventListener('click', () => {
        const modal = document.getElementById('asset-management-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const staffModalClose = document.getElementById('staff-modal-close');
    if (staffModalClose) {
      staffModalClose.addEventListener('click', () => {
        const modal = document.getElementById('staff-management-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    // Route Management CSV Import Functionality
    const setupRouteCSVImport = () => {
      const dropZone = document.getElementById('csv-drop-zone');
      const fileInput = document.getElementById('csv-file-input');
      const statusDiv = document.getElementById('csv-status');

      if (!dropZone || !fileInput || !statusDiv) return;

      // Click to browse
      dropZone.addEventListener('click', () => {
        fileInput.click();
      });

      // File input change
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processRouteCSV(file);
      });

      // Drag & Drop events
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-200');
      });

      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-200');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-200');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const file = files[0];
          if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            processRouteCSV(file);
          } else {
            showCSVStatus('Please drop a CSV file', true);
          }
        }
      });

      // Process CSV file
      const processRouteCSV = async (file) => {
        try {
          showCSVStatus('Processing CSV file...', false);
          
          const text = await file.text();
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            showCSVStatus('CSV file is empty', true);
            return;
          }

          let importedCount = 0;
          let errorCount = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handle quotes and commas)
            const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
            
            if (parts.length >= 2) {
              const routeName = parts[0];
              const shift = parts[1] || 'AM';
              const status = parts[2] || 'active';
              
              // Validate shift
              if (!['AM', 'PM', 'Both'].includes(shift)) {
                console.warn(`Invalid shift "${shift}" for route "${routeName}", using AM`);
              }
              
              // Validate status
              if (!['active', 'inactive'].includes(status)) {
                console.warn(`Invalid status "${status}" for route "${routeName}", using active`);
              }
              
              // Add route (calling the state management function)
              if (routeName) {
                const success = addRoute({
                  name: routeName,
                  shift: shift,
                  status: status,
                  type: 'Gen Ed' // Default type
                });
                
                if (success) {
                  console.log(`Adding route: ${routeName}, ${shift}, ${status}`);
                  // TODO: Call your route addition function here
                  // addRoute({ name: routeName, shift, status });
                  importedCount++;
                } else {
                  console.warn(`Route ${routeName} already exists`);
                  errorCount++;
                }
              }
            } else {
              errorCount++;
              console.warn(`Invalid CSV line ${i + 1}: ${line}`);
            }
          }
          
          showCSVStatus(`✅ Imported ${importedCount} routes successfully` + 
                       (errorCount > 0 ? ` (${errorCount} errors)` : ''), false);
          
          // Clear file input
          fileInput.value = '';
          
        } catch (error) {
          console.error('Error processing CSV:', error);
          showCSVStatus('❌ Error processing CSV file', true);
        }
      };

      // Show status message
      const showCSVStatus = (message, isError) => {
        statusDiv.textContent = message;
        statusDiv.className = `mt-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        statusDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          statusDiv.classList.add('hidden');
        }, 5000);
      };
    };

    // Manual Bulk Entry Functionality
    const setupManualBulkEntry = () => {
      const bulkAddBtn = document.getElementById('bulk-add-routes');
      const bulkInput = document.getElementById('bulk-route-input');
      const bulkStatus = document.getElementById('bulk-status');
      const defaultShift = document.getElementById('bulk-default-shift');
      const defaultStatus = document.getElementById('bulk-default-status');

      if (!bulkAddBtn || !bulkInput) return;

      bulkAddBtn.addEventListener('click', () => {
        const text = bulkInput.value.trim();
        if (!text) {
          showBulkStatus('Please enter some routes to add.', true);
          return;
        }

        processBulkRoutes(text);
      });

      const processBulkRoutes = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          showBulkStatus('No routes found to process.', true);
          return;
        }

        let addedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const result = parseBulkRouteLine(line, i + 1);
            if (result.success) {
              // Add route to the system using the state management function
              const success = addRoute({
                name: result.route.name,
                shift: result.route.shift,
                status: result.route.status,
                type: 'Gen Ed' // Default type, could be enhanced later
              });
              
              if (success) {
                console.log(`Added route: ${result.route.name}, ${result.route.shift}, ${result.route.status}`);
                addedCount++;
              } else {
                errors.push(`Route ${result.route.name} already exists`);
                errorCount++;
              }
            } else {
              errors.push(result.error);
              errorCount++;
            }
          } catch (error) {
            errors.push(`Line ${i + 1}: ${error.message}`);
            errorCount++;
          }
        }

        // Show results
        if (addedCount > 0) {
          showBulkStatus(`✅ Successfully added ${addedCount} routes!` + 
                       (errorCount > 0 ? ` (${errorCount} errors)` : ''), 
                       errorCount > 0);
          if (errorCount === 0) {
            bulkInput.value = ''; // Clear input on success
          }
          
          // Refresh the route list display if UI system is available
          if (window.uiSystem && typeof window.uiSystem.refreshRouteList === 'function') {
            window.uiSystem.refreshRouteList();
          }
        } else {
          showBulkStatus(`❌ No routes were added. ${errorCount} errors found.`, true);
        }

        // Show detailed errors if any
        if (errors.length > 0) {
          console.warn('Bulk route entry errors:', errors);
        }
      };

      const parseBulkRouteLine = (line, lineNumber) => {
        // Split by comma and clean up
        const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length === 0 || !parts[0]) {
          return { success: false, error: `Line ${lineNumber}: Route name is required` };
        }

        const routeName = parts[0];
        
        // Get shift - from line, or default, or 'AM'
        let shift = parts[1] || defaultShift.value || 'AM';
        if (!['AM', 'PM', 'Both'].includes(shift)) {
          return { success: false, error: `Line ${lineNumber}: Invalid shift "${shift}". Must be AM, PM, or Both` };
        }

        // Get status - from line, or default, or 'active'
        let status = parts[2] || defaultStatus.value || 'active';
        if (!['active', 'inactive'].includes(status)) {
          return { success: false, error: `Line ${lineNumber}: Invalid status "${status}". Must be active or inactive` };
        }

        return {
          success: true,
          route: {
            name: routeName,
            shift: shift,
            status: status
          }
        };
      };

      const showBulkStatus = (message, isError) => {
        if (!bulkStatus) return;
        
        bulkStatus.innerHTML = message;
        bulkStatus.className = `mt-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        bulkStatus.classList.remove('hidden');
        
        // Auto-hide after 8 seconds (longer for bulk operations)
        setTimeout(() => {
          bulkStatus.classList.add('hidden');
        }, 8000);
      };
    };

    // Asset Bulk Management Functionality
    const setupAssetBulkManagement = () => {
      // Function to refresh the asset list in the modal
      const refreshAssetListModal = () => {
        console.log('🔍 Refreshing asset list modal...');
        const assetListContainer = document.getElementById('asset-list-modal');
        if (!assetListContainer) {
          console.warn('❌ Asset list container not found');
          return;
        }

        // Get current assets from state
        const assets = STATE.data && STATE.data.assets ? STATE.data.assets : [];
        console.log(`📊 Found ${assets.length} assets in STATE.data.assets`);
        
        if (assets.length === 0) {
          assetListContainer.innerHTML = '<p class="text-gray-500 text-sm">No assets found</p>';
          return;
        }

        // Create asset list HTML
        const assetItems = assets.map(asset => {
          const statusClass = asset.status === 'active' ? 'bg-green-100 text-green-800' :
                              asset.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800';
          
          return `
            <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
              <div>
                <span class="font-medium">${asset.name}</span>
                <span class="text-gray-600 text-sm"> - ${asset.type}</span>
                ${asset.capacity > 0 ? `<span class="text-gray-500 text-sm"> (${asset.capacity})</span>` : ''}
              </div>
              <span class="px-2 py-1 rounded text-xs ${statusClass}">${asset.status}</span>
            </div>
          `;
        }).join('');

        assetListContainer.innerHTML = assetItems;
        console.log('✅ Asset list modal refreshed');
      };

      // Make function available globally for use in modal open
      window.refreshAssetListModal = refreshAssetListModal;

      // CSV Import functionality for assets
      const csvDropZone = document.getElementById('asset-csv-drop-zone');
      const csvFileInput = document.getElementById('asset-csv-file-input');
      const csvStatus = document.getElementById('asset-csv-status');

      if (csvDropZone && csvFileInput) {
        // File input change handler
        csvFileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            handleAssetCSVFile(e.target.files[0]);
          }
        });

        // Drag and drop handlers
        csvDropZone.addEventListener('click', () => {
          csvFileInput.click();
        });

        csvDropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          csvDropZone.classList.add('border-green-500', 'bg-green-200');
        });

        csvDropZone.addEventListener('dragleave', () => {
          csvDropZone.classList.remove('border-green-500', 'bg-green-200');
        });

        csvDropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          csvDropZone.classList.remove('border-green-500', 'bg-green-200');
          
          if (e.dataTransfer.files.length > 0) {
            handleAssetCSVFile(e.dataTransfer.files[0]);
          }
        });
      }

      // Manual bulk entry functionality for assets
      const bulkAddBtn = document.getElementById('bulk-add-assets');
      const bulkInput = document.getElementById('bulk-asset-input');
      const bulkStatus = document.getElementById('asset-bulk-status');
      const defaultType = document.getElementById('bulk-default-asset-type');
      const defaultStatus = document.getElementById('bulk-default-asset-status');

      if (bulkAddBtn && bulkInput) {
        bulkAddBtn.addEventListener('click', () => {
          const text = bulkInput.value.trim();
          if (!text) {
            showAssetBulkStatus('Please enter some assets to add.', true);
            return;
          }

          processAssetBulkEntry(text);
        });
      }

      const handleAssetCSVFile = async (file) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          showAssetCSVStatus('Please select a CSV file.', true);
          return;
        }

        try {
          showAssetCSVStatus('Processing CSV file...', false);
          
          const text = await file.text();
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            showAssetCSVStatus('CSV file is empty', true);
            return;
          }

          let importedCount = 0;
          let errorCount = 0;
          let duplicateCount = 0;
          let skipHeader = true;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Skip header row if it looks like headers
            if (skipHeader && (line.toLowerCase().includes('vehicle') || line.toLowerCase().includes('asset'))) {
              skipHeader = false;
              continue;
            }
            skipHeader = false;

            try {
              const result = parseAssetCSVLine(line, i + 1);
              if (result.success) {
                console.log(`🔍 Attempting to add asset:`, result.asset);
                
                // Add asset to the system using the state management function
                const success = addAsset({
                  name: result.asset.name,
                  capacity: result.asset.capacity,
                  type: result.asset.type,
                  status: result.asset.status
                });
                
                if (success) {
                  console.log(`✅ Added asset: ${result.asset.name}, capacity: ${result.asset.capacity}, type: ${result.asset.type}, status: ${result.asset.status}`);
                  importedCount++;
                } else {
                  console.warn(`❌ Asset ${result.asset.name} already exists or failed to add`);
                  duplicateCount++;
                }
              } else {
                console.warn(`❌ Parse error: ${result.error}`);
                errorCount++;
              }
            } catch (error) {
              console.error(`Line ${i + 1} error:`, error);
              errorCount++;
            }
          }

          // Show appropriate message based on results
          if (importedCount > 0) {
            showAssetCSVStatus(`✅ Imported ${importedCount} new assets` + 
                             (duplicateCount > 0 ? ` (${duplicateCount} already existed)` : '') +
                             (errorCount > 0 ? ` (${errorCount} errors)` : ''), 
                             false);
          } else if (duplicateCount > 0 && errorCount === 0) {
            showAssetCSVStatus(`ℹ️ All ${duplicateCount} assets already exist in the system`, false);
          } else {
            showAssetCSVStatus(`❌ Import failed: ${errorCount} errors, ${duplicateCount} duplicates`, true);
          }
          
          if (importedCount > 0 || duplicateCount > 0) {
            csvFileInput.value = '';
            
            // Always refresh the asset list display since we want to show existing assets
            if (window.uiSystem && typeof window.uiSystem.refreshAssetList === 'function') {
              window.uiSystem.refreshAssetList();
            }
            
            // Refresh the asset list in the modal
            if (window.refreshAssetListModal) {
              window.refreshAssetListModal();
            }
            
            // Refresh the Resource Monitor panel asset list
            if (window.renderAssetPanel) {
              window.renderAssetPanel();
            }
          }
          
        } catch (error) {
          console.error('Error processing asset CSV:', error);
          showAssetCSVStatus('❌ Error processing CSV file', true);
        }
      };

      const processAssetBulkEntry = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          showAssetBulkStatus('No assets found to process.', true);
          return;
        }

        let addedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const result = parseAssetBulkLine(line, i + 1);
            if (result.success) {
              // Add asset to the system using the state management function
              const success = addAsset({
                name: result.asset.name,
                capacity: result.asset.capacity,
                type: result.asset.type,
                status: result.asset.status
              });
              
              if (success) {
                console.log(`Added asset: ${result.asset.name}, capacity: ${result.asset.capacity}, type: ${result.asset.type}, status: ${result.asset.status}`);
                addedCount++;
              } else {
                errors.push(`Asset ${result.asset.name} already exists`);
                errorCount++;
              }
            } else {
              errors.push(result.error);
              errorCount++;
            }
          } catch (error) {
            errors.push(`Line ${i + 1}: ${error.message}`);
            errorCount++;
          }
        }

        // Show results
        if (addedCount > 0) {
          showAssetBulkStatus(`✅ Successfully added ${addedCount} assets!` + 
                             (errorCount > 0 ? ` (${errorCount} errors)` : ''), 
                             errorCount > 0);
          if (errorCount === 0) {
            bulkInput.value = '';
          }
          
          // Refresh the asset list display if UI system is available
          if (window.uiSystem && typeof window.uiSystem.refreshAssetList === 'function') {
            window.uiSystem.refreshAssetList();
          }
          
          // Refresh the asset list in the modal
          if (window.refreshAssetListModal) {
            window.refreshAssetListModal();
          }
          
          // Refresh the Resource Monitor panel asset list
          if (window.renderAssetPanel) {
            window.renderAssetPanel();
          }
        } else {
          showAssetBulkStatus(`❌ No assets were added. ${errorCount} errors found.`, true);
        }

        if (errors.length > 0) {
          console.warn('Asset bulk entry errors:', errors);
        }
      };

      const parseAssetCSVLine = (line, lineNumber) => {
        const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length < 1 || !parts[0]) {
          return { success: false, error: `Line ${lineNumber}: Vehicle Number is required` };
        }

        const vehicleNumber = parts[0];
        // Handle empty or missing capacity
        let capacity = 0;
        if (parts[1] && parts[1].trim() !== '') {
          capacity = parseInt(parts[1]);
          if (isNaN(capacity) || capacity < 0) {
            console.warn(`Line ${lineNumber}: Invalid capacity "${parts[1]}", using 0`);
            capacity = 0;
          }
        }

        // Determine type based on vehicle number or use provided value
        let type = parts[2] || guessAssetType(vehicleNumber);
        const validTypes = ['Bus', 'Van', 'Car', 'Suburban', 'Other'];
        if (!validTypes.includes(type)) {
          console.warn(`Line ${lineNumber}: Invalid type "${type}", using "Other"`);
          type = 'Other';
        }

        // Get status
        let status = parts[3] || 'active';
        const validStatuses = ['active', 'maintenance', 'retired'];
        if (!validStatuses.includes(status)) {
          console.warn(`Line ${lineNumber}: Invalid status "${status}", using "active"`);
          status = 'active';
        }

        return {
          success: true,
          asset: {
            name: vehicleNumber,
            capacity: capacity,
            type: type,
            status: status
          }
        };
      };

      const parseAssetBulkLine = (line, lineNumber) => {
        const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
        
        if (parts.length < 2 || !parts[0]) {
          return { success: false, error: `Line ${lineNumber}: Vehicle Number and Capacity are required` };
        }

        const vehicleNumber = parts[0];
        const capacity = parts[1] ? parseInt(parts[1]) : 0;
        
        if (isNaN(capacity) || capacity < 0) {
          return { success: false, error: `Line ${lineNumber}: Invalid capacity "${parts[1]}"` };
        }

        // Get type - from line, or default, or guess from name
        let type = parts[2] || defaultType.value || guessAssetType(vehicleNumber);
        const validTypes = ['Bus', 'Van', 'Car', 'Suburban', 'Other'];
        if (!validTypes.includes(type)) {
          return { success: false, error: `Line ${lineNumber}: Invalid type "${type}". Must be Bus, Van, Car, Suburban, or Other` };
        }

        // Get status - from line, or default, or 'active'
        let status = parts[3] || defaultStatus.value || 'active';
        const validStatuses = ['active', 'maintenance', 'retired'];
        if (!validStatuses.includes(status)) {
          return { success: false, error: `Line ${lineNumber}: Invalid status "${status}". Must be active, maintenance, or retired` };
        }

        return {
          success: true,
          asset: {
            name: vehicleNumber,
            capacity: capacity,
            type: type,
            status: status
          }
        };
      };

      const guessAssetType = (vehicleName) => {
        const name = vehicleName.toLowerCase();
        
        // Check for specific patterns
        if (name.includes('suv')) return 'Suburban';
        if (name.includes('van')) return 'Van';
        if (name.includes('car')) return 'Car';
        if (name.includes('truck') || name.includes('trk')) return 'Other';
        if (name.includes('trailer') || name.includes('trl')) return 'Other';
        if (name.includes('shop')) return 'Other';
        if (name.includes('maint')) return 'Other';
        
        // If it's a number only, likely a bus
        if (/^\d+$/.test(vehicleName.trim())) return 'Bus';
        
        // If it starts with numbers, likely a bus
        if (/^\d/.test(vehicleName.trim())) return 'Bus';
        
        // Default to Bus for any unrecognized pattern
        return 'Bus';
      };

      const showAssetCSVStatus = (message, isError) => {
        if (!csvStatus) return;
        
        csvStatus.innerHTML = message;
        csvStatus.className = `mt-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        csvStatus.classList.remove('hidden');
        
        setTimeout(() => {
          csvStatus.classList.add('hidden');
        }, 5000);
      };

      const showAssetBulkStatus = (message, isError) => {
        if (!bulkStatus) return;
        
        bulkStatus.innerHTML = message;
        bulkStatus.className = `mt-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        bulkStatus.classList.remove('hidden');
        
        setTimeout(() => {
          bulkStatus.classList.add('hidden');
        }, 8000);
      };
    };

    // Staff Management Functionality
    const setupStaffManagement = () => {
      console.log('👥 Setting up staff management...');

      // Make function available globally for use in modal open
      window.refreshStaffListModal = refreshStaffListModal;

      // Staff form submission
      const staffForm = document.getElementById('add-staff-form');
      if (staffForm) {
        staffForm.addEventListener('submit', (e) => {
          e.preventDefault();
          
          const formData = {
            firstName: document.getElementById('staff-first-name').value.trim(),
            lastName: document.getElementById('staff-last-name').value.trim(),
            employeeId: document.getElementById('staff-employee-id').value.trim(),
            position: document.getElementById('staff-position').value.trim(),
            department: document.getElementById('staff-department').value,
            status: document.getElementById('staff-status').value,
            phone: document.getElementById('staff-phone').value.trim(),
            email: document.getElementById('staff-email').value.trim(),
            notes: document.getElementById('staff-notes').value.trim()
          };

          if (!formData.firstName || !formData.lastName) {
            showStaffStatus('First name and last name are required.', true);
            return;
          }

          try {
            const editingId = staffForm.dataset.editingId;
            
            if (editingId) {
              // Update existing staff member
              updateStaffMember(editingId, formData);
              delete staffForm.dataset.editingId;
              
              // Reset button text
              const submitBtn = staffForm.querySelector('button[type="submit"]');
              if (submitBtn) {
                submitBtn.textContent = 'Add Staff Member';
                submitBtn.className = 'px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700';
              }
            } else {
              // Add new staff member
              window.addNewStaffMember(formData);
            }

            // Clear form
            staffForm.reset();
            showStaffStatus('Staff member saved successfully!', false);
            
          } catch (error) {
            console.error('Error saving staff member:', error);
            showStaffStatus('Error saving staff member. Please try again.', true);
          }
        });
      }

      // Export staff button
      const exportBtn = document.getElementById('export-staff-list');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          window.exportStaffListAsCSV();
        });
      }

      // CSV Import functionality for staff
      const csvDropZone = document.getElementById('staff-csv-drop-zone');
      const csvFileInput = document.getElementById('staff-csv-file-input');
      const csvStatus = document.getElementById('staff-csv-status');

      if (csvDropZone && csvFileInput) {
        // File input change handler
        csvFileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            handleStaffCSVFile(e.target.files[0]);
          }
        });

        // Drag and drop handlers
        csvDropZone.addEventListener('click', () => {
          csvFileInput.click();
        });

        csvDropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          csvDropZone.classList.add('border-purple-500', 'bg-purple-200');
        });

        csvDropZone.addEventListener('dragleave', () => {
          csvDropZone.classList.remove('border-purple-500', 'bg-purple-200');
        });

        csvDropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          csvDropZone.classList.remove('border-purple-500', 'bg-purple-200');
          
          if (e.dataTransfer.files.length > 0) {
            handleStaffCSVFile(e.dataTransfer.files[0]);
          }
        });
      }

      const handleStaffCSVFile = async (file) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          showStaffCSVStatus('Please select a CSV file.', true);
          return;
        }

        try {
          showStaffCSVStatus('Processing CSV file...', false);
          
          const result = await window.handleStaffCSVImport(file);
          showStaffCSVStatus(`✅ Successfully imported ${result.imported} out of ${result.total} staff members.`, false);
          
        } catch (error) {
          console.error('Error processing staff CSV:', error);
          showStaffCSVStatus(`❌ Error processing CSV: ${error.message}`, true);
        }
      };

      const updateStaffMember = (staffId, formData) => {
        if (!STATE.data || !STATE.data.staff) {
          throw new Error('No staff data available');
        }

        const staffIndex = STATE.data.staff.findIndex(s => s.id === staffId || s.name === staffId);
        if (staffIndex === -1) {
          throw new Error('Staff member not found');
        }

        // Update the staff member
        const updatedStaff = {
          ...STATE.data.staff[staffIndex],
          firstName: formData.firstName,
          lastName: formData.lastName,
          name: `${formData.firstName} ${formData.lastName}`,
          employeeId: formData.employeeId,
          position: formData.position,
          role: formData.position,
          department: formData.department,
          status: formData.status,
          phone: formData.phone,
          email: formData.email,
          notes: formData.notes,
          lastUpdated: new Date().toISOString()
        };

        STATE.data.staff[staffIndex] = updatedStaff;
        saveToLocalStorage();

        // Refresh displays
        window.refreshStaffListModal();
        window.renderStaffPanel();

        console.log(`✅ Staff member updated: ${updatedStaff.name}`);
      };

      const showStaffStatus = (message, isError) => {
        const staffForm = document.getElementById('add-staff-form');
        if (!staffForm) return;
        
        // Create or update status message
        let statusElement = document.getElementById('staff-form-status');
        if (!statusElement) {
          statusElement = document.createElement('div');
          statusElement.id = 'staff-form-status';
          staffForm.appendChild(statusElement);
        }
        
        statusElement.innerHTML = message;
        statusElement.className = `mt-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        statusElement.classList.remove('hidden');
        
        setTimeout(() => {
          statusElement.classList.add('hidden');
        }, 5000);
      };

      const showStaffCSVStatus = (message, isError) => {
        if (!csvStatus) return;
        
        csvStatus.innerHTML = message;
        csvStatus.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`;
        csvStatus.classList.remove('hidden');
        
        setTimeout(() => {
          csvStatus.classList.add('hidden');
        }, 5000);
      };
    };

    // Initialize CSV import functionality
    setupRouteCSVImport();
    
    // Initialize manual bulk entry functionality
    setupManualBulkEntry();

    // Initialize staff management
    setupStaffManagement();
    
    // Initialize asset bulk management functionality
    setupAssetBulkManagement();
    
    // Comprehensive Settings Dialog Handler
    const openComprehensiveSettingsBtn = document.getElementById('open-comprehensive-settings');
    if (openComprehensiveSettingsBtn) {
      openComprehensiveSettingsBtn.addEventListener('click', () => {
        closeSlideout();
        settingsSystem.openSettingsDialog();
      });
    }
    
    // Export All Data Handler
    const exportAllDataBtn = document.getElementById('export-all-data');
    if (exportAllDataBtn) {
      exportAllDataBtn.addEventListener('click', () => {
        closeSlideout();
        settingsSystem.exportAllData();
      });
    }
    
    // Import Data Handler
    const importDataBtn = document.getElementById('import-data');
    if (importDataBtn) {
      importDataBtn.addEventListener('click', () => {
        closeSlideout();
        settingsSystem.showImportDialog();
      });
    }
    
    // Advanced Search Dialog Handler
    const openSearchDialogBtn = document.getElementById('open-search-dialog');
    if (openSearchDialogBtn) {
      openSearchDialogBtn.addEventListener('click', () => {
        closeSlideout();
        // Open the advanced search overlay
        const searchOverlay = document.getElementById('search-overlay');
        if (searchOverlay) {
          searchOverlay.classList.remove('hidden');
        }
      });
    }
    
    // Advanced Search Close Handler
    const searchOverlayCloseBtn = document.getElementById('search-overlay-close');
    if (searchOverlayCloseBtn) {
      searchOverlayCloseBtn.addEventListener('click', () => {
        const searchOverlay = document.getElementById('search-overlay');
        if (searchOverlay) {
          searchOverlay.classList.add('hidden');
        }
      });
    }
    
    // Close search overlay when clicking outside
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay) {
      searchOverlay.addEventListener('click', (e) => {
        // Only close if clicking the overlay background, not the modal content
        if (e.target === searchOverlay) {
          searchOverlay.classList.add('hidden');
        }
      });
    }
    // Import Routes (file)
    const importInput = document.getElementById('import-routes-input');
    if (importInput) {
      importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          if (file.name.endsWith('.csv')) {
            await importExport.importCSV(file, 'routes');
            setBulkStatus('Routes imported from CSV.');
          } else if (file.name.endsWith('.json')) {
            const text = await file.text();
            const data = JSON.parse(text);
            await importExport.processImportData(data, 'routes');
            setBulkStatus('Routes imported from JSON.');
          } else {
            setBulkStatus('Unsupported file type.', true);
          }
        } catch (err) {
          setBulkStatus('Import failed: ' + err.message, true);
        }
        importInput.value = '';
      });
    }
    // Bulk Entry (textarea)
    const bulkTextarea = document.getElementById('bulk-routes-textarea');
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    const bulkClearBtn = document.getElementById('bulk-clear-btn');
    if (bulkImportBtn && bulkTextarea) {
      bulkImportBtn.addEventListener('click', async () => {
        const val = bulkTextarea.value.trim();
        if (!val) return setBulkStatus('Paste CSV or JSON to import.', true);
        try {
          if (val.startsWith('[') || val.startsWith('{')) {
            // JSON
            const data = JSON.parse(val);
            await importExport.processImportData(data, 'routes');
            setBulkStatus('Routes imported from JSON.');
          } else {
            // CSV
            const data = importExport.parseCSV(val);
            await importExport.processImportData(data, 'routes');
            setBulkStatus('Routes imported from CSV.');
          }
        } catch (err) {
          setBulkStatus('Bulk import failed: ' + err.message, true);
        }
      });
    }
    if (bulkClearBtn && bulkTextarea) {
      bulkClearBtn.addEventListener('click', () => {
        bulkTextarea.value = '';
        setBulkStatus('');
      });
    }
    function setBulkStatus(msg, isError) {
      const el = document.getElementById('bulk-import-status');
      if (el) {
        el.textContent = msg;
        el.className = 'text-xs mt-1 ' + (isError ? 'text-red-500' : 'text-gray-500');
      }
    }
    
  } catch (error) {
    console.error('💥 Bootstrap failed:', error);
    throw error;
  }
}

/**
 * Setup development helpers
 */
function setupDevelopmentHelpers() {
  // Global helper functions for development
  window.DispatchDev = {
    getModule: (name) => app.getModule(name),
    getAllModules: () => app.getAllModules(),
    restart: () => app.restart(),
    saveData: () => app.saveAllData(),
    getState: () => app.modules.get('CoreState'),
    getEvents: () => app.modules.get('CoreEvents')
  };
  
  // Make route card functions globally accessible
  window.renderRouteCards = renderRouteCards;
  window.createRoute = createRoute;
  window.assignDriver = assignDriver;
  window.assignAsset = assignAsset;
  window.addSafetyEscort = addSafetyEscort;
  window.removeSafetyEscort = removeSafetyEscort;
  window.updateRouteNotes = updateRouteNotes;
  window.ROUTE_TYPES = ROUTE_TYPES;
  
  console.log('🛠️ Development helpers available on window.DispatchDev');
  console.log('🚗 Route card functions available globally');
}

// Bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for module usage
export { ModularDispatchApp, bootstrap };
export default app;
