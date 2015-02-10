'use strict';

var debug = require('diagnostics')('fever')
  , EventEmitter = require('eventemitter3')
  , TickTock = require('tick-tock')
  , destroy = require('demolish')
  , HotPath = require('hotpath')
  , parse = require('url').parse
  , fuse = require('fusing')
  , File = require('./file');

/**
 * Our file factory.
 *
 * Options:
 *
 * - hotpath, {Object}, Configuration for our hotpath cache.
 * - engine, {FileSystem}, The file system where we store and get our files.
 *
 * @constructor
 * @param {Object} options Fever configuration.
 * @api private
 */
function Fever(options) {
  if (!this) return new Fever(options);

  var selfie = this;
  options = options || {};

  this.fs = options.engine || require('supreme');   // File system.
  this.hotpath = new HotPath(options.hotpath);      // Internal cache system.
  this.timers = new TickTock(this);                 // Timer management.
  this.options = options;                           // Backup of the options.
  this.files = [];                                  // Active files.

  //
  // Expose the File constructor which now contains a reference to the newly
  // created Fever.
  //
  this.File = function File(path, options) {
    this.fuse([selfie, path, options]);
  };

  fuse(this.File, File);
}

//
// Supply provides our middleware and plugin system, so we're going to inherit
// from it.
//
Fever.prototype.__proto__ = require('supply').prototype;
Object.keys(EventEmitter.prototype).forEach(function each(key) {
  Fever.prototype[key] = EventEmitter.prototype[key];
});

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

  function fever(req, res, next) {
    req.uri = req.uri || parse(req.url);

    var file = selfie.alias(req.uri.pathname);
    if (!file || 'GET' !== req.method) return next();

    file.forward(res, { gzip: req.zipline, headers: req.headers });
  }

  if (server && 'function' === typeof server.use) {
    server.use('zipline', require('zipline'), options);
    server.use('fever', fever);
  }

  return fever;
};

Fever.prototype.destroy = destroy('fs, hotpath, timers, options, files');

//
// Expose the module.
//
Fever.File = File;
module.exports = Fever;
