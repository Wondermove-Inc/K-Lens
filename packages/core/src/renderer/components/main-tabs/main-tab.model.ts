/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { StrictReactNode } from "@skuberplus/utilities";

import type { SplitDirection } from "./split-types";

/**
 * 🎯 목적: 메인 콘텐츠 영역 탭 시스템의 데이터 모델 정의
 *
 * @description
 * - 크롬 브라우저 스타일 탭 시스템 구현을 위한 핵심 데이터 구조
 * - 각 탭은 고유한 리소스 뷰(Pods, Services, Deployments 등)를 표현
 * - 라우팅 시스템과 연동되어 URL과 탭 상태가 동기화됨
 *
 * 🔄 변경이력: 2025-09-25 - 초기 생성 (메인 탭 시스템 기반 구조)
 */

export type MainTabId = string;

/**
 * 🎯 목적: 에디터 그룹 식별자 타입 (Phase 2: 2-pane split)
 *
 * @description
 * - Split pane을 구분하기 위한 그룹 ID
 * - Phase 2에서는 "left"와 "right" 두 개만 지원
 * - Phase 3에서 "top", "bottom" 추가 예정
 *
 * 🔄 변경이력: 2025-10-29 - Split 기능 추가를 위한 그룹 ID 타입 정의
 */
export type EditorGroupId = "left" | "right";

/**
 * 탭 타입 구분
 * - 'resource': 쿠버네티스 리소스 뷰 (Pods, Services 등)
 * - 'file': 파일 에디터 탭
 */
export type MainTabType = "resource" | "file";

/**
 * 마크다운 뷰 모드
 * - 'edit': 에디터만 표시
 * - 'preview': 렌더링된 미리보기만 표시
 * - 'split': 좌측 에디터 + 우측 미리보기
 */
export type MarkdownViewMode = "edit" | "preview" | "split";

/**
 * 🏷️ 메인 탭의 핵심 데이터 구조
 */
export interface MainTab {
  /** 🆔 고유 식별자 - 중복 방지용 */
  id: MainTabId;

  /** 📝 탭 제목 (예: "Pods", "Services", "Deployments") */
  title: string;

  /** 🛤️ 연결된 라우트 경로 */
  route: string;

  /** 🎨 Material Design 아이콘명 (선택사항, 레거시) */
  icon?: string;

  /** 🎨 React 아이콘 컴포넌트 (lucide-react 등, 선택사항) */
  iconComponent?: StrictReactNode;

  /** ⏰ 탭 생성 시간 - 정렬 및 히스토리 관리용 */
  createdAt: Date;

  /** 🔄 마지막 활성화 시간 - LRU 관리용 */
  lastActiveAt: Date;

  /** 🎨 이 탭이 속한 클러스터 ID (클러스터 컨텍스트가 없는 탭은 undefined) */
  clusterId?: string;

  // ========== 🆕 파일 탭 전용 필드 ==========

  /**
   * 탭 타입 구분
   * @default 'resource' - 기존 탭은 리소스 타입으로 간주
   */
  type?: MainTabType;

  /**
   * 파일 경로 (type='file'일 때만 사용)
   * - 예: '/home/user/project/deployment.yaml'
   */
  filePath?: string;

  /**
   * 파일 언어 (type='file'일 때만 사용)
   * - Monaco 에디터 언어 ID (yaml, json, typescript 등)
   */
  language?: string;

  /**
   * 원본 파일 내용 (type='file'일 때만 사용)
   * - 파일 최초 로드 또는 저장 직후의 내용
   * - isDirty 계산에 사용
   */
  originalContent?: string;

  /**
   * 현재 편집 중인 내용 (type='file'일 때만 사용)
   * - 에디터에서 수정 중인 내용
   */
  currentContent?: string;

  /**
   * 변경 여부 (type='file'일 때만 사용)
   * - originalContent !== currentContent 일 때 true
   */
  isDirty?: boolean;

  /**
   * 읽기 전용 여부 (type='file'일 때만 사용)
   */
  readOnly?: boolean;

  /**
   * 마크다운 뷰 모드 (마크다운 파일일 때만 사용)
   * - 탭 전환 시에도 뷰 모드 상태 유지를 위해 저장
   * @default 'edit'
   */
  markdownViewMode?: MarkdownViewMode;
}

/**
 * 🎯 탭 생성 시 필요한 옵션
 */
export interface CreateMainTabOptions {
  /** 📝 탭 제목 */
  title: string;

  /** 🛤️ 라우트 경로 */
  route: string;

  /**
   * ⚙️ 동일한 route에 대해 중복 탭 생성을 허용할지 여부
   *
   * @default false
   */
  allowDuplicateRoute?: boolean;

  /** 🎨 아이콘명 (선택사항, 레거시) */
  icon?: string;

  /** 🎨 React 아이콘 컴포넌트 (lucide-react 등, 선택사항) */
  iconComponent?: StrictReactNode;

  /** 🆔 커스텀 ID (선택사항, 미제공시 자동 생성) */
  id?: MainTabId;

  /** 🎨 클러스터 ID (선택사항, 미제공시 현재 활성 클러스터 자동 감지) */
  clusterId?: string;

  // ========== 🆕 파일 탭 생성 옵션 ==========

  /** 탭 타입 (기본값: 'resource') */
  type?: MainTabType;

  /** 파일 경로 (type='file'일 때 필수) */
  filePath?: string;

  /** 파일 언어 (type='file'일 때 사용, 자동 감지 가능) */
  language?: string;

  /** 파일 내용 (type='file'일 때 필수) */
  content?: string;

  /** 읽기 전용 여부 */
  readOnly?: boolean;
}

/**
 * 🆕 파일 탭 생성 전용 옵션
 */
export interface CreateFileTabOptions {
  /** 파일 경로 (필수) */
  filePath: string;

  /** 파일 내용 (필수) */
  content: string;

  /** 파일 언어 (자동 감지 가능) */
  language?: string;

  /** 읽기 전용 여부 */
  readOnly?: boolean;

  /** 클러스터 ID */
  clusterId?: string;
}

/**
 * 🗄️ 탭 상태 저장을 위한 스토리지 모델 (레거시)
 *
 * @deprecated V2 사용 권장. 이 타입은 마이그레이션 지원용으로만 유지됨.
 */
export interface MainTabStorageState {
  /** 📋 모든 탭 목록 */
  tabs: MainTab[];

  /** 🎯 현재 활성 탭 ID */
  activeTabId?: MainTabId;
}

/**
 * 🗄️ Storage V1: 기존 단일 pane 형식 (Split 기능 이전)
 *
 * @description
 * - Split 기능 추가 이전의 스토리지 형식
 * - 마이그레이션 시 V2로 자동 변환됨
 *
 * 🔄 변경이력: 2025-10-29 - Split 기능 추가를 위한 V1 타입 정의
 */
export interface MainTabStorageStateV1 {
  /** 📋 모든 탭 목록 */
  tabs: MainTab[];

  /** 🎯 현재 활성 탭 ID */
  activeTabId?: MainTabId;
}

/**
 * 🗄️ Storage V2: Split 기능을 지원하는 새로운 형식
 *
 * @description
 * - 에디터 그룹 기반 탭 관리
 * - Split layout 상태 포함
 * - localStorage에 저장 시 version 필드로 V1/V2 구분
 *
 * 📝 주의사항:
 * - version 필드는 마이그레이션 판단용 (1 또는 2)
 * - groups 배열은 최소 1개(left)는 항상 존재해야 함
 * - splitLayout.enabled가 false일 때는 groups[0](left)만 활성
 *
 * 🔄 변경이력: 2025-10-29 - Split 기능 추가를 위한 V2 타입 정의
 */
export interface MainTabStorageStateV2 {
  /** 🔢 스토리지 버전 (마이그레이션 판단용, 값: 2) */
  version: 2;

  /** 📂 에디터 그룹 목록 (Phase 2: 최대 2개) */
  groups: EditorGroup[];

  /** 📐 Split layout 설정 */
  splitLayout: {
    /** ✅ Split 활성화 여부 */
    enabled: boolean;

    /** 📏 좌측 pane 비율 (0.3 ~ 0.7) */
    leftRatio: number;

    /** 🎯 현재 활성 그룹 ID */
    activeGroupId?: EditorGroupId;

    /** ↕️ Split 방향 */
    orientation: SplitDirection;
  };

  /** 🎯 전역 활성 탭 ID (URL 라우팅용, 선택사항) */
  activeTabId?: MainTabId;
}

/**
 * 🎯 목적: 에디터 그룹 (Split pane을 나타내는 논리적 단위)
 *
 * @description
 * - Split pane을 나타내는 그룹 개념
 * - 각 그룹은 독립적인 탭 목록과 활성 탭을 관리
 * - VSCode의 EditorGroup 개념을 DAIVE에 맞게 단순화한 버전
 *
 * 📝 주의사항:
 * - Phase 2에서는 최대 2개 그룹(left, right)만 지원
 * - 각 그룹은 독립적으로 탭을 관리하지만, 클러스터 컨텍스트는 공유
 *
 * 🔄 변경이력: 2025-10-29 - Split 기능 추가를 위한 그룹 모델 정의
 */
export interface EditorGroup {
  /** 🆔 그룹 고유 식별자 ("left" | "right") */
  id: EditorGroupId;

  /** 📋 이 그룹에 속한 탭 목록 */
  tabs: MainTab[];

  /** 🎯 이 그룹의 현재 활성 탭 ID */
  activeTabId?: MainTabId;

  /** ⏰ 그룹 생성 시간 */
  createdAt: Date;

  /** 🔄 마지막 활성화 시간 (LRU 관리용) */
  lastActiveAt: Date;
}

/**
 * 🎭 탭 이벤트 타입 정의
 */
export interface MainTabChangeEvent {
  /** 🆔 변경된 탭 ID */
  tabId: MainTabId;

  /** 📄 변경된 탭 객체 */
  tab: MainTab;

  /** 📄 이전 활성 탭 (있는 경우) */
  previousTab?: MainTab;
}
