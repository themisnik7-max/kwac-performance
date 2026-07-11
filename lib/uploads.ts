// Shared upload-path helper for property-docs, property-photos, and
// gpi-upload. The extension used to be taken straight from the user-
// supplied filename with no validation — bucket RLS already scopes the
// path prefix to agency_id (so no cross-tenant path traversal was
// possible), but an unsanitized extension could still inject an extra
// path segment (e.g. "a.jpg/../evil") into the object key. Whitelisted to
// a short alphanumeric extension; anything else falls back to the
// caller-provided default.
export function safeExtension(filename: string, fallback: string): string {
  const raw = filename.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,5}$/.test(raw) ? raw : fallback
}
