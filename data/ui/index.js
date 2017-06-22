'use strict';

var log = {
  element: document.querySelector('#status span'),
  id: null,
  queue: [],
  write: msg => {
    log.queue.push(msg);
    log.check();
  },
  check: () => {
    console.error('called');
    if (log.id) {
      return;
    }
    const msg = log.queue.shift();
    if (msg) {
      log.element.textContent = msg;
      log.id = window.setTimeout(() => {
        log.id = null;
        log.check();
      }, 2000);
    }
    else {
      log.element.textContent = '';
      log.id = window.clearTimeout(log.id);
    }
  }
};

log.write('Drop CSS files to start editing');

var entry = {
  parent: document.getElementById('content'),
  template: document.querySelector('template'),
  log: (id, message) => {
    const log = document.querySelector(`[data-id="${id}"] [data-id=log]`);
    if (log) {
      log.textContent = message;
    }
  },
  add: (filename, content) => {
    const clone = document.importNode(entry.template.content, true);
    clone.querySelector('[data-id=filename]').textContent = filename;
    const parent = clone.querySelector('.entry');
    entry.parent.appendChild(clone);
    if (content) {
      chrome.runtime.sendMessage({
        method: 'open-temporary',
        content,
        filename
      }, id => {
        parent.dataset.id = id;
      });
    }
    return parent;
  }
};
// drag & drop
document.body.addEventListener('dragover', e => {
  e.preventDefault();
  const types = [...e.dataTransfer.types];

  e.dataTransfer.dropEffect = (
    types.indexOf('Files') !== -1
  )  ? 'link' : 'none';
});
document.body.addEventListener('drop', e => {
  e.preventDefault();
  let files = [...event.dataTransfer.files];
  const ignored = files.filter(file => file.type !== 'text/css');
  if (ignored.length) {
    ignored.forEach(file => log.write(`${file.name} is ignored since it is not a CSS file`));
  }
  files.filter(file => file.type === 'text/css').forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      entry.add(file.name, e.target.result);
    };
    reader.readAsText(file, 'utf-8');
  });
});
// updates
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'log') {
    entry.log(request.id, request.message);
  }
});
// startup
chrome.runtime.sendMessage({
  method: 'get-cache'
}, arr => {
  arr.forEach(({id, filename, log}) => {
    entry.add(filename).dataset.id = id;
    entry.log(id, log.message);
  });
});
// commands
document.addEventListener('click', e => {
  const target = e.target;
  const cmd = target.dataset.cmd;
  if (cmd === 'detach') {
    const parent = e.target.closest('.entry');
    chrome.runtime.sendMessage({
      method: 'detach',
      id: parent.dataset.id
    }, () => {
      parent.parentNode.removeChild(parent);
      log.write('Native client observer is detached');
    });
  }
});
// unload
window.addEventListener('beforeunload', () => {
  const background = chrome.extension.getBackgroundPage();
  background.resize({
    left: window.screenX,
    top: window.screenY,
    width: Math.max(window.outerWidth, 100),
    height: Math.max(window.outerHeight, 100)
  });
});
