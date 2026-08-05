/**
 * Formats query pages and calculates limits, offsets, and metadata mappings
 * @param {Object} query Express request query parameter mapping page/limit
 * @returns {Object} Extracted options (page, limit, skip) and formatting metadata builders
 */
export const getPaginationOptions = (query) => {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit || "10", 10))); // capped limit 100
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

/**
 * Format standard meta object for JSON query lists
 * @param {number} totalItems Total records matching query
 * @param {number} page Current page number
 * @param {number} limit Items count limit per query request
 * @returns {Object} Standard meta envelope
 */
export const formatPaginationMeta = (totalItems, page, limit) => {
  const totalPages = Math.ceil(totalItems / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    totalItems,
    totalPages,
    currentPage: page,
    limit,
    hasNextPage,
    hasPrevPage,
  };
};

export default {
  getPaginationOptions,
  formatPaginationMeta,
};
