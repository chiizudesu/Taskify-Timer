# How Clockify Tracks App Usage (Developer Perspective)

## 1. Background Activity Recorder (Local Client)

Clockify's desktop app runs a lightweight background process that:

* Listens for active window changes (via OS APIs):
  * **Windows**: `GetForegroundWindow`, `GetWindowThreadProcessId`, `UIAutomation`
  * **macOS**: `NSWorkspace.shared.runningApplications`, `AXObserver`
* Records:
  * Application name
  * Window title
  * Timestamp start/end
  * Idle status (keyboard/mouse inactivity)
  * Optional: screenshots (their "Kiosk" product does this)

This data is stored locally in a small queue or SQLite file.

## 2. Periodic Sampling Instead of Continuous Logging

Clockify does time-slicing (e.g., every 5 seconds):

* Check which window is active
* If same as previous sample → extend duration
* If changed → finalize previous entry, start new entry

This eliminates huge logs and creates a clean timeline.

## 3. Idle Detection

Clockify uses native OS idle APIs:

* **Windows**: `GetLastInputInfo`
* **macOS**: `IOHID` event taps

If idle threshold exceeds X minutes:

* Keeps the time but flags it as idle
* Prompts user whether to discard or keep

## 4. Tracing Is Local-Only Until Synced

Clockify intentionally stores activity locally:

* Prevents missed events if offline
* Reduces server load
* Allows batching uploads

Sync happens when:

* Timer stops
* App regains internet
* Or after a periodic interval (e.g., 30–60 seconds)

## 5. Server-Side Aggregation

Clockify's server merges the raw "slices" into usable analytics:

* App-level totals
* Category grouping (e.g., "Communication", "Dev Tools")
* Work session timelines
* Productivity scoring (if enabled)

The raw data stays as time ranges; rendering happens at query time.

---

## How Reports Are Generated

Clockify does not store precomputed report values; it stores:
```
{ appName, windowTitle, startTimestamp, endTimestamp, idleFlag }
```

When a user opens a report:

1. Server queries relevant slices
2. Groups by:
   * Project / Task
   * App
   * Day
3. Sums durations
4. Returns structured analytics

This is why reports update instantly across devices.

---

## How to Implement Something Like Clockify (Optimal Approach)

Below is a high-level, dev-friendly blueprint.

### A. Local Client Architecture

#### 1. Use OS Native APIs

Avoid polling UI libraries; use actual system hooks.

**Windows Stack**

* Foreground window: `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)`
* Process info: `OpenProcess`, `QueryFullProcessImageName`
* Idle: `GetLastInputInfo`

**macOS Stack**

* Window focus: Accessibility API
* App metadata: `NSRunningApplication`
* Idle: CGEvent taps

#### 2. Use a 3–5 second sampling interval

Optimal balance:

* Fast enough to capture real usage
* Slow enough to avoid huge logs

#### 3. Keep a local buffer (SQLite)

Raw events table structure:
```
id
process_name
window_title
start_time
end_time
is_idle
uploaded (bool)
```

#### 4. Batch your uploads

Send 20–100 events at a time.

Retry logic:

* Exponential backoff
* Stop after N failures
* Resume on connection recovery

### B. Server Architecture

#### 1. Store raw slices in an efficient table

Suggested schema:
```
user_id
start_ts
end_ts
activity_type (app, idle, manual timer, etc.)
app_name
window_title
device_id
```

Indexes:

* `(user_id, start_ts)`
* `(user_id, app_name)`
* `(user_id, date)`

#### 2. Generate reports dynamically with grouped queries

Use analytical queries:

* `SUM(end_ts - start_ts)`
* `GROUP BY app_name`
* Date truncation for daily totals

Caching is optional but improves performance.

### C. Privacy & Compliance

Clockify's approach is deliberate:

* Most sensitive data stays local until sync
* Screenshots are opt-in
* Window titles can be anonymized
* No keystrokes logged

If you're building a commercial tool, adopt the same principles.

---

## Recommended Optimal Architecture Summary

| Area | Best Practice |
|------|--------------|
| **Tracking** | OS-level hooks + 5s sampling |
| **Idle Detection** | Native idle APIs |
| **Data Storage** | Local SQLite buffer |
| **Uploading** | Batched sync with retry |
| **Server** | Store raw slices, compute analytics on demand |
| **Reports** | Grouped aggregations, not precomputed totals |
| **User Experience** | Clean timeline + app totals |