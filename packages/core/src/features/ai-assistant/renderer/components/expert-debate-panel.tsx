/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Expert Debate Panel UI Component
 *
 * Displays real-time progress of the multi-expert panel analysis.
 * Shows expert cards with thinking/complete status and the synthesis result.
 *
 * Events handled:
 * - debate-start: Show expert cards in "thinking" state
 * - debate-expert-response: Update individual expert status
 * - debate-consensus: Show final synthesis
 */

import { action, makeAutoObservable } from "mobx";
import { observer } from "mobx-react";
import React from "react";

// ============================================
// Types
// ============================================

export interface ExpertDebateExpert {
  id: string;
  name: string;
  status: "waiting" | "thinking" | "complete";
  content?: string;
}

export interface ExpertDebateState {
  active: boolean;
  experts: ExpertDebateExpert[];
  roundNumber: number;
  consensus?: string;
}

// ============================================
// MobX Store
// ============================================

export class ExpertDebateStore {
  state: ExpertDebateState | null = null;

  constructor() {
    makeAutoObservable(this, {
      handleDebateStart: action,
      handleExpertResponse: action,
      handleConsensus: action,
      reset: action,
    });
  }

  handleDebateStart(experts: Array<{ id: string; name: string }>, roundNumber: number): void {
    this.state = {
      active: true,
      roundNumber,
      experts: experts.map((e) => ({
        id: e.id,
        name: e.name,
        status: "waiting",
      })),
    };
  }

  handleExpertResponse(expertId: string, expertName: string, content: string, status: "thinking" | "complete"): void {
    if (!this.state) return;

    const expert = this.state.experts.find((e) => e.id === expertId);
    if (expert) {
      expert.status = status;
      if (status === "complete") {
        expert.content = content;
      }
    }
  }

  handleConsensus(consensus: string): void {
    if (!this.state) return;
    this.state.consensus = consensus;
    this.state.active = false;
  }

  reset(): void {
    this.state = null;
  }

  get isActive(): boolean {
    return this.state?.active ?? false;
  }

  get hasState(): boolean {
    return this.state !== null;
  }
}

// Singleton store instance
export const expertDebateStore = new ExpertDebateStore();

// ============================================
// UI Components
// ============================================

const lineStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--textSecondary, #666)",
  lineHeight: 1.8,
};

const activeLineStyle: React.CSSProperties = {
  ...lineStyle,
  animation: "expertPulse 1.5s ease-in-out infinite",
};

function getStatusSymbol(status: "waiting" | "thinking" | "complete"): string {
  switch (status) {
    case "waiting":
      return "\u25CB";
    case "thinking":
      return "\u23F5";
    case "complete":
      return "\u2713";
  }
}

function getStatusLabel(status: "waiting" | "thinking" | "complete"): string {
  switch (status) {
    case "waiting":
      return "waiting...";
    case "thinking":
      return "analyzing...";
    case "complete":
      return "complete";
  }
}

interface ExpertDebatePanelProps {
  store?: ExpertDebateStore;
}

export const ExpertDebatePanel: React.FC<ExpertDebatePanelProps> = observer(({ store }) => {
  const debateStore = store ?? expertDebateStore;

  if (!debateStore.hasState || !debateStore.state) {
    return null;
  }

  const { experts, consensus } = debateStore.state;
  const allComplete = experts.every((e) => e.status === "complete");

  const isActive = (status: string) => status === "thinking" || status === "waiting";

  return (
    <div style={{ margin: "8px 0" }}>
      <style>{`@keyframes expertPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {experts.map((expert) => (
        <div key={expert.id} style={isActive(expert.status) ? activeLineStyle : lineStyle}>
          {getStatusSymbol(expert.status)} {expert.name}: {getStatusLabel(expert.status)}
        </div>
      ))}
      {allComplete && !consensus && <div style={activeLineStyle}>{"\u23F5"} Synthesizing findings...</div>}
      {consensus && <div style={lineStyle}>{"\u2713"} Expert analysis complete</div>}
    </div>
  );
});

ExpertDebatePanel.displayName = "ExpertDebatePanel";
