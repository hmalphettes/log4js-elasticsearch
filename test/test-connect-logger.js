var sandbox = require('sandboxed-module');
var libpath = process.env.COVERAGE ? '../lib-cov' : '../lib';
var log4jsElasticSearch = require(libpath + '/log4js-elasticsearch');
var logstashConnectFormatter = log4jsElasticSearch.logstashConnectFormatter;
var expect = require('chai').expect;
var levels = require('log4js').levels;

function MockLogger() {

  var that = this;
  this.messages = [];

  this.log = function(level, message, exception) {
    that.messages.push({ level: level, message: message });
  };

  this.isLevelEnabled = function(level) {
    return level.isGreaterThanOrEqualTo(that.level);
  };

  this.level = levels.TRACE;
}

function MockRequest(remoteAddr, method, originalUrl) {

  this.socket = { remoteAddress: remoteAddr };
  this.originalUrl = originalUrl;
  this.method = method;
  this.httpVersionMajor = '5';
  this.httpVersionMinor = '0';
  this.headers = {};

}

function MockResponse(statusCode) {

  this.statusCode = statusCode;
  this.end = function(chunk, encoding) {};

}

describe.skip('When using a connect logger', function() {
  var log4js = require('log4js');
  var ml, cl;
  before(function() {
    ml = new MockLogger();
    cl = log4js.connectLogger(ml, { format: logstashConnectFormatter });
    expect(cl).to.be.a['function'];
  });
  it('Must format a logging event for logstash from the execution of a connect request', function(done) {
    var req = new MockRequest('my.remote.addr', 'GET', 'http://url');
    var res = new MockResponse(200);
    cl(req, res, function() {
      res.end('chunk', 'encoding');
      done();
    });
  });
});
describe('When using a connect logger on the es appender', function() {
  var  log4js = sandbox.require('log4js', {
    requires: { 'log4js-elasticsearch': log4jsElasticSearch }
  });
  var ml, cl;
  var mockElasticsearchClient = {
    index: function(indexName, typeName, logObj, id, cb) {
      // console.log('logObj', logObj);
      expect(logObj['@message']).to.equal('my.remote.addr - - "GET http://url HTTP/5.0" 200 - "" ""');
      var fields = logObj['@fields'];
      expect(fields.url).to.equal('http://url');
      expect(fields.method).to.equal('GET');
      expect(fields['response-time']).to.be.a.number;
      expect(fields['remote-addr']).to.equal('my.remote.addr');
      expect(fields['content-length']).to.be.a.number;
      expect(fields['http-version']).to.equal('5.0');
      cb();
    }, defineTemplate: function(templateName, template, cb) {
      cb(null, 'ok');
    }, getTemplate: function(templateName, cb) {
      cb(null, '{}');
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
    ml = log4js.getLogger('unittest');
    cl = log4js.connectLogger(ml, { format: logstashConnectFormatter });
    expect(cl).to.be.a['function'];
  });
  it('Must format a logging event for logstash from the execution of a connect request', function(done) {
    var req = new MockRequest('my.remote.addr', 'GET', 'http://url');
    var res = new MockResponse(200);
    cl(req, res, function() {
      res.end('chunk', 'encoding');
      done();
    });
  });
});




