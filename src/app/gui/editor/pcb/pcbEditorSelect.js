import {Pcb} from "../../../pcb/pcb";
import {PcbEditorPlace} from "./pcbEditorPlace";
import {Selection} from "./selection";
import {OverlayRulerDefinition} from "../overlay/rulers/overlayRulerDefinition";
import {PartSummary} from "../../../pcb/partSummary";
import {Budget} from "../../../mission/budget/budget";
import {BudgetInventory} from "../../../mission/budget/budgetInventory";
import Myr from "myr.js"

/**
 * An extend editor, able to extend the current PCB.
 * @param {RenderContext} renderContext A render context.
 * @param {Pcb} pcb The PCB currently being edited.
 * @param {Myr.Vector} cursor The cursor position in cells.
 * @param {PcbEditor} editor A PCB editor.
 * @param {Selection} selection A selection.
 * @param {Object} budget A part budget to take into account. May be null.
 * @constructor
 */
export function PcbEditorSelect(renderContext, pcb, cursor, editor, selection, budget) {
    const _cursorDrag = new Myr.Vector(0, 0);
    let _selectable = false;
    let _dragging = false;
    let _moveStart = null;
    let _lastMouseDown = new Myr.Vector(0, 0);

    const move = start => {
        const moveFixtures = [];

        for (const fixture of selection.getSelected())
            moveFixtures.push(new PcbEditorPlace.Fixture(
                fixture.part.copy(),
                fixture.x - start.x,
                fixture.y - start.y));

        deleteSelectedParts();

        editor.getEditor().getOverlay().clearRulers();
        selection.move(cursor.x - start.x, cursor.y - start.y);

        editor.setEditor(new PcbEditorPlace(renderContext, pcb, cursor, editor, moveFixtures, selection));
    };

    const budgetAllows = fixtures => {
        if (!budget)
            return true; // TODO: Provide some feedback here

        switch (budget.getType()) {
            case Budget.TYPE_INVENTORY:
                const summary = new PartSummary();

                summary.merge(new PartSummary(pcb));

                for (const fixture of fixtures) if (fixture.part)
                    summary.register(fixture.part.getDefinition().object);

                for (const fixture of fixtures) if (fixture.part) {
                    const count = budget.getCount(fixture.part.getDefinition().object);

                    if (count !== null && count !== BudgetInventory.COUNT_INFINITE && count < summary.getPartCount(fixture.part.getDefinition().object))
                        return false;
                }

                break;
        }

        return true;
    };

    const copy = () => {
        if (!budgetAllows(selection.getSelected()))
            return;

        const placeFixtures = [];

        for (const fixture of selection.getSelected())
            placeFixtures.push(new PcbEditorPlace.Fixture(
                fixture.part.copy(),
                fixture.x - selection.getLeft(),
                fixture.y - selection.getTop()));

        editor.getUndoStack().push();
        editor.getEditor().getOverlay().clearRulers();
        selection.move(cursor.x - selection.getLeft(), cursor.y - selection.getTop());

        editor.setEditor(new PcbEditorPlace(renderContext, pcb, cursor, editor, placeFixtures, selection));
    };

    const moveSelection = delta => {
        if (selection.getSelected().length === 0)
            return;

        const _moveFixtures = [];
        let _canMove = true;

        editor.getUndoStack().push();

        for (const fixture of selection.getSelected()) {
            _moveFixtures.push(fixture);

            pcb.remove(fixture.part);
        }

        for (const fixture of selection.getSelected()) {
            if (!pcb.fits(fixture.x + delta.x, fixture.y + delta.y, fixture.part.getConfiguration())) {
                _canMove = false;

                break;
            }
        }

        if (!_canMove) {
            delta.x = delta.y = 0;

            editor.getUndoStack().pushCancel();
        }

        selection.clearSelected();

        for (const fixture of _moveFixtures)
            selection.addSelected(pcb.place(fixture.part, fixture.x + delta.x, fixture.y + delta.y));

        selection.move(delta.x, delta.y);
        updateSelectedInfo();
        editor.revalidate();
    };

    const isPartSelected = part => {
        for (const fixture of selection.getSelected())
            if (fixture.part === part)
                return true;

        return false;
    };

    const findSelectedParts = () => {
        selection.clearSelected();

        for (let y = selection.getTop(); y <= selection.getBottom(); ++y) {
            for (let x = selection.getLeft(); x <= selection.getRight(); ++x) {
                const pcbPoint = pcb.getPoint(x, y);

                if (pcbPoint !== null && pcbPoint.part !== null && !isPartSelected(pcbPoint.part))
                    selection.addSelected(pcb.getFixture(pcbPoint.part));
            }
        }
    };

    const deleteSelectedParts = () => {
        editor.getUndoStack().push();

        for (const fixture of selection.getSelected())
            pcb.remove(fixture.part);

        editor.revalidate();
    };

    const updateSelectedInfo = () => {
        if (selection.getSelected().length === 1)
            editor.getEditor().getInfo().setPinouts(
                selection.getSelected()[0].part.getConfiguration(),
                selection.getSelected()[0].x,
                selection.getSelected()[0].y);
        else
            editor.getEditor().getInfo().setPinouts(null);

        if (selection.getSelected().length > 1)
            editor.getEditor().getOverlay().makeRulers([
                new OverlayRulerDefinition(
                    selection.getLeft(),
                    selection.getBottom() + 1,
                    OverlayRulerDefinition.DIRECTION_RIGHT,
                    selection.getRight() - selection.getLeft() + 1),
                new OverlayRulerDefinition(
                    selection.getRight() + 1,
                    selection.getBottom() + 1,
                    OverlayRulerDefinition.DIRECTION_UP,
                    selection.getBottom() - selection.getTop() + 1)
            ]);
        else
            editor.getEditor().getOverlay().clearRulers();
    };

    const selectAll = () => {
        selection.clearSelected();

        for (const fixture of pcb.getFixtures())
            selection.addSelected(fixture);

        PcbEditorSelect.crop(selection);

        updateSelectedInfo();
    };

    /**
     * Select a fixture.
     * @param {Array} fixtures An array of fixtures to select.
     */
    this.select = fixtures => {
        selection.clearSelected();

        for (const fixture of fixtures)
            selection.addSelected(fixture);

        PcbEditorSelect.crop(selection);

        updateSelectedInfo();
    };

    /**
     * Change the PCB being edited.
     * @param {Pcb} newPcb The new PCB to edit.
     */
    this.updatePcb = newPcb => {
        selection.clearSelected();

        updateSelectedInfo();

        pcb = newPcb;
    };

    /**
     * A key event has been fired.
     * @param {KeyEvent} event A key event.
     */
    this.onKeyEvent = event => {
       if (event.down) switch (event.key) {
            case PcbEditorSelect.KEY_DELETE:
                if (!editor.getEditor().getInfo().isHovering() && selection.getSelected().length > 0) {
                    deleteSelectedParts();

                    selection.clearSelected();
                    updateSelectedInfo();

                    this.moveCursor();
                }

                break;
            case PcbEditorSelect.KEY_COPY:
                if (event.control && selection.getSelected().length > 0)
                    copy();

                break;
            case PcbEditorSelect.KEY_SELECT_ALL:
                if (event.control)
                    selectAll();

                break;
            case PcbEditorSelect.KEY_LEFT:
                moveSelection(new Myr.Vector(-1, 0));

                break;
            case PcbEditorSelect.KEY_UP:
                moveSelection(new Myr.Vector(0, -1));

                break;
            case PcbEditorSelect.KEY_RIGHT:
                moveSelection(new Myr.Vector(1, 0));

                break;
            case PcbEditorSelect.KEY_DOWN:
                moveSelection(new Myr.Vector(0, 1));

                break;
        }
    };

    /**
     * Tell the editor the cursor has moved.
     */
    this.moveCursor = () => {
        if (_dragging)
            selection.setRegion(
                Math.min(cursor.x, _cursorDrag.x),
                Math.max(cursor.x, _cursorDrag.x),
                Math.min(cursor.y, _cursorDrag.y),
                Math.max(cursor.y, _cursorDrag.y));
        else {
            if (_moveStart !== null) {
                move(_moveStart);

                _moveStart = null;
            }
            else {
                _selectable = pcb.getPoint(cursor.x, cursor.y) !== null;

                if (selection.getSelected().length === 0)
                    selection.setRegion(cursor.x, cursor.x, cursor.y, cursor.y);
            }
        }
    };

    /**
     * Tell the editor the mouse has moved.
     * @param {Number} x The mouse position on the screen in pixels.
     * @param {Number} y The mouse position on the screen in pixels.
     */
    this.mouseMove = (x, y) => {

    };

    /**
     * Start dragging action.
     * @param {Number} x The mouse x position in pixels.
     * @param {Number} y The mouse y position in pixels.
     * @returns {Boolean} A boolean indicating whether a drag event has started.
     */
    this.mouseDown = (x, y) => {
        _lastMouseDown.x = x;
        _lastMouseDown.y = y;

        if (selection.getSelected().length > 0 && selection.contains(cursor.x, cursor.y)) {
            _moveStart = cursor.copy();

            return true;
        }
        else if (_selectable) {
            selection.clearSelected();
            updateSelectedInfo();

            _cursorDrag.x = cursor.x;
            _cursorDrag.y = cursor.y;
            _dragging = true;

            this.moveCursor();

            return true;
        }

        return false;
    };

    /**
     * Finish the current dragging action.
     * @param {Number} x The mouse x position in pixels.
     * @param {Number} y The mouse y position in pixels.
     */
    this.mouseUp = (x, y) => {
        if (_dragging) {
            findSelectedParts();

            _dragging = false;

            if (selection.getSelected().length === 0)
                this.moveCursor();
            else
                PcbEditorSelect.crop(selection);

            updateSelectedInfo();
        }
        else if (_moveStart && _moveStart.equals(cursor)) {
            _moveStart = null;

            selection.setRegion(cursor.x, cursor.x, cursor.y, cursor.y);

            findSelectedParts();

            if (selection.getSelected().length > 0)
                PcbEditorSelect.crop(selection);

            updateSelectedInfo();
        }
        else if (_lastMouseDown.x === x && _lastMouseDown.y === y && selection.getSelected().length !== 0) {
            selection.clearSelected();

            updateSelectedInfo();
        }
    };

    /**
     * Zoom in.
     * @returns {Boolean} A boolean indicating whether this editor handled the action.
     */
    this.zoomIn = () => false;

    /**
     * Zoom out.
     * @returns {Boolean} A boolean indicating whether this editor handled the action.
     */
    this.zoomOut = () => false;

    /**
     * The mouse enters.
     */
    this.onMouseEnter = () => {

    };

    /**
     * The mouse leaves.
     */
    this.onMouseLeave = () => {
        this.cancelAction();
    };

    /**
     * Cancel any actions deviating from this editors base state.
     */
    this.cancelAction = () => {
        _dragging = false;

        this.moveCursor();
    };

    /**
     * Reset the editor's current state.
     */
    this.reset = () => {
        selection.clearSelected();

        updateSelectedInfo();

        this.cancelAction();
    };

    /**
     * Update this editor.
     * @param {Number} timeStep The time passed since the last update in seconds.
     */
    this.update = timeStep => {

    };

    /**
     * Make this editor active.
     */
    this.makeActive = () => {
        updateSelectedInfo();
    };

    /**
     * Draw this editor.
     */
    this.draw = () => {
        if (!editor.getEditor().getInfo().isHovering() && (_selectable || selection.getSelected().length > 0))
            selection.draw();
    };
}

PcbEditorSelect.crop = selection => {
    let left = undefined;
    let top = undefined;
    let right = undefined;
    let bottom = undefined;

    for (const fixture of selection.getSelected()) {
        for (const point of fixture.part.getConfiguration().footprint.points) {
            if (left === undefined || point.x + fixture.x < left)
                left = point.x + fixture.x;

            if (right === undefined || point.x + fixture.x > right)
                right = point.x + fixture.x;

            if (top === undefined || point.y + fixture.y < top)
                top = point.y + fixture.y;

            if (bottom === undefined || point.y + fixture.y > bottom)
                bottom = point.y + fixture.y;
        }
    }

    selection.setRegion(left, right, top, bottom);
};

PcbEditorSelect.KEY_DELETE = "Delete";
PcbEditorSelect.KEY_COPY = "c";
PcbEditorSelect.KEY_SELECT_ALL = "a";
PcbEditorSelect.KEY_LEFT = "ArrowLeft";
PcbEditorSelect.KEY_UP = "ArrowUp";
PcbEditorSelect.KEY_RIGHT = "ArrowRight";
PcbEditorSelect.KEY_DOWN = "ArrowDown";