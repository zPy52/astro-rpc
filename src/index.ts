import { createInfo } from "@/info";
import { useEndpoint } from "@/hook";
import { createEndpoint } from "@/server";

export const a = {
  use: useEndpoint,
  info: createInfo,
  create: createEndpoint,
};

export const arpc = a;
