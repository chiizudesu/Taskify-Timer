import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  readCsv: (filePath: string) => ipcRenderer.invoke('read-csv', filePath),
  saveTaskLog: (date: string, task: any) => ipcRenderer.invoke('save-task-log', date, task),
  getTaskLogs: (date: string) => ipcRenderer.invoke('get-task-logs', date),
  deleteTaskLog: (date: string, taskId: string) => ipcRenderer.invoke('delete-task-log', date, taskId),
  getActiveWindowTitle: () => ipcRenderer.invoke('get-active-window-title'),
  resizeFloatingTimer: (width: number, height: number) => ipcRenderer.invoke('resize-floating-timer', width, height),
  sendToMainWindow: (channel: string, ...args: any[]) => ipcRenderer.send('send-to-main-window', channel, ...args),
  onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => ipcRenderer.on(channel, callback),
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, callback),
  selectFile: (options?: any) => ipcRenderer.invoke('select-file', options),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowSetLayout: (layout: 'horizontal' | 'vertical') => ipcRenderer.invoke('window-set-layout', layout)
});

