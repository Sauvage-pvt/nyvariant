// Kundeside: bygger en ny forside for en lokal bedrift.
// Punktene er hentet fra testene i dahl-ai-synlighet-test: meta-beskrivelse, canonical,
// schema.org, telefon og sted i klartekst, FAQ, llms.txt og anmeldelser. I tillegg
// kommer chat og bookinglenke, slik at forsiden kan prøves som den er.

const KINDS = {
  frisor: { label: "Frisør", noun: "frisør", schema: "HairSalon", accent: "#2f5d50", cta: "Book time" },
  restaurant: { label: "Restaurant / kafé", noun: "spisested", schema: "Restaurant", accent: "#8a3b20", cta: "Bestill bord" },
  handverker: { label: "Håndverker", noun: "håndverker", schema: "HomeAndConstructionBusiness", accent: "#1f4f7a", cta: "Be om tilbud" },
  behandler: { label: "Klinikk / behandler", noun: "klinikk", schema: "MedicalBusiness", accent: "#2c6e7a", cta: "Book time" },
  butikk: { label: "Butikk", noun: "butikk", schema: "Store", accent: "#7a3e68", cta: "Ta kontakt" },
  annet: { label: "Annet", noun: "lokal bedrift", schema: "LocalBusiness", accent: "#334e68", cta: "Ta kontakt" },
};

const DAYS = [
  { n: 1, no: "mandag", en: "Monday" },
  { n: 2, no: "tirsdag", en: "Tuesday" },
  { n: 3, no: "onsdag", en: "Wednesday" },
  { n: 4, no: "torsdag", en: "Thursday" },
  { n: 5, no: "fredag", en: "Friday" },
  { n: 6, no: "lørdag", en: "Saturday" },
  { n: 0, no: "søndag", en: "Sunday" },
];

const DEMO = {
  siteUrl: "",
  name: "Per Frisør",
  kind: "frisor",
  city: "Steinkjer",
  address: "Eksempelveien 1",
  phone: "+47 000 00 000",
  email: "post@example.no",
  openDays: [2, 3, 4, 5, 6],
  opens: "09:00",
  closes: "17:00",
  services: "Klipp | 45\nKlipp og skjegg | 60",
  bookingUrl: "https://cal.com/",
  reviewUrl: "https://g.page/r/eksempel/review",
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const preview = $("preview");
let lastHtml = "";
let lastLlms = "";
let lastSlug = "kunde";

$("kind").innerHTML = Object.entries(KINDS)
  .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
  .join("");
$("days").innerHTML = DAYS.map(
  (d) => `<label><input type="checkbox" value="${d.n}" /> ${d.no.slice(0, 3)}</label>`
).join("");

function fillForm(v) {
  $("siteUrl").value = v.siteUrl;
  $("name").value = v.name;
  $("kind").value = v.kind;
  $("city").value = v.city;
  $("address").value = v.address;
  $("phone").value = v.phone;
  $("email").value = v.email;
  $("opens").value = v.opens;
  $("closes").value = v.closes;
  $("services").value = v.services;
  $("bookingUrl").value = v.bookingUrl;
  $("reviewUrl").value = v.reviewUrl;
  document.querySelectorAll("#days input").forEach((i) => {
    i.checked = v.openDays.includes(Number(i.value));
  });
}

$("fill-demo").addEventListener("click", () => {
  fillForm(DEMO);
  buildSite();
});
$("build").addEventListener("click", () => buildSite());

$("download").addEventListener("click", () => saveFile(lastHtml, `${lastSlug}-ny-forside.html`, "text/html"));
$("download-llms").addEventListener("click", () => saveFile(lastLlms, "llms.txt", "text/plain"));
$("open-full").addEventListener("click", () => {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(lastHtml);
  w.document.close();
});
for (const [id, mobile] of [["view-desktop", false], ["view-mobile", true]]) {
  $(id).addEventListener("click", () => {
    $("browser").classList.toggle("mobile", mobile);
    $("view-desktop").setAttribute("aria-pressed", String(!mobile));
    $("view-mobile").setAttribute("aria-pressed", String(mobile));
  });
}

function saveFile(text, filename, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setStatus(msg) {
  statusEl.hidden = !msg;
  statusEl.textContent = msg || "";
}

function readForm() {
  return {
    siteUrl: $("siteUrl").value.trim(),
    name: $("name").value.trim(),
    kind: $("kind").value,
    city: $("city").value.trim(),
    address: $("address").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    opens: $("opens").value,
    closes: $("closes").value,
    openDays: [...document.querySelectorAll("#days input:checked")].map((i) => Number(i.value)),
    services: $("services").value,
    bookingUrl: $("bookingUrl").value.trim(),
    reviewUrl: $("reviewUrl").value.trim(),
  };
}

// slugify() fjerner æ, ø og å, så de byttes ut først.
function nameSlug(name) {
  const map = { æ: "ae", ø: "o", å: "a" };
  return slugify(name.toLowerCase().replace(/[æøå]/g, (c) => map[c]));
}

function httpUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function parseServices(text) {
  return text
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter((p) => p[0])
    .map(([name, min, price]) => ({
      name,
      min: Math.max(5, parseInt(min, 10) || 30),
      price: price || "",
    }));
}

// «tirsdag–lørdag» for sammenhengende dager, ellers en liste.
function dayRange(openDays) {
  const order = DAYS.map((d) => d.n).filter((n) => openDays.includes(n));
  if (!order.length) return "";
  const names = order.map((n) => DAYS.find((d) => d.n === n).no);
  const idx = order.map((n) => DAYS.findIndex((d) => d.n === n));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (names.length > 2 && consecutive) return `${cap(names[0])} til ${names[names.length - 1]}`;
  return cap(names.join(", ").replace(/, ([^,]*)$/, " og $1"));
}

async function buildSite() {
  const form = readForm();
  const siteUrl = httpUrl(form.siteUrl);
  if (!form.name || !form.city) {
    setStatus("Fyll inn bedriftsnavn og sted først.");
    return;
  }
  if (!form.openDays.length) {
    setStatus("Velg minst én åpen dag.");
    return;
  }

  $("build").disabled = true;
  let meta = null;
  if (siteUrl) {
    setStatus("Leser dagens nettside…");
    try {
      meta = await fetchMeta(siteUrl);
      if (/a closer look at the offer/.test(meta.description || "")) meta.description = "";
    } catch {
      meta = null;
    }
  }

  const kind = KINDS[form.kind] || KINDS.annet;
  const services = parseServices(form.services);
  const cfg = {
    name: form.name,
    kindKey: form.kind,
    kind,
    city: form.city,
    address: form.address,
    phone: form.phone,
    phoneHref: form.phone.replace(/[^\d+]/g, ""),
    email: form.email,
    siteUrl,
    opens: form.opens || "09:00",
    closes: form.closes || "17:00",
    openDays: form.openDays,
    hoursText: `${dayRange(form.openDays)} ${form.opens}–${form.closes}`,
    services,
    bookingUrl: httpUrl(form.bookingUrl),
    reviewUrl: httpUrl(form.reviewUrl),
    image: meta?.image || "",
    siteDescription: meta?.description || "",
  };

  const built = buildCustomerSite(cfg);
  lastHtml = built.html;
  lastLlms = built.llms;
  lastSlug = nameSlug(cfg.name);

  preview.srcdoc = lastHtml;
  $("omnibox").textContent = (siteUrl ? hostname(siteUrl).replace(/^www\./, "") : nameSlug(cfg.name)) + " · ny forside";
  $("result-meta").textContent = `${cfg.name} · ${kind.noun} i ${cfg.city}`;
  $("result").hidden = false;
  renderFixes(built.checks);
  setStatus(`Bygde ny forside for ${cfg.name}. Prøv chatten nede til høyre i forhåndsvisningen.`);
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  $("build").disabled = false;
}

function renderFixes(checks) {
  $("fixes").innerHTML = checks
    .map(
      (c) =>
        `<li><span class="${c.ok ? "ok" : "miss"}">${c.ok ? "✓" : "–"}</span><span><b>${escapeHtml(c.title)}</b>${escapeHtml(c.note)}</span></li>`
    )
    .join("");
}

function buildFaqs(cfg) {
  const faqs = [];
  faqs.push([
    `Hvor holder ${cfg.name} til?`,
    cfg.address
      ? `${cfg.name} ligger i ${cfg.address}, ${cfg.city}.`
      : `${cfg.name} holder til i ${cfg.city}.`,
  ]);
  faqs.push([`Når har dere åpent?`, `${cfg.hoursText}. Andre dager er det stengt.`]);
  if (cfg.services.length) {
    faqs.push([
      `Hva kan jeg bestille hos ${cfg.name}?`,
      cfg.services
        .map((s) => `${s.name} (${s.min} min${s.price ? `, ${s.price}` : ""})`)
        .join(". ") + ".",
    ]);
  }
  faqs.push([
    "Hvordan booker jeg time?",
    cfg.bookingUrl
      ? "Bruk Book på nett-knappen på siden, eller spør chatten om ledige tider."
      : "Spør chatten om ledige tider, eller ta kontakt på telefon.",
  ]);
  if (cfg.phone) faqs.push(["Hvordan kommer jeg i kontakt?", `Ring ${cfg.phone}${cfg.email ? ` eller send e-post til ${cfg.email}` : ""}.`]);
  return faqs;
}

function buildCustomerSite(cfg) {
  const { kind } = cfg;
  const faqs = buildFaqs(cfg);
  const title = `${cfg.name} – ${kind.noun} i ${cfg.city}`;
  const description = (
    cfg.siteDescription ||
    `${cfg.name} er en ${kind.noun} i ${cfg.city}. ${cfg.hoursText}. ${
      cfg.bookingUrl ? "Book tid på nett eller spør chatten." : "Ta kontakt for å avtale tid."
    }`
  ).slice(0, 158);

  const schema = {
    "@context": "https://schema.org",
    "@type": kind.schema,
    name: cfg.name,
    description,
    ...(cfg.siteUrl ? { url: cfg.siteUrl } : {}),
    ...(cfg.phone ? { telephone: cfg.phone } : {}),
    ...(cfg.email ? { email: cfg.email } : {}),
    address: {
      "@type": "PostalAddress",
      ...(cfg.address ? { streetAddress: cfg.address } : {}),
      addressLocality: cfg.city,
      addressCountry: "NO",
    },
    areaServed: cfg.city,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DAYS.filter((d) => cfg.openDays.includes(d.n)).map((d) => d.en),
        opens: cfg.opens,
        closes: cfg.closes,
      },
    ],
    ...(cfg.services.length
      ? {
          makesOffer: cfg.services.map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name, description: `${s.name}, ${s.min} minutter` },
            ...(s.price ? { priceSpecification: { "@type": "PriceSpecification", description: s.price } } : {}),
          })),
        }
      : {}),
    ...(cfg.reviewUrl ? { sameAs: [cfg.reviewUrl] } : {}),
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  const ld = (o) => JSON.stringify(o, null, 2).replace(/</g, "\\u003c");

  const runtimeCfg = {
    name: cfg.name,
    phone: cfg.phone,
    phoneHref: cfg.phoneHref,
    email: cfg.email,
    address: cfg.address,
    city: cfg.city,
    hoursText: cfg.hoursText,
    openDays: cfg.openDays,
    opens: cfg.opens,
    closes: cfg.closes,
    services: cfg.services,
    bookingUrl: cfg.bookingUrl,
    reviewUrl: cfg.reviewUrl,
  };

  const bookHref = cfg.bookingUrl ? escapeAttr(cfg.bookingUrl) : "#chat";
  const bookAttrs = cfg.bookingUrl ? ' target="_blank" rel="noopener"' : ' data-open-chat';

  const servicesHtml = cfg.services.length
    ? `<section id="tjenester" aria-labelledby="h-tjenester">
      <h2 id="h-tjenester">Tjenester</h2>
      <ul class="services">${cfg.services
        .map(
          (s) =>
            `<li><span><b>${escapeHtml(s.name)}</b><small>${s.min} minutter</small></span><span class="price">${escapeHtml(
              s.price || ""
            )}</span></li>`
        )
        .join("")}</ul>
    </section>`
    : "";

  const reviewsHtml = cfg.reviewUrl
    ? `<section id="anmeldelser" aria-labelledby="h-anm" class="card">
      <h2 id="h-anm">Fornøyd? Si det videre</h2>
      <p>En kort anmeldelse på Google hjelper andre i ${escapeHtml(cfg.city)} å finne ${escapeHtml(cfg.name)}.</p>
      <a class="btn ghost" href="${escapeAttr(cfg.reviewUrl)}" target="_blank" rel="noopener">Skriv en anmeldelse på Google</a>
    </section>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description)}" />
${cfg.siteUrl ? `<link rel="canonical" href="${escapeAttr(cfg.siteUrl)}" />` : "<!-- canonical: legg inn riktig adresse når siden publiseres -->"}
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeAttr(title)}" />
<meta property="og:description" content="${escapeAttr(description)}" />
${cfg.image ? `<meta property="og:image" content="${escapeAttr(cfg.image)}" />` : ""}
<script type="application/ld+json">
${ld(schema)}
</script>
<script type="application/ld+json">
${ld(faqSchema)}
</script>
<style>
  :root { --bg:#f7f5f0; --surface:#fff; --fg:#1f1d1a; --muted:#645f57; --line:#e2dccf; --accent:${kind.accent}; --accent-fg:#fff; color-scheme:light dark; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#15171a; --surface:#1d2024; --fg:#ece8df; --muted:#9b958a; --line:#30343a; --accent:#7fc2ac; --accent-fg:#0f1d18; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:860px; margin:0 auto; padding:0 16px; }
  .skip { position:absolute; left:-999px; top:8px; background:var(--surface); padding:8px 12px; border-radius:8px; }
  .skip:focus { left:8px; z-index:20; }
  a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  header.site { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 0; }
  header.site strong { font-size:18px; }
  nav { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:15px; }
  nav a { color:var(--accent); text-decoration:none; }
  .btn { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:0 18px; border-radius:10px; border:1px solid var(--accent); background:var(--accent); color:var(--accent-fg); font:600 15px/1 inherit; text-decoration:none; cursor:pointer; }
  .btn.ghost { background:transparent; color:var(--accent); }
  .hero { display:grid; grid-template-columns:1.1fr .9fr; gap:28px; align-items:center; padding:28px 0 20px; }
  .hero.noimg { grid-template-columns:1fr; }
  .hero img { width:100%; height:280px; object-fit:cover; border-radius:16px; }
  h1 { font-size:clamp(30px,5vw,44px); line-height:1.1; margin:0 0 12px; }
  h2 { font-size:24px; margin:36px 0 10px; }
  .lede { font-size:18px; color:var(--muted); margin:0 0 18px; }
  .cta-row { display:flex; flex-wrap:wrap; gap:10px; }
  .services { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
  .services li { display:flex; justify-content:space-between; gap:12px; background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
  .services small { display:block; color:var(--muted); }
  .price { font-weight:600; white-space:nowrap; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-top:28px; }
  .card h2 { margin-top:0; }
  .contact dl { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:0; }
  .contact dt { color:var(--muted); }
  .contact dd { margin:0; }
  .contact a { color:var(--accent); }
  details { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:8px; }
  summary { cursor:pointer; font-weight:600; }
  details p { margin:8px 0 0; }
  footer.site { margin:40px 0 100px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:14px; }
  /* chat */
  #chat-open { position:fixed; right:16px; bottom:16px; z-index:30; box-shadow:0 8px 24px rgba(0,0,0,.2); }
  #chat { position:fixed; right:16px; bottom:16px; z-index:40; width:min(380px,calc(100vw - 32px)); height:min(560px,calc(100vh - 32px)); display:none; flex-direction:column; background:var(--surface); color:var(--fg); border:1px solid var(--line); border-radius:16px; box-shadow:0 18px 50px rgba(0,0,0,.25); overflow:hidden; }
  #chat.open { display:flex; }
  .chat-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 14px; border-bottom:1px solid var(--line); }
  .chat-head p { margin:0; font-size:12px; color:var(--muted); }
  .chat-head b { display:block; font-size:15px; }
  .chat-head button { background:none; border:0; color:var(--fg); font-size:22px; line-height:1; min-width:36px; min-height:36px; cursor:pointer; }
  .chat-log { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; min-height:0; }
  .msg { display:flex; flex-direction:column; gap:8px; max-width:88%; }
  .msg.bot { align-self:flex-start; }
  .msg.me { align-self:flex-end; align-items:flex-end; }
  .bubble { padding:9px 12px; border-radius:14px; white-space:pre-line; overflow-wrap:anywhere; font-size:15px; line-height:1.4; }
  .bot .bubble { background:var(--bg); border:1px solid var(--line); border-top-left-radius:4px; }
  .me .bubble { background:var(--accent); color:var(--accent-fg); border-top-right-radius:4px; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { min-height:38px; padding:0 12px; border-radius:999px; border:1px solid var(--accent); background:var(--surface); color:var(--accent); font:inherit; font-size:14px; cursor:pointer; }
  .chip[disabled] { opacity:.4; cursor:default; }
  .chip.link { text-decoration:none; display:inline-flex; align-items:center; background:var(--accent); color:var(--accent-fg); }
  .chat-form { display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--line); }
  .chat-form input { flex:1; min-width:0; min-height:42px; border:1px solid var(--line); border-radius:10px; padding:0 12px; font:inherit; background:var(--bg); color:var(--fg); }
  .chat-demo { margin:0; padding:6px 14px; font-size:12px; color:var(--muted); background:var(--bg); border-bottom:1px solid var(--line); }
  @media (max-width:720px) { .hero { grid-template-columns:1fr; } .hero img { height:200px; } }
</style>
</head>
<body>
<a class="skip" href="#main">Hopp til innhold</a>
<div class="wrap">
  <header class="site">
    <strong>${escapeHtml(cfg.name)}</strong>
    <nav aria-label="Hovedmeny">
      ${cfg.services.length ? '<a href="#tjenester">Tjenester</a>' : ""}
      <a href="#kontakt">Kontakt</a>
      <a href="#faq">Spørsmål</a>
    </nav>
  </header>

  <main id="main">
    <section class="hero${cfg.image ? "" : " noimg"}">
      <div>
        <h1>${escapeHtml(kind.noun.charAt(0).toUpperCase() + kind.noun.slice(1))} i ${escapeHtml(cfg.city)}</h1>
        <p class="lede">${escapeHtml(cfg.siteDescription || `${cfg.name} i ${cfg.city}. ${cfg.hoursText}.`)}</p>
        <div class="cta-row">
          <a class="btn" id="book-link" href="${bookHref}"${bookAttrs}>${cfg.bookingUrl ? "Book på nett" : escapeHtml(kind.cta)}</a>
          <button class="btn ghost" type="button" data-open-chat>Spør chatten</button>
          ${cfg.phone ? `<a class="btn ghost" href="tel:${escapeAttr(cfg.phoneHref)}">Ring ${escapeHtml(cfg.phone)}</a>` : ""}
        </div>
      </div>
      ${cfg.image ? `<img src="${escapeAttr(cfg.image)}" alt="${escapeAttr(cfg.name)}" />` : ""}
    </section>

    ${servicesHtml}

    <section id="kontakt" aria-labelledby="h-kontakt" class="card contact">
      <h2 id="h-kontakt">Åpningstider og kontakt</h2>
      <dl>
        <dt>Åpent</dt><dd>${escapeHtml(cfg.hoursText)}</dd>
        <dt>Sted</dt><dd>${escapeHtml([cfg.address, cfg.city].filter(Boolean).join(", "))}</dd>
        ${cfg.phone ? `<dt>Telefon</dt><dd><a href="tel:${escapeAttr(cfg.phoneHref)}">${escapeHtml(cfg.phone)}</a></dd>` : ""}
        ${cfg.email ? `<dt>E-post</dt><dd><a href="mailto:${escapeAttr(cfg.email)}">${escapeHtml(cfg.email)}</a></dd>` : ""}
      </dl>
    </section>

    <section id="faq" aria-labelledby="h-faq">
      <h2 id="h-faq">Ofte stilte spørsmål</h2>
      ${faqs.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join("\n      ")}
    </section>

    ${reviewsHtml}
  </main>

  <footer class="site">
    <p>${escapeHtml(cfg.name)} · ${escapeHtml(cfg.city)}${cfg.phone ? ` · ${escapeHtml(cfg.phone)}` : ""}</p>
    <p>Utkast til ny forside. Tekst, priser og åpningstider må godkjennes av bedriften.</p>
  </footer>
</div>

<button class="btn" id="chat-open" type="button" aria-controls="chat" aria-expanded="false">Chat og booking</button>
<section id="chat" role="dialog" aria-label="Chat med ${escapeAttr(cfg.name)}">
  <div class="chat-head">
    <div><b>${escapeHtml(cfg.name)}</b><p>Chat og booking</p></div>
    <button type="button" id="chat-close" aria-label="Lukk chat">×</button>
  </div>
  <p class="chat-demo">Utkast uten AI. Bookinger lagres bare i denne fanen.</p>
  <div class="chat-log" id="chat-log" aria-live="polite"></div>
  <form class="chat-form" id="chat-form" autocomplete="off">
    <input type="text" id="chat-text" placeholder="Skriv her, eller bruk knappene" aria-label="Skriv en melding" />
    <button class="btn" type="submit">Send</button>
  </form>
</section>

<script>
(${chatRuntime.toString()})(${JSON.stringify(runtimeCfg).replace(/</g, "\\u003c")});
</script>
</body>
</html>`;

  const llms = [
    `# ${cfg.name} – ${kind.noun} i ${cfg.city}`,
    "",
    description,
    "",
    "## Tjenester",
    ...(cfg.services.length
      ? cfg.services.map((s) => `- ${s.name} (${s.min} min${s.price ? `, ${s.price}` : ""})`)
      : ["- Ta kontakt for oversikt"]),
    "",
    "## Åpningstider",
    cfg.hoursText,
    "",
    "## Område",
    `${cfg.city}, Norge.`,
    "",
    "## Kontakt",
    ...(cfg.phone ? [`Telefon: ${cfg.phone}`] : []),
    ...(cfg.email ? [`E-post: ${cfg.email}`] : []),
    ...(cfg.address ? [`Adresse: ${cfg.address}, ${cfg.city}`] : []),
    ...(cfg.bookingUrl ? [`Booking: ${cfg.bookingUrl}`] : []),
    ...(cfg.reviewUrl ? [`Anmeldelser: ${cfg.reviewUrl}`] : []),
    "",
  ].join("\n");

  const checks = [
    { ok: true, title: "Meta-beskrivelse", note: "Skrevet med bransje, sted og åpningstider." },
    {
      ok: !!cfg.siteUrl,
      title: "Canonical",
      note: cfg.siteUrl ? "Peker på dagens adresse." : "Legg inn dagens nettadresse for å få med canonical.",
    },
    {
      ok: !!(cfg.phone && cfg.city),
      title: `Strukturerte data (${kind.schema})`,
      note: "Navn, sted, åpningstider og tjenester som schema.org." + (cfg.phone ? "" : " Telefon mangler."),
    },
    {
      ok: !!cfg.phone,
      title: "Telefon og sted i klartekst",
      note: cfg.phone ? "Står i kontaktseksjonen, ikke bare i bilder." : "Legg inn telefon.",
    },
    { ok: true, title: "FAQ med FAQPage-data", note: `${faqs.length} spørsmål som søk og AI kan sitere.` },
    { ok: true, title: "llms.txt", note: "Last ned og legg i roten av domenet." },
    {
      ok: !!cfg.reviewUrl,
      title: "Google-anmeldelser",
      note: cfg.reviewUrl ? "Egen seksjon med lenke til anmeldelsesskjema." : "Legg inn lenke fra Google Business Profile.",
    },
    {
      ok: !!cfg.bookingUrl,
      title: "Bookinglenke",
      note: cfg.bookingUrl ? "Knapp i toppen og i chatten." : "Legg inn kundens bookinglenke. Uten den peker knappen på chatten.",
    },
    { ok: true, title: "Chat som svarer og booker", note: "Åpningstider, priser, adresse og ledige tider." },
  ];

  return { html, llms, checks };
}

// Kjører inne i den genererte siden. Må være selvstendig: den serialiseres med toString().
function chatRuntime(cfg) {
  var chat = document.getElementById("chat");
  var openBtn = document.getElementById("chat-open");
  var log = document.getElementById("chat-log");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-text");
  var bookings = [];
  var state = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function down() { log.scrollTop = log.scrollHeight; }
  function say(who, text, chips) {
    var row = el("div", "msg " + who);
    row.appendChild(el("div", "bubble", text));
    if (chips && chips.length) {
      var box = el("div", "chips");
      chips.forEach(function (c) {
        var b;
        if (c.href) {
          b = el("a", "chip link", c.label);
          b.href = c.href;
          b.target = "_blank";
          b.rel = "noopener";
        } else {
          b = el("button", "chip", c.label);
          b.type = "button";
          b.addEventListener("click", function () {
            var all = log.querySelectorAll("button.chip");
            for (var i = 0; i < all.length; i++) all[i].disabled = true;
            say("me", c.label);
            c.pick();
          });
        }
        box.appendChild(b);
      });
      row.appendChild(box);
    }
    log.appendChild(row);
    down();
  }

  function setOpen(open) {
    chat.classList.toggle("open", open);
    openBtn.style.display = open ? "none" : "";
    openBtn.setAttribute("aria-expanded", String(open));
    if (open) { if (!log.children.length) menu(); input.focus(); } else { openBtn.focus(); }
  }
  openBtn.addEventListener("click", function () { setOpen(true); });
  document.getElementById("chat-close").addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && chat.classList.contains("open")) setOpen(false); });
  document.querySelectorAll("[data-open-chat]").forEach(function (n) {
    n.addEventListener("click", function (e) { e.preventDefault(); setOpen(true); });
  });

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function toMin(s) { var p = s.split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function dayShort(k) { return parseKey(k).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" }); }
  function dayLong(k) { return parseKey(k).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" }); }

  function nextDays(count) {
    var out = [], now = new Date();
    for (var i = 1; out.length < count && i < 30; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (cfg.openDays.indexOf(d.getDay()) !== -1) out.push(keyOf(d));
    }
    return out;
  }
  // Testdata: faste tider er «opptatt», så demoen oppfører seg likt hver gang.
  function busy(key, min) {
    var h = 0, s = key + ":" + min;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 4 === 0;
  }
  function taken(key, a, b) {
    return bookings.some(function (x) { return x.key === key && a < x.end && b > x.start; });
  }
  function slots(key, svc) {
    var free = [], t, end;
    for (t = toMin(cfg.opens); t + svc.min <= toMin(cfg.closes); t += svc.min) {
      end = t + svc.min;
      if (!busy(key, t) && !taken(key, t, end)) free.push(t);
    }
    return free;
  }

  function bookLink() {
    return cfg.bookingUrl ? [{ label: "Book på nett", href: cfg.bookingUrl }] : [];
  }

  function menu() {
    state = {};
    var chips = [];
    if (cfg.services.length) chips.push({ label: "Book time", pick: askService });
    chips.push({ label: "Åpningstider", pick: function () { answer("åpent"); } });
    if (cfg.services.length) chips.push({ label: "Priser", pick: function () { answer("pris"); } });
    chips.push({ label: "Hvor ligger dere?", pick: function () { answer("adresse"); } });
    say("bot", "Hei! Jeg er assistenten til " + cfg.name + ". Hva kan jeg hjelpe deg med?", chips.concat(bookLink()));
  }

  function askService() {
    state = { step: "service" };
    if (!cfg.services.length) { say("bot", "Jeg har ingen tjenester å booke her ennå. Ta kontakt på telefon.", bookLink()); return; }
    say("bot", "Hva skal du ha?", cfg.services.map(function (s) {
      return { label: s.name + " (" + s.min + " min)", pick: function () { state.svc = s; askDay(); } };
    }));
  }
  function askDay() {
    state.step = "day";
    say("bot", "Velg en dag. Vi har åpent " + cfg.hoursText.toLowerCase() + ".", nextDays(6).map(function (k) {
      return { label: dayShort(k), pick: function () { state.key = k; showSlots(); } };
    }));
  }
  function showSlots() {
    state.step = "slot";
    var free = slots(state.key, state.svc);
    var back = { label: "Annen dag", pick: askDay };
    if (!free.length) { say("bot", "Det er fullt den dagen.", [back]); return; }
    var chips = free.slice(0, 10).map(function (m) {
      return { label: hhmm(m), pick: function () { state.start = m; state.step = "name"; say("bot", "Hva heter du?"); } };
    });
    chips.push(back);
    say("bot", "Ledige tider " + dayLong(state.key) + ":", chips);
  }
  function confirm() {
    state.step = "confirm";
    say("bot", "Jeg booker " + state.svc.name.toLowerCase() + " " + dayLong(state.key) + " kl. " + hhmm(state.start) + " på navnet " + state.name + ". Stemmer det?", [
      { label: "Ja, book", pick: finish },
      { label: "Avbryt", pick: function () { say("bot", "Ok, ingenting er booket.", [{ label: "Start på nytt", pick: menu }]); } }
    ]);
  }
  function finish() {
    var end = state.start + state.svc.min;
    if (busy(state.key, state.start) || taken(state.key, state.start, end)) {
      say("bot", "Beklager, den tiden ble tatt. Velg en ny.", [{ label: "Velg tid", pick: showSlots }]);
      return;
    }
    bookings.push({ key: state.key, start: state.start, end: end });
    state.step = "done";
    say("bot", "Booket! " + state.svc.name + " " + dayLong(state.key) + " kl. " + hhmm(state.start) + ".\n\nDette er en demo, så ingen bekreftelse sendes. I en ekte løsning går bookingen til kalenderen.",
      bookLink().concat([{ label: "Start på nytt", pick: menu }]));
  }

  function answer(text) {
    var t = text.toLowerCase();
    if (/book|bestill|ledig|time\b|timer|avtale/.test(t) && cfg.services.length) { askService(); return; }
    if (/åpen|åpent|åpning|stenger|når /.test(t)) { say("bot", "Vi har åpent " + cfg.hoursText + ".", bookLink()); return; }
    if (/pris|koster|kr\b|betal/.test(t)) {
      var lines = cfg.services.map(function (s) { return "• " + s.name + " (" + s.min + " min)" + (s.price ? ": " + s.price : ""); });
      say("bot", cfg.services.length ? "Dette tilbyr vi:\n" + lines.join("\n") : "Ta kontakt for pris.", bookLink());
      return;
    }
    if (/hvor|adresse|ligger|finn|veibeskriv/.test(t)) { say("bot", [cfg.address, cfg.city].filter(Boolean).join(", ") + "."); return; }
    if (/telefon|ring|nummer|mobil/.test(t) && cfg.phone) { say("bot", "Ring oss på " + cfg.phone + "."); return; }
    if (/e-?post|mail/.test(t) && cfg.email) { say("bot", "Send e-post til " + cfg.email + "."); return; }
    if (/anmeld|google|omtale/.test(t) && cfg.reviewUrl) {
      say("bot", "Takk, det setter vi stor pris på!", [{ label: "Skriv anmeldelse", href: cfg.reviewUrl }]);
      return;
    }
    say("bot", "Det kan jeg ikke svare sikkert på. Jeg kan hjelpe med booking, åpningstider, priser og adresse" + (cfg.phone ? ", eller du kan ringe " + cfg.phone : "") + ".", [
      { label: "Book time", pick: askService }
    ].concat(bookLink()));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    say("me", text);
    if (/^(avbryt|start på nytt)$/i.test(text)) { menu(); return; }
    if (state.step === "name") { state.name = text; confirm(); return; }
    answer(text);
  });
}
