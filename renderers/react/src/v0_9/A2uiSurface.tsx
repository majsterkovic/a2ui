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

/**
 * Surface renderer driven by the node layer.
 *
 * `A2uiSurface` constructs one `NodeResolver` and renders the resolved
 * `ComponentNode` tree it maintains. Each implementation carries a generated
 * `view` (see `adapter.tsx`) that subscribes to its own node's props and
 * converts them back to the shapes existing views expect, so a data change
 * re-renders exactly the affected component. The surface only dispatches: it
 * hands each `view` its node and a `buildChild` that renders resolved child
 * nodes.
 */

import React, {memo, useCallback, useMemo, useSyncExternalStore, useRef, useEffect} from 'react';
import {
  type ComponentNode,
  isComponentNode,
  NodeResolver,
  effect,
  getValue,
  peekValue,
  type SurfaceModel,
  type ComponentContext,
} from '@a2ui/web_core/v0_9';
import {basicCatalog as webCoreBasicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';
import type {ReactComponentImplementation, ReactCatalogComponent} from './adapter';
import {useA2UI} from './core/A2UIProvider';
import {
  LoadingPlaceholder,
  NodeSurfaceContext,
  UnresolvedChildReference,
  useNodeView,
  type NodeBuildChild,
} from './node-view';

const WebComponentNode = memo(
  ({tagName, context}: {tagName: string; context: ComponentContext}) => {
    const elRef = useRef<HTMLElement | null>(null);
    const contextRef = useRef(context);
    contextRef.current = context;

    const setRef = useCallback((node: HTMLElement | null) => {
      elRef.current = node;
      if (node) {
        (node as unknown as {context?: ComponentContext}).context = contextRef.current;
      }
    }, []);

    useEffect(() => {
      if (elRef.current) {
        (elRef.current as unknown as {context?: ComponentContext}).context = context;
      }
    }, [context]);

    return React.createElement(tagName, {ref: setRef});
  },
);
WebComponentNode.displayName = 'WebComponentNode';

const WebComponentFallback: React.FC<{
  tagName: string;
  node: ComponentNode<ReactCatalogComponent>;
  buildChild: NodeBuildChild;
}> = ({tagName, node, buildChild}) => {
  const {context} = useNodeView(node as any, buildChild);
  if (!context) {
    return <LoadingPlaceholder componentId={node.componentId} />;
  }
  return <WebComponentNode tagName={tagName} context={context} />;
};

/** Renders an implementation that has no `view`: its wrapper binds itself. */
const RenderFallback: React.FC<{
  node: ComponentNode<ReactComponentImplementation>;
  impl: ReactComponentImplementation;
  buildChild: NodeBuildChild;
}> = ({node, impl, buildChild}) => {
  // `render` reads raw component ids from the model, not the tokens the
  // conversion puts in view props, so it resolves through the raw-id map.
  const {context, rawBuildChild} = useNodeView(node, buildChild);
  const Render = impl.render;
  if (!context) {
    return <LoadingPlaceholder componentId={node.componentId} />;
  }
  return <Render context={context} buildChild={rawBuildChild} />;
};

const NodeView = memo(
  ({
    surface,
    node,
  }: {
    surface: SurfaceModel<ReactCatalogComponent>;
    node: ComponentNode<ReactCatalogComponent>;
  }) => {
    const {useUniversalComponents} = useA2UI();
    const buildChild = useCallback<NodeBuildChild>(
      (child, basePath) => {
        if (isComponentNode(child)) {
          return <NodeView key={child.instanceId} surface={surface} node={child} />;
        }
        // The resolver turns every child reference it can identify into a
        // node, so a leftover id was never classified. Distinguish the two
        // causes a catalog author can actually have.
        const requested = basePath ?? node.dataPath;
        const detail = surface.componentsModel.get(child)
          ? 'the component exists, but the catalog schema does not mark the referencing ' +
            'property as a component id. Use componentId() or childList() from ' +
            '@a2ui/web_core.'
          : 'no component with this id exists on the surface.';
        return (
          <UnresolvedChildReference
            key={JSON.stringify([child, requested])}
            surface={surface as any}
            id={child}
            requestedPath={requested}
            detail={detail}
          />
        );
      },
      [surface, node],
    );

    if (node.state === 'unknown-type') {
      return <div style={{color: 'red'}}>Unknown component type: {node.type}</div>;
    }
    if (node.isPlaceholder) {
      return <LoadingPlaceholder componentId={node.componentId} />;
    }
    const impl = node.impl;
    if (!impl) {
      // Type narrowing; unreachable for a resolved node.
      return null;
    }

    const hasViewOrRender = Boolean(
      ('view' in impl && (impl as ReactComponentImplementation).view) ||
      ('render' in impl && (impl as ReactComponentImplementation).render),
    );
    const preferUniversal =
      useUniversalComponents || (!hasViewOrRender && 'tagName' in impl && !!impl.tagName);

    if (preferUniversal) {
      const universalComp =
        'tagName' in impl && impl.tagName ? impl : webCoreBasicCatalog.components.get(node.type);
      if (universalComp && 'tagName' in universalComp && universalComp.tagName) {
        return (
          <WebComponentFallback
            tagName={universalComp.tagName}
            node={node}
            buildChild={buildChild}
          />
        );
      }
    }

    const View = (impl as ReactComponentImplementation).view;
    if (!View) {
      return (
        <RenderFallback
          node={node as any}
          impl={impl as ReactComponentImplementation}
          buildChild={buildChild}
        />
      );
    }
    return <View node={node as any} buildChild={buildChild} />;
  },
);
NodeView.displayName = 'NodeView';

export const A2uiSurface: React.FC<{
  surface: SurfaceModel<ReactCatalogComponent>;
}> = ({surface}) => {
  // The resolver is created inside subscribe, which React calls only for
  // committed renders: a render that is discarded (concurrent mode,
  // Suspense) never constructs one, and every constructed resolver is
  // disposed by its own unsubscribe. StrictMode's double mount creates and
  // disposes two in turn.
  // The factory reads nothing; the dependency exists to reset the box when
  // the surface is swapped.
  const box = useMemo(
    () => ({resolver: undefined as NodeResolver<ReactCatalogComponent> | undefined}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface],
  );
  const subscribe = useCallback(
    (onChange: () => void) => {
      const resolver = new NodeResolver(surface, surface.catalog as any);
      box.resolver = resolver;
      const stopEffect = effect(() => {
        getValue(resolver.rootNode);
        onChange();
      });
      return () => {
        stopEffect();
        resolver.dispose();
        if (box.resolver === resolver) {
          box.resolver = undefined;
        }
      };
    },
    [surface, box],
  );
  const getSnapshot = useCallback(
    () => (box.resolver ? peekValue(box.resolver.rootNode) : undefined),
    [box],
  );
  const root = useSyncExternalStore(subscribe, getSnapshot);

  if (!root) {
    return <LoadingPlaceholder componentId="root" />;
  }
  return (
    <NodeSurfaceContext.Provider value={surface as any}>
      <NodeView surface={surface} node={root} />
    </NodeSurfaceContext.Provider>
  );
};
