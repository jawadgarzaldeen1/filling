'use strict';

import { EXTENSION_CONFIG } from './constants.js';

/**
 * Enhanced logging system with configurable levels
 */
export class Logger {
    constructor(context = 'Background') {
        this.context = context;
        this.logLevel = EXTENSION_CONFIG.LOG_LEVELS.INFO;
    }

    setLogLevel(level) {
        this.logLevel = typeof level === 'string' 
            ? EXTENSION_CONFIG.LOG_LEVELS[level.toUpperCase()] 
            : level;
    }

    log(level, message, ...args) {
        const levelNum = typeof level === 'string' 
            ? EXTENSION_CONFIG.LOG_LEVELS[level.toUpperCase()] 
            : level;
        
        if (levelNum <= this.logLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${this.context}]`;
            
            switch (levelNum) {
                case EXTENSION_CONFIG.LOG_LEVELS.ERROR:
                    console.error(prefix, message, ...args);
                    break;
                case EXTENSION_CONFIG.LOG_LEVELS.WARN:
                    console.warn(prefix, message, ...args);
                    break;
                case EXTENSION_CONFIG.LOG_LEVELS.INFO:
                    console.info(prefix, message, ...args);
                    break;
                case EXTENSION_CONFIG.LOG_LEVELS.DEBUG:
                    console.debug(prefix, message, ...args);
                    break;
            }
        }
    }

    error(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.ERROR, message, ...args); }
    warn(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.WARN, message, ...args); }
    info(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.INFO, message, ...args); }
    debug(message, ...args) { this.log(EXTENSION_CONFIG.LOG_LEVELS.DEBUG, message, ...args); }
}