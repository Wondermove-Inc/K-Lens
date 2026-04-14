/**
 * 🎯 목적: Kubernetes 리소스 공통 메타데이터 섹션 (shadcn UI 스타일)
 *
 * 표시 필드:
 * - Created: 생성 시간 (Age + LocaleDate)
 * - Labels: Key-Value Badge 목록
 * - Annotations: Annotation Badge 목록 (일부 보기 + Expand/Collapse 기능)
 *
 * 📝 주의사항:
 * - shadcn Table 컴포넌트 사용 (Tailwind 토큰만 사용)
 * - KubeObject 인터페이스 호환 (getName, getLabels, getAnnotations)
 * - hideFields 옵션으로 필드 숨김 가능
 * - Annotations: 기본 3개까지만 표시, 4개 이상일 때 "Expand/Collapse" 버튼 표시
 *
 * 🔄 변경이력:
 * - 2025-11-04: 초기 생성 (OLD KubeObjectMeta → NEW shadcn 스타일 컴포넌트)
 * - 2025-11-18: Annotations 일부 보기 + Expand/Collapse 기능 추가 (기본: 3개까지 표시)
 */

import { KubeObject } from "@skuberplus/kube-object";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";
import { KubeObjectAge } from "../kube-object/age";
import { LocaleDate } from "../locale-date/locale-date";

export interface KubeObjectMetaSectionProps {
  /**
   * Kubernetes 리소스 객체
   */
  object: KubeObject;

  /**
   * 숨길 필드 목록 (예: ["created", "labels", "annotations"])
   */
  hideFields?: string[];
}

/**
 * Kubernetes 리소스 공통 메타데이터 섹션 컴포넌트
 *
 * @param object - Kubernetes 리소스 객체
 * @param hideFields - 숨길 필드 목록
 * @returns shadcn 스타일의 메타데이터 테이블
 */
export function KubeObjectMetaSection({ object, hideFields = [] }: KubeObjectMetaSectionProps) {
  // 🎯 Annotations Expand/Collapse 상태 관리 (기본: false = 일부만 표시)
  const [isAnnotationsExpanded, setIsAnnotationsExpanded] = useState(false);

  // 🎯 필드 숨김 여부 확인
  const isHidden = (field: string) => hideFields.includes(field);

  // 🎯 Labels와 Annotations 데이터 준비
  const labels = object.getLabels();
  const annotations = object.getAnnotations(false); // false = show all annotations (테스트용)

  // 🎯 Annotations 표시 설정 (개수 + 길이 조합)
  const MAX_ANNOTATION_LENGTH = 100; // 각 Annotation 최대 표시 길이
  const INITIAL_DISPLAY_COUNT = 2; // 기본 2개까지 표시

  const displayedAnnotations = isAnnotationsExpanded
    ? annotations // Expand: 전체 표시
    : annotations
        .slice(0, INITIAL_DISPLAY_COUNT) // 먼저 2개까지만
        .map((annotation) =>
          annotation.length > MAX_ANNOTATION_LENGTH ? `${annotation.slice(0, MAX_ANNOTATION_LENGTH)}...` : annotation,
        ); // 각 Annotation을 100자로 자르기

  // 🎯 긴 Annotation 존재 여부 체크
  const hasLongAnnotation = annotations.some((annotation) => annotation.length > MAX_ANNOTATION_LENGTH);

  // 🎯 Expand/Collapse 버튼 표시 여부 (3개 이상 OR 100자 초과 항목 존재)
  const showExpandButton = annotations.length > INITIAL_DISPLAY_COUNT || hasLongAnnotation;

  // 🎯 Annotations Expand/Collapse 토글 함수
  const toggleAnnotations = () => {
    setIsAnnotationsExpanded((prev) => !prev);
  };

  return (
    <Table>
      <TableBody>
        {/* ============================================ */}
        {/* 🕒 Created - 생성 시간 */}
        {/* ============================================ */}
        {!isHidden("created") && object.metadata.creationTimestamp && (
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Created</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px] align-top">
              <span className="text-foreground text-sm">
                <KubeObjectAge object={object} compact={false} withTooltip={false} /> ago{" "}
                <LocaleDate date={object.metadata.creationTimestamp} />
              </span>
            </TableCell>
          </TableRow>
        )}

        {/* ============================================ */}
        {/* 🏷️ Labels - Key-Value Badge 목록 */}
        {/* ============================================ */}
        {!isHidden("labels") && Object.keys(labels).length > 0 && (
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Labels</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <div className="flex flex-wrap gap-1">
                {Object.entries(labels).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </TableCell>
          </TableRow>
        )}

        {/* ============================================ */}
        {/* 📝 Annotations - Annotation Badge 목록 (일부 보기 + Expand/Collapse) */}
        {/* ============================================ */}
        {!isHidden("annotations") && annotations.length > 0 && (
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Annotations</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <div className="flex flex-col gap-2">
                {/* 🎯 Annotations Badge 목록 (Collapse: 100자 자르기, Expand: 줄바꿈) */}
                <div className="flex flex-wrap gap-1">
                  {displayedAnnotations.map((annotation) => (
                    <Badge
                      key={annotation}
                      variant="outline"
                      className={`text-xs ${isAnnotationsExpanded ? "break-all whitespace-normal" : ""}`}
                    >
                      {annotation}
                    </Badge>
                  ))}
                </div>

                {/* 🎯 Expand/Collapse 버튼 (4개 이상일 때만 표시) */}
                {showExpandButton && (
                  <div className="flex justify-start">
                    <Button variant="ghost" size="sm" onClick={toggleAnnotations} className="h-8 gap-1 px-2">
                      {isAnnotationsExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          <span className="text-xs">Collapse</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          <span className="text-xs">Expand</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
