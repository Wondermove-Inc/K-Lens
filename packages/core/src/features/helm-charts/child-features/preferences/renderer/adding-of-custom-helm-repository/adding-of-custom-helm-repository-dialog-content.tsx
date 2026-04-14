/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ChevronDown, ChevronUp, FolderSearch, Plus, X } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { toJS } from "../../../../../../common/utils";
import { Button } from "../../../../../../renderer/components/shadcn-ui/button";
import { Checkbox } from "../../../../../../renderer/components/shadcn-ui/checkbox";
// 🎯 목적: shadcn UI 컴포넌트 복사본에서 import
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../../../renderer/components/shadcn-ui/dialog";
import { Field, FieldLabel } from "../../../../../../renderer/components/shadcn-ui/field";
import { Input } from "../../../../../../renderer/components/shadcn-ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../../../renderer/components/shadcn-ui/input-group";
import { Label } from "../../../../../../renderer/components/shadcn-ui/label";
import customHelmRepoInjectable from "./custom-helm-repo.injectable";
import addingOfCustomHelmRepositoryDialogIsVisibleInjectable from "./dialog-visibility/adding-of-custom-helm-repository-dialog-is-visible.injectable";
import hideDialogForAddingCustomHelmRepositoryInjectable from "./dialog-visibility/hide-dialog-for-adding-custom-helm-repository.injectable";
import maximalCustomHelmRepoOptionsAreShownInjectable from "./maximal-custom-helm-repo-options-are-shown.injectable";
import submitCustomHelmRepositoryInjectable from "./submit-custom-helm-repository.injectable";

import type { IObservableValue } from "mobx";

import type { HelmRepo } from "../../../../../../common/helm/helm-repo";

interface Dependencies {
  helmRepo: HelmRepo;
  hideDialog: () => void;
  isDialogOpen: IObservableValue<boolean>;
  submitCustomRepository: (repository: HelmRepo) => Promise<void>;
  maximalOptionsAreShown: IObservableValue<boolean>;
}

const keyExtensions = ["key", "keystore", "jks", "p12", "pfx", "pem"];
const certExtensions = ["crt", "cer", "ca-bundle", "p7b", "p7c", "p7s", "p12", "pfx", "pem"];

const NonInjectedActivationOfCustomHelmRepositoryDialogContent = observer(
  ({ helmRepo, submitCustomRepository, maximalOptionsAreShown, hideDialog, isDialogOpen }: Dependencies) => {
    // 🎯 목적: 파일 입력 참조를 위한 ref
    const keyFileRef = React.useRef<HTMLInputElement>(null);
    const caFileRef = React.useRef<HTMLInputElement>(null);
    const certFileRef = React.useRef<HTMLInputElement>(null);

    const handleAddRepo = async () => {
      await submitCustomRepository(toJS(helmRepo));
    };

    return (
      <Dialog open={isDialogOpen.get()} onOpenChange={(open) => !open && hideDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          {/* Dialog Header */}
          <DialogHeader>
            <DialogTitle>Add custom Helm Repo</DialogTitle>
            <DialogDescription>Please add a helm repo.</DialogDescription>
          </DialogHeader>

          {/* Dialog Content - Form Fields */}
          <div className="flex flex-col gap-4" data-testid="add-custom-helm-repository-dialog">
            <Field>
              <FieldLabel>Helm repo name</FieldLabel>
              <Input
                type="text"
                placeholder="Enter a name"
                value={helmRepo.name}
                onChange={(e) => action(() => (helmRepo.name = e.target.value))()}
                data-testid="custom-helm-repository-name-input"
              />
            </Field>

            <Field>
              <FieldLabel>URL</FieldLabel>
              <Input
                type="text"
                placeholder="Enter a url"
                value={helmRepo.url}
                onChange={(e) => action(() => (helmRepo.url = e.target.value))()}
                data-testid="custom-helm-repository-url-input"
              />
            </Field>

            {/* 🎯 목적: 축소 상태일 때 Expand 버튼 표시 */}
            {!maximalOptionsAreShown.get() && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit gap-2 self-start"
                onClick={action(() => maximalOptionsAreShown.set(true))}
                data-testid="toggle-maximal-options-for-custom-helm-repository-button"
              >
                Expand
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}

            {/* 🎯 목적: 확장 시 추가 보안 설정 필드 표시 */}
            {maximalOptionsAreShown.get() && (
              <>
                <div className="flex flex-col gap-2.5" data-testid="maximal-options-for-custom-helm-repository-dialog">
                  {/* Security settings 섹션 */}
                  <Field>
                    <FieldLabel>Security settings</FieldLabel>
                    <InputGroup>
                      <InputGroupInput placeholder="Key file" value={helmRepo.keyFile || ""} readOnly />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton size="icon-xs" variant="default" onClick={() => keyFileRef.current?.click()}>
                          <FolderSearch className="h-4 w-4" />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <input
                      type="file"
                      ref={keyFileRef}
                      className="hidden"
                      accept={keyExtensions.map((ext) => `.${ext}`).join(",")}
                      onChange={(e) => action(() => (helmRepo.keyFile = e.target.files?.[0]?.path || ""))()}
                      data-testid="custom-helm-repository-key-file-input"
                    />
                  </Field>

                  <InputGroup>
                    <InputGroupInput placeholder="Ca file" value={helmRepo.caFile || ""} readOnly />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton size="icon-xs" variant="default" onClick={() => caFileRef.current?.click()}>
                        <FolderSearch className="h-4 w-4" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <input
                    type="file"
                    ref={caFileRef}
                    className="hidden"
                    accept={certExtensions.map((ext) => `.${ext}`).join(",")}
                    onChange={(e) => action(() => (helmRepo.caFile = e.target.files?.[0]?.path || ""))()}
                    data-testid="custom-helm-repository-ca-cert-file-input"
                  />

                  <InputGroup>
                    <InputGroupInput placeholder="Certificate file" value={helmRepo.certFile || ""} readOnly />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton size="icon-xs" variant="default" onClick={() => certFileRef.current?.click()}>
                        <FolderSearch className="h-4 w-4" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <input
                    type="file"
                    ref={certFileRef}
                    className="hidden"
                    accept={certExtensions.map((ext) => `.${ext}`).join(",")}
                    onChange={(e) => action(() => (helmRepo.certFile = e.target.files?.[0]?.path || ""))()}
                    data-testid="custom-helm-repository-cert-file-input"
                  />

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skip-tls"
                      checked={helmRepo.insecureSkipTlsVerify}
                      onCheckedChange={(checked) => action(() => (helmRepo.insecureSkipTlsVerify = checked === true))()}
                      data-testid="custom-helm-repository-verify-tls-input"
                    />
                    <Label htmlFor="skip-tls" className="text-sm font-light text-[var(--textColorSecondary)]">
                      Skip TLS certificate checks for the repository
                    </Label>
                  </div>

                  {/* Chart Repository Credentials 섹션 */}
                  <Field className="mt-1.5">
                    <FieldLabel>Chart Repository Credentials</FieldLabel>
                    <Input
                      type="text"
                      placeholder="Username"
                      value={helmRepo.username}
                      onChange={(e) => action(() => (helmRepo.username = e.target.value))()}
                      data-testid="custom-helm-repository-username-input"
                    />
                  </Field>

                  <Input
                    type="password"
                    placeholder="Password"
                    value={helmRepo.password}
                    onChange={(e) => action(() => (helmRepo.password = e.target.value))()}
                    data-testid="custom-helm-repository-password-input"
                  />
                </div>

                {/* 🎯 목적: 확장 상태일 때 Collapse 버튼을 하단에 표시 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit gap-2 self-start"
                  onClick={action(() => maximalOptionsAreShown.set(false))}
                >
                  Collapse
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Dialog Footer */}
          <DialogFooter>
            <Button variant="ghost" onClick={hideDialog} data-testid="custom-helm-repository-cancel-button">
              Cancel
            </Button>
            <Button
              onClick={handleAddRepo}
              className="gap-2 !text-white"
              data-testid="custom-helm-repository-submit-button"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DialogFooter>

          {/* Custom Close Icon */}
          <button
            type="button"
            className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
            onClick={hideDialog}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogContent>
      </Dialog>
    );
  },
);

export const AddingOfCustomHelmRepositoryDialogContent = withInjectables<Dependencies>(
  NonInjectedActivationOfCustomHelmRepositoryDialogContent,
  {
    getProps: (di) => ({
      helmRepo: di.inject(customHelmRepoInjectable),
      hideDialog: di.inject(hideDialogForAddingCustomHelmRepositoryInjectable),
      isDialogOpen: di.inject(addingOfCustomHelmRepositoryDialogIsVisibleInjectable),
      submitCustomRepository: di.inject(submitCustomHelmRepositoryInjectable),
      maximalOptionsAreShown: di.inject(maximalCustomHelmRepoOptionsAreShownInjectable),
    }),
  },
);
