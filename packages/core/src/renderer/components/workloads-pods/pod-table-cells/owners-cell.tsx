/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: 레거시 Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { stopPropagation } from "@skuberplus/utilities";
import React from "react";
import { Link } from "react-router-dom";

import type { Pod } from "@skuberplus/kube-object";

import type { ApiManager } from "../../../../common/k8s-api/api-manager";
import type { GetDetailsUrl } from "../../kube-detail-params/get-details-url.injectable";

/**
 * 🎯 목적: Pod를 소유하는 리소스 표시 (Deployment, ReplicaSet, DaemonSet 등)
 *
 * @param pod - Pod 객체
 * @param apiManager - Kubernetes API 관리자 (owner reference 조회)
 * @param getDetailsUrl - 리소스 상세 페이지 URL 생성 함수
 * @returns Badge + Link 조합으로 owner 리소스 표시
 *
 * 📝 주의사항:
 * - Badge 클릭 시 owner 상세 페이지로 이동
 * - stopPropagation으로 행 클릭 이벤트 방지
 * - 여러 owner가 있을 경우 모두 표시
 */
export const OwnersCell = ({
  pod,
  apiManager,
  getDetailsUrl,
}: {
  pod: Pod;
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
}) => {
  return (
    <div>
      {pod.getOwnerRefs().map((ref) => {
        const { kind, name } = ref;
        const detailsLink = getDetailsUrl(apiManager.lookupApiLink(ref, pod));

        return (
          <Badge variant="outline" key={name} className="owner" title={name}>
            <Link to={detailsLink} onClick={stopPropagation}>
              {kind}
            </Link>
          </Badge>
        );
      })}
    </div>
  );
};
