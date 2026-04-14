# 의존성 방향 규칙

## 레이어 계층

```
types → config → repo → service → runtime → ui
```

하위 레이어는 상위 레이어를 import할 수 없다.

## 패키지 의존성 구조

```
@skuberplus/core (최상위)
├── @skuberplus/business-features/*
├── @skuberplus/cluster-sidebar
├── @skuberplus/cluster-settings
├── @skuberplus/feature-core
├── @skuberplus/react-application
├── @skuberplus/application
└── @skuberplus/utility-features/*
```

### 규칙

1. **Core 중심**: `packages/core`가 모든 feature/domain 패키지에 의존
2. **순환 의존성 금지**: A → B → A 형태 불가
3. **Workspace 참조**: `"workspace:^"` 사용
4. **Feature-First**: 각 패키지는 `feature.ts`에서 feature 객체 정의

## DI 중립성

Injectable 파일은 구체적 구현에 의존하지 않는다. 추상화된 injection token을 통해 의존성 주입.

```typescript
// ✅ 올바른 의존성
const myInjectable = getInjectable({
  id: "my-feature",
  instantiate: (di) => {
    const dep = di.inject(abstractTokenInjectable); // 추상 토큰
    return new MyFeature(dep);
  },
});

// ❌ 잘못된 의존성
import { ConcreteClass } from "../upper-layer/concrete"; // 상위 레이어 직접 참조
```
