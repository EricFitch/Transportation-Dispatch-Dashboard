/* TOUCH - GESTURES MODULE
   Transportation Dispatch Dashboard

   High-level orchestration for gesture UX layered atop the TouchController. Manages
   tutorials, contextual menus, swipe affordances, and analytics while delegating
   low-level pointer work to the controller module.
*/

import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { debounceRender } from '../core/utils.js';
import { touchController } from './controller.js';

const TOUCH_GESTURES = {
    hasHaptics: 'vibrate' in navigator,
    hasTouchScreen: typeof window !== 'undefined' && (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia?.('(pointer: coarse)').matches
    ),
    feedbackEnabled: true,
    hapticsEnabled: true,
    visualFeedbackEnabled: true,
    contextMenuElement: null,
    swipeIndicator: null,
    gestureHistory: [],
    maxHistorySize: 15,
    analytics: {
        taps: 0,
        swipes: 0,
        longPresses: 0,
        lastGestureAt: null
    },
    thresholds: touchController.getThresholds()
};

let initialized = false;
const globalListeners = [];
const eventSubscriptions = [];

function subscribe(event, handler) {
    eventBus.on(event, handler);
    eventSubscriptions.push({ event, handler });
}

function registerGlobalListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    globalListeners.push({ target, type, handler, options });
}

function removeGlobalListeners() {
    globalListeners.forEach(({ target, type, handler, options }) => {
        target.removeEventListener(type, handler, options);
    });
    globalListeners.length = 0;
}

function removeEventSubscriptions() {
    eventSubscriptions.forEach(({ event, handler }) => {
        eventBus.off(event, handler);
    });
    eventSubscriptions.length = 0;
}

// =============================================================================
// TOUCH GESTURE INITIALIZATION
// =============================================================================

function initializeTouchGestures(options = {}) {
    if (!TOUCH_GESTURES.hasTouchScreen) {
        console.log('⚠️ No touch screen detected, skipping touch gesture initialization');
        return false;
    }

    if (initialized) {
        return true;
    }

    console.log('👆 Initializing touch gesture system...');

    loadTouchPreferences();
    initializeTouchStyles();

    const mounted = touchController.initialize({
        root: options.root,
        selectors: options.selectors,
        enableMouseGestures: options.enableMouseGestures
    });

    if (!mounted) {
        console.warn('TouchController failed to mount; gestures disabled.');
        return false;
    }

    TOUCH_GESTURES.thresholds = touchController.getThresholds();

    registerEventBusHandlers();
    setupGlobalListeners();

    if (!STATE.touchTutorialShown) {
        setTimeout(() => showGestureTutorial(), 2000);
    }

    initialized = true;

    console.log('✅ Touch gesture system initialized');
    eventBus.emit('touch:initialized', {
        hasHaptics: TOUCH_GESTURES.hasHaptics,
        capabilities: getTouchCapabilities()
    });

    return true;
}

function enableAllGestures(options = {}) {
    TOUCH_GESTURES.feedbackEnabled = true;
    TOUCH_GESTURES.hapticsEnabled = true;
    TOUCH_GESTURES.visualFeedbackEnabled = true;

    if (!initialized) {
        return initializeTouchGestures(options);
    }

    // Refresh thresholds in case viewport or pointer type changed while disabled
    TOUCH_GESTURES.thresholds = touchController.computeAdaptiveThresholds?.() || touchController.getThresholds();
    return true;
}

function teardownTouchGestures() {
    if (!initialized) {
        return;
    }

    removeGlobalListeners();
    removeEventSubscriptions();
    hideContextMenu();
    hideSwipeIndicator();

    touchController.unmount();
    initialized = false;
}

function disableAllGestures() {
    TOUCH_GESTURES.feedbackEnabled = false;
    TOUCH_GESTURES.hapticsEnabled = false;
    TOUCH_GESTURES.visualFeedbackEnabled = false;

    if (initialized) {
        teardownTouchGestures();
    }
}

function registerEventBusHandlers() {
    subscribe('touch:tap', handleTap);
    subscribe('touch:longpress', handleLongPress);
    subscribe('touch:swipeStart', handleSwipeStart);
    subscribe('touch:swipe', handleSwipe);
    subscribe('touch:pointerdown', handlePointerDown);
    subscribe('touch:pointerup', handlePointerUp);
    subscribe('touch:gestureRecorded', recordGesture);
    subscribe('touch:thresholdsUpdated', ({ thresholds }) => {
        TOUCH_GESTURES.thresholds = thresholds;
    });
}

function setupGlobalListeners() {
    const root = document.getElementById('dashboard') || document.body;

    registerGlobalListener(root, 'contextmenu', (event) => {
        if (TOUCH_GESTURES.contextMenuElement) {
            event.preventDefault();
        }
    }, true);

    registerGlobalListener(document, 'click', (event) => {
        if (TOUCH_GESTURES.contextMenuElement &&
            !TOUCH_GESTURES.contextMenuElement.contains(event.target)) {
            hideContextMenu();
        }
    }, true);

    registerGlobalListener(document, 'keyup', (event) => {
        if (event.key === 'Escape') {
            hideContextMenu();
            hideSwipeIndicator();
        }
    });

    registerGlobalListener(window, 'orientationchange', () => {
        setTimeout(() => {
            debounceRender('recalculateTouchAreas');
        }, 300);
    });
}

function initializeTouchStyles() {
    if (document.getElementById('touch-gesture-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'touch-gesture-styles';
    style.textContent = `
        .touch-feedback--active {
            transform: scale(0.97);
            transition: transform 0.12s ease;
        }

        .touch-feedback--tap {
            animation: touchTapPulse 180ms ease-out;
        }

        .touch-feedback--longpress {
            outline: 2px solid rgba(59, 130, 246, 0.45);
            outline-offset: 2px;
            filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.25));
        }

        .touch-swipe-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.92);
            background: rgba(17, 24, 39, 0.92);
            color: white;
            padding: 9px 18px;
            border-radius: 999px;
            font-size: 0.9rem;
            font-weight: 500;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 120ms ease, transform 120ms ease;
        }

        .touch-swipe-indicator.visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        .touch-context-menu {
            position: fixed;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
            z-index: 10001;
            min-width: 170px;
            overflow: hidden;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 120ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .touch-context-menu.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .touch-context-menu .menu-item {
            display: block;
            width: 100%;
            padding: 12px 16px;
            background: none;
            border: none;
            text-align: left;
            cursor: pointer;
            font-size: 0.9rem;
            color: #1f2937;
            transition: background 120ms ease;
        }

        .touch-context-menu .menu-item:hover,
        .touch-context-menu .menu-item:focus-visible {
            background-color: #f3f4f6;
        }

        .gesture-tutorial {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.78);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            padding: 24px;
        }

        .gesture-tutorial .tutorial-content {
            background: rgba(31, 41, 55, 0.88);
            backdrop-filter: blur(6px);
            padding: 32px;
            border-radius: 18px;
            max-width: 420px;
            width: 100%;
        }

        @keyframes touchTapPulse {
            0% { transform: scale(0.96); }
            60% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
    `;

    document.head.appendChild(style);
}

// =============================================================================
// TOUCH EVENT HANDLERS
// =============================================================================

function handleTouchStart() {
    if (!handleTouchStart.warned) {
        console.warn('handleTouchStart is managed by TouchController. Direct calls are no longer required.');
        handleTouchStart.warned = true;
    }
}

function handleTouchMove() {
    if (!handleTouchMove.warned) {
        console.warn('handleTouchMove is managed by TouchController.');
        handleTouchMove.warned = true;
    }
}

function handleTouchEnd() {
    if (!handleTouchEnd.warned) {
        console.warn('handleTouchEnd is managed by TouchController.');
        handleTouchEnd.warned = true;
    }
}

function handleTouchCancel() {
    if (!handleTouchCancel.warned) {
        console.warn('handleTouchCancel is managed by TouchController.');
        handleTouchCancel.warned = true;
    }
}

function handlePointerDown() {
    hideContextMenu();
}

function handlePointerUp() {
    hideSwipeIndicator();
}

function handleTap({ target }) {
    if (!target) {
        return;
    }

    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        try {
            navigator.vibrate?.(10);
        } catch (error) {
            // Ignore devices that disallow vibration.
        }
    }

    if (TOUCH_GESTURES.visualFeedbackEnabled) {
        target.classList.add('touch-feedback--tap');
        setTimeout(() => target.classList.remove('touch-feedback--tap'), 200);
    }

    TOUCH_GESTURES.analytics.taps += 1;
    TOUCH_GESTURES.analytics.lastGestureAt = Date.now();

    eventBus.emit('touch:tap:processed', { target });
}

function handleLongPress({ pointer, target }) {
    if (!target) {
        return;
    }

    if (TOUCH_GESTURES.visualFeedbackEnabled) {
        addLongPressFeedback(target);
    }

    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        try {
            navigator.vibrate?.([40, 20, 40]);
        } catch (error) {
            // Ignore vibration errors.
        }
    }

    const x = pointer?.lastX ?? pointer?.startX ?? target.getBoundingClientRect().left;
    const y = pointer?.lastY ?? pointer?.startY ?? target.getBoundingClientRect().top;

    showContextMenu({ clientX: x, clientY: y }, target);

    TOUCH_GESTURES.analytics.longPresses += 1;
    TOUCH_GESTURES.analytics.lastGestureAt = Date.now();
}

function handleSwipeStart({ direction }) {
    if (!TOUCH_GESTURES.visualFeedbackEnabled) {
        return;
    }

    addSwipeIndicator(direction);

    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        try {
            navigator.vibrate?.(12);
        } catch (error) {
            // Ignore.
        }
    }
}

function handleSwipe({ target, direction }) {
    if (!target || !direction) {
        return;
    }

    switch (direction) {
        case 'left':
            handleSwipeLeft(target);
            break;
        case 'right':
            handleSwipeRight(target);
            break;
        case 'up':
            handleSwipeUp(target);
            break;
        case 'down':
            handleSwipeDown(target);
            break;
    }

    showSwipeNotification(direction);

    TOUCH_GESTURES.analytics.swipes += 1;
    TOUCH_GESTURES.analytics.lastGestureAt = Date.now();
}

// =============================================================================
// GESTURE HANDLERS
// =============================================================================

function showSwipeNotification(direction) {
    if (!TOUCH_GESTURES.visualFeedbackEnabled) {
        return;
    }

    const messageMap = {
        left: 'Swipe left',
        right: 'Swipe right',
        up: 'Swipe up',
        down: 'Swipe down'
    };

    const indicator = document.createElement('div');
    indicator.className = 'touch-swipe-indicator visible';
    indicator.textContent = messageMap[direction] || 'Swipe';

    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.classList.remove('visible');
        setTimeout(() => indicator.remove(), 160);
    }, 900);
}

function handleSwipeLeft(target) {
    // Navigate to next panel, tab, or collapse current panel
    if (target.closest('.panel')) {
        const panel = target.closest('.panel');
        const panelId = panel.id;
        
        if (panelId === 'routes-panel') {
            eventBus.emit('ui:switchPanel', { target: 'staff-panel' });
            showSwipeNotification('→ Staff Panel');
        } else if (panelId === 'staff-panel') {
            eventBus.emit('ui:switchPanel', { target: 'asset-panel' });
            showSwipeNotification('→ Asset Panel');
        }
    } else if (target.closest('.route-card, .staff-card, .asset-card')) {
        // Quick assign or status change
        eventBus.emit('touch:quickAction', { 
            target: target, 
            action: 'assign',
            direction: 'left'
        });
        showSwipeNotification('Quick Assign');
    }
}

function handleSwipeRight(target) {
    // Navigate to previous panel, tab, or expand current panel
    if (target.closest('.panel')) {
        const panel = target.closest('.panel');
        const panelId = panel.id;
        
        if (panelId === 'asset-panel') {
            eventBus.emit('ui:switchPanel', { target: 'staff-panel' });
            showSwipeNotification('← Staff Panel');
        } else if (panelId === 'staff-panel') {
            eventBus.emit('ui:switchPanel', { target: 'routes-panel' });
            showSwipeNotification('← Routes Panel');
        }
    } else if (target.closest('.route-card, .staff-card, .asset-card')) {
        // Quick unassign or status change
        eventBus.emit('touch:quickAction', { 
            target: target, 
            action: 'unassign',
            direction: 'right'
        });
        showSwipeNotification('Quick Unassign');
    }
}

function handleSwipeUp(target) {
    // Scroll up within panel or minimize panel
    if (target.closest('.panel')) {
        const panel = target.closest('.panel');
        panel.scrollTop = Math.max(0, panel.scrollTop - 200);
        showSwipeNotification('↑ Scroll Up');
    } else if (target.closest('.route-card, .staff-card, .asset-card')) {
        // Mark as priority or urgent
        eventBus.emit('touch:quickAction', { 
            target: target, 
            action: 'priority',
            direction: 'up'
        });
        showSwipeNotification('⭐ Mark Priority');
    }
}

function handleSwipeDown(target) {
    // Scroll down within panel or expand panel
    if (target.closest('.panel')) {
        const panel = target.closest('.panel');
        panel.scrollTop = panel.scrollTop + 200;
        showSwipeNotification('↓ Scroll Down');
    } else if (target.closest('.route-card, .staff-card, .asset-card')) {
        // Mark as complete or normal
        eventBus.emit('touch:quickAction', { 
            target: target, 
            action: 'complete',
            direction: 'down'
        });
        showSwipeNotification('✅ Mark Complete');
    }
}

// =============================================================================
// CONTEXT MENU SYSTEM
// =============================================================================

function showContextMenu(position, target) {
    hideContextMenu();
    const menu = createContextMenu(target);
    if (!menu) {
        return;
    }

    const coordinates = resolveCoordinates(position, target);
    positionContextMenu(menu, coordinates.x, coordinates.y);

    TOUCH_GESTURES.contextMenuElement = menu;
    document.body.appendChild(menu);

    requestAnimationFrame(() => {
        menu.classList.add('visible');
    });
}

function createContextMenu(target) {
    const menu = document.createElement('div');
    menu.className = 'touch-context-menu';

    let menuItems = [];
    
    // Determine menu items based on target
    if (target.closest('.route-card')) {
        menuItems = [
            { text: '👤 Assign Driver', action: 'assignDriver' },
            { text: '🚛 Assign Vehicle', action: 'assignVehicle' },
            { text: '📝 Add Note', action: 'addNote' },
            { text: '⭐ Mark Priority', action: 'markPriority' },
            { text: '📄 Export', action: 'export' }
        ];
    } else if (target.closest('.staff-card')) {
        menuItems = [
            { text: '🚌 Assign Route', action: 'assignRoute' },
            { text: '⏰ Set Schedule', action: 'setSchedule' },
            { text: '📞 Contact', action: 'contact' },
            { text: '❌ Mark Out', action: 'markOut' },
            { text: '📄 Export', action: 'export' }
        ];
    } else if (target.closest('.asset-card')) {
        menuItems = [
            { text: '🚌 Assign to Route', action: 'assignToRoute' },
            { text: '🔧 Mark for Maintenance', action: 'markMaintenance' },
            { text: '📋 View Details', action: 'viewDetails' },
            { text: '📊 View History', action: 'viewHistory' },
            { text: '📄 Export', action: 'export' }
        ];
    } else {
        // Generic menu for other elements
        menuItems = [
            { text: '📄 Export View', action: 'exportView' },
            { text: '🔄 Refresh', action: 'refresh' },
            { text: '⚙️ Settings', action: 'settings' }
        ];
    }
    
    menuItems.forEach(item => {
        const button = document.createElement('button');
        button.className = 'menu-item';
        button.type = 'button';
        button.textContent = item.text;
        button.addEventListener('click', () => {
            handleContextMenuAction(item.action, target);
            hideContextMenu();
        });
        menu.appendChild(button);
    });

    return menu;
}

function positionContextMenu(menu, x, y) {
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    // Adjust horizontal position
    if (left + rect.width > viewportWidth) {
        left = viewportWidth - rect.width - 10;
    }
    if (left < 10) {
        left = 10;
    }
    
    // Adjust vertical position
    if (top + rect.height > viewportHeight) {
        top = y - rect.height;
    }
    if (top < 10) {
        top = 10;
    }
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function hideContextMenu() {
    if (TOUCH_GESTURES.contextMenuElement) {
        const menu = TOUCH_GESTURES.contextMenuElement;
        menu.classList.remove('visible');

        setTimeout(() => {
            menu.remove();
            if (TOUCH_GESTURES.contextMenuElement === menu) {
                TOUCH_GESTURES.contextMenuElement = null;
            }
        }, 160);
    }
}

function handleContextMenuAction(action, target) {
    console.log(`🎯 Context menu action: ${action} on`, target.className);
    
    // Emit context menu action event
    eventBus.emit('touch:contextMenuAction', {
        action: action,
        target: target,
        element: target
    });
    
    // Handle specific actions
    switch (action) {
        case 'exportView':
            exportCurrentView();
            break;
        case 'refresh':
            eventBus.emit('ui:refresh');
            break;
        case 'settings':
            eventBus.emit('ui:showSettings');
            break;
        default:
            // Let other modules handle specific actions
            break;
    }
}

// =============================================================================
// VISUAL FEEDBACK FUNCTIONS
// =============================================================================

function addTouchFeedback(element) {
    if (!element) return;
    element.classList.add('touch-feedback--active');
}

function removeTouchFeedback(element = null) {
    if (element) {
        element.classList.remove('touch-feedback--active', 'touch-feedback--tap', 'touch-feedback--longpress');
        return;
    }

    document.querySelectorAll('.touch-feedback--active, .touch-feedback--tap, .touch-feedback--longpress')
        .forEach(node => node.classList.remove('touch-feedback--active', 'touch-feedback--tap', 'touch-feedback--longpress'));
}

function addLongPressFeedback(element) {
    if (!element) return;
    element.classList.add('touch-feedback--longpress');
}

function addSwipeIndicator(direction) {
    hideSwipeIndicator();
    const indicator = document.createElement('div');
    indicator.id = 'touch-swipe-indicator';
    indicator.className = 'touch-swipe-indicator visible';
    indicator.innerHTML = `${getSwipeIcon(direction)} Swipe ${direction}`;
    document.body.appendChild(indicator);
    TOUCH_GESTURES.swipeIndicator = indicator;
}

function hideSwipeIndicator() {
    const indicator = TOUCH_GESTURES.swipeIndicator || document.getElementById('touch-swipe-indicator');
    if (!indicator) return;

    indicator.classList.remove('visible');
    setTimeout(() => {
        indicator.remove();
    }, 160);
    TOUCH_GESTURES.swipeIndicator = null;
}

function getSwipeIcon(direction) {
    const icons = { left: '←', right: '→', up: '↑', down: '↓' };
    return icons[direction] || '↔';
}

// =============================================================================
// TUTORIAL AND HELP SYSTEM
// =============================================================================

function showGestureTutorial() {
    const tutorial = document.createElement('div');
    tutorial.className = 'gesture-tutorial';
    tutorial.innerHTML = `
        <div class="tutorial-content">
            <h2 style="margin-bottom: 24px;">👆 Touch Gestures</h2>
            <div style="text-align: left; margin-bottom: 20px;">
                <p><strong>Tap:</strong> Select items and buttons</p>
                <p><strong>Long Press:</strong> Open context menu</p>
                <p><strong>Swipe Left/Right:</strong> Navigate panels</p>
                <p><strong>Swipe Up/Down:</strong> Scroll or quick actions</p>
            </div>
            <button id="close-tutorial" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer;">
                Got it!
            </button>
        </div>
    `;
    
    document.body.appendChild(tutorial);
    
    document.getElementById('close-tutorial').addEventListener('click', () => {
        tutorial.style.opacity = '0';
        setTimeout(() => {
            if (tutorial.parentNode) {
                tutorial.parentNode.removeChild(tutorial);
            }
        }, 300);
        
        // Mark tutorial as shown
        STATE.touchTutorialShown = true;
        saveToLocalStorage();
    });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getTouchDistance(pointA, pointB) {
    if (!pointA || !pointB) return 0;
    const dx = (pointB.clientX ?? pointB.x) - (pointA.clientX ?? pointA.x);
    const dy = (pointB.clientY ?? pointB.y) - (pointA.clientY ?? pointA.y);
    return Math.sqrt((dx * dx) + (dy * dy));
}

function resolveCoordinates(position, fallbackTarget) {
    if (position && typeof position.clientX === 'number' && typeof position.clientY === 'number') {
        return { x: position.clientX, y: position.clientY };
    }

    if (fallbackTarget) {
        const rect = fallbackTarget.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function getTouchCapabilities() {
    return {
        hasTouch: TOUCH_GESTURES.hasTouchScreen,
        hasHaptics: TOUCH_GESTURES.hasHaptics,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        supportsPointerEvents: 'PointerEvent' in window,
        thresholds: touchController.getThresholds()
    };
}

function loadTouchPreferences() {
    if (!STATE.touchPreferences) return;

    TOUCH_GESTURES.feedbackEnabled = STATE.touchPreferences.feedbackEnabled !== false;
    TOUCH_GESTURES.hapticsEnabled = STATE.touchPreferences.hapticsEnabled !== false;
    TOUCH_GESTURES.visualFeedbackEnabled = STATE.touchPreferences.visualFeedbackEnabled !== false;
}

function resetGestureState() {
    hideContextMenu();
    hideSwipeIndicator();
    removeTouchFeedback();
}

function recordGesture(gestureData) {
    TOUCH_GESTURES.gestureHistory.push(gestureData);
    if (TOUCH_GESTURES.gestureHistory.length > TOUCH_GESTURES.maxHistorySize) {
        TOUCH_GESTURES.gestureHistory.shift();
    }
}

function exportCurrentView() {
    console.log('📄 Exporting current view...');
    
    try {
        const viewData = {
            timestamp: new Date().toISOString(),
            panels: {
                routes: document.getElementById('routes-panel')?.innerHTML || '',
                staff: document.getElementById('staff-panel')?.innerHTML || '',
                assets: document.getElementById('asset-panel')?.innerHTML || ''
            },
            state: {
                assignments: STATE.assignments,
                assetStatus: STATE.assetStatus,
                staffStatus: STATE.staffStatus
            },
            gestures: TOUCH_GESTURES.gestureHistory
        };
        
        // Create download link
        const blob = new Blob([JSON.stringify(viewData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dispatch-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        eventBus.emit('touch:exported', { success: true });
        console.log('✅ View exported successfully');
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        eventBus.emit('touch:exported', { success: false, error });
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Listen for state changes
eventBus.on('state:dataUpdated', () => {
    loadTouchPreferences();
});

// Listen for UI changes that might affect touch areas
eventBus.on('ui:panelChanged', () => {
    debounceRender('recalculateTouchAreas');
});

// =============================================================================
// EXPORTS
// =============================================================================

export {
    initializeTouchGestures,
    enableAllGestures,
    teardownTouchGestures,
    disableAllGestures,
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
    TOUCH_GESTURES,
    touchController
};
