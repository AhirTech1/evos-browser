/**
 * EVOS Temporal Tracker
 * Tracks when facts were learned and manages staleness/decay
 */

class TemporalTracker {
    constructor(knowledgeGraph) {
        this.kg = knowledgeGraph;

        // Decay rates (confidence reduction per day)
        this.decayRates = {
            preference: 0.01,
            search: 0.1,
            visit: 0.2,
            interest: 0.02,
            fact: 0.005
        };

        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => this.periodicCleanup(), 3600000); // Every hour
    }

    /**
     * Apply confidence decay to a relationship or fact
     */
    applyDecay(item) {
        if (!item.created) return item;

        const ageInDays = (Date.now() - item.created) / (24 * 60 * 60 * 1000);
        const decayRate = this.decayRates[item.type] || 0.01;

        // Exponential decay
        const decayedConfidence = item.confidence * Math.exp(-decayRate * ageInDays);

        return {
            ...item,
            currentConfidence: Math.max(0.1, decayedConfidence),
            ageInDays: Math.round(ageInDays * 10) / 10
        };
    }

    /**
     * Get items with their current (decayed) confidence
     */
    getWithDecay(items) {
        return items.map(item => this.applyDecay(item));
    }

    /**
     * Check if an item should be considered stale
     */
    isStale(item, threshold = 0.3) {
        const decayed = this.applyDecay(item);
        return decayed.currentConfidence < threshold;
    }

    /**
     * Get recently updated items
     */
    getRecentItems(items, days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return items.filter(item =>
            (item.updated || item.created) >= cutoff
        );
    }

    /**
     * Periodic cleanup of very stale items
     */
    periodicCleanup() {
        if (!this.kg) return;

        // Prune very stale relationships (confidence < 0.1)
        const staleRelationships = this.kg.relationships.filter(r => {
            const decayed = this.applyDecay(r);
            return decayed.currentConfidence < 0.1;
        });

        for (const rel of staleRelationships) {
            this.kg.removeRelationship(rel.id);
        }

        if (staleRelationships.length > 0) {
            console.log(`[TemporalTracker] Cleaned ${staleRelationships.length} stale relationships`);
        }
    }

    /**
     * Get timeline of changes
     */
    getTimeline(limit = 50) {
        const timeline = [];

        // Add entities
        for (const entity of Object.values(this.kg.entities)) {
            timeline.push({
                type: 'entity',
                action: 'created',
                item: entity,
                timestamp: entity.created
            });
        }

        // Add relationships
        for (const rel of this.kg.relationships) {
            timeline.push({
                type: 'relationship',
                action: 'created',
                item: rel,
                timestamp: rel.created
            });
        }

        // Add facts
        for (const fact of this.kg.facts) {
            timeline.push({
                type: 'fact',
                action: 'created',
                item: fact,
                timestamp: fact.created
            });
        }

        // Sort by timestamp descending
        timeline.sort((a, b) => b.timestamp - a.timestamp);

        return timeline.slice(0, limit);
    }

    /**
     * Get only high-confidence items for AI context
     */
    getHighConfidenceContext(minConfidence = 0.5) {
        const relationships = this.kg.relationships
            .map(r => this.applyDecay(r))
            .filter(r => r.currentConfidence >= minConfidence);

        const facts = this.kg.facts
            .map(f => this.applyDecay(f))
            .filter(f => f.currentConfidence >= minConfidence);

        return { relationships, facts };
    }

    /**
     * Boost confidence when information is confirmed
     */
    confirmItem(item) {
        if (item.confidence) {
            item.confidence = Math.min(1, item.confidence + 0.1);
            item.lastConfirmed = Date.now();
        }
        return item;
    }

    /**
     * Stop cleanup interval
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = { TemporalTracker };
