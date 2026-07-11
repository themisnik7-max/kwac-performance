import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    include:     ['**/__tests__/**/*.test.ts'],
    // Several lib/*.ts files instantiate a Supabase client at module scope
    // (createClient(...) throws immediately if the URL/key are empty) — same
    // reason .github/workflows/ci.yml sets placeholders for `next build`.
    // These are never used for a real network call by anything under test;
    // they just need to exist so importing e.g. lib/auth.ts for its pure
    // functions (isCeoOrAdmin) doesn't crash before any test runs.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
