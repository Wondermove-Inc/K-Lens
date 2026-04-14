/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Large JSON async parsing utility
 * JSON size threshold check + Worker Thread separate parsing
 *
 * Key content:
 * - Log warning when JSON exceeds 10MB
 * - Parse in Worker Thread → prevent Event Loop blocking
 * - Under 10MB: parse directly on main thread (minimal overhead)
 *
 * @packageDocumentation
 */

import { isMainThread, parentPort, Worker, workerData } from "worker_threads";

// ============================================
// Constants
// ============================================

/** JSON size warning threshold: 10MB */
export const JSON_SIZE_WARN_THRESHOLD_BYTES = 10 * 1024 * 1024;

/** Worker Thread usage threshold: 10MB (same as warning) */
export const JSON_SIZE_WORKER_THRESHOLD_BYTES = 10 * 1024 * 1024;

// ============================================
// Worker execution code (parses workerData.json)
// ============================================

if (!isMainThread && parentPort) {
  // Runs inside Worker Thread
  try {
    const result = JSON.parse(workerData.json as string);
    parentPort.postMessage({ success: true, result });
  } catch (err) {
    parentPort.postMessage({ success: false, error: String(err) });
  }
}

// ============================================
// parseJsonAsync — branches to Worker or direct parse based on size
// ============================================

/**
 * Parses a JSON string asynchronously.
 *
 * - Under 10MB: direct parse on main thread (fast)
 * - 10MB+: offload to Worker Thread (protects Event Loop)
 *
 * @param json - JSON string to parse
 * @param logger - for warning logs (optional)
 * @param label - log identifier (optional, e.g. "Trivy", "Kubescape")
 */
export async function parseJsonAsync(
  json: string,
  logger?: { warn: (msg: string) => void },
  label = "JSON",
): Promise<unknown> {
  const byteSize = Buffer.byteLength(json, "utf8");

  // log warning when JSON exceeds 10MB
  if (byteSize > JSON_SIZE_WARN_THRESHOLD_BYTES) {
    const mb = (byteSize / (1024 * 1024)).toFixed(1);
    logger?.warn(
      `[SECURITY][${label}] JSON size warning: ${mb}MB (threshold ${JSON_SIZE_WARN_THRESHOLD_BYTES / 1024 / 1024}MB exceeded) — offloading to Worker Thread`,
    );
  }

  // offload to Worker Thread when JSON >= 10MB
  if (byteSize >= JSON_SIZE_WORKER_THRESHOLD_BYTES) {
    return parseJsonInWorker(json);
  }

  // Under 10MB: direct parse
  return JSON.parse(json);
}

/**
 * Runs JSON parsing in a Worker Thread
 * Parses without blocking the Event Loop
 */
function parseJsonInWorker(json: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Use __filename as the Worker file (this file contains Worker code)
    // In Electron asar, __filename points inside .asar — Worker may fail to load
    // → catch in worker.once("error") and fall back to main-thread parse
    let worker: import("worker_threads").Worker;
    try {
      worker = new Worker(__filename, {
        workerData: { json },
      });
    } catch {
      // Worker creation failed (e.g. asar env) → fall back to main-thread parse
      try {
        resolve(JSON.parse(json));
      } catch (err) {
        reject(err);
      }
      return;
    }

    worker.once("message", (msg: { success: boolean; result?: unknown; error?: string }) => {
      if (msg.success) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error ?? "Worker JSON parsing failure"));
      }
    });

    worker.once("error", (err) => {
      // Worker load failed (e.g. asar env) → fall back to main-thread parse
      try {
        resolve(JSON.parse(json));
      } catch {
        reject(err);
      }
    });

    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
