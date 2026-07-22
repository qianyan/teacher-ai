/** @vitest-environment jsdom */
/**
 * #25 — opening 报告全屏预览 must reuse the in-step iframe (no second cold mount).
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import React, { forwardRef, useEffect } from "react";

const mounts: { id: number; fitToViewport: boolean }[] = [];
let nextId = 1;

vi.mock("@/components/ReportPreviewIframe", () => ({
  ReportPreviewIframe: forwardRef(function MockReportPreviewIframe(
    props: {
      srcDoc: string;
      title?: string;
      scaled?: boolean;
      fitToViewport?: boolean;
    },
    _ref: unknown,
  ) {
    const idRef = React.useRef(0);
    if (idRef.current === 0) {
      idRef.current = nextId++;
    }
    useEffect(() => {
      const record = {
        id: idRef.current,
        fitToViewport: Boolean(props.fitToViewport),
      };
      mounts.push(record);
      return () => {
        const idx = mounts.findIndex((m) => m.id === record.id);
        if (idx >= 0) mounts.splice(idx, 1);
      };
    }, [props.fitToViewport]);
    return React.createElement("div", {
      "data-testid": "report-preview-iframe",
      "data-instance": idRef.current,
      "data-fit": props.fitToViewport ? "1" : "0",
      "data-title": props.title ?? "",
    });
  }),
}));

import { PreviewPanel } from "./PreviewPanel";

beforeEach(() => {
  mounts.length = 0;
  nextId = 1;
});

describe("PreviewPanel — 报告全屏预览 open without cold second iframe", () => {
  test("opening fullscreen reuses the same ReportPreviewIframe instance", async () => {
    render(
      <PreviewPanel
        fullHtml={"<html><body><p>hi</p></body></html>"}
        photos={[]}
      />,
    );

    // Debounced srcDoc write
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mounts).toHaveLength(1);
    const beforeId = mounts[0]!.id;
    expect(mounts[0]!.fitToViewport).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "全屏预览" }));

    expect(mounts).toHaveLength(1);
    expect(mounts[0]!.id).toBe(beforeId);
    expect(mounts[0]!.fitToViewport).toBe(true);
    expect(
      screen.getByTestId("report-preview-iframe").getAttribute("data-fit"),
    ).toBe("1");
  });
});
