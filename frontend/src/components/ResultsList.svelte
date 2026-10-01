<script lang="ts">
  import ResultCard from '@/components/ResultCard.svelte'
  import type { SearchState } from '@/store/search'

  let { state }: { state: SearchState } = $props()

  const loading = $derived(state.status === 'loading' || state.status === 'idle')
</script>

{#if state.status !== 'error'}
  {#if state.response}
    <!-- Keep showing the previous results, dimmed, while the next search loads. -->
    <ul
      aria-busy={loading}
      class="grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 {loading ? 'opacity-50' : ''}"
    >
      {#each state.response.items as item (item.id)}
        <li><ResultCard {item} /></li>
      {/each}
    </ul>
  {:else if loading}
    <ul aria-hidden="true" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each { length: 6 }, i (i)}
        <li class="h-44 motion-safe:animate-pulse rounded-lg border border-gray-200 bg-gray-100"></li>
      {/each}
    </ul>
  {/if}
{/if}
