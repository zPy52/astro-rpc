import { z } from 'zod';
import type { ARPCProcedure } from './server';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A callable object that also exposes loading state, last result, last error
 * and is await-able (Promise-like).
 */
export interface RemoteProcedure<I = unknown, O = unknown> {
  /** Invoke the remote procedure. The returned promise resolves with `O`. */
  (input: I): Promise<O>;
  /** Indicates if a request is currently in flight. */
  isLoading: boolean;
  /** Holds the data returned by the last successful call. */
  data: O | undefined;
  /** Holds the error from the last failed call, if any. */
  error: unknown;
  /** Promise of the last call, if any. */
  promise: Promise<O> | undefined;
  /** Makes the object await-able (thenable) so `await proc` works. */
  then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2>;
}

// ---------------------------------------------------------------------------
// Type helpers – convert the server router shape into the client counterpart
// ---------------------------------------------------------------------------
type InferInput<P> = P extends ARPCProcedure<infer S, any> ? z.infer<S> : never;
type InferOutput<P> = P extends ARPCProcedure<any, infer O> ? Awaited<O> : never;

export type Clientify<T> = T extends ARPCProcedure<any, any>
  ? {
      use: () => RemoteProcedure<InferInput<T>, InferOutput<T>>;
    }
  : {
      [K in keyof T as K extends 'POST' ? never : K]: Clientify<T[K]>;
    };

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------
interface CreateArpcClientOptions {
  endpoint?: string;
}

export function createARPCClient<TRouter>(opts?: CreateArpcClientOptions) {
  const endpoint = opts?.endpoint ?? '/api/arpc';

  class RPCClient {
    public constructor(private readonly endpoint: string) {}

    /**
     * React hook that returns a stable, callable object representing a remote
     * procedure. The object updates its own state and re-renders subscribers when
     * that state changes thanks to React state hooks.
     */
    useRemoteProcedure<I, O>(path: string[]): RemoteProcedure<I, O> {
      // Local reactive state so React can re-render consumers on changes.
      const [isLoading, setIsLoading] = useState(false);
      const [data, setData] = useState<O>();
      const [error, setError] = useState<any>();

      // Refs that always hold the latest value – used by the stable procedure object.
      const promiseRef = useRef<Promise<O> | undefined>(undefined);
      const isLoadingRef = useRef(isLoading);
      const dataRef = useRef<O | undefined>(data);
      const errorRef = useRef<any>(error);

      // Keep the refs up-to-date whenever React state changes.
      useEffect(() => {
        isLoadingRef.current = isLoading;
      }, [isLoading]);
      useEffect(() => {
        dataRef.current = data;
      }, [data]);
      useEffect(() => {
        errorRef.current = error;
      }, [error]);

      const call = useCallback(
        async (input: I): Promise<O> => {
          setIsLoading(true);
          isLoadingRef.current = true;
          errorRef.current = undefined;
          setError(undefined);
          try {
            const fullRoute = path.join('.');
            const res = await fetch(this.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fullRoute, input }),
            });
            const json = await res.json();
            if (json.error) {
              setError(json.error);
              errorRef.current = json.error;
              throw json.error;
            }
            const out: O = json.data;
            setData(out);
            dataRef.current = out;
            return out;
          } catch (err) {
            setError(err);
            errorRef.current = err;
            throw err;
          } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        },
        [JSON.stringify(path)],
      );

      // Stable procedure object – created only once per hook call.
      const procedureRef = useRef<RemoteProcedure<I, O> | null>(null);
      if (!procedureRef.current) {
        const fn = ((input: I) => {
          const promise = call(input);
          promiseRef.current = promise;
          return promise;
        }) as RemoteProcedure<I, O>;

        Object.defineProperties(fn, {
          isLoading: { get: () => isLoadingRef.current, enumerable: true },
          data: { get: () => dataRef.current, enumerable: true },
          error: { get: () => errorRef.current, enumerable: true },
          promise: { get: () => promiseRef.current, enumerable: true },
        });

        // Make it thenable so `await proc` works.
        fn.then = (onfulfilled, onrejected) => {
          const p = promiseRef.current ?? Promise.resolve(undefined as unknown as O);
          return p.then(onfulfilled, onrejected);
        };

        procedureRef.current = fn;
      }

      return procedureRef.current!;
    }

    makeProxy(path: string[] = []): any {
      return new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === 'use') {
              return (() => this.useRemoteProcedure<any, any>(path)) as any;
            }
            if (typeof prop === 'symbol') return undefined;
            return this.makeProxy([...path, prop.toString()]);
          },
        },
      );
    }
  }

  const client = new RPCClient(endpoint);
  return client.makeProxy() as Clientify<TRouter>;
}
