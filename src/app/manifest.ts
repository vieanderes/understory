import type { MetadataRoute } from 'next';

/** Makes Understory installable. On iOS this is the app until the native one exists. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Understory',
    short_name: 'Understory',
    description:
      'Learn software engineering, keep it through spaced practice, follow what changes.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    // The ink ground of the dark theme. The splash screen and the icon share it.
    background_color: '#08090a',
    theme_color: '#08090a',
    categories: ['education', 'productivity', 'developer'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Practice', url: '/practise' },
      { name: 'News', url: '/signal' },
    ],
  };
}
