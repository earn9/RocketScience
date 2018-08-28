import {PartRenderer} from "../../part/partRenderer";
import {Pcb} from "../../pcb/pcb";
import * as Myr from "../../../lib/myr";
import {Part} from "../../part/part";
import {getPartBehavior} from "../../part/objects";
import "../../part/objects"

/**
 * A placement editor used to place a part on a pcb.
 * @param {Sprites} sprites A sprites instance.
 * @param {Pcb} pcb The PCB currently being edited.
 * @param {Myr.Vector} cursor The cursor position in cells.
 * @param {Object} editor An interface provided by the Editor to influence the editor.
 * @param {Array} fixtures An array of valid PcbEditorPlace.Fixture instances to place on the PCB.
 * @param {Selection} selection An optional selection which will be reinstated when placement has succeeded.
 * @constructor
 */
export function PcbEditorPlace(sprites, pcb, cursor, editor, fixtures, selection) {
    const COLOR_UNSUITABLE = new Myr.Color(1, 0, 0, 0.5);

    const _lastCursor = cursor.copy();
    const _renderers = [];
    let _configurationIndex = 0;
    let _suitable = false;

    const makeRenderers = () => {
        _renderers.splice(0, _renderers.length);

        for (const fixture of fixtures) {
            if (fixture.isInstance())
                _renderers.push(new PartRenderer(sprites, fixture.part.getConfiguration()));
            else
                _renderers.push(new PartRenderer(sprites, fixture.part.configurations[_configurationIndex]));
        }
    };

    const isSuitable = fixture => {
        let footprint = null;

        if (fixture.isInstance())
            footprint = fixture.part.getConfiguration().footprint;
        else
            footprint = fixture.part.configurations[_configurationIndex].footprint;

        for (const point of footprint.points) {
            const pcbPoint = pcb.getPoint(cursor.x + point.x + fixture.x, cursor.y + point.y + fixture.y);

            if (!pcbPoint || pcbPoint.part !== null)
                return false;
        }

        for (const point of footprint.space) {
            const pcbPoint = pcb.getPoint(cursor.x + point.x + fixture.x, cursor.y + point.y + fixture.y);

            if (!pcbPoint)
                return false;
        }

        for (const point of footprint.air)
            if (pcb.getPoint(cursor.x + point.x + fixture.x, cursor.y + point.y + fixture.y))
                return false;

        return true;
    };

    const getConfigurationCount = () => {
        if (fixtures.length > 1)
            return 1;

        const fixture = fixtures[0];

        if (fixture.isInstance())
            return fixture.part.getDefinition().configurations.length;
        else
            return fixture.part.configurations.length;
    };

    const canReconfigure = () => !selection;

    const nextConfiguration = () => {
        _configurationIndex = (_configurationIndex + 1) % getConfigurationCount();

        makeRenderers();
        this.moveCursor();
    };

    const previousConfiguration = () => {
        if (--_configurationIndex === -1)
            _configurationIndex = getConfigurationCount() - 1;

        makeRenderers();
        this.moveCursor();
    };

    /**
     * Change the PCB being edited.
     * @param {Pcb} newPcb The new PCB to edit.
     */
    this.updatePcb = newPcb => {
        pcb = newPcb;
    };

    /**
     * A key is pressed.
     * @param {String} key A key.
     * @param {Boolean} control Indicates whether the control button is pressed.
     */
    this.onKeyDown = (key, control) => {

    };

    /**
     * Tell the editor the cursor has moved.
     */
    this.moveCursor = () => {
        _suitable = true;

        for (const fixture of fixtures) {
            if (!isSuitable(fixture)) {
                _suitable = false;

                break;
            }
        }

        if (selection) {
            if (!_lastCursor.equals(cursor)) {
                selection.move(cursor.x - _lastCursor.x, cursor.y - _lastCursor.y);

                _lastCursor.x = cursor.x;
                _lastCursor.y = cursor.y;
            }
        }
    };

    /**
     * Start dragging action.
     * @returns {Boolean} A boolean indicating whether a drag event has started.
     */
    this.mouseDown = () => {
        if (_suitable) {
            editor.undoPush();

            if (selection)
                selection.clearSelected();

            for (const fixture of fixtures) {
                let part = null;

                if (fixture.isInstance())
                    part = new Part(
                        fixture.part.getDefinition(),
                        fixture.part.getConfigurationIndex(),
                        new (getPartBehavior(fixture.part.getDefinition().object))());
                else
                    part = new Part(
                        fixture.part,
                        _configurationIndex,
                        new (getPartBehavior(fixture.part.object))());

                const pcbFixture = pcb.place(
                    part,
                    cursor.x + fixture.x,
                    cursor.y + fixture.y);

                if (selection)
                    selection.addSelected(pcbFixture);
            }

            editor.revalidate();
            editor.revert();

            return true;
        }
        else {
            if (selection !== null)
                selection.clearSelected();

            editor.revert();

            return false;
        }
    };

    /**
     * Finish the current dragging action.
     */
    this.mouseUp = () => {
        this.mouseDown();
    };

    /**
     * Zoom in.
     * @returns {Boolean} A boolean indicating whether this editor handled the action.
     */
    this.zoomIn = () => {
        if (!canReconfigure())
            return false;

        nextConfiguration();

        return true;
    };

    /**
     * Zoom out.
     * @returns {Boolean} A boolean indicating whether this editor handled the action.
     */
    this.zoomOut = () => {
        if (!canReconfigure())
            return false;

        previousConfiguration();

        return true;
    };

    /**
     * Cancel any actions deviating from this editors base state.
     */
    this.cancelAction = () => {

    };

    /**
     * Reset the editor's current state.
     */
    this.reset = () => {
        this.cancelAction();
    };

    /**
     * Update this editor.
     * @param {Number} timeStep The time passed since the last update in seconds.
     */
    this.update = timeStep => {

    };

    /**
     * Draw this editor.
     * @param {Myr} myr A myriad instance.
     */
    this.draw = myr => {
        if (!_suitable)
            myr.setColor(COLOR_UNSUITABLE);

        for (let i = 0; i < fixtures.length; ++i)
            _renderers[i].draw(
                (cursor.x + fixtures[i].x) * Pcb.PIXELS_PER_POINT,
                (cursor.y + fixtures[i].y) * Pcb.PIXELS_PER_POINT);

        if (!_suitable)
            myr.setColor(Myr.Color.WHITE);

        if (selection !== null)
            selection.draw();
    };

    if (fixtures.length === 1 && fixtures[0].isInstance())
        _configurationIndex = fixtures[0].part.getConfigurationIndex();

    makeRenderers();
}

/**
 * A part to place with an offset.
 * @param {Object} part Either a part definition as defined in parts.json or a Part instance.
 * @param {Number} x The X offset.
 * @param {Number} y The Y offset.
 * @constructor
 */
PcbEditorPlace.Fixture = function(part, x, y) {
    this.part = part;
    this.x = x;
    this.y = y;
};

PcbEditorPlace.Fixture.prototype.isInstance = function() {
    return this.part.configurations === undefined;
};