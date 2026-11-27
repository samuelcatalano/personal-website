import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [{
    name: 'lazy-world-preloads',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s*<link rel="modulepreload" href="js\/[^\"]+">/g, '');
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      external: [/^three(?:\/.*)?$/],
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: (chunk) => chunk.name.startsWith('world') ? 'js/world/[name]-[hash].js' : 'js/[name]-[hash].js',
        codeSplitting: {
          groups: [{
            name: 'world',
            priority: 10,
            includeDependenciesRecursively: false,
            test: (id) => {
              const file = id.split('?')[0];
              return file.includes('/js/world/') && !file.endsWith('/layout.js') && !file.endsWith('/load-progress.js');
            },
          }],
        },
      },
    },
  },
});
