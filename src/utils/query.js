const { injectCursor, buildCursor } = require('./cursor');

module.exports = {
  /**
   * Parses the raw results from a find or aggregate query and generates a response object that
   * contain the various pagination properties
   *
   * @param {Object[]} results the results from a query
   * @param {Object} params The params originally passed to `find` or `aggregate`
   *
   * @return {Object} The object containing pagination properties
   */
  prepareResponse(results, params) {
    const hasMore = results.length > params.limit;
    // Remove the extra element that we added to 'peek' to see if there were more entries.
    if (hasMore) results.pop();

    if (params.includeCursor) {
      // build the cursor for each result document
      results = results.map((result) => injectCursor(result, params.paginatedField));
    }

    const hasPrevious = !!params.next || !!(params.previous && hasMore);
    const hasNext = !!params.previous || hasMore;

    // If we sorted reverse to get the previous page, correct the sort order.
    if (params.previous) results = results.reverse();

    return {
      results,
      previous: results.length ? buildCursor(results[0]) : null,
      hasPrevious,
      next: results.length ? buildCursor(results[results.length - 1]) : null,
      hasNext,
    };
  },

  /**
   * Generates a `$sort` object given the parameters
   *
   * @param {Object} params The params originally passed to `find` or `aggregate`
   *
   * @return {Object} a sort object
   */
  generateSort(params) {
    const sortAsc =
      (!params.sortAscending && params.previous) || (params.sortAscending && !params.previous);
    const sortDir = sortAsc ? 1 : -1;
    const shouldSecondarySortOnId = params.paginatedField !== '_id';

    if (shouldSecondarySortOnId) {
      return {
        [params.paginatedField]: sortDir,
        _id: sortDir,
      };
    }

    return {
      [params.paginatedField]: sortDir,
    };
  },

  /**
   * Generates a cursor query that provides the offset capabilities
   *
   * @param {Object} params The params originally passed to `find` or `aggregate`
   *
   * @return {Object} a cursor offset query
   */
  generateCursorQuery(params) {
    if (!params.next && !params.previous) return {};

    const sortAsc =
      (!params.sortAscending && params.previous) || (params.sortAscending && !params.previous);
    const comparisonOp = sortAsc ? '$gt' : '$lt';
    const shouldSecondarySortOnId = params.paginatedField !== '_id';

    // a `next` cursor will have precedence over a `previous` cursor.
    const op = params.next || params.previous;

    if (shouldSecondarySortOnId) {
      return {
        $or: [
          {
            [params.paginatedField]: {
              [comparisonOp]: op[0],
            },
          },
          {
            [params.paginatedField]: {
              $eq: op[0],
            },
            _id: {
              [comparisonOp]: op[1],
            },
          },
        ],
      };
    }

    return {
      [params.paginatedField]: {
        [comparisonOp]: op,
      },
    };
  },
};
