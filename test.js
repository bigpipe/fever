describe('File', function () {
  'use strict';

  var assume = require('assume')
    , File = require('./file');

  it('has a middleware system');
  it('is an event emitter');
  it('adds it self to the factory when created');

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
    fever = new Fever();
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
