/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {setActiveConsumer} from '@angular/core/primitives/signals';

import {inject} from '../../di/injector_compatibility';
import {RuntimeError, RuntimeErrorCode} from '../../errors';
import {DestroyRef} from '../../linker/destroy_ref';

import {OutputRef, OutputRefSubscription} from './output_ref';

/**
 * An `OutputEmitterRef` is created by the `output()` function and can be
 * used to emit values to consumers of your directive or component.
 *
 * Consumers of your directive/component can bind to the output and
 * subscribe to changes via the bound event syntax. For example:
 *
 * ```html
 * <my-comp (valueChange)="processNewValue($event)" />
 * ```
 *
 * @developerPreview
 */
export class OutputEmitterRef<T> implements OutputRef<T> {
  private destroyed = false;
  private listeners: Array<(value: T) => void>|null = null;

  /** @internal */
  destroyRef: DestroyRef = inject(DestroyRef);

  constructor() {
    // Clean-up all listeners and mark as destroyed upon destroy.
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.listeners = null;
    });
  }

  subscribe(callback: (value: T) => void): OutputRefSubscription {
    if (this.destroyed) {
      throw new RuntimeError(
          RuntimeErrorCode.OUTPUT_REF_DESTROYED,
          ngDevMode &&
              'Unexpected subscription to destroyed `OutputRef`. ' +
                  'The owning directive/component is destroyed.');
    }

    (this.listeners ??= []).push(callback);

    return {
      unsubscribe: () => {
        const idx = this.listeners?.indexOf(callback);
        if (idx !== undefined && idx !== -1) {
          this.listeners?.splice(idx, 1);
        }
      }
    };
  }

  /** Emits a new value to the output. */
  emit(value: T): void {
    if (this.destroyed) {
      throw new RuntimeError(
          RuntimeErrorCode.OUTPUT_REF_DESTROYED,
          ngDevMode &&
              'Unexpected emit for destroyed `OutputRef`. ' +
                  'The owning directive/component is destroyed.');
    }

    const previousConsumer = setActiveConsumer(null);
    try {
      // TODO: Run every listener using `try/catch`.
      this.listeners?.forEach(fn => fn(value));
    } finally {
      setActiveConsumer(previousConsumer);
    }
  }
}

/** Gets the owning `DestroyRef` for the given output. */
export function getOutputDestroyRef(ref: OutputRef<unknown>): DestroyRef|undefined {
  return ref.destroyRef;
}
