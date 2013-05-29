var parseUrl = require('url').parse;
var http = require('http');
var https = require('https');
var EventEmitter = require('events').EventEmitter;

function ElasticSearchClient(options) {
  this.secure = options.secure || false;
  this.host = options.host;
  this.port = options.port;
  if (options.auth) {
    this.auth = options.auth.username;
    if (options.auth.password) {
      this.auth += ':' + options.auth.password;
    }
  }
  this.timeout = options.timeout || false;
  this.httpClient = this.secure ? https : http;
  this.agent = options.agent;
}
// inherit nodejs events emitter
ElasticSearchClient.prototype = Object.create(EventEmitter.prototype);

ElasticSearchClient.prototype.__makeRequestOptions = function(path, method) {
  return {
    path: path,
    method: method,
    host: this.host,
    port: this.port,
    auth: this.auth,
    agent: this.agent
  };
};

ElasticSearchClient.prototype.index = function(indexName, typeName, data, id, done) {
  var path = '/' + indexName + '/' + typeName, method;
  if (typeof id === 'function' && done === undefined) {
    done = id;
    id = undefined;
    method = 'POST';
  } else if (id) {
    path += "/" + id;
    method = 'PUT';
  } else {
    method = 'POST';
  }
  var reqOptions = this.__makeRequestOptions(path, method);
  var request = this.httpClient.request(reqOptions);
  this.execRequest(request, data, done);
};

/**
 * indexName and typeName are optional.
 */
ElasticSearchClient.prototype.bulk = function(indexName, typeName, bulkCmds, done) {
  //first arg that is an array is bulkCmds;
  if (Array.isArray(indexName)) {
    bulkCmds = indexName;
    done = typeName;
    indexName = undefined;
    typeName = undefined;
  } else if (Array.isArray(typeName)) {
    bulkCmds = typeName;
    done = bulkCmds;
    typeName = undefined;
  }
  var path = '/_bulk';
  if (indexName) {
    if (typeName) {
      path = '/' + indexName + '/' + typeName + path;
    } else {
      path = '/' + indexName + path;
    }
  }
  var data = ''; //don't even think about buffer, this is what is most efficient in V8
  for (var i = 0; i < bulkCmds.length; i++) {
    data += JSON.stringify(bulkCmds[i]) + '\n';
  }
  var reqOptions = this.__makeRequestOptions(path, 'POST');
  var request = this.httpClient.request(reqOptions);
  this.execRequest(request, data, done);
};

ElasticSearchClient.prototype.getTemplate = function(templateName, done) {
  var path = '/_template/' + templateName;
  var reqOptions = this.__makeRequestOptions(path, 'GET');
  var request = this.httpClient.request(reqOptions);
  this.execRequest(request, null, done);
};

ElasticSearchClient.prototype.defineTemplate = function(templateName, template, done) {
  var path = '/_template/' + templateName;
  var reqOptions = this.__makeRequestOptions(path, 'PUT');
  var request = this.httpClient.request(reqOptions);
  this.execRequest(request, template, done);
};

/**
 * @param request is either an http.request object or an array [ http.request, postOrPutPayload ]
 * @param data is optional.
 */
ElasticSearchClient.prototype.execRequest = function(request, data, done) {
  if (done === undefined && typeof data === 'function') {
    done = data;
  }
  var self = this;
  if (self.timeout) {
    request.setTimeout(self.timeout, function () {
      self.emit('error', new Error('timed out after ' + self.timeout + 'ms'));
    });
  }

  request.on('error', function (error) {
    self.emit("error", error);
  });

  request.on('response', function (response) {
    var body = "";
    response.on('data', function (chunk) {
      body += chunk;
    });
    response.on('end', function () {
      if (typeof done === 'function') {
        done(undefined, body);
      } else {
        self.emit("data", body);
        self.emit("done", 0);
      }
    });
    response.on('error', function (error) {
      if (typeof self.callback === 'function') {
        // console.log('problem', error);
        done(error);
      } else {
        self.emit("error", error);
      }
    });
  });
  if (data) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Content-Length', Buffer.byteLength(data, 'utf8'));
    request.end(data);
  } else {
    request.end('');
  }

};

/**
 * Parses a URL with optional login / password
 * returns the expected json options to configure the connection to ES.
 */
ElasticSearchClient.makeOptions = function(url) {
  var urlP = parseUrl(url);
  var options = {
    host: urlP.hostname
  };
  var secure = urlP.protocol === 'https:';
  if (urlP.port !== null && urlP.port !== undefined) {
    options.port = urlP.port;
  } else if (secure) {
    options.port = '443';
  } else {
    options.port = '80';
  }
  options.secure = secure;
  if (urlP.auth) {
    var toks = urlP.auth.split(':');
    if (toks.length === 2) {
      options.auth = { username: toks[0], password: toks[1] };
    } else {
      options.auth = { username: toks[0], password: '' };
    }
  }
  return options;
};

module.exports = ElasticSearchClient;