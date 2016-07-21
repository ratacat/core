const util = require('util');

const Type   = require('./type').Type;
const Random = require('./random').Random;
const _ = require('./helpers');

//TODO: Eventually, have API for both NPCs and Players.

/**
* The purpose of this class is to standardize
* the realtime combat API between players & NPCs.
*/

/**
* Generic func to apply all mods to a stat,
* starting with the base stat.
*/
const applyMod  = (stat, modifier) => modifier(stat)
const applyMods = (base, modsObj)  => _
  .reduceValues(modsObj, applyMod, base);

function CombatHelper(entity) {
  this._entity = entity;

  /*
   * Example modifier: {
      name: 'berserk',
      effect: damage => damage * 2
    }
   * Speed mods will affect time in between attacks
   * in milliseconds. So, doubling it will half attack speed.
   */
  this.speedMods   = {};
  this.damageMods  = {};
  this.toHitMods   = {};
  this.defenseMods = {};
  this.dodgeMods   = {};

  this.addMod = type =>
    modifier => this[type][modifier.name] = modifier.effect;

  this.addSpeedMod   = this.addMod('speedMods');
  this.addDamageMod  = this.addMod('damageMods');
  this.addToHitMod   = this.addMod('toHitMods');
  this.addDefenseMod = this.addMod('defenseMods');
  this.addDodgeMod   = this.addMod('dodgeMods');

  this.deleteMod = type =>
    name => delete this[type][name];

  this.removeSpeedMod   = this.deleteMod('speedMods');
  this.removeDamageMod  = this.deleteMod('damageMods');
  this.removeToHitMod   = this.deleteMod('toHitMods');
  this.removeDefenseMod = this.deleteMod('defenseMods');
  this.removeDodgeMod   = this.deleteMod('dodgeMods');

  this.deleteAllMods = name => {
    if (!name) { return false; } //TODO: Eventually, remove all mods?
    this.removeSpeedMod(name);
    this.removeDamageMod(name);
    this.removeToHitMod(name);
  };

  /**
   * Get hydrated primary or offhand weapon of player/npc.
   */
  this.getWeapon  = location => this._entity
    .getEquipped(location || 'wield', true);

  this.getOffhand = () => this.getWeapon('offhand');


  /**
   * Get just the name of the attack.
   */
  this.getAttackName = location => this
    .getWeapon(location)
    .getShortDesc('en');

  this.getPrimaryAttackName   = () => this.getAttackName('wield');
  this.getSecondaryAttackName = () => this.getAttackName('offhand');

  /**
  * Gets damage range from weapon obj
  * @param   Weapon obj
  * @param   Base possible damage for hand-to-hand
  * @return  Array of [min, max] damage range
  */
  const getWeaponDamage = (weapon, base) => weapon ?
    (weapon.getAttribute('damage') ?
      weapon.getAttribute('damage')
        .split('-')
        .map(dmg => parseInt(dmg, 10)) :
        base) :
      base;

  /**
   * Get the damage a player can do
   * @return int
   */
  this.getDamage = location => {
    location = location || 'wield';

    const self   = this._entity;
    const weapon = self.getEquipped(location, true);
    const base   = [ 1, self.getAttribute('stamina') + 5 ];

    const damageRange = getWeaponDamage(weapon, base);

    const damageRoll = Random.inRange(...damageRange);

    const min = damageRange[0];
    const modifiedDamageRoll = applyMods(damageRoll, this.damageMods);

    const damageWithinBounds = _.setBounds(min, Infinity);
    const damageDealt = damageWithinBounds(modifiedDamageRoll);

    util.log('Deals damage: ', damageDealt);

    return damageDealt;
  };

  const getWeaponSpeed = (weapon, base, factor) => (weapon ?
    weapon.getAttribute('speed') : base) * factor;

  /**
   * Get attack speed of a player
   * @return float milliseconds between attacks
   */
  this.getAttackSpeed = secondAttack => {
    const weapon  = secondAttack ? this.getWeapon() : this.getOffhand();

    const minimum = secondAttack ? 750 : 500;
    const maximum = 10 * 1000;

    const speedWithinBounds = _.setBounds(minimum, maximum);

    const unarmedSpeed    = this._entity.getAttribute('quickness');
    const weaponSpeed     = getWeaponSpeed(weapon, unarmedSpeed, 500);
    const attributesSpeed = unarmedSpeed * 500
      + this._entity.getAttribute('cleverness') * 250;

    const baseSpeed = maximum - weaponSpeed - attributesSpeed;

    util.log("Their base speed is ", baseSpeed);

    const speed = applyMods(baseSpeed, this.speedMods);

    util.log("Their modified speed is ", speed);

    return speedWithinBounds(speed);
  };

  this.getDodgeChance = () => {
    const dodgeSkill = this._entity.getSkills('dodge') + Random.roll();
    const dodgeBonus = this._entity.getAttribute('quickness')
      + Math.round(this._entity.getAttribute('cleverness') / 2);
    const dodgeChance = applyMods(dodgeSkill + dodgeBonus, this.dodgeMods);
    const dodgeWithinBounds = _.setBounds(5, 90);
    util.log('Dodge chance is ', dodgeChance);
    return dodgeWithinBounds(dodgeChance);
  }

  return this;
}

this.getToHitChance = () => {
  //TODO: Weapon skills related to weapon type?
  //TODO: General combat skills?
  // Replace 1 with skill get.
  const toHitSkill = this._entity.getAttribute('level') + Random.roll(); //For now, 1-20.
  const toHitBonus = this._entity.getAttribute('cleverness')
    + Math.round(this._entity.getAttribute('quickness') / 2);
  const toHitChance = applyMods(toHitSkill + toHitBonus, this.toHitMods);
  const toHitWithinBounds = _.setBounds(5, 90);
  util.log('To hit chance is ', toHitChance);
  return toHitWithinBounds(toHitChance);
}

this.getDefense = () => {
  //TODO: Replace with defense func from player.
  return this._entity.getAttribute('level') * 2;
}

function getHelper(entity) {
  return new CombatHelper(entity);
}

exports.CombatUtil   = { getHelper };
exports.CombatHelper = CombatHelper;
