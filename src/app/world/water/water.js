import {makeOctaves} from "../../utils/octaves";
import {Scale} from "../scale";

/**
 * A water plane.
 * @constructor
 */
export function Water() {
    const _octaves = makeOctaves(Water.WAVE_FUNCTION_PHASES, Water.WAVE_FUNCTION_FALLOFF);
    const _particles = [];
    let _top = 0;
    let _phase = 0;

    const updateParticles = timeStep => {
        _top = -Water.AMPLITUDE;

        for (let i = _particles.length; i-- > 0;) {
            const particle = _particles[i];

            particle.vy += timeStep * 200;
            particle.x += particle.vx * timeStep;
            particle.y += particle.vy * timeStep;
            particle.radius -= 6 * timeStep;

            if (particle.radius < 0 || (particle.vy > 0 && particle.y - particle.radius > Water.AMPLITUDE))
                _particles.splice(i, 1);
            else if (particle.y - particle.radius < _top)
                _top = particle.y - particle.radius;
        }
    };

    /**
     * Update the water.
     * @param {Number} timeStep The number of seconds passed since the last update.
     */
    this.update = timeStep => {
        _phase += timeStep * Water.SPEED;

        if (_phase > Water.WAVE_PHASE_LIMIT)
            _phase -= Water.WAVE_PHASE_LIMIT;

        updateParticles(timeStep);
    };

    /**
     * Get all particles on this water plane.
     * @returns {Array} An array of particles, to be used by the water renderer.
     */
    this.getParticles = () => _particles;

    /**
     * Add a particle.
     * @param {Number} x The X position in pixels.
     * @param {Number} y The Y position in pixels.
     * @param {Number} dx The X velocity in pixels per second.
     * @param {Number} dy The Y velocity in pixels per second.
     * @param {Number} radius The initial radius in pixels.
     */
    this.addParticle = (x, y, dx, dy, radius) => {
        _particles.push(new Water.Particle(x, y, dx, dy, radius));
    };

    /**
     * Get the topmost pixel where water exists.
     * @returns {Number} The topmost pixel where water exists.
     */
    this.getTop = () => _top;

    /**
     * Sample the vertical displacement.
     * @param {Number} x The X location in pixels to sample at.
     * @returns {Number} The vertical displacement in pixels.
     */
    this.sample = x => {
        const left = Math.floor(x / Water.INTERVAL);
        const f = (x - left * Water.INTERVAL) / Water.INTERVAL;

        return this.sampleIndex(left) + (this.sampleIndex(left + 1) - this.sampleIndex(left)) * f;
    };

    /**
     * Sample the derivative.
     * @param {Number} x The X location in pixels to sample at.
     * @returns {Number} The derivative of the waves at this point.
     */
    this.sampleDerivative = x => {
        const left = Math.floor(x / Water.INTERVAL);
        const f = (x - left * Water.INTERVAL) / Water.INTERVAL;

        return this.sampleDerivativeIndex(left) + (this.sampleDerivativeIndex(left + 1) - this.sampleDerivativeIndex(left)) * f;
    };

    /**
     * Sample the vertical displacement at an anchor point index.
     * @param {Number} i The index to sample at. Indices are separated by Water.INTERVAL pixels.
     * @returns {Number} The vertical displacement in pixels.
     */
    this.sampleIndex = i => {
        const index = i * Water.SCALE * Water.INTERVAL;
        const phase = _phase * Math.PI * 2;

        return (
            _octaves[0] * Math.cos(index * Water.WAVE_INDEX_SCALE_A - phase * Water.WAVE_SCALE_A) +
            _octaves[1] * Math.cos(index * Water.WAVE_INDEX_SCALE_B - phase * Water.WAVE_SCALE_B) +
            _octaves[2] * Math.cos(index * Water.WAVE_INDEX_SCALE_C - phase * Water.WAVE_SCALE_C)
        ) * Water.AMPLITUDE;
    };

    /**
     * Sample the slope at an anchor point index.
     * @param {Number} i The index to sample at. Indices are separated by Water.INTERVAL pixels.
     * @returns {Number} The derivative of the waves at this point.
     */
    this.sampleDerivativeIndex = i => {
        const index = i * Water.SCALE * Water.INTERVAL;
        const phase = _phase * Math.PI * 2;

        return (
            _octaves[0] * Water.WAVE_SCALE_A * Math.sin(index * Water.WAVE_INDEX_SCALE_A - phase * Water.WAVE_SCALE_A) +
            _octaves[1] * Water.WAVE_SCALE_B * Math.sin(index * Water.WAVE_INDEX_SCALE_B - phase * Water.WAVE_SCALE_B) +
            _octaves[2] * Water.WAVE_SCALE_C * Math.sin(index * Water.WAVE_INDEX_SCALE_C - phase * Water.WAVE_SCALE_C)
        ) * -Water.AMPLITUDE / Water.INTERVAL;
    };

    /**
     * Create the effect of a downwards splashing object in this water plane.
     * @param {Number} left The leftmost pixel where the object enters the water.
     * @param {Number} right The rightmost pixel where the object enters the water.
     * @param {Number} velocity The velocity of the object.
     * @param {Number} mass The mass of the object.
     */
    this.splashDown = (left, right, velocity, mass) => {
        if (velocity < Water.SPLASH_SPEED_THRESHOLD)
            return;

        const intensity = velocity * mass;
        const particleCount = Math.ceil((right - left) * Water.PARTICLES_PER_PIXEL);

        for (let i = 0; i < particleCount; ++i) {
            const r = Math.random();
            const f = (1 - 2 * r) * (1 - 2 * r);
            const dir = Math.PI * (1.3 + f * 0.4);
            const speed = Math.min(
                Water.SPLASH_SPEED_MIN + Water.SPLASH_SPEED_MULTIPLIER * velocity * Math.pow(Math.random(), 2),
                Water.SPLASH_SPEED_MAX);
            const radius = Math.min(
                Water.SPLASH_RADIUS_MIN + Water.SPLASH_RADIUS_MULTIPLIER * intensity,
                Water.SPLASH_RADIUS_MAX);

            this.addParticle(
                left + (right - left) * f,
                Water.AMPLITUDE + radius,
                Math.cos(dir) * speed,
                Math.sin(dir) * speed,
                radius);
        }
    };
}

Water.Particle = function(x, y, vx, vy, radius) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
};

Water.AMPLITUDE = 3;
Water.WAVE_FUNCTION_PHASES = 3;
Water.WAVE_FUNCTION_FALLOFF = 1.3;
Water.WAVE_SCALE_A = 1;
Water.WAVE_SCALE_B = -1.41;
Water.WAVE_SCALE_C = 0.31;
Water.WAVE_INDEX_SCALE_A = 0.8;
Water.WAVE_INDEX_SCALE_B = 1.31;
Water.WAVE_INDEX_SCALE_C = 1.41;
Water.WAVE_PHASE_LIMIT = 100;
Water.INTERVAL = 16;
Water.SCALE = 0.08;
Water.SPEED = 1.2;
Water.PARTICLES_PER_PIXEL = 0.03;
Water.SPLASH_SPEED_THRESHOLD = 0.5;
Water.SPLASH_SPEED_MIN = 70;
Water.SPLASH_SPEED_MAX = 240;
Water.SPLASH_SPEED_MULTIPLIER = 25;
Water.SPLASH_RADIUS_MIN = 7;
Water.SPLASH_RADIUS_MAX = 20;
Water.SPLASH_RADIUS_MULTIPLIER = 0.14;