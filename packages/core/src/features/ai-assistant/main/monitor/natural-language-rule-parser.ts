/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";
import { v4 as uuid } from "uuid";

import type { MonitorConfig, MonitorRule } from "../../common/monitor-types";

type ParserLLMModel = ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI | ChatOllama | ChatOpenRouter;

/**
 * 목적: evalCommand 보안 검증 (생성 시 + 실행 시 2중 검증)
 */
export function validateEvalCommand(command: string): { valid: boolean; error?: string } {
  const allowed = ["get", "describe", "logs", "top", "events", "api-resources"];
  const args = command.trim().split(/\s+/);
  if (!allowed.includes(args[0])) {
    return { valid: false, error: `'${args[0]}' not allowed` };
  }
  if (command.includes("--kubeconfig")) {
    return { valid: false, error: "Must not include --kubeconfig" };
  }
  if (/[;&|`$()]/.test(command)) {
    return { valid: false, error: "Shell metacharacters not allowed" };
  }
  return { valid: true };
}

/**
 * 목적: LLM 기반 자연어 규칙 파서 (evalCommand 생성)
 */
export async function parseNaturalLanguageRuleWithLLM(params: {
  description: string;
  provider: MonitorConfig["provider"];
  apiKey: string;
  modelId?: string;
}): Promise<MonitorRule> {
  const { description, provider, apiKey, modelId } = params;

  const model = createParserModel(provider, apiKey, modelId);

  const systemPrompt = `You generate kubectl evaluation commands for Kubernetes monitoring rules.
Given a natural language description, produce JSON:
{
  "condition": { "resource": "node|pod|event", "field": "memory_percent|cpu_percent|message", "operator": "gt|lt|eq|contains|regex", "value": "string" },
  "evalCommand": "kubectl args without 'kubectl' prefix, e.g. 'top pods -A --no-headers'",
  "evalInterpretHint": "How to evaluate the output against the rule threshold",
  "severity": "critical|warning|info"
}
CONSTRAINTS: read-only commands only (get/describe/logs/top/events/api-resources). Use -A for cluster-wide. Prefer --no-headers or -o json.
Output ONLY the JSON object. No other text.`;

  const response = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(description)]);

  const text =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .filter(
              (block): block is { type: "text"; text: string } => typeof block === "object" && block.type === "text",
            )
            .map((block) => block.text)
            .join("")
        : "";

  const parsed = safeParseLLMJson(text);
  if (!parsed) {
    throw new Error("LLM returned unparseable JSON");
  }

  const validOperators: MonitorRule["condition"]["operator"][] = ["gt", "lt", "eq", "contains", "regex"];
  const rawOperator = parsed.condition?.operator;

  const rule: MonitorRule = {
    id: `rule-${uuid()}`,
    description,
    condition: {
      resource: String(parsed.condition?.resource ?? "event"),
      field: parsed.condition?.field ? String(parsed.condition.field) : undefined,
      operator: validOperators.includes(rawOperator) ? rawOperator : "contains",
      value: String(parsed.condition?.value ?? ""),
    },
    severity: parsed.severity === "critical" || parsed.severity === "info" ? parsed.severity : "warning",
    enabled: true,
  };

  // evalCommand 검증 — 실패 시 evalCommand 없이 반환
  if (parsed.evalCommand) {
    const validation = validateEvalCommand(String(parsed.evalCommand));
    if (validation.valid) {
      rule.evalCommand = String(parsed.evalCommand);
      if (parsed.evalInterpretHint) {
        rule.evalInterpretHint = String(parsed.evalInterpretHint);
      }
    } else {
      console.warn(`[RuleParser] evalCommand rejected: ${validation.error}`);
    }
  }

  return rule;
}

/**
 * 목적: 자연어 규칙을 내부 룰 타입으로 변환 (regex 폴백)
 */
export function parseNaturalLanguageRule(description: string): MonitorRule {
  const lowered = description.toLowerCase();
  const severity = inferSeverity(lowered);
  const threshold = inferThreshold(lowered);

  return {
    id: `rule-${uuid()}`,
    description,
    condition: {
      resource: inferResource(lowered),
      field: inferField(lowered),
      operator: inferOperator(lowered),
      value: threshold,
    },
    severity,
    enabled: true,
  };
}

/**
 * 목적: provider/apiKey로 LangChain 모델 인스턴스 생성 (파서 전용)
 */
function createParserModel(provider: MonitorConfig["provider"], apiKey: string, modelId?: string): ParserLLMModel {
  const id = modelId ?? "claude-sonnet-4-6";
  switch (provider) {
    case "anthropic": {
      return new ChatAnthropic({
        apiKey,
        model: id,
        temperature: 0,
        maxTokens: 1024,
      });
    }
    case "openai":
      return new ChatOpenAI({
        apiKey,
        model: id,
        temperature: 0,
        maxTokens: 1024,
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: id,
        temperature: 0,
      } as any);
    case "ollama":
      return new ChatOllama({
        model: id,
      });
    case "openrouter":
      return new ChatOpenRouter({
        model: id,
        apiKey,
        temperature: 0,
        maxTokens: 1024,
      });
    default:
      return new ChatAnthropic({
        apiKey,
        model: id,
        temperature: 0,
        maxTokens: 1024,
      });
  }
}

function safeParseLLMJson(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {
    /* fallthrough */
  }
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    /* fallthrough */
  }
  try {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) return JSON.parse(text.slice(first, last + 1));
  } catch {
    /* fallthrough */
  }
  return null;
}

function inferSeverity(text: string): MonitorRule["severity"] {
  if (text.includes("critical") || text.includes("심각") || text.includes("즉시")) {
    return "critical";
  }
  if (text.includes("warning") || text.includes("경고")) {
    return "warning";
  }
  return "info";
}

function inferResource(text: string): string {
  if (text.includes("node") || text.includes("노드")) return "node";
  if (text.includes("pod") || text.includes("파드")) return "pod";
  if (text.includes("event") || text.includes("이벤트")) return "event";
  return "event";
}

function inferField(text: string): string {
  if (text.includes("memory") || text.includes("메모리")) return "memory_percent";
  if (text.includes("cpu")) return "cpu_percent";
  return "message";
}

function inferOperator(text: string): MonitorRule["condition"]["operator"] {
  if (text.includes("넘") || text.includes("초과") || text.includes(">")) return "gt";
  if (text.includes("미만") || text.includes("<")) return "lt";
  if (text.includes("일치") || text.includes("같") || text.includes("==")) return "eq";
  return "contains";
}

function inferThreshold(text: string): string {
  const numberMatch = text.match(/(\d{1,3})/);
  if (numberMatch) return numberMatch[1];
  const quoted = text.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  return text.slice(0, 64);
}
