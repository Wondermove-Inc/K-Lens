/**
 * 🎯 목적: Kubernetes 리소스 Scale Dialog 공통 컴포넌트
 *
 * @remarks
 * - shadcn/ui 기반 Dialog, Slider, ButtonGroup 사용
 * - Deployments, StatefulSets, ReplicaSets 공통 사용
 * - MobX observable 상태 관리와 통합
 *
 * 📝 주의사항:
 * - @skuberplus/storybook-shadcn 패키지 의존성 필요
 * - 부모 컴포넌트에서 API 호출 로직 구현 필요
 *
 * 🔄 변경이력:
 * - 2025-11-17: 초기 생성 (기존 Material-UI 기반 Scale Dialog를 shadcn으로 마이그레이션)
 */

import { Alert, AlertDescription } from "@skuberplus/storybook-shadcn/src/components/ui/alert";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { ButtonGroup } from "@skuberplus/storybook-shadcn/src/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/dialog";
import { Slider } from "@skuberplus/storybook-shadcn/src/components/ui/slider";
import { AlertTriangleIcon, MinusIcon, PlusIcon } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";

/**
 * 🎯 목적: ScaleDialog 컴포넌트 Props 정의
 */
export interface ScaleDialogProps {
  /**
   * Dialog 열림 상태
   */
  isOpen: boolean;
  /**
   * Dialog 닫기 핸들러
   */
  onClose: () => void;
  /**
   * Scale 실행 핸들러
   */
  onScale: () => void | Promise<void>;
  /**
   * 리소스 타입 (Deployment, StatefulSet, ReplicaSet)
   */
  resourceType: string;
  /**
   * 리소스 이름
   */
  resourceName: string;
  /**
   * 현재 레플리카 수
   */
  currentReplicas: number;
  /**
   * 원하는 레플리카 수
   */
  desiredReplicas: number;
  /**
   * 레플리카 수 변경 핸들러
   */
  onDesiredReplicasChange: (value: number) => void;
  /**
   * API 호출 완료 상태
   */
  ready?: boolean;
  /**
   * 최대 레플리카 수 (기본값: 자동 계산)
   */
  maxReplicas?: number;
  /**
   * 최소 레플리카 수 (기본값: 0)
   */
  minReplicas?: number;
}

/**
 * 🎯 목적: Kubernetes 리소스 Scale Dialog
 *
 * @param props - ScaleDialogProps
 * @returns shadcn 기반 Scale Dialog 컴포넌트
 *
 * @example
 * <ScaleDialog
 *   isOpen={Boolean(deployment)}
 *   onClose={() => state.set(undefined)}
 *   onScale={() => deploymentApi.scale(...)}
 *   resourceType="Deployment"
 *   resourceName={deployment.getName()}
 *   currentReplicas={currentReplicas}
 *   desiredReplicas={desiredReplicas}
 *   onDesiredReplicasChange={(value) => setDesiredReplicas(value)}
 *   ready={ready}
 * />
 */
export const ScaleDialog = observer(function ScaleDialog({
  isOpen,
  onClose,
  onScale,
  resourceType,
  resourceName,
  currentReplicas,
  desiredReplicas,
  onDesiredReplicasChange,
  ready = true,
  maxReplicas,
  minReplicas = 0,
}: ScaleDialogProps) {
  // 🎯 최대 레플리카 수 자동 계산 (기본값 50, 현재 값의 2배)
  const scaleMax = React.useMemo(() => {
    if (maxReplicas !== undefined) {
      return maxReplicas;
    }
    const defaultMax = 50;
    return currentReplicas <= defaultMax ? defaultMax * 2 : currentReplicas * 2;
  }, [currentReplicas, maxReplicas]);

  // 🚨 높은 레플리카 수 경고 표시
  const showWarning = currentReplicas < 10 && desiredReplicas > 90;

  // ⬆️ 레플리카 수 증가
  const handleIncrement = () => {
    onDesiredReplicasChange(Math.min(scaleMax, desiredReplicas + 1));
  };

  // ⬇️ 레플리카 수 감소
  const handleDecrement = () => {
    onDesiredReplicasChange(Math.max(minReplicas, desiredReplicas - 1));
  };

  // 🎚️ Slider 값 변경 핸들러
  const handleSliderChange = (values: number[]) => {
    if (values.length > 0) {
      onDesiredReplicasChange(values[0]);
    }
  };

  // ✅ Scale 실행
  const handleScale = async () => {
    await onScale();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Scale {resourceType}</DialogTitle>
          <DialogDescription>{resourceName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 현재 레플리카 수 표시 */}
          <div className="flex items-center gap-2" data-testid="current-scale">
            <span className="text-sm font-medium">Current replica scale</span>
            <span className="text-sm text-muted-foreground">{currentReplicas}</span>
          </div>

          {/* 원하는 레플리카 수 조절 영역 - 한 줄에 모두 배치 */}
          <div className="flex items-center gap-2" data-testid="desired-scale">
            <span className="text-sm font-medium whitespace-nowrap">Desired number of replicas</span>
            <span className="text-sm text-muted-foreground">{desiredReplicas}</span>
            <Slider
              value={[desiredReplicas]}
              onValueChange={handleSliderChange}
              max={scaleMax}
              min={minReplicas}
              step={1}
              className="flex-1"
              data-testid="replica-slider"
            />
            <ButtonGroup>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={desiredReplicas <= minReplicas}
                data-testid="desired-replicas-down"
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleIncrement}
                disabled={desiredReplicas >= scaleMax}
                data-testid="desired-replicas-up"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </ButtonGroup>
          </div>

          {/* 경고 메시지 */}
          {showWarning && (
            <Alert variant="destructive" data-testid="warning">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>High number of replicas may cause cluster performance issues</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={handleScale}
            disabled={!ready || currentReplicas === desiredReplicas}
          >
            Scale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ScaleDialog;
