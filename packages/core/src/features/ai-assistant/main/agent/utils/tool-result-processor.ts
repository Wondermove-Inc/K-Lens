/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Tool Result Processor
 *
 * Manages large tool results to prevent context window exhaustion.
 * Strategy:
 *   1. Check result size against per-tool threshold
 *   2. If over threshold: save full result to file, return smart extraction + file path
 *   3. kubectl/helm structured data → diagnostic field extraction
 *   4. Logs → error/warn pattern matching + tail
 *   5. Shell/other → first 2KB preview
 *
 * LLM can always use read_file to access the full output via _fullOutputPath.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// ============================================
// Configuration
// ============================================

/** Default threshold in characters. Results under this are returned inline. */
const DEFAULT_THRESHOLD_CHARS = 8_000;

/** Preview size for generic (non-structured) results */
const PREVIEW_SIZE_CHARS = 2_000;

/** Max lines to keep from log tail */
const LOG_TAIL_LINES = 50;

/** Max error/warn context lines (before + after the match) */
const LOG_CONTEXT_LINES = 3;

/** Base directory for persisted tool results */
const RESULTS_DIR = path.join(os.tmpdir(), "daive-tool-results");

/** Max age for persisted files before cleanup (1 hour) */
const MAX_FILE_AGE_MS = 60 * 60 * 1_000;

/** Max total size of persisted files before cleanup (50MB) */
const MAX_TOTAL_SIZE_BYTES = 50 * 1_024 * 1_024;

/** Cleanup interval (run at most once per 10 minutes) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1_000;

/** Per-tool threshold overrides */
const TOOL_THRESHOLDS: Record<string, number> = {
  kubectl: 8_000,
  helm: 8_000,
  shell: 8_000,
  getLogs: 6_000,
  getPods: 10_000,
  getDeployments: 10_000,
  getServices: 10_000,
  getNodes: 10_000,
  getNamespaces: 15_000, // typically small
  describeResource: 8_000,
  read_file: Infinity, // never process — LLM explicitly requested this file
};

// ============================================
// Types
// ============================================

export interface ProcessedResult {
  /** Content to store in ToolMessage (may be reduced) */
  content: string;
  /** Whether the result was persisted to a file */
  wasPersisted: boolean;
  /** Path to full output file (if persisted) */
  fullOutputPath?: string;
  /** Original size in characters */
  originalSize: number;
}

interface DiagnosticExtraction {
  summary: string;
  details: unknown;
  _fullOutputPath: string;
  _originalSize: string;
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Process a tool result, potentially saving large outputs to file
 * and returning a smart extraction instead.
 */
export async function processToolResult(
  toolName: string,
  toolInput: Record<string, unknown>,
  rawResult: string,
): Promise<ProcessedResult> {
  const threshold = TOOL_THRESHOLDS[toolName] ?? DEFAULT_THRESHOLD_CHARS;
  const originalSize = rawResult.length;

  // Under threshold — return inline as-is
  if (originalSize <= threshold || threshold === Infinity) {
    return { content: rawResult, wasPersisted: false, originalSize };
  }

  // Persist full output to file — graceful fallback on failure
  let fullOutputPath: string;
  try {
    fullOutputPath = await persistResult(toolName, rawResult);
  } catch {
    // Disk full, permission error, etc. — return raw result inline as fallback
    return { content: rawResult, wasPersisted: false, originalSize };
  }

  // Generate smart extraction based on tool type
  let extraction: string;

  if (isStructuredQueryTool(toolName)) {
    extraction = extractStructuredDiagnostics(toolName, rawResult, fullOutputPath);
  } else if (toolName === "getLogs" || isLogOutput(toolName, rawResult)) {
    extraction = extractLogDiagnostics(rawResult, fullOutputPath);
  } else {
    extraction = buildPreview(rawResult, fullOutputPath);
  }

  return {
    content: extraction,
    wasPersisted: true,
    fullOutputPath,
    originalSize,
  };
}

// ============================================
// File Persistence
// ============================================

let resultsDirCreated = false;
let lastCleanupTime = 0;

async function ensureResultsDir(): Promise<void> {
  if (resultsDirCreated) return;
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  resultsDirCreated = true;
}

async function persistResult(toolName: string, content: string): Promise<string> {
  await ensureResultsDir();
  const id = crypto.randomUUID().slice(0, 8);
  const filename = `${toolName}-${id}.txt`;
  const filepath = path.join(RESULTS_DIR, filename);
  await fs.writeFile(filepath, content, "utf-8");

  // Trigger background cleanup (non-blocking, at most once per interval)
  scheduleCleanup();

  return filepath;
}

/**
 * Clean up old/oversized persisted tool results.
 *
 * Runs in the background — errors are silently ignored.
 * Two eviction strategies:
 *   1. Age-based: delete files older than MAX_FILE_AGE_MS (1 hour)
 *   2. Size-based: if total size > MAX_TOTAL_SIZE_BYTES, delete oldest files first
 */
function scheduleCleanup(): void {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  // Fire-and-forget
  cleanupResults().catch(() => {});
}

async function cleanupResults(): Promise<void> {
  const entries = await fs.readdir(RESULTS_DIR);
  if (entries.length === 0) return;

  // Gather file stats
  const files: Array<{ name: string; path: string; mtimeMs: number; size: number }> = [];
  for (const name of entries) {
    const filepath = path.join(RESULTS_DIR, name);
    try {
      const stat = await fs.stat(filepath);
      if (stat.isFile()) {
        files.push({ name, path: filepath, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    } catch {
      // File may have been deleted concurrently
    }
  }

  // Sort oldest first
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);

  const now = Date.now();
  let totalSize = files.reduce((sum, f) => sum + f.size, 0);

  for (const file of files) {
    const age = now - file.mtimeMs;
    const shouldDelete = age > MAX_FILE_AGE_MS || totalSize > MAX_TOTAL_SIZE_BYTES;

    if (shouldDelete) {
      try {
        await fs.unlink(file.path);
        totalSize -= file.size;
      } catch {
        // File already deleted
      }
    }
  }
}

// ============================================
// Structured Query Extraction (kubectl/helm)
// ============================================

const STRUCTURED_QUERY_TOOLS = new Set([
  "getPods",
  "getDeployments",
  "getServices",
  "getNodes",
  "getNamespaces",
  "describeResource",
]);

function isStructuredQueryTool(toolName: string): boolean {
  return STRUCTURED_QUERY_TOOLS.has(toolName) || toolName === "kubectl" || toolName === "helm";
}

function extractStructuredDiagnostics(toolName: string, rawResult: string, fullOutputPath: string): string {
  try {
    const parsed = JSON.parse(rawResult);
    if (parsed.status === "error") {
      // Errors are always small enough to return inline
      return rawResult;
    }

    const data = parsed.data;
    if (!data) return buildPreview(rawResult, fullOutputPath);

    // Structured query tools return { status, data: [...] }
    if (Array.isArray(data)) {
      return extractFromArray(toolName, data, fullOutputPath, rawResult.length);
    }

    // kubectl raw output (data is a string) — try JSON parse
    if (typeof data === "string") {
      return extractFromRawKubectl(toolName, data, fullOutputPath, rawResult.length);
    }

    return buildPreview(rawResult, fullOutputPath);
  } catch {
    return buildPreview(rawResult, fullOutputPath);
  }
}

/**
 * Extract diagnostics from structured query tool arrays (getPods, getDeployments, etc.)
 */
function extractFromArray(toolName: string, data: any[], fullOutputPath: string, originalSize: number): string {
  const sizeStr = formatSize(originalSize);

  if (toolName === "getPods") {
    const unhealthy = data.filter((p: any) => p.status && !["Running", "Succeeded", "Completed"].includes(p.status));
    const highRestarts = data.filter((p: any) => typeof p.restarts === "number" && p.restarts > 5);
    const notReady = data.filter((p: any) => p.ready === "NotReady");

    const extraction: DiagnosticExtraction = {
      summary: `${data.length} pods total, ${unhealthy.length} unhealthy, ${highRestarts.length} high-restart, ${notReady.length} not-ready`,
      details: {
        totalPods: data.length,
        unhealthy: unhealthy.slice(0, 20),
        highRestarts: highRestarts.slice(0, 10),
        notReady: notReady.slice(0, 10),
        // If everything is healthy, show a sample
        ...(unhealthy.length === 0 && { sample: data.slice(0, 5) }),
      },
      _fullOutputPath: fullOutputPath,
      _originalSize: sizeStr,
    };
    return JSON.stringify({ status: "success", ...extraction });
  }

  if (toolName === "getDeployments") {
    const unhealthy = data.filter((d: any) => {
      if (typeof d.replicas !== "string") return false;
      const [ready, desired] = d.replicas.split("/").map(Number);
      return !isNaN(ready) && !isNaN(desired) && ready < desired;
    });

    const extraction: DiagnosticExtraction = {
      summary: `${data.length} deployments, ${unhealthy.length} with insufficient replicas`,
      details: {
        total: data.length,
        unhealthy: unhealthy.slice(0, 20),
        ...(unhealthy.length === 0 && { sample: data.slice(0, 5) }),
      },
      _fullOutputPath: fullOutputPath,
      _originalSize: sizeStr,
    };
    return JSON.stringify({ status: "success", ...extraction });
  }

  if (toolName === "getNodes") {
    const notReady = data.filter((n: any) => n.status && n.status !== "Ready");

    const extraction: DiagnosticExtraction = {
      summary: `${data.length} nodes, ${notReady.length} not ready`,
      details: {
        total: data.length,
        notReady: notReady.slice(0, 10),
        all: data.slice(0, 20),
      },
      _fullOutputPath: fullOutputPath,
      _originalSize: sizeStr,
    };
    return JSON.stringify({ status: "success", ...extraction });
  }

  // Generic array: return first N items + count
  const extraction: DiagnosticExtraction = {
    summary: `${data.length} items (showing first 20)`,
    details: {
      total: data.length,
      items: data.slice(0, 20),
    },
    _fullOutputPath: fullOutputPath,
    _originalSize: sizeStr,
  };
  return JSON.stringify({ status: "success", ...extraction });
}

/**
 * Extract diagnostics from raw kubectl string output (e.g., kubectl get -o yaml/json)
 */
function extractFromRawKubectl(
  toolName: string,
  rawData: string,
  fullOutputPath: string,
  originalSize: number,
): string {
  // Try to parse as JSON (kubectl -o json output)
  try {
    const json = JSON.parse(rawData);

    // Kubernetes List object
    if (json.kind?.endsWith("List") && Array.isArray(json.items)) {
      const items = json.items;
      const summaries = items.slice(0, 30).map((item: any) => ({
        name: item.metadata?.name,
        namespace: item.metadata?.namespace,
        kind: item.kind,
        phase: item.status?.phase,
        conditions: item.status?.conditions
          ?.filter((c: any) => c.status === "False" || c.type === "Ready")
          ?.map((c: any) => ({ type: c.type, status: c.status, reason: c.reason })),
        containerStatuses: item.status?.containerStatuses
          ?.filter((cs: any) => cs.restartCount > 0 || cs.state?.waiting)
          ?.map((cs: any) => ({
            name: cs.name,
            restartCount: cs.restartCount,
            state: cs.state?.waiting ?? cs.state?.terminated ?? cs.state?.running,
          })),
      }));

      return JSON.stringify({
        status: "success",
        summary: `${items.length} ${json.kind} items (diagnostic fields extracted)`,
        details: { total: items.length, items: summaries },
        _fullOutputPath: fullOutputPath,
        _originalSize: formatSize(originalSize),
      });
    }

    // Single resource
    if (json.metadata?.name) {
      return JSON.stringify({
        status: "success",
        summary: `${json.kind ?? "Resource"} ${json.metadata.namespace ? json.metadata.namespace + "/" : ""}${json.metadata.name}`,
        details: {
          kind: json.kind,
          name: json.metadata.name,
          namespace: json.metadata.namespace,
          phase: json.status?.phase,
          conditions: json.status?.conditions,
          containerStatuses: json.status?.containerStatuses,
        },
        _fullOutputPath: fullOutputPath,
        _originalSize: formatSize(originalSize),
      });
    }
  } catch {
    // Not JSON — fall through to preview
  }

  return buildPreview(JSON.stringify({ status: "success", data: rawData }), fullOutputPath);
}

// ============================================
// Log Extraction
// ============================================

/** Patterns that indicate error/warning lines worth extracting */
const ERROR_PATTERNS = /\b(ERROR|FATAL|PANIC|Exception|panic:|OOMKill|CrashLoopBackOff|SIGSEGV|SIGKILL)\b/i;
const WARN_PATTERNS = /\b(WARN|WARNING|timeout|refused|unavailable|denied|failed|retry)\b/i;
const STACK_TRACE_START = /^\s+(at |Caused by:|Traceback|File "|goroutine \d+)/;

function isLogOutput(toolName: string, result: string): boolean {
  // Heuristic: if it's a kubectl/shell result with multi-line data that looks like logs
  if (toolName !== "kubectl" && toolName !== "shell") return false;
  try {
    const parsed = JSON.parse(result);
    const data = parsed.data;
    if (typeof data !== "string") return false;
    const lines = data.split(/\r?\n/);
    return lines.length > 50; // probably log output
  } catch {
    return false;
  }
}

function extractLogDiagnostics(rawResult: string, fullOutputPath: string): string {
  let logContent: string;
  try {
    const parsed = JSON.parse(rawResult);
    logContent = typeof parsed.data === "string" ? parsed.data : rawResult;
  } catch {
    logContent = rawResult;
  }

  const lines = logContent.split(/\r?\n/);
  const errors: string[] = [];
  const warnings: string[] = [];
  const stackTraces: string[] = [];

  let inStackTrace = false;
  let currentStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stack trace detection
    if (STACK_TRACE_START.test(line)) {
      if (!inStackTrace) {
        inStackTrace = true;
        currentStack = [];
        // Include the line before stack trace start (usually the exception message)
        if (i > 0) currentStack.push(lines[i - 1]);
      }
      currentStack.push(line);
      continue;
    } else if (inStackTrace) {
      // Stack trace ended
      stackTraces.push(currentStack.join("\n"));
      inStackTrace = false;
      currentStack = [];
    }

    // Error patterns with context
    if (ERROR_PATTERNS.test(line)) {
      const context = getLineContext(lines, i, LOG_CONTEXT_LINES);
      errors.push(context);
      continue;
    }

    // Warning patterns with context
    if (WARN_PATTERNS.test(line)) {
      const context = getLineContext(lines, i, 2);
      warnings.push(context);
    }
  }

  // Flush any remaining stack trace
  if (inStackTrace && currentStack.length > 0) {
    stackTraces.push(currentStack.join("\n"));
  }

  const tail = lines.slice(-LOG_TAIL_LINES).join("\n");

  const extraction = {
    status: "success",
    summary: `${lines.length} log lines — ${errors.length} errors, ${warnings.length} warnings, ${stackTraces.length} stack traces`,
    diagnostics: {
      errors: errors.slice(0, 20),
      warnings: warnings.slice(0, 15),
      stackTraces: stackTraces.slice(0, 5),
      tail: `(last ${Math.min(LOG_TAIL_LINES, lines.length)} lines)\n${tail}`,
    },
    _fullOutputPath: fullOutputPath,
    _originalSize: formatSize(rawResult.length),
    _hint:
      "Use read_file tool with the _fullOutputPath to see the complete log output if this extraction is insufficient.",
  };

  return JSON.stringify(extraction);
}

function getLineContext(lines: string[], idx: number, contextLines: number): string {
  const start = Math.max(0, idx - contextLines);
  const end = Math.min(lines.length - 1, idx + contextLines);
  const contextArr: string[] = [];
  for (let i = start; i <= end; i++) {
    const prefix = i === idx ? ">>> " : "    ";
    contextArr.push(`${prefix}${lines[i]}`);
  }
  return contextArr.join("\n");
}

// ============================================
// Generic Preview
// ============================================

function buildPreview(rawResult: string, fullOutputPath: string): string {
  const previewText = truncateAtNewline(rawResult, PREVIEW_SIZE_CHARS);
  const hasMore = rawResult.length > PREVIEW_SIZE_CHARS;

  return JSON.stringify({
    status: "success",
    summary: `Command executed successfully. Full output (${formatSize(rawResult.length)}) saved to file. Preview below.`,
    preview: previewText,
    ...(hasMore && { previewOnly: true }),
    _fullOutputPath: fullOutputPath,
    _originalSize: formatSize(rawResult.length),
    _hint:
      "This preview contains the beginning of the output. Use read_file with _fullOutputPath only if you need to see more. Do NOT re-run the same command.",
  });
}

function truncateAtNewline(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  // Prefer newline boundary if > 50% of limit
  if (lastNewline > maxChars * 0.5) {
    return truncated.slice(0, lastNewline);
  }
  return truncated;
}

// ============================================
// Utilities
// ============================================

function formatSize(chars: number): string {
  if (chars < 1_000) return `${chars} chars`;
  if (chars < 1_000_000) return `${(chars / 1_000).toFixed(1)}K chars`;
  return `${(chars / 1_000_000).toFixed(1)}M chars`;
}
