/**
 * 🎯 목적: AI Assistant Context 타입 정의 모듈
 *
 * 01: Context 타입 정의
 *
 * 주요 기능:
 * - Kubernetes 리소스 및 시스템 컨텍스트 타입 정의
 * - ContextItem 인터페이스 정의 (컨텍스트 필/멘션용)
 * - 타입별 메타데이터 (아이콘, 라벨, 우선순위)
 * - 유틸리티 함수 제공
 *
 * @packageDocumentation
 */

import { v4 as uuid } from "uuid";

// ============================================
// 🎯 Context Type 열거형
// ============================================

/** 지원하는 컨텍스트 타입 - Kubernetes 리소스 및 시스템 컨텍스트 */
export const ContextType = {
  // Kubernetes 리소스 타입
  POD: "pod",
  DEPLOYMENT: "deployment",
  SERVICE: "service",
  NODE: "node",
  NAMESPACE: "namespace",
  CONFIGMAP: "configmap",
  SECRET: "secret",
  INGRESS: "ingress",
  PVC: "pvc",
  STATEFULSET: "statefulset",
  DAEMONSET: "daemonset",
  REPLICASET: "replicaset",
  JOB: "job",
  CRONJOB: "cronjob",
  // 시스템 컨텍스트 타입
  CLUSTER: "cluster",
  FILE: "file",
  ERROR: "error",
  LOG: "log",
  METRIC: "metric",
  EVENT: "event",
} as const;

/** ContextType 값의 유니온 타입 */
export type ContextTypeValue = (typeof ContextType)[keyof typeof ContextType];

// ============================================
// 🎯 Context Item 인터페이스
// ============================================

/** 컨텍스트 아이템 - 컨텍스트 필에서 표시되는 단일 항목 */
export interface ContextItem {
  /** 고유 식별자 */
  id: string;
  /** 컨텍스트 타입 */
  type: ContextTypeValue;
  /** 리소스 이름 */
  name: string;
  /** 네임스페이스 (Kubernetes 리소스의 경우) */
  namespace?: string;
  /** UI에 표시할 이름 (없으면 name 사용) */
  displayName?: string;
  /** 설명 텍스트 */
  description?: string;
  /** 추가 메타데이터 (리소스별 상세 정보) */
  metadata?: Record<string, unknown>;
  /** Kubernetes 리소스 버전 */
  resourceVersion?: string;
  /** 생성 시간 */
  createdAt: Date;
}

/** ContextItem 생성을 위한 입력 타입 */
export interface CreateContextItemInput {
  type: ContextTypeValue;
  name: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  resourceVersion?: string;
}

// ============================================
// 🎯 Context Type 메타데이터
// ============================================

/** 컨텍스트 타입별 메타데이터 */
export interface ContextTypeMetadata {
  /** 아이콘 이름 (Lucide 또는 커스텀) */
  icon: string;
  /** 한글 라벨 */
  label: string;
  /** 정렬 우선순위 (낮을수록 먼저 표시) */
  priority: number;
  /** 카테고리 */
  category: "kubernetes" | "system";
}

/** 모든 ContextType에 대한 메타데이터 */
export const CONTEXT_TYPE_METADATA: Record<ContextTypeValue, ContextTypeMetadata> = {
  // 시스템 컨텍스트 (우선순위 높음)
  [ContextType.CLUSTER]: { icon: "server", label: "클러스터", priority: 1, category: "system" },
  [ContextType.NAMESPACE]: {
    icon: "folder",
    label: "네임스페이스",
    priority: 2,
    category: "kubernetes",
  },
  // Kubernetes 워크로드
  [ContextType.POD]: { icon: "box", label: "파드", priority: 10, category: "kubernetes" },
  [ContextType.DEPLOYMENT]: {
    icon: "layers",
    label: "디플로이먼트",
    priority: 11,
    category: "kubernetes",
  },
  [ContextType.STATEFULSET]: {
    icon: "database",
    label: "스테이트풀셋",
    priority: 12,
    category: "kubernetes",
  },
  [ContextType.DAEMONSET]: {
    icon: "cpu",
    label: "데몬셋",
    priority: 13,
    category: "kubernetes",
  },
  [ContextType.REPLICASET]: {
    icon: "copy",
    label: "레플리카셋",
    priority: 14,
    category: "kubernetes",
  },
  [ContextType.JOB]: { icon: "play", label: "잡", priority: 15, category: "kubernetes" },
  [ContextType.CRONJOB]: { icon: "clock", label: "크론잡", priority: 16, category: "kubernetes" },
  // 네트워킹
  [ContextType.SERVICE]: {
    icon: "network",
    label: "서비스",
    priority: 20,
    category: "kubernetes",
  },
  [ContextType.INGRESS]: {
    icon: "globe",
    label: "인그레스",
    priority: 21,
    category: "kubernetes",
  },
  // 설정 & 스토리지
  [ContextType.CONFIGMAP]: {
    icon: "file-text",
    label: "컨피그맵",
    priority: 30,
    category: "kubernetes",
  },
  [ContextType.SECRET]: { icon: "key", label: "시크릿", priority: 31, category: "kubernetes" },
  [ContextType.PVC]: {
    icon: "hard-drive",
    label: "PVC",
    priority: 32,
    category: "kubernetes",
  },
  // 인프라
  [ContextType.NODE]: { icon: "server", label: "노드", priority: 40, category: "kubernetes" },
  // 시스템 컨텍스트
  [ContextType.FILE]: { icon: "file", label: "파일", priority: 50, category: "system" },
  [ContextType.LOG]: { icon: "file-text", label: "로그", priority: 51, category: "system" },
  [ContextType.EVENT]: { icon: "bell", label: "이벤트", priority: 52, category: "system" },
  [ContextType.METRIC]: { icon: "bar-chart", label: "메트릭", priority: 53, category: "system" },
  [ContextType.ERROR]: {
    icon: "alert-circle",
    label: "에러",
    priority: 54,
    category: "system",
  },
};

// ============================================
// 🎯 유틸리티 함수
// ============================================

/** 유효한 ContextType 값들의 Set (빠른 검색용) */
const VALID_CONTEXT_TYPES = new Set(Object.values(ContextType));

/**
 * 문자열이 유효한 ContextType인지 검증
 * @param value - 검증할 문자열
 * @returns 유효한 ContextType이면 true
 */
export function isValidContextType(value: string): value is ContextTypeValue {
  return VALID_CONTEXT_TYPES.has(value.toLowerCase() as ContextTypeValue);
}

/**
 * ContextItem 객체 생성
 * @param input - 생성에 필요한 입력값
 * @returns 생성된 ContextItem
 */
export function createContextItem(input: CreateContextItemInput): ContextItem {
  return {
    id: uuid(),
    type: input.type,
    name: input.name,
    namespace: input.namespace,
    displayName: input.displayName,
    description: input.description,
    metadata: input.metadata,
    resourceVersion: input.resourceVersion,
    createdAt: new Date(),
  };
}

/**
 * ContextType에 해당하는 아이콘 이름 반환
 * @param type - 컨텍스트 타입
 * @returns 아이콘 이름
 */
export function getContextTypeIcon(type: ContextTypeValue | string): string {
  const metadata = CONTEXT_TYPE_METADATA[type as ContextTypeValue];
  return metadata?.icon ?? "help-circle";
}

/**
 * ContextType에 해당하는 한글 라벨 반환
 * @param type - 컨텍스트 타입
 * @returns 한글 라벨
 */
export function getContextTypeLabel(type: ContextTypeValue | string): string {
  const metadata = CONTEXT_TYPE_METADATA[type as ContextTypeValue];
  return metadata?.label ?? type;
}

/**
 * ContextType의 정렬 우선순위 반환
 * @param type - 컨텍스트 타입
 * @returns 우선순위 (낮을수록 먼저)
 */
export function getContextTypePriority(type: ContextTypeValue | string): number {
  const metadata = CONTEXT_TYPE_METADATA[type as ContextTypeValue];
  return metadata?.priority ?? 999;
}

/**
 * 카테고리별 ContextType 목록 반환
 * @param category - 카테고리 (kubernetes 또는 system)
 * @returns 해당 카테고리의 ContextType 배열
 */
export function getContextTypesByCategory(category: "kubernetes" | "system"): ContextTypeValue[] {
  return Object.entries(CONTEXT_TYPE_METADATA)
    .filter(([, meta]) => meta.category === category)
    .map(([type]) => type as ContextTypeValue);
}

/**
 * 우선순위 기준으로 ContextItem 배열 정렬
 * @param items - 정렬할 ContextItem 배열
 * @returns 정렬된 배열 (원본 수정 안함)
 */
export function sortContextItemsByPriority(items: ContextItem[]): ContextItem[] {
  return [...items].sort((a, b) => getContextTypePriority(a.type) - getContextTypePriority(b.type));
}
