// src/pages/admin/AdminBracketCourtManagerPage.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "context/SocketContext";
import {
  useUpsertCourtsMutation,
  useBuildGroupsQueueMutation,
  useAssignNextHttpMutation,
  useListMatchesQuery,
} from "slices/adminCourtApiSlice";
import { skipToken } from "@reduxjs/toolkit/query";

// MUI
import {
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  IconButton,
  Tooltip,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import QueuePlayNextIcon from "@mui/icons-material/QueuePlayNext";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { toast } from "react-toastify";

/* ================= Helpers (labels, formatters) ================= */
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

// Nhận diện Playoff (PO)
const isPO = (m) => {
  const t = String(m?.type || m?.format || "").toLowerCase();
  return t === "po" || m?.meta?.po === true;
};

// Nhận diện Knockout (KO)
const isKO = (m) => {
  const t = String(m?.type || m?.format || "").toLowerCase();
  return t === "ko" || t === "knockout" || t === "elimination" || m?.meta?.knockout === true;
};

// Chỉ coi là group-like nếu KHÔNG phải KO/PO
const isGroupLike = (m) => {
  if (!m) return false;
  if (isPO(m) || isKO(m)) return false;
  const t = String(m?.type || m?.format || "").toLowerCase();
  if (t === "group" || t === "rr" || t === "roundrobin" || t === "round_robin") return true;
  return !!m?.pool;
};

const viMatchStatus = (s) => {
  switch (s) {
    case "scheduled":
      return "Đã lên lịch";
    case "queued":
      return "Trong hàng đợi";
    case "assigned":
      return "Đã gán trận";
    case "live":
      return "Đang thi đấu";
    case "finished":
      return "Đã kết thúc";
    default:
      return s || "";
  }
};

const matchStatusColor = (s) => {
  switch (s) {
    case "assigned":
      return "info";
    case "live":
      return "warning";
    case "finished":
      return "success";
    case "queued":
    default:
      return "default";
  }
};

const viCourtStatus = (courtStatus) => {
  if (courtStatus === "idle") return "Trống";
  if (courtStatus === "maintenance") return "Bảo trì";
  if (courtStatus === "live") return "Đang thi đấu";
  if (courtStatus === "assigned") return "Đã gán trận";
  return courtStatus || "";
};

const letterToIndex = (s) => {
  const ch = String(s || "")
    .trim()
    .toUpperCase();
  if (/^[A-Z]$/.test(ch)) return ch.charCodeAt(0) - 64;
  return null;
};

const poolBoardLabel = (m) => {
  const p = m?.pool || {};
  if (isNum(p.index)) return `B${p.index}`;
  const raw = String(p.code || p.name || "").trim();
  if (!raw) return "B?";
  const byLetter = letterToIndex(raw);
  if (byLetter) return `B${byLetter}`;
  const m1 = raw.match(/^B(\d+)$/i);
  if (m1) return `B${m1[1]}`;
  if (/^\d+$/.test(raw)) return `B${raw}`;
  return raw;
};

const stageIndexOf = (m) => {
  if (isNum(m?.stageIndex)) return m.stageIndex;
  const lk = String(m?.labelKey || "");
  const hit = /^V(\d+)/i.exec(lk);
  return hit ? Number(hit[1]) : null;
};

const roundTag = (m) => {
  if (!m) return "";
  if (m.roundName) return String(m.roundName).toUpperCase();
  if (typeof m.round === "string") return m.round.toUpperCase();
  if (isGroupLike(m) && isNum(m.round)) return `B${m.round}`;
  if (isNum(m.rrRound)) return `V${m.rrRound}`;
  if ((isKO(m) || isPO(m)) && isNum(m.round)) return `R${m.round}`;
  if (isNum(m.round)) return `R${m.round}`;
  return "";
};

const roundIndexKOPO = (m) => {
  if (isNum(m?.roundIndex)) return m.roundIndex;
  if (isNum(m?.round)) return m.round;
  const tryParse = (str) => {
    const hit = /R(\d+)/i.exec(String(str || ""));
    return hit ? Number(hit[1]) : null;
  };
  return tryParse(m?.labelKey) ?? tryParse(m?.roundName) ?? tryParse(roundTag(m)) ?? null;
};

// ==== QUY ƯỚC MÃ TRẬN ====
// - Group: "V{stageIndex}-B{index}#{order+1}"
// - KO/PO:  "R{index}#{order}"
const buildMatchCode = (m) => {
  if (!m) return "";
  if (isGroupLike(m)) {
    const st = stageIndexOf(m);
    const prefix = isNum(st) ? `V${st}` : "V?";
    const board = poolBoardLabel(m);
    const ord = m.order != null ? `#${(m.order ?? 0) + 1}` : "";
    return `${prefix}-${board}${ord}`;
  }
  if (isKO(m) || isPO(m)) {
    const idx = roundIndexKOPO(m);
    const ord = m.order != null ? `#${m.order}` : "";
    return `R${isNum(idx) ? idx : "?"}${ord}`;
  }
  if (m.labelKey) return String(m.labelKey);
  if (m.code) return String(m.code);
  const r = roundTag(m);
  const ord = m.order != null ? `#${m.order}` : "";
  return `${r}${ord}`;
};

const personName = (p) =>
  !p || typeof p !== "object"
    ? ""
    : p.fullName || p.nickName || p.displayName || p.name || p.email || p.phone || "";

const pairName = (pair) => {
  if (!pair) return "";
  if (pair.displayName || pair.name) return pair.displayName || pair.name;
  const names = [];
  if (pair.player1) names.push(personName(pair.player1));
  if (pair.player2) names.push(personName(pair.player2));
  if (!names.length && Array.isArray(pair.participants)) {
    for (const it of pair.participants) names.push(personName(it?.user || it));
  }
  return names.filter(Boolean).join(" & ");
};

const fmtTime = (v) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "";
  }
};

/* ================= Component ================= */
export default function AdminBracketCourtManagerPage() {
  const { bracketId } = useParams();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Lấy tournamentId từ state hoặc query (?tournamentId= / ?t=)
  const searchParams = new URLSearchParams(location.search || "");
  const tournamentId =
    location?.state?.tournamentId || searchParams.get("tournamentId") || searchParams.get("t");
  const bracketName = location?.state?.bracketName || "";
  const tournamentName = location?.state?.tournamentName || "";
  const bracket = bracketId;

  // ---------- UI state ----------
  const [mode, setMode] = useState("count");
  const [count, setCount] = useState(10);
  const [namesText, setNamesText] = useState("Sân 1\nSân 2\nSân 3");

  const names = useMemo(
    () =>
      namesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [namesText]
  );

  // realtime state
  const [courts, setCourts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [socketMatches, setSocketMatches] = useState([]);
  const notifQueueRef = useRef([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // ---------- RTKQ mutations ----------
  const [upsertCourts, { isLoading: savingCourts }] = useUpsertCourtsMutation();
  const [buildQueue, { isLoading: buildingQueue }] = useBuildGroupsQueueMutation();
  const [assignNextHttp] = useAssignNextHttpMutation();

  // ---------- RTKQ query: finished matches ----------
  const finishedArgs =
    bracket || tournamentId ? { tournamentId, bracket, status: "finished", limit: 500 } : skipToken;

  const {
    data: finishedList = [],
    isFetching: loadingFinished,
    refetch: refetchFinished,
  } = useListMatchesQuery(finishedArgs, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // build map nhanh: id -> match từ socket
  const matchMap = useMemo(() => {
    const map = new Map();
    for (const m of socketMatches) map.set(String(m._id || m.id), m);
    return map;
  }, [socketMatches]);

  const courtIdToName = useMemo(() => {
    const map = new Map();
    for (const c of courts || []) {
      map.set(String(c._id || c.id), c.name || c.label || c.title || c.code || "");
    }
    return map;
  }, [courts]);

  const courtLabelOf = (m) =>
    m?.courtLabel ||
    courtIdToName.get(String(m?.court || "")) ||
    m?.courtName ||
    m?.courtCode ||
    "";

  // ---------- Socket rooms ----------
  useEffect(() => {
    if (!socket || !tournamentId || !bracket) return;

    socket.emit("scheduler:join", { tournamentId, bracket });

    const onState = ({ courts, matches }) => {
      setCourts(courts || []);
      setSocketMatches(matches || []);
      setQueue((matches || []).map((m) => ({ id: m._id || m.id, ...m })));
    };
    const onNotify = (msg) => {
      notifQueueRef.current = [msg, ...notifQueueRef.current].slice(0, 20);
      setSnackbar({ open: true, message: msg?.message || "", severity: msg?.level || "info" });
    };

    const reqState = () => socket.emit("scheduler:requestState", { tournamentId, bracket });
    const onMatchFinish = () => {
      reqState();
      refetchFinished?.();
    };
    const onMatchUpdate = () => {
      reqState();
    };

    socket.on("scheduler:state", onState);
    socket.on("scheduler:notify", onNotify);
    socket.on?.("match:finish", onMatchFinish);
    socket.on?.("match:update", onMatchUpdate);

    reqState();
    refetchFinished?.();

    const interval = setInterval(() => {
      reqState();
      refetchFinished?.();
    }, 8000);

    return () => {
      clearInterval(interval);
      socket.emit("scheduler:leave", { tournamentId, bracket });
      socket.off("scheduler:state", onState);
      socket.off("scheduler:notify", onNotify);
      socket.off?.("match:finish", onMatchFinish);
      socket.off?.("match:update", onMatchUpdate);
    };
  }, [socket, tournamentId, bracket, refetchFinished]);

  // ---------- handlers ----------
  const handleSaveCourts = async (e) => {
    e.preventDefault();
    if (!tournamentId || !bracket) {
      toast.error("Thiếu mã giải đấu (tournamentId) hoặc giai đoạn (bracket).");
      return;
    }
    const payload =
      mode === "names"
        ? { tournamentId, bracket, names }
        : { tournamentId, bracket, count: Number(count) || 0 };

    try {
      await upsertCourts(payload).unwrap();
      toast.success("Đã lưu danh sách sân và sắp xếp theo hàng đợi.");
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lỗi lưu sân");
    }
  };

  const handleBuildQueue = async () => {
    if (!tournamentId || !bracket) {
      toast.error("Thiếu mã giải đấu (tournamentId) hoặc giai đoạn (bracket).");
      return;
    }
    try {
      const res = await buildQueue({ tournamentId, bracket }).unwrap();
      toast.success(`Đã xếp ${res?.totalQueued ?? 0} trận vào hàng đợi.`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Xếp hàng đợi thất bại");
    } finally {
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    }
  };

  const handleAssignNext = async (courtId) => {
    if (!tournamentId || !bracket || !courtId) return;
    socket?.emit?.("scheduler:assignNext", { tournamentId, courtId, bracket });
    await assignNextHttp({ tournamentId, courtId, bracket }).unwrap();
  };

  const handleRefresh = () => {
    if (!tournamentId || !bracket) return;
    socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    refetchFinished?.();
  };

  const goMatch = (matchId) => {
    if (!matchId) return;
    navigate(`/admin/matches/${matchId}`);
  };

  // ===== Helpers read-from-socket ONLY =====
  const getMatchForCourt = (c) => {
    if (c?.currentMatchObj) return c.currentMatchObj;
    if (c?.currentMatch) return matchMap.get(String(c.currentMatch)) || null;
    return null;
  };

  const getMatchCodeForCourt = (c) => {
    const m = getMatchForCourt(c);
    if (!m) return "";
    return buildMatchCode(m);
  };

  const getTeamsForCourt = (c) => {
    const m = getMatchForCourt(c);
    if (!m) return { A: "", B: "" };
    if (m.pairAName || m.pairBName) return { A: m.pairAName || "", B: m.pairBName || "" };
    const A = m.pairA ? pairName(m.pairA) : "";
    const B = m.pairB ? pairName(m.pairB) : "";
    return { A, B };
  };

  // ======= Finished matches table =======
  const finishedRows = useMemo(() => {
    const apiItems = Array.isArray(finishedList) ? finishedList : [];
    const normApi = apiItems.map((m) => ({
      id: String(m._id || m.id),
      finishedAt: m.finishedAt || m.endedAt || m.updatedAt || m.endAt || m.completedAt || null,
      ...m,
    }));

    const fromSocket =
      (socketMatches || [])
        .filter((m) => m?.status === "finished")
        .map((m) => ({
          id: String(m._id || m.id),
          finishedAt: m.finishedAt || m.endedAt || m.updatedAt || m.endAt || m.completedAt || null,
          ...m,
        })) || [];

    const map = new Map();
    for (const m of [...normApi, ...fromSocket]) map.set(m.id, m);
    const rows = [...map.values()];

    rows.sort((a, b) => {
      const ta = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const tb = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return tb - ta;
    });
    return rows;
  }, [finishedList, socketMatches]);

  // ===== Decide showing columns =====
  const showPoolQueue = useMemo(() => (queue || []).some((r) => isGroupLike(r)), [queue]);
  const showPoolFinished = useMemo(
    () => (finishedRows || []).some((r) => isGroupLike(r)),
    [finishedRows]
  );

  const showRRQueue = useMemo(
    () => (queue || []).some((r) => isGroupLike(r) && isNum(r?.rrRound)),
    [queue]
  );
  const showRRFinished = useMemo(
    () => (finishedRows || []).some((r) => isGroupLike(r) && isNum(r?.rrRound)),
    [finishedRows]
  );

  // Column defs
  const poolColDef = {
    field: "pool",
    headerName: "Bảng",
    width: 110,
    valueGetter: (p) => (isGroupLike(p.row) ? poolBoardLabel(p.row) : ""),
  };

  const rrColDef = {
    field: "rrRound",
    headerName: "Lượt (RR)",
    width: 110,
    valueGetter: (p) => (isGroupLike(p.row) && isNum(p.row?.rrRound) ? p.row.rrRound : ""),
  };

  const queueColumns = useMemo(() => {
    const base = [
      {
        field: "code",
        headerName: "Mã trận",
        width: 170,
        valueGetter: (p) => buildMatchCode(p.row),
      },
      {
        field: "pairAName",
        headerName: "Đội A",
        flex: 1,
        minWidth: 140,
        valueGetter: (p) => p.row?.pairAName || (p.row?.pairA ? pairName(p.row.pairA) : ""),
      },
      {
        field: "pairBName",
        headerName: "Đội B",
        flex: 1,
        minWidth: 140,
        valueGetter: (p) => p.row?.pairBName || (p.row?.pairB ? pairName(p.row.pairB) : ""),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 130,
        valueGetter: (p) => viMatchStatus(p.row?.status),
      },
      { field: "queueOrder", headerName: "Thứ tự", width: 90 },
      ...(showPoolQueue ? [poolColDef] : []),
      ...(showRRQueue ? [rrColDef] : []),
      { field: "round", headerName: "Vòng", width: 90, valueGetter: (p) => roundTag(p.row) },
      { field: "order", headerName: "#", width: 70 },
      {
        field: "courtLabel",
        headerName: "Sân",
        width: 120,
        valueGetter: (p) => p.row?.courtLabel || "",
      },
    ];
    return base;
  }, [showPoolQueue, showRRQueue]);

  const finishedColumns = useMemo(() => {
    const base = [
      {
        field: "code",
        headerName: "Mã trận",
        width: 170,
        valueGetter: (p) => buildMatchCode(p.row),
      },
      {
        field: "pairAName",
        headerName: "Đội A",
        flex: 1,
        minWidth: 160,
        valueGetter: (p) => p.row?.pairAName || (p.row?.pairA ? pairName(p.row.pairA) : ""),
      },
      {
        field: "pairBName",
        headerName: "Đội B",
        flex: 1,
        minWidth: 160,
        valueGetter: (p) => p.row?.pairBName || (p.row?.pairB ? pairName(p.row.pairB) : ""),
      },
      { field: "court", headerName: "Sân", width: 140, valueGetter: (p) => courtLabelOf(p.row) },
      { field: "round", headerName: "Vòng", width: 100, valueGetter: (p) => roundTag(p.row) },
      ...(showPoolFinished ? [poolColDef] : []),
      ...(showRRFinished ? [rrColDef] : []),
      {
        field: "finishedAt",
        headerName: "Kết thúc lúc",
        type: "dateTime",
        width: 190,
        valueGetter: (p) => (p.row?.finishedAt ? new Date(p.row.finishedAt) : null),
        renderCell: (p) => fmtTime(p.row?.finishedAt),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 130,
        valueGetter: (p) => viMatchStatus(p.row?.status),
      },
    ];
    return base;
  }, [showPoolFinished, showRRFinished]);

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ mx: "auto", p: 2, maxWidth: 1400 }}>
        {/* Header */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Điều phối sân
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {bracketName && (
                  <>
                    Giai đoạn: <strong>{bracketName}</strong>
                  </>
                )}
                {tournamentName && (
                  <>
                    {" "}
                    • Giải đấu: <em>{tournamentName}</em>
                  </>
                )}
                {bracketId && (
                  <>
                    {" "}
                    • ID giai đoạn: <code>{bracketId}</code>
                  </>
                )}
                {tournamentId ? (
                  <>
                    {" "}
                    • Mã giải đấu: <code>{tournamentId}</code>
                  </>
                ) : (
                  <span style={{ color: "#d32f2f", marginLeft: 8 }}>
                    (Thiếu tournamentId — thêm vào state hoặc query ?t=)
                  </span>
                )}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Làm mới">
                <IconButton onClick={handleRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                onClick={() => navigate(-1)}
                size="small"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
              >
                Quay lại
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Config + Build */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper component="form" onSubmit={handleSaveCourts} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Cấu hình sân cho giai đoạn
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)} row sx={{ mb: 2 }}>
                <FormControlLabel value="count" control={<Radio />} label="Theo số lượng" />
                <FormControlLabel value="names" control={<Radio />} label="Theo tên từng sân" />
              </RadioGroup>

              {mode === "count" ? (
                <TextField
                  label="Số lượng sân"
                  type="number"
                  inputProps={typeof window !== "undefined" ? { min: 1 } : {}}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                />
              ) : (
                <TextField
                  label="Tên sân (mỗi dòng 1 tên)"
                  value={namesText}
                  onChange={(e) => setNamesText(e.target.value)}
                  fullWidth
                  multiline
                  minRows={6}
                  sx={{ mb: 2 }}
                />
              )}

              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={savingCourts}
              >
                {savingCourts ? "Đang lưu..." : "Lưu danh sách sân"}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Xếp hàng đợi theo lượt (Vòng bảng/RR)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Thuật toán: A1, B1, C1, D1… sau đó A2, B2… (tránh trùng VĐV đang{" "}
                <em>chờ vào sân/đang thi đấu</em>).
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  onClick={handleBuildQueue}
                  variant="contained"
                  startIcon={<QueuePlayNextIcon />}
                  disabled={buildingQueue}
                >
                  {buildingQueue ? "Đang xếp..." : "Xếp hàng đợi"}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Realtime panel */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
            {/* COURTS */}
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">Danh sách sân</Typography>
                <Typography variant="caption" color="text.secondary">
                  {courts.length} sân
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {courts.map((c) => {
                  const m = getMatchForCourt(c);
                  const hasMatch = Boolean(m);
                  const statusLabel = viCourtStatus(c.status);
                  const code = getMatchCodeForCourt(c);
                  const teams = getTeamsForCourt(c);

                  return (
                    <Paper
                      key={c._id}
                      sx={{
                        p: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          label={c.name}
                          color={
                            c.status === "idle"
                              ? "default"
                              : c.status === "live"
                              ? "success"
                              : c.status === "maintenance"
                              ? "warning"
                              : "info"
                          }
                        />
                        <Typography variant="body2">{statusLabel}</Typography>

                        {hasMatch && (
                          <Chip
                            size="small"
                            color={matchStatusColor(m.status)}
                            label={`Trận: ${viMatchStatus(m.status)}`}
                          />
                        )}

                        {hasMatch && (
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {code && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Mã trận: ${code}`}
                                onClick={() => goMatch(m._id || c.currentMatch)}
                                sx={{ cursor: "pointer" }}
                              />
                            )}
                            {(teams.A || teams.B) && (
                              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                                {teams.A || "Đội A"} <b>vs</b> {teams.B || "Đội B"}
                              </Typography>
                            )}
                            {isGroupLike(m) && (
                              <Chip size="small" label={`Bảng ${poolBoardLabel(m)}`} />
                            )}
                            {isGroupLike(m) && isNum(m?.rrRound) && (
                              <Chip size="small" label={`Lượt ${m.rrRound}`} />
                            )}
                          </Stack>
                        )}
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AutorenewIcon />}
                          disabled={c.status !== "idle"}
                          onClick={() => handleAssignNext(c._id)}
                        >
                          Gán trận kế tiếp
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}

                {courts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có sân nào cho giai đoạn này.
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* QUEUE */}
            <Box sx={{ flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">Hàng đợi trận đấu</Typography>
                <Tooltip title="Làm mới">
                  <IconButton onClick={handleRefresh} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <div style={{ height: 520, width: "100%" }}>
                <DataGrid
                  rows={queue}
                  getRowId={(r) => r.id}
                  columns={queueColumns}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                  onRowClick={(p) => navigate(`/admin/matches/${p.row._id || p.row.id}`)}
                />
              </div>
            </Box>
          </Stack>
        </Paper>

        {/* ======== Finished matches list ======== */}
        <Paper sx={{ p: 2, mt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">
              Trận đã kết thúc{" "}
              <Typography component="span" variant="caption" color="text.secondary">
                ({loadingFinished ? "đang tải..." : finishedRows.length})
              </Typography>
            </Typography>
            <Tooltip title="Làm mới">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          <div style={{ height: 520, width: "100%" }}>
            <DataGrid
              rows={finishedRows}
              getRowId={(r) => r.id}
              columns={finishedColumns}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: "finishedAt", sort: "desc" }] },
              }}
              onRowClick={(p) => navigate(`/admin/matches/${p.row._id || p.row.id}`)}
            />
          </div>
        </Paper>

        {/* mini log cho notify */}
        {notifQueueRef.current.length > 0 && (
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Thông báo gần đây
            </Typography>
            <Stack spacing={1}>
              {notifQueueRef.current.map((n, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={n.level || "info"} variant="outlined" />
                  <Typography variant="body2">
                    {new Date(n.at).toLocaleTimeString()} — {n.message}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={2500}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
