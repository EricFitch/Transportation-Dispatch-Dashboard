/* TOUCH - RESPONSIVE MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Responsive layout management, collapsible cards, adaptive UI,
   field trip rendering, search functionality, and mobile optimization
   Total lines: 380
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive responsive system from fragmented extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { PERFORMANCE, debounceRender } from '../core/utils.js';

// =============================================================================
// RESPONSIVE LAYOUT CONFIGURATION
// =============================================================================

const RESPONSIVE_CONFIG = {
    // Breakpoints
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1200
    },
    
    // Card collapse settings
    cardCollapse: {
        enabled: true,
        autoCollapseOnMobile: true,
        rememberState: true,
        animationDuration: 300
    },
    
    // Grid settings
    grid: {
        mobile: { columns: 1, gap: '8px' },
        tablet: { columns: 2, gap: '16px' },
        desktop: { columns: 3, gap: '20px' }
    },
    
    // Touch targets
    touchTargets: {
        minSize: 44, // iOS/Android guideline
        padding: 12
    }
};

// Track responsive state
const RESPONSIVE_STATE = {
    currentBreakpoint: 'desktop',
    isCollapsed: new Set(),
    searchResults: {
        staff: [],
        routes: [],
        assets: [],
        totalCount: 0
    },
    searchTerm: '',
    cardStates: new Map() // Track individual card states
};

// =============================================================================
// RESPONSIVE INITIALIZATION
// =============================================================================

function initializeResponsiveSystem() {
    console.log('📱 Initializing responsive system...');
    
    // Detect initial breakpoint
    updateCurrentBreakpoint();
    
    // Set up responsive event listeners
    setupResponsiveListeners();
    
    // Initialize responsive grids
    initializeResponsiveGrids();
    
    // Set up card collapse system
    setupCardCollapse();
    
    // Load saved card states
    loadCardStates();
    
    // Apply initial responsive classes
    applyResponsiveClasses();
    
    console.log(`✅ Responsive system initialized (${RESPONSIVE_STATE.currentBreakpoint})`);
    eventBus.emit('responsive:initialized', {
        breakpoint: RESPONSIVE_STATE.currentBreakpoint
    });
    
    return true;
}

function setupResponsiveListeners() {
    // Window resize handler with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            handleResponsiveChange();
        }, 150);
    });
    
    // Orientation change handler
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleResponsiveChange();
            recalculateResponsiveLayout();
        }, 300);
    });
    
    // Listen for data updates
    eventBus.on('state:dataUpdated', () => {
        debounceRender('updateResponsiveContent');
    });
}

function handleResponsiveChange() {
    const oldBreakpoint = RESPONSIVE_STATE.currentBreakpoint;
    updateCurrentBreakpoint();
    
    if (oldBreakpoint !== RESPONSIVE_STATE.currentBreakpoint) {
        console.log(`📱 Breakpoint changed: ${oldBreakpoint} → ${RESPONSIVE_STATE.currentBreakpoint}`);
        
        // Apply responsive changes
        applyResponsiveClasses();
        updateResponsiveGrids();
        handleBreakpointChange(oldBreakpoint, RESPONSIVE_STATE.currentBreakpoint);
        
        eventBus.emit('responsive:breakpointChanged', {
            from: oldBreakpoint,
            to: RESPONSIVE_STATE.currentBreakpoint
        });
    }
    
    // Always recalculate layout
    recalculateResponsiveLayout();
}

function updateCurrentBreakpoint() {
    const width = window.innerWidth;
    
    if (width < RESPONSIVE_CONFIG.breakpoints.mobile) {
        RESPONSIVE_STATE.currentBreakpoint = 'mobile';
    } else if (width < RESPONSIVE_CONFIG.breakpoints.tablet) {
        RESPONSIVE_STATE.currentBreakpoint = 'tablet';
    } else {
        RESPONSIVE_STATE.currentBreakpoint = 'desktop';
    }
}

// =============================================================================
// RESPONSIVE GRID SYSTEM
// =============================================================================

function initializeResponsiveGrids() {
    const grids = document.querySelectorAll('.responsive-grid');
    
    grids.forEach(grid => {
        setupGridResponsiveness(grid);
    });
    
    // Create responsive field trip grid if needed
    setupFieldTripGrid();
}

function setupGridResponsiveness(grid) {
    if (!grid) return;
    
    // Add responsive classes
    grid.classList.add('responsive-grid-container');
    
    // Apply current breakpoint styles
    updateGridLayout(grid);
}

function updateGridLayout(grid) {
    const config = RESPONSIVE_CONFIG.grid[RESPONSIVE_STATE.currentBreakpoint];
    
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${config.columns}, 1fr)`;
    grid.style.gap = config.gap;
    grid.style.width = '100%';
}

function updateResponsiveGrids() {
    const grids = document.querySelectorAll('.responsive-grid');
    grids.forEach(grid => updateGridLayout(grid));
}

function setupFieldTripGrid() {
    // This function handles the field trip rendering mentioned in the extraction
    if (!STATE.data?.fieldTrips) return;
    
    const currentFieldTrips = STATE.data.fieldTrips.filter(trip => {
        const tripDate = new Date(trip.date);
        const today = new Date();
        return tripDate.toDateString() === today.toDateString();
    });
    
    if (currentFieldTrips.length > 0) {
        console.log('🚌 Adding field trips section to HTML');
        
        let html = `
            <div class="responsive-grid grid gap-4 mb-4" id="field-trips-grid">
                <h3 class="col-span-full text-lg font-semibold text-gray-800 mb-2">
                    Today's Field Trips (${currentFieldTrips.length})
                </h3>
        `;
        
        currentFieldTrips.forEach(fieldTrip => {
            html += generateFieldTripCardHtml(fieldTrip);
        });
        
        html += '</div>';
        
        // Insert into dashboard
        const routesPanel = document.getElementById('routes-panel');
        if (routesPanel) {
            const existingGrid = document.getElementById('field-trips-grid');
            if (existingGrid) {
                existingGrid.outerHTML = html;
            } else {
                routesPanel.insertAdjacentHTML('afterbegin', html);
            }
        }
        
        // Apply responsive grid to the new element
        const newGrid = document.getElementById('field-trips-grid');
        if (newGrid) {
            setupGridResponsiveness(newGrid);
        }
    }
}

function generateFieldTripCardHtml(fieldTrip) {
    return `
        <div class="field-trip-card bg-purple-50 border-2 border-purple-200 rounded-lg p-4 hover:shadow-lg transition-all"
             data-trip-id="${fieldTrip.id}">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-semibold text-purple-800">${fieldTrip.name || 'Field Trip'}</h4>
                <span class="px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                    FIELD TRIP
                </span>
            </div>
            
            <div class="space-y-1 text-sm text-gray-600">
                ${fieldTrip.destination ? `<div><strong>Destination:</strong> ${fieldTrip.destination}</div>` : ''}
                ${fieldTrip.departureTime ? `<div><strong>Departure:</strong> ${fieldTrip.departureTime}</div>` : ''}
                ${fieldTrip.returnTime ? `<div><strong>Return:</strong> ${fieldTrip.returnTime}</div>` : ''}
                ${fieldTrip.studentCount ? `<div><strong>Students:</strong> ${fieldTrip.studentCount}</div>` : ''}
            </div>
            
            ${fieldTrip.asset || fieldTrip.driver ? `
                <div class="mt-3 pt-3 border-t border-purple-200">
                    ${fieldTrip.asset ? `<div class="text-sm"><strong>Vehicle:</strong> ${fieldTrip.asset}</div>` : ''}
                    ${fieldTrip.driver ? `<div class="text-sm"><strong>Driver:</strong> ${fieldTrip.driver}</div>` : ''}
                </div>
            ` : ''}
            
            <div class="mt-3 flex space-x-2">
                <button class="assign-trip-btn flex-1 py-1 px-2 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                        data-trip-id="${fieldTrip.id}">
                    🎯 Assign
                </button>
                <button class="trip-details-btn px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                        data-trip-id="${fieldTrip.id}">
                    📋
                </button>
            </div>
        </div>
    `;
}

// =============================================================================
// CARD COLLAPSE SYSTEM
// =============================================================================

function setupCardCollapse() {
    console.log('📋 Setting up card collapse system...');
    
    // Set up collapse functionality for existing cards
    setupExistingCardCollapse();
    
    // Listen for new cards being added
    observeNewCards();
    
    // Auto-collapse on mobile if enabled
    if (RESPONSIVE_CONFIG.cardCollapse.autoCollapseOnMobile && RESPONSIVE_STATE.currentBreakpoint === 'mobile') {
        autoCollapseAllCards();
    }
}

function setupExistingCardCollapse() {
    const cards = document.querySelectorAll('.route-card, .staff-card, .asset-card');
    
    cards.forEach(card => {
        setupCardCollapseFeature(card);
    });
}

function setupCardCollapseFeature(card) {
    if (card.querySelector('.collapse-btn')) return; // Already set up
    
    const cardId = card.id || `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    card.id = cardId;
    
    // Create collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn absolute top-2 right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full text-xs font-bold transition-colors z-10';
    collapseBtn.textContent = '−';
    collapseBtn.title = 'Collapse';
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCardCollapse(cardId);
    });
    
    // Make card relatively positioned for absolute button
    card.style.position = 'relative';
    
    // Create collapsible content wrapper
    const content = Array.from(card.children);
    const collapsibleContent = document.createElement('div');
    collapsibleContent.className = 'collapsible-content';
    
    // Move existing content to collapsible wrapper (except the button)
    content.forEach(child => {
        if (child !== collapseBtn) {
            collapsibleContent.appendChild(child);
        }
    });
    
    // Create minimal view
    const minimalView = createMinimalView(card);
    minimalView.style.display = 'none';
    
    // Add elements to card
    card.appendChild(collapseBtn);
    card.appendChild(collapsibleContent);
    card.appendChild(minimalView);
    
    // Load saved state
    const savedState = RESPONSIVE_STATE.cardStates.get(cardId);
    if (savedState?.collapsed || (RESPONSIVE_CONFIG.cardCollapse.autoCollapseOnMobile && RESPONSIVE_STATE.currentBreakpoint === 'mobile')) {
        toggleCardCollapse(cardId, true);
    }
}

function createMinimalView(card) {
    const minimalView = document.createElement('div');
    minimalView.className = 'minimal-view p-2';
    
    // Extract key information based on card type
    let title = '';
    let subtitle = '';
    let status = '';
    
    if (card.classList.contains('route-card')) {
        const routeNumber = card.querySelector('[data-route-number]')?.textContent || 'Route';
        const school = card.querySelector('.school-name')?.textContent || '';
        const time = card.querySelector('.departure-time')?.textContent || '';
        title = routeNumber;
        subtitle = school;
        status = time;
    } else if (card.classList.contains('staff-card')) {
        const name = card.querySelector('.staff-name')?.textContent || 'Staff';
        const role = card.querySelector('.staff-role')?.textContent || '';
        const availability = card.querySelector('.availability-status')?.textContent || '';
        title = name;
        subtitle = role;
        status = availability;
    } else if (card.classList.contains('asset-card')) {
        const assetName = card.querySelector('.asset-name')?.textContent || 'Asset';
        const type = card.querySelector('.asset-type')?.textContent || '';
        const status_el = card.querySelector('.asset-status')?.textContent || '';
        title = assetName;
        subtitle = type;
        status = status_el;
    }
    
    minimalView.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">${title}</div>
                ${subtitle ? `<div class="text-xs text-gray-500 truncate">${subtitle}</div>` : ''}
            </div>
            ${status ? `<div class="text-xs text-gray-600 ml-2">${status}</div>` : ''}
        </div>
    `;
    
    return minimalView;
}

function toggleCardCollapse(cardId, forceCollapse = null) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const collapsibleContent = card.querySelector('.collapsible-content');
    const minimalView = card.querySelector('.minimal-view');
    const collapseBtn = card.querySelector('.collapse-btn');
    
    if (!collapsibleContent || !minimalView || !collapseBtn) return;
    
    const isCurrentlyCollapsed = collapsibleContent.style.display === 'none';
    const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCurrentlyCollapsed;
    
    if (shouldCollapse) {
        // Collapse: Hide full content, show minimal view
        collapsibleContent.style.display = 'none';
        minimalView.style.display = 'block';
        collapseBtn.textContent = '+';
        collapseBtn.title = 'Expand';
        
        // Add collapsed class
        card.classList.add('route-card-collapsed', 'card-collapsed');
        card.classList.remove('route-card-expanded', 'card-expanded');
        
        RESPONSIVE_STATE.isCollapsed.add(cardId);
    } else {
        // Expand: Show full content, hide minimal view
        collapsibleContent.style.display = 'block';
        minimalView.style.display = 'none';
        collapseBtn.textContent = '−';
        collapseBtn.title = 'Collapse';
        
        // Add expanded class
        card.classList.add('route-card-expanded', 'card-expanded');
        card.classList.remove('route-card-collapsed', 'card-collapsed');
        
        RESPONSIVE_STATE.isCollapsed.delete(cardId);
    }
    
    // Save state
    RESPONSIVE_STATE.cardStates.set(cardId, {
        collapsed: shouldCollapse,
        timestamp: Date.now()
    });
    
    if (RESPONSIVE_CONFIG.cardCollapse.rememberState) {
        saveCardStates();
    }
    
    // Emit event
    eventBus.emit('responsive:cardToggled', {
        cardId: cardId,
        collapsed: shouldCollapse,
        type: card.className
    });
}

function collapseAllCards() {
    const cards = document.querySelectorAll('.route-card, .staff-card, .asset-card');
    let collapsedCount = 0;
    
    cards.forEach(card => {
        const cardId = card.id;
        if (cardId) {
            const collapsibleContent = card.querySelector('.collapsible-content');
            const minimalView = card.querySelector('.minimal-view');
            const btn = card.querySelector('.collapse-btn');
            
            if (collapsibleContent && collapsibleContent.style.display !== 'none') {
                toggleCardCollapse(cardId, true);
                collapsedCount++;
            }
        }
    });
    
    console.log(`📋 Collapsed ${collapsedCount} cards`);
    return collapsedCount;
}

function expandAllCards() {
    const cards = document.querySelectorAll('.route-card, .staff-card, .asset-card');
    let expandedCount = 0;
    
    cards.forEach(card => {
        const cardId = card.id;
        if (cardId) {
            const collapsibleContent = card.querySelector('.collapsible-content');
            const minimalView = card.querySelector('.minimal-view');
            const btn = card.querySelector('.collapse-btn');
            
            if (collapsibleContent && collapsibleContent.style.display === 'none') {
                toggleCardCollapse(cardId, false);
                expandedCount++;
            }
        }
    });
    
    console.log(`📋 Expanded ${expandedCount} cards`);
    return expandedCount;
}

function autoCollapseAllCards() {
    if (RESPONSIVE_STATE.currentBreakpoint === 'mobile' && RESPONSIVE_CONFIG.cardCollapse.autoCollapseOnMobile) {
        setTimeout(() => {
            collapseAllCards();
        }, 500); // Delay to ensure cards are rendered
    }
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================

function performResponsiveSearch(searchTerm) {
    console.log(`🔍 Performing responsive search: "${searchTerm}"`);
    
    RESPONSIVE_STATE.searchTerm = searchTerm.toLowerCase().trim();
    
    if (!RESPONSIVE_STATE.searchTerm) {
        clearSearchResults();
        return RESPONSIVE_STATE.searchResults;
    }
    
    const results = {
        staff: [],
        routes: [],
        assets: [],
        totalCount: 0
    };
    
    // Search staff
    if (STATE.data?.staff) {
        STATE.data.staff.forEach((staff, index) => {
            const matches = searchInObject(staff, RESPONSIVE_STATE.searchTerm);
            if (matches) {
                results.staff.push({ ...staff, index, type: 'staff' });
            }
        });
    }
    
    // Search routes
    if (STATE.data?.routes) {
        STATE.data.routes.forEach((route, index) => {
            const matches = searchInObject(route, RESPONSIVE_STATE.searchTerm);
            if (matches) {
                results.routes.push({ ...route, index, type: 'route' });
            }
        });
    }
    
    // Search assets
    if (STATE.data?.assets) {
        STATE.data.assets.forEach((asset, index) => {
            const matches = searchInObject(asset, RESPONSIVE_STATE.searchTerm);
            if (matches) {
                results.assets.push({ ...asset, index, type: 'asset' });
            }
        });
    }
    
    results.totalCount = results.staff.length + results.routes.length + results.assets.length;
    RESPONSIVE_STATE.searchResults = results;
    
    // Update UI
    updateSearchResults();
    highlightSearchTerms();
    
    eventBus.emit('responsive:searchCompleted', {
        term: searchTerm,
        results: results
    });
    
    return results;
}

function searchInObject(obj, term) {
    if (!obj || !term) return false;
    
    return Object.values(obj).some(value => {
        if (typeof value === 'string') {
            return value.toLowerCase().includes(term);
        } else if (typeof value === 'number') {
            return value.toString().includes(term);
        }
        return false;
    });
}

function updateSearchResults() {
    const results = RESPONSIVE_STATE.searchResults;
    
    // Hide non-matching cards
    hideNonMatchingCards();
    
    // Show search summary if there are results
    if (results.totalCount > 0) {
        showSearchSummary();
    }
}

function hideNonMatchingCards() {
    const allCards = document.querySelectorAll('.route-card, .staff-card, .asset-card');
    
    allCards.forEach(card => {
        const shouldShow = cardMatchesSearch(card);
        card.style.display = shouldShow ? 'block' : 'none';
    });
}

function cardMatchesSearch(card) {
    if (!RESPONSIVE_STATE.searchTerm) return true;
    
    const cardText = card.textContent.toLowerCase();
    return cardText.includes(RESPONSIVE_STATE.searchTerm);
}

function highlightSearchTerms() {
    if (!RESPONSIVE_STATE.searchTerm) return;
    
    const visibleCards = document.querySelectorAll('.route-card:not([style*="display: none"]), .staff-card:not([style*="display: none"]), .asset-card:not([style*="display: none"])');
    
    visibleCards.forEach(card => {
        highlightInElement(card, RESPONSIVE_STATE.searchTerm);
    });
}

function highlightInElement(element, term) {
    // Remove existing highlights
    element.querySelectorAll('.search-highlight').forEach(highlight => {
        highlight.outerHTML = highlight.innerHTML;
    });
    
    // Add new highlights
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
        const parent = textNode.parentNode;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;
        
        const text = textNode.textContent;
        const regex = new RegExp(`(${term})`, 'gi');
        const highlightedText = text.replace(regex, '<span class="search-highlight bg-yellow-200">$1</span>');
        
        if (highlightedText !== text) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = highlightedText;
            parent.replaceChild(wrapper, textNode);
            
            // Unwrap the div
            while (wrapper.firstChild) {
                parent.insertBefore(wrapper.firstChild, wrapper);
            }
            parent.removeChild(wrapper);
        }
    });
}

function clearSearchResults() {
    RESPONSIVE_STATE.searchResults = {
        staff: [],
        routes: [],
        assets: [],
        totalCount: 0
    };
    RESPONSIVE_STATE.searchTerm = '';
    
    // Show all cards
    const allCards = document.querySelectorAll('.route-card, .staff-card, .asset-card');
    allCards.forEach(card => {
        card.style.display = 'block';
    });
    
    // Remove highlights
    document.querySelectorAll('.search-highlight').forEach(highlight => {
        highlight.outerHTML = highlight.innerHTML;
    });
    
    // Hide search summary
    hideSearchSummary();
}

function showSearchSummary() {
    const results = RESPONSIVE_STATE.searchResults;
    let summary = document.getElementById('search-summary');
    
    if (!summary) {
        summary = document.createElement('div');
        summary.id = 'search-summary';
        summary.className = 'search-summary bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4';
        
        const dashboard = document.getElementById('dashboard') || document.body;
        dashboard.insertAdjacentElement('afterbegin', summary);
    }
    
    summary.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <strong>Search Results:</strong> ${results.totalCount} items found
                ${results.staff.length > 0 ? `<span class="ml-2 px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded">${results.staff.length} Staff</span>` : ''}
                ${results.routes.length > 0 ? `<span class="ml-1 px-2 py-1 bg-green-200 text-green-800 text-xs rounded">${results.routes.length} Routes</span>` : ''}
                ${results.assets.length > 0 ? `<span class="ml-1 px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded">${results.assets.length} Assets</span>` : ''}
            </div>
            <button onclick="clearSearch()" class="text-blue-600 hover:text-blue-800 text-sm">
                ✕ Clear
            </button>
        </div>
    `;
}

function hideSearchSummary() {
    const summary = document.getElementById('search-summary');
    if (summary) {
        summary.remove();
    }
}

// =============================================================================
// BREAKPOINT HANDLERS
// =============================================================================

function handleBreakpointChange(from, to) {
    console.log(`📱 Handling breakpoint change: ${from} → ${to}`);
    
    // Auto-collapse cards on mobile
    if (to === 'mobile' && RESPONSIVE_CONFIG.cardCollapse.autoCollapseOnMobile) {
        autoCollapseAllCards();
    } else if (from === 'mobile' && to !== 'mobile') {
        // Auto-expand when leaving mobile (optional)
        // expandAllCards();
    }
    
    // Update touch targets
    updateTouchTargets();
    
    // Recalculate field trip grid
    setupFieldTripGrid();
}

function updateTouchTargets() {
    const minSize = RESPONSIVE_CONFIG.touchTargets.minSize;
    const padding = RESPONSIVE_CONFIG.touchTargets.padding;
    
    if (RESPONSIVE_STATE.currentBreakpoint === 'mobile') {
        // Ensure touch targets are large enough
        const buttons = document.querySelectorAll('button, .clickable, .touchable');
        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            if (rect.width < minSize || rect.height < minSize) {
                button.style.minWidth = `${minSize}px`;
                button.style.minHeight = `${minSize}px`;
                button.style.padding = `${padding}px`;
            }
        });
    }
}

function applyResponsiveClasses() {
    document.body.classList.remove('mobile-layout', 'tablet-layout', 'desktop-layout');
    document.body.classList.add(`${RESPONSIVE_STATE.currentBreakpoint}-layout`);
    
    // Add breakpoint data attribute
    document.body.setAttribute('data-breakpoint', RESPONSIVE_STATE.currentBreakpoint);
}

function recalculateResponsiveLayout() {
    // Force repaint to ensure proper layout
    debounceRender('updateResponsiveGrids');
    debounceRender('updateTouchTargets');
    
    // Emit layout change event
    eventBus.emit('responsive:layoutRecalculated', {
        breakpoint: RESPONSIVE_STATE.currentBreakpoint,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    });
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

function saveCardStates() {
    const stateData = Object.fromEntries(RESPONSIVE_STATE.cardStates);
    STATE.responsiveCardStates = stateData;
    saveToLocalStorage();
}

function loadCardStates() {
    if (STATE.responsiveCardStates) {
        RESPONSIVE_STATE.cardStates = new Map(Object.entries(STATE.responsiveCardStates));
    }
}

function observeNewCards() {
    // Use MutationObserver to detect new cards
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const newCards = node.querySelectorAll?.('.route-card, .staff-card, .asset-card') || [];
                    newCards.forEach(card => {
                        setupCardCollapseFeature(card);
                    });
                    
                    // Also check if the node itself is a card
                    if (node.classList?.contains('route-card') || node.classList?.contains('staff-card') || node.classList?.contains('asset-card')) {
                        setupCardCollapseFeature(node);
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// =============================================================================
// GLOBAL FUNCTIONS
// =============================================================================

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.setupCardCollapse = setupCardCollapse;
    window.toggleCardCollapse = toggleCardCollapse;
    window.collapseAllCards = collapseAllCards;
    window.expandAllCards = expandAllCards;
    window.clearSearch = clearSearchResults;
    window.performSearch = performResponsiveSearch;
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

eventBus.on('ui:cardAdded', (data) => {
    if (data.element) {
        setupCardCollapseFeature(data.element);
    }
});

eventBus.on('touch:initialized', () => {
    updateTouchTargets();
});

// =============================================================================
// EXPORTS
// =============================================================================

export {
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
