import {Terrain} from "../../../world/terrain/terrain";
import {World} from "../../../world/world";
import {Pcb} from "../../../pcb/pcb";
import {PcbRenderer} from "../../../pcb/pcbRenderer";
import {View} from "../../../view/view";
import {PcbEditorPlace} from "./pcbEditorPlace";
import {PcbEditorSelect} from "./pcbEditorSelect";
import {PcbEditorReshape} from "./pcbEditorReshape";
import {Selection} from "./selection";
import {PcbEditorEtch} from "./pcbEditorEtch";
import {Editor} from "../../editor";
import Myr from "../../../../lib/myr.js";
import {PcbFile} from "../../../pcb/pcbFile";

/**
 * The interactive Pcb editor which takes care of sizing & modifying a Pcb.
 * @param {RenderContext} renderContext A render context.
 * @param {World} world A world instance to interact with.
 * @param {View} view A View instance.
 * @param {Number} width The editor width.
 * @param {Number} height The editor height.
 * @param {Number} x The X position of the editor view in pixels.
 * @param {EditorOutput} output An EditorOutput object.
 * @constructor
 */
export function PcbEditor(renderContext, world, view, width, height, x, output) {
    const State = function(pcb, position) {
        this.getPcb = () => pcb;
        this.getPosition = () => position;
    };

    const KEY_UNDO = "z";
    const KEY_REDO = "y";
    const KEY_SAVE = "q";
    const UNDO_COUNT = 64;

    const _undoStack = [];
    const _redoStack = [];
    const _cursor = new Myr.Vector(-1, -1);
    const _pcbPosition = new Myr.Vector(0, 0);

    let _pcb = null;
    let _renderer = null;
    let _editor = null;
    let _stashedEditor = null;
    let _pressLocation = null;

    const matchWorldPosition = () => {
        world.getView().focus(
            view.getFocusX() + _pcbPosition.x * Terrain.PIXELS_PER_METER - x * 0.5 / view.getZoom(),
            view.getFocusY() + _pcbPosition.y * Terrain.PIXELS_PER_METER,
            view.getZoom());
    };

    const undoPop = () => {
        const newState = _undoStack.pop();

        if (newState) {
            _redoStack.push(new State(_pcb.copy(), _pcbPosition.copy()));

            this.edit(newState.getPcb(), newState.getPosition().x, newState.getPosition().y);
        }
    };

    const redoPop = () => {
        const newState = _redoStack.pop();

        if (newState) {
            _undoStack.push(new State(_pcb.copy(), _pcbPosition.copy()));

            this.edit(newState.getPcb(), newState.getPosition().x, newState.getPosition().y);
        }
    };

    const updateCursor = () => {
        const oldX = _cursor.x;
        const oldY = _cursor.y;

        _cursor.x = view.getMouse().x;
        _cursor.y = view.getMouse().y;

        view.getInverse().apply(_cursor);

        _cursor.x = Math.floor(_cursor.x / Pcb.PIXELS_PER_POINT);
        _cursor.y = Math.floor(_cursor.y / Pcb.PIXELS_PER_POINT);

        return _cursor.x !== oldX || _cursor.y !== oldY;
    };

    const moveCursor = () => {
        if (!_editor)
            return;

        _editor.moveCursor();
    };

    const mouseDown = () => {
        if (!_editor)
            return false;

        return _editor.mouseDown();
    };

    const mouseUp = () => {
        if (!_editor)
            return;

        _editor.mouseUp();
    };

    const updatePcb = pcb => {
        _pcb = pcb;

        if (_editor)
            _editor.updatePcb(pcb);

        if (_stashedEditor)
            _stashedEditor.updatePcb(pcb);
    };

    /**
     * Shift the PCB position.
     * @param {Number} dx The horizontal movement in pixels.
     * @param {Number} dy The vertical movement in pixels.
     */
    this.shift = (dx, dy) => {
        _pcbPosition.x += dx * Terrain.METERS_PER_PIXEL;
        _pcbPosition.y += dy * Terrain.METERS_PER_PIXEL;

        view.focus(view.getFocusX() - dx, view.getFocusY() - dy, view.getZoom());

        matchWorldPosition();
    };

    /**
     * Set an editor to be active in this PcbEditor.
     * @param {Object} editor One of the valid PCB editor objects.
     */
    this.setEditor = editor => {
        _stashedEditor = _editor;
        _editor = editor;
        _editor.makeActive();

        moveCursor();
    };

    /**
     * Revalidate the editor state and PCB graphics.
     */
    this.revalidate = () => {
        if(_renderer)
            _renderer.revalidate();

        updateCursor();
    };

    /**
     * Push the current PCB state to the undo stack.
     */
    this.undoPush = () => {
        _undoStack.push(new State(_pcb.copy(), _pcbPosition.copy()));

        if (_undoStack > UNDO_COUNT)
            _undoStack.splice(0, 1);

        _redoStack.length = 0;
    };

    /**
     * Cancel pushing the last undo state (using undoPush()).
     * Use this when an undo state was pushed, but nothing has changed.
     */
    this.undoPushCancel = () => {
        _undoStack.pop();

        _redoStack.length = 0;
    };

    /**
     * Revert to the previously active PCB editor.
     * @returns {Object} The previously active PCB editor.
     */
    this.revertEditor = () => {
        this.setEditor(_stashedEditor);

        return _editor;
    };

    /**
     * Get the output channels associated with this editor.
     * @returns {EditorOutput} The EditorOutput object.
     */
    this.getOutput = () => output;

    /**
     * Set the editors edit mode. Possible options are:
     * PcbEditor.EDIT_MODE_SELECT  for selection dragging.
     * PcbEditor.EDIT_MODE_RESHAPE for PCB reshaping.
     * PcbEditor.EDIT_MODE_ETCH for path etching.
     * @param {Object} mode Any of the valid edit modes.
     */
    this.setEditMode = mode => {
        output.getInfo().setPinouts(null);
        output.getOverlay().clearRulers();

        switch (mode) {
            case PcbEditor.EDIT_MODE_RESHAPE:
                this.setEditor(new PcbEditorReshape(renderContext, _pcb, _cursor, this));
                break;
            case PcbEditor.EDIT_MODE_SELECT:
                this.setEditor(new PcbEditorSelect(renderContext, _pcb, _cursor, this, new Selection(renderContext)));
                break;
            case PcbEditor.EDIT_MODE_ETCH:
                this.setEditor(new PcbEditorEtch(renderContext, _pcb, _cursor, this));
                break;
        }
    };

    /**
     * Update the state of the pcb editor.
     * @param timeStep The number of seconds passed after the previous update.
     */
    this.update = timeStep => {
        if (!_editor)
            return;

        _editor.update(timeStep);
    };

    /**
     * Draw the pcb editor.
     */
    this.draw = () => {
        renderContext.getMyr().push();
        renderContext.getMyr().translate(renderContext.getViewport().getSplitX(), 0);
        renderContext.getMyr().transform(view.getTransform());

        _renderer.drawBody(0, 0);
        _editor.draw(renderContext.getMyr());

        renderContext.getMyr().pop();
    };

    /**
     * Show the pcb editor.
     */
    this.show = () => {
        matchWorldPosition();

        _cursor.x = _cursor.y = -1;

        moveCursor();
    };

    /**
     * Hide the pcb editor.
     */
    this.hide = () => {
        view.onMouseRelease();
        _editor.reset();

        world.addPcb(_pcb, _pcbPosition.x, _pcbPosition.y);
    };

    /**
     * Start placing one or more parts.
     * @param {Array} fixtures An array of valid PcbEditorPlace.Fixture instances to place on the PCB.
     */
    this.place = fixtures => {
        _editor.reset();

        this.setEditor(new PcbEditorPlace(renderContext, _pcb, _cursor, this, fixtures, null));
    };

    /**
     * Start editing a pcb.
     * @param {Pcb} pcb A pcb instance to edit.
     * @param {Number} x The X position in the world in meters.
     * @param {Number} y The Y position in the world in meters
     */
    this.edit = (pcb, x, y) => {
        if (_renderer) {
            _renderer.free();

            const dx = (x - _pcbPosition.x) * Terrain.PIXELS_PER_METER;
            const dy = (y - _pcbPosition.y) * Terrain.PIXELS_PER_METER;

            view.focus(
                view.getFocusX() - dx,
                view.getFocusY() - dy,
                view.getZoom());
        }
        else
            view.focus(
                pcb.getWidth() * 0.5 * Pcb.PIXELS_PER_POINT,
                pcb.getHeight() * 0.5 * Pcb.PIXELS_PER_POINT,
                Editor.ZOOM_DEFAULT);

        updatePcb(pcb);

        _pcbPosition.x = x;
        _pcbPosition.y = y;
        _renderer = new PcbRenderer(renderContext, pcb);

        matchWorldPosition();
        this.revalidate();
        moveCursor();
    };

    /**
     * Get the pcb editor width
     * @returns {Number} The width of the editor in pixels.
     */
    this.getWidth = () => width;

    /**
     * Press the mouse.
     */
    this.onMousePress = () => {
        if (!mouseDown()) {
            _pressLocation = view.getMouse().copy();
            view.onMousePress();
        }
    };

    /**
     * Release the mouse.
     */
    this.onMouseRelease = () => {
        if (_pressLocation && _pressLocation.equals(view.getMouse()))
            _editor.reset();
        else
            mouseUp();

        _pressLocation = null;

        view.onMouseRelease();
    };

    /**
     * Move the mouse.
     * @param {Number} x The mouse x position in pixels.
     * @param {Number} y The mouse y position in pixels.
     */
    this.onMouseMove = (x, y) => {
        view.onMouseMove(x, y);

        if (view.isDragging())
            matchWorldPosition();

        if (updateCursor())
            moveCursor();
    };

    /**
     * The mouse enters.
     */
    this.onMouseEnter = () => {
        if (!_editor)
            return;

        _editor.onMouseEnter();
    };

    /**
     * The mouse leaves.
     */
    this.onMouseLeave = () => {
        if (!_editor)
            return;

        _editor.onMouseLeave();
        _editor.cancelAction();

        view.onMouseRelease();
    };

    /**
     * Zoom in.
     */
    this.zoomIn = () => {
        if (_editor.zoomIn())
            return;

        view.zoomIn();

        matchWorldPosition();
    };

    /**
     * Zoom out.
     */
    this.zoomOut = () => {
        if (_editor.zoomOut())
            return;

        view.zoomOut();

        matchWorldPosition();
    };

    /**
     * A key is pressed.
     * @param {String} key A key.
     * @param {Boolean} control Indicates whether the control button is pressed.
     */
    this.onKeyDown = (key, control) => {
        switch(key) {
            case KEY_UNDO:
                if (control)
                    undoPop();
                break;
            case KEY_REDO:
                if (control)
                    redoPop();
                break;
            case KEY_SAVE:
                if (control)
                    this.edit(PcbFile.fromPcb(_pcb).decode(), _pcbPosition.x, _pcbPosition.y);
                break;
            default:
                _editor.onKeyDown(key, control);
        }
    };

    /**
     * Free all resources occupied by this editor.
     */
    this.free = () => {
        if (_renderer)
            _renderer.free();
    };
}

PcbEditor.EDIT_MODE_SELECT = 0;
PcbEditor.EDIT_MODE_RESHAPE = 1;
PcbEditor.EDIT_MODE_ETCH = 2;