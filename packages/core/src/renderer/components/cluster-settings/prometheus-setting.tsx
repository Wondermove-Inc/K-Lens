/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { autorun, makeObservable, observable, runInAction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { initialFilesystemMountpoints } from "../../../common/cluster-types";
import productNameInjectable from "../../../common/vars/product-name.injectable";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { SubTitle } from "../layout/sub-title";
import { Select } from "../select";

import type { Cluster } from "../../../common/cluster/cluster";
import type { MetricsSourceType } from "../../../common/cluster-types";
import type { SelectOption } from "../select";

export interface ClusterPrometheusSettingProps {
  cluster: Cluster;
}

interface Dependencies {
  productName: string;
}

/**
 * 🎯 목적: 클러스터 Prometheus 설정 컴포넌트
 *
 * 📝 주의사항:
 * - 2가지 메트릭 소스만 지원: Metrics Server (기본값), Prometheus
 * - Prometheus 선택 시 엔드포인트 직접 입력
 * - Provider 선택 UI 제거됨 (통합 쿼리 사용)
 *
 * 🔄 변경이력: 2026-01-09 - Auto-detect 제거, 극단적 단순화
 */
class NonInjectedClusterPrometheusSetting extends Component<ClusterPrometheusSettingProps & Dependencies> {
  @observable mountpoints = "";
  @observable path = ""; // <namespace>/<service>:<port>
  @observable customPrefix = ""; // e.g. "/prometheus"
  @observable useHttps = false;
  @observable selectedMetricsSource: MetricsSourceType = "metrics-server";

  readonly initialFilesystemMountpoints = initialFilesystemMountpoints;

  /**
   * 🎯 목적: 메트릭 소스 선택 옵션 (2가지만)
   */
  readonly metricsSourceOptions: SelectOption<MetricsSourceType>[] = [
    { value: "metrics-server", label: "Metrics Server" },
    { value: "prometheus", label: "Prometheus" },
  ];

  constructor(props: ClusterPrometheusSettingProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    disposeOnUnmount(
      this,
      autorun(() => {
        const { prometheus, metricsSource, filesystemMountpoints } = this.props.cluster.preferences;

        // 메트릭 소스 설정
        this.selectedMetricsSource = metricsSource ?? "metrics-server";

        // Prometheus 엔드포인트 설정
        if (prometheus) {
          this.path = `${prometheus.namespace}/${prometheus.service}:${prometheus.port}`;
          this.customPrefix = prometheus.prefix || "";
          this.useHttps = Boolean(prometheus.https);
        } else {
          this.path = "";
          this.customPrefix = "";
          this.useHttps = false;
        }

        // 파일시스템 마운트포인트 설정
        if (filesystemMountpoints) {
          this.mountpoints = filesystemMountpoints;
        }
      }),
    );
  }

  /**
   * 🎯 목적: Prometheus 경로를 파싱하여 설정 객체로 변환
   */
  parsePrometheusPath = () => {
    if (!this.path) return undefined;

    const parsed = this.path.split(/\/|:/, 3);

    if (!parsed[0] || !parsed[1] || !parsed[2]) return undefined;

    const prefix = this.customPrefix.startsWith("/")
      ? this.customPrefix
      : this.customPrefix
        ? `/${this.customPrefix}`
        : "";

    return {
      namespace: parsed[0],
      service: parsed[1],
      port: parseInt(parsed[2]),
      prefix,
      https: this.useHttps,
    };
  };

  /**
   * 🎯 목적: 메트릭 소스 변경 시 저장
   */
  onSaveMetricsSource = (source: MetricsSourceType) => {
    runInAction(() => {
      this.selectedMetricsSource = source;
      this.props.cluster.preferences.metricsSource = source;
    });
  };

  /**
   * 🎯 목적: Prometheus 엔드포인트 설정 저장
   */
  onSavePrometheus = () => {
    runInAction(() => {
      this.props.cluster.preferences.prometheus = this.parsePrometheusPath();
    });
  };

  /**
   * 🎯 목적: 파일시스템 마운트포인트 저장
   */
  onSaveMountpoints = () => {
    runInAction(() => {
      this.props.cluster.preferences.filesystemMountpoints = this.mountpoints;
    });
  };

  render() {
    const isPrometheusSelected = this.selectedMetricsSource === "prometheus";

    return (
      <>
        {/* 메트릭 소스 선택 */}
        <section>
          <SubTitle title="Metric Source" />
          <Select
            id="cluster-metrics-source-input"
            value={this.selectedMetricsSource}
            onChange={(option) => this.onSaveMetricsSource(option?.value ?? "metrics-server")}
            options={this.metricsSourceOptions}
            themeName="lens"
          />
          <small className="hint">
            Metrics Server uses the Kubernetes built-in metrics API. Prometheus requires a custom endpoint
            configuration.
          </small>
        </section>

        {/* Prometheus 엔드포인트 설정 (Prometheus 선택 시에만 표시) */}
        {isPrometheusSelected && (
          <>
            <hr />
            <section>
              <SubTitle title="Prometheus Service Address" />
              <Input
                theme="round-black"
                value={this.path}
                onChange={(value) => (this.path = value)}
                onBlur={this.onSavePrometheus}
                placeholder="<namespace>/<service>:<port>"
              />
              <small className="hint">Enter the Prometheus service address. Example: namespace/servicename:port</small>
            </section>

            <hr />
            <section>
              <SubTitle title="HTTPS" />
              <Checkbox
                label="Use HTTPS for Prometheus requests"
                value={this.useHttps}
                onChange={(checked) => {
                  this.useHttps = checked;
                  this.onSavePrometheus();
                }}
              />
              <small className="hint">Check this if your externally hosted Prometheus uses HTTPS.</small>
            </section>

            <hr />
            <section>
              <SubTitle title="Custom Path Prefix" />
              <Input
                theme="round-black"
                value={this.customPrefix}
                onChange={(value) => (this.customPrefix = value)}
                onBlur={this.onSavePrometheus}
                placeholder="/prometheus"
              />
              <small className="hint">An optional path prefix added to all Prometheus requests.</small>
            </section>
          </>
        )}

        {/* 파일시스템 마운트포인트 */}
        <hr />
        <section>
          <SubTitle title="Filesystem Mountpoints" />
          <Input
            theme="round-black"
            value={this.mountpoints}
            onChange={(value) => (this.mountpoints = value)}
            onBlur={this.onSaveMountpoints}
            placeholder={this.initialFilesystemMountpoints}
          />
          <small className="hint">
            A regexp for the filesystem mountpoints to create disk usage graphs. Use "/" for root disk only, ".*" for
            all disks.
          </small>
        </section>
      </>
    );
  }
}

export const ClusterPrometheusSetting = withInjectables<Dependencies, ClusterPrometheusSettingProps>(
  observer(NonInjectedClusterPrometheusSetting),
  {
    getProps: (di, props) => ({
      ...props,
      productName: di.inject(productNameInjectable),
    }),
  },
);
