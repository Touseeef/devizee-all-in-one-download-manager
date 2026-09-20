# Routing Rule Schema

Stored in SQLite as a `rules` table (columns mirror this shape, or store
`action` as a single JSON column if the action set grows later — start
relational since the fields are fixed and small for v1).

```json
{
  "id": "uuid",
  "name": "Podcast channel -> audio archive",
  "priority": 0,
  "enabled": true,
  "match": {
    "type": "channel_contains",
    "value": "Lex Fridman"
  },
  "action": {
    "destination_folder": "D:/Media/Podcasts",
    "default_format": "audio_mp3_192",
    "auto_start": true,
    "ignore_quiet_hours": false
  }
}
```

## `match.type` values (v1 — keep this list small)
- `domain_equals` — e.g. `youtube.com`
- `channel_contains` — case-insensitive substring match against the
  uploader/channel name returned by `fetch_metadata`
- `url_contains` — raw substring match against the pasted URL (covers
  playlist IDs, specific paths, etc.)

## Evaluation order
Rules are evaluated by ascending `priority` (0 = checked first); first
match wins. If no rule matches, fall through to the built-in default
(current Downloads/Devizee folder, "Best Quality" format, always ask
before auto-starting) — this default is not itself a row in the table,
it's a hardcoded fallback so the table can never end up empty in a way
that breaks routing.

## What NOT to put in v1
- Regex matching — adds real complexity (need a safe regex engine,
  timeout protection against catastrophic backtracking) for a use case
  three simple match types already cover. Revisit only if users
  specifically request it.
- Multiple simultaneous matching rules "merging" their actions — keep it
  first-match-wins, simple to reason about and to explain in the UI.
