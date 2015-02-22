'use strict';

var debug = require('diagnostics')('fever:file')
  , EventEmitter = require('eventemitter3')
  , hash = require('crypto').createHash
  , destroy = require('demolish')
  , Supply = require('supply')
  , sm = require('source-map')
  , async = require('async')
  , path = require('path')
  , zlib = require('zlib')
  , mime = require('mime');

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
  Supply.call(this);

  this.type = 'text/javascript';  // The content type of the file.
  this.directory = fever.dir;     // Directory in which our compiled assets live.
  this.requested = 0;             // The amount of x this file has been requested.
  this.contents = [];             // Various of file that we should read.
  this.fever = fever;             // Reference to the fever instance.
  this.alias = '';                // Alias of the file, also known as fingerprint.
  this.smg = null;                // Placeholder for the source file generator.
  this.size = {
    deflate: 0,                   // Total deflate size.
    gzip: 0,                      // Total gzip size.
    raw: 0                        // Total binary size.
  };

  fever.emit('add', this);
  if (file) this.push(file);
}

//
// File inherits from the EventEmitter so people can hook in to these changes.
//
File.prototype.__proto__ = Supply.prototype;
File.prototype.emits = require('emits');
Object.keys(EventEmitter.prototype).forEach(function each(key) {
  File.prototype[key] = EventEmitter.prototype[key];
});

//
// Generate API methods which allows the adding and removing of file's.
//
['push', 'shift', 'pop', 'unshift'].forEach(function generate(method) {
  File.prototype[method] = function compiled(path, fn) {
    this.contents[method](path);
    this.emit(method);

    return this.modified(fn);
  };
});

/**
 * Generate a fingerprint based on all the contents.
 *
 * @param {Array} contents Array of read file contents.
 * @returns {String} The newly generated alias/fingerprint.
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

  return this.alias = md5.digest('hex');
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
  this.fever.fs.readFile(path.join(this.directory, this.alias), fn);
  return this;
};

/**
 * Check if the our internal contents array contains a given file.
 *
 * @param {String} file Full path of the file we should search for.
 * @returns {Boolean}
 * @api public
 */
File.prototype.contains = function contains(file) {
  return this.contents.some(function some(name) {
    return name === file;
  });
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
File.prototype.modified = function modified(fn) {
  var alias = this.alias
    , fs = this.fever.fs
    , selfie = this
    , buffers = []
    , local;

  async.map(this.contents, function map(file, next) {
    fs.readFile(file, function read(err, content) {
      buffers.push(content);

      next(err, {
        type: mime.lookup(file),
        content: content,
        path: file
      });
    });
  }, function mapped(err, contents) {
    if (err) return fn(err);

    //
    // Generate a new alias, as it only works file actual file content we need to
    // return an array which only holds these contents. Once we have the new
    // alias we can generate a new source map.
    //
    selfie.smg = new sm.SourceMapGenerator({
      file: selfie.fingerprinter(buffers)
    });

    async.series([
      function fever(next) {
        async.eachSeries(contents, function iterator(content, next) {
          selfie.fever.each(content, selfie, next);
        }, next);
      },
      function local(next) {
        async.eachSeries(contents, function iterator(content, next) {
          selfie.each(content, selfie, next);
        }, next);
      }
    ], function transformed(err) {
      if (err) return fn(err);

      //
      // Generate the total size of the file so we can use it for the
      // Content-Length header.
      //
      selfie.size.deflate = 0;
      selfie.size.gzip = 0;
      selfie.size.raw = 0;

      contents.forEach(function each(file) {
        selfie.size.raw += file.content.length;

        // @TODO check if we need to add an exiting file map.
        // @TODO check for a possible existing .map on the contents object.
        selfie.smg.setSourceContent(file.path, file.content.toString());
      });

      //
      // Assume that the content types in this file are all the same so we can
      // get the first one and roll with that.
      //
      selfie.type = contents[0].type;

      //
      // Concat the buffers so it's easier to pass around and write.
      //
      buffers = Buffer.concat(buffers);

      async.parallel([
        function gzip(next) {
          zlib.gzip(buffers, function compressed(err, buffer) {
            if (err) return next(err);
            selfie.size.gzip = buffer.length;

            fs.writeFile(
              path.join(selfie.directory, selfie.alias +'.gzip'),
              buffer,
              next
            );
          });
        },
        function normal(next) {
          fs.writeFile(
            path.join(selfie.directory, selfie.alias),
            buffers,
            next
          );
        },
        function deflate(next) {
          zlib.deflate(buffers, function compressed(err, buffer) {
            if (err) return next(err);
            selfie.size.deflate = buffer.length;

            fs.writeFile(
              path.join(selfie.directory, selfie.alias +'.deflate'),
              buffer,
              next
            );
          });
        },
      ], function (err) {
        fn(err);

        //
        // Attempt to remove the old stored buffer, it doesn't really matter if we
        // cannot remove it.
        //
        fs.unlink(path.join(selfie.directory, alias), function rm(err) {
          if (err) debug('Failed to destroy old %s due to error', alias, err);
        });
      });
    });

    debug('Updated %s to %s as content is changed', alias || '(empty)', selfie.alias);
  });

  return this;
};

/**
 * Write the response headers for this cached item.
 *
 * @param {Request} req Incoming HTTP request.
 * @param {Response} res Outgoing HTTP response.
 * @returns {File}
 * @api public
 */
File.prototype.setHeader = function setHeader(req, res) {
  var age = 84029840280;

  res.statusCode = 200;

  res.setHeader('Expires', new Date(Date.now() + age).toUTCString());
  res.setHeader('Cache-Control', 'max-age='+ age +', public');
  res.setHeader('Content-Type', this.type);

  // @TODO make this gzip selection aware.
  res.setHeader('Content-Length', this.size.raw);

  this.requested++;
  return this;
};

/**
 * Forward the file contents to different streams, services and API's.
 *
 * Options:
 *
 * - encoding: The accepted content encoding
 *
 * @param {Stream} where Where do we need to write to.
 * @param {Object} options Write options.
 * @returns {File}
 * @api public
 */
File.prototype.forward = function forward(where, options) {
  options = options || {};

  var stream = this.stream(options.encoding || []);

  return this;
};

/**
 * Get the file stream.
 *
 * @param {Array} encoding Array with possible allowed encodings.
 * @returns {ReadableStream}
 * @api public
 */
File.prototype.stream = function stream(encoding) {
  var alias = this.alias + (
    ~encoding.indexOf('gzip') && this.size.gzip ? '.gzip' : (
    ~encoding.indexOf('deflate') && this.size.deflate ? '.deflate' : '')
  );

  return this.fever.fs.createReadstream(path.join(this.directory, alias));
};

/**
 * Destroy the file instance and un-register it in the fever.
 *
 * @TODO also clean up locally stored file.
 * @returns {File}
 * @api public
 */
File.prototype.destroy = destroy('requested, contents, fever, alias, smg, size', {
  before: function before() {
    this.fever.emit('remove', this);
  }
});

//
// Expose the module.
//
module.exports = File;
