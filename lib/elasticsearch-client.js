var parseUrl = require('url').parse;
var ElasticSearchClient = require('elasticsearchclient');

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