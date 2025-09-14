/**
 * UI UTILITIES MODULE
 * Transportation Dispatch Dashboard
 * 
 * Comprehensive UI utility system for:
 * - Context menus and right-click interactions
 * - Tab navigation and management
 * - Advanced search and filtering
 * - Keyboard shortcuts and hotkeys
 * - UI animations and transitions
 * - Element manipulation utilities
 * - Form validation and helpers
 * - Responsive design utilities
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE } from '../core/state.js';
import { uiSystem } from '../ui/system.js';

class UIUtilities {
  constructor() {
    this.contextMenus = new Map();
    this.tabs = new Map();
    this.shortcuts = new Map();
    this.searchFilters = new Map();
    this.animations = new Map();
    this.formValidators = new Map();
    this.activeElements = new Set();
    
    this.init();
  }

  /**
   * Initialize UI utilities
   */
  init() {
    this.setupEventListeners();
    this.setupContextMenus();
    this.setupKeyboardShortcuts();
    this.setupTabNavigation();
    this.setupSearchUtilities();
    this.setupFormValidation();
    this.setupAnimations();
    
    console.log('🎨 UI Utilities initialized');
    eventBus.emit('ui-utilities-ready');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Context menu events
    eventBus.on('show-context-menu', (data) => this.showContextMenu(data));
    eventBus.on('hide-context-menu', () => this.hideContextMenu());
    
    // Tab events
    eventBus.on('create-tab', (data) => this.createTab(data));
    eventBus.on('switch-tab', (data) => this.switchTab(data));
    eventBus.on('close-tab', (data) => this.closeTab(data));
    
    // Search events
    eventBus.on('search-data', (data) => this.handleSearch(data));
    eventBus.on('filter-data', (data) => this.handleFilter(data));
    
    // Keyboard events
    eventBus.on('register-shortcut', (data) => this.registerShortcut(data));
    eventBus.on('unregister-shortcut', (data) => this.unregisterShortcut(data));
    
    // Animation events
    eventBus.on('animate-element', (data) => this.animateElement(data));
    eventBus.on('transition-view', (data) => this.transitionView(data));
  }

  // ===== CONTEXT MENUS =====

  /**
   * Setup context menu system
   */
  setupContextMenus() {
    document.addEventListener('contextmenu', (e) => {
      const contextElement = e.target.closest('[data-context-menu]');
      if (contextElement) {
        e.preventDefault();
        this.showContextMenu({
          element: contextElement,
          x: e.clientX,
          y: e.clientY,
          type: contextElement.dataset.contextMenu
        });
      }
    });
    
    // Hide context menu on click elsewhere
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.hideContextMenu();
      }
    });
    
    // Define default context menus
    this.defineDefaultContextMenus();
    
    console.log('🎨 Context menus initialized');
  }

  /**
   * Define default context menus
   */
  defineDefaultContextMenus() {
    // Staff context menu
    this.contextMenus.set('staff', {
      items: [
        { label: 'Edit Staff', action: 'edit-staff', icon: '✏️' },
        { label: 'View Details', action: 'view-staff-details', icon: '👁️' },
        { label: 'Assign to Route', action: 'assign-staff-route', icon: '🚌' },
        { separator: true },
        { label: 'Mark Available', action: 'mark-staff-available', icon: '✅', condition: (data) => data.status !== 'available' },
        { label: 'Mark Out', action: 'mark-staff-out', icon: '❌', condition: (data) => data.status !== 'out' },
        { separator: true },
        { label: 'Remove Staff', action: 'remove-staff', icon: '🗑️', class: 'danger' }
      ]
    });
    
    // Route context menu
    this.contextMenus.set('route', {
      items: [
        { label: 'Edit Route', action: 'edit-route', icon: '✏️' },
        { label: 'View Route Details', action: 'view-route-details', icon: '👁️' },
        { label: 'Assign Staff', action: 'assign-route-staff', icon: '👥' },
        { label: 'Assign Asset', action: 'assign-route-asset', icon: '🚌' },
        { separator: true },
        { label: 'Activate Route', action: 'activate-route', icon: '▶️', condition: (data) => data.status !== 'active' },
        { label: 'Complete Route', action: 'complete-route', icon: '✅', condition: (data) => data.status === 'active' },
        { separator: true },
        { label: 'Duplicate Route', action: 'duplicate-route', icon: '📋' },
        { label: 'Export Route', action: 'export-route', icon: '📤' },
        { separator: true },
        { label: 'Delete Route', action: 'delete-route', icon: '🗑️', class: 'danger' }
      ]
    });
    
    // Asset context menu
    this.contextMenus.set('asset', {
      items: [
        { label: 'Edit Asset', action: 'edit-asset', icon: '✏️' },
        { label: 'View Asset Details', action: 'view-asset-details', icon: '👁️' },
        { label: 'Assign to Route', action: 'assign-asset-route', icon: '🚌' },
        { label: 'Service Log', action: 'view-service-log', icon: '🔧' },
        { separator: true },
        { label: 'Mark Available', action: 'mark-asset-available', icon: '✅', condition: (data) => data.status !== 'available' },
        { label: 'Mark In Service', action: 'mark-asset-service', icon: '🔧', condition: (data) => data.status !== 'in-service' },
        { label: 'Mark Maintenance', action: 'mark-asset-maintenance', icon: '⚠️', condition: (data) => data.status !== 'maintenance' },
        { separator: true },
        { label: 'Remove Asset', action: 'remove-asset', icon: '🗑️', class: 'danger' }
      ]
    });
    
    // Field trip context menu
    this.contextMenus.set('field-trip', {
      items: [
        { label: 'Edit Trip', action: 'edit-field-trip', icon: '✏️' },
        { label: 'View Details', action: 'view-trip-details', icon: '👁️' },
        { label: 'Assign Staff', action: 'assign-trip-staff', icon: '👥' },
        { label: 'Assign Asset', action: 'assign-trip-asset', icon: '🚌' },
        { separator: true },
        { label: 'Approve Trip', action: 'approve-trip', icon: '✅', condition: (data) => data.status === 'pending' },
        { label: 'Cancel Trip', action: 'cancel-trip', icon: '❌', condition: (data) => data.status !== 'cancelled' },
        { separator: true },
        { label: 'Duplicate Trip', action: 'duplicate-trip', icon: '📋' },
        { label: 'Print Trip Sheet', action: 'print-trip', icon: '🖨️' }
      ]
    });
  }

  /**
   * Show context menu
   */
  showContextMenu({ element, x, y, type, data = {} }) {
    this.hideContextMenu(); // Hide any existing menu
    
    const menuConfig = this.contextMenus.get(type);
    if (!menuConfig) {
      console.warn(`No context menu defined for type: ${type}`);
      return;
    }
    
    // Get element data
    const elementData = this.getElementData(element);
    const mergedData = { ...elementData, ...data };
    
    // Filter menu items based on conditions
    const filteredItems = menuConfig.items.filter(item => {
      if (item.condition) {
        return item.condition(mergedData);
      }
      return true;
    });
    
    // Create menu element
    const menu = this.createContextMenuElement(filteredItems, mergedData);
    
    // Position menu
    this.positionContextMenu(menu, x, y);
    
    // Add to DOM
    document.body.appendChild(menu);
    
    // Store reference
    this.activeContextMenu = menu;
    
    // Setup menu event handlers
    this.setupContextMenuHandlers(menu, mergedData);
  }

  /**
   * Hide context menu
   */
  hideContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  /**
   * Create context menu element
   */
  createContextMenuElement(items, data) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = `context-menu-item ${item.class || ''}`;
        menuItem.dataset.action = item.action;
        
        menuItem.innerHTML = `
          <span class="context-menu-icon">${item.icon || ''}</span>
          <span class="context-menu-label">${item.label}</span>
        `;
        
        menu.appendChild(menuItem);
      }
    });
    
    return menu;
  }

  /**
   * Position context menu
   */
  positionContextMenu(menu, x, y) {
    // Add to DOM temporarily to measure
    menu.style.position = 'absolute';
    menu.style.visibility = 'hidden';
    document.body.appendChild(menu);
    
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Remove from DOM
    document.body.removeChild(menu);
    
    // Calculate position
    let left = x;
    let top = y;
    
    // Adjust if menu would go off screen
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 10;
    }
    
    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - 10;
    }
    
    // Ensure minimum distance from edges
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
  }

  /**
   * Setup context menu handlers
   */
  setupContextMenuHandlers(menu, data) {
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (item) {
        const action = item.dataset.action;
        this.handleContextMenuAction(action, data);
        this.hideContextMenu();
      }
    });
  }

  /**
   * Handle context menu action
   */
  handleContextMenuAction(action, data) {
    console.log(`🎨 Context menu action: ${action}`, data);
    
    // Emit event for the action
    eventBus.emit(`context-${action}`, data);
    
    // Handle common actions
    switch (action) {
      case 'edit-staff':
      case 'edit-route':
      case 'edit-asset':
      case 'edit-field-trip':
        this.handleEditAction(action, data);
        break;
        
      case 'view-staff-details':
      case 'view-route-details':
      case 'view-asset-details':
      case 'view-trip-details':
        this.handleViewAction(action, data);
        break;
        
      case 'remove-staff':
      case 'delete-route':
      case 'remove-asset':
        this.handleDeleteAction(action, data);
        break;
        
      default:
        // Let other modules handle specific actions
        break;
    }
  }

  // ===== TAB NAVIGATION =====

  /**
   * Setup tab navigation
   */
  setupTabNavigation() {
    // Create tab container if it doesn't exist
    if (!document.querySelector('.tab-container')) {
      this.createTabContainer();
    }
    
    // Setup tab event handlers
    this.setupTabEventHandlers();
    
    console.log('🎨 Tab navigation initialized');
  }

  /**
   * Create tab container
   */
  createTabContainer() {
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';
    
    const tabHeader = document.createElement('div');
    tabHeader.className = 'tab-header';
    
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    
    tabContainer.appendChild(tabHeader);
    tabContainer.appendChild(tabContent);
    
    // Find appropriate insertion point
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(tabContainer);
  }

  /**
   * Create new tab
   */
  createTab({ id, title, content, icon = '', closable = true, active = false }) {
    console.log(`🎨 Creating tab: ${id}`);
    
    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.className = `tab-button ${active ? 'active' : ''}`;
    tabButton.dataset.tabId = id;
    
    tabButton.innerHTML = `
      <span class="tab-icon">${icon}</span>
      <span class="tab-title">${title}</span>
      ${closable ? '<span class="tab-close" data-action="close">×</span>' : ''}
    `;
    
    // Create tab panel
    const tabPanel = document.createElement('div');
    tabPanel.className = `tab-panel ${active ? 'active' : ''}`;
    tabPanel.dataset.tabId = id;
    
    if (typeof content === 'string') {
      tabPanel.innerHTML = content;
    } else if (content instanceof Element) {
      tabPanel.appendChild(content);
    }
    
    // Add to DOM
    const tabHeader = document.querySelector('.tab-header');
    const tabContent = document.querySelector('.tab-content');
    
    if (tabHeader && tabContent) {
      tabHeader.appendChild(tabButton);
      tabContent.appendChild(tabPanel);
    }
    
    // Store tab data
    this.tabs.set(id, {
      id,
      title,
      icon,
      closable,
      button: tabButton,
      panel: tabPanel,
      active
    });
    
    // Activate if specified
    if (active) {
      this.switchTab({ id });
    }
    
    return { button: tabButton, panel: tabPanel };
  }

  /**
   * Switch to tab
   */
  switchTab({ id }) {
    console.log(`🎨 Switching to tab: ${id}`);
    
    const tab = this.tabs.get(id);
    if (!tab) {
      console.warn(`Tab not found: ${id}`);
      return false;
    }
    
    // Deactivate all tabs
    this.tabs.forEach(t => {
      t.button.classList.remove('active');
      t.panel.classList.remove('active');
      t.active = false;
    });
    
    // Activate target tab
    tab.button.classList.add('active');
    tab.panel.classList.add('active');
    tab.active = true;
    
    // Emit event
    eventBus.emit('tab-switched', { id, tab });
    
    return true;
  }

  /**
   * Close tab
   */
  closeTab({ id }) {
    console.log(`🎨 Closing tab: ${id}`);
    
    const tab = this.tabs.get(id);
    if (!tab || !tab.closable) {
      return false;
    }
    
    // If this was the active tab, switch to another
    if (tab.active) {
      const remainingTabs = Array.from(this.tabs.values()).filter(t => t.id !== id);
      if (remainingTabs.length > 0) {
        this.switchTab({ id: remainingTabs[0].id });
      }
    }
    
    // Remove from DOM
    tab.button.remove();
    tab.panel.remove();
    
    // Remove from storage
    this.tabs.delete(id);
    
    // Emit event
    eventBus.emit('tab-closed', { id });
    
    return true;
  }

  /**
   * Setup tab event handlers
   */
  setupTabEventHandlers() {
    document.addEventListener('click', (e) => {
      // Handle tab button clicks
      if (e.target.matches('.tab-button') || e.target.closest('.tab-button')) {
        const button = e.target.closest('.tab-button');
        const tabId = button.dataset.tabId;
        
        if (e.target.matches('.tab-close')) {
          // Close button clicked
          this.closeTab({ id: tabId });
        } else {
          // Tab button clicked
          this.switchTab({ id: tabId });
        }
      }
    });
    
    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        // Ctrl+1-9 to switch tabs
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = Array.from(this.tabs.values());
        if (tabs[tabIndex]) {
          this.switchTab({ id: tabs[tabIndex].id });
        }
      } else if (e.ctrlKey && e.key === 'w') {
        // Ctrl+W to close current tab
        e.preventDefault();
        const activeTab = Array.from(this.tabs.values()).find(t => t.active);
        if (activeTab && activeTab.closable) {
          this.closeTab({ id: activeTab.id });
        }
      }
    });
  }

  // ===== SEARCH UTILITIES =====

  /**
   * Setup search utilities
   */
  setupSearchUtilities() {
    // Create global search functions
    this.setupGlobalSearch();
    
    // Setup filter utilities
    this.setupFilterUtilities();
    
    console.log('🎨 Search utilities initialized');
  }

  /**
   * Setup global search
   */
  setupGlobalSearch() {
    // Add search input handler
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-search-target]')) {
        const target = e.target.dataset.searchTarget;
        const query = e.target.value;
        this.performSearch(target, query);
      }
    });
  }

  /**
   * Perform search
   */
  performSearch(target, query) {
    console.log(`🎨 Searching ${target} for: ${query}`);
    
    const results = this.searchData(target, query);
    this.displaySearchResults(target, results, query);
    
    // Emit search event
    eventBus.emit('search-performed', { target, query, results });
  }

  /**
   * Search data
   */
  searchData(target, query) {
    if (!query || query.length < 2) {
      return this.getAllData(target);
    }
    
    const data = this.getAllData(target);
    const queryLower = query.toLowerCase();
    
    return data.filter(item => {
      return Object.values(item).some(value => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(queryLower);
        }
        return false;
      });
    });
  }

  /**
   * Get all data for target
   */
  getAllData(target) {
    switch (target) {
      case 'staff':
        return STATE.staff || [];
      case 'routes':
        return STATE.routes || [];
      case 'assets':
        return STATE.assets || [];
      case 'fieldTrips':
        return STATE.fieldTrips || [];
      default:
        return [];
    }
  }

  /**
   * Display search results
   */
  displaySearchResults(target, results, query) {
    const container = document.querySelector(`[data-search-results="${target}"]`);
    if (!container) return;
    
    // Clear existing results
    container.innerHTML = '';
    
    if (results.length === 0) {
      container.innerHTML = `<div class="no-results">No results found for "${query}"</div>`;
      return;
    }
    
    // Display results
    results.forEach(item => {
      const resultElement = this.createSearchResultElement(target, item, query);
      container.appendChild(resultElement);
    });
  }

  /**
   * Create search result element
   */
  createSearchResultElement(target, item, query) {
    const element = document.createElement('div');
    element.className = `search-result ${target}-result`;
    element.dataset.itemId = item.id;
    
    // Highlight matching text
    const highlightedContent = this.highlightSearchTerms(item, query);
    element.innerHTML = highlightedContent;
    
    return element;
  }

  /**
   * Highlight search terms
   */
  highlightSearchTerms(item, query) {
    const queryLower = query.toLowerCase();
    
    // Create a basic representation of the item
    let content = '';
    
    switch (item.type || 'default') {
      case 'staff':
        content = `
          <div class="result-title">${this.highlightText(item.name, query)}</div>
          <div class="result-subtitle">${this.highlightText(item.role, query)}</div>
          <div class="result-status">${item.status}</div>
        `;
        break;
        
      case 'route':
        content = `
          <div class="result-title">${this.highlightText(item.name, query)}</div>
          <div class="result-subtitle">${this.highlightText(item.type, query)} - ${item.shift}</div>
          <div class="result-status">${item.status}</div>
        `;
        break;
        
      default:
        content = `
          <div class="result-title">${this.highlightText(item.name || item.title || 'Unknown', query)}</div>
          <div class="result-subtitle">${this.highlightText(item.description || '', query)}</div>
        `;
        break;
    }
    
    return content;
  }

  /**
   * Highlight text
   */
  highlightText(text, query) {
    if (!text || !query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // ===== KEYBOARD SHORTCUTS =====

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const shortcut = this.getShortcutKey(e);
      const handler = this.shortcuts.get(shortcut);
      
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    });
    
    // Register default shortcuts
    this.registerDefaultShortcuts();
    
    console.log('🎨 Keyboard shortcuts initialized');
  }

  /**
   * Register default shortcuts
   */
  registerDefaultShortcuts() {
    this.registerShortcut({
      key: 'ctrl+f',
      action: () => this.focusGlobalSearch(),
      description: 'Focus global search'
    });
    
    this.registerShortcut({
      key: 'ctrl+n',
      action: () => eventBus.emit('new-item-request'),
      description: 'Create new item'
    });
    
    this.registerShortcut({
      key: 'ctrl+s',
      action: () => eventBus.emit('save-request'),
      description: 'Save current work'
    });
    
    this.registerShortcut({
      key: 'escape',
      action: () => this.handleEscapeKey(),
      description: 'Cancel/close current action'
    });
    
    this.registerShortcut({
      key: 'f5',
      action: () => eventBus.emit('refresh-request'),
      description: 'Refresh data'
    });
  }

  /**
   * Register shortcut
   */
  registerShortcut({ key, action, description }) {
    this.shortcuts.set(key.toLowerCase(), action);
    console.log(`🎨 Registered shortcut: ${key} - ${description}`);
  }

  /**
   * Unregister shortcut
   */
  unregisterShortcut({ key }) {
    this.shortcuts.delete(key.toLowerCase());
    console.log(`🎨 Unregistered shortcut: ${key}`);
  }

  /**
   * Get shortcut key string
   */
  getShortcutKey(e) {
    const parts = [];
    
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    
    parts.push(e.key.toLowerCase());
    
    return parts.join('+');
  }

  // ===== ANIMATIONS =====

  /**
   * Setup animations
   */
  setupAnimations() {
    // Define animation presets
    this.animations.set('fadeIn', {
      keyframes: [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      options: { duration: 300, easing: 'ease-out' }
    });
    
    this.animations.set('fadeOut', {
      keyframes: [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-10px)' }
      ],
      options: { duration: 200, easing: 'ease-in' }
    });
    
    this.animations.set('slideIn', {
      keyframes: [
        { transform: 'translateX(-100%)' },
        { transform: 'translateX(0)' }
      ],
      options: { duration: 250, easing: 'ease-out' }
    });
    
    this.animations.set('slideOut', {
      keyframes: [
        { transform: 'translateX(0)' },
        { transform: 'translateX(100%)' }
      ],
      options: { duration: 250, easing: 'ease-in' }
    });
    
    console.log('🎨 Animations initialized');
  }

  /**
   * Animate element
   */
  animateElement({ element, animation, options = {} }) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    
    if (!element) {
      console.warn('Element not found for animation');
      return Promise.resolve();
    }
    
    const animationConfig = this.animations.get(animation);
    if (!animationConfig) {
      console.warn(`Animation not found: ${animation}`);
      return Promise.resolve();
    }
    
    const mergedOptions = { ...animationConfig.options, ...options };
    
    return element.animate(animationConfig.keyframes, mergedOptions).finished;
  }

  /**
   * Transition view
   */
  async transitionView({ from, to, animation = 'fadeIn' }) {
    console.log(`🎨 Transitioning view from ${from} to ${to}`);
    
    const fromElement = typeof from === 'string' ? document.querySelector(from) : from;
    const toElement = typeof to === 'string' ? document.querySelector(to) : to;
    
    if (fromElement) {
      await this.animateElement({ element: fromElement, animation: 'fadeOut' });
      fromElement.style.display = 'none';
    }
    
    if (toElement) {
      toElement.style.display = 'block';
      await this.animateElement({ element: toElement, animation });
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get element data
   */
  getElementData(element) {
    const data = {};
    
    // Get data attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        const key = attr.name.replace('data-', '').replace(/-/g, '_');
        data[key] = attr.value;
      }
    }
    
    // Get text content
    data.text = element.textContent?.trim();
    
    return data;
  }

  /**
   * Handle edit action
   */
  handleEditAction(action, data) {
    console.log(`🎨 Edit action: ${action}`, data);
    // Emit specific edit event
    eventBus.emit('open-edit-modal', { type: action.replace('edit-', ''), data });
  }

  /**
   * Handle view action
   */
  handleViewAction(action, data) {
    console.log(`🎨 View action: ${action}`, data);
    // Emit specific view event
    eventBus.emit('open-details-modal', { type: action.replace('view-', '').replace('-details', ''), data });
  }

  /**
   * Handle delete action
   */
  handleDeleteAction(action, data) {
    console.log(`🎨 Delete action: ${action}`, data);
    
    // Show confirmation dialog
    uiSystem.showConfirmDialog({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        eventBus.emit('delete-item', { type: action.replace('remove-', '').replace('delete-', ''), data });
      }
    });
  }

  /**
   * Focus global search
   */
  focusGlobalSearch() {
    const searchInput = document.querySelector('[data-search-target]');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  /**
   * Handle escape key
   */
  handleEscapeKey() {
    // Hide context menu
    this.hideContextMenu();
    
    // Close modals
    eventBus.emit('close-modal');
    
    // Clear search
    const searchInputs = document.querySelectorAll('[data-search-target]');
    searchInputs.forEach(input => {
      if (input === document.activeElement) {
        input.value = '';
        input.blur();
        this.performSearch(input.dataset.searchTarget, '');
      }
    });
  }

  /**
   * Setup filter utilities
   */
  setupFilterUtilities() {
    document.addEventListener('change', (e) => {
      if (e.target.matches('[data-filter-target]')) {
        const target = e.target.dataset.filterTarget;
        const filter = e.target.dataset.filterBy;
        const value = e.target.value;
        this.applyFilter(target, filter, value);
      }
    });
  }

  /**
   * Apply filter
   */
  applyFilter(target, filter, value) {
    console.log(`🎨 Applying filter: ${target}.${filter} = ${value}`);
    
    eventBus.emit('filter-applied', { target, filter, value });
  }

  /**
   * Setup form validation
   */
  setupFormValidation() {
    // Real-time validation
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-validate]')) {
        this.validateField(e.target);
      }
    });
    
    // Form submission validation
    document.addEventListener('submit', (e) => {
      if (e.target.matches('[data-validate-form]')) {
        if (!this.validateForm(e.target)) {
          e.preventDefault();
        }
      }
    });
  }

  /**
   * Validate field
   */
  validateField(field) {
    const rules = field.dataset.validate.split('|');
    const value = field.value;
    
    for (const rule of rules) {
      const isValid = this.checkValidationRule(value, rule);
      if (!isValid) {
        this.showFieldError(field, rule);
        return false;
      }
    }
    
    this.clearFieldError(field);
    return true;
  }

  /**
   * Check validation rule
   */
  checkValidationRule(value, rule) {
    switch (rule) {
      case 'required':
        return value.trim() !== '';
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'phone':
        return /^\d{3}-\d{4}$|^\(\d{3}\)\s\d{3}-\d{4}$/.test(value);
      case 'number':
        return !isNaN(value) && value !== '';
      default:
        return true;
    }
  }

  /**
   * Show field error
   */
  showFieldError(field, rule) {
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = this.getErrorMessage(rule);
    field.parentNode.appendChild(errorDiv);
  }

  /**
   * Clear field error
   */
  clearFieldError(field) {
    field.classList.remove('error');
    const error = field.parentNode.querySelector('.field-error');
    if (error) {
      error.remove();
    }
  }

  /**
   * Get error message
   */
  getErrorMessage(rule) {
    const messages = {
      required: 'This field is required',
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      number: 'Please enter a valid number'
    };
    
    return messages[rule] || 'Invalid input';
  }

  /**
   * Validate form
   */
  validateForm(form) {
    const fields = form.querySelectorAll('[data-validate]');
    let isValid = true;
    
    fields.forEach(field => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });
    
    return isValid;
  }

  /**
   * Handle search
   */
  handleSearch(data) {
    const { target, query } = data;
    this.performSearch(target, query);
  }

  /**
   * Handle filter
   */
  handleFilter(data) {
    const { target, filter, value } = data;
    this.applyFilter(target, filter, value);
  }
}

// Create and export singleton instance
const uiUtilities = new UIUtilities();

export { uiUtilities };
