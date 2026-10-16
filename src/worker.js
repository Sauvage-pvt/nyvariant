// Nyvariant Worker: serves the static site and the carousel API.
//
// Routes
//   POST /api/carousel        { url }  -> { slug, path }   (one carousel per link)
//   GET  /api/carousel/:slug           -> { url, created }
//   GET  /k/:slug                      -> carousel page (carousel.html)
//   everything else                    -> static assets (index.html, styles.css, ...)
//
// Only the link is stored. The carousel is rebuilt in the browser from the same
// engine as the landing page, so the slides and the page always match.

const SLUG_PATTERN = /^[a-f0-9]{12}$/;
const MAX_URL_LENGTH = 2048;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/carousel" && request.method === "POST") {
      return createCarousel(request, env);
    }

    if (url.pathname.startsWith("/api/carousel/") && request.method === "GET") {
      return readCarousel(url.pathname.slice("/api/carousel/".length), env);
    }

    if (url.pathname.startsWith("/k/")) {
      return env.ASSETS.fetch(new Request(new URL("/carousel.html", url), request));
    }

    return env.ASSETS.fetch(request);
  },
};

async function createCarousel(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const target = normalizeUrl(body?.url);
  if (!target) {
    return json({ error: "Expected an http(s) URL." }, 400);
  }

  const slug = await slugFor(target);
  const existing = await env.CAROUSELS.get(slug);
  if (!existing) {
    await env.CAROUSELS.put(
      slug,
      JSON.stringify({ url: target, created: new Date().toISOString() })
    );
  }

  return json({ slug, path: `/k/${slug}` });
}

async function readCarousel(slug, env) {
  if (!SLUG_PATTERN.test(slug)) {
    return json({ error: "Not found." }, 404);
  }

  const stored = await env.CAROUSELS.get(slug);
  if (!stored) {
    return json({ error: "Not found." }, 404);
  }

  return new Response(stored, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function normalizeUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function slugFor(target) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(target));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
