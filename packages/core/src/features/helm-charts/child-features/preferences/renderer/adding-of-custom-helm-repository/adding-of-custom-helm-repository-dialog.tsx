/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./add-helm-repo-dialog.scss";

import React from "react";
import { AddingOfCustomHelmRepositoryDialogContent } from "./adding-of-custom-helm-repository-dialog-content";

// 🎯 목적: shadcn Dialog를 사용하므로 기존 Dialog 래퍼 제거
// Dialog 자체가 AddingOfCustomHelmRepositoryDialogContent 내부에서 관리됨
export const AddingOfCustomHelmRepositoryDialog = () => <AddingOfCustomHelmRepositoryDialogContent />;
