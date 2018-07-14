/**
 * A spinner which renders a small animation.
 * Used to indicate a loading state (e.g. an active linting).
 */
module.exports = class Spinner {
    constructor() {
        this.i = 0;
        this.frames = ["   ", ".  ", ".. ", "...", " ..", "  .", "   "];
    }
    toString() {
        this.i = (this.i + 1) % this.frames.length;
        return this.frames[this.i];
    }
};
