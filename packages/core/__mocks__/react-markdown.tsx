/**
 * react-markdown 모킹
 *
 * 🎯 목적: Jest 테스트 시 react-markdown ESM 문제 해결
 *
 * 문제: react-markdown 패키지가 ESM export를 사용하며
 * Jest에서 파싱 오류 발생 (Unexpected token 'export')
 *
 * 해결: Markdown을 단순 렌더링하는 Mock 컴포넌트 제공
 */
import * as React from "react";

export interface ReactMarkdownOptions {
  children: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  className?: string;
  components?: Record<string, React.ComponentType<unknown>>;
}

/**
 * ReactMarkdown Mock
 * 📝 마크다운 콘텐츠를 pre 태그로 단순 렌더링
 *
 * ⚠️ remarkPlugins, rehypePlugins, components 등 React DOM에서
 * 인식하지 못하는 props는 필터링하여 경고 방지
 */
function ReactMarkdown({
  children,
  className,
  // 아래 props들은 DOM에 전달하지 않음 (React 경고 방지)
  remarkPlugins: _remarkPlugins,
  rehypePlugins: _rehypePlugins,
  components: _components,
}: ReactMarkdownOptions) {
  return (
    <div className={className} data-testid="react-markdown">
      <pre>{children}</pre>
    </div>
  );
}

export default ReactMarkdown;
