import { useMemo } from "react";

const STAGE_META = [
  { key: "groups", type: "group", title: "Vòng bảng" },
  { key: "po", type: "po", title: "Play-Off" },
  { key: "ko", type: "ko", title: "Knockout" },
];

export default function useBlueprintDraft({
  includeGroup,
  includePO,
  groupCount,
  groupSize,
  groupTotal,
  groupTopN,
  manualRemainder,
  groupSizes,
  minGroupSize,
  groupRules,
  poPlan,
  poRules,
  poRoundRules,
  koPlan,
  koRules,
  koSemiOverride,
  koSemiRules,
  koFinalOverride,
  koFinalRules,
  koThirdPlace,
  normalizeRulesForState,
  normalizeSeedsPO,
  normalizeSeedsKO,
  defaultRules,
  defaultPoRules,
  existingBrackets,
}) {
  const planPayload = useMemo(() => {
    const hasGroup = includeGroup && Number(groupCount) > 0;
    const total = Math.max(0, Number(groupTotal) || 0);
    const qualifiersPerGroup = Math.max(
      1,
      Math.min(Number(groupTopN) || 1, Math.max(1, minGroupSize || 1))
    );
    const koFormat =
      String(koPlan?.format || "single_elim").trim().toLowerCase() === "double_elim"
        ? "double_elim"
        : "single_elim";
    const isDoubleElim = koFormat === "double_elim";

    return {
      groups: hasGroup
        ? total > 0
          ? {
              count: Number(groupCount) || 0,
              totalTeams: total,
              ...(manualRemainder ? { groupSizes } : {}),
              qualifiersPerGroup,
              rules: normalizeRulesForState(groupRules, defaultRules),
            }
          : {
              count: Number(groupCount) || 0,
              size: Number(groupSize) || 0,
              qualifiersPerGroup,
              rules: normalizeRulesForState(groupRules, defaultRules),
            }
        : null,
      po: includePO
        ? {
            ...normalizeSeedsPO(poPlan),
            rules: normalizeRulesForState(poRules, defaultPoRules),
            roundRules: (poRoundRules || []).map((rule) =>
              normalizeRulesForState(rule, defaultPoRules)
            ),
          }
        : null,
      ko: {
        ...normalizeSeedsKO(koPlan),
        format: koFormat,
        ...(isDoubleElim
          ? {
              doubleElim: {
                hasGrandFinalReset:
                  !!koPlan?.doubleElim?.hasGrandFinalReset,
              },
            }
          : {}),
        rules: normalizeRulesForState(koRules, defaultRules),
        semiRules:
          !isDoubleElim && koSemiOverride
            ? normalizeRulesForState(koSemiRules, defaultRules)
            : null,
        finalRules: koFinalOverride ? normalizeRulesForState(koFinalRules, defaultRules) : null,
        thirdPlace: !isDoubleElim && !!koThirdPlace,
      },
    };
  }, [
    defaultPoRules,
    defaultRules,
    groupCount,
    groupRules,
    groupSize,
    groupSizes,
    groupTopN,
    groupTotal,
    includeGroup,
    includePO,
    koPlan,
    koFinalOverride,
    koFinalRules,
    koRules,
    koSemiOverride,
    koSemiRules,
    koThirdPlace,
    manualRemainder,
    minGroupSize,
    normalizeRulesForState,
    normalizeSeedsKO,
    normalizeSeedsPO,
    poPlan,
    poRoundRules,
    poRules,
  ]);

  const stageRuntimeMap = useMemo(() => {
    const byType = new Map((existingBrackets || []).map((stage) => [stage.type, stage]));
    return {
      groups: byType.get("group")?.runtime || null,
      po: byType.get("po")?.runtime || null,
      ko: byType.get("ko")?.runtime || null,
    };
  }, [existingBrackets]);

  const stageCards = useMemo(
    () =>
      STAGE_META.map((stage) => {
        const published = (existingBrackets || []).find((item) => item.type === stage.type);
        return {
          key: stage.key,
          title: stage.title,
          config: published?.config || planPayload[stage.key] || null,
          runtime: stageRuntimeMap[stage.key] || {
            key: stage.key,
            status: "draftable",
            locked: false,
            lockReasons: [],
            publishedBracketId: null,
            matchSummary: { total: 0, operational: 0, byStatus: {} },
            drawSummary: { total: 0, committed: 0, active: 0 },
          },
        };
      }),
    [existingBrackets, planPayload, stageRuntimeMap]
  );

  return {
    planPayload,
    stageRuntimeMap,
    stageCards,
    hasPublishedStages: (existingBrackets || []).length > 0,
  };
}
