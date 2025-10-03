/* CORE - ERROR HANDLER MODULE
   Transportation Dispatch Dashboard
   Centralized error handling with user notifications
*/

import { Logger } from './logger.js';

/**
 * Standardized error handling utility
 * Provides consistent error logging, user notifications, and error recovery
 */
export class ErrorHandler {
    /**
     * Handle an error with logging and optional user notification
     * @param {Error|string} error - The error to handle
     * @param {Object} options - Configuration options
     * @param {string} options.context - Where the error occurred (e.g., 'Asset Management')
     * @param {boolean} options.showUser - Whether to show error to user (default: true)
     * @param {string} options.userMessage - Custom message for user (optional)
     * @param {boolean} options.fatal - Whether error is fatal (default: false)
     * @param {Function} options.onError - Callback function after handling error
     */
    static handle(error, options = {}) {
        const {
            context = 'Application',
            showUser = true,
            userMessage = null,
            fatal = false,
            onError = null
        } = options;

        // Log the error with full context
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : null;
        
        Logger.error(`[${context}]`, errorMessage);
        if (errorStack) {
            Logger.debug('Stack trace:', errorStack);
        }

        // Show user-friendly message if requested
        if (showUser) {
            const displayMessage = userMessage || this.getUserFriendlyMessage(error, context);
            this.showUserNotification(displayMessage, fatal ? 'error' : 'warning');
        }

        // Execute callback if provided
        if (onError && typeof onError === 'function') {
            try {
                onError(error);
            } catch (callbackError) {
                Logger.error('Error in error handler callback:', callbackError);
            }
        }

        // If fatal, provide recovery options
        if (fatal) {
            this.handleFatalError(error, context);
        }

        // Return error details for further processing
        return {
            error,
            context,
            message: errorMessage,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Convert technical errors to user-friendly messages
     */
    static getUserFriendlyMessage(error, context) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Network errors
        if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
            return `Unable to connect to the server. Please check your internet connection.`;
        }
        
        // Firebase errors
        if (errorMsg.includes('firebase') || errorMsg.includes('firestore')) {
            return `Database connection issue. Your changes may not be saved.`;
        }
        
        // Permission errors
        if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
            return `You don't have permission to perform this action.`;
        }
        
        // Data validation errors
        if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
            return `The data entered is invalid. Please check and try again.`;
        }
        
        // Generic error with context
        return `An error occurred in ${context}. Please try again or contact support if the problem persists.`;
    }

    /**
     * Show notification to user (using modal or toast)
     */
    static showUserNotification(message, type = 'error') {
        // Try to use existing modal system if available
        if (window.showModal && typeof window.showModal === 'function') {
            window.showModal('Error', message);
            return;
        }

        // Fallback to alert for critical errors
        if (type === 'error') {
            alert(`❌ ${message}`);
        } else {
            console.warn('⚠️', message);
        }
    }

    /**
     * Handle fatal errors that prevent app from functioning
     */
    static handleFatalError(error, context) {
        Logger.error('FATAL ERROR:', error);
        
        const message = `A critical error occurred in ${context}.\n\n` +
                       `The application may not function correctly.\n\n` +
                       `Would you like to reload the page?`;
        
        if (confirm(message)) {
            window.location.reload();
        }
    }

    /**
     * Async error wrapper - catches errors in async functions
     * @param {Function} fn - Async function to wrap
     * @param {Object} options - Error handling options
     * @returns {Function} Wrapped function
     */
    static async asyncHandler(fn, options = {}) {
        try {
            return await fn();
        } catch (error) {
            return this.handle(error, options);
        }
    }

    /**
     * Sync error wrapper - catches errors in sync functions
     * @param {Function} fn - Function to wrap
     * @param {Object} options - Error handling options
     * @returns {*} Function result or error details
     */
    static syncHandler(fn, options = {}) {
        try {
            return fn();
        } catch (error) {
            return this.handle(error, options);
        }
    }

    /**
     * Promise rejection handler for unhandled rejections
     */
    static initGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            event.preventDefault(); // Prevent default console error
            this.handle(event.reason, {
                context: 'Unhandled Promise Rejection',
                showUser: false, // Log only, don't spam user
                fatal: false
            });
        });

        // Handle global errors
        window.addEventListener('error', (event) => {
            this.handle(event.error || event.message, {
                context: 'Global Error',
                showUser: false, // Log only
                fatal: false
            });
        });

        Logger.info('Global error handlers initialized');
    }

    /**
     * Validate data and throw descriptive errors
     * @param {*} value - Value to validate
     * @param {Object} rules - Validation rules
     * @throws {Error} If validation fails
     */
    static validate(value, rules = {}) {
        const { required, type, min, max, pattern, custom } = rules;

        if (required && (value === null || value === undefined || value === '')) {
            throw new Error('This field is required');
        }

        if (type && typeof value !== type) {
            throw new Error(`Expected ${type}, got ${typeof value}`);
        }

        if (type === 'string') {
            if (min !== undefined && value.length < min) {
                throw new Error(`Minimum length is ${min} characters`);
            }
            if (max !== undefined && value.length > max) {
                throw new Error(`Maximum length is ${max} characters`);
            }
            if (pattern && !pattern.test(value)) {
                throw new Error('Invalid format');
            }
        }

        if (type === 'number') {
            if (min !== undefined && value < min) {
                throw new Error(`Minimum value is ${min}`);
            }
            if (max !== undefined && value > max) {
                throw new Error(`Maximum value is ${max}`);
            }
        }

        if (custom && typeof custom === 'function') {
            const result = custom(value);
            if (result !== true) {
                throw new Error(result || 'Validation failed');
            }
        }

        return true;
    }
}

// Initialize global error handlers on load
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    
    // Auto-initialize global handlers when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ErrorHandler.initGlobalHandlers();
        });
    } else {
        ErrorHandler.initGlobalHandlers();
    }
}

export default ErrorHandler;
