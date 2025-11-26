/**
 * Simple logger utility to keep logging consistent across the backend.
 * Falls back to console but adds level tags and timestamps for easier tracing.
 */
function formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    return [`[${level}]`, timestamp, ...args];
}

module.exports = {
    info: (...args) => console.log(...formatMessage('INFO', args)),
    warn: (...args) => console.warn(...formatMessage('WARN', args)),
    error: (...args) => console.error(...formatMessage('ERROR', args)),
    debug: (...args) => console.debug(...formatMessage('DEBUG', args))
};
