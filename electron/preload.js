// No privileged APIs exposed yet — the app is a thin wrapper around the
// hosted site, which only needs standard browser APIs (already available in
// the renderer) for the offline-resilience features (IndexedDB, the online/
// offline events) to work. Add exposeInMainWorld() bindings here if a future
// feature needs real OS-level access.
