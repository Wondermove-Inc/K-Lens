# 모듈 경계

## 패키지 분류

| 패키지 | 역할 | 의존 방향 |
|--------|------|-----------|
| `packages/core/` | 핵심 로직, UI, K8s API | 모든 패키지 의존 가능 |
| `packages/business-features/` | UI 기능 (keyboard-shortcuts 등) | feature-core, react-application |
| `packages/technical-features/` | 메시징, 애플리케이션 코어 | feature-core |
| `packages/ui-components/` | 공유 UI 컴포넌트 | 없음 (leaf 패키지) |
| `packages/infrastructure/` | 빌드 설정 (webpack, jest, ts) | 없음 (도구) |
| `packages/utility-features/` | 유틸리티 함수 | 최소 의존 |
| `packages/kube-object/` | K8s 객체 타입 | 없음 (leaf 패키지) |
| `packages/transpilation/` | 외부 패키지 트랜스파일 | 없음 |

## 경계 규칙

1. **Leaf 패키지**는 다른 도메인 패키지에 의존하지 않는다
2. **Core**만 모든 패키지를 조합할 수 있다
3. **Feature 등록**: 각 패키지는 `feature.ts`에서 feature 객체 export
4. **패키지 간 통신**: injection token을 통해서만 (직접 import 금지)

## 프로세스 경계

| 프로세스 | 엔트리 포인트 | 역할 |
|----------|-------------|------|
| Main | `packages/core/src/main/` | Electron 메인, 시스템 API |
| Renderer | `packages/core/src/renderer/` | React UI |

Main ↔ Renderer 통신은 `packages/technical-features/messaging/` 패키지를 통해서만 수행.
