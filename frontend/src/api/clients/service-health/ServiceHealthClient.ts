import ApiClient from '@/api/clients/ApiClient'
import type { HealthResponse } from '@/interfaces/HealthInterfaces'

export default class ServiceHealthClient extends ApiClient {
  serviceName = '/api/'

  getHealth(): Promise<HealthResponse> {
    return this.get('health')
  }
}
