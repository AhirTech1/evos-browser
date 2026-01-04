/**
 * EVOS Knowledge Graph Memory
 * Relational memory system that stores entities, relationships, and facts
 * with temporal reasoning and automatic staleness detection
 */

const Store = require('electron-store');

class KnowledgeGraph {
    constructor(store = null) {
        if (store) {
            this.store = store;
        } else {
            try {
                this.store = new Store({ name: 'evos-knowledge-graph' });
            } catch (e) {
                console.warn('[KnowledgeGraph] Could not initialize Electron Store, using memory fallback');
                this.store = { get: (k, d) => d, set: () => { }, delete: () => { } };
            }
        }

        // Load existing graph
        this.entities = this.store.get('entities', {});
        this.relationships = this.store.get('relationships', []);
        this.facts = this.store.get('facts', []);

        // Entity type definitions
        this.entityTypes = {
            person: { color: '#6366f1', icon: '👤' },
            organization: { color: '#10b981', icon: '🏢' },
            location: { color: '#f59e0b', icon: '📍' },
            product: { color: '#ec4899', icon: '📦' },
            preference: { color: '#8b5cf6', icon: '❤️' },
            date: { color: '#06b6d4', icon: '📅' },
            url: { color: '#3b82f6', icon: '🔗' },
            other: { color: '#6b7280', icon: '📝' }
        };

        // Relationship types with staleness thresholds (ms)
        this.relationshipTypes = {
            spouse: { staleAfter: null }, // Never stale
            family: { staleAfter: null },
            friend: { staleAfter: null },
            works_at: { staleAfter: 365 * 24 * 60 * 60 * 1000 }, // 1 year
            lives_in: { staleAfter: 365 * 24 * 60 * 60 * 1000 },
            prefers: { staleAfter: 90 * 24 * 60 * 60 * 1000 }, // 90 days
            recently_searched: { staleAfter: 7 * 24 * 60 * 60 * 1000 }, // 7 days
            recently_visited: { staleAfter: 24 * 60 * 60 * 1000 }, // 24 hours
            interested_in: { staleAfter: 30 * 24 * 60 * 60 * 1000 }, // 30 days
            purchased: { staleAfter: null } // Never stale
        };

        console.log('[KnowledgeGraph] Loaded:', Object.keys(this.entities).length, 'entities,', this.relationships.length, 'relationships');
    }

    // ==========================================
    // Entity Management
    // ==========================================

    /**
     * Add or update an entity
     */
    addEntity(type, name, attributes = {}) {
        const id = this.generateEntityId(type, name);

        const entity = {
            id,
            type,
            name,
            attributes,
            created: Date.now(),
            updated: Date.now(),
            accessCount: 0
        };

        // Merge with existing if present
        if (this.entities[id]) {
            entity.created = this.entities[id].created;
            entity.accessCount = (this.entities[id].accessCount || 0) + 1;
            entity.attributes = { ...this.entities[id].attributes, ...attributes };
        }

        this.entities[id] = entity;
        this.save();

        return entity;
    }

    /**
     * Get entity by ID
     */
    getEntity(id) {
        const entity = this.entities[id];
        if (entity) {
            entity.accessCount = (entity.accessCount || 0) + 1;
            entity.lastAccessed = Date.now();
        }
        return entity;
    }

    /**
     * Find entities by type or name
     */
    findEntities(query) {
        return Object.values(this.entities).filter(e => {
            if (query.type && e.type !== query.type) return false;
            if (query.name && !e.name.toLowerCase().includes(query.name.toLowerCase())) return false;
            if (query.attribute) {
                const [key, value] = Object.entries(query.attribute)[0];
                if (!e.attributes[key] || !e.attributes[key].includes(value)) return false;
            }
            return true;
        });
    }

    /**
     * Delete entity
     */
    deleteEntity(id) {
        // Remove entity
        delete this.entities[id];

        // Remove related relationships
        this.relationships = this.relationships.filter(r => r.from !== id && r.to !== id);

        // Remove related facts
        this.facts = this.facts.filter(f => f.subject !== id);

        this.save();
    }

    // ==========================================
    // Relationship Management
    // ==========================================

    /**
     * Add a relationship between entities
     */
    addRelationship(fromId, toId, type, attributes = {}) {
        // Ensure entities exist
        if (!this.entities[fromId] || !this.entities[toId]) {
            console.warn('[KnowledgeGraph] Cannot create relationship - entity not found');
            return null;
        }

        // Get staleness config
        const typeConfig = this.relationshipTypes[type] || { staleAfter: 30 * 24 * 60 * 60 * 1000 };

        const relationship = {
            id: `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from: fromId,
            to: toId,
            type,
            attributes,
            confidence: attributes.confidence || 0.8,
            created: Date.now(),
            staleAfter: typeConfig.staleAfter
        };

        // Check for existing relationship of same type
        const existingIdx = this.relationships.findIndex(r =>
            r.from === fromId && r.to === toId && r.type === type
        );

        if (existingIdx >= 0) {
            // Update existing
            relationship.id = this.relationships[existingIdx].id;
            relationship.created = this.relationships[existingIdx].created;
            this.relationships[existingIdx] = relationship;
        } else {
            this.relationships.push(relationship);
        }

        this.save();
        return relationship;
    }

    /**
     * Get relationships for an entity
     */
    getRelationships(entityId, options = {}) {
        const { type, direction, includeStale = false } = options;

        return this.relationships.filter(r => {
            // Match entity
            const matchesEntity = direction === 'outgoing'
                ? r.from === entityId
                : direction === 'incoming'
                    ? r.to === entityId
                    : r.from === entityId || r.to === entityId;

            if (!matchesEntity) return false;

            // Match type
            if (type && r.type !== type) return false;

            // Check staleness
            if (!includeStale && this.isRelationshipStale(r)) return false;

            return true;
        });
    }

    /**
     * Get relationship between two specific entities
     */
    getRelationship(fromId, toId, type = null) {
        return this.relationships.find(r => {
            if (r.from !== fromId || r.to !== toId) return false;
            if (type && r.type !== type) return false;
            return true;
        });
    }

    /**
     * Check if relationship is stale
     */
    isRelationshipStale(relationship) {
        if (!relationship.staleAfter) return false;
        return Date.now() - relationship.created > relationship.staleAfter;
    }

    /**
     * Remove relationship
     */
    removeRelationship(relationshipId) {
        this.relationships = this.relationships.filter(r => r.id !== relationshipId);
        this.save();
    }

    // ==========================================
    // Fact Management
    // ==========================================

    /**
     * Add a fact about an entity
     */
    addFact(subjectId, predicate, object, attributes = {}) {
        const fact = {
            id: `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            subject: subjectId,
            predicate,
            object,
            attributes,
            confidence: attributes.confidence || 0.8,
            created: Date.now(),
            source: attributes.source || 'user'
        };

        // Check for existing fact
        const existingIdx = this.facts.findIndex(f =>
            f.subject === subjectId && f.predicate === predicate
        );

        if (existingIdx >= 0) {
            // Update existing
            fact.id = this.facts[existingIdx].id;
            fact.created = this.facts[existingIdx].created;
            fact.updated = Date.now();
            this.facts[existingIdx] = fact;
        } else {
            this.facts.push(fact);
        }

        this.save();
        return fact;
    }

    /**
     * Get facts about an entity
     */
    getFacts(subjectId, predicate = null) {
        return this.facts.filter(f => {
            if (f.subject !== subjectId) return false;
            if (predicate && f.predicate !== predicate) return false;
            return true;
        });
    }

    // ==========================================
    // Natural Language Processing
    // ==========================================

    /**
     * Extract entities and relationships from text
     */
    async extractFromText(text, context = {}) {
        const extracted = {
            entities: [],
            relationships: [],
            facts: []
        };

        // Pattern-based extraction

        // Names (simple pattern - in production, use NER)
        const namePatterns = [
            /my (?:wife|husband|spouse|partner)'?s? (?:name is|called) (\w+)/i,
            /(?:I am|my name is|call me) (\w+)/i,
            /(\w+) is my (?:wife|husband|spouse|partner)/i
        ];

        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                const name = match[1];
                const entity = this.addEntity('person', name);
                extracted.entities.push(entity);

                // Check for relationship hints
                if (/wife|husband|spouse|partner/i.test(text)) {
                    const userEntity = this.getOrCreateUserEntity();
                    this.addRelationship(userEntity.id, entity.id, 'spouse');
                    extracted.relationships.push({ from: 'user', to: name, type: 'spouse' });
                }
            }
        }

        // Preferences
        const prefPatterns = [
            /(?:I|my \w+) (?:prefer|like|love|want)s? (.+)/i,
            /(?:I|my \w+) (?:always|usually) (?:get|order|choose) (.+)/i
        ];

        for (const pattern of prefPatterns) {
            const match = text.match(pattern);
            if (match) {
                const preference = match[1].trim();
                const prefEntity = this.addEntity('preference', preference);
                const userEntity = this.getOrCreateUserEntity();
                this.addRelationship(userEntity.id, prefEntity.id, 'prefers', { context: context.topic || 'general' });
                extracted.entities.push(prefEntity);
                extracted.relationships.push({ from: 'user', to: preference, type: 'prefers' });
            }
        }

        // Locations
        const locationPatterns = [
            /(?:I live|I'm from|I'm in|I'm based in|located in) (.+)/i,
            /(?:my home|my address|I reside) (?:is|in) (.+)/i
        ];

        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match) {
                const location = match[1].trim();
                const locEntity = this.addEntity('location', location);
                const userEntity = this.getOrCreateUserEntity();
                this.addRelationship(userEntity.id, locEntity.id, 'lives_in');
                extracted.entities.push(locEntity);
                extracted.relationships.push({ from: 'user', to: location, type: 'lives_in' });
            }
        }

        // Work
        const workPatterns = [
            /(?:I work at|I'm employed at|I work for) (.+)/i,
            /(?:my job|my company|my employer) (?:is|at) (.+)/i
        ];

        for (const pattern of workPatterns) {
            const match = text.match(pattern);
            if (match) {
                const company = match[1].trim();
                const orgEntity = this.addEntity('organization', company);
                const userEntity = this.getOrCreateUserEntity();
                this.addRelationship(userEntity.id, orgEntity.id, 'works_at');
                extracted.entities.push(orgEntity);
                extracted.relationships.push({ from: 'user', to: company, type: 'works_at' });
            }
        }

        // Search/Interest patterns - capture what user is looking for
        const searchPatterns = [
            /(?:find|search|looking for|help me find|where (?:can I|to)|show me|recommend) (?:a |some |the )?(.+?)(?:\?|$)/i,
            /(?:best|good|top) (.+?) (?:in|near|around|at) (.+)/i,
            /(.+?) (?:restaurant|hotel|place|cafe|shop|store)s? (?:in|near|around) (.+)/i
        ];

        for (const pattern of searchPatterns) {
            const match = text.match(pattern);
            if (match) {
                let interest = match[1].trim();
                let location = match[2] ? match[2].trim() : null;
                
                // Clean up the interest
                interest = interest.replace(/\?$/, '').trim();
                
                if (interest.length > 2 && interest.length < 100) {
                    const interestEntity = this.addEntity('preference', interest, {
                        type: 'search_interest',
                        searchedAt: Date.now()
                    });
                    const userEntity = this.getOrCreateUserEntity();
                    this.addRelationship(userEntity.id, interestEntity.id, 'interested_in', { 
                        context: 'search',
                        query: text,
                        timestamp: Date.now()
                    });
                    extracted.entities.push(interestEntity);
                    extracted.relationships.push({ from: 'user', to: interest, type: 'interested_in' });

                    // Also capture location if present
                    if (location && location.length > 2) {
                        const locEntity = this.addEntity('location', location, { mentionedInSearch: true });
                        this.addRelationship(userEntity.id, locEntity.id, 'interested_in', { context: 'location_search' });
                        extracted.entities.push(locEntity);
                    }
                }
            }
        }

        // Capture city/location mentions even without explicit patterns
        const cityPatterns = [
            /\b(?:in|at|near|around) (surat|mumbai|delhi|bangalore|chennai|kolkata|pune|ahmedabad|hyderabad|jaipur)\b/i
        ];

        for (const pattern of cityPatterns) {
            const match = text.match(pattern);
            if (match) {
                const city = match[1].trim();
                const locEntity = this.addEntity('location', city, { type: 'city' });
                const userEntity = this.getOrCreateUserEntity();
                this.addRelationship(userEntity.id, locEntity.id, 'interested_in', { context: 'mentioned_city' });
                extracted.entities.push(locEntity);
            }
        }

        return extracted;
    }

    /**
     * Get or create user entity
     */
    getOrCreateUserEntity() {
        let userEntity = this.entities['user'];
        if (!userEntity) {
            userEntity = this.addEntity('person', 'User', { isMainUser: true });
            userEntity.id = 'user';
            this.entities['user'] = userEntity;
            this.save();
        }
        return userEntity;
    }

    // ==========================================
    // Query & Context
    // ==========================================

    /**
     * Query the knowledge graph for AI context
     */
    queryForContext(topic) {
        const context = {
            user: this.getOrCreateUserEntity(),
            related: [],
            facts: [],
            preferences: []
        };

        // Get user relationships
        const userRelations = this.getRelationships('user');
        for (const rel of userRelations) {
            const targetId = rel.from === 'user' ? rel.to : rel.from;
            const targetEntity = this.entities[targetId];

            if (targetEntity) {
                context.related.push({
                    entity: targetEntity,
                    relationship: rel.type,
                    isStale: this.isRelationshipStale(rel)
                });

                if (rel.type === 'prefers') {
                    context.preferences.push({
                        name: targetEntity.name,
                        context: rel.attributes?.context || 'general'
                    });
                }
            }
        }

        // Get user facts
        context.facts = this.getFacts('user');

        return context;
    }

    /**
     * Generate natural language context for AI
     */
    getContextForAI() {
        const context = this.queryForContext();

        let text = '';
        let hasContent = false;

        // Relationships (excluding search interests)
        const permanentRelations = context.related.filter(rel => 
            !rel.isStale && !['interested_in', 'recently_searched'].includes(rel.relationship)
        );
        
        if (permanentRelations.length > 0) {
            text += 'Known information about the user:\n';
            for (const rel of permanentRelations) {
                text += `- ${this.formatRelationship(rel)}\n`;
            }
            hasContent = true;
        }

        // Recent interests/searches (last 30 days)
        const recentInterests = context.related.filter(rel => 
            rel.relationship === 'interested_in' && !rel.isStale
        );
        
        if (recentInterests.length > 0) {
            text += '\nRecent interests/searches:\n';
            for (const rel of recentInterests.slice(0, 5)) {
                text += `- ${rel.entity.name}\n`;
            }
            hasContent = true;
        }

        // Preferences
        if (context.preferences.length > 0) {
            text += '\nPreferences:\n';
            for (const pref of context.preferences) {
                text += `- ${pref.name} (${pref.context})\n`;
            }
            hasContent = true;
        }

        // Facts
        if (context.facts.length > 0) {
            text += '\nFacts:\n';
            for (const fact of context.facts) {
                text += `- ${fact.predicate}: ${fact.object}\n`;
            }
            hasContent = true;
        }

        return hasContent ? text : '';
    }

    /**
     * Format relationship for display
     */
    formatRelationship(rel) {
        const typeLabels = {
            spouse: 'is married to',
            family: 'is family of',
            friend: 'is friends with',
            works_at: 'works at',
            lives_in: 'lives in',
            prefers: 'prefers',
            interested_in: 'is interested in',
            recently_searched: 'recently searched for',
            recently_visited: 'recently visited'
        };

        const label = typeLabels[rel.relationship] || rel.relationship;
        return `User ${label} ${rel.entity.name}`;
    }

    // ==========================================
    // Temporal Reasoning
    // ==========================================

    /**
     * Get fresh (non-stale) relationships
     */
    getFreshRelationships() {
        return this.relationships.filter(r => !this.isRelationshipStale(r));
    }

    /**
     * Prune stale relationships
     */
    pruneStaleRelationships() {
        const before = this.relationships.length;
        this.relationships = this.getFreshRelationships();
        const pruned = before - this.relationships.length;

        if (pruned > 0) {
            console.log(`[KnowledgeGraph] Pruned ${pruned} stale relationships`);
            this.save();
        }

        return pruned;
    }

    // ==========================================
    // Persistence
    // ==========================================

    generateEntityId(type, name) {
        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return `${type}-${normalized}`;
    }

    save() {
        this.store.set('entities', this.entities);
        this.store.set('relationships', this.relationships);
        this.store.set('facts', this.facts);
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            entityCount: Object.keys(this.entities).length,
            relationshipCount: this.relationships.length,
            factCount: this.facts.length,
            staleRelationships: this.relationships.filter(r => this.isRelationshipStale(r)).length
        };
    }

    /**
     * Clear all data
     */
    clear() {
        this.entities = {};
        this.relationships = [];
        this.facts = [];
        this.save();
    }
}

// Singleton
const knowledgeGraph = new KnowledgeGraph();

module.exports = { KnowledgeGraph, knowledgeGraph };
