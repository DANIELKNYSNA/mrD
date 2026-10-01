# Solution

This document covers the design of the Mr D search and discovery mini app, the trade-offs behind it, and where AI assistance was used. How to run it and the API reference are in the [README](./README.md).

## Overview

```
Browser (Svelte)                         Express API
────────────────                         ───────────────────────────────────────────────
SearchControls ─┐                        GET /api/search
                ├─ searchStore ── fetch ──► parseSearchQuery   validate + normalise
SearchStatus  ◄─┤   (debounce,           │  findItems          match + rank the catalog
ResultsList   ◄─┘    abort, dedupe)      │  enrichItems        price each result in parallel,
                                         │    └─ upstreamProvider   per-item timeout
                                         │  sortResults        relevance / popularity / price
                                         └► { items, partial, tookMs }
```

The core idea is that **the catalog is ours and reliable, and live pricing is someone else's and isn't**. Search always succeeds as long as the catalog does. A slow or failing upstream makes individual results less complete; it never makes the search fail.

## Backend

### Structure

The backend uses a conventional layered layout: `routes → controllers → services → models_actions → models`, with `interfaces`, `types`, `utils` and `middleware` alongside.

- **Controllers** only handle HTTP: parse the request, call a service, send the response.
- **Services** orchestrate the work: search, enrichment and the simulated provider.
- **`models_actions`** contains the catalog query and ranking logic.
- **Models** load the JSON data once at startup and expose it as read-only.

`createApp()` builds the app without starting a server, so Supertest can exercise the real middleware stack.

For an app this size the layering is more than strictly needed. I kept it because it makes every piece easy to find and to test on its own, and because it matches how a larger service would be organised.

### Data model

There are two JSON files, deliberately kept separate to simulate the difference in ownership:

- **`catalog.json`** holds 36 items in 8 categories: id, name, category, description, tags and popularity. This is our own data.
- **`priceList.json`** holds the price and prep time for each item, and only the upstream provider reads it. It stands in for data held by another system.

Keeping price out of the catalog means the API can't quietly fall back to a stale price when the upstream fails. Prices only come from the upstream. A test checks that every catalog item has a price-list entry, so the two files can't drift apart.

### Simulated upstream provider

`UpstreamProvider.getOffer(itemId)` behaves like a remote call:

- **Normal calls** take 80–600 ms.
- **Slow outliers:** 10% of calls take around 2.5 s, varied by ±20% so they don't all arrive at once.
- **Failures:** 10% of calls fail.
- **Offer data:** availability and the delivery estimate are randomised on every call, since they're meant to be "live".

Every rate and delay can be changed through environment variables, which makes the degraded UI states easy to demonstrate. The random-number source can also be passed in, so tests are fully predictable.

**The provider deliberately has no timeout.** How long to wait is a decision for the caller, not the dependency. Real upstreams don't time themselves out for you either.

**Trade-off: one call per item instead of one batch call.** Pricing each item separately means one slow or failing item costs only that item, which suits a flaky dependency. The cost is N calls per search. With at most 36 items that's fine. With a real upstream I'd want a batch endpoint, accepting that a failure then affects everything in the batch.

### Enrichment, timeouts and partial results

`enrichItems` prices every result in parallel, each call wrapped in `withTimeout` (default 1000 ms, set by `UPSTREAM_TIMEOUT_MS`), and collects the outcomes with `Promise.allSettled`:

- **On time:** the item gets an `offer` and `enrichment: "ok"`.
- **Too slow:** `offer: null` and `enrichment: "timeout"`.
- **Failed:** `offer: null` and `enrichment: "error"`.

The response's `partial` flag is set if any item isn't `ok`.

How this plays out:

- **Speed is capped.** A search can never take much longer than the timeout, however slow the upstream gets. I checked this against the running server: searches with slow calls in the mix returned in about 1000 ms.
- **Partial results are a normal 200 response, not an error status.** Every item still comes back, and the UI can show exactly which ones are missing a price and why. Separating `timeout` from `error` lets the UI say "pricing took too long" rather than a generic failure.
- **Timed-out calls aren't cancelled.** The late answer is simply ignored. With the in-process simulation there's nothing to cancel. With a real HTTP upstream I'd pass an `AbortSignal` through, so abandoned requests stop using connections.
- **The cost:** at the default 10% failure rate plus slow calls, a search that returns many items will nearly always be missing a few prices. That's realistic, and it's why a short-lived price cache is the most valuable stretch goal.

### Search and ranking

The catalog is small, so search is a linear scan over a version prepared once at startup, with no external search library. Each search word is scored against the field it matches best:

| Field       | Weight | | Match type              | Strength |
| ----------- | ------ |-| ----------------------- | -------- |
| name        | 10     | | whole word              | 1.0      |
| category    | 6      | | start of a word         | 0.8      |
| tags        | 4      | | inside a word (3+ letters) | 0.5   |
| description | 2      | |                         |          |

An item's score is the sum of its per-word scores. Other behaviour:

- **Every word must match** something in the item, so `vegan burger` returns vegan burgers rather than everything vegan plus every burger.
- **Case, accents and simple plurals are ignored.** `Sautéed`, `PIZZAS` and `eggs` all match.
- **Partial words match the start of a word** (`marg` finds Margherita), so search as you type feels right.
- **Matches inside a word need at least 3 letters**, so a single `a` doesn't match everything.

**Trade-off:** this is hand-rolled and simple, which makes it easy to explain and test, and it's plenty for 36 items. It has no typo tolerance and only crude plural handling. For a real catalog I'd use a proper search engine like Elasticsearch or at least a library like MiniSearch. That would add typo tolerance and better word-stemming, and it would scale past a linear scan.

### Sorting

Sorting happens **after** enrichment, because price isn't known until then.

- **Relevance breaks ties.** The catalog search returns results in relevance order, enrichment keeps that order, and the final sort keeps the existing order for equal values. So within the popularity and price sorts, ties fall back to relevance without any extra logic.
- **Unpriced items go last for `sort=price`** in both directions. Treating them as zero would put them first in an ascending sort, which would be misleading.
- **`order` is ignored for `relevance`.** Least relevant first isn't useful.
- **Each sort has a sensible default order:** cheapest first for price, highest first for everything else.

### API design

- **Search is a `GET` with query parameters** rather than a `POST` body. That makes it cacheable and linkable, and it makes URL-synced state on the client straightforward.
- **Input is validated at the edge.** `parseSearchQuery` turns the raw query string into a typed `ISearchQuery`. Invalid values return a 400 that lists the allowed values. Repeated parameters (`?q=a&q=b`) are treated as missing instead of crashing.
- **Every error has the same shape:** `{ error: { code, message, details? } }`, so the client handles errors in one place. Unexpected errors are logged on the server and returned as a generic 500, so internal details never reach the client. A test checks this.
- **No try/catch in the controllers.** Express 5 sends errors from async handlers straight to the error middleware.
- **`tookMs` in the response,** together with the request-timing log middleware, gives basic visibility into performance.

## Frontend

### Svelte, without SvelteKit

The frontend is Svelte 5 with Vite and TypeScript. I chose plain Svelte over SvelteKit because this is a single page with no routing, server rendering or form actions, so SvelteKit would add complexity without benefit. In development, Vite forwards `/api` to the Express server, so the client uses same-origin URLs and needs no CORS setup.

### API layer

`ApiClient` follows a pattern I use in Vue projects:

- **One base class** implementing `IApiClient` (get, post, put, delete).
- **One client per service** extending it and setting `serviceName` (`ServiceSearchClient`, `ServiceHealthClient`).
- **A single `apiClients` object** that collects them.

I used `fetch` instead of Axios. It's built in, supports `AbortSignal` directly, and this app needs nothing Axios adds. Every non-2xx response throws a typed `ApiError` carrying the server's error code, rather than returning `null`. That lets the UI tell "no data" apart from "something failed".

### State: the search store

`searchStore` is a Svelte store with actions, the Svelte equivalent of a Pinia store. It owns the whole request lifecycle and guarantees that **only the latest search can update the screen**:

- **Cancellation:** each new search aborts the previous request, so a slow old response can never overwrite a newer one.
- **No repeats:** a search identical to the current one (ignoring case and surrounding spaces) isn't sent again. Pressing Search or Enter always sends it, so a customer can refresh prices on purpose.
- **Client-side time limit:** the request gives up after 8 s. The server already caps a search at about 1 s, so this only matters if the server itself is stuck.
- **Friendly errors:** failures become messages a customer can act on. A 502, 503 or 504 reads "The search service is unavailable right now", not a raw status code.

Typing searches after a 250 ms pause, so typing "chicken" sends one request rather than seven.

The categories list has its own small store, which can be loaded again. "Try again" reloads both the search and the categories. Without that, if the API was down when the page loaded, the category filter stayed disabled until a manual reload. I found that while testing the failure path in the browser.

**What's stored where.** Each piece of client data is kept in the place that suits it:

| Data | Where | Why |
|---|---|---|
| Sort choice, recent searches | localStorage, via `svelte-persisted-store` | Personal data that should outlast the session |
| Current query, category and sort | The URL | Shareable. Keeping a second copy in localStorage could disagree with it |
| Categories | In memory, plus a 5-minute HTTP cache | Small and static; the browser's cache does this better than custom code |
| Suggestions | In memory for the session, plus a 60-second HTTP cache | Only useful while typing |
| Search results and prices | Not stored on the client | Meant to be live; the server's 30-second price cache handles reuse |

Values read back from localStorage are checked field by field, because they may come from an older version of the app or have been edited by hand. Anything unrecognised falls back to the default.

**Recent searches** (the last 5) appear when the search box is focused and empty, in the same dropdown and with the same keyboard support as suggestions. A search is only remembered when it was deliberate (Enter, the Search button, or choosing a suggestion) and found results. Recording every search as you type would fill the list with fragments like "chi" and "chic", and recording dead ends like "xyzzy" isn't useful.

**No results with a category selected.** I considered clearing the search box automatically when the category changes to one that doesn't contain the query (for example "coca-cola", then switching to Chicken). I decided against it:
- **It's destructive:** it throws away what the user typed, in reaction to a different control.
- **The intent is unclear:** switching category could mean "show me Chicken instead" or "is this available in Chicken?"
- **It costs a request:** it would need an extra call just to check.

Instead, the empty state names the problem ("No results for 'coca-cola' in Chicken") and offers **Search all categories** and **Clear search** buttons. Both ways out are one click, and nothing is lost.

### Loading, error and partial states

| Situation                 | What the user sees                                                        |
| ------------------------- | ------------------------------------------------------------------------- |
| First load                | Placeholder cards, plus a spinner and "Getting delicious results…"         |
| New search while results are showing | Previous results stay visible, dimmed, with the same spinner and message |
| Some items unpriced       | Amber notice ("Live prices couldn't be loaded for N items") with **Refresh prices**; each affected card says why |
| No matches                | "No results for … in …" with **Search all categories** / **Clear search** |
| API down or erroring      | Red panel with a customer-facing message and **Try again**                |
| Categories failed         | Category filter disabled with a short note; recovers on retry             |

Keeping the old results on screen while new ones load is what stops the page flickering during slow responses. The status area is announced to screen readers without moving focus, and form controls have proper labels.

### Styling

Styling is minimal, as the brief asks. I used Tailwind (v4, via the Vite plugin, no config file) because it keeps the small amount of styling right next to the markup, without separate CSS files to maintain, and it only ships the CSS that's actually used: about 3.8 kB gzipped.

## Testing

The backend has 52 tests using Vitest and Supertest, with about 98% statement coverage (`npm run test:coverage -w backend`):

| Area | Covered |
|---|---|
| Search ranking | each field, case, accents and plurals, partial words, every-word-must-match, ranking order, short words, no results, category filter |
| Sorting | each sort, ties broken by relevance, unpriced items last, input not changed |
| Enrichment | ok / timeout / error per item, order kept, waits no longer than the timeout, all-failed still returns every item |
| Upstream provider | success, failure, unknown item, slow outliers, observed failure rate |
| HTTP | endpoints, validation errors, 404s, categories, filter and sort end to end |
| Error handling | `AppError` mapping, generic 500 with no leaked details, values that aren't `Error`s |
| Data | catalog size, unique ids, every item has a price |
| Stretch goals | cache expiry and eviction, failures never cached, serving from cache during an outage, metrics counts, suggestions (limit, category filter, cache header) |

Two things keep the tests predictable without mocking:

- **A fake provider can be passed in.** The provider implements `IOfferProvider`, so the enrichment tests use a fake that hangs on some items and fails on others.
- **The real provider is made reliable during tests.** `vitest.config.ts` sets zero delay and no failures, so the HTTP tests are fast and stable. Tests that need flaky behaviour set it up themselves.

**There are no frontend tests.** The brief asks for server-side tests, and that's where the logic lives. If I added frontend tests, I'd start with the search store's cancellation and repeat-skipping logic, which is the subtlest part of the client.

## Trade-offs and known limitations

- **The request and response types are written twice,** once in `backend/src/interfaces` and once in `frontend/src/interfaces/SearchInterfaces.ts`. A small `shared/` workspace would remove the risk of them drifting apart. I held off to keep the setup simple, and the backend's API tests would catch most drift.
- **Searching doesn't cancel work on the server.** When the browser abandons a search, the server still finishes enriching it. That's cheap here. With a real upstream I'd watch for the request closing on the server and stop enriching.
- **Simple search,** as described above: no typo tolerance, crude plurals, a linear scan.
- **No resilience patterns for the upstream** beyond timeouts and the cache. With a real dependency I'd add a circuit breaker, so that when it's clearly down we stop calling it and fail fast.
- **Prices aren't timestamped.** Cached offers can be up to 30 s old, and the response doesn't say so. Adding a `fetchedAt` to each offer would let the UI label older prices.
- **Simultaneous requests aren't merged.** Two searches arriving together that need the same uncached item each call the upstream. Sharing one in-flight call per item would fix that.

## Stretch goals

All four are implemented.

### Small server-side cache

A `TtlCache` keeps successful offers per item for 30 s (`OFFER_CACHE_TTL_MS`). It has a size cap and evicts the oldest entry when full.

- **Only successes are cached.** Failures and timeouts are retried on the next search, so a bad moment upstream doesn't stick.
- **Cached items return instantly,** and they still have a price if the upstream fails in the meantime. This makes "Refresh prices" useful: each refresh only goes upstream for the items still missing a price, so results fill in over a few tries instead of re-rolling every item.
- **Trade-off:** price and availability can be up to 30 s old. That's acceptable for browsing. A checkout flow would need a fresh check.
- **Cached by item, not by query.** Different searches that return the same item share its cached price, which gives a much better hit rate than caching whole responses.
- **Turned off in tests** (`OFFER_CACHE_TTL_MS=0`). When disabled, the cache is `null` rather than a cache with zero lifetime, so metrics don't count phantom misses. Cache tests pass in their own instance.

### Lightweight instrumentation

`GET /api/metrics` reports in-process counters:

- requests by status code
- search count, average and maximum `tookMs`
- upstream outcomes (ok, timeout, error) and success rate
- cache hits, misses and hit rate

Cache hits aren't counted as upstream calls, so the success rate describes the dependency itself. Separately, the request-logging middleware writes a timing line per request.

**Trade-off:** the counters live in memory, reset on restart and cover a single process. That's enough to watch the app during a demo or local debugging. In production I'd export them to Prometheus or OpenTelemetry and use histograms instead of an average and a maximum.

### URL-synced state

- **The URL tracks the search.** Query, category and sort are written to it after the same 250 ms pause as the search itself, using `history.replaceState`. Refining a search doesn't fill the back button with every keystroke. The cost is that Back doesn't step through earlier searches.
- **Reading a link:** on load, values from the URL take priority over the saved sort preference. An invalid `sort` is ignored, and a category is matched case-insensitively against the real list, so `?category=pizza` works and an unknown category falls back to "All categories".

### Typeahead suggestions

`GET /api/suggestions` returns the top 5 matches by name, using the same ranking as search, with no price lookup, so it's fast. It also respects the category filter.

**Avoiding unnecessary requests**, as the brief asks:
- **Waiting for a pause:** suggestions wait for a 150 ms pause in typing and need at least 2 characters.
- **Cancelling:** each new request cancels the one before it.
- **Remembering answers:** the component keeps every answer for the session, so backspacing to an earlier prefix costs nothing.
- **Browser caching:** the response carries `Cache-Control: public, max-age=60`.
- **Only while typing:** suggestions aren't fetched when the page loads from a shared link, or when choosing a suggestion changes the input.

The input follows the ARIA combobox pattern, so screen readers announce the highlighted suggestion while focus stays in the input. ↑ and ↓ move through the list, Enter chooses, and Esc closes it. When the list is open, Esc only closes it; normally Chrome's Esc also clears a search field, which would wipe the query. Pressing Enter to submit also closes the list, so it doesn't sit on top of the results. Clicking an option uses `mousedown` with `preventDefault`, so the input's blur doesn't close the list before the click registers.

**Trade-off:** search already runs as you type, so a pause in typing can send both a suggestions request and a search request. Suggestions are cheap and cached, so I accepted that. A product decision might be to show suggestions only and search on Enter.

## AI assistance

I built this with Claude Code (Anthropic's AI coding assistant) as a pair programmer, working step by step in one session.

- **My decisions:**
  - The tech stack: Express and Svelte with TypeScript, Vite, and Tailwind.
  - The backend folder structure: controllers, models, models_actions and so on.
  - The `ApiClient` / service-client pattern, carried over from my Vue projects.
  - Using a persisted store for local cache.
  - The order of the work: catalog and provider, then enrichment, ranking and sorting, tests, docs, and finally the UI.
- **Generated by the AI, then reviewed and steered by me:** boiler plate code, the catalog data, the tests, and first drafts of the README and this document. That includes:
  - The scoring scheme, and the decision to sort after enrichment.
  - The timeout and partial-result approach.
  - The search store's cancellation and repeat-skipping logic.
- **Stretch goals:** the same split. The four goals and their order were my call; the AI helped implemented them, and they were then tested in the browser.
- **How it was checked:**
  - **Automated checks:** the test suite plus strict type checks on both sides.
  - **Running server:** the example responses in the README are real output, and the ~1 s cap was measured.
  - **Browser:** every UI state was tested in a real browser against a deliberately flaky upstream. Testing that way exposed two issues that are now fixed: an unhelpful "status 502" error message, and a category filter that never recovered from a failed load.
