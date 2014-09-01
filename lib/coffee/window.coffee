###*
# Initialize a new `VimWindow` with the given `index` and `client`.
# @class Represent a Window in Vim
# @param {int} index - The window index
# @param {Client} client - The vim client
###
VimWindow = (index, client) ->
  @index = index
  @client = client
  return


###*
# Set the cursor position or get the current cursor position if no position
# index is given.
# @param {int} [row] - The row index
# @param {int} [col] - The column index
# @returns {int[]} The [row, col] array
###
VimWindow::cursor = (row, col) ->
  if arguments.length == 0
    @get_cursor()
  else
    @set_cursor([row, col])

###*
# Set the window height or get the window height if no height value is given.
# This will only succeed if the screen is split horizontally.
# @param {int} [height] - The new height in rows
###
VimWindow::height = (height) ->
  if arguments.length == 0
    @get_height()
  else
    @set_height(height)


###*
# Set the window width or get the window width if no width value is given.
# This will only succeed if the screen is split vertically.
# @param {int} [width] - The new width in columns
###
VimWindow::width = (width) ->
  if arguments.length == 0
    @get_width()
  else
    @set_width(width)


###*
# Set a window variable or get a window variable
# Passing 'nil' as value deletes the variable.
# @param {string} name - The variable name
# @param [value] - The variable value
###
VimWindow::var = (name, value) ->
  if arguments.length == 1
    @get_var(name)
  else
    @set_var(name, value)


###*
# Get or set a window option value.
# Passing 'nil' as value deletes the option(only
# works if there's a global fallback)
# @param {string} name - The option name
# @param [value] - The option value
# @return The option value
###
VimWindow::option = (name, value) ->
  if arguments.length == 1
    @get_option(name)
  else
    @set_option(name, value)

exports.VimWindow = VimWindow
