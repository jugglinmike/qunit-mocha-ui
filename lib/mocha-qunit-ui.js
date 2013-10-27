var Mocha = global.Mocha;
var Suite = Mocha.Suite;
var Test = Mocha.Test;
var QUnit = global.QUnit;
var assert = QUnit.assert;
var config = QUnit.config;
var jsDump = QUnit.jsDump;

function normalizeTestArgs(fn) {
  return function(title, expect, test) {
    if (typeof expect == "function") {
      test = expect;
      expect = 0;
    }

    return fn.call(this, title, expect, test);
  };
}

function wrapTestFunction(test, wrapper) {
  var result = function(done) {
    return wrapper.call(this, test, done);
  };
  result.toString = test.toString.bind(test);
  return result;
}

function spy(object, methodName, handlers) {
  var orig = object[methodName];
  var before = handlers.before;
  var after = handlers.after;
  var spied;

  if (orig.__restore) {
    orig = orig.__restore();
  }

  spied = object[methodName] = function() {
    var result;
    if (before) {
      before.apply(this, arguments);
    }

    result = orig.apply(this, arguments);

    if (after) {
      after.apply(this, arguments);
    }

    return result;
  };
  spied.__restore = function() {
    return object[methodName] = orig;
  };

  return spied;
}

function wrapAssert(qTest, qTestToStr, name, makeMessage) {
  var assertions = config.current.assertions;
  var pushSpy;
  spy(assert, name, {
    // Custom assertions work by invoking `QUnit.push`. Because QUnit's
    // built-in assertions also use this method, the spy should be temporarily
    // disabled while the build-in assertions run.
    before: function() {
      pushSpy = QUnit.push;
      if (pushSpy.__restore) {
        pushSpy.__restore();
      }
    },
    after: function(expected, actual, description) {
      var assertion = assertions[assertions.length - 1];
      var testFn, qAssert;

      if (name === 'ok') {
        description = actual;
      }

      // If there is no explicit description for this assertion, simply use the
      // assertion name.
      if (!description) {
        description = name;
      }

      testFn = function() {
        if (!assertion.result) {
          throw new Error(makeMessage(
            jsDump.parse(expected),
            jsDump.parse(actual)
          ));
        }
      };

      testFn.toString = qTestToStr;
      qAssert = new Test(description, testFn);

      qTest.addTest(qAssert);

      QUnit.push = pushSpy;
    }
  });
}

// Because QUnit allows for multiple assertion failures, a QUnit "test" must
// be implemented as a Mocha "suite" which redefines assertions to create
// individual tests dynamically.
function makeQTest(moduleSuite, title, expect, qTestFn) {
  var qTest = Suite.create(moduleSuite, title);
  var qTestToStr = qTestFn.toString.bind(qTestFn);

  config.current = { assertions: [] };

  wrapAssert(qTest, qTestToStr, 'ok', function(actual) {
    return 'Expected ' + actual + ' to be okay';
  });

  wrapAssert(qTest, qTestToStr, 'deepEqual', function(expected, actual) {
    return 'Expected ' + expected + ' to deeply equal ' + actual;
  });

  spy(QUnit, 'push', {
    after: function(result, actual, expected, message) {
      var testFn = function() {
        if (!result) {
          throw new Error(
            'Expected: ' + jsDump.parse(expected) +
            ' Actual: ' + jsDump.parse(actual)
          );
        }
      };
      var qAssert;

      testFn.toString = qTestToStr;
      qAssert = new Test(message, testFn);

      qTest.addTest(qAssert);
    }
  });

  return qTest;
}

var ui = function(suite) {
  var suites = [suite];

  suite.on('pre-require', function(context) {

    /**
     * Describe a "suite" with the given `title`.
     */

    context.module = function(title, opts) {
      if (suites.length > 1) suites.shift();
      var suite = Suite.create(suites[0], title);
      suites.unshift(suite);
    };

    /**
     * Describe a specification or test-case
     * with the given `title`, an optional number of assertions to expect,
     * callback `test` acting as a thunk.
     */
    context.test = normalizeTestArgs(function(title, expect, test) {
      //addTest(suites[0], title, expect, test);
      var moduleSuite = suites[0];
      var qTest = makeQTest(moduleSuite, title, expect, test);
      suites.unshift(qTest);
      test.call(qTest, assert);
      suites.shift();
    });

  });
};

Mocha.interfaces.qunit = ui;
if (typeof module !== "undefined") {
  module.exports = ui;
}
