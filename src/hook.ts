import type { z, ZodTypeAny } from "zod";
import type { EndpointInfo } from "@/info";
import { useCallback, useMemo, useState } from "react";

type EndpointFn<I extends ZodTypeAny, O extends ZodTypeAny> = {
  (input: z.infer<I>): void;
  isLoading: boolean;
  data?: z.infer<O>;
  error?: string;
  promise: Promise<void>;
};

export function useEndpoint<
  I extends ZodTypeAny = ZodTypeAny,
  O extends ZodTypeAny = ZodTypeAny
>(info: EndpointInfo<I, O>) {
  const [error, setError] = useState<string | undefined>(undefined);

  const [promise, setPromise] = useState<Promise<void>>(Promise.resolve());
  const [data, setData] = useState<z.infer<O> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const pullData = useCallback(
    (input: z.infer<I>) => {
      setIsLoading(true);

      const func = async () => {
        try {
          const response = await fetch(info.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          });

          if (response.status === 500) {
            throw new Error((await response.json())?.error ?? "Server error");
          }

          const parsedOutput = info.output.parse(await response.json());
          setData(parsedOutput);
          setError(undefined);
        } catch (e: any) {
          setError(`${e}`);
          setData(undefined);
        }

        setIsLoading(false);
      };

      setPromise(func());
    },
    [info.endpoint, info.input, info.output]
  );

  return useMemo(() => {
    const fn = ((input: z.infer<I>) => pullData(input)) as EndpointFn<I, O>;

    Object.defineProperties(fn, {
      isLoading: {
        get: () => isLoading,
        enumerable: true,
      },
      data: {
        get: () => data,
        enumerable: true,
      },
      error: {
        get: () => error,
        enumerable: true,
      },
      promise: {
        get: () => promise,
        enumerable: true,
      },
    });

    return fn;
  }, [pullData, isLoading, data, error, promise]);
}
