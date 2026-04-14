/**
 * 🎯 목적: Tool 승인 UI에 Diff 통합 컴포넌트
 * 02: Tool 승인 UI에 Diff 통합
 *
 * 📝 주요 기능:
 * - 파일 수정 Tool (FILE_EDIT): DiffViewer로 변경 사항 표시
 * - 파일 생성 Tool (FILE_CREATE): 새 파일 배지 + 내용 미리보기
 * - AI 파일 쓰기 Tool (FILE_WRITE): AI 파일 시스템 저장 (diff/new 지원)
 * - kubectl Tool: YAML 표시 (기존 방식)
 * - Bash Tool: 명령어 표시
 *
 * @packageDocumentation
 */

import { Check, Cloud, FileCode, FolderOpen, HardDrive, Terminal, X } from "lucide-react";
import React, { useCallback } from "react";
import { ToolApprovalType, type ToolApprovalWithDiff } from "../../../features/ai-assistant/common/tool-approval-types";
import { cn } from "../../lib/utils";
import { Button } from "../shadcn-ui/button";
import { Card } from "../shadcn-ui/card";
import { DiffViewer } from "./diff-viewer";

// ============================================
// 🎯 Props 인터페이스
// ============================================

/**
 * ToolApprovalDiff 컴포넌트 Props
 */
export interface ToolApprovalDiffProps {
  /** 승인 요청 정보 */
  approval: ToolApprovalWithDiff;

  /** 승인 콜백 */
  onApprove: (id: string) => void;

  /** 거부 콜백 */
  onReject: (id: string) => void;

  /** 제출 중 여부 */
  isSubmitting?: boolean;

  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 🎯 Tool 아이콘 컴포넌트
// ============================================

/**
 * Tool 유형에 따른 아이콘 반환
 *
 * @param type - Tool 유형
 * @returns 아이콘 컴포넌트
 */
function getToolIcon(type: ToolApprovalType): React.ReactNode {
  switch (type) {
    case ToolApprovalType.FILE_EDIT:
    case ToolApprovalType.FILE_CREATE:
    case ToolApprovalType.FILE_WRITE:
    case ToolApprovalType.FILE_DELETE:
      return <FileCode className="h-4 w-4" />;
    case ToolApprovalType.KUBECTL:
      return <Cloud className="h-4 w-4" />;
    case ToolApprovalType.COMMAND:
      return <Terminal className="h-4 w-4" />;
    default:
      return <FileCode className="h-4 w-4" />;
  }
}

/**
 * Tool 유형에 따른 배지 텍스트 반환
 *
 * @param type - Tool 유형
 * @returns 배지 텍스트
 */
function getToolBadge(type: ToolApprovalType): string | null {
  switch (type) {
    case ToolApprovalType.FILE_CREATE:
      return "New File";
    case ToolApprovalType.FILE_WRITE:
      return "Save File";
    case ToolApprovalType.FILE_DELETE:
      return "Delete";
    case ToolApprovalType.KUBECTL:
      return "Kubernetes";
    case ToolApprovalType.COMMAND:
      return "Command";
    default:
      return null;
  }
}

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 🎯 파일 크기 포맷팅 유틸리티
 *
 * @param bytes - 바이트 수
 * @returns 읽기 좋은 파일 크기 문자열 (예: "2.3 KB")
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * 🎯 목적: YAML stdin에서 리소스 이름 추출
 *
 * @param stdin - YAML 문자열
 * @returns "kind/name.yaml" 형태의 리소스 이름
 *
 * 📝 주의사항:
 * - metadata.name과 kind를 추출하여 조합
 * - 실패 시 null 반환
 */
function extractResourceName(stdin?: string): string | null {
  if (!stdin) return null;

  try {
    // 간단한 정규식으로 kind와 name 추출 (YAML 파서 의존성 없이)
    const kindMatch = stdin.match(/^kind:\s*(\w+)/m);
    const nameMatch = stdin.match(/^\s{2,}name:\s*(\S+)/m);

    if (kindMatch && nameMatch) {
      const kind = kindMatch[1].toLowerCase();
      const name = nameMatch[1];
      return `${kind}/${name}.yaml`;
    }

    if (kindMatch) {
      return `${kindMatch[1].toLowerCase()}.yaml`;
    }
  } catch {
    // 파싱 실패 시 null
  }

  return null;
}

// ============================================
// 🎯 콘텐츠 렌더러 컴포넌트
// ============================================

/**
 * 🎯 목적: 새 리소스 생성 시 YAML 표시
 *
 * 📝 주의사항:
 * - 모든 라인이 추가(+)로 표시되는 Diff 형식으로 변환
 * - DiffViewer를 사용하여 일관된 UI 제공
 *
 * 🔄 변경이력:
 * - 2026-01-07: 초기 생성 (SOLVE-UI-001)
 */
const NewResourceYamlDisplay: React.FC<{ stdin: string }> = ({ stdin }) => {
  // 리소스 이름 추출
  const resourceName = extractResourceName(stdin) ?? "new-resource.yaml";

  // 새 리소스 생성 Diff 형식 변환 (모든 라인 추가)
  const lines = stdin.split("\n");
  const newResourceDiff = `--- /dev/null
+++ b/${resourceName}
@@ -0,0 +1,${lines.length} @@
${lines.map((line) => `+${line}`).join("\n")}`;

  return (
    <DiffViewer
      diff={newResourceDiff}
      fileName={resourceName}
      showLineNumbers
      showStatistics
      maxHeight="300px"
      defaultExpanded
    />
  );
};

/**
 * 파일 수정 콘텐츠 렌더러
 */
const FileEditContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  if (!approval.diff || !approval.filePath) {
    return null;
  }

  return (
    <DiffViewer
      diff={approval.diff}
      fileName={approval.filePath}
      showLineNumbers
      showStatistics
      maxHeight="300px"
      defaultExpanded
    />
  );
};

/**
 * 파일 생성 콘텐츠 렌더러
 */
const FileCreateContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  // 새 파일 생성 시 Diff 형태로 표시 (모두 추가)
  if (approval.newContent && approval.filePath) {
    const lines = approval.newContent.split("\n");
    const newFileDiff = `--- /dev/null
+++ b${approval.filePath}
@@ -0,0 +1,${lines.length} @@
${lines.map((line) => `+${line}`).join("\n")}`;

    return (
      <DiffViewer
        diff={newFileDiff}
        fileName={approval.filePath}
        showLineNumbers
        showStatistics
        maxHeight="300px"
        defaultExpanded
      />
    );
  }

  return null;
};

/**
 * 🎯 파일 메타데이터 표시 컴포넌트 (PHASE 4 - UX Improvement)
 *
 * 📝 save_to_cluster 승인 시 추가 컨텍스트 정보 표시:
 * - 클러스터 이름
 * - 폴더 타입
 * - 파일명
 * - 파일 크기
 */
const FileMetadataDisplay: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  const metadata = approval.metadata;

  // metadata가 없으면 표시하지 않음 (하위 호환성)
  if (!metadata) return null;

  // 표시할 정보가 하나도 없으면 표시하지 않음
  const hasContent = metadata.clusterName || metadata.folderType || metadata.filename || metadata.filesize;
  if (!hasContent) return null;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 mb-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {/* 클러스터 이름 */}
        {metadata.clusterName && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{metadata.clusterName}</span>
          </div>
        )}

        {/* 폴더 타입 */}
        {metadata.folderType && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{metadata.folderType}</span>
          </div>
        )}

        {/* 파일 크기 */}
        {metadata.filesize !== undefined && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatFileSize(metadata.filesize)}</span>
          </div>
        )}

        {/* 문서 타입 (신뢰도 포함) - 🎯 THEME-024 */}
        {metadata.documentType && (
          <div className="text-muted-foreground">
            <span className="px-1.5 py-0.5 text-xs rounded bg-badge-info">
              {metadata.documentType}
              {metadata.confidence !== undefined && metadata.confidence >= 0.7 && " ✓"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 🎯 AI 파일 쓰기 콘텐츠 렌더러 (FILE_WRITE)
 *
 * 📝 AI 파일 시스템에서 사용:
 * - oldContent가 있으면 diff 표시 (덮어쓰기)
 * - oldContent가 없으면 새 파일 생성 형태로 표시
 * - 📝 PHASE 4: metadata가 있으면 추가 컨텍스트 정보 표시
 */
const FileWriteContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  // diff가 있으면 DiffViewer 사용
  if (approval.diff && approval.filePath) {
    return (
      <div className="flex flex-col">
        {/* 🆕 PHASE 4: 메타데이터 표시 */}
        <FileMetadataDisplay approval={approval} />

        <DiffViewer
          diff={approval.diff}
          fileName={approval.filePath}
          showLineNumbers
          showStatistics
          maxHeight="300px"
          defaultExpanded
        />
      </div>
    );
  }

  // 새 파일 생성 시 Diff 형태로 표시 (모두 추가)
  if (approval.newContent && approval.filePath) {
    const lines = approval.newContent.split("\n");
    const newFileDiff = `--- /dev/null
+++ b${approval.filePath}
@@ -0,0 +1,${lines.length} @@
${lines.map((line) => `+${line}`).join("\n")}`;

    return (
      <div className="flex flex-col">
        {/* 🆕 PHASE 4: 메타데이터 표시 */}
        <FileMetadataDisplay approval={approval} />

        <DiffViewer
          diff={newFileDiff}
          fileName={approval.filePath}
          showLineNumbers
          showStatistics
          maxHeight="300px"
          defaultExpanded
        />
      </div>
    );
  }

  return null;
};

/**
 * 🎯 목적: kubectl 콘텐츠 렌더러
 *
 * 📝 주의사항:
 * - approval.diff가 있으면 DiffViewer로 변경 사항 시각화
 * - diff가 없으면 기존 stdin(YAML) 표시 방식 유지 (새 리소스 생성)
 *
 * 🔄 변경이력:
 * - 2026-01-07: approval.diff 존재 시 DiffViewer 사용하도록 개선 (SOLVE-UI-001)
 */
const KubectlContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  // 🎯 diff가 있으면 DiffViewer로 변경 사항 시각화
  if (approval.diff) {
    // 리소스 이름 추출 (kubectl 명령어 또는 stdin에서)
    const resourceName = approval.resourceName ?? extractResourceName(approval.stdin) ?? "kubernetes-resource.yaml";

    return (
      <div className="flex flex-col gap-2">
        {/* 명령어 표시 (선택적) */}
        {approval.command && (
          <div className="rounded-md border border-border bg-secondary/40 p-2">
            <pre className="text-xs font-mono text-foreground/90">{approval.command}</pre>
          </div>
        )}

        {/* Diff 뷰어 */}
        <DiffViewer
          diff={approval.diff}
          fileName={resourceName}
          showLineNumbers
          showStatistics
          maxHeight="300px"
          defaultExpanded
        />
      </div>
    );
  }

  // 🎯 diff가 없으면 기존 방식 (새 리소스 생성 또는 단순 명령어)
  return (
    <div className="flex flex-col gap-2">
      {/* 명령어 */}
      {approval.command && (
        <div className="rounded-md border border-border bg-secondary/40 p-2">
          <pre className="text-xs font-mono text-foreground/90">{approval.command}</pre>
        </div>
      )}

      {/* YAML 내용 (새 리소스 생성 시) */}
      {approval.stdin && <NewResourceYamlDisplay stdin={approval.stdin} />}
    </div>
  );
};

/**
 * Bash 콘텐츠 렌더러
 */
const BashContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2">
      <pre className="text-xs font-mono text-foreground/90">{approval.command}</pre>
    </div>
  );
};

/**
 * 일반 콘텐츠 렌더러
 */
const GenericContent: React.FC<{ approval: ToolApprovalWithDiff }> = ({ approval }) => {
  if (!approval.toolInput) {
    return null;
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2 max-h-48 overflow-y-auto">
      <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap">
        {JSON.stringify(approval.toolInput, null, 2)}
      </pre>
    </div>
  );
};

// ============================================
// 🎯 ToolApprovalDiff 메인 컴포넌트
// ============================================

/**
 * Tool 승인 Diff 컴포넌트
 *
 * 📝 Tool 유형에 따라 적절한 UI 표시:
 * - FILE_EDIT: DiffViewer로 변경 사항 시각화
 * - FILE_CREATE: 새 파일 배지 + 전체 내용 표시
 * - FILE_WRITE: AI 파일 시스템 저장 (diff/new 지원)
 * - KUBECTL: 명령어 + YAML 표시
 * - COMMAND: 명령어 표시
 *
 * @param props - ToolApprovalDiffProps
 *
 * @example
 * ```tsx
 * <ToolApprovalDiff
 *   approval={fileEditApproval}
 *   onApprove={(id) => handleApprove(id)}
 *   onReject={(id) => handleReject(id)}
 * />
 * ```
 */
export const ToolApprovalDiff: React.FC<ToolApprovalDiffProps> = ({
  approval,
  onApprove,
  onReject,
  isSubmitting = false,
  className,
}) => {
  // 승인 핸들러
  const handleApprove = useCallback(() => {
    if (!isSubmitting) {
      onApprove(approval.id);
    }
  }, [approval.id, isSubmitting, onApprove]);

  // 거부 핸들러
  const handleReject = useCallback(() => {
    if (!isSubmitting) {
      onReject(approval.id);
    }
  }, [approval.id, isSubmitting, onReject]);

  // 배지 텍스트
  const badge = getToolBadge(approval.toolType);

  // 콘텐츠 렌더링
  const renderContent = () => {
    switch (approval.toolType) {
      case ToolApprovalType.FILE_EDIT:
        return <FileEditContent approval={approval} />;
      case ToolApprovalType.FILE_CREATE:
        return <FileCreateContent approval={approval} />;
      case ToolApprovalType.FILE_WRITE:
        return <FileWriteContent approval={approval} />;
      case ToolApprovalType.KUBECTL:
        return <KubectlContent approval={approval} />;
      case ToolApprovalType.COMMAND:
        return <BashContent approval={approval} />;
      default:
        return <GenericContent approval={approval} />;
    }
  };

  return (
    <Card
      className={cn("border-border bg-background flex flex-col gap-4 border p-4 overflow-hidden", className)}
      role="region"
      aria-label={`Tool 승인 요청: ${approval.toolName}`}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          {/* Tool 정보 */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{getToolIcon(approval.toolType)}</span>
            <span className="text-sm font-semibold text-foreground">{approval.toolName}</span>

            {/* 배지 */}
            {badge && <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">{badge}</span>}
          </div>

          {/* 설명 */}
          <p className="text-xs text-muted-foreground">{approval.description}</p>

          {/* 파일 경로 */}
          {approval.filePath && <span className="text-xs font-mono text-muted-foreground/80">{approval.filePath}</span>}
        </div>

        {/* Approval required badge - 🎯 THEME-024: Semantic color */}
        <span className="text-xs text-status-warning flex-shrink-0">Approval required</span>
      </div>

      {/* 콘텐츠 */}
      <div className="min-w-0">{renderContent()}</div>

      {/* 버튼 */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="default" disabled={isSubmitting} onClick={handleApprove} className="gap-1">
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>

        <Button size="sm" variant="outline" disabled={isSubmitting} onClick={handleReject} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </Card>
  );
};

ToolApprovalDiff.displayName = "ToolApprovalDiff";

export default ToolApprovalDiff;
