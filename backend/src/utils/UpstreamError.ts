export type UpstreamErrorReason = 'unavailable' | 'not_found';

/** Raised by the upstream provider. Callers degrade gracefully rather than failing the whole search. */
export class UpstreamError extends Error {
  constructor(
    public readonly reason: UpstreamErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
