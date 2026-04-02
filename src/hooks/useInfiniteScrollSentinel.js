import { useEffect, useRef } from "react";

export default function useInfiniteScrollSentinel({
  enabled = true,
  hasMore = false,
  loading = false,
  onLoadMore,
  root = null,
  rootMargin = "320px",
  threshold = 0,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !hasMore || loading || typeof onLoadMore !== "function") {
      return undefined;
    }

    const element = sentinelRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        void onLoadMore();
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, hasMore, loading, onLoadMore, root, rootMargin, threshold]);

  return sentinelRef;
}
