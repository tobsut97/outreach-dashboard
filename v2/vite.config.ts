import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** Plain `vite dev` has no serverless runtime for v2/api/*, so a fetch to /api/overrides would
 *  otherwise resolve to api/overrides.ts on disk and crash on its Node-only import. Stub it out
 *  with a 404 here so the app degrades to fetchOverrides()'s empty-object fallback instead —
 *  use `npm run dev:vercel` to actually exercise the API route locally. */
function stubApiInDev(): Plugin {
  return {
    name: 'stub-api-in-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          res.statusCode = 404
          res.end()
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile(), stubApiInDev()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
