// Shared CORS handling for all edge functions.
//
// Browsers reject a credentialed request (we send an Authorization header)
// unless the response echoes the *exact* requesting origin in
// Access-Control-Allow-Origin — a wildcard '*' is not allowed with
// credentials. Previously each function pinned a single origin from
// APP_ORIGIN, so Netlify deploy-preview subdomains
// (e.g. <hash>--<site>.netlify.app) failed CORS preflight and surfaced as
// "Failed to send a request to the Edge Function".
//
// This helper reflects the request origin back when it is allowed:
//   • any origin listed in APP_ORIGIN / APP_ORIGINS (comma-separated), or
//     the legacy VITE_APP_ORIGIN;
//   • localhost / 127.0.0.1 on any port (local dev);
//   • this site's Netlify production domain and its deploy previews, derived
//     from the host of APP_ORIGIN (prod "<site>.netlify.app" plus previews
//     "<hash>--<site>.netlify.app").

function configuredOrigins(): string[] {
  const list = [
    Deno.env.get('APP_ORIGIN'),
    Deno.env.get('VITE_APP_ORIGIN'),
    ...(Deno.env.get('APP_ORIGINS') ?? '').split(','),
  ]
  return list.map((o) => (o ?? '').trim()).filter(Boolean)
}

function netlifySiteHost(): string | null {
  for (const o of configuredOrigins()) {
    try {
      const host = new URL(o).host
      if (host.endsWith('.netlify.app')) return host
    } catch { /* not a full URL — ignore */ }
  }
  return null
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false

  // Exact match against any configured origin.
  if (configuredOrigins().some((o) => o === origin)) return true

  let host: string
  try { host = new URL(origin).host } catch { return false }

  // Local development on any port.
  const hostname = host.split(':')[0]
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true

  // This site's Netlify production domain + deploy previews.
  const siteHost = netlifySiteHost()
  if (siteHost && (host === siteHost || host.endsWith(`--${siteHost}`))) return true

  return false
}

// Build the CORS headers for a given request. Falls back to the first
// configured origin (or localhost) when the caller sends no/disallowed
// Origin, so non-browser callers still get a sane, non-empty header.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allow = isAllowedOrigin(origin)
    ? origin
    : (configuredOrigins()[0] ?? 'http://localhost:5173')
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
