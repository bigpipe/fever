describe('File', function () {
  'use strict';

  var assume = require('assume')
    , path = require('path')
    , Fever = require('./')
    , fever
    , File
    , file;

  beforeEach(function each() {
    fever = new Fever({
      directory: path.join(__dirname, 'fixtures', 'dist')
    });

    File = fever.File;
    file = new File();
  });

  afterEach(function each() {
    file.destroy();
  });

  it('is instanceof supply', function () {
    assume(file).is.instanceOf(require('supply'));
  });

  it('is an EventEmitter', function (next) {
    file.once('foo', function (arg) {
      assume(arg).equals('bar');
      assume(this).equals(file);

      next();
    });

    file.emit('foo', 'bar');
  });

  it('adds it self to the factory when created');

  describe('#size', function () {
    it('has an initial size of 0', function () {
      assume(file.size.raw).equals(0);
      assume(file.size.deflate).equals(0);
      assume(file.size.gzip).equals(0);
    });

    it('increases when a new file is added', function (next) {
      file.push(path.join(__dirname, 'fixtures', 'events.js'), function (err) {
        assume(file.size.raw).equals(8921);
        next(err);
      });
    });

    it('decreases when a file is removed', function () {
      file.push(path.join(__dirname, 'fixtures', 'events.js'), function (err) {
        if (err) return next(err);

        assume(file.size.raw).equals(8921);

        file.pop(null, function (err) {
          assume(file.size.raw).equals(0);
          next(err);
        });
      });
    });
  });

  describe('#forward', function () {
    it('increments the .requested property');
  });

  describe("#buffer", function () {
    it('returns a buffer of the files contents');
  });

  describe('#modified', function () {
    it('debounces the calls to the next tick');
    it('re-reads all content from disk');
    it('re-generates the compiled version');
    it('re-generates the static gzip');
  });

  describe('#concat', function () {
    it('returns a new file instance');
    it('destroys the concated and supplied files');
    it('it starts the modification process');
  });
});

describe('Fever', function () {
  'use strict';

  var assume = require('assume')
    , Fever = require('./')
    , fever;

  beforeEach(function each() {
    fever = new Fever({
      directory: path.join(__dirname, 'fixtures', 'dist')
    });
  });

  afterEach(function each() {
    fever.destroy();
  });

  it('is exported as a function', function () {
    assume(Fever).is.a('function');
  });

  it('exposes the .File', function () {
    assume(Fever.File).is.a('function');
  });

  it('inherits from Supply', function () {
    assume(fever).is.instanceOf(require('supply'));
  });

  it('is an EventEmitter', function (next) {
    fever.once('foo', function (arg) {
      assume(arg).equals('bar');
      assume(this).equals(fever);

      next();
    });

    fever.emit('foo', 'bar');
  });
});
