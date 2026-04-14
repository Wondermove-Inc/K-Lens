# 테스트 전략

## 기술 스택

- Jest 29.7 (maxWorkers: 2)
- React Testing Library + userEvent
- Turborepo (`pnpm test:unit` = `turbo run test:unit`)

## 테스트 유형

| 유형 | 파일 패턴 | 위치 |
|------|-----------|------|
| 유닛 테스트 | `*.test.ts`, `*.test.tsx` | `__tests__/` 또는 소스 옆 |
| 통합 테스트 | `*.integration.test.ts` | `__tests__/` |

## 테스트 패턴

### DI 컨테이너 기반 테스트

```typescript
describe("feature", () => {
  let di: DiContainer;

  beforeEach(() => {
    di = createContainer("test");
    registerInjectableReact(di);
    registerMobX(di);
    runInAction(() => registerFeature(di, featureName));
  });

  it("동작 검증", async () => {
    di.override(depInjectable, mockImpl);
    const feature = di.inject(featureInjectable);
    expect(feature.doSomething()).toBe(expected);
  });
});
```

### React 컴포넌트 테스트

```typescript
it("렌더링 검증", async () => {
  const user = userEvent.setup();
  const { getByText } = render(<Component />);
  await user.click(getByText("버튼"));
  expect(getByText("결과")).toBeInTheDocument();
});
```

## 규칙

1. 새 기능은 반드시 테스트 포함
2. 커버리지 80% 이상 유지
3. `di.override()`로 외부 의존성 모킹
4. `runInAction()`으로 MobX 상태 변경 래핑
5. `pnpm test:unit --bail`로 첫 실패 시 중단
