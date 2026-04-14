/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { ClusterId } from "../../../../common/cluster-types";

export const clearClusterAsDeletingChannel = getRequestChannel<ClusterId, void>("clear-cluster-as-deleting");
