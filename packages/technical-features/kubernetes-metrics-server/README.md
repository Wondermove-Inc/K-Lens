# Kubernetes Metrics Server Integration

이 패키지는 SkuberPlus에서 Kubernetes Metrics Server를 Prometheus의 대안으로 사용할 수 있도록 하는 기능을 제공합니다.

## 개요

Kubernetes Metrics Server는 클러스터 내의 노드와 Pod에서 리소스 사용량 메트릭을 수집하는 클러스터 전역 구성 요소입니다. 이 패키지는 Metrics Server API를 통해 얻은 데이터를 Prometheus 호환 형식으로 변환하여 SkuberPlus의 기존 메트릭 UI와 호환되도록 합니다.

## 주요 기능

### 지원하는 메트릭

**클러스터 레벨 메트릭:**
- `cpuUsage` - 클러스터 전체 CPU 사용량
- `memoryUsage` - 클러스터 전체 메모리 사용량
- `workloadMemoryUsage` - 워크로드 메모리 사용량

**노드 레벨 메트릭:**
- `cpuUsage` - 노드별 CPU 사용량
- `memoryUsage` - 노드별 메모리 사용량

**Pod 레벨 메트릭:**
- `cpuUsage` - Pod CPU 사용량 (Method 1: PodStore 시뮬레이션)
- `memoryUsage` - Pod 메모리 사용량 (Method 1: PodStore 시뮬레이션)

### 지원하지 않는 메트릭

다음 메트릭들은 Kubernetes Metrics Server에서 제공하지 않으므로 UI에서 숨김 처리됩니다:
- 용량 관련 메트릭 (memoryCapacity, cpuCapacity 등)
- 요청/제한 관련 메트릭 (memoryRequests, cpuLimits 등)
- 네트워크 메트릭
- 파일시스템 메트릭
- Pod 개수 관련 메트릭

## 아키텍처

### 핵심 컴포넌트

1. **MetricsServerProvider** - Prometheus 공급자 시스템과의 통합점
2. **MetricsAdapter** - Kubernetes 메트릭을 Prometheus 형식으로 변환
3. **MetricsServerApi** - Kubernetes Metrics Server API와의 인터페이스
4. **MetricsServerDetection** - 클러스터에서 Metrics Server 가용성 감지

### 데이터 플로우

```
Kubernetes Metrics Server
    ↓ (metrics.k8s.io/v1beta1)
MetricsServerApi
    ↓ (NodeMetrics, PodMetrics 객체)
MetricsAdapter
    ↓ (Prometheus 호환 형식)
SkuberPlus UI 컴포넌트
```

## 사용법

### UI에서 설정

1. **클러스터 설정** → **메트릭스** 섹션으로 이동
2. **"Auto Detect Kubernetes Metrics Server"** 옵션 선택
3. 설정 저장

### 프로그래밍 방식으로 사용

```typescript
import { MetricsAdapter } from '@skuberplus/kubernetes-metrics-server';
import { CoreV1Api } from '@skuberplus/kubernetes-client-node';

const apiClient = kubeConfig.makeApiClient(CoreV1Api);
const adapter = new MetricsAdapter(apiClient);

// 클러스터 메트릭 조회
const clusterMetrics = await adapter.getClusterMetrics({
  category: 'cluster',
  nodes: 'node1|node2'
});

// Pod 메트릭 조회
const podMetrics = await adapter.executeQuery('cpuUsage', {
  category: 'pods',
  namespace: 'default',
  pods: 'my-pod'
});
```

## 메트릭 처리 방식

### Method 1: 실제 Kubernetes Metrics Server API (현재 구현)

CPU와 메모리 메트릭 모두 실제 Kubernetes Metrics Server API를 사용합니다:

- **장점**: 일관된 메트릭 데이터 제공으로 개요와 상세 화면 간 값 일치
- **현재 상태**: 실제 CustomObjectsApi를 통한 metrics.k8s.io API 호출
- **API 엔드포인트**: `/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods`
- **로그**: `🔥 [METHOD 1] Using REAL Kubernetes Metrics API for {CPU|Memory}`

### 향후 개선사항

1. **실시간 메트릭**: 현재는 단일 시점 메트릭, 향후 시계열 데이터 지원
2. **캐싱 메커니즘**: 빈번한 API 호출을 줄이기 위한 메트릭 캐싱
3. **노드 메트릭 실제 API**: 현재는 NodeMetrics만 실제 API 사용, Pod 메트릭도 같은 방식 적용

## 오류 처리

### Graceful Degradation

시스템은 다음과 같이 오류를 우아하게 처리합니다:

```typescript
// 지원하는 메트릭 - 실패 시 오류 발생
if (queryName === 'cpuUsage' || queryName === 'memoryUsage') {
  // 실제 메트릭 조회 시도
  // 실패 시 사용자에게 오류 표시
}

// 지원하지 않는 메트릭 - 조용히 숨김 처리
console.warn(`[METRICS-SERVER] Metric ${queryName} not available - hiding from UI`);
return [[timestamp, '0']]; // UI에서 숨김
```

### 로그 레벨

- **경고**: 지원하지 않는 메트릭에 대한 정보 (`console.warn`)
- **정보**: 테스트 방식에 대한 정보 (`console.log`)

## 개발자 가이드

### 프로젝트 구조

```
packages/technical-features/kubernetes-metrics-server/
├── src/
│   ├── index.ts                              # 패키지 진입점
│   ├── feature.ts                            # 기능 정의
│   ├── metrics-server-provider.injectable.ts # 공급자 등록
│   ├── metrics-adapter.ts                    # 핵심 변환 로직
│   ├── metrics-server-api.ts                 # Kubernetes API 인터페이스
│   └── metrics-server-detection.ts           # 서버 감지 로직
└── package.json
```

### 빌드 및 테스트

```bash
# 프로젝트 루트에서
pnpm build:dev    # 개발 빌드
pnpm dev          # 개발 서버 시작
pnpm test:unit    # 단위 테스트 실행
```

### 디버깅

개발 중에는 다음 로그를 통해 메트릭 처리 상태를 확인할 수 있습니다:

```
🔥 [METHOD 1] Using REAL Kubernetes Metrics API for CPU calculation
🔥 Using REAL CustomObjectsApi for metrics.k8s.io API - namespace: default
🔥 [METHOD 1] REAL Kubernetes API CPU: 0.05 cores (from 3 pods)
🔥 [METHOD 1] Using REAL Kubernetes Metrics API for Memory calculation
🔥 [METHOD 1] REAL Kubernetes API Memory: 134217728 bytes (from 3 pods)

[METRICS-SERVER] Metric memoryCapacity not available - hiding from UI
[METRICS-SERVER] Unsupported pod metric fsUsage - hiding from UI
```

## 알려진 제한사항

1. **시계열 데이터 부족**: 현재 시점의 메트릭만 제공 (Prometheus는 시계열 제공)
2. **용량 정보 없음**: 노드 용량 정보는 별도 Node API 구현 필요
3. **네트워크/파일시스템**: Metrics Server는 기본 CPU/메모리만 제공
4. **Fallback 메커니즘**: CustomObjectsApi가 없는 경우에만 fallback API 사용

## 기여하기

1. 새로운 메트릭 지원 추가 시 `executeQuery` 메서드 수정
2. 에러 처리는 graceful degradation 원칙 준수
3. 지원하지 않는 메트릭은 경고 로그와 함께 빈 값 반환
4. 모든 변경사항은 해당 로그 메시지와 함께 문서 업데이트