/* globals Native */
'use strict';

function open ({onCreated, onChanged, onError}) {
  function external (tmpdir) {
    /* globals push, close */
    var crypto = require('crypto');
    var fs = require('fs');

    var filename = require('path').join(tmpdir, 'stylus-' + crypto.randomBytes(4).readUInt32LE(0) + '.css');
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

  var native = new Native();
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
  native.post({
    method: 'spec'
  }).then(resp => {
    const tmpdir = resp.tmpdir;
    if (tmpdir) {
      native.send({
        permissions: ['crypto', 'fs', 'path'],
        script: `(${external.toString()})('${tmpdir}')`
      });
    }
    else {
      throw Error('cannot find system\'s temporary directory');
    }
  }).catch(onError);
}

open({
  onCreated: (filename) => {
    // open the created tmp file in Sublime Text for Mac OS
    const native = new Native();
    native.post({
      permissions: ['child_process'],
      script: `
        const {exec} = require('child_process');
        exec('open -a "Sublime Text" ${filename}', (error, stdout, stderr) => {
          push({error, stdout, stderr});
          close();
        });
      `
    });
  },
  onChanged: resp => console.log('file changed', resp),
  onError: e => console.error(e)
});
