/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 Electron IPC 모의 객체 (named export 형식)
export const ipcRenderer = {
  on: jest.fn(() => ipcRenderer),
  once: jest.fn(() => ipcRenderer),
  off: jest.fn(() => ipcRenderer),
  removeListener: jest.fn(() => ipcRenderer),
  removeAllListeners: jest.fn(() => ipcRenderer),
  send: jest.fn(),
  invoke: jest.fn().mockResolvedValue(undefined),
  sendSync: jest.fn(),
  postMessage: jest.fn(),
  addListener: jest.fn(() => ipcRenderer),
  setMaxListeners: jest.fn(() => ipcRenderer),
  getMaxListeners: jest.fn().mockReturnValue(10),
  listeners: jest.fn().mockReturnValue([]),
  rawListeners: jest.fn().mockReturnValue([]),
  emit: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(0),
  prependListener: jest.fn(() => ipcRenderer),
  prependOnceListener: jest.fn(() => ipcRenderer),
  eventNames: jest.fn().mockReturnValue([]),
};

export const ipcMain = {
  on: jest.fn(() => ipcMain),
  once: jest.fn(() => ipcMain),
  off: jest.fn(() => ipcMain),
  removeListener: jest.fn(() => ipcMain),
  removeAllListeners: jest.fn(() => ipcMain),
  addListener: jest.fn(() => ipcMain),
  setMaxListeners: jest.fn(() => ipcMain),
  getMaxListeners: jest.fn().mockReturnValue(10),
  listeners: jest.fn().mockReturnValue([]),
  rawListeners: jest.fn().mockReturnValue([]),
  emit: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(0),
  prependListener: jest.fn(() => ipcMain),
  prependOnceListener: jest.fn(() => ipcMain),
  eventNames: jest.fn().mockReturnValue([]),
  handle: jest.fn(),
  handleOnce: jest.fn(),
  removeHandler: jest.fn(),
};

export const shell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue(""),
  showItemInFolder: jest.fn(),
  beep: jest.fn(),
  readShortcutLink: jest.fn(),
  writeShortcutLink: jest.fn(),
  trashItem: jest.fn().mockResolvedValue(undefined),
};

export const clipboard = {
  writeText: jest.fn(),
  readText: jest.fn().mockReturnValue(""),
  writeHTML: jest.fn(),
  readHTML: jest.fn().mockReturnValue(""),
  writeImage: jest.fn(),
  readImage: jest.fn(),
  writeRTF: jest.fn(),
  readRTF: jest.fn().mockReturnValue(""),
  writeBookmark: jest.fn(),
  readBookmark: jest.fn(),
  writeBuffer: jest.fn(),
  readBuffer: jest.fn(),
  clear: jest.fn(),
  availableFormats: jest.fn().mockReturnValue([]),
  has: jest.fn().mockReturnValue(false),
  read: jest.fn().mockReturnValue(""),
  write: jest.fn(),
};

export const app = {
  getVersion: jest.fn().mockReturnValue("3.0.0"),
  getLocale: jest.fn().mockReturnValue("en"),
  getPath: jest.fn().mockReturnValue("tmp"),
  getName: jest.fn().mockReturnValue("DAIVE"),
  setPath: jest.fn(),
  getAppPath: jest.fn().mockReturnValue("/app"),
  isReady: jest.fn().mockReturnValue(true),
  whenReady: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn(),
  exit: jest.fn(),
  relaunch: jest.fn(),
  isPackaged: false,
  on: jest.fn(),
  once: jest.fn(),
};

export const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: "" }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  showErrorBox: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
  },
  close: jest.fn(),
  destroy: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  focus: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
}));

export const Menu = {
  buildFromTemplate: jest.fn().mockReturnValue({}),
  setApplicationMenu: jest.fn(),
  getApplicationMenu: jest.fn(),
};

export const Tray = jest.fn().mockImplementation(() => ({
  setContextMenu: jest.fn(),
  setImage: jest.fn(),
  setToolTip: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
}));

export const nativeTheme = {
  shouldUseDarkColors: false,
  themeSource: "system" as const,
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
};

export const safeStorage = {
  isEncryptionAvailable: jest.fn().mockReturnValue(true),
  encryptString: jest.fn((text: string) => Buffer.from(`encrypted:${text}`)),
  decryptString: jest.fn((buffer: Buffer) => buffer.toString().replace("encrypted:", "")),
  getSelectedStorageBackend: jest.fn().mockReturnValue("gnome_libsecret"),
  setUsePlainTextEncryption: jest.fn(),
};

export default {
  ipcRenderer,
  ipcMain,
  shell,
  clipboard,
  app,
  dialog,
  BrowserWindow,
  Menu,
  Tray,
  nativeTheme,
  safeStorage,
};
