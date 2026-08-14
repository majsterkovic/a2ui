/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {html, noChange} from 'lit';
import {directive, DirectiveParameters, Part} from 'lit/directive.js';
import {AsyncDirective} from 'lit/async-directive.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import type {MarkdownRenderer, MarkdownRendererOptions} from '../context/markdown.js';

let globalDefaultMarkdownRenderer: MarkdownRenderer | undefined;

/**
 * Sets the global default markdown renderer for basic catalog text components.
 * Host applications or renderer packages can register a renderer (e.g. from `@a2ui/markdown-it`)
 * to automatically render markdown without explicit per-component context configuration.
 */
export function setDefaultMarkdownRenderer(renderer?: MarkdownRenderer): void {
  globalDefaultMarkdownRenderer = renderer;
}

/**
 * Gets the currently registered global default markdown renderer, if any.
 */
export function getDefaultMarkdownRenderer(): MarkdownRenderer | undefined {
  return globalDefaultMarkdownRenderer;
}

class MarkdownDirective extends AsyncDirective {
  private lastValue: string | null = null;
  private lastRenderer: MarkdownRenderer | undefined = undefined;
  private lastTagClassMap: string | null = null;

  override update(
    _part: Part,
    [value, markdownRenderer, markdownOptions]: DirectiveParameters<this>,
  ) {
    const effectiveRenderer = markdownRenderer ?? globalDefaultMarkdownRenderer;
    const jsonTagClassMap = JSON.stringify(markdownOptions?.tagClassMap);
    if (
      this.lastValue === value &&
      this.lastRenderer === effectiveRenderer &&
      jsonTagClassMap === this.lastTagClassMap
    ) {
      return noChange;
    }

    this.lastValue = value;
    this.lastRenderer = effectiveRenderer;
    this.lastTagClassMap = jsonTagClassMap;
    return this.render(value, effectiveRenderer, markdownOptions);
  }

  render(
    value: string,
    markdownRenderer?: MarkdownRenderer,
    markdownOptions?: MarkdownRendererOptions,
  ) {
    const effectiveRenderer = markdownRenderer ?? globalDefaultMarkdownRenderer;
    const renderFn =
      typeof effectiveRenderer === 'function'
        ? effectiveRenderer
        : (effectiveRenderer as any)?.['render']?.bind(effectiveRenderer);

    if (renderFn) {
      Promise.resolve(renderFn(value, markdownOptions)).then((renderedStr: string) => {
        if (value !== this.lastValue) return;
        if (this.isConnected) {
          this.setValue(unsafeHTML(renderedStr));
        }
      });
      return html`<span class="no-markdown-renderer">${value}</span>`;
    }

    return html`<span class="no-markdown-renderer">${value}</span>`;
  }
}

export const markdown = directive(MarkdownDirective);
