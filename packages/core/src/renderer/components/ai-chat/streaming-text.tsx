/**
 * StreamingText 컴포넌트
 * 01: 스트리밍 텍스트 UI 구현
 *
 * 주요 기능:
 * - 스트리밍 중인 텍스트를 마크다운으로 렌더링
 * - 스트리밍 중 커서 깜빡임 애니메이션
 * - 자동 스크롤 (하단으로)
 * - 성능 최적화 (React.memo, useMemo)
 *
 * 변경이력:
 * - 2026-01-18: 수정 - llm-ui 제거, ReactMarkdown 복원
 *
 * @packageDocumentation
 */

import React, { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import { MermaidRenderer } from "./mermaid-renderer";

import type { Components } from "react-markdown";

// ============================================
// 타입 정의
// ============================================

/**
 * StreamingText 컴포넌트 props
 */
export interface StreamingTextProps {
  /** 표시할 콘텐츠 */
  content: string;
  /** 스트리밍 진행 중 여부 */
  isStreaming: boolean;
  /** 에러 객체 */
  error?: Error | null;
  /** 취소 여부 */
  isCancelled?: boolean;
  /** 자동 스크롤 활성화 (기본값: true) */
  autoScroll?: boolean;
  /** 상태 표시 여부 */
  showStatus?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 마크다운 컴포넌트 설정
// ============================================

/**
 * shadcn 스타일 마크다운 컴포넌트 매핑
 */
const markdownComponents: Components = {
  // 인라인 코드
  code: ({ children, className, ...props }) => {
    const isCodeBlock = className?.startsWith("language-");

    if (isCodeBlock) {
      return (
        <code className="text-muted-foreground font-mono text-sm" {...props}>
          {children}
        </code>
      );
    }

    // 인라인 코드 스타일 - 배경색 제거, 볼드체로 강조
    return (
      <code className="font-semibold" {...props}>
        {children}
      </code>
    );
  },

  // 코드 블록 (Mermaid 다이어그램 지원)
  pre: ({ children, ...props }) => {
    // Mermaid 코드 블록 감지 및 렌더링
    // ReactMarkdown에서 pre > code 구조로 전달됨
    if (React.isValidElement(children)) {
      const codeElement = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      const className = codeElement.props?.className || "";

      // language-mermaid 클래스 감지
      if (className.includes("language-mermaid")) {
        const codeContent = String(codeElement.props?.children || "");
        return <MermaidRenderer code={codeContent} />;
      }
    }

    // 일반 코드 블록
    return (
      <div className="bg-muted/30 rounded-lg border p-3 my-2 overflow-x-auto">
        <pre className="text-muted-foreground font-mono text-sm whitespace-pre-wrap" {...props}>
          {children}
        </pre>
      </div>
    );
  },

  // 링크
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      className="text-primary underline hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),

  // 강조
  strong: ({ children, ...props }) => (
    <strong className="font-bold" {...props}>
      {children}
    </strong>
  ),

  // 기울임
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),

  // 리스트
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-4 my-1" {...props}>
      {children}
    </ul>
  ),

  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-4 my-1" {...props}>
      {children}
    </ol>
  ),

  li: ({ children, ...props }) => (
    <li className="my-0.5" {...props}>
      {children}
    </li>
  ),

  // 헤딩
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold mt-3 mb-2" {...props}>
      {children}
    </h1>
  ),

  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-bold mt-2 mb-1" {...props}>
      {children}
    </h2>
  ),

  h3: ({ children, ...props }) => (
    <h3 className="text-base font-bold mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),

  // 문단
  p: ({ children, ...props }) => (
    <p className="my-1" {...props}>
      {children}
    </p>
  ),

  // 테이블 스타일
  table: ({ children, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),

  thead: ({ children, ...props }) => (
    <thead className="border-b border-border bg-muted/50" {...props}>
      {children}
    </thead>
  ),

  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border" {...props}>
      {children}
    </tbody>
  ),

  tr: ({ children, ...props }) => (
    <tr className="hover:bg-muted/30 transition-colors" {...props}>
      {children}
    </tr>
  ),

  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left font-semibold text-foreground" {...props}>
      {children}
    </th>
  ),

  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-muted-foreground" {...props}>
      {children}
    </td>
  ),
};

// ============================================
// 하위 컴포넌트
// ============================================

/**
 * 스트리밍 커서 컴포넌트
 */
const StreamingCursor: React.FC = () => (
  <span
    data-testid="streaming-cursor"
    className="inline-block w-2 h-4 bg-foreground animate-blink ml-0.5"
    aria-hidden="true"
  />
);

/**
 * 에러 표시 컴포넌트
 */
const StreamingError: React.FC<{ error: Error }> = ({ error }) => (
  <div data-testid="streaming-error" className="mt-2 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
    오류: {error.message}
  </div>
);

/**
 * 취소 표시 컴포넌트
 */
const StreamingCancelled: React.FC = () => (
  <div data-testid="streaming-cancelled" className="mt-2 text-muted-foreground text-sm italic">
    응답이 취소되었습니다
  </div>
);

/**
 * 상태 표시 컴포넌트
 */
const StreamingStatus: React.FC<{ content: string }> = ({ content }) => {
  const tokenCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div data-testid="streaming-status" className="mt-2 text-xs text-muted-foreground">
      {tokenCount} 토큰
    </div>
  );
};

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * StreamingText 컴포넌트
 *
 * 기능:
 * - 스트리밍 중인 LLM 응답을 실시간 렌더링
 * - 마크다운 지원 (코드 블록, 리스트, 링크 등)
 * - 커서 깜빡임 애니메이션
 * - 자동 스크롤
 */
export const StreamingText = React.memo(function StreamingText({
  content,
  isStreaming,
  error = null,
  isCancelled = false,
  autoScroll = true,
  showStatus = false,
  className,
}: StreamingTextProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================
  // 자동 스크롤 효과
  // ============================================

  useEffect(() => {
    if (autoScroll && isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming, autoScroll]);

  // ============================================
  // 마크다운 렌더링 (메모이제이션)
  // ============================================

  const renderedContent = useMemo(() => {
    if (!content) {
      return null;
    }

    // 스트리밍 중 trailing whitespace 제거
    // Claude/Gemini 응답에 trailing newline이 있으면 커서가 텍스트 아래에 표시됨
    // 표시용으로만 trimEnd() 적용 (원본 content는 유지)
    const displayContent = isStreaming ? content.trimEnd() : content;

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {displayContent}
      </ReactMarkdown>
    );
  }, [content, isStreaming]);

  // ============================================
  // 렌더링
  // ============================================

  return (
    <div
      ref={containerRef}
      data-testid="streaming-text"
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
    >
      {/* 콘텐츠 */}
      {renderedContent}

      {/* 스트리밍 커서 */}
      {isStreaming && <StreamingCursor />}

      {/* 에러 표시 */}
      {error && <StreamingError error={error} />}

      {/* 취소 표시 */}
      {isCancelled && !error && <StreamingCancelled />}

      {/* 상태 표시 */}
      {showStatus && isStreaming && <StreamingStatus content={content} />}
    </div>
  );
});

StreamingText.displayName = "StreamingText";
