import type { GetRxController } from "./controller";

export type ObsListener<T> = (value: T) => void;

export interface ObsEmitter<T> {
  use: () => T | undefined;
  on: (listener: ObsListener<T>) => void;
  off: (listener: ObsListener<T>) => void;
  value: T | undefined;
  get: () => T | undefined;
  set: (value: T) => void;
}

export type GetRxControllerFactory<T extends GetRxController> = () => T;