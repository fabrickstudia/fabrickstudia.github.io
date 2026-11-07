// Re-export chat handler so both endpoints use the exact same logic
const chat = require('./chat.js');
exports.handler = chat.handler;
