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
# Gets the current buffer index in a window
# @param window The window handle
###
VimWindow::get_buffer = ->
  @client.send_method('window_get_buffer', @index)


###*
# Gets the window position in display cells. First position is zero.
# @return {int[]} The [row, col] array with the window position
###
VimWindow::get_position = ->
  @client.send_method('window_get_position', @index)


###*
# Set the cursor position or get the current cursor position if no position
# index is given.
# @param {int} [row] - The row index
# @param {int} [col] - The column index
# @returns {int[]} The [row, col] array
###
VimWindow::cursor = (row, col) ->
  if arguments.length == 0
    @client.send_method('window_get_cursor', @index)
  else
    @client.send_method('window_set_cursor', @index, [row, col])

###*
# Set the window height or get the window height if no height value is given.
# This will only succeed if the screen is split horizontally.
# @param {int} [height] - The new height in rows
###
VimWindow::height = (height) ->
  if arguments.length == 0
    @client.send_method('window_get_height', @index)
  else
    @client.send_method('window_set_height', @index, height)


###*
# Set the window width or get the window width if no width value is given.
# This will only succeed if the screen is split vertically.
# @param {int} [width] - The new width in columns
###
VimWindow::width = (width) ->
  if arguments.length == 0
    @client.send_method('window_get_width', @index)
  else
    @client.send_method('window_set_width', @index, width)


###*
# Set a window variable or get a window variable
# Passing 'nil' as value deletes the variable.
# @param {string} name - The variable name
# @param [value] - The variable value
###
VimWindow::var = (name, value) ->
  if arguments.length == 1
    @client.send_method('window_get_var', @index, name)
  else
    @client.send_method('window_set_var', @index, name, value)


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
    @client.send_method('window_get_option', @index, name)
  else
    @client.send_method('window_set_option', @index, name, value)


### TODO: window_get_tabpage()
###


exports.VimWindow = VimWindow
