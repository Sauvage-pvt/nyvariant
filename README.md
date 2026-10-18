# Nyvariant

Samme lenke. Ny variant.

Lim inn en tilbudslenke. Nyvariant leser destinasjonen og bygger en forside rundt den. Kjøpknappen peker fortsatt på original-URL-en.

## Prøv lokalt

Åpne `index.html` i nettleseren, eller kjør:

```bash
python3 -m http.server 8080
```

Gå til [http://localhost:8080](http://localhost:8080).

## Filer

- `index.html` — verktøyet
- `app.js` — UI-logikk for forsiden
- `engine.js` — henter metadata og skriver varianten (delt med karusellen)
- `carousel.html` / `carousel.js` — karusellsiden `/k/<slug>`, PNG-slides i 1080×1350
- `kunde.html` / `kunde.js` — ny forside for en lokal bedrift: meta-beskrivelse, canonical, schema.org, FAQ, llms.txt, anmeldelseslenke, chat og bookinglenke (punktene fra dahl-ai-synlighet-test)
- `styles.css` — UI
- `src/worker.js` — Cloudflare Worker: statiske filer, `POST /api/carousel`, `GET /api/carousel/:slug`
- `wrangler.toml` — Worker-konfig og KV-binding `CAROUSELS`

## Cloudflare

Verktøyet kjører som en Worker med statiske filer fra repoet.

Første gang:

```bash
npx wrangler kv namespace create CAROUSELS   # lim inn id-en i wrangler.toml
npx wrangler deploy
```

Deploy skjer automatisk ved push til `main` via `.github/workflows/deploy.yml`.
Krever repo-secrets `CLOUDFLARE_API_TOKEN` og `CLOUDFLARE_ACCOUNT_ID`.

Lagres bare lenken. Karusellen bygges i nettleseren med samme motor som forsiden.

## Hva det ikke er

Ikke et hostingselskap, ikke et trafikkverktøy, og ikke en «passiv inntekt»-maskin. Bare en ny variant av lenka.
