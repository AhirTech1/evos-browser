# Security Systems

Security and safety measures for AI-powered browser automation.

## Overview

The security system protects users from malicious automation, injection attacks, and unintended actions while allowing legitimate AI assistance.

## Components

### `injection-detector.js`
Detects and prevents code injection attacks.

**Threat Model:**
AI agents execute code in the browser context, which could be exploited:
- Malicious websites manipulating AI responses
- Injected scripts in user prompts
- XSS-style attacks via AI tool calls
- Data exfiltration through AI actions

**Protection Mechanisms:**

1. **Input Sanitization**
   - Strip dangerous characters from user input
   - Validate URLs before navigation
   - Escape HTML in AI messages
   - Block eval() and similar constructs

2. **Code Analysis**
   - Parse JavaScript before execution
   - Detect suspicious patterns
   - Check for known attack signatures
   - Sandbox untrusted code

3. **Output Validation**
   - Verify AI tool parameters
   - Check for script injection in selectors
   - Validate data before DOM insertion

**Key Methods:**
- `scanInput(userInput)` - Check user input for threats
- `validateToolCall(toolName, params)` - Verify tool parameters
- `sanitizeSelector(selector)` - Clean CSS selectors
- `detectXSS(html)` - Find XSS patterns
- `isURLSafe(url)` - Validate navigation targets
- `scanPageContent(html)` - Check loaded pages

**Detection Patterns:**
```javascript
const DANGEROUS_PATTERNS = [
  /<script/i,                    // Script tags
  /javascript:/i,                 // JavaScript URLs
  /on\w+\s*=/i,                  // Event handlers
  /eval\s*\(/i,                  // eval() calls
  /document\.cookie/i,            // Cookie access
  /\.innerHTML\s*=/i,            // innerHTML assignment
];
```

### `intent-verifier.js`
Verifies that AI actions match user intent.

**Purpose:**
Ensure the AI only performs actions the user actually wants:
- Confirm destructive actions (delete, purchase)
- Verify sensitive operations (payments, data sharing)
- Detect misinterpreted commands
- Prevent scope creep in automation

**Verification Levels:**

1. **Automatic** (Low risk)
   - Read-only operations
   - Navigation to known sites
   - Search queries
   - Information extraction

2. **Passive Confirmation** (Medium risk)
   - Form fills with user data
   - Cookie/storage modifications
   - Downloads
   - New tab creation

3. **Active Confirmation** (High risk)
   - Financial transactions
   - Account modifications
   - Data deletion
   - External communications

**Key Methods:**
- `classifyAction(toolName, params)` - Determine risk level
- `requiresConfirmation(action)` - Check if user approval needed
- `verifyIntent(userPrompt, proposedActions)` - Match actions to intent
- `explainAction(action)` - Generate user-friendly description
- `getUserApproval(action, context)` - Request confirmation
- `logAction(action, approved)` - Audit trail

**Intent Matching:**
```javascript
// User: "Book a flight to Paris"
// AI proposes: [search_flights, fill_form, submit_payment]
// Verifier checks:
// ✓ search_flights - matches intent
// ✓ fill_form - matches intent
// ✗ submit_payment - requires confirmation ($$)
```

**Safety Rules:**
- Never auto-execute financial transactions
- Always confirm data deletion
- Verify external communications
- Respect privacy boundaries
- Log all high-risk actions

### `index.js`
Module exports and initialization.

## Security Policies

### JavaScript Execution
```javascript
// Allowed
webview.executeJavaScript('document.title');

// Blocked by injection detector
webview.executeJavaScript(userInput); // Unescaped user input
webview.executeJavaScript('<script>...</script>');
```

### URL Navigation
```javascript
// Allowed
navigate('https://trusted-site.com');
navigate('http://localhost:3000'); // Dev mode

// Blocked
navigate('javascript:alert(1)');
navigate('file:///etc/passwd');
navigate('data:text/html,<script>...');
```

### Data Access
- Read: Always allowed with user awareness
- Write: Requires verification for sensitive actions
- Delete: Always requires confirmation

## Audit Trail

All security-relevant events are logged:

```javascript
{
  timestamp: "2025-01-04T23:30:00Z",
  action: "payment_submission",
  riskLevel: "high",
  userApproved: true,
  context: {
    url: "https://example.com/checkout",
    amount: "$99.99"
  }
}
```

Logs are stored locally and can be reviewed in settings.

## Usage

```javascript
const { InjectionDetector, IntentVerifier } = require('../security');

// Check input safety
const detector = new InjectionDetector();
const userInput = '<script>alert(1)</script>';
if (detector.scanInput(userInput)) {
  console.error('Injection attempt detected!');
  return;
}

// Verify intent
const verifier = new IntentVerifier();
const action = {
  tool: 'click_element',
  params: { selector: '.submit-payment' }
};
if (verifier.requiresConfirmation(action)) {
  const approved = await verifier.getUserApproval(action);
  if (!approved) {
    console.log('User rejected action');
    return;
  }
}
```

## Development

### Adding New Threat Patterns
1. Identify attack vector
2. Create detection regex/logic
3. Add tests with malicious samples
4. Document in threat model

### Risk Classification
When adding new tools, classify by risk:
- **Low**: Read-only, no side effects
- **Medium**: Writes data, modifiable
- **High**: Financial, destructive, external

### Testing Security
Run security test suite:
```bash
npm test -- security
```

Includes:
- XSS injection tests
- Intent verification scenarios
- Bypass attempt simulations
- Edge case handling

## Privacy

The security system respects user privacy:
- No telemetry sent externally
- Audit logs stored locally only
- User can review/delete all logs
- Transparent operation explanations
