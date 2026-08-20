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
import {setupTestDom, teardownTestDom, asyncUpdate} from '../../test/dom-setup.js';
import {
  ComponentContext,
  MessageProcessor,
  Catalog,
  ComponentApi,
  SurfaceModel,
  Subscription,
} from '../../index.js';

describe('DateTimeInput Component', () => {
  let basicCatalog: Catalog<ComponentApi>;

  before(async () => {
    setupTestDom();
    basicCatalog = (await import('../index.js')).basicCatalog;
    await import('./DateTimeInput.js');
  });

  after(teardownTestDom);

  let processor: MessageProcessor<ComponentApi>;
  let surface: SurfaceModel;
  let element: any = null;
  let subscription: Subscription | null = null;

  beforeEach(() => {
    processor = new MessageProcessor([basicCatalog]);
    processor.processMessages([
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'test-surface',
          catalogId: basicCatalog.id,
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'test-surface',
          components: [
            {
              id: 'comp1',
              component: 'DateTimeInput',
              label: 'Birthday',
              value: '2023-01-01',
              enableDate: true,
              enableTime: false,
            },
          ],
        },
      },
    ]);
    surface = processor.model.getSurface('test-surface')!;
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = null;
    if (element) {
      element.remove();
      element = null;
    }
  });

  it('should render date and label value', async () => {
    const el = document.createElement('a2ui-datetimeinput');
    element = el;
    document.body.appendChild(el);

    const context = new ComponentContext(surface, 'comp1');
    await asyncUpdate(el, (e: any) => {
      e.context = context;
    });

    assert.notStrictEqual(el, null);
    const label = el.querySelector('.a2ui-date-time-label');
    assert.notStrictEqual(label, null);
    assert.strictEqual(label?.textContent?.trim(), 'Birthday');

    const input = el.querySelector('input[type="date"]') as HTMLInputElement;
    assert.notStrictEqual(input, null);
    assert.strictEqual(input?.value, '2023-01-01');
  });

  it('should update bound data model when date is selected', async () => {
    processor.processMessages([
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'test-surface',
          path: '/selectedDate',
          value: '2023-01-01',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'test-surface',
          components: [
            {
              id: 'dt_bound',
              component: 'DateTimeInput',
              label: 'Event Date',
              value: {path: '/selectedDate'},
              enableDate: true,
              enableTime: false,
            },
          ],
        },
      },
    ]);

    const el = document.createElement('a2ui-datetimeinput');
    element = el;
    document.body.appendChild(el);

    const context = new ComponentContext(surface, 'dt_bound');
    await asyncUpdate(el, (e: any) => {
      e.context = context;
    });

    const input = el.querySelector('input[type="date"]') as HTMLInputElement;
    assert.notStrictEqual(input, null);
    assert.strictEqual(input?.value, '2023-01-01');

    input.value = '2024-05-20';
    input.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.strictEqual(surface.dataModel.get('/selectedDate'), '2024-05-20');
  });
});
