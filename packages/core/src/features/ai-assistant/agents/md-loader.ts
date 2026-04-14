/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * MD-based Agent Configuration Loader
 *
 * Loads SOUL.md, TOOLS.md, skill MDs, and expert MDs.
 * Default MDs are bundled via webpack (asset/source).
 * User overrides from userData/agents/ take priority (fs.readFileSync).
 *
 * Frontmatter parser: self-contained (~50 lines), no external dependencies.
 */

import * as fs from "fs";
import * as path from "path";
import performanceMd from "./experts/performance.md";
import reliabilityMd from "./experts/reliability.md";
// Expert MDs
import securityMd from "./experts/security.md";
import synthesizerMd from "./experts/synthesizer.md";
// Bundled MD files (webpack asset/source → raw string)
import soulMd from "./SOUL.md";
import assessmentMd from "./skills/assessment.md";
import deploymentsMd from "./skills/deployments.md";
import devopsMd from "./skills/devops.md";
import diagnoseMd from "./skills/diagnose.md";
import eventsMd from "./skills/events.md";
import finopsMd from "./skills/finops.md";
import logsMd from "./skills/logs.md";
import metricsMd from "./skills/metrics.md";
// Skill MDs
import podsMd from "./skills/pods.md";
import researchMd from "./skills/research.md";
import servicesMd from "./skills/services.md";
import solveMd from "./skills/solve.md";
import toolsMd from "./TOOLS.md";

// ============================================
// Frontmatter Parser
// ============================================

export interface MdDocument<T extends Record<string, unknown> = Record<string, unknown>> {
  meta: T;
  content: string;
}

/**
 * Parse markdown with YAML frontmatter.
 * Handles simple key: value pairs and arrays in [a, b, c] format.
 */
function parseFrontmatter<T extends Record<string, unknown> = Record<string, unknown>>(raw: string): MdDocument<T> {
  const trimmed = raw.replace(/^\uFEFF/, ""); // strip BOM
  if (!trimmed.startsWith("---")) {
    return { meta: {} as T, content: trimmed };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { meta: {} as T, content: trimmed };
  }

  const frontmatterBlock = trimmed.slice(4, endIndex); // skip first "---\n"
  const body = trimmed.slice(endIndex + 4); // skip "\n---"
  const content = (body.startsWith("\n") ? body.slice(1) : body).replace(/\n+$/, "");

  const meta: Record<string, unknown> = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    let value: unknown = trimmedLine.slice(colonIndex + 1).trim();

    // Remove surrounding quotes
    if (typeof value === "string" && value.length >= 2) {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = (value as string).slice(1, -1);
      }
    }

    // Parse arrays: [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }

    // Parse booleans and numbers
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (typeof value === "string" && value !== "" && !isNaN(Number(value))) {
      value = Number(value);
    }

    meta[key] = value;
  }

  return { meta: meta as T, content };
}

// ============================================
// Skill Metadata Types
// ============================================

export interface SkillMeta {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
}

export interface ExpertMeta {
  [key: string]: unknown;
  id: string;
  name: string;
  focusAreas?: string[];
  description?: string;
}

// ============================================
// User Override Directory
// ============================================

/** 사용자 오버라이드 MD 루트 경로 (앱 데이터/ai-assistant/agents/) */
let userOverrideDir: string | null = null;

/**
 * 🎯 사용자 오버라이드 디렉토리 설정
 * 앱 초기화 시 한 번 호출합니다.
 * @param userDataPath - app.getPath('userData') 경로
 */
export function setUserOverrideDir(userDataPath: string): void {
  userOverrideDir = path.join(userDataPath, "ai-assistant", "agents");
  // 캐시 무효화 (새 경로 적용)
  invalidateMdCache();
}

/**
 * 🎯 사용자 오버라이드 파일 읽기 (동기)
 * 파일이 있으면 내용 반환, 없으면 null
 */
function readUserOverride(relativePath: string): string | null {
  if (!userOverrideDir) return null;
  const filePath = path.join(userOverrideDir, relativePath);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null; // 파일 없으면 번들 기본값 사용
  }
}

/**
 * 🎯 사용자 오버라이드 파일 쓰기 (동기)
 * AI가 채팅으로 MD를 편집할 때 사용
 */
export function writeUserOverride(relativePath: string, content: string): void {
  if (!userOverrideDir) return;
  const filePath = path.join(userOverrideDir, relativePath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  // 해당 캐시 무효화
  invalidateMdCache();
}

/**
 * 🎯 사용자 오버라이드 파일 삭제 (번들 기본값 복원)
 */
export function deleteUserOverride(relativePath: string): boolean {
  if (!userOverrideDir) return false;
  const filePath = path.join(userOverrideDir, relativePath);
  try {
    fs.unlinkSync(filePath);
    invalidateMdCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * 🎯 사용자 오버라이드 파일 목록 조회
 */
export function listUserOverrides(): string[] {
  if (!userOverrideDir) return [];
  try {
    const files: string[] = [];
    const walk = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else if (entry.name.endsWith(".md")) {
          files.push(rel);
        }
      }
    };
    walk(userOverrideDir, "");
    return files;
  } catch {
    return [];
  }
}

// ============================================
// Cached MD Documents
// ============================================

/** Parsed SOUL.md (cached on first access) */
let cachedSoul: MdDocument | null = null;

/** Parsed TOOLS.md (cached on first access) */
let cachedTools: MdDocument | null = null;

/** Parsed skill MDs (cached on first access) */
let cachedSkills: Map<string, MdDocument<SkillMeta>> | null = null;

/** Parsed expert MDs (cached on first access) */
let cachedExperts: Map<string, MdDocument<ExpertMeta>> | null = null;

// ============================================
// Bundled MD Registry
// ============================================

const BUNDLED_SKILLS: Record<string, string> = {
  pods: podsMd,
  deployments: deploymentsMd,
  services: servicesMd,
  logs: logsMd,
  metrics: metricsMd,
  events: eventsMd,
  solve: solveMd,
  devops: devopsMd,
  finops: finopsMd,
  research: researchMd,
  assessment: assessmentMd,
  diagnose: diagnoseMd,
};

const BUNDLED_EXPERTS: Record<string, string> = {
  security: securityMd,
  performance: performanceMd,
  reliability: reliabilityMd,
  synthesizer: synthesizerMd,
};

// ============================================
// 🎯 Editable Config Registry
// ============================================

export interface EditableConfig {
  name: string;
  relativePath: string;
  category: "core" | "skill" | "expert";
  description: string;
}

/**
 * 화이트리스트: AI 도구 및 UI에서 접근 가능한 설정 파일 목록.
 * 새 파일 추가 시 여기에 등록만 하면 됨.
 */
export const EDITABLE_CONFIGS: EditableConfig[] = [
  { name: "SOUL.md", relativePath: "SOUL.md", category: "core", description: "AI 페르소나 및 안전 규칙" },
  { name: "TOOLS.md", relativePath: "TOOLS.md", category: "core", description: "도구 설명 및 파일 관리 지침" },
  ...Object.entries(BUNDLED_SKILLS).map(([id]) => ({
    name: `${id}.md`,
    relativePath: `skills/${id}.md`,
    category: "skill" as const,
    description: `Skill: ${id}`,
  })),
  ...Object.entries(BUNDLED_EXPERTS).map(([id]) => ({
    name: `${id}.md`,
    relativePath: `experts/${id}.md`,
    category: "expert" as const,
    description: `Expert: ${id}`,
  })),
];

/**
 * 🎯 번들된 기본값 가져오기 (오버라이드 없이)
 */
export function getBundledContent(relativePath: string): string {
  if (relativePath === "SOUL.md") return parseFrontmatter(soulMd).content;
  if (relativePath === "TOOLS.md") return parseFrontmatter(toolsMd).content;
  if (relativePath.startsWith("skills/")) {
    const id = relativePath.replace("skills/", "").replace(".md", "");
    const raw = BUNDLED_SKILLS[id];
    return raw ? parseFrontmatter(raw).content : "";
  }
  if (relativePath.startsWith("experts/")) {
    const id = relativePath.replace("experts/", "").replace(".md", "");
    const raw = BUNDLED_EXPERTS[id];
    return raw ? parseFrontmatter(raw).content : "";
  }
  return "";
}

/**
 * 🎯 현재 유효한 내용 가져오기 (오버라이드 우선)
 * 오버라이드가 있으면 그걸, 없으면 null 반환
 */
export function getEffectiveContent(relativePath: string): string | null {
  const userOverride = readUserOverride(relativePath);
  if (userOverride !== null) {
    return parseFrontmatter(userOverride).content;
  }
  return null; // 번들 기본값 사용 중
}

// ============================================
// Public API
// ============================================

/**
 * Get the core persona prompt (SOUL.md body).
 */
export function getSoulPrompt(): string {
  if (!cachedSoul) {
    const userOverride = readUserOverride("SOUL.md");
    cachedSoul = parseFrontmatter(userOverride ?? soulMd);
  }
  return cachedSoul.content;
}

/**
 * Get the tools/file management prompt (TOOLS.md body).
 */
export function getToolsPrompt(): string {
  if (!cachedTools) {
    const userOverride = readUserOverride("TOOLS.md");
    cachedTools = parseFrontmatter(userOverride ?? toolsMd);
  }
  return cachedTools.content;
}

/**
 * Get a skill's prompt content by ID.
 * Returns the MD body (without frontmatter) or undefined if not found.
 */
export function getSkillPrompt(id: string): MdDocument<SkillMeta> | undefined {
  if (!cachedSkills) {
    cachedSkills = new Map();
    for (const [skillId, raw] of Object.entries(BUNDLED_SKILLS)) {
      const userOverride = readUserOverride(`skills/${skillId}.md`);
      cachedSkills.set(skillId, parseFrontmatter<SkillMeta>(userOverride ?? raw));
    }
  }
  return cachedSkills.get(id);
}

/**
 * Get all skill documents (for building skill configs).
 */
export function getAllSkills(): Map<string, MdDocument<SkillMeta>> {
  if (!cachedSkills) {
    cachedSkills = new Map();
    for (const [skillId, raw] of Object.entries(BUNDLED_SKILLS)) {
      const userOverride = readUserOverride(`skills/${skillId}.md`);
      cachedSkills.set(skillId, parseFrontmatter<SkillMeta>(userOverride ?? raw));
    }
  }
  return cachedSkills;
}

/**
 * Get an expert's prompt content by ID.
 */
export function getExpertPrompt(id: string): MdDocument<ExpertMeta> | undefined {
  if (!cachedExperts) {
    cachedExperts = new Map();
    for (const [expertId, raw] of Object.entries(BUNDLED_EXPERTS)) {
      const userOverride = readUserOverride(`experts/${expertId}.md`);
      cachedExperts.set(expertId, parseFrontmatter<ExpertMeta>(userOverride ?? raw));
    }
  }
  return cachedExperts.get(id);
}

/**
 * Get all expert documents.
 */
export function getAllExperts(): Map<string, MdDocument<ExpertMeta>> {
  if (!cachedExperts) {
    cachedExperts = new Map();
    for (const [expertId, raw] of Object.entries(BUNDLED_EXPERTS)) {
      const userOverride = readUserOverride(`experts/${expertId}.md`);
      cachedExperts.set(expertId, parseFrontmatter<ExpertMeta>(userOverride ?? raw));
    }
  }
  return cachedExperts;
}

// ============================================
// 🎯 Custom Skill System (보편적 패턴)
// ============================================

/** 커스텀 skill 저장 경로: {userData}/ai-assistant/agents/custom-skills/*.md */
const CUSTOM_SKILLS_SUBDIR = "custom-skills";

/** 커스텀 skill 최대 개수 (제한 없음 — Progressive Disclosure로 on-demand 로드) */
export const MAX_CUSTOM_SKILLS = Infinity;

/** 커스텀 skill 총 토큰 상한 (Lazy Load에서는 retrieve 시에만 적용, 약 8,000 토큰 ≈ 32KB) */
export const MAX_CUSTOM_SKILLS_TOTAL_CHARS = 32_000;

export interface CustomSkillMeta {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
}

/** Parsed custom skill documents (cached) */
let cachedCustomSkills: Map<string, MdDocument<CustomSkillMeta>> | null = null;

/**
 * 커스텀 skill 디렉토리 경로
 */
function getCustomSkillsDir(): string | null {
  if (!userOverrideDir) return null;
  return path.join(userOverrideDir, CUSTOM_SKILLS_SUBDIR);
}

/**
 * 모든 커스텀 skill 로드 (캐시)
 */
export function getAllCustomSkills(): Map<string, MdDocument<CustomSkillMeta>> {
  if (cachedCustomSkills) return cachedCustomSkills;

  const dir = getCustomSkillsDir();
  // userOverrideDir 미설정 시 캐시하지 않음 (race condition 방지)
  if (!dir) return new Map();

  cachedCustomSkills = new Map();

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        const doc = parseFrontmatter<CustomSkillMeta>(raw);
        const id = doc.meta.id || file.replace(/\.md$/, "");
        doc.meta.id = id;
        if (!doc.meta.name) doc.meta.name = id;
        if (!doc.meta.description) doc.meta.description = "";
        cachedCustomSkills.set(id, doc);
      } catch {
        // 파싱 실패 시 스킵
      }
    }
  } catch {
    // 디렉토리 없으면 빈 맵
  }

  return cachedCustomSkills;
}

/**
 * 활성화된 커스텀 skill만 반환 (시스템 프롬프트 주입용)
 */
export function getEnabledCustomSkills(): Map<string, MdDocument<CustomSkillMeta>> {
  const all = getAllCustomSkills();
  const enabled = new Map<string, MdDocument<CustomSkillMeta>>();
  for (const [id, doc] of all) {
    if (doc.meta.enabled !== false) {
      enabled.set(id, doc);
    }
  }
  return enabled;
}

/**
 * 커스텀 skill 프롬프트 텍스트 생성 (시스템 프롬프트에 상시 포함)
 * 토큰 상한 초과 시 경고 포함하여 잘림
 */
/**
 * 커스텀 skill 목록 프롬프트 생성 (Progressive Disclosure 방식)
 *
 * 시스템 프롬프트에는 이름+설명+파일 경로만 포함하여 토큰을 절약한다.
 * AI가 스킬 적용이 필요하다고 판단하면 read_file 도구로 전체 내용을 로드한다.
 * (retrieve_custom_skill 전용 도구 대신 범용 read_file 활용 — Claude/Codex Skills 방식)
 */
export function buildCustomSkillsPrompt(): string {
  const enabled = getEnabledCustomSkills();
  if (enabled.size === 0) return "";

  const dir = getCustomSkillsDir();
  if (!dir) return "";

  const parts: string[] = [];
  parts.push("\n## Custom Skills (User-Defined)");
  parts.push(
    "You have access to the following custom skills. When the user\'s request matches a skill\'s description, use the `read_file` tool to load the full instructions from the file path before proceeding.\n",
  );

  for (const [id, doc] of enabled) {
    const filePath = dir + "/" + id + ".md";
    parts.push(`- **${doc.meta.name}** (file: \`${filePath}\`): ${doc.meta.description}`);
  }

  return parts.join("\n");
}

/**
 * 커스텀 skill 전체 내용 반환 (retrieve_custom_skill 도구용)
 */
export function getCustomSkillContent(id: string): string | null {
  const doc = readCustomSkill(id);
  if (!doc || doc.meta.enabled === false) return null;
  return `# Skill: ${doc.meta.name}\n\n${doc.content}`;
}

/**
 * 커스텀 skill 저장
 */
export function saveCustomSkill(id: string, mdContent: string): void {
  const dir = getCustomSkillsDir();
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.md`), mdContent, "utf-8");
  cachedCustomSkills = null;
}

/**
 * 커스텀 skill 삭제
 */
export function deleteCustomSkillFile(id: string): boolean {
  const dir = getCustomSkillsDir();
  if (!dir) return false;
  try {
    fs.unlinkSync(path.join(dir, `${id}.md`));
    cachedCustomSkills = null;
    return true;
  } catch {
    return false;
  }
}

/**
 * 커스텀 skill 읽기
 */
export function readCustomSkill(id: string): MdDocument<CustomSkillMeta> | undefined {
  const all = getAllCustomSkills();
  return all.get(id);
}

/**
 * Invalidate all caches (for hot-reload or testing).
 */
export function invalidateMdCache(): void {
  cachedSoul = null;
  cachedTools = null;
  cachedSkills = null;
  cachedExperts = null;
  cachedCustomSkills = null;
}
