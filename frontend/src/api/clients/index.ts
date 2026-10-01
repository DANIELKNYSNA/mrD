import ApiClient, { type IApiClient } from '@/api/clients/ApiClient'
import ServiceHealthClient from '@/api/clients/service-health/ServiceHealthClient'
import ServiceSearchClient from '@/api/clients/service-search/ServiceSearchClient'

export interface ApiClients {
  generic: IApiClient
  serviceHealth: ServiceHealthClient
  serviceSearch: ServiceSearchClient
}

export const apiClients: ApiClients = {
  generic: new ApiClient(),
  serviceHealth: new ServiceHealthClient(),
  serviceSearch: new ServiceSearchClient(),
}
