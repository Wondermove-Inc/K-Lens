/**
 * 🎯 목적: 파일 에디터용 마크다운 프리뷰 컴포넌트
 * 📝 기능:
 *   - react-markdown + remark-gfm으로 GFM 지원
 *   - 코드 블록 구문 강조 (react-syntax-highlighter + VSCode 테마)
 *   - Mermaid 코드 블록 → MermaidRenderer로 렌더링
 *   - 테이블, 체크리스트 렌더링 (content-based width)
 *   - 외부 링크 새 탭에서 열기 (Electron shell)
 *   - 이미지 렌더링
 *   - shadcn 스타일링
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-28: 테이블 너비 content-based로 변경, 코드 구문 강조 추가
 * @module markdown-preview/markdown-preview
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { shell } from "electron";
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";
import { MermaidRenderer } from "../ai-chat/mermaid-renderer";

import type { Components, ExtraProps } from "react-markdown";

/**
 * MarkdownPreview Props
 */
export interface MarkdownPreviewProps {
  /** 마크다운 내용 */
  content: string;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 코드 블록에서 언어 추출
 */
function extractLanguage(className?: string): string | undefined {
  if (!className) return undefined;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : undefined;
}

/**
 * Mermaid 코드인지 확인
 */
function isMermaidCode(language?: string): boolean {
  return language === "mermaid";
}

/**
 * 체크박스 리스트 아이템인지 확인
 */
function isCheckboxItem(children: React.ReactNode): boolean {
  if (!React.Children.count(children)) return false;
  const first = React.Children.toArray(children)[0];
  return React.isValidElement(first) && first.type === "input";
}

/**
 * 마크다운 컴포넌트 매핑 (shadcn 스타일)
 */
function createMarkdownComponents(): Components {
  return {
    // ============================================
    // 🎯 Code Block: 인라인 코드만 처리 (블록 코드는 pre에서 처리)
    // ============================================
    code: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"code"> & ExtraProps) => {
      // 코드 블록 내부 코드는 pre에서 처리하므로 여기서는 pass-through
      if (className?.startsWith("language-")) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      // 인라인 코드
      return (
        <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
          {children}
        </code>
      );
    },

    // ============================================
    // 🎯 Pre: 코드 블록 (SyntaxHighlighter로 구문 강조)
    // ============================================
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre"> & ExtraProps) => {
      // 자식 code 요소에서 언어와 코드 추출
      if (React.isValidElement(children)) {
        const codeElement = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
        const language = extractLanguage(codeElement.props?.className);
        const codeString = String(codeElement.props?.children || "").replace(/\n$/, "");

        // Mermaid 다이어그램
        if (isMermaidCode(language)) {
          return <MermaidRenderer code={codeString} />;
        }

        // 구문 강조 코드 블록
        return (
          <div className="my-4 rounded-[10px] border overflow-hidden" data-syntax-highlight="true">
            <SyntaxHighlighter
              style={oneDark}
              language={language || "text"}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: "1rem",
                background: "var(--syntax-highlight-bg)", // THEME-020: CSS 변수 사용
                fontSize: "0.875rem",
                lineHeight: "1.5rem",
                borderRadius: "10px",
              }}
              codeTagProps={{
                style: {
                  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
                },
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      // fallback: 일반 pre
      return (
        <div className="bg-muted/30 flex w-full flex-col rounded-[10px] border p-4 my-4">
          <pre
            className="w-full text-left font-mono text-sm leading-6 overflow-auto whitespace-pre-wrap break-words"
            {...props}
          >
            {children}
          </pre>
        </div>
      );
    },

    // ============================================
    // 🎯 Table: shadcn Table 컴포넌트 (content-based width)
    // ============================================
    table: ({ children }: React.ComponentPropsWithoutRef<"table"> & ExtraProps) => (
      <div className="my-4 overflow-x-auto inline-block max-w-full">
        <Table className="w-auto border-collapse">{children}</Table>
      </div>
    ),
    thead: ({ children }: React.ComponentPropsWithoutRef<"thead"> & ExtraProps) => (
      <TableHeader className="bg-muted">{children}</TableHeader>
    ),
    tbody: ({ children }: React.ComponentPropsWithoutRef<"tbody"> & ExtraProps) => <TableBody>{children}</TableBody>,
    tr: ({ children }: React.ComponentPropsWithoutRef<"tr"> & ExtraProps) => (
      <TableRow className="hover:bg-muted/50 border-b transition-colors">{children}</TableRow>
    ),
    th: ({ children }: React.ComponentPropsWithoutRef<"th"> & ExtraProps) => (
      <TableHead className="px-3 py-2 font-medium text-foreground">{children}</TableHead>
    ),
    td: ({ children }: React.ComponentPropsWithoutRef<"td"> & ExtraProps) => (
      <TableCell className="px-3 py-2 border-border border-b text-foreground">{children}</TableCell>
    ),

    // ============================================
    // 🎯 Link: 외부 링크 Electron shell 처리
    // ============================================
    a: ({ href, children }: React.ComponentPropsWithoutRef<"a"> & ExtraProps) => {
      const safeHref = href ?? "";
      const isHttpLink = /^https?:\/\//i.test(safeHref);

      const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!safeHref) {
          event.preventDefault();
          return;
        }

        if (isHttpLink) {
          event.preventDefault();
          void shell.openExternal(safeHref).catch((error) => {
            console.error("[MarkdownPreview] 외부 링크 열기 실패:", error);
          });
        }
      };

      return (
        <a
          href={safeHref}
          target="_blank"
          rel="noreferrer"
          onClick={handleClick}
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {children}
        </a>
      );
    },

    // ============================================
    // 🎯 Blockquote: shadcn 스타일
    // ============================================
    blockquote: ({ children }: React.ComponentPropsWithoutRef<"blockquote"> & ExtraProps) => (
      <blockquote className="border-l-4 border-border bg-muted/30 pl-4 py-2 my-4 text-muted-foreground italic">
        {children}
      </blockquote>
    ),

    // ============================================
    // 🎯 Headers: shadcn 스타일
    // ============================================
    h1: ({ children }: React.ComponentPropsWithoutRef<"h1"> & ExtraProps) => (
      <h1 className="text-2xl font-semibold text-foreground mt-6 mb-4 pb-2 border-b border-border">{children}</h1>
    ),
    h2: ({ children }: React.ComponentPropsWithoutRef<"h2"> & ExtraProps) => (
      <h2 className="text-xl font-semibold text-foreground mt-5 mb-3 pb-2 border-b border-border">{children}</h2>
    ),
    h3: ({ children }: React.ComponentPropsWithoutRef<"h3"> & ExtraProps) => (
      <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h3>
    ),
    h4: ({ children }: React.ComponentPropsWithoutRef<"h4"> & ExtraProps) => (
      <h4 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h4>
    ),
    h5: ({ children }: React.ComponentPropsWithoutRef<"h5"> & ExtraProps) => (
      <h5 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h5>
    ),
    h6: ({ children }: React.ComponentPropsWithoutRef<"h6"> & ExtraProps) => (
      <h6 className="text-sm font-medium text-muted-foreground mt-2 mb-1">{children}</h6>
    ),

    // ============================================
    // 🎯 Lists: shadcn 스타일 + 체크리스트 지원
    // ============================================
    ul: ({ children }: React.ComponentPropsWithoutRef<"ul"> & ExtraProps) => (
      <ul className="list-disc pl-6 my-2 text-foreground">{children}</ul>
    ),
    ol: ({ children }: React.ComponentPropsWithoutRef<"ol"> & ExtraProps) => (
      <ol className="list-decimal pl-6 my-2 text-foreground">{children}</ol>
    ),
    li: ({ children }: React.ComponentPropsWithoutRef<"li"> & ExtraProps) => {
      // GFM 체크박스 리스트 지원
      if (isCheckboxItem(children)) {
        return <li className="my-1 list-none flex items-start gap-2">{children}</li>;
      }
      return <li className="my-1">{children}</li>;
    },

    // ============================================
    // 🎯 체크박스 Input (GFM Task List)
    // ============================================
    input: ({ type, checked, ...props }: React.ComponentPropsWithoutRef<"input"> & ExtraProps) => {
      if (type === "checkbox") {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mt-1 h-4 w-4 rounded border-border bg-background accent-primary"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },

    // ============================================
    // 🎯 Paragraph & Others
    // ============================================
    p: ({ children }: React.ComponentPropsWithoutRef<"p"> & ExtraProps) => (
      <p className="my-2 text-foreground leading-relaxed">{children}</p>
    ),
    hr: () => <hr className="my-6 border-border" />,
    strong: ({ children }: React.ComponentPropsWithoutRef<"strong"> & ExtraProps) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }: React.ComponentPropsWithoutRef<"em"> & ExtraProps) => <em className="italic">{children}</em>,

    // ============================================
    // 🎯 Image: 반응형 이미지
    // ============================================
    img: ({ src, alt }: React.ComponentPropsWithoutRef<"img"> & ExtraProps) => (
      <img src={src} alt={alt ?? ""} className="max-w-full h-auto rounded my-2" loading="lazy" />
    ),
  };
}

/**
 * 파일 에디터용 마크다운 프리뷰 컴포넌트
 *
 * @description
 * - react-markdown + remark-gfm 사용
 * - Mermaid 코드 블록을 MermaidRenderer로 렌더링
 * - shadcn 스타일 적용
 * - 외부 링크 Electron shell 처리
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  // 컴포넌트 매핑 메모이제이션
  const components = useMemo(() => createMarkdownComponents(), []);

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

MarkdownPreview.displayName = "MarkdownPreview";
