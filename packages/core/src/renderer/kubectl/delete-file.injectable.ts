/**
 * 🎯 목적: kubectl delete (파일 기반) Renderer injectable
 * 📝 기능: Main 프로세스의 kubectl-delete-file 채널 호출
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-030 - 초기 구현
 * @module renderer/kubectl/delete-file
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type KubectlFileRequest,
  type KubectlFileResponse,
  kubectlDeleteFileChannel,
} from "../../common/ipc/kubectl-apply";

export type KubectlDeleteFile = (req: KubectlFileRequest) => Promise<KubectlFileResponse>;

const kubectlDeleteFileInjectable = getInjectable({
  id: "kubectl-delete-file",
  instantiate: (di): KubectlDeleteFile => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (req) => requestFromChannel(kubectlDeleteFileChannel, req);
  },
});

export default kubectlDeleteFileInjectable;
