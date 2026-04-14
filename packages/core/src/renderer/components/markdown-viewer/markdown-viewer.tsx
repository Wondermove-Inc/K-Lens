/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Markdown을 shadcn 스타일로 렌더링하는 컴포넌트
 * 📝 주의사항:
 *   - react-markdown + remark-gfm 사용
 *   - shadcn Table 컴포넌트로 테이블 렌더링
 *   - Electron shell.openExternal로 외부 링크 처리
 * 🔄 변경이력:
 *   - 2025-12-01: marked + DOMPurify에서 react-markdown으로 마이그레이션
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { cssNames } from "@skuberplus/utilities";
import { shell } from "electron";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Components } from "react-markdown";

export interface MarkdownViewerProps {
  markdown: string;
  className?: string;
}

/**
 * 🎯 목적: shadcn 스타일 Markdown 컴포넌트 매핑
 */
const markdownComponents: Components = {
  // ============================================
  // 🎯 Inline Code: shadcn 스타일
  // ============================================
  code: ({ children, className, ...props }) => {
    // className에 language-* 가 있으면 code block 내부 코드
    const isCodeBlock = className?.startsWith("language-");

    if (isCodeBlock) {
      return (
        <code className="text-muted-foreground font-mono text-sm leading-6" {...props}>
          {children}
        </code>
      );
    }

    // Inline code
    return (
      <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
        {children}
      </code>
    );
  },

  // ============================================
  // 🎯 Code Block: shadcn 스타일 wrapper
  // ============================================
  pre: ({ children, ...props }) => (
    <div className="bg-muted/50 flex w-full flex-col rounded-[10px] border border-border p-4 my-4">
      <pre
        className="text-muted-foreground w-full text-left font-mono text-sm leading-6 overflow-auto whitespace-pre-wrap break-words"
        {...props}
      >
        {children}
      </pre>
    </div>
  ),

  // ============================================
  // 🎯 Table: shadcn Table 컴포넌트
  // ============================================
  table: ({ children }) => <Table className="my-4 w-full">{children}</Table>,
  thead: ({ children }) => <TableHeader className="bg-muted">{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow className="hover:bg-muted/50 border-b transition-colors">{children}</TableRow>,
  th: ({ children }) => <TableHead className="px-3 py-2 font-medium text-foreground">{children}</TableHead>,
  td: ({ children }) => <TableCell className="px-3 py-2 border-border border-b text-foreground">{children}</TableCell>,

  // ============================================
  // 🎯 Link: 외부 링크 Electron shell 처리
  // ============================================
  a: ({ href, children }) => {
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
          console.error("[MarkdownViewer] 외부 링크 열기 실패:", error);
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
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border bg-muted/50 pl-4 py-2 my-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  // ============================================
  // 🎯 Headers: shadcn 스타일
  // ============================================
  h1: ({ children }) => (
    <h1 className="text-2xl font-semibold text-foreground mt-6 mb-4 pb-2 border-b border-border">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-foreground mt-5 mb-3 pb-2 border-b border-border">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h5>,
  h6: ({ children }) => <h6 className="text-sm font-medium text-muted-foreground mt-2 mb-1">{children}</h6>,

  // ============================================
  // 🎯 Lists: shadcn 스타일
  // ============================================
  ul: ({ children }) => <ul className="list-disc pl-6 my-2 text-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 my-2 text-foreground">{children}</ol>,
  li: ({ children }) => <li className="my-1 text-foreground">{children}</li>,

  // ============================================
  // 🎯 Paragraph & Others
  // ============================================
  p: ({ children }) => <p className="my-2 text-foreground leading-7">{children}</p>,
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  img: ({ src, alt }) => <img src={src} alt={alt} className="max-w-full h-auto rounded my-2" />,
};

/**
 * 🎯 목적: Markdown을 shadcn 스타일로 렌더링하는 컴포넌트
 *
 * @param markdown - 렌더링할 Markdown 문자열
 * @param className - 추가 CSS 클래스
 */
export function MarkdownViewer({ markdown, className }: MarkdownViewerProps) {
  return (
    <div className={cssNames("prose prose-sm max-w-none antialiased", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
