import type { ZodTypeAny } from "zod";

export class EndpointInfo<
  I extends ZodTypeAny = ZodTypeAny,
  O extends ZodTypeAny = ZodTypeAny
> {
  public readonly endpoint: string;
  public readonly input: I;
  public readonly output: O;

  public constructor({
    endpoint,
    input,
    output,
  }: {
    endpoint: string;
    input: I;
    output: O;
  }) {
    this.input = input;
    this.output = output;
    this.endpoint = endpoint;
  }
}

export function createInfo<
  I extends ZodTypeAny = ZodTypeAny,
  O extends ZodTypeAny = ZodTypeAny
>(args: { endpoint: string; input: I; output: O }) {
  return new EndpointInfo(args);
}
