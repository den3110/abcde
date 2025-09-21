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
  useGetTournamentBracketsQuery,
} from "slices/tournamentsApiSlice";
import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

/* ===== Helpers ===== */
const ceilPow2 = (n) => (n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n)));
const nextPow2 = ceilPow2;
const RR_MATCHES = (size) => (size >= 2 ? (size * (size - 1)) / 2 : 0);
const makeStageId = (idx) => `V${idx + 1}`; // V1, V2,...
const BYE = { type: "bye", ref: null, label: "BYE" };

/* ===== PO (non-2^n) helpers ===== */
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

/* ===== PO rematch helpers for ladder (ước lượng theo losers-cascade) ===== */
function _extractRoundOrder1(seed) {
  // order trả về 1-based
  const r = Number(seed?.ref?.round || 0);
  const t1 = Number((seed?.ref?.order ?? -1) + 1);
  return { r, t1 };
}
/** Trong PO losers-cascade:
 *  Winner ở Vr, thứ tự t1 => đến từ block losers V1 có kích thước 2^(r-1), bắt đầu tại (t1-1)*block+1
 *  n1 = số trận V1 (ceil(drawSize/2))
 */
function _v1BlockRangeFor(weakRound, t1, n1) {
  const bs = Math.max(1, 1 << Math.max(0, weakRound - 1)); // 2^(r-1)
  const start = (t1 - 1) * bs + 1;
  const end = Math.min(n1, start + bs - 1);
  return [start, end];
}
/** Ước lượng: a và b đã gặp nhau ở PO chưa?
 *  - Nếu một là W-V1-Tx và cái kia là W-Vr-Ty (r>=2), kiểm tra Tx có nằm trong block V1 losers của Ty không.
 *  - Trường hợp cả hai đều r>=2: bỏ qua (không chắc chắn), coi như không đánh dấu "đã gặp".
 */
function _hasRematchPO(a, b, poDrawSize) {
  if (!a || !b) return false;
  if (a.type !== "stageMatchWinner" || b.type !== "stageMatchWinner") return false;

  const n1 = poMatchesForRound(poDrawSize, 1); // số trận V1
  const { r: ra, t1: ta } = _extractRoundOrder1(a);
  const { r: rb, t1: tb } = _extractRoundOrder1(b);

  if (ra === 1 && rb >= 2) {
    const [lo, hi] = _v1BlockRangeFor(rb, tb, n1);
    return ta >= lo && ta <= hi;
  }
  if (rb === 1 && ra >= 2) {
    const [lo, hi] = _v1BlockRangeFor(ra, ta, n1);
    return tb >= lo && tb <= hi;
  }
  return false; // cả hai r>=2: không khẳng định -> không tính là tái đấu
}

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

/* ====== Rules Editor + CAP ====== */
const DEFAULT_RULES = {
  bestOf: 3,
  pointsToWin: 11,
  winByTwo: true,
  cap: { mode: "none", points: null },
};
const normalizeRulesForState = (r = {}) => ({
  bestOf: Number(r.bestOf ?? DEFAULT_RULES.bestOf),
  pointsToWin: Number(r.pointsToWin ?? DEFAULT_RULES.pointsToWin),
  winByTwo: !!(r.winByTwo ?? DEFAULT_RULES.winByTwo),
  cap: {
    mode: String(r?.cap?.mode ?? "none"),
    points: r?.cap?.points === null || r?.cap?.points === undefined ? null : Number(r.cap.points),
  },
});
const ruleSummary = (r) => {
  const base = `BO${r.bestOf} • ${r.pointsToWin} điểm • ${r.winByTwo ? "Win by 2" : "No win-by-2"}`;
  const cap =
    r?.cap?.mode && r.cap.mode !== "none"
      ? ` • Cap: ${r.cap.mode}${Number.isFinite(Number(r.cap.points)) ? ` @${r.cap.points}` : ""}`
      : "";
  return base + cap;
};

function RulesEditor({ label = "Luật trận", value, onChange }) {
  const v = normalizeRulesForState(value);
  const set = (patch) => onChange({ ...v, ...patch });

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
        value={v.bestOf}
        onChange={(e) => set({ bestOf: parseInt(e.target.value || "3", 10) })}
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
        value={v.pointsToWin}
        onChange={(e) => set({ pointsToWin: parseInt(e.target.value || "11", 10) })}
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
            checked={!!v.winByTwo}
            onChange={(e) => set({ winByTwo: !!e.target.checked })}
          />
        }
        label="Thắng cách 2 điểm"
      />

      {/* CAP */}
      <TextField
        select
        size="small"
        label="Cap mode"
        value={v.cap.mode}
        onChange={(e) => set({ cap: { ...v.cap, mode: e.target.value } })}
        sx={{ width: 160 }}
      >
        <MenuItem value="none">none</MenuItem>
        <MenuItem value="soft">soft</MenuItem>
        <MenuItem value="hard">hard</MenuItem>
      </TextField>

      <TextField
        size="small"
        type="number"
        label="Cap points"
        value={v.cap.points ?? ""}
        onChange={(e) =>
          set({
            cap: {
              ...v.cap,
              points: e.target.value === "" ? null : parseInt(e.target.value || "0", 10),
            },
          })
        }
        sx={{ width: 140 }}
        disabled={v.cap.mode === "none"}
        placeholder={v.cap.mode === "none" ? "—" : "e.g. 15"}
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
    cap: PropTypes.shape({
      mode: PropTypes.string,
      points: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    }),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

/** Build KO rounds (R editable; R>=2 winners auto) với baseRound
 *  — dùng mã winner theo V hiển thị (đã offset) */
function buildRoundsFromPlan(planKO, stageIndex = 1, baseRound = 1) {
  const drawSize = Math.max(2, nextPow2(planKO?.drawSize || 2));
  const firstPairs = drawSize / 2;

  // Vòng hiển thị đầu
  const r1Display = baseRound;

  const r1 = Array.from({ length: firstPairs }, (_, i) => {
    const found = (planKO?.seeds || []).find((s) => Number(s.pair) === i + 1);
    const A = found?.A || { type: "registration", label: "—" };
    const B = found?.B || { type: "registration", label: "—" };
    return {
      id: `R${r1Display}-${i + 1}`,
      pairIndex: i + 1,
      teams: [
        { name: seedLabel(A), __seed: A, __pair: i + 1, __slot: "A" },
        { name: seedLabel(B), __seed: B, __pair: i + 1, __slot: "B" },
      ],
    };
  });

  const rounds = [{ title: roundTitleByPairs(firstPairs), seeds: r1 }];

  let prevPairs = firstPairs;
  let prevRound = r1;
  let roundNum = 2; // round nội bộ của KO (1 đã vẽ ở trên)

  while (prevPairs > 1) {
    const pairs = Math.ceil(prevPairs / 2);

    // Vòng hiển thị của vòng hiện tại & vòng trước nó
    const displayRound = baseRound + (roundNum - 1);
    const prevDisplayRound = baseRound + (roundNum - 2);

    const thisSeeds = Array.from({ length: pairs }, (_, i) => {
      const prevA = prevRound[i * 2];
      const prevB = prevRound[i * 2 + 1];
      const tLeft = prevA?.pairIndex || i * 2 + 1;
      const tRight = prevB?.pairIndex || i * 2 + 2;

      // DÙNG V hiển thị cho mã winner: W-V{prevDisplayRound}-T{...}
      return {
        id: `R${displayRound}-${i + 1}`,
        teams: [
          { name: `W-V${prevDisplayRound}-T${tLeft}` },
          { name: `W-V${prevDisplayRound}-T${tRight}` },
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

/* ========================= PO (losers-cascade) builder (non-2^n) với baseRound ========================= */
function buildPoRoundsFromPlan(planPO, stageIndex = 1, baseRound = 1) {
  const N = Math.max(0, Number(planPO?.drawSize || 0));
  const maxR = Math.max(1, Math.min(maxPoRoundsFor(N), Number(planPO?.maxRounds || 1)));
  const rounds = [];

  // Vòng hiển thị đầu tiên
  const r1Display = baseRound;

  // V1 (editable) nhưng id hiển thị là R{baseRound}
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
      id: `R${r1Display}-${i + 1}`, // <-- đổi id theo baseRound
      pairIndex: i + 1,
      teams: [
        { name: seedLabel(A), __seed: A, __pair: i + 1, __slot: "A" },
        { name: seedLabel(B), __seed: B, __pair: i + 1, __slot: "B" },
      ],
    };
  });
  rounds.push({ title: `PO • Vòng ${r1Display} (${r1Seeds.length} trận)`, seeds: r1Seeds });

  // V>=2: losers cascade
  let losersPool = Math.floor(N / 2);
  let roundNum = 2;

  while (roundNum <= maxR && losersPool > 0) {
    const pairs = Math.max(1, Math.ceil(losersPool / 2));
    const displayRound = baseRound + (roundNum - 1); // <-- số vòng hiển thị

    const seeds = Array.from({ length: pairs }, (_, i) => {
      const leftIdx = 2 * i + 1;
      const rightIdx = 2 * i + 2;
      const left = { name: `L-V${roundNum - 1}-T${leftIdx}` }; // giữ V nội bộ
      const right =
        rightIdx <= losersPool ? { name: `L-V${roundNum - 1}-T${rightIdx}` } : { name: "BYE" };
      return { id: `R${displayRound}-${i + 1}`, teams: [left, right] };
    });

    rounds.push({ title: `PO • Vòng ${displayRound} (${pairs} trận)`, seeds });
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

/* ===== Group → qualifiers matrix ===== */
function buildGroupQualMatrix(groupStage, groupStageIndex, topN) {
  const stNum = groupStageIndex + 1;
  const groups = (groupStage?.config?.groups || []).map(String);
  const N = Math.max(1, Number(topN) || 1);

  const ranks = Array.from({ length: N }, (_, r) =>
    groups.map((g) => ({
      type: "groupRank",
      ref: { stage: stNum, groupCode: g, rank: r + 1 },
      label: `V${stNum}-B${g}-#${r + 1}`,
      __group: g,
      __rank: r + 1,
    }))
  );
  return { groups, ranks };
}

// Random có seed
function seededShuffle(arr, seedStr = "42") {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rand() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  }
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i++) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===== BYE helpers & fixers ===== */
const isBye = (s) => s?.type === "bye" || s?.label === "BYE" || s?.name === "BYE";
/** Sửa cặp BYE–BYE bằng cách mượn 1 đội từ cặp phía sau */
function fixDoubleByes(pairs) {
  const totalPairs = pairs.length;
  const nonByeCount = pairs.reduce(
    (acc, p) => acc + (isBye(p.A) ? 0 : 1) + (isBye(p.B) ? 0 : 1),
    0
  );
  if (nonByeCount === 0) return pairs;

  // Không đủ 1 đội/ cặp: dàn đều 1 đội vào các cặp BYE–BYE trước
  if (nonByeCount < totalPairs) {
    const pool = [];
    for (const p of pairs) {
      if (!isBye(p.A)) pool.push(p.A);
      if (!isBye(p.B)) pool.push(p.B);
    }
    for (let i = 0; i < pairs.length && pool.length; i++) {
      if (isBye(pairs[i].A) && isBye(pairs[i].B)) {
        pairs[i].A = pool.shift();
      }
    }
    return pairs;
  }

  // Đủ 1 đội/ cặp: loại bỏ BYE–BYE bằng swap từ cặp sau
  for (let i = 0; i < pairs.length; i++) {
    if (isBye(pairs[i].A) && isBye(pairs[i].B)) {
      // Ưu tiên mượn B từ cặp có 2 đội thật
      let donor = -1;
      for (let j = i + 1; j < pairs.length; j++) {
        if (!isBye(pairs[j].A) && !isBye(pairs[j].B)) {
          donor = j;
          break;
        }
      }
      if (donor >= 0) {
        pairs[i].B = pairs[donor].B;
        pairs[donor].B = BYE;
        continue;
      }
      // Fallback: mượn 1 đội ở cặp 1-đội
      for (let j = i + 1; j < pairs.length; j++) {
        const oneTeam =
          (!isBye(pairs[j].A) && isBye(pairs[j].B)) || (isBye(pairs[j].A) && !isBye(pairs[j].B));
        if (oneTeam) {
          if (!isBye(pairs[j].A)) {
            pairs[i].B = pairs[j].A;
            pairs[j].A = BYE;
          } else {
            pairs[i].B = pairs[j].B;
            pairs[j].B = BYE;
          }
          break;
        }
      }
    }
  }
  return pairs;
}

/** Vị trí seed tiêu chuẩn 2^n (1-indexed seed -> position) */
function seedPositionsPow2(n) {
  const build = (m) => {
    if (m === 1) return [1];
    const prev = build(m >> 1);
    const left = prev.map((p) => 2 * p - 1);
    const right = prev.map((p) => 2 * p);
    return left.concat(right);
  };
  return build(n); // array length n, giá trị 1..n
}
function makePairsFromSlots(slots) {
  const pairs = [];
  for (let i = 0; i < slots.length; i += 2) {
    const A = slots[i] || BYE;
    const B = slots[i + 1] || BYE;
    pairs.push({ pair: i / 2 + 1, A, B });
  }
  return pairs;
}
function arrangeLinearIntoKO(linearSeeds, firstPairs, method = "default", seedKey = "ko") {
  const capacity = firstPairs * 2;
  const pool = linearSeeds.slice(0, capacity);
  while (pool.length < capacity) pool.push(BYE);

  const pairs = [];

  if (method === "cross") {
    const half = capacity / 2;
    const left = pool.slice(0, half);
    const right = pool.slice(half);
    for (let i = 0; i < firstPairs; i++) {
      pairs.push({ pair: i + 1, A: left[i] || BYE, B: right[i] || BYE });
    }
  } else if (method === "shift") {
    const left = pool.filter((_, idx) => idx % 2 === 0);
    let right = pool.filter((_, idx) => idx % 2 === 1);
    const s = Math.max(1, Math.floor(firstPairs / 2));
    if (right.length) right = right.slice(s).concat(right.slice(0, s));
    for (let i = 0; i < firstPairs; i++) {
      pairs.push({ pair: i + 1, A: left[i] || BYE, B: right[i] || BYE });
    }
  } else if (method === "random") {
    const shuffled = seededShuffle(pool, seedKey + "_rand");
    for (let i = 0; i < firstPairs; i++) {
      pairs.push({ pair: i + 1, A: shuffled[2 * i] || BYE, B: shuffled[2 * i + 1] || BYE });
    }
  } else {
    // default: (1 vs 2), (3 vs 4), ...
    for (let i = 0; i < firstPairs; i++) {
      pairs.push({ pair: i + 1, A: pool[2 * i] || BYE, B: pool[2 * i + 1] || BYE });
    }
  }

  // ❗ Chặn BYE–BYE (khi có thể)
  return fixDoubleByes(pairs);
}

/* ----- Rematch-avoid helper dùng _hasRematchPO ----- */
// Ghép "đầu–cuối": lấy mạnh từ đầu, yếu từ cuối; nếu conflict thì dịch dần để tránh.
// Hết yếu -> BYE. Dư yếu -> tự ghép với nhau. Luôn chạy fixDoubleByes ở cuối.
function buildPairsStrongWeakNoRematch(strongArr, weakArr, firstPairs, poDrawSize) {
  const S = strongArr.slice(); // W-V1-T1.. (tăng)
  const W = weakArr.slice(); // W-V2/V3/... (tăng)
  const pairs = [];

  for (let i = 0; i < firstPairs; i++) {
    if (S.length) {
      const s = S.shift();
      if (W.length) {
        // ưu tiên yếu nhất còn lại (cuối mảng); nếu conflict thì tìm ứng viên khác
        let pick = -1;
        for (let idx = W.length - 1; idx >= 0; idx--) {
          if (!_hasRematchPO(s, W[idx], poDrawSize)) {
            pick = idx;
            break;
          }
        }
        if (pick === -1) pick = W.length - 1; // không tránh được thì chấp nhận
        const w = W.splice(pick, 1)[0];
        pairs.push({ pair: i + 1, A: s, B: w });
      } else {
        pairs.push({ pair: i + 1, A: s, B: BYE });
      }
    } else if (W.length >= 2) {
      const b = W.pop();
      const a = W.pop() || BYE;
      pairs.push({ pair: i + 1, A: a, B: b });
    } else if (W.length === 1) {
      pairs.push({ pair: i + 1, A: W.pop(), B: BYE });
    } else {
      pairs.push({ pair: i + 1, A: BYE, B: BYE });
    }
  }
  return fixDoubleByes(pairs);
}

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

  const sSel = stages[mStageIdx];
  const rMax =
    sSel?.type === "po"
      ? Math.max(1, Number(sSel?.config?.maxRounds || 1))
      : Math.max(1, Math.round(Math.log2(nextPow2(sSel?.config?.drawSize || 2))));

  const canPick = () => {
    if (mode === "groupRank" && !groupStages.length) return false;
    if ((mode === "stageMatchWinner" || mode === "stageMatchLoser") && !poKoStages.length)
      return false;
    return true;
  };

  const handlePick = () => {
    if (!canPick()) return;
    if (mode === "bye") return onPick(BYE);
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
      const rMaxLocal =
        s?.type === "po"
          ? Math.max(1, Number(s.config?.maxRounds || 1))
          : Math.max(1, Math.round(Math.log2(nextPow2(s?.config?.drawSize || 2))));
      const r = Math.min(Math.max(1, Number(mRound || 1)), rMaxLocal);
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
                    const rMaxLocal =
                      s?.type === "po"
                        ? Math.max(1, Number(s.config?.maxRounds || 1))
                        : Math.max(1, Math.round(Math.log2(nextPow2(s?.config?.drawSize || 2))));
                    setMRound(Math.min(v, rMaxLocal));
                    setMTIndex(1);
                  }}
                  sx={{ width: 140 }}
                  helperText={`Tối đa V${rMax}`}
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

  // Lấy danh sách brackets đã tạo
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
  const [groupSize, setGroupSize] = useState(4);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupTopN, setGroupTopN] = useState(1);

  // PO defaults (non-2^n)
  const [poPlan, setPoPlan] = useState({ drawSize: 8, maxRounds: 1, seeds: [] });

  // KO defaults
  const [koPlan, setKoPlan] = useState({ drawSize: 16, seeds: [] });

  // ===== Rules per stage (có CAP) =====
  const [groupRules, setGroupRules] = useState(DEFAULT_RULES);
  const [poRules, setPoRules] = useState(DEFAULT_RULES);
  const [koRules, setKoRules] = useState(DEFAULT_RULES);

  // KO Final override
  const [koFinalOverride, setKoFinalOverride] = useState(false);
  const [koFinalRules, setKoFinalRules] = useState({
    bestOf: 5,
    pointsToWin: 11,
    winByTwo: true,
    cap: { mode: "none", points: null },
  });

  // Prefill flags
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const prefillOnceRef = useRef(false);

  // Chọn kiểu đổ KO theo nguồn
  const [group2KOMethod, setGroup2KOMethod] = useState("cross"); // default | cross | shift | random
  const [po2KOMethod, setPo2KOMethod] = useState("default"); // default | cross | shift | random

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
          groupSize,
          groups: Array.from({ length: groupCount }, (_, i) => String(i + 1)),
          groupSizes,
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

    // Đếm số "vòng hiển thị" trước stage hiện tại
    const roundsBefore = (() => {
      let count = 0;
      // Nếu có vòng bảng trước -> +1
      const hasGroupBefore = stages.slice(0, stageIdx).some((s) => s.type === "group");
      if (hasGroupBefore) count += 1;

      // Nếu có PO trước -> +maxRounds của PO (nếu có nhiều PO, cộng tất)
      stages.slice(0, stageIdx).forEach((s) => {
        if (s.type === "po") {
          const N = Number(s.config?.drawSize || 0);
          const maxR = Math.max(1, Math.min(maxPoRoundsFor(N), Number(s.config?.maxRounds || 1)));
          count += maxR;
        }
      });

      return count;
    })();

    const baseRound = 1 + roundsBefore; // vòng hiển thị đầu tiên của stage này

    if (stage.type === "po") {
      const rounds = buildPoRoundsFromPlan(poPlan, stageIdx + 1, baseRound);
      return (
        <Bracket
          rounds={rounds}
          renderSeedComponent={({ seed }) => {
            const A = seed?.teams?.[0];
            const B = seed?.teams?.[1];
            const pair = A?.__pair || B?.__pair; // chỉ có ở R đầu của stage
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
    const rounds = buildRoundsFromPlan(koPlan, stageIdx + 1, baseRound);
    return (
      <Bracket
        rounds={rounds}
        renderSeedComponent={({ seed }) => {
          const A = seed?.teams?.[0];
          const B = seed?.teams?.[1];
          const pair = A?.__pair || B?.__pair; // chỉ có ở R đầu của stage
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

  /* ===== Đổ KO từ PO (nhiều kiểu) ===== */
  const prefillKOfromPO = (method = "default") => {
    const poIdx = stages.findIndex((s) => s.type === "po");
    if (poIdx < 0) return toast.info("Chưa bật PO để đổ seed sang KO");

    const qualifiers = computePoQualifiers(poPlan, poIdx); // linear W-Vr-Ti (r↑, i↑)

    // Nhóm theo round
    const byRound = new Map();
    for (const q of qualifiers) {
      const r = q?.ref?.round || 1;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(q);
    }
    const roundsAsc = [...byRound.keys()].sort((a, b) => a - b);

    setKoPlan((prev) => {
      const size = Math.max(2, nextPow2(Number(prev.drawSize || 2)));
      const firstPairs = size / 2;
      const capacity = firstPairs * 2;
      const poN = Number(poPlan?.drawSize || 0);

      // ====== Option: V1 vs V2+ (đầu–cuối, tránh tái đấu) ======
      if (method === "v1v2") {
        // mạnh: chỉ V1
        const strong = (byRound.get(1) || []).slice().sort((a, b) => a.ref.order - b.ref.order);
        // yếu: gộp toàn bộ V2, V3, V4...
        const weak = [];
        for (const r of roundsAsc)
          if (r >= 2) {
            const arr = (byRound.get(r) || []).slice().sort((a, b) => a.ref.order - b.ref.order);
            weak.push(...arr);
          }

        const pairs = buildPairsStrongWeakNoRematch(strong, weak, firstPairs, poN);
        const nonByeCount = strong.length + weak.length;
        // if (nonByeCount < firstPairs) {
        //   toast.warning("Không đủ đội -> đã chèn BYE & dàn đều để tránh BYE–BYE.");
        // }
        toast.success("Đã đổ seed: V1 vs V2+ (đầu–cuối, tránh tái đấu)");
        return { drawSize: size, seeds: pairs };
      }

      // ====== Option: Ladder (giữ dáng + tránh tái đấu) ======
      if (method === "ladder") {
        // 1) Gom qualifiers: mạnh = toàn bộ W-V1 (sắp theo T1..), yếu = gộp W-V2, V3, ...
        const strong = (byRound.get(1) || [])
          .slice()
          .sort((a, b) => (a.ref.order || 0) - (b.ref.order || 0));
        const weak = [];
        for (const r of roundsAsc)
          if (r >= 2) {
            const arr = (byRound.get(r) || [])
              .slice()
              .sort((a, b) => (a.ref.order || 0) - (b.ref.order || 0));
            weak.push(...arr);
          }

        // Nếu KO nhỏ hơn số V1 thì phần "mạnh" dư sẽ tràn sang pool yếu
        const S = Math.min(firstPairs, strong.length);
        const remainingStrong = strong.slice(S);

        // Pool ứng viên cho bên "yếu" (đối thủ của mạnh) + mọi phần dư
        const weakPool = [...weak, ...remainingStrong];

        // 2) Dáng ladder: seed #rank -> cặp theo vị trí chuẩn
        const positions = seedPositionsPow2(size); // mảng 1..size
        const pairIndexForRank = (rank) => Math.ceil(positions[rank - 1] / 2); // 1-based

        // Khởi tạo cặp kết quả
        const resultPairs = Array.from({ length: firstPairs }, (_, i) => ({
          pair: i + 1,
          A: BYE,
          B: BYE,
        }));

        // 3) Đặt S seed mạnh vào đúng cặp "chuẩn ladder"
        for (let rank = 1; rank <= S; rank++) {
          const pIdx = pairIndexForRank(rank) - 1; // 0-based
          resultPairs[pIdx].A = strong[rank - 1];
        }

        // 4) Chọn đối thủ cho từng cặp có "mạnh": ưu tiên tránh tái đấu
        const pickWeakFor = (sSeed) => {
          if (!weakPool.length) return null;
          let idx = weakPool.findIndex((w) => !_hasRematchPO(sSeed, w, poN));
          if (idx === -1) idx = 0; // nếu bất khả kháng, chấp nhận tái đấu
          return weakPool.splice(idx, 1)[0];
        };

        for (let rank = 1; rank <= S; rank++) {
          const pIdx = pairIndexForRank(rank) - 1;
          const sSeed = resultPairs[pIdx].A;
          resultPairs[pIdx].B = pickWeakFor(sSeed) || BYE;
        }

        // 5) Điền các cặp còn lại (không có "mạnh")
        for (let i = 0; i < resultPairs.length; i++) {
          const p = resultPairs[i];
          if (isBye(p.A) && isBye(p.B)) {
            p.A = weakPool.shift() || BYE;
            p.B = weakPool.shift() || BYE;
          } else if (isBye(p.B)) {
            p.B = weakPool.shift() || BYE;
          }
        }

        // 6) Cải thiện cục bộ: hoán đổi "B" giữa các cặp mạnh nếu giảm tổng tái đấu
        const conflict = (pair) =>
          !isBye(pair.A) && !isBye(pair.B) && _hasRematchPO(pair.A, pair.B, poN) ? 1 : 0;

        let improved = true;
        let iter = 0;
        while (improved && iter < 20) {
          improved = false;
          iter++;
          for (let i = 0; i < resultPairs.length; i++) {
            for (let j = i + 1; j < resultPairs.length; j++) {
              const p1 = resultPairs[i];
              const p2 = resultPairs[j];
              if (isBye(p1.A) || isBye(p2.A) || isBye(p1.B) || isBye(p2.B)) continue;

              const cur = conflict(p1) + conflict(p2);

              const swapP1 = { ...p1, B: p2.B };
              const swapP2 = { ...p2, B: p1.B };
              const sw = conflict(swapP1) + conflict(swapP2);

              if (sw < cur) {
                const tmp = p1.B;
                p1.B = p2.B;
                p2.B = tmp;
                improved = true;
              }
            }
          }
        }

        const finalPairs = fixDoubleByes(resultPairs);

        const used = Math.min(capacity, strong.length + weak.length);
        // if (used < capacity) {
        //   toast.warning("Không đủ đội → đã chèn BYE & dàn đều để tránh BYE–BYE.");
        // }
        toast.success("Đã đổ seed: Ladder (giữ dáng + tránh tái đấu tối đa)");
        return { drawSize: size, seeds: finalPairs };
      }

      // ====== Option: Ladder ngược (giữ dáng ladder + tránh tái đấu + ghép “xa” nhất) ======
      if (method === "ladderReverse") {
        const strong = (byRound.get(1) || [])
          .slice()
          .sort((a, b) => (a.ref.order || 0) - (b.ref.order || 0));

        const weak = [];
        for (const r of roundsAsc)
          if (r >= 2) {
            const arr = (byRound.get(r) || [])
              .slice()
              .sort((a, b) => (a.ref.order || 0) - (b.ref.order || 0));
            weak.push(...arr);
          }

        const S = Math.min(firstPairs, strong.length);
        const remainingStrong = strong.slice(S);
        const weakPool = [...weak, ...remainingStrong];

        // Dáng ladder
        const positions = seedPositionsPow2(size);
        const pairIndexForRank = (rank) => Math.ceil(positions[rank - 1] / 2);

        const resultPairs = Array.from({ length: firstPairs }, (_, i) => ({
          pair: i + 1,
          A: BYE,
          B: BYE,
        }));
        for (let rank = 1; rank <= S; rank++) {
          const pIdx = pairIndexForRank(rank) - 1;
          resultPairs[pIdx].A = strong[rank - 1];
        }

        // Tham chiếu “độ xa”
        const weakRef = weak.slice(); // r↑, t↑
        const weakIndex = new Map(weakRef.map((w, idx) => [w, idx])); // identity-based

        const pickWeakForReverse = (sSeed, rank) => {
          if (!weakPool.length) return null;
          const desired = Math.max(0, weakRef.length - rank); // muốn “xa” về cuối
          let bestIdx = -1;
          let bestScore = -Infinity;
          for (let i = 0; i < weakPool.length; i++) {
            const cand = weakPool[i];
            const refIdx = weakIndex.has(cand) ? weakIndex.get(cand) : weakRef.length + i; // đẩy dư về cuối
            const dist = Math.abs(refIdx - desired);
            const rematch = _hasRematchPO(sSeed, cand, poN);
            const score = (rematch ? 0 : 1_000_000) + dist; // ưu tiên không tái đấu rồi mới tối đa dist
            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }
          return bestIdx >= 0 ? weakPool.splice(bestIdx, 1)[0] : null;
        };

        for (let rank = 1; rank <= S; rank++) {
          const pIdx = pairIndexForRank(rank) - 1;
          const sSeed = resultPairs[pIdx].A;
          resultPairs[pIdx].B = pickWeakForReverse(sSeed, rank) || BYE;
        }

        // Điền phần còn lại
        for (let i = 0; i < resultPairs.length; i++) {
          const p = resultPairs[i];
          if (isBye(p.A) && isBye(p.B)) {
            p.A = weakPool.shift() || BYE;
            p.B = weakPool.shift() || BYE;
          } else if (isBye(p.B)) {
            p.B = weakPool.shift() || BYE;
          }
        }

        // Hoán đổi cục bộ giảm tái đấu
        const conflict = (pair) =>
          !isBye(pair.A) && !isBye(pair.B) && _hasRematchPO(pair.A, pair.B, poN) ? 1 : 0;

        let improved = true;
        let iter = 0;
        while (improved && iter < 20) {
          improved = false;
          iter++;
          for (let i = 0; i < resultPairs.length; i++) {
            for (let j = i + 1; j < resultPairs.length; j++) {
              const p1 = resultPairs[i];
              const p2 = resultPairs[j];
              if (isBye(p1.A) || isBye(p2.A) || isBye(p1.B) || isBye(p2.B)) continue;

              const cur = conflict(p1) + conflict(p2);
              const swapP1 = { ...p1, B: p2.B };
              const swapP2 = { ...p2, B: p1.B };
              const sw = conflict(swapP1) + conflict(swapP2);

              if (sw < cur) {
                const tmp = p1.B;
                p1.B = p2.B;
                p2.B = tmp;
                improved = true;
              }
            }
          }
        }

        const finalPairs = fixDoubleByes(resultPairs);

        const used = Math.min(capacity, strong.length + weak.length);
        // if (used < capacity) {
        //   toast.warning("Không đủ đội → đã chèn BYE & dàn đều để tránh BYE–BYE.");
        // }
        toast.success("Đã đổ seed: Ladder NGƯỢC (tránh tái đấu, ghép xa nhất)");
        return { drawSize: size, seeds: finalPairs };
      }

      // ====== Các cách cũ (default|cross|shift|random|lateFirst|interleave|pairSplit|snake) ======
      let linear = qualifiers.slice(0, capacity);
      switch (method) {
        case "lateFirst": {
          const roundsDesc = [...roundsAsc].reverse();
          linear = [];
          for (const r of roundsDesc) linear.push(...(byRound.get(r) || []));
          break;
        }
        case "interleave": {
          linear = [];
          const maxLen = Math.max(...roundsAsc.map((r) => (byRound.get(r) || []).length));
          for (let c = 0; c < maxLen; c++) {
            for (const r of roundsAsc) {
              const arr = byRound.get(r) || [];
              if (arr[c]) linear.push(arr[c]);
            }
          }
          break;
        }
        case "pairSplit": {
          const base = qualifiers.slice(0, capacity);
          const odds = base.filter((_, i) => i % 2 === 0);
          const evens = base.filter((_, i) => i % 2 === 1);
          linear = [...odds, ...evens];
          break;
        }
        case "snake": {
          const base = qualifiers.slice(0, capacity);
          linear = [];
          const step = 8;
          for (let i = 0; i < base.length; i += step) {
            const chunk = base.slice(i, i + step);
            if ((i / step) % 2 === 1) chunk.reverse();
            linear.push(...chunk);
          }
          break;
        }
        default:
          break;
      }

      const pairingMethod = ["default", "cross", "shift", "random"].includes(method)
        ? method
        : "default";
      const pairs = arrangeLinearIntoKO(
        linear,
        firstPairs,
        pairingMethod,
        String(tournamentId || "pt")
      );
      const used = Math.min(capacity, linear.length);
      toast.success(`Đã đổ ${used}/${capacity} seed từ PO sang KO • Kiểu: ${method.toUpperCase()}`);
      return { drawSize: size, seeds: pairs };
    });
  };

  /* ===== Đổ KO từ Vòng bảng (nhiều kiểu) ===== */
  const prefillKOfromGroups = (method = "default") => {
    const gIdx = stages.findIndex((s) => s.type === "group");
    if (gIdx < 0) return toast.info("Chưa bật vòng bảng để đổ seed sang KO");

    const seedKey = String(tournamentId || "pt");
    const groupStage = stages[gIdx];
    const N = Math.max(1, Math.min(Number(groupTopN) || 1, minGroupSize || 1)); // topN/bảng
    const { groups, ranks } = buildGroupQualMatrix(groupStage, gIdx, N);

    setKoPlan((prev) => {
      const size = Math.max(2, nextPow2(Number(prev.drawSize || 2)));
      const firstPairs = size / 2;
      const capacity = firstPairs * 2;

      const winners = ranks[0] || [];
      const runners = ranks[1] || [];
      const othersFlat = ranks.slice(2).flat() || [];

      let linear = []; // sẽ đưa vào arrangeLinearIntoKO

      if (method === "cross" && winners.length >= 1) {
        // Cặp bảng: (G1,G2),(G3,G4)... => A1–B2, B1–A2
        for (let i = 0; i < groups.length; i += 2) {
          const gA = groups[i];
          const gB = groups[i + 1];
          const A1 = winners.find((x) => x.__group === gA);
          const B1 = gB ? winners.find((x) => x.__group === gB) : null;
          const A2 = runners.find((x) => x.__group === gA);
          const B2 = gB ? runners.find((x) => x.__group === gB) : null;

          if (gB) {
            if (A1) linear.push(A1);
            if (B2) linear.push(B2);
            if (B1) linear.push(B1);
            if (A2) linear.push(A2);
          } else {
            if (A1) linear.push(A1);
            if (A2) linear.push(A2);
          }
        }
        linear.push(...othersFlat);
      } else if (method === "shift" && winners.length && runners.length) {
        // #2 xoay nửa vòng, tránh gặp cùng bảng khi có thể
        const shift = Math.ceil(groups.length / 2);
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          const a = winners.find((x) => x.__group === g);
          if (a) linear.push(a);
          let b = runners.find((x) => x.__group === groups[(i + shift) % groups.length]);
          if (b?.__group === g) {
            b = runners.find((x) => x.__group === groups[(i + shift + 1) % groups.length]);
          }
          if (b) linear.push(b);
        }
        linear.push(...othersFlat);
      } else if (method === "random") {
        // Ngẫu nhiên (ưu tiên tránh cùng bảng ở vị trí kề)
        const pool = seededShuffle(ranks.flat(), seedKey + "_g");
        linear = pool;
      } else if (method === "snake") {
        // Serpentine theo block hạng
        const rows = ranks.map((row, idx) => (idx % 2 === 0 ? row : row.slice().reverse()));
        linear = rows.flat();
      } else if (method === "pot") {
        // Pot1 = winners, Pot2 = runners; bắt cặp cố tránh cùng bảng
        const W = seededShuffle(winners, seedKey + "_potW");
        const R = seededShuffle(runners, seedKey + "_potR");
        const usedR = new Set();
        for (const a of W) {
          let pick = -1;
          for (let j = 0; j < R.length; j++) {
            if (!usedR.has(j) && R[j].__group !== a.__group) {
              pick = j;
              break;
            }
          }
          if (pick === -1)
            for (let j = 0; j < R.length; j++)
              if (!usedR.has(j)) {
                pick = j;
                break;
              }
          linear.push(a);
          if (pick !== -1) {
            linear.push(R[pick]);
            usedR.add(pick);
          }
        }
        for (let j = 0; j < R.length; j++) if (!usedR.has(j)) linear.push(R[j]);
        linear.push(...othersFlat);
      } else if (method === "antiSameGroup") {
        // Greedy để tránh cùng bảng tối đa
        const remW = [...winners];
        const remR = [...runners];
        while (remW.length) {
          const a = remW.shift();
          let idx = remR.findIndex((x) => x.__group !== a.__group);
          if (idx === -1) idx = remR.length ? 0 : -1;
          linear.push(a);
          if (idx !== -1) linear.push(remR.splice(idx, 1)[0]);
        }
        linear.push(...remR);
        linear.push(...othersFlat);
      } else {
        // default – theo khối hạng
        linear = ranks.flat();
      }

      // Pair và đệm BYE theo sức chứa KO
      const pairs = arrangeLinearIntoKO(linear, firstPairs, "default", seedKey);
      const used = Math.min(capacity, linear.length);

      toast.success(
        `Đã đổ ${used}/${
          groups.length * N
        } seed từ Vòng bảng sang KO • Kiểu: ${method.toUpperCase()}`
      );
      return { drawSize: size, seeds: pairs };
    });
  };

  // Prefill từ sơ đồ đã có (brackets)
  const prefillFromExisting = (list) => {
    if (!Array.isArray(list) || !list.length) return;

    const bGroup = list.find((b) => b.type === "group");
    const bPO = list.find((b) => b.type === "po");
    const bKO = list.find((b) => b.type === "ko");

    // Group
    if (bGroup) {
      const cfg = bGroup.config || {};
      const groupsArr = Array.isArray(cfg.groups) ? cfg.groups : [];
      const gCount = groupsArr.length || Number(cfg.groupCount || 0) || 0;

      const sizes = Array.isArray(cfg.groupSizes) ? cfg.groupSizes : [];
      const sum = sizes.reduce((a, b) => a + (Number(b) || 0), 0);
      const gSize = Number(cfg.groupSize || 0);
      const qualifiersPerGroup =
        Number(cfg.qualifiersPerGroup || bGroup.meta?.qualifiersPerGroup || 1) || 1;

      setIncludeGroup(true);
      setGroupCount(gCount || 0);
      if (sum > 0) {
        setGroupTotal(sum);
        setGroupSize(gSize || (gCount ? Math.floor(sum / gCount) : 0));
      } else {
        setGroupTotal(0);
        setGroupSize(gSize || 0);
      }
      setGroupTopN(Math.max(1, qualifiersPerGroup));

      const rules = normalizeRulesForState(bGroup.rules || cfg.rules || DEFAULT_RULES);
      setGroupRules(rules);
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
      const rules = normalizeRulesForState(bPO.rules || cfg.rules || DEFAULT_RULES);
      setPoRules(rules);
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

      const rules = normalizeRulesForState(bKO.rules || cfg.rules || DEFAULT_RULES);
      setKoRules(rules);

      const finalRules = bKO.finalRules || cfg.finalRules || null;
      if (finalRules) {
        setKoFinalOverride(true);
        setKoFinalRules(normalizeRulesForState(finalRules));
      } else {
        setKoFinalOverride(false);
      }
    }

    setTab("manual");
  };

  // chạy prefill 1 lần khi có dữ liệu brackets
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
      const qpg = Math.max(1, Math.min(Number(groupTopN) || 1, minGroupSize || 1)); // qualifiersPerGroup

      const groupsPayload = hasGroup
        ? total > 0
          ? {
              count: groupCount,
              totalTeams: total,
              qualifiersPerGroup: qpg,
              rules: normalizeRulesForState(groupRules),
            }
          : {
              count: groupCount,
              size: groupSize,
              qualifiersPerGroup: qpg,
              rules: normalizeRulesForState(groupRules),
            }
        : null;

      const payload = {
        groups: groupsPayload,
        po: includePO
          ? { ...normalizeSeedsPO(poPlan), rules: normalizeRulesForState(poRules) }
          : null,
        ko: {
          ...normalizeSeedsKO(koPlan),
          rules: normalizeRulesForState(koRules),
          finalRules: koFinalOverride ? normalizeRulesForState(koFinalRules) : null,
        },
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

        {/* Banner nếu đã có sơ đồ */}
        {hasExisting && (
          <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
            <AlertTitle>Giải này đã có sơ đồ (brackets) rồi</AlertTitle>
            Hệ thống đã tự nạp lại cấu hình vào tab “Tự thiết kế & Seed map” để chỉnh tiếp nếu cần.
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

                    {/* Cách đổ KO từ Group */}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                      <TextField
                        select
                        size="small"
                        label="Cách đổ KO (nguồn: Vòng bảng)"
                        value={group2KOMethod}
                        onChange={(e) => setGroup2KOMethod(e.target.value)}
                        sx={{ minWidth: 240 }}
                      >
                        <MenuItem value="default">Mặc định (theo thứ hạng)</MenuItem>
                        <MenuItem value="cross">So le (A1–B2, B1–A2)</MenuItem>
                        <MenuItem value="shift">Xoay lệch (#2 xoay nửa vòng)</MenuItem>
                        <MenuItem value="random">Ngẫu nhiên (khác bảng)</MenuItem>
                        <MenuItem value="snake">Serpentine (rank1 →, rank2 ← ...)</MenuItem>
                        <MenuItem value="pot">Rút “pot” (1 vs 2, tránh cùng bảng)</MenuItem>
                        <MenuItem value="antiSameGroup">Tránh cùng bảng tối đa</MenuItem>
                      </TextField>

                      <Button
                        variant="outlined"
                        onClick={() => prefillKOfromGroups(group2KOMethod)}
                      >
                        Đổ seed KO từ Vòng bảng
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Stack>

              {includeGroup && (
                <Box sx={{ mt: 1 }}>
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

                    {/* Cách đổ KO từ PO */}
                    <TextField
                      select
                      size="small"
                      label="Cách đổ KO (nguồn: PO)"
                      value={po2KOMethod}
                      onChange={(e) => setPo2KOMethod(e.target.value)}
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="default">Mặc định (1–2, 3–4,…)</MenuItem>
                      <MenuItem value="cross">So le nửa nhánh</MenuItem>
                      <MenuItem value="shift">Xoay lệch</MenuItem>
                      <MenuItem value="random">Ngẫu nhiên</MenuItem>
                      <MenuItem value="lateFirst">Ưu tiên vòng cao (Vmax→…→V1)</MenuItem>
                      <MenuItem value="interleave">Đan xen theo vòng</MenuItem>
                      <MenuItem value="pairSplit">Tách lẻ/chẵn</MenuItem>
                      <MenuItem value="snake">Serpentine</MenuItem>
                      <MenuItem value="v1v2">Ưu tiên V1 vs V2 (hết V2 → BYE)</MenuItem>
                      <MenuItem value="ladder">Ladder (giữ dáng + tránh tái đấu)</MenuItem>
                      <MenuItem value="ladderReverse">
                        Ladder ngược (tránh tái đấu, ghép xa nhất)
                      </MenuItem>
                    </TextField>

                    <Button variant="outlined" onClick={() => prefillKOfromPO(po2KOMethod)}>
                      Đổ seed KO từ PO
                    </Button>
                  </Stack>
                )}
              </Stack>

              {includePO && (
                <Box sx={{ mt: 1 }}>
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
                          label={`Rule: ${ruleSummary(normalizeRulesForState(groupRules))}`}
                        />
                      )}
                      {stage.type === "po" && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Rule: ${ruleSummary(normalizeRulesForState(poRules))}`}
                        />
                      )}
                      {stage.type === "ko" && (
                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Rule: ${ruleSummary(normalizeRulesForState(koRules))}`}
                          />
                          {koFinalOverride && (
                            <Chip
                              size="small"
                              color="secondary"
                              variant="outlined"
                              label={`Final: ${ruleSummary(normalizeRulesForState(koFinalRules))}`}
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
                          const start = sizes.slice(0, gi).reduce((a, b) => a + (b || 0), 0) + 1;
                          const names = Array.from(
                            { length: sizeThis },
                            (_, j) => `Đội ${start + j}`
                          );

                          return (
                            <Paper key={g} variant="outlined" sx={{ p: 1.5 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <Chip size="small" color="secondary" label={`B${g}`} />
                                <Typography variant="subtitle2">{`Dự kiến ${sizeThis} đội • ${RR_MATCHES(
                                  sizeThis
                                )} trận`}</Typography>
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

/* ===== Normalizers for payload ===== */
function normalizeSeedsKO(plan) {
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
}
function normalizeSeedsPO(plan) {
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
}
