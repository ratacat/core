'use strict';

const sty = require('sty');
const mudcolors = require('mudcolors');

/**
 * Helper methods for colored output during input-events
 */
class EventUtil {
  /**
   * Generate a function for writing colored output to a socket
   * @param {net.Socket} socket
   * @return {function (string)}
   */
  static genWrite(socket) {
    return string => socket.write(mudcolors.parse(sty.parse(string)));
  }

  /**
   * Generate a function for writing colored output to a socket with a newline
   * @param {net.Socket} socket
   * @return {function (string)}
   */
  static genSay(socket, noparse=false) {
    if (noparse) {
      return string => socket.write(string + '\r\n');
    } else {
      return string => socket.write(mudcolors.parse(sty.parse(string + '\r\n')));
    }
    
  }
}

module.exports = EventUtil;
