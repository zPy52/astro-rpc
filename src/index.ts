import { useEndpoint } from "@/hook";
import { EndpointInfo } from "./info";
import { createEndpoint } from "@/server";

export const arpc = {
  use: useEndpoint,
  info: EndpointInfo,
  create: createEndpoint,
};
