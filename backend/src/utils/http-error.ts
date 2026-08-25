/**
 * Typed HTTP error carrying a status code.
 *
 * Purpose: Let services throw domain errors with a specific, actionable message
 *   and status; the central error handler reads `.status` to shape the response.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** 400 Bad Request. */
export const badRequest = (m: string): HttpError => new HttpError(400, m);
/** 401 Unauthorized. */
export const unauthorized = (m: string): HttpError => new HttpError(401, m);
/** 403 Forbidden. */
export const forbidden = (m: string): HttpError => new HttpError(403, m);
/** 404 Not Found. */
export const notFoundError = (m: string): HttpError => new HttpError(404, m);
/** 409 Conflict. */
export const conflict = (m: string): HttpError => new HttpError(409, m);
