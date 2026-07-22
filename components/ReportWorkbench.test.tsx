// @vitest-environment jsdom
/**
 * Issue #20: opening photos/preview steps re-flashes loading UI.
 *
 * display:none keep-alive preserves React state but still fails UX:
 * - preview iframe measures wrapWidth=0 while hidden → skeleton on every first paint
 * - lazy thumbnails under display:none never decode until shown → blank flash
 *
 * Contract: inactive step panels stay mounted, must NOT use display:none,
 * and must keep a layout width so preview can pre-measure.
 */

import { describe, expect, test, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

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

vi.mock("@/components/RichEditor", () => ({
  RichEditor: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "rich-editor",
      ...props,
    }),
}));

vi.mock("@/components/TemplatePicker", () => ({
  TemplatePicker: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "template-picker",
      ...props,
    }),
  default: (props: Record<string, unknown>) =>
    React.createElement("div", {
      "data-testid": "template-picker",
      ...props,
    }),
}));

import { ReportWorkbench } from "./ReportWorkbench";
import type { ReportTemplateId } from "@/lib/report/templates";
import { DEFAULT_TEMPLATE_ID } from "@/lib/report/templates";

function clickStep(container: HTMLElement, label: string) {
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

function createMinimalProps(overrides: Record<string, unknown> = {}) {
  return {
    templateId: DEFAULT_TEMPLATE_ID satisfies ReportTemplateId,
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
    photos: [] as [],
    setPhotos: vi.fn(),
    fullHtml: "<html><body>preview</body></html>",
    setFullHtml: vi.fn(),
    loading: false,
    error: null as string | null,
    generateBlockedReason: undefined as string | undefined,
    usageHint: undefined as string | undefined,
    onGenerate: vi.fn(),
    advanceToPreview: false,
    onAdvanceToPreviewConsumed: vi.fn(),
    ...overrides,
  };
}

function panel(container: HTMLElement, name: string) {
  return container.querySelector(
    `.workbench-panel--${name}`,
  ) as HTMLElement | null;
}

describe("ReportWorkbench — issue #20 step panel keep-alive", () => {
  test("all four step panels stay mounted on the meta step", () => {
    const { container } = render(
      React.createElement(ReportWorkbench, createMinimalProps()),
    );

    expect(panel(container, "meta")).not.toBeNull();
    expect(panel(container, "write")).not.toBeNull();
    expect(panel(container, "photos")).not.toBeNull();
    expect(panel(container, "preview")).not.toBeNull();
  });

  test("inactive panels must not use display:none (keeps layout width)", () => {
    const { container } = render(
      React.createElement(ReportWorkbench, createMinimalProps()),
    );

    const photos = panel(container, "photos")!;
    const preview = panel(container, "preview")!;

    expect(photos.classList.contains("is-inactive")).toBe(true);
    expect(preview.classList.contains("is-inactive")).toBe(true);
    expect(getComputedStyle(photos).display).not.toBe("none");
    expect(getComputedStyle(preview).display).not.toBe("none");
    expect(photos.style.display).not.toBe("none");
    expect(preview.style.display).not.toBe("none");
    // No wrapper that hides via display:none either.
    expect(photos.parentElement?.style.display).not.toBe("none");
    expect(preview.parentElement?.style.display).not.toBe("none");
  });

  test("only the active step panel is marked is-active", () => {
    const { container } = render(
      React.createElement(ReportWorkbench, createMinimalProps()),
    );

    expect(panel(container, "meta")!.classList.contains("is-active")).toBe(true);
    expect(panel(container, "photos")!.classList.contains("is-active")).toBe(
      false,
    );

    clickStep(container, "照片");

    expect(panel(container, "meta")!.classList.contains("is-active")).toBe(
      false,
    );
    expect(panel(container, "photos")!.classList.contains("is-active")).toBe(
      true,
    );
    expect(panel(container, "photos")!.classList.contains("is-inactive")).toBe(
      false,
    );
  });

  test("photos panel DOM node identity survives navigate away and back", () => {
    const { container } = render(
      React.createElement(ReportWorkbench, createMinimalProps()),
    );

    clickStep(container, "照片");
    const photosEl = panel(container, "photos")!;
    expect(photosEl.classList.contains("is-active")).toBe(true);

    clickStep(container, "撰文");
    expect(photosEl.isConnected).toBe(true);
    expect(photosEl.classList.contains("is-inactive")).toBe(true);

    clickStep(container, "照片");
    expect(panel(container, "photos")).toBe(photosEl);
    expect(photosEl.classList.contains("is-active")).toBe(true);
  });

  test("preview panel DOM node identity survives navigate away and back", () => {
    const { container } = render(
      React.createElement(ReportWorkbench, createMinimalProps()),
    );

    clickStep(container, "预览");
    const previewEl = panel(container, "preview")!;
    expect(previewEl.classList.contains("is-active")).toBe(true);

    clickStep(container, "照片");
    expect(previewEl.isConnected).toBe(true);
    expect(previewEl.classList.contains("is-inactive")).toBe(true);

    clickStep(container, "预览");
    expect(panel(container, "preview")).toBe(previewEl);
    expect(previewEl.classList.contains("is-active")).toBe(true);
  });
});
