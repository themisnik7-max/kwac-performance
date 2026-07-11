/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  // Deliberately no Content-Security-Policy here — this app loads external
  // images (i-list.gr thumbnails), a Leaflet map, and other third-party
  // assets across many pages; a CSP tight enough to matter needs auditing
  // every page's actual script/style/img sources first, not guessing one
  // and risking silently breaking a page nobody happens to click through
  // right after deploy. The headers below are safe defaults with no such
  // page-by-page risk.
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    }]
  },
}
module.exports = nextConfig