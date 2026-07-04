import { ApiError } from '../utils/ApiError.js';

/**
 * Validate request parts against zod schemas.
 * Usage: validate({ body: schema, query: schema, params: schema })
 */
export const validate = (schemas = {}) => (req, _res, next) => {
  try {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) {
        const result = schemas[key].safeParse(req[key]);
        if (!result.success) {
          const details = result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          }));
          return next(ApiError.badRequest('Validation failed', details));
        }
        // Assign parsed/coerced values back (query/params are read-only getters
        // in some Express versions, so guard with try).
        try {
          req[key] = result.data;
        } catch {
          /* read-only in some runtimes; ignore */
        }
      }
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export default validate;
