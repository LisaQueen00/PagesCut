import { useSyncExternalStore } from "react";
import {
  enableWebLlm,
  getWebLlmStatus,
  getWebLlmStatusDetail,
  resetWebLlm,
  subscribeWebLlmStatus,
  type WebLlmStatus,
} from "@/lib/webLlm";

export interface WebLlmState {
  status: WebLlmStatus;
  detail: string;
  enable: () => Promise<boolean>;
  reset: () => void;
}

const statusSnapshot = () => `${getWebLlmStatus()}\u0000${getWebLlmStatusDetail()}`;

function subscribe(callback: () => void) {
  return subscribeWebLlmStatus(() => callback());
}

export function useWebLlmStatus(): WebLlmState {
  useSyncExternalStore(subscribe, statusSnapshot, statusSnapshot);
  return {
    status: getWebLlmStatus(),
    detail: getWebLlmStatusDetail(),
    enable: () => enableWebLlm(),
    reset: resetWebLlm,
  };
}
