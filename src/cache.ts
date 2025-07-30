import type { GetRxController } from "./controller";

/**
 * Simple **process-wide** registry that stores controller singletons.
 *
 * The cache is *not* exported outside of the `getrx` package – public consumers
 * interact with it exclusively through the React hooks (`useGet`) or via the
 * facade methods exposed on the default export (`Get`).  Hiding the
 * implementation detail prevents accidental misuse (e.g. leaking controllers
 * or bypassing lifecycle hooks).
 *
 * A controller instance is uniquely identified by **its class name** plus an
 * optional *tag* suffix – this allows multiple isolated instances of the same
 * class to coexist when needed (`TodoController-listA`,
 * `TodoController-listB`, …).
 */
export class Get {
  /** The backing map for the cache */
  private static readonly registry = new Map<string, unknown>();

  /**
   * Prevent instantiation – this class is intended to be used statically.
   */
  private constructor() {}

  /* ----------------------------------------------------------------------- */
  /* Internal helpers                                                       */
  /* ----------------------------------------------------------------------- */
  /**
   * Ensures that the generated cache key is a non-empty string.
   *
   * While the method is trivial, centralising the check avoids repeated
   * defensive code across the public API.
   */
  private static makeKey(tag: string): string {
    if (!tag || typeof tag !== "string") {
      throw new Error("A non-empty string tag is required for GetRxCache.");
    }
    return tag;
  }

  /**
   * Utility to call a (possibly async) lifecycle method **without** propagating
   * any thrown errors – they are caught and printed to the console instead so
   * that a faulty controller cannot break unrelated parts of the app.
   */
  private static async callMaybeAsync(fn?: () => void | Promise<void>) {
    if (typeof fn === "function") {
      // Call the function; if it returns a promise, await and catch errors.
      const result = fn();
      if (result instanceof Promise) {
        await result.catch(console.error);
      }
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Helpers used by the public hooks API                                 */
  /* --------------------------------------------------------------------- */

  /**
   * Generates the canonical cache key for the given controller class and tag.
   *
   * Examples:
   *  • `UserController`          → `UserController`
   *  • `UserController`, "admin" → `UserController-admin`
   */
  private static buildTag(
    ControllerClass: new (...args: any[]) => GetRxController,
    suffix?: string
  ): string {
    const base = ControllerClass.name || "AnonymousController";
    return suffix ? `${base}-${suffix}` : base;
  }

  /**
   * Pure lookup that **never** creates new instances.
   *
   * @returns `undefined` when the controller is not found.
   */
  public static find<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): T | undefined {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    return this.registry.get(key) as T | undefined;
  }

  /**
   * Returns an existing cached controller **or** constructs a new one using
   * `new ControllerClass(...args)` and stores it.
   *
   * @param ControllerClass – Concrete class extending {@link GetRxController}.
   * @param options.tag      – Optional string to differentiate multiple
   *                           instances of the same class.
   * @param options.args     – Arguments to forward to the constructor.
   */
  public static put<T extends GetRxController, Args extends any[] = any[]>(
    ControllerClass: new (...args: Args) => T,
    options: { tag?: string; args?: Args } = {}
  ): T {
    const { tag, args = [] as unknown as Args } = options;
    const key = this.makeKey(this.buildTag(ControllerClass, tag));

    const existing = this.registry.get(key) as T | undefined;
    if (existing) {
      return existing;
    }

    const instance = new ControllerClass(...(args as unknown as Args));
    this.registry.set(key, instance);
    this.callMaybeAsync(instance.onInit);
    return instance;
  }

  /**
   * Evicts the given controller from the cache. If the instance implements
   * `onClose`, it will be awaited (if async) before removal.
   */
  public static delete<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): void {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    const cached = this.registry.get(key) as T | undefined;
    if (cached) {
      this.callMaybeAsync(cached.onClose);
      this.registry.delete(key);
    }
  }

  /**
   * Convenience helper that only tells whether an entry exists regardless of
   * its actual value.
   */
  public static exists<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): boolean {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    return this.registry.has(key);
  }
}
