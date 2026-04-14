/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job의 실행 시간(Duration)을 Tooltip과 함께 표시
 *
 * @param job - Job 객체
 * @returns WithTooltip 컴포넌트 (hover 시 시작/완료 시간 표시)
 *
 * 📝 주의사항:
 * - formatDuration()으로 사람이 읽기 쉬운 형식으로 변환 (예: "5m 30s")
 * - Tooltip에 시작 시간(startTime)과 완료 시간(completionTime) 표시
 * - startTime이 없으면 빈 문자열 tooltip
 * - completionTime이 없으면 "Start time: ..." 만 표시 (실행 중)
 * - 둘 다 있으면 시작/완료 시간 모두 표시
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (shadcn 마이그레이션)
 */

import { formatDuration } from "@skuberplus/utilities/dist";
import React from "react";
import { DurationAbsoluteTimestamp } from "../../events";
import { WithTooltip } from "../../with-tooltip";

import type { Job } from "@skuberplus/kube-object";

/**
 * 🎯 목적: Duration Tooltip 내용 생성
 *
 * @param job - Job 객체
 * @returns Tooltip에 표시할 내용 (JSX 또는 문자열)
 *
 * 📝 로직:
 * - startTime 없음 → 빈 문자열
 * - completionTime 없음 → "Start time: ..." 만 표시
 * - 둘 다 있음 → "Start time: ...\nCompletion time: ..." 표시
 */
const durationTooltip = (job: Job) => {
  const startTime = job.status?.startTime;
  const completionTime = job.status?.completionTime;

  if (!startTime) {
    return "";
  }

  if (!completionTime) {
    return `Start time: ${startTime}`;
  }

  return (
    <>
      Start time: <DurationAbsoluteTimestamp timestamp={startTime} />
      <br />
      Completion time: <DurationAbsoluteTimestamp timestamp={completionTime} />
    </>
  );
};

export const DurationCell = ({ job }: { job: Job }) => {
  const duration = job.getJobDuration();
  const formattedDuration = formatDuration(duration);
  const tooltip = durationTooltip(job);

  return <WithTooltip tooltip={tooltip}>{formattedDuration}</WithTooltip>;
};
