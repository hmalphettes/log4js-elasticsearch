
var esLogBuffers = [];

function EsOneAtaTime(layout, esclient, layoutES) {
  this.esclient = esclient;
  this.layout = layout;
  this.layoutES = layoutES;
}

EsOneAtaTime.prototype.log = function(loggingEvent) {
  var cc = this.esclient.index(this.layoutES.indexName(loggingEvent)
    , this.layoutES.typeName(loggingEvent)
    , this.layout(loggingEvent)
    , this.layoutES.logId(loggingEvent));
  cc.exec(function() {
    //emit an error?
  });
};


function EsLogBuffer(layout, esclient, layoutES, timeout, buffersize) {
  this.esclient = esclient;
  this.layout = layout;
  this.layoutES = layoutES;
  if (buffersize > 0) {
    this.bulkCmdsLength = buffersize * 2;
  }
  this.timeout = timeout;
  this.bulkCmds = [];
  if (this.timeout > 0) {
    var self = this;
    setTimeout(function() {
      self.flush();
    }, this.timeout);
  }
}


EsLogBuffer.prototype.log = function(loggingEvent) {
  this.bulkCmds.push({
    index: {
      _id: this.layoutES.logId(loggingEvent)
      , _type: this.layoutES.typeName(loggingEvent)
      , _index: this.layoutES.indexName(loggingEvent)
    }
  });
  this.bulkCmds.push(this.layout(loggingEvent));
  if (this.bulkCmds.length >= this.bulkCmdsLength) {
    this.flush();
  }
};

EsLogBuffer.prototype.flush = function() {
  if (this.bulkCmds.length === 0) {
    return;
  }
  var current = this.bulkCmds;
  this.bulkCmds = [];
  this.esclient.bulk(current).exec(function() {});
};

/**
 * The function that knows how to post to elasticsearch: 
 * one at a time or in bulk mode regurlarly.
 */
exports.makeEsLog = function(layout, esclient, layoutES, timeout, buffersize) {
  if (buffersize === 1) {
    return new EsOneAtaTime(layout, esclient, layoutES);
  }
  if ((!timeout || timeout === 0) && (!buffersize || buffersize <= 0)) {
    buffersize = 256;
  }
  if (!timeout) {
    timeout = 30000; //30 seconds
  }

  var esBulk = new EsLogBuffer(layout, esclient, layoutES, timeout, buffersize);
  esLogBuffers.push(esBulk);
  return esBulk;
};

function flushAll(doreset) {
  var flushthem = esLogBuffers;
  if (doreset) {
    esLogBuffers = [];
  }
  flushthem.forEach(function (esLogBuffer) {
    esLogBuffer.flush();
  });
}

exports.flushAll = flushAll;

//on process exit send what's is missing.
process.on('exit', function() {
  flushAll(true);
});
