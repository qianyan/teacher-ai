// @vitest-environment jsdom
/**
 * Tests for ReportWorkbench fix: keep PhotoList/PreviewPanel mounted on step
 * switch using CSS display:none instead of conditional && rendering.
 *
 * User intent: Every time the user opens the photo page or preview page, there
 * is repeated loading / flickering because PhotoList and PreviewPanel were
 * conditionally rendered with React's && operator, so they unmount on step
 * switch and remount on return, destroying usePhotoPreviewCache's thumbnail
 * cache (all blob URLs revoked, cache cleared).
 *
 * Fix: wrap each step section in a div with CSS display:none instead of
 * conditional && rendering, keeping both components always mounted.
 */

import { describe, expect, test, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React, { type ComponentProps } from "react";

// Mock next/dynamic so dynamically imported components render a simple stub
// instead of trying to fetch chunks.
vi.mock("next/dynamic", () => ({
  default:
    (
      importFn: () => Promise<{ default: React.ComponentType<unknown> }>,
    ) => {
      const DynamicComp = (props: Record<string, unknown>) =>
        React.createElement("div", {
          "data-dynamic": String(importFn),
          ...props,
        });
      DynamicComp.displayName = "DynamicStub";
      return DynamicComp;
    },
}));

// Mock RichEditor since it depends on @tiptap/react which needs a DOM.
vi.mock("@/components/RichEditor", () => ({
  RichEditor: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "rich-editor",
      ...props,
    }),
}));

// Mock TemplatePicker since it's interactive but not the focus of this test.
vi.mock("@/components/TemplatePicker", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "template-picker",
      ...props,
    }),
}));

import { ReportWorkbench } from "./ReportWorkbench";

/** Click a nav rail step button by its label text. */
function clickStep(container: HTMLElement, label: string) {
  const btn = container.querySelector<HTMLButtonElement>(
    `.workbench-step .workbench-step__label`,
  );
  // Find the button whose label matches.
  const labels = container.querySelectorAll<HTMLSpanElement>(
    ".workbench-step__label",
  );
  for (const el of labels) {
    if (el.textContent?.trim() === label) {
      const btn = el.closest<HTMLButtonElement>("button.workbench-step");
      if (btn) {
        fireEvent.click(btn);
        return;
      }
    }
  }
  throw new Error(`Could not find step button with label "${label}"`);
}

/** Minimal props that satisfy ReportWorkbenchInner (memo-wrapped). */
function createMinimalProps(
  overrides: Partial<ComponentProps<typeof ReportWorkbench>> = {},
): ComponentProps<typeof ReportWorkbench> {
  return {
    templateId: "cream-soft",
    setTemplateId: vi.fn(),
    biweeklyDateRange: "2026-04-01 ~ 2026-04-14",
    setBiweeklyDateRange: vi.fn(),
    englishClassName: "Infant D",
    setEnglishClassName: vi.fn(),
    subTitle: "双周简报",
    setSubTitle: vi.fn(),
    introHtml: "<p>开篇</p>",
    setIntroHtml: vi.fn(),
    bodyHtml: "<p>正文</p>",
    setBodyHtml: vi.fn(),
    photos: [],
    setPhotos: vi.fn(),
    fullHtml: "<html><body>preview</body></html>",
    setFullHtml: vi.fn(),
    loading: false,
    error: null,
    generateBlockedReason: undefined,
    usageHint: undefined,
    onGenerate: vi.fn(),
    advanceToPreview: false,
    onAdvanceToPreviewConsumed: vi.fn(),
    ...overrides,
  };
}

describe("ReportWorkbench — PhotoList/PreviewPanel always-mounted fix", () => {
  test("photos and preview sections stay mounted when step is meta (display:none)", () => {
    const props = createMinimalProps();
    const { container } = render(React.createElement(ReportWorkbench, props));

    // The meta step is the default, so it should be visible.
    const metaSection = container.querySelector(
      ".workbench-panel--meta",
    ) as HTMLElement | null;
    expect(metaSection).not.toBeNull();
    expect(metaSection!.style.display).toBe("");

    // The photos section should be in the DOM but hidden.
    const photosSection = container.querySelector(
      ".workbench-panel--photos",
    ) as HTMLElement | null;
    expect(photosSection).not.toBeNull();
    // The wrapper div sets display:none when step !== "photos"
    const photosWrapper = photosSection!.parentElement as HTMLElement | null;
    expect(photosWrapper).not.toBeNull();
    expect(photosWrapper!.style.display).toBe("none");

    // The preview section should also be in the DOM but hidden.
    const previewSection = container.querySelector(
      ".workbench-panel--preview",
    ) as HTMLElement | null;
    expect(previewSection).not.toBeNull();
    const previewWrapper = previewSection!.parentElement as HTMLElement | null;
    expect(previewWrapper).not.toBeNull();
    expect(previewWrapper!.style.display).toBe("none");
  });

  test("photos section becomes visible when navigating to photos step", () => {
    const props = createMinimalProps();
    const { container } = render(React.createElement(ReportWorkbench, props));

    // Navigate to write step first (to leave meta).
    clickStep(container, "撰文");

    // Then navigate to photos step.
    clickStep(container, "照片");

    const photosSection = container.querySelector(
      ".workbench-panel--photos",
    ) as HTMLElement | null;
    expect(photosSection).not.toBeNull();
    const photosWrapper = photosSection!.parentElement as HTMLElement | null;
    expect(photosWrapper).not.toBeNull();
    // display should not be "none" — it should be visible
    expect(photosWrapper!.style.display).not.toBe("none");
  });

  test("photos section stays mounted when navigating away and back", () => {
    const props = createMinimalProps();
    const { container } = render(React.createElement(ReportWorkbench, props));

    // Navigate to write step, then photos step.
    clickStep(container, "撰文");
    clickStep(container, "照片");

    // Get a reference to the photos element while it's visible.
    const photosSection = container.querySelector(
      ".workbench-panel--photos",
    ) as HTMLElement | null;
    expect(photosSection).not.toBeNull();
    const photosWrapper = photosSection!.parentElement as HTMLElement | null;
    expect(photosWrapper).not.toBeNull();
    expect(photosWrapper!.style.display).not.toBe("none");

    // Navigate back to write step using the nav rail button.
    clickStep(container, "撰文");

    // The photos section should still be in the DOM, just hidden.
    expect(photosWrapper!.style.display).toBe("none");
    expect(
      container.contains(photosWrapper!),
      "photos wrapper should still be in the DOM after navigating away",
    ).toBe(true);

    // Navigate back to photos step.
    clickStep(container, "照片");

    // The same element should now be visible again.
    expect(photosWrapper!.style.display).not.toBe("none");
    expect(
      container.contains(photosWrapper!),
      "photos wrapper should still be the same DOM element",
    ).toBe(true);
  });

  test("preview section stays mounted when navigating away and back", () => {
    const props = createMinimalProps();
    const { container } = render(React.createElement(ReportWorkbench, props));

    // Navigate to write, then photos.
    clickStep(container, "撰文");
    clickStep(container, "照片");

    // Click "查看预览" button to go to preview step (fullHtml is truthy).
    // The button is inside the workbench-panel--photos footer.
    const photosPanel = container.querySelector(".workbench-panel--photos");
    // The last btn in the photos footer is "查看预览" when fullHtml is set.
    const previewBtns =
      photosPanel!.querySelectorAll<HTMLButtonElement>(
        '.workbench-panel__foot button',
      );
    const viewPreviewBtn = previewBtns[previewBtns.length - 1];
    expect(viewPreviewBtn!.textContent).toContain("查看预览");
    fireEvent.click(viewPreviewBtn!);

    // Get a reference to the preview element while it's visible.
    const previewSection = container.querySelector(
      ".workbench-panel--preview",
    ) as HTMLElement | null;
    expect(previewSection).not.toBeNull();
    const previewWrapper = previewSection!.parentElement as HTMLElement | null;
    expect(previewWrapper).not.toBeNull();
    expect(previewWrapper!.style.display).not.toBe("none");

    // Navigate back to photos step via the nav rail button.
    clickStep(container, "照片");

    // Preview section should still be in DOM, just hidden.
    expect(previewWrapper!.style.display).toBe("none");
    expect(
      container.contains(previewWrapper!),
      "preview wrapper should still be in the DOM after navigating away",
    ).toBe(true);

    // Navigate back to preview step via the "查看预览" button (in photos panel).
    const previewBtns2 =
      photosPanel!.querySelectorAll<HTMLButtonElement>(
        '.workbench-panel__foot button',
      );
    const viewPreviewBtn2 = previewBtns2[previewBtns2.length - 1];
    expect(viewPreviewBtn2!.textContent).toContain("查看预览");
    fireEvent.click(viewPreviewBtn2!);

    // Same element visible again.
    expect(previewWrapper!.style.display).not.toBe("none");
    expect(
      container.contains(previewWrapper!),
      "preview wrapper should still be the same DOM element",
    ).toBe(true);
  });

  test("usePhotoPreviewCache is not destroyed (PhotoList stays mounted)", () => {
    // This test verifies the structural condition that enables cache survival:
    // PhotoList is inside the always-mounted wrapper div. If the old && pattern
    // were used, PhotoList would unmount when step !== "photos", destroying
    // the cache. With the CSS display:none wrapper, the PhotoList stays mounted.
    const props = createMinimalProps();
    const { container } = render(React.createElement(ReportWorkbench, props));

    // On the meta step, the photos panel is hidden but present.
    const photosSection = container.querySelector(
      ".workbench-panel--photos",
    ) as HTMLElement | null;
    expect(photosSection).not.toBeNull();

    // Navigate to write, then photos.
    clickStep(container, "撰文");
    clickStep(container, "照片");

    const photosSectionVisible = container.querySelector(
      ".workbench-panel--photos",
    ) as HTMLElement | null;
    expect(photosSectionVisible).toBe(photosSection);
    expect(photosSectionVisible!.isConnected).toBe(true);

    // Go back to write step.
    clickStep(container, "撰文");

    // Element reference is still valid and connected.
    expect(photosSectionVisible!.isConnected).toBe(true);
    expect(
      container.querySelector(".workbench-panel--photos"),
    ).toBe(photosSectionVisible);
  });
});
