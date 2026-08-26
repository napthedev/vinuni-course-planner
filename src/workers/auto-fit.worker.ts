/// <reference lib="webworker" />

import {
  AutoFitWorkerRequest,
  AutoFitWorkerResponse,
  autoFitSchedule,
} from "@/lib/auto-fit-algorithm";

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<AutoFitWorkerRequest>) => {
  const { requestId, input } = event.data;

  try {
    const response: AutoFitWorkerResponse = {
      requestId,
      result: autoFitSchedule(input),
    };
    worker.postMessage(response);
  } catch (error) {
    const response: AutoFitWorkerResponse = {
      requestId,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while generating schedules.",
    };
    worker.postMessage(response);
  }
};

export {};
