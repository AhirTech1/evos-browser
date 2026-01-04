# Macro System

The macro system allows recording and playing back sequences of browser actions with intelligent self-healing.

## Features

### Macro Recording
- Record user interactions in the browser
- Capture clicks, typing, navigation, scrolling
- Store element selectors and context
- Include timing information

### Macro Playback
- Replay recorded actions
- Self-healing when elements change
- Retry logic for flaky selectors
- Progress tracking and error handling

### Self-Healing
The healing engine automatically adapts to UI changes:
- Finds similar elements when original selector fails
- Uses multiple selector strategies (ID, class, text, position)
- Learns from successful recoveries
- Provides confidence scores for healed actions

## Files

### `index.js`
Module exports for the macro system.

### `healing-engine.js`
Intelligent selector healing and adaptation.

**Key Functions:**
- `healSelector(originalSelector, context)` - Find alternative selectors
- `scoreElement(element, original)` - Calculate similarity score
- `findBestMatch(candidates, original)` - Select best alternative
- `updateMacro(macro, healedSelectors)` - Update macro with healed selectors

**Healing Strategies:**
1. **Direct retry** - Try original selector with delays
2. **Sibling search** - Look for nearby elements
3. **Text matching** - Find by visible text
4. **Position matching** - Find by screen coordinates
5. **Attribute matching** - Match data attributes
6. **Visual matching** - Screenshot-based comparison

## Usage

```javascript
const { MacroRecorder, MacroPlayer } = require('../macros');

// Record a macro
const recorder = new MacroRecorder();
recorder.startRecording();
// ... user performs actions ...
const macro = recorder.stopRecording();

// Playback with healing
const player = new MacroPlayer();
await player.playMacro(macro, {
  healingEnabled: true,
  retryAttempts: 3,
  retryDelay: 1000
});
```

## Macro Format

Macros are stored as JSON:

```json
{
  "id": "unique-id",
  "name": "Macro Name",
  "description": "What this macro does",
  "steps": [
    {
      "type": "click",
      "selector": "#button",
      "waitFor": 500,
      "context": {
        "url": "https://example.com",
        "text": "Click me"
      }
    },
    {
      "type": "type",
      "selector": "input[name='search']",
      "value": "query text",
      "context": {
        "placeholder": "Search..."
      }
    }
  ],
  "metadata": {
    "created": "2025-01-04T00:00:00Z",
    "recordedUrl": "https://example.com",
    "healingHistory": []
  }
}
```

## Development

### Adding New Action Types
1. Add handler in `macro-agent.js`
2. Update recorder to capture the action
3. Add healing logic if needed
4. Update macro format documentation

### Healing Algorithm
The healing engine uses a scoring system:
- **100%** - Exact match (original selector works)
- **80-99%** - Strong match (same text, similar position)
- **60-79%** - Good match (same tag, similar attributes)
- **40-59%** - Weak match (same area, different element)
- **0-39%** - Poor match (should prompt user)

Healed actions with scores below 60% trigger warnings.
