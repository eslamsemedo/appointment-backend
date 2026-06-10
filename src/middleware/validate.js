// Generic Zod middleware wrapper.
// Usage: validate(schema)            -> validates req.body
//        validate(schema, 'query')   -> validates req.query
//
// Note: in Express 5 `req.query` is a getter with no setter, so we only
// write the parsed result back for `body`. Query values are read directly
// by controllers after validation passes.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (source === 'body') {
    req.body = result.data;
  }

  return next();
};

export default validate;
