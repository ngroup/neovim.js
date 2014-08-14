
/**
 * Initialize a new `VimWindow` with the given `index` and `client`.
 * @class Represent a Window in Vim
 * @param {int} index - The window index
 * @param {Client} client - The vim client
 */
var VimWindow;

VimWindow = function(index, client) {
  this.index = index;
  this.client = client;
};


/**
 * Gets the current buffer index in a window
 * @param window The window handle
 */

VimWindow.prototype.get_buffer = function() {
  return this.client.send_method('window_get_buffer', this.index);
};


/**
 * Gets the window position in display cells. First position is zero.
 * @return {int[]} The [row, col] array with the window position
 */

VimWindow.prototype.get_position = function() {
  return this.client.send_method('window_get_position', this.index);
};


/**
 * Set the cursor position or get the current cursor position if no position
 * index is given.
 * @param {int} [row] - The row index
 * @param {int} [col] - The column index
 * @returns {int[]} The [row, col] array
 */

VimWindow.prototype.cursor = function(row, col) {
  if (arguments.length === 0) {
    return this.client.send_method('window_get_cursor', this.index);
  } else {
    return this.client.send_method('window_set_cursor', this.index, [row, col]);
  }
};


/**
 * Set the window height or get the window height if no height value is given.
 * This will only succeed if the screen is split horizontally.
 * @param {int} [height] - The new height in rows
 */

VimWindow.prototype.height = function(height) {
  if (arguments.length === 0) {
    return this.client.send_method('window_get_height', this.index);
  } else {
    return this.client.send_method('window_set_height', this.index, height);
  }
};


/**
 * Set the window width or get the window width if no width value is given.
 * This will only succeed if the screen is split vertically.
 * @param {int} [width] - The new width in columns
 */

VimWindow.prototype.width = function(width) {
  if (arguments.length === 0) {
    return this.client.send_method('window_get_width', this.index);
  } else {
    return this.client.send_method('window_set_width', this.index, width);
  }
};


/**
 * Set a window variable or get a window variable
 * Passing 'nil' as value deletes the variable.
 * @param {string} name - The variable name
 * @param [value] - The variable value
 */

VimWindow.prototype["var"] = function(name, value) {
  if (arguments.length === 1) {
    return this.client.send_method('window_get_var', this.index, name);
  } else {
    return this.client.send_method('window_set_var', this.index, name, value);
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

VimWindow.prototype.option = function(name, value) {
  if (arguments.length === 1) {
    return this.client.send_method('window_get_option', this.index, name);
  } else {
    return this.client.send_method('window_set_option', this.index, name, value);
  }
};


/* TODO: window_get_tabpage()
 */

exports.VimWindow = VimWindow;
