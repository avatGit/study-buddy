export interface Pagination {
  page: number;
  limit: number;
}

export function paginationOffset({ page, limit }: Pagination): number {
  return (page - 1) * limit;
}

export function paginatedList<T>(
  items: T[],
  { page, limit }: Pagination,
  total: number,
): { items: T[]; page: number; limit: number; total: number } {
  return { items, page, limit, total };
}
