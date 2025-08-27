// src/pages/tournament/TournamentBlueprintPage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Stack,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  MenuItem,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Tooltip,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { Bracket, Seed, SeedItem, SeedTeam } from "react-brackets";
import { toast } from "react-toastify";
import {
  useGetTournamentQuery,
  usePlanTournamentMutation,
  useCommitTournamentPlanMutation,
  useGetTournamentBracketsQuery, // 🔹 NEW: lấy danh sách brackets hiện có
} from "slices/tournamentsApiSlice";
import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

/* ===== Helpers ===== */
const ceilPow2 = (n) => (n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n)));
const nextPow2 = ceilPow2;
const RR_MATCHES = (size) => (size >= 2 ? (size * (size - 1)) / 2 : 0);
const makeStageId = (idx) => `V${idx + 1}`; // V1, V2,...

// ===== PO (non-2^n) helpers =====
const maxPoRoundsFor = (n) => {
  const N = Math.max(0, Number(n) || 0);
  const losers1 = Math.floor(N / 2);
  return Math.max(1, 1 + (losers1 > 0 ? Math.floor(Math.log2(losers1)) : 0));
};

const poMatchesForRound = (n, round) => {
  const N = Math.max(0, Number(n) || 0);
  const r = Math.max(1, Number(round) || 1);
  if (r === 1) return Math.max(1, Math.ceil(N / 2)); // lẻ thì trận cuối BYE
  let losersPool = Math.floor(N / 2);
  for (let k = 2; k < r; k++) losersPool = Math.floor(losersPool / 2);
  return Math.max(1, Math.ceil(losersPool / 2)); // lẻ thì trận cuối BYE
};

const roundTitleByPairs = (pairs) => {
  if (pairs === 1) return "Chung kết";
  if (pairs === 2) return "Bán kết";
  if (pairs === 4) return "Tứ kết";
  if (pairs === 8) return "Vòng 1/8";
  return `Vòng (${pairs} trận)`;
};

const seedLabel = (seed) => {
  if (!seed || !seed.type) return "—";
  if (seed.label) return seed.label;
  switch (seed.type) {
    case "groupRank": {
      const st = seed.ref?.stage ?? "?";
      const g = seed.ref?.groupCode;
      const r = seed.ref?.rank ?? "?";
      return g ? `V${st}-B${g}-#${r}` : `V${st}-#${r}`;
    }
    case "stageMatchWinner": {
      const r = seed.ref?.round ?? "?";
      const t = (seed.ref?.order ?? -1) + 1;
      return `W-V${r}-T${t}`;
    }
    case "stageMatchLoser": {
      const r = seed.ref?.round ?? "?";
      const t = (seed.ref?.order ?? -1) + 1;
      return `L-V${r}-T${t}`;
    }
    case "bye":
      return "BYE";
    case "registration": {
      const hasReg = !!(seed.ref && (seed.ref.registration || seed.ref.reg));
      return hasReg ? "Registration" : "—";
    }
    default:
      return "—";
  }
};

/* ====== Rules Editor ====== */
const DEFAULT_RULES = { bestOf: 3, pointsToWin: 11, winByTwo: true };

function RulesEditor({ label = "Luật trận", value, onChange }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems="center"
      sx={{ flexWrap: "wrap" }}
    >
      <Chip size="small" label={label} />
      <TextField
        select
        size="small"
        label="Best of"
        value={value.bestOf}
        onChange={(e) => onChange({ ...value, bestOf: parseInt(e.target.value || "3", 10) })}
        sx={{ width: 140 }}
      >
        {[1, 3, 5].map((n) => (
          <MenuItem key={n} value={n}>
            {n}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label="Điểm thắng game"
        value={value.pointsToWin}
        onChange={(e) => onChange({ ...value, pointsToWin: parseInt(e.target.value || "11", 10) })}
        sx={{ width: 180 }}
      >
        {[11, 15, 21].map((n) => (
          <MenuItem key={n} value={n}>
            {n}
          </MenuItem>
        ))}
      </TextField>

      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.winByTwo}
            onChange={(e) => onChange({ ...value, winByTwo: !!e.target.checked })}
          />
        }
        label="Thắng cách 2 điểm"
      />
    </Stack>
  );
}

RulesEditor.propTypes = {
  label: PropTypes.string,
  value: PropTypes.shape({
    bestOf: PropTypes.number.isRequired,
    pointsToWin: PropTypes.number.isRequired,
    winByTwo: PropTypes.bool.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

/** Build KO rounds (R1 editable; R>=2 winners auto) */
function buildRoundsFromPlan(planKO, stageIndex = 1) {
  const drawSize = Math.max(2, nextPow2(planKO?.drawSize || 2));
  const firstPairs = drawSize / 2;

  const r1 = Array.from({ length: firstPairs }, (_, i) => {
    const found = (planKO?.seeds || []).find((s) => Number(s.pair) === i + 1);
    const A = found?.A || { type: "registration", label: "—" };
    const B = found?.B || { type: "registration", label: "—" };
    return {
      id: `R1-${i + 1}`,
      pairIndex: i + 1,
      teams: [
        { name: seedLabel(A), __seed: A, __pair: i + 1, __slot: "A" },
        { name: seedLabel(B), __seed: B, __pair: i + 1, __slot: "B" },
      ],
    };
  });

  const rounds = [{ title: roundTitleByPairs(firstPairs), seeds: r1 }];

  const winnerLabel = (prevRoundNumber, prevPairIdx) => `W-V${prevRoundNumber}-T${prevPairIdx}`;

  let prevPairs = firstPairs;
  let prevRound = r1;
  let roundNum = 2;

  while (prevPairs > 1) {
    const pairs = Math.ceil(prevPairs / 2);
    const prevRoundNumber = roundNum - 1;

    const thisSeeds = Array.from({ length: pairs }, (_, i) => {
      const prevA = prevRound[i * 2];
      const prevB = prevRound[i * 2 + 1];
      const tLeft = prevA?.pairIndex || i * 2 + 1;
      const tRight = prevB?.pairIndex || i * 2 + 2;
      return {
        id: `R${roundNum}-${i + 1}`,
        teams: [
          { name: winnerLabel(prevRoundNumber, tLeft) },
          { name: winnerLabel(prevRoundNumber, tRight) },
        ],
      };
    });

    rounds.push({ title: roundTitleByPairs(pairs), seeds: thisSeeds });
    prevRound = thisSeeds.map((s, idx) => ({ ...s, pairIndex: idx + 1 }));
    prevPairs = pairs;
    roundNum += 1;
  }

  return rounds;
}

/* ========================= PO (losers-cascade) builder (non-2^n) ========================= */
function buildPoRoundsFromPlan(planPO, stageIndex = 1) {
  const N = Math.max(0, Number(planPO?.drawSize || 0));
  const maxR = Math.max(1, Math.min(maxPoRoundsFor(N), Number(planPO?.maxRounds || 1)));
  const rounds = [];

  // V1 (editable)
  const r1Pairs = Math.max(1, Math.ceil(N / 2));
  const r1Seeds = Array.from({ length: r1Pairs }, (_, i) => {
    const found = (planPO?.seeds || []).find((s) => Number(s.pair) === i + 1) || {};
    const idxA = i * 2 + 1;
    const idxB = i * 2 + 2;
    const defA = { type: "registration", ref: {}, label: `Đội ${idxA}` };
    const defB =
      idxB <= N
        ? { type: "registration", ref: {}, label: `Đội ${idxB}` }
        : { type: "bye", ref: null, label: "BYE" };
    const A = found.A && found.A.type ? found.A : defA;
    const B = found.B && found.B.type ? found.B : defB;
    return {
      id: `R1-${i + 1}`,
      pairIndex: i + 1,
      teams: [
        { name: seedLabel(A), __seed: A, __pair: i + 1, __slot: "A" },
        { name: seedLabel(B), __seed: B, __pair: i + 1, __slot: "B" },
      ],
    };
  });
  rounds.push({ title: `PO • Vòng 1 (${r1Pairs} trận)`, seeds: r1Seeds });

  // V>=2: losers cascade
  let losersPool = Math.floor(N / 2);
  let roundNum = 2;

  while (roundNum <= maxR && losersPool > 0) {
    const pairs = Math.max(1, Math.ceil(losersPool / 2));
    const seeds = Array.from({ length: pairs }, (_, i) => {
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      const left = { name: `L-V${roundNum - 1}-T${leftIdx}` };
      const right =
        rightIdx <= losersPool ? { name: `L-V${roundNum - 1}-T${rightIdx}` } : { name: "BYE" };
      return { id: `R${roundNum}-${i + 1}`, teams: [left, right] };
    });

    rounds.push({ title: `PO • Vòng ${roundNum} (${pairs} trận)`, seeds });
    losersPool = Math.floor(losersPool / 2);
    roundNum += 1;
  }

  return rounds;
}

/* ===== Compute PO qualifiers list (winners of V1..Vmax, in order) ===== */
function computePoQualifiers(planPO, poStageIndex /* 0-based in stages */) {
  const N = Math.max(0, Number(planPO?.drawSize || 0));
  const maxR = Math.max(1, Math.min(maxPoRoundsFor(N), Number(planPO?.maxRounds || 1)));
  const list = [];
  for (let r = 1; r <= maxR; r++) {
    const pairs = poMatchesForRound(N, r);
    for (let i = 1; i <= pairs; i++) {
      list.push({
        type: "stageMatchWinner",
        ref: { stageIndex: poStageIndex + 1, round: r, order: i - 1 },
        label: `W-V${r}-T${i}`,
      });
    }
  }
  return list;
}

/* ===== Compute GROUP qualifiers list (Top N per group) ===== */
function computeGroupQualifiers(groupStage, groupStageIndex /* 0-based*/, topN = 1) {
  const stNum = groupStageIndex + 1;
  const groups = groupStage?.config?.groups || [];
  const sizes = groupStage?.config?.groupSizes || [];
  const minSize =
    sizes.length > 0
      ? Math.max(0, Math.min(...sizes.map((v) => Number(v) || 0)))
      : groupStage?.config?.groupSize || 0;
  const N = Math.max(1, Math.min(Number(topN) || 1, minSize || 1));

  // Order: B1#1, B2#1, ..., Bk#1, then B1#2, B2#2, ...
  const list = [];
  for (let rank = 1; rank <= N; rank++) {
    for (const g of groups) {
      list.push({
        type: "groupRank",
        ref: { stage: stNum, groupCode: String(g), rank },
        label: `V${stNum}-B${g}-#${rank}`,
      });
    }
  }
  return list;
}

const normalizeSeedsKO = (plan) => {
  const size = Math.max(2, nextPow2(Number(plan?.drawSize || 2)));
  const firstPairs = size / 2;
  const map = new Map((plan?.seeds || []).map((s) => [Number(s.pair), s]));
  const placeholder = () => ({ type: "registration", ref: {}, label: "" });
  const seeds = Array.from({ length: firstPairs }, (_, i) => {
    const pair = i + 1;
    const cur = map.get(pair) || { pair, A: null, B: null };
    return {
      pair,
      A: cur.A && cur.A.type ? cur.A : placeholder(),
      B: cur.B && cur.B.type ? cur.B : placeholder(),
    };
  });
  return { drawSize: size, seeds };
};

const normalizeSeedsPO = (plan) => {
  const N = Math.max(0, Number(plan?.drawSize || 0));
  const firstPairs = Math.max(1, Math.ceil(N / 2));
  const map = new Map((plan?.seeds || []).map((s) => [Number(s.pair), s]));
  const seeds = Array.from({ length: firstPairs }, (_, i) => {
    const pair = i + 1;
    const idxA = i * 2 + 1;
    const idxB = i * 2 + 2;
    const cur = map.get(pair) || { pair, A: null, B: null };
    const A = cur.A && cur.A.type ? cur.A : { type: "registration", ref: {}, label: `Đội ${idxA}` };
    const B =
      cur.B && cur.B.type
        ? cur.B
        : idxB <= N
        ? { type: "registration", ref: {}, label: `Đội ${idxB}` }
        : { type: "bye", ref: null, label: "BYE" };
    return { pair, A, B };
  });
  return {
    drawSize: N,
    maxRounds: Math.max(1, Math.min(maxPoRoundsFor(N), Number(plan?.maxRounds || 1))),
    seeds,
  };
};

/* ========================= Seed Picker ========================= */
function SeedPickerDialog({ open, onClose, onPick, stages, currentStageIndex }) {
  const [mode, setMode] = useState("groupRank");

  const earlier = useMemo(() => stages.slice(0, currentStageIndex), [stages, currentStageIndex]);
  const groupStages = useMemo(
    () => earlier.map((s, i) => ({ ...s, idx: i })).filter((s) => s.type === "group"),
    [earlier]
  );
  const poKoStages = useMemo(
    () =>
      earlier.map((s, i) => ({ ...s, idx: i })).filter((s) => s.type === "po" || s.type === "ko"),
    [earlier]
  );

  // groupRank state
  const [grStageIdx, setGrStageIdx] = useState(groupStages[0]?.idx ?? 0);
  const [grGroup, setGrGroup] = useState("ANY");
  const [grRank, setGrRank] = useState(1);

  // stage match state
  const [mStageIdx, setMStageIdx] = useState(poKoStages[0]?.idx ?? 0);
  const [mRound, setMRound] = useState(1);
  const [mTIndex, setMTIndex] = useState(1);

  const mPairsForRound = useMemo(() => {
    const s = stages[mStageIdx];
    if (!s) return 1;
    if (s.type === "po") return poMatchesForRound(s.config?.drawSize || 0, mRound);
    // KO
    const size = s?.config?.drawSize || 2;
    const fp = Math.max(1, nextPow2(size) / 2);
    return Math.max(1, Math.ceil(fp / Math.pow(2, Math.max(0, mRound - 1))));
  }, [stages, mStageIdx, mRound]);

  const canPick = () => {
    if (mode === "groupRank" && !groupStages.length) return false;
    if ((mode === "stageMatchWinner" || mode === "stageMatchLoser") && !poKoStages.length)
      return false;
    return true;
  };

  const handlePick = () => {
    if (!canPick()) return;
    if (mode === "bye") return onPick({ type: "bye", ref: null, label: "BYE" });
    if (mode === "registration") return onPick({ type: "registration", ref: {}, label: "" });

    if (mode === "groupRank") {
      const st = (grStageIdx ?? 0) + 1;
      const groupName = grGroup === "ANY" ? "" : String(grGroup);
      const label = groupName ? `V${st}-B${groupName}-#${grRank}` : `V${st}-#${grRank}`;
      return onPick({
        type: "groupRank",
        ref: { stage: st, groupCode: groupName, rank: grRank },
        label,
      });
    }

    if (mode === "stageMatchWinner" || mode === "stageMatchLoser") {
      const st = (mStageIdx ?? 0) + 1;
      const s = stages[mStageIdx];
      const rMax =
        s?.type === "po"
          ? Math.max(1, Number(s.config?.maxRounds || 1))
          : Math.max(1, Math.round(Math.log2(nextPow2(s?.config?.drawSize || 2))));
      const r = Math.min(Math.max(1, Number(mRound || 1)), rMax);
      const order = Math.max(0, Math.min(mPairsForRound || 1, Number(mTIndex || 1)) - 1);
      const label = mode === "stageMatchWinner" ? `W-V${r}-T${order + 1}` : `L-V${r}-T${order + 1}`;
      return onPick({ type: mode, ref: { stageIndex: st, round: r, order }, label });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chọn nguồn seed</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ minWidth: 360 }}>
          <Select size="small" value={mode} onChange={(e) => setMode(e.target.value)}>
            <MenuItem value="groupRank" disabled={!groupStages.length}>
              Top bảng (Vx-Bi-#r / Vx-#r)
            </MenuItem>
            <MenuItem value="stageMatchWinner" disabled={!poKoStages.length}>
              Winner của trận (W - Vr - Tt)
            </MenuItem>
            <MenuItem value="stageMatchLoser" disabled={!poKoStages.length}>
              Loser của trận (L - Vr - Tt)
            </MenuItem>
            <MenuItem value="bye">BYE</MenuItem>
            <MenuItem value="registration">Chỉ định (Registration)</MenuItem>
          </Select>

          {/* groupRank config */}
          {mode === "groupRank" && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Chọn vòng bảng nguồn và hạng cần lấy
              </Typography>
              <Stack direction="row" spacing={1}>
                <Select
                  size="small"
                  value={grStageIdx}
                  onChange={(e) => setGrStageIdx(Number(e.target.value))}
                >
                  {groupStages.map((s) => (
                    <MenuItem key={s.id} value={s.idx}>{`${s.id} • ${
                      s.title || "Group"
                    }`}</MenuItem>
                  ))}
                </Select>
                <Select size="small" value={grGroup} onChange={(e) => setGrGroup(e.target.value)}>
                  <MenuItem value="ANY">(Không chỉ định bảng)</MenuItem>
                  {(stages[grStageIdx]?.config?.groups || []).map((g) => (
                    <MenuItem key={g} value={g}>{`B${g}`}</MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  label="Hạng (#)"
                  type="number"
                  value={grRank}
                  onChange={(e) => setGrRank(parseInt(e.target.value || "1", 10))}
                  sx={{ width: 120 }}
                />
              </Stack>
            </Stack>
          )}

          {/* stageMatch config */}
          {(mode === "stageMatchWinner" || mode === "stageMatchLoser") && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Chọn vòng nguồn (KO/PO) và trận T
              </Typography>
              <Stack direction="row" spacing={1}>
                <Select
                  size="small"
                  value={mStageIdx}
                  onChange={(e) => {
                    setMStageIdx(Number(e.target.value));
                    setMRound(1);
                    setMTIndex(1);
                  }}
                >
                  {poKoStages.map((s) => (
                    <MenuItem key={s.id} value={s.idx}>{`${s.id} • ${
                      s.title || (s.type === "po" ? "PO" : "KO")
                    }`}</MenuItem>
                  ))}
                </Select>
                <TextField
                  size="small"
                  label="V (round)"
                  type="number"
                  value={mRound}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value || "1", 10));
                    const s = stages[mStageIdx];
                    const rMax =
                      s?.type === "po"
                        ? Math.max(1, Number(s.config?.maxRounds || 1))
                        : Math.max(1, Math.round(Math.log2(nextPow2(s?.config?.drawSize || 2))));
                    setMRound(Math.min(v, rMax));
                    setMTIndex(1);
                  }}
                  sx={{ width: 140 }}
                  helperText={() => {
                    const s = stages[mStageIdx];
                    const rMax =
                      s?.type === "po"
                        ? Math.max(1, Number(s.config?.maxRounds || 1))
                        : Math.max(1, Math.round(Math.log2(nextPow2(s?.config?.drawSize || 2))));
                    return `Tối đa V${rMax}`;
                  }}
                />
                <TextField
                  size="small"
                  label={`T (1..${mPairsForRound})`}
                  type="number"
                  value={mTIndex}
                  onChange={(e) =>
                    setMTIndex(
                      Math.max(1, Math.min(mPairsForRound, parseInt(e.target.value || "1", 10)))
                    )
                  }
                  sx={{ width: 160 }}
                />
              </Stack>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button
          variant="contained"
          onClick={() => {
            handlePick();
            onClose();
          }}
          disabled={!canPick()}
        >
          Chọn
        </Button>
      </DialogActions>
    </Dialog>
  );
}

SeedPickerDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onPick: PropTypes.func.isRequired,
  stages: PropTypes.array.isRequired,
  currentStageIndex: PropTypes.number.isRequired,
};

/* ========================= Main Page ========================= */
export default function TournamentBlueprintPage() {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();

  const { data: tournament, isLoading, error } = useGetTournamentQuery(tournamentId);

  // 🔹 NEW: lấy danh sách brackets đã tạo
  const {
    data: existingBrackets = [],
    isLoading: loadingBrackets,
    isError: bracketsError,
  } = useGetTournamentBracketsQuery(tournamentId);

  const [tab, setTab] = useState("auto");

  // stage toggles (order: Group -> PO -> KO)
  const [includeGroup, setIncludeGroup] = useState(true);
  const [includePO, setIncludePO] = useState(false);

  // Group defaults
  const [groupCount, setGroupCount] = useState(4);
  const [groupSize, setGroupSize] = useState(4); // dùng khi không nhập tổng số đội
  const [groupTotal, setGroupTotal] = useState(0); // tổng số đội (chia đều, dư dồn bảng cuối)
  const [groupTopN, setGroupTopN] = useState(1); // ⭐ Top N/bảng đổ vào KO

  // PO defaults (non-2^n)
  const [poPlan, setPoPlan] = useState({ drawSize: 8, maxRounds: 1, seeds: [] });

  // KO defaults
  const [koPlan, setKoPlan] = useState({ drawSize: 16, seeds: [] });

  // ===== Rules per stage =====
  const [groupRules, setGroupRules] = useState(DEFAULT_RULES);
  const [poRules, setPoRules] = useState(DEFAULT_RULES);
  const [koRules, setKoRules] = useState(DEFAULT_RULES);
  // KO Final override
  const [koFinalOverride, setKoFinalOverride] = useState(false);
  const [koFinalRules, setKoFinalRules] = useState({ bestOf: 5, pointsToWin: 11, winByTwo: true });

  // 🔹 NEW: cờ & tùy chọn ghi đè
  const [prefilledFromExisting, setPrefilledFromExisting] = useState(false);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const prefillOnceRef = useRef(false);

  // Tính groupSizes hiển thị (ưu tiên total)
  const groupSizes = useMemo(() => {
    if (!includeGroup || groupCount <= 0) return [];
    const total = Math.max(0, Number(groupTotal) || 0);
    if (total > 0) {
      const base = Math.floor(total / groupCount);
      const remainder = total - base * groupCount;
      const arr = new Array(groupCount).fill(base);
      if (groupCount > 0) arr[groupCount - 1] += remainder; // dồn dư vào bảng cuối
      return arr;
    }
    return new Array(groupCount).fill(Math.max(0, Number(groupSize) || 0));
  }, [includeGroup, groupCount, groupSize, groupTotal]);

  // Min size của các bảng (để giới hạn Top N)
  const minGroupSize = useMemo(() => {
    if (!includeGroup || !groupSizes.length) return Math.max(0, Number(groupSize) || 0);
    return Math.max(0, Math.min(...groupSizes.map((v) => Number(v) || 0)));
  }, [includeGroup, groupSizes, groupSize]);

  // computed stages (UI preview only)
  const stages = useMemo(() => {
    const arr = [];
    if (includeGroup) {
      arr.push({
        id: makeStageId(arr.length),
        type: "group",
        title: "Vòng bảng",
        config: {
          groupCount,
          groupSize, // giữ để hiển thị legacy
          groups: Array.from({ length: groupCount }, (_, i) => String(i + 1)),
          groupSizes, // ⭐ kích thước từng bảng đã tính
          matchesPerGroupArr: groupSizes.map((sz) => RR_MATCHES(sz)),
        },
      });
    }
    if (includePO) {
      arr.push({
        id: makeStageId(arr.length),
        type: "po",
        title: "Play-Off (cắt bớt)",
        config: { ...poPlan },
      });
    }
    arr.push({ id: makeStageId(arr.length), type: "ko", title: "Knockout", config: { ...koPlan } });
    return arr;
  }, [includeGroup, includePO, groupCount, groupSize, groupSizes, poPlan, koPlan]);

  const stageIdxOf = (stageId) => stages.findIndex((s) => s.id === stageId);

  // seed picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // { stageIdx, pair, slot }

  const openPicker = (stageIdx, pair, slot) => {
    setPickerTarget({ stageIdx, pair, slot });
    setPickerOpen(true);
  };

  const putSeed = (stageIdx, pair, slot, seedObj) => {
    const stage = stages[stageIdx];
    if (!stage || (stage.type !== "po" && stage.type !== "ko")) return;
    const setPlan = stage.type === "po" ? setPoPlan : setKoPlan;

    setPlan((prev) => {
      const cur = { ...prev };
      let firstPairs = 1;
      if (stage.type === "po") {
        firstPairs = Math.max(1, Math.ceil((cur.drawSize || 0) / 2));
      } else {
        const size = Math.max(2, nextPow2(cur.drawSize || 2));
        firstPairs = size / 2;
      }
      const list = [...(cur.seeds || [])];
      const idx = list.findIndex((s) => Number(s.pair) === pair);
      if (idx >= 0) {
        const it = { ...list[idx] };
        it[slot] = seedObj;
        list[idx] = it;
      } else {
        const it = { pair, A: null, B: null };
        it[slot] = seedObj;
        list.push(it);
      }
      const cleaned = list
        .filter((s) => Number(s.pair) >= 1 && Number(s.pair) <= firstPairs)
        .sort((a, b) => Number(a.pair) - Number(b.pair));
      return { ...cur, seeds: cleaned };
    });
  };

  const renderEditableBracket = (stageIdx) => {
    const stage = stages[stageIdx];
    if (stage.type === "po") {
      const rounds = buildPoRoundsFromPlan(poPlan, stageIdx + 1);
      return (
        <Bracket
          rounds={rounds}
          renderSeedComponent={({ seed }) => {
            const A = seed?.teams?.[0];
            const B = seed?.teams?.[1];
            const pair = A?.__pair || B?.__pair; // chỉ có ở R1
            if (!pair) {
              return (
                <Seed>
                  <SeedItem>
                    <div style={{ display: "grid", gap: 4 }}>
                      <SeedTeam>{A?.name || "—"}</SeedTeam>
                      <SeedTeam>{B?.name || "—"}</SeedTeam>
                    </div>
                  </SeedItem>
                </Seed>
              );
            }
            return (
              <Seed>
                <SeedItem>
                  <div style={{ display: "grid", gap: 4 }}>
                    <SeedTeam>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => openPicker(stageIdx, pair, "A")}
                      >
                        {A?.name || "—"}
                      </Button>
                    </SeedTeam>
                    <SeedTeam>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => openPicker(stageIdx, pair, "B")}
                      >
                        {B?.name || "—"}
                      </Button>
                    </SeedTeam>
                  </div>
                </SeedItem>
              </Seed>
            );
          }}
          mobileBreakpoint={0}
        />
      );
    }
    // KO
    const rounds = buildRoundsFromPlan(koPlan, stageIdx + 1);
    return (
      <Bracket
        rounds={rounds}
        renderSeedComponent={({ seed }) => {
          const A = seed?.teams?.[0];
          const B = seed?.teams?.[1];
          const pair = A?.__pair || B?.__pair; // chỉ có ở R1
          if (!pair) {
            return (
              <Seed>
                <SeedItem>
                  <div style={{ display: "grid", gap: 4 }}>
                    <SeedTeam>{A?.name || "—"}</SeedTeam>
                    <SeedTeam>{B?.name || "—"}</SeedTeam>
                  </div>
                </SeedItem>
              </Seed>
            );
          }
          return (
            <Seed>
              <SeedItem>
                <div style={{ display: "grid", gap: 4 }}>
                  <SeedTeam>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => openPicker(stageIdx, pair, "A")}
                    >
                      {A?.name || "—"}
                    </Button>
                  </SeedTeam>
                  <SeedTeam>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => openPicker(stageIdx, pair, "B")}
                    >
                      {B?.name || "—"}
                    </Button>
                  </SeedTeam>
                </div>
              </SeedItem>
            </Seed>
          );
        }}
        mobileBreakpoint={0}
      />
    );
  };

  const [planTournament] = usePlanTournamentMutation();
  const [commitTournamentPlan, { isLoading: committing }] = useCommitTournamentPlanMutation();

  const autoSuggest = async () => {
    try {
      const body = {
        expectedTeams: Number(tournament?.expected || 0),
        allowGroup: includeGroup,
        allowPO: includePO,
        allowKO: true,
        eventType: tournament?.eventType || "double",
      };
      const resp = await planTournament({ tournamentId, body }).unwrap();
      toast.success("Đã tạo gợi ý sơ đồ");
      if (resp?.groups && includeGroup) {
        setGroupCount(resp.groups.count || groupCount);
        setGroupSize(resp.groups.size || groupSize);
        // không động vào groupTotal – để bạn tự nhập khi cần
      }
      if (resp?.po && includePO)
        setPoPlan((p) => ({
          drawSize: resp.po.drawSize,
          maxRounds: Math.min(maxPoRoundsFor(resp.po.drawSize), p.maxRounds || 1),
          seeds: resp.po.seeds || [],
        }));
      if (resp?.ko) setKoPlan({ drawSize: resp.ko.drawSize, seeds: resp.ko.seeds || [] });
    } catch (e) {
      toast.error("Gợi ý tự động lỗi – bạn có thể cấu hình tay ở tab bên cạnh");
    }
  };

  // Prefill KO R1 seeds from PO winners of V1..Vmax
  const prefillKOfromPO = () => {
    const poIdx = stages.findIndex((s) => s.type === "po");
    if (poIdx < 0) return toast.info("Chưa bật PO để đổ seed sang KO");
    const qualifiers = computePoQualifiers(poPlan, poIdx);
    setKoPlan((prev) => {
      const size = Math.max(2, nextPow2(Number(prev.drawSize || 2)));
      const firstPairs = size / 2;
      const pairs = Array.from({ length: firstPairs }, (_, i) => {
        const A = qualifiers[2 * i] || { type: "bye", ref: null, label: "BYE" };
        const B = qualifiers[2 * i + 1] || { type: "bye", ref: null, label: "BYE" };
        return { pair: i + 1, A, B };
      });
      toast.success(`Đã đổ ${Math.min(qualifiers.length, firstPairs * 2)} seed từ PO sang KO`);
      return { drawSize: size, seeds: pairs };
    });
  };

  // ⭐ Prefill KO R1 seeds from GROUPS (Top-N per group)
  const prefillKOfromGroups = () => {
    const gIdx = stages.findIndex((s) => s.type === "group");
    if (gIdx < 0) return toast.info("Chưa bật vòng bảng để đổ seed sang KO");

    // hạn chế TopN theo minGroupSize
    const N = Math.max(1, Math.min(Number(groupTopN) || 1, minGroupSize || 1));
    const qualifiers = computeGroupQualifiers(stages[gIdx], gIdx, N);

    setKoPlan((prev) => {
      const size = Math.max(2, nextPow2(Number(prev.drawSize || 2)));
      const firstPairs = size / 2;
      const capacity = firstPairs * 2;

      const used = Math.min(capacity, qualifiers.length);
      const seedsLinear = qualifiers.slice(0, capacity);
      // pad BYE nếu thiếu
      while (seedsLinear.length < capacity) {
        seedsLinear.push({ type: "bye", ref: null, label: "BYE" });
      }

      const pairs = Array.from({ length: firstPairs }, (_, i) => {
        const A = seedsLinear[2 * i];
        const B = seedsLinear[2 * i + 1];
        return { pair: i + 1, A, B };
      });

      toast.success(
        `Đã đổ ${used}/${qualifiers.length} seed từ Vòng bảng sang KO (Top ${N}/bảng)${
          qualifiers.length > capacity ? " • KO hiện không đủ chỗ, hãy tăng drawSize nếu cần" : ""
        }`
      );
      return { drawSize: size, seeds: pairs };
    });
  };

  // 🔹 NEW: Prefill từ sơ đồ đã có (brackets)
  const prefillFromExisting = (list) => {
    if (!Array.isArray(list) || !list.length) return;

    // Ưu tiên theo type: group / po / ko
    const bGroup = list.find((b) => b.type === "group");
    const bPO = list.find((b) => b.type === "po");
    const bKO = list.find((b) => b.type === "ko");

    // Group
    if (bGroup) {
      const cfg = bGroup.config || {};
      const groupsArr = Array.isArray(cfg.groups) ? cfg.groups : [];
      const gCount = groupsArr.length || Number(cfg.groupCount || 0) || 0;

      // cố gắng khôi phục đúng tổng đội
      const sizes = Array.isArray(cfg.groupSizes) ? cfg.groupSizes : [];
      const sum = sizes.reduce((a, b) => a + (Number(b) || 0), 0);
      const gSize = Number(cfg.groupSize || 0);
      const qualifiersPerGroup =
        Number(cfg.qualifiersPerGroup || bGroup.meta?.qualifiersPerGroup || 1) || 1;

      setIncludeGroup(true);
      setGroupCount(gCount || 0);
      if (sum > 0) {
        setGroupTotal(sum);
        // groupSize giữ hiển thị; không ảnh hưởng khi groupTotal > 0
        setGroupSize(gSize || (gCount ? Math.floor(sum / gCount) : 0));
      } else {
        setGroupTotal(0);
        setGroupSize(gSize || 0);
      }
      setGroupTopN(Math.max(1, qualifiersPerGroup));
      // rules
      const rules = bGroup.rules || cfg.rules || DEFAULT_RULES;
      setGroupRules({
        bestOf: Number(rules.bestOf ?? DEFAULT_RULES.bestOf),
        pointsToWin: Number(rules.pointsToWin ?? DEFAULT_RULES.pointsToWin),
        winByTwo: !!(rules.winByTwo ?? DEFAULT_RULES.winByTwo),
      });
    } else {
      setIncludeGroup(false);
    }

    // PO
    if (bPO) {
      const cfg = bPO.config || {};
      const drawSize = Number(cfg.drawSize || 0);
      const maxRounds = Number(cfg.maxRounds || maxPoRoundsFor(drawSize) || 1);
      const seeds = Array.isArray(cfg.seeds) ? cfg.seeds : [];
      setIncludePO(true);
      setPoPlan({ drawSize, maxRounds, seeds });
      const rules = bPO.rules || cfg.rules || DEFAULT_RULES;
      setPoRules({
        bestOf: Number(rules.bestOf ?? DEFAULT_RULES.bestOf),
        pointsToWin: Number(rules.pointsToWin ?? DEFAULT_RULES.pointsToWin),
        winByTwo: !!(rules.winByTwo ?? DEFAULT_RULES.winByTwo),
      });
    } else {
      setIncludePO(false);
      setPoPlan((p) => ({ ...p, seeds: [] }));
    }

    // KO
    if (bKO) {
      const cfg = bKO.config || {};
      const drawSize = Number(cfg.drawSize || 2);
      const seeds = Array.isArray(cfg.seeds) ? cfg.seeds : [];
      setKoPlan({ drawSize, seeds });

      const rules = bKO.rules || cfg.rules || DEFAULT_RULES;
      setKoRules({
        bestOf: Number(rules.bestOf ?? DEFAULT_RULES.bestOf),
        pointsToWin: Number(rules.pointsToWin ?? DEFAULT_RULES.pointsToWin),
        winByTwo: !!(rules.winByTwo ?? DEFAULT_RULES.winByTwo),
      });

      const finalRules = bKO.finalRules || cfg.finalRules || null;
      if (finalRules) {
        setKoFinalOverride(true);
        setKoFinalRules({
          bestOf: Number(finalRules.bestOf ?? 5),
          pointsToWin: Number(finalRules.pointsToWin ?? 11),
          winByTwo: !!(finalRules.winByTwo ?? true),
        });
      } else {
        setKoFinalOverride(false);
      }
    }

    // Bật tab Manual xem/chỉnh luôn
    setTab("manual");
    setPrefilledFromExisting(true);
  };

  // 🔹 chạy prefill 1 lần khi có dữ liệu brackets
  useEffect(() => {
    if (prefillOnceRef.current) return;
    if (!loadingBrackets && Array.isArray(existingBrackets) && existingBrackets.length) {
      prefillFromExisting(existingBrackets);
      prefillOnceRef.current = true;
    }
  }, [loadingBrackets, existingBrackets]);

  const commitPlan = async () => {
    try {
      const hasGroup = includeGroup && groupCount > 0;
      const total = Math.max(0, Number(groupTotal) || 0);
      const qpg = Math.max(1, Math.min(Number(groupTopN) || 1, minGroupSize || 1)); // ⭐ qualifiersPerGroup

      const groupsPayload = hasGroup
        ? total > 0
          ? { count: groupCount, totalTeams: total, qualifiersPerGroup: qpg, rules: groupRules }
          : { count: groupCount, size: groupSize, qualifiersPerGroup: qpg, rules: groupRules }
        : null;

      const payload = {
        groups: groupsPayload,
        po: includePO ? { ...normalizeSeedsPO(poPlan), rules: poRules } : null,
        ko: {
          ...normalizeSeedsKO(koPlan),
          rules: koRules,
          finalRules: koFinalOverride ? koFinalRules : null, // ⭐ riêng cho Chung kết KO
        },
        // tuỳ backend có hỗ trợ force/overwrite không; nếu có, thêm { force: true }
        ...(allowOverwrite ? { force: true } : {}),
      };

      await commitTournamentPlan({ tournamentId, body: payload }).unwrap();
      toast.success(allowOverwrite ? "Đã ghi đè & tạo lại sơ đồ!" : "Đã tạo sơ đồ/khung giải!");
      navigate(`/admin/tournaments/${tournamentId}/brackets`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Tạo sơ đồ thất bại.");
    }
  };

  if (isLoading || loadingBrackets) return <Box p={4}>Loading…</Box>;
  if (error || bracketsError) return <Box p={4}>Lỗi tải dữ liệu.</Box>;

  const hasExisting = Array.isArray(existingBrackets) && existingBrackets.length > 0;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            Tạo sơ đồ • {tournament?.name}
          </Typography>
          <Chip size="small" label={(tournament?.eventType || "").toUpperCase()} sx={{ ml: 1 }} />
        </Stack>

        {/* 🔹 Banner nếu đã có sơ đồ */}
        {hasExisting && (
          <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
            <AlertTitle>Giải này đã có sơ đồ (brackets) rồi</AlertTitle>
            Hệ thống đã tự nạp lại cấu hình vào tab “Tự thiết kế & Seed map” để anh chỉnh tiếp nếu
            cần.
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
              <Button
                variant="contained"
                onClick={() => navigate(`/admin/tournaments/${tournamentId}/brackets`)}
              >
                Đi tới quản trị bracket
              </Button>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allowOverwrite}
                    onChange={(e) => setAllowOverwrite(e.target.checked)}
                  />
                }
                label="Ghi đè sơ đồ hiện tại khi bấm Tạo sơ đồ"
              />
            </Stack>
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Option 1: Gợi ý (Auto)" value="auto" />
            <Tab label="Option 2: Tự thiết kế & Seed map" value="manual" />
          </Tabs>

          {tab === "auto" ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeGroup}
                      onChange={(e) => setIncludeGroup(e.target.checked)}
                    />
                  }
                  label="Có vòng bảng"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includePO}
                      onChange={(e) => setIncludePO(e.target.checked)}
                    />
                  }
                  label="Có vòng PO (cắt bớt)"
                />
              </Stack>
              <Button variant="contained" onClick={autoSuggest} sx={{ width: 200 }}>
                Gợi ý tự động
              </Button>
            </Stack>
          ) : (
            <Stack spacing={3}>
              {/* ===== Group config ===== */}
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeGroup}
                      onChange={(e) => setIncludeGroup(e.target.checked)}
                    />
                  }
                  label="Thêm Vòng bảng (Vx)"
                />
                {includeGroup && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      label="Số bảng"
                      value={groupCount}
                      onChange={(e) => setGroupCount(parseInt(e.target.value || "0", 10))}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Số đội / bảng (nếu không nhập tổng)"
                      value={groupSize}
                      onChange={(e) => setGroupSize(parseInt(e.target.value || "0", 10))}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Tổng số đội (tuỳ chọn)"
                      value={groupTotal}
                      onChange={(e) => setGroupTotal(parseInt(e.target.value || "0", 10))}
                      helperText="Nếu >0: chia đều, dư dồn bảng cuối"
                    />
                    <Divider orientation="vertical" flexItem />
                    {/* ⭐ Top N/bảng để đổ KO */}
                    <TextField
                      size="small"
                      type="number"
                      label={`Top N/bảng (≤ ${Math.max(1, minGroupSize || 1)})`}
                      value={groupTopN}
                      onChange={(e) =>
                        setGroupTopN(
                          Math.max(
                            1,
                            Math.min(
                              parseInt(e.target.value || "1", 10),
                              Math.max(1, minGroupSize || 1)
                            )
                          )
                        )
                      }
                      sx={{ width: 180 }}
                    />
                    <Chip
                      size="small"
                      label={`Min size bảng hiện tại: ${Math.max(0, minGroupSize || 0)}`}
                    />
                    <Button variant="outlined" onClick={prefillKOfromGroups}>
                      Đổ seed KO từ Vòng bảng
                    </Button>
                  </Stack>
                )}
              </Stack>

              {includeGroup && (
                <Box sx={{ mt: 1 }}>
                  {/* Rules cho Group */}
                  <RulesEditor
                    label="Luật (Vòng bảng)"
                    value={groupRules}
                    onChange={setGroupRules}
                  />
                </Box>
              )}

              {/* ===== PO config ===== */}
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includePO}
                      onChange={(e) => setIncludePO(e.target.checked)}
                    />
                  }
                  label="Thêm Play-Off (PO) trước KO"
                />
                {includePO && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      label="PO drawSize"
                      value={poPlan.drawSize}
                      onChange={(e) => {
                        const ds = parseInt(e.target.value || "0", 10);
                        const maxPossible = maxPoRoundsFor(ds);
                        setPoPlan((p) => ({
                          ...p,
                          drawSize: ds,
                          maxRounds: Math.max(1, Math.min(maxPossible, p.maxRounds || 1)),
                        }));
                      }}
                    />

                    <Stack direction="column" spacing={0.5} sx={{ minWidth: 220 }}>
                      <Typography variant="caption" color="text.secondary">
                        PO tối đa bao nhiêu vòng?
                      </Typography>
                      <Select
                        size="small"
                        value={poPlan.maxRounds || 1}
                        onChange={(e) => {
                          const v = parseInt(e.target.value || "1", 10);
                          const maxPossible = maxPoRoundsFor(poPlan.drawSize);
                          setPoPlan((p) => ({
                            ...p,
                            maxRounds: Math.max(1, Math.min(maxPossible, v)),
                          }));
                        }}
                      >
                        {Array.from({ length: maxPoRoundsFor(poPlan.drawSize) }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>{`V${i + 1} (dừng sau vòng ${
                            i + 1
                          })`}</MenuItem>
                        ))}
                      </Select>
                    </Stack>

                    <Chip
                      size="small"
                      label={`PO V1: ${poMatchesForRound(
                        poPlan.drawSize,
                        1
                      )} trận • V tối đa: ${maxPoRoundsFor(poPlan.drawSize)}`}
                    />

                    <Button variant="outlined" onClick={prefillKOfromPO}>
                      Đổ seed KO từ PO
                    </Button>
                  </Stack>
                )}
              </Stack>

              {includePO && (
                <Box sx={{ mt: 1 }}>
                  {/* Rules cho PO */}
                  <RulesEditor label="Luật (PO)" value={poRules} onChange={setPoRules} />
                </Box>
              )}

              {/* ===== KO config ===== */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                <TextField
                  size="small"
                  type="number"
                  label="KO drawSize"
                  value={koPlan.drawSize}
                  onChange={(e) =>
                    setKoPlan((p) => ({ ...p, drawSize: parseInt(e.target.value || "2", 10) }))
                  }
                />
                <Chip
                  size="small"
                  label={`KO R1: ${Math.max(1, nextPow2(koPlan.drawSize) / 2)} cặp`}
                />
              </Stack>

              <Box sx={{ mt: 1 }}>
                {/* Rules cho KO + override Chung kết */}
                <RulesEditor label="Luật (KO)" value={koRules} onChange={setKoRules} />

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems="center"
                  sx={{ mt: 1 }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={koFinalOverride}
                        onChange={(e) => setKoFinalOverride(e.target.checked)}
                      />
                    }
                    label="Dùng Rule riêng cho trận Chung kết (KO)"
                  />
                  {koFinalOverride && (
                    <RulesEditor
                      label="Luật Chung kết (KO)"
                      value={koFinalRules}
                      onChange={setKoFinalRules}
                    />
                  )}
                </Stack>
              </Box>

              <Divider />

              {/* ===== Stage preview & seeding ===== */}
              {stages.map((stage, idx) => (
                <Paper key={stage.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 1, flexWrap: "wrap" }}
                  >
                    <Chip color="primary" size="small" label={stage.id} />
                    <Typography variant="h6" fontWeight={700}>
                      {stage.title}
                    </Typography>
                    <Chip size="small" label={stage.type.toUpperCase()} />

                    {/* Rule summary chips */}
                    <Stack direction="row" spacing={1} sx={{ ml: 1, flexWrap: "wrap" }}>
                      {stage.type === "group" && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Rule: BO${groupRules.bestOf} • ${groupRules.pointsToWin} điểm • ${
                            groupRules.winByTwo ? "Win by 2" : "No win-by-2"
                          }`}
                        />
                      )}
                      {stage.type === "po" && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Rule: BO${poRules.bestOf} • ${poRules.pointsToWin} điểm • ${
                            poRules.winByTwo ? "Win by 2" : "No win-by-2"
                          }`}
                        />
                      )}
                      {stage.type === "ko" && (
                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Rule: BO${koRules.bestOf} • ${koRules.pointsToWin} điểm • ${
                              koRules.winByTwo ? "Win by 2" : "No win-by-2"
                            }`}
                          />
                          {koFinalOverride && (
                            <Chip
                              size="small"
                              color="secondary"
                              variant="outlined"
                              label={`Final: BO${koFinalRules.bestOf} • ${
                                koFinalRules.pointsToWin
                              } điểm • ${koFinalRules.winByTwo ? "Win by 2" : "No win-by-2"}`}
                            />
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Stack>

                  {stage.type === "group" && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {`Số bảng: ${stage.config.groupCount}${
                          (groupTotal || 0) > 0
                            ? ` • Tổng số đội: ${groupTotal} (chia đều, dư dồn bảng cuối)`
                            : ` • Mỗi bảng dự kiến: ${stage.config.groupSize} đội`
                        } • Top N/bảng để đổ KO: ${Math.max(
                          1,
                          Math.min(Number(groupTopN) || 1, Math.max(1, minGroupSize || 1))
                        )}`}
                      </Typography>

                      <Stack gap={2}>
                        {stage.config.groups.map((g, gi) => {
                          const sizes = stage.config.groupSizes || [];
                          const sizeThis = sizes[gi] ?? stage.config.groupSize ?? 0;

                          // tính offset start id theo tổng các bảng trước
                          const start = sizes.slice(0, gi).reduce((a, b) => a + (b || 0), 0) + 1;

                          const names = Array.from(
                            { length: sizeThis },
                            (_, j) => `Đội ${start + j}`
                          );

                          return (
                            <Paper key={g} variant="outlined" sx={{ p: 1.5 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Chip size="small" color="secondary" label={`B${g}`} />
                                <Typography variant="subtitle2">
                                  {`Dự kiến ${sizeThis} đội • ${RR_MATCHES(sizeThis)} trận`}
                                </Typography>
                              </Stack>
                              <Stack direction="row" gap={1} flexWrap="wrap">
                                {names.map((n) => (
                                  <Chip key={n} label={n} size="small" />
                                ))}
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </>
                  )}

                  {(stage.type === "po" || stage.type === "ko") && (
                    <Box sx={{ overflowX: "auto" }}>{renderEditableBracket(idx)}</Box>
                  )}
                </Paper>
              ))}

              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip
                  title={
                    hasExisting && !allowOverwrite
                      ? "Giải đã có sơ đồ. Tích 'Ghi đè sơ đồ hiện tại' để tạo lại."
                      : ""
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      onClick={commitPlan}
                      disabled={committing || (hasExisting && !allowOverwrite)}
                      sx={{ color: "white !important" }}
                    >
                      {hasExisting && allowOverwrite ? "Ghi đè & tạo lại sơ đồ" : "Tạo sơ đồ"}
                    </Button>
                  </span>
                </Tooltip>
                <Button variant="outlined" onClick={() => navigate(-1)}>
                  Quay lại
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>

        {/* Universal Seed Picker with V/B/T codes */}
        <SeedPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          stages={stages.map((s) => ({ ...s, id: s.id }))}
          currentStageIndex={pickerTarget?.stageIdx ?? stages.length - 1}
          onPick={(seed) => {
            if (pickerTarget)
              putSeed(pickerTarget.stageIdx, pickerTarget.pair, pickerTarget.slot, seed);
            setPickerOpen(false);
          }}
        />
      </Box>
    </DashboardLayout>
  );
}
