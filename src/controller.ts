/**
 * Base class to be extended by any controller that wishes to be cached through
 * the GetRx hooks.  The class is intentionally minimal – you are free to add
 * state, observables, methods, etc.  Simply extend this class and optionally
 * override `onInit` and/or `onClose`.
 *
 * A **controller** groups together state and business logic that can be shared
 * by many unrelated components.  Instances are *automatically* memoised by the
 * {@link Get} cache and should therefore be treated as *singletons* – do not
 * assume that `new MyController()` will always run when using the React hook.
 *
 * Lifecycle hooks:
 *  • {@link onInit}  – Called *once* immediately after the instance is inserted
 *                      into the cache. Supports `async` functions.
 *  • {@link onClose} – Called *once* right before the instance is permanently
 *                      removed from the cache (when the last consumer
 *                      component unmounts).
 */
export abstract class GetRxController {
  /**
   * Optional lifecycle method called once when the controller instance is first
   * put into the cache.
   */
  public onInit?(): void | Promise<void>;

  /**
   * Optional lifecycle method called once when the controller instance is
   * removed from the cache via `useGetDelete`.
   */
  public onClose?(): void | Promise<void>;
}
