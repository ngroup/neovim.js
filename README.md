Neovim.js
=========

A [Neovim](https://github.com/neovim/neovim) client build on top of Node.js.

*Warning: This project is currently incomplete and under heavy construction. Please use it at your own risk.*

## Installation

Install [Neovim.js](https://github.com/ngroup/neovim.js)

```sh
$ npm install git://github.com/ngroup/neovim.js.git
```

## Usage

Start up Neovim with $NEOVIM_LISTEN_ADDRESS specified.

```sh
$ NEOVIM_LISTEN_ADDRESS=/tmp/neovim nvim
```

Require `neovim` and instantiate a `client` by `neovim.connect(path)`:

```js
var neovim = require('neovim');
var client = neovim.connect('/tmp/neovim');
```

Now you can try to manipulate your Neovim:

```js
client.command(':split');
client.command(':vsplit');
```
