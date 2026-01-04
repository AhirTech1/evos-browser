/**
 * EVOS Security Module Index
 * Exports all security components
 */

const { IntentVerifier } = require('./intent-verifier');
const { InjectionDetector } = require('./injection-detector');

// Create singleton instances
const intentVerifier = new IntentVerifier();
const injectionDetector = new InjectionDetector();

module.exports = {
    IntentVerifier,
    InjectionDetector,
    intentVerifier,
    injectionDetector
};
