/**
 * EVOS Perception Module Index
 */

const { FrameCompositor, frameCompositor } = require('./frame-compositor');
const { CoordinateMapper } = require('./coordinate-mapper');

// Create coordinate mapper with compositor
const coordinateMapper = new CoordinateMapper(frameCompositor);

module.exports = {
    FrameCompositor,
    frameCompositor,
    CoordinateMapper,
    coordinateMapper
};
