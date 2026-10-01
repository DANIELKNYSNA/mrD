export interface IApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
