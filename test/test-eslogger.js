var expect = require('chai').expect;
var sandbox = require('sandboxed-module');
var libpath = process.env.COVERAGE ? '../lib-cov' : '../lib';
var log4jsElasticSearch = require(libpath + '/log4js-elasticsearch');

describe('When configuring a logger posting events to elasticsearch', function() {
  var log4js = require('log4js');
  var mockElasticsearchClient = {
    index: function(indexName, typeName, logObj, newLogId) {
      expect(indexName).to.match(/^logstash-/);
      expect(typeName).to.equal('nodejs');
      expect(newLogId).to.not.exist;
      expect(logObj['@fields'].category).to.equal('unittest');
      expect(logObj['@source']).to.equal('log4js');
      expect(logObj['@source_host']).to.equal(require('os').hostname());
      expect(logObj['@source_path']).to.equal(process.cwd());
      expect(logObj['@tags'].length).to.equal(0);
      if (currentMsg) {
        expect(logObj['@message']).to.equal(currentMsg);
        currentMsg = null;
      } else {
        expect(logObj['@message']).to.exist;
      }
      if (currentErrorMsg) {
        expect(currentErrorMsg).to.equal(logObj['@fields'].error);
        expect(logObj['@fields'].stack).to.be['instanceof'](Array);
        currentErrorMsg = null;
      }
      if (currentLevelStr) {
        expect(logObj['@fields'].levelStr).to.equal(currentLevelStr);
        currentLevelStr = null;
      }
      if (currentCallback) {
        return { exec: function() {
          currentCallback();
          currentCallback = null;
        } };
      } else {
        return { exec: function() {

        }};
      }
    }, defineTemplate: function(templateName, template, done) {
      expect(templateName).to.equal('logstash-*');
      defineTemplateWasCalled = true;
      if (typeof done === 'function') {
        done();
      }
      return { exec: function(cb) {
        cb();
      }};
    }, getTemplate: function(templateName) {
      return { exec: function(cb) {
        cb(null, '{}');
      }};
    }
  };
  var currentMsg;
  var currentCallback;
  var currentErrorMsg;
  var currentLevelStr;
  var defineTemplateWasCalled = false;
  before(function(done) {
    var config = { esclient: mockElasticsearchClient, buffersize: 1 };
    log4js.clearAppenders();
    log4js.addAppender(log4jsElasticSearch.configure(config, null, done), 'unittest');
  });
  it("Must have created the template", function() {
    expect(defineTemplateWasCalled).to.equal(true);
  });

  describe("When logging", function() {
    it('Must send events to elasticsearch', function(done) {
      var log = log4js.getLogger('unittest');
      var nolog = log4js.getLogger('notunittest');
      currentErrorMsg = 'I should not be called at all';
      nolog.error('nono');
      currentErrorMsg = null;

      currentLevelStr = 'ERROR';
      currentMsg = 'aha';
      log.error('aha');
      expect(currentMsg).to.be['null'];

      currentLevelStr = 'INFO';
      currentMsg = 'huhu \'hehe\'';
      log.info('huhu', 'hehe');
      expect(currentMsg).to.be['null'];

      currentLevelStr = 'WARN';
      currentMsg = 'ohoho';
      currentErrorMsg = 'pants on fire';
      log.warn('ohoho', new Error('pants on fire'));

      currentCallback = done;
      currentMsg = 'ohoho a param';
      currentErrorMsg = 'pants on fire';
      log.error('ohoho %s', 'a param', new Error('pants on fire'));
    });
  });
});

describe('When configuring an elasticsearch appender', function() {
  var  log4js = sandbox.require('log4js', {
      requires: {
        'log4js-elasticsearch': log4jsElasticSearch
      }
  });

  var currentMsg;
  var defineTemplateWasCalled = false;
  var mockElasticsearchClient = {
    index: function(indexName, typeName, logObj) {
      expect(logObj['@message']).to.equal(currentMsg);
      currentMsg = null;
      return { exec: function() {
      }};
    }, defineTemplate: function() {
      defineTemplateWasCalled = true;
      return { exec: function(cb) {
        cb(null, 'ok');
      }};
    }, getTemplate: function(templateName) {
      return { exec: function(cb) {
        cb(null, '{}');
      }};
    }
  };
  before(function() {
    log4js.configure({
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "esclient": mockElasticsearchClient,
          "buffersize": 1,
          "layout": { type: 'logstash' }
        }
      ]
    });
    expect(defineTemplateWasCalled).to.be['true'];
  });
  it('Must have configured the appender', function() {
    currentMsg = 'hello';
    log4js.getLogger('unittest').info('hello');
    expect(currentMsg).to.be['null'];
  });
});

describe('When configuring an elasticsearch logstash appender layout', function() {
  var  log4js = sandbox.require('log4js', {
    requires: {
      'log4js-elasticsearch': log4jsElasticSearch
    }
  });

  var currentMsg;
  var defineTemplateWasCalled = false;
  var mockElasticsearchClient = {
    index: function(indexName, typeName, logObj) {
      expect(logObj['@message']).to.equal(currentMsg);
      expect(logObj['@tags'][0]).to.equal('goodie');
      expect(logObj['@source_host']).to.equal('aspecialhost');
      expect(typeName).to.equal('customType');
      currentMsg = null;
      return { exec: function() {
      }};
    }, defineTemplate: function() {
      defineTemplateWasCalled = true;
      return { exec: function(cb) {
        cb(null, 'something');
      }};
    }, getTemplate: function(templateName) {
      return { exec: function(cb) {
        cb(null, '{}');
      }};
    }
  };
  it('Must have configured the appender with static params', function() {
    log4js.configure({
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "esclient": mockElasticsearchClient,
          "typeName": "customType",
          "buffersize": 1,
          "layout": {
            "type": "logstash",
            "tags": [ "goodie" ],
            "sourceHost": "aspecialhost"
          }
        }
      ]
    });
    expect(defineTemplateWasCalled).to.be['true'];
    defineTemplateWasCalled = undefined;

    currentMsg = 'hello';
    log4js.getLogger('unittest').info('hello');
    expect(currentMsg).to.be['null'];
  });

  it('Must have configured the appender with dynamic params', function() {
    log4js.configure({
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "esclient": mockElasticsearchClient,
          "buffersize": 1,
          "typeName": function(loggingEvent) {
            return 'customType';
          },
          "layout": {
            "type": "logstash",
            "tags": function(loggingEvent) {
              return [ 'goodie' ];
            },
            "sourceHost": function(loggingEvent) {
              return "aspecialhost";
            }
          }
        }
      ]
    });
    expect(defineTemplateWasCalled).to.be['true'];
    defineTemplateWasCalled = undefined;

    currentMsg = 'hello';
    log4js.getLogger('unittest').info('hello');
    expect(currentMsg).to.be['null'];
  });
});

describe('When sending the logs in bulk', function() {
  var  log4js = sandbox.require('log4js', {
    requires: {
      'log4js-elasticsearch': log4jsElasticSearch
    }
  });

  var currentMsg;
  var bulkWasCalled = 0;
  var expectedBulkcmdsSize;
  var mockElasticsearchClient = {
    bulk: function(bulkCmds) {
      if (expectedBulkcmdsSize) {
        expect(bulkCmds.length).to.equal(expectedBulkcmdsSize);
        expectedBulkcmdsSize = null;
      }
      bulkWasCalled++;
      return { exec: function() {
      }};
    }, getTemplate: function(templateName) {
      return { exec: function(cb) {
        cb(null, 'notempty');
      }};
    }
  };
  function reset(done) {
    log4jsElasticSearch.flushAll(true);
    bulkWasCalled = 0;
    done();
  }
  afterEach(reset);
  beforeEach(reset);
  it('Must send logs in bulks when the bufferSize is reached', function(done) {
    log4js.configure({
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "esclient": mockElasticsearchClient,
          "buffersize": 2
        }
      ]
    });
    expectedBulkcmdsSize = 4;
    log4js.getLogger('unittest').info('hello');
    expect(bulkWasCalled).to.equal(0);
    log4js.getLogger('unittest').info('goodbye');
    expect(bulkWasCalled).to.equal(1);
    done();
  });
  it('Must send logs in bulks after a timeout', function(done) {
    log4js.configure({
      "appenders": [
        {
          "type": "log4js-elasticsearch",
          "esclient": mockElasticsearchClient,
          "buffersize": 2,
          "timeout": 20
        }
      ]
    });
    expectedBulkcmdsSize = 2;
    log4js.getLogger('unittest').info('hello');
    expect(bulkWasCalled).to.equal(0);
    setTimeout(function() {
      expect(bulkWasCalled).to.equal(1);
      done();
    }, 80);
  });
});

