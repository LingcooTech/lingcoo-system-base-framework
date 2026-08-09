import { defineExtension, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { type WebRouteContext, defineWebExtension } from '@lingcootech/frame-web';
import type { ComponentType } from 'react';

import {
  ArchitecturePage,
  ExtensionsPage,
  FrameworkPage,
  HomePage,
  PackagesPage,
  ReleasesPage,
} from './pages';
import { DocsIndexPage, DocumentPage } from './document-pages';
import { referenceDocuments } from './docs';
import { officialSitemapEntries, referenceSiteManifest } from './manifest';

export interface ReferenceWebContext {
  presentation: import('@lingcootech/frame-web/presentation').PublicPresentation | null;
}

function withPresentation(
  Page: ComponentType<{ presentation: ReferenceWebContext['presentation'] }>,
) {
  return ({ context }: WebRouteContext<ReferenceWebContext>) => (
    <Page presentation={context.presentation} />
  );
}

const referenceSiteSurface = defineWebExtension<ReferenceWebContext>({
  routes: [
    {
      id: 'reference.home',
      component: ({ context }) => <HomePage presentation={context.presentation} />,
    },
    { id: 'reference.framework', component: withPresentation(FrameworkPage) },
    { id: 'reference.architecture', component: withPresentation(ArchitecturePage) },
    { id: 'reference.packages', component: withPresentation(PackagesPage) },
    { id: 'reference.extensions', component: withPresentation(ExtensionsPage) },
    { id: 'reference.docs', component: withPresentation(DocsIndexPage) },
    {
      id: 'reference.docs.detail',
      component: ({ context, params }) => (
        <DocumentPage presentation={context.presentation} slug={params.slug ?? ''} />
      ),
    },
    { id: 'reference.releases', component: withPresentation(ReleasesPage) },
  ],
  seo: [
    { id: 'reference.home', resolve: () => ({ canonicalPath: '/' }) },
    { id: 'reference.framework', resolve: () => ({ canonicalPath: '/framework' }) },
    { id: 'reference.architecture', resolve: () => ({ canonicalPath: '/architecture' }) },
    { id: 'reference.packages', resolve: () => ({ canonicalPath: '/packages' }) },
    { id: 'reference.extensions', resolve: () => ({ canonicalPath: '/extensions' }) },
    { id: 'reference.docs', resolve: () => ({ canonicalPath: '/docs' }) },
    {
      id: 'reference.docs.detail',
      resolve: ({ params }) => ({ canonicalPath: `/docs/${params.slug ?? ''}` }),
    },
    { id: 'reference.releases', resolve: () => ({ canonicalPath: '/releases' }) },
  ],
  sitemap: [
    {
      id: 'reference.home',
      collect: () => [officialSitemapEntries[0]],
    },
    {
      id: 'reference.framework',
      collect: () => [officialSitemapEntries[1]],
    },
    {
      id: 'reference.architecture',
      collect: () => [officialSitemapEntries[2]],
    },
    {
      id: 'reference.packages',
      collect: () => [officialSitemapEntries[3]],
    },
    {
      id: 'reference.extensions',
      collect: () => [officialSitemapEntries[4]],
    },
    {
      id: 'reference.docs',
      collect: () => [
        officialSitemapEntries[5],
        ...referenceDocuments.map((document) => ({
          path: `/docs/${document.slug}`,
          changeFrequency: 'monthly' as const,
          priority: 0.6,
        })),
      ],
    },
    {
      id: 'reference.releases',
      collect: () => [officialSitemapEntries[6]],
    },
  ],
});

export const referenceSiteDefinition = defineExtension({
  manifest: {
    id: 'frame-reference-site',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
    web: referenceSiteManifest,
  },
  web: referenceSiteSurface,
});
