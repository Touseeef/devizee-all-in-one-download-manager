---
name: system-notifications
description: Use when wiring native OS notifications for download completion, errors, or batch summaries. Covers coalescing rules for batch downloads and the sound-on-event setting.
---

# System Notifications

## When to use
Any change that fires a native OS notification on task completion,
failure, or other events the user should know about even when the app
window isn't focused.

## Implementation
- Use Tauri's notification plugin (native Windows toast notifications),
  triggered from the same Rust event path that already emits progress
  events — a notification fires when a task's status transitions into a
  terminal state (`completed`, `error` — see status-model skill), not
  from any separate polling logic.
- Click on the notification should focus/open the app to that task's
  entry, not just dismiss — use whatever click-action the notification
  plugin supports; if action buttons ("Open Folder") are available on
  the platform, wire one, but don't block the notification on that
  capability existing — a plain click-to-open-app is an acceptable
  fallback everywhere.

## Coalescing (don't spam)
If a batch of tasks (e.g. several playlist items in a future phase, or
several queued single downloads) complete within a short window
(~2-3 seconds of each other), fire ONE summary notification ("5 downloads
completed") instead of one per task. Track a short-lived buffer of
recently-completed task IDs and flush it as a single notification after a
brief debounce window, rather than notifying immediately on every
individual completion. The same applies to errors: several failures in
quick succession become "3 downloads failed — view queue for details"
rather than three separate error toasts.

## Sound
- One Settings toggle: "Play a sound on download complete/error." Off by
  default is reasonable, or on by default matching most download
  managers — either is fine, just make it a single toggle, not a
  per-event-type setting (avoid over-configuring this).
- Use the OS's own default notification sound rather than bundling a
  custom audio asset — this avoids any question of sound-asset licensing
  entirely, keeps the installer smaller, and matches how every other
  well-behaved Windows app behaves (users already associate the system
  sound with "something happened," which is exactly the signal wanted
  here).

## Respect the OS, don't fight it
Don't build custom "Do Not Disturb" logic — Windows' own Focus
Assist/notification settings already govern whether toasts interrupt the
user, and native notifications respect that automatically. Reimplementing
that logic inside the app would just create an inconsistent second layer
the user has to separately configure.
