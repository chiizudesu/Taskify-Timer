# Taskify Timer - Development Roadmap

This roadmap tracks all planned features and improvements for the Taskify Timer application. Check off items as they are completed.

---

## 🎨 UI Improvements

### Layout System
- [ ] **Create layout context/state management**
  - [ ] Add layout mode state (horizontal/vertical)
  - [ ] Persist layout preference to localStorage/config
  - [ ] Create responsive layout hook

- [ ] **Horizontal Layout (Current)**
  - [ ] Ensure current layout works correctly
  - [ ] Test window snapping for full width/height on horizontal monitors
  - [ ] Verify all elements scale properly

- [ ] **Vertical Layout**
  - [ ] Design vertical layout mockup
  - [ ] Implement vertical layout component structure
  - [ ] Rearrange sidebar to top/bottom for vertical monitors
  - [ ] Adjust timer display for vertical orientation
  - [ ] Rearrange WorkShiftInfographic for vertical layout
  - [ ] Test window snapping for full width/height on vertical monitors

- [ ] **Flexible Elements**
  - [ ] Make timer display responsive to layout changes
  - [ ] Make search bar flexible (width/height based on layout)
  - [ ] Make control buttons adapt to layout orientation
  - [ ] Make WorkShiftInfographic responsive
  - [ ] Ensure all spacing/padding adapts to layout

### Custom Title Bar
- [ ] **Remove standard window controls**
  - [ ] Remove minimize button
  - [ ] Remove maximize button

- [ ] **Add layout toggle buttons**
  - [ ] Add horizontal layout button (icon: horizontal lines/rectangle)
  - [ ] Add vertical layout button (icon: vertical lines/rectangle)
  - [ ] Implement toggle functionality between layouts
  - [ ] Add visual indicator for current layout mode
  - [ ] Add tooltips for layout buttons

- [ ] **Keep close button**
  - [ ] Ensure close button remains functional
  - [ ] Maintain close button styling

- [ ] **IPC handlers for layout switching**
  - [ ] Add `window-set-layout` IPC handler in main process
  - [ ] Add `window-set-layout` to preload.ts
  - [ ] Add `windowSetLayout` to electron.d.ts
  - [ ] Implement window resize logic for layout changes

---

## 💬 Dialogs & Modals

### Flexible Dialog System
- [ ] **Dialog layout detection**
  - [ ] Detect current app layout (horizontal/vertical)
  - [ ] Pass layout context to dialog components

- [ ] **Horizontal layout dialogs**
  - [ ] Review current dialog sizing (Add Custom Task, Edit Task, Stop Timer)
  - [ ] Ensure dialogs fit well in horizontal layout
  - [ ] Test dialog positioning and sizing

- [ ] **Vertical layout dialogs**
  - [ ] Design vertical-optimized dialog layouts
  - [ ] Adjust dialog width/height for vertical orientation
  - [ ] Rearrange form fields for vertical layout
  - [ ] Test all modals in vertical layout:
    - [ ] Add Custom Task modal
    - [ ] Edit Task modal
    - [ ] Stop Timer modal

- [ ] **Responsive dialog components**
  - [ ] Make dialog content stack vertically when needed
  - [ ] Adjust input field layouts based on available space
  - [ ] Ensure dialogs don't overflow viewport

---

## ⚙️ Settings Window

### Convert Settings to Standalone Window
- [ ] **Create settings window in main process**
  - [ ] Add `createSettingsWindow()` function in main.ts
  - [ ] Configure settings window size and properties
  - [ ] Load settings window HTML/renderer
  - [ ] Handle settings window lifecycle (open/close)

- [ ] **Settings window IPC**
  - [ ] Add `open-settings-window` IPC handler
  - [ ] Add `openSettingsWindow` to preload.ts
  - [ ] Add `openSettingsWindow` to electron.d.ts

- [ ] **Convert SettingsModal to SettingsWindow component**
  - [ ] Create new `SettingsWindow.tsx` component
  - [ ] Move settings logic from modal to window component
  - [ ] Add window title bar (or use system frame)
  - [ ] Update TimeLoggerWindow to open settings window instead of modal

- [ ] **Settings window management**
  - [ ] Prevent multiple settings windows from opening
  - [ ] Handle settings window close events
  - [ ] Ensure settings persist correctly

---

## 🔧 Services & Core Functionality

### Fix Task Tracker ESM Error
- [ ] **Replace get-windows with native solution**
  - [ ] Research Windows native APIs for window tracking
  - [ ] Implement Windows `GetForegroundWindow` API
  - [ ] Add `SetWinEventHook` for window change events
  - [ ] Create native window tracking service
  - [ ] Remove `get-windows` dependency from package.json

- [ ] **Alternative: Fix ESM import**
  - [ ] If keeping get-windows, ensure proper dynamic import
  - [ ] Verify import works in compiled Electron main process
  - [ ] Test window tracking functionality

### Optimize Task Tracker (Based on Task Tracking.md)
- [ ] **Implement sampling interval**
  - [ ] Change from continuous tracking to 3-5 second sampling
  - [ ] Add configurable sampling interval (default: 5 seconds)
  - [ ] Update settings to include sampling interval option

- [ ] **Implement time-slicing logic**
  - [ ] Track window changes with timestamps
  - [ ] Extend duration if same window, create new entry if changed
  - [ ] Store window slices efficiently

- [ ] **Add idle detection**
  - [ ] Implement Windows `GetLastInputInfo` API
  - [ ] Add idle threshold configuration (default: 5 minutes)
  - [ ] Flag idle time in window logs
  - [ ] Add UI option to discard/keep idle time

- [ ] **Optimize data storage**
  - [ ] Store window slices instead of every change
  - [ ] Implement efficient data structure for window logs
  - [ ] Add cleanup for old window log entries

- [ ] **Update Task interface**
  - [ ] Update `WindowTitleLog` to include start/end timestamps
  - [ ] Add `isIdle` flag to window logs
  - [ ] Ensure backward compatibility with existing tasks

---

## 📊 Reports & Analytics

### Daily Report Window
- [ ] **Create daily report window**
  - [ ] Add `createDailyReportWindow()` in main.ts
  - [ ] Configure report window size and properties
  - [ ] Create `DailyReportWindow.tsx` component

- [ ] **Daily report IPC**
  - [ ] Add `open-daily-report` IPC handler
  - [ ] Add `get-daily-report-data` IPC handler
  - [ ] Add IPC methods to preload.ts and electron.d.ts

- [ ] **Daily report UI**
  - [ ] Display date selector
  - [ ] Show total tasks count
  - [ ] Display billable vs non-billable breakdown
  - [ ] Show total duration
  - [ ] Show billable duration
  - [ ] List all tasks with:
    - [ ] Task name
    - [ ] Duration
    - [ ] Billable indicator (badge/icon)
    - [ ] Click handler to show details

- [ ] **Task detail view**
  - [ ] Create task detail modal/panel
  - [ ] Show app usage timeline during task
    - [ ] List window titles with timestamps
    - [ ] Show duration per app/window
    - [ ] Display idle periods (if any)
  - [ ] Show file operations (if tracked)
  - [ ] Show narration (if available)

- [ ] **Report data aggregation**
  - [ ] Create report service to aggregate task data
  - [ ] Calculate billable vs non-billable totals
  - [ ] Group tasks by client/project
  - [ ] Calculate productivity metrics

### Weekly Report View
- [ ] **Weekly report window**
  - [ ] Create `WeeklyReportWindow.tsx` component
  - [ ] Add week selector (date range picker)
  - [ ] Display weekly summary:
    - [ ] Total hours per day
    - [ ] Billable vs non-billable per day
    - [ ] Task breakdown by day
    - [ ] Weekly totals

- [ ] **Weekly report IPC**
  - [ ] Add `open-weekly-report` IPC handler
  - [ ] Add `get-weekly-report-data` IPC handler
  - [ ] Add IPC methods to preload.ts and electron.d.ts

- [ ] **Weekly aggregation logic**
  - [ ] Aggregate tasks across date range
  - [ ] Group by day
  - [ ] Calculate daily and weekly totals

### Monthly Report View
- [ ] **Monthly report window**
  - [ ] Create `MonthlyReportWindow.tsx` component
  - [ ] Add month/year selector
  - [ ] Display monthly summary:
    - [ ] Calendar view with daily totals
    - [ ] Monthly billable vs non-billable
    - [ ] Top tasks/clients
    - [ ] Productivity trends

- [ ] **Monthly report IPC**
  - [ ] Add `open-monthly-report` IPC handler
  - [ ] Add `get-monthly-report-data` IPC handler
  - [ ] Add IPC methods to preload.ts and electron.d.ts

- [ ] **Monthly aggregation logic**
  - [ ] Aggregate tasks for entire month
  - [ ] Group by week and day
  - [ ] Calculate monthly totals and averages

### Report Navigation
- [ ] **Add report access from main window**
  - [ ] Add "Reports" button/menu item
  - [ ] Create report menu with options:
    - [ ] Daily Report
    - [ ] Weekly Report
    - [ ] Monthly Report
  - [ ] Add keyboard shortcuts for reports (optional)

---

## 🔌 XPM Integration

### XPM API Integration
- [ ] **Research XPM API**
  - [ ] Document XPM API endpoints
  - [ ] Identify authentication method
  - [ ] Understand timesheet entry format
  - [ ] Test API connectivity

- [ ] **Create XPM service**
  - [ ] Create `services/xpm.ts` service file
  - [ ] Implement API client
  - [ ] Add authentication handling
  - [ ] Add error handling and retry logic

- [ ] **XPM configuration**
  - [ ] Add XPM settings to settings window:
    - [ ] API endpoint URL
    - [ ] API key/token
    - [ ] Project/client mappings
    - [ ] Enable/disable sync toggle
  - [ ] Store XPM config securely

- [ ] **Timesheet sync logic**
  - [ ] Map tasks to XPM timesheet entries
  - [ ] Handle billable vs non-billable flagging
  - [ ] Add sync on task completion (optional)
  - [ ] Add manual sync button
  - [ ] Add batch sync for multiple tasks

- [ ] **Sync status & feedback**
  - [ ] Show sync status indicator
  - [ ] Display last sync timestamp
  - [ ] Show sync errors/warnings
  - [ ] Add sync history/log

- [ ] **XPM IPC handlers**
  - [ ] Add `xpm-sync-task` IPC handler
  - [ ] Add `xpm-sync-batch` IPC handler
  - [ ] Add `xpm-test-connection` IPC handler
  - [ ] Add IPC methods to preload.ts and electron.d.ts

---

## 🧪 Testing & Quality Assurance

### Layout Testing
- [ ] Test horizontal layout on various screen sizes
- [ ] Test vertical layout on various screen sizes
- [ ] Test layout switching functionality
- [ ] Test window snapping behavior
- [ ] Test all dialogs in both layouts

### Functionality Testing
- [ ] Test task tracking with optimized tracker
- [ ] Test idle detection
- [ ] Test daily/weekly/monthly reports
- [ ] Test XPM integration (if API available)
- [ ] Test settings window functionality

### Performance Testing
- [ ] Verify optimized tracker reduces CPU usage
- [ ] Test with large number of tasks
- [ ] Test report generation performance
- [ ] Test memory usage over time

---

## 📝 Documentation

- [ ] Update README with new features
- [ ] Document layout system
- [ ] Document report features
- [ ] Document XPM integration setup
- [ ] Add developer notes for future maintenance

---

## 🎯 Priority Order (Suggested)

1. **High Priority**
   - Fix task tracker ESM error
   - Optimize task tracker (sampling, idle detection)
   - Create vertical layout
   - Custom title bar with layout toggles

2. **Medium Priority**
   - Flexible dialogs
   - Settings window conversion
   - Daily report window

3. **Lower Priority**
   - Weekly/monthly reports
   - XPM integration
   - Advanced analytics

---

## 📅 Progress Tracking

**Last Updated:** [Date]
**Overall Progress:** 0/XX tasks completed

### Quick Stats
- UI Improvements: 0/X
- Dialogs: 0/X
- Settings: 0/X
- Services: 0/X
- Reports: 0/X
- XPM Integration: 0/X

---

## Notes

- Keep this file updated as tasks are completed
- Add any blockers or issues encountered
- Document any deviations from the original plan
- Link to relevant PRs or commits when applicable

