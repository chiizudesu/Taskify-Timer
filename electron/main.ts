import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import path from 'path';
import { promises as fs, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Try to load ffi-rs for Windows API calls, but make it optional
let ffiRs: any = null;
try {
  ffiRs = require('ffi-rs');
  // Debug: log available methods
  console.log('[WorkArea] ffi-rs loaded, available methods:', Object.keys(ffiRs || {}));
} catch (error) {
  console.log('[WorkArea] ffi-rs not available, work area reservation will be disabled');
  console.log('[WorkArea] To enable: npm install ffi-rs (requires Rust toolchain)');
}

const isDev = !app.isPackaged;
const rendererPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5183;
const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || `http://localhost:${rendererPort}`;
const CONFIG_PATH = path.join(app.getPath('userData'), 'time-logger-config.json');
const TASK_LOG_DIR = path.join(app.getPath('userData'), 'time-logger-tasks');

let mainWindow: BrowserWindow | null = null;
let workAreaReserved = false;
let originalWorkArea: { x: number; y: number; width: number; height: number } | null = null;

const defaultConfig = {
  rootPath: app.getPath('documents'),
  workShiftStart: '06:00',
  workShiftEnd: '15:00',
  productivityTargetHours: 7.5,
  trackWindows: true,
  windowTrackingInterval: 2,
  layout: 'horizontal'
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

const ASPECT_RATIO = 1068 / 300; // 3.56

// Calculate minimum height needed for right panel (WorkShiftInfographic)
// Title bar: 32px + Time badge section: ~40px + Shift time: ~50px + Logged time: ~50px + Today's Summary: ~120px + Padding: ~20px = ~312px
// Using 350px as safe minimum to ensure all content is visible without scrolling
const MIN_HEIGHT_FOR_RIGHT_PANEL = 350;

const calculateWindowDimensions = (layout: 'horizontal' | 'vertical', windowBounds?: { x: number; y: number; width: number; height: number }) => {
  // Get the display where the window currently is (or primary if no window bounds provided)
  let display;
  if (windowBounds) {
    const windowCenterX = windowBounds.x + windowBounds.width / 2;
    const windowCenterY = windowBounds.y + windowBounds.height / 2;
    display = screen.getDisplayNearestPoint({ x: windowCenterX, y: windowCenterY });
  } else {
    display = screen.getPrimaryDisplay();
  }
  
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  if (layout === 'horizontal') {
    const width = screenWidth;
    // Base height on right panel requirements to ensure all content is visible
    let height = MIN_HEIGHT_FOR_RIGHT_PANEL;
    
    // For wider monitors, we can use aspect ratio if it gives more height (better proportions)
    const aspectRatioHeight = Math.floor(width / ASPECT_RATIO);
    height = Math.max(height, aspectRatioHeight);
    
    console.log('[Layout] Horizontal - Display:', { screenWidth, screenHeight }, 'Calculated:', { width, height, basedOn: 'rightPanel' });
    return { width, height };
  } else {
    const height = screenHeight;
    const width = Math.floor(height / ASPECT_RATIO);
    console.log('[Layout] Vertical - Display:', { screenWidth, screenHeight }, 'Calculated:', { width, height });
    return { width, height };
  }
};

// Reserve Windows work area so maximized windows don't cover the timer
// Uses SystemParametersInfo(SPI_SETWORKAREA) via ffi-rs (Rust-based FFI)
async function reserveWorkArea(window: BrowserWindow, layout: 'horizontal' | 'vertical') {
  if (process.platform !== 'win32') {
    console.log('[WorkArea] Work area reservation only supported on Windows');
    return;
  }

  if (!ffiRs) {
    console.log('[WorkArea] ffi-rs not available - work area reservation disabled');
    console.log('[WorkArea] Install with: npm install ffi-rs (requires Rust toolchain)');
    return;
  }

  try {
    const bounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    const workArea = display.workArea;
    
    // Store original work area in screen coordinates if not already stored
    const screenBounds = display.bounds;
    if (!originalWorkArea) {
      originalWorkArea = {
        x: screenBounds.x,
        y: screenBounds.y,
        width: screenBounds.width,
        height: screenBounds.height
      };
    }
    
    // Check if window is at screen edge (within 5px tolerance)
    const isAtLeftEdge = Math.abs(bounds.x - screenBounds.x) < 5;
    const isAtRightEdge = Math.abs((bounds.x + bounds.width) - (screenBounds.x + screenBounds.width)) < 5;
    const isAtTopEdge = Math.abs(bounds.y - screenBounds.y) < 5;
    const isAtBottomEdge = Math.abs((bounds.y + bounds.height) - (screenBounds.y + screenBounds.height)) < 5;
    
    // Calculate new work area in screen coordinates (SPI_SETWORKAREA expects screen coords)
    let newWorkAreaRect = {
      left: screenBounds.x,
      top: screenBounds.y,
      right: screenBounds.x + screenBounds.width,
      bottom: screenBounds.y + screenBounds.height
    };
    
    if (layout === 'horizontal' && isAtTopEdge) {
      // Reserve space at top for horizontal layout
      newWorkAreaRect.top = screenBounds.y + bounds.height;
      console.log('[WorkArea] Reserving top area for horizontal layout:', { reservedHeight: bounds.height, newWorkAreaRect });
    } else if (layout === 'vertical' && isAtLeftEdge) {
      // Reserve space at left for vertical layout
      newWorkAreaRect.left = screenBounds.x + bounds.width;
      console.log('[WorkArea] Reserving left area for vertical layout:', { reservedWidth: bounds.width, newWorkAreaRect });
    } else {
      // Window not at edge, restore work area if previously reserved
      if (workAreaReserved) {
        await restoreWorkArea();
      }
      return;
    }
    
    const SPI_SETWORKAREA = 0x002F;
    const SPIF_UPDATEINIFILE = 0x01;
    const SPIF_SENDCHANGE = 0x02;
    
    // Open user32.dll and kernel32.dll libraries
    ffiRs.open({
      library: 'user32',
      path: 'user32.dll'
    });
    ffiRs.open({
      library: 'kernel32',
      path: 'kernel32.dll'
    });
    
    // Define RECT structure as a RecordFieldType (struct)
    const RECT = {
      left: ffiRs.DataType.I32,
      top: ffiRs.DataType.I32,
      right: ffiRs.DataType.I32,
      bottom: ffiRs.DataType.I32
    };
    
    // Create RECT data in screen coordinates
    const rectData = {
      left: newWorkAreaRect.left,
      top: newWorkAreaRect.top,
      right: newWorkAreaRect.right,
      bottom: newWorkAreaRect.bottom
    };
    
    console.log('[WorkArea] RECT data:', rectData);
    
    // Create pointer to RECT structure
    const rectPointer = ffiRs.createPointer({
      paramsType: [RECT],
      paramsValue: [rectData]
    });
    
    console.log('[WorkArea] Created pointer:', rectPointer);
    
    // Get GetLastError function for error checking
    const result = ffiRs.load({
      library: 'user32',
      funcName: 'SystemParametersInfoW',
      retType: ffiRs.DataType.Boolean,
      paramsType: [
        ffiRs.DataType.U32,  // uiAction (SPI_SETWORKAREA)
        ffiRs.DataType.U32,  // uiParam (0)
        ffiRs.DataType.External,  // pvParam (pointer to RECT)
        ffiRs.DataType.U32   // fWinIni (flags)
      ],
      paramsValue: [
        SPI_SETWORKAREA,
        0,
        rectPointer[0],  // Use the created pointer
        SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
      ]
    });
    
    // Check for errors
    if (!result) {
      // Get error code
      const errorCode = ffiRs.load({
        library: 'kernel32',
        funcName: 'GetLastError',
        retType: ffiRs.DataType.U32,
        paramsType: [],
        paramsValue: []  // Empty array for no parameters
      });
      console.error('[WorkArea] SystemParametersInfoW failed with error code:', errorCode);
      // Free the pointer before throwing
      ffiRs.freePointer({
        paramsType: [RECT],
        paramsValue: rectPointer,
        pointerType: ffiRs.PointerType.CPointer
      });
      throw new Error(`SystemParametersInfoW returned false (error code: ${errorCode})`);
    }
    
    // Free the pointer after use
    ffiRs.freePointer({
      paramsType: [RECT],
      paramsValue: rectPointer,
      pointerType: ffiRs.PointerType.CPointer
    });
    
    workAreaReserved = true;
    console.log('[WorkArea] Work area reserved successfully');
  } catch (error) {
    console.error('[WorkArea] Failed to reserve work area:', error);
    // Continue without work area reservation - app will still work, just won't reserve space
  }
}

// Restore work area when window is closed or moved away from edge
async function restoreWorkArea() {
  if (!workAreaReserved || !originalWorkArea) {
    return;
  }

  if (process.platform !== 'win32') {
    return;
  }

  if (!ffiRs) {
    return;
  }

  try {
    const SPI_SETWORKAREA = 0x002F;
    const SPIF_UPDATEINIFILE = 0x01;
    const SPIF_SENDCHANGE = 0x02;
    
    // Open user32.dll library if not already open
    try {
      ffiRs.open({
        library: 'user32',
        path: 'user32.dll'
      });
    } catch {
      // Library might already be open
    }
    
    // Define RECT structure as a RecordFieldType (struct)
    const RECT = {
      left: ffiRs.DataType.I32,
      top: ffiRs.DataType.I32,
      right: ffiRs.DataType.I32,
      bottom: ffiRs.DataType.I32
    };
    
    // Create pointer to RECT structure
    const rectPointer = ffiRs.createPointer({
      paramsType: [RECT],
      paramsValue: [{
        left: originalWorkArea.x,
        top: originalWorkArea.y,
        right: originalWorkArea.x + originalWorkArea.width,
        bottom: originalWorkArea.y + originalWorkArea.height
      }]
    });
    
    // Call SystemParametersInfoW to restore
    const result = ffiRs.load({
      library: 'user32',
      funcName: 'SystemParametersInfoW',
      retType: ffiRs.DataType.Boolean,
      paramsType: [
        ffiRs.DataType.U32,  // uiAction (SPI_SETWORKAREA)
        ffiRs.DataType.U32,  // uiParam (0)
        ffiRs.DataType.External,  // pvParam (pointer to RECT)
        ffiRs.DataType.U32   // fWinIni (flags)
      ],
      paramsValue: [
        SPI_SETWORKAREA,
        0,
        rectPointer[0],  // Use the created pointer
        SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
      ]
    });
    
    // Get error code if failed
    const errorCode = result ? 0 : ffiRs.load({
      library: 'kernel32',
      funcName: 'GetLastError',
      retType: ffiRs.DataType.U32,
      paramsType: [],
      paramsValue: []
    });
    
    // Check for errors
    if (!result) {
      console.error('[WorkArea] SystemParametersInfoW restore failed with error code:', errorCode);
      // Free the pointer before returning
      ffiRs.freePointer({
        paramsType: [RECT],
        paramsValue: rectPointer,
        pointerType: ffiRs.PointerType.CPointer
      });
      throw new Error(`SystemParametersInfoW returned false (error code: ${errorCode})`);
    }
    
    // Free the pointer after use
    ffiRs.freePointer({
      paramsType: [RECT],
      paramsValue: rectPointer,
      pointerType: ffiRs.PointerType.CPointer
    });
    
    workAreaReserved = false;
    originalWorkArea = null;
    console.log('[WorkArea] Work area restored');
  } catch (error) {
    console.error('[WorkArea] Failed to restore work area:', error);
  }
}

const createWindow = async () => {
  const config = await loadConfig();
  const layout = config.layout || 'horizontal';
  const dimensions = calculateWindowDimensions(layout);
  console.log('[Layout] Creating window with layout:', layout, 'Dimensions:', dimensions);

  mainWindow = new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    resizable: true, // Allow resizing programmatically
    backgroundColor: '#0f172a',
    title: 'Time Logger',
    frame: false,
    titleBarStyle: 'hidden',
    x: layout === 'horizontal' ? 0 : undefined,
    y: layout === 'vertical' ? 0 : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  
  // Disable user resizing after window is created
  mainWindow.setResizable(false);
  
  // Log actual window size after creation
  const [actualWidth, actualHeight] = mainWindow.getSize();
  console.log('[Layout] Window created - Actual size:', { width: actualWidth, height: actualHeight });

  if (isDev) {
    await mainWindow.loadURL(devServerUrl);
    // DevTools disabled by default - can be opened manually with F12 if needed
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Reserve work area after window is shown
  mainWindow.once('ready-to-show', () => {
    reserveWorkArea(mainWindow!, layout);
  });
};

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await restoreWorkArea();
    app.quit();
  }
});

// Restore work area when app is quitting
app.on('before-quit', async () => {
  await restoreWorkArea();
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

ipcMain.handle('window-set-layout', async (_, layout: 'horizontal' | 'vertical') => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window not available' };
  }

  try {
    // Get current window bounds to determine which display it's on
    const windowBounds = mainWindow.getBounds();
    const [currentWidth, currentHeight] = mainWindow.getSize();
    console.log('[Layout] BEFORE resize - Current dimensions:', { width: currentWidth, height: currentHeight }, 'Bounds:', windowBounds);
    
    // Calculate dimensions based on the display where the window currently is
    const dimensions = calculateWindowDimensions(layout, windowBounds);
    console.log('[Layout] Target dimensions:', dimensions);
    
    // Temporarily enable resizing to allow programmatic resize
    mainWindow.setResizable(true);
    
    // Resize window (no min size constraints)
    mainWindow.setSize(dimensions.width, dimensions.height, false);
    
    // Wait a moment for resize to complete, then verify
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get dimensions AFTER resize
    const [afterWidth, afterHeight] = mainWindow.getSize();
    console.log('[Layout] AFTER resize - Actual dimensions:', { width: afterWidth, height: afterHeight });
    
    // If resize didn't work, try again with animate: false
    if (afterWidth !== dimensions.width || afterHeight !== dimensions.height) {
      console.log('[Layout] Resize mismatch, retrying...');
      mainWindow.setSize(dimensions.width, dimensions.height, false);
      await new Promise(resolve => setTimeout(resolve, 100));
      const [retryWidth, retryHeight] = mainWindow.getSize();
      console.log('[Layout] After retry - Actual dimensions:', { width: retryWidth, height: retryHeight });
    }
    
    // Get the display where the window is to position correctly
    const windowCenterX = windowBounds.x + windowBounds.width / 2;
    const windowCenterY = windowBounds.y + windowBounds.height / 2;
    const display = screen.getDisplayNearestPoint({ x: windowCenterX, y: windowCenterY });
    
    // Position at screen edge of the current display
    mainWindow.setPosition(display.workArea.x, display.workArea.y);
    console.log('[Layout] Positioned at:', { x: display.workArea.x, y: display.workArea.y });
    
    // Disable user resizing again
    mainWindow.setResizable(false);
    
    // Reserve work area for this layout
    await reserveWorkArea(mainWindow, layout);
    
    // Save layout preference to config
    const config = await loadConfig();
    await saveConfig({ ...config, layout });
    
    return { success: true };
  } catch (error) {
    console.error('[TimeLogger] Failed to set layout:', error);
    return { success: false, error: String(error) };
  }
});

