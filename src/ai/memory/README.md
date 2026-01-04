# Memory Systems

Advanced memory and context management for the AI agent.

## Overview

The memory system provides long-term knowledge storage, relationship tracking, and temporal awareness for the AI to maintain context across sessions.

## Components

### `knowledge-graph.js`
A graph-based knowledge representation system.

**Features:**
- Store entities (people, places, things, concepts)
- Track relationships between entities
- Query by entity type or relationship
- Find related entities
- Update and merge knowledge

**Data Structure:**
```javascript
{
  entities: {
    "entity-id": {
      id: "entity-id",
      type: "person|place|thing|concept",
      name: "Entity Name",
      properties: {
        key: "value"
      },
      created: Date,
      updated: Date
    }
  },
  relationships: [
    {
      from: "entity-id-1",
      to: "entity-id-2",
      type: "works_at|lives_in|knows|...",
      strength: 0.0-1.0,
      properties: {}
    }
  ]
}
```

**Key Methods:**
- `addEntity(type, name, properties)` - Add new entity
- `addRelationship(from, to, type, properties)` - Connect entities
- `query(filters)` - Search entities
- `getRelated(entityId, relationshipType)` - Find connections
- `updateEntity(id, updates)` - Modify entity
- `forget(entityId)` - Remove entity and relationships

**Use Cases:**
- Remember user preferences and context
- Track visited websites and their relationships
- Store form data and credentials
- Build user profile over time
- Context-aware suggestions

### `temporal-tracker.js`
Time-aware event tracking and patterns.

**Features:**
- Track events with timestamps
- Identify patterns and routines
- Schedule reminders
- Predict future actions
- Analyze time-based behaviors

**Event Types:**
- Website visits
- Form submissions
- Search queries
- Downloads
- Task completions

**Key Methods:**
- `recordEvent(type, data, timestamp)` - Log event
- `getEventHistory(type, timeRange)` - Query events
- `findPatterns(eventType)` - Detect routines
- `getFrequency(eventType, duration)` - Calculate rates
- `predictNext(eventType)` - Forecast next occurrence

**Use Cases:**
- "You usually check email at 9 AM"
- "Time to order groceries" (weekly pattern)
- Suggest revisiting important pages
- Track project milestones
- Remind about recurring tasks

### `index.js`
Module exports and initialization.

## Storage

Memory is persisted to:
```
%APPDATA%/evos-browser/memory/
├── knowledge-graph.json    # Entities and relationships
├── temporal-events.json    # Time-based events
└── index.json              # Metadata and indices
```

## Privacy

All memory is stored locally:
- No cloud synchronization
- User can view/edit/delete all data
- Clear memory option in settings
- Export/import capability

## Usage

```javascript
const { KnowledgeGraph, TemporalTracker } = require('../memory');

// Knowledge Graph
const kg = new KnowledgeGraph();
const personId = kg.addEntity('person', 'John Doe', {
  email: 'john@example.com',
  occupation: 'Developer'
});
const companyId = kg.addEntity('organization', 'ACME Corp');
kg.addRelationship(personId, companyId, 'works_at', {
  since: '2020-01-01'
});

// Temporal Tracker
const tracker = new TemporalTracker();
tracker.recordEvent('visit', {
  url: 'https://github.com',
  title: 'GitHub'
});
const patterns = tracker.findPatterns('visit');
```

## Integration with AI

The memory systems enhance AI capabilities:

1. **Context Awareness**
   - AI knows about user's relationships and preferences
   - Remembers previous conversations
   - Understands user's work context

2. **Proactive Assistance**
   - Suggests actions based on patterns
   - Reminds about recurring tasks
   - Pre-fills forms with known data

3. **Personalization**
   - Tailors responses to user's style
   - Uses known preferences
   - Adapts to user's schedule

## Development

### Adding New Entity Types
1. Define type in `knowledge-graph.js`
2. Add extraction logic in `agent.js`
3. Create UI for viewing/editing in renderer

### Extending Temporal Tracking
1. Add event type to tracker
2. Implement pattern detection algorithm
3. Create visualization in dashboard

### Memory Consolidation
Periodic cleanup and optimization:
- Merge duplicate entities
- Strengthen frequently accessed relationships
- Archive old, unused events
- Rebuild search indices
