# aria2c Invocation Reference

Concrete flags for the direct-link engine. Adjust segment counts per the
adaptive strategy in SKILL.md — these are the fixed/always-on flags.

## Base command (spawned same way as yt-dlp/ffmpeg — see sidecar-manager skill)
```
aria2c.exe
  --dir="<resolved output dir>"
  --out="<sanitized filename>"
  --split=<adaptive, 1-16>
  --max-connection-per-server=<same value as --split>
  --min-split-size=1M
  --continue=true
  --auto-file-renaming=false      # we own rename/collision logic, not aria2c
  --allow-overwrite=true          # matches --force-overwrites decision from subprocess-reliability skill
  --file-allocation=falloc        # fast on Windows NTFS, avoids slow prealloc stalls
  --summary-interval=1            # emit progress once per second, parseable
  --console-log-level=warn        # keep stdout signal-to-noise low; drain stderr per subprocess-reliability skill, never null it
  --max-tries=5
  --retry-wait=2
  --timeout=30
  --save-session="<taskDataDir>/task-<taskId>.aria2session"
  <url>
```

## Progress parsing
aria2c's `--summary-interval=1` output is columnar, not JSON — if precise
structured progress matters more than avoiding one more dependency,
prefer running aria2c in **RPC mode** instead (`--enable-rpc
--rpc-listen-port=<local, randomized per launch>`) and poll
`aria2.tellStatus` over local JSON-RPC. RPC mode is more robust to parse
than stdout scraping and gives exact byte counts, connection count, and
per-segment state — worth the slightly higher setup cost given how much
this app already leans on precise progress events for the status model.

## Resume on relaunch
```
aria2c.exe --input-file="<path to a generated .txt with pending URLs>" --continue=true ...
```
Or, if using RPC mode throughout: reconnect to a fresh RPC instance and
call `aria2.addUri` with the same `--dir`/`--out` — aria2c detects the
existing partial file + its own `.aria2` control file and resumes
automatically as long as `--continue=true` is set and the output path is
identical to the interrupted attempt.

## Do not
- Do not disable `--continue` — that's the entire point of using aria2c
  over a hand-rolled downloader.
- Do not set `--split` higher than needed for small files — more
  connections against a small file adds overhead without benefit and can
  trip some servers' rate limiting, causing failures IDM itself is known
  to hit on certain hosts.
