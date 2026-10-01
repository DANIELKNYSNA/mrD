<script lang="ts">
  import type { SearchResultItem } from '@/interfaces/SearchInterfaces'
  import { AVAILABILITY_LABELS, formatDelivery, formatPrice } from '@/utils/format'

  let { item }: { item: SearchResultItem } = $props()

  const outOfStock = $derived(item.offer?.availability === 'out_of_stock')

  const badge = {
    in_stock: 'bg-green-100 text-green-800',
    low_stock: 'bg-amber-100 text-amber-800',
    out_of_stock: 'bg-gray-200 text-gray-600',
  } as const
</script>

<article class="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 {outOfStock ? 'opacity-60' : ''}">
  <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{item.category}</p>
  <h2 class="mt-1 font-semibold text-gray-900">{item.name}</h2>
  <p class="mt-1 flex-1 text-sm text-gray-600">{item.description}</p>

  <div class="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-gray-100 pt-3">
    {#if item.offer}
      <div>
        <p class="text-lg font-semibold text-gray-900">{formatPrice(item.offer.price, item.offer.currency)}</p>
        <p class="text-xs text-gray-500">Delivery {formatDelivery(item.offer.deliveryEstimateMinutes)}</p>
      </div>
      <span class="rounded-full px-2 py-0.5 text-xs font-medium {badge[item.offer.availability]}">
        {AVAILABILITY_LABELS[item.offer.availability]}
      </span>
    {:else}
      <p class="text-sm text-gray-500">
        Price unavailable
        <span class="block text-xs text-gray-400">
          {item.enrichment === 'timeout' ? 'Pricing took too long' : "Couldn't load live pricing"}
        </span>
      </p>
    {/if}
  </div>
</article>
