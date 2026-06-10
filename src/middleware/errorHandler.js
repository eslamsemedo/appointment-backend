// Global Express error handler (must have 4 args).
// Catches anything passed to next(err) — only unexpected errors reach here.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error('Unexpected error:', err);

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  });
};

export default errorHandler;
