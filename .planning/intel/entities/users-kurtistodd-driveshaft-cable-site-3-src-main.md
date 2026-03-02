---
path: /Users/kurtistodd/driveshaft-cable-site-3/src/main.jsx
type: module
updated: 2026-03-02
status: active
---

# main.jsx

## Purpose

Application entry point that bootstraps the React application. Mounts the root App component into the DOM and dispatches a render event for prerendering/SSG tooling.

## Exports

None

## Dependencies

- react (external)
- react-dom/client (external)
- [[app]] - Root application component
- ./index.css - Global styles

## Used By

TBD

## Notes

- Uses React 18's `createRoot` API for concurrent rendering
- Wraps app in `React.StrictMode` for development warnings
- Dispatches custom `render-event` after mounting to signal prerenderer completion (used for static site generation)