var async = require('async');
var assert = require('assert');
var config = require("../../lib/config");
var nodeAssert = require('../../lib/nodeify-assertions');
var redis = config.redis;
var RedisProcess = require("../../lib/redis-process");
var commands = require("../../../lib/commands");

// expected inputs and outputs for a
// sampling of redis commands.
var expectations = {
  append: {
    before: function (client, done) { client.set('banana', 'phone', done); },
    arguments: ['banana', 'phone'],
    assert: function (response) { assert.strictEqual(10, response); }
  },
  auth: {
    arguments: ['fakepass'],
    assertError: function (err) { assert.notEqual(err.message.indexOf('no password is set'), -1); }
  },
  bitcount: {
    before: function (client, done) { client.set('banana', 'phone', done); },
    arguments: ['banana'],
    assert: function (response) { assert.strictEqual(21, response); }
  },
  bitop: {
    before: function (client, done) { client.set('banana', 'phone', done); },
    arguments: ['AND', 'dest', 'banana'],
    assert: function (response) { assert.strictEqual(5, response); }
  },
  'client list': {
    assert: function (response) { assert.notEqual(response.indexOf('cmd=client'), -1); }
  }
}

describe("The auto-generated methods", function () {

    var rp;
    before(function (done) {
        RedisProcess.start(function (err, _rp) {
            rp = _rp;
            return done(err);
        });
    })

    function allTests(parser, ip) {
        var args = config.configureClient(parser, ip);

        describe("using " + parser + " and " + ip, function () {
            var client;

            beforeEach(function (done) {
                client = redis.createClient.apply(redis.createClient, config.configureClient(parser, ip));
                client.once("error", done);
                client.once("connect", function () {
                    client.flushdb(function (err) {
                        return done(err);
                    });
                });
            });

            afterEach(function () {
                client.end();
            });

            commands.forEach(function (command) {
                var expected = expectations[command]
                if (!expected) return;

                var commandArgs = command.split(' ');
                var method = commandArgs.shift();
                [].push.apply(commandArgs, expectations[command].arguments)

                describe("the " + method + " method", function () {
                    it("calls sendCommand with whatever arguments it receives", function (done) {
                      if (expected.before) {
                        expected.before(client, function () {
                          applyAssertions();
                        })
                      } else {
                        applyAssertions();
                      }

                      // apply the assertions describe in the expections object:
                      // * provide arguments in the arguments varible.
                      // * provide a before callback to setup state.
                      // * provide an assert callback to check the response.
                      // * provide an assertError callback to check an error.
                      function applyAssertions() {
                        commandArgs.push(function (err, response) {
                            if (expected.assert) expected.assert(response)
                            if (expected.assertError) expected.assertError(err)
                            return done();
                        })

                        client[method].apply(client, commandArgs);
                      }
                    });
                });
            });
        });
    }

    ['javascript', 'hiredis'].forEach(function (parser) {
        allTests(parser, "/tmp/redis.sock");
        ['IPv4', 'IPv6'].forEach(function (ip) {
            allTests(parser, ip);
        })
    });

    after(function (done) {
        if (rp) rp.stop(done);
    });
});
