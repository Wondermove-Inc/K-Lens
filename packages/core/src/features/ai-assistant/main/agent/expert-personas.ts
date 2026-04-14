/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Expert Personas for Multi-Expert Panel Analysis
 *
 * Loads specialized Kubernetes expert roles from MD files and provides
 * the synthesizer prompt for unified report generation.
 */

import { getExpertPrompt } from "../../agents/md-loader";

// ============================================
// Types
// ============================================

export interface ExpertRole {
  /** Unique expert identifier */
  id: string;
  /** Display name */
  name: string;
  /** System prompt defining the expert's perspective */
  systemPrompt: string;
  /** Areas of focus for this expert */
  focusAreas: string[];
  /** Allowed tools list (if set, only these tools are available; if unset, all tools) */
  allowedTools?: string[];
  /** Denied tools list (lower priority than allowedTools; excluded from full set) */
  deniedTools?: string[];
}

export interface ExpertPanelConfig {
  /** Expert roles to include in the panel */
  experts: ExpertRole[];
  /** Maximum debate rounds (default: 1 = parallel analysis only, max: 2) */
  maxDebateRounds?: number;
  /** How to reach consensus */
  consensusMode: "synthesis" | "voting" | "debate";
  /** Slash command context for output formatting */
  commandContext?: {
    /** Command purpose (e.g., "Diagnose resource issues") */
    purpose: string;
    /** Desired output format template */
    outputFormat?: string;
  };
}

// ============================================
// Kubernetes Expert Roles (loaded from MD)
// ============================================

function loadBuiltinExpertRoles(): ExpertRole[] {
  const expertIds = ["security", "performance", "reliability"];
  const roles: ExpertRole[] = [];

  for (const id of expertIds) {
    const doc = getExpertPrompt(id);
    if (!doc) continue;

    roles.push({
      id: doc.meta.id,
      name: doc.meta.name,
      systemPrompt: doc.content,
      focusAreas: doc.meta.focusAreas ?? [],
    });
  }

  return roles;
}

export const BUILTIN_EXPERT_ROLES: ExpertRole[] = loadBuiltinExpertRoles();

// ============================================
// Synthesizer Prompt (loaded from MD)
// ============================================

function loadSynthesizerBase(): string {
  const doc = getExpertPrompt("synthesizer");
  return doc?.content ?? "";
}

const SYNTHESIZER_BASE = loadSynthesizerBase();

/**
 * Build synthesizer system prompt with optional command context.
 * When a slash command provides purpose/outputFormat, the synthesizer
 * follows that structure instead of a generic format.
 */
export function buildSynthesizerPrompt(commandContext?: { purpose: string; outputFormat?: string }): string {
  if (commandContext?.outputFormat) {
    return `${SYNTHESIZER_BASE}

## Report Purpose
${commandContext.purpose}

## Required Output Format
Follow this output structure:

${commandContext.outputFormat}

Integrate the expert findings into the sections above. Do not use a separate format.`;
  }

  return `${SYNTHESIZER_BASE}

Output format: Structured markdown with priority sections.`;
}

/** @deprecated Use buildSynthesizerPrompt() instead */
export const SYNTHESIZER_PROMPT = `${SYNTHESIZER_BASE}

Output format: Structured markdown with priority sections.
Use the same language as the user's original query.`;
