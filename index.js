'use strict';

var debug = require('diagnostics')('fever')
  , EventEmitter = require('eventemitter3')
  , TickTock = require('tick-tock')
  , destroy = require('demolish')
  , HotPath = require('hotpath')
  , parse = require('url').parse
  , Supply = require('supply')
  , fuse = require('fusing')
  , File = require('./file');

/**
 * Our file factory.
 *
 * Options:
 *
 * - hotpath, {Object}, Configuration for our hotpath cache.
 * - engine, {FileSystem}, The file system where we store and get our files.
 * - recache, {Number} Every x amount of requests we should try to re-cache files.
 *
 * @constructor
 * @param {Object} options Fever configuration.
 * @api private
 */
function Fever(options) {
  if (!this) return new Fever(options);
  Supply.call(this);

  var selfie = this;
  options = options || {};

  this.fs = options.engine || require('supreme');   // File system like API.
  this.dir = options.directory || __dirname;        // Asset compile directory.
  this.hotpath = new HotPath(options.hotpath);      // Internal cache system.
  this.recache = options.recache || 10000;          // Amount of requests to trigger re-cache.
  this.timers = new TickTock(this);                 // Timer management.
  this.options = options;                           // Backup of the options.
  this.requested = 0;                               // Amount of requests we handled.
  this.files = [];                                  // Active files.

  //
  // Expose the File constructor which now contains a reference to the newly
  // created Fever.
  //
  this.File = function File(path, options) {
    this.fuse([selfie, path, options]);
  };

  fuse(this.File, File);
  this.initialize();
}

//
// Supply provides our middleware and plugin system, so we're going to inherit
// from it.
//
Fever.prototype.__proto__ = Supply.prototype;
Fever.prototype.emits = require('emits');
Object.keys(EventEmitter.prototype).forEach(function each(key) {
  Fever.prototype[key] = EventEmitter.prototype[key];
});

/**
 * Initialize the Fever instance and initialize all the things.
 *
 * @api private
 */
Fever.prototype.initialize = function initialize() {
  this.on('add', function add(file) {
    this.files.push(file);
  });

  this.on('remove', function remove(file) {
    var index = this.files.indexOf(file);

    if (index === -1) return;
    this.files.splice(index, 0);
  });
};

/**
 * Handy helper function for creating optional callbacks.
 *
 * @param {Function} fn Optional callback.
 * @param {String} msg Optional failure message.
 * @returns {Function}
 * @api private
 */
Fever.prototype.optional = function optional(fn, msg) {
  return fn || function nope(err) {
    if (err) debug(msg || 'Missing callback for failed operation', err);
  };
};

/**
 * Replace the internal file system.
 *
 * @param {FileSystem} fs The file system that we should use for the files.
 * @returns {Fever}
 * @api public
 */
Fever.prototype.engine = function engine(fs) {
  this.fs = fs;

  return this;
};

/**
 * Get the files that use this path.
 *
 * @param {String} path location of file.
 * @returns {Array}
 * @api private
 */
Fever.prototype.get = function get(path) {
  return [];
};

/**
 * Add a new file to our collection, only if it doesn't exist before.
 *
 * @param {String} path Location of the file.
 * @param {Object} options File configuration.
 * @returns {File}
 * @api public
 */
Fever.prototype.add = function add(path, options) {
  if (this.files.some(function some(file) {
    return file.contains(path);
  })) return this;

  return new this.File(path, options);
};

/**
 * Re-cache the hot cache with the most requested files from this system.
 * Every time a file is requested we increment the requested count.
 *
 * @param {Function} fn Optional completion callback.
 * @returns {Fever}
 * @api public
 */
Fever.prototype.cache = function cache(fn) {
  fn = this.optional(fn, 'Failed to update the cache');

  var sorted = this.files.sort(function sort(a, b) {
    return a.requested - b.requested;
  });

  //
  // Clear the hot cache as we're about to refill it's contents with new and
  // potentially hotter code paths.
  //
  this.hotpath.reset();

  sorted.forEach(function forEach(file) {
    return this.hotpath.set(file.uuid, file.buffer());
  }, this);

  return this;
};

/**
 * Attempt to mount the factory to a given HTTP server instance. If no server is
 * given we will return a middleware layer that is compatible with connect.
 *
 * @param {HTTPServer} server A HTTP server which understands middleware.
 * @returns {Function} The middleware layer we've generated.
 * @api public
 */
Fever.prototype.mount = function mount(server, options) {
  var selfie = this;

  /**
   * Handle the incoming files.
   *
   * @param {Request} req Incoming HTTP request.
   * @param {Response} res Outgoing HTTP response.
   * @param {Function} next Continuation of middleware.
   * @api private
   */
  function fever(req, res, next) {
    req.uri = req.uri || parse(req.url);

    var file = selfie.alias(req.uri.pathname)
      , cache;

    if (
         !file
      || 'GET' !== req.method
      || !file.length.raw
    ) return next();

    //
    // As we can handle the file we need to check if we should start a re-cache
    // procedure so our most requested files can float around in memory. And we
    // want to make sure that we're serving up to date assets from our hot cache.
    //
    selfie.requested++;

    if (selfie.request % selfie.recache === 0) {
      selfie.cache();
    }

    file.setHeader(req, res);
    cache = selfie.hotpath.get(req.uri.pathname);
    if (cache) return res.end(cache);

    file.forward(res, {
      encoding: req.zipline,
      headers: req.headers
    });
  }

  if (server && 'function' === typeof server.use) {
    server.use('zipline', require('zipline'), options);
    server.use('fever', fever);
  }

  return fever;
};

/**
 * Destroy and clean-up things.
 *
 * @TODO cleanup Supply based data.
 * @TODO cleanup EventEmitter properties.
 * @TODO clean up all files.
 *
 * @type {Function}
 * @returns {Boolean}
 * @api public
 */
Fever.prototype.destroy = destroy('fs, hotpath, timers, options, files, File');

//
// Expose the module.
//
Fever.File = File;
module.exports = Fever;
