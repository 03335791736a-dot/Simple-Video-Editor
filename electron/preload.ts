import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, ExportJobOptions, MediaProbeResult } from '../src/types/electron';
import { ExportProgress } from '../src/types/editor';

const electronAPI: ElectronAPI = {
  isElectron: true,

  openVideoDialog: async () => {
    return await ipcRenderer.invoke('dialog:open-video');
  },

  openImagesDialog: async () => {
    return await ipcRenderer.invoke('dialog:open-images');
  },

  openAudioDialog: async () => {
    return await ipcRenderer.invoke('dialog:open-audio');
  },

  saveVideoDialog: async (defaultName?: string) => {
    return await ipcRenderer.invoke('dialog:save-video', defaultName);
  },

  probeMedia: async (filePath: string): Promise<MediaProbeResult> => {
    return await ipcRenderer.invoke('media:probe', filePath);
  },

  exportVideo: async (
    options: ExportJobOptions,
    onProgress: (progress: ExportProgress) => void
  ) => {
    const progressListener = (_event: any, progress: ExportProgress) => {
      onProgress(progress);
    };

    ipcRenderer.on('export:progress', progressListener);

    try {
      const result = await ipcRenderer.invoke('media:export', options);
      return result;
    } finally {
      ipcRenderer.removeListener('export:progress', progressListener);
    }
  },

  openOutputFolder: async (filePath: string) => {
    return await ipcRenderer.invoke('shell:open-folder', filePath);
  },

  getAppVersion: async () => {
    return await ipcRenderer.invoke('app:version');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
