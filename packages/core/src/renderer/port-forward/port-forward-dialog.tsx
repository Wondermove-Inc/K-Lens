/**
 * 🎯 목적: Port Forward Dialog 컴포넌트
 *
 * @remarks
 * - shadcn/ui 기반 Dialog, Field, Input, Checkbox 사용
 * - Pod, Service 등의 포트 포워딩 설정
 * - MobX observable 상태 관리
 *
 * 📝 주의사항:
 * - Dialog 상태는 PortForwardDialogModel로 관리
 * - API 호출은 portForwardStore 사용
 *
 * 🔄 변경이력:
 * - 2025-11-17: shadcn 기반 Dialog, Field, Input, Checkbox로 마이그레이션
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Checkbox } from "@skuberplus/storybook-shadcn/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/dialog";
import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import { Label } from "@skuberplus/storybook-shadcn/src/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { makeObservable, observable, reaction } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import aboutPortForwardingInjectable from "./about-port-forwarding.injectable";
import notifyErrorPortForwardingInjectable from "./notify-error-port-forwarding.injectable";
import openPortForwardInjectable from "./open-port-forward.injectable";
import portForwardDialogModelInjectable from "./port-forward-dialog-model/port-forward-dialog-model.injectable";
import portForwardStoreInjectable from "./port-forward-store/port-forward-store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { IReactionDisposer } from "mobx";

import type { OpenPortForward } from "./open-port-forward.injectable";
import type {
  PortForwardDialogData,
  PortForwardDialogModel,
} from "./port-forward-dialog-model/port-forward-dialog-model";
import type { PortForwardStore } from "./port-forward-store/port-forward-store";

export interface PortForwardDialogProps {}

interface Dependencies {
  portForwardStore: PortForwardStore;
  model: PortForwardDialogModel;
  logger: Logger;
  aboutPortForwarding: () => void;
  notifyErrorPortForwarding: (message: string) => void;
  openPortForward: OpenPortForward;
}

@observer
class NonInjectedPortForwardDialog extends Component<PortForwardDialogProps & Dependencies> {
  @observable currentPort = 0;
  @observable desiredPort = 0;
  @observable desiredAddress = "localhost";

  private disposer: IReactionDisposer | null = null;

  constructor(props: PortForwardDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidMount() {
    this.disposer = reaction(
      () => this.props.model.data.get(),
      (data) => {
        if (data) {
          this.onOpen(data);
        }
      },
      { fireImmediately: true },
    );
  }

  componentWillUnmount() {
    this.disposer?.();
  }

  get portForwardStore() {
    return this.props.portForwardStore;
  }

  onOpen = (data: PortForwardDialogData) => {
    this.currentPort = +data.portForward.forwardPort;
    this.desiredPort = this.currentPort;
    this.desiredAddress = data.portForward.address ?? "localhost";
  };

  changePort = (value: string) => {
    this.desiredPort = Number(value);
  };

  changeAddress = (value: string) => {
    this.desiredAddress = value;
  };

  startPortForward = async (data: PortForwardDialogData) => {
    let { portForward } = data;
    const { currentPort, desiredPort } = this;

    portForward.address = this.desiredAddress;

    try {
      const { length } = this.portForwardStore.getPortForwards();

      portForward.protocol = data.useHttps ? "https" : "http";

      if (currentPort) {
        const wasRunning = portForward.status === "Active";

        portForward = await this.portForwardStore.modify(portForward, desiredPort);

        if (wasRunning && portForward.status === "Disabled") {
          this.props.notifyErrorPortForwarding(
            `Error occurred starting port-forward, the local port ${portForward.forwardPort} may not be available or the ${portForward.kind} ${portForward.name} may not be reachable`,
          );
        }
      } else {
        portForward.forwardPort = desiredPort;
        portForward = await this.portForwardStore.add(portForward);

        if (portForward.status === "Disabled") {
          this.props.notifyErrorPortForwarding(
            `Error occurred starting port-forward, the local port ${portForward.forwardPort} may not be available or the ${portForward.kind} ${portForward.name} may not be reachable`,
          );
        } else {
          if (!length) {
            this.props.aboutPortForwarding();
          }
        }
      }

      if (portForward.status === "Active" && data.openInBrowser) {
        this.props.openPortForward(portForward);
      }
    } catch (error) {
      this.props.logger.error(`[PORT-FORWARD-DIALOG]: ${error}`, portForward);
    } finally {
      data.onClose?.();
      this.props.model.close();
    }
  };

  render() {
    const { model } = this.props;
    const data = model.data.get();
    const isOpen = Boolean(data);

    return (
      <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && model.close()}>
        <DialogContent className="sm:max-w-md" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Port Forwarding</DialogTitle>
            <DialogDescription>{data?.portForward.name}</DialogDescription>
          </DialogHeader>

          {data && (
            <div className="space-y-4 py-4">
              {/* Address Field */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Label htmlFor="address" className="text-sm font-medium">
                    Addresses to listen on (comma separated)
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>
                          Only accepts IP addresses or localhost as a value. When localhost is supplied, kubectl will
                          try to bind on both 127.0.0.1 and ::1 and will fail if neither of these addresses are
                          available to bind.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="address"
                  placeholder="localhost"
                  value={this.desiredAddress}
                  onChange={(e) => this.changeAddress(e.target.value)}
                  data-testid="current-address"
                  className="flex-1"
                />
              </div>

              {/* Port Field */}
              <div className="flex items-center gap-3">
                <Label htmlFor="port" className="text-sm font-medium whitespace-nowrap">
                  Local port to forward from
                </Label>
                <Input
                  id="port"
                  type="number"
                  min={0}
                  max={65535}
                  value={this.desiredPort === 0 ? "" : String(this.desiredPort)}
                  placeholder="Random"
                  onChange={(e) => this.changePort(e.target.value)}
                  autoFocus
                  data-testid="current-port"
                  className="flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* HTTPS Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="https"
                  checked={data.useHttps}
                  onCheckedChange={(checked) => (data.useHttps = checked === true)}
                  data-testid="port-forward-https"
                />
                <Label htmlFor="https" className="text-sm font-medium">
                  Use HTTPS
                </Label>
              </div>

              {/* Open in Browser Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="openInBrowser"
                  checked={data.openInBrowser}
                  onCheckedChange={(checked) => (data.openInBrowser = checked === true)}
                  data-testid="port-forward-open"
                />
                <Label htmlFor="openInBrowser" className="text-sm font-medium">
                  Open in Browser
                </Label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="default" onClick={model.close}>
              Cancel
            </Button>
            <Button variant="default" size="default" onClick={() => data && this.startPortForward(data)}>
              {this.currentPort === 0 ? "Start" : "Modify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const PortForwardDialog = withInjectables<Dependencies, PortForwardDialogProps>(NonInjectedPortForwardDialog, {
  getProps: (di, props) => ({
    ...props,
    portForwardStore: di.inject(portForwardStoreInjectable),
    model: di.inject(portForwardDialogModelInjectable),
    aboutPortForwarding: di.inject(aboutPortForwardingInjectable),
    notifyErrorPortForwarding: di.inject(notifyErrorPortForwardingInjectable),
    openPortForward: di.inject(openPortForwardInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
