# fever

[![From bigpipe.io][from]](http://bigpipe.io)[![Version npm][version]](http://browsenpm.org/package/fever)[![Build Status][build]](https://travis-ci.org/bigpipe/fever)[![Dependencies][david]](https://david-dm.org/bigpipe/fever)[![Coverage Status][cover]](https://coveralls.io/r/bigpipe/fever?branch=master)

[from]: https://img.shields.io/badge/from-bigpipe.io-9d8dff.svg?style=flat-square
[version]: http://img.shields.io/npm/v/fever.svg?style=flat-square
[build]: http://img.shields.io/travis/bigpipe/fever/master.svg?style=flat-square
[david]: https://img.shields.io/david/bigpipe/fever.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/bigpipe/fever/master.svg?style=flat-square

Fever is the new asset build/pipeline/server/service for the BigPipe framework.

- Assets that are requested frequently are placed hot cached in the memory of
  the Node process.
- A plugin system allows the modification of file contents so things like SASS,
  LESS and CoffeeScript can be supported transparently.
- Source maps are integrated so you will always have the correct line numbers.
- A custom file engine is used so you can switch between any more that supports
  a File System like API. This is great if you want to store the files directly
  on a network partition like a CDN etc.

## Installation

```
npm install --save fever
```

## Usage

```js
'use strict';

var fever = require('fever')
  , new Fever({ /* options */ });
```

When constructing a new `Fever` instance you can supply the following options to
further customize your build service:

- **engine**: The file system like API you want to use. Defaults to `supreme`.
- **directory**: The location in which the compiled assets will be stored.
- **hotpath**: Options for our hot path cache.
- **recache**: The amount of requests we should receive before triggering a re-cache.

## License

MIT
