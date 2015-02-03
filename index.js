'use strict';

var debug = require('diagnostics')('fever:factory')
  , TickTock = require('tick-tock')
  , HotPath = require('hotpath')
  , parse = require('url').parse
  , supply = require('supply')
  , fuse = require('fusing')
  , File = require('./file');

/**
 * Handy helper function for creating optional callbacks.
 *
 * @param {Function} fn Optional callback.
 * @param {String} msg Optional failure message.
 * @returns {Function}
 * @api private
 */
function optional(fn, msg) {
  return fn || function nope(err) {
    if (err) debug(msg || 'Missing callback for failed operation', err);
  };
}

/**
 * Our file factory.
 *
 * Options:
 *
 * - hotpath, {Object}, Configuration for our hotpath cache.
 * - engine, {FileSystem}, The file system where we store and get our files.
 *
 * @constructor
 * @param {Server} server HTTP/HTTPS server instance.
 * @param {Object} options Factory configuration.
 * @api private
 */
function Factory(server, options) {
  if (!this) return new Factory(server, options);

  var selfie = this;
  options = options || {};

  this.hotpath = new HotPath(options.hotpath);    // Internal cache system.
  this.fs = options.engine || require('supreme'); // File system.
  this.options = options;                         // Backup of the options.
  this.server = server;                           // The HTTP server we attach on.
  this.timers = {};                               // Active timers.
  this.files = [];                                // Active files.
  this.mount(this.server);

  //
  // Expose the File constructor which now contains a reference to the newly
  // created Factory.
  //
  this.File = function File(path, options) {
    this.fuse([selfie, path, options]);
  };

  fuse(this.File, File);
  this.mount();
}

//
// Supply provides our middleware and plugin system, so we're going to inherit
// from it.
//
Factory.prototype.__proto__ = require('eventemitter3').prototype;
supply.middleware(Factory, { add: 'transform', run: 'run' });

/**
 * Replace the internal file system.
 *
 * @param {FileSystem} fs The file system that we should use for the files.
 * @returns {Factory}
 * @api public
 */
Factory.prototype.engine = function engine(fs) {
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
Factory.prototype.get = function get(path) {
  return [];
};

/**
 * Re-cache the hot cache with the most requested files from this system.
 * Every time a file is requested we increment the requested count.
 *
 * @param {Function} fn Optional completion callback.
 * @returns {Factory}
 * @api public
 */
Factory.prototype.cache = function cache(fn) {
  fn = optional(fn, 'Failed to update the cache');

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
 * Clear the any of the given timeouts.
 *
 * @arguments {String} names of timeouts that needs to be cleared.
 * @returns {Factory}
 * @api public
 */
Factory.prototype.clearTimeout = function clearTimeout() {
  for (var i = 0, l = arguments.length; i < l; i++) {
    clearTimeout(this.timers[arguments[i]]);
    clearInterval(this.timers[arguments[i]]);
    this.timers[arguments[i]] = null;
  }

  return this;
};

/**
 * Attach the factory instance to a given HTTP server instance. We assume that
 * these HTTP servers work with an `supply` or `connect` based middleware system.
 * The compatibility mode can be set using the options object:
 *
 * - connect, `false`, Use the connect based middleware system.
 * - add, `undefined`, Use the given method name for adding middleware.
 *
 * @param {Server} server HTTP server instance.
 * @param {Object} options Optional configuration.
 * @returns {Factory}
 * @api public
 */
Factory.prototype.mount = function mount(server, options) {
  if (!options) options = this.options;
  if (!server) server = this.server;

  var selfie = this;

  supply.detect(server, 'zipline', require('zipline'), options);
  supply.detect(server, 'sfs', function sfs(req, res, next) {
    req.uri = req.uri || parse(req.url);

    var file = selfie.alias(req.uri.pathname);
    if (!file || 'GET' !== req.method) return next();

    file.forward(res, { gzip: req.zipline, headers: req.headers });
  }, options);

  return this;
};

//
// Expose the module.
//
module.exports = Factory;
