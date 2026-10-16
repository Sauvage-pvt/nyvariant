// Carousel page: /k/<slug>
// Loads the stored link, rebuilds the landing copy with the shared engine,
// and renders 1080x1350 PNG slides in the Nyvariant light palette.

const SIZE = { w: 1080, h: 1350 };

const PALETTE = {
  paper: "#f4efe4",
  ink: "#1a1714",
  muted: "#5c564c",
  yellow: "#ffe56a",
  red: "#d24a32",
  line: "#d9d0bf",
  card: "#fffaf1",
};

const FONT_HEAD = '"Fraunces", Georgia, serif';
const FONT_BODY = '"Source Sans 3", system-ui, sans-serif';
const FONT_LOADS = [
  `500 40px ${FONT_HEAD}`,
  `600 40px ${FONT_HEAD}`,
  `400 40px ${FONT_BODY}`,
  `600 40px ${FONT_BODY}`,
];

const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
const $ = (id) => document.getElementById(id);

let copy = null;
let slides = [];

wireButtons();
init();

async function init() {
  try {
    const res = await fetch(`/api/carousel/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      throw new Error(res.status === 404 ? "Fant ikke karusellen." : `Feil ${res.status}`);
    }
    const { url } = await res.json();

    await Promise.all(FONT_LOADS.map((f) => document.fonts.load(f)));

    const meta = await fetchMeta(url);
    const page = inventPage(meta);
    copy = buildCopy(page);
    slides = copy.slides.map((s, i) => ({
      ...s,
      canvas: renderSlide(s, i, copy.slides.length, page.domain),
    }));

    show(page);
  } catch (err) {
    console.error(err);
    const status = $("status");
    status.textContent = err.message || "Noe gikk galt.";
    status.classList.add("error");
  }
}

function show(page) {
  $("status").hidden = true;
  $("title").textContent = page.product;
  $("source").textContent = `Fra ${page.domain} · ${slides.length} slides`;
  document.title = `${page.product} — karusell`;
  $("original").href = page.affiliateUrl;

  const grid = $("slides");
  for (const s of slides) {
    const img = new Image();
    img.src = s.canvas.toDataURL("image/png");
    img.alt = `${s.label}: ${s.title}`;
    grid.append(img);
  }

  $("caption").value = copy.caption;
  $("hashtags").textContent = copy.hashtags.join(" ");
}

function wireButtons() {
  $("download").addEventListener("click", async () => {
    const btn = $("download");
    btn.disabled = true;
    try {
      const zip = new JSZip();
      const blobs = await Promise.all(
        slides.map((s) => new Promise((resolve) => s.canvas.toBlob(resolve, "image/png")))
      );
      blobs.forEach((blob, i) => {
        zip.file(`${String(i + 1).padStart(2, "0")}-${slides[i].kind}.png`, blob);
      });
      zip.file("caption.txt", $("caption").value);
      zip.file("hashtags.txt", copy.hashtags.join(" "));

      const out = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `${slugify(copy.product)}-karusell.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      btn.disabled = false;
    }
  });

  $("copy-caption").addEventListener("click", () => {
    navigator.clipboard.writeText($("caption").value);
  });

  $("copy-hashtags").addEventListener("click", () => {
    navigator.clipboard.writeText(copy.hashtags.join(" "));
  });
}

// Same content as the landing page: headline, benefits, first FAQ and CTA.
function buildCopy(page) {
  const points = page.benefits.slice(0, 3).map(([title, body]) => ({
    kind: "point",
    label: "Hvorfor",
    title,
    body,
  }));

  const faq = page.faqs[0]
    ? [{ kind: "faq", label: "Spørsmål", title: page.faqs[0][0], body: page.faqs[0][1] }]
    : [];

  const slideList = [
    { kind: "hook", label: "Tilbud", title: page.headline, body: page.sub },
    ...points,
    ...faq,
    {
      kind: "cta",
      label: "Neste steg",
      title: page.cta,
      body: "Lenke i bio. Derfra kommer du rett til tilbudet.",
    },
  ];

  const brandTag = "#" + String(page.brand).toLowerCase().replace(/[^a-z0-9æøå]+/g, "");
  const hashtags = [...new Set([brandTag, "#tilbud", "#anbefaling"])].filter((t) => t.length > 1);

  const caption = [
    page.headline,
    String(page.sub || "").slice(0, 220),
    "",
    `${page.cta} → lenke i bio.`,
  ].join("\n");

  return { product: page.product, slides: slideList, caption, hashtags };
}

function renderSlide(s, index, total, domain) {
  const { w, h } = SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);

  // Header: mark, name, page counter
  roundRect(ctx, 96, 90, 64, 64, 16);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 40px ${FONT_HEAD}`;
  ctx.fillText("N", 128, 124);

  ctx.textAlign = "left";
  ctx.font = `500 44px ${FONT_HEAD}`;
  ctx.fillText("Nyvariant", 184, 122);

  ctx.textAlign = "right";
  ctx.font = `600 34px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(
    `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    w - 96,
    122
  );

  // Card
  roundRect(ctx, 96, 200, w - 192, 920, 48);
  ctx.fillStyle = PALETTE.card;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.line;
  ctx.stroke();

  // Label pill
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `600 30px ${FONT_BODY}`;
  const label = s.label.toUpperCase();
  const labelW = ctx.measureText(label).width + 44;
  roundRect(ctx, 152, 252, labelW, 56, 28);
  ctx.fillStyle = PALETTE.yellow;
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(label, 174, 281);

  // Red accent bar
  roundRect(ctx, 152, 340, 96, 10, 5);
  ctx.fillStyle = PALETTE.red;
  ctx.fill();

  // Title
  ctx.textBaseline = "top";
  const textX = 152;
  const textW = w - 304;
  const titleTop = 390;
  const titleBox = { maxWidth: textW, maxHeight: 440, sizes: [96, 88, 80, 72, 64, 56, 48], lineRatio: 1.08 };
  const title = fitText(ctx, s.title, { family: FONT_HEAD, weight: 600, ...titleBox });
  ctx.fillStyle = PALETTE.ink;
  drawLines(ctx, title, textX, titleTop, titleBox.lineRatio);

  // Body
  const bodyTop = titleTop + title.height + 48;
  const bodyBox = {
    maxWidth: textW,
    maxHeight: Math.max(120, 1060 - bodyTop),
    sizes: [44, 40, 36, 32],
    lineRatio: 1.4,
  };
  const body = fitText(ctx, s.body, { family: FONT_BODY, weight: 400, ...bodyBox });
  ctx.fillStyle = PALETTE.muted;
  drawLines(ctx, body, textX, bodyTop, bodyBox.lineRatio);

  // Footer
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `600 34px ${FONT_BODY}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(String(domain).replace(/^www\./, ""), 96, 1230);

  return canvas;
}

function fitText(ctx, text, { family, weight, maxWidth, maxHeight, sizes, lineRatio }) {
  let chosen = null;

  for (const size of sizes) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length * size * lineRatio <= maxHeight) {
      chosen = { size, lines };
      break;
    }
  }

  if (!chosen) {
    const size = sizes[sizes.length - 1];
    ctx.font = `${weight} ${size}px ${family}`;
    const maxLines = Math.max(1, Math.floor(maxHeight / (size * lineRatio)));
    let lines = wrapLines(ctx, text, maxWidth);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S+$/, "") + "…";
    }
    chosen = { size, lines };
  }

  ctx.font = `${weight} ${chosen.size}px ${family}`;
  return {
    size: chosen.size,
    lines: chosen.lines,
    height: chosen.lines.length * chosen.size * lineRatio,
  };
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(ctx, block, x, y, lineRatio) {
  block.lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * block.size * lineRatio);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
