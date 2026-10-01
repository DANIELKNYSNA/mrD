<script lang="ts">
  import { untrack } from 'svelte'
  import { apiClients } from '@/api/clients'
  import type { Suggestion } from '@/interfaces/SearchInterfaces'
  import { clearRecentQueries, searchPreferences } from '@/store/searchPreferences'

  interface Props {
    value: string
    /** Current category filter; suggestions are limited to it. */
    category?: string
    class?: string
    /** Called after an option is chosen and `value` updated. */
    onselect: () => void
  }

  let { value = $bindable(), category = '', class: className = '', onselect }: Props = $props()

  /** Suggestions need a short pause and at least this many characters, to avoid needless requests. */
  const MIN_CHARS = 2
  const DEBOUNCE_MS = 150

  const listId = 'search-suggestions'

  interface Option {
    key: string
    label: string
    detail?: string
  }

  let suggestions = $state<Suggestion[]>([])
  /** Opened by typing or focusing; choosing an option (which sets `value`) doesn't reopen it. */
  let open = $state(false)
  let active = $state(-1)

  // Per-session cache: retyping or backspacing to an earlier prefix costs no request.
  const cache = new Map<string, Suggestion[]>()
  let inFlight: AbortController | null = null

  // Empty box: offer recent searches. Otherwise: offer server suggestions.
  const showingRecent = $derived(value.trim() === '')
  const options = $derived<Option[]>(
    showingRecent
      ? $searchPreferences.recentQueries.map((q) => ({ key: `recent:${q}`, label: q }))
      : suggestions.map((s) => ({ key: s.id, label: s.name, detail: s.category })),
  )
  const visible = $derived(open && options.length > 0)

  $effect(() => {
    const term = value.trim().toLowerCase()
    const filter = category
    active = -1

    // Only fetch while the user is typing: not on page load from a shared link,
    // and not when `value` changed because an option was chosen.
    // untrack: opening/closing the list shouldn't re-run this effect.
    if (term.length < MIN_CHARS || !untrack(() => open)) {
      inFlight?.abort()
      suggestions = []
      return
    }

    const key = `${filter}\u0000${term}`
    const cached = cache.get(key)
    if (cached) {
      suggestions = cached
      return
    }

    const timer = setTimeout(async () => {
      inFlight?.abort()
      const controller = new AbortController()
      inFlight = controller
      try {
        const response = await apiClients.serviceSearch.getSuggestions(term, filter || undefined, controller.signal)
        cache.set(key, response.suggestions)
        if (!controller.signal.aborted) suggestions = response.suggestions
      } catch {
        // Suggestions are a nicety; the main search reports real errors.
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  })

  function choose(option: Option) {
    value = option.label
    open = false
    onselect()
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // First Escape closes the list; only a second one gets the browser's
      // native "clear the search field" behaviour.
      if (visible) event.preventDefault()
      open = false
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return
      event.preventDefault()
      open = true
      const step = event.key === 'ArrowDown' ? 1 : -1
      // Wrap around, with -1 meaning "back in the text box".
      const count = options.length + 1
      active = ((active + 1 + step + count) % count) - 1
      return
    }
    if (event.key === 'Enter') {
      if (visible && active >= 0) {
        event.preventDefault()
        choose(options[active]!)
      }
      // Otherwise the form submits; either way the list has done its job.
      open = false
    }
  }
</script>

<div class="relative {className}">
  <label for="search-q" class="sr-only">Search</label>
  <input
    id="search-q"
    type="search"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={visible}
    aria-controls={listId}
    aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
    bind:value
    oninput={() => (open = true)}
    onfocus={() => (open = true)}
    onclick={() => (open = true)}
    onblur={() => (open = false)}
    {onkeydown}
    placeholder="Search for pizza, sushi, groceries…"
    autocomplete="off"
    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
  />

  {#if visible}
    <div class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
      {#if showingRecent}
        <div class="flex items-center justify-between px-3 pb-1 pt-1 text-xs text-gray-500">
          <span>Recent searches</span>
          <!-- mousedown + preventDefault keeps focus in the input so blur doesn't close the list first. -->
          <button
            type="button"
            class="font-medium text-red-700 hover:underline"
            onmousedown={(event) => {
              event.preventDefault()
              clearRecentQueries()
            }}
          >
            Clear
          </button>
        </div>
      {/if}
      <ul id={listId} role="listbox" aria-label={showingRecent ? 'Recent searches' : 'Suggestions'}>
        {#each options as option, i (option.key)}
          <li
            id="{listId}-{i}"
            role="option"
            aria-selected={i === active}
            onmousedown={(event) => {
              event.preventDefault()
              choose(option)
            }}
            onmouseenter={() => (active = i)}
            class="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm {i === active ? 'bg-red-50' : ''}"
          >
            <span class="text-gray-900">{option.label}</span>
            {#if option.detail}
              <span class="text-xs text-gray-500">{option.detail}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
