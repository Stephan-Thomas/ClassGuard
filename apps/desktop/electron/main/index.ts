import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from '../ipc/index.js';
import { DesktopDatabaseService } from '../services/sqlite.service.js';
import { DesktopSyncService } from '../services/sync.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let backgroundSyncTimer: NodeJS.Timeout | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#090a0f',
    title: 'ClassGuard - Student Attendance Tracking & Monitoring System',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Initialize SQLite database
  const db = DesktopDatabaseService.getInstance();
  await db.initialize();
  console.log('[ClassGuard Main] SQLite database initialized successfully.');

  // Register all secure IPC handlers
  registerIpcHandlers(mainWindow);

  // Load URL: Dev server or production bundle
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const maxRetries = 30;
    let retries = 0;
    const pollAndLoad = async () => {
      try {
        await mainWindow!.loadURL(devServerUrl);
        console.log(`[ClassGuard Main] Connected to frontend dev server at ${devServerUrl}`);
      } catch {
        if (retries < maxRetries) {
          retries++;
          setTimeout(pollAndLoad, 400);
        } else {
          console.error(`[ClassGuard Main] Could not reach frontend at ${devServerUrl}`);
        }
      }
    };
    await pollAndLoad();
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Background Auto-Sync Worker (runs every 60 seconds if connected)
  backgroundSyncTimer = setInterval(async () => {
    try {
      const syncService = DesktopSyncService.getInstance();
      const status = db.getSyncStatus();
      if (status.pendingCount > 0) {
        console.log(`[AutoSync] Found ${status.pendingCount} pending records. Attempting sync...`);
        const result = await syncService.syncPendingRecords();
        if (result.success && result.syncedCount > 0) {
          console.log(`[AutoSync] Successfully uploaded ${result.syncedCount} records.`);
        }
      }
    } catch (err: any) {
      console.warn('[AutoSync] Background sync check failed:', err.message);
    }
  }, 60000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (backgroundSyncTimer) clearInterval(backgroundSyncTimer);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
