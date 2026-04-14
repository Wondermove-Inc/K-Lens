/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Terminal 설정 콘텐츠 컴포넌트 (Storybook 템플릿 기반)
 *
 * 터미널 관련 설정을 표시합니다:
 * - Working directory (InputGroup with button)
 * - Default namespace (Input)
 *
 * 📝 주의사항:
 * - Storybook 템플릿 UI를 100% 따라서 shadcn 컴포넌트 사용
 * - 기존 비즈니스 로직 보존 (cluster.preferences.terminalCWD, defaultNamespace)
 * - DI 패턴 유지 (withInjectables)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@skuberplus/storybook-shadcn/src/components/ui/input-group";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import { FolderSearch } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import isWindowsInjectable from "../../../../common/vars/is-windows.injectable";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";
import openPathPickingDialogInjectable from "../../../../features/path-picking-dialog/renderer/pick-paths.injectable";

import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";
import type { OpenPathPickingDialog } from "../../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { CatalogEntity } from "../../../api/catalog-entity";

/**
 * TerminalContent Props 인터페이스
 */
export interface TerminalContentProps {
  /**
   * 카탈로그 엔티티 (클러스터)
   */
  entity: CatalogEntity;
}

/**
 * Dependencies 인터페이스
 */
interface Dependencies {
  getClusterById: GetClusterById;
  openPathPickingDialog: OpenPathPickingDialog;
  isWindows: boolean;
}

/**
 * 🎯 목적: Terminal 설정 UI 컴포넌트 (Storybook 템플릿 기반)
 *
 * Storybook 템플릿과 동일한 UI 구조:
 * - Working directory: InputGroup with FolderSearch button
 * - Default namespace: Label + Input
 *
 * 기존 비즈니스 로직 보존:
 * - cluster.preferences.terminalCWD (Working directory)
 * - cluster.preferences.defaultNamespace (Default namespace)
 *
 * @param entity - 카탈로그 엔티티 (클러스터)
 * @param getClusterById - 클러스터 조회 함수 (DI)
 * @param openPathPickingDialog - 경로 선택 대화상자 함수 (DI)
 * @param isWindows - Windows 환경 여부 (DI)
 */
const NonInjectedTerminalContent = observer(
  ({ entity, getClusterById, openPathPickingDialog, isWindows }: TerminalContentProps & Dependencies) => {
    const cluster = getClusterById(entity.getId());
    const [workingDir, setWorkingDir] = React.useState("");
    const [defaultNs, setDefaultNs] = React.useState("");

    // 초기 값 설정
    React.useEffect(() => {
      if (cluster) {
        setWorkingDir(cluster.preferences.terminalCWD || "");
        setDefaultNs(cluster.preferences.defaultNamespace || "");
      }
    }, [cluster]);

    if (!cluster) {
      return null;
    }

    // 🎯 Working directory 변경 처리
    const handleWorkingDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setWorkingDir(e.target.value);
    };

    // 🎯 Working directory 저장 (onBlur 시)
    const handleWorkingDirBlur = () => {
      cluster.preferences.terminalCWD = workingDir || undefined;
    };

    // 🎯 Directory 선택 버튼 클릭
    const handleDirectoryClick = () => {
      openPathPickingDialog({
        message: "Choose Working Directory",
        buttonLabel: "Pick",
        properties: ["openDirectory", "showHiddenFiles"],
        onPick: ([directory]) => {
          if (directory) {
            setWorkingDir(directory);
            cluster.preferences.terminalCWD = directory;
          }
        },
      });
    };

    // 🎯 Default namespace 변경 처리
    const handleDefaultNsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setDefaultNs(e.target.value);
    };

    // 🎯 Default namespace 저장 (onBlur 시)
    const handleDefaultNsBlur = () => {
      cluster.preferences.defaultNamespace = defaultNs || undefined;
    };

    // 🎯 Placeholder 계산
    const workingDirPlaceholder = isWindows ? "$USERPROFILE" : "$HOME";

    return (
      <div className="flex w-full flex-col gap-6">
        {/* Working directory Field */}
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="working-directory" className="text-foreground text-sm font-medium">
            Working directory
          </Label>
          <InputGroup>
            <InputGroupInput
              id="working-directory"
              type="text"
              value={workingDir}
              onChange={handleWorkingDirChange}
              onBlur={handleWorkingDirBlur}
              placeholder={workingDirPlaceholder}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="default" size="icon-xs" onClick={handleDirectoryClick}>
                <FolderSearch className="h-4 w-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <p className="text-muted-foreground text-sm leading-5">
            An explicit start path where the terminal will be launched, this is used as the current working directory
            (cwd) for the shell process.
          </p>
        </div>

        {/* Default namespace Field */}
        <div className="flex w-full flex-col gap-3">
          <Label htmlFor="default-namespace" className="text-foreground text-sm font-medium">
            Default namespace
          </Label>
          <Input
            id="default-namespace"
            type="text"
            placeholder="default"
            className="bg-input/30 border-border"
            value={defaultNs}
            onChange={handleDefaultNsChange}
            onBlur={handleDefaultNsBlur}
          />
          <p className="text-muted-foreground text-sm leading-5">Default namespace used for kubectl.</p>
        </div>
      </div>
    );
  },
);

/**
 * DI 패턴 적용된 Terminal Content 컴포넌트
 */
export const TerminalContent = withInjectables<Dependencies, TerminalContentProps>(NonInjectedTerminalContent, {
  getProps: (di, props) => ({
    ...props,
    getClusterById: di.inject(getClusterByIdInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    isWindows: di.inject(isWindowsInjectable),
  }),
});
