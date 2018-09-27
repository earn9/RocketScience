import {Terrain} from "./terrain/terrain";
import {View} from "../view/view";
import {Physics} from "./physics/physics";
import {WorldObject} from "./worldObject";
import {ZoomProfile} from "../view/zoomProfile";
import {ShiftProfile} from "../view/shiftProfile";
import {TerrainRugged} from "./terrain/terrainRugged";
import Myr from "../../lib/myr";

/**
 * Simulates physics and led for all objects in the same space.
 * @param {RenderContext} renderContext A render context.
 * @constructor
 */
export function World(renderContext) {
    const _objects = [];
    const _physics = new Physics(World.GRAVITY);
    const _terrain = new Terrain(renderContext.getMyr(), new TerrainRugged(Math.random(), 100, 0.2, 0.5));
    const _view = new View(
        renderContext.getWidth(),
        renderContext.getHeight(),
        new ZoomProfile(
            ZoomProfile.TYPE_CONTINUOUS,
            World.ZOOM_FACTOR,
            1,
            World.ZOOM_MIN,
            World.ZOOM_MAX),
        new ShiftProfile(
            0));

    let _surface = new (renderContext.getMyr().Surface)(renderContext.getWidth(), renderContext.getHeight());
    let _tickCounter = 0;
    let _paused = false;

    /**
     * Add a new pcb to simulate in the world.
     * @param {Pcb} pcb The pcb to add.
     * @param {Number} x The x-position.
     * @param {Number} y The y-position.
     */
    this.addPcb = (pcb, x, y) => {
        _objects.push(new WorldObject(renderContext, _physics, pcb, x, y));
    };

    /**
     * Get the view object.
     * @returns {View} The view object applied to this world.
     */
    this.getView = () => _view;

    /**
     * Press the mouse.
     */
    this.onMousePress = () => {
        _view.onMousePress();
    };

    /**
     * Release the mouse.
     */
    this.onMouseRelease = () => {
        _view.onMouseRelease();
    };

    /**
     * Move the mouse.
     * @param {Number} x The mouse x position in pixels.
     * @param {Number} y The mouse y position in pixels.
     */
    this.onMouseMove = (x, y) => {
        _view.onMouseMove(x, y);
    };

    /**
     * Zoom in.
     */
    this.zoomIn = () => {
        _view.zoomIn();
    };

    /**
     * Zoom out.
     */
    this.zoomOut = () => {
        _view.zoomOut();
    };

    /**
     * Pause the world.
     */
    this.pause = () => {
        _paused = true;
    };

    /**
     * Unpause the world.
     */
    this.unpause = () => {
        _paused = false;
    };

    /**
     * Activate the world.
     */
    this.activate = () => {

    };

    /**
     * Deactivate the world.
     */
    this.deactivate = () => {
        _view.onMouseRelease();

        while (_objects.length > 0)
            _objects.pop().free();
    };

    /**
     * Update the state of the world.
     * @param {Number} timeStep The number of seconds passed after the previous update.
     */
    this.update = timeStep => {
        if (!_paused) {
            _physics.update(1 / 60);

            let tick = 0;
            _tickCounter -= timeStep;

            while (_tickCounter < 0) {
                _tickCounter += World.TICK_DELAY;
                ++tick;
            }

            for (let index = 0; index < _objects.length; index++) {
                for (let i = 0; i < tick; ++i)
                    _objects[index].tick();

                _objects[index].update(timeStep);
            }
        }

        _surface.bind();
        _surface.clear();

        renderContext.getMyr().push();
        renderContext.getMyr().transform(_view.getTransform());

        _terrain.draw();

        for (let index = 0; index < _objects.length; index++)
            _objects[index].draw( renderContext.getMyr());

        renderContext.getMyr().pop();
    };

    /**
     * Draw the world
     */
    this.draw = () => {
        _surface.draw(0, 0);
    };

    /**
     * Call when the render context has resized.
     * @param {Number} width The width in pixels.
     * @param {Number} height The height in pixels.
     */
    this.resize = (width, height) => {
        _view.resize(width, height);

        _surface.free();
        _surface = new (renderContext.getMyr().Surface)(renderContext.getWidth(), renderContext.getHeight());
        _surface.setClearColor(World.COLOR_CLEAR);
    };

    /**
     * Free all resources occupied by the world
     */
    this.free = () => {
        this.deactivate();

        _surface.free();
        _physics.free();
    };

    _view.focus(-_terrain.getWidth() * 0.5, 0, 0.5);
    _surface.setClearColor(World.COLOR_CLEAR);
    _terrain.makeTerrain(_physics);
}

World.COLOR_CLEAR = new Myr.Color(0.5, 0.6, 0.7);
World.ZOOM_FACTOR = 0.25;
World.ZOOM_MIN = 0.25;
World.ZOOM_MAX = 8;
World.GRAVITY = 9.81;
World.TPS = 15;
World.TICK_DELAY = 1 / World.TPS;