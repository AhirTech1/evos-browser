/**
 * EVOS Memory Module Index
 */

const { KnowledgeGraph, knowledgeGraph } = require('./knowledge-graph');
const { TemporalTracker } = require('./temporal-tracker');

// Create temporal tracker with knowledge graph
const temporalTracker = new TemporalTracker(knowledgeGraph);

module.exports = {
    KnowledgeGraph,
    knowledgeGraph,
    TemporalTracker,
    temporalTracker
};
