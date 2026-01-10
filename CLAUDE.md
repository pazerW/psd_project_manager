# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PSD Project Manager is an Electron + Vue 3 desktop application for managing PSD design projects. It supports both local-only mode and network mode with a Node.js backend server.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (Electron app)
npm run dev

# Build for production
npm run build

# Run backend server (for network mode)
node server.js
```

## Architecture

### Dual-Mode Operation

The application operates in two distinct modes controlled by `src/utils/networkMode.js`:

1. **Local Mode**: Uses IndexedDB via `src/utils/db.js` for client-side storage
2. **Network Mode**: Connects to Express backend (`server.js`) with SQLite database

Mode switching affects all data operations throughout the app. Check `isNetworkMode()` before implementing data persistence.

### Frontend Structure

- **Framework**: Vue 3 with Composition API
- **Router**: Vue Router (`src/router/index.js`)
- **State**: Pinia stores in `src/stores/`
- **UI**: Element Plus component library
- **Entry**: `src/main.js` initializes Vue app, `electron.js` manages Electron window

### Key Views

- `ProjectList.vue`: Main project listing and management
- `ProjectDetail.vue`: Individual project details and file management
- `AIWorkbench.vue`: AI-powered design analysis features
- `Settings.vue`: Application configuration including network mode toggle

### Backend (Network Mode)

- **Server**: Express.js (`server.js`)
- **Database**: SQLite with better-sqlite3
- **API**: RESTful endpoints for projects, files, tags, and AI features
- **Port**: 3000 (configurable)

### Data Layer

**Local Mode**:
- `src/utils/db.js`: IndexedDB wrapper with stores for projects, files, tags, settings
- All operations are async and return promises

**Network Mode**:
- API calls to backend server
- SQLite database managed by server
- Sync operations on server side

### Electron Integration

- `electron.js`: Main process, window management, IPC handlers
- `src/preload.js`: Exposes safe APIs to renderer (file system, dialogs)
- IPC channels for file operations, system dialogs, and app control

## Important Patterns

### Network Mode Checks

Always check mode before data operations:

```javascript
import { isNetworkMode } from '@/utils/networkMode'

if (isNetworkMode()) {
  // Use fetch() to call backend API
  const response = await fetch('http://localhost:3000/api/projects')
} else {
  // Use IndexedDB
  const projects = await db.getAllProjects()
}
```

### File Path Handling

PSD files are referenced by absolute paths. Use `window.electronAPI.selectFolder()` and `window.electronAPI.selectFile()` for file selection.

### AI Features

AI workbench integrates with external AI services. API keys stored in settings. Check `AIWorkbench.vue` for implementation patterns.

## Database Schema

### IndexedDB Stores (Local Mode)
- `projects`: id, name, path, description, createdAt, updatedAt, tags
- `files`: id, projectId, name, path, size, modifiedAt, thumbnail, tags
- `tags`: id, name, color, category
- `settings`: key-value pairs

### SQLite Tables (Network Mode)
Similar schema to IndexedDB but with relational structure and junction tables for many-to-many relationships.

## Configuration Files

- `vite.config.js`: Vite build configuration with Electron plugin
- `package.json`: Scripts, dependencies, Electron main entry
- No TypeScript - pure JavaScript codebase
