/**
 * Vision-DOM Verification Script
 * Tests the Frame Compositor and Coordinate Mapper
 * Run with: node tests/verification/verify-perception.js
 */

const { FrameCompositor } = require('../../src/ai/perception/frame-compositor');
const { CoordinateMapper } = require('../../src/ai/perception/coordinate-mapper');

// Mock Webview
class MockWebview {
    async executeJavaScript(script) {
        // Mock DOM extraction response
        if (script.includes('interactiveSelectors')) {
            return {
                viewport: { width: 1920, height: 1080 },
                elements: [
                    {
                        tagName: 'button',
                        text: 'Submit',
                        bounds: { x: 100, y: 100, width: 100, height: 50, centerX: 150, centerY: 125 },
                        isClickable: true,
                        selector: 'button.submit-btn'
                    },
                    {
                        tagName: 'input',
                        name: 'email',
                        bounds: { x: 100, y: 200, width: 200, height: 40, centerX: 200, centerY: 220 },
                        isEditable: true,
                        selector: 'input[name="email"]'
                    },
                    {
                        tagName: 'div',
                        text: 'Welcome to EVOS',
                        bounds: { x: 50, y: 50, width: 500, height: 50, centerX: 300, centerY: 75 },
                        selector: '#hero-title'
                    }
                ]
            };
        }

        // Mock Accessibility Tree response
        if (script.includes('const roles')) {
            return [
                {
                    role: 'button',
                    name: 'Submit Form',
                    bounds: { x: 100, y: 100, width: 100, height: 50 }
                }
            ];
        }

        // Mock scroll offset
        return { x: 0, y: 500 }; // Scrolled down 500px
    }

    getURL() {
        return 'https://example.com';
    }
}

async function runPerceptionTests() {
    console.log('👁️ Starting Vision-DOM Verification Tests...\n');

    const compositor = new FrameCompositor();
    const mapper = new CoordinateMapper(compositor);
    const mockWebview = new MockWebview();
    const context = { webview: mockWebview, captureScreenshot: false };

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

    // --- TEST 1: Frame Capture ---
    console.log('--- Suite 1: Frame Capture ---');

    const frame = await compositor.captureFrame(context);

    assert('Capture frame elements', frame.elements.length, 3);
    assert('Extract viewport', frame.viewport.width, 1920);

    // --- TEST 2: Accessibility Merging ---
    console.log('\n--- Suite 2: Accessibility Enrichment ---');

    const submitBtn = frame.elements.find(el => el.tagName === 'button');
    assert('Merge A11y role', submitBtn.role, 'button');
    assert('Merge A11y name', submitBtn.accessibleName, 'Submit Form');

    // --- TEST 3: Element Finding Strategies ---
    console.log('\n--- Suite 3: Element Finding strategies ---');

    // Exact text
    const found1 = compositor.findElement('Submit');
    assert('Find by exact text', found1.element.text, 'Submit');

    // A11y name
    const found2 = compositor.findElement('Submit Form');
    assert('Find by accessible name', found2.element.selector, 'button.submit-btn');

    // Fuzzy/Partial
    const found3 = compositor.findElement('EVOS');
    assert('Find by partial text', found3.element.selector, '#hero-title');

    // --- TEST 4: Coordinate Mapping ---
    console.log('\n--- Suite 4: Coordinate Mapping ---');

    // Coordinate conversion (with scroll mock)
    await mapper.updateScrollOffset(mockWebview); // Sets scrollY to 500

    const screenPoint = { x: 150, y: 125 };
    const pagePoint = mapper.screenToPage(screenPoint.x, screenPoint.y);

    assert('Screen to Page (Y)', pagePoint.y, 625); // 125 + 500

    // Scroll calculation
    // Button is at y=100. We are scrolled to 500. Button is off-screen (top).
    // viewport is 0-1080 relative to scroll? No, bounds are usually client rects (relative to viewport)
    // In our mock, bounds are static. Let's assume they are page metrics for this test logic or adapt mock.
    // Ideally getBoundingClientRect returns relative to viewport.
    // If we assume bounds are viewport-relative:
    // element at y=100 is visible (viewport height 1080).
    const scrollReq = mapper.getScrollToElement(submitBtn);
    assert('Element is in view (no scroll needed)', scrollReq, null);

    // Summary
    console.log('\n----------------------------------------');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);

    if (failed === 0) {
        console.log('🎉 PERCEPTION SYSTEM VERIFIED!');
    } else {
        console.log('⚠️ PERCEPTION SYSTEM NEEDS ATTENTION');
    }
}

runPerceptionTests().catch(console.error);
