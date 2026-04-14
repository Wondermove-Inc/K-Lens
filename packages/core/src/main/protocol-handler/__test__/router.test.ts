/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LensProtocolRouterMain 테스트
 * 📝 skuber:// 프로토콜은 별도 핸들러에서 처리되므로
 *    이 router에서는 skuber:// URL을 무시합니다 (2026-01 변경)
 */

import { runInAction } from "mobx";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import broadcastMessageInjectable from "../../../common/ipc/broadcast-message.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import lensProtocolRouterMainInjectable from "../lens-protocol-router-main/lens-protocol-router-main.injectable";

import type { LensProtocolRouterMain } from "../lens-protocol-router-main/lens-protocol-router-main";

describe("protocol router tests", () => {
  let lpr: LensProtocolRouterMain;
  let broadcastMessageMock: jest.Mock;

  beforeEach(async () => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");

    broadcastMessageMock = jest.fn();
    di.override(broadcastMessageInjectable, () => broadcastMessageMock);

    lpr = di.inject(lensProtocolRouterMainInjectable);

    runInAction(() => {
      lpr.rendererLoaded.set(true);
    });
  });

  it("should silently ignore skuber:// URLs (handled by separate protocol handler)", async () => {
    await lpr.route("skuber://foobar");

    // skuber:// 프로토콜은 별도 핸들러에서 처리되므로 broadcastMessage가 호출되지 않음
    expect(broadcastMessageMock).not.toHaveBeenCalled();
  });

  it("should not throw on skuber:// app URL", async () => {
    await expect(lpr.route("skuber://app")).resolves.toBeUndefined();
  });

  it("should not throw on skuber:// extension URL", async () => {
    await expect(lpr.route("skuber://extension/@some/extension")).resolves.toBeUndefined();
  });
});
