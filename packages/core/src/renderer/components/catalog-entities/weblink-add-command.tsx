/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import addWeblinkInjectable from "../../../features/weblinks/common/add.injectable";
import commandOverlayInjectable from "../command-palette/command-overlay.injectable";
import { Input } from "../input";
import { isUrl } from "../input/input_validators";

import type { AddWeblink } from "../../../features/weblinks/common/add.injectable";

interface Dependencies {
  closeCommandOverlay: () => void;
  addWeblink: AddWeblink;
}

class NonInjectedWeblinkAddCommand extends Component<Dependencies> {
  @observable url = "";
  @observable nameHidden = true;
  @observable dirty = false;

  constructor(props: Dependencies) {
    super(props);
    makeObservable(this);
  }

  onChangeUrl(url: string) {
    this.dirty = true;
    this.url = url;
  }

  onSubmitUrl(url: string) {
    this.dirty = true;
    this.url = url;
    this.nameHidden = false;
  }

  onSubmit(name: string) {
    this.props.addWeblink({
      name: name || this.url,
      url: this.url,
    });
    this.props.closeCommandOverlay();
  }

  @computed get showValidation() {
    return this.url?.length > 0;
  }

  render() {
    return (
      <>
        <Input
          placeholder="Link URL"
          autoFocus={this.nameHidden}
          theme="round-black"
          data-test-id="command-palette-weblink-add-url"
          validators={[isUrl]}
          dirty={this.dirty}
          value={this.url}
          onChange={(v) => this.onChangeUrl(v)}
          onSubmit={(v) => this.onSubmitUrl(v)}
          showValidationLine={true}
        />
        {this.nameHidden && (
          <small className="hint">
            Please provide a web link URL (Press &quot;Enter&quot; to continue or &quot;Escape&quot; to cancel)
          </small>
        )}
        {!this.nameHidden && (
          <>
            <Input
              placeholder="Name (optional)"
              autoFocus={true}
              theme="round-black"
              data-test-id="command-palette-weblink-add-name"
              onSubmit={(v) => this.onSubmit(v)}
              dirty={true}
            />
            <small className="hint">
              Please provide a name for the web link (Press &quot;Enter&quot; to confirm or &quot;Escape&quot; to
              cancel)
            </small>
          </>
        )}
      </>
    );
  }
}

export const WeblinkAddCommand = withInjectables<Dependencies>(observer(NonInjectedWeblinkAddCommand), {
  getProps: (di, props) => ({
    ...props,
    closeCommandOverlay: di.inject(commandOverlayInjectable).close,
    addWeblink: di.inject(addWeblinkInjectable),
  }),
});
