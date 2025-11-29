export interface FileOperation {
  timestamp: string;
  operation: string;
  details?: string;
}

export interface WindowTitleLog {
  timestamp: string;
  windowTitle: string;
}

export interface Task {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration: number;
  fileOperations: FileOperation[];
  windowTitles: WindowTitleLog[];
  isPaused: boolean;
  pausedDuration: number;
  narration?: string;
}

export interface TimerState {
  currentTask: Task | null;
  isRunning: boolean;
  isPaused: boolean;
}

class TaskTimerService {
  private readonly STORAGE_KEY = 'time_logger_timer_state';
  private readonly GMT_8_OFFSET_MS = 8 * 60 * 60 * 1000;

  getTimerState(): TimerState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[TaskTimer] Error loading timer state:', error);
    }
    return { currentTask: null, isRunning: false, isPaused: false };
  }

  saveTimerState(state: TimerState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[TaskTimer] Error saving timer state:', error);
    }
  }

  startTask(taskName: string): Task {
    return {
      id: `task_${Date.now()}`,
      name: taskName,
      startTime: new Date().toISOString(),
      duration: 0,
      fileOperations: [],
      windowTitles: [],
      isPaused: false,
      pausedDuration: 0
    };
  }

  calculateDuration(task: Task, isPaused: boolean): number {
    if (!task.startTime) return 0;
    const start = new Date(task.startTime).getTime();
    const end = task.endTime ? new Date(task.endTime).getTime() : Date.now();
    const totalSeconds = Math.floor((end - start) / 1000);
    return Math.max(0, totalSeconds - task.pausedDuration);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  logFileOperation(task: Task, operation: string, details?: string): Task {
    const entry: FileOperation = { timestamp: new Date().toISOString(), operation, details };
    return { ...task, fileOperations: [...task.fileOperations, entry] };
  }

  logWindowTitle(task: Task, windowTitle: string): Task {
    const lastLog = task.windowTitles[task.windowTitles.length - 1];
    const now = new Date();
    if (lastLog) {
      const seconds = (now.getTime() - new Date(lastLog.timestamp).getTime()) / 1000;
      if (lastLog.windowTitle === windowTitle && seconds < 10) {
        return task;
      }
    }
    const entry: WindowTitleLog = { timestamp: now.toISOString(), windowTitle };
    return { ...task, windowTitles: [...task.windowTitles, entry] };
  }

  getTodayDateString(): string {
    const now = new Date();
    const gmt8 = new Date(now.getTime() + this.GMT_8_OFFSET_MS);
    return gmt8.toISOString().split('T')[0];
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    });
  }

  isTaskFromDifferentDay(task: Task | null): boolean {
    if (!task?.startTime) return false;
    const taskDate = new Date(task.startTime);
    const taskDateGmt8 = new Date(taskDate.getTime() + this.GMT_8_OFFSET_MS);
    return taskDateGmt8.toISOString().split('T')[0] !== this.getTodayDateString();
  }
}

export const taskTimerService = new TaskTimerService();

