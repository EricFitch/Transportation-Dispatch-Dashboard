/* CORE - EVENTS MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Event handling, keyboard navigation, input method detection,
   touch gesture initialization, and search dialog management
   Total lines: 320
   Extracted: 2025-09-11_23-56
   Manual refinement: Organized event handling, cleaned up fragmented code
*/

// Transportation Dispatch Dashboard Module Dependencies
import { PERFORMANCE } from './utils.js';
import { STATE } from './state.js';

// =============================================================================
// INPUT METHOD DETECTION
// =============================================================================

const INPUT_METHOD = {
    hasTouch: false,
    isPrimaryTouch: false,
    isLargeScreen: false,
    screenSize: 'desktop'
};

function detectInputMethod() {
    // Detect touch capability
    INPUT_METHOD.hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Detect if touch is the primary input method
    INPUT_METHOD.isPrimaryTouch = window.matchMedia('(pointer: coarse)').matches;
    
    // Detect screen size category
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    if (width >= 1920 || height >= 1080) {
        INPUT_METHOD.isLargeScreen = true;
        INPUT_METHOD.screenSize = 'large';
    } else if (width >= 1280) {
        INPUT_METHOD.screenSize = 'medium';
    } else if (width >= 768) {
        INPUT_METHOD.screenSize = 'tablet';
    } else {
        INPUT_METHOD.screenSize = 'mobile';
    }
    
    console.log('📱 Input method detected:', INPUT_METHOD);
    
    // Apply appropriate CSS classes to body
    document.body.classList.toggle('touch-primary', INPUT_METHOD.isPrimaryTouch);
    document.body.classList.toggle('has-touch', INPUT_METHOD.hasTouch);
    document.body.classList.toggle('large-screen', INPUT_METHOD.isLargeScreen);
    document.body.classList.add(`screen-${INPUT_METHOD.screenSize}`);
    
    // Update CSS custom properties based on input method
    updateInputBasedStyling();
}

function updateInputBasedStyling() {
    const root = document.documentElement;
    
    if (INPUT_METHOD.isPrimaryTouch) {
        // Enhance touch targets for touch-primary devices
        root.style.setProperty('--touch-target', 'clamp(48px, 3.5vw, 72px)');
        root.style.setProperty('--touch-padding', 'clamp(12px, 1.2vw, 20px)');
    } else {
        // Smaller targets for mouse-primary devices
        root.style.setProperty('--touch-target', 'clamp(32px, 2.5vw, 48px)');
        root.style.setProperty('--touch-padding', 'clamp(6px, 0.8vw, 12px)');
    }
    
    if (INPUT_METHOD.isLargeScreen) {
        // Optimize for large displays
        root.style.setProperty('--text-base', 'clamp(1rem, 1.4vw, 1.25rem)');
        root.style.setProperty('--text-lg', 'clamp(1.125rem, 1.6vw, 1.5rem)');
    }
}

// =============================================================================
// KEYBOARD NAVIGATION SYSTEM
// =============================================================================

const KEYBOARD_NAV = {
    currentFocus: null,
    focusHistory: [],
    isActive: false,
    
    // Navigation targets
    panels: ['staff-panel', 'route-cards', 'asset-panel', 'resource-monitor'],
    currentPanel: 0,
    
    // Focusable selectors
    selectors: {
        cards: '.route-card, .staff-item, .asset-item',
        buttons: 'button:not([disabled])',
        inputs: 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        focusable: 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    }
};

function initializeKeyboardNavigation() {
    // Add keyboard event listeners
    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    // Make cards and items focusable
    updateFocusableElements();
    
    console.log('⌨️ Keyboard navigation initialized');
}

function updateFocusableElements() {
    // Add tabindex to cards and items for keyboard navigation
    const cards = document.querySelectorAll(KEYBOARD_NAV.selectors.cards);
    cards.forEach((card, index) => {
        if (!card.hasAttribute('tabindex')) {
            card.setAttribute('tabindex', '0');
        }
    });
}

function handleGlobalKeydown(event) {
    const { key, ctrlKey, altKey, shiftKey } = event;
    
    if (ctrlKey || altKey) {
        console.log('🔑 Keyboard shortcut detected:', { key, ctrlKey, altKey, shiftKey });
    }
    
    // Handle modal-specific shortcuts
    const activeModal = document.querySelector('.modal:not(.hidden)');
    if (activeModal) {
        handleModalKeydown(event);
        return;
    }
    
    switch (true) {
        // Essential Actions
        case ctrlKey && key === 'o':
            event.preventDefault();
            console.log('🎯 Ctrl+O - Opening staff out dialog');
            // Will be implemented by staff module
            break;
            
        case ctrlKey && key === 'f':
            event.preventDefault();
            // Use the search system if available
            if (window.DispatchApp?.modules?.get('SearchSystem')) {
                window.DispatchApp.modules.get('SearchSystem').openSearchOverlay();
            } else {
                console.log('🔍 Search system not yet available');
            }
            break;
            
        case key === 'Escape':
            handleEscape(event);
            break;
            
        case ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key):
            handleArrowNavigation(event);
            break;
            
        case key === 'Enter':
            handleEnterKey(event);
            break;
            
        case key === ' ':
            handleSpaceKey(event);
            break;
            
        case key === 'Home':
            handleHomeKey(event);
            break;
            
        case key === 'End':
            handleEndKey(event);
            break;
            
        case key === 'Delete':
            handleDeleteKey(event);
            break;
    }
}

function handleModalKeydown(event) {
    const { key } = event;
    
    switch (key) {
        case 'Escape':
            event.preventDefault();
            // Close modal logic will be handled by ui/modals module
            break;
            
        case 'Enter':
            if (event.target.tagName !== 'TEXTAREA') {
                const submitBtn = event.target.closest('.modal').querySelector('[data-action="submit"]');
                if (submitBtn) {
                    event.preventDefault();
                    submitBtn.click();
                }
            }
            break;
    }
}

function handleArrowNavigation(event) {
    const focusableItems = Array.from(document.querySelectorAll(KEYBOARD_NAV.selectors.focusable));
    const currentIndex = focusableItems.indexOf(document.activeElement);
    const itemsPerRow = Math.floor(window.innerWidth / 300); // Approximate items per row
    
    let newIndex;
    
    switch (event.key) {
        case 'ArrowUp':
            newIndex = Math.max(0, currentIndex - itemsPerRow);
            break;
        case 'ArrowDown':
            newIndex = Math.min(focusableItems.length - 1, currentIndex + itemsPerRow);
            break;
        case 'ArrowLeft':
            newIndex = Math.max(0, currentIndex - 1);
            break;
        case 'ArrowRight':
            newIndex = Math.min(focusableItems.length - 1, currentIndex + 1);
            break;
    }
    
    if (newIndex !== undefined && focusableItems[newIndex]) {
        event.preventDefault();
        focusableItems[newIndex].focus();
    }
}

function handleEnterKey(event) {
    const activeElement = document.activeElement;
    
    if (activeElement && activeElement.classList.contains('route-card')) {
        // Trigger card action
        activeElement.click();
    }
}

function handleSpaceKey(event) {
    const activeElement = document.activeElement;
    
    if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.role === 'button')) {
        event.preventDefault();
        activeElement.click();
    }
}

function handleHomeKey(event) {
    const focusableItems = document.querySelectorAll(KEYBOARD_NAV.selectors.focusable);
    const firstItem = focusableItems[0];
    
    if (firstItem) {
        event.preventDefault();
        firstItem.focus();
    }
}

function handleEndKey(event) {
    const focusableItems = document.querySelectorAll(KEYBOARD_NAV.selectors.focusable);
    const lastItem = focusableItems[focusableItems.length - 1];
    
    if (lastItem) {
        event.preventDefault();
        lastItem.focus();
    }
}

function handleEscape(event) {
    // Check if search overlay is open first
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && !searchOverlay.classList.contains('hidden')) {
        searchOverlay.classList.add('hidden');
        return;
    }
    
    // Check for open modals
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
        openModal.classList.add('hidden');
        return;
    }
    
    // Clear focus
    if (document.activeElement) {
        document.activeElement.blur();
    }
}

function handleDeleteKey(event) {
    // Handle delete key for clearing assignments or similar actions
    const activeElement = document.activeElement;
    
    if (activeElement && activeElement.dataset.clearable) {
        event.preventDefault();
        // Clear assignment logic will be handled by specific modules
        console.log('🗑️ Delete key pressed on clearable element');
    }
}

function handleFocusIn(event) {
    KEYBOARD_NAV.currentFocus = event.target;
    KEYBOARD_NAV.isActive = true;
    
    // Add visual indicator
    event.target.classList.add('keyboard-nav-active');
}

function handleFocusOut(event) {
    // Remove visual indicator
    event.target.classList.remove('keyboard-nav-active');
}

// =============================================================================
// SEARCH DIALOG MANAGEMENT
// =============================================================================

function openQuickSearchDialog() {
    // Open the floating search overlay
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay) {
        searchOverlay.classList.remove('hidden');
        
        // Focus on the search input
        setTimeout(() => {
            const searchInput = searchOverlay.querySelector('input[type="text"]');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 100);
    }
}

// =============================================================================
// TOUCH GESTURE INITIALIZATION
// =============================================================================

function initializeTouchGestures() {
    if (!INPUT_METHOD.hasTouch) {
        console.log('👆 Touch not available, skipping gesture initialization');
        return;
    }
    
    // Add touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    
    // Add gesture-specific CSS classes
    document.body.classList.add('touch-gestures-enabled');
    
    console.log('👆 Touch gestures initialized');
}

function handleTouchStart(event) {
    // Basic touch start handling - detailed implementation in touch/gestures module
    if (event.touches.length === 2) {
        event.preventDefault(); // Prevent default zoom
    }
}

function handleTouchMove(event) {
    // Basic touch move handling - detailed implementation in touch/gestures module
    if (event.touches.length === 2) {
        event.preventDefault(); // Prevent default zoom
    }
}

function handleTouchEnd(event) {
    // Basic touch end handling - detailed implementation in touch/gestures module
}

function handleTouchCancel(event) {
    // Basic touch cancel handling - detailed implementation in touch/gestures module
}

// =============================================================================
// EVENT BUS SYSTEM
// =============================================================================

const eventBus = {
    events: new Map(),
    
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName).add(callback);
    },
    
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
        }
    },
    
    emit(eventName, data) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    },
    
    clear() {
        this.events.clear();
    }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

function initializeEvents() {
    console.log('🎯 Initializing event system...');
    
    // Detect input methods
    detectInputMethod();
    
    // Initialize keyboard navigation
    initializeKeyboardNavigation();
    
    // Initialize touch gestures if available
    initializeTouchGestures();
    
    // Listen for window resize to update input method
    window.addEventListener('resize', () => {
        PERFORMANCE.renderTimeouts.inputMethodUpdate = setTimeout(detectInputMethod, 250);
    });
    
    console.log('✅ Event system initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEvents);
} else {
    initializeEvents();
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    INPUT_METHOD,
    KEYBOARD_NAV,
    eventBus,
    detectInputMethod,
    updateInputBasedStyling,
    initializeKeyboardNavigation,
    updateFocusableElements,
    handleGlobalKeydown,
    handleModalKeydown,
    handleArrowNavigation,
    handleEnterKey,
    handleSpaceKey,
    handleHomeKey,
    handleEndKey,
    handleEscape,
    handleDeleteKey,
    handleFocusIn,
    handleFocusOut,
    openQuickSearchDialog,
    initializeTouchGestures,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    initializeEvents
};
