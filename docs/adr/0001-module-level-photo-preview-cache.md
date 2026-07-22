# Module-level photo preview cache (cache ownership moved out of hook state; dual-mount stays)

#21 kept `PhotoList` and `PreviewPanel` always mounted behind `display:none` so `usePhotoPreviewCache` survived step switches. On Android (Chrome / system browser), with photos present and preview HTML already generated, toggling those two heavy trees still causes repeated full-screen white flashes when switching 照片步骤 ↔ 预览步骤 — worse returning to photos.

We move the thumbnail/preview URL cache out of `usePhotoPreviewCache` (a component-local `useRef<Map>`) into a **module-level singleton** (`photo-preview-cache.ts`) so the cache survives hook/component unmount. Dual-mount of workbench steps (`display:none`) stays as-is for now; the cache no longer depends on React lifecycle for persistence.

Key invalidation rules: invalidate per photo entry signature; clear on draft clear / logout; do **not** clear when merely leaving the photos step.

## Considered Options

- **Keep dual-mount, change hiding** (`visibility` / `content-visibility` / freeze iframe) — lower churn, but both heavy trees stay in the document; rejected as the primary fix after the dual-mount approach already failed to stop Android full-screen flashes.
- **React Context cache at workbench root** — still couples cache lifetime to a React subtree; rejected in favour of a module singleton until cross-tree subscription is clearly needed.
- **Module-level cache** (chosen — #23) — preserves thumbnails across remounts; dual-mount of workbench steps stays as-is for now.
- **Single active step mount** (not yet implemented — future work) — reverses the `display:none` dual-mount so only the active step panel is in the DOM. Would eliminate the cost of two heavy trees entirely.
