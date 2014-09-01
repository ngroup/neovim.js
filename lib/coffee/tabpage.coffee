###*
# Initialize a new `VimWindow` with the given `index` and `client`.
# @class Represent a Window in Vim
# @param {int} index - The window index
# @param {Client} client - The vim client
###
VimTabpage = (index, client) ->
  @index = index
  @client = client
  return


exports.VimTabpage = VimTabpage
