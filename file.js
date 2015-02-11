'use strict';

var debug = require('diagnostics')('fever:file')
  , EventEmitter = require('eventemitter3')
  , hash = require('crypto').createHash
  , sm = require('source-map')
  , path = require('path')
  , fs = require('fs');

/**
 * Representation of a single file.
 *
 * @TODO: Add the path to the contents.
 *
 * @constructor
 * @param {Fever} fever The fever that creates and manages the files.
 * @param {String} file Location of the file.
 * @param {Object} options File configuration.
 * @api public
 */
function File(fever, file, options) {
  if (!this) return new File(path, options);
  options = options || {};

  this.requested = 0;           // The amount of x this file has been requested.
  this.contents = [];           // Various of file that we should read.
  this.fever = fever;           // Reference to the fever instance.
  this.alias = '';              // Alias of the file, also known as fingerprint.
  this.smg = null;              // Placeholder for the source file generator.

  fever.emit('add', this);
  if (path) this.push(file);
}

//
// File inherits from the EventEmitter so people can hook in to these changes.
//
File.prototype.__proto__ = require('supply').prototype;
Object.keys(EventEmitter.prototype).forEach(function each(key) {
  File.prototype[key] = EventEmitter.prototype[key];
});

//
// Generate API methods which allows the adding and removing of file's.
//
['push', 'shift', 'pop', 'unshift'].forEach(function generate(method) {
  File.prototype[method] = function compiled(path, options) {
    this.contents[method](path);
    this.emit(method);

    return this.modified();
  };
});

/**
 * Generate a fingerprint based on all the contents.
 *
 * @param {Array} contents Array of read file contents.
 * @returns {File}
 * @api private
 */
File.prototype.fingerprinter = function fingerprinter(contents) {
  var md5 = hash('md5');

  //
  // As crypto is actually a stream we can do multiple update calls with each of
  // the files that we've stored in our contents array.
  //
  (contents || this.contents).forEach(function each(content) {
    md5.update(content.toString());
  });

  this.alias = md5.digest('hex');

  return this;
};

/**
 * Concatenate multiple files together.
 *
 * @returns {File}
 * @api public
 */
File.prototype.concat = function concat() {
  var file = new File(this.fever)
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
 * things:
 *
 * - Source map.
 * - New alias based on the content.
 *
 * @returns {File}
 * @api public
 */
File.prototype.modified = function modified() {
  var contents = this.contents.map(function map(file) {
    return {
      content: fs.readFileSync(__dirname),
      path: file
    };
  });

  //
  // Generate a new alias, as it only works file actual file content we need to
  // return an array which only holds these contents.
  //
  this.fingerprinter(contents.map(function map(file) {
    return file.content;
  }));

  //
  // Now that we know the file's alias we can generate a new sourcemap.
  //
  this.smg = new sm.SourceMapGenerator({
    file: this.alias
  });

  contents.forEach(function each(file) {
    // @TODO check if we need to add an exiting file map.
    this.smg.setSourceContent(file.path, file.content.toString());
  }, this);

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
 * Destroy the file instance and un-register it in the fever.
 *
 * @returns {File}
 * @api public
 */
File.prototype.destroy = function destroy() {
  this.fever.emit('remove', this);

  return this;
};

//
// Expose the module.
//
module.exports = File;
