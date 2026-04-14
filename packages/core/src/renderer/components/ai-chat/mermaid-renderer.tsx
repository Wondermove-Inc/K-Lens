/**
 * 🎯 목적: Mermaid 다이어그램 렌더러 컴포넌트
 * 2026-01-13: LLM 출력의 Mermaid 코드 블록을 다이어그램으로 렌더링
 *
 * 📝 주요 기능:
 * - Mermaid 코드를 SVG 다이어그램으로 변환
 * - 다크 테마 적용 (어두운 회색 배경, 흰색 글자)
 * - 에러 시 코드 블록 폴백
 * - 로딩 상태 표시
 * - 🆕 클릭 시 모달로 크게 보기
 * - 🆕 다이어그램/코드 토글 기능
 * - 🆕 모달 줌/팬 기능 (react-zoom-pan-pinch)
 *
 * @packageDocumentation
 */

import { Code, Download, Image, Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import mermaid from "mermaid";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { cn } from "../../lib/utils";

/**
 * oklch/rgb 등의 CSS 색상값을 hex로 변환
 * Mermaid.js는 hex/rgb만 지원하므로 런타임 변환 필요
 */
function resolveColorToHex(colorValue: string): string | null {
  if (typeof document === "undefined") return null;
  const div = document.createElement("div");
  try {
    div.style.color = colorValue;
    document.body.appendChild(div);
    const resolved = getComputedStyle(div).color;

    const match = resolved.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    const [, r, g, b] = match;
    return `#${Number(r).toString(16).padStart(2, "0")}${Number(g).toString(16).padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}`;
  } catch {
    return null;
  } finally {
    div.parentNode?.removeChild(div);
  }
}

/**
 * 🎯 THEME-020: CSS 변수에서 Mermaid 테마 값 읽기
 * oklch 등 Mermaid 비호환 형식은 hex로 자동 변환
 * @param varName CSS 변수 이름 (--mermaid-* 형식)
 * @param fallback 폴백 값
 */
function getMermaidCSSVar(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return fallback;
    return resolveColorToHex(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * MermaidRenderer 컴포넌트 props
 */
export interface MermaidRendererProps {
  /** Mermaid 코드 */
  code: string;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 🎯 Mermaid 초기화
// ============================================

/**
 * Mermaid 라이브러리 초기화
 * 📝 다크 테마 강제 적용 (어두운 회색 배경, 흰색 글자)
 */
function initializeMermaid(): void {
  // 🎯 THEME-020: CSS 변수에서 테마 색상 읽기 (폴백 값 포함)
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "loose",
    fontFamily: "inherit",
    themeVariables: {
      background: getMermaidCSSVar("--mermaid-bg", "#1e1e1e"),
      primaryColor: getMermaidCSSVar("--mermaid-primary", "#3b82f6"),
      primaryTextColor: getMermaidCSSVar("--mermaid-primary-text", "#ffffff"),
      primaryBorderColor: getMermaidCSSVar("--mermaid-primary-border", "#4b5563"),
      secondaryColor: getMermaidCSSVar("--mermaid-secondary", "#374151"),
      secondaryTextColor: getMermaidCSSVar("--mermaid-secondary-text", "#ffffff"),
      tertiaryColor: getMermaidCSSVar("--mermaid-tertiary", "#1f2937"),
      tertiaryTextColor: getMermaidCSSVar("--mermaid-tertiary-text", "#ffffff"),
      lineColor: getMermaidCSSVar("--mermaid-line", "#6b7280"),
      textColor: getMermaidCSSVar("--mermaid-text", "#ffffff"),
      mainBkg: getMermaidCSSVar("--mermaid-main-bg", "#374151"),
      nodeBkg: getMermaidCSSVar("--mermaid-node-bg", "#374151"),
      nodeBorder: getMermaidCSSVar("--mermaid-node-border", "#4b5563"),
      clusterBkg: getMermaidCSSVar("--mermaid-cluster-bg", "#1f2937"),
      clusterBorder: getMermaidCSSVar("--mermaid-cluster-border", "#4b5563"),
      titleColor: getMermaidCSSVar("--mermaid-title", "#ffffff"),
      edgeLabelBackground: getMermaidCSSVar("--mermaid-edge-label-bg", "#374151"),
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: "basis",
    },
    sequence: {
      useMaxWidth: true,
      wrap: true,
    },
  });
}

/**
 * Mermaid 예약어 목록
 */
const MERMAID_RESERVED_WORDS = [
  "default",
  "graph",
  "subgraph",
  "end",
  "style",
  "class",
  "classDef",
  "click",
  "callback",
  "link",
  "linkStyle",
  "direction",
];

/**
 * Mermaid 코드 정리 및 유효성 검사
 *
 * @param code - 원본 Mermaid 코드
 * @returns 정리된 코드 또는 에러 객체
 */
function sanitizeMermaidCode(code: string): { cleanCode: string } | { error: string } {
  if (!code || !code.trim()) {
    return { error: "Empty Mermaid code" };
  }

  let cleanCode = code.trim();

  // 1. 코드 블록 마커 제거
  if (cleanCode.startsWith("```mermaid")) {
    cleanCode = cleanCode.slice("```mermaid".length).trim();
  } else if (cleanCode.startsWith("```")) {
    cleanCode = cleanCode.slice(3).trim();
  }
  if (cleanCode.endsWith("```")) {
    cleanCode = cleanCode.slice(0, -3).trim();
  }

  // 2. 유효한 다이어그램 타입 목록
  const validDiagramTypes = [
    "flowchart",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "erDiagram",
    "gantt",
    "pie",
    "journey",
    "gitGraph",
    "mindmap",
    "timeline",
    "quadrantChart",
    "xychart",
    "sankey",
    "block",
  ];

  // 3. 중복 다이어그램 타입 제거
  for (const type of validDiagramTypes) {
    const duplicatePattern = new RegExp(`(${type}\\s+(?:TD|TB|LR|RL|BT)?\\s*)(?:${type}\\s+(?:TD|TB|LR|RL|BT)?)`, "gi");
    cleanCode = cleanCode.replace(duplicatePattern, (match) => {
      const lastMatch = match.match(new RegExp(`${type}\\s+(?:TD|TB|LR|RL|BT)?`, "gi"));
      if (lastMatch && lastMatch.length > 0) {
        return lastMatch[lastMatch.length - 1].trim();
      }
      return match;
    });
  }

  // 4. 첫 줄에서 다이어그램 타입 확인
  const firstLine = cleanCode.split("\n")[0].trim().toLowerCase();
  const hasValidType = validDiagramTypes.some((type) => firstLine.startsWith(type.toLowerCase()));

  if (!hasValidType) {
    if (cleanCode.includes("-->") || cleanCode.includes("->") || cleanCode.includes("---")) {
      cleanCode = `flowchart TD\n${cleanCode}`;
    } else {
      return {
        error: `Invalid diagram type. First line: "${firstLine.slice(0, 50)}..."`,
      };
    }
  }

  // 5. 예약어를 subgraph 이름으로 사용한 경우 변환
  for (const reserved of MERMAID_RESERVED_WORDS) {
    const subgraphPattern = new RegExp(`(subgraph\\s+)(${reserved})(\\s*\\n|\\s*$|\\s+[A-Z])`, "gi");
    cleanCode = cleanCode.replace(subgraphPattern, (match, prefix, word, suffix) => {
      const safeName = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() + "_NS";
      return `${prefix}${safeName}${suffix}`;
    });
  }

  return { cleanCode };
}

// ============================================
// 🎯 줌 컨트롤 컴포넌트
// ============================================

/**
 * 모달 내 줌 컨트롤 버튼들
 */
function ZoomControls(): React.ReactElement {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="flex items-center gap-1 bg-background/90 rounded-lg border p-1 shadow-lg">
      <button onClick={() => zoomIn()} className="p-2 rounded hover:bg-muted transition-colors" title="Zoom In (+)">
        <ZoomIn className="h-4 w-4 text-foreground" />
      </button>
      <button onClick={() => zoomOut()} className="p-2 rounded hover:bg-muted transition-colors" title="Zoom Out (-)">
        <ZoomOut className="h-4 w-4 text-foreground" />
      </button>
      <div className="w-px h-6 bg-border mx-1" />
      <button
        onClick={() => resetTransform()}
        className="p-2 rounded hover:bg-muted transition-colors"
        title="Fit to Screen (100%)"
      >
        <Maximize className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * MermaidRenderer 컴포넌트
 *
 * 📝 기능:
 * - Mermaid 코드를 SVG 다이어그램으로 렌더링
 * - 에러 발생 시 원본 코드 표시
 * - 로딩 상태 표시
 * - 다이어그램/코드 토글
 * - 모달 줌/팬 기능
 */
export function MermaidRenderer({ code, className }: MermaidRendererProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 🆕 다이어그램/코드 토글 상태
  const [showCode, setShowCode] = useState(false);

  /**
   * 모달 열기
   */
  const openModal = useCallback(() => {
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  /**
   * 모달 닫기
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    document.body.style.overflow = "";
  }, []);

  /**
   * SVG 다운로드 (PNG 형식)
   */
  const downloadAsPng = useCallback(() => {
    if (!svg) return;

    // Create a canvas to convert SVG to PNG
    const svgElement = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;

    // Get SVG dimensions from viewBox or default
    const viewBox = svgElement.getAttribute("viewBox");
    let width = 1200;
    let height = 800;

    if (viewBox) {
      const parts = viewBox.split(" ");
      if (parts.length === 4) {
        width = parseFloat(parts[2]) || 1200;
        height = parseFloat(parts[3]) || 800;
      }
    }

    // Scale up for better quality
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill background with dark color (THEME-020: CSS 변수 사용)
    ctx.fillStyle = getMermaidCSSVar("--mermaid-bg", "#1e1e1e");
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create image from SVG
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new window.Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      // Download as PNG
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `mermaid-diagram-${Date.now()}.png`;
      link.href = pngUrl;
      link.click();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: download as SVG
      downloadAsSvg();
    };

    img.src = url;
  }, [svg]);

  /**
   * SVG 다운로드 (SVG 형식)
   */
  const downloadAsSvg = useCallback(() => {
    if (!svg) return;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `mermaid-diagram-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [svg]);

  /**
   * ESC 키로 모달 닫기
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, closeModal]);

  /**
   * Mermaid 다이어그램 렌더링
   */
  useEffect(() => {
    let isMounted = true;

    async function renderDiagram(): Promise<void> {
      if (!code.trim()) {
        setIsLoading(false);
        return;
      }

      try {
        const sanitizeResult = sanitizeMermaidCode(code);

        if ("error" in sanitizeResult) {
          if (isMounted) {
            setError(sanitizeResult.error);
            setSvg(null);
            setIsLoading(false);
          }
          return;
        }

        const cleanCode = sanitizeResult.cleanCode;
        initializeMermaid();

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, cleanCode);

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Mermaid rendering failed";
          setError(errorMessage);
          setSvg(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code]);

  // ============================================
  // 🔹 로딩 상태
  // ============================================

  if (isLoading) {
    return (
      <div className={cn("my-2 p-4 rounded-lg border bg-muted/30 text-muted-foreground text-sm", className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Rendering diagram...</span>
        </div>
      </div>
    );
  }

  // ============================================
  // 🔹 에러 상태 - 원본 코드만 표시 (에러 메시지 숨김)
  // ============================================

  if (error || !svg) {
    return (
      <div className={cn("my-2", className)}>
        {/* 에러 메시지 제거 - 코드만 표시 */}
        <div className="bg-muted/30 rounded-lg border p-3 overflow-x-auto">
          <pre className="text-muted-foreground font-mono text-sm whitespace-pre-wrap">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    );
  }

  // ============================================
  // 🔹 성공 - SVG 다이어그램 + 토글 + 모달
  // ============================================

  return (
    <>
      {/* 미리보기 영역 - 다이어그램/코드 토글 가능 */}
      <div ref={containerRef} className={cn("my-2 rounded-lg border bg-background overflow-hidden", className)}>
        {/* 헤더: 토글 버튼 + 확대 버튼 */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1">
            {/* Diagram button */}
            <button
              onClick={() => setShowCode(false)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                !showCode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
              )}
              title="View Diagram"
            >
              <Image className="h-3.5 w-3.5" />
              <span>Diagram</span>
            </button>
            {/* Code button */}
            <button
              onClick={() => setShowCode(true)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                showCode ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
              )}
              title="View Code"
            >
              <Code className="h-3.5 w-3.5" />
              <span>Code</span>
            </button>
          </div>

          {/* Expand button (diagram mode only) */}
          {!showCode && (
            <button
              onClick={openModal}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground transition-colors"
              title="Expand"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              <span>Expand</span>
            </button>
          )}
        </div>

        {/* 컨텐츠 영역 */}
        {showCode ? (
          /* 코드 보기 */
          <div className="p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
            <pre className="text-muted-foreground font-mono text-sm whitespace-pre-wrap">
              <code>{code}</code>
            </pre>
          </div>
        ) : (
          /* Diagram view */
          <div
            className="p-4 overflow-x-auto cursor-pointer hover:bg-muted/10 transition-colors"
            onClick={openModal}
            title="Click to expand"
          >
            <div className="[&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        )}
      </div>

      {/* 모달 (크게 보기) - 줌/팬 기능 포함 */}
      {isModalOpen && svg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeModal}>
          {/* 오버레이 배경 */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal content - 70% of viewport (no max constraints) */}
          <div
            className="relative z-10 bg-background border rounded-xl shadow-2xl flex flex-col"
            style={{
              width: "70vw",
              height: "70vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-sm font-medium text-foreground">Mermaid Diagram</h3>
              <div className="flex items-center gap-1">
                {/* Download buttons */}
                <button
                  onClick={downloadAsPng}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground"
                  title="Download as PNG"
                >
                  <Download className="h-4 w-4" />
                  <span>PNG</span>
                </button>
                <button
                  onClick={downloadAsSvg}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground"
                  title="Download as SVG"
                >
                  <Download className="h-4 w-4" />
                  <span>SVG</span>
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                {/* Close button */}
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title="Close (ESC)"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* 다이어그램 영역 - 줌/팬 가능 */}
            <div className="flex-1 min-h-0 relative" style={{ backgroundColor: "var(--mermaid-bg)" }}>
              <TransformWrapper
                initialScale={1}
                minScale={0.1}
                maxScale={5}
                centerOnInit={true}
                wheel={{ step: 0.1 }}
                panning={{ velocityDisabled: true }}
              >
                {() => (
                  <>
                    {/* 줌 컨트롤 - 우측 상단 */}
                    <div className="absolute top-4 right-4 z-10">
                      <ZoomControls />
                    </div>

                    {/* SVG area - fit to modal (100% = fill modal) */}
                    <TransformComponent
                      wrapperStyle={{
                        width: "100%",
                        height: "100%",
                      }}
                      contentStyle={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        className="mermaid-svg-container [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          padding: "16px",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: svg
                            // Remove fixed dimensions, let CSS handle sizing
                            .replace(/(<svg[^>]*)(\s+width="[^"]*")/gi, "$1")
                            .replace(/(<svg[^>]*)(\s+height="[^"]*")/gi, "$1")
                            // Remove inline max-width style
                            .replace(/style="[^"]*"/gi, (match) => match.replace(/max-width:\s*[^;]+;?/gi, "")),
                        }}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>

            {/* Modal footer */}
            <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center shrink-0 flex items-center justify-center gap-4">
              <span>Mouse Wheel: Zoom</span>
              <span>Drag: Pan</span>
              <span>ESC: Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

MermaidRenderer.displayName = "MermaidRenderer";
