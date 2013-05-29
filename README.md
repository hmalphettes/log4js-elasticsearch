log4js-elasticsearch
====================

log4js-elasticsearch is a log4js log appender to push log messages into [elasticsearch](http://elasticsearch.org).
[Kibana](http://three.kibana.org) is the awesome tool to view the logs.

The logs produced are compatible with [logstash's elasticsearch_http output](logstash.net/docs/1.1.12/outputs/elasticsearch_http).

Installation
------------

You can install install log4js-elasticsearch via npm:

    npm install git://github.com/hmalphettes/log4js-elasticsearch.git

Usage: basic
------------

    var log4js = require('log4js');
    var esAppenderConfig = {
        url: 'http://user:password@myelasticsearch.com:9200'
    };
    var log4jsESAppender = require('log4js-elasticsearch').configure(esAppenderConfig);
    log4js.addAppender(log4js, 'tests');

The default url of the ES server is http://localhost:9200

Usage: log4js configuration
---------------------------

    var log4js = require('log4js');
    log4js.configure({
        "appenders": [
            {
                "category": "tests", 
                "type": "logLevelFilter",
                "level": "WARN",
                "appender": {
                    "type": "log4js-elasticsearch",
                    "url": "http://127.0.0.1:9200"
                }
            },
            { 
                "category": "tests", 
                "type": "console",
            }
        ],
        "levels": {
            "tests":  "DEBUG"
        }
    });

Usage: custom
-------------

    var log4js = require('log4js');
    var uuid = require('node-uuid');
    log4js.configure({
        "appenders": [
            "appender": {
                "type": "log4js-elasticsearch",
                "indexName": function(loggingEvent) {
                    return loggingEvent.categoryName;
                },
                "typeName": function(loggingEvent) {
                    return loggingEvent.level.levelStr;
                },
                "url": "http://127.0.0.1:9200",
                "logId": function(loggingEvent) {
                    return uuid.v4();
                },
                "buffersize": 1024,
                "timeout": 45000,
                "layout": {
                    "type": "logstash",
                    "tags": [ "mytag" ],
                    "sourceHost": function(loggingEvent) {
                        return "it-depends";
                    }
                }
            }
        ],
        "levels": {
            "tests":  "DEBUG"
        }
    });


Appender configuration parameters
=================================
- `url`: the URL of the elasticsearch server.
Basic authentication is supported.
Default: http://localhost:9200

- `indexName`: the name of the elasticsearch index in which the logs are stored.
Either a static string either a function that is passed the logging event.
Defaults: undefined'; The indexNamePrefix is used by default.

- `indexNamePrefix`: the prefix of the index name in which the logs are stored.
The name of the actual index is suffixed with the date: `%{+YYYY.MM.dd}` and changes every day, UTC time.
Defaults: 'logstash-'.

- `typeName`: the name of the elasticsearch object in which the logs are posted.
Either a string or a function that is passed the logging event.
Default: 'nodejs'.

- `layout`: object descriptor for the layout.
By default the layout is logstash.

- `buffersize`: number of logs events to buffer before posted in bulks to elasticsearch
Default: 256

- `timeout`: number of milliseconds to wait until the logs buffer is posted to elasticsearch; regardless of its size.
Default: 30 seconds.

- `logId`: function that returns the value of the `_id` of the logging event.
Default: undefined to let elasticsearch generate it.

Additional Built-in layouts
============================

The following layouts are added to the log4js builtin layouts:
- logstash
- simpleJson

The following parameters are the children of the `layout` parameter in the appender's configuration for those new built-in layouts.

Default: Logstash layout
------------------------
The logstash layout posts logs in the same structure than [logstash's elasticsearch_http output](logstash.net/docs/1.1.12/outputs/elasticsearch_http).

- `tags`: output as the value of the `@tags` property.
A static array or a function that is passed the logging event.
Default: empty array.

- `sourceHost`: output as the value of the `@source_host` property.
A static string or a function that is passed the logging event
Default: OS's hostname.

- `source`: output as the value of the `@source` property.
A string.
Default: 'log4js'.

- `sourcePath`: output as the value of the `@source_path` property
A string.
Default: working directory of the current process.

- `logId`: outputs the value of the `_id` field.
A function or undefined to let elasticsearch generates it.
Default: undefined.

- `template`: the elasticsearch template to define.
Only used if no template with the same name is defined.
Default: from [untergeek's using-templates-to-improve-elasticsearch-caching-with-logstash](http://untergeek.com/2012/09/20/using-templates-to-improve-elasticsearch-caching-with-logstash/).

simpleJson Layout
-----------------
A simple message pass through of the loggingEvent.

Resources
=========
Nodejs to host Kibana 3 and proxy the calls to elasticsearch: [https://github.com/hmalphettes/kibana-proxy](https://github.com/hmalphettes/kibana-proxy)

License
=======
MIT

Copyright
=========
(c) 2013 Sutoiku, Inc.