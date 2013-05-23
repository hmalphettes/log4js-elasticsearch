var ElasticsearchClient = require('./elasticsearch-client');
var layouts = require('./log4js-elasticsearch-layouts');
var bulk = require('./elasticsearch-bulk');

var defaultHostname = require('os').hostname();

function createAppender(layout, config, options, done) {
  var layoutES = makeESHelper(layout, config);
  var esclient = initESClient(config, options, layoutES.template, done);
  var eslog = bulk.makeEsLog(layout, esclient, layoutES
                      , config.timeout, config.buffersize);
  return function(loggingEvent) {
    eslog.log(loggingEvent);
  };
}

function configure(config, options, done) {
  var layout;
  config = loadAppenderConfig(config);
  layout = layouts.layout(config.layout.type, config.layout);
  if (typeof layout !== 'function') {
    console.error('Unable to find a layout named ' + config.layout.type);
  }
  return createAppender(layout, config, options, done);
}

function loadAppenderConfig(config) {
  if (!config) {
    config = {};
  }
  if (typeof config.typeName !== 'function') {
    var value = config.typeName || 'nodejs';
    config.typeName = function(loggingEvent) {
      return value;
    };
  }
  if (!config.layout) {
    config.layout = { type: 'logstash' };
  }
  
  //we need to pass the typeName to the layout config.
  //it is used both by the logstash layout and by the ES client.
  config.layout.typeName = config.typeName;

  return config;
}

function initESClient(config, options, template, done) {
  var esOptions;
  if (config.url) {
    esOptions = ElasticsearchClient.makeOptions(config.url);
  } else if (config.esOptions) {
    esOptions = config.esOptions;
  } else {
    esOptions = ElasticsearchClient.makeOptions('http://localhost:9200');
  }
  var esclient = config.esclient || new ElasticsearchClient(esOptions);
  if (template) {
    var templateName = template.template;
    esclient.getTemplate(templateName).exec(function(err, res) {
      if (res === '{}' || config.forceDefineTemplate) {
        esclient.defineTemplate(templateName, template).exec(function() {
          //let it be or plug an event emitter in there
          if (typeof done === 'function') {
            done();
          }
        });
      } else if (typeof done === 'function') {
        done();
      }
    });
  } else if (typeof done === 'function') {
    done();
  }
  return esclient;
}

function makeESHelper(layout, config) {
  var logId = config.logId || function() {};
  var typeName;
  if (typeof config.typeName === 'function') {
    typeName = config.typeName;
  } else {
    typeName = function(loggingEvent) {
      return config.typeName || 'nodejs';
    };
  }

  var indexName;
  var templateName;
  var template;
  if (typeof config.indexName === 'function') {
    indexName = config.indexName;
  } else if (typeof config.indexName === 'string') {
    indexName = function() {
      return config.indexName;
    };
  } else {
    var prefix = config.indexNamePrefix || 'logstash-';
    templateName = prefix + '*';
    indexName = function() {
      function pad(n){
        return n<10 ? '0'+n : n;
      }
      var date = new Date();
      var vDay = pad(date.getUTCDate());
      var vMonth = pad(date.getUTCMonth()+1);
      var vYearLong = pad(date.getUTCFullYear());
      //'logstash-%{+YYYY.MM.dd}';
      return prefix + vYearLong + '.' + vMonth + '.' + vDay;
    };
    if (config.layout) {
      if (config.layout.type === 'logstash') {
        template = layouts.esTemplateMakers.logstash(templateName);
      } else if (config.layout.type === 'simpleJson') {
        template = layouts.esTemplateMakers.simpleJson(templateName);
      }
    }
  }
  return {
    indexName: indexName,
    typeName: typeName,
    logId: logId,
    template: template
  };
}

exports.appender = createAppender;
exports.configure = configure;
exports.flushAll = bulk.flushAll;
