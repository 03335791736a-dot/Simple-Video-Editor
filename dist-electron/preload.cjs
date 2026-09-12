// electron/preload.ts
var import_electron = require("electron");
var electronAPI = {
  isElectron: true,
  openVideoDialog: async () => {
    return await import_electron.ipcRenderer.invoke("dialog:open-video");
  },
  openImagesDialog: async () => {
    return await import_electron.ipcRenderer.invoke("dialog:open-images");
  },
  openAudioDialog: async () => {
    return await import_electron.ipcRenderer.invoke("dialog:open-audio");
  },
  saveVideoDialog: async (defaultName) => {
    return await import_electron.ipcRenderer.invoke("dialog:save-video", defaultName);
  },
  probeMedia: async (filePath) => {
    return await import_electron.ipcRenderer.invoke("media:probe", filePath);
  },
  exportVideo: async (options, onProgress) => {
    const progressListener = (_event, progress) => {
      onProgress(progress);
    };
    import_electron.ipcRenderer.on("export:progress", progressListener);
    try {
      const result = await import_electron.ipcRenderer.invoke("media:export", options);
      return result;
    } finally {
      import_electron.ipcRenderer.removeListener("export:progress", progressListener);
    }
  },
  openOutputFolder: async (filePath) => {
    return await import_electron.ipcRenderer.invoke("shell:open-folder", filePath);
  },
  getAppVersion: async () => {
    return await import_electron.ipcRenderer.invoke("app:version");
  }
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
