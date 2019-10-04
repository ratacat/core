'use strict';

const ansi = require('sty');
const { Logger } = require('./Logger');
const lineWrap = require('wrap-ansi');
const mudcolors = require('mudcolors');
const _ = require('lodash');
ansi.enable(); // force ansi on even when there isn't a tty for the server


/** @typedef {{getBroadcastTargets: function(): Array}} */
var Broadcastable;

/** THIS IS THE CORE BROADCAST, IT"S ONLY USED FOR CHANNELS!!!!!!
 * Class used for sending text to the player. All output to the player should happen through this
 * class.
 */
class Broadcast {
  /**
   * @param {Broadcastable} source Target to send the broadcast to
   * @param {string} message
   * @param {number|boolean} wrapWidth=false width to wrap the message to or don't wrap at all
   * @param {boolean} useColor Whether to parse color tags in the message
   * @param {?function(target, message): string} formatter=null Function to call to format the
   *   message to each target
   */
  static at(source, message = '', wrapWidth = false, useColor = true, formatter = null) {
    if (!Broadcast.isBroadcastable(source)) {
      throw new Error(`Tried to broadcast message to non-broadcastable object: MESSAGE [${message}]`);
    }

    useColor = typeof useColor === 'boolean' ? useColor : true;
    formatter = formatter || ((target, message) => message);

    message = Broadcast._fixNewlines(message);

    for (const target of source.getBroadcastTargets()) {
      if (!target.socket || !target.socket.writable) {
        continue;
      }

      let targetMessage = formatter(target, message);
      let lastLine;
      if (_.get(target,`metadata.broadcastLog`)[0].replace(/[\[0m\n\r]/g,'').length < 3) {
        lastLine = _.get(target,`metadata.broadcastLog`)[1];
      } else {
        lastLine = _.get(target,`metadata.broadcastLog`)[0];
      }

      if (isLineChat(targetMessage) && !isLineChat(lastLine)){
        target.socket._prompt = true;
      }

      if (target.socket._prompt) {
        if (!(isLineChat(targetMessage) && isLineChat(lastLine)) ){
          this.record(target,'\r\n');
          target.socket.write('\r\n');
          target.socket._prompt = false;
        }
      }
      
      targetMessage = wrapWidth ? Broadcast.wrap(targetMessage, wrapWidth) : mudcolors.parse(ansi.parse(targetMessage));
      target.socket.write(targetMessage);
      this.record(target,targetMessage);
    }
    function isLineChat(line){
      return line.includes('You chat: [0m[92m') || line.includes(`[0m[96m[[0m[97mchat[0m[96m][0m[37m`)
    }
  }

  /**
   * records latest broadcasts to character metadata
   * @param {Character} target 
   * @param {String} targetMessage 
   */
  static record(target,targetMessage){
    if (!_.get(target,'metadata')){
      target.metadata = new Object();
    }

    if (!_.get(target,'metadata.broadcastLog')){
      target.metadata.broadcastLog = new Array();
    }

    if (_.get(target,'metadata.broadcastLog').length > 1000) {
      let discard = target.metadata.broadcastLog.pop();
    }

    target.metadata.broadcastLog.unshift(targetMessage);
  }

  /**
   * Broadcast.at for all except given list of players
   * @see {@link Broadcast#at}
   * @param {Broadcastable} source
   * @param {string} message
   * @param {Array<Player>} excludes
   * @param {number|boolean} wrapWidth
   * @param {boolean} useColor
   * @param {function} formatter
   */
  static atExcept(source, message, excludes, wrapWidth, useColor, formatter) {
    if (!Broadcast.isBroadcastable(source)) {
      throw new Error(`Tried to broadcast message to non-broadcastable object: MESSAGE [${message}]`);
    }

    // Could be an array or a single target.
    excludes = [].concat(excludes);

    const targets = source.getBroadcastTargets()
      .filter(target => !excludes.includes(target) && target.metadata.position > 0);

    const newSource = {
      getBroadcastTargets: () => targets
    };

    Broadcast.at(newSource, message, wrapWidth, useColor, formatter);
  }

  /**
   * Helper wrapper around Broadcast.at to be used when you're using a formatter
   * @see {@link Broadcast#at}
   * @param {Broadcastable} source
   * @param {string} message
   * @param {function} formatter
   * @param {number|boolean} wrapWidth
   * @param {boolean} useColor
   */
  static atFormatted(source, message, formatter, wrapWidth, useColor) {
    Broadcast.at(source, message, wrapWidth, useColor, formatter);
  }

  /**
   * `Broadcast.at` with a newline
   * @see {@link Broadcast#at}
   */
  static sayAt(source, message, wrapWidth, useColor, formatter) {
    Broadcast.at(source, message, wrapWidth, useColor, (target, message) => {
      return (formatter ? formatter(target, message) : message ) + '\r\n';
    });
  }

  /**
   * `Broadcast.atExcept` with a newline
   * @see {@link Broadcast#atExcept}
   */
  static sayAtExcept(source, message, excludes, wrapWidth, useColor, formatter) {
    Broadcast.atExcept(source, message, excludes, wrapWidth, useColor, (target, message) => {
      return (formatter ? formatter(target, message) : message ) + '\r\n';
    });
  }

  /**
   * `Broadcast.atFormatted` with a newline
   * @see {@link Broadcast#atFormatted}
   */
  static sayAtFormatted(source, message, formatter, wrapWidth, useColor) {
    Broadcast.sayAt(source, message, wrapWidth, useColor, formatter);
  }

  /**
   * Render the player's prompt including any extra prompts
   * @param {Player} player
   * @param {object} extra     extra data to avail to the prompt string interpolator
   * @param {number} wrapWidth
   * @param {boolean} useColor
   */

  static promptAll(source) {
    for (const target of source.getBroadcastTargets()) {
      if (!target.socket || !target.socket.writable) {
        continue;
      }

      this.prompt(target);
    }

  }

  static prompt(player, extra, wrapWidth, useColor) {
    const usingWebsockets = player.socket instanceof player.metadata.transport;
    if (!usingWebsockets){
      if (!player.socket){
        Logger.error(`${player.name} has no socket`);
        return false;
      }
      player.socket._prompt = false;
      Broadcast.at(player, '\r\n' + player.interpolatePrompt(player.prompt, extra) + ' ', wrapWidth, useColor);
      let needsNewline = player.extraPrompts.size > 0;
      if (needsNewline) {
        Broadcast.sayAt(player);
      }
      
      for (const [id, extraPrompt] of player.extraPrompts) {
        Broadcast.sayAt(player, extraPrompt.renderer(), wrapWidth, useColor);
        if (extraPrompt.removeOnRender) {
          player.removePrompt(id);
        }
      }
      
      if (needsNewline) {
        Broadcast.at(player, '> ');
      }
      
      
      player.socket._prompt = true;
      if (player.socket.writable) {
        player.socket.command('goAhead');
      }
    } else {
      player.socket._prompt = true;
    }
  }

  /**
   * Generate an ASCII art progress bar
   * @param {number} width Max width
   * @param {number} percent Current percent
   * @param {string} color
   * @param {string} barChar Character to use for the current progress
   * @param {string} fillChar Character to use for the rest
   * @param {string} delimiters Characters to wrap the bar in
   * @return {string}
   */
  static progress(width, percent, color, barChar = "#", fillChar = " ", delimiters = "()") {
    percent = Math.max(0, percent);
    width -= 3; // account for delimiters and tip of bar
    if (percent === 100) {
        width++; // 100% bar doesn't have a second right delimiter
    }
    barChar = barChar[0];
    fillChar = fillChar[0];
    const [ leftDelim, rightDelim ] = delimiters;
    const openColor = `<${color}>`;
    const closeColor = `</${color}>`;
    let buf = openColor + leftDelim + "<bold>";
    const widthPercent = Math.round((percent / 100) * width);
    buf += Broadcast.line(widthPercent, barChar);
    buf += Broadcast.line(width - widthPercent, fillChar);
    buf += "</bold>" + rightDelim + closeColor;
    return buf;
  }

  /**
   * Center a string in the middle of a given width
   * @param {number} width
   * @param {string} message
   * @param {string} color
   * @param {?string} fillChar Character to pad with, defaults to ' '
   * @return {string}
   */
  static center(width, message, color, fillChar = " ") {
    const padWidth = width / 2 - message.length / 2;
    let openColor = '';
    let closeColor = '';
    if (color) {
      openColor = `${color}`;
      closeColor = ``;
    }

    return (
      openColor +
      Broadcast.line(Math.floor(padWidth), fillChar) +
      message +
      Broadcast.line(Math.ceil(padWidth), fillChar) +
      closeColor
    );
  }

  /**
   * Render a line of a specific width/color
   * @param {number} width
   * @param {string} fillChar
   * @param {?string} color
   * @return {string}
   */
  static line(width, fillChar = "-", color = null) {
    let openColor = '';
    let closeColor = '';
    if (color) {
      openColor = `${color}`;
      closeColor = `w]`;
    }
    return openColor + (new Array(width + 1)).join(fillChar) + closeColor;
  }

  /**
   * Wrap a message to a given width. Note: Evaluates color tags
   * @param {string}  message
   * @param {?number} width   Defaults to 80
   * @return {string}
   */
  static wrap(message, width = 80) {
    return Broadcast._fixNewlines(lineWrap(mudcolors.parse(ansi.parse(message)), width));
  }

  /**
   * Indent all lines of a given string by a given amount
   * @param {string} message
   * @param {number} indent
   * @return {string}
   */
  static indent(message, indent) {
    message = Broadcast._fixNewlines(message);
    const padding = Broadcast.line(indent, ' ');
    return padding + message.replace(/\r\n/g, '\r\n' + padding);
  }

  /**
   * Fix LF unpaired with CR for windows output
   * @param {string} message
   * @return {string}
   * @private
   */
  static _fixNewlines(message) {
    // Fix \n not in a \r\n pair to prevent bad rendering on windows
    message = message.replace(/\r\n/g, '<NEWLINE>').split('\n');
    message = message.join('\r\n').replace(/<NEWLINE>/g, '\r\n');
    // fix sty's incredibly stupid default of always appending ^[[0m
    return message.replace(/\x1B\[0m$/, '');
  }

  static isBroadcastable(source) {
    return source && typeof source.getBroadcastTargets === 'function';
  }
}

module.exports = Broadcast;
