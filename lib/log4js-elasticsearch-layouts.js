/** 
  some idea; maybe not so good:
  support the pattern layout but make it as a json serialization ?
*/
var layouts = require('log4js').layouts;
module.exports = layouts;

var messagePassThroughLayout = layouts.messagePassThroughLayout;

/*
log4js logging event:
startTime: date,
categoryName: string,
level: { level: int, levelStr: levelStr },
data: [ args of logger ],
logger: ... circular ...
*/


/**
 * Outputs a JSON object
 */
function simpleJsonLayout(loggingEvent) {
  var data = __formatData(loggingEvent);
  var message = data[0], errorMsg = data[1], stack = data[2];
  var base = {
    startTime: loggingEvent.startTime,
    category: loggingEvent.categoryName,
    level: loggingEvent.level.level,
    levelStr: loggingEvent.level.levelStr,
    message: message
  };
  if (errorMsg !== undefined) {
    base.error = errorMsg;
    base.stack = stack;
  }
  return base;
}

/**
 * @param the logging event
 * @return The JSON
 */
function logstashLayout(loggingEvent) {
  var data = __formatData(loggingEvent);
  var message = data[0], errorMsg = data[1], stack = data[2];
  var eslogger = loggingEvent.logger;
  var base = {
    '@timestamp': loggingEvent.startTime,
    '@message': message,
    '@fields': {
      level: loggingEvent.level.level,
      levelStr: loggingEvent.level.levelStr,
      category: loggingEvent.categoryName
    }
  };
  if (errorMsg) {
    base['@fields'].error = errorMsg;
    base['@fields'].stack = stack;
  }
  return base;
}

/**
 * Extracts the message, error-message and stack track.
 */
function __formatData(loggingEvent) {
  var data = loggingEvent.data;
  var message, errorMsg, stack;
  if (data[data.length -1] instanceof Error) {
    var error = data[data.length - 1];
    errorMsg = error.message;
    if (typeof error.stack === 'string') {
      stack = error.stack.split('\n');
    } else {
      stack = error.stack;
    }    
    data = data.splice(0, data.length -1);
    message = messagePassThroughLayout({data: data});
  } else {
    message = messagePassThroughLayout(loggingEvent);
  }
  return [ message, errorMsg, stack ];
}

layouts.logstashLayout = logstashLayout;
layouts.simpleJsonLayout = simpleJsonLayout;


var defaultHostname = require('os').hostname();
function logstashLayoutMaker(layoutConfig) {
  var typeName = layoutConfig.typeName;
  var source = layoutConfig.source ? layoutConfig.source : 'log4js';

  var sourceHost;
  if (typeof layoutConfig.sourceHost === 'function') {
    sourceHost = layoutConfig.sourceHost;
  } else {
    sourceHost = function() {
      return layoutConfig.sourceHost || defaultHostname;
    };
  }
  var tags;
  if (typeof layoutConfig.tags === 'function') {
    tags = layoutConfig.tags;
  } else {
    tags = function() {
      return layoutConfig.tags || [];
    };
  }
  var sourcePath = layoutConfig.sourcePath ? layoutConfig.sourcePath : process.cwd();
  return function(loggingEvent) {
    var layoutOutput = logstashLayout(loggingEvent);
    layoutOutput['@type'] = typeName(loggingEvent);
    layoutOutput['@source'] = source;
    layoutOutput['@source_host'] = sourceHost(loggingEvent);
    layoutOutput['@source_path'] = sourcePath;
    layoutOutput['@tags'] = tags(loggingEvent);
    return layoutOutput;
  };
}

// add the new layouts:
var oriLayoutMaker = layouts.layout;
if (oriLayoutMaker.name !== 'layoutEs') {
  // really sure we don't double monky patch or yagni ?
  layouts.layout = function layoutEs(name, config) {
    if (name === 'logstash') {
      return logstashLayoutMaker(config);
    } else if (name === 'simpleJson') {
      return layouts.simpleJson;
    } else {
      return oriLayoutMaker(name, config);    
    }
  };
}

layouts.esTemplateMakers = {};

// http://untergeek.com/2012/09/20/using-templates-to-improve-elasticsearch-caching-with-logstash/
layouts.esTemplateMakers.logstash = function(templateName) {
  return {
    "template" : templateName || "logstash-*",
    "settings" : {
      "number_of_shards" : parseInt(process.env.ES_DEFAULT_SHARDS_NUMBER, 10) || 4,
      "index.cache.field.type" : "soft",
      "index.refresh_interval" : "5s",
      "index.store.compress.stored" : true,
      "index.query.default_field" : "@message",
      "index.routing.allocation.total_shards_per_node" : 2
    },
    "mappings" : {
      "_default_" : {
         "_all" : {"enabled" : false},
         "properties" : {
            "@fields" : { "type" : "object", "dynamic": true, "path": "full" },
            "@message": { "type": "string", "index": "analyzed" },
            "@source": { "type": "string", "index": "not_analyzed" },
            "@source_host": { "type": "string", "index": "not_analyzed" },
            "@source_path": { "type": "string", "index": "not_analyzed" },
            "@tags": { "type": "string", "index": "not_analyzed" },
            "@timestamp": { "type": "date", "index": "not_analyzed" },
            "@type": { "type": "string", "index": "not_analyzed" }    
         }   
      }
    }
  };
};

layouts.esTemplateMakers.simpleJson = function(templateName) {
  return {
    "template" : templateName || "log4js*",
    "settings" : {
      "number_of_shards" : parseInt(process.env.ES_DEFAULT_SHARDS_NUMBER, 10) || 4,
      "index.cache.field.type" : "soft",
      "index.refresh_interval" : "5s",
      "index.store.compress.stored" : true,
      "index.query.default_field" : "message",
      "index.routing.allocation.total_shards_per_node" : 2
    },
    "mappings" : {
      "_default_" : {
         "_all" : {"enabled" : false},
         "properties" : {
            "category": { "type": "string", "index": "not_analyzed" },
            "level": { "type": "integer" },
            "levelStr": { "type": "string", "index": "not_analyzed" },
            "startTime": { "type": "date" },
            "message": { "type": "string", "index": "analyzed" },
            "error": { "type": "string", "index": "analyzed" },
            "stack": { "type": "object", "dynamic": true }
         }   
      }
    }
  };
};
