// src/pages/tournament/TournamentBlueprintPage.jsx
import React, { useMemo, useState, useEffect, useRef, startTransition } from "react";
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
  IconButton,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { Bracket, Seed, SeedItem, SeedTeam } from "react-brackets";
import { toast } from "react-toastify";
import { Add as AddIcon, Remove as RemoveIcon } from "@mui/icons-material";
import {
  useGetTournamentQuery,
  usePlanTournamentMutation,
  useCommitTournamentPlanMutation,
  useGetTournamentBracketsQuery,
  useSuggestTournamentPlanMutation,
  useGetRegistrationsQuery,
  useGetTournamentPlanQuery,
  useUpdateTournamentPlanMutation,
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

// ✅ PO mặc định BO1
const DEFAULT_PO_RULES = {
  bestOf: 1,
  pointsToWin: 11,
  winByTwo: true,
  cap: { mode: "none", points: null },
};

const normalizeRulesForState = (r = {}, fallback = DEFAULT_RULES) => ({
  bestOf: Number(r.bestOf ?? fallback.bestOf),
  pointsToWin: Number(r.pointsToWin ?? fallback.pointsToWin),
  winByTwo: !!(r.winByTwo ?? fallback.winByTwo),
  cap: {
    mode: String(r?.cap?.mode ?? fallback.cap.mode),
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
  rounds.push({
    title: `PO • Vòng ${r1Display} (${r1Seeds.length} trận)`,
    seeds: r1Seeds,
  });

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

    rounds.push({
      title: `PO • Vòng ${displayRound} (${pairs} trận)`,
      seeds,
    });
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
function seededShuffle(arr = [], seedStr = "42") {
  const input = Array.isArray(arr) ? arr : [];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rand() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  }
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* ===== BYE helpers & fixers ===== */
const isBye = (s) => s?.type === "bye" || s?.label === "BYE" || s?.name === "BYE";

// --- Section helpers: tách nửa/quarter/eighth... để tránh cùng bảng gặp nhau sớm ---
function makeSectionHelpers(firstPairs) {
  const L = Math.max(0, Math.round(Math.log2(Math.max(1, firstPairs))));
  // trọng số: va chạm cùng nửa phạt nặng hơn cùng quarter/eighth...
  const weights = Array.from({ length: L }, (_, i) => 1 << (L - i + 2)); // ví dụ [8,4,2,1]
  const occ = new Map(); // groupCode -> [Set(level0), Set(level1), ...]

  const ensure = (g) => {
    if (!occ.has(g))
      occ.set(
        g,
        Array.from({ length: L }, () => new Set())
      );
    return occ.get(g);
  };

  const sectionsOf = (pairIndexZeroBased) => {
    const ids = [];
    for (let lvl = 1; lvl <= L; lvl++) {
      const buckets = 1 << lvl; // số vùng ở level này
      const size = firstPairs / buckets; // số cặp/pairs mỗi vùng
      const id = Math.floor(pairIndexZeroBased / size);
      ids.push(id); // 0..buckets-1
    }
    return ids; // [halfId, quarterId, eighthId, ...]
  };

  const scoreFor = (groupCodes /* array of string */, pairIndexOneBased) => {
    const pz = (pairIndexOneBased || 1) - 1;
    const secs = sectionsOf(pz);
    let s = 0;
    for (const g of groupCodes) {
      const o = ensure(g);
      for (let k = 0; k < secs.length; k++) {
        if (o[k].has(secs[k])) s += weights[k];
      }
    }
    return s;
  };

  const commit = (groupCodes, pairIndexOneBased) => {
    const pz = (pairIndexOneBased || 1) - 1;
    const secs = sectionsOf(pz);
    for (const g of groupCodes) {
      const o = ensure(g);
      for (let k = 0; k < secs.length; k++) o[k].add(secs[k]);
    }
  };

  return { scoreFor, commit };
}

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
      pairs.push({
        pair: i + 1,
        A: shuffled[2 * i] || BYE,
        B: shuffled[2 * i + 1] || BYE,
      });
    }
  } else {
    // default: (1 vs 2), (3 vs 4), ...
    for (let i = 0; i < firstPairs; i++) {
      pairs.push({
        pair: i + 1,
        A: pool[2 * i] || BYE,
        B: pool[2 * i + 1] || BYE,
      });
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
    data: existingBracketsRaw = [],
    isLoading: loadingBrackets,
    isError: bracketsError,
  } = useGetTournamentBracketsQuery(tournamentId);

  const existingBrackets = Array.isArray(existingBracketsRaw)
    ? existingBracketsRaw
    : existingBracketsRaw?.items || existingBracketsRaw?.data || [];
  // Lấy plan đã lưu (nếu có)
  const {
    data: savedPlan,
    isLoading: loadingPlan,
    isError: planError,
  } = useGetTournamentPlanQuery(tournamentId);

  // Cập nhật plan (PUT /plan)
  const [updateTournamentPlan] = useUpdateTournamentPlanMutation();
  const [tab, setTab] = useState("manual");

  // ===== Auto (OpenAI) =====
  const [askingAI, setAskingAI] = useState(false);
  const [suggestTournamentPlan] = useSuggestTournamentPlanMutation();
  // stage toggles (order: Group -> PO -> KO)
  const [includeGroup, setIncludeGroup] = useState(true);
  const [includePO, setIncludePO] = useState(false);

  // Group defaults
  const [groupCount, setGroupCount] = useState(4);
  const [groupSize, setGroupSize] = useState(4);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupTopN, setGroupTopN] = useState(1);
  const [manualRemainder, setManualRemainder] = useState(false);
  const [groupExtras, setGroupExtras] = useState([]); // mảng extra cho từng bảng (0..groupCount-1)
  const [aiResult, setAiResult] = useState(null);

  // Lấy danh sách đội đăng ký của giải & đếm đội đã thanh toán
  const {
    data: registrations,
    isLoading: loadingRegs,
    isError: regsError,
  } = useGetRegistrationsQuery(tournamentId); // truyền đúng params slice của bạn

  const paidCount = useMemo(() => {
    const list = Array.isArray(registrations) ? registrations : registrations?.items || [];
    const isPaid = (r) => {
      const s =
        r?.status?.toLowerCase?.() ||
        r?.paymentStatus?.toLowerCase?.() ||
        r?.payment?.status?.toLowerCase?.() ||
        "";
      return (
        r?.isPaid === true ||
        r?.invoice?.paid === true ||
        s === "paid" ||
        s === "success" ||
        s === "completed"
      );
    };
    return list.filter(isPaid).length;
  }, [registrations]);

  const [planTournament] = usePlanTournamentMutation();
  const [commitTournamentPlan, { isLoading: committing }] = useCommitTournamentPlanMutation();
  const [aiPlan, setAiPlan] = useState(null);

  // PO defaults (non-2^n)
  const [poPlan, setPoPlan] = useState({
    drawSize: 8,
    maxRounds: 1,
    seeds: [],
  });

  // KO defaults
  const [koPlan, setKoPlan] = useState({ drawSize: 16, seeds: [] });

  // ===== Rules per stage (có CAP) =====
  const [groupRules, setGroupRules] = useState(DEFAULT_RULES);

  // ✅ PO: rule tổng + rule từng vòng
  const [poRules, setPoRules] = useState(DEFAULT_PO_RULES);
  const [poRoundRules, setPoRoundRules] = useState([DEFAULT_PO_RULES]);

  const [koRules, setKoRules] = useState(DEFAULT_RULES);

  // KO Final override
  const [koFinalOverride, setKoFinalOverride] = useState(false);
  const [koFinalRules, setKoFinalRules] = useState({
    bestOf: 5,
    pointsToWin: 11,
    winByTwo: true,
    cap: { mode: "none", points: null },
  });

  // ✅ NEW: KO Semi-final override
  const [koSemiOverride, setKoSemiOverride] = useState(false);
  const [koSemiRules, setKoSemiRules] = useState({
    bestOf: 3,
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

  // Khi đổi số vòng PO thì sync mảng rule
  useEffect(() => {
    setPoRoundRules((prev) => {
      const need = Math.max(1, Number(poPlan.maxRounds || 1));
      const next = [];
      for (let i = 0; i < need; i++) {
        next.push(normalizeRulesForState(prev[i] || poRules || DEFAULT_PO_RULES, DEFAULT_PO_RULES));
      }
      return next;
    });
  }, [poPlan.maxRounds, poRules]);

  function applyPlanToManual(plan) {
    if (!plan) return;

    // GROUP
    if (plan.groups) {
      setIncludeGroup(true);
      if (Number(plan.groups.totalTeams || 0) > 0) {
        setGroupCount(Number(plan.groups.count || 0));
        setGroupTotal(Number(plan.groups.totalTeams || 0));
        if (Array.isArray(plan.groups.groupSizes)) {
          setManualRemainder(true);
          setGroupExtras(() => {
            const base = Math.floor((plan.groups.totalTeams || 0) / (plan.groups.count || 1));
            return Array.from({ length: plan.groups.count || 0 }, (_, i) =>
              Math.max(0, (Number(plan.groups.groupSizes[i]) || 0) - base)
            );
          });
        } else {
          setManualRemainder(false);
        }
      } else {
        setGroupCount(Number(plan.groups.count || groupCount));
        setGroupSize(Number(plan.groups.size || groupSize));
        setGroupTotal(0);
        setManualRemainder(false);
      }
      setGroupTopN(Number(plan.groups.qualifiersPerGroup || 1));
      if (plan.groups.rules)
        setGroupRules(normalizeRulesForState(plan.groups.rules, DEFAULT_RULES));
    } else {
      setIncludeGroup(false);
      setGroupTotal(0);
      setManualRemainder(false);
    }

    // PO
    if (plan.po) {
      setIncludePO(true);
      const ds = Number(plan.po.drawSize || 0);
      const mr = Math.max(1, Number(plan.po.maxRounds || 1));
      setPoPlan({
        drawSize: ds,
        maxRounds: mr,
        seeds: Array.isArray(plan.po.seeds) ? plan.po.seeds : [],
      });

      // rule tổng
      if (plan.po.rules) setPoRules(normalizeRulesForState(plan.po.rules, DEFAULT_PO_RULES));
      else setPoRules(DEFAULT_PO_RULES);

      // ✅ rule từng vòng nếu BE có
      if (Array.isArray(plan.po.roundRules) && plan.po.roundRules.length) {
        setPoRoundRules(plan.po.roundRules.map((r) => normalizeRulesForState(r, DEFAULT_PO_RULES)));
      } else {
        setPoRoundRules(
          Array.from({ length: mr }, () =>
            normalizeRulesForState(plan.po.rules || DEFAULT_PO_RULES, DEFAULT_PO_RULES)
          )
        );
      }
    } else {
      setIncludePO(false);
      setPoPlan((p) => ({ ...p, seeds: [] }));
      setPoRules(DEFAULT_PO_RULES);
      setPoRoundRules([DEFAULT_PO_RULES]);
    }

    // KO
    if (plan.ko) {
      setKoPlan({
        drawSize: Number(plan.ko.drawSize || 2),
        seeds: Array.isArray(plan.ko.seeds) ? plan.ko.seeds : [],
      });
      if (plan.ko.rules) setKoRules(normalizeRulesForState(plan.ko.rules, DEFAULT_RULES));
      // NEW: semi-final rules
      if (plan.ko.semiRules) {
        setKoSemiOverride(true);
        setKoSemiRules(normalizeRulesForState(plan.ko.semiRules, DEFAULT_RULES));
      } else {
        setKoSemiOverride(false);
      }
      if (plan.ko.finalRules) {
        setKoFinalOverride(true);
        setKoFinalRules(normalizeRulesForState(plan.ko.finalRules, DEFAULT_RULES));
      } else {
        setKoFinalOverride(false);
      }
    }
  }

  useEffect(() => {
    if (!includeGroup) {
      setGroupExtras([]);
      setManualRemainder(false);
      return;
    }
    setGroupExtras((prev) =>
      Array.from({ length: Math.max(0, groupCount) }, (_, i) => prev[i] || 0)
    );
  }, [includeGroup, groupCount]);

  useEffect(() => {
    // Đổi tổng đội → reset extras để tránh overflow
    setGroupExtras((prev) => prev.map(() => 0));
  }, [groupTotal]);

  const groupRemainder = useMemo(() => {
    if (!includeGroup || groupCount <= 0) return 0;
    const total = Math.max(0, Number(groupTotal) || 0);
    if (total <= 0) return 0;
    const base = Math.floor(total / groupCount);
    const rem = total - base * groupCount;
    const used = (groupExtras || []).slice(0, groupCount).reduce((a, b) => a + (Number(b) || 0), 0);
    return Math.max(0, rem - used);
  }, [includeGroup, groupCount, groupTotal, groupExtras]);

  // Tính groupSizes hiển thị (ưu tiên total)
  const groupSizes = useMemo(() => {
    if (!includeGroup || groupCount <= 0) return [];
    const total = Math.max(0, Number(groupTotal) || 0);

    if (total > 0) {
      const base = Math.floor(total / groupCount);
      const arr = new Array(groupCount).fill(base);
      const rem = total - base * groupCount;

      if (manualRemainder) {
        const extras = (groupExtras || [])
          .slice(0, groupCount)
          .map((x) => Math.max(0, Number(x) || 0));
        // đảm bảo tổng extras ≤ rem
        let sum = extras.reduce((a, b) => a + b, 0);
        if (sum > rem) {
          let over = sum - rem;
          for (let i = extras.length - 1; i >= 0 && over > 0; i--) {
            const take = Math.min(extras[i], over);
            extras[i] -= take;
            over -= take;
          }
        }
        for (let i = 0; i < groupCount; i++) arr[i] += extras[i] || 0;
      } else {
        // Giữ hành vi cũ: dồn dư vào bảng cuối
        if (groupCount > 0) arr[groupCount - 1] += rem;
      }
      return arr;
    }

    // Không nhập "Tổng số đội" → dùng size đều
    return new Array(groupCount).fill(Math.max(0, Number(groupSize) || 0));
  }, [includeGroup, groupCount, groupSize, groupTotal, manualRemainder, groupExtras]);

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
    arr.push({
      id: makeStageId(arr.length),
      type: "ko",
      title: "Knockout",
      config: { ...koPlan },
    });
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

  // gọi OpenAI backend: /plan/suggest
  const askOpenAI = async () => {
    try {
      setAskingAI(true);
      if (loadingRegs) {
        toast.info("Đang lấy danh sách đội đã thanh toán…");
      }
      if (regsError) {
        toast.error("Không lấy được danh sách đăng ký.");
        return;
      }
      const body = {
        paidCount: Math.max(0, Number(paidCount) || 0),
        modeHint: includeGroup ? "group" : includePO ? "po" : "auto",
      };
      const resp = await suggestTournamentPlan({
        tournamentId,
        body,
      }).unwrap();
      const plan = resp?.plan ?? resp;
      setAiPlan(plan);
      applyPlanToManual(plan);
      toast.success("Đã hỏi AI và nhận đề xuất + seed!");
      setTab("auto");
    } catch (e) {
      toast.error(e.message || "Gợi ý tự động lỗi.");
    } finally {
      setAskingAI(false);
    }
  };

  const commitAIPlan = async () => {
    try {
      if (!aiPlan?.ko && !aiPlan?.groups && !aiPlan?.po) {
        toast.info("Chưa có đề xuất để tạo.");
        return;
      }
      const planPayload = {
        groups: aiPlan.groups
          ? {
              count: aiPlan.groups.count,
              totalTeams: aiPlan.groups.totalTeams,
              groupSizes: aiPlan.groups.groupSizes,
              qualifiersPerGroup: aiPlan.groups.qualifiersPerGroup || groupTopN || 2,
              rules: aiPlan.groups.rules || normalizeRulesForState(groupRules),
            }
          : null,
        po: aiPlan.po
          ? {
              drawSize: aiPlan.po.drawSize,
              maxRounds: Math.max(1, Number(aiPlan.po.maxRounds || 1)),
              seeds: aiPlan.po.seeds || [],
              rules: aiPlan.po.rules || normalizeRulesForState(poRules, DEFAULT_PO_RULES),
              // ✅ nếu AI trả roundRules thì gửi lên
              roundRules: Array.isArray(aiPlan.po.roundRules)
                ? aiPlan.po.roundRules.map((r) => normalizeRulesForState(r, DEFAULT_PO_RULES))
                : undefined,
            }
          : null,
        ko: aiPlan.ko
          ? {
              drawSize: aiPlan.ko.drawSize,
              seeds: aiPlan.ko.seeds || [],
              rules: aiPlan.ko.rules || normalizeRulesForState(koRules, DEFAULT_RULES),
              semiRules:
                aiPlan.ko.semiRules ||
                (koSemiOverride ? normalizeRulesForState(koSemiRules, DEFAULT_RULES) : null),
              finalRules:
                aiPlan.ko.finalRules ||
                (koFinalOverride ? normalizeRulesForState(koFinalRules, DEFAULT_RULES) : null),
            }
          : null,
      };

      // 1) Lưu plan server-side (để quay lại trang vẫn có cấu hình)
      await updateTournamentPlan({
        tournamentId,
        body: planPayload,
      }).unwrap();

      // 2) Commit brackets (gửi kèm planPayload để tương thích BE cũ)
      await commitTournamentPlan({
        tournamentId,
        body: {
          ...planPayload,
          ...(allowOverwrite ? { force: true } : {}),
        },
      }).unwrap();

      toast.success(
        allowOverwrite ? "Đã ghi đè & tạo lại sơ đồ!" : "Đã tạo sơ đồ theo đề xuất AI!"
      );
      navigate(`/admin/tournaments/${tournamentId}/brackets`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Tạo sơ đồ thất bại.");
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
        const size = Math.max(2, nextPow2(Number(koPlan?.drawSize || 2)));
        const firstPairs = size / 2;
        const capacity = firstPairs * 2;

        const W = seededShuffle(Array.isArray(winners) ? winners : [], seedKey + "_potW");
        const R = seededShuffle(Array.isArray(runners) ? runners : [], seedKey + "_potR");

        if (W.length === 0 || R.length === 0) {
          // Không đủ Pot #2 → fallback an toàn, không crash/đơ
          const linearDefault = ranks.flat();
          const pairs = arrangeLinearIntoKO(linearDefault, firstPairs, "default", seedKey);
          startTransition(() => {
            setKoPlan({ drawSize: size, seeds: pairs });
          });
          toast.info("‘Rút pot’ cần tối thiểu Top 2/bảng. Đã dùng cách mặc định theo thứ hạng.");
          return;
        }

        const usedR = new Set();
        const linear = [];

        // Ghép 1 vs 2, cố tránh cùng bảng
        for (let i = 0; i < W.length && linear.length < capacity; i++) {
          const a = W[i];
          let pick = -1;

          // Ưu tiên R khác bảng
          for (let j = 0; j < R.length; j++) {
            if (!usedR.has(j) && R[j].__group !== a.__group) {
              pick = j;
              break;
            }
          }
          // Nếu không tránh được, lấy bất kỳ R chưa dùng
          if (pick === -1) {
            for (let j = 0; j < R.length; j++) {
              if (!usedR.has(j)) {
                pick = j;
                break;
              }
            }
          }

          // Đẩy vào linear (giới hạn capacity)
          if (linear.length < capacity) linear.push(a);
          if (pick !== -1 && linear.length < capacity) {
            linear.push(R[pick]);
            usedR.add(pick);
          }
        }

        // Thêm phần R còn thừa (nếu còn slot)
        for (let j = 0; j < R.length && linear.length < capacity; j++) {
          if (!usedR.has(j)) linear.push(R[j]);
        }
        // Thêm các hạng khác (nếu còn slot)
        for (let k = 0; k < othersFlat.length && linear.length < capacity; k++) {
          linear.push(othersFlat[k]);
        }

        const pairs = arrangeLinearIntoKO(linear, firstPairs, "default", seedKey);
        startTransition(() => {
          setKoPlan({ drawSize: size, seeds: pairs });
        });
        toast.success("Đã đổ seed: Rút pot (1 vs 2, tránh cùng bảng)");
      } else if (method === "strongWeak") {
        const size = Math.max(2, nextPow2(Number(prev.drawSize || 2)));
        const firstPairs = size / 2;
        const capacity = firstPairs * 2;

        // các “pot” theo hạng: ranks[0] = Top1 (mạnh), ranks[1] = Top2 (yếu hơn), ...
        const winners = (ranks[0] || []).slice(); // Top1
        const tiers = ranks.slice(1).map((row) => row.slice()); // Top2, Top3, ...

        // khởi tạo cặp KO
        const result = Array.from({ length: firstPairs }, (_, i) => ({
          pair: i + 1,
          A: BYE,
          B: BYE,
        }));

        // helper phân vùng để tránh cùng bảng “gặp sớm”
        const section = makeSectionHelpers(firstPairs);

        // vị trí “ladder” để rải Top1 xa nhau
        const positions = seedPositionsPow2(size);
        const pairIndexForRank = (rank) => Math.ceil(positions[rank - 1] / 2);

        // 1) Đặt Top1 vào A-slots theo ladder (rải đều các nửa/quarter/eighth)
        let rankCounter = 1;
        for (const a of winners) {
          if (rankCounter > firstPairs) break;
          let p = pairIndexForRank(rankCounter); // 1-based
          // nếu A đã có thì tìm cặp trống tiếp theo (hiếm khi xảy ra)
          let spins = 0;
          while (spins < firstPairs && !isBye(result[p - 1].A)) {
            p = (p % firstPairs) + 1;
            spins++;
          }
          result[p - 1].A = a;
          section.commit([String(a.__group || "")], p);
          rankCounter++;
        }

        // 2) Với mỗi A=Top1, chọn đối thủ “yếu nhất có thể” nhưng khác bảng và ít xung đột nhất
        const takeBestOpponentFor = (a, pairNo) => {
          let best = null,
            bestTier = -1,
            bestIdx = -1,
            bestScore = Infinity;
          for (let t = 0; t < tiers.length; t++) {
            const arr = tiers[t];
            for (let j = 0; j < arr.length; j++) {
              const cand = arr[j];
              if (!cand) continue;
              if (cand.__group === a.__group) continue; // cấm cùng bảng ở vòng hiện tại
              const sc = section.scoreFor(
                [String(a.__group || ""), String(cand.__group || "")],
                pairNo
              );
              // Ưu tiên yếu hơn (tier lớn hơn), sau đó ưu tiên ít xung đột
              if (sc < bestScore || (sc === bestScore && t > bestTier)) {
                best = cand;
                bestTier = t;
                bestIdx = j;
                bestScore = sc;
              }
            }
          }
          if (best) tiers[bestTier].splice(bestIdx, 1);
          return best;
        };

        for (const p of result) {
          if (!isBye(p.A) && isBye(p.B)) {
            const opp = takeBestOpponentFor(p.A, p.pair);
            if (opp) {
              p.B = opp;
              section.commit([String(opp.__group || "")], p.pair);
            } else {
              p.B = BYE; // không còn đối thủ hợp lệ → BYE
            }
          }
        }

        // 3) Ghép phần còn lại: luôn “mạnh vs yếu” (tier nhỏ gặp tier lớn) + tránh cùng bảng + tránh gặp sớm
        let remaining = [];
        for (let t = 0; t < tiers.length; t++) {
          for (const s of tiers[t]) remaining.push({ s, t });
        }
        // mạnh trước (t nhỏ), yếu sau (t lớn)
        remaining.sort((a, b) => a.t - b.t);

        const pickBestForPair = (pair, anchor /* có thể null */) => {
          let bestIdx = -1,
            bestScore = Infinity,
            bestTier = -1;
          for (let k = 0; k < remaining.length; k++) {
            const r = remaining[k];
            // cấm cùng bảng với anchor nếu có
            if (anchor && r.s.__group === anchor.__group) continue;
            // điểm xung đột theo phân vùng
            const sc = section.scoreFor(
              anchor
                ? [String(anchor.__group || ""), String(r.s.__group || "")]
                : [String(r.s.__group || "")],
              pair.pair
            );
            if (sc < bestScore || (sc === bestScore && r.t > bestTier)) {
              bestScore = sc;
              bestTier = r.t; // ưu tiên yếu hơn nếu cùng score
              bestIdx = k;
            }
          }
          return bestIdx;
        };

        for (const p of result) {
          // cặp rỗng hoàn toàn
          if (isBye(p.A) && isBye(p.B)) {
            // lấy 1 đội mạnh nhất còn lại
            const first = remaining.shift();
            if (first) {
              p.A = first.s;
              section.commit([String(p.A.__group || "")], p.pair);
              // tìm đối thủ yếu nhất có thể ở cặp này
              const idx = pickBestForPair(p, p.A);
              if (idx >= 0) {
                p.B = remaining.splice(idx, 1)[0].s;
                section.commit([String(p.B.__group || "")], p.pair);
              } else {
                p.B = BYE;
              }
            }
          } else if (!isBye(p.A) && isBye(p.B)) {
            // đã có A (thường là Top1) mà chưa có B → kiếm đối thủ
            const idx = pickBestForPair(p, p.A);
            if (idx >= 0) {
              p.B = remaining.splice(idx, 1)[0].s;
              section.commit([String(p.B.__group || "")], p.pair);
            } else {
              p.B = BYE;
            }
          }
        }

        const finalPairs = fixDoubleByes(result);
        toast.success("Đã đổ seed: Mạnh–Yếu (tránh cùng bảng & phân tán gặp sớm)");
        return { drawSize: size, seeds: finalPairs };
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
      } else if (method === "strongWeakSpread") {
        // Mạnh–Yếu toàn cục:
        // - Ưu tiên rank nhỏ hơn (Top1 > Top2 > Top3 > ...)
        // - Nếu cùng rank: bảng số nhỏ hơn mạnh hơn (B1 > B2 > ... > Bn)
        // - Ghép: mạnh nhất vs yếu nhất, dần vào giữa, cố tránh cùng bảng.

        const all = ranks.flat();

        if (!all.length) {
          toast.info("Không có seed từ vòng bảng để đổ.");
          return { drawSize: size, seeds: [] };
        }

        const parseGroupIndex = (g) => {
          if (g === undefined || g === null || g === "") return 999;
          const m = String(g).match(/\d+/);
          return m ? parseInt(m[0], 10) || 999 : 999;
        };

        // sort mạnh -> yếu
        const strongOrder = [...all].sort((a, b) => {
          const ra = a.__rank || a.ref?.rank || 999;
          const rb = b.__rank || b.ref?.rank || 999;
          if (ra !== rb) return ra - rb;
          const ga = parseGroupIndex(a.__group ?? a.ref?.groupCode);
          const gb = parseGroupIndex(b.__group ?? b.ref?.groupCode);
          return ga - gb;
        });

        // sort yếu -> mạnh
        const weakOrder = [...all].sort((a, b) => {
          const ra = a.__rank || a.ref?.rank || 999;
          const rb = b.__rank || b.ref?.rank || 999;
          if (ra !== rb) return rb - ra;
          const ga = parseGroupIndex(a.__group ?? a.ref?.groupCode);
          const gb = parseGroupIndex(b.__group ?? b.ref?.groupCode);
          return gb - ga;
        });

        const used = new Set();
        const linearSW = [];

        const takeStrong = () => {
          for (const q of strongOrder) {
            if (!used.has(q)) return q;
          }
          return null;
        };

        const takeWeak = (avoidGroup) => {
          let fallback = null;
          for (const q of weakOrder) {
            if (used.has(q)) continue;
            const g = q.__group ?? q.ref?.groupCode;
            if (avoidGroup && g === avoidGroup) {
              if (!fallback) fallback = q; // giữ lại nếu bắt buộc
              continue;
            }
            return q; // khác bảng -> ưu tiên
          }
          return fallback;
        };

        // Ghép mạnh nhất vs yếu nhất, lần lượt tới khi hết slot KO
        while (linearSW.length + 1 < capacity) {
          const s = takeStrong();
          if (!s) break;

          const sGroup = s.__group ?? s.ref?.groupCode;
          const w = takeWeak(sGroup);

          used.add(s);
          linearSW.push(s);

          if (w && linearSW.length < capacity) {
            used.add(w);
            linearSW.push(w);
          } else {
            // không còn đối thủ phù hợp: dừng (sẽ fill sau)
            break;
          }
        }

        // Nếu còn slot trống, nhét phần còn lại theo thứ tự mạnh→yếu rồi yếu→mạnh
        for (const q of strongOrder) {
          if (linearSW.length >= capacity) break;
          if (!used.has(q)) {
            used.add(q);
            linearSW.push(q);
          }
        }
        for (const q of weakOrder) {
          if (linearSW.length >= capacity) break;
          if (!used.has(q)) {
            used.add(q);
            linearSW.push(q);
          }
        }

        const pairs = arrangeLinearIntoKO(linearSW, firstPairs, "default", seedKey);
        const usedCount = Math.min(capacity, linearSW.length);

        toast.success(
          `Đã đổ ${usedCount}/${
            groups.length * N
          } seed từ Vòng bảng sang KO • Kiểu: Mạnh–Yếu xa nhất`
        );
        return { drawSize: size, seeds: pairs };
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

        // Nếu có groupSizes → bật chia dư thủ công và khôi phục extras
        if (gCount > 0 && sizes.length === gCount) {
          const base = Math.floor(sum / gCount);
          const extras = sizes.map((s) => Math.max(0, (Number(s) || 0) - base));
          setManualRemainder(extras.some((e) => e > 0));
          setGroupExtras(Array.from({ length: gCount }, (_, i) => extras[i] || 0));
        } else {
          setManualRemainder(false);
          setGroupExtras(Array.from({ length: gCount }, () => 0));
        }
      } else {
        setGroupTotal(0);
        setGroupSize(gSize || 0);
        setManualRemainder(false);
        setGroupExtras(Array.from({ length: gCount || 0 }, () => 0));
      }
      setGroupTopN(Math.max(1, qualifiersPerGroup));

      const rules = normalizeRulesForState(
        bGroup.rules || cfg.rules || DEFAULT_RULES,
        DEFAULT_RULES
      );
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
      const rules = normalizeRulesForState(
        bPO.rules || cfg.rules || DEFAULT_PO_RULES,
        DEFAULT_PO_RULES
      );
      setPoRules(rules);

      // ✅ nếu bracket có rule từng vòng
      if (Array.isArray(bPO.roundRules) && bPO.roundRules.length) {
        setPoRoundRules(bPO.roundRules.map((r) => normalizeRulesForState(r, DEFAULT_PO_RULES)));
      } else {
        setPoRoundRules(
          Array.from({ length: maxRounds }, () =>
            normalizeRulesForState(bPO.rules || cfg.rules || DEFAULT_PO_RULES, DEFAULT_PO_RULES)
          )
        );
      }
    } else {
      setIncludePO(false);
      setPoPlan((p) => ({ ...p, seeds: [] }));
      setPoRules(DEFAULT_PO_RULES);
      setPoRoundRules([DEFAULT_PO_RULES]);
    }

    // KO
    if (bKO) {
      const cfg = bKO.config || {};
      const drawSize = Number(cfg.drawSize || 2);
      const seeds = Array.isArray(cfg.seeds) ? cfg.seeds : [];
      setKoPlan({ drawSize, seeds });

      const rules = normalizeRulesForState(bKO.rules || cfg.rules || DEFAULT_RULES, DEFAULT_RULES);
      setKoRules(rules);

      const finalRules = bKO.finalRules || cfg.finalRules || null;
      if (finalRules) {
        setKoFinalOverride(true);
        setKoFinalRules(normalizeRulesForState(finalRules, DEFAULT_RULES));
      } else {
        setKoFinalOverride(false);
      }

      // ✅ NEW: semiRules
      const semiRules = bKO.semiRules || cfg.semiRules || null;
      if (semiRules) {
        setKoSemiOverride(true);
        setKoSemiRules(normalizeRulesForState(semiRules, DEFAULT_RULES));
      } else {
        setKoSemiOverride(false);
      }
    }

    setTab("manual");
  };

  // Prefill từ plan đã lưu (ưu tiên hơn việc đoán từ brackets)
  useEffect(() => {
    if (loadingPlan || !savedPlan) return;

    // cho phép BE trả { plan: {...} } hoặc trả thẳng {...}
    const plan = savedPlan?.plan ?? savedPlan;
    if (plan && (plan.groups || plan.po || plan.ko)) {
      applyPlanToManual(plan);
      prefillOnceRef.current = true;
    }
  }, [loadingPlan, savedPlan]);

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
              ...(manualRemainder ? { groupSizes: groupSizes } : {}),
              qualifiersPerGroup: qpg,
              rules: normalizeRulesForState(groupRules, DEFAULT_RULES),
            }
          : {
              count: groupCount,
              size: groupSize,
              qualifiersPerGroup: qpg,
              rules: normalizeRulesForState(groupRules, DEFAULT_RULES),
            }
        : null;

      const planPayload = {
        groups: groupsPayload,
        po: includePO
          ? {
              ...normalizeSeedsPO(poPlan),
              rules: normalizeRulesForState(poRules, DEFAULT_PO_RULES),
              // ✅ gửi thêm rule từng vòng
              roundRules: (poRoundRules || []).map((r) =>
                normalizeRulesForState(r, DEFAULT_PO_RULES)
              ),
            }
          : null,
        ko: {
          ...normalizeSeedsKO(koPlan),
          rules: normalizeRulesForState(koRules, DEFAULT_RULES),
          semiRules: koSemiOverride ? normalizeRulesForState(koSemiRules, DEFAULT_RULES) : null,
          finalRules: koFinalOverride ? normalizeRulesForState(koFinalRules, DEFAULT_RULES) : null,
        },
      };

      // 1) Lưu plan để lần sau vào vẫn có cấu hình
      await updateTournamentPlan({
        tournamentId,
        body: planPayload,
      }).unwrap();

      // 2) Commit brackets; gửi kèm planPayload để tương thích BE hiện tại
      await commitTournamentPlan({
        tournamentId,
        body: {
          ...planPayload,
          ...(hasExisting && allowOverwrite ? { force: true } : {}),
        },
      }).unwrap();

      toast.success(allowOverwrite ? "Đã ghi đè & tạo lại sơ đồ!" : "Đã tạo sơ đồ/khung giải!");
      navigate(`/admin/tournaments/${tournamentId}/brackets`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Tạo sơ đồ thất bại.");
    }
  };

  function poMatchesForRoundLocal(n, r) {
    const N = Math.max(0, Number(n) || 0);
    const R = Math.max(1, Number(r) || 1);
    if (R === 1) return Math.max(1, Math.ceil(N / 2));
    let losersPool = Math.floor(N / 2);
    for (let k = 2; k < R; k++) losersPool = Math.floor(losersPool / 2);
    return Math.max(1, Math.ceil(losersPool / 2));
  }

  if (isLoading || loadingBrackets || loadingPlan) {
    return <Box p={4}>Loading…</Box>;
  }
  if (error || bracketsError || planError) {
    return <Box p={4}>Lỗi tải dữ liệu.</Box>;
  }
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

              {/* Số đội đã thanh toán (đầu vào duy nhất để AI nghĩ) */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                <TextField
                  size="small"
                  type="number"
                  label="Số đội đã thanh toán"
                  value={paidCount}
                  // giữ nguyên như code gốc: nếu muốn chỉnh tay thì sau bạn đổi thành state khác
                  onChange={() => toast.info("Dữ liệu thanh toán đang lấy từ API ạ.")}
                  sx={{ width: 240 }}
                  helperText="AI chỉ dựa vào số lượng này, không gắn đội cụ thể"
                />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="contained" onClick={askOpenAI} disabled={askingAI}>
                  {askingAI ? "Đang hỏi AI" : "Hỏi AI (gợi ý + seed)"}
                </Button>
                <Button variant="outlined" onClick={commitAIPlan} disabled={!aiPlan}>
                  Tạo sơ đồ theo đề xuất
                </Button>
              </Stack>

              {/* Tùy chọn: hiện tóm tắt */}
              {aiPlan && (
                <Alert severity="success" variant="outlined">
                  <AlertTitle>Đề xuất đã sẵn sàng</AlertTitle>
                  {aiPlan.groups
                    ? `Group x${aiPlan.groups.count} → KO ${aiPlan.ko.drawSize}`
                    : aiPlan.po
                    ? `PO ${aiPlan.po.drawSize} → KO ${aiPlan.ko.drawSize}`
                    : `KO ${aiPlan.ko.drawSize}`}
                </Alert>
              )}
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
                        {/* <MenuItem value="pot">Rút “pot” (1 vs 2, tránh cùng bảng)</MenuItem> */}
                        <MenuItem value="antiSameGroup">Tránh cùng bảng tối đa</MenuItem>
                        <MenuItem value="strongWeak">
                          Mạnh–Yếu (Top1 vs Top2; tránh cùng bảng & gặp sớm)
                        </MenuItem>
                        <MenuItem value="strongWeakSpread">
                          Mạnh–Yếu xa nhất (1 mạnh nhất vs yếu nhất, dần vào giữa)
                        </MenuItem>
                      </TextField>

                      <Button
                        variant="outlined"
                        onClick={() => prefillKOfromGroups(group2KOMethod)}
                      >
                        Đổ seed KO từ Vòng bảng
                      </Button>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={manualRemainder}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setManualRemainder(on);
                              if (!on) setGroupExtras(Array.from({ length: groupCount }, () => 0));
                            }}
                            disabled={(Number(groupTotal) || 0) <= 0}
                          />
                        }
                        label="Chia dư thủ công"
                      />
                      {(Number(groupTotal) || 0) > 0 && (
                        <Chip
                          size="small"
                          color={groupRemainder > 0 ? "warning" : "success"}
                          label={`Dư còn lại: ${groupRemainder}`}
                        />
                      )}
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
                        {Array.from(
                          {
                            length: maxPoRoundsFor(poPlan.drawSize),
                          },
                          (_, i) => (
                            <MenuItem key={i + 1} value={i + 1}>{`V${i + 1} (dừng sau vòng ${
                              i + 1
                            })`}</MenuItem>
                          )
                        )}
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
                  {/* Luật tổng – mặc định BO1 */}
                  <RulesEditor
                    label="Luật (PO) – mặc định cho tất cả round"
                    value={poRules}
                    onChange={(val) => {
                      setPoRules(val);
                      // fill các round chưa có
                      setPoRoundRules((prev) => {
                        const need = Math.max(1, Number(poPlan.maxRounds || 1));
                        const next = [];
                        for (let i = 0; i < need; i++) {
                          next.push(prev[i] ? prev[i] : val);
                        }
                        return next;
                      });
                    }}
                  />

                  {/* Luật từng vòng PO */}
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {Array.from(
                      {
                        length: Math.max(1, Number(poPlan.maxRounds || 1)),
                      },
                      (_, idx) => (
                        <RulesEditor
                          key={idx}
                          label={`Luật PO • V${idx + 1}`}
                          value={poRoundRules[idx] || poRules || DEFAULT_PO_RULES}
                          onChange={(val) =>
                            setPoRoundRules((prev) => {
                              const next = prev.slice();
                              next[idx] = val;
                              return next;
                            })
                          }
                        />
                      )
                    )}
                  </Stack>
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
                    setKoPlan((p) => ({
                      ...p,
                      drawSize: parseInt(e.target.value || "2", 10),
                    }))
                  }
                />
                <Chip
                  size="small"
                  label={`KO R1: ${Math.max(1, nextPow2(koPlan.drawSize) / 2)} cặp`}
                />
              </Stack>

              <Box sx={{ mt: 1 }}>
                <RulesEditor label="Luật (KO)" value={koRules} onChange={setKoRules} />

                {/* Mỗi override một dòng riêng */}
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {/* Row: Bán kết */}
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems="flex-start"
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={koSemiOverride}
                          onChange={(e) => setKoSemiOverride(e.target.checked)}
                        />
                      }
                      label="Dùng Rule riêng cho trận Bán kết (KO)"
                      sx={{ minWidth: 240 }}
                    />

                    {koSemiOverride && (
                      <Box sx={{ flexGrow: 1 }}>
                        <RulesEditor
                          label="Luật Bán kết (KO)"
                          value={koSemiRules}
                          onChange={setKoSemiRules}
                        />
                      </Box>
                    )}
                  </Stack>

                  {/* Row: Chung kết */}
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems="flex-start"
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={koFinalOverride}
                          onChange={(e) => setKoFinalOverride(e.target.checked)}
                        />
                      }
                      label="Dùng Rule riêng cho trận Chung kết (KO)"
                      sx={{ minWidth: 240 }}
                    />

                    {koFinalOverride && (
                      <Box sx={{ flexGrow: 1 }}>
                        <RulesEditor
                          label="Luật Chung kết (KO)"
                          value={koFinalRules}
                          onChange={setKoFinalRules}
                        />
                      </Box>
                    )}
                  </Stack>
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
                          label={`Rule: ${ruleSummary(
                            normalizeRulesForState(groupRules, DEFAULT_RULES)
                          )}`}
                        />
                      )}
                      {stage.type === "po" && (
                        <Stack direction="row" spacing={1}>
                          {Array.from(
                            {
                              length: Math.max(1, Number(poPlan.maxRounds || 1)),
                            },
                            (_, ri) => {
                              const r = poRoundRules[ri] || poRules || DEFAULT_PO_RULES;
                              return (
                                <Chip
                                  key={ri}
                                  size="small"
                                  variant="outlined"
                                  label={`PO V${ri + 1}: ${ruleSummary(
                                    normalizeRulesForState(r, DEFAULT_PO_RULES)
                                  )}`}
                                />
                              );
                            }
                          )}
                        </Stack>
                      )}
                      {stage.type === "ko" && (
                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Rule: ${ruleSummary(
                              normalizeRulesForState(koRules, DEFAULT_RULES)
                            )}`}
                          />

                          {koSemiOverride && (
                            <Chip
                              size="small"
                              color="secondary"
                              variant="outlined"
                              label={`Bán kết: ${ruleSummary(
                                normalizeRulesForState(koSemiRules, DEFAULT_RULES)
                              )}`}
                            />
                          )}

                          {koFinalOverride && (
                            <Chip
                              size="small"
                              color="secondary"
                              variant="outlined"
                              label={`Chung kết: ${ruleSummary(
                                normalizeRulesForState(koFinalRules, DEFAULT_RULES)
                              )}`}
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
                                <Typography variant="subtitle2">
                                  {`Dự kiến ${sizeThis} đội • ${RR_MATCHES(sizeThis)} trận`}
                                </Typography>
                                {manualRemainder && (Number(groupTotal) || 0) > 0 && (
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    sx={{ ml: 1 }}
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setGroupExtras((prev) => {
                                          const next = Array.from(
                                            {
                                              length: groupCount,
                                            },
                                            (_, i) => prev[i] || 0
                                          );
                                          if (next[gi] > 0) next[gi] -= 1;
                                          else toast.info("Nhóm này chưa nhận dư để bớt.");
                                          return next;
                                        });
                                      }}
                                    >
                                      <RemoveIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        if (groupRemainder <= 0) {
                                          toast.info("Hết số dư để phân bổ.");
                                          return;
                                        }
                                        setGroupExtras((prev) => {
                                          const next = Array.from(
                                            {
                                              length: groupCount,
                                            },
                                            (_, i) => prev[i] || 0
                                          );
                                          next[gi] += 1;
                                          return next;
                                        });
                                      }}
                                    >
                                      <AddIcon fontSize="small" />
                                    </IconButton>
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={`+${groupExtras[gi] || 0}`}
                                    />
                                  </Stack>
                                )}
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
