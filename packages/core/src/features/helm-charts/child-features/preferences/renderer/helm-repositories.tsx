/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Repository 목록 컴포넌트 - shadcn UI 기반
 *
 * 📝 주의사항:
 * - shadcn Button + lucide-react Trash2 아이콘 사용
 * - Tailwind CSS 클래스로 스타일링
 * - preferences-dialog.tsx의 Synced items 패턴 적용
 *
 * 🔄 변경이력:
 * - 2025-11-11: RemovableItem → shadcn UI로 마이그레이션
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Button } from "../../../../../renderer/components/shadcn-ui/button";
import activeHelmRepositoriesInjectable from "./active-helm-repositories.injectable";
import removeHelmRepositoryInjectable from "./remove-helm-repository.injectable";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { HelmRepo } from "../../../../../common/helm/helm-repo";

interface Dependencies {
  activeHelmRepositories: IAsyncComputed<HelmRepo[]>;
  removeRepository: (repository: HelmRepo) => Promise<void>;
}

/**
 * 🎯 목적: Helm Repository 목록 컴포넌트 (MobX observer)
 *
 * @param activeHelmRepositories - 활성 Helm repository 목록 (비동기 computed)
 * @param removeRepository - Repository 삭제 함수
 * @returns Helm repository 목록 UI (shadcn UI 스타일)
 */
const NonInjectedActiveHelmRepositories = observer(({ activeHelmRepositories, removeRepository }: Dependencies) => {
  // 로딩 중: Spinner 표시
  if (activeHelmRepositories.pending.get()) {
    return (
      <div className="flex flex-col gap-2 mt-3">
        <div className="pt-5 relative">
          <Spinner center data-testid="helm-repositories-are-loading" />
        </div>
      </div>
    );
  }

  const repositories = activeHelmRepositories.value.get();

  // Repository 목록이 없으면 빈 메시지 표시 (선택적)
  if (repositories.length === 0) {
    return (
      <div className="flex flex-col gap-2 mt-3">
        <p className="text-muted-foreground text-sm text-center py-4">No Helm repositories found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-3">
      {repositories.map((repository) => (
        <div
          key={repository.name}
          className="hover:bg-accent/50 flex items-center gap-3 rounded-lg p-3"
          data-testid={`remove-helm-repository-${repository.name}`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium" data-testid={`helm-repository-${repository.name}`}>
              {repository.name}
            </p>
            <p className="text-muted-foreground text-sm">{repository.url}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => removeRepository(repository)}
            aria-label={`Remove ${repository.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
});

export const HelmRepositories = withInjectables<Dependencies>(
  NonInjectedActiveHelmRepositories,

  {
    getProps: (di) => ({
      activeHelmRepositories: di.inject(activeHelmRepositoriesInjectable),
      removeRepository: di.inject(removeHelmRepositoryInjectable),
    }),
  },
);
