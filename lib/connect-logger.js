/*
  "@fields"    => {
    "client"        => "127.0.0.1",
    "duration_usec" => 240,
    "status"        => 404,
    "request"       => "/favicon.ico",
    "method"        => "GET",
    "referrer"      => "-"
  },
*/
function logstashConnectFormatter(req, res, formattedOutput) {
  var fields = {
    url: req.originalUrl,
    method: req.method,
    status: res.__statusCode || res.statusCode,
    'response-time': res.responseTime,
    referrer: req.headers.referer || req.headers.referrer || '',
    'http-version': req.httpVersionMajor + '.' + req.httpVersionMinor,
    'remote-addr': req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress)),
    'user-agent': req.headers['user-agent'] || '',
    'content-length': (res._headers && res._headers['content-length']) || (res.__headers && res.__headers['Content-Length']) || -1
  };
  var message = formattedOutput(':remote-addr - - ":method :url HTTP/:http-version" :status :content-length ":referrer" ":user-agent"', req, res);
  var resul = {};
  Object.defineProperty(resul, '@fields', { value: fields, enumerable: true });
  resul.toString = function() {
    return message;
  };
  return resul;
}
exports.logstashConnectFormatter = logstashConnectFormatter;
