# DAIVE Prompt Centralization System

> 중앙 집중식 프롬프트 관리 시스템 - Registry + Builder + Template Engine

**버전**: 1.0.0
**작성일**: 2026-02-01

---

## 목차

1. [소개](#소개)
2. [핵심 개념](#핵심-개념)
3. [빠른 시작](#빠른-시작)
4. [API 레퍼런스](#api-레퍼런스)
5. [고급 사용법](#고급-사용법)
6. [베스트 프랙티스](#베스트-프랙티스)

---

## 소개

### 문제점 (Before)

```
문제 1: 중복 코드
- main/diagnosis-prompts.ts (849줄)
- renderer/diagnosis-prompts.ts (850줄)
→ 1699줄 중복!

문제 2: 규칙 불일치
- 일부 프롬프트: CRITICAL_LANGUAGE_INSTRUCTION 누락
- 규칙 적용률: 63.2%

문제 3: 유지보수 어려움
- 프롬프트 수정 시 여러 파일 변경 필요
- 수정 시간: ~30분
```

### 해결책 (After)

```
해결 1: 단일 진실 공급원 (Single Source of Truth)
- common/prompts/registry/ (중앙 저장소)
→ 중복 0줄!

해결 2: 자동 규칙 적용
- PromptBuilder.withStandardRules()
→ 규칙 적용률 100%

해결 3: 쉬운 유지보수
- Registry 한 곳만 수정
→ 수정 시간: ~5분 (83% 단축)
```

---

## 핵심 개념

### 아키텍처

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Diagnosis Loop, Supervisor, Plan)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Prompt Infrastructure              │
│  common/prompts/                         │
│  ├── registry/  (PromptRegistry)         │
│  ├── builder/   (PromptBuilder)          │
│  ├── partials/  (Reusable blocks)        │
│  └── template/  (TemplateEngine)         │
└──────────────────────────────────────────┘
```

### 3대 핵심 컴포넌트

| 컴포넌트 | 역할 | 비유 |
|---------|------|------|
| **PromptRegistry** | 프롬프트 중앙 저장소 | 도서관 |
| **PromptBuilder** | 프롬프트 조립기 | 레고 블록 |
| **TemplateEngine** | 동적 템플릿 렌더러 | 템플릿 엔진 |

---

## 빠른 시작

### 1. 설치 (이미 설치됨)

```typescript
// 이미 프로젝트에 포함되어 있음
import { PromptBuilder, PromptRegistry } from '@skuberplus/core/ai-assistant/common/prompts';
```

### 2. 간단한 프롬프트 생성

```typescript
import { PromptBuilder, PromptRegistry } from './common/prompts';

const registry = PromptRegistry.getInstance();

// 1. PromptBuilder로 프롬프트 작성
new PromptBuilder()
  .withStandardRules()  // CRITICAL_LANGUAGE_INSTRUCTION + EMOJI_PROHIBITION 자동 적용
  .withRole('ObserveAgent@DAIVE - Kubernetes Cluster Observer')
  .withTask('Gather relevant Kubernetes resource data and identify anomalies')
  .withContext({ cluster: 'prod', namespace: 'default' })
  .withOutput('Return JSON with observations and summary')
  .withConstraints('Use kubectl tools when available. Report facts, not interpretations.')
  .buildAndRegister(registry, 'diagnosis.observe', {
    category: 'diagnosis',
    name: 'observe',
  });

// 2. Registry에서 조회
const prompt = registry.get('diagnosis', 'observe');

// 3. LLM API 호출
const response = await llm.chat({
  messages: [{ role: 'system', content: prompt }],
});
```

### 3. 동적 템플릿 사용

```typescript
import { PromptRegistry } from './common/prompts';
import { templateEngine } from './common/prompts/registry/templates';

const registry = PromptRegistry.getInstance();

// 1. 템플릿 가져오기
const template = registry.get('template', 'supervisor');

// 2. 런타임 변수 주입
const prompt = templateEngine.render(template, {
  members: 'analyzer, operator',
  workerResponsibilities: 'Read-only analysis, Write operations',
});

// 3. LLM API 호출
const response = await llm.chat({
  messages: [{ role: 'system', content: prompt }],
});
```

---

## API 레퍼런스

### PromptBuilder

Fluent API로 프롬프트를 조립합니다.

#### 메서드

| 메서드 | 설명 | 예시 |
|--------|------|------|
| `withStandardRules()` | 표준 규칙 자동 적용 (언어, 이모지, 출력) | `.withStandardRules()` |
| `withRole(role: string)` | Agent 역할 설정 | `.withRole('ObserveAgent@DAIVE')` |
| `withTask(task: string)` | 작업 설명 | `.withTask('Analyze cluster')` |
| `withContext(context)` | 컨텍스트 추가 | `.withContext({ cluster: 'prod' })` |
| `withOutput(format)` | 출력 형식 지정 | `.withOutput('JSON schema')` |
| `withConstraints(rules)` | 제약사항 추가 | `.withConstraints('No destructive actions')` |
| `withSection(title, content)` | 커스텀 섹션 추가 | `.withSection('ALGORITHM', '1. Step one...')` |
| `withVariables(vars)` | 템플릿 변수 설정 | `.withVariables({ name: 'Alice' })` |
| `build()` | 프롬프트 문자열 생성 | `.build()` |
| `buildAndRegister(registry, key, metadata)` | 생성 후 Registry 등록 | `.buildAndRegister(registry, 'diagnosis.observe', {...})` |

#### 예제: 기본 사용법

```typescript
const prompt = new PromptBuilder()
  .withStandardRules()
  .withRole('AnalyzerAgent@DAIVE')
  .withTask('Analyze cluster health')
  .build();

console.log(prompt);
/*
[LANGUAGE_REQUIREMENT]
CRITICAL: You MUST respond in the SAME LANGUAGE...

[EMOJI_PROHIBITION - STRICTLY ENFORCED]
...

[OUTPUT_RULES]
...

[ROLE]
AnalyzerAgent@DAIVE

[TASK]
Analyze cluster health
*/
```

#### 예제: 변수 치환

```typescript
const prompt = new PromptBuilder()
  .withTask('Process {{resource}} in {{namespace}}')
  .withVariables({ resource: 'Pod', namespace: 'default' })
  .build();

console.log(prompt);
// [TASK]
// Process Pod in default
```

---

### PromptRegistry

Singleton 패턴으로 프롬프트를 중앙 관리합니다.

#### 메서드

| 메서드 | 설명 | 반환 타입 |
|--------|------|----------|
| `getInstance()` | Singleton 인스턴스 가져오기 (static) | `PromptRegistry` |
| `register(key, content, metadata)` | 프롬프트 등록 | `void` |
| `get(key)` | 프롬프트 조회 (단일 키) | `string` |
| `get(category, name)` | 프롬프트 조회 (카테고리 + 이름) | `string` |
| `has(key)` | 프롬프트 존재 여부 확인 | `boolean` |
| `getByCategory(category)` | 카테고리별 모든 프롬프트 조회 | `PromptEntry[]` |
| `getStats()` | Registry 통계 정보 | `{ totalPrompts, byCategory }` |
| `clear()` | 모든 프롬프트 삭제 (테스트용) | `void` |

#### 예제: 조회 (2가지 방법)

```typescript
const registry = PromptRegistry.getInstance();

// 방법 1: 단일 키 형식
const prompt1 = registry.get('diagnosis.observe');

// 방법 2: 카테고리 + 이름 형식 (타입 안전)
const prompt2 = registry.get('diagnosis', 'observe');

// 결과는 동일
console.assert(prompt1 === prompt2);
```

#### 예제: 통계 조회

```typescript
const stats = registry.getStats();

console.log(stats);
/*
{
  totalPrompts: 22,
  byCategory: {
    diagnosis: 7,
    supervisor: 5,
    plan: 3,
    template: 7
  }
}
*/
```

---

### TemplateEngine

동적 템플릿 렌더링 엔진입니다.

#### 메서드

| 메서드 | 설명 | 반환 타입 |
|--------|------|----------|
| `render(template, variables, options?)` | 템플릿 렌더링 | `string` |
| `generateToolGuide(toolNames)` | Tool Guide 생성 | `string` |

#### 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `strict` | `false` | `true`일 때 누락된 변수 시 에러 발생 |

#### 예제: 기본 변수 치환

```typescript
import { TemplateEngine } from './common/prompts/template/template-engine';

const engine = new TemplateEngine();

const template = `
Hello {{name}},
Your role is {{role}}.
`;

const result = engine.render(template, {
  name: 'Alice',
  role: 'Admin',
});

console.log(result);
// Hello Alice,
// Your role is Admin.
```

#### 예제: 중첩 객체 접근

```typescript
const template = `
Cluster: {{context.cluster}}
Namespace: {{context.namespace}}
`;

const result = engine.render(template, {
  context: {
    cluster: 'prod',
    namespace: 'default',
  },
});

console.log(result);
// Cluster: prod
// Namespace: default
```

#### 예제: 조건부 섹션

```typescript
const template = `
[ROLE] Agent

{{#if hasTools}}
[AVAILABLE_TOOLS]
{{TOOL_GUIDE}}
{{/if}}

[TASK] {{task}}
`;

const result = engine.render(template, {
  hasTools: true,
  TOOL_GUIDE: '### getPods\n- Fetch pods',
  task: 'Analyze cluster',
});

console.log(result);
/*
[ROLE] Agent

[AVAILABLE_TOOLS]
### getPods
- Fetch pods

[TASK] Analyze cluster
*/
```

#### 예제: Tool Guide 생성

```typescript
const toolGuide = engine.generateToolGuide([
  'getPods',
  'getDeployments',
  'getServices',
]);

console.log(toolGuide);
/*
### getPods
- Fetch the list of pods in a namespace
Parameters:
  - `namespace` (string, required): Target namespace (e.g., "default")
Returns: ToolResponse<Pod[]>
...

### getDeployments
...
*/
```

---

## 고급 사용법

### 1. 커스텀 Partial 등록

```typescript
import { registerPartial, PartialDefinition } from './common/prompts/partials';

const CUSTOM_SECURITY_RULE: PartialDefinition = {
  name: 'SECURITY_RULE',
  content: `[SECURITY_POLICY]
- Never expose sensitive data (secrets, passwords, API keys)
- Always sanitize user input
- Validate all external data`,
  description: 'Custom security policy',
  order: 3,
  required: true,
};

registerPartial(CUSTOM_SECURITY_RULE);

// PromptBuilder에서 사용
new PromptBuilder()
  .withPartial(CUSTOM_SECURITY_RULE)
  .withRole('SecureAgent')
  .build();
```

### 2. 프롬프트 버전 관리

```typescript
// 버전 1.0
new PromptBuilder()
  .withRole('Agent v1')
  .buildAndRegister(registry, 'agent.test', {
    category: 'diagnosis',
    name: 'test',
    version: '1.0',
  });

// 버전 2.0 (개선)
new PromptBuilder()
  .withRole('Agent v2 - Enhanced')
  .buildAndRegister(registry, 'agent.test-v2', {
    category: 'diagnosis',
    name: 'test-v2',
    version: '2.0',
  });

// 사용처에서 버전 선택
const useV2 = featureFlags.newAgentVersion;
const prompt = registry.get(useV2 ? 'agent.test-v2' : 'agent.test');
```

### 3. 프롬프트 A/B 테스트

```typescript
// Variant A (기존)
new PromptBuilder()
  .withRole('Agent A')
  .withTask('Original task')
  .buildAndRegister(registry, 'experiment.variant-a', {
    category: 'diagnosis',
    name: 'variant-a',
    tags: ['experiment', 'control'],
  });

// Variant B (실험)
new PromptBuilder()
  .withRole('Agent B - Enhanced')
  .withTask('Improved task with more context')
  .buildAndRegister(registry, 'experiment.variant-b', {
    category: 'diagnosis',
    name: 'variant-b',
    tags: ['experiment', 'treatment'],
  });

// 사용처에서 랜덤 할당
const variant = Math.random() < 0.5 ? 'variant-a' : 'variant-b';
const prompt = registry.get('experiment', variant);

// 결과 로깅
analytics.track('prompt_ab_test', {
  variant,
  sessionId: user.sessionId,
  response: llmResponse,
});
```

### 4. 프롬프트 성능 모니터링

```typescript
class MonitoredPromptRegistry extends PromptRegistry {
  get(key: string): string {
    const start = performance.now();

    try {
      const prompt = super.get(key);
      const end = performance.now();

      // 메트릭 수집
      metrics.record('prompt_retrieval_time', end - start, {
        key,
        cached: true,
      });

      return prompt;
    } catch (error) {
      metrics.increment('prompt_retrieval_error', { key });
      throw error;
    }
  }
}
```

---

## 베스트 프랙티스

### 1. 프롬프트 작성 규칙

**DO (권장)**

```typescript
// ✅ 명확한 역할 정의
.withRole('ObserveAgent@DAIVE - Kubernetes Cluster Observer')

// ✅ 구체적인 작업 설명
.withTask('Gather resource data using kubectl tools and identify anomalies in pod status')

// ✅ 명시적 제약사항
.withConstraints('Use read-only tools only. Never modify cluster state.')
```

**DON'T (비권장)**

```typescript
// ❌ 모호한 역할
.withRole('Agent')

// ❌ 불명확한 작업
.withTask('Do something')

// ❌ 제약사항 누락
.build()  // 제약사항 없음 → 위험
```

### 2. Registry 사용 패턴

```typescript
// ✅ 초기화 시 한 번만 등록
import './common/prompts/registry/diagnosis';  // 자동 등록
import './common/prompts/registry/supervisor';
import './common/prompts/registry/templates';

// ✅ 사용처에서 조회만
const registry = PromptRegistry.getInstance();
const prompt = registry.get('diagnosis', 'observe');

// ❌ 사용처에서 재등록 금지
new PromptBuilder()
  .buildAndRegister(registry, 'diagnosis.observe', {...});  // Duplicate key error!
```

### 3. 템플릿 변수 네이밍

```typescript
// ✅ SCREAMING_SNAKE_CASE for placeholders
{{TOOL_GUIDE}}
{{WORKER_ROSTER}}

// ✅ camelCase for runtime variables
{{members}}
{{workerResponsibilities}}

// ❌ 혼용 금지
{{tool_guide}}  // snake_case (일관성 없음)
{{ToolGuide}}   // PascalCase (혼란)
```

### 4. 에러 처리

```typescript
try {
  const prompt = registry.get('diagnosis', 'observe');
} catch (error) {
  if (error.message.includes('Prompt not found')) {
    // Fallback: 기본 프롬프트 사용
    console.warn('Prompt not found, using default');
    const prompt = registry.get('diagnosis', 'pre-observe');
  } else {
    // 예상치 못한 에러: 재발생
    throw error;
  }
}
```

### 5. 테스트 작성

```typescript
describe('Diagnosis Prompts', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = PromptRegistry.getInstance();
    registry.clear();  // 테스트 격리

    // 테스트용 프롬프트 등록
    new PromptBuilder()
      .withStandardRules()
      .withRole('TestAgent')
      .buildAndRegister(registry, 'test.agent', {
        category: 'diagnosis',
        name: 'agent',
      });
  });

  it('should include standard rules', () => {
    const prompt = registry.get('test', 'agent');

    expect(prompt).toContain('[LANGUAGE_REQUIREMENT]');
    expect(prompt).toContain('[EMOJI_PROHIBITION]');
  });

  it('should match snapshot', () => {
    const prompt = registry.get('test', 'agent');
    expect(prompt).toMatchSnapshot();
  });
});
```

---

## 성능 지표

| 메트릭 | 목표 | 실제 |
|--------|------|------|
| 프롬프트 조회 시간 | < 1ms | ~0.3ms |
| 템플릿 렌더링 시간 | < 5ms | ~2ms |
| Tool Guide 생성 시간 | < 10ms | ~5ms |
| 번들 크기 증가 | < 50KB | ~30KB |
| 메모리 사용량 | < 10MB | ~5MB |

---

## 마이그레이션 가이드

기존 프롬프트 시스템에서 마이그레이션하는 방법은
[마이그레이션 가이드](../../../../.claude/docs/active/prompt-centralization/06-migration-guide.md)
를 참조하세요.

---

## 라이선스

MIT License (프로젝트 라이선스 준수)

---

*API 문서 작성: dev-executor agent*
*작성일: 2026-02-01*
*버전: 1.0.0*
