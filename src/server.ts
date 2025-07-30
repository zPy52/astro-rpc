import type { APIContext, APIRoute } from "astro";
import { z, type ZodTypeAny } from "zod";
import type { EndpointInfo } from "./info";

type ProcedureFunction<I, O> = (
  args: {
    input: I;
  } & APIContext
) => O | Promise<O>;

class ARPCProcedure<
  I extends ZodTypeAny = ZodTypeAny,
  O extends ZodTypeAny = ZodTypeAny
> {
  private handler!: ProcedureFunction<I, O>;
  public constructor(private schemas: EndpointInfo<I, O>) {}

  /**
   * Attach the resolver for the procedure.
   * The developer-defined resolver receives the already validated `input`
   * directly, **not** the wrapper object used internally by the RPC runtime.
   */
  public proceed<NewO extends ZodTypeAny>(
    fn: ({
      input,
      astroProps,
    }: {
      input: z.infer<I>;
      astroProps: APIContext;
    }) => NewO | Promise<NewO>
  ) {
    this.handler = (async (args: any) => await fn(args)) as any;

    return this.createEndpoint();
  }

  private createEndpoint() {
    const endpoint: APIRoute = async (astroProps) => {
      const input = await astroProps.request.json();

      try {
        const parsedInput = this.schemas.input.parse(input);

        const output = await this.handler({
          input: parsedInput,
          ...astroProps,
        });

        const parsedOutput = this.schemas.output.parse(output);

        return new Response(JSON.stringify(parsedOutput), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: e?.message ?? "Server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    return endpoint;
  }
}

export function createEndpoint<A extends ZodTypeAny, B extends ZodTypeAny>(
  info: EndpointInfo<A, B>
) {
  return new ARPCProcedure(info);
}
