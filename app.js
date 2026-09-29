const $ = (id) => document.getElementById(id);

const urlInput = $("url");
const buildBtn = $("build");
const statusEl = $("status");
const result = $("result");
const preview = $("preview");
const chipUrl = $("chip-url");
const resultMeta = $("result-meta");
const omnibox = $("omnibox");

let lastHtml = "";
let lastName = "offer";

urlInput.addEventListener("input", () => {
  chipUrl.textContent = urlInput.value.trim() || "https://www.skool.com/salgsraketten/about";
});

document.querySelectorAll(".presets button").forEach((btn) => {
  btn.addEventListener("click", () => {
    urlInput.value = btn.dataset.url;
    chipUrl.textContent = btn.dataset.url;
  });
});

buildBtn.addEventListener("click", () => buildSite());
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") buildSite();
});

$("again").addEventListener("click", () => {
  result.hidden = true;
  urlInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("download").addEventListener("click", () => {
  const blob = new Blob([lastHtml], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slugify(lastName)}-nyvariant.html`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("open-full").addEventListener("click", () => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(lastHtml);
  w.document.close();
});

function setStatus(msg, show = true) {
  statusEl.hidden = !show;
  statusEl.textContent = msg;
}

async function buildSite() {
  const raw = urlInput.value.trim();
  if (!raw) {
    setStatus("Lim inn en lenke først.");
    return;
  }

  let href;
  try {
    href = new URL(raw.startsWith("http") ? raw : `https://${raw}`).toString();
  } catch {
    setStatus("Det ser ikke ut som en URL.");
    return;
  }

  buildBtn.disabled = true;
  setStatus("Leser tilbudet på den andre siden av lenka…");

  const meta = await fetchMeta(href);
  const page = inventPage(meta);
  lastHtml = renderLanding(page);
  lastName = page.product;

  preview.srcdoc = lastHtml;
  omnibox.textContent = page.domain.replace(/^www\./, "") + " · via nyvariant";
  resultMeta.textContent = `${page.product} · ny variant fra ${page.domain}`;
  result.hidden = false;
  setStatus(`Lagde en ${page.angle}-variant for ${page.product}.`, true);
  buildBtn.disabled = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function fetchMeta(url) {
  const fallback = inferFromUrl(url);
  const endpoints = [
    `https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false`,
    `https://r.jina.ai/http://api.microlink.io/?url=${encodeURIComponent(url)}`,
  ];

  for (const endpoint of endpoints.slice(0, 1)) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const json = await res.json();
      const data = json.data || json;
      if (!data || json.status === "fail") continue;
      return {
        url,
        finalUrl: data.url || url,
        title: cleanTitle(data.title) || fallback.title,
        description: (data.description || "").slice(0, 280) || fallback.description,
        image: data.image?.url || data.logo?.url || "",
        publisher: data.publisher || fallback.publisher,
        domain: hostname(data.url || url),
      };
    } catch {
      /* use fallback */
    }
  }
  return fallback;
}

function inferFromUrl(url) {
  const host = hostname(url);
  const brand = brandFromHost(host);
  const pathBits = new URL(url).pathname
    .split(/[-_/+]/)
    .filter((p) => p && !/^(dp|gp|product|products|p|item|id)$/i.test(p) && !/^\d+$/.test(p) && p.length > 2)
    .slice(0, 6)
    .map((p) => p.replace(/\.(html|php|aspx)$/i, ""));

  const guessed = pathBits.map(titleCase).join(" ") || brand;
  return {
    url,
    finalUrl: url,
    title: guessed,
    description: `${guessed} — a closer look at the offer behind this link, written as a simple landing page.`,
    image: "",
    publisher: brand,
    domain: host,
  };
}

function inventPage(meta) {
  const product = tidyProduct(meta.title, meta.publisher, meta.domain);
  const brand = meta.publisher || brandFromHost(meta.domain);
  const words = product.toLowerCase();

  const category = categorize(words + " " + (meta.description || "") + " " + meta.domain);
  const angle = category.angle;
  const headline = category.headline(product, brand);
  const sub = meta.description || category.sub(product);
  const benefits = category.benefits(product, brand);
  const faqs = category.faqs(product);
  const cta = category.cta;
  const vibe = category.vibe;

  return {
    affiliateUrl: meta.url,
    product,
    brand,
    domain: meta.domain,
    headline,
    sub,
    image: meta.image,
    benefits,
    faqs,
    cta,
    vibe,
    angle,
    disclosure: `This page was generated as a demo. The button still points at the original link you pasted (${meta.domain}). If that link is an affiliate URL, purchases may earn a commission.`,
  };
}

function categorize(text) {
  const t = text.toLowerCase();
  if (/(kindle|book|ebook|novel|author)/.test(t)) return copyPacks.book;
  if (/(airpods|headphones|earbuds|audio)/.test(t)) return copyPacks.audio;
  if (/(tesla|car|vehicle|model 3|ev\b)/.test(t)) return copyPacks.auto;
  if (/(notion|saas|app|software|platform|tool)/.test(t)) return copyPacks.software;
  if (/(course|masterclass|training|academy)/.test(t)) return copyPacks.course;
  return copyPacks.general;
}

const copyPacks = {
  general: {
    angle: "review",
    vibe: { bg: "#f7f1e6", ink: "#1c1915", accent: "#e2b84a", card: "#fffdf8" },
    headline: (p) => `A calmer look at ${p}`,
    sub: (p) => `${p} without the usual landing-page shouting. Here’s what the offer actually is.`,
    cta: "See the offer",
    benefits: (p) => [
      ["What it is", `A plain-language page built around ${p}, so the link has somewhere decent to live.`],
      ["Who it’s for", "People who already wanted the thing — they just needed a page that explains it."],
      ["What you keep", "Your original URL. Same destination, less naked-link energy."],
    ],
    faqs: (p) => [
      [`Is this the official ${p} site?`, "No. This is a generated review-style page that sends people onward to the original link."],
      ["Did a human write this?", "A small generator wrote this from the page title, description, and domain. Treat it as a first draft."],
    ],
  },
  software: {
    angle: "product",
    vibe: { bg: "#eef3ef", ink: "#14201b", accent: "#7bd4a8", card: "#ffffff" },
    headline: (p) => `${p} — less tab chaos, more one place`,
    sub: () => "A workspace people open on Monday and still use on Thursday.",
    cta: "Try it from the official page",
    benefits: (p, b) => [
      ["One home for the work", `${p} is the kind of tool you open instead of hunting through five other tabs.`],
      ["Built to be shared", `Teams usually adopt ${b} because the empty page is less scary than a blank doc.`],
      ["You still leave to sign up", "This page is the porch. The product lives at the original link."],
    ],
    faqs: (p) => [
      [`Does this log me into ${p}?`, "No. The button takes you to the real site."],
      ["Is the copy from their marketing team?", "No. It was assembled from public page metadata plus a template."],
    ],
  },
  book: {
    angle: "review",
    vibe: { bg: "#f3ead7", ink: "#2a2116", accent: "#d9a441", card: "#fff8ea" },
    headline: (p) => `Should you actually read ${p}?`,
    sub: () => "A short landing page for a long thing: what it is, who it’s for, where to get it.",
    cta: "Get the book",
    benefits: (p) => [
      ["The pitch", `${p} is the kind of title people send to a friend with “just start this one.”`],
      ["The format", "If the destination is a store page, that’s where formats, price, and sample live."],
      ["The honest bit", "A generated page cannot review a book it hasn’t read. Use this as a wrapper, not a critic."],
    ],
    faqs: (p) => [
      ["Is this a full review?", `No. It’s a storefront wrapper for ${p}.`],
      ["Where does the button go?", "To the exact link you pasted — Kindle store, publisher, wherever it pointed."],
    ],
  },
  audio: {
    angle: "product",
    vibe: { bg: "#eceff3", ink: "#111318", accent: "#8ab4ff", card: "#ffffff" },
    headline: (p) => `${p}, without the spec-sheet fog`,
    sub: () => "Noise cancelling, fit, battery — the reasons people actually buy them.",
    cta: "Check current price",
    benefits: (p) => [
      ["Everyday use", `${p} exists for commutes, calls, and the “I need the world quieter” hour.`],
      ["The usual tradeoff", "Fit and battery matter more than another frequency-response chart."],
      ["Buy from the source", "Pricing and colors change. The original product page is still the source of truth."],
    ],
    faqs: (p) => [
      ["Are these in stock?", `This page doesn’t know. The live store behind your link does.`],
      ["Is this Apple / Amazon / etc.?", "It depends on the URL you pasted. The button does not rewrite the merchant."],
    ],
  },
  auto: {
    angle: "brochure",
    vibe: { bg: "#f0f0f0", ink: "#101010", accent: "#e11f26", card: "#ffffff" },
    headline: (p) => `${p}, introduced like a product instead of a press release`,
    sub: () => "Range, daily driving, and the part where you still have to configure it on the real site.",
    cta: "Configure on the official site",
    benefits: (p) => [
      ["The daily version", `${p} is sold as transportation first, statement second — at least on a page like this.`],
      ["What we can’t invent", "Range, price, and delivery dates belong on the manufacturer page."],
      ["Why wrap the link", "A bare URL is a shrug. A page is an introduction."],
    ],
    faqs: (p) => [
      ["Can I order here?", "No. Ordering happens at the destination link."],
      ["Is this official?", `No. Official details live on ${p}’s own site.`],
    ],
  },
  course: {
    angle: "sales",
    vibe: { bg: "#f7efe4", ink: "#231910", accent: "#f0b429", card: "#fffaf2" },
    headline: (p) => `${p} — the syllabus without the countdown timer`,
    sub: () => "A quieter page for people who already meant to start.",
    cta: "Go to the course",
    benefits: (p) => [
      ["Who it’s for", `People considering ${p} who don’t need fireworks to decide.`],
      ["What you get there", "Curriculum, price, and login live on the original site."],
      ["What this page is", "A generated front door. Not the classroom."],
    ],
    faqs: (p) => [
      ["Is this the checkout?", "The button is. This page is only the explanation."],
      ["Refunds?", `Whatever the original ${p} offer says. This demo doesn’t add a guarantee.`],
    ],
  },
};

function renderLanding(p) {
  const img = p.image
    ? `<img class="hero-img" src="${escapeAttr(p.image)}" alt="${escapeAttr(p.product)}" />`
    : `<div class="hero-img fallback">${escapeHtml(p.product.charAt(0))}</div>`;

  const benefits = p.benefits
    .map(
      ([t, b]) => `<article><h3>${escapeHtml(t)}</h3><p>${escapeHtml(b)}</p></article>`
    )
    .join("");

  const faqs = p.faqs
    .map(
      ([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(p.product)} — Nyvariant</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:${p.vibe.bg}; --ink:${p.vibe.ink}; --accent:${p.vibe.accent}; --card:${p.vibe.card}; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:"Source Sans 3", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  header, main, footer { width:min(980px, calc(100% - 40px)); margin:0 auto; }
  header { display:flex; justify-content:space-between; align-items:center; padding:22px 0; }
  .logo { font-family:"Fraunces", serif; font-size:22px; }
  .hero { display:grid; grid-template-columns:1.1fr .9fr; gap:36px; align-items:center; padding:20px 0 40px; }
  h1 { font-family:"Fraunces", serif; font-size:clamp(36px, 5vw, 58px); line-height:1.05; margin:0 0 14px; }
  .sub { font-size:20px; opacity:.86; }
  .cta { display:inline-block; margin-top:18px; background:var(--ink); color:var(--bg); text-decoration:none; padding:14px 18px; border-radius:999px; font-weight:600; }
  .hero-img { width:100%; height:320px; object-fit:cover; border-radius:22px; background:#ddd; }
  .fallback { display:grid; place-items:center; font-family:"Fraunces", serif; font-size:80px; background:var(--accent); }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; padding:10px 0 40px; }
  article, details { background:var(--card); border-radius:16px; padding:18px; }
  h2, h3 { font-family:"Fraunces", serif; }
  h3 { margin:0 0 8px; }
  article p, details p { margin:0; line-height:1.5; }
  .faq { display:grid; gap:10px; padding-bottom:40px; }
  footer { padding:10px 0 40px; font-size:13px; opacity:.75; }
  .note { font-size:13px; opacity:.7; margin-top:10px; }
  @media (max-width:800px){ .hero,.grid{grid-template-columns:1fr;} .hero-img{height:220px;} }
</style>
</head>
<body>
  <header>
    <div class="logo">${escapeHtml(p.brand)}</div>
    <a class="cta" href="${escapeAttr(p.affiliateUrl)}" rel="nofollow sponsored"> ${escapeHtml(p.cta)} </a>
  </header>
  <main>
    <section class="hero">
      <div>
        <h1>${escapeHtml(p.headline)}</h1>
        <p class="sub">${escapeHtml(p.sub)}</p>
        <a class="cta" href="${escapeAttr(p.affiliateUrl)}" rel="nofollow sponsored">${escapeHtml(p.cta)} →</a>
        <p class="note">Keeps your original link. Opens the real offer.</p>
      </div>
      ${img}
    </section>
    <h2>Why this page exists</h2>
    <section class="grid">${benefits}</section>
    <h2>Quick answers</h2>
    <section class="faq">${faqs}</section>
  </main>
  <footer>${escapeHtml(p.disclosure)}</footer>
</body>
</html>`;
}

function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "link";
  }
}

function brandFromHost(host) {
  const h = host.replace(/^www\./, "").split(".")[0];
  const map = { amzn: "Amazon", amazon: "Amazon", notion: "Notion", apple: "Apple", tesla: "Tesla" };
  return map[h] || titleCase(h);
}

function tidyProduct(title, publisher, domain) {
  let t = cleanTitle(title || "");
  const brand = publisher || brandFromHost(domain);
  t = t.replace(new RegExp(`\\s*[\\-|–|:]\\s*${escapeReg(brand)}.*$`, "i"), "");
  t = t.replace(/\s*\|\s*.*$/, "");
  if (t.length > 68) t = t.slice(0, 65).replace(/\s+\S*$/, "") + "…";
  return t || brand;
}

function cleanTitle(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .replace(/Amazon\.com\s*:/i, "")
    .trim();
}

function titleCase(s) {
  return String(s)
    .replace(/[%._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "site";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, """);
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
