/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "assert";
import { iter } from "./iter";

// Helper to convert memory from units Ki, Mi, Gi, Ti, Pi, Ei to bytes and vise versa

const baseMagnitude = 1024;
const maxMagnitude = ["EiB", baseMagnitude ** 6] as const;
const magnitudes = new Map([
  ["B", 1] as const,
  ["KiB", baseMagnitude ** 1] as const,
  ["MiB", baseMagnitude ** 2] as const,
  ["GiB", baseMagnitude ** 3] as const,
  ["TiB", baseMagnitude ** 4] as const,
  ["PiB", baseMagnitude ** 5] as const,
  maxMagnitude,
]);
const unitRegex = /(?<value>[0-9]+(\.[0-9]*)?)\s*(?<suffix>(B|[KMGTPE]iB?))?/;

type BinaryUnit = typeof magnitudes extends Map<infer Key, any> ? Key : never;

export function unitsToBytes(value: string): number {
  const unitsMatch = value.match(unitRegex);

  if (!unitsMatch?.groups) {
    return NaN;
  }

  const parsedValue = parseFloat(unitsMatch.groups.value);

  if (!unitsMatch.groups?.suffix) {
    return parsedValue;
  }

  const magnitude =
    magnitudes.get(unitsMatch.groups.suffix as BinaryUnit) ??
    magnitudes.get(`${unitsMatch.groups.suffix}B` as BinaryUnit);

  assert(magnitude, "UnitRegex is wrong some how");

  return parseInt((parsedValue * magnitude).toFixed(1));
}

export interface BytesToUnitesOptions {
  /**
   * The number of decimal places. MUST be an integer. MUST be in the range [0, 20].
   * @default 1
   */
  precision?: number;
}

export function bytesToUnits(bytes: number, { precision = 1 }: BytesToUnitesOptions = {}): string {
  if (bytes <= 0 || isNaN(bytes) || !isFinite(bytes)) {
    return "N/A";
  }

  let index = 0;
  let temp = bytes;

  while (temp >= baseMagnitude && index < magnitudes.size - 1) {
    temp /= baseMagnitude;
    index++;
  }

  const [suffix, magnitude] = iter.nth(magnitudes.entries(), index) ?? maxMagnitude;

  return `${(bytes / magnitude).toFixed(precision)}${suffix}`;
}
