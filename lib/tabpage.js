
/**
 * Initialize a new `VimWindow` with the given `index` and `client`.
 * @class Represent a Window in Vim
 * @param {int} index - The window index
 * @param {Client} client - The vim client
 */
var VimTabpage;

VimTabpage = function(index, client) {
  this.index = index;
  this.client = client;
};

exports.VimTabpage = VimTabpage;
