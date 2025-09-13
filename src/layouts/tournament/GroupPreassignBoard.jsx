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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Container,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

// ✅ Bracket APIs
import {
  useGetOnlyBracketQuery,
  useBulkAssignSlotPlanMutation,
  useStartGroupDrawMutation,
} from "slices/bracketsApiSlice";

// ✅ Tournament APIs (lấy registrations theo tournament)
import { useGetRegistrationsQuery } from "slices/tournamentsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const keyOf = (poolKey, slotIndex) => `${poolKey}:${slotIndex}`;

/* =========================
 *  NICKNAME-ONLY HELPERS
 * ========================= */
const safe = (s) => (s && String(s).trim()) || "";
const pNick = (p) => safe(p?.nickName);
const pScore = (p) => (typeof p?.score === "number" ? p.score : null);
const pAvatar = (p) => safe(p?.avatar);

// Build view-model từ 1 registration: label = nickname ONLY
function makeRegView(reg) {
  const p1 = reg?.player1 || null;
  const p2 = reg?.player2 || null;
  const isDouble = !!p2;

  const nick1 = pNick(p1);
  const nick2 = p2 ? pNick(p2) : "";

  const label = isDouble ? [nick1 || "?", nick2 || "?"].join(" & ") : nick1 || "(chưa có nickname)";

  // rating: đơn = p1.score, đôi = average nếu có
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
    label, // <- CHỈ nickname
    subtitle: "", // <- bỏ subtext để gọn
    rating,
    avatars: isDouble ? [pAvatar(p1) || null, pAvatar(p2) || null] : [pAvatar(p1) || null],
  };
}

export default function GroupPreassignBoard({ bid: bidProp }) {
  const { bracketId: bidFromParams } = useParams();
  const [search] = useSearchParams();
  const bid = bidProp ?? bidFromParams;
  const tid = search.get("t"); // tournament id từ query param ?t=...

  // 1) Load bracket để render groups/name
  const {
    data: bracket,
    isLoading: loadingBracket,
    refetch: refetchBracket,
  } = useGetOnlyBracketQuery(bid, { skip: !bid });

  // 2) Registrations theo tournament (admin path)
  const {
    data: registrations = [],
    isLoading: loadingRegs,
    refetch: refetchRegs,
  } = useGetRegistrationsQuery(tid, { skip: !tid });

  const [bulkAssign, { isLoading: saving }] = useBulkAssignSlotPlanMutation();
  const [startGroupDraw, { isLoading: starting }] = useStartGroupDrawMutation();

  // Local plan
  const [plan, setPlan] = useState(new Map());
  const [defaultLock, setDefaultLock] = useState(true);
  const [notice, setNotice] = useState("");

  // Seed plan từ bracket.slotPlan
  useEffect(() => {
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

  const groups = useMemo(() => bracket?.groups || [], [bracket]);

  // Chuẩn hoá options từ payload thực tế (đơn/đôi) -> nickname-only
  const regOptions = useMemo(() => registrations.map(makeRegView), [registrations]);

  // tiện ích lấy option theo id
  const optById = useMemo(() => {
    const m = new Map();
    regOptions.forEach((o) => m.set(String(o.id), o));
    return m;
  }, [regOptions]);

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

  // Dialog
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
        // swap
        setSlot(exist.poolKey, exist.slotIndex, {
          poolKey: exist.poolKey,
          slotIndex: exist.slotIndex,
          regId: cur.regId,
          locked: exist.locked,
        });
        setSlot(poolKey, slotIndex, { poolKey, slotIndex, regId: pick.id, locked: lock });
        setNotice("Đã hoán đổi (swap) 2 đội.");
      } else {
        // move
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

  // Persist
  const toAssignments = (mapPlan) =>
    Array.from(mapPlan.values()).map((v) => ({
      poolKey: v.poolKey,
      slotIndex: v.slotIndex,
      regId: v.regId,
      locked: !!v.locked,
    }));

  const handleSave = async () => {
    if (!bid) {
      setNotice("Thiếu bracketId trong URL.");
      return;
    }
    if (!tid) {
      setNotice("Thiếu tournament id (?t=...) trong URL.");
      return;
    }
    const assignments = toAssignments(plan);

    const seen = new Set();
    for (const a of assignments) {
      if (seen.has(a.regId)) {
        setNotice("Một đội xuất hiện nhiều hơn 1 slot. Vui lòng kiểm tra lại.");
        return;
      }
      seen.add(a.regId);
    }

    try {
      await bulkAssign({ bid, body: { assignments, conflictPolicy: "replace" } }).unwrap();
      setNotice("Đã lưu cơ cấu slot.");
      await Promise.all([refetchBracket(), refetchRegs()]);
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi lưu cơ cấu");
    }
  };

  const handleStartDraw = async () => {
    if (!bid) {
      setNotice("Thiếu bracketId trong URL.");
      return;
    }
    try {
      await startGroupDraw({ bid, body: {} }).unwrap();
      setNotice("Đã bắt đầu bốc thăm vòng bảng (pre-assign đã được giữ).");
    } catch (e) {
      setNotice(e?.data?.message || "Lỗi start draw");
    }
  };

  // Render guards
  if (!bid) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">
            Thiếu <code>:bracketId</code> trong route hoặc prop <code>bid</code>.
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  if (!tid) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">
            Thiếu <code>?t=&lt;tournamentId&gt;</code> trong URL. Ví dụ:
            <br />
            <code>/admin/brackets/{bid}/preassign?t=YOUR_TOURNAMENT_ID</code>
          </Alert>
        </Container>
      </DashboardLayout>
    );
  }

  if (loadingBracket || loadingRegs) {
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

  const totalGroups = (groups || []).length;
  const totalSlots = (groups || []).reduce((s, g) => s + (g.size ?? g.expectedSize ?? 0), 0) || 0;

  const usedRegIds = new Set(Array.from(plan.values()).map((v) => String(v.regId)));
  const assignedCount = usedRegIds.size;
  const regsCount = registrations.length;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
          >
            <Typography variant="h6" sx={{ minWidth: 0 }}>
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
                onClick={handleSave}
                disabled={saving}
              >
                Lưu cơ cấu
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={handleStartDraw}
                disabled={starting}
              >
                Bắt đầu bốc thăm
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            {(groups || []).map((g, gi) => {
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
                          const label = opt ? opt.label : "— trống —";
                          const type = opt?.type;

                          return (
                            <Box
                              key={`${poolKey}-${idx}`}
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "max-content 1fr max-content max-content",
                                gap: 1,
                                alignItems: "center",
                                border: "1px dashed",
                                borderColor: cur ? "divider" : "transparent",
                                borderRadius: 1,
                                p: 1,
                                overflow: "hidden", // chống tràn khối ngoài
                                "&:hover": { backgroundColor: "action.hover" },
                              }}
                            >
                              <Chip label={`#${idx}`} size="small" sx={{ mr: 0.5 }} />

                              <Button
                                variant={cur ? "contained" : "outlined"}
                                onClick={() => openAssign(poolKey, idx)}
                                sx={{
                                  justifySelf: "stretch",
                                  textTransform: "none",
                                  width: "100%",
                                  overflow: "hidden", // chống tràn trong button
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{
                                    width: "100%",
                                    justifyContent: "flex-start",
                                    minWidth: 0, // rất quan trọng cho ellipsis
                                  }}
                                >
                                  {opt ? (
                                    type === "double" ? (
                                      <Stack direction="row" spacing={-0.5} sx={{ flexShrink: 0 }}>
                                        <Avatar
                                          alt=""
                                          src={opt.avatars?.[0] || undefined}
                                          sx={{ width: 24, height: 24 }}
                                        />
                                        <Avatar
                                          alt=""
                                          src={opt.avatars?.[1] || undefined}
                                          sx={{
                                            width: 24,
                                            height: 24,
                                            ml: "-8px",
                                            border: "2px solid white",
                                          }}
                                        />
                                      </Stack>
                                    ) : (
                                      <Avatar
                                        alt=""
                                        src={opt.avatars?.[0] || undefined}
                                        sx={{ width: 24, height: 24, flexShrink: 0 }}
                                      />
                                    )
                                  ) : null}

                                  <Stack
                                    direction="column"
                                    sx={{
                                      textAlign: "left",
                                      flex: 1,
                                      minWidth: 0,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <Typography variant="body2" fontWeight={600} noWrap>
                                      {label}
                                    </Typography>
                                  </Stack>

                                  {opt?.rating != null ? (
                                    <Chip
                                      size="small"
                                      sx={{ ml: 1, flexShrink: 0 }}
                                      label={`⭐ ${Number(opt.rating).toFixed(1)}`}
                                    />
                                  ) : null}
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

          {/* Dialog chọn đội */}
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
                  getOptionLabel={(o) => o.label} // nickname-only
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(p) => <TextField {...p} label="Chọn đội để gán" autoFocus />}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props;
                    return (
                      <ListItem key={key} {...rest} sx={{ alignItems: "center" }}>
                        <ListItemAvatar sx={{ minWidth: 56 }}>
                          {option.type === "double" ? (
                            <Stack direction="row" spacing={-0.5}>
                              <Avatar
                                alt=""
                                src={option.avatars?.[0] || undefined}
                                sx={{ width: 32, height: 32 }}
                              />
                              <Avatar
                                alt=""
                                src={option.avatars?.[1] || undefined}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  ml: "-10px",
                                  border: "2px solid white",
                                }}
                              />
                            </Stack>
                          ) : (
                            <Avatar
                              alt=""
                              src={option.avatars?.[0] || undefined}
                              sx={{ width: 32, height: 32 }}
                            />
                          )}
                        </ListItemAvatar>

                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ minWidth: 0, overflow: "hidden" }}
                            >
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                                sx={{ minWidth: 0, flex: 1 }}
                              >
                                {option.label}
                              </Typography>
                              <Chip
                                size="small"
                                label={option.type === "double" ? "Đôi" : "Đơn"}
                                sx={{ flexShrink: 0 }}
                              />
                              {option.rating != null ? (
                                <Chip
                                  size="small"
                                  label={`⭐ ${option.rating.toFixed(1)}`}
                                  sx={{ flexShrink: 0 }}
                                />
                              ) : null}
                            </Stack>
                          }
                          secondary={null}
                        />
                      </ListItem>
                    );
                  }}
                />

                {pick &&
                  (() => {
                    const ex = findSlotByReg(pick.id);
                    if (ex && (ex.poolKey !== dlg.poolKey || ex.slotIndex !== dlg.slotIndex)) {
                      return (
                        <Alert severity="warning">
                          Đội đã ở Bảng {ex.poolKey} Slot #{ex.slotIndex}. Gán vào đây sẽ{" "}
                          <strong>move</strong> nếu slot trống hoặc <strong>swap</strong> nếu slot
                          này có đội.
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

          <Snackbar
            open={!!notice}
            autoHideDuration={2600}
            onClose={() => setNotice("")}
            message={notice}
          />
        </Stack>
      </Container>
    </DashboardLayout>
  );
}

GroupPreassignBoard.propTypes = {
  bid: PropTypes.string, // optional
  key: PropTypes.any,
};
