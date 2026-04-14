# Archived Scripts

## analyze-source-features-bash-deprecated.sh

**아카이브 사유**:
- Bash + ripgrep 기반 접근의 한계 (Props 추출 정확도 70%)
- ts-morph 기반 TypeScript 스크립트로 대체 (정확도 100%)

**아카이브 일시**: 2025-10-20

**대체 스크립트**: `scripts/analyze-source-features.ts`

**주요 문제점**:
1. **Props 인터페이스 속성 추출 부정확** (부분 문자열, 함수 본문 포함)
   - 예: `ter` (navigateToAddCluster에서), `try` (catalogRegistry에서)
   - 예: `const handleSyncKubeconfig = () => {` (함수 본문)
2. **타입 정보 추출 불가** (정규표현식 한계)
3. **MobX, React 훅 분석 어려움** (복잡한 패턴)
4. **확장성 부족** (새로운 패턴 추가 시 정규표현식 복잡도 증가)

**개선 결과** (ts-morph 버전):
- Props 추출 정확도: 70% → 100%
- 타입 정보: 추출 불가 → 정확히 추출
- DI 주입 분석: 95% → 100%
- MobX observer: 감지 어려움 → 정확히 감지
- React 훅: 감지 불가 → 감지 가능

**롤백 방법**:

이 스크립트는 삭제되지 않고 보관되어 있으므로, 필요 시 다시 사용 가능합니다:

```bash
# 롤백 (필요 시)
mv scripts/archive/analyze-source-features-bash-deprecated.sh scripts/analyze-source-features.sh
```

**참고 문서**:
- ts-morph 전환 계획: `docs/plan/active/ts-morph-plan.md`
- 스크립트 개발 계획: `docs/plan/shadcn-통합및기능검증-script-plan.md`
- 메인 마이그레이션 계획: `docs/plan/active/shadcn-통합및기능검증-plan.md`

---

## ts-morph-universal-extractor-before-refactoring.ts

**아카이브 일시**: 2025-10-21

**파일 정보**:
- 원본 파일명: `ts-morph-universal-extractor.ts.backup`
- 파일 크기: 2065 lines

**아카이브 사유**:
범용 추출 시스템 구축을 위한 모듈 분리 리팩토링 진행

### Before (리팩토링 전)
```
scripts/ts-morph-universal-extractor.ts  (2065 lines)
├── Types (interfaces, types)
├── Profiler (12 detection functions)
├── Analyzers (UI, Props, Business Logic)
├── Section configs
├── Generators
└── main()
```

### After (리팩토링 후)
```
scripts/
├── ts-morph-universal-extractor.ts      (637 lines, -69.2%)
├── ts-morph/
│   ├── types.ts                        (177 lines)
│   ├── profiler.ts                     (580 lines)
│   └── analyzers/
│       ├── ui-elements.ts              (363 lines)
│       ├── props-di.ts                 (228 lines)
│       ├── business-logic.ts           (179 lines)
│       ├── hooks.ts
│       ├── event-handlers.ts
│       └── state.ts
```

### 개선 효과
- **가독성 향상**: 단일 파일 2065 lines → 모듈별 분리
- **유지보수성 향상**: 각 모듈 독립적으로 수정 가능
- **재사용성 향상**: 분석 모듈을 다른 스크립트에서도 사용 가능

### 롤백 방법
```bash
# 필요 시 복구
cp scripts/archive/ts-morph-universal-extractor-before-refactoring.ts \
   scripts/ts-morph-universal-extractor.ts
```

### 관련 계획 문서
- `docs/plan/active/ts-morph-universal-extraction-system-plan.md` (Phase 2-1)

---

**Last Updated**: 2025-10-21
