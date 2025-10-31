// layouts/tournament/GroupPreassignBoard.jsx
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

// RTK Query
import {
  useGetOnlyBracketQuery,
  useGetDrawStatusQuery,
  useBulkAssignSlotPlanMutation,
  useBulkAssignPoPlanMutation, // theo bracket
  useStartGroupDrawMutation,
  useStartPoDrawMutation,
} from "slices/bracketsApiSlice";
import { useGetRegistrationsQuery } from "slices/tournamentsApiSlice";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const keyOf = (poolKey, slotIndex) => `${poolKey}:${slotIndex}`;
const safe = (s) => (s && String(s).trim()) || "";
const pNick = (p) => safe(p?.nickName);
const pScore = (p) => (typeof p?.score === "number" ? p.score : null);
const pAvatar = (p) => safe(p?.avatar);

function makeRegView(reg) {
  const p1 = reg?.player1 || null;
  const p2 = reg?.player2 || null;
  const isDouble = !!p2;

  const nick1 = pNick(p1);
  const nick2 = p2 ? pNick(p2) : "";
  const label = isDouble ? [nick1 || "?", nick2 || "?"].join(" & ") : nick1 || "(chưa có nickname)";

  const s1 = pScore(p1);
  const s2 = pScore(p2);
  let rating = null;
  if (!isDouble) rating = s1 ?? null;
  else {
    const valid = [s1, s2].filter((n) => typeof n === "number");
    rating = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  }

  return {
    id: String(reg?._id),
    type: isDouble ? "double" : "single",
    label,
    rating,
    avatars: isDouble ? [pAvatar(p1) || null, pAvatar(p2) || null] : [pAvatar(p1) || null],
  };
}

// xác định group / po
const detectBracketKind = (br = {}) => {
  const t = (br.type || "").toLowerCase();
  if (["group", "round_robin", "gsl", "swiss"].includes(t)) return "group";
  if (["knockout", "roundelim", "double_elim"].includes(t)) return "po";
  if (Array.isArray(br.groups) && br.groups.length > 0) return "group";
  if (Array.isArray(br.slotPlan) && br.slotPlan.length > 0) return "group";
  if (Array.isArray(br.prefill?.seeds) && br.prefill.seeds.length > 0) return "po";
  if (br.config?.roundElim) return "po";
  if (
    typeof br.meta?.expectedFirstRoundMatches === "number" &&
    br.meta.expectedFirstRoundMatches > 0
  )
    return "po";
  return "group";
};

/**
 * Build toàn bộ cặp PO từ:
 * - bracket.poPreplan (fixed + pools)
 * - drawStatus (reveal/session)
 * - meta.expectedFirstRoundMatches
 */
const buildPoPlanAll = (bracket, drawStatus) => {
  const poPreplan = bracket?.poPreplan || {};
  const fixed = Array.isArray(poPreplan.fixed) ? poPreplan.fixed : [];
  const pools = Array.isArray(poPreplan.pools) ? poPreplan.pools : [];

  let pairCount = 0;

  const maxFixed = fixed.reduce((m, f) => {
    const idx =
      typeof f.pairIndex === "number" ? f.pairIndex : typeof f.pair === "number" ? f.pair - 1 : -1;
    return idx >= 0 ? Math.max(m, idx + 1) : m;
  }, 0);
  pairCount = Math.max(pairCount, maxFixed);

  const maxPools = pools.reduce((m, p) => {
    const idx =
      typeof p.pairIndex === "number" ? p.pairIndex : typeof p.pair === "number" ? p.pair - 1 : -1;
    return idx >= 0 ? Math.max(m, idx + 1) : m;
  }, 0);
  pairCount = Math.max(pairCount, maxPools);

  if (drawStatus?.mode === "po" && Array.isArray(drawStatus.reveals)) {
    pairCount = Math.max(pairCount, drawStatus.reveals.length);
  }

  const sess = drawStatus?.session || drawStatus?.draw || null;
  if (sess?.board?.pairs && Array.isArray(sess.board.pairs)) {
    pairCount = Math.max(pairCount, sess.board.pairs.length);
  }

  if (
    typeof bracket?.meta?.expectedFirstRoundMatches === "number" &&
    bracket.meta.expectedFirstRoundMatches > 0
  ) {
    pairCount = Math.max(pairCount, bracket.meta.expectedFirstRoundMatches);
  }

  if (Array.isArray(bracket?.prefill?.seeds) && bracket.prefill.seeds.length > 0) {
    pairCount = Math.max(pairCount, bracket.prefill.seeds.length);
  }

  if (!pairCount) pairCount = 8;

  const rows = [];
  for (let i = 0; i < pairCount; i += 1) {
    const row = {
      pairIndex: i,
      A: { displayName: null, fixed: null, fromBracket: false, candidates: [] },
      B: { displayName: null, fixed: null, fromBracket: false, candidates: [] },
    };

    // từ drawStatus.reveals
    if (drawStatus?.mode === "po" && Array.isArray(drawStatus.reveals) && drawStatus.reveals[i]) {
      row.A.displayName = drawStatus.reveals[i].AName ?? null;
      row.B.displayName = drawStatus.reveals[i].BName ?? null;
    }

    // từ bracket.poPreplan.fixed
    const fxA =
      fixed.find(
        (f) => (f.pairIndex === i || f.pairIndex === i + 1 || f.pair === i + 1) && f.side === "A"
      ) || null;
    const fxB =
      fixed.find(
        (f) => (f.pairIndex === i || f.pairIndex === i + 1 || f.pair === i + 1) && f.side === "B"
      ) || null;

    if (fxA) {
      if (fxA.reg) {
        row.A.fixed = String(fxA.reg);
        row.A.candidates = [String(fxA.reg)];
      }
      if (!row.A.displayName && fxA.label) row.A.displayName = fxA.label;
      row.A.fromBracket = true;
    }
    if (fxB) {
      if (fxB.reg) {
        row.B.fixed = String(fxB.reg);
        row.B.candidates = [String(fxB.reg)];
      }
      if (!row.B.displayName && fxB.label) row.B.displayName = fxB.label;
      row.B.fromBracket = true;
    }

    // từ bracket.poPreplan.pools → gán vào candidates
    const poolA =
      pools.find(
        (p) => (p.pairIndex === i || p.pairIndex === i + 1 || p.pair === i + 1) && p.side === "A"
      ) || null;
    const poolB =
      pools.find(
        (p) => (p.pairIndex === i || p.pairIndex === i + 1 || p.pair === i + 1) && p.side === "B"
      ) || null;

    if (poolA && Array.isArray(poolA.candidates)) {
      row.A.candidates = poolA.candidates.map(String);
      row.A.fixed = row.A.candidates.length === 1 ? row.A.candidates[0] : null;
    }
    if (poolB && Array.isArray(poolB.candidates)) {
      row.B.candidates = poolB.candidates.map(String);
      row.B.fixed = row.B.candidates.length === 1 ? row.B.candidates[0] : null;
    }

    rows.push(row);
  }

  return rows;
};

export default function GroupPreassignBoard({ bid: bidProp }) {
  const { bracketId: bidFromParams } = useParams();
  const [search] = useSearchParams();
  const bid = bidProp ?? bidFromParams;
  const tid = search.get("t");

  const {
    data: bracket,
    isLoading: loadingBracket,
    refetch: refetchBracket,
  } = useGetOnlyBracketQuery(bid, { skip: !bid });

  const {
    data: drawStatus,
    refetch: refetchDrawStatus,
    isLoading: loadingDrawStatus,
  } = useGetDrawStatusQuery(bid, { skip: !bid });

  const {
    data: registrations = [],
    isLoading: loadingRegs,
    refetch: refetchRegs,
  } = useGetRegistrationsQuery(tid, { skip: !tid });

  const [bulkAssign, { isLoading: savingGroup }] = useBulkAssignSlotPlanMutation();
  const [startGroupDraw, { isLoading: startingGroup }] = useStartGroupDrawMutation();
  const [startPoDraw, { isLoading: startingPo }] = useStartPoDrawMutation();
  const [bulkAssignPo, { isLoading: savingPo }] = useBulkAssignPoPlanMutation();

  // GROUP
  const [plan, setPlan] = useState(new Map());
  const [defaultLock, setDefaultLock] = useState(true);
  const [notice, setNotice] = useState("");

  // PO
  const [poPlan, setPoPlan] = useState([]);

  const regOptions = useMemo(() => registrations.map(makeRegView), [registrations]);
  const optById = useMemo(() => {
    const m = new Map();
    regOptions.forEach((o) => m.set(String(o.id), o));
    return m;
  }, [regOptions]);

  // init group
  useEffect(() => {
    if (!bracket) return;
    const m = new Map();
    (bracket?.slotPlan || []).forEach((a) => {
      m.set(keyOf(a.poolKey, a.slotIndex), {
        poolKey: a.poolKey,
        slotIndex: a.slotIndex,
        regId: String(a.registration?._id || a.registration),
        locked: a.locked !== false,
      });
    });
    setPlan(m);
  }, [bracket]);

  // init PO
  useEffect(() => {
    if (!bracket && !drawStatus) return;
    const rows = buildPoPlanAll(bracket || {}, drawStatus || {});
    setPoPlan(rows);
  }, [bracket, drawStatus]);

  // group helpers
  const getSlot = (k, i) => plan.get(keyOf(k, i));
  const setSlot = (k, i, entry) =>
    setPlan((prev) => {
      const m = new Map(prev);
      const key = keyOf(k, i);
      if (!entry) m.delete(key);
      else m.set(key, entry);
      return m;
    });
  const findSlotByReg = (regId) => {
    for (const v of plan.values()) if (String(v.regId) === String(regId)) return v;
    return null;
  };

  const [dlg, setDlg] = useState({ open: false, poolKey: "", slotIndex: 0, current: null });
  const [pick, setPick] = useState(null);

  const openAssign = (poolKey, slotIndex) => {
    const cur = getSlot(poolKey, slotIndex) || null;
    setPick(cur?.regId ? optById.get(String(cur.regId)) || null : null);
    setDlg({ open: true, poolKey, slotIndex, current: cur });
  };
  const closeAssign = () => setDlg((s) => ({ ...s, open: false }));

  const applyAssign = () => {
    if (!pick) return closeAssign();
    const { poolKey, slotIndex } = dlg;
    const cur = getSlot(poolKey, slotIndex);
    const lock = cur?.locked ?? defaultLock;

    const exist = findSlotByReg(pick.id);
    if (exist && (exist.poolKey !== poolKey || exist.slotIndex !== slotIndex)) {
      if (cur?.regId) {
        setSlot(exist.poolKey, exist.slotIndex, {
          poolKey: exist.poolKey,
          slotIndex: exist.slotIndex,
          regId: cur.regId,
          locked: exist.locked,
        });
        setSlot(poolKey, slotIndex, { poolKey, slotIndex, regId: pick.id, locked: lock });
        setNotice("Đã hoán đổi 2 đội.");
      } else {
        setSlot(exist.poolKey, exist.slotIndex, null);
        setSlot(poolKey, slotIndex, { poolKey, slotIndex, regId: pick.id, locked: lock });
        setNotice("Đã chuyển đội vào slot mới.");
      }
    } else {
      setSlot(poolKey, slotIndex, { poolKey, slotIndex, regId: pick.id, locked: lock });
    }
    closeAssign();
  };

  const toggleLock = (poolKey, slotIndex) => {
    const cur = getSlot(poolKey, slotIndex);
    if (!cur) return;
    setSlot(poolKey, slotIndex, { ...cur, locked: !cur.locked });
  };

  const clearSlot = (poolKey, slotIndex) => {
    setSlot(poolKey, slotIndex, null);
  };

  const toGroupAssignments = (mapPlan) =>
    Array.from(mapPlan.values()).map((v) => ({
      poolKey: v.poolKey,
      slotIndex: v.slotIndex,
      regId: v.regId,
      locked: !!v.locked,
    }));

  const handleSaveGroup = async () => {
    if (!bid || !tid) {
      setNotice("Thiếu bracketId hoặc tournamentId.");
      return;
    }
    const assignments = toGroupAssignments(plan);

    const seen = new Set();
    for (const a of assignments) {
      if (seen.has(a.regId)) {
        setNotice("Một đội đang ở nhiều slot. Kiểm tra lại ạ.");
        return;
      }
      seen.add(a.regId);
    }

    try {
      await bulkAssign({ bid, body: { assignments, conflictPolicy: "replace" } }).unwrap();
      setNotice("Đã lưu cơ cấu vòng bảng.");
      await Promise.all([refetchBracket(), refetchRegs()]);
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi lưu cơ cấu vòng bảng");
    }
  };

  const handleStartGroupDraw = async () => {
    if (!bid) {
      setNotice("Thiếu bracketId.");
      return;
    }
    try {
      await startGroupDraw({ bid, body: {} }).unwrap();
      setNotice("Đã bắt đầu bốc thăm vòng bảng.");
      await refetchDrawStatus();
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi start draw");
    }
  };

  // ===== PO =====
  const handleStartPo = async () => {
    if (!bid) {
      setNotice("Thiếu bracketId.");
      return;
    }
    try {
      await startPoDraw({ bid, body: {} }).unwrap();
      setNotice("Đã bắt đầu bốc thăm PO.");
      await refetchDrawStatus();
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi start PO draw");
    }
  };

  const handleSavePo = async () => {
    if (!bid) {
      setNotice("Thiếu bracketId.");
      return;
    }

    const fixed = [];
    const pools = [];

    (poPlan || []).forEach((row) => {
      // A
      const aIds = Array.isArray(row.A?.candidates)
        ? row.A.candidates
        : row.A?.fixed
        ? [row.A.fixed]
        : [];
      if (aIds.length === 1) {
        fixed.push({
          pairIndex: row.pairIndex,
          side: "A",
          reg: aIds[0],
        });
      } else if (aIds.length > 1) {
        pools.push({
          pairIndex: row.pairIndex,
          side: "A",
          candidates: aIds,
        });
      }

      // B
      const bIds = Array.isArray(row.B?.candidates)
        ? row.B.candidates
        : row.B?.fixed
        ? [row.B.fixed]
        : [];
      if (bIds.length === 1) {
        fixed.push({
          pairIndex: row.pairIndex,
          side: "B",
          reg: bIds[0],
        });
      } else if (bIds.length > 1) {
        pools.push({
          pairIndex: row.pairIndex,
          side: "B",
          candidates: bIds,
        });
      }
    });

    try {
      await bulkAssignPo({
        bid,
        body: {
          fixed,
          pools,
          avoidPairs: [],
          mustPairs: [],
        },
      }).unwrap();
      setNotice("Đã lưu cơ cấu PO.");
      await Promise.all([refetchBracket(), refetchDrawStatus()]);
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi lưu cơ cấu PO");
    }
  };

  const clearPoSlot = (pairIndex, side) => {
    setPoPlan((prev) =>
      prev.map((row) => {
        if (row.pairIndex !== pairIndex) return row;
        if (side === "A") {
          return {
            ...row,
            A: {
              ...row.A,
              candidates: [],
              fixed: null,
              fromBracket: false,
            },
          };
        }
        return {
          ...row,
          B: {
            ...row.B,
            candidates: [],
            fixed: null,
            fromBracket: false,
          },
        };
      })
    );
  };

  // ===== guards =====
  if (!bid) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">Thiếu :bracketId.</Alert>
        </Container>
      </DashboardLayout>
    );
  }
  if (!tid) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">Thiếu ?t=&lt;tournamentId&gt; trên URL.</Alert>
        </Container>
      </DashboardLayout>
    );
  }
  if (loadingBracket || loadingRegs || loadingDrawStatus) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Stack alignItems="center" justifyContent="center">
            <CircularProgress />
          </Stack>
        </Container>
      </DashboardLayout>
    );
  }
  if (!bracket) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">Không tải được Bracket.</Alert>
        </Container>
      </DashboardLayout>
    );
  }

  const kind = detectBracketKind(bracket);
  const isGroup = kind === "group";
  const isPo = kind === "po";

  const totalGroups = (bracket.groups || []).length;
  const totalSlots =
    (bracket.groups || []).reduce((s, g) => s + (g.size ?? g.expectedSize ?? 0), 0) || 0;
  const usedRegIds = new Set(Array.from(plan.values()).map((v) => String(v.regId)));
  const assignedCount = usedRegIds.size;
  const regsCount = registrations.length;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* GROUP */}
        {isGroup && (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
              <Typography variant="h6">
                {bracket?.name ? `Cơ cấu vòng bảng • ${bracket.name}` : "Cơ cấu vòng bảng"} •{" "}
                {totalGroups} bảng • {totalSlots} slot
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`Đã gán: ${assignedCount}/${regsCount}`} size="small" />
                <Typography variant="body2">Lock mặc định</Typography>
                <Switch checked={defaultLock} onChange={(e) => setDefaultLock(e.target.checked)} />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveGroup}
                  disabled={savingGroup}
                >
                  Lưu cơ cấu
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStartGroupDraw}
                  disabled={startingGroup}
                >
                  Bắt đầu bốc thăm
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              {(bracket.groups || []).map((g, gi) => {
                const poolKey = g.key || g.name || String.fromCharCode(65 + gi);
                const size = Number(g.size ?? g.expectedSize ?? (g.regIds?.length || 0)) || 0;

                return (
                  <Grid item xs={12} md={6} lg={4} key={poolKey}>
                    <Card>
                      <CardHeader title={`Bảng ${poolKey}`} subheader={`Slots: ${size}`} />
                      <CardContent>
                        <Stack spacing={1}>
                          {Array.from({ length: size }, (_, i) => i + 1).map((idx) => {
                            const cur = getSlot(poolKey, idx);
                            const opt = cur ? optById.get(String(cur.regId)) : null;

                            return (
                              <Box
                                key={`${poolKey}-${idx}`}
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "max-content 1fr max-content max-content",
                                  gap: 1,
                                  alignItems: "center",
                                  border: cur
                                    ? "1px dashed rgba(0,0,0,0.12)"
                                    : "1px solid transparent",
                                  borderRadius: 1,
                                  p: 1,
                                  "&:hover": { backgroundColor: "action.hover" },
                                }}
                              >
                                <Chip label={`#${idx}`} size="small" sx={{ mr: 0.5 }} />
                                <Button
                                  variant={cur ? "contained" : "outlined"}
                                  onClick={() => openAssign(poolKey, idx)}
                                  sx={{ textTransform: "none" }}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    {opt ? (
                                      opt.type === "double" ? (
                                        <Stack direction="row" spacing={-0.5}>
                                          <Avatar
                                            src={opt.avatars?.[0] || undefined}
                                            sx={{ width: 24, height: 24 }}
                                          />
                                          <Avatar
                                            src={opt.avatars?.[1] || undefined}
                                            sx={{
                                              width: 24,
                                              height: 24,
                                              ml: "-8px",
                                              border: "2px solid #fff",
                                            }}
                                          />
                                        </Stack>
                                      ) : (
                                        <Avatar
                                          src={opt.avatars?.[0] || undefined}
                                          sx={{ width: 24, height: 24 }}
                                        />
                                      )
                                    ) : null}
                                    <Typography variant="body2" noWrap maxWidth={180}>
                                      {opt ? opt.label : "— trống —"}
                                    </Typography>
                                  </Stack>
                                </Button>

                                <Tooltip title={cur?.locked ? "Khoá slot" : "Mở khoá slot"}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => toggleLock(poolKey, idx)}
                                      disabled={!cur}
                                    >
                                      {cur?.locked ? (
                                        <LockIcon fontSize="small" />
                                      ) : (
                                        <LockOpenIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Tooltip title="Xoá đội khỏi slot">
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => clearSlot(poolKey, idx)}
                                      disabled={!cur}
                                      color="error"
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            );
                          })}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        )}

        {/* PO */}
        {isPo && (
          <Stack spacing={2} sx={{ mt: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
              <Typography variant="h6">
                {bracket?.name ? `Cơ cấu vòng PO • ${bracket.name}` : "Cơ cấu vòng PO"}
              </Typography>
              <Stack direction="row" spacing={1}>
                {/* <Button
                  variant="outlined"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStartPo}
                  disabled={startingPo}
                >
                  Bắt đầu bốc thăm PO
                </Button> */}
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSavePo}
                  disabled={savingPo}
                >
                  Lưu cơ cấu PO
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              {poPlan.map((row) => {
                const valueA = (
                  row.A?.candidates?.length ? row.A.candidates : row.A?.fixed ? [row.A.fixed] : []
                )
                  .map((id) => optById.get(String(id)))
                  .filter(Boolean);

                const valueB = (
                  row.B?.candidates?.length ? row.B.candidates : row.B?.fixed ? [row.B.fixed] : []
                )
                  .map((id) => optById.get(String(id)))
                  .filter(Boolean);

                return (
                  <Grid item xs={12} md={6} lg={4} key={row.pairIndex}>
                    <Card>
                      <CardHeader
                        title={`Cặp #${row.pairIndex + 1}`}
                        subheader={`pairIndex = ${row.pairIndex + 1}`}
                      />
                      <CardContent>
                        <Stack spacing={2}>
                          {/* SLOT A */}
                          <Box>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Slot A ({valueA.length} đội)
                              </Typography>
                              {valueA.length ? (
                                <Tooltip title="Bỏ cơ cấu slot A">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => clearPoSlot(row.pairIndex, "A")}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </Stack>

                            {row.A.displayName ? (
                              <Alert severity="info" sx={{ my: 1 }}>
                                BE: {row.A.displayName}
                              </Alert>
                            ) : null}
                            {row.A.fromBracket ? (
                              <Chip
                                label="Đã cơ cấu từ bracket"
                                size="small"
                                color="success"
                                sx={{ mb: 1 }}
                              />
                            ) : null}

                            <Autocomplete
                              multiple
                              disableCloseOnSelect
                              options={regOptions}
                              value={valueA}
                              onChange={(e, v) => {
                                const ids = v.map((x) => String(x.id));
                                setPoPlan((prev) =>
                                  prev.map((p) =>
                                    p.pairIndex === row.pairIndex
                                      ? {
                                          ...p,
                                          A: {
                                            ...p.A,
                                            candidates: ids,
                                            fixed: ids.length === 1 ? ids[0] : null,
                                            fromBracket: false,
                                          },
                                        }
                                      : p
                                  )
                                );
                              }}
                              getOptionLabel={(o) => o.label}
                              isOptionEqualToValue={(o, v) => o?.id === v?.id}
                              renderOption={(props, option, { selected }) => (
                                <li {...props}>
                                  <Checkbox style={{ marginRight: 8 }} checked={selected} />
                                  {option.label}
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="(FE) Chọn nhiều đội cho A"
                                  size="small"
                                />
                              )}
                            />
                          </Box>

                          {/* SLOT B */}
                          <Box>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Slot B ({valueB.length} đội)
                              </Typography>
                              {valueB.length ? (
                                <Tooltip title="Bỏ cơ cấu slot B">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => clearPoSlot(row.pairIndex, "B")}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </Stack>

                            {row.B.displayName ? (
                              <Alert severity="info" sx={{ my: 1 }}>
                                BE: {row.B.displayName}
                              </Alert>
                            ) : null}
                            {row.B.fromBracket ? (
                              <Chip
                                label="Đã cơ cấu từ bracket"
                                size="small"
                                color="success"
                                sx={{ mb: 1 }}
                              />
                            ) : null}

                            <Autocomplete
                              multiple
                              disableCloseOnSelect
                              options={regOptions}
                              value={valueB}
                              onChange={(e, v) => {
                                const ids = v.map((x) => String(x.id));
                                setPoPlan((prev) =>
                                  prev.map((p) =>
                                    p.pairIndex === row.pairIndex
                                      ? {
                                          ...p,
                                          B: {
                                            ...p.B,
                                            candidates: ids,
                                            fixed: ids.length === 1 ? ids[0] : null,
                                            fromBracket: false,
                                          },
                                        }
                                      : p
                                  )
                                );
                              }}
                              getOptionLabel={(o) => o.label}
                              isOptionEqualToValue={(o, v) => o?.id === v?.id}
                              renderOption={(props, option, { selected }) => (
                                <li {...props}>
                                  <Checkbox style={{ marginRight: 8 }} checked={selected} />
                                  {option.label}
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="(FE) Chọn nhiều đội cho B"
                                  size="small"
                                />
                              )}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        )}

        <Snackbar
          open={!!notice}
          autoHideDuration={2600}
          onClose={() => setNotice("")}
          message={notice}
        />

        {/* dialog group */}
        <Dialog open={dlg.open} onClose={closeAssign} fullWidth maxWidth="sm">
          <DialogTitle>
            Gán đội • Bảng {dlg.poolKey} • Slot #{dlg.slotIndex}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {dlg.current ? (
                <Alert severity="info">
                  Slot hiện tại:{" "}
                  <strong>
                    {optById.get(String(dlg.current?.regId))?.label || dlg.current?.regId}
                  </strong>{" "}
                  {dlg.current.locked ? "🔒" : "🔓"}
                </Alert>
              ) : (
                <Alert severity="info">Slot đang trống</Alert>
              )}

              <Autocomplete
                options={regOptions}
                value={pick}
                onChange={(e, v) => setPick(v)}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(p) => <TextField {...p} label="Chọn đội để gán" autoFocus />}
              />

              {pick &&
                (() => {
                  const ex = findSlotByReg(pick.id);
                  if (ex && (ex.poolKey !== dlg.poolKey || ex.slotIndex !== dlg.slotIndex)) {
                    return (
                      <Alert severity="warning">
                        Đội đã ở Bảng {ex.poolKey} Slot #{ex.slotIndex}. Gán vào đây sẽ move/swap.
                      </Alert>
                    );
                  }
                  return null;
                })()}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAssign}>Huỷ</Button>
            <Button variant="contained" onClick={applyAssign} disabled={!pick}>
              Gán đội
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </DashboardLayout>
  );
}

GroupPreassignBoard.propTypes = {
  bid: PropTypes.string,
  key: PropTypes.any,
};
