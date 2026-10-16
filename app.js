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
let lastHref = "";

urlInput.addEventListener("input", () => {
  chipUrl.textContent = urlInput.value.trim() || "Lim inn en lenke…";
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

$("carousel").addEventListener("click", async () => {
  const btn = $("carousel");
  btn.disabled = true;
  try {
    const res = await fetch("/api/carousel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: lastHref }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { path } = await res.json();
    window.open(path, "_blank", "noopener");
  } catch (err) {
    console.error(err);
    setStatus("Klarte ikke å lage karusellen. Prøv igjen.");
  } finally {
    btn.disabled = false;
  }
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
  lastHref = href;

  buildBtn.disabled = true;
  setStatus("Leser tilbudet på den andre siden av lenka…");

  try {
    const meta = await fetchMeta(href);
    const page = inventPage(meta);
    lastHtml = renderLanding(page);
    lastName = page.product;

    preview.srcdoc = lastHtml;
    omnibox.textContent = page.domain.replace(/^www\./, "") + " · via nyvariant";
    resultMeta.textContent = `${page.product} · ny variant fra ${page.domain}`;
    result.hidden = false;
    setStatus(`Lagde en ${page.angle}-variant for ${page.product}.`, true);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus("Klarte ikke å lage en variant av denne lenka. Prøv en annen.");
  } finally {
    buildBtn.disabled = false;
  }
}

