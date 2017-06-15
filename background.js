/* globals Native, commands */
'use strict';

function openTmpFile ({onCreated, onChanged, onError}) {
  function external () {
    /* globals push, close */
    const crypto = require('crypto');
    const fs = require('fs');

    const filename = require('path').join(
      require('os').tmpdir(),
      'stylus-' + crypto.randomBytes(4).readUInt32LE(0) + '.css'
    );
    fs.writeFile(filename, '/* this is a temporary style file */', e => {
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
          fs.readFile(filename, 'utf8', (e, data) => {
            if (e) {
              push({
                type: 'file-read',
                error: e.message
              });
            }
            else {
              push({
                method: 'file-changed',
                data,
                event
              });
            }
          });
        });
      }
    });
  }

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
    script: String.raw`(${external.toString()})()`
  });
}

function observeFile (filename, {onChanged, onError}) {
  function external (filename) {
    /* globals push, close */
    var fs = require('fs');

    fs.watchFile(filename, event => {
      fs.readFile(filename, 'utf8', (e, data) => {
        if (e) {
          push({
            type: 'file-read',
            error: e.message
          });
        }
        else {
          push({
            method: 'file-changed',
            data,
            event
          });
        }
      });
    });
  }
  const native = new Native();
  native.on('error', onError);
  native.on('response', resp => {
    if (resp.method === 'file-changed') {
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
    permissions: ['fs'],
    script: `(${external.toString()})('${filename}')`
  });
}

var observe = {
  onCreated: (filename) => {
    // open the created tmp file in Sublime Text for Mac OS
    chrome.storage.local.get({
      command: commands.guess()
    }, prefs => {
      const command = prefs.command.replace('[filename]', filename.replace(/\\/g, '\\\\'));
      let native = new Native();
      native.post({
        permissions: ['child_process'],
        script: String.raw`
          const {exec} = require('child_process');
          exec('${command}', (error, stdout, stderr) => {
            push({error, stdout, stderr});
            close();
          });
        `
      }).then(
        r => console.log(r),
        observe.onError
      );
    });
  },
  onChanged: resp => console.log('file changed', resp),
  onError: e => console.error('Error occurred', e)
};

/* open a temp file and observe */
openTmpFile(observe);

/* only observe file changes */
//observeFile('/Users/jeremy/Desktop/test.css', observe);
