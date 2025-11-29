import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { promises as fs, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const isDev = !app.isPackaged;
const rendererPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5183;
const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || `http://localhost:${rendererPort}`;
const CONFIG_PATH = path.join(app.getPath('userData'), 'time-logger-config.json');
const TASK_LOG_DIR = path.join(app.getPath('userData'), 'time-logger-tasks');

let mainWindow: BrowserWindow | null = null;

const defaultConfig = {
  rootPath: app.getPath('documents'),
  workShiftStart: '06:00',
  workShiftEnd: '15:00',
  productivityTargetHours: 7.5,
  trackWindows: true,
  windowTrackingInterval: 2
};

async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

async function saveConfig(config: Record<string, any>) {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function ensureTaskDir() {
  if (!existsSync(TASK_LOG_DIR)) {
    mkdirSync(TASK_LOG_DIR, { recursive: true });
  }
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1068,
    height: 300,
    minWidth: 1068,
    minHeight: 300,
    backgroundColor: '#0f172a',
    title: 'Time Logger',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL(devServerUrl);
    // DevTools disabled by default - can be opened manually with F12 if needed
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-config', async () => {
  return await loadConfig();
});

ipcMain.handle('set-config', async (_, config) => {
  const current = await loadConfig();
  const merged = { ...current, ...config };
  await saveConfig(merged);
  return merged;
});

ipcMain.handle('read-csv', async (_, filePath: string) => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
  } catch (error) {
    console.error('[TimeLogger] Failed to read CSV:', error);
    return [];
  }
});

ipcMain.handle('select-file', async (_, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    ...options
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle('save-task-log', async (_, date: string, task: any) => {
  try {
    await ensureTaskDir();
    const filePath = path.join(TASK_LOG_DIR, `${date}.json`);
    let tasks: any[] = [];
    if (existsSync(filePath)) {
      tasks = JSON.parse(readFileSync(filePath, 'utf-8'));
    }
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    writeFileSync(filePath, JSON.stringify(tasks, null, 2));
    return { success: true };
  } catch (error) {
    console.error('[TimeLogger] Failed to save task log:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-task-logs', async (_, date: string) => {
  try {
    await ensureTaskDir();
    const filePath = path.join(TASK_LOG_DIR, `${date}.json`);
    if (!existsSync(filePath)) {
      return { success: true, tasks: [] };
    }
    const tasks = JSON.parse(readFileSync(filePath, 'utf-8'));
    return { success: true, tasks };
  } catch (error) {
    console.error('[TimeLogger] Failed to load task logs:', error);
    return { success: false, tasks: [], error: String(error) };
  }
});

ipcMain.handle('delete-task-log', async (_, date: string, taskId: string) => {
  try {
    await ensureTaskDir();
    const filePath = path.join(TASK_LOG_DIR, `${date}.json`);
    if (!existsSync(filePath)) {
      return { success: false, error: 'Log not found' };
    }
    const tasks = JSON.parse(readFileSync(filePath, 'utf-8'));
    const filtered = tasks.filter((task: any) => task.id !== taskId);
    writeFileSync(filePath, JSON.stringify(filtered, null, 2));
    return { success: true };
  } catch (error) {
    console.error('[TimeLogger] Failed to delete task log:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('resize-floating-timer', async (_, width: number, height: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(Math.floor(width), Math.floor(height));
  }
});

ipcMain.on('send-to-main-window', (_event, channel, ...args) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
});

ipcMain.handle('get-active-window-title', async () => {
  try {
    const { activeWindow } = await import('get-windows');
    const win = await activeWindow();
    if (!win) {
      return { success: true, title: '' };
    }
    const title = win.title || (win as any).name || '';
    return { success: true, title };
  } catch (error) {
    console.error('[TimeLogger] Failed to fetch active window title:', error);
    return { success: false, title: '', error: (error as Error).message };
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

