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

import * as assert from 'node:assert';
import {describe, it, before, after, beforeEach, afterEach} from 'node:test';
import {setupTestDom, teardownTestDom} from '../../test/dom-setup.js';
import type {MarkdownRenderer} from '../context/markdown.js';

describe('MarkdownDirective', () => {
  let html: typeof import('lit').html;
  let render: typeof import('lit').render;
  let markdown: typeof import('./markdown.js').markdown;

  before(async () => {
    setupTestDom();
    const lit = await import('lit');
    html = lit.html;
    render = lit.render;
    markdown = (await import('./markdown.js')).markdown;
  });

  after(teardownTestDom);

  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders synchronous fallback span initially and updates asynchronously', async () => {
    const customRenderer: MarkdownRenderer = async (text: string) => {
      return `<strong>${text}</strong>`;
    };

    render(html`<div>${markdown('Hello World', customRenderer)}</div>`, container);

    // Initial render before promise resolution
    const initialSpan = container.querySelector('span.no-markdown-renderer');
    assert.notStrictEqual(initialSpan, null);
    assert.strictEqual(initialSpan?.textContent, 'Hello World');

    // Wait for microtask/async resolution
    await new Promise(r => setTimeout(r, 20));

    const strong = container.querySelector('strong');
    assert.notStrictEqual(strong, null);
    assert.strictEqual(strong?.textContent, 'Hello World');
  });

  it('supports renderer objects with render method', async () => {
    const customRendererObj = {
      render: async (text: string) => `<em>${text}</em>`,
    };

    render(html`<div>${markdown('Obj Test', customRendererObj as any)}</div>`, container);

    await new Promise(r => setTimeout(r, 20));

    const em = container.querySelector('em');
    assert.notStrictEqual(em, null);
    assert.strictEqual(em?.textContent, 'Obj Test');
  });

  it('prevents race conditions when value updates rapidly', async () => {
    let resolveFirst: ((val: string) => void) | null = null;
    let resolveSecond: ((val: string) => void) | null = null;

    const customRenderer: MarkdownRenderer = (text: string) => {
      if (text === 'first') {
        return new Promise<string>(resolve => {
          resolveFirst = resolve;
        });
      }
      if (text === 'second') {
        return new Promise<string>(resolve => {
          resolveSecond = resolve;
        });
      }
      return Promise.resolve(text);
    };

    // First render with 'first'
    render(html`<div>${markdown('first', customRenderer)}</div>`, container);

    // Rapid second render with 'second' before first resolves
    render(html`<div>${markdown('second', customRenderer)}</div>`, container);

    // Now resolve 'first' later
    resolveFirst!('<h1>First Rendered</h1>');
    await new Promise(r => setTimeout(r, 20));

    // The DOM should not have 'First Rendered' because 'first' is outdated
    assert.strictEqual(container.querySelector('h1'), null);

    // Now resolve 'second'
    resolveSecond!('<h2>Second Rendered</h2>');
    await new Promise(r => setTimeout(r, 20));

    const h2 = container.querySelector('h2');
    assert.notStrictEqual(h2, null);
    assert.strictEqual(h2?.textContent, 'Second Rendered');
  });

  it('prevents race conditions when same value is rendered with different renderers', async () => {
    let resolveFirst: ((val: string) => void) | null = null;
    let resolveSecond: ((val: string) => void) | null = null;

    const renderer1: MarkdownRenderer = () =>
      new Promise<string>(resolve => {
        resolveFirst = resolve;
      });

    const renderer2: MarkdownRenderer = () =>
      new Promise<string>(resolve => {
        resolveSecond = resolve;
      });

    // First render with renderer1
    render(html`<div>${markdown('same-value', renderer1)}</div>`, container);

    // Second render with renderer2
    render(html`<div>${markdown('same-value', renderer2)}</div>`, container);

    // Resolve renderer1 later
    resolveFirst!('<span>Old Version</span>');
    await new Promise(r => setTimeout(r, 20));

    // Stale render from renderer1 should be ignored
    assert.strictEqual(
      container.querySelector('span.no-markdown-renderer')?.textContent,
      'same-value',
    );

    // Resolve renderer2
    resolveSecond!('<p>New Version</p>');
    await new Promise(r => setTimeout(r, 20));

    const p = container.querySelector('p');
    assert.notStrictEqual(p, null);
    assert.strictEqual(p?.textContent, 'New Version');
  });

  it('uses global default markdown renderer when no explicit renderer is provided', async () => {
    const {setDefaultMarkdownRenderer, getDefaultMarkdownRenderer} = await import('./markdown.js');

    const defaultRenderer: MarkdownRenderer = async text => `<h3>${text} (Default)</h3>`;
    setDefaultMarkdownRenderer(defaultRenderer);
    assert.strictEqual(getDefaultMarkdownRenderer(), defaultRenderer);

    render(html`<div>${markdown('Default Text')}</div>`, container);

    await new Promise(r => setTimeout(r, 20));

    const h3 = container.querySelector('h3');
    assert.notStrictEqual(h3, null);
    assert.strictEqual(h3?.textContent, 'Default Text (Default)');

    // Reset default renderer
    setDefaultMarkdownRenderer(undefined);
    assert.strictEqual(getDefaultMarkdownRenderer(), undefined);
  });
});
