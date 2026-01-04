/**
 * EVOS Injection Detector
 * Advanced detection of prompt injection and malicious content
 */

class InjectionDetector {
    constructor() {
        // Categories of injection patterns
        this.patterns = {
            // Direct instruction override
            instructionOverride: [
                /ignore\s*(all\s*)?(previous|above|prior|earlier)\s*(instructions?|prompts?|commands?)/i,
                /disregard\s*(all\s*)?(previous|above|prior|earlier)/i,
                /forget\s*(everything|all|what|the)\s*(you|i|we)\s*(said|told|mentioned)/i,
                /new\s*instructions?\s*:/i,
                /override\s*(previous|all|system)/i,
                /reset\s*(your|the)?\s*(instructions?|prompt)/i
            ],

            // Role manipulation
            roleManipulation: [
                /you\s*are\s*now\s*(a|an|the)?/i,
                /act\s*as\s*(if\s*you\s*are|a|an)?/i,
                /pretend\s*(to\s*be|you\s*are|you're)/i,
                /roleplay\s*as/i,
                /imagine\s*you\s*are/i,
                /from\s*now\s*on\s*you\s*are/i,
                /switch\s*to\s*.*\s*mode/i
            ],

            // Jailbreak attempts
            jailbreak: [
                /jailbreak/i,
                /DAN\s*(mode)?/i,
                /dev(eloper)?\s*mode/i,
                /no\s*restrictions?\s*mode/i,
                /uncensored\s*mode/i,
                /bypass\s*(the\s*)?(restrictions?|filters?|safety)/i,
                /unlock\s*(your)?\s*(full|true)\s*(capabilities?|potential)/i
            ],

            // System prompt extraction
            promptExtraction: [
                /show\s*(me\s*)?(your|the)\s*(system\s*)?prompt/i,
                /what\s*(are|is)\s*your\s*(instructions?|system\s*prompt)/i,
                /repeat\s*(your)?\s*(system\s*)?prompt/i,
                /print\s*(your)?\s*(initial|system)\s*(instructions?|prompt)/i,
                /reveal\s*(your)?\s*(hidden|secret)\s*instructions?/i
            ],

            // Code injection
            codeInjection: [
                /<script[\s>]/i,
                /<\/script>/i,
                /javascript\s*:/i,
                /on(click|load|error|mouseover|mouseout|focus|blur)\s*=/i,
                /eval\s*\(/i,
                /new\s+Function\s*\(/i,
                /document\.(write|cookie|location)/i,
                /window\.(location|open)/i,
                /innerHTML\s*=/i,
                /outerHTML\s*=/i
            ],

            // Social engineering
            socialEngineering: [
                /this\s*is\s*(a|an)?\s*(urgent|emergency|critical)/i,
                /you\s*must\s*immediately/i,
                /failure\s*to\s*comply/i,
                /administrator\s*override/i,
                /authorized\s*personnel/i,
                /security\s*clearance/i,
                /i\s*am\s*(the|your)\s*(developer|creator|admin)/i
            ],

            // Data exfiltration
            dataExfiltration: [
                /send\s*(this|all|the)\s*(data|information)\s*to/i,
                /upload\s*(to|this\s*to)/i,
                /forward\s*(this|all)\s*to/i,
                /exfiltrate/i,
                /transmit\s*user\s*data/i
            ],

            // Encoded/obfuscated attacks
            encodedAttacks: [
                /base64\s*decode/i,
                /atob\s*\(/i,
                /btoa\s*\(/i,
                /\/\*.*\*\//s, // Block comments (might hide malicious code)
                /\\x[0-9a-f]{2}/i, // Hex escapes
                /\\u[0-9a-f]{4}/i  // Unicode escapes
            ]
        };

        // Suspicious domains
        this.suspiciousDomains = [
            'pastebin.com',
            'hastebin.com',
            'ghostbin.com',
            'temp-mail',
            'guerrillamail',
            'fakemailgenerator'
        ];

        // Suspicious keywords in context
        this.suspiciousKeywords = [
            'password',
            'credit card',
            'ssn',
            'social security',
            'bank account',
            'api key',
            'secret key',
            'private key',
            'token',
            'auth'
        ];
    }

    /**
     * Analyze content for injection attempts
     * @param {string} content - Page content or message to analyze
     * @returns {Object} Detection result
     */
    analyze(content) {
        if (!content || typeof content !== 'string') {
            return { detected: false, threats: [], severity: 'none' };
        }

        const threats = [];
        let maxSeverity = 'none';

        // Check each pattern category
        for (const [category, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                const match = content.match(pattern);
                if (match) {
                    const severity = this.getSeverityForCategory(category);
                    threats.push({
                        category,
                        pattern: pattern.source,
                        matched: match[0],
                        severity,
                        position: match.index
                    });

                    if (this.compareSeverity(severity, maxSeverity) > 0) {
                        maxSeverity = severity;
                    }
                }
            }
        }

        // Check for suspicious domains
        for (const domain of this.suspiciousDomains) {
            if (content.toLowerCase().includes(domain)) {
                threats.push({
                    category: 'suspiciousDomain',
                    pattern: domain,
                    matched: domain,
                    severity: 'medium',
                    position: content.toLowerCase().indexOf(domain)
                });
                if (maxSeverity === 'none') maxSeverity = 'medium';
            }
        }

        // Check for high concentration of suspicious keywords
        const keywordCount = this.countSuspiciousKeywords(content);
        if (keywordCount >= 3) {
            threats.push({
                category: 'keywordConcentration',
                pattern: 'Multiple sensitive keywords',
                matched: `${keywordCount} keywords found`,
                severity: 'medium',
                position: 0
            });
            if (maxSeverity === 'none') maxSeverity = 'medium';
        }

        return {
            detected: threats.length > 0,
            threats,
            severity: maxSeverity,
            threatCount: threats.length,
            summary: this.generateSummary(threats)
        };
    }

    /**
     * Get severity for a category
     */
    getSeverityForCategory(category) {
        const severityMap = {
            instructionOverride: 'critical',
            roleManipulation: 'high',
            jailbreak: 'critical',
            promptExtraction: 'high',
            codeInjection: 'critical',
            socialEngineering: 'medium',
            dataExfiltration: 'critical',
            encodedAttacks: 'medium'
        };
        return severityMap[category] || 'low';
    }

    /**
     * Compare severity levels
     */
    compareSeverity(a, b) {
        const levels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
        return (levels[a] || 0) - (levels[b] || 0);
    }

    /**
     * Count suspicious keywords
     */
    countSuspiciousKeywords(content) {
        const lower = content.toLowerCase();
        return this.suspiciousKeywords.filter(kw => lower.includes(kw)).length;
    }

    /**
     * Generate human-readable summary
     */
    generateSummary(threats) {
        if (threats.length === 0) return 'No threats detected';

        const categories = [...new Set(threats.map(t => t.category))];
        const maxSeverity = threats.reduce((max, t) =>
            this.compareSeverity(t.severity, max) > 0 ? t.severity : max, 'none');

        return `${threats.length} threat(s) detected: ${categories.join(', ')}. Max severity: ${maxSeverity}`;
    }

    /**
     * Quick check for blocking decisions
     */
    shouldBlock(content) {
        const result = this.analyze(content);
        return result.severity === 'critical' || result.severity === 'high';
    }

    /**
     * Sanitize content by removing detected threats
     */
    sanitize(content) {
        if (!content) return content;

        let sanitized = content;

        // Remove detected patterns
        for (const patterns of Object.values(this.patterns)) {
            for (const pattern of patterns) {
                sanitized = sanitized.replace(pattern, '[REDACTED]');
            }
        }

        return sanitized;
    }

    /**
     * Get analysis report
     */
    getReport(content) {
        const result = this.analyze(content);

        return {
            ...result,
            contentLength: content?.length || 0,
            analyzedAt: Date.now(),
            recommendation: this.getRecommendation(result.severity)
        };
    }

    /**
     * Get recommendation based on severity
     */
    getRecommendation(severity) {
        switch (severity) {
            case 'critical':
                return 'BLOCK: Critical injection attempt detected. Do not execute any actions.';
            case 'high':
                return 'BLOCK: High-risk injection detected. Require user confirmation before proceeding.';
            case 'medium':
                return 'WARN: Suspicious content detected. Proceed with caution.';
            case 'low':
                return 'ALLOW: Minor concerns. Monitor for suspicious behavior.';
            default:
                return 'ALLOW: No threats detected.';
        }
    }
}

module.exports = { InjectionDetector };
