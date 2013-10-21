module('module name');

QUnit.assert.mod2 = function( value, expected, message ) {
  var actual = value % 2;
  QUnit.push(actual === expected, actual, expected, message);
};

test('this is a test', 6, function(assert) {

  assert.ok(true, 'Should be okay');
  assert.ok(false, 'Should fail');

  assert.deepEqual({ mj: 45 }, { mj: 45 }, 'Should be awesome');
  assert.deepEqual({ mj: 23 }, { mj: 45 }, 'Should be not so awesome');

  assert.mod2(2, 0, "2 % 2 == 0");
  assert.mod2(3, 1, "3 % 2 == 1");
});
