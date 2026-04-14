/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import lensProxyCertificateInjectable from "../../common/certificate/lens-proxy-certificate.injectable";
import { lensProxyCertificateChannel } from "../../common/certificate/lens-proxy-certificate-channel";

const lensProxyCertificateRequestHandlerInjectable = getRequestChannelListenerInjectable({
  id: "lens-proxy-certificate-request-handler-listener",
  channel: lensProxyCertificateChannel,
  getHandler: (di) => {
    const lensProxyCertificate = di.inject(lensProxyCertificateInjectable).get();

    return () => ({
      cert: lensProxyCertificate.cert,
      public: lensProxyCertificate.public,
      private: "",
    });
  },
});

export default lensProxyCertificateRequestHandlerInjectable;
