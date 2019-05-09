import {Pcb} from "../../pcb/pcb";
import Myr from "myr.js"
import {EditableRegion} from "./editableRegion";
import {BudgetInventory} from "../budget/budgetInventory";

/**
 * A definition of an editable PCB (and its part budget).
 * @param {EditableRegion} region The editable region of this editable.
 * @param {Pcb} pcb The default pcb for this editable.
 * @param {Myr.Vector} pcbOffset The PCB's offset within its region.
 * @param {BudgetInventory} budget A part budget, or null if there is no budget.
 * @constructor
 */
export function Editable(region, pcb, pcbOffset, budget) {
    const _position = new Myr.Vector(0, 0);

    const calculatePosition = () => {
        _position.x = region.getOrigin().x + pcbOffset.x;
        _position.y = region.getOrigin().y + pcbOffset.y;
    };

    /**
     * Get the region this editable is in.
     * @returns {EditableRegion}
     */
    this.getRegion = () => region;

    /**
     * Get the PCB of this editable.
     * @returns {Pcb} A pcb.
     */
    this.getPcb = () => pcb;

    /**
     * Update the pcb of this editable.
     * @param {Pcb} newPcb A new root pcb.
     */
    this.setPcb = newPcb => pcb = newPcb;

    /**
     * Get the part budget of this editable.
     * @returns {BudgetInventory} A part budget.
     */
    this.getBudget = () => budget;

    /**
     * Get the offset of the pcb in the editable region.
     * @returns {Myr.Vector} The offset in meters.
     */
    this.getOffset = () => pcbOffset;

    /**
     * Move the PCB offset in the editable region.
     * @param {Number} dx The horizontal movement in meters.
     * @param {Number} dy The vertical movement in meters.
     */
    this.moveOffset = (dx, dy) => {
        pcbOffset.x += dx;
        pcbOffset.y += dy;

        calculatePosition();
    };

    /**
     * Get the PCB position in the world.
     * @returns {Myr.Vector} The PCB position in the world in meters.
     */
    this.getPosition = () => _position;

    calculatePosition();

    this.serialize = buffer => {
        this.getRegion().serialize(buffer);
        this.getPcb().serialize(buffer);

        buffer.writeByte(this.getOffset().x);
        buffer.writeByte(this.getOffset().y);

        let byte = (this.getBudget() === null)?Editable.SERIALIZE_BIT_BUDGET_NULL:0;
        buffer.writeByte(byte);

        if (!(byte & Editable.SERIALIZE_BIT_BUDGET_NULL))
            this.getBudget().serialize(buffer);
    };
}

Editable.deserialize = buffer => {
    let region = EditableRegion.deserialize(buffer);
    let pcb = Pcb.deserialize(buffer);
    let offset = new Myr.Vector(buffer.readByte(), buffer.readByte());
    let budget = null;

    let byte = buffer.readByte();
    if (!(byte & Editable.SERIALIZE_BIT_BUDGET_NULL))
        budget = BudgetInventory.deserialize(buffer);

    return new Editable(region, pcb, offset, budget);
};

Editable.UNDO_COUNT = 64;
Editable.SERIALIZE_BIT_BUDGET_NULL = 0x10;