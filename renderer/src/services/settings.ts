export interface TimeLoggerSettings {
  rootPath: string;
  clientbasePath?: string;
  workShiftStart?: string;
  workShiftEnd?: string;
  productivityTargetHours?: number;
  trackWindows?: boolean;
  windowTrackingInterval?: number;
}

class SettingsService {
  private cached: TimeLoggerSettings | null = null;

  async getSettings(): Promise<TimeLoggerSettings> {
    if (this.cached) return this.cached;
    const api = (window as any).electronAPI;
    if (!api?.getConfig) {
      this.cached = { rootPath: '' };
      return this.cached;
    }
    const settings = await api.getConfig();
    this.cached = settings ?? { rootPath: '' };
    return this.cached;
  }

  async setSettings(next: TimeLoggerSettings): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api?.setConfig) {
      throw new Error('Config bridge is unavailable.');
    }
    const current = await this.getSettings();
    const merged = { ...current, ...next };
    await api.setConfig(merged);
    this.cached = merged;
  }

  clearCache() {
    this.cached = null;
  }
}

export const settingsService = new SettingsService();

