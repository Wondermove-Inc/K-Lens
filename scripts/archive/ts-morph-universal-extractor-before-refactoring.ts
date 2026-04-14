#!/usr/bin/env tsx

/**
 * 🎯 목적: 모든 React 컴포넌트 타입에 범용적으로 적용 가능한 ts-morph 기반 추출 시스템
 *
 * 사용법:
 *   pnpm tsx scripts/ts-morph-universal-extractor.ts <source-file> <output-file>
 *
 * 예시:
 *   pnpm tsx scripts/ts-morph-universal-extractor.ts \
 *     packages/core/src/renderer/components/layout/sidebar.tsx \
 *     docs/plan/active/features/sidebar-analysis.md
 *
 * 📝 주의사항:
 *   - sidebar에 한정되지 않고 모든 컴포넌트 타입 대응 (Class/Functional, MobX/useState, Simple/Complex)
 *   - 4개 아키타입 자동 감지 및 동적 섹션 생성
 *
 * 🔄 변경이력:
 *   2025-10-21 - 범용 시스템으로 전면 재작성 (10개 컴포넌트 패턴 분석 기반)
 */

import * as fs from "fs";
import * as path from "path";
import {
  CallExpression,
  ClassDeclaration,
  FunctionDeclaration,
  ImportDeclaration,
  InterfaceDeclaration,
  JsxAttribute,
  JsxElement,
  JsxSelfClosingElement,
  MethodDeclaration,
  Node,
  Project,
  PropertySignature,
  SourceFile,
  SyntaxKind,
  VariableDeclaration,
} from "ts-morph";

// ============================================
// 📊 타입 정의 - ComponentProfile (아키타입 감지용)
// ============================================

/**
 * 🎯 목적: 컴포넌트 프로파일 (자동 감지 결과)
 *
 * 이 프로파일을 기반으로:
 * 1. 아키타입 자동 추천
 * 2. 필요한 섹션 동적 생성
 * 3. 분석 모듈 선택
 */
interface ComponentProfile {
  // 기본 정보
  type: "class" | "functional" | "forwardRef" | "memo";
  exportType: "default" | "named" | "hoc-wrapped";
  complexity: "simple" | "medium" | "complex" | "very-complex";

  // State 관리
  stateManagement: {
    type: "mobx" | "useState" | "useReducer" | "class-state" | "none";
    count: number;
  };

  // Props
  propsPattern: {
    defined: boolean;
    count: number;
    hasDI: boolean;
    hasGeneric: boolean;
  };

  // UI 패턴
  uiPatterns: {
    jsxElementCount: number;
    hasConditionalRendering: boolean;
    hasMapRendering: boolean;
    hasFragments: boolean;
  };

  // 이벤트
  eventHandlers: {
    count: number;
    types: string[]; // ['onClick', 'onChange', ...]
  };

  // 로직
  businessLogic: {
    functionCount: number;
    hasAsyncLogic: boolean;
  };

  // 스타일
  styling: {
    type: "css-module" | "styled-components" | "tailwind" | "inline" | "none";
    hasDynamicClasses: boolean;
  };

  // Hooks (Functional만)
  hooks?: {
    useState: number;
    useEffect: number;
    useMemo: number;
    useCallback: number;
    useRef: number;
    custom: string[];
  };

  // Lifecycle (Class만)
  lifecycle?: {
    methods: string[]; // ['componentDidMount', 'componentDidUpdate', ...]
  };

  // External libraries
  externalLibraries: string[]; // ['@radix-ui/react-select', 'class-variance-authority', ...]

  // 추천 아키타입
  archetype:
    | "functional-mobx-complex"
    | "class-mobx-very-complex"
    | "functional-simple"
    | "shadcn-radix-ui"
    | "unknown";
}

/**
 * 🎯 목적: UI 요소 분석 결과
 */
interface UIElement {
  tagName: string;
  location: string; // "line:col-line:col"
  attributes: {
    name: string;
    value: string;
    isSpread: boolean;
    isDynamic: boolean;
  }[];
  children: UIElement[];
  textContent?: string;
  conditionalContext?: {
    type: "&&" | "ternary" | "if-return";
    condition: string;
  };
  mapContext?: {
    arrayExpression: string;
    itemVariable: string;
  };
  styling: {
    className?: string;
    inlineStyle?: string;
    isDynamic: boolean;
  };
  parentContext?: {
    type: "Fragment" | "Portal" | "normal";
    details?: string;
  };
}

/**
 * 🎯 목적: Props 분석 결과
 */
interface PropsAnalysis {
  interface?: {
    name: string;
    properties: {
      name: string;
      type: string;
      optional: boolean;
      defaultValue?: string;
      jsDoc?: string;
    }[];
    hasGeneric: boolean;
    genericParams?: string[];
  };
  diInjections?: {
    injectable: string;
    type: string;
  }[];
  usage: {
    propName: string;
    locations: string[];
  }[];
}

/**
 * 🎯 목적: 비즈니스 로직 분석 결과
 */
interface BusinessLogicFunction {
  name: string;
  type: "arrow-function" | "function-declaration" | "class-method";
  signature: string;
  isAsync: boolean;
  parameters: {
    name: string;
    type?: string;
  }[];
  returnType?: string;
  code: string;
  location: string;
  usageCount: number;
}

/**
 * 🎯 목적: 분석 결과 (각 모듈에서 추출한 정보)
 */
interface AnalysisResult {
  profile: ComponentProfile;
  uiElements: UIElement[];
  props: PropsAnalysis;
  state: any;
  eventHandlers: any[];
  businessLogic: BusinessLogicFunction[];
  hooks: any[];
  lifecycle?: any[];
  conditionalRendering: any[];
  mapRendering: any[];
  styling: any;
  di?: any;
}

// ============================================
// 🔍 Phase 2-1: 컴포넌트 프로파일러 구현
// ============================================

/**
 * 🎯 목적: 컴포넌트 타입 감지 (Class vs Functional)
 */
function detectComponentType(sourceFile: SourceFile): "class" | "functional" {
  // Class Component 감지
  const classDecl = sourceFile.getClasses().find((cls) => {
    // React.Component 또는 Component를 extends하는 클래스 찾기
    const extendsExpression = cls.getExtends();
    if (extendsExpression) {
      const extendsText = extendsExpression.getText();
      return extendsText.includes("Component");
    }
    return false;
  });

  if (classDecl) {
    return "class";
  }

  // Functional Component로 판단
  return "functional";
}

/**
 * 🎯 목적: State 관리 방식 감지
 */
function detectStateManagement(
  sourceFile: SourceFile,
  componentType: "class" | "functional",
): { type: ComponentProfile["stateManagement"]["type"]; count: number } {
  // MobX observer 감지
  const hasObserver = sourceFile
    .getImportDeclarations()
    .some(
      (imp) =>
        imp.getModuleSpecifierValue().includes("mobx-react") &&
        imp.getNamedImports().some((n) => n.getName() === "observer"),
    );

  if (componentType === "functional") {
    // useState 개수
    const useStateCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const expression = call.getExpression();
      return expression.getText() === "useState";
    });

    // useReducer 개수
    const useReducerCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      const expression = call.getExpression();
      return expression.getText() === "useReducer";
    });

    if (useReducerCalls.length > 0) {
      return { type: "useReducer", count: useReducerCalls.length };
    } else if (useStateCalls.length > 0) {
      return { type: "useState", count: useStateCalls.length };
    } else if (hasObserver) {
      return { type: "mobx", count: 0 }; // MobX는 props로 관리
    } else {
      return { type: "none", count: 0 };
    }
  } else {
    // Class Component
    const classDecl = sourceFile.getClass(() => true);
    if (classDecl) {
      // class state 감지
      const constructor = classDecl.getConstructors()[0];
      const hasClassState =
        constructor &&
        constructor
          .getDescendantsOfKind(SyntaxKind.ExpressionStatement)
          .some((stmt) => stmt.getText().includes("this.state"));

      if (hasClassState || hasObserver) {
        return { type: "class-state", count: 1 }; // 대략적인 추정
      } else if (hasObserver) {
        return { type: "mobx", count: 0 };
      }
    }
    return { type: "none", count: 0 };
  }
}

/**
 * 🎯 목적: DI 패턴 감지 (withInjectables)
 */
function detectDI(sourceFile: SourceFile): boolean {
  return sourceFile
    .getImportDeclarations()
    .some(
      (imp) =>
        imp.getModuleSpecifierValue().includes("@ogre-tools/injectable-react") &&
        imp.getNamedImports().some((n) => n.getName() === "withInjectables"),
    );
}

/**
 * 🎯 목적: UI 패턴 감지
 */
function detectUIPatterns(sourceFile: SourceFile): {
  jsxElementCount: number;
  hasConditionalRendering: boolean;
  hasMapRendering: boolean;
  hasFragments: boolean;
} {
  // JSX 요소 개수
  const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
  const jsxSelfClosing = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const jsxElementCount = jsxElements.length + jsxSelfClosing.length;

  // 조건부 렌더링 감지 (&&, ternary)
  const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const hasAndOperator = binaryExpressions.some(
    (expr) => expr.getOperatorToken().getText() === "&&" && containsJSX(expr),
  );

  const ternaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression);
  const hasTernary = ternaryExpressions.some((expr) => containsJSX(expr));

  const hasConditionalRendering = hasAndOperator || hasTernary;

  // map 렌더링 감지
  const mapCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const expression = call.getExpression();
    if (Node.isPropertyAccessExpression(expression)) {
      return expression.getName() === "map" && containsJSX(call);
    }
    return false;
  });

  const hasMapRendering = mapCalls.length > 0;

  // Fragment 감지 (<> </> or <Fragment>)
  const fragments = sourceFile.getDescendantsOfKind(SyntaxKind.JsxFragment);
  const fragmentComponents = jsxElements.filter((elem) => {
    const openingElement = elem.getOpeningElement();
    return openingElement.getTagNameNode().getText() === "Fragment";
  });

  const hasFragments = fragments.length > 0 || fragmentComponents.length > 0;

  return {
    jsxElementCount,
    hasConditionalRendering,
    hasMapRendering,
    hasFragments,
  };
}

/**
 * 🎯 목적: JSX 포함 여부 확인 (조건부 렌더링, map 감지용)
 */
function containsJSX(node: Node): boolean {
  const jsxElements = node.getDescendantsOfKind(SyntaxKind.JsxElement);
  const jsxSelfClosing = node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  return jsxElements.length > 0 || jsxSelfClosing.length > 0;
}

/**
 * 🎯 목적: 이벤트 핸들러 감지
 */
function detectEventHandlers(sourceFile: SourceFile): { count: number; types: string[] } {
  const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);

  const eventHandlers = jsxAttributes.filter((attr) => {
    const nameNode = attr.getNameNode();
    const attrName = nameNode.getText();
    return attrName.startsWith("on"); // onClick, onChange, onSubmit, etc.
  });

  const eventTypes = Array.from(new Set(eventHandlers.map((attr) => attr.getNameNode().getText())));

  return {
    count: eventHandlers.length,
    types: eventTypes,
  };
}

/**
 * 🎯 목적: 비즈니스 로직 함수 개수 감지
 */
function detectBusinessLogic(
  sourceFile: SourceFile,
  componentType: "class" | "functional",
): { functionCount: number; hasAsyncLogic: boolean } {
  let functionCount = 0;
  let hasAsyncLogic = false;

  if (componentType === "class") {
    // Class methods
    const classDecl = sourceFile.getClass(() => true);
    if (classDecl) {
      const methods = classDecl.getMethods();
      functionCount = methods.length;

      // async 메서드 확인
      hasAsyncLogic = methods.some((method) => method.isAsync());
    }
  } else {
    // Functional component 내부 함수들
    // 🔥 HOC 패턴 감지 (observer, withInjectables 등)
    let targetScope: Node = sourceFile;

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const expression = call.getExpression();
      const expressionText = expression.getText();

      if (expressionText === "observer" || expressionText === "withInjectables") {
        const args = call.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          if (Node.isArrowFunction(firstArg) || Node.isFunctionExpression(firstArg)) {
            targetScope = firstArg;
            break;
          }
        }
      }
    }

    // targetScope 내부에서 VariableDeclaration 검색
    const variableDeclarations = targetScope.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    const innerFunctions = variableDeclarations.filter((decl) => {
      const initializer = decl.getInitializer();
      return Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer);
    });

    functionCount = innerFunctions.length;

    // async 함수 확인
    hasAsyncLogic = innerFunctions.some((decl) => {
      const initializer = decl.getInitializer();
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        return initializer.isAsync();
      }
      return false;
    });

    // async/await in useEffect
    const useEffectCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
      return call.getExpression().getText() === "useEffect";
    });

    for (const call of useEffectCalls) {
      const args = call.getArguments();
      if (args.length > 0 && Node.isArrowFunction(args[0])) {
        const callback = args[0];
        const awaitExpressions = callback.getDescendantsOfKind(SyntaxKind.AwaitExpression);
        if (awaitExpressions.length > 0) {
          hasAsyncLogic = true;
        }
      }
    }
  }

  return { functionCount, hasAsyncLogic };
}

/**
 * 🎯 목적: React Hooks 감지 (Functional만)
 */
function detectHooks(sourceFile: SourceFile): ComponentProfile["hooks"] {
  const hooks = {
    useState: 0,
    useEffect: 0,
    useMemo: 0,
    useCallback: 0,
    useRef: 0,
    custom: [] as string[],
  };

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expression = call.getExpression();
    const expressionText = expression.getText();

    if (expressionText === "useState") {
      hooks.useState++;
    } else if (expressionText === "useEffect") {
      hooks.useEffect++;
    } else if (expressionText === "useMemo") {
      hooks.useMemo++;
    } else if (expressionText === "useCallback") {
      hooks.useCallback++;
    } else if (expressionText === "useRef") {
      hooks.useRef++;
    } else if (expressionText.startsWith("use") && expressionText !== "use") {
      // Custom hooks
      if (!hooks.custom.includes(expressionText)) {
        hooks.custom.push(expressionText);
      }
    }
  }

  return hooks;
}

/**
 * 🎯 목적: Lifecycle methods 감지 (Class만)
 */
function detectLifecycle(sourceFile: SourceFile): string[] {
  const lifecycleMethods: string[] = [];
  const classDecl = sourceFile.getClass(() => true);

  if (classDecl) {
    const methods = classDecl.getMethods();
    const lifecycleNames = [
      "componentDidMount",
      "componentDidUpdate",
      "componentWillUnmount",
      "shouldComponentUpdate",
      "getDerivedStateFromProps",
    ];

    for (const method of methods) {
      const methodName = method.getName();
      if (lifecycleNames.includes(methodName)) {
        lifecycleMethods.push(methodName);
      }
    }
  }

  return lifecycleMethods;
}

/**
 * 🎯 목적: 스타일링 방식 감지
 */
function detectStyling(sourceFile: SourceFile): {
  type: ComponentProfile["styling"]["type"];
  hasDynamicClasses: boolean;
} {
  const imports = sourceFile.getImportDeclarations();

  // CSS Module 감지
  const hasCSSModule = imports.some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return (
      moduleSpecifier.endsWith(".scss") ||
      moduleSpecifier.endsWith(".module.css") ||
      moduleSpecifier.endsWith(".module.scss")
    );
  });

  // Tailwind 감지 (cn 유틸리티 사용)
  const hasTailwind = imports.some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return moduleSpecifier.includes("/lib/utils"); // shadcn pattern
  });

  // styled-components 감지
  const hasStyledComponents = imports.some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return moduleSpecifier.includes("styled-components");
  });

  // Dynamic classes 감지 (cssNames, classNames, clsx, cn)
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const hasDynamicClasses = callExpressions.some((call) => {
    const expression = call.getExpression();
    const expressionText = expression.getText();
    return ["cssNames", "classNames", "clsx", "cn"].includes(expressionText);
  });

  let type: ComponentProfile["styling"]["type"] = "none";
  if (hasTailwind) {
    type = "tailwind";
  } else if (hasCSSModule) {
    type = "css-module";
  } else if (hasStyledComponents) {
    type = "styled-components";
  }

  return { type, hasDynamicClasses };
}

/**
 * 🎯 목적: Props 패턴 감지
 */
function detectPropsPattern(sourceFile: SourceFile): {
  defined: boolean;
  count: number;
  hasDI: boolean;
  hasGeneric: boolean;
} {
  // Props 인터페이스 찾기
  const interfaces = sourceFile.getInterfaces();
  const propsInterface = interfaces.find((iface) => {
    const name = iface.getName();
    return name.endsWith("Props") || name.endsWith("Dependencies");
  });

  if (!propsInterface) {
    return { defined: false, count: 0, hasDI: false, hasGeneric: false };
  }

  const properties = propsInterface.getProperties();
  const count = properties.length;

  // DI 감지
  const hasDI = detectDI(sourceFile);

  // Generic 타입 감지
  const typeParameters = propsInterface.getTypeParameters();
  const hasGeneric = typeParameters.length > 0;

  return { defined: true, count, hasDI, hasGeneric };
}

/**
 * 🎯 목적: External libraries 감지
 */
function detectExternalLibraries(sourceFile: SourceFile): string[] {
  const imports = sourceFile.getImportDeclarations();
  const libraries: string[] = [];

  const externalLibraryPatterns = [
    "@radix-ui",
    "class-variance-authority",
    "lucide-react",
    "@ogre-tools/injectable",
    "mobx",
    "react-table",
  ];

  for (const imp of imports) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    for (const pattern of externalLibraryPatterns) {
      if (moduleSpecifier.includes(pattern) && !libraries.includes(pattern)) {
        libraries.push(pattern);
      }
    }
  }

  return libraries;
}

/**
 * 🎯 목적: 복잡도 계산
 */
function calculateComplexity(
  sourceFile: SourceFile,
  jsxElementCount: number,
  functionCount: number,
): ComponentProfile["complexity"] {
  const lineCount = sourceFile.getEndLineNumber();

  if (lineCount < 100 && jsxElementCount < 10 && functionCount < 5) {
    return "simple";
  } else if (lineCount < 200 && jsxElementCount < 20 && functionCount < 10) {
    return "medium";
  } else if (lineCount < 400) {
    return "complex";
  } else {
    return "very-complex";
  }
}

/**
 * 🎯 목적: 아키타입 자동 추천
 */
function recommendArchetype(profile: Partial<ComponentProfile>): ComponentProfile["archetype"] {
  // shadcn/Radix UI 패턴 우선 감지
  if (
    profile.externalLibraries?.some((lib) => lib.includes("@radix-ui")) ||
    profile.externalLibraries?.includes("class-variance-authority") ||
    profile.styling?.type === "tailwind"
  ) {
    return "shadcn-radix-ui";
  }

  // Class Component 감지
  if (profile.type === "class") {
    if (profile.complexity === "very-complex") {
      return "class-mobx-very-complex";
    } else {
      return "class-mobx-very-complex"; // cluster-overview도 포함
    }
  }

  // Functional Component
  if (profile.type === "functional") {
    // MobX + DI + Complex
    if (
      profile.stateManagement?.type === "mobx" &&
      profile.propsPattern?.hasDI &&
      (profile.complexity === "complex" || profile.complexity === "very-complex")
    ) {
      return "functional-mobx-complex";
    }

    // useState + Complex
    if (
      profile.stateManagement?.type === "useState" &&
      (profile.complexity === "complex" || profile.complexity === "very-complex")
    ) {
      return "functional-mobx-complex"; // 같은 카테고리로 처리
    }

    // Simple/Medium
    if (profile.complexity === "simple" || profile.complexity === "medium") {
      return "functional-simple";
    }

    // 기타
    return "functional-mobx-complex"; // default
  }

  return "unknown";
}

/**
 * 🎯 목적: 컴포넌트 프로파일링 (메인 함수)
 *
 * 이 함수가 모든 감지 로직을 통합하여 ComponentProfile 생성
 */
export function profileComponent(sourceFile: SourceFile): ComponentProfile {
  // 1. 컴포넌트 타입
  const type = detectComponentType(sourceFile);

  // 2. State 관리
  const stateManagement = detectStateManagement(sourceFile, type);

  // 3. Props 패턴
  const propsPattern = detectPropsPattern(sourceFile);

  // 4. UI 패턴
  const uiPatterns = detectUIPatterns(sourceFile);

  // 5. 이벤트 핸들러
  const eventHandlers = detectEventHandlers(sourceFile);

  // 6. 비즈니스 로직
  const businessLogic = detectBusinessLogic(sourceFile, type);

  // 7. 스타일링
  const styling = detectStyling(sourceFile);

  // 8. External libraries
  const externalLibraries = detectExternalLibraries(sourceFile);

  // 9. 복잡도
  const complexity = calculateComplexity(sourceFile, uiPatterns.jsxElementCount, businessLogic.functionCount);

  // 10. Hooks (Functional만)
  const hooks = type === "functional" ? detectHooks(sourceFile) : undefined;

  // 11. Lifecycle (Class만)
  const lifecycle = type === "class" ? { methods: detectLifecycle(sourceFile) } : undefined;

  // 12. Export 타입 감지 (간단하게)
  const exportType: ComponentProfile["exportType"] = "hoc-wrapped"; // 대부분 HOC wrapped

  // 13. 아키타입 추천
  const partialProfile = {
    type,
    complexity,
    stateManagement,
    propsPattern,
    styling,
    externalLibraries,
  };
  const archetype = recommendArchetype(partialProfile);

  const profile: ComponentProfile = {
    type,
    exportType,
    complexity,
    stateManagement,
    propsPattern,
    uiPatterns,
    eventHandlers,
    businessLogic,
    styling,
    externalLibraries,
    hooks,
    lifecycle,
    archetype,
  };

  return profile;
}

// ============================================
// 📋 Phase 2-2: 동적 섹션 생성기 구현
// ============================================

/**
 * 🎯 목적: 섹션 설정 (조건부 포함 + 우선순위)
 */
interface SectionConfig {
  title: string;
  priority: number; // 1-10, 높을수록 중요
  condition: (profile: ComponentProfile) => boolean;
  generator: (analysis: AnalysisResult, profile: ComponentProfile) => string;
}

/**
 * 🎯 목적: 12개 섹션 설정 (우선순위 및 조건)
 *
 * 📝 주의사항:
 * - condition: false → 섹션 생략
 * - priority: 높을수록 먼저 출력
 */
const SECTION_CONFIGS: SectionConfig[] = [
  // 1. UI 요소 (모든 컴포넌트, 최우선)
  {
    title: "UI 요소",
    priority: 10,
    condition: (profile) => profile.uiPatterns.jsxElementCount > 0,
    generator: generateUIElementsSection,
  },

  // 2. Props/DI (Props가 정의된 경우)
  {
    title: "Props 및 DI",
    priority: 9,
    condition: (profile) => profile.propsPattern.defined,
    generator: generatePropsSection,
  },

  // 3. 비즈니스 로직 (함수가 있는 경우)
  {
    title: "비즈니스 로직",
    priority: 9,
    condition: (profile) => profile.businessLogic.functionCount > 0,
    generator: generateBusinessLogicSection,
  },

  // 4. React Hooks (Functional만)
  {
    title: "React Hooks",
    priority: 8,
    condition: (profile) =>
      profile.type === "functional" &&
      profile.hooks !== undefined &&
      (profile.hooks.useState > 0 ||
        profile.hooks.useEffect > 0 ||
        profile.hooks.useMemo > 0 ||
        profile.hooks.useCallback > 0 ||
        profile.hooks.useRef > 0 ||
        profile.hooks.custom.length > 0),
    generator: generateHooksSection,
  },

  // 5. Lifecycle Methods (Class만)
  {
    title: "Lifecycle Methods",
    priority: 8,
    condition: (profile) =>
      profile.type === "class" && profile.lifecycle !== undefined && profile.lifecycle.methods.length > 0,
    generator: generateLifecycleSection,
  },

  // 6. MobX 패턴 (MobX 사용 시)
  {
    title: "MobX 패턴",
    priority: 7,
    condition: (profile) => profile.stateManagement.type === "mobx",
    generator: generateMobXSection,
  },

  // 7. State 관리 (useState, useReducer, class-state)
  {
    title: "State 관리",
    priority: 7,
    condition: (profile) => ["useState", "useReducer", "class-state"].includes(profile.stateManagement.type),
    generator: generateStateSection,
  },

  // 8. 이벤트 핸들러
  {
    title: "이벤트 핸들러",
    priority: 7,
    condition: (profile) => profile.eventHandlers.count > 0,
    generator: generateEventHandlersSection,
  },

  // 9. 조건부 렌더링
  {
    title: "조건부 렌더링",
    priority: 6,
    condition: (profile) => profile.uiPatterns.hasConditionalRendering,
    generator: generateConditionalRenderingSection,
  },

  // 10. 반복 렌더링 (map)
  {
    title: "반복 렌더링",
    priority: 6,
    condition: (profile) => profile.uiPatterns.hasMapRendering,
    generator: generateMapRenderingSection,
  },

  // 11. 스타일링
  {
    title: "스타일링",
    priority: 5,
    condition: (profile) => profile.styling.type !== "none",
    generator: generateStylingSection,
  },

  // 12. External Libraries
  {
    title: "External Libraries",
    priority: 4,
    condition: (profile) => profile.externalLibraries.length > 0,
    generator: generateExternalLibrariesSection,
  },
];

/**
 * 🎯 목적: ComponentProfile 기반 동적 섹션 생성
 *
 * @param profile - 컴포넌트 프로파일 (감지 결과)
 * @param analysis - 분석 결과 (각 모듈에서 추출한 정보)
 * @returns Markdown 문서
 *
 * 📝 주의사항:
 * - condition이 false인 섹션은 생략
 * - priority 높은 순서로 정렬
 */
function generateDynamicSections(profile: ComponentProfile, analysis: AnalysisResult): string {
  const sections: string[] = [];

  // Header
  sections.push(`# 컴포넌트 분석 결과\n`);
  sections.push(`**아키타입**: ${profile.archetype}\n`);
  sections.push(`**컴포넌트 타입**: ${profile.type}\n`);
  sections.push(`**복잡도**: ${profile.complexity}\n`);
  sections.push(`**State 관리**: ${profile.stateManagement.type}\n`);
  sections.push(`\n---\n`);

  // 조건에 맞는 섹션 필터링 및 정렬
  const applicableSections = SECTION_CONFIGS.filter((config) => config.condition(profile)).sort(
    (a, b) => b.priority - a.priority,
  );

  // 각 섹션 생성
  for (const config of applicableSections) {
    try {
      const sectionContent = config.generator(analysis, profile);
      sections.push(`\n## ${config.title}\n`);
      sections.push(sectionContent);
    } catch (error) {
      console.error(`⚠️  섹션 생성 실패: ${config.title}`, error);
      sections.push(`\n⚠️ 섹션 생성 중 오류 발생\n`);
    }
  }

  return sections.join("\n");
}

// ============================================
// 🔬 Phase 2-3: 핵심 분석 모듈 구현
// ============================================

/**
 * 🎯 목적: UI 요소 분석 모듈 (Step 2-3-1)
 *
 * 모든 JSX 요소의 속성, 자식 구조, 조건부/map 컨텍스트를 완전히 추출
 *
 * @param sourceFile - 소스 파일
 * @param profile - 컴포넌트 프로파일
 * @returns UI 요소 배열
 */
function analyzeUIElements(sourceFile: SourceFile, profile: ComponentProfile): UIElement[] {
  // 🔥 Class Component: render() 메서드 내부만 분석
  let targetScope: Node = sourceFile;

  if (profile.type === "class") {
    const classDecl = sourceFile.getClass(() => true);
    if (classDecl) {
      const renderMethod = classDecl.getMethod("render");
      if (renderMethod) {
        targetScope = renderMethod;
      }
    }
  }

  // 모든 JSX 요소 추출
  const jsxElements = targetScope.getDescendantsOfKind(SyntaxKind.JsxElement);
  const jsxSelfClosing = targetScope.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);

  const allElements: (JsxElement | JsxSelfClosingElement)[] = [...jsxElements, ...jsxSelfClosing];

  // 각 요소 분석
  const uiElements: UIElement[] = allElements.map((element) => analyzeJsxElement(element, sourceFile));

  return uiElements;
}

/**
 * 🎯 목적: 개별 JSX 요소 분석
 */
function analyzeJsxElement(element: JsxElement | JsxSelfClosingElement, sourceFile: SourceFile): UIElement {
  const tagName = getJsxTagName(element);
  const location = `${element.getStartLineNumber()}:${element.getStart()}-${element.getEndLineNumber()}:${element.getEnd()}`;

  // 속성 추출
  const attributes = extractJsxAttributes(element);

  // 자식 요소 추출
  const children: UIElement[] = [];
  let textContent: string | undefined;

  if (Node.isJsxElement(element)) {
    const jsxChildren = element.getJsxChildren();
    for (const child of jsxChildren) {
      if (Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child)) {
        children.push(analyzeJsxElement(child, sourceFile));
      } else if (Node.isJsxText(child)) {
        const text = child.getText().trim();
        if (text) {
          textContent = text;
        }
      } else if (Node.isJsxExpression(child)) {
        const expression = child.getExpression();
        if (expression) {
          textContent = `{${expression.getText()}}`;
        }
      }
    }
  }

  // 조건부 렌더링 컨텍스트 감지
  const conditionalContext = detectConditionalContext(element);

  // map 렌더링 컨텍스트 감지
  const mapContext = detectMapContext(element);

  // 스타일링 정보 추출
  const styling = extractElementStyling(element);

  // 부모 컨텍스트 감지 (Fragment, Portal)
  const parentContext = detectParentContext(element);

  return {
    tagName,
    location,
    attributes,
    children,
    textContent,
    conditionalContext,
    mapContext,
    styling,
    parentContext,
  };
}

/**
 * 🎯 목적: JSX 태그 이름 추출
 */
function getJsxTagName(element: JsxElement | JsxSelfClosingElement): string {
  if (Node.isJsxElement(element)) {
    return element.getOpeningElement().getTagNameNode().getText();
  } else {
    return element.getTagNameNode().getText();
  }
}

/**
 * 🎯 목적: JSX 속성 추출 (일반, spread, 동적)
 */
function extractJsxAttributes(element: JsxElement | JsxSelfClosingElement): UIElement["attributes"] {
  const attributes: UIElement["attributes"] = [];

  let jsxAttributes: Node[];
  if (Node.isJsxElement(element)) {
    jsxAttributes = element.getOpeningElement().getAttributes();
  } else {
    jsxAttributes = element.getAttributes();
  }

  for (const attr of jsxAttributes) {
    if (Node.isJsxAttribute(attr)) {
      const name = attr.getNameNode().getText();
      const initializer = attr.getInitializer();
      let value = "";
      let isDynamic = false;

      if (initializer) {
        if (Node.isStringLiteral(initializer)) {
          value = initializer.getText();
        } else if (Node.isJsxExpression(initializer)) {
          const expression = initializer.getExpression();
          value = expression ? `{${expression.getText()}}` : "{}";
          isDynamic = true;
        }
      } else {
        // Boolean attribute (e.g., disabled)
        value = "true";
      }

      attributes.push({
        name,
        value,
        isSpread: false,
        isDynamic,
      });
    } else if (Node.isJsxSpreadAttribute(attr)) {
      const expression = attr.getExpression();
      attributes.push({
        name: "...",
        value: `{...${expression.getText()}}`,
        isSpread: true,
        isDynamic: true,
      });
    }
  }

  return attributes;
}

/**
 * 🎯 목적: 조건부 렌더링 컨텍스트 감지
 *
 * 패턴: condition && <Component />, condition ? <A /> : <B />, if (condition) return <Component />
 */
function detectConditionalContext(element: JsxElement | JsxSelfClosingElement): UIElement["conditionalContext"] {
  let parent = element.getParent();

  // && 패턴 감지
  while (parent) {
    if (Node.isBinaryExpression(parent)) {
      const operator = parent.getOperatorToken().getText();
      if (operator === "&&") {
        const leftSide = parent.getLeft();
        return {
          type: "&&",
          condition: leftSide.getText(),
        };
      }
    }

    // ternary 패턴 감지
    if (Node.isConditionalExpression(parent)) {
      const condition = parent.getCondition();
      return {
        type: "ternary",
        condition: condition.getText(),
      };
    }

    // if-return 패턴 감지
    if (Node.isIfStatement(parent)) {
      const condition = parent.getExpression();
      return {
        type: "if-return",
        condition: condition.getText(),
      };
    }

    parent = parent.getParent();
  }

  return undefined;
}

/**
 * 🎯 목적: map 렌더링 컨텍스트 감지
 *
 * 패턴: array.map(item => <Component />)
 */
function detectMapContext(element: JsxElement | JsxSelfClosingElement): UIElement["mapContext"] {
  let parent = element.getParent();

  while (parent) {
    // ArrowFunction 안에 있는지 확인
    if (Node.isArrowFunction(parent)) {
      const arrowParent = parent.getParent();

      // CallExpression의 argument인지 확인
      if (Node.isCallExpression(arrowParent)) {
        const expression = arrowParent.getExpression();

        // .map() 호출인지 확인
        if (Node.isPropertyAccessExpression(expression)) {
          const methodName = expression.getName();
          if (methodName === "map" || methodName === "filter") {
            const arrayExpression = expression.getExpression().getText();
            const parameters = parent.getParameters();
            const itemVariable = parameters.length > 0 ? parameters[0].getName() : "item";

            return {
              arrayExpression,
              itemVariable,
            };
          }
        }
      }
    }

    parent = parent.getParent();
  }

  return undefined;
}

/**
 * 🎯 목적: 요소의 스타일링 정보 추출
 */
function extractElementStyling(element: JsxElement | JsxSelfClosingElement): UIElement["styling"] {
  const attributes = Node.isJsxElement(element) ? element.getOpeningElement().getAttributes() : element.getAttributes();

  let className: string | undefined;
  let inlineStyle: string | undefined;
  let isDynamic = false;

  for (const attr of attributes) {
    if (Node.isJsxAttribute(attr)) {
      const name = attr.getNameNode().getText();

      if (name === "className") {
        const initializer = attr.getInitializer();
        if (initializer) {
          if (Node.isStringLiteral(initializer)) {
            className = initializer.getLiteralText();
          } else if (Node.isJsxExpression(initializer)) {
            const expression = initializer.getExpression();
            className = expression ? expression.getText() : "";
            isDynamic = true;
          }
        }
      } else if (name === "style") {
        const initializer = attr.getInitializer();
        if (initializer && Node.isJsxExpression(initializer)) {
          const expression = initializer.getExpression();
          inlineStyle = expression ? expression.getText() : "";
          isDynamic = true;
        }
      }
    }
  }

  return {
    className,
    inlineStyle,
    isDynamic,
  };
}

/**
 * 🎯 목적: 부모 컨텍스트 감지 (Fragment, Portal)
 */
function detectParentContext(element: JsxElement | JsxSelfClosingElement): UIElement["parentContext"] {
  let parent = element.getParent();

  while (parent) {
    // Fragment 감지
    if (Node.isJsxFragment(parent)) {
      return {
        type: "Fragment",
        details: "<> ... </>",
      };
    }

    // <Fragment> 감지
    if (Node.isJsxElement(parent)) {
      const tagName = parent.getOpeningElement().getTagNameNode().getText();
      if (tagName === "Fragment" || tagName === "React.Fragment") {
        return {
          type: "Fragment",
          details: `<${tagName}>`,
        };
      }
    }

    // createPortal 감지
    if (Node.isCallExpression(parent)) {
      const expression = parent.getExpression();
      const expressionText = expression.getText();
      if (expressionText.includes("createPortal") || expressionText === "createPortal") {
        return {
          type: "Portal",
          details: "ReactDOM.createPortal(...)",
        };
      }
    }

    parent = parent.getParent();
  }

  return {
    type: "normal",
  };
}

/**
 * 🎯 목적: Props/DI 분석 모듈 (Step 2-3-2)
 *
 * Props 인터페이스, DI 패턴, 사용 위치를 완전히 추출
 *
 * @param sourceFile - 소스 파일
 * @param profile - 컴포넌트 프로파일
 * @returns Props 분석 결과
 */
function analyzeProps(sourceFile: SourceFile, profile: ComponentProfile): PropsAnalysis {
  const result: PropsAnalysis = {
    usage: [],
  };

  // 1. Props 인터페이스 찾기
  const propsInterface = findPropsInterface(sourceFile);

  if (propsInterface) {
    const properties = propsInterface.getProperties();
    const typeParameters = propsInterface.getTypeParameters();

    result.interface = {
      name: propsInterface.getName(),
      properties: properties.map((prop) => {
        const name = prop.getName();
        const type = prop.getType().getText();
        const optional = prop.hasQuestionToken();
        const jsDocComment = prop.getJsDocs()[0];
        const jsDoc = jsDocComment ? jsDocComment.getDescription().trim() : undefined;

        // 기본값 추출 (initializer가 있는 경우)
        let defaultValue: string | undefined;
        const initializer = prop.getInitializer();
        if (initializer) {
          defaultValue = initializer.getText();
        }

        return {
          name,
          type,
          optional,
          defaultValue,
          jsDoc,
        };
      }),
      hasGeneric: typeParameters.length > 0,
      genericParams: typeParameters.map((tp) => tp.getName()),
    };
  }

  // 2. DI 주입 감지 (withInjectables)
  if (profile.propsPattern.hasDI) {
    result.diInjections = extractDIInjections(sourceFile);
  }

  // 3. Props 사용 위치 추적
  if (propsInterface) {
    result.usage = trackPropsUsage(sourceFile, propsInterface, profile);
  }

  return result;
}

/**
 * 🎯 목적: Props 인터페이스 찾기
 *
 * 이름이 Props, Dependencies, *Props로 끝나는 인터페이스 찾기
 */
function findPropsInterface(sourceFile: SourceFile): InterfaceDeclaration | undefined {
  const interfaces = sourceFile.getInterfaces();

  // 우선순위: Dependencies > *Props > Props
  const dependencies = interfaces.find((iface) => iface.getName() === "Dependencies");
  if (dependencies) {
    return dependencies;
  }

  const propsInterface = interfaces.find((iface) => iface.getName().endsWith("Props"));
  if (propsInterface) {
    return propsInterface;
  }

  return undefined;
}

/**
 * 🎯 목적: DI 주입 추출 (withInjectables의 두 번째 인자)
 *
 * 패턴: di.inject(injectableInjectable) in getProps function
 */
function extractDIInjections(sourceFile: SourceFile): PropsAnalysis["diInjections"] {
  const diInjections: NonNullable<PropsAnalysis["diInjections"]> = [];

  // withInjectables 호출 찾기
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expression = call.getExpression();
    if (expression.getText() === "withInjectables") {
      // 두 번째 인자 (getProps 객체)
      const args = call.getArguments();
      if (args.length >= 2 && Node.isObjectLiteralExpression(args[1])) {
        const configObject = args[1];

        // getProps 함수 찾기
        const getPropsProperty = configObject.getProperty("getProps");
        if (getPropsProperty && Node.isPropertyAssignment(getPropsProperty)) {
          const getPropsFunc = getPropsProperty.getInitializer();

          if (getPropsFunc) {
            // getProps 함수 내부의 di.inject() 호출 찾기
            const injectCalls = getPropsFunc.getDescendantsOfKind(SyntaxKind.CallExpression);

            for (const injectCall of injectCalls) {
              const injectExpr = injectCall.getExpression();

              // di.inject(...) 패턴 감지
              if (Node.isPropertyAccessExpression(injectExpr)) {
                const propertyName = injectExpr.getName();
                const objectExpr = injectExpr.getExpression();

                if (propertyName === "inject" && objectExpr.getText() === "di") {
                  const injectArgs = injectCall.getArguments();
                  if (injectArgs.length > 0) {
                    const injectableName = injectArgs[0].getText();
                    diInjections.push({
                      injectable: injectableName,
                      type: "unknown",
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return diInjections.length > 0 ? diInjections : undefined;
}

/**
 * 🎯 목적: Props 사용 위치 추적
 *
 * 각 prop이 어디서 사용되는지 추적
 */
function trackPropsUsage(
  sourceFile: SourceFile,
  propsInterface: InterfaceDeclaration,
  profile: ComponentProfile,
): PropsAnalysis["usage"] {
  const usage: PropsAnalysis["usage"] = [];
  const properties = propsInterface.getProperties();

  for (const prop of properties) {
    const propName = prop.getName();
    const locations: string[] = [];

    // Functional Component: props destructuring 또는 props.propName
    if (profile.type === "functional") {
      // Identifier 찾기
      const identifiers = sourceFile
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .filter((id) => id.getText() === propName);

      for (const identifier of identifiers) {
        const parent = identifier.getParent();

        // props destructuring이 아닌 실제 사용 위치만
        if (
          !Node.isBindingElement(parent) &&
          !Node.isPropertySignature(parent) &&
          !Node.isPropertyDeclaration(parent)
        ) {
          const line = identifier.getStartLineNumber();
          locations.push(`Line ${line}`);
        }
      }
    }

    // Class Component: this.props.propName
    if (profile.type === "class") {
      const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);

      for (const access of propertyAccesses) {
        const property = access.getName();
        if (property === propName) {
          const expression = access.getExpression();
          // this.props.propName 패턴 확인
          if (Node.isPropertyAccessExpression(expression) && expression.getName() === "props") {
            const line = access.getStartLineNumber();
            locations.push(`Line ${line}`);
          }
        }
      }
    }

    if (locations.length > 0) {
      usage.push({
        propName,
        locations: Array.from(new Set(locations)), // 중복 제거
      });
    }
  }

  return usage;
}

/**
 * 🎯 목적: 비즈니스 로직 분석 모듈 (Step 2-3-3)
 *
 * 모든 함수의 시그니처, 코드, 비동기 여부를 완전히 추출
 *
 * @param sourceFile - 소스 파일
 * @param profile - 컴포넌트 프로파일
 * @returns 비즈니스 로직 함수 배열
 */
function analyzeBusinessLogic(sourceFile: SourceFile, profile: ComponentProfile): BusinessLogicFunction[] {
  const functions: BusinessLogicFunction[] = [];

  if (profile.type === "class") {
    // Class Component: 모든 메서드 추출
    const classDecl = sourceFile.getClass(() => true);
    if (classDecl) {
      const methods = classDecl.getMethods();

      for (const method of methods) {
        const name = method.getName();
        const isAsync = method.isAsync();
        const parameters = method.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType().getText(),
        }));
        const returnType = method.getReturnType().getText();
        const code = method.getText();
        const location = `Line ${method.getStartLineNumber()}`;

        // 사용 횟수 추적 (간단하게 이름으로 검색)
        const usageCount = countFunctionUsage(sourceFile, name);

        functions.push({
          name,
          type: "class-method",
          signature: `${name}(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${returnType}`,
          isAsync,
          parameters,
          returnType,
          code,
          location,
          usageCount,
        });
      }
    }
  } else {
    // Functional Component: 내부 함수 추출
    // 🔥 HOC 패턴 감지 (observer, withInjectables 등)
    let targetScope: Node = sourceFile;

    // observer() 같은 HOC 내부 함수를 찾기 위해 CallExpression 검색
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const expression = call.getExpression();
      const expressionText = expression.getText();

      // observer() 또는 withInjectables() 같은 HOC 패턴 감지
      if (expressionText === "observer" || expressionText === "withInjectables") {
        const args = call.getArguments();

        // observer()의 경우 첫 번째 인자가 컴포넌트 함수
        if (args.length > 0) {
          const firstArg = args[0];

          if (Node.isArrowFunction(firstArg) || Node.isFunctionExpression(firstArg)) {
            targetScope = firstArg;
            break;
          }
        }
      }
    }

    // targetScope 내부에서 VariableDeclaration 검색
    const variableDeclarations = targetScope.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const varDecl of variableDeclarations) {
      const name = varDecl.getName();
      const initializer = varDecl.getInitializer();

      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        const isAsync = initializer.isAsync();
        const parameters = initializer.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType().getText(),
        }));
        const returnType = initializer.getReturnType().getText();
        const code = varDecl.getText();
        const location = `Line ${varDecl.getStartLineNumber()}`;
        const usageCount = countFunctionUsage(sourceFile, name);

        functions.push({
          name,
          type: "arrow-function",
          signature: `${name} = (${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}) => ${returnType}`,
          isAsync,
          parameters,
          returnType,
          code,
          location,
          usageCount,
        });
      }
    }

    // Function declarations (최상위 레벨만)
    const functionDeclarations = sourceFile.getFunctions();

    for (const func of functionDeclarations) {
      const name = func.getName() || "anonymous";
      const isAsync = func.isAsync();
      const parameters = func.getParameters().map((param) => ({
        name: param.getName(),
        type: param.getType().getText(),
      }));
      const returnType = func.getReturnType().getText();
      const code = func.getText();
      const location = `Line ${func.getStartLineNumber()}`;
      const usageCount = countFunctionUsage(sourceFile, name);

      functions.push({
        name,
        type: "function-declaration",
        signature: `function ${name}(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${returnType}`,
        isAsync,
        parameters,
        returnType,
        code,
        location,
        usageCount,
      });
    }
  }

  return functions;
}

/**
 * 🎯 목적: 함수 사용 횟수 추적
 */
function countFunctionUsage(sourceFile: SourceFile, functionName: string): number {
  const identifiers = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id) => id.getText() === functionName);

  let count = 0;
  for (const identifier of identifiers) {
    const parent = identifier.getParent();

    // 함수 호출인지 확인 (CallExpression의 일부)
    if (
      Node.isCallExpression(parent) ||
      (Node.isPropertyAccessExpression(parent) && Node.isCallExpression(parent.getParent()))
    ) {
      count++;
    }
  }

  return count;
}

// ============================================
// 🔧 섹션별 Generator 함수 스텁 (Step 2-3에서 구현)
// ============================================

/**
 * 🎯 목적: UI 요소 섹션 생성
 *
 * 📝 주의사항:
 * - Step 2-3-1에서 실제 분석 로직 구현 완료
 */
function generateUIElementsSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  const uiElements = analysis.uiElements;

  if (uiElements.length === 0) {
    return "⚠️ JSX 요소가 없습니다.";
  }

  const sections: string[] = [];

  // 요약 통계
  sections.push("### 📊 요약 통계");
  sections.push(`- **총 JSX 요소**: ${uiElements.length}개`);

  const conditionalElements = uiElements.filter((e) => e.conditionalContext !== undefined);
  const mapElements = uiElements.filter((e) => e.mapContext !== undefined);
  const fragmentElements = uiElements.filter((e) => e.parentContext?.type === "Fragment");
  const portalElements = uiElements.filter((e) => e.parentContext?.type === "Portal");

  if (conditionalElements.length > 0) {
    sections.push(`- **조건부 렌더링**: ${conditionalElements.length}개`);
  }
  if (mapElements.length > 0) {
    sections.push(`- **반복 렌더링 (map)**: ${mapElements.length}개`);
  }
  if (fragmentElements.length > 0) {
    sections.push(`- **Fragment 사용**: ${fragmentElements.length}개`);
  }
  if (portalElements.length > 0) {
    sections.push(`- **Portal 사용**: ${portalElements.length}개`);
  }

  sections.push("");

  // 주요 컴포넌트 목록 (depth 0인 요소만, 최대 10개)
  const topLevelElements = uiElements.filter((e) => !e.tagName.startsWith("div") && !e.tagName.startsWith("span"));
  if (topLevelElements.length > 0) {
    sections.push("### 🎨 주요 UI 컴포넌트");
    const displayElements = topLevelElements.slice(0, 10);
    for (const element of displayElements) {
      const attrCount = element.attributes.length;
      const childrenInfo = element.children.length > 0 ? ` (자식: ${element.children.length}개)` : "";
      const conditionalInfo = element.conditionalContext ? ` [조건부]` : "";
      const mapInfo = element.mapContext ? ` [map]` : "";

      sections.push(`- **\`<${element.tagName}>\`** - ${attrCount}개 속성${childrenInfo}${conditionalInfo}${mapInfo}`);
    }
    if (topLevelElements.length > 10) {
      sections.push(`- _(... 외 ${topLevelElements.length - 10}개 컴포넌트)_`);
    }
    sections.push("");
  }

  // 조건부 렌더링 상세
  if (conditionalElements.length > 0) {
    sections.push("### 🔀 조건부 렌더링");
    for (const element of conditionalElements.slice(0, 5)) {
      const ctx = element.conditionalContext!;
      sections.push(`- **\`<${element.tagName}>\`** - ${ctx.type} 패턴`);
      sections.push(`  - 조건: \`${ctx.condition}\``);
      sections.push(`  - 위치: Line ${element.location.split(":")[0]}`);
    }
    if (conditionalElements.length > 5) {
      sections.push(`- _(... 외 ${conditionalElements.length - 5}개)_`);
    }
    sections.push("");
  }

  // map 렌더링 상세
  if (mapElements.length > 0) {
    sections.push("### 🔁 반복 렌더링 (map)");
    for (const element of mapElements.slice(0, 5)) {
      const mapCtx = element.mapContext!;
      sections.push(`- **\`<${element.tagName}>\`**`);
      sections.push(`  - 배열: \`${mapCtx.arrayExpression}\``);
      sections.push(`  - 아이템 변수: \`${mapCtx.itemVariable}\``);
      sections.push(`  - 위치: Line ${element.location.split(":")[0]}`);
    }
    if (mapElements.length > 5) {
      sections.push(`- _(... 외 ${mapElements.length - 5}개)_`);
    }
    sections.push("");
  }

  // 스타일링 패턴 요약
  const styledElements = uiElements.filter((e) => e.styling.className || e.styling.inlineStyle);
  if (styledElements.length > 0) {
    const dynamicStyled = styledElements.filter((e) => e.styling.isDynamic);
    sections.push("### 🎨 스타일링 패턴");
    sections.push(`- **스타일링 사용**: ${styledElements.length}개 요소`);
    if (dynamicStyled.length > 0) {
      sections.push(`- **동적 className**: ${dynamicStyled.length}개 요소`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

function generatePropsSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  const props = analysis.props;

  if (!props.interface) {
    return "⚠️ Props 인터페이스가 정의되지 않았습니다.";
  }

  const sections: string[] = [];

  // 인터페이스 정보
  sections.push(`### 📋 Props 인터페이스: \`${props.interface.name}\``);
  sections.push("");

  if (props.interface.hasGeneric) {
    sections.push(`**Generic 타입**: \`<${props.interface.genericParams?.join(", ")}>\``);
    sections.push("");
  }

  // Props 목록
  sections.push(`**총 ${props.interface.properties.length}개 Props**:`);
  sections.push("");

  for (const prop of props.interface.properties) {
    const optionalMark = prop.optional ? "?" : "";
    const defaultInfo = prop.defaultValue ? ` = ${prop.defaultValue}` : "";

    sections.push(`#### \`${prop.name}${optionalMark}: ${prop.type}\`${defaultInfo}`);

    if (prop.jsDoc) {
      sections.push(`- **설명**: ${prop.jsDoc}`);
    }

    // 사용 위치
    const usage = props.usage.find((u) => u.propName === prop.name);
    if (usage && usage.locations.length > 0) {
      const locationCount = usage.locations.length;
      const firstLocations = usage.locations.slice(0, 3).join(", ");
      const moreInfo = locationCount > 3 ? ` _(외 ${locationCount - 3}개 위치)_` : "";
      sections.push(`- **사용 위치** (${locationCount}회): ${firstLocations}${moreInfo}`);
    } else {
      sections.push(`- **사용 위치**: 미사용`);
    }

    sections.push("");
  }

  // DI 주입 정보
  if (props.diInjections && props.diInjections.length > 0) {
    sections.push("### 💉 Dependency Injection");
    sections.push("");
    sections.push("**withInjectables로 주입된 의존성**:");
    sections.push("");

    for (const di of props.diInjections) {
      sections.push(`- \`${di.injectable}\``);
    }

    sections.push("");
  }

  return sections.join("\n");
}

function generateBusinessLogicSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  const functions = analysis.businessLogic;

  if (functions.length === 0) {
    return "⚠️ 비즈니스 로직 함수가 없습니다.";
  }

  const sections: string[] = [];

  // 요약 통계
  sections.push("### 📊 요약 통계");
  sections.push(`- **총 함수 개수**: ${functions.length}개`);

  const asyncFunctions = functions.filter((f) => f.isAsync);
  if (asyncFunctions.length > 0) {
    sections.push(`- **비동기 함수**: ${asyncFunctions.length}개`);
  }

  const usedFunctions = functions.filter((f) => f.usageCount > 0);
  sections.push(`- **사용된 함수**: ${usedFunctions.length}개`);

  sections.push("");

  // 함수 목록 (최대 10개)
  sections.push("### 🔧 함수 목록");
  sections.push("");

  const displayFunctions = functions.slice(0, 10);

  for (const func of displayFunctions) {
    const asyncMark = func.isAsync ? " `[async]`" : "";
    const usageMark = func.usageCount > 0 ? ` - **사용** (${func.usageCount}회)` : " - **미사용**";

    sections.push(`#### \`${func.name}\`${asyncMark}`);
    sections.push(`- **타입**: ${func.type}`);
    sections.push(`- **위치**: ${func.location}`);
    sections.push(`- **시그니처**: \`${func.signature}\``);
    sections.push(usageMark);

    // 코드 미리보기 (첫 3줄)
    const codeLines = func.code.split("\n").slice(0, 3);
    const codePreview = codeLines.join("\n");
    const hasMore = func.code.split("\n").length > 3;

    sections.push("```typescript");
    sections.push(codePreview);
    if (hasMore) {
      sections.push("// ...");
    }
    sections.push("```");
    sections.push("");
  }

  if (functions.length > 10) {
    sections.push(`_... 외 ${functions.length - 10}개 함수_`);
    sections.push("");
  }

  return sections.join("\n");
}

function generateHooksSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  if (!profile.hooks) {
    return "⚠️ Hooks 정보 없음";
  }

  // TODO: Step 2-3에서 구현
  return `
### React Hooks 요약
- **useState**: ${profile.hooks.useState}개
- **useEffect**: ${profile.hooks.useEffect}개
- **useMemo**: ${profile.hooks.useMemo}개
- **useCallback**: ${profile.hooks.useCallback}개
- **useRef**: ${profile.hooks.useRef}개
- **Custom Hooks**: ${profile.hooks.custom.length > 0 ? profile.hooks.custom.join(", ") : "없음"}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateLifecycleSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  if (!profile.lifecycle) {
    return "⚠️ Lifecycle 정보 없음";
  }

  // TODO: Step 2-3에서 구현
  return `
### Lifecycle Methods 요약
- **메서드 목록**: ${profile.lifecycle.methods.length > 0 ? profile.lifecycle.methods.join(", ") : "없음"}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateMobXSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### MobX 패턴 요약
- **observer HOC**: 사용 중
- **State 관리**: Props를 통한 주입 (DI 패턴)

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateStateSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### State 관리 요약
- **타입**: ${profile.stateManagement.type}
- **개수**: ${profile.stateManagement.count}개

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateEventHandlersSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### 이벤트 핸들러 요약
- **총 개수**: ${profile.eventHandlers.count}개
- **타입**: ${profile.eventHandlers.types.join(", ")}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateConditionalRenderingSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### 조건부 렌더링 요약
- **감지됨**: ${profile.uiPatterns.hasConditionalRendering ? "예 (&&, ternary)" : "아니오"}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateMapRenderingSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### 반복 렌더링 요약
- **감지됨**: ${profile.uiPatterns.hasMapRendering ? "예 (.map())" : "아니오"}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateStylingSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### 스타일링 요약
- **타입**: ${profile.styling.type}
- **Dynamic Classes**: ${profile.styling.hasDynamicClasses ? "사용 (cssNames, cn 등)" : "미사용"}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

function generateExternalLibrariesSection(analysis: AnalysisResult, profile: ComponentProfile): string {
  // TODO: Step 2-3에서 구현
  return `
### External Libraries 요약
- **라이브러리**: ${profile.externalLibraries.join(", ")}

📝 **상세 분석은 Step 2-3에서 구현 예정**
`;
}

// ============================================
// 🧪 테스트용 메인 함수
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("사용법: pnpm tsx scripts/ts-morph-universal-extractor.ts <source-file> [output-file]");
    console.error("\n예시:");
    console.error(
      "  pnpm tsx scripts/ts-morph-universal-extractor.ts packages/core/src/renderer/components/layout/sidebar.tsx",
    );
    console.error(
      "  pnpm tsx scripts/ts-morph-universal-extractor.ts packages/core/src/renderer/components/layout/sidebar.tsx output.md",
    );
    process.exit(1);
  }

  const sourceFilePath = path.resolve(process.cwd(), args[0]);
  const outputFilePath = args[1] ? path.resolve(process.cwd(), args[1]) : null;

  if (!fs.existsSync(sourceFilePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${sourceFilePath}`);
    process.exit(1);
  }

  console.log(`\n🔍 분석 시작: ${path.relative(process.cwd(), sourceFilePath)}\n`);

  // ts-morph Project 생성
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  });

  const sourceFile = project.addSourceFileAtPath(sourceFilePath);

  // ============================================
  // Step 2-1: 컴포넌트 프로파일링
  // ============================================
  const profile = profileComponent(sourceFile);

  console.log("📊 Component Profile:");
  console.log(`  - 타입: ${profile.type}`);
  console.log(`  - 복잡도: ${profile.complexity}`);
  console.log(`  - State 관리: ${profile.stateManagement.type}`);
  console.log(`  - 아키타입: ${profile.archetype}`);
  console.log("");

  // ============================================
  // Step 2-3: 핵심 분석 모듈 실행
  // ============================================
  console.log("📋 핵심 분석 모듈 실행 중...\n");

  // Step 2-3-1: UI 요소 분석
  console.log("  - UI 요소 분석 중...");
  const uiElements = analyzeUIElements(sourceFile, profile);
  console.log(`    ✓ ${uiElements.length}개 JSX 요소 분석 완료`);

  // Step 2-3-2: Props/DI 분석
  console.log("  - Props/DI 분석 중...");
  const props = analyzeProps(sourceFile, profile);
  const propsCount = props.interface?.properties.length || 0;
  const diCount = props.diInjections?.length || 0;
  console.log(`    ✓ ${propsCount}개 Props, ${diCount}개 DI 주입 분석 완료`);

  // Step 2-3-3: 비즈니스 로직 분석
  console.log("  - 비즈니스 로직 분석 중...");
  const businessLogic = analyzeBusinessLogic(sourceFile, profile);
  const asyncCount = businessLogic.filter((f) => f.isAsync).length;
  console.log(`    ✓ ${businessLogic.length}개 함수 분석 완료 (비동기: ${asyncCount}개)`);

  // 🔥 임시: 나머지 분석 모듈은 빈 값 (Step 2-3-4 이후에 구현 예정)
  const analysis: AnalysisResult = {
    profile,
    uiElements,
    props,
    businessLogic,
    state: {},
    eventHandlers: [],
    hooks: [],
    lifecycle: [],
    conditionalRendering: [],
    mapRendering: [],
    styling: {},
    di: {},
  };

  // ============================================
  // Step 2-2: 동적 섹션 생성
  // ============================================
  console.log("\n📋 동적 섹션 생성 중...\n");

  const markdown = generateDynamicSections(profile, analysis);

  // ============================================
  // 결과 출력 또는 파일 저장
  // ============================================
  if (outputFilePath) {
    fs.writeFileSync(outputFilePath, markdown, "utf-8");
    console.log(`✅ 분석 결과 저장: ${path.relative(process.cwd(), outputFilePath)}`);
  } else {
    console.log("📄 Markdown 출력:\n");
    console.log(markdown);
  }

  console.log("\n✅ 분석 완료");
  console.log("\n📝 참고: 현재는 Step 2-2까지 구현되어 있어서 섹션별 상세 분석은 요약만 표시됩니다.");
  console.log("   Step 2-3 (6개 분석 모듈 구현) 후 실제 코드 추출이 포함됩니다.\n");
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  });
}
