/* TOUCH - GESTURES MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Touch gesture recognition, swipe handling, long press detection,
   haptic feedback, context menus, and mobile optimization
   Total lines: 450
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive touch system from fragmented extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { PERFORMANCE, debounceRender } from '../core/utils.js';

// =============================================================================
// TOUCH GESTURE CONFIGURATION
// =============================================================================

const TOUCH_GESTURES = {
    // Touch state management
    activeElement: null,
    startTouch: null,
    currentTouch: null,
    gestureType: null,
    swipeDirection: null,
    longPressTimer: null,
    contextMenuElement: null,
    
    // Touch thresholds and timing
    swipeThreshold: 50,        // Minimum pixels for swipe
    maxTapTime: 200,           // Maximum time for tap (ms)
    longPressTime: 500,        // Time for long press (ms)
    maxTapDistance: 15,        // Maximum movement for tap
    
    // Gesture sensitivity
    swipeVelocityThreshold: 0.5,
    pinchThreshold: 10,
    
    // Device capabilities
    hasHaptics: 'vibrate' in navigator,
    hasTouchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    
    // Touch feedback settings
    feedbackEnabled: true,
    hapticsEnabled: true,
    visualFeedbackEnabled: true,
    
    // Gesture history for analysis
    gestureHistory: [],
    maxHistorySize: 10
};

// =============================================================================
// TOUCH GESTURE INITIALIZATION
// =============================================================================

function initializeTouchGestures() {
    console.log('👆 Initializing touch gesture system...');
    
    if (!TOUCH_GESTURES.hasTouchScreen) {
        console.log('⚠️ No touch screen detected, skipping touch gesture initialization');
        return false;
    }
    
    // Load touch preferences from state
    loadTouchPreferences();
    
    // Set up touch event listeners
    setupTouchEventListeners();
    
    // Initialize touch CSS classes
    initializeTouchStyles();
    
    // Set up gesture tutorial if first time
    if (!STATE.touchTutorialShown) {
        setTimeout(() => showGestureTutorial(), 2000);
    }
    
    console.log('✅ Touch gesture system initialized');
    eventBus.emit('touch:initialized', {
        hasHaptics: TOUCH_GESTURES.hasHaptics,
        capabilities: getTouchCapabilities()
    });
    
    return true;
}

function setupTouchEventListeners() {
    const dashboard = document.getElementById('dashboard') || document.body;
    
    // Primary touch events
    dashboard.addEventListener('touchstart', handleTouchStart, { passive: false });
    dashboard.addEventListener('touchmove', handleTouchMove, { passive: false });
    dashboard.addEventListener('touchend', handleTouchEnd, { passive: false });
    dashboard.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    
    // Prevent default behaviors that interfere with gestures
    dashboard.addEventListener('contextmenu', (e) => {
        if (TOUCH_GESTURES.contextMenuElement) {
            e.preventDefault();
        }
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            debounceRender('recalculateTouchAreas');
        }, 300);
    });
    
    // Clean up context menus on outside tap
    document.addEventListener('click', (e) => {
        if (TOUCH_GESTURES.contextMenuElement && 
            !TOUCH_GESTURES.contextMenuElement.contains(e.target)) {
            hideContextMenu();
        }
    });
}

function initializeTouchStyles() {
    // Inject touch-specific CSS if not already present
    if (!document.getElementById('touch-gesture-styles')) {
        const style = document.createElement('style');
        style.id = 'touch-gesture-styles';
        style.textContent = `
            .touch-active {
                transform: scale(0.98);
                transition: transform 0.1s ease;
            }
            
            .long-press-active {
                background-color: rgba(59, 130, 246, 0.1) !important;
                border-color: #3b82f6 !important;
                transition: all 0.2s ease;
            }
            
            .swipe-indicator {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            
            .swipe-indicator.visible {
                opacity: 1;
            }
            
            .touch-context-menu {
                position: fixed;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                z-index: 10001;
                min-width: 150px;
                overflow: hidden;
            }
            
            .touch-context-menu .menu-item {
                display: block;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: none;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
                color: #374151;
                border-bottom: 1px solid #f3f4f6;
            }
            
            .touch-context-menu .menu-item:hover {
                background-color: #f9fafb;
            }
            
            .touch-context-menu .menu-item:last-child {
                border-bottom: none;
            }
            
            .gesture-tutorial {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10002;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                text-align: center;
            }
            
            .tutorial-content {
                background: #1f2937;
                padding: 32px;
                border-radius: 12px;
                max-width: 400px;
                margin: 20px;
            }
        `;
        document.head.appendChild(style);
    }
}

// =============================================================================
// TOUCH EVENT HANDLERS
// =============================================================================

function handleTouchStart(event) {
    const touch = event.touches[0];
    const target = event.target.closest('[data-touchable], .route-card, .staff-card, .asset-card, .panel, button');
    
    if (!target) return;
    
    // Store touch start information
    TOUCH_GESTURES.startTouch = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
        target: target
    };
    
    TOUCH_GESTURES.currentTouch = { ...TOUCH_GESTURES.startTouch };
    TOUCH_GESTURES.activeElement = target;
    TOUCH_GESTURES.gestureType = null;
    TOUCH_GESTURES.swipeDirection = null;
    
    // Add visual feedback
    if (TOUCH_GESTURES.visualFeedbackEnabled) {
        addTouchFeedback(target);
    }
    
    // Start long press timer
    startLongPressTimer(touch, target);
    
    // Prevent scrolling on certain elements
    if (target.closest('.route-card, .staff-card, .asset-card')) {
        event.preventDefault();
    }
}

function handleTouchMove(event) {
    if (!TOUCH_GESTURES.startTouch || !TOUCH_GESTURES.activeElement) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - TOUCH_GESTURES.startTouch.x;
    const deltaY = touch.clientY - TOUCH_GESTURES.startTouch.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Update current touch position
    TOUCH_GESTURES.currentTouch = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
        target: TOUCH_GESTURES.startTouch.target
    };
    
    // Cancel long press if moved too much
    if (distance > TOUCH_GESTURES.maxTapDistance) {
        clearLongPressTimer();
        removeTouchFeedback();
    }
    
    // Detect swipe gesture
    if (distance > TOUCH_GESTURES.swipeThreshold && !TOUCH_GESTURES.gestureType) {
        TOUCH_GESTURES.gestureType = 'swipe';
        
        // Determine swipe direction
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > absY) {
            TOUCH_GESTURES.swipeDirection = deltaX > 0 ? 'right' : 'left';
        } else {
            TOUCH_GESTURES.swipeDirection = deltaY > 0 ? 'down' : 'up';
        }
        
        // Show swipe indicator
        if (TOUCH_GESTURES.visualFeedbackEnabled) {
            addSwipeIndicator(TOUCH_GESTURES.swipeDirection);
        }
        
        // Haptic feedback for swipe start
        if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
            navigator.vibrate(10);
        }
    }
}

function handleTouchEnd(event) {
    if (!TOUCH_GESTURES.startTouch || !TOUCH_GESTURES.activeElement) return;
    
    const duration = Date.now() - TOUCH_GESTURES.startTouch.timestamp;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - TOUCH_GESTURES.startTouch.x;
    const deltaY = touch.clientY - TOUCH_GESTURES.startTouch.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Clean up timers and feedback
    clearLongPressTimer();
    removeTouchFeedback();
    hideSwipeIndicator();
    
    // Determine gesture type and handle accordingly
    if (duration < TOUCH_GESTURES.maxTapTime && distance < TOUCH_GESTURES.maxTapDistance) {
        // TAP gesture
        handleTap(TOUCH_GESTURES.activeElement);
        
    } else if (TOUCH_GESTURES.gestureType === 'swipe') {
        // SWIPE gesture
        completeSwipeGesture();
        
    } else if (duration >= TOUCH_GESTURES.longPressTime && distance < TOUCH_GESTURES.maxTapDistance) {
        // LONG PRESS gesture (already handled in timer)
        console.log('👆 Long press completed');
    }
    
    // Record gesture in history
    recordGesture({
        type: TOUCH_GESTURES.gestureType || 'tap',
        direction: TOUCH_GESTURES.swipeDirection,
        duration: duration,
        distance: distance,
        target: TOUCH_GESTURES.activeElement.className,
        timestamp: Date.now()
    });
    
    // Reset gesture state
    resetGestureState();
}

function handleTouchCancel(event) {
    console.log('👆 Touch cancelled');
    clearLongPressTimer();
    removeTouchFeedback();
    hideSwipeIndicator();
    resetGestureState();
}

// =============================================================================
// GESTURE HANDLERS
// =============================================================================

function handleTap(target) {
    console.log('👆 Tap detected on:', target.className);
    
    // Haptic feedback for tap
    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        navigator.vibrate(10);
    }
    
    // Add tap animation
    if (TOUCH_GESTURES.visualFeedbackEnabled) {
        target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            target.style.transform = '';
        }, 100);
    }
    
    // Emit tap event for other modules to handle
    eventBus.emit('touch:tap', {
        target: target,
        element: target,
        type: 'tap'
    });
}

function startLongPressTimer(touch, target) {
    TOUCH_GESTURES.longPressTimer = setTimeout(() => {
        if (TOUCH_GESTURES.activeElement === target) {
            handleLongPress(touch, target);
        }
    }, TOUCH_GESTURES.longPressTime);
}

function clearLongPressTimer() {
    if (TOUCH_GESTURES.longPressTimer) {
        clearTimeout(TOUCH_GESTURES.longPressTimer);
        TOUCH_GESTURES.longPressTimer = null;
    }
}

function handleLongPress(touch, target) {
    console.log('👆 Long press detected on:', target.className);
    
    TOUCH_GESTURES.gestureType = 'longpress';
    
    // Haptic feedback for long press
    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        navigator.vibrate([50, 10, 50]); // Pattern vibration
    }
    
    // Add long press visual feedback
    if (TOUCH_GESTURES.visualFeedbackEnabled) {
        addLongPressFeedback(target);
    }
    
    // Show context menu
    showContextMenu(touch, target);
    
    // Emit long press event
    eventBus.emit('touch:longpress', {
        target: target,
        element: target,
        type: 'longpress',
        x: touch.clientX,
        y: touch.clientY
    });
}

function completeSwipeGesture() {
    const target = TOUCH_GESTURES.activeElement;
    const direction = TOUCH_GESTURES.swipeDirection;
    
    console.log(`👆 Swipe ${direction} detected on:`, target.className);
    
    // Haptic feedback for swipe completion
    if (TOUCH_GESTURES.hapticsEnabled && TOUCH_GESTURES.hasHaptics) {
        navigator.vibrate(20);
    }
    
    // Handle direction-specific actions
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
    
    // Emit swipe event
    eventBus.emit('touch:swipe', {
        target: target,
        direction: direction,
        element: target,
        type: 'swipe'
    });
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

function showContextMenu(touch, target) {
    // Hide existing context menu
    hideContextMenu();
    
    // Create context menu based on target type
    const menu = createContextMenu(target);
    if (!menu) return;
    
    // Position menu
    positionContextMenu(menu, touch.clientX, touch.clientY);
    
    // Store reference
    TOUCH_GESTURES.contextMenuElement = menu;
    
    // Add to DOM with animation
    document.body.appendChild(menu);
    requestAnimationFrame(() => {
        menu.style.opacity = '1';
        menu.style.transform = 'scale(1)';
    });
}

function createContextMenu(target) {
    const menu = document.createElement('div');
    menu.className = 'touch-context-menu';
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.8)';
    menu.style.transition = 'all 0.2s ease';
    
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
    
    // Create menu items
    menuItems.forEach(item => {
        const button = document.createElement('button');
        button.className = 'menu-item';
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
    // Calculate position to keep menu on screen
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
        TOUCH_GESTURES.contextMenuElement.style.transition = 'all 0.2s ease';
        TOUCH_GESTURES.contextMenuElement.style.opacity = '0';
        TOUCH_GESTURES.contextMenuElement.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            if (TOUCH_GESTURES.contextMenuElement) {
                document.body.removeChild(TOUCH_GESTURES.contextMenuElement);
                TOUCH_GESTURES.contextMenuElement = null;
            }
        }, 200);
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
    element.classList.add('touch-active');
    element.style.transform = 'scale(0.98)';
    element.style.transition = 'transform 0.1s ease';
}

function removeTouchFeedback() {
    document.querySelectorAll('.touch-active').forEach(element => {
        element.classList.remove('touch-active');
        element.style.transform = '';
        element.style.transition = '';
    });
}

function addLongPressFeedback(element) {
    element.classList.add('long-press-active');
    element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    element.style.borderColor = '#3b82f6';
    element.style.transition = 'all 0.2s ease';
}

function addSwipeIndicator(direction) {
    hideSwipeIndicator(); // Remove any existing indicator
    
    const indicator = document.createElement('div');
    indicator.className = 'swipe-indicator';
    indicator.id = 'touch-swipe-indicator';
    indicator.innerHTML = `${getSwipeIcon(direction)} Swipe ${direction}`;
    
    document.body.appendChild(indicator);
    
    requestAnimationFrame(() => {
        indicator.classList.add('visible');
    });
}

function hideSwipeIndicator() {
    const indicator = document.getElementById('touch-swipe-indicator');
    if (indicator) {
        indicator.classList.remove('visible');
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 200);
    }
}

function getSwipeIcon(direction) {
    const icons = {
        left: '←',
        right: '→',
        up: '↑',
        down: '↓'
    };
    return icons[direction] || '↔';
}

function showSwipeNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = 'swipe-indicator';
    notification.textContent = message;
    notification.style.top = '20%';
    
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.classList.add('visible');
    });
    
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 200);
    }, 1500);
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

function getTouchDistance(touch1, touch2) {
    const deltaX = touch2.clientX - touch1.clientX;
    const deltaY = touch2.clientY - touch1.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getTouchCapabilities() {
    return {
        hasTouch: TOUCH_GESTURES.hasTouchScreen,
        hasHaptics: TOUCH_GESTURES.hasHaptics,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        supportsPointerEvents: 'PointerEvent' in window
    };
}

function loadTouchPreferences() {
    if (STATE.touchPreferences) {
        TOUCH_GESTURES.feedbackEnabled = STATE.touchPreferences.feedbackEnabled !== false;
        TOUCH_GESTURES.hapticsEnabled = STATE.touchPreferences.hapticsEnabled !== false;
        TOUCH_GESTURES.visualFeedbackEnabled = STATE.touchPreferences.visualFeedbackEnabled !== false;
    }
}

function resetGestureState() {
    TOUCH_GESTURES.activeElement = null;
    TOUCH_GESTURES.startTouch = null;
    TOUCH_GESTURES.currentTouch = null;
    TOUCH_GESTURES.gestureType = null;
    TOUCH_GESTURES.swipeDirection = null;
}

function recordGesture(gestureData) {
    TOUCH_GESTURES.gestureHistory.push(gestureData);
    
    // Keep history size manageable
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
