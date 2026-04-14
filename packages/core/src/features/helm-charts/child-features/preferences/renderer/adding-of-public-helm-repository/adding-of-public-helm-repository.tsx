/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Public Helm Repository 선택 컴포넌트 - shadcn UI Combobox 기반 (검색 가능)
 *
 * 📝 주의사항:
 * - shadcn UI Combobox 사용 (Popover + Command)
 * - CommandInput으로 repository 검색 가능
 * - 선택된 repository는 체크 아이콘 표시
 * - 토글 방식: 선택된 repository 다시 클릭 시 제거
 * - 여러 개 선택 가능 (선택 후 자동으로 닫히지 않음)
 *
 * 🔄 변경이력:
 * - 2025-11-11: react-select → shadcn UI Select로 마이그레이션
 * - 2025-11-11: selectHelmRepositoryInjectable → add/removeHelmRepositoryInjectable 직접 사용
 * - 2025-11-11: Select → Combobox로 변경 (검색 기능 추가)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { matches } from "lodash/fp";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { Button } from "../../../../../../renderer/components/shadcn-ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../../../renderer/components/shadcn-ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../../../renderer/components/shadcn-ui/popover";
import activeHelmRepositoriesInjectable from "../active-helm-repositories.injectable";
import removeHelmRepositoryInjectable from "../remove-helm-repository.injectable";
import publicHelmRepositoriesInjectable from "./public-helm-repositories/public-helm-repositories.injectable";
import addHelmRepositoryInjectable from "./select-helm-repository/add-helm-repository.injectable";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { HelmRepo } from "../../../../../../common/helm/helm-repo";

interface Dependencies {
  publicRepositories: IAsyncComputed<HelmRepo[]>;
  activeRepositories: IAsyncComputed<HelmRepo[]>;
  addRepository: (repository: HelmRepo) => Promise<void>;
  removeRepository: (repository: HelmRepo) => Promise<void>;
}

/**
 * 🎯 목적: Public Helm Repository 선택 컴포넌트 (MobX observer)
 *
 * @param publicRepositories - Public Helm repository 목록 (비동기 computed)
 * @param activeRepositories - 활성 Helm repository 목록 (비동기 computed)
 * @param addRepository - Repository 추가 함수
 * @param removeRepository - Repository 제거 함수
 * @returns shadcn UI Combobox 컴포넌트 (검색 가능)
 */
const NonInjectedAddingOfPublicHelmRepository = observer(
  ({ publicRepositories, activeRepositories, addRepository, removeRepository }: Dependencies) => {
    const dereferencesPublicRepositories = publicRepositories.value.get();
    const dereferencesActiveRepositories = activeRepositories.value.get();

    const valuesAreLoading = publicRepositories.pending.get() || activeRepositories.pending.get();

    // Combobox 열림/닫힘 상태 관리
    const [open, setOpen] = useState(false);

    // 선택된 repository 확인 함수
    const isRepositoryActive = (repositoryName: string) => {
      return !!dereferencesActiveRepositories.find(matches({ name: repositoryName }));
    };

    // Repository 선택/해제 핸들러 (토글 방식)
    const handleRepositorySelect = (repositoryName: string) => {
      const repository = dereferencesPublicRepositories.find((r) => r.name === repositoryName);
      if (!repository) return;

      const isActive = isRepositoryActive(repositoryName);
      if (isActive) {
        removeRepository(repository);
      } else {
        addRepository(repository);
      }
      // 선택 후 combobox 닫지 않음 (여러 개 선택 가능)
    };

    // 로딩 중이면 disabled 상태로 표시
    return (
      <div className="flex-1">
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={valuesAreLoading}
              className="bg-input/30 border-border w-full justify-between"
            >
              {valuesAreLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  <span>Repositories</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0"
            align="start"
            sideOffset={4}
            style={{ width: "var(--radix-popover-trigger-width)" }}
          >
            <Command>
              <CommandInput placeholder="Search repositories..." />
              <CommandList onWheel={(e) => e.stopPropagation()}>
                <CommandEmpty>No repository found.</CommandEmpty>
                <CommandGroup>
                  {dereferencesPublicRepositories.map((repository) => (
                    <CommandItem
                      key={repository.name}
                      value={repository.name}
                      onSelect={() => handleRepositorySelect(repository.name)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${isRepositoryActive(repository.name) ? "opacity-100" : "opacity-0"}`}
                      />
                      {repository.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);

export const AddingOfPublicHelmRepository = withInjectables<Dependencies>(
  NonInjectedAddingOfPublicHelmRepository,

  {
    getProps: (di) => ({
      publicRepositories: di.inject(publicHelmRepositoriesInjectable),
      activeRepositories: di.inject(activeHelmRepositoriesInjectable),
      addRepository: di.inject(addHelmRepositoryInjectable),
      removeRepository: di.inject(removeHelmRepositoryInjectable),
    }),
  },
);
