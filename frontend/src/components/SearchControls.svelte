<script lang="ts">
  import SearchBox from '@/components/SearchBox.svelte'
  import { categoriesStore } from '@/store/categories'
  import { SORT_OPTIONS, type SortOption } from '@/utils/sortOptions'

  interface Props {
    q: string
    category: string
    sort: SortOption
    onsubmit: () => void
  }

  let { q = $bindable(), category = $bindable(), sort = $bindable(), onsubmit }: Props = $props()

  const categories = $derived($categoriesStore.categories)
  const categoriesFailed = $derived($categoriesStore.failed)

  const field = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600'
</script>

<form
  role="search"
  class="flex flex-col gap-3 sm:flex-row sm:items-end"
  onsubmit={(event) => {
    event.preventDefault()
    onsubmit()
  }}
>
  <div class="flex flex-1 gap-2">
    <SearchBox bind:value={q} {category} onselect={onsubmit} class="flex-1" />
    <button type="submit" class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
      Search
    </button>
  </div>

  <label class="flex flex-col gap-1 text-xs font-medium text-gray-600">
    Category
    <select bind:value={category} class={field} disabled={categoriesFailed}>
      <option value="">All categories</option>
      {#each categories as name (name)}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </label>

  <label class="flex flex-col gap-1 text-xs font-medium text-gray-600">
    Sort by
    <select bind:value={sort} class={field}>
      {#each SORT_OPTIONS as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </label>
</form>

{#if categoriesFailed}
  <p class="mt-2 text-xs text-amber-700">Couldn't load categories, so filtering is unavailable right now.</p>
{/if}
