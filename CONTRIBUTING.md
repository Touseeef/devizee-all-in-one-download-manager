# Contributing to Devizee Lite
 
Thank you for your interest in contributing to **Devizee Lite**! We welcome community contributions, bug reports, feature discussions, and documentation improvements.

---

## 🛠️ Project Architecture

Devizee Lite is structured into clean, decoupled layers:
1. **Frontend (`/src`)**: React 18, TypeScript, and Tailwind CSS.
2. **Backend Engine (`/src-tauri`)**: Rust running on Tauri v2 with SQLite (`rusqlite`) for atomic task and history persistence.
3. **Companion Extension (`/devizee-aio-download-manager-extension` & `/native_host`)**: Chromium Manifest V3 browser extension communicating with the desktop app via Native Messaging.

---

## 🚀 Development Setup

### Prerequisites
- **Node.js**: `v18.0.0+` (LTS recommended) and `npm`
- **Rust**: Latest stable toolchain (`rustup update stable`)
- **C++ Build Tools**: Microsoft C++ Build Tools (via Visual Studio Installer on Windows)

### Getting Started
1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/Touseeef/devizee-lite-universal-video-downloader.git
   cd devizee-lite-universal-video-downloader
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Sidecar Binaries**:
   Ensure `yt-dlp` and `ffmpeg` binaries are placed in `src-tauri/bin/`:
   - `yt-dlp-x86_64-pc-windows-msvc.exe`
   - `ffmpeg-x86_64-pc-windows-msvc.exe`

4. **Run in Development**:
   ```bash
   npm run tauri dev
   ```

---

## 📋 Pull Request Guidelines

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Verify Code Quality**:
   Before submitting, ensure all type checks and compiler checks pass cleanly:
   ```bash
   npm run lint
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
3. **Commit Messages**: Follow standard Conventional Commits format (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`).
4. **Open a PR**: Submit your pull request against the `main` branch with a clear description of changes made and any relevant screenshots.

---

## 💬 Community & Support

- Open an issue for bug reports or feature suggestions.
- For private security disclosures, refer to our [Security Policy](SECURITY.md).