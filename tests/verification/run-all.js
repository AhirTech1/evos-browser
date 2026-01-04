/**
 * Master Verification Runner
 * Runs all EVOS system verification tests
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 INITIALIZING EVOS SYSTEM VERIFICATION...\n');

const tests = [
    { name: 'Security Protocol', script: 'verify-security.js' },
    { name: 'Unified Perception', script: 'verify-perception.js' },
    { name: 'State & Memory', script: 'verify-state.js' }
];

let totalPassed = 0;
let totalFailed = 0;

for (const test of tests) {
    console.log(`\n==================================================`);
    console.log(`RUNNING: ${test.name.toUpperCase()}`);
    console.log(`==================================================\n`);

    try {
        const output = execSync(`node ${path.join(__dirname, test.script)}`, { encoding: 'utf8' });
        console.log(output);
        totalPassed++;
    } catch (e) {
        console.error(`❌ ${test.name} FAILED TO EXECUTE`);
        console.error(e.stdout);
        console.error(e.stderr);
        totalFailed++;
    }
}

console.log(`\n==================================================`);
console.log(`VERIFICATION COMPLETE`);
console.log(`Systems Verified: ${totalPassed}/${tests.length}`);
console.log(`==================================================`);
