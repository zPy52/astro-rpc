import type { APIRoute } from 'astro';
import { z, type ZodTypeAny } from 'zod';

type ProcedureFunction<I, O> = ({ input }: { input: I }) => O | Promise<O>;

export class ARPCProcedure<Schema extends ZodTypeAny = ZodTypeAny, O = unknown> {
  private zodSchema!: Schema;
  public _handler!: ProcedureFunction<z.infer<Schema>, O>;

  public input<S extends ZodTypeAny>(schema: S) {
    this.zodSchema = schema as any;
    return this as unknown as ARPCProcedure<S, O>;
  }

  /**
   * Attach the resolver for the procedure.
   * The developer-defined resolver receives the already validated `input`
   * directly, **not** the wrapper object used internally by the RPC runtime.
   */
  public proceed<NewO>(fn: (input: z.infer<Schema>) => NewO | Promise<NewO>) {
    // Wrap the user resolver so the internal call signature remains
    // `{ input: I }` while the developer gets just `I`.
    this._handler = (async ({ input }: { input: z.infer<Schema> }) => await fn(input)) as any;
    return this as unknown as ARPCProcedure<Schema, Promise<NewO>>;
  }

  public get inputSchema() {
    return this.zodSchema;
  }
}

interface ARPCRoutes {
  [key: string]: ARPCProcedure<any, any> | ARPCRoutes;
}

export class ARPCServer {
  private routes: ARPCRoutes = {};

  public router<T extends ARPCRoutes>(routes: T) {
    this.routes = routes;

    // Re-expose the POST handler but keep the lexical `this` binding so it can
    // access the routes stored above even when called outside the class
    // instance (e.g. inside an Astro API route).
    const postHandler: APIRoute = this.POST;

    return Object.assign({}, routes, { POST: postHandler }) as T & {
      POST: typeof postHandler;
    };
  }

  public get procedure() {
    return new ARPCProcedure();
  }

  public POST: APIRoute = async ({ request }) => {
    const bodySchema = z.object({
      fullRoute: z.string(),
      input: z.any(),
    });

    try {
      const body = bodySchema.parse(await request.json());
      const { fullRoute, input } = body;

      const segments = fullRoute.split('.').filter(Boolean);

      let current: ARPCRoutes | ARPCProcedure = this.routes;
      for (const seg of segments) {
        if (typeof current === 'object' && seg in current) {
          current = (current as ARPCRoutes)[seg];
        } else {
          return new Response(JSON.stringify({ error: `Route not found: ${fullRoute}` }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (!(current instanceof ARPCProcedure)) {
        return new Response(JSON.stringify({ error: `Route not found: ${fullRoute}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const proc = current as ARPCProcedure<any, any>;

      const parsedInput = proc.inputSchema.parse(input);

      const handlerResult = await proc._handler({ input: parsedInput });

      return new Response(JSON.stringify({ data: handlerResult }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
        status: err.name === 'ZodError' ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

export function createARPC() {
  return new ARPCServer();
}


class ARPCSubroute<Schema extends ZodTypeAny = ZodTypeAny, O = unknown> {
  public routes<T>(args: T): T {
    return args;
  }

  public get procedure() {
    return new ARPCProcedure<Schema, O>();
  }
  
}

export function createARPCSubroute() {
  return new ARPCSubroute();
}