import { useCallback, useEffect, useMemo, useState } from "react";
import { usePreviewBlueprintImpactMutation } from "slices/tournamentsApiSlice";

export default function useBlueprintImpact({ tournamentId, planPayload, enabled = false }) {
  const [previewBlueprintImpact, { isLoading }] = usePreviewBlueprintImpactMutation();
  const [impact, setImpact] = useState(null);
  const [impactError, setImpactError] = useState("");

  const payloadKey = useMemo(() => JSON.stringify(planPayload || {}), [planPayload]);

  const refreshImpact = useCallback(
    async (nextPayload = planPayload) => {
      if (!tournamentId || !nextPayload) return null;
      try {
        const result = await previewBlueprintImpact({
          tournamentId,
          body: nextPayload,
        }).unwrap();
        setImpact(result);
        setImpactError("");
        return result;
      } catch (error) {
        setImpactError(error?.data?.message || error?.error || "Không phân tích được impact.");
        throw error;
      }
    },
    [planPayload, previewBlueprintImpact, tournamentId]
  );

  useEffect(() => {
    if (!enabled || !tournamentId || !planPayload) return undefined;

    const timer = setTimeout(() => {
      refreshImpact(planPayload).catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [enabled, tournamentId, planPayload, payloadKey, refreshImpact]);

  return {
    impact,
    impactError,
    loadingImpact: isLoading,
    refreshImpact,
    setImpact,
  };
}
