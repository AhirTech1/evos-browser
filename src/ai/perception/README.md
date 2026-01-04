# Perception Systems

Visual perception and coordinate mapping for browser automation.

## Overview

The perception system enables the AI to understand and interact with web pages visually, handling coordinate mapping, multi-frame scenarios, and visual element detection.

## Components

### `coordinate-mapper.js`
Translates between different coordinate systems in browser automation.

**Problem:**
When automating browsers, coordinates can be in different spaces:
- Screen coordinates (absolute pixels)
- Window coordinates (relative to browser window)
- Viewport coordinates (visible area)
- Element coordinates (relative to element)
- WebView coordinates (Electron's embedded browser)

**Solution:**
The coordinate mapper provides conversions between all coordinate systems.

**Key Functions:**
- `screenToWebView(x, y, webview)` - Convert screen to WebView coords
- `webViewToScreen(x, y, webview)` - Convert WebView to screen coords
- `viewportToElement(x, y, element)` - Get element-relative coords
- `elementToViewport(x, y, element)` - Get viewport coords from element
- `getElementPosition(element, referenceFrame)` - Universal position getter
- `adjustForScroll(x, y, scrollX, scrollY)` - Account for scrolling

**Use Cases:**
- Click at specific screen coordinates
- Map mouse positions to page elements
- Handle zoomed pages
- Work with iframes and nested frames
- Calculate relative positions

### `frame-compositor.js`
Handles multi-frame scenarios and nested browsing contexts.

**Features:**
- Detect and map iframe hierarchies
- Calculate positions across frame boundaries
- Handle cross-origin frames safely
- Composite visual representations
- Track frame focus and navigation

**Frame Tree:**
```javascript
{
  url: "https://example.com",
  title: "Main Page",
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  frames: [
    {
      url: "https://widget.com",
      bounds: { x: 100, y: 100, width: 400, height: 300 },
      frames: [] // nested frames
    }
  ]
}
```

**Key Methods:**
- `buildFrameTree(webview)` - Map entire frame hierarchy
- `findFrameByUrl(tree, url)` - Locate specific frame
- `getFramePath(element)` - Get path to element's frame
- `executeInFrame(framePath, code)` - Run code in specific frame
- `clickInFrame(framePath, x, y)` - Click within nested frame
- `screenshotFrame(framePath)` - Capture frame image

**Challenges:**
- Cross-origin restrictions
- Dynamic frame loading
- Frame z-index and overlapping
- Performance with many frames

### `index.js`
Module exports and utilities.

## Visual Understanding

The perception system works with the AI's vision capabilities:

1. **Element Detection**
   - Identify clickable elements
   - Extract text and images
   - Understand layouts
   - Detect interactive controls

2. **Spatial Reasoning**
   - Calculate distances between elements
   - Understand visual hierarchy
   - Determine reading order
   - Identify visual groups

3. **Change Detection**
   - Detect dynamic content updates
   - Track element movements
   - Notice new elements
   - Identify disappeared elements

## Integration with Macros

The perception system helps macros self-heal:

1. **Position-Based Healing**
   - Find element at recorded position
   - Adjust for layout changes
   - Handle responsive designs

2. **Visual Similarity**
   - Compare element appearances
   - Match by screenshot similarity
   - Identify renamed elements

3. **Context Understanding**
   - Use surrounding elements
   - Leverage visual hierarchy
   - Consider semantic meaning

## Usage

```javascript
const { CoordinateMapper, FrameCompositor } = require('../perception');

// Coordinate mapping
const mapper = new CoordinateMapper(webview);
const screenPos = { x: 500, y: 300 };
const webViewPos = mapper.screenToWebView(screenPos.x, screenPos.y);

// Frame handling
const compositor = new FrameCompositor(webview);
const frameTree = await compositor.buildFrameTree();
const targetFrame = compositor.findFrameByUrl(frameTree, 'https://widget.com');
await compositor.clickInFrame(targetFrame.path, 50, 50);
```

## Development

### Coordinate System Reference

```
┌─────────────────────────────────────────────────┐ Screen (0,0)
│  ┌───────────────────────────────────────────┐  │
│  │ Browser Window                            │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │ WebView                             │  │  │
│  │  │  ┌───────────────────────────────┐  │  │  │
│  │  │  │ Viewport (visible area)       │  │  │  │
│  │  │  │   ┌─────────────┐             │  │  │  │
│  │  │  │   │  Element    │             │  │  │  │
│  │  │  │   └─────────────┘             │  │  │  │
│  │  │  └───────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Adding New Mappings
1. Define source and target coordinate systems
2. Implement conversion mathematics
3. Add tests for edge cases
4. Document in JSDoc comments

### Performance Considerations
- Cache coordinate transformations
- Batch frame tree builds
- Debounce rapid position queries
- Use requestAnimationFrame for updates
