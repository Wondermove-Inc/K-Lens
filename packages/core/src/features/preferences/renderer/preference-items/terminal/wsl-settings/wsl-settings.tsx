/**
 * 🎯 목적: WSL (Windows Subsystem for Linux) 설정 컴포넌트
 * 📝 기능:
 *   - WSL 설치 상태 표시
 *   - WSL 활성화 스위치
 *   - WSL 배포판 선택 드롭다운
 * 🔄 변경이력:
 *   - 2026-02-03: WSL UX 개선 - 초기 구현
 * @module features/preferences/renderer/preference-items/terminal/wsl-settings
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Spinner } from "@skuberplus/spinner";
import { ipcRenderer } from "electron";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useState } from "react";
import { wslChannels } from "../../../../../../common/ipc/wsl";
import isWindowsInjectable from "../../../../../../common/vars/is-windows.injectable";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Select } from "../../../../../../renderer/components/select";
import { Switch } from "../../../../../../renderer/components/switch";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { WslDistrosResponse, WslStatusResponse } from "../../../../../../common/ipc/wsl";
import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
  isWindows: boolean;
}

const NonInjectedWslSettings = observer(({ state, isWindows }: Dependencies) => {
  const [wslInstalled, setWslInstalled] = useState<boolean | null>(null);
  const [distros, setDistros] = useState<string[]>([]);
  const [defaultDistro, setDefaultDistro] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // WSL 상태 및 배포판 조회
  const checkWslStatus = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const statusResponse: WslStatusResponse = await ipcRenderer.invoke(wslChannels.getStatus);

      setWslInstalled(statusResponse.installed);

      if (statusResponse.installed) {
        const distrosResponse: WslDistrosResponse = await ipcRenderer.invoke(wslChannels.getDistros);

        if (distrosResponse.success) {
          setDistros(distrosResponse.distros);
          setDefaultDistro(distrosResponse.defaultDistro);
        } else {
          setError(distrosResponse.error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isWindows) {
      checkWslStatus();
    } else {
      setLoading(false);
    }
  }, [isWindows, checkWslStatus]);

  if (!isWindows) {
    return null;
  }

  // 로딩 상태
  if (loading) {
    return (
      <section id="wsl-settings">
        <SubTitle title="WSL (Windows Subsystem for Linux)" />
        <div className="flex items-center gap-2">
          <Spinner />
          <span>Checking WSL status...</span>
        </div>
      </section>
    );
  }

  // WSL 미설치 상태
  if (!wslInstalled) {
    return (
      <section id="wsl-settings">
        <SubTitle title="WSL (Windows Subsystem for Linux)" />
        <div className="flex flex-col gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <Icon material="warning" />
            <span className="font-medium">WSL is not installed</span>
          </div>
          <p className="text-sm text-yellow-600 dark:text-yellow-500">
            To use WSL as your terminal shell, install it by running the following command in PowerShell
            (Administrator):
          </p>
          <code className="text-sm bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded font-mono">wsl --install</code>
        </div>
      </section>
    );
  }

  // 배포판 옵션 생성
  const distributionOptions = [
    {
      value: "",
      label: `Use default distribution${defaultDistro ? ` (${defaultDistro})` : ""}`,
    },
    ...distros.map((distro) => ({
      value: distro,
      label: distro === defaultDistro ? `${distro} (Default)` : distro,
    })),
  ];

  const handleWslToggle = () => {
    state.wslEnabled = !state.wslEnabled;

    // WSL 비활성화 시 배포판 설정도 초기화
    if (!state.wslEnabled) {
      state.wslDistribution = "";
    }
  };

  return (
    <section id="wsl-settings">
      <SubTitle title="WSL (Windows Subsystem for Linux)" />

      <div className="flex flex-col gap-4">
        {/* WSL 활성화 스위치 */}
        <Switch checked={state.wslEnabled} onChange={handleWslToggle}>
          Use WSL as terminal shell
        </Switch>

        {/* WSL 활성화 시 배포판 선택 표시 */}
        {state.wslEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <label className="text-sm text-gray-600 dark:text-gray-400">Distribution</label>
            <div className="flex items-center gap-2">
              <Select
                id="wsl-distribution-select"
                themeName="lens"
                options={distributionOptions}
                value={state.wslDistribution}
                onChange={(option) => (state.wslDistribution = option?.value ?? "")}
                className="flex-1"
              />
              <button
                type="button"
                onClick={checkWslStatus}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Refresh distributions"
              >
                <Icon material="refresh" />
              </button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {distros.length === 0 && !error && (
              <p className="text-sm text-gray-500">
                No distributions installed. Install a distribution using &quot;wsl --install -d Ubuntu&quot;.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
});

export const WslSettings = withInjectables<Dependencies>(NonInjectedWslSettings, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
    isWindows: di.inject(isWindowsInjectable),
  }),
});
