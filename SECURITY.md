# Security Policy

## Reporting a Vulnerability

Devizee is a local-first desktop download manager. It spawns `yt-dlp`
and `ffmpeg` as subprocesses and does not transmit user data to any
server.

If you discover a security issue, please **do not** open a public GitHub
issue. Instead, report it privately via GitHub's
[Security Advisory](https://github.com/Touseeef/devizee-lite-universal-video-downloader/security/advisories/new)
feature, or email **connect.touseeef@gmail.com** with:

- A description of the issue
- Steps to reproduce
- Affected version

You can expect an initial response within 72 hours.

## Scope

In scope:
- Remote code execution through malicious URLs or downloaded content
- Subprocess command injection
- Local privilege escalation
- Credential disclosure (browser cookie access when enabled)

Out of scope:
- Denial of service through very large downloads
- Social engineering
- Issues in third-party binaries (`yt-dlp`, `ffmpeg`) — report those
  upstream