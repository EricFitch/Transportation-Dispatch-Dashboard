/* CORE - UTILS MODULE
   Transportation Dispatch Dashboard - Auto-extracted from legacy
   
   Functions included: debounceRender, batchUpdate, createVirtualList, PERFORMANCE
   Total lines: 85
   Extracted: 2025-09-11_23-56
   Manual fixes applied: Complete function bodies, removed undefined exports
*/

// Transportation Dispatch Dashboard Module Dependencies
// Core module - minimal dependencies

function debounceRender(functionName, delay = 100) {
    if (PERFORMANCE.renderTimeouts[functionName]) {
        clearTimeout(PERFORMANCE.renderTimeouts[functionName]);
    }
    
    PERFORMANCE.renderTimeouts[functionName] = setTimeout(() => {
        PERFORMANCE.lastRenderTimes[functionName] = Date.now();
        delete PERFORMANCE.renderTimeouts[functionName];
        
        // Execute the actual render function by name
        if (typeof window[functionName] === 'function') {
            window[functionName]();
        }
    }, delay);
}

function batchUpdate(operations) {
    PERFORMANCE.isRendering = true;
    
    try {
        // Execute all operations in a batch
        operations.forEach(operation => {
            if (typeof operation === 'function') {
                operation();
            }
        });
    } finally {
        PERFORMANCE.isRendering = false;
    }
}

function createVirtualList(container, items, renderItem, itemHeight = 50) {
    const containerHeight = container.clientHeight;
    const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    
    let scrollTop = 0;
    const virtualContainer = document.createElement('div');
    virtualContainer.style.height = `${items.length * itemHeight}px`;
    virtualContainer.style.position = 'relative';
    
    function updateVisibleItems() {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
        const endIndex = Math.min(items.length - 1, startIndex + visibleItems);
        
        // Clear existing items
        virtualContainer.innerHTML = '';
        
        // Render visible items
        for (let i = startIndex; i <= endIndex; i++) {
            const item = renderItem(items[i], i);
            item.style.position = 'absolute';
            item.style.top = `${i * itemHeight}px`;
            item.style.height = `${itemHeight}px`;
            virtualContainer.appendChild(item);
        }
    }
    
    container.addEventListener('scroll', () => {
        scrollTop = container.scrollTop;
        debounceRender('updateVisibleItems', 16); // ~60fps
    });
    
    container.appendChild(virtualContainer);
    updateVisibleItems();
    
    return {
        update: updateVisibleItems,
        destroy: () => container.removeChild(virtualContainer)
    };
}

const PERFORMANCE = {
    renderTimeouts: {},
    lastRenderTimes: {},
    renderQueue: new Set(),
    isRendering: false,
    
    // Add performance monitoring methods
    startTiming: function(operation) {
        this.startTimes = this.startTimes || {};
        this.startTimes[operation] = performance.now();
    },
    
    endTiming: function(operation) {
        if (this.startTimes && this.startTimes[operation]) {
            const duration = performance.now() - this.startTimes[operation];
            console.log(`⏱️ ${operation}: ${duration.toFixed(2)}ms`);
            delete this.startTimes[operation];
            return duration;
        }
    }
};

// =============================================================================
// ADDITIONAL UTILITY FUNCTIONS
// =============================================================================

/**
 * Generic debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format time for display
 */
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Handle various time formats
    if (timeString.includes(':')) {
        return timeString;
    }
    
    // Convert minutes to hours:minutes
    const minutes = parseInt(timeString);
    if (!isNaN(minutes)) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}:${mins.toString().padStart(2, '0')}`;
    }
    
    return timeString;
}

/**
 * Create DOM element with attributes
 */
function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Set content
    if (content) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        }
    }
    
    return element;
}

/**
 * Format date for display
 */
function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    
    return d.toLocaleDateString();
}

/**
 * Generate unique ID
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simple Event Bus for module communication
 */
class EventBus {
    constructor() {
        this.events = {};
        this.debug = false;
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        
        if (this.debug) {
            console.log(`👂 EventBus: Listener added for '${event}'`);
        }
    }

    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        
        if (this.debug) {
            console.log(`🔇 EventBus: Listener removed for '${event}'`);
        }
    }

    emit(event, data = null) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ EventBus listener error for '${event}':`, error);
            }
        });
        
        if (this.debug) {
            console.log(`📢 EventBus: '${event}' emitted to ${this.events[event].length} listeners`);
        }
    }

    clear() {
        this.events = {};
        if (this.debug) {
            console.log(`🧹 EventBus: All listeners cleared`);
        }
    }
}

// Create singleton instance
const eventBus = new EventBus();

// Export all functions
export {
    debounceRender,
    batchUpdate,
    createVirtualList,
    PERFORMANCE,
    debounce,
    formatTime,
    createElement,
    formatDate,
    generateId,
    EventBus,
    eventBus
};
