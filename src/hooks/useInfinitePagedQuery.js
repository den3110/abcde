import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function resolveRowKey(row, index, getRowId) {
  const key = getRowId ? getRowId(row) : row?.id;
  if (key != null && key !== "") return String(key);
  return `row-${index}`;
}

function mergeRows(previousRows, nextRows, getRowId) {
  const merged = [...previousRows];
  const indexByKey = new Map(
    previousRows.map((row, index) => [resolveRowKey(row, index, getRowId), index])
  );

  nextRows.forEach((row, index) => {
    const key = resolveRowKey(row, previousRows.length + index, getRowId);
    const existingIndex = indexByKey.get(key);
    if (existingIndex == null) {
      indexByKey.set(key, merged.length);
      merged.push(row);
      return;
    }
    merged[existingIndex] = row;
  });

  return merged;
}

export default function useInfinitePagedQuery({
  trigger,
  baseArgs = {},
  pageSize = 40,
  enabled = true,
  getRowId = (row) => row?.id,
  pollingInterval = 0,
  skipPolling = false,
}) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestSeqRef = useRef(0);

  const argsKey = useMemo(() => JSON.stringify(baseArgs || {}), [baseArgs]);

  const applyResponse = useCallback(
    (response, mode = "replace") => {
      const nextRows = Array.isArray(response?.rows) ? response.rows : [];
      setRows((previousRows) =>
        mode === "append" ? mergeRows(previousRows, nextRows, getRowId) : nextRows
      );
      setSummary(response?.summary || null);
      setMeta(response?.meta || null);
      setCount(Number(response?.count || 0));
      setPage(Number(response?.page || 1));
      setPages(Math.max(1, Number(response?.pages || 1)));
      setError(null);
    },
    [getRowId]
  );

  const loadPage = useCallback(
    async ({ nextPage = 1, limit = pageSize, mode = "replace", refresh = false } = {}) => {
      if (!enabled) return null;

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      if (mode === "append") {
        setIsLoadingMore(true);
      } else if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      try {
        const response = await trigger(
          {
            ...baseArgs,
            page: nextPage,
            limit,
          },
          false
        ).unwrap();

        if (requestSeq !== requestSeqRef.current) return response;
        applyResponse(response, mode);
        return response;
      } catch (nextError) {
        if (requestSeq === requestSeqRef.current) {
          setError(nextError);
        }
        throw nextError;
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setIsInitialLoading(false);
          setIsLoadingMore(false);
          setIsRefreshing(false);
        }
      }
    },
    [applyResponse, baseArgs, enabled, pageSize, trigger]
  );

  const refresh = useCallback(async () => {
    const limit = Math.max(pageSize, rows.length || pageSize);
    return loadPage({
      nextPage: 1,
      limit,
      mode: "replace",
      refresh: true,
    });
  }, [loadPage, pageSize, rows.length]);

  const loadMore = useCallback(async () => {
    if (!enabled || isInitialLoading || isLoadingMore || isRefreshing) return null;
    const hasMore = rows.length < count && page < pages;
    if (!hasMore) return null;
    return loadPage({
      nextPage: page + 1,
      limit: pageSize,
      mode: "append",
    });
  }, [
    count,
    enabled,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadPage,
    page,
    pageSize,
    pages,
    rows.length,
  ]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setSummary(null);
      setMeta(null);
      setCount(0);
      setPage(0);
      setPages(1);
      setError(null);
      return;
    }

    setRows([]);
    setSummary(null);
    setMeta(null);
    setCount(0);
    setPage(0);
    setPages(1);
    setError(null);
    void loadPage({
      nextPage: 1,
      limit: pageSize,
      mode: "replace",
    });
  }, [argsKey, enabled, loadPage, pageSize]);

  useEffect(() => {
    if (!enabled || skipPolling || !pollingInterval || pollingInterval < 1000) {
      return undefined;
    }

    const timer = setInterval(() => {
      void refresh();
    }, pollingInterval);

    return () => clearInterval(timer);
  }, [enabled, pollingInterval, refresh, skipPolling]);

  return {
    rows,
    summary,
    meta,
    count,
    page,
    pages,
    hasMore: rows.length < count && page < pages,
    error,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refresh,
  };
}
