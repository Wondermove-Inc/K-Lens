/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";

import type { JsonApiErrorParsed } from "@skuberplus/json-api";

/**
 * 🎯 목적: NotificationMessage 타입을 Sonner가 처리할 수 있는 문자열로 변환
 * 📝 주의사항: React.ReactElement는 텍스트 내용만 추출함
 * 🔄 변경이력: 2025-11-25 - Sonner 마이그레이션을 위해 신규 생성
 */

export type NotificationId = string | number;
export type NotificationMessage = string | React.ReactElement | React.ReactElement[] | JsonApiErrorParsed | Error;

export interface CreateNotificationOptions {
  id?: NotificationId;
  timeout?: number;
  onClose?(): void;
}

/**
 * 🎯 목적: Notification 표시 함수의 타입 정의
 * 📝 주의사항: Disposer 함수를 반환하여 알림을 수동으로 닫을 수 있음
 */
export type ShowNotification = (message: NotificationMessage, opts?: CreateNotificationOptions) => () => void;

/**
 * React Element에서 텍스트 내용을 추출
 */
function extractTextFromReactElement(element: React.ReactElement): string {
  const children = element.props?.children;

  if (typeof children === "string") {
    return children;
  }

  if (typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children
      .map((child) => {
        if (typeof child === "string") return child;
        if (typeof child === "number") return String(child);
        if (React.isValidElement(child)) return extractTextFromReactElement(child);
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }

  if (React.isValidElement(children)) {
    return extractTextFromReactElement(children);
  }

  return "";
}

/**
 * 다양한 메시지 타입을 Sonner가 처리할 수 있는 문자열로 변환
 * @param message - NotificationMessage 타입의 메시지
 * @returns 문자열로 변환된 메시지
 */
export function convertMessageToString(message: NotificationMessage): string {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Error) {
    return message.message;
  }

  // JsonApiErrorParsed 처리 (toString() 메서드가 있음)
  if (message && typeof (message as JsonApiErrorParsed).toString === "function" && !(message instanceof Error)) {
    const stringified = (message as JsonApiErrorParsed).toString();
    if (stringified !== "[object Object]") {
      return stringified;
    }
  }

  // React Element 처리
  if (React.isValidElement(message)) {
    const text = extractTextFromReactElement(message);
    return text || "Notification";
  }

  // React Element 배열 처리
  if (Array.isArray(message)) {
    const texts = message.map((el) => {
      if (React.isValidElement(el)) {
        return extractTextFromReactElement(el);
      }
      return String(el);
    });
    return texts.filter(Boolean).join(" ") || "Notification";
  }

  return String(message);
}
