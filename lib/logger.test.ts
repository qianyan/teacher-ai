import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, minLevelFrom } from "@/lib/logger";

const originalLogLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  delete process.env.LOG_LEVEL;
});

afterEach(() => {
  if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLogLevel;
  vi.restoreAllMocks();
});

describe("minLevelFrom", () => {
  it("defaults to info", () => {
    expect(minLevelFrom(undefined)).toBe("info");
    expect(minLevelFrom("")).toBe("info");
    expect(minLevelFrom("bogus")).toBe("info");
  });

  it("parses known levels case-insensitively", () => {
    expect(minLevelFrom("debug")).toBe("debug");
    expect(minLevelFrom("WARN")).toBe("warn");
    expect(minLevelFrom(" error ")).toBe("error");
  });
});

describe("logger", () => {
  it("emits a JSON line with level, time and msg", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("hello");

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", msg: "hello" });
    expect(() => new Date(parsed.time).toISOString()).not.toThrow();
    expect(new Date(parsed.time).toISOString()).toBe(parsed.time);
  });

  it("routes each level to its matching console method", () => {
    process.env.LOG_LEVEL = "debug";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("passes extra fields through into the JSON payload", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", { code: "E_DB", retries: 2, nested: { a: 1 } });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      msg: "boom",
      code: "E_DB",
      retries: 2,
      nested: { a: 1 },
    });
  });

  it("suppresses levels below LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "warn";
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
