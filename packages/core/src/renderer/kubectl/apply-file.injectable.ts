/**
 * 🎯 목적: kubectl apply (파일 기반) Renderer injectable
 * 📝 기능: Main 프로세스의 kubectl-apply-file 채널 호출
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-030 - 초기 구현
 * @module renderer/kubectl/apply-file
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type KubectlFileRequest,
  type KubectlFileResponse,
  kubectlApplyFileChannel,
} from "../../common/ipc/kubectl-apply";

export type KubectlApplyFile = (req: KubectlFileRequest) => Promise<KubectlFileResponse>;

const kubectlApplyFileInjectable = getInjectable({
  id: "kubectl-apply-file",
  instantiate: (di): KubectlApplyFile => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (req) => requestFromChannel(kubectlApplyFileChannel, req);
  },
});

export default kubectlApplyFileInjectable;
