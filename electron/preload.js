'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function assertString(value, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value;
}

function normalizeSaveOptions(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Save options are required');
  return {
    defaultPath: assertString(options.defaultPath, 'defaultPath'),
    content: assertString(options.content, 'content'),
  };
}

contextBridge.exposeInMainWorld('atlas', {
  getData: () => ipcRenderer.invoke('atlas:get-data'),
  getAppInfo: () => ipcRenderer.invoke('atlas:get-app-info'),
  checkForUpdates: () => ipcRenderer.invoke('atlas:check-for-updates'),
  openExternal: url => ipcRenderer.invoke('atlas:open-external', assertString(url, 'url')),
  saveFile: options => ipcRenderer.invoke('atlas:save-file', normalizeSaveOptions(options)),
  loadFile: () => ipcRenderer.invoke('atlas:load-file'),
});
