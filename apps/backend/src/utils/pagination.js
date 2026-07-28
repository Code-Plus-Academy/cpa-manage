/**
 * Pagination helper for list endpoints.
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
  limit = Math.min(limit, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, totalCount) {
  return {
    page,
    limit,
    total_count: totalCount,
    total_pages: Math.ceil(totalCount / limit),
    has_next: page * limit < totalCount,
    has_prev: page > 1,
  };
}

module.exports = { parsePagination, paginationMeta };
