/* globals Native, commands, fromMozillaFormat */
'use strict';

function openTmpFile (content, {onCreated, onChanged, onError}) {
  const native = new Native();
  native.on('error', onError);
  native.on('response', resp => {
    if (resp.method === 'file-created') {
      onCreated(resp.filename);
    }
    else if (resp.method === 'file-changed') {
      onChanged(resp);
    }
    else if (resp.error) {
      onError(resp.error);
    }
    else {
      console.error(resp);
      throw Error('unsupported response');
    }
  });
  native.send({
    permissions: ['crypto', 'fs', 'path', 'os'],
    args: [content],
    script: `
      const crypto = require('crypto');
      const fs = require('fs');

      const filename = require('path').join(
        require('os').tmpdir(),
        'stylus-' + crypto.randomBytes(4).readUInt32LE(0) + '.css'
      );
      fs.writeFile(filename, args[0], e => {
        if (e) {
          push({
            type: 'internal',
            error: e.message
          });
          close();
        }
        else {
          push({
            method: 'file-created',
            filename
          });
          fs.watchFile(filename, event => {
            fs.readFile(filename, 'utf8', (e, content) => {
              if (e) {
                push({
                  type: 'file-read',
                  error: e.message
                });
              }
              else {
                push({
                  method: 'file-changed',
                  content,
                  event
                });
              }
            });
          });
        }
      });
    `
  });

  return native;
}

function openEditor (filename, onError) {
  // open the created tmp file in Sublime Text for Mac OS
  chrome.storage.local.get({
    command: commands.guess()
  }, prefs => {
    const command = prefs.command.replace('[filename]', filename);
    let native = new Native();
    native.post({
      permissions: ['child_process'],
      args: [command],
      script: String.raw`
        const {exec} = require('child_process');
        exec(args[0], (error, stdout, stderr) => {
          push({error, stdout, stderr});
          close();
        });
      `
    }).catch(onError);
  });
}

var cache = {};

function log (id, message, type = 'log') {
  message = (new Date()).toLocaleTimeString() + ' - ' + message;
  cache[id].log = {message, type};
  chrome.runtime.sendMessage({
    method: 'log',
    id,
    type,
    message
  });
}

function toSections (content) {
  let erros = [];
  let sections = [];
  return new Promise(resolve => {
    fromMozillaFormat(
      content,
      (e, section) => {
        if (e) {
          erros.push(e);
        }
        else {
          sections.push(section);
        }
      },
      e => erros.push(e),
      () => resolve({sections, erros})
    );
  });
}

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'open-temporary') {
    const id = Math.random();
    const native = openTmpFile(request.content, {
      onCreated: filename => {
        log(id, 'a new temporary file is created "' + filename + '"');
        openEditor(filename, e => log(id, e, 'error'));
      },
      onChanged: r => {
        if (r.method === 'file-changed') {
          log(id, request.filename + ' -> ' + 'file content is changed. Updating style');
          // send to Stylus
          toSections(r.content).then(r => console.log(r));
        }
      },
      onError: e => log(id, request.filename + ' -> ' + (e.message || e.error), 'error')
    });
    cache[id] = {
      native,
      filename: request.filename
    };
    response(id);
  }
  else if (request.method === 'get-cache') {
    response(Object.entries(cache).map(([id, {filename, log}]) => {
      return {
        id,
        filename,
        log
      };
    }));
  }
  else if (request.method === 'detach') {
    const obj = cache[request.id];
    if (obj) {
      obj.native.kill();
      delete cache[request.id];
    }
  }
});

// browser action
var win;
chrome.browserAction.onClicked.addListener(() => {
  function create () {
    chrome.storage.local.get({
      width: 700,
      height: 500,
      left: Math.round((screen.availWidth - 700) / 2),
      top: Math.round((screen.availHeight - 500) / 2),
    }, prefs => {
      chrome.windows.create(Object.assign(prefs, {
        url: chrome.extension.getURL('data/ui/index.html'),
        type: 'popup'
      }), w => win = w);
    });
  }
  if (win && win.id) {
    chrome.windows.get(win.id, w => {
      if (chrome.runtime.lastError || !w) {
        create();
      }
      else {
        chrome.windows.update(win.id, {focused: true});
      }
    });
  }
  else {
    create();
  }
});

// resize
function resize (prefs) { // jshint ignore:line
  chrome.storage.local.set(prefs);
}
