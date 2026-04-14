/**
 * 🎯 목적: kubectl diff (파일 기반) Renderer injectable
 * 📝 기능: Main 프로세스의 kubectl-diff-file 채널 호출
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-030 - 초기 구현
 * @module renderer/kubectl/diff-file
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type KubectlFileRequest,
  type KubectlFileResponse,
  kubectlDiffFileChannel,
} from "../../common/ipc/kubectl-apply";

export type KubectlDiffFile = (req: KubectlFileRequest) => Promise<KubectlFileResponse>;

const kubectlDiffFileInjectable = getInjectable({
  id: "kubectl-diff-file",
  instantiate: (di): KubectlDiffFile => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (req) => requestFromChannel(kubectlDiffFileChannel, req);
  },
});

export default kubectlDiffFileInjectable;
