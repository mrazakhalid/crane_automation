import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Request-validation middleware factory.
 *
 * Purpose: Validate and sanitize `body`, `query`, and `params` at the HTTP
 *   boundary using Zod schemas before the request reaches a controller/service.
 * Args: schemas — optional Zod schemas for `body`, `query`, and `params`.
 * Returns: Express middleware that replaces/merges each part with its parsed
 *   value, or forwards a `ZodError` to the error handler on failure.
 *
 * Note: In Express 5, `req.query` and `req.params` are getter-only — we mutate
 *   them in place via `Object.assign` rather than reassigning.
 */
export function validate(schemas: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      next(err);
    }
  };
}
