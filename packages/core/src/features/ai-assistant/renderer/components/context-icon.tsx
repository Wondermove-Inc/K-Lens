/**
 * 🎯 목적: ContextIcon 컴포넌트 - 컨텍스트 타입별 아이콘 표시
 *
 * 02: ContextPill 지원 컴포넌트
 *
 * 주요 기능:
 * - 컨텍스트 타입별 Lucide 아이콘 매핑
 * - 크기 조절 지원
 *
 * @packageDocumentation
 */

import {
  AlertCircle,
  BarChart,
  Bell,
  Box,
  Clock,
  Copy,
  Cpu,
  Database,
  File,
  FileText,
  Folder,
  Globe,
  HardDrive,
  HelpCircle,
  Key,
  Layers,
  Network,
  Play,
  Server,
} from "lucide-react";
import React from "react";
import { ContextType } from "../../common/context-types";

import type { ContextTypeValue } from "../../common/context-types";

// ============================================
// 🎯 아이콘 매핑
// ============================================

/** 컨텍스트 타입별 아이콘 컴포넌트 매핑 */
const CONTEXT_ICON_MAP: Record<ContextTypeValue, React.ElementType> = {
  [ContextType.POD]: Box,
  [ContextType.DEPLOYMENT]: Layers,
  [ContextType.SERVICE]: Network,
  [ContextType.NODE]: Server,
  [ContextType.NAMESPACE]: Folder,
  [ContextType.CONFIGMAP]: FileText,
  [ContextType.SECRET]: Key,
  [ContextType.INGRESS]: Globe,
  [ContextType.PVC]: HardDrive,
  [ContextType.STATEFULSET]: Database,
  [ContextType.DAEMONSET]: Cpu,
  [ContextType.REPLICASET]: Copy,
  [ContextType.JOB]: Play,
  [ContextType.CRONJOB]: Clock,
  [ContextType.CLUSTER]: Server,
  [ContextType.FILE]: File,
  [ContextType.ERROR]: AlertCircle,
  [ContextType.LOG]: FileText,
  [ContextType.METRIC]: BarChart,
  [ContextType.EVENT]: Bell,
};

// ============================================
// 🎯 타입 정의
// ============================================

/** ContextIcon Props */
export interface ContextIconProps {
  /** 컨텍스트 타입 */
  type: ContextTypeValue;
  /** 아이콘 크기 (px) */
  size?: number;
  /** 추가 CSS 클래스 */
  className?: string;
}

// ============================================
// 🎯 컴포넌트 구현
// ============================================

/**
 * ContextIcon 컴포넌트
 *
 * 컨텍스트 타입에 맞는 Lucide 아이콘을 표시합니다.
 *
 * @example
 * ```tsx
 * <ContextIcon type={ContextType.POD} size={16} />
 * ```
 */
export const ContextIcon: React.FC<ContextIconProps> = ({ type, size = 14, className }) => {
  const IconComponent = CONTEXT_ICON_MAP[type] ?? HelpCircle;

  return <IconComponent data-testid={`context-icon-${type}`} className={className} size={size} aria-hidden="true" />;
};

ContextIcon.displayName = "ContextIcon";
