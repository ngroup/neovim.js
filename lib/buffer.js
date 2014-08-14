
/**
 * Initialize a new `VimBuffer` with the given `index` and `client`.
 * @class Represent a VimBuffer
 * @param {int} index - The buffer index
 * @param {Client} client - The client object
 */
var VimBuffer;

VimBuffer = function(index, client) {
  this.index = index;
  this.client = client;
};


/**
 * Get lines on the buffer
 * @param {int} from - The first line index
 * @param {int} [to=from] - The last line index
 * @returns {Promise.<string|Error>}
 */

VimBuffer.prototype.get_line = function() {
  var from, to;
  from = arguments[0];
  to = from;
  if ((typeof arguments[1] === 'number') && (parseInt(arguments[1]) === arguments[1])) {
    to = arguments[1];
  }
  return this.client.send_method('buffer_get_slice', this.index, from, to, true, true);
};


/**
 * Replace lines on the buffer
 * @param {int} from - The first line index
 * @param {int} [to=from] - The Last line index
 * @param {string[]} content - An array of strings to use as replacement
 * @returns {Promise}
 */

VimBuffer.prototype.set_line = function() {
  var content, from, self, to;
  from = arguments[0];
  to = from;
  if ((typeof arguments[1] === 'number') && (parseInt(arguments[1]) === arguments[1])) {
    to = arguments[1];
  }
  content = arguments[arguments.length - 1];
  self = this;
  return this.get_length().then(function(buffer_length) {
    var gap, keep;
    if (from >= buffer_length) {
      gap = from - buffer_length;
      keep = buffer_length - 1;
      return self.get_line(keep).then(function(keep_content) {
        var num, _i;
        if (gap !== 0) {
          for (num = _i = 1; 1 <= gap ? _i <= gap : _i >= gap; num = 1 <= gap ? ++_i : --_i) {
            content.unshift('');
          }
        }
        content.unshift(keep_content[0]);
        return self.client.send_method('buffer_set_slice', self.index, keep, to, true, true, content);
      });
    } else {
      return self.client.send_method('buffer_set_slice', self.index, from, to, true, true, content);
    }
  });
};


/**
 * Delete a line on the buffer
 * @param {int} index - The line index
 * @returns {Promise}
 */

VimBuffer.prototype.delete_line = function(index) {
  return this.client.send_method('buffer_del_line', this.index, index);
};


/**
 * Get the buffer line count
 * @returns {Promise}
 */

VimBuffer.prototype.get_length = function() {
  return this.client.send_method('buffer_get_length', this.index);
};

exports.VimBuffer = VimBuffer;
