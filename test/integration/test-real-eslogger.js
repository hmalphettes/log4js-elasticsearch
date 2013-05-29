// run this for some real life logging
var expect = require('chai').expect;
var sandbox = require('sandboxed-module');
var libpath = process.env.COVERAGE ? '../../lib-cov' : '../../lib';
var log4jsElasticSearch = require(libpath + '/log4js-elasticsearch');

// a single shard for testing is enough.
if (!process.env.ES_DEFAULT_SHARDS_NUMBER) {
  process.env.ES_DEFAULT_SHARDS_NUMBER = 1;
}

describe('When configuring a logger posting events to elasticsearch', function() {
  var log4js = require('log4js');
  before(function(done) {
    var config = {
      typeName: 'log4js',
      buffersize: 1,
      url: process.env.ES_URL,
      layout: {
        type: 'logstash'
      }
    };
    log4js.clearAppenders();
    log4js.addAppender(log4jsElasticSearch.configure(config, null, done), 'unittest');
  });

  describe("When logging", function() {
    it('Must send events to elasticsearch', function(done) {
      var log = log4js.getLogger('unittest');
      var nolog = log4js.getLogger('notunittest');
      nolog.error('nono');
      log.error('aha');
      log.info('huhu', 'hehe');
      log.warn('ohoho', new Error('pants on fire'));
      log.error('ohoho %s', 'a param', new Error('pants on fire'));
      setTimeout(done, 700);
    });
  });
});

describe('When configuring an es logger', function() {
  var  log4js = sandbox.require('log4js', {
    requires: {
      'log4js-elasticsearch': log4jsElasticSearch
    }
  });
  before(function(done) {
    var config = {
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "url": process.env.ES_URL || 'http://127.0.0.1:9200',
          "forceDefineTemplate": true,
          "layout": {
            "type": "logstash",
            "tags": [ "goodie" ],
            "sourceHost": "aspecialhost"
          }
        }
      ]
    };
    log4js.clearAppenders();
    log4js.configure(config);
    setTimeout(done, 1000);
  });
  it('Must log where expected', function(done) {
    log4js.getLogger('tests').warn('and one for ES and the console');
    log4js.getLogger('tests').debug('and one for the console alone');
    log4jsElasticSearch.flushAll(true);
    setTimeout(done, 700);
  });
});

describe.skip('When configuring a filtered es logger', function() {
  // if someone knows how to setup the sandbox to make it load right
  // it would be nicer!
  var log4js = sandbox.require('log4js', {
    requires: {
      'log4js-elasticsearch': log4jsElasticSearch
    }
  });
  before(function(done) {
    var config = {
      "appenders": [
        {
          "category": "tests2", 
          "type": "logLevelFilter",
          "level": "WARN",
          "appender": {
            "type": "log4js-elasticsearch",
            "url": process.env.ES_URL,
            "layout": { 
              "type": "logstash" 
            } 
          }
        },
        { 
          "category": "tests2", 
          "type": "console",
          "layout": { 
            "type": "messagePassThrough" 
          } 
        }
      ],
      "levels": {
        "tests":  "DEBUG"
      }
    };
    log4js.clearAppenders();
    log4js.configure(config);
    setTimeout(done, 1000);
  });
  it('Must log where expected', function(done) {
    log4js.getLogger('tests2').warn('and one for ES and the console');
    log4js.getLogger('tests2').debug('and one for the console alone');
    log4jsElasticSearch.flushAll(true);
    setTimeout(done, 700);
  });
});
