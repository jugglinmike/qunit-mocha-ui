var Mocha = global.Mocha;
var Suite = Mocha.Suite;
var Test = Mocha.Test;
var QUnit = global.QUnit;
var assert = QUnit.assert;
var jsDump = QUnit.jsDump;

function testContext(context) {
  var config = QUnit.config;
  if (arguments.length === 0) {
    return config.current;
  }
  config.current = {
    testEnvironment: context,
    assertions: [],
    expected: null
  };
  QUnit.current_testEnvironment = context;
}


function normalizeTestArgs(fn) {
  return function(title, expect, test) {
    if (typeof expect == "function") {
      test = expect;
      expect = null;
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

function mock(object, methodName, newFn) {
  var orig = object[methodName];
  var spied;

  if (orig.__restore) {
    orig = orig.__restore();
  }

  spied = object[methodName] = newFn;

  spied.__restore = function() {
    return object[methodName] = orig;
  };
  spied.__orig = orig;

  return spied;
}

function wrapAssert(qTest, qTestToStr, name, makeMessage) {
  var pushSpy;

  var m = mock(assert, name, function(expected, actual, description) {
    // Custom assertions work by invoking `QUnit.push`. Because QUnit's
    // built-in assertions also use this method, the mock should be temporarily
    // disabled while the build-in assertions run.
    pushSpy = QUnit.push;
    if (pushSpy.__restore) {
      pushSpy.__restore();
    }
    var testFn, qAssert;
    var call = { ctx: this, args: arguments };

    if (name === 'ok') {
      description = actual;
    }

    // If there is no explicit description for this assertion, simply use the
    // assertion name.
    if (!description) {
      description = name;
    }

    testFn = function() {
  var assertions = testContext().assertions;
      var assertion;
      m.__orig.apply(call.ctx, call.args);

      assertion = assertions[assertions.length - 1];
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
  });
}

// Because QUnit allows for multiple assertion failures, a QUnit "test" must
// be implemented as a Mocha "suite" which redefines assertions to create
// individual tests dynamically.
function makeQTest(moduleSuite, title, expect, qTestFn) {
  var qTest = Suite.create(moduleSuite, title);
  var qTestToStr = qTestFn.toString.bind(qTestFn);

  var opts = moduleSuite.opts;

  wrapAssert(qTest, qTestToStr, 'ok', function(actual) {
    return 'Expected ' + actual + ' to be okay';
  });

  wrapAssert(qTest, qTestToStr, 'deepEqual', function(expected, actual) {
    return 'Expected ' + expected + ' to deeply equal ' + actual;
  });

  mock(QUnit, 'push', function(result, actual, expected, message) {
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
  });

  qTest.beforeAll(function() {
    testContext(this);
    QUnit.expect(expect);
  });

  if (opts && opts.setup) {
    qTest.beforeAll(function() {
      opts.setup.call(this, assert);
    });
  }

  if (opts && opts.teardown) {
    qTest.afterAll(function() {
      opts.teardown.call(this, assert);
    });
  }

  qTest.afterAll(function() {
    var testCtx = testContext();
    if (testCtx.expected && testCtx.expected !== testCtx.assertions.length) {
      console.log(moduleSuite);
      throw new Error(
        'Expected ' + testCtx.expected + ' assertions but saw ' +
        testCtx.assertions.length
      );
    }
  });

  return qTest;
}

var ui = function(suite) {
  var suites = [suite];

  suite.on('pre-require', function(context) {

    testContext({});

    /**
     * Describe a "suite" with the given `title`.
     */

    context.module = function(title, opts) {
      if (suites.length > 1) suites.shift();
      var suite = Suite.create(suites[0], title);
      suites.unshift(suite);
      suite.opts = opts;
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
      var assertions = {
        passed: 0,
        failed: 0
      };
      suites.unshift(qTest);

      test.call(qTest, assert);

      suites.shift();

    });

    context.asyncTest = function() {};

  });
};

Mocha.interfaces.qunit = ui;
if (typeof module !== "undefined") {
  module.exports = ui;
}
