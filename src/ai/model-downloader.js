// EVOS Browser - Model Downloader
// Downloads and manages the AI model on first launch

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');
const { MODEL_CONFIG, MODELS_PATH, ensureDirectories, getModelPath } = require('./config');

class ModelDownloader {
  constructor() {
    this.downloadProgress = 0;
    this.downloadSpeed = 0;
    this.isDownloading = false;
    this.abortController = null;
    this.listeners = new Set();
  }

  // Check if model exists and is valid
  isModelReady() {
    const modelPath = getModelPath();
    console.log('[ModelDownloader] Checking model at:', modelPath);
    
    if (!fs.existsSync(modelPath)) {
      console.log('[ModelDownloader] Model file does not exist');
      return false;
    }
    
    // Check file size - must be at least 500MB to be a valid GGUF model
    const stats = fs.statSync(modelPath);
    const minSize = 500 * 1024 * 1024; // 500MB minimum
    
    console.log('[ModelDownloader] Model file size:', stats.size, '(' + (stats.size / (1024*1024*1024)).toFixed(2) + ' GB)');
    
    const isValid = stats.size >= minSize;
    console.log('[ModelDownloader] Model valid:', isValid);
    
    return isValid;
  }

  // Get model file path
  getModelPath() {
    return getModelPath();
  }

  // Add progress listener
  onProgress(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Emit progress to all listeners
  emitProgress(data) {
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('Progress listener error:', e);
      }
    });
  }

  // Download model with progress tracking
  async downloadModel(useFallback = false) {
    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    ensureDirectories();

    const config = useFallback ? MODEL_CONFIG.fallback : MODEL_CONFIG;
    const modelPath = path.join(MODELS_PATH, config.filename);
    const tempPath = modelPath + '.download';

    this.isDownloading = true;
    this.downloadProgress = 0;
    this.abortController = new AbortController();

    try {
      this.emitProgress({
        status: 'starting',
        message: `Downloading ${config.name}...`,
        progress: 0,
        speed: 0,
        downloaded: 0,
        total: config.size
      });

      // Check for partial download
      let startByte = 0;
      if (fs.existsSync(tempPath)) {
        const stats = fs.statSync(tempPath);
        startByte = stats.size;
        this.emitProgress({
          status: 'resuming',
          message: `Resuming download from ${this.formatBytes(startByte)}...`,
          progress: (startByte / config.size) * 100,
          downloaded: startByte,
          total: config.size
        });
      }

      await this.downloadFile(config.downloadUrl, tempPath, config.size, startByte);

      // Rename temp file to final
      console.log('[ModelDownloader] Download finished, renaming temp file...');
      console.log('[ModelDownloader] Temp path:', tempPath);
      console.log('[ModelDownloader] Final path:', modelPath);
      
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }
      fs.renameSync(tempPath, modelPath);
      
      // Verify the file exists after rename
      if (fs.existsSync(modelPath)) {
        const finalStats = fs.statSync(modelPath);
        console.log('[ModelDownloader] Model file saved successfully, size:', finalStats.size);
      } else {
        console.error('[ModelDownloader] ERROR: Model file not found after rename!');
      }

      this.emitProgress({
        status: 'complete',
        message: 'Model downloaded successfully!',
        progress: 100,
        downloaded: config.size,
        total: config.size
      });

      return modelPath;

    } catch (error) {
      if (error.name === 'AbortError') {
        this.emitProgress({
          status: 'cancelled',
          message: 'Download cancelled',
          progress: this.downloadProgress
        });
      } else {
        this.emitProgress({
          status: 'error',
          message: `Download failed: ${error.message}`,
          progress: this.downloadProgress,
          error: error.message
        });
      }
      throw error;
    } finally {
      this.isDownloading = false;
      this.abortController = null;
    }
  }

  // Core download function with resume support
  downloadFile(url, destPath, totalSize, startByte = 0) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const options = {
        headers: {}
      };
      
      if (startByte > 0) {
        options.headers['Range'] = `bytes=${startByte}-`;
      }

      const fileStream = createWriteStream(destPath, {
        flags: startByte > 0 ? 'a' : 'w'
      });

      let downloadedBytes = startByte;
      let lastTime = Date.now();
      let lastBytes = startByte;

      const request = protocol.get(url, options, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          fileStream.close();
          this.downloadFile(response.headers.location, destPath, totalSize, startByte)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          // Calculate speed every 500ms
          const now = Date.now();
          if (now - lastTime >= 500) {
            const bytesPerSecond = (downloadedBytes - lastBytes) / ((now - lastTime) / 1000);
            this.downloadSpeed = bytesPerSecond;
            lastTime = now;
            lastBytes = downloadedBytes;
          }

          this.downloadProgress = (downloadedBytes / totalSize) * 100;
          
          this.emitProgress({
            status: 'downloading',
            message: `Downloading AI model...`,
            progress: this.downloadProgress,
            speed: this.downloadSpeed,
            downloaded: downloadedBytes,
            total: totalSize,
            eta: this.calculateETA(downloadedBytes, totalSize, this.downloadSpeed)
          });
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); // Delete failed file
          reject(err);
        });
      });

      request.on('error', reject);

      // Handle abort
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          request.destroy();
          fileStream.close();
          reject(new Error('AbortError'));
        });
      }
    });
  }

  // Cancel ongoing download
  cancelDownload() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Calculate ETA
  calculateETA(downloaded, total, speed) {
    if (speed <= 0) return 'Calculating...';
    const remaining = total - downloaded;
    const seconds = remaining / speed;
    
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Delete model file
  deleteModel() {
    const modelPath = getModelPath();
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
    }
    // Also delete temp file if exists
    const tempPath = modelPath + '.download';
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }

  // Get download status
  getStatus() {
    return {
      isDownloading: this.isDownloading,
      isReady: this.isModelReady(),
      progress: this.downloadProgress,
      speed: this.downloadSpeed,
      modelName: MODEL_CONFIG.name,
      modelSize: MODEL_CONFIG.size,
      modelPath: getModelPath()
    };
  }
}

// Singleton instance
const modelDownloader = new ModelDownloader();

module.exports = { ModelDownloader, modelDownloader };
