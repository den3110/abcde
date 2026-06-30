import { useMemo } from "react";

const STAGE_META = [
  { key: "groups", type: "group", title: "Vòng bảng" },
  { key: "po", type: "po", title: "Play-Off" },
  { key: "ko", type: "ko", title: "Knockout" },
];

const isByeSeed = (seed) =>
  seed?.type === "bye" ||
  String(seed?.label || seed?.name || "")
    .trim()
    .toUpperCase() === "BYE";

const isBlankRegistrationSeed = (seed) => {
  if (!seed || seed.type !== "registration") return false;
  const ref = seed.ref || {};
  const hasRegistrationRef =
    !!ref.registration || !!ref.reg || !!ref._id || !!ref.id || !!ref.team || !!ref.teamId;
  const hasLabel = !!String(seed.label || seed.name || "").trim();
  return !hasRegistrationRef && !hasLabel;
};

const isPlayableSeed = (seed) =>
  !!seed?.type && !isByeSeed(seed) && !isBlankRegistrationSeed(seed);

const getSeedStage = (seed) =>
  Number(seed?.ref?.stageIndex ?? seed?.ref?.stage ?? 0) || 0;

const getGroupRematchKey = (seed) => {
  if (seed?.type !== "groupRank") return "";
  const groupCode = seed?.__group ?? seed?.ref?.groupCode ?? seed?.ref?.group ?? "";
  if (!groupCode) return "";
  return `${getSeedStage(seed) || 1}:${String(groupCode).trim().toUpperCase()}`;
};

const getRoundOrder = (seed) => ({
  round: Number(seed?.ref?.round || 0),
  order: Number(seed?.ref?.order ?? -1) + 1,
});

const poMatchesForRound = (drawSize, round) => {
  const n = Math.max(0, Number(drawSize) || 0);
  const r = Math.max(1, Number(round) || 1);
  if (r === 1) return Math.max(1, Math.ceil(n / 2));
  let losersPool = Math.floor(n / 2);
  for (let k = 2; k < r; k += 1) {
    losersPool = Math.floor(losersPool / 2);
  }
  return Math.max(1, Math.ceil(losersPool / 2));
};

const poV1BlockRange = (round, order, v1MatchCount) => {
  const blockSize = Math.max(1, 1 << Math.max(0, round - 1));
  const start = (order - 1) * blockSize + 1;
  const end = Math.min(v1MatchCount, start + blockSize - 1);
  return [start, end];
};

const hasPoWinnerRematch = (a, b, poDrawSize) => {
  if (!poDrawSize || a?.type !== "stageMatchWinner" || b?.type !== "stageMatchWinner") {
    return false;
  }
  if (getSeedStage(a) && getSeedStage(b) && getSeedStage(a) !== getSeedStage(b)) {
    return false;
  }

  const v1MatchCount = poMatchesForRound(poDrawSize, 1);
  const { round: roundA, order: orderA } = getRoundOrder(a);
  const { round: roundB, order: orderB } = getRoundOrder(b);

  if (roundA === 1 && roundB >= 2) {
    const [start, end] = poV1BlockRange(roundB, orderB, v1MatchCount);
    return orderA >= start && orderA <= end;
  }
  if (roundB === 1 && roundA >= 2) {
    const [start, end] = poV1BlockRange(roundA, orderA, v1MatchCount);
    return orderB >= start && orderB <= end;
  }
  return false;
};

const sameSourceMatch = (a, b) => {
  const stageA = getSeedStage(a);
  const stageB = getSeedStage(b);
  if (stageA && stageB && stageA !== stageB) return false;
  const matchSeedTypes = new Set(["stageMatchWinner", "stageMatchLoser"]);
  if (!matchSeedTypes.has(a?.type) || !matchSeedTypes.has(b?.type)) return false;
  const aRound = Number(a?.ref?.round || 0);
  const bRound = Number(b?.ref?.round || 0);
  const aOrder = Number(a?.ref?.order ?? -1);
  const bOrder = Number(b?.ref?.order ?? -1);
  return aRound > 0 && aRound === bRound && aOrder >= 0 && aOrder === bOrder;
};

const rematchRisk = (a, b, context) => {
  let risk = 0;
  const groupA = getGroupRematchKey(a);
  const groupB = getGroupRematchKey(b);
  if (groupA && groupA === groupB) risk += 120;
  if (sameSourceMatch(a, b)) risk += 140;
  if (hasPoWinnerRematch(a, b, context.poDrawSize)) risk += 100;
  return risk;
};

const slotPairIndex = (slotIndex) => Math.floor(slotIndex / 2);

const sectionIdForSlot = (slotIndex, drawSize, level) => {
  const firstPairs = Math.max(1, Math.floor(drawSize / 2));
  const bucketCount = Math.min(firstPairs, 1 << level);
  const bucketSize = Math.max(1, firstPairs / bucketCount);
  return Math.floor(slotPairIndex(slotIndex) / bucketSize);
};

const placementConflictScore = (entry, slotIndex, placed, drawSize, context) => {
  let score = 0;
  const maxLevel = Math.max(1, Math.round(Math.log2(Math.max(1, drawSize / 2))));

  for (const other of placed) {
    const risk = rematchRisk(entry.seed, other.seed, context);
    if (!risk) continue;

    if (slotPairIndex(slotIndex) === slotPairIndex(other.slotIndex)) {
      score += risk * 10000;
    }

    for (let level = 1; level <= maxLevel; level += 1) {
      if (
        sectionIdForSlot(slotIndex, drawSize, level) ===
        sectionIdForSlot(other.slotIndex, drawSize, level)
      ) {
        score += risk * (level === 1 ? 1000 : 160 / level);
      }
    }
  }

  const distance = Math.abs(slotIndex - entry.originalSlot);
  const sideChange = slotIndex % 2 === entry.originalSlot % 2 ? 0 : 0.2;
  return score + distance * 0.5 + sideChange;
};

const buildKoSlots = (koPlan) => {
  const firstPairs = Math.max(1, Math.floor(Number(koPlan?.drawSize || 0) / 2));
  const slots = [];
  for (let pairIndex = 0; pairIndex < firstPairs; pairIndex += 1) {
    const row = koPlan?.seeds?.[pairIndex] || {};
    slots.push(row.A || null, row.B || null);
  }
  return slots;
};

const buildKoSeedsFromSlots = (slots) => {
  const seeds = [];
  for (let index = 0; index < slots.length; index += 2) {
    seeds.push({
      pair: index / 2 + 1,
      A: slots[index] || { type: "registration", ref: {}, label: "" },
      B: slots[index + 1] || { type: "registration", ref: {}, label: "" },
    });
  }
  return seeds;
};

const reorderKoSeedsToAvoidRematches = (koPlan, context = {}) => {
  const drawSize = Math.max(0, Number(koPlan?.drawSize || 0));
  if (drawSize < 4 || !Array.isArray(koPlan?.seeds) || !koPlan.seeds.length) {
    return koPlan;
  }

  const slots = buildKoSlots(koPlan);
  const entries = slots
    .map((seed, originalSlot) => ({ seed, originalSlot, conflictDegree: 0 }))
    .filter((entry) => isPlayableSeed(entry.seed));

  if (entries.length < 2) return koPlan;

  let hasConflict = false;
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const risk = rematchRisk(entries[i].seed, entries[j].seed, context);
      if (risk > 0) {
        hasConflict = true;
        entries[i].conflictDegree += risk;
        entries[j].conflictDegree += risk;
      }
    }
  }

  if (!hasConflict) return koPlan;

  const orderedEntries = entries
    .slice()
    .sort(
      (a, b) =>
        b.conflictDegree - a.conflictDegree ||
        a.originalSlot - b.originalSlot
    );
  const availableSlots = Array.from({ length: drawSize }, (_, index) => index);
  const usedSlots = new Set();
  const placed = [];
  const outputSlots = Array(drawSize).fill(null);

  for (const entry of orderedEntries) {
    let bestSlot = -1;
    let bestScore = Infinity;
    for (const slotIndex of availableSlots) {
      if (usedSlots.has(slotIndex)) continue;
      const score = placementConflictScore(entry, slotIndex, placed, drawSize, context);
      if (score < bestScore) {
        bestScore = score;
        bestSlot = slotIndex;
      }
    }
    if (bestSlot < 0) continue;
    usedSlots.add(bestSlot);
    outputSlots[bestSlot] = entry.seed;
    placed.push({ ...entry, slotIndex: bestSlot });
  }

  const fillers = slots.filter((seed) => !isPlayableSeed(seed));
  for (let index = 0; index < outputSlots.length; index += 1) {
    if (outputSlots[index]) continue;
    outputSlots[index] = fillers.shift() || { type: "registration", ref: {}, label: "" };
  }

  return {
    ...koPlan,
    seeds: buildKoSeedsFromSlots(outputSlots),
  };
};

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
    const normalizedKo = normalizeSeedsKO(koPlan);
    const protectedKo = koPlan?.avoidRematchBranches
      ? reorderKoSeedsToAvoidRematches(normalizedKo, {
          poDrawSize: includePO ? Number(poPlan?.drawSize || 0) : 0,
        })
      : normalizedKo;

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
        ...protectedKo,
        format: koFormat,
        avoidRematchBranches: !!koPlan?.avoidRematchBranches,
        ...(isDoubleElim
          ? {
              doubleElim: {
                hasGrandFinalReset:
                  !!koPlan?.doubleElim?.hasGrandFinalReset,
                startRoundKey: koPlan?.doubleElim?.startRoundKey || null,
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
