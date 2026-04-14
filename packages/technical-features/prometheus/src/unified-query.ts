/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { bytesSent } from "./provider";

/**
 * 🎯 목적: 통합 Prometheus 쿼리 생성기
 *
 * Operator 방식(kube_pod_info 조인)을 기본으로 사용하여 모든 Prometheus 설치 환경에서 호환되도록 함.
 *
 * 📝 주의사항:
 * - 이 쿼리 방식은 라벨 커스터마이징과 무관하게 동작
 * - 조인 연산으로 인해 약간의 성능 오버헤드가 있으나 DAIVE 용도에서는 무시 가능
 *
 * 🔄 변경이력:
 * - 2026-01-09: 6개 Provider 통합 (helm, helm14, lens, operator, stacklight, skuberplus)
 */

export interface QueryOptions {
  /** 노드 이름 패턴 (regex) */
  nodes?: string;
  /** 마운트포인트 패턴 (regex) */
  mountpoints?: string;
  /** Pod 이름 패턴 (regex) */
  pods?: string;
  /** 네임스페이스 */
  namespace?: string;
  /** 셀렉터 (group by용) */
  selector?: string;
  /** PVC 이름 */
  pvc?: string;
  /** Ingress 이름 */
  ingress?: string;
}

/**
 * 쿼리 카테고리
 */
export type QueryCategory = "cluster" | "nodes" | "pods" | "pvc" | "ingress";

/**
 * rate 함수의 정확도 (기본값: 5m)
 *
 * 📝 주의사항:
 * - 1m 윈도우는 Prometheus 스크래핑 타이밍에 민감하여 간헐적으로 빈 결과 반환
 * - 5m 윈도우로 설정하여 안정적인 데이터 반환 보장
 * - Helm/SkuberPlus Provider와 동일한 값 사용 (일관성)
 *
 * 🔄 변경이력: 2026-01-12 - 1m → 5m 변경 (CPU 차트 간헐적 미표시 문제 해결)
 */
const RATE_ACCURACY = "5m";

/**
 * 🎯 목적: 카테고리와 쿼리 이름에 따른 PromQL 쿼리 생성
 *
 * @param category - 쿼리 카테고리 (cluster, nodes, pods, pvc, ingress)
 * @param queryName - 쿼리 이름 (memoryUsage, cpuUsage 등)
 * @param opts - 쿼리 옵션
 * @returns PromQL 쿼리 문자열
 */
export function getUnifiedQuery(category: QueryCategory, queryName: string, opts: QueryOptions): string {
  switch (category) {
    case "cluster":
      return getClusterQuery(queryName, opts);
    case "nodes":
      return getNodesQuery(queryName, opts);
    case "pods":
      return getPodsQuery(queryName, opts);
    case "pvc":
      return getPvcQuery(queryName, opts);
    case "ingress":
      return getIngressQuery(queryName, opts);
    default:
      throw new Error(`Unknown query category: ${category}`);
  }
}

/**
 * 🎯 목적: 클러스터 레벨 메트릭 쿼리
 *
 * 📝 주의사항:
 * - CPU/메모리 사용량은 container 기반 메트릭 사용 (pod, namespace 라벨 보유)
 * - node_cpu_seconds_total은 node-exporter 메트릭으로 pod/namespace 라벨이 없어 조인 불가
 * - Capacity/Allocatable은 kube-state-metrics에서 제공
 *
 * 🔄 변경이력: 2026-01-09 - CPU 쿼리를 container 기반으로 수정 (조인 버그 수정)
 */
function getClusterQuery(queryName: string, opts: QueryOptions): string {
  const { nodes = ".*", mountpoints = "/.*" } = opts;

  switch (queryName) {
    case "memoryUsage":
      // 컨테이너 메모리 사용량 + kube_pod_info 조인 (환경별 라벨 차이 극복)
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(container_memory_working_set_bytes{container!=""} * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info{node=~"${nodes}"})))`;
    case "workloadMemoryUsage":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(container_memory_working_set_bytes{container!=""} * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info{node=~"${nodes}"}))) by (component)`;
    case "memoryRequests":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_requests{node=~"${nodes}", resource="memory"}))`;
    case "memoryLimits":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_limits{node=~"${nodes}", resource="memory"}))`;
    case "memoryCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_capacity{node=~"${nodes}", resource="memory"}))`;
    case "memoryAllocatableCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_allocatable{node=~"${nodes}", resource="memory"}))`;
    case "cpuUsage":
      // 컨테이너 CPU 사용량 + kube_pod_info 조인 (환경별 라벨 차이 극복)
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(rate(container_cpu_usage_seconds_total{container!=""}[${RATE_ACCURACY}]) * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info{node=~"${nodes}"})))`;
    case "cpuRequests":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_requests{node=~"${nodes}", resource="cpu"}))`;
    case "cpuLimits":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_limits{node=~"${nodes}", resource="cpu"}))`;
    case "cpuCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_capacity{node=~"${nodes}", resource="cpu"}))`;
    case "cpuAllocatableCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_allocatable{node=~"${nodes}", resource="cpu"}))`;
    case "podUsage":
      // 🎯 실제 실행 중인 Pod 수
      // 📝 주의: kubelet_running_pod_count/kubelet_running_pods는 많은 환경에서 스크랩되지 않음
      // kube_pod_info는 kube-state-metrics에서 제공하며 대부분의 환경에서 사용 가능
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      // 🔄 변경이력: 2026-01-14 - kubelet 메트릭 대신 kube_pod_info 사용으로 호환성 개선
      return `count(group by (pod, namespace, node) (kube_pod_info{node=~"${nodes}"}))`;
    case "podCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_capacity{node=~"${nodes}", resource="pods"}))`;
    case "podAllocatableCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(max by (node) (kube_node_status_allocatable{node=~"${nodes}", resource="pods"}))`;
    case "fsSize":
      // 🔧 수정: node_filesystem 메트릭은 node-exporter에서 제공
      // - pod/namespace 라벨 없음
      // - node 라벨도 환경에 따라 없을 수 있음 (Kind, Docker Desktop 등)
      // - instance 라벨(IP:port)은 항상 존재
      // node와 instance 모두 반환하여 클라이언트에서 유연하게 매칭
      return `sum(node_filesystem_size_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay|ramfs"}) by (node, instance)`;
    case "fsUsage":
      // 🔧 수정: node_filesystem 메트릭은 node-exporter에서 제공
      // node와 instance 모두 반환하여 클라이언트에서 유연하게 매칭
      return `sum(node_filesystem_size_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay|ramfs"} - node_filesystem_avail_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay|ramfs"}) by (node, instance)`;
    case "diskReadOps":
      // 🎯 Disk IOPS - 읽기 작업 수 (ops/sec)
      // node_disk_reads_completed_total은 node-exporter에서 제공
      // device 필터로 가상/루프백 디바이스 제외
      return `sum(rate(node_disk_reads_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "diskWriteOps":
      // 🎯 Disk IOPS - 쓰기 작업 수 (ops/sec)
      return `sum(rate(node_disk_writes_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "diskReadLatency":
      // 🎯 Disk Latency - 평균 읽기 지연 시간 (ms)
      // rate(read_time) / rate(reads_completed) * 1000
      // 📝 주의: clamp_min으로 0 나누기 방지 (IOPS가 0일 때 Latency도 0 반환)
      return `sum(rate(node_disk_read_time_seconds_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]) / clamp_min(rate(node_disk_reads_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (node, instance)`;
    case "diskWriteLatency":
      // 🎯 Disk Latency - 평균 쓰기 지연 시간 (ms)
      return `sum(rate(node_disk_write_time_seconds_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]) / clamp_min(rate(node_disk_writes_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (node, instance)`;
    // 🎯 Network BPS/PPS - 클러스터 전체 네트워크 트래픽
    // node_network_* 메트릭은 node-exporter에서 제공
    // device 필터로 가상 인터페이스 제외 (lo, veth, docker, br 등)
    // 🔄 변경이력: 2026-01-14 - BPS/PPS 듀얼 축 차트 지원을 위해 추가
    case "networkReceiveBps":
      // 🎯 Network BPS - 수신 대역폭 (bits/sec)
      // bytes * 8 = bits
      return `sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}]) * 8) by (node, instance)`;
    case "networkTransmitBps":
      // 🎯 Network BPS - 송신 대역폭 (bits/sec)
      return `sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}]) * 8) by (node, instance)`;
    case "networkReceivePps":
      // 🎯 Network PPS - 수신 패킷 수 (packets/sec)
      return `sum(rate(node_network_receive_packets_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "networkTransmitPps":
      // 🎯 Network PPS - 송신 패킷 수 (packets/sec)
      return `sum(rate(node_network_transmit_packets_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    default:
      throw new Error(`Unknown cluster query: ${queryName}`);
  }
}

/**
 * 🎯 목적: 노드 레벨 메트릭 쿼리
 *
 * 📝 주의사항:
 * - CPU/메모리 사용량은 container 기반 메트릭 사용 후 노드별 집계
 * - node_cpu_seconds_total은 node-exporter 메트릭으로 pod/namespace 라벨이 없어 조인 불가
 * - kube_pod_info를 통해 노드별로 그룹핑
 *
 * 🔄 변경이력: 2026-01-09 - CPU 쿼리를 container 기반으로 수정 (조인 버그 수정)
 */
function getNodesQuery(queryName: string, opts: QueryOptions): string {
  const { mountpoints = "/.*" } = opts;

  switch (queryName) {
    case "memoryUsage":
      // 컨테이너 메모리 + kube_pod_info 조인 후 노드별 집계
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(container_memory_working_set_bytes{container!=""} * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info))) by (node)`;
    case "workloadMemoryUsage":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(container_memory_working_set_bytes{container!="POD", container!=""} * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info))) by (node)`;
    case "memoryCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거
      return `max(kube_node_status_capacity{resource="memory"}) by (node)`;
    case "memoryAllocatableCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거
      return `max(kube_node_status_allocatable{resource="memory"}) by (node)`;
    case "cpuUsage":
      // 컨테이너 CPU + kube_pod_info 조인 후 노드별 집계
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - group by로 중복 제거
      return `sum(rate(container_cpu_usage_seconds_total{container!=""}[${RATE_ACCURACY}]) * on (pod, namespace) group_left(node) (group by (pod, namespace, node) (kube_pod_info))) by (node)`;
    case "cpuCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거
      return `max(kube_node_status_capacity{resource="cpu"}) by (node)`;
    case "cpuAllocatableCapacity":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거
      return `max(kube_node_status_allocatable{resource="cpu"}) by (node)`;
    case "fsSize":
      // 🔧 수정: node-exporter 메트릭은 환경에 따라 node 또는 instance 라벨만 존재
      // node, instance 라벨 모두 반환하여 클라이언트에서 유연하게 매칭
      // - kube-prometheus-stack: node 라벨 있음
      // - 기본 node-exporter: instance 라벨만 있음 (예: "node1:9100" 또는 "192.168.1.10:9100")
      return `sum(node_filesystem_size_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay"}) by (node, instance)`;
    case "fsUsage":
      // 🔧 수정: node-exporter 메트릭은 환경에 따라 node 또는 instance 라벨만 존재
      // node, instance 라벨 모두 반환하여 클라이언트에서 유연하게 매칭
      return `sum(node_filesystem_size_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay"} - node_filesystem_avail_bytes{mountpoint=~"${mountpoints}", fstype!~"tmpfs|overlay"}) by (node, instance)`;
    case "diskReadOps":
      // 🎯 Disk IOPS - 읽기 작업 수 (ops/sec)
      // node_disk_reads_completed_total은 node-exporter에서 제공
      // device 필터로 가상/루프백 디바이스 제외
      return `sum(rate(node_disk_reads_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "diskWriteOps":
      // 🎯 Disk IOPS - 쓰기 작업 수 (ops/sec)
      return `sum(rate(node_disk_writes_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "diskReadLatency":
      // 🎯 Disk Latency - 평균 읽기 지연 시간 (ms)
      // rate(read_time) / rate(reads_completed) * 1000
      // 📝 주의: clamp_min으로 0 나누기 방지 (IOPS가 0일 때 Latency도 0 반환)
      return `sum(rate(node_disk_read_time_seconds_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]) / clamp_min(rate(node_disk_reads_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (node, instance)`;
    case "diskWriteLatency":
      // 🎯 Disk Latency - 평균 쓰기 지연 시간 (ms)
      return `sum(rate(node_disk_write_time_seconds_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]) / clamp_min(rate(node_disk_writes_completed_total{device!~"dm-.*|loop.*|nbd.*"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (node, instance)`;
    // 🎯 Network BPS/PPS - 노드별 네트워크 트래픽
    // node_network_* 메트릭은 node-exporter에서 제공
    // device 필터로 가상 인터페이스 제외 (lo, veth, docker, br 등)
    // 🔄 변경이력: 2026-01-14 - BPS/PPS 듀얼 축 차트 지원을 위해 추가
    case "networkReceiveBps":
      // 🎯 Network BPS - 수신 대역폭 (bits/sec)
      return `sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}]) * 8) by (node, instance)`;
    case "networkTransmitBps":
      // 🎯 Network BPS - 송신 대역폭 (bits/sec)
      return `sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}]) * 8) by (node, instance)`;
    case "networkReceivePps":
      // 🎯 Network PPS - 수신 패킷 수 (packets/sec)
      return `sum(rate(node_network_receive_packets_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    case "networkTransmitPps":
      // 🎯 Network PPS - 송신 패킷 수 (packets/sec)
      return `sum(rate(node_network_transmit_packets_total{device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*|calico.*"}[${RATE_ACCURACY}])) by (node, instance)`;
    default:
      throw new Error(`Unknown nodes query: ${queryName}`);
  }
}

/**
 * Pod 레벨 메트릭 쿼리
 */
function getPodsQuery(queryName: string, opts: QueryOptions): string {
  const { pods = ".*", namespace = "", selector = "pod" } = opts;

  switch (queryName) {
    case "cpuUsage":
      // 🔧 수정: image!="" 필터 제거 (일부 환경에서 image 라벨 없음)
      return `sum(rate(container_cpu_usage_seconds_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    case "cpuRequests":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거 후 sum
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_requests{pod=~"${pods}", resource="cpu", namespace="${namespace}"})) by (${selector})`;
    case "cpuLimits":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거 후 sum
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_limits{pod=~"${pods}", resource="cpu", namespace="${namespace}"})) by (${selector})`;
    case "memoryUsage":
      // 🔧 수정: image!="" 필터 제거 (일부 환경에서 image 라벨 없음)
      return `sum(container_memory_working_set_bytes{container!="", pod=~"${pods}", namespace="${namespace}"}) by (${selector})`;
    case "memoryRequests":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거 후 sum
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_requests{pod=~"${pods}", resource="memory", namespace="${namespace}"})) by (${selector})`;
    case "memoryLimits":
      // 🔧 수정: kube-state-metrics 중복 설치 환경 대응 - max로 중복 제거 후 sum
      return `sum(max by (pod, namespace, container) (kube_pod_container_resource_limits{pod=~"${pods}", resource="memory", namespace="${namespace}"})) by (${selector})`;
    case "fsUsage":
      // 🔧 수정: image!="" 필터 제거 (일부 환경에서 image 라벨 없음)
      return `sum(container_fs_usage_bytes{container!="", pod=~"${pods}", namespace="${namespace}"}) by (${selector})`;
    case "fsWrites":
      // 🎯 Disk IOPS - 쓰기 작업 횟수 (ops/sec)
      // container_fs_writes_total: 누적 쓰기 작업 수 (cAdvisor diskIO 메트릭)
      return `sum(rate(container_fs_writes_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    case "fsReads":
      // 🎯 Disk IOPS - 읽기 작업 횟수 (ops/sec)
      // container_fs_reads_total: 누적 읽기 작업 수 (cAdvisor diskIO 메트릭)
      return `sum(rate(container_fs_reads_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    case "fsReadLatency":
      // 🎯 Disk Latency - 평균 읽기 지연 시간 (ms)
      // rate(read_seconds) / rate(reads_total) * 1000
      // 📝 주의: clamp_min으로 0 나누기 방지 (IOPS가 0일 때 Latency도 0 반환)
      // 🔄 변경이력: 2026-01-14 - Pod IOPS + Latency 이중 축 차트 지원을 위해 추가
      return `sum(rate(container_fs_read_seconds_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]) / clamp_min(rate(container_fs_reads_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (${selector})`;
    case "fsWriteLatency":
      // 🎯 Disk Latency - 평균 쓰기 지연 시간 (ms)
      // 🔄 변경이력: 2026-01-14 - Pod IOPS + Latency 이중 축 차트 지원을 위해 추가
      return `sum(rate(container_fs_write_seconds_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]) / clamp_min(rate(container_fs_writes_total{container!="", pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]), 1e-10) * 1000) by (${selector})`;
    case "networkReceive":
      return `sum(rate(container_network_receive_bytes_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    case "networkTransmit":
      return `sum(rate(container_network_transmit_bytes_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    // 🎯 Network BPS/PPS - Pod별 네트워크 트래픽
    // container_network_* 메트릭은 cAdvisor(kubelet 내장)에서 제공
    // 🔄 변경이력: 2026-01-14 - BPS/PPS 듀얼 축 차트 지원을 위해 추가
    case "networkReceiveBps":
      // 🎯 Network BPS - 수신 대역폭 (bits/sec)
      // bytes * 8 = bits
      return `sum(rate(container_network_receive_bytes_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]) * 8) by (${selector})`;
    case "networkTransmitBps":
      // 🎯 Network BPS - 송신 대역폭 (bits/sec)
      return `sum(rate(container_network_transmit_bytes_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}]) * 8) by (${selector})`;
    case "networkReceivePps":
      // 🎯 Network PPS - 수신 패킷 수 (packets/sec)
      return `sum(rate(container_network_receive_packets_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    case "networkTransmitPps":
      // 🎯 Network PPS - 송신 패킷 수 (packets/sec)
      return `sum(rate(container_network_transmit_packets_total{pod=~"${pods}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (${selector})`;
    default:
      throw new Error(`Unknown pods query: ${queryName}`);
  }
}

/**
 * PVC 메트릭 쿼리
 */
function getPvcQuery(queryName: string, opts: QueryOptions): string {
  const { pvc = "", namespace = "" } = opts;

  switch (queryName) {
    case "diskUsage":
      return `sum(kubelet_volume_stats_used_bytes{persistentvolumeclaim="${pvc}", namespace="${namespace}"}) by (persistentvolumeclaim, namespace)`;
    case "diskCapacity":
      return `sum(kubelet_volume_stats_capacity_bytes{persistentvolumeclaim="${pvc}", namespace="${namespace}"}) by (persistentvolumeclaim, namespace)`;
    default:
      throw new Error(`Unknown pvc query: ${queryName}`);
  }
}

/**
 * Ingress 메트릭 쿼리
 */
function getIngressQuery(queryName: string, opts: QueryOptions): string {
  const { ingress = "", namespace = "" } = opts;

  switch (queryName) {
    case "bytesSentSuccess":
      return bytesSent({
        rateAccuracy: RATE_ACCURACY,
        ingress,
        namespace,
        statuses: "^2\\\\d*",
      });
    case "bytesSentFailure":
      return bytesSent({
        rateAccuracy: RATE_ACCURACY,
        ingress,
        namespace,
        statuses: "^5\\\\d*",
      });
    case "requestDurationSeconds":
      return `sum(rate(nginx_ingress_controller_request_duration_seconds_sum{ingress="${ingress}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (ingress, namespace)`;
    case "responseDurationSeconds":
      return `sum(rate(nginx_ingress_controller_response_duration_seconds_sum{ingress="${ingress}", namespace="${namespace}"}[${RATE_ACCURACY}])) by (ingress, namespace)`;
    default:
      throw new Error(`Unknown ingress query: ${queryName}`);
  }
}
