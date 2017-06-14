'use strict';

var Native = function () {
  this.channel = chrome.runtime.connectNative('com.add0n.stylus');
  this.callbacks = {};
  this.resolve = null;
  this.reject = null;

  this.channel.onDisconnect.addListener(() => {
    const error = new Error('Unexpended exit of the native client. Either native client is not integrated or the running application is crashed.');
    if (this.reject) {
      this.reject(error);
    }
    else {
      this.emit('error', error);
    }
    this.resolve = this.reject = this.channel = null;
  });
  this.channel.onMessage.addListener(response => {
    if (this.resolve) {
      this.resolve(response);
    }
    else {
      this.emit('response', response);
    }
    this.resolve = this.reject = null;
  });
};
Native.prototype.on = function (name, callback) {
  this.callbacks[name] = this.callbacks[name] || [];
  this.callbacks[name].push(callback);
};
Native.prototype.emit = function (name, data) {
  (this.callbacks[name] || []).forEach(c => c(data));
};
Native.prototype.post = function (request) {
  if (!this.channel) {
    return Promise.reject(new Error('there is no open channel'));
  }
  return new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
    this.channel.postMessage(request);
  });
};
Native.prototype.send = function (request) {
  if (!this.channel) {
    return Promise.reject(new Error('there is no open channel'));
  }
  this.channel.postMessage(request);
};
Native.prototype.kill = function () {
  if (this.channel) {
    this.channel.disconnect();
  }
  this.channel = null;
};
