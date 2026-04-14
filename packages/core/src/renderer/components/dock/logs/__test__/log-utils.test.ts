/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { detectLogLevel } from "../log-utils";

describe("detectLogLevel", () => {
  describe("JSON logs with 'severity' field", () => {
    it("detects info level when severity is beyond 100 chars", () => {
      const longMessage = "a".repeat(200);
      const logLine = JSON.stringify({ message: longMessage, severity: "info" });

      expect(detectLogLevel(logLine)).toBe("info");
    });

    it("detects info level with short message", () => {
      const logLine = JSON.stringify({ message: "short msg", severity: "info" });

      expect(detectLogLevel(logLine)).toBe("info");
    });

    it("detects error level", () => {
      const logLine = JSON.stringify({ message: "something failed", severity: "error" });

      expect(detectLogLevel(logLine)).toBe("error");
    });

    it("detects warn level with 'warning' value", () => {
      const logLine = JSON.stringify({ message: "caution", severity: "warning" });

      expect(detectLogLevel(logLine)).toBe("warn");
    });

    it("handles case-insensitive severity values", () => {
      const logLine = JSON.stringify({ message: "test", severity: "INFO" });

      expect(detectLogLevel(logLine)).toBe("info");
    });
  });

  describe("JSON logs with 'level' field", () => {
    it("detects error level", () => {
      const logLine = JSON.stringify({ message: "db connection failed", level: "error" });

      expect(detectLogLevel(logLine)).toBe("error");
    });

    it("detects debug level", () => {
      const logLine = JSON.stringify({ message: "query executed", level: "debug" });

      expect(detectLogLevel(logLine)).toBe("debug");
    });

    it("detects fatal as error", () => {
      const logLine = JSON.stringify({ message: "crash", level: "fatal" });

      expect(detectLogLevel(logLine)).toBe("error");
    });
  });

  describe("JSON logs with 'lvl' field", () => {
    it("detects warn level", () => {
      const logLine = JSON.stringify({ msg: "deprecated API", lvl: "warn" });

      expect(detectLogLevel(logLine)).toBe("warn");
    });

    it("detects trace level with 'verbose' value", () => {
      const logLine = JSON.stringify({ msg: "details", lvl: "verbose" });

      expect(detectLogLevel(logLine)).toBe("trace");
    });
  });

  describe("JSON logs - field priority", () => {
    it("prefers 'severity' over 'level'", () => {
      const logLine = JSON.stringify({ severity: "error", level: "info" });

      expect(detectLogLevel(logLine)).toBe("error");
    });

    it("prefers 'level' over 'lvl'", () => {
      const logLine = JSON.stringify({ level: "warn", lvl: "debug" });

      expect(detectLogLevel(logLine)).toBe("warn");
    });
  });

  describe("invalid/incomplete JSON logs", () => {
    it("falls back to regex for malformed JSON starting with {", () => {
      const logLine = "{broken json info message";

      expect(detectLogLevel(logLine)).toBe("info");
    });

    it("returns unknown for JSON without level fields", () => {
      const logLine = JSON.stringify({ message: "no level field here at all", timestamp: "2024-01-01" });

      expect(detectLogLevel(logLine)).toBe("unknown");
    });

    it("returns unknown for JSON with non-string level value", () => {
      const logLine = JSON.stringify({ message: "numeric level", level: 3 });

      expect(detectLogLevel(logLine)).toBe("unknown");
    });
  });

  describe("plain text logs (existing behavior)", () => {
    it("detects error level from text", () => {
      expect(detectLogLevel("[ERROR] Something went wrong")).toBe("error");
    });

    it("detects warn level from text", () => {
      expect(detectLogLevel("2024-01-01 WARN: deprecated call")).toBe("warn");
    });

    it("detects info level from text", () => {
      expect(detectLogLevel("2024-01-01 INFO: server started")).toBe("info");
    });

    it("detects debug level from text", () => {
      expect(detectLogLevel("DEBUG processing request")).toBe("debug");
    });

    it("detects klog format I0127", () => {
      expect(detectLogLevel("I0127 12:00:00.000000 main.go:42] Starting")).toBe("info");
    });

    it("detects klog format E0127", () => {
      expect(detectLogLevel("E0127 12:00:00.000000 main.go:42] Failed")).toBe("error");
    });

    it("returns unknown for unrecognized log", () => {
      expect(detectLogLevel("just some random text")).toBe("unknown");
    });
  });
});
