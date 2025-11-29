interface ElectronAPI {
  getConfig: () => Promise<any>;
  setConfig: (config: any) => Promise<any>;
  readCsv: (path: string) => Promise<any[]>;
  saveTaskLog: (date: string, task: any) => Promise<{ success: boolean }>;
  getTaskLogs: (date: string) => Promise<{ success: boolean; tasks: any[] }>;
  deleteTaskLog: (date: string, id: string) => Promise<{ success: boolean }>;
  getActiveWindowTitle: () => Promise<{ success: boolean; title: string }>;
  resizeFloatingTimer: (width: number, height: number) => Promise<void>;
  sendToMainWindow: (channel: string, ...args: any[]) => void;
  onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | undefined>;
  selectDirectory: () => Promise<string | undefined>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowSetLayout: (layout: 'horizontal' | 'vertical') => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

