---
path: /Users/kurtistodd/driveshaft-cable-site-3/vite.config.js
type: config
updated: 2026-03-02
status: active
---

# vite.config.js

## Purpose

Configures Vite build tool for the React application, defining plugins, development server settings, and build output options.

## Exports

- **default**: Vite configuration object created via `defineConfig`
- **defineConfig**: Re-exported from vite (used for type hints and validation)

## Dependencies

- `vite`: Build tool framework providing `defineConfig` helper
- `@vitejs/plugin-react`: Official React plugin for Vite enabling JSX/React Fast Refresh

## Used By

TBD

## Notes

- Development server runs on port 3000
- Production builds output to `dist` directory
- Uses default React plugin configuration (Babel-based transforms)