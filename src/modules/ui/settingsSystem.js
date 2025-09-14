/**
 * COMPREHENSIVE SETTINGS SYSTEM MODULE
 * Transportation Dispatch Dashboard
 * 
 * Complete settings interface with tabbed system including:
 * - Data Settings (CSV file management, data validation)
 * - Color Settings (theme customization, accessibility)
 * - Control Settings (touch sensitivity, keyboard shortcuts)
 * - Import/Export functionality
 * - User preferences and workspace customization
 * 
 * Dependencies: core/events, core/state, ui/system
 */

import { eventBus } from '../core/events.js';
import { STATE, getState, setState, saveToLocalStorage } from '../core/state.js';
import { uiSystem } from './system.js';

class SettingsSystem {
  constructor() {
    this.settings = {
      data: {
        autoSave: true,
        autoSaveInterval: 30000, // 30 seconds
        dataValidation: true,
        strictValidation: false,
        backupBeforeImport: true,
        maxBackups: 10,
        csvDelimiter: ',',
        csvEncoding: 'utf-8',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      colors: {
        theme: 'default',
        customTheme: {
          primary: '#3b82f6',
          secondary: '#6b7280',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          background: '#ffffff',
          surface: '#f9fafb',
          text: '#1f2937',
          textMuted: '#6b7280'
        },
        accessibility: {
          highContrast: false,
          reducedMotion: false,
          largeText: false,
          colorBlindFriendly: false
        },
        statusColors: {
          assigned: '#3b82f6',
          unassigned: '#f59e0b',
          active: '#10b981',
          inactive: '#6b7280',
          cancelled: '#ef4444',
          inProgress: '#8b5cf6'
        }
      },
      controls: {
        touchSensitivity: 'medium',
        doubleTapDelay: 300,
        longPressDelay: 500,
        swipeThreshold: 50,
        pinchSensitivity: 'medium',
        hapticFeedback: true,
        soundEffects: false,
        keyboardShortcuts: true,
        customShortcuts: {},
        autoFocus: true,
        confirmActions: true
      },
      display: {
        cardSize: 'medium',
        gridDensity: 'comfortable',
        showIcons: true,
        showTimestamps: true,
        showStatusBadges: true,
        animationSpeed: 'medium',
        tooltips: true,
        breadcrumbs: true,
        sidebarWidth: 280,
        headerHeight: 60
      },
      notifications: {
        enabled: true,
        sound: false,
        duration: 5000,
        position: 'top-right',
        types: {
          info: true,
          success: true,
          warning: true,
          error: true
        }
      }
    };

    this.themes = {
      default: {
        name: 'Default',
        primary: '#3b82f6',
        secondary: '#6b7280',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#1f2937',
        textMuted: '#6b7280'
      },
      dark: {
        name: 'Dark Mode',
        primary: '#3b82f6',
        secondary: '#9ca3af',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        background: '#111827',
        surface: '#1f2937',
        text: '#f9fafb',
        textMuted: '#9ca3af'
      },
      highContrast: {
        name: 'High Contrast',
        primary: '#000000',
        secondary: '#666666',
        success: '#008000',
        warning: '#ff8c00',
        danger: '#ff0000',
        background: '#ffffff',
        surface: '#f0f0f0',
        text: '#000000',
        textMuted: '#333333'
      },
      transportation: {
        name: 'Transportation Theme',
        primary: '#1e40af',
        secondary: '#64748b',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        background: '#f8fafc',
        surface: '#e2e8f0',
        text: '#0f172a',
        textMuted: '#475569'
      }
    };

    this.backups = [];
    this.initialized = false;
  }

  /**
   * Initialize settings system
   */
  init() {
    if (this.initialized) {
      console.log('⚙️ Settings System already initialized');
      return;
    }

    this.loadSettings();
    this.applySettings();
    this.setupEventListeners();
    this.scheduleAutoSave();
    
    this.initialized = true;
    console.log('⚙️ Settings System initialized');
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const savedSettings = getState('userSettings');
      if (savedSettings) {
        this.settings = this.mergeSettings(this.settings, savedSettings);
      }

      const savedBackups = getState('settingsBackups');
      if (savedBackups) {
        this.backups = savedBackups;
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    }
  }

  /**
   * Deep merge settings objects
   */
  mergeSettings(defaultSettings, userSettings) {
    const merged = { ...defaultSettings };
    
    Object.keys(userSettings).forEach(key => {
      if (typeof userSettings[key] === 'object' && userSettings[key] !== null && !Array.isArray(userSettings[key])) {
        merged[key] = this.mergeSettings(defaultSettings[key] || {}, userSettings[key]);
      } else {
        merged[key] = userSettings[key];
      }
    });
    
    return merged;
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      setState('userSettings', this.settings);
      setState('settingsBackups', this.backups);
      console.log('⚙️ Settings saved');
      
      eventBus.emit('settings:saved', { settings: this.settings });
    } catch (error) {
      console.error('❌ Error saving settings:', error);
    }
  }

  /**
   * Apply current settings to the application
   */
  applySettings() {
    this.applyTheme();
    this.applyDisplaySettings();
    this.applyControlSettings();
    this.applyNotificationSettings();
    this.applyAccessibilitySettings();
    
    console.log('⚙️ Settings applied');
  }

  /**
   * Apply theme settings
   */
  applyTheme() {
    const theme = this.settings.colors.theme === 'custom' 
      ? this.settings.colors.customTheme 
      : this.themes[this.settings.colors.theme];
    
    if (!theme) return;

    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'name') {
        root.style.setProperty(`--color-${key}`, value);
      }
    });

    // Apply status colors
    Object.entries(this.settings.colors.statusColors).forEach(([status, color]) => {
      root.style.setProperty(`--status-${status}`, color);
    });

    // Update theme class on body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${this.settings.colors.theme}`);
  }

  /**
   * Apply display settings
   */
  applyDisplaySettings() {
    const root = document.documentElement;
    const display = this.settings.display;

    // Card size
    root.style.setProperty('--card-size', this.getCardSizeValue(display.cardSize));
    
    // Grid density
    root.style.setProperty('--grid-gap', this.getGridDensityValue(display.gridDensity));
    
    // Animation speed
    root.style.setProperty('--animation-duration', this.getAnimationSpeed(display.animationSpeed));
    
    // Sidebar and header dimensions
    root.style.setProperty('--sidebar-width', `${display.sidebarWidth}px`);
    root.style.setProperty('--header-height', `${display.headerHeight}px`);

    // Toggle UI elements
    document.body.classList.toggle('hide-icons', !display.showIcons);
    document.body.classList.toggle('hide-timestamps', !display.showTimestamps);
    document.body.classList.toggle('hide-status-badges', !display.showStatusBadges);
    document.body.classList.toggle('hide-tooltips', !display.tooltips);
  }

  /**
   * Apply control settings
   */
  applyControlSettings() {
    const controls = this.settings.controls;
    
    // Touch sensitivity settings
    eventBus.emit('controls:touchSensitivity', { 
      sensitivity: controls.touchSensitivity,
      doubleTapDelay: controls.doubleTapDelay,
      longPressDelay: controls.longPressDelay,
      swipeThreshold: controls.swipeThreshold
    });

    // Haptic feedback
    eventBus.emit('controls:hapticFeedback', { enabled: controls.hapticFeedback });
    
    // Sound effects
    eventBus.emit('controls:soundEffects', { enabled: controls.soundEffects });
    
    // Keyboard shortcuts
    eventBus.emit('controls:keyboardShortcuts', { 
      enabled: controls.keyboardShortcuts,
      custom: controls.customShortcuts
    });
  }

  /**
   * Apply notification settings
   */
  applyNotificationSettings() {
    const notifications = this.settings.notifications;
    
    eventBus.emit('notifications:config', {
      enabled: notifications.enabled,
      sound: notifications.sound,
      duration: notifications.duration,
      position: notifications.position,
      types: notifications.types
    });
  }

  /**
   * Apply accessibility settings
   */
  applyAccessibilitySettings() {
    const accessibility = this.settings.colors.accessibility;
    
    document.body.classList.toggle('high-contrast', accessibility.highContrast);
    document.body.classList.toggle('reduced-motion', accessibility.reducedMotion);
    document.body.classList.toggle('large-text', accessibility.largeText);
    document.body.classList.toggle('color-blind-friendly', accessibility.colorBlindFriendly);
  }

  /**
   * Get card size CSS value
   */
  getCardSizeValue(size) {
    const sizes = {
      small: '0.9rem',
      medium: '1rem',
      large: '1.1rem'
    };
    return sizes[size] || sizes.medium;
  }

  /**
   * Get grid density CSS value
   */
  getGridDensityValue(density) {
    const densities = {
      compact: '0.5rem',
      comfortable: '1rem',
      spacious: '1.5rem'
    };
    return densities[density] || densities.comfortable;
  }

  /**
   * Get animation speed CSS value
   */
  getAnimationSpeed(speed) {
    const speeds = {
      slow: '0.5s',
      medium: '0.3s',
      fast: '0.15s'
    };
    return speeds[speed] || speeds.medium;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    eventBus.on('settings:open', () => {
      this.openSettingsDialog();
    });

    eventBus.on('settings:reset', () => {
      this.resetToDefaults();
    });

    eventBus.on('settings:export', () => {
      this.exportSettings();
    });

    eventBus.on('settings:import', (data) => {
      this.importSettings(data.settings);
    });

    // Connect to existing UI elements
    this.connectHamburgerMenu();
  }

  /**
   * Connect to hamburger menu and existing buttons
   */
  connectHamburgerMenu() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupHamburgerMenuHandlers();
      });
    } else {
      this.setupHamburgerMenuHandlers();
    }
  }

  /**
   * Setup hamburger menu handlers
   */
  setupHamburgerMenuHandlers() {
    // Connect hamburger menu button to slideout
    const hamburgerBtn = document.getElementById('hamburger-menu-btn');
    const settingsSlideout = document.getElementById('settings-slideout');
    const closeBtn = document.getElementById('settings-slideout-close');

    if (hamburgerBtn && settingsSlideout) {
      hamburgerBtn.addEventListener('click', () => {
        this.toggleHamburgerMenu();
      });
    }

    if (closeBtn && settingsSlideout) {
      closeBtn.addEventListener('click', () => {
        this.closeHamburgerMenu();
      });
    }

    // Connect comprehensive settings button
    const comprehensiveSettingsBtn = document.getElementById('open-comprehensive-settings');
    if (comprehensiveSettingsBtn) {
      comprehensiveSettingsBtn.addEventListener('click', () => {
        this.openSettingsDialog();
        this.closeHamburgerMenu();
      });
    }

    // Connect other menu items
    const searchBtn = document.getElementById('open-search-dialog');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (window.advancedSearchSystem) {
          window.advancedSearchSystem.openAdvancedSearchDialog();
        }
        this.closeHamburgerMenu();
      });
    }

    const exportBtn = document.getElementById('export-all-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportAllData();
        this.closeHamburgerMenu();
      });
    }

    const importBtn = document.getElementById('import-data');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.showImportDialog();
        this.closeHamburgerMenu();
      });
    }

    // Connect existing settings button in header
    const headerSettingsBtn = document.getElementById('settings-btn');
    if (headerSettingsBtn) {
      headerSettingsBtn.addEventListener('click', () => {
        this.openSettingsDialog();
      });
    }

    console.log('⚙️ Hamburger menu connected to settings system');
  }

  /**
   * Toggle hamburger menu visibility
   */
  toggleHamburgerMenu() {
    const settingsSlideout = document.getElementById('settings-slideout');
    if (settingsSlideout) {
      const isOpen = !settingsSlideout.classList.contains('-translate-x-full');
      
      if (isOpen) {
        this.closeHamburgerMenu();
      } else {
        this.openHamburgerMenu();
      }
    }
  }

  /**
   * Open hamburger menu
   */
  openHamburgerMenu() {
    const settingsSlideout = document.getElementById('settings-slideout');
    if (settingsSlideout) {
      settingsSlideout.classList.remove('-translate-x-full');
      settingsSlideout.classList.add('translate-x-0');
      
      // Add backdrop
      this.addMenuBackdrop();
    }
  }

  /**
   * Close hamburger menu
   */
  closeHamburgerMenu() {
    const settingsSlideout = document.getElementById('settings-slideout');
    if (settingsSlideout) {
      settingsSlideout.classList.add('-translate-x-full');
      settingsSlideout.classList.remove('translate-x-0');
      
      // Remove backdrop
      this.removeMenuBackdrop();
    }
  }

  /**
   * Add menu backdrop
   */
  addMenuBackdrop() {
    // Remove existing backdrop if any
    this.removeMenuBackdrop();
    
    const backdrop = document.createElement('div');
    backdrop.id = 'menu-backdrop';
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-40';
    backdrop.addEventListener('click', () => {
      this.closeHamburgerMenu();
    });
    
    document.body.appendChild(backdrop);
  }

  /**
   * Remove menu backdrop
   */
  removeMenuBackdrop() {
    const backdrop = document.getElementById('menu-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }

  /**
   * Schedule auto-save
   */
  scheduleAutoSave() {
    if (this.settings.data.autoSave) {
      setInterval(() => {
        this.saveSettings();
      }, this.settings.data.autoSaveInterval);
    }
  }

  /**
   * Open settings dialog
   */
  openSettingsDialog() {
    console.log('🔧 Opening settings dialog...');
    
    // Get the existing settings modal from HTML
    const modal = document.getElementById('settings-modal');
    if (!modal) {
      console.error('❌ Settings modal not found in HTML');
      return;
    }

    // Update the tab navigation to match our comprehensive settings
    const tabNavigation = modal.querySelector('.flex.space-x-1.mb-4.border-b');
    if (tabNavigation) {
      tabNavigation.innerHTML = `
        <button class="tab-btn active px-4 py-2 font-medium text-sm border-b-2 border-blue-500 text-blue-600" data-tab="data">📁 Data</button>
        <button class="tab-btn px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="colors">🎨 Colors</button>
        <button class="tab-btn px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="controls">🎮 Controls</button>
        <button class="tab-btn px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="display">🖥️ Display</button>
        <button class="tab-btn px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="notifications">🔔 Notifications</button>
        <button class="tab-btn px-4 py-2 font-medium text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="advanced">⚙️ Advanced</button>
      `;
    }

    // Update the modal content with our comprehensive settings
    const contentContainer = modal.querySelector('.flex-1.overflow-hidden');
    if (contentContainer) {
      contentContainer.innerHTML = this.createSettingsContent();
    }

    // Show the modal
    modal.classList.remove('hidden');
    
    // Setup event handlers for the settings
    this.setupSettingsHandlers();
    
    // Setup close button handler
    const closeBtn = modal.querySelector('#settings-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }

    // Setup cancel button handler
    const cancelBtn = modal.querySelector('#settings-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }

    // Setup save button handler
    const saveBtn = modal.querySelector('#settings-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        this.saveSettings();
        modal.classList.add('hidden');
        uiSystem.showNotification('Settings saved successfully', 'success');
      };
    }
    
    console.log('✅ Settings dialog opened successfully');
  }

  /**
   * Create settings dialog content
   */
  createSettingsContent() {
    return `
      <div class="settings-container h-full">
        <div class="settings-content h-full overflow-auto">
          <div class="tab-content active" id="data-tab">
            ${this.createDataSettingsContent()}
          </div>
          
          <div class="tab-content hidden" id="colors-tab">
            ${this.createColorSettingsContent()}
          </div>
          
          <div class="tab-content hidden" id="controls-tab">
            ${this.createControlSettingsContent()}
          </div>
          
          <div class="tab-content hidden" id="display-tab">
            ${this.createDisplaySettingsContent()}
          </div>
          
          <div class="tab-content hidden" id="notifications-tab">
            ${this.createNotificationSettingsContent()}
          </div>
          
          <div class="tab-content hidden" id="advanced-tab">
            ${this.createAdvancedSettingsContent()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create data settings content
   */
  createDataSettingsContent() {
    const data = this.settings.data;
    
    return `
      <div class="settings-section">
        <h3>Data Management</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="auto-save" ${data.autoSave ? 'checked' : ''}>
            Auto-save changes
          </label>
          <small class="setting-description">Automatically save changes every few seconds</small>
        </div>

        <div class="setting-group">
          <label class="setting-label">Auto-save interval (seconds)</label>
          <input type="number" id="auto-save-interval" value="${data.autoSaveInterval / 1000}" min="10" max="300" class="setting-input">
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="data-validation" ${data.dataValidation ? 'checked' : ''}>
            Enable data validation
          </label>
          <small class="setting-description">Validate data before saving</small>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="strict-validation" ${data.strictValidation ? 'checked' : ''}>
            Strict validation mode
          </label>
          <small class="setting-description">Use stricter validation rules</small>
        </div>

        <div class="setting-group">
          <label class="setting-label">CSV Delimiter</label>
          <select id="csv-delimiter" class="setting-select">
            <option value="," ${data.csvDelimiter === ',' ? 'selected' : ''}>Comma (,)</option>
            <option value=";" ${data.csvDelimiter === ';' ? 'selected' : ''}>Semicolon (;)</option>
            <option value="\t" ${data.csvDelimiter === '\t' ? 'selected' : ''}>Tab</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Date Format</label>
          <select id="date-format" class="setting-select">
            <option value="MM/DD/YYYY" ${data.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
            <option value="DD/MM/YYYY" ${data.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
            <option value="YYYY-MM-DD" ${data.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Time Format</label>
          <select id="time-format" class="setting-select">
            <option value="12h" ${data.timeFormat === '12h' ? 'selected' : ''}>12 Hour (AM/PM)</option>
            <option value="24h" ${data.timeFormat === '24h' ? 'selected' : ''}>24 Hour</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3>Backup & Recovery</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="backup-before-import" ${data.backupBeforeImport ? 'checked' : ''}>
            Create backup before importing
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">Maximum backups to keep</label>
          <input type="number" id="max-backups" value="${data.maxBackups}" min="1" max="50" class="setting-input">
        </div>

        <div class="backup-actions">
          <button class="btn btn-secondary" onclick="settingsSystem.createBackup()">Create Backup Now</button>
          <button class="btn btn-secondary" onclick="settingsSystem.viewBackups()">View Backups</button>
        </div>
      </div>
    `;
  }

  /**
   * Create color settings content
   */
  createColorSettingsContent() {
    const colors = this.settings.colors;
    
    const themesHtml = Object.entries(this.themes).map(([key, theme]) => `
      <option value="${key}" ${colors.theme === key ? 'selected' : ''}>${theme.name}</option>
    `).join('');

    return `
      <div class="settings-section">
        <h3>Theme Selection</h3>
        
        <div class="setting-group">
          <label class="setting-label">Choose Theme</label>
          <select id="theme-select" class="setting-select">
            ${themesHtml}
            <option value="custom" ${colors.theme === 'custom' ? 'selected' : ''}>Custom Theme</option>
          </select>
        </div>

        <div class="theme-preview" id="theme-preview">
          ${this.createThemePreview()}
        </div>
      </div>

      <div class="settings-section ${colors.theme !== 'custom' ? 'hidden' : ''}" id="custom-theme-section">
        <h3>Custom Theme Colors</h3>
        
        <div class="color-grid">
          ${Object.entries(colors.customTheme).map(([key, value]) => `
            <div class="color-input-group">
              <label class="setting-label">${this.formatColorLabel(key)}</label>
              <input type="color" id="custom-${key}" value="${value}" class="color-input">
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <h3>Status Colors</h3>
        
        <div class="color-grid">
          ${Object.entries(colors.statusColors).map(([status, color]) => `
            <div class="color-input-group">
              <label class="setting-label">${this.formatColorLabel(status)}</label>
              <input type="color" id="status-${status}" value="${color}" class="color-input">
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-section">
        <h3>Accessibility</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="high-contrast" ${colors.accessibility.highContrast ? 'checked' : ''}>
            High contrast mode
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="reduced-motion" ${colors.accessibility.reducedMotion ? 'checked' : ''}>
            Reduce animations
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="large-text" ${colors.accessibility.largeText ? 'checked' : ''}>
            Large text
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="color-blind-friendly" ${colors.accessibility.colorBlindFriendly ? 'checked' : ''}>
            Color blind friendly
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Create control settings content
   */
  createControlSettingsContent() {
    const controls = this.settings.controls;
    
    return `
      <div class="settings-section">
        <h3>Touch Controls</h3>
        
        <div class="setting-group">
          <label class="setting-label">Touch Sensitivity</label>
          <select id="touch-sensitivity" class="setting-select">
            <option value="low" ${controls.touchSensitivity === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${controls.touchSensitivity === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${controls.touchSensitivity === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Double-tap delay (ms)</label>
          <input type="number" id="double-tap-delay" value="${controls.doubleTapDelay}" min="100" max="1000" class="setting-input">
        </div>

        <div class="setting-group">
          <label class="setting-label">Long press delay (ms)</label>
          <input type="number" id="long-press-delay" value="${controls.longPressDelay}" min="200" max="2000" class="setting-input">
        </div>

        <div class="setting-group">
          <label class="setting-label">Swipe threshold (px)</label>
          <input type="number" id="swipe-threshold" value="${controls.swipeThreshold}" min="20" max="200" class="setting-input">
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="haptic-feedback" ${controls.hapticFeedback ? 'checked' : ''}>
            Haptic feedback
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Keyboard & Audio</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="keyboard-shortcuts" ${controls.keyboardShortcuts ? 'checked' : ''}>
            Enable keyboard shortcuts
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="sound-effects" ${controls.soundEffects ? 'checked' : ''}>
            Sound effects
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="auto-focus" ${controls.autoFocus ? 'checked' : ''}>
            Auto-focus inputs
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="confirm-actions" ${controls.confirmActions ? 'checked' : ''}>
            Confirm destructive actions
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Custom Shortcuts</h3>
        
        <div class="shortcuts-list" id="custom-shortcuts">
          ${this.createShortcutsList()}
        </div>

        <button class="btn btn-secondary" onclick="settingsSystem.addCustomShortcut()">Add Custom Shortcut</button>
      </div>
    `;
  }

  /**
   * Create display settings content
   */
  createDisplaySettingsContent() {
    const display = this.settings.display;
    
    return `
      <div class="settings-section">
        <h3>Layout & Appearance</h3>
        
        <div class="setting-group">
          <label class="setting-label">Card Size</label>
          <select id="card-size" class="setting-select">
            <option value="small" ${display.cardSize === 'small' ? 'selected' : ''}>Small</option>
            <option value="medium" ${display.cardSize === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="large" ${display.cardSize === 'large' ? 'selected' : ''}>Large</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Grid Density</label>
          <select id="grid-density" class="setting-select">
            <option value="compact" ${display.gridDensity === 'compact' ? 'selected' : ''}>Compact</option>
            <option value="comfortable" ${display.gridDensity === 'comfortable' ? 'selected' : ''}>Comfortable</option>
            <option value="spacious" ${display.gridDensity === 'spacious' ? 'selected' : ''}>Spacious</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Animation Speed</label>
          <select id="animation-speed" class="setting-select">
            <option value="slow" ${display.animationSpeed === 'slow' ? 'selected' : ''}>Slow</option>
            <option value="medium" ${display.animationSpeed === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="fast" ${display.animationSpeed === 'fast' ? 'selected' : ''}>Fast</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Sidebar Width (px)</label>
          <input type="range" id="sidebar-width" min="200" max="400" value="${display.sidebarWidth}" class="setting-range">
          <span class="range-value">${display.sidebarWidth}px</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>UI Elements</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="show-icons" ${display.showIcons ? 'checked' : ''}>
            Show icons
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="show-timestamps" ${display.showTimestamps ? 'checked' : ''}>
            Show timestamps
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="show-status-badges" ${display.showStatusBadges ? 'checked' : ''}>
            Show status badges
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="show-tooltips" ${display.tooltips ? 'checked' : ''}>
            Show tooltips
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="show-breadcrumbs" ${display.breadcrumbs ? 'checked' : ''}>
            Show breadcrumbs
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Create notification settings content
   */
  createNotificationSettingsContent() {
    const notifications = this.settings.notifications;
    
    return `
      <div class="settings-section">
        <h3>Notification Preferences</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notifications-enabled" ${notifications.enabled ? 'checked' : ''}>
            Enable notifications
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notification-sound" ${notifications.sound ? 'checked' : ''}>
            Play notification sounds
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">Notification duration (ms)</label>
          <input type="number" id="notification-duration" value="${notifications.duration}" min="1000" max="10000" class="setting-input">
        </div>

        <div class="setting-group">
          <label class="setting-label">Notification position</label>
          <select id="notification-position" class="setting-select">
            <option value="top-left" ${notifications.position === 'top-left' ? 'selected' : ''}>Top Left</option>
            <option value="top-right" ${notifications.position === 'top-right' ? 'selected' : ''}>Top Right</option>
            <option value="bottom-left" ${notifications.position === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
            <option value="bottom-right" ${notifications.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h3>Notification Types</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notify-info" ${notifications.types.info ? 'checked' : ''}>
            Info notifications
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notify-success" ${notifications.types.success ? 'checked' : ''}>
            Success notifications
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notify-warning" ${notifications.types.warning ? 'checked' : ''}>
            Warning notifications
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="notify-error" ${notifications.types.error ? 'checked' : ''}>
            Error notifications
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Create advanced settings content
   */
  createAdvancedSettingsContent() {
    return `
      <div class="settings-section">
        <h3>System Information</h3>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Version:</span>
            <span class="info-value">1.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-label">Build Date:</span>
            <span class="info-value">September 13, 2025</span>
          </div>
          <div class="info-item">
            <span class="info-label">Browser:</span>
            <span class="info-value">${navigator.userAgent.split(' ').slice(-1)[0]}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Screen Resolution:</span>
            <span class="info-value">${screen.width} × ${screen.height}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Data Management</h3>
        
        <div class="advanced-actions">
          <button class="btn btn-secondary" onclick="settingsSystem.clearCache()">Clear Cache</button>
          <button class="btn btn-secondary" onclick="settingsSystem.exportAllData()">Export All Data</button>
          <button class="btn btn-warning" onclick="settingsSystem.resetAllData()">Reset All Data</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>Debug Options</h3>
        
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="debug-mode" ${getState('debugMode') ? 'checked' : ''}>
            Enable debug mode
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="verbose-logging" ${getState('verboseLogging') ? 'checked' : ''}>
            Verbose logging
          </label>
        </div>

        <div class="debug-actions">
          <button class="btn btn-secondary" onclick="settingsSystem.downloadLogs()">Download Logs</button>
          <button class="btn btn-secondary" onclick="settingsSystem.runDiagnostics()">Run Diagnostics</button>
        </div>
      </div>
    `;
  }

  /**
   * Create theme preview
   */
  createThemePreview() {
    const theme = this.settings.colors.theme === 'custom' 
      ? this.settings.colors.customTheme 
      : this.themes[this.settings.colors.theme];
    
    return `
      <div class="preview-card" style="background: ${theme.background}; color: ${theme.text}; border: 1px solid ${theme.secondary};">
        <div class="preview-header" style="background: ${theme.primary}; color: white;">
          Theme Preview
        </div>
        <div class="preview-content">
          <p style="color: ${theme.text};">Primary text content</p>
          <p style="color: ${theme.textMuted};">Secondary text content</p>
          <div class="preview-badges">
            <span class="preview-badge" style="background: ${theme.success}; color: white;">Success</span>
            <span class="preview-badge" style="background: ${theme.warning}; color: white;">Warning</span>
            <span class="preview-badge" style="background: ${theme.danger}; color: white;">Error</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Format color label for display
   */
  formatColorLabel(key) {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Create shortcuts list
   */
  createShortcutsList() {
    const shortcuts = this.settings.controls.customShortcuts;
    
    if (Object.keys(shortcuts).length === 0) {
      return '<p class="no-shortcuts">No custom shortcuts defined</p>';
    }

    return Object.entries(shortcuts).map(([key, action]) => `
      <div class="shortcut-item">
        <span class="shortcut-key">${key}</span>
        <span class="shortcut-action">${action}</span>
        <button class="btn btn-sm btn-danger" onclick="settingsSystem.removeShortcut('${key}')">Remove</button>
      </div>
    `).join('');
  }

  /**
   * Setup settings dialog handlers
   */
  setupSettingsHandlers() {
    console.log('🔧 Setting up settings handlers...');
    
    // Tab switching with more robust selectors
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log(`Found ${tabButtons.length} tab buttons`);
    
    tabButtons.forEach((btn, index) => {
      const tabName = btn.dataset.tab;
      console.log(`Setting up handler for tab ${index}: ${tabName}`);
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`🖱️ Tab button clicked: ${tabName}`);
        this.showSettingsTab(tabName);
      });
    });

    // Theme selection change
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.settings.colors.theme = e.target.value;
        this.updateThemePreview();
        this.toggleCustomThemeSection();
      });
    }

    // Real-time preview updates
    this.setupRealtimePreview();
    
    console.log('✅ Settings handlers setup complete');
  }

  /**
   * Show specific settings tab
   */
  showSettingsTab(tabName) {
    console.log(`🔄 Switching to tab: ${tabName}`);
    
    // Update tab buttons - remove active from all, add to selected
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
        btn.classList.remove('text-gray-500');
        btn.classList.add('text-blue-600', 'border-blue-500');
        btn.style.borderBottomColor = '#3b82f6';
      } else {
        btn.classList.remove('active');
        btn.classList.add('text-gray-500');
        btn.classList.remove('text-blue-600', 'border-blue-500');
        btn.style.borderBottomColor = 'transparent';
      }
    });

    // Update tab content - hide all, show selected
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.remove('hidden');
        content.classList.add('active');
        console.log(`✅ Showing tab content: ${content.id}`);
      } else {
        content.classList.add('hidden');
        content.classList.remove('active');
      }
    });
    
    console.log(`✅ Tab switched to: ${tabName}`);
  }

  /**
   * Setup realtime preview
   */
  setupRealtimePreview() {
    // Color inputs
    document.querySelectorAll('.color-input').forEach(input => {
      input.addEventListener('change', () => {
        this.updateFromForm();
        this.applySettings();
        this.updateThemePreview();
      });
    });

    // Range inputs
    document.querySelectorAll('.setting-range').forEach(input => {
      input.addEventListener('input', (e) => {
        const valueSpan = e.target.nextElementSibling;
        if (valueSpan) {
          valueSpan.textContent = `${e.target.value}px`;
        }
      });
    });
  }

  /**
   * Update theme preview
   */
  updateThemePreview() {
    const preview = document.getElementById('theme-preview');
    if (preview) {
      preview.innerHTML = this.createThemePreview();
    }
  }

  /**
   * Toggle custom theme section visibility
   */
  toggleCustomThemeSection() {
    const section = document.getElementById('custom-theme-section');
    if (section) {
      section.classList.toggle('hidden', this.settings.colors.theme !== 'custom');
    }
  }

  /**
   * Update settings from form
   */
  updateFromForm() {
    // Data settings
    const autoSave = document.getElementById('auto-save');
    if (autoSave) this.settings.data.autoSave = autoSave.checked;

    const autoSaveInterval = document.getElementById('auto-save-interval');
    if (autoSaveInterval) this.settings.data.autoSaveInterval = parseInt(autoSaveInterval.value) * 1000;

    // Color settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) this.settings.colors.theme = themeSelect.value;

    // Update custom colors
    Object.keys(this.settings.colors.customTheme).forEach(key => {
      const input = document.getElementById(`custom-${key}`);
      if (input) this.settings.colors.customTheme[key] = input.value;
    });

    // Update status colors
    Object.keys(this.settings.colors.statusColors).forEach(status => {
      const input = document.getElementById(`status-${status}`);
      if (input) this.settings.colors.statusColors[status] = input.value;
    });

    // Continue updating other settings...
    // (This would continue for all form fields)
  }

  /**
   * Save and close settings
   */
  saveAndClose() {
    this.updateFromForm();
    this.saveSettings();
    this.applySettings();
    uiSystem.closeCurrentModal();
    
    uiSystem.showNotification('Settings saved successfully', 'success');
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      // Create backup before reset
      this.createBackup();
      
      // Reset settings
      this.settings = this.constructor.prototype.settings;
      this.saveSettings();
      this.applySettings();
      
      // Refresh dialog
      uiSystem.closeCurrentModal();
      this.openSettingsDialog();
      
      uiSystem.showNotification('Settings reset to defaults', 'info');
    }
  }

  /**
   * Create backup
   */
  createBackup() {
    const backup = {
      id: `backup_${Date.now()}`,
      timestamp: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(this.settings)),
      data: JSON.parse(JSON.stringify(STATE))
    };

    this.backups.unshift(backup);
    
    // Limit backup count
    if (this.backups.length > this.settings.data.maxBackups) {
      this.backups = this.backups.slice(0, this.settings.data.maxBackups);
    }

    this.saveSettings();
    uiSystem.showNotification('Backup created successfully', 'success');
  }

  /**
   * Export settings
   */
  exportSettings() {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: this.settings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-dashboard-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    uiSystem.showNotification('Settings exported successfully', 'success');
  }

  /**
   * Import settings from file
   */
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        this.importSettings(importData.settings);
      } catch (error) {
        uiSystem.showNotification('Error importing settings: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Import settings
   */
  importSettings(importedSettings) {
    if (this.settings.data.backupBeforeImport) {
      this.createBackup();
    }

    this.settings = this.mergeSettings(this.settings, importedSettings);
    this.saveSettings();
    this.applySettings();
    
    // Refresh dialog if open
    if (uiSystem.isModalOpen() && document.getElementById('settings-modal')) {
      uiSystem.closeCurrentModal();
      this.openSettingsDialog();
    }

    uiSystem.showNotification('Settings imported successfully', 'success');
  }

  /**
   * Show import dialog
   */
  showImportDialog() {
    const modal = uiSystem.createModal('import-data-modal', 'Import Data', this.createImportDialogContent());
    uiSystem.openModal(modal.id);
    
    this.setupImportDialogHandlers();
  }

  /**
   * Create import dialog content
   */
  createImportDialogContent() {
    return `
      <div class="import-dialog-content">
        <div class="import-section">
          <h3>Import Dashboard Data</h3>
          <p class="text-gray-600 mb-4">Select the type of data you want to import:</p>
          
          <div class="import-options">
            <label class="import-option">
              <input type="radio" name="import-type" value="settings" checked>
              <span class="option-title">Settings Only</span>
              <span class="option-desc">Import dashboard settings and preferences</span>
            </label>
            
            <label class="import-option">
              <input type="radio" name="import-type" value="data">
              <span class="option-title">Data Only</span>
              <span class="option-desc">Import routes, staff, and assets data</span>
            </label>
            
            <label class="import-option">
              <input type="radio" name="import-type" value="complete">
              <span class="option-title">Complete Backup</span>
              <span class="option-desc">Import settings and all data</span>
            </label>
          </div>
        </div>

        <div class="file-upload-section">
          <div class="file-drop-zone" id="file-drop-zone">
            <div class="drop-icon">📁</div>
            <div class="drop-text">Drop your file here or click to browse</div>
            <input type="file" id="import-file-input" accept=".json" hidden>
          </div>
          
          <div class="file-info" id="file-info" style="display: none;">
            <div class="file-details">
              <span class="file-name" id="file-name"></span>
              <span class="file-size" id="file-size"></span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="settingsSystem.clearFileSelection()">Clear</button>
          </div>
        </div>

        <div class="import-options-section">
          <label class="checkbox-label">
            <input type="checkbox" id="create-backup-before-import" checked>
            Create backup before importing
          </label>
          
          <label class="checkbox-label">
            <input type="checkbox" id="overwrite-existing">
            Overwrite existing data
          </label>
        </div>

        <div class="import-actions">
          <button class="btn btn-secondary" onclick="uiSystem.closeCurrentModal()">Cancel</button>
          <button class="btn btn-primary" id="execute-import-btn" disabled onclick="settingsSystem.executeImport()">Import Data</button>
        </div>
      </div>
    `;
  }

  /**
   * Setup import dialog handlers
   */
  setupImportDialogHandlers() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    const importBtn = document.getElementById('execute-import-btn');

    if (dropZone && fileInput) {
      // Click to browse
      dropZone.addEventListener('click', () => {
        fileInput.click();
      });

      // File selection
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileSelection(e.target.files[0]);
        }
      });

      // Drag and drop
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
          this.handleFileSelection(e.dataTransfer.files[0]);
        }
      });
    }
  }

  /**
   * Handle file selection for import
   */
  handleFileSelection(file) {
    if (!file.name.endsWith('.json')) {
      uiSystem.showNotification('Please select a JSON file', 'error');
      return;
    }

    const dropZone = document.getElementById('file-drop-zone');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const importBtn = document.getElementById('execute-import-btn');

    if (dropZone) dropZone.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'flex';
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
    if (importBtn) importBtn.disabled = false;

    this.selectedFile = file;
  }

  /**
   * Clear file selection
   */
  clearFileSelection() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInfo = document.getElementById('file-info');
    const importBtn = document.getElementById('execute-import-btn');
    const fileInput = document.getElementById('import-file-input');

    if (dropZone) dropZone.style.display = 'flex';
    if (fileInfo) fileInfo.style.display = 'none';
    if (importBtn) importBtn.disabled = true;
    if (fileInput) fileInput.value = '';

    this.selectedFile = null;
  }

  /**
   * Execute import
   */
  executeImport() {
    if (!this.selectedFile) {
      uiSystem.showNotification('Please select a file to import', 'error');
      return;
    }

    const importType = document.querySelector('input[name="import-type"]:checked')?.value;
    const createBackup = document.getElementById('create-backup-before-import')?.checked;
    const overwriteExisting = document.getElementById('overwrite-existing')?.checked;

    if (createBackup) {
      this.createBackup();
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        switch (importType) {
          case 'settings':
            this.importSettings(importData.settings || importData);
            break;
          case 'data':
            this.importData(importData.data || importData, overwriteExisting);
            break;
          case 'complete':
            this.importCompleteBackup(importData, overwriteExisting);
            break;
        }

        uiSystem.closeCurrentModal();
        uiSystem.showNotification('Data imported successfully', 'success');
        
      } catch (error) {
        console.error('Import error:', error);
        uiSystem.showNotification('Error importing file: Invalid format', 'error');
      }
    };

    reader.readAsText(this.selectedFile);
  }

  /**
   * Export all data
   */
  exportAllData() {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      type: 'complete',
      settings: this.settings,
      data: JSON.parse(JSON.stringify(STATE))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-dashboard-complete-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    uiSystem.showNotification('Complete data exported successfully', 'success');
  }

  /**
   * Import data only
   */
  importData(data, overwrite = false) {
    if (overwrite) {
      // Replace all data
      Object.keys(data).forEach(key => {
        setState(key, data[key]);
      });
    } else {
      // Merge data
      Object.keys(data).forEach(key => {
        const existing = getState(key);
        if (existing && Array.isArray(existing) && Array.isArray(data[key])) {
          // Merge arrays by unique identifiers
          setState(key, this.mergeArrayData(existing, data[key], key));
        } else if (existing && typeof existing === 'object' && typeof data[key] === 'object') {
          // Merge objects
          setState(key, { ...existing, ...data[key] });
        } else {
          // Replace primitive values
          setState(key, data[key]);
        }
      });
    }

    saveToLocalStorage();
    eventBus.emit('data:updated');
  }

  /**
   * Import complete backup
   */
  importCompleteBackup(backup, overwrite = false) {
    if (backup.settings) {
      this.importSettings(backup.settings);
    }
    
    if (backup.data) {
      this.importData(backup.data, overwrite);
    }
  }

  /**
   * Merge array data intelligently
   */
  mergeArrayData(existing, imported, dataType) {
    switch (dataType) {
      case 'routes':
        return this.mergeRoutes(existing, imported);
      case 'staff':
        return this.mergeStaff(existing, imported);
      case 'assets':
        return this.mergeAssets(existing, imported);
      default:
        // For other arrays, concatenate and remove duplicates
        return [...existing, ...imported.filter(item => 
          !existing.some(existingItem => 
            JSON.stringify(existingItem) === JSON.stringify(item)
          )
        )];
    }
  }

  /**
   * Merge routes intelligently
   */
  mergeRoutes(existing, imported) {
    const merged = [...existing];
    
    imported.forEach(importedRoute => {
      const existingIndex = merged.findIndex(route => 
        route.name === importedRoute.name && route.shift === importedRoute.shift
      );
      
      if (existingIndex >= 0) {
        // Update existing route
        merged[existingIndex] = { ...merged[existingIndex], ...importedRoute };
      } else {
        // Add new route
        merged.push(importedRoute);
      }
    });
    
    return merged;
  }

  /**
   * Merge staff intelligently
   */
  mergeStaff(existing, imported) {
    const merged = [...existing];
    
    imported.forEach(importedStaff => {
      const existingIndex = merged.findIndex(staff => staff.name === importedStaff.name);
      
      if (existingIndex >= 0) {
        // Update existing staff
        merged[existingIndex] = { ...merged[existingIndex], ...importedStaff };
      } else {
        // Add new staff
        merged.push(importedStaff);
      }
    });
    
    return merged;
  }

  /**
   * Merge assets intelligently
   */
  mergeAssets(existing, imported) {
    const merged = [...existing];
    
    imported.forEach(importedAsset => {
      const existingIndex = merged.findIndex(asset => asset.name === importedAsset.name);
      
      if (existingIndex >= 0) {
        // Update existing asset
        merged[existingIndex] = { ...merged[existingIndex], ...importedAsset };
      } else {
        // Add new asset
        merged.push(importedAsset);
      }
    });
    
    return merged;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Download system logs for debugging
   */
  downloadLogs() {
    console.log('📥 Downloading system logs...');
    
    // Collect various log data
    const logData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      localStorage: {},
      sessionStorage: {},
      console: [],
      errors: [],
      performance: {
        timing: performance.timing,
        navigation: performance.navigation
      },
      state: {
        routes: STATE.data?.routes?.length || 0,
        staff: STATE.data?.staff?.length || 0,
        assets: STATE.data?.assets?.length || 0,
        currentView: STATE.currentView
      }
    };

    // Safely collect localStorage data
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        logData.localStorage[key] = localStorage.getItem(key);
      }
    } catch (e) {
      logData.localStorage.error = e.message;
    }

    // Safely collect sessionStorage data
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        logData.sessionStorage[key] = sessionStorage.getItem(key);
      }
    } catch (e) {
      logData.sessionStorage.error = e.message;
    }

    // Create and download the log file
    const logContent = JSON.stringify(logData, null, 2);
    const blob = new Blob([logContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ System logs downloaded successfully');
  }

  /**
   * Run system diagnostics
   */
  runDiagnostics() {
    console.log('🔍 Running system diagnostics...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        platform: navigator.platform
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      performance: {
        memory: performance.memory,
        timing: performance.timing,
        navigation: performance.navigation
      },
      storage: {
        localStorage: {
          available: !!window.localStorage,
          quota: this.getStorageQuota('localStorage'),
          used: this.getStorageUsed('localStorage')
        },
        sessionStorage: {
          available: !!window.sessionStorage,
          quota: this.getStorageQuota('sessionStorage'),
          used: this.getStorageUsed('sessionStorage')
        }
      },
      modules: {
        loadedModules: window.DispatchDev?.modules || [],
        errors: window.DispatchDev?.errors || []
      },
      data: {
        routes: STATE.data?.routes?.length || 0,
        staff: STATE.data?.staff?.length || 0,
        assets: STATE.data?.assets?.length || 0,
        statusTimestamps: Object.keys(STATE.statusTimestamps || {}).length
      },
      dom: {
        elements: document.querySelectorAll('*').length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length
      }
    };

    // Log results to console
    console.table(diagnostics.browser);
    console.table(diagnostics.storage);
    console.table(diagnostics.data);
    
    // Show results in modal
    this.showDiagnosticsModal(diagnostics);
    
    console.log('✅ System diagnostics completed');
    return diagnostics;
  }

  /**
   * Get storage quota estimation
   */
  getStorageQuota(storageType) {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
          return estimate.quota;
        });
      }
      return 'Unknown';
    } catch (e) {
      return 'Error';
    }
  }

  /**
   * Get storage used estimation
   */
  getStorageUsed(storageType) {
    try {
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
      let total = 0;
      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          total += storage[key].length + key.length;
        }
      }
      return this.formatFileSize(total);
    } catch (e) {
      return 'Error';
    }
  }

  /**
   * Show diagnostics results in modal
   */
  showDiagnosticsModal(diagnostics) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-hidden flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-xl font-bold">System Diagnostics</h3>
          <button class="close-diagnostics text-gray-500 hover:text-gray-700 text-xl">×</button>
        </div>
        <div class="p-4 flex-1 overflow-y-auto">
          <div class="space-y-4">
            <div>
              <h4 class="font-semibold mb-2">Browser Information</h4>
              <pre class="bg-gray-100 p-2 rounded text-sm overflow-x-auto">${JSON.stringify(diagnostics.browser, null, 2)}</pre>
            </div>
            <div>
              <h4 class="font-semibold mb-2">Storage Information</h4>
              <pre class="bg-gray-100 p-2 rounded text-sm overflow-x-auto">${JSON.stringify(diagnostics.storage, null, 2)}</pre>
            </div>
            <div>
              <h4 class="font-semibold mb-2">Application Data</h4>
              <pre class="bg-gray-100 p-2 rounded text-sm overflow-x-auto">${JSON.stringify(diagnostics.data, null, 2)}</pre>
            </div>
            <div>
              <h4 class="font-semibold mb-2">Performance</h4>
              <pre class="bg-gray-100 p-2 rounded text-sm overflow-x-auto">${JSON.stringify({
                loadTime: diagnostics.performance.timing.loadEventEnd - diagnostics.performance.timing.navigationStart,
                domContentLoaded: diagnostics.performance.timing.domContentLoadedEventEnd - diagnostics.performance.timing.navigationStart,
                memory: diagnostics.performance.memory
              }, null, 2)}</pre>
            </div>
          </div>
        </div>
        <div class="p-4 border-t">
          <div class="flex space-x-2">
            <button class="download-diagnostics px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Download Report</button>
            <button class="close-diagnostics px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Close</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    modal.querySelectorAll('.close-diagnostics').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    });

    modal.querySelector('.download-diagnostics').addEventListener('click', () => {
      const content = JSON.stringify(diagnostics, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    document.body.appendChild(modal);
  }
}

// Create and export singleton instance
const settingsSystem = new SettingsSystem();

// Make functions globally accessible for inline event handlers
window.settingsSystem = settingsSystem;

export { settingsSystem };