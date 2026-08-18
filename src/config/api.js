export const API_URL = import.meta.env.VITE_API_URL || '';

// Dev/build-time sanity check — helps catch missing env var immediately
// instead of silently hitting the wrong host in production.
if (import.meta.env.PROD && !API_URL) {
  console.error(
    '[config/api.js] VITE_API_URL is not set in this build. ' +
    'All API requests will go to the frontend\'s own origin, which will fail. ' +
    'Set VITE_API_URL in your production env and rebuild.'
  );
}

export const getWsUrl = (path) => {
  const base = API_URL || window.location.origin;
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}${path}`;
};

/**
 * Safe wrapper around fetch() that:
 *  - Always resolves to a JSON-ish object, even on error
 *  - Never throws "Unexpected token" on non-JSON responses (HTML error pages, etc.)
 *  - Gives a clear error message when the backend returns something unexpected
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    // fetch() itself failed — server unreachable, CORS block, DNS fail, etc.
    throw new Error(`Network error while calling ${url}: ${networkErr.message}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data = null;
  const rawText = await res.text();

  if (isJson) {
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      throw new Error(
        `Server claimed JSON but body was invalid (status ${res.status}) at ${url}. ` +
        `First 100 chars: ${rawText.slice(0, 100)}`
      );
    }
  } else {
    // Server returned HTML / plain text instead of JSON —
    // this is exactly what causes "Unexpected token 'T', 'The page c'..."
    throw new Error(
      `Expected JSON but got "${contentType || 'unknown'}" (status ${res.status}) from ${url}. ` +
      `This usually means the request hit the wrong host/route, the backend is down, ` +
      `or a proxy/hosting layer returned its own error page. ` +
      `First 100 chars: ${rawText.slice(0, 100)}`
    );
  }

  if (!res.ok) {
    const message = data?.detail || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}