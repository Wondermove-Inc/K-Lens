/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 메트릭 수집 실패 시 짧은 재시도 수행
 *
 * 기본값:
 * - 재시도 2회 (총 3번 시도)
 * - 300ms 간격
 */
export async function retryMetricsRequest<T>(
  request: () => Promise<T>,
  opts: { retries?: number; delayMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 2, delayMs = 300, label = "metrics" } = opts;

  let attempt = 0;

  while (true) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      attempt += 1;
      console.warn(`⚠️  [METRICS-RETRY] ${label} 실패, 재시도 ${attempt}/${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
