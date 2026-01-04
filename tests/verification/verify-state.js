/**
 * State & Memory Verification Script
 * Tests the Context Bus and Knowledge Graph
 * Run with: node tests/verification/verify-state.js
 */

// Mock Electron environment BEFORE importing ContextBus
const mockIpcMain = {
    handle: () => { },
    on: () => { },
    removeHandler: () => { }
};

// We need to override the require mechanism or use a proxy to mock 'electron'
// Since we're in a simple node script without jest/sinon, we'll try to patch the constructor behavior
// or if ContextBus imports electron at top level, we might need a different approach.

// Let's protect the test by mocking the require for this specific run if possible, 
// or simpler: modify ContextBus to accept an options object to skip IPC setup.
// BUT since we can't easily modify code just for tests without creating tech debt,
// let's try a clever hack: populate the global variable that might be used or try to mock the module.

// A robust way in vanilla node is to rely on how ContextBus accesses electron.
// If it uses require('electron'), we can pre-load a mock if we used a test runner.
// In this case, let's just make ContextBus.js robust to missing ipcMain if that's easier,
// OR (better) use a Proxy to intercept the require call - tough in CommonJS.

// SIMPLEST FIX: Create a mock 'electron' module in `tests/verification/mocks/electron.js` and require it?
// No, that's complex pathing.

// ALTERNATIVE: ContextBus checks if ipcMain exists before using it.
// Let's modify ContextBus.js to be test-friendly (safe for import outside Electron).

const { ContextBus } = require('../../src/main/context-bus');
const { KnowledgeGraph } = require('../../src/ai/memory/knowledge-graph');
const { TemporalTracker } = require('../../src/ai/memory/temporal-tracker');

// Note: If ContextBus fails at require time, we must modify ContextBus.js first.
// The failure log showed it failed at "new ContextBus" -> "setupIPC" -> "ipcMain.handle".
// So we can instantiate it with a flag if we modify the class.

// Mock dependencies
const mockStore = {
    get: (key) => ({ entities: [], relationships: [] }),
    set: (key, val) => { },
    delete: (key) => { }
};

async function runStateTests() {
    console.log('🧠 Starting State & Memory Verification Tests...\n');

    // Initialize modules
    const contextBus = new ContextBus();
    const knowledgeGraph = new KnowledgeGraph(mockStore);
    const temporalTracker = new TemporalTracker(knowledgeGraph);

    let passed = 0;
    let failed = 0;

    function assert(testName, result, expected) {
        // Simple equality check
        const isEqual = JSON.stringify(result) === JSON.stringify(expected);
        if (isEqual || result === expected) {
            console.log(`✅ ${testName}: PASSED`);
            passed++;
        } else {
            console.error(`❌ ${testName}: FAILED`);
            console.error(`   Expected: ${JSON.stringify(expected)}`);
            console.error(`   Got:      ${JSON.stringify(result)}`);
            failed++;
        }
    }

    // --- TEST 1: Context Bus (Tab Management) ---
    console.log('--- Suite 1: Context Bus ---');

    // Register a tab
    const tabId = 1;
    const tabData = {
        id: tabId,
        url: 'https://example.com',
        title: 'Example',
        lastActive: Date.now()
    };

    contextBus.updateTabState(tabId, tabData);
    const state = contextBus.getTabState(tabId);

    assert('Register and retrieve tab', state.title, 'Example');
    assert('Get all tabs count', contextBus.getAllTabs().length, 1);

    // AI Context generation
    const aiContext = contextBus.getAIContext();
    assert('Generate AI context', aiContext.includes('Example'), true);

    // --- TEST 2: Knowledge Graph (Entities) ---
    console.log('\n--- Suite 2: Knowledge Graph Entities ---');

    // Add entity
    const userEntity = {
        name: 'John Doe',
        type: 'person',
        source: 'user_profile'
    };

    const entityId = knowledgeGraph.addEntity(userEntity);
    const retrieved = knowledgeGraph.getEntity(entityId);

    assert('Add and retrieve entity', retrieved.name, 'John Doe');

    // Search entity by name
    const searchResults = knowledgeGraph.findEntities('John');
    assert('Search entity', searchResults[0].name, 'John Doe');

    // --- TEST 3: Knowledge Graph (Relationships) ---
    console.log('\n--- Suite 3: Relationships & Temporal Logic ---');

    // Add another entity
    const locationEntity = {
        name: 'New York',
        type: 'location'
    };
    const locId = knowledgeGraph.addEntity(locationEntity);

    // Add relationship
    knowledgeGraph.addRelationship({
        sourceId: entityId,
        targetId: locId,
        type: 'lives_in',
        confidence: 0.9
    });

    const rels = knowledgeGraph.getRelationships(entityId);
    assert('Add relationship', rels[0].type, 'lives_in');

    // Check temporal awareness (staleness)
    const isStale = temporalTracker.isStale(rels[0]);
    assert('Check freshness (fresh)', isStale, false);

    // Force staleness (simulate old date)
    rels[0].timestamp = Date.now() - (400 * 24 * 60 * 60 * 1000); // 400 days ago
    const isStaleOld = temporalTracker.isStale(rels[0]); // lives_in decays after 1 year (365 days)
    assert('Check staleness (old)', isStaleOld, true);

    // Summary
    console.log('\n----------------------------------------');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);

    if (failed === 0) {
        console.log('🎉 STATE & MEMORY SYSTEMS VERIFIED!');
    } else {
        console.log('⚠️ STATE SYSTEMS NEED ATTENTION');
    }
}

runStateTests().catch(console.error);
