# Cut and Crop

A modern browser-based rhythmic video editor built with **React**, **TypeScript**, **Vite**, **FFmpeg WebAssembly**, **Express**, and **Tailwind CSS**.

## Key Capabilities & Architecture

- **Browser-Native Execution**: Runs directly inside modern browsers with standard `<input type="file">`, Blob URLs, and HTML5 video/audio metadata inspection. Zero desktop Electron dependencies required.
- **Client-Side FFmpeg WebAssembly**: Encodes, trims, crops, and transcodes videos locally inside the browser using `@ffmpeg/ffmpeg` and `@ffmpeg/core`. User media files remain completely private and are never uploaded to cloud storage.
- **Automated Rhythmic Video Cutting**:
  - **2:4 Pattern**: Keeps the first 2 seconds, cuts the next 4 seconds, keeps 2 seconds, cuts 4 seconds, recursively through the entire timeline.
  - **4:2 Pattern**: Cuts the first 4 seconds, keeps the next 2 seconds, cuts 4 seconds, keeps 2 seconds, recursively through the entire timeline.
  - **Custom Intervals**: Fine-tune custom keep and cut duration intervals.
- **Interactive Visual Crop**: Free crop, 16:9 Landscape, 9:16 Portrait / Story, and 1:1 Square presets with draggable crop handles and live preview.
- **Multi-Quality Exports**: Export and transcode into 360p, 480p, 720p HD, 1080p Full HD, 1440p 2K, or 4K Ultra HD.
- **Multi-Resolution Downloads**: Transcode generated videos into multiple resolutions on demand directly in the browser.
- **Authentication & Access Control**: Built-in authentication screen with session management and admin dashboard.

---

## Development and Build

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production web application
npm run build

# Start production server
npm start
```
