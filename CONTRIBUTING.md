# Contributing to Devizee All-in-One Download Manager

Thank you for your interest in contributing to **Devizee**! We welcome community contributions, bug reports, performance improvements, and documentation enhancements.

---

## 🛠️ Project Architecture

Devizee is an all-in-one download manager composed of three interconnected layers:
1. **Frontend (`/src`)**: React 18, TypeScript, and Tailwind CSS with custom multi-palette theming (including High Contrast).
2. **Backend Engine (`/src-tauri`)**: Rust running on Tauri v2 with SQLite (`rusqlite`) for history and task persistence.
3. **Companion Extension (`/devizee-aio-download-manager-extension` & `/native_host`)**: Manifest V3 browser extension communicating with the desktop app via Chrome Native Messaging.

---

## 🚀 Development Setup

### Prerequisites
- **Node.js**: `v18.0.0+` (LTS recommended) and `npm`
- **Rust**: Latest stable toolchain (`rustup update stable`)
- **Build Tools**:
  - **Windows**: Microsoft C++ Build Tools (via Visual Studio Installer)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libappindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools

### Getting Started
1. **Fork and Clone** the repository:
   ```bash
   git clone [https://github.com/Touseef/devizee-all-in-one-download-manager.git](https://github.com/Touseef/devizee-all-in-one-download-manager.git)
   cd devizee-all-in-one-download-manager