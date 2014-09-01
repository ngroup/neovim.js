
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
 * Get / set lines on the buffer
 * @param {int} from - The first line index
 * @param {int} [to=from] - The last line index
 * @param {string[]} [content] - The content to replace, (A 0-length array
 *                               will simply delete the line range)
 * @returns {Promise.<string|Error>}
 */

VimBuffer.prototype.lines = function() {
  var content, from, self, to;
  from = arguments[0];
  if ((typeof arguments[1] === 'number') && (parseInt(arguments[1]) === arguments[1])) {
    to = arguments[1];
  } else {
    to = from;
  }
  self = this;
  content = arguments[arguments.length - 1];
  this.get_length().then(function(buffer_length) {
    return console.log(buffer_length);
  });
  if (Array.isArray(content)) {
    return self.set_slice(from, to, true, true, content);
  } else if ((typeof content === 'number') && (parseInt(content) === content)) {
    return self.get_slice(from, to, true, true);
  }
};


/**
 * Set a window variable or get a window variable
 * Passing 'nil' as value deletes the variable.
 * @param {string} name - The variable name
 * @param [value] - The variable value
 */

VimBuffer.prototype["var"] = function(name, value) {
  if (arguments.length === 1) {
    return this.get_var(name);
  } else {
    return this.set_var(name, value);
  }
};


/**
 * Get or set a window option value.
 * Passing 'nil' as value deletes the option(only
 * works if there's a global fallback)
 * @param {string} name - The option name
 * @param [value] - The option value
 * @return The option value
 */

VimBuffer.prototype.option = function(name, value) {
  if (arguments.length === 1) {
    return this.get_option(name);
  } else {
    return this.set_option(name, value);
  }
};

exports.VimBuffer = VimBuffer;
