import { useEndpoint } from "@/hook";
import { EndpointInfo } from "./info";
import { createEndpoint } from "@/server";

export const a = {
  use: useEndpoint,
  info: EndpointInfo,
  create: createEndpoint,
};

export const arpc = a;