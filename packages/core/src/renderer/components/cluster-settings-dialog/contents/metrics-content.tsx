/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Metrics 설정 콘텐츠 컴포넌트 (단순화된 버전)
 *
 * 메트릭 수집 방식 설정을 표시합니다:
 * - Metric Source (2가지: Metrics Server / Prometheus)
 * - Prometheus 엔드포인트 설정 (Prometheus 선택 시)
 * - Filesystem mountpoints
 * - Hide metrics from the UI
 *
 * 📝 주의사항:
 * - Auto-detect 제거됨
 * - Provider 선택 제거됨 (통합 쿼리 사용)
 * - metricsSource 필드 사용 ("metrics-server" | "prometheus")
 *
 * 🔄 변경이력: 2026-01-09 - 극단적 단순화 (Auto-detect, Provider 선택 제거)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Checkbox } from "@skuberplus/storybook-shadcn/src/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@skuberplus/storybook-shadcn/src/components/ui/command";
import { Field, FieldDescription } from "@skuberplus/storybook-shadcn/src/components/ui/field";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Item, ItemActions, ItemContent, ItemTitle } from "@skuberplus/storybook-shadcn/src/components/ui/item";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@skuberplus/storybook-shadcn/src/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skuberplus/storybook-shadcn/src/components/ui/select";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { ChevronDown, RotateCcw, X } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { ClusterMetricsResourceType, initialFilesystemMountpoints } from "../../../../common/cluster-types";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";

import type { MetricsSourceType } from "../../../../common/cluster-types";
import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * MetricsContent Props 인터페이스
 */
export interface MetricsContentProps {
  entity: CatalogEntity;
}

/**
 * Dependencies 인터페이스
 */
interface Dependencies {
  getClusterById: GetClusterById;
}

/**
 * 🎯 목적: Metrics 설정 UI 컴포넌트 (단순화된 버전)
 *
 * 2가지 메트릭 소스만 제공:
 * - Metrics Server (기본값): Kubernetes 기본 메트릭 API 사용
 * - Prometheus: 사용자 지정 Prometheus 엔드포인트 사용
 */
const NonInjectedMetricsContent = observer(({ entity, getClusterById }: MetricsContentProps & Dependencies) => {
  const cluster = getClusterById(entity.getId());
  const [filesystemMountpoints, setFilesystemMountpoints] = React.useState("");
  const [selectedMetrics, setSelectedMetrics] = React.useState<string[]>([]);

  // 🎯 메트릭 소스 상태 (2가지만: metrics-server, prometheus)
  const [metricsSource, setMetricsSource] = React.useState<MetricsSourceType>("metrics-server");

  // 🎯 Prometheus 엔드포인트 설정 상태
  const [prometheusPath, setPrometheusPath] = React.useState("");
  const [useHttps, setUseHttps] = React.useState(false);
  const [customPrefix, setCustomPrefix] = React.useState("");

  // 초기 값 설정
  React.useEffect(() => {
    if (cluster) {
      setFilesystemMountpoints(cluster.preferences.filesystemMountpoints || "");
      setSelectedMetrics(cluster.preferences.hiddenMetrics || []);

      // 🎯 metricsSource 로드 (기본값: metrics-server)
      setMetricsSource(cluster.preferences.metricsSource || "metrics-server");

      // 🎯 Prometheus 엔드포인트 설정 로드
      const prometheus = cluster.preferences.prometheus;
      if (prometheus) {
        setPrometheusPath(`${prometheus.namespace}/${prometheus.service}:${prometheus.port}`);
        setUseHttps(prometheus.https || false);
        setCustomPrefix(prometheus.prefix || "");
      }
    }
  }, [cluster]);

  if (!cluster) {
    return null;
  }

  // 🎯 메트릭 소스 변경 처리
  const handleMetricsSourceChange = (value: string) => {
    const source = value as MetricsSourceType;
    setMetricsSource(source);
    cluster.preferences.metricsSource = source;
  };

  // 🎯 Filesystem mountpoints 변경 처리
  const handleFilesystemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesystemMountpoints(e.target.value);
  };

  // 🎯 Filesystem mountpoints 저장 (onBlur 시)
  const handleFilesystemBlur = () => {
    cluster.preferences.filesystemMountpoints = filesystemMountpoints || undefined;
  };

  // 🎯 Prometheus Path 파싱 함수
  const parsePrometheusPath = () => {
    if (!prometheusPath) return undefined;

    const parsed = prometheusPath.split(/\/|:/, 3);
    if (!parsed[0] || !parsed[1] || !parsed[2]) return undefined;

    return {
      namespace: parsed[0],
      service: parsed[1],
      port: parseInt(parsed[2]),
      prefix: customPrefix.startsWith("/") ? customPrefix : customPrefix ? `/${customPrefix}` : "",
      https: useHttps,
    };
  };

  // 🎯 Prometheus 설정 저장 핸들러
  const handleSavePrometheus = () => {
    const prometheus = parsePrometheusPath();
    cluster.preferences.prometheus = prometheus;
  };

  // 🎯 메트릭 토글 핸들러
  const handleMetricToggle = (metric: string, checked: boolean | "indeterminate") => {
    let newSelectedMetrics: string[];

    if (checked === true) {
      newSelectedMetrics = [...selectedMetrics, metric];
    } else {
      newSelectedMetrics = selectedMetrics.filter((m) => m !== metric);
    }

    setSelectedMetrics(newSelectedMetrics);
    cluster.preferences.hiddenMetrics = newSelectedMetrics;
  };

  // 🎯 메트릭 제거 핸들러
  const handleRemoveMetric = (metric: string) => {
    const newSelectedMetrics = selectedMetrics.filter((m) => m !== metric);

    setSelectedMetrics(newSelectedMetrics);
    cluster.preferences.hiddenMetrics = newSelectedMetrics;
  };

  // 🎯 모든 메트릭 숨기기
  const handleHideAllMetrics = () => {
    const allMetrics = Object.values(ClusterMetricsResourceType);

    setSelectedMetrics(allMetrics);
    cluster.preferences.hiddenMetrics = allMetrics;
  };

  // 🎯 메트릭 숨김 초기화
  const handleResetMetrics = () => {
    setSelectedMetrics([]);
    cluster.preferences.hiddenMetrics = [];
  };

  // 🎯 사용 가능한 메트릭 목록
  const availableMetrics = Object.values(ClusterMetricsResourceType);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Metric Source 선택 (2가지만) */}
      <Field>
        <Label htmlFor="metric-source" className="text-foreground text-sm font-medium">
          Metric Source
        </Label>
        <Select value={metricsSource} onValueChange={handleMetricsSourceChange}>
          <SelectTrigger id="metric-source" className="bg-input/30 border-border w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="metrics-server">Metrics Server</SelectItem>
            <SelectItem value="prometheus">Prometheus</SelectItem>
          </SelectContent>
        </Select>
        <FieldDescription>
          Metrics Server uses the Kubernetes built-in metrics API. Prometheus requires a custom endpoint configuration.
        </FieldDescription>
      </Field>

      {/* Prometheus 엔드포인트 설정 (Prometheus 선택 시에만 표시) */}
      {metricsSource === "prometheus" && (
        <>
          <Separator />
          {/* Prometheus Service Address */}
          <Field>
            <Label htmlFor="prometheus-service-address" className="text-foreground text-sm font-medium">
              Prometheus Service Address
            </Label>
            <Input
              id="prometheus-service-address"
              type="text"
              placeholder="<namespace>/<service>:<port>"
              className="bg-input/30 border-border"
              value={prometheusPath}
              onChange={(e) => setPrometheusPath(e.target.value)}
              onBlur={handleSavePrometheus}
            />
            <FieldDescription>
              Enter the Prometheus service address. Example: namespace/servicename:port
            </FieldDescription>
          </Field>

          <Separator />
          {/* Prometheus HTTPS */}
          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="prometheus-https"
                checked={useHttps}
                onCheckedChange={(checked) => {
                  setUseHttps(checked === true);
                  setTimeout(handleSavePrometheus, 0);
                }}
              />
              <Label htmlFor="prometheus-https" className="text-sm font-normal cursor-pointer">
                Use HTTPS for Prometheus requests
              </Label>
            </div>
            <FieldDescription>Check this if your externally hosted Prometheus uses HTTPS.</FieldDescription>
          </Field>

          <Separator />
          {/* Custom Path Prefix */}
          <Field>
            <Label htmlFor="custom-path-prefix" className="text-foreground text-sm font-medium">
              Custom Path Prefix
            </Label>
            <Input
              id="custom-path-prefix"
              type="text"
              placeholder="/prometheus"
              className="bg-input/30 border-border"
              value={customPrefix}
              onChange={(e) => setCustomPrefix(e.target.value)}
              onBlur={handleSavePrometheus}
            />
            <FieldDescription>An optional path prefix added to all Prometheus requests.</FieldDescription>
          </Field>
        </>
      )}

      {/* Filesystem mountpoints */}
      <Field>
        <Label htmlFor="filesystem-mountpoints" className="text-foreground text-sm font-medium">
          Filesystem Mountpoints
        </Label>
        <Input
          id="filesystem-mountpoints"
          type="text"
          placeholder={initialFilesystemMountpoints}
          className="bg-input/30 border-border"
          value={filesystemMountpoints}
          onChange={handleFilesystemChange}
          onBlur={handleFilesystemBlur}
        />
        <FieldDescription>
          A regexp for the filesystem mountpoints to create disk usage graphs. Use "/" for root disk only, ".*" for all
          disks.
        </FieldDescription>
      </Field>

      {/* Separator */}
      <Separator />

      {/* Hide metrics from the UI */}
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2 self-stretch">
          <Field className="flex-1">
            <Label className="text-foreground text-sm font-medium">Hide metrics from the UI</Label>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="bg-input/30 border-border w-full justify-between">
                  <span className="text-muted-foreground">
                    {selectedMetrics.length > 0
                      ? `${selectedMetrics.length} metrics selected`
                      : "Select metrics to hide..."}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
                <Command>
                  <CommandList>
                    <CommandEmpty>No metrics found.</CommandEmpty>
                    <CommandGroup>
                      {availableMetrics.map((metric) => (
                        <CommandItem
                          key={metric}
                          onSelect={() => handleMetricToggle(metric, !selectedMetrics.includes(metric))}
                        >
                          <Checkbox checked={selectedMetrics.includes(metric)} className="pointer-events-none" />
                          <span>{metric}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>
          <Button onClick={handleHideAllMetrics}>Hide all metrics</Button>
          <Button variant="secondary" size="icon" onClick={handleResetMetrics}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* 선택된 메트릭 리스트 표시 */}
        {selectedMetrics.length > 0 && (
          <div className="space-y-2">
            {selectedMetrics.map((metric) => (
              <Item key={metric} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{metric}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <X className="h-4 w-4 cursor-pointer" onClick={() => handleRemoveMetric(metric)} />
                </ItemActions>
              </Item>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * DI 패턴 적용된 Metrics Content 컴포넌트
 */
export const MetricsContent = withInjectables<Dependencies, MetricsContentProps>(NonInjectedMetricsContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
  }),
});
