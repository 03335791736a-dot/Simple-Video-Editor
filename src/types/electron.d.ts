import { ExportProgress, ExportResolution, PatternSettings } from './editor';

export interface MediaProbeResult {
  format: string;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  size: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface ExportJobOptions {
  videoPath?: string;
  images?: Array<{ path: string; duration: number }>;
  audioPath?: string;
  crop?: {
    enabled: boolean;
    x: number; // percentage 0 - 100
    y: number;
    width: number;
    height: number;
  };
  pattern?: PatternSettings;
  resolution: ExportResolution;
  duplicateFillAudio?: boolean;
  outputPath: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  openVideoDialog: () => Promise<{ canceled: boolean; filePath?: string; fileData?: File }>;
  openImagesDialog: () => Promise<{ canceled: boolean; filePaths?: string[]; fileData?: File[] }>;
  openAudioDialog: () => Promise<{ canceled: boolean; filePath?: string; fileData?: File }>;
  saveVideoDialog: (defaultName?: string) => Promise<{ canceled: boolean; filePath?: string }>;
  probeMedia: (filePath: string) => Promise<MediaProbeResult>;
  exportVideo: (
    options: ExportJobOptions,
    onProgress: (progress: ExportProgress) => void
  ) => Promise<{ success: boolean; outputPath: string; error?: string }>;
  openOutputFolder: (filePath: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
