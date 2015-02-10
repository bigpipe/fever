'use strict';

var debug = require('diagnostics')('fever:file')
  , EventEmitter = require('eventemitter3')
  , hash = require('crypto').createHash
  , path = require('path');

/**
 * Representation of a single file.
 *
 * @TODO: Add the path to the contents.
 *
 * @constructor
 * @param {Factory} factory The factory that creates and manages the files.
 * @param {String} path Location of the file.
 * @param {Object} options File configuration.
 * @api public
 */
function File(factory, path, options) {
  if (!this) return new File(path, options);
  options = options || {};

  this.requested = 0;           // The amount of x this file has been requested.
  this.contents = [];           // Various of file that we should read.
  this.factory = null;          // Reference to the factory instance.
  this.alias = '';              // Alias of the file, also known as fingerprint.
  this.factory = factory;       // Reference to the factory.

  factory.emit('add', this);
  if (path) this.push(path);
}

//
// File inherits from the EventEmitter so people can hook in to these changes.
//
File.prototype.__proto__ = require('supply').prototype;
Object.keys(EventEmitter.prototype).forEach(function each(key) {
  File.prototype[key] = EventEmitter.prototype[key];
});

/**
 * Generate a fingerprint of the current content.
 *
 * @param {String|Buffer} content Content that needs to be fingered.
 * @returns {File}
 * @api private
 */
File.prototype.fingerprinter = function fingerprinter(content) {
  this.alias = hash('md5').update(content.toString()).digest('hex');

  return this;
};

['push', 'shift', 'pop', 'unshift'].forEach(function generate(method) {
  File.prototype[method] = function compiled(path, options) {
    this.contents[method](path);
    this.emit(method);

    return this.modified();
  };
});

/**
 * Concatenate multiple files together.
 *
 * @returns {File}
 * @api public
 */
File.prototype.concat = function concat() {
  var file = new File(this.factory)
    , files = Array.prototype.slice.call(arguments, 0);

  //
  // Add all the file contents to our new file instances.
  //
  Array.prototype.push.apply(file.contents, this.contents);
  Array.prototype.push.apply(file.contents, files);

  //
  // Nuke all old file instances as they are now concatenated in to a new
  // instance.
  //
  files.forEach(function each(old) {
    old.destroy();
  });
  this.destroy();

  return file;
};

/**
 * Read out the compiled contents and callback with the resulting buffer.
 *
 * @param {Function} fn Error first callback.
 * @returns {File}
 * @api public
 */
File.prototype.buffer = function buffer(fn) {
  return this;
};

/**
 * Something in this file has been modified, we need to re-calculate all the
 * things.
 *
 * @returns {File}
 * @api public
 */
File.prototype.modified = function modified() {
  this.fingerprinter();

  return this;
};

/**
 * Forward the file contents to different streams, services and API's.
 *
 * @returns {File}
 * @api public
 */
File.prototype.forward = function forward(what, options) {
  options = options || {};

  this.requested++;
  return this;
};

/**
 * Destroy the file instance and un-register it in the factory.
 *
 * @returns {File}
 * @api public
 */
File.prototype.destroy = function destroy() {
  this.factory.emit('remove', this);

  return this;
};

//
// Expose the module.
//
module.exports = File;
