/**
 * Enhanced logging system for popup
 */
export class PopupLogger {
    constructor(context = 'Popup') {
        this.context = context;
        this.logLevel = 2; // INFO level
    }

    setLogLevel(level) {
        this.logLevel = typeof level === 'string' 
            ? ['error', 'warn', 'info', 'debug'].indexOf(level.toLowerCase())
            : level;
    }

    log(level, message, ...args) {
        const levelNum = typeof level === 'string' 
            ? ['error', 'warn', 'info', 'debug'].indexOf(level.toLowerCase())
            : level;
        
        if (levelNum <= this.logLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${this.context}] `;
            console[['error', 'warn', 'info', 'debug'][levelNum]](prefix + message, ...args);
        }
    }

    error(message, ...args) { this.log(0, message, ...args); }
    warn(message, ...args) { this.log(1, message, ...args); }
    info(message, ...args) { this.log(2, message, ...args); }
    debug(message, ...args) { this.log(3, message, ...args); }
}