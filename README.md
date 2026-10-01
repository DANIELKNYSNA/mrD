# Mr D Search mini full stack app

A small full-stack search app: free-text search over a local catalog, with live price, availability and delivery estimates from a simulated (slow, flaky) upstream provider.

Monorepo (npm workspaces):

- `backend/` — Node.js, Express 5, TypeScript (strict). Tests with Vitest + Supertest.
- `frontend/` — Svelte 5, Vite, TypeScript, Tailwind CSS.

Design decisions and trade-offs are in [SOLUTION.md](./SOLUTION.md).

## Requirements

Node.js 18+ (LTS).

## Getting started

```bash
npm install
npm run dev        # API on http://localhost:3000, UI on http://localhost:5173
```

In development the Vite server proxies `/api` to the API, so open http://localhost:5173.

| Script                            | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | Runs API (tsx watch) and UI (Vite) together                  |
| `npm run build`                   | Compiles the API to `backend/dist` and UI to `frontend/dist` |
| `npm start`                       | Runs the compiled API                                        |
| `npm test`                        | Runs the backend test suite                                  |
| `npm run test:coverage -w backend`| Runs the tests with a coverage report                        |
| `npm run check`                   | Type-checks both workspaces                                  |

## Configuration

All settings are optional environment variables for the API. Defaults are shown; see `backend/.env.example`.

| Variable                   | Default                 | Description                                                      |
| -------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `PORT`                     | `3000`                  | API port                                                         |
| `CORS_ORIGIN`              | `http://localhost:5173` | Allowed browser origin                                           |
| `UPSTREAM_MIN_LATENCY_MS`  | `80`                    | Fastest normal upstream response                                 |
| `UPSTREAM_MAX_LATENCY_MS`  | `600`                   | Slowest normal upstream response                                 |
| `UPSTREAM_SLOW_RATE`       | `0.1`                   | Chance (0–1) a call is a slow outlier                            |
| `UPSTREAM_SLOW_LATENCY_MS` | `2500`                  | Approximate latency of slow outliers (±20%)                      |
| `UPSTREAM_FAILURE_RATE`    | `0.1`                   | Chance (0–1) a call fails                                        |
| `UPSTREAM_TIMEOUT_MS`      | `1000`                  | How long search waits for each item's offer before giving up     |
| `OFFER_CACHE_TTL_MS`       | `30000`                 | How long a successful offer is reused (`0` disables the cache)    |

To see the UI's degraded states, make the upstream worse:

```bash
UPSTREAM_FAILURE_RATE=0.5 UPSTREAM_SLOW_RATE=0.3 npm run dev
```

Set `OFFER_CACHE_TTL_MS=0` as well if you want every search to hit the flaky upstream.

The frontend reads `VITE_API_BASE_URL` (see `frontend/.env.example`). Leave it empty in development to use the proxy.

## API

Base path: `/api`. All responses are JSON.

### `GET /api/search`

Searches the catalog, enriches each result with a live offer from the upstream provider, then sorts.

| Param      | Type                                    | Default                                  | Description                                             |
| ---------- | --------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `q`        | string                                  | `""`                                     | Free text. Empty returns the whole catalog.             |
| `category` | string                                  | —                                        | Exact category, case-insensitive (see `/api/categories`) |
| `sort`     | `relevance` \| `popularity` \| `price`  | `relevance`                              | Sort field                                              |
| `order`    | `asc` \| `desc`                         | `asc` for `price`, otherwise `desc`      | Sort direction. Ignored for `relevance`.                 |

**Search behaviour**

- Matches across name, category, tags and description, weighted in that order.
- Every word in `q` must match something (`vegan burger` → only vegan burgers).
- Case-, accent- and plural-insensitive; word prefixes match (`marg` → Margherita).
- `relevance` ranks by match score, then popularity.
- With `sort=price`, items without a price always come last, whichever the order.

**Enrichment**

Each result is priced in parallel, with a per-item timeout (`UPSTREAM_TIMEOUT_MS`). A slow or failing upstream never fails the search; the affected items come back with `offer: null`:

| `enrichment` | Meaning                                    | `offer`  |
| ------------ | ------------------------------------------ | -------- |
| `ok`         | Upstream responded in time                 | object   |
| `timeout`    | Upstream didn't respond within the timeout | `null`   |
| `error`      | Upstream failed                            | `null`   |

`partial` is `true` when any item isn't `ok`. `tookMs` is server-side time for the whole search, which is capped at roughly the timeout.

**Example**

```bash
curl "http://localhost:3000/api/search?q=burger&sort=price"
```

```jsonc
// 200 OK — 2 of 5 items omitted for brevity
{
  "query": { "q": "burger", "sort": "price", "order": "asc" },
  "total": 5,
  "items": [
    {
      "id": "itm-007",
      "name": "Crispy Chicken Burger",
      "category": "Burgers",
      "description": "Buttermilk-fried chicken breast with slaw and mayo.",
      "tags": ["chicken"],
      "popularity": 83,
      "offer": {
        "itemId": "itm-007",
        "price": 89.9,
        "currency": "ZAR",
        "availability": "low_stock",
        "deliveryEstimateMinutes": 34
      },
      "enrichment": "ok"
    },
    {
      "id": "itm-006",
      "name": "Double Cheeseburger",
      "category": "Burgers",
      "description": "Two beef patties, cheddar, pickles and house sauce.",
      "tags": ["beef"],
      "popularity": 88,
      "offer": {
        "itemId": "itm-006",
        "price": 99.9,
        "currency": "ZAR",
        "availability": "in_stock",
        "deliveryEstimateMinutes": 46
      },
      "enrichment": "ok"
    },
    // …
    {
      "id": "itm-009",
      "name": "Plant-Based Burger",
      "category": "Burgers",
      "description": "Plant patty, vegan cheese, lettuce and tomato.",
      "tags": ["vegan", "vegetarian"],
      "popularity": 58,
      "offer": null,
      "enrichment": "error"
    }
  ],
  "partial": true,
  "tookMs": 533
}
```

`availability` is one of `in_stock`, `low_stock` or `out_of_stock`. `deliveryEstimateMinutes` is prep time plus travel.

**Caching:** successful offers are cached per item for `OFFER_CACHE_TTL_MS` (30 s by default). Cached items return instantly, and they still have a price if the upstream fails in the meantime. Failures and timeouts are never cached, so they're retried on the next search. The trade-off is that price and availability can be up to 30 s old.

### `GET /api/suggestions`

Typeahead suggestions: the top 5 matches by name, with no price lookup, so it's fast. It takes the same `q` and `category` as `/api/search`, and uses the same ranking. The response sets `Cache-Control: public, max-age=60`, so the browser reuses it.

```bash
curl "http://localhost:3000/api/suggestions?q=chick&category=Burgers"
```

```json
{ "suggestions": [{ "id": "itm-007", "name": "Crispy Chicken Burger", "category": "Burgers" }] }
```

### `GET /api/categories`

Distinct catalog categories, sorted. Used to populate the category filter. The response sets `Cache-Control: public, max-age=300`, so the browser reuses it.

```bash
curl http://localhost:3000/api/categories
```

```json
{
  "categories": ["Beverages", "Burgers", "Chicken", "Desserts", "Groceries", "Healthy", "Pizza", "Sushi"]
}
```

### `GET /api/health`

```json
{ "status": "ok", "uptimeSeconds": 42 }
```

### `GET /api/metrics`

In-process counters since the server started (they reset on restart). View them with:

```bash
curl -s http://localhost:3000/api/metrics   # or open it in a browser
```

```json
{
  "startedAt": "2026-10-01T10:40:17.043Z",
  "requests": { "total": 8, "byStatus": { "200": 7, "304": 1 } },
  "search": { "count": 6, "avgMs": 574, "maxMs": 1007 },
  "upstream": { "calls": 16, "ok": 8, "timeout": 4, "error": 4, "successRate": 0.5 },
  "offerCache": { "hits": 6, "misses": 16, "hitRate": 0.273 }
}
```

- **`upstream`** counts real calls to the provider; cache hits aren't included.
- **`search` timings** are the server-side `tookMs` values.
- **Console log:** the API also writes one timing line per request, for example `GET /api/search?q=pizza 200 512.3ms`.

### Errors

Every error uses the same envelope, so the client can handle them uniformly:

```json
{ "error": { "code": "BAD_REQUEST", "message": "Invalid sort \"banana\"", "details": { "allowed": ["relevance", "popularity", "price"] } } }
```

| Status | `code`           | When                                                                 |
| ------ | ---------------- | -------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`    | Invalid `sort` or `order`; `details.allowed` lists valid values       |
| 404    | `NOT_FOUND`      | Unknown route                                                        |
| 500    | `INTERNAL_ERROR` | Unexpected server error (details are logged, never sent to the client) |

Upstream failures are **not** errors at this level; they're reported per item via `enrichment`.

## UI notes

- **Shareable URLs:** the search is reflected in the URL, so a link restores it. For example, `http://localhost:5173/?q=chicken&category=Burgers&sort=price-asc`.
  - **Sort values:** `relevance`, `popularity`, `price-asc`, `price-desc`.
  - **Default sort:** with no `sort` in the URL, the last sort you chose (saved in localStorage) is used.
- **Typeahead:** suggestions appear after 2 or more characters, limited to the selected category. Use ↑ and ↓ to move through them, Enter to choose one, and Esc to close the list.
- **Recent searches:** focus the empty search box to see your last 5 searches. A search is remembered when you submit it with Enter or the Search button, or choose a suggestion, and only if it found something. **Clear** empties the list.
- **No results:** the empty state offers **Search all categories** and **Clear search** buttons, so a mismatched query and category is one click away from results.
- **Local storage** (`mrd:search-preferences`) holds only the sort choice and recent searches. Everything else lives in the URL, in memory, or in the browser's HTTP cache.

## Project structure

```
backend/src/
  controllers/      HTTP handlers (parse request → call service → respond)
  interfaces/       Data shapes (catalog item, offer, search request/response)
  middleware/       Request logging, 404, error envelope
  models/           Catalog and upstream price list (JSON) + read-only accessors
  models_actions/   Catalog search and ranking
  routes/           Express routers
  services/         Search orchestration, enrichment, simulated upstream provider
  types/            Shared string-union types (sort fields, availability, …)
  utils/            Config, errors, timeout, sorting, query parsing
backend/tests/      Vitest + Supertest

frontend/src/
  api/clients/      ApiClient base class + one client per service
  interfaces/       Response types mirroring the API
  store/            Svelte stores (search state; persisted preferences)
  components/       UI components
```
