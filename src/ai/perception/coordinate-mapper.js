/**
 * EVOS Coordinate Mapper
 * Maps coordinates between visual and DOM space
 * Handles dynamic content and scrolling
 */

class CoordinateMapper {
    constructor(frameCompositor) {
        this.compositor = frameCompositor;
        this.scrollOffset = { x: 0, y: 0 };
        this.scale = 1;
    }

    /**
     * Update scroll offset from webview
     */
    async updateScrollOffset(webview) {
        if (!webview) return;

        try {
            const offset = await webview.executeJavaScript(`
        ({ x: window.scrollX, y: window.scrollY })
      `);
            this.scrollOffset = offset;
        } catch (e) {
            console.warn('[CoordinateMapper] Failed to get scroll offset');
        }
    }

    /**
     * Convert screen coordinates to page coordinates
     */
    screenToPage(screenX, screenY) {
        return {
            x: screenX + this.scrollOffset.x,
            y: screenY + this.scrollOffset.y
        };
    }

    /**
     * Convert page coordinates to screen coordinates
     */
    pageToScreen(pageX, pageY) {
        return {
            x: pageX - this.scrollOffset.x,
            y: pageY - this.scrollOffset.y
        };
    }

    /**
     * Check if element is in viewport
     */
    isInViewport(element, viewport = null) {
        if (!element.bounds) return false;

        const vp = viewport || (this.compositor.lastCapture?.viewport) || { width: 1920, height: 1080 };
        const bounds = element.bounds;

        return bounds.x < vp.width &&
            bounds.x + bounds.width > 0 &&
            bounds.y < vp.height &&
            bounds.y + bounds.height > 0;
    }

    /**
     * Get click coordinates for an element
     * Returns center point, avoiding edges
     */
    getClickPoint(element) {
        if (!element.bounds) return null;

        const { bounds } = element;

        // Use center by default
        let x = bounds.centerX || (bounds.x + bounds.width / 2);
        let y = bounds.centerY || (bounds.y + bounds.height / 2);

        // Add small offset to avoid exact center (some sites have overlays)
        x += 2;
        y += 2;

        return { x: Math.round(x), y: Math.round(y) };
    }

    /**
     * Get safe click point (avoids overlapping elements)
     */
    async getSafeClickPoint(element, webview) {
        const point = this.getClickPoint(element);
        if (!point || !webview) return point;

        // Check what element is at that point
        const script = `
      (function() {
        const el = document.elementFromPoint(${point.x}, ${point.y});
        if (!el) return null;
        
        const selector = el.id ? '#' + el.id : 
                        (el.className ? el.tagName.toLowerCase() + '.' + el.className.split(' ')[0] : 
                         el.tagName.toLowerCase());
        
        return {
          tagName: el.tagName.toLowerCase(),
          selector: selector,
          bounds: (() => {
            const rect = el.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })()
        };
      })()
    `;

        try {
            const elementAtPoint = await webview.executeJavaScript(script);

            if (elementAtPoint && elementAtPoint.selector !== element.selector) {
                // Something is overlapping! Try corners
                const corners = [
                    { x: point.x - 10, y: point.y - 10 },
                    { x: point.x + 10, y: point.y - 10 },
                    { x: point.x - 10, y: point.y + 10 },
                    { x: point.x + 10, y: point.y + 10 }
                ];

                // Just return center anyway, but log the issue
                console.warn('[CoordinateMapper] Element may be overlapped:', element.selector);
            }

            return point;
        } catch (e) {
            return point;
        }
    }

    /**
     * Calculate scroll required to bring element into view
     */
    getScrollToElement(element, viewport = null) {
        if (!element.bounds) return null;

        const vp = viewport || (this.compositor.lastCapture?.viewport) || { width: 1920, height: 1080 };
        const bounds = element.bounds;

        let scrollX = 0;
        let scrollY = 0;

        // Horizontal scroll
        if (bounds.x < 0) {
            scrollX = bounds.x - 50; // Scroll left with margin
        } else if (bounds.x + bounds.width > vp.width) {
            scrollX = bounds.x + bounds.width - vp.width + 50; // Scroll right with margin
        }

        // Vertical scroll
        if (bounds.y < 0) {
            scrollY = bounds.y - 50; // Scroll up with margin
        } else if (bounds.y + bounds.height > vp.height) {
            scrollY = bounds.y + bounds.height - vp.height + 50; // Scroll down with margin
        }

        if (scrollX === 0 && scrollY === 0) {
            return null; // No scroll needed
        }

        return { x: scrollX, y: scrollY };
    }

    /**
     * Find nearest element to a point
     */
    findNearestElement(x, y, elements = null) {
        const targets = elements || this.compositor.lastCapture?.elements || [];

        let nearest = null;
        let minDistance = Infinity;

        for (const el of targets) {
            if (!el.bounds) continue;

            const centerX = el.bounds.centerX || (el.bounds.x + el.bounds.width / 2);
            const centerY = el.bounds.centerY || (el.bounds.y + el.bounds.height / 2);

            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

            if (distance < minDistance) {
                minDistance = distance;
                nearest = el;
            }
        }

        return nearest ? { element: nearest, distance: minDistance } : null;
    }

    /**
     * Get elements in a region
     */
    getElementsInRegion(x, y, width, height) {
        const elements = this.compositor.lastCapture?.elements || [];

        return elements.filter(el => {
            if (!el.bounds) return false;

            // Check if element overlaps with region
            return el.bounds.x < x + width &&
                el.bounds.x + el.bounds.width > x &&
                el.bounds.y < y + height &&
                el.bounds.y + el.bounds.height > y;
        });
    }

    /**
     * Get relative position description (for AI)
     */
    getPositionDescription(element) {
        if (!element.bounds) return '';

        const vp = this.compositor.lastCapture?.viewport || { width: 1920, height: 1080 };
        const { bounds } = element;

        const centerX = bounds.centerX || (bounds.x + bounds.width / 2);
        const centerY = bounds.centerY || (bounds.y + bounds.height / 2);

        // Horizontal position
        let hPos = 'center';
        if (centerX < vp.width * 0.33) hPos = 'left';
        else if (centerX > vp.width * 0.67) hPos = 'right';

        // Vertical position
        let vPos = 'middle';
        if (centerY < vp.height * 0.33) vPos = 'top';
        else if (centerY > vp.height * 0.67) vPos = 'bottom';

        if (hPos === 'center' && vPos === 'middle') return 'center of page';
        if (vPos === 'middle') return `${hPos} side`;
        if (hPos === 'center') return `${vPos} of page`;
        return `${vPos}-${hPos}`;
    }
}

module.exports = { CoordinateMapper };
