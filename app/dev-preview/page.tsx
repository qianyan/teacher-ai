import { notFound } from "next/navigation";
import { DevPreviewHarness } from "./DevPreviewHarness";

// E2E harness: renders the real PreviewPanel inside the same
// .app-panel.workbench-panel--preview shell the workbench uses, so layout/CSS
// bugs (containing block, clipping) reproduce without a backend.
export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevPreviewHarness />;
}
