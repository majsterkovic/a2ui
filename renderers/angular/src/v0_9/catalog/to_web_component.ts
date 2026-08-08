/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Type,
  Injector,
  EnvironmentInjector,
  ApplicationRef,
  createComponent,
  ComponentRef,
  NgZone,
} from '@angular/core';
import type {ZodTypeAny} from 'zod';
import {ComponentContext, WebComponentImplementation, Catalog} from '@a2ui/web_core/v0_9';
import {basicCatalog as webCoreBasicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';
import type {AngularComponentImplementation} from './types';

import {ComponentBinder} from '../core/component-binder.service';

const angularWcCache = new WeakMap<Type<object>, WebComponentImplementation>();
const angularInjectorMap = new WeakMap<Type<object>, Injector>();
const preparedUniversalCatalogs = new WeakSet<Catalog<any>>();

export interface ToWebComponentOptions {
  /** Explicit custom element tag name to register. */
  tagName?: string;
}

/**
 * Idempotently converts an Angular `@Component` class declaration (`AngularComponentImplementation`)
 * into a W3C Custom Element (`WebComponentImplementation`).
 *
 * This allows custom Angular components to be registered inside the unified `Catalog<WebComponentImplementation>`
 * and rendered seamlessly within any A2UI surface.
 *
 * @param componentImpl The AngularComponentImplementation combining the ComponentApi schema and component class.
 * @param injectorOrOptions Optional Angular Injector or configuration options.
 * @param optionsParam Optional configuration options when injector is passed as second argument.
 * @returns The WebComponentImplementation representation.
 */
export function toWebComponent<Schema extends ZodTypeAny = ZodTypeAny>(
  componentImpl: AngularComponentImplementation<Schema>,
  injectorOrOptions?: Injector | ToWebComponentOptions,
  optionsParam?: ToWebComponentOptions,
): WebComponentImplementation<Schema> {
  const componentClass = componentImpl.component;
  const injector =
    injectorOrOptions && 'get' in injectorOrOptions ? (injectorOrOptions as Injector) : undefined;
  const options =
    optionsParam ??
    (injectorOrOptions && !('get' in injectorOrOptions)
      ? (injectorOrOptions as ToWebComponentOptions)
      : undefined);

  let resolvedInjector = injector;
  if (!resolvedInjector) {
    try {
      resolvedInjector = (globalThis as any).ng?.getInjector?.() ?? undefined;
    } catch {
      resolvedInjector = undefined;
    }
  }
  if (resolvedInjector) {
    angularInjectorMap.set(componentClass, resolvedInjector);
  }

  if (angularWcCache.has(componentClass)) {
    return angularWcCache.get(componentClass)! as WebComponentImplementation<Schema>;
  }

  let tagName =
    options?.tagName ||
    (componentImpl as {tagName?: string}).tagName ||
    `a2ui-ng-${componentImpl.name.toLowerCase()}`;

  if (typeof customElements !== 'undefined') {
    let suffix = 1;
    const baseTagName = tagName;
    while (customElements.get(tagName)) {
      tagName = `${baseTagName}-${suffix++}`;
    }

    if (!customElements.get(tagName)) {
      class AngularWcHost extends HTMLElement {
        private componentRef?: ComponentRef<object>;
        private appRef?: ApplicationRef;
        private _context?: ComponentContext;
        private updateSub?: {unsubscribe: () => void};
        private _injector?: Injector;

        set injector(inj: Injector) {
          this._injector = inj;
        }

        get injector(): Injector | undefined {
          return this._injector;
        }

        connectedCallback() {
          this.style.display = 'contents';

          if (!this.componentRef) {
            const currentInjector =
              this._injector ?? angularInjectorMap.get(componentClass) ?? resolvedInjector;
            if (!currentInjector) {
              throw new Error(
                `Cannot instantiate Web Component for '${componentImpl.name}': No Angular Injector available.`,
              );
            }
            this.appRef = currentInjector.get(ApplicationRef);
            this.componentRef = createComponent(componentClass, {
              environmentInjector: currentInjector.get(EnvironmentInjector),
              elementInjector: currentInjector,
              hostElement: this,
            });
            this.appRef.attachView(this.componentRef.hostView);
          }

          if (this._context && !this.updateSub) {
            this.subscribeToContext(this._context);
          }

          this.updateContext();
        }

        private subscribeToContext(ctx: ComponentContext) {
          this.updateSub?.unsubscribe();
          const currentInjector =
            this._injector ?? angularInjectorMap.get(componentClass) ?? resolvedInjector;
          const ngZone = currentInjector?.get(NgZone, null);
          this.updateSub = ctx.componentModel.onUpdated.subscribe(() => {
            if (ngZone) {
              ngZone.run(() => {
                this.updateContext();
              });
            } else {
              this.updateContext();
            }
          });
        }

        set context(ctx: ComponentContext) {
          this._context = ctx;
          this.subscribeToContext(ctx);
          this.updateContext();
        }

        get context() {
          return this._context!;
        }

        private updateContext() {
          if (!this.componentRef || !this._context) return;
          const currentInjector =
            this._injector ?? angularInjectorMap.get(componentClass) ?? resolvedInjector;
          if (!currentInjector) return;
          const binder = currentInjector.get(ComponentBinder);
          const boundProps = binder.bind(this._context);
          try {
            this.componentRef.setInput('props', boundProps);
          } catch {
            // Component may not accept props input
          }
          try {
            this.componentRef.setInput('surfaceId', this._context.dataContext.surface.id);
          } catch {
            // Optional input not defined on component
          }
          try {
            this.componentRef.setInput('componentId', this._context.componentModel.id);
          } catch {
            // Optional input not defined on component
          }
          try {
            this.componentRef.setInput('dataContextPath', this._context.dataContext.path);
          } catch {
            // Optional input not defined on component
          }
          this.componentRef.changeDetectorRef.detectChanges();
        }

        disconnectedCallback() {
          if (this.updateSub) {
            this.updateSub.unsubscribe();
            this.updateSub = undefined;
          }
          if (this.componentRef) {
            this.appRef?.detachView(this.componentRef.hostView);
            this.componentRef.destroy();
            this.componentRef = undefined;
            this.appRef = undefined;
          }
        }
      }

      customElements.define(tagName, AngularWcHost);
    }
  }

  const implementation: WebComponentImplementation<Schema> & {component?: Type<object>} = {
    name: componentImpl.name,
    schema: componentImpl.schema,
    tagName,
    component: componentClass,
  };

  angularWcCache.set(componentClass, implementation);
  return implementation;
}

/**
 * Prepares an Angular catalog for universal Web Component rendering by ensuring
 * all registered components have their `tagName` populated.
 *
 * For standard basic components, tag names are assigned from `webCoreBasicCatalog`.
 * For custom Angular component declarations (`.component`), they are bridged into
 * W3C Custom Elements using the provided Angular `Injector`.
 *
 * This operation is cached via a `WeakSet` and is idempotent.
 *
 * @param catalog The catalog to prepare.
 * @param injector The Angular Injector or EnvironmentInjector.
 */
export function prepareUniversalCatalog(catalog: Catalog<any>, injector: Injector): void {
  if (!catalog) {
    return;
  }

  if (injector) {
    for (const api of catalog.components.values()) {
      if ('component' in api && api.component) {
        angularInjectorMap.set(api.component, injector);
      }
    }
  }

  if (preparedUniversalCatalogs.has(catalog)) {
    return;
  }

  const compMap = catalog.components as Map<string, any>;
  for (const [key, api] of catalog.components.entries()) {
    if (!api.tagName) {
      const universal = webCoreBasicCatalog.components.get(api.name || key);
      if (universal?.tagName) {
        compMap.set(key, {
          ...api,
          tagName: universal.tagName,
        });
      } else if ('component' in api && api.component) {
        const wcImpl = toWebComponent(api as AngularComponentImplementation, injector);
        compMap.set(key, {
          ...api,
          tagName: wcImpl.tagName,
        });
      }
    }
  }

  preparedUniversalCatalogs.add(catalog);
}
