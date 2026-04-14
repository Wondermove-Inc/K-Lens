# DI 패턴 가이드

## 기술 스택

`@ogre-tools/injectable` + MobX

## 기본 구조

```typescript
import { getInjectable } from "@ogre-tools/injectable";

const myFeatureInjectable = getInjectable({
  id: "my-feature",                    // kebab-case, 고유
  instantiate: (di) => {
    const dep = di.inject(depInjectable);
    return new MyFeature(dep);
  },
  decorable: false,                    // 선택: 데코레이터 지원
  injectionToken: someToken,           // 선택: 그룹 등록용
});

export default myFeatureInjectable;
```

## 주요 패턴

### 1. 기본 주입
```typescript
const dep = di.inject(injectable);
```

### 2. 다중 주입 (플러그인 패턴)
```typescript
const plugins = di.injectMany(injectionToken);
```

### 3. 팩토리 패턴
```typescript
instantiate: (di) => (args) => {
  const dep = di.inject(depInjectable);
  return dep.create(args);
}
```

### 4. MobX 반응성 통합
```typescript
instantiate: (di) => {
  const state = observable({ count: 0 });
  return {
    state,
    increment: action(() => { state.count++; }),
    doubled: computed(() => state.count * 2),
  };
}
```

## 파일 규칙

| 항목 | 규칙 |
|------|------|
| 파일명 | `feature-name.injectable.ts` (kebab-case) |
| ID | `"feature-name"` (kebab-case, 고유) |
| Export | `export default injectableName` |
| 구조 | imports → types → getInjectable() → export |

## 테스트에서 DI 사용

```typescript
let di: DiContainer;

beforeEach(() => {
  di = createContainer("test");
  registerInjectableReact(di);
  registerMobX(di);
  runInAction(() => registerFeature(di, featureName));
  di.override(tokenToOverride, mockImpl);  // 의존성 모킹
});
```
