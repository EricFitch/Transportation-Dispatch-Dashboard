/**
 * UI CARD MANAGEMENT MODULE
 * Transportation Dispatch Dashboard
 * 
 * Card collapse, expand, and visual management system:
 * - Individual card collapse/expand
 * - Category collapse functionality
 * - Card state persistence
 * - Animation and transition management
 * 
 * Dependencies: core/events, core/state
 */

import { eventBus } from '../core/events.js';
import { STATE, getState, setState, saveToLocalStorage } from '../core/state.js';

class CardManagement {
  constructor() {
    this.cardStates = new Map(); // Track collapse states
    this.categoryStates = new Map(); // Track category collapse states
    this.initialized = false;
  }

  /**
   * Initialize card management system
   */
  init() {
    if (this.initialized) {
      console.log('🃏 Card Management already initialized');
      return;
    }

    this.loadCardStates();
    this.setupEventListeners();
    this.setupCardCollapse();
    this.setupCategoryCollapse();
    
    this.initialized = true;
    console.log('🃏 Card Management initialized');
  }

  /**
   * Load saved card states from localStorage
   */
  loadCardStates() {
    try {
      const savedStates = getState('cardStates');
      if (savedStates) {
        this.cardStates = new Map(Object.entries(savedStates.cards || {}));
        this.categoryStates = new Map(Object.entries(savedStates.categories || {}));
      }
    } catch (error) {
      console.error('❌ Error loading card states:', error);
    }
  }

  /**
   * Save card states to localStorage
   */
  saveCardStates() {
    try {
      setState('cardStates', {
        cards: Object.fromEntries(this.cardStates),
        categories: Object.fromEntries(this.categoryStates)
      });
    } catch (error) {
      console.error('❌ Error saving card states:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    eventBus.on('card:toggle', (data) => {
      this.toggleCardCollapse(data.cardId);
    });

    eventBus.on('cards:collapseAll', () => {
      this.collapseAllCards();
    });

    eventBus.on('cards:expandAll', () => {
      this.expandAllCards();
    });

    eventBus.on('category:toggle', (data) => {
      this.collapseCategoryRoutes(data.categoryId);
    });
  }

  /**
   * Setup card collapse functionality
   */
  setupCardCollapse() {
    // Add click handlers for collapse buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('collapse-btn') || e.target.closest('.collapse-btn')) {
        const collapseBtn = e.target.closest('.collapse-btn') || e.target;
        const routeKey = collapseBtn.dataset.routeKey;
        
        if (routeKey) {
          this.toggleCardCollapse(routeKey);
        }
      }
    });

    // Apply saved collapse states after DOM updates
    eventBus.on('route:rendered', () => {
      this.applyCardStates();
    });
  }

  /**
   * Setup category collapse functionality
   */
  setupCategoryCollapse() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('collapse-category-btn') || e.target.closest('.collapse-category-btn')) {
        const categoryBtn = e.target.closest('.collapse-category-btn') || e.target;
        const categoryId = categoryBtn.dataset.category;
        
        if (categoryId) {
          this.collapseCategoryRoutes(categoryId);
        }
      }
    });
  }

  /**
   * Toggle collapse state of a specific card
   */
  toggleCardCollapse(routeKey) {
    if (!routeKey) {
      console.error('❌ No route key provided for toggle');
      return;
    }

    const card = document.querySelector(`[data-route-key="${routeKey}"]`);
    if (!card) {
      console.error('❌ Card not found:', routeKey);
      return;
    }

    const isCurrentlyCollapsed = this.cardStates.get(routeKey) || false;
    const newState = !isCurrentlyCollapsed;

    // Update state
    this.cardStates.set(routeKey, newState);
    this.saveCardStates();

    // Apply visual changes
    this.applyCollapseState(card, newState);

    // Emit event
    eventBus.emit('card:toggled', { 
      routeKey, 
      collapsed: newState 
    });

    console.log(`🃏 Card ${routeKey} ${newState ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Apply collapse state to a card element
   */
  applyCollapseState(card, collapsed) {
    const collapsibleContent = card.querySelector('.collapsible-content');
    const collapseBtn = card.querySelector('.collapse-btn');

    if (!collapsibleContent) return;

    if (collapsed) {
      // Collapse the card
      card.classList.add('route-card-collapsed');
      card.classList.remove('route-card-expanded');
      collapsibleContent.style.display = 'none';
      
      if (collapseBtn) {
        collapseBtn.innerHTML = '▶'; // Right arrow for collapsed
        collapseBtn.setAttribute('aria-expanded', 'false');
      }
    } else {
      // Expand the card
      card.classList.remove('route-card-collapsed');
      card.classList.add('route-card-expanded');
      collapsibleContent.style.display = 'block';
      
      if (collapseBtn) {
        collapseBtn.innerHTML = '▼'; // Down arrow for expanded
        collapseBtn.setAttribute('aria-expanded', 'true');
      }
    }
  }

  /**
   * Apply saved collapse states to all cards
   */
  applyCardStates() {
    this.cardStates.forEach((collapsed, routeKey) => {
      const card = document.querySelector(`[data-route-key="${routeKey}"]`);
      if (card) {
        this.applyCollapseState(card, collapsed);
      }
    });
  }

  /**
   * Collapse all cards
   */
  collapseAllCards() {
    const cards = document.querySelectorAll('.route-card[data-route-key]');
    
    cards.forEach(card => {
      const routeKey = card.dataset.routeKey;
      if (routeKey) {
        this.cardStates.set(routeKey, true);
        this.applyCollapseState(card, true);
      }
    });

    this.saveCardStates();
    
    eventBus.emit('cards:allCollapsed');
    console.log('🃏 All cards collapsed');
  }

  /**
   * Expand all cards
   */
  expandAllCards() {
    const cards = document.querySelectorAll('.route-card[data-route-key]');
    
    cards.forEach(card => {
      const routeKey = card.dataset.routeKey;
      if (routeKey) {
        this.cardStates.set(routeKey, false);
        this.applyCollapseState(card, false);
      }
    });

    this.saveCardStates();
    
    eventBus.emit('cards:allExpanded');
    console.log('🃏 All cards expanded');
  }

  /**
   * Collapse/expand an entire category of routes
   */
  collapseCategoryRoutes(categoryId) {
    if (!categoryId) {
      console.error('❌ No category ID provided');
      return;
    }

    const categorySection = document.getElementById(categoryId);
    if (!categorySection) {
      console.error('❌ Category section not found:', categoryId);
      return;
    }

    const isCurrentlyCollapsed = this.categoryStates.get(categoryId) || false;
    const newState = !isCurrentlyCollapsed;

    // Update state
    this.categoryStates.set(categoryId, newState);
    this.saveCardStates();

    // Apply visual changes
    this.applyCategoryCollapseState(categorySection, newState);

    // Update category button if exists
    const categoryBtn = document.querySelector(`[data-category="${categoryId}"]`);
    if (categoryBtn) {
      categoryBtn.innerHTML = newState ? '▶ Show' : '▼ Hide';
      categoryBtn.setAttribute('aria-expanded', newState ? 'false' : 'true');
    }

    // Emit event
    eventBus.emit('category:toggled', { 
      categoryId, 
      collapsed: newState 
    });

    console.log(`🗂️ Category ${categoryId} ${newState ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Apply collapse state to a category section
   */
  applyCategoryCollapseState(categorySection, collapsed) {
    const routeGrid = categorySection.querySelector('.responsive-grid');
    
    if (!routeGrid) return;

    if (collapsed) {
      routeGrid.style.display = 'none';
      categorySection.classList.add('category-collapsed');
    } else {
      routeGrid.style.display = 'grid';
      categorySection.classList.remove('category-collapsed');
    }
  }

  /**
   * Get collapse state of a specific card
   */
  getCardState(routeKey) {
    return this.cardStates.get(routeKey) || false;
  }

  /**
   * Get collapse state of a specific category
   */
  getCategoryState(categoryId) {
    return this.categoryStates.get(categoryId) || false;
  }

  /**
   * Add collapse button to a card element
   */
  addCollapseButton(card, routeKey) {
    // Check if button already exists
    if (card.querySelector('.collapse-btn')) return;

    const cardHeader = card.querySelector('.route-header, h3');
    if (!cardHeader) return;

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.dataset.routeKey = routeKey;
    collapseBtn.innerHTML = '▼';
    collapseBtn.setAttribute('aria-expanded', 'true');
    collapseBtn.setAttribute('aria-label', 'Toggle card details');
    collapseBtn.title = 'Click to collapse/expand card';

    // Add to card header
    cardHeader.style.position = 'relative';
    cardHeader.appendChild(collapseBtn);

    // Mark collapsible content
    const contentElements = card.querySelectorAll('.route-assignment, .route-status, .route-notes, textarea, .route-actions');
    if (contentElements.length > 0) {
      const collapsibleDiv = document.createElement('div');
      collapsibleDiv.className = 'collapsible-content';
      
      // Move content into collapsible container
      contentElements.forEach(element => {
        collapsibleDiv.appendChild(element);
      });
      
      card.appendChild(collapsibleDiv);
    }
  }

  /**
   * Initialize cards with collapse functionality
   */
  initializeCards() {
    const cards = document.querySelectorAll('.route-card[data-route-key]');
    
    cards.forEach(card => {
      const routeKey = card.dataset.routeKey;
      if (routeKey) {
        this.addCollapseButton(card, routeKey);
        
        // Apply saved state
        const collapsed = this.getCardState(routeKey);
        this.applyCollapseState(card, collapsed);
      }
    });
  }

  /**
   * Reset all card states
   */
  resetAllStates() {
    this.cardStates.clear();
    this.categoryStates.clear();
    this.saveCardStates();
    
    // Expand all visible cards
    this.expandAllCards();
    
    console.log('🃏 All card states reset');
  }
}

// Create and export singleton instance
const cardManagement = new CardManagement();

// Make functions globally accessible for inline event handlers
window.setupCardCollapse = () => cardManagement.setupCardCollapse();
window.toggleCardCollapse = (routeKey) => cardManagement.toggleCardCollapse(routeKey);
window.collapseAllCards = () => cardManagement.collapseAllCards();
window.expandAllCards = () => cardManagement.expandAllCards();
window.collapseCategoryRoutes = (categoryId) => cardManagement.collapseCategoryRoutes(categoryId);

export { cardManagement };