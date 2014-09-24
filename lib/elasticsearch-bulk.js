var esLogBuffers = [];

function EsOneAtaTime(layout, esclient, layoutES) {
  this.esclient = esclient;
  this.layout = layout;
  this.layoutES = layoutES;
}

EsOneAtaTime.prototype.log = function(loggingEvent) {
  this.esclient.index(this.layoutES.indexName(loggingEvent)
    , this.layoutES.typeName(loggingEvent)
    , this.layout(loggingEvent)
    , this.layoutES.logId(loggingEvent)
    , function() {
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
    this.interv = setInterval(function() {
      self.flush();
    }, this.timeout);
    if (typeof this.interv.unref === 'function') {
      this.interv.unref();
    } else {
      console.warn('No support for Timer#unref:\n' +
        '   the setInterval object will keep running the node\n' +
        '   process until it stop for some other reason.\n' +
        '   Call require(log4js-elasticsearch).flushAll(true)\n' +
        '   Call EsLogBuffer#close to clear the setInterval.');
    }
    setupProcessListeners();
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

EsLogBuffer.prototype.close = function() {
  if (this.interv) {
    clearTimeout(this.interv);
  }
};

EsLogBuffer.prototype.flush = function(optionalDone) {
  if (this.bulkCmds.length === 0) {
    if (optionalDone) {
      optionalDone();
    }
    return;
  }
  if (!optionalDone) {
    optionalDone = function() {
      //emit an event to say it is over?
    };
  }
  var current = this.bulkCmds;
  this.bulkCmds = [];
  this.esclient.bulk(current, optionalDone);
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

function flushAll(doreset, optionalDone) {
  var flushthem = esLogBuffers;
  if (doreset) {
    esLogBuffers = [];
    clearProcessListeners();
  }
  if (typeof optionalDone === 'function') {
    var i = -1;
    var flushOneAtATime = function() {
      i++;
      var curr = flushthem[i];
      if (curr) {
        curr.flush(function(err) {
          if (doreset) {
            curr.close();
          }
          flushOneAtATime();
        });
      } else {
        optionalDone();
      }
    };
    flushOneAtATime();
  } else {
    flushthem.forEach(function (esLogBuffer) {
      if (doreset) {
        esLogBuffer.close();
      }
      esLogBuffer.flush();
    });
  }
}

var processListenersSetup = false;

var onProcessSigint = function() {
  clearProcessListeners();
  flushAll(true, function() {
    process.kill(process.pid, 'SIGINT');
  });
};
var onProcessExit = function() {
  clearProcessListeners();
  flushAll(true, function() {
    process.exit();
  });
};

function setupProcessListeners() {
  if (!processListenersSetup) {
    processListenersSetup = true;
    process.addListener('SIGINT', onProcessSigint);
    process.addListener('exit', onProcessExit);    
  }
}
function clearProcessListeners() {
  if (processListenersSetup) {
    processListenersSetup = false;
    process.removeListener('SIGINT', onProcessSigint);
    process.removeListener('exit', onProcessExit);
  }
}

exports.flushAll = flushAll;
