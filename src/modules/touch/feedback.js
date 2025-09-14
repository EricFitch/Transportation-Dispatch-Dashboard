/* TOUCH - FEEDBACK MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: Visual feedback systems, haptic feedback, animation controls,
   user interaction feedback, and accessibility enhancements
   Total lines: 320
   Extracted: 2025-09-11_23-56
   Manual enhancement: Built comprehensive feedback system from minimal extraction
*/

// Transportation Dispatch Dashboard Module Dependencies
import { eventBus } from '../core/events.js';
import { STATE, saveToLocalStorage } from '../core/state.js';
import { PERFORMANCE, debounceRender } from '../core/utils.js';

// =============================================================================
// FEEDBACK SYSTEM CONFIGURATION
// =============================================================================

const FEEDBACK_CONFIG = {
    // Visual feedback settings
    visual: {
        enabled: true,
        animationDuration: 200,
        highlightColor: '#3b82f6',
        successColor: '#10b981',
        errorColor: '#ef4444',
        warningColor: '#f59e0b'
    },
    
    // Haptic feedback settings
    haptic: {
        enabled: true,
        patterns: {
            tap: [10],
            success: [100, 50, 100],
            error: [200, 100, 200],
            warning: [50, 25, 50, 25, 50],
            longPress: [50, 10, 50]
        }
    },
    
    // Audio feedback settings
    audio: {
        enabled: false, // Disabled by default for dispatch environment
        volume: 0.3,
        sounds: {
            tap: 'click',
            success: 'success',
            error: 'error',
            warning: 'warning'
        }
    },
    
    // Toast notification settings
    toast: {
        duration: 3000,
        position: 'top-right',
        maxVisible: 3
    },
    
    // Animation settings
    animations: {
        scale: {
            active: 0.95,
            duration: 100
        },
        pulse: {
            duration: 600,
            iterations: 2
        },
        shake: {
            distance: 5,
            duration: 400
        }
    }
};

// Track feedback state
const FEEDBACK_STATE = {
    activeAnimations: new Set(),
    toastQueue: [],
    visibleToasts: [],
    feedbackHistory: [],
    isHapticSupported: 'vibrate' in navigator,
    isAudioSupported: 'Audio' in window
};

// =============================================================================
// FEEDBACK SYSTEM INITIALIZATION
// =============================================================================

function initializeFeedbackSystem() {
    console.log('🎯 Initializing feedback system...');
    
    // Load user preferences
    loadFeedbackPreferences();
    
    // Set up feedback event listeners
    setupFeedbackListeners();
    
    // Initialize CSS animations
    initializeFeedbackStyles();
    
    // Test device capabilities
    testDeviceCapabilities();
    
    console.log('✅ Feedback system initialized');
    eventBus.emit('feedback:initialized', {
        hasHaptic: FEEDBACK_STATE.isHapticSupported,
        hasAudio: FEEDBACK_STATE.isAudioSupported
    });
    
    return true;
}

function setupFeedbackListeners() {
    // Listen for various events that should trigger feedback
    eventBus.on('touch:tap', handleTapFeedback);
    eventBus.on('touch:longpress', handleLongPressFeedback);
    eventBus.on('touch:swipe', handleSwipeFeedback);
    eventBus.on('ui:success', handleSuccessFeedback);
    eventBus.on('ui:error', handleErrorFeedback);
    eventBus.on('ui:warning', handleWarningFeedback);
    eventBus.on('assignments:changed', handleAssignmentFeedback);
    eventBus.on('state:saved', handleSaveFeedback);
    
    // Set up global click feedback
    document.addEventListener('click', handleGlobalClickFeedback, { passive: true });
    document.addEventListener('touchstart', handleGlobalTouchFeedback, { passive: true });
}

function initializeFeedbackStyles() {
    if (!document.getElementById('feedback-styles')) {
        const style = document.createElement('style');
        style.id = 'feedback-styles';
        style.textContent = `
            @keyframes feedbackPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes feedbackShake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            @keyframes feedbackGlow {
                0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.1); }
                100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
            
            @keyframes feedbackSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes feedbackSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .feedback-active {
                animation: feedbackPulse 0.2s ease-in-out;
            }
            
            .feedback-success {
                background-color: rgba(16, 185, 129, 0.1) !important;
                border-color: #10b981 !important;
                animation: feedbackGlow 0.6s ease-in-out;
            }
            
            .feedback-error {
                background-color: rgba(239, 68, 68, 0.1) !important;
                border-color: #ef4444 !important;
                animation: feedbackShake 0.4s ease-in-out;
            }
            
            .feedback-warning {
                background-color: rgba(245, 158, 11, 0.1) !important;
                border-color: #f59e0b !important;
                animation: feedbackPulse 0.3s ease-in-out;
            }
            
            .feedback-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                max-width: 300px;
                animation: feedbackSlideIn 0.3s ease-out;
                pointer-events: auto;
                cursor: pointer;
            }
            
            .feedback-toast.removing {
                animation: feedbackSlideOut 0.3s ease-in;
            }
            
            .feedback-toast.success {
                border-left: 4px solid #10b981;
            }
            
            .feedback-toast.error {
                border-left: 4px solid #ef4444;
            }
            
            .feedback-toast.warning {
                border-left: 4px solid #f59e0b;
            }
            
            .feedback-toast.info {
                border-left: 4px solid #3b82f6;
            }
            
            .feedback-collapse-active {
                background-color: rgba(59, 130, 246, 0.1) !important;
                border-color: #3b82f6 !important;
                transition: all 0.2s ease;
                transform: scale(0.98);
            }
            
            .feedback-disabled {
                opacity: 0.6;
                pointer-events: none;
                filter: grayscale(50%);
            }
            
            .feedback-loading {
                position: relative;
                overflow: hidden;
            }
            
            .feedback-loading::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
                animation: feedbackShimmer 1.5s infinite;
            }
            
            @keyframes feedbackShimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
        `;
        document.head.appendChild(style);
    }
}

function testDeviceCapabilities() {
    // Test haptic feedback
    if (FEEDBACK_STATE.isHapticSupported) {
        try {
            navigator.vibrate(1);
            console.log('✅ Haptic feedback supported');
        } catch (error) {
            FEEDBACK_STATE.isHapticSupported = false;
            console.log('❌ Haptic feedback not supported');
        }
    }
    
    // Test audio support
    if (FEEDBACK_STATE.isAudioSupported) {
        try {
            new Audio();
            console.log('✅ Audio feedback supported');
        } catch (error) {
            FEEDBACK_STATE.isAudioSupported = false;
            console.log('❌ Audio feedback not supported');
        }
    }
}

// =============================================================================
// VISUAL FEEDBACK FUNCTIONS
// =============================================================================

function addVisualFeedback(element, type = 'active', duration = null) {
    if (!element || !FEEDBACK_CONFIG.visual.enabled) return;
    
    const actualDuration = duration || FEEDBACK_CONFIG.visual.animationDuration;
    const className = `feedback-${type}`;
    
    // Remove any existing feedback classes
    element.classList.remove('feedback-active', 'feedback-success', 'feedback-error', 'feedback-warning');
    
    // Add new feedback class
    element.classList.add(className);
    
    // Track active animation
    const animationId = `${element.id || 'element'}-${Date.now()}`;
    FEEDBACK_STATE.activeAnimations.add(animationId);
    
    // Remove class after animation
    setTimeout(() => {
        element.classList.remove(className);
        FEEDBACK_STATE.activeAnimations.delete(animationId);
    }, actualDuration);
    
    return animationId;
}

function addPulseFeedback(element, iterations = 1) {
    if (!element || !FEEDBACK_CONFIG.visual.enabled) return;
    
    const duration = FEEDBACK_CONFIG.animations.pulse.duration;
    element.style.animation = `feedbackPulse ${duration}ms ease-in-out ${iterations}`;
    
    setTimeout(() => {
        element.style.animation = '';
    }, duration * iterations);
}

function addShakeFeedback(element) {
    if (!element || !FEEDBACK_CONFIG.visual.enabled) return;
    
    const duration = FEEDBACK_CONFIG.animations.shake.duration;
    element.style.animation = `feedbackShake ${duration}ms ease-in-out`;
    
    setTimeout(() => {
        element.style.animation = '';
    }, duration);
}

function addGlowFeedback(element, color = null) {
    if (!element || !FEEDBACK_CONFIG.visual.enabled) return;
    
    const glowColor = color || FEEDBACK_CONFIG.visual.highlightColor;
    element.style.animation = `feedbackGlow 0.6s ease-in-out`;
    element.style.setProperty('--glow-color', glowColor);
    
    setTimeout(() => {
        element.style.animation = '';
    }, 600);
}

function addLoadingFeedback(element, enable = true) {
    if (!element) return;
    
    if (enable) {
        element.classList.add('feedback-loading');
        element.style.pointerEvents = 'none';
    } else {
        element.classList.remove('feedback-loading');
        element.style.pointerEvents = '';
    }
}

function addDisabledFeedback(element, disabled = true) {
    if (!element) return;
    
    if (disabled) {
        element.classList.add('feedback-disabled');
    } else {
        element.classList.remove('feedback-disabled');
    }
}

// =============================================================================
// HAPTIC FEEDBACK FUNCTIONS
// =============================================================================

function triggerHapticFeedback(pattern = 'tap', force = false) {
    if (!FEEDBACK_STATE.isHapticSupported || (!FEEDBACK_CONFIG.haptic.enabled && !force)) {
        return false;
    }
    
    try {
        const hapticPattern = FEEDBACK_CONFIG.haptic.patterns[pattern] || FEEDBACK_CONFIG.haptic.patterns.tap;
        navigator.vibrate(hapticPattern);
        
        recordFeedback('haptic', pattern);
        return true;
    } catch (error) {
        console.warn('Haptic feedback failed:', error);
        return false;
    }
}

function triggerCustomHaptic(pattern) {
    if (!FEEDBACK_STATE.isHapticSupported || !FEEDBACK_CONFIG.haptic.enabled) {
        return false;
    }
    
    try {
        navigator.vibrate(pattern);
        recordFeedback('haptic', 'custom', { pattern });
        return true;
    } catch (error) {
        console.warn('Custom haptic feedback failed:', error);
        return false;
    }
}

// =============================================================================
// TOAST NOTIFICATION SYSTEM
// =============================================================================

function showToast(message, type = 'info', duration = null, actions = null) {
    const toast = createToastElement(message, type, duration, actions);
    
    // Add to visible toasts
    FEEDBACK_STATE.visibleToasts.push(toast);
    
    // Remove excess toasts
    while (FEEDBACK_STATE.visibleToasts.length > FEEDBACK_CONFIG.toast.maxVisible) {
        const oldToast = FEEDBACK_STATE.visibleToasts.shift();
        removeToast(oldToast);
    }
    
    // Position toast
    positionToast(toast);
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Auto-remove after duration
    if (duration !== 0) { // 0 means persistent
        setTimeout(() => {
            removeToast(toast);
        }, duration || FEEDBACK_CONFIG.toast.duration);
    }
    
    // Record feedback
    recordFeedback('toast', type, { message });
    
    return toast;
}

function createToastElement(message, type, duration, actions) {
    const toast = document.createElement('div');
    toast.className = `feedback-toast ${type}`;
    
    let actionsHtml = '';
    if (actions && actions.length > 0) {
        actionsHtml = `
            <div class="toast-actions mt-2 flex space-x-2">
                ${actions.map(action => `
                    <button class="toast-action-btn px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                            data-action="${action.id}">
                        ${action.text}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    toast.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <div class="toast-message font-medium text-sm text-gray-800">${message}</div>
                ${actionsHtml}
            </div>
            <button class="toast-close ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
    `;
    
    // Add event listeners
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Handle action buttons
    if (actions) {
        toast.querySelectorAll('.toast-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionId = e.target.dataset.action;
                const action = actions.find(a => a.id === actionId);
                if (action && action.handler) {
                    action.handler();
                }
                removeToast(toast);
            });
        });
    }
    
    // Click to dismiss
    toast.addEventListener('click', (e) => {
        if (!e.target.closest('.toast-action-btn') && !e.target.closest('.toast-close')) {
            removeToast(toast);
        }
    });
    
    return toast;
}

function positionToast(toast) {
    const index = FEEDBACK_STATE.visibleToasts.indexOf(toast);
    const offset = index * 80; // Height + margin
    
    toast.style.top = `${20 + offset}px`;
    toast.style.right = '20px';
}

function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.add('removing');
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        
        // Remove from visible toasts
        const index = FEEDBACK_STATE.visibleToasts.indexOf(toast);
        if (index > -1) {
            FEEDBACK_STATE.visibleToasts.splice(index, 1);
        }
        
        // Reposition remaining toasts
        FEEDBACK_STATE.visibleToasts.forEach((remainingToast, i) => {
            remainingToast.style.top = `${20 + (i * 80)}px`;
        });
    }, 300);
}

function clearAllToasts() {
    FEEDBACK_STATE.visibleToasts.forEach(toast => {
        removeToast(toast);
    });
    FEEDBACK_STATE.visibleToasts = [];
}

// =============================================================================
// EVENT-SPECIFIC FEEDBACK HANDLERS
// =============================================================================

function handleTapFeedback(data) {
    const element = data.target || data.element;
    if (element) {
        addVisualFeedback(element, 'active');
        triggerHapticFeedback('tap');
    }
}

function handleLongPressFeedback(data) {
    const element = data.target || data.element;
    if (element) {
        addGlowFeedback(element);
        triggerHapticFeedback('longPress');
    }
}

function handleSwipeFeedback(data) {
    triggerHapticFeedback('tap');
    
    // Show directional feedback
    const direction = data.direction;
    showToast(`Swiped ${direction}`, 'info', 1000);
}

function handleSuccessFeedback(data) {
    const element = data.element;
    const message = data.message || 'Operation successful';
    
    if (element) {
        addVisualFeedback(element, 'success');
    }
    
    triggerHapticFeedback('success');
    showToast(message, 'success');
}

function handleErrorFeedback(data) {
    const element = data.element;
    const message = data.message || 'Operation failed';
    
    if (element) {
        addVisualFeedback(element, 'error');
        addShakeFeedback(element);
    }
    
    triggerHapticFeedback('error');
    showToast(message, 'error');
}

function handleWarningFeedback(data) {
    const element = data.element;
    const message = data.message || 'Warning';
    
    if (element) {
        addVisualFeedback(element, 'warning');
    }
    
    triggerHapticFeedback('warning');
    showToast(message, 'warning');
}

function handleAssignmentFeedback(data) {
    showToast('Assignment updated', 'success', 2000);
    triggerHapticFeedback('success');
}

function handleSaveFeedback(data) {
    showToast('Data saved', 'info', 1500);
}

function handleGlobalClickFeedback(event) {
    const target = event.target;
    
    // Only add feedback to interactive elements
    if (target.matches('button, .btn, .clickable, [role="button"]')) {
        addVisualFeedback(target, 'active', 150);
    }
}

function handleGlobalTouchFeedback(event) {
    const target = event.target;
    
    // Add touch feedback to touchable elements
    if (target.matches('.route-card, .staff-card, .asset-card, .touchable')) {
        target.style.transform = 'scale(0.98)';
        target.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
            target.style.transform = '';
        }, 100);
    }
}

// =============================================================================
// CARD COLLAPSE FEEDBACK
// =============================================================================

function handleCardCollapseFeedback(element, isCollapsing) {
    if (!element || !FEEDBACK_CONFIG.visual.enabled) return;
    
    // Add visual feedback during collapse/expand
    if (isCollapsing) {
        const collapsibleContent = element.querySelector('.collapsible-content');
        const minimalView = element.querySelector('.minimal-view');
        const btn = element.querySelector('.collapse-btn');
        
        if (collapsibleContent && collapsibleContent.style.display !== 'none') {
            // Add feedback class temporarily
            element.classList.add('feedback-collapse-active');
            
            setTimeout(() => {
                element.classList.remove('feedback-collapse-active');
            }, FEEDBACK_CONFIG.visual.animationDuration);
            
            triggerHapticFeedback('tap');
        }
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function recordFeedback(type, subtype, data = null) {
    const record = {
        type: type,
        subtype: subtype,
        timestamp: Date.now(),
        data: data
    };
    
    FEEDBACK_STATE.feedbackHistory.push(record);
    
    // Keep history manageable
    if (FEEDBACK_STATE.feedbackHistory.length > 100) {
        FEEDBACK_STATE.feedbackHistory.shift();
    }
}

function loadFeedbackPreferences() {
    if (STATE.feedbackPreferences) {
        Object.assign(FEEDBACK_CONFIG.visual, STATE.feedbackPreferences.visual || {});
        Object.assign(FEEDBACK_CONFIG.haptic, STATE.feedbackPreferences.haptic || {});
        Object.assign(FEEDBACK_CONFIG.audio, STATE.feedbackPreferences.audio || {});
    }
}

function saveFeedbackPreferences() {
    STATE.feedbackPreferences = {
        visual: FEEDBACK_CONFIG.visual,
        haptic: FEEDBACK_CONFIG.haptic,
        audio: FEEDBACK_CONFIG.audio
    };
    saveToLocalStorage();
}

function getFeedbackStats() {
    const stats = {
        totalFeedbacks: FEEDBACK_STATE.feedbackHistory.length,
        byType: {},
        recent: FEEDBACK_STATE.feedbackHistory.slice(-10)
    };
    
    FEEDBACK_STATE.feedbackHistory.forEach(record => {
        stats.byType[record.type] = (stats.byType[record.type] || 0) + 1;
    });
    
    return stats;
}

// =============================================================================
// GLOBAL FUNCTIONS
// =============================================================================

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.showToast = showToast;
    window.clearAllToasts = clearAllToasts;
    window.addVisualFeedback = addVisualFeedback;
    window.triggerHapticFeedback = triggerHapticFeedback;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    initializeFeedbackSystem,
    addVisualFeedback,
    addPulseFeedback,
    addShakeFeedback,
    addGlowFeedback,
    addLoadingFeedback,
    addDisabledFeedback,
    triggerHapticFeedback,
    triggerCustomHaptic,
    showToast,
    removeToast,
    clearAllToasts,
    handleCardCollapseFeedback,
    loadFeedbackPreferences,
    saveFeedbackPreferences,
    getFeedbackStats,
    FEEDBACK_CONFIG,
    FEEDBACK_STATE
};
