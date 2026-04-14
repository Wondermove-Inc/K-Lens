/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security Feature Flags management module
 * SECURITY_SCAN_PANEL Feature Flag registration
 *
 * Pattern: Same structure as features/ai-assistant/common/feature-flags.ts.
 *
 * Feature definition:
 * - SECURITY_SCAN_PANEL: Enable/disable entire security dashboard panel
 *   When false, Security menu and /security route are disabled
 *
 * Environment variable override:
 * - SKUBERPLUS_FEATURE_SECURITY_SCAN_PANEL=true|false
 *
 * @packageDocumentation
 */

// ============================================
// Type definition
// ============================================

/** Security Feature Flag key type */
export type SecurityFeatureFlagKey =
  // Epic 2: Security dashboard UI
  | "SECURITY_SCAN_PANEL"
  // Epic 3: AI integration (reserved for future)
  | "RBAC_AUDIT"
  | "AUTO_PATCH"
  // Epic 4: Reports (reserved for future)
  | "SECURITY_REPORT";

/** Security Feature Flags object type */
export type SecurityFeatureFlagsType = Record<SecurityFeatureFlagKey, boolean>;

// ============================================
// Default Feature Flags definition
// ============================================

/**
 * Default Feature Flag values
 * - SECURITY_SCAN_PANEL: true — Epic 2 development started, enabled by default
 * - RBAC_AUDIT, AUTO_PATCH, SECURITY_REPORT: To be enabled in Epic 3~4
 */
const DEFAULT_FLAGS: SecurityFeatureFlagsType = {
  SECURITY_SCAN_PANEL: true, // Epic 2: enabled by default
  RBAC_AUDIT: false, // Planned to enable in Epic 3
  AUTO_PATCH: false, // Planned to enable in Epic 3
  SECURITY_REPORT: false, // Planned to enable in Epic 4
};

// ============================================
// Runtime Feature Flags state
// ============================================

/** Current Feature Flag state (can be changed at runtime) */
let currentFlags: SecurityFeatureFlagsType = { ...DEFAULT_FLAGS };

/**
 * SECURITY_FLAGS — Current Feature Flag state for external reference
 * Proxy reflects currentFlags values
 */
export const SECURITY_FLAGS: Readonly<SecurityFeatureFlagsType> = new Proxy({} as SecurityFeatureFlagsType, {
  get(_target, prop: string) {
    return currentFlags[prop as SecurityFeatureFlagKey];
  },
  set() {
    return false; // Direct modification not allowed
  },
});

// ============================================
// Utility functions
// ============================================

/**
 * Check if a specific Security feature is enabled
 * @param feature - Security Feature Flag key
 * @returns Whether the feature is enabled
 */
export function isSecurityFeatureEnabled(feature: SecurityFeatureFlagKey): boolean {
  return currentFlags[feature] ?? false;
}

/**
 * Set individual Security feature enabled state (for testing/runtime control)
 * @param feature - Security Feature Flag key
 * @param enabled - Whether to enable the feature
 */
export function setSecurityFeatureEnabled(feature: SecurityFeatureFlagKey, enabled: boolean): void {
  currentFlags[feature] = enabled;
}

/** Reset all Security Feature Flags to default values */
export function resetSecurityFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FLAGS };
}

/** Return list of currently enabled Security features (for debugging) */
export function getEnabledSecurityFeatures(): SecurityFeatureFlagKey[] {
  return (Object.keys(currentFlags) as SecurityFeatureFlagKey[]).filter((k) => currentFlags[k]);
}

// ============================================
// Environment variable override
// ============================================

/**
 * Apply Security Feature Flag overrides from environment variables
 * Format: SKUBERPLUS_FEATURE_{FLAG_NAME}=true|false
 * Called once during app initialization
 *
 * @example
 * SKUBERPLUS_FEATURE_SECURITY_SCAN_PANEL=false pnpm start
 */
export function applySecurityFeatureEnvironmentOverrides(): void {
  if (typeof process === "undefined" || !process.env) {
    return;
  }
  const prefix = "SKUBERPLUS_FEATURE_";
  for (const key of Object.keys(currentFlags) as SecurityFeatureFlagKey[]) {
    const envKey = `${prefix}${key}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      const enabled = envValue.toLowerCase() === "true";
      currentFlags[key] = enabled;
      console.log(`[Security Feature Flags] Environment variable override: ${key} = ${enabled}`);
    }
  }
}
