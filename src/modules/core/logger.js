/* CORE - LOGGER MODULE
   Transportation Dispatch Dashboard
   Centralized logging with level control
*/

export class Logger {
    // Set log level: 'debug' | 'info' | 'warn' | 'error' | 'none'
    // In development: 'debug' or 'info'
    // In production: 'warn' or 'error'
    static level = 'info';
    
    static levels = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        none: 4
    };
    
    static shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    
    static setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
            console.log(`🔧 Logger level set to: ${level}`);
        }
    }
    
    static debug(...args) {
        if (this.shouldLog('debug')) {
            console.log('🔍 [DEBUG]', ...args);
        }
    }
    
    static info(...args) {
        if (this.shouldLog('info')) {
            console.log('ℹ️ [INFO]', ...args);
        }
    }
    
    static warn(...args) {
        if (this.shouldLog('warn')) {
            console.warn('⚠️ [WARN]', ...args);
        }
    }
    
    static error(...args) {
        if (this.shouldLog('error')) {
            console.error('❌ [ERROR]', ...args);
        }
    }
    
    // Special categories for module-specific logging
    static module(moduleName, level, ...args) {
        const prefix = `[${moduleName.toUpperCase()}]`;
        
        switch(level) {
            case 'debug':
                this.debug(prefix, ...args);
                break;
            case 'info':
                this.info(prefix, ...args);
                break;
            case 'warn':
                this.warn(prefix, ...args);
                break;
            case 'error':
                this.error(prefix, ...args);
                break;
        }
    }
}

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}

export default Logger;
