import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_ID,
  REPORT_TEMPLATES,
  isReportTemplateId,
  resolveTemplateId,
} from "@/lib/report/templates";

describe("isReportTemplateId", () => {
  it("accepts every defined template id", () => {
    for (const id of Object.keys(REPORT_TEMPLATES)) {
      expect(isReportTemplateId(id)).toBe(true);
    }
  });

  it("rejects unknown and non-string values", () => {
    expect(isReportTemplateId("unknown")).toBe(false);
    expect(isReportTemplateId(undefined)).toBe(false);
    expect(isReportTemplateId(123)).toBe(false);
  });
});

describe("resolveTemplateId", () => {
  it("returns the id when valid", () => {
    expect(resolveTemplateId("ocean-fresh")).toBe("ocean-fresh");
  });

  it("falls back to the default for invalid input", () => {
    expect(resolveTemplateId("nope")).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId(null)).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplateId(undefined)).toBe(DEFAULT_TEMPLATE_ID);
  });
});
