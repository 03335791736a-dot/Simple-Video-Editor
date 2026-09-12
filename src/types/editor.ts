export interface VideoAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  duration: number; // in seconds
  width: number;
  height: number;
  thumbnailUrl?: string;
  size?: number;
  format?: string;
}

export interface ImageAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  duration: number; // default 3 seconds
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  size?: number;
}

export interface AudioAsset {
  id: string;
  name: string;
  path: string;
  url: string;
  duration: number; // in seconds
  size?: number;
  format?: string;
}

export type AspectRatioType = 'free' | '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export interface CropSettings {
  enabled: boolean;
  aspectRatio: AspectRatioType;
  x: number; // 0 to 100 (%)
  y: number; // 0 to 100 (%)
  width: number; // 0 to 100 (%)
  height: number; // 0 to 100 (%)
}

export type PatternMode = 'none' | '2:4' | '4:2' | 'custom';

export interface PatternSettings {
  mode: PatternMode;
  keepDuration: number; // e.g., 2
  cutDuration: number;  // e.g., 4
  startWith: 'keep' | 'cut'; // 'keep' for 2:4, 'cut' for 4:2
}

export interface CutSegment {
  index: number;
  start: number;
  end: number;
  duration: number;
  type: 'keep' | 'cut';
}

export type ExportResolution = '360p' | '480p' | '720p' | '1080p' | '1440p' | '4k' | 'original';

export interface ResolutionOption {
  id: ExportResolution;
  label: string;
  resolution: string;
  description: string;
  height: number;
  width?: number;
}

export interface ExportSettings {
  resolution: ExportResolution;
  outputFormat: 'mp4';
  videoCodec: 'libx264';
  audioCodec: 'aac';
}

export interface ExportProgress {
  status: 'idle' | 'preparing' | 'exporting' | 'completed' | 'error';
  percent: number;
  message: string;
  outputPath?: string;
  outputUrl?: string;
  error?: string;
  resolution?: ExportResolution;
}

export interface ProcessedVideoResult {
  url: string;
  outputPath: string;
  duration: number;
  resolution: ExportResolution;
  pattern: PatternMode;
  stats: {
    originalDuration: number;
    newDuration: number;
    cutsCount: number;
    timeSaved: number;
  };
}

export interface ProjectState {
  video: VideoAsset | null;
  crop: CropSettings;
  pattern: PatternSettings;
  exportSettings: ExportSettings;
}
