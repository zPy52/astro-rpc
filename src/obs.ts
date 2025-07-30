import { useOnObsChange } from "./hooks";
import type { ObsEmitter, ObsListener } from "./types";

/**
 * A very small reactive value holder.
 *
 * `Obs<T>` stores a single **current** value of type `T` and notifies every
 * registered listener immediately after the value changes.  Think of it as a
 * super-lightweight alternative to an RxJS `BehaviorSubject` that is purpose-built
 * for React:
 *
 * 1. `value` / `get()` – read the latest value.
 * 2. `set()` / `value = x` – update the value **synchronously** and broadcast it.
 * 3. `on()` / `off()` – imperatively subscribe / unsubscribe to changes.
 * 4. `use()` – idiomatic React hook that re-renders a component whenever the
 *              observable emits a new value.
 *
 * No fancy operators, no buffering, no scheduling – just the essentials for
 * modelling component-level state without pulling additional dependencies.
 */
export class Obs<T> implements ObsEmitter<T> {
  private eventHandlers: ObsListener<T>[] = [];
  private currentValue: T | undefined;

  constructor(initialValue?: T | undefined) {
    this.currentValue = initialValue;
  }

  /**
   * Syntactic sugar to read the current value through property access
   * (`myObs.value`). Internally delegates to {@link get}.
   */
  public get value(): T | undefined {
    return this.get();
  }

  /**
   * Returns the latest value stored in the observable **without** subscribing
   * the caller to future updates.
   */
  public get(): T | undefined {
    return this.currentValue;
  }

  /**
   * Property setter counterpart to {@link value}. Updates the current value and
   * notifies every registered listener.
   */
  public set value(value: T) {
    this.set(value);
  }

  /**
   * Replaces the current value and synchronously notifies subscribers.
   *
   * @param value – The new value to broadcast.
   */
  public set(value: T) {
    this.currentValue = value;
    this.eventHandlers.forEach(listener => listener(value));  
  }

  /**
   * Subscribes a listener that will be called **immediately** with the current
   * value (if one exists) and **every time** the value changes afterwards.
   *
   * @param listener – Callback invoked with the latest value.
   */
  public on(listener: ObsListener<T>) {
    this.eventHandlers.push(listener);
    if (this.currentValue !== undefined) {
      listener(this.currentValue);
    }
  }

  /**
   * Removes a previously registered listener so it will no longer be notified
   * of value changes.
   */
  public off(listener: ObsListener<T>) {
    this.eventHandlers = this.eventHandlers.filter(l => l !== listener);
  }

  /**
   * React hook that returns the current value and schedules a re-render of the
   * calling component whenever the value changes. The semantics are identical
   * to `useState` – the component will re-render with the **latest** value on
   * every update.
   */
  public use(): T | undefined {
    return useOnObsChange(this);
  }
}