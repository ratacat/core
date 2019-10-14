'use strict';

const uuid = require('uuid/v4');
const Attributes = require('./Attributes');
const Character = require('./Character');
const Config = require('./Config');
const Logger = require('./Logger');
const Scriptable = require('./Scriptable');
const CommandQueue = require('./CommandQueue');

/**
 * @property {number} id   Area-relative id (vnum)
 * @property {Area}   area Area npc belongs to (not necessarily the area they're currently in)
 * @property {Map} behaviors
 * @extends Character
 * @mixes Scriptable
 */
class Npc extends Scriptable(Character) {
  constructor(area, data) {
    super(data);
    const validate = ['keywords', 'name', 'id'];

    for (const prop of validate) {
      if (!(prop in data)) {
        throw new ReferenceError(`NPC in area [${area.name}] missing required property [${prop}]`);
      }
    }

    this.area = data.area;
    this.script = data.script;
    this.behaviors = new Map(Object.entries(data.behaviors || {}));
    this.equipment = new Map();
    this.defaultEquipment = data.equipment || {};
    this.defaultItems = data.items || [];
    this.description = data.description;
    this.entityReference = data.entityReference; 
    this.id = data.id;
    this.keywords = data.keywords;
    this.quests = data.quests || [];
    this.uuid = data.uuid || uuid();
<<<<<<< HEAD
    this.commandQueue = new CommandQueue(this);
=======
    this.commandQueue = new CommandQueue();
>>>>>>> 56614d3215c4912a1553a989c18ed050fbf64a40
  }

  /**
   * Move the npc to the given room, emitting events appropriately
   * @param {Room} nextRoom
   * @param {function} onMoved Function to run after the npc is moved to the next room but before enter events are fired
   * @fires Room#npcLeave
   * @fires Room#npcEnter
   * @fires Npc#enterRoom
   */
  moveTo(nextRoom, onMoved = _ => _) {
    const prevRoom = this.room;
    if (this.room) {
      /**
       * @event Room#npcLeave
       * @param {Npc} npc
       * @param {Room} nextRoom
       */
      this.room.emit('npcLeave', this, nextRoom);
      this.room.removeNpc(this);
    }

    this.room = nextRoom;
    nextRoom.addNpc(this);

    onMoved();

    /**
     * @event Room#npcEnter
     * @param {Npc} npc
     * @param {Room} prevRoom
     */
    nextRoom.emit('npcEnter', this, prevRoom);
    /**
     * @event Npc#enterRoom
     * @param {Room} room
     */
    this.emit('enterRoom', nextRoom);
  }

  hydrate(state) {
    super.hydrate(state);
    state.MobManager.addMob(this);

    this.setupBehaviors(state.MobBehaviorManager);

    for (let defaultItemId of this.defaultItems) {
      
      const newItem = state.ItemFactory.create(this.area, defaultItemId);
      newItem.hydrate(state);
      state.ItemManager.add(newItem);
      this.addItem(newItem);
      //Logger.verbose(`\tDIST: Adding item [${newItem.name}w]] to npc [${this.name}w]]`);
    }

    for (let [slot, defaultEqId] of Object.entries(this.defaultEquipment)) {
      
      const newItem = state.ItemFactory.create(this.area, defaultEqId);
      newItem.hydrate(state);
      state.ItemManager.add(newItem);
      this.equip(newItem, slot);
      //Logger.verbose(`\tDIST: Equipping item [${newItem.name}w]] to npc [${this.name}w]] in slot [${slot}w]]`);
    }
  }

  get isNpc() {
    return true;
  }
}

module.exports = Npc;
