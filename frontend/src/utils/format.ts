import type { Availability } from '@/interfaces/SearchInterfaces'

export const formatPrice = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)

export const formatDelivery = (minutes: number): string => `~${minutes} min`

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}
