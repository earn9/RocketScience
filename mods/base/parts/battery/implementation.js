/**
 * A battery.
 * @param {Object} context An object containing the game context, and references to some important utils.
 * @constructor
 */
function Battery(context) {
    const PIN_COUNT = 4;

    /**
     * Initialize the state.
     * @param {Physics} body A physics body to apply state to.
     */
    this.initialize = body => {

    };

    /**
     * Update the state.
     * @param {Array} state A state array to read from and/or write to.
     */
    this.tick = state => {
        for (let pin = 0; pin < PIN_COUNT; ++pin)
            state[context.pins[pin]] = 1;
    };
}