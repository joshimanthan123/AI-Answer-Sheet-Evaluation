/**
 * Wrapper to catch errors in Express async handlers and forward them to next()
 * @param {Function} requestHandler Async Express request handler function
 * @returns {Function} Express middleware wrapper
 */
const asyncHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
};

export default asyncHandler;
export { asyncHandler };
