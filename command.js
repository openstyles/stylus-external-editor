'use strict';

var commands = {
  windows: 'start "" [filename]',
  mac: 'open [filename]',
  linux: 'start [filename]'
};

commands.guess = () => {
  if (navigator.platform.startsWith('Win')) {
    return commands.windows;
  }
  if (navigator.platform.startsWith('Linux')) {
    return commands.linux;
  }
  return commands.mac;
};
