// src/layouts/admin/AdminMatchDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  Paper,
  Tabs,
  Tab,
  Divider,
  Tooltip,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BoltIcon from "@mui/icons-material/Bolt";
import ReplayIcon from "@mui/icons-material/Replay";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import StadiumIcon from "@mui/icons-material/Stadium";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { toast } from "react-toastify";

import { useSocket } from "../../context/SocketContext";

import {
  useGetMatchAdminQuery,
  useGetMatchLogsQuery,
  useGetMatchRatingChangesQuery,
  useApplyMatchRatingMutation,
} from "../../slices/matchesApiSlice";
import AdminMatchLogsPanel from "./AdminMatchLogsPanel";
import AdminMatchRatingPanel from "./AdminMatchRatingPanel";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

/* ===================== Helpers ===================== */
const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
};

const isNum = (x) => typeof x === "number" && isFinite(x);

const viStatus = (s) => {
  switch (s) {
    case "scheduled":
      return "Đã lên lịch";
    case "queued":
      return "Trong hàng đợi";
    case "assigned":
      return "Chờ vào sân";
    case "live":
      return "Đang thi đấu";
    case "finished":
      return "Đã kết thúc";
    case "canceled":
      return "Đã huỷ";
    default:
      return s || "—";
  }
};

const viBracketType = (t) => {
  switch (t) {
    case "group":
    case "roundrobin":
      return "Vòng bảng";
    case "po":
    case "roundElim":
      return "Playoff";
    case "knockout":
    case "ko":
      return "Loại trực tiếp";
    default:
      return t || "—";
  }
};

const viFormat = (m) => viBracketType(m?.format || m?.bracket?.type);

/** Lấy tên người chơi từ object người */
const personLabel = (p) => {
  if (!p || typeof p !== "object") {
    return typeof p === "string" ? `#${p.slice(-6)}` : "—";
  }
  return (
    p.fullName ||
    p.nickName ||
    p.displayName ||
    p.name ||
    p.email ||
    p.phone ||
    (p.user && typeof p.user === "string" ? `#${p.user.slice(-6)}` : "—")
  );
};

/** Lấy tên đội (đôi/đơn) */
const pairLabel = (pair) => {
  if (!pair) return "—";
  if (pair.displayName || pair.name) return pair.displayName || pair.name;

  const names = [];
  if (pair.player1) names.push(personLabel(pair.player1));
  if (pair.player2) names.push(personLabel(pair.player2));

  if (!names.length && Array.isArray(pair.participants)) {
    for (const it of pair.participants) {
      names.push(personLabel(it?.user || it));
    }
  }
  return names.filter(Boolean).join(" & ") || "—";
};

/** Ưu tiên globalRound (API), nếu không có thì parse từ code/labelKey; luôn hiển thị V */
const roundTag = (m) => {
  if (!m) return "";
  // 1) globalRound từ API (đã cộng dồn theo bracket)
  const gr = Number(m.globalRound);
  if (Number.isFinite(gr) && gr > 0) return `V${gr}`;

  // 2) từ code/labelKey: V{n} hoặc R{n}
  const fromStr = (s) => {
    if (!s) return "";
    const mv = /V(\d+)/i.exec(s);
    if (mv) return `V${mv[1]}`;
    const mr = /R(\d+)/i.exec(s);
    if (mr) return `V${mr[1]}`; // convert R -> V cho hiển thị
    return "";
  };
  const byCode = fromStr(m.code) || fromStr(m.labelKey);
  if (byCode) return byCode;

  // 3) fallback local: rrRound/round (đổi R->V để nhất quán)
  if (isNum(m.rrRound)) return `V${m.rrRound}`;
  if (isNum(m.round)) return `V${m.round}`;
  if (typeof m.round === "string" && m.round) {
    const mr = /(\d+)/.exec(m.round);
    if (mr) return `V${mr[1]}`;
  }
  return "";
};

/** Mã trận: ưu tiên code do BE chuẩn hoá theo V */
const matchCode = (m) => m?.globalCode || m?.code || m?.labelKey || "";

/** T index: order + 1 (nếu có) */
const matchTIndex = (m) => (isNum(m?.order) ? m.order + 1 : null);

/** Hiển thị tỉ số */
const scoresDisplay = (m) => {
  const arr = Array.isArray(m?.gameScores) ? m.gameScores : null;
  if (arr && arr.length) {
    const parts = arr
      .map((g) => {
        if (Array.isArray(g) && g.length >= 2 && isNum(g[0]) && isNum(g[1]))
          return `${g[0]}-${g[1]}`;
        const a = g?.a ?? g?.A ?? g?.home ?? g?.p1;
        const b = g?.b ?? g?.B ?? g?.away ?? g?.p2;
        return isNum(a) && isNum(b) ? `${a}-${b}` : null;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return "—";
};

export default function AdminMatchDetailPage() {
  const { id } = useParams();
  const socket = useSocket();
  const [tab, setTab] = useState(0);
  const [auto, setAuto] = useState(true);

  const { data: match, refetch: refetchMatch } = useGetMatchAdminQuery(id);
  const { data: logs, refetch: refetchLogs } = useGetMatchLogsQuery(id, {
    pollingInterval: auto ? 4000 : 0,
  });
  const { data: ratingRows, refetch: refetchRating } = useGetMatchRatingChangesQuery(id, {
    pollingInterval: auto ? 6000 : 0,
  });
  const [applyRating, { isLoading: applying }] = useApplyMatchRatingMutation();

  /* ===== Realtime ===== */
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit?.("match:subscribe", { matchId: id });

    const onSnapshot = () => {
      refetchMatch();
      refetchLogs();
      refetchRating();
    };
    const onLog = () => refetchLogs();
    const onRatingUpdated = () => {
      refetchMatch();
      refetchRating();
    };

    socket.on?.("match:snapshot", onSnapshot);
    socket.on?.("match:log", onLog);
    socket.on?.("rating:updated", onRatingUpdated);

    return () => {
      socket.emit?.("match:unsubscribe", { matchId: id });
      socket.off?.("match:snapshot", onSnapshot);
      socket.off?.("match:log", onLog);
      socket.off?.("rating:updated", onRatingUpdated);
    };
  }, [socket, id, refetchMatch, refetchLogs, refetchRating]);

  const statusChip = useMemo(() => {
    if (!match) return null;
    const color =
      match.status === "finished"
        ? "success"
        : match.status === "live"
        ? "warning"
        : match.status === "canceled"
        ? "default"
        : "info";
    const icon =
      match.status === "finished" ? (
        <CheckCircleIcon sx={{ mr: 0.5 }} />
      ) : (
        <PlayArrowIcon sx={{ mr: 0.5 }} />
      );
    return <Chip icon={icon} color={color} label={viStatus(match.status)} size="small" />;
  }, [match]);

  const canApply =
    match && match.status === "finished" && !match.ratingApplied && match.pairA && match.pairB;

  const handleApply = async () => {
    try {
      await applyRating(id).unwrap();
      toast.success("Đã áp dụng rating cho trận này.");
      refetchMatch();
      refetchRating();
    } catch (e) {
      toast.error(e?.data?.message || "Áp dụng rating thất bại.");
    }
  };

  const code = match ? matchCode(match) : "";
  const teamA = pairLabel(match?.pairA);
  const teamB = pairLabel(match?.pairB);
  const tIdx = matchTIndex(match);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button
            component={RouterLink}
            to="/admin/matches"
            startIcon={<ArrowBackIosNewIcon />}
            size="small"
          >
            Quay về danh sách
          </Button>

          <Typography variant="h5" sx={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <SportsTennisIcon />
            Trận đấu {code ? `• ${code}` : ""}
          </Typography>

          {statusChip}
          <Chip size="small" label={`Vòng: ${roundTag(match) || "—"}`} />
          <Chip size="small" label={`Thứ tự: ${tIdx ?? "—"}`} />

          {match?.ratingApplied && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              icon={<BoltIcon />}
              label="Đã áp dụng rating"
            />
          )}
          <Chip
            size="small"
            variant="outlined"
            color={socket?.connected ? "success" : "default"}
            label={socket?.connected ? "Trực tuyến" : "Ngoại tuyến"}
          />
        </Stack>

        {/* Thông tin tổng quan */}
        <Paper sx={{ mb: 2, p: 2 }}>
          {/* Tên đội + tỉ số */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color="text.secondary">
                Đội A
              </Typography>
              <Typography variant="h6">{teamA}</Typography>
            </Stack>

            <Stack alignItems="center" justifyContent="center">
              <Typography variant="body2" color="text.secondary">
                Tỷ số
              </Typography>
              <Typography variant="h6">{scoresDisplay(match)}</Typography>
            </Stack>

            <Stack spacing={0.5} alignItems={{ xs: "flex-start", md: "flex-end" }}>
              <Typography variant="subtitle2" color="text.secondary">
                Đội B
              </Typography>
              <Typography variant="h6" textAlign={{ xs: "left", md: "right" }}>
                {teamB}
              </Typography>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Chi tiết ngữ cảnh trận */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Giải đấu: <b>{match?.tournament?.name || "—"}</b>
              </Typography>
              <Typography variant="body2">
                Giai đoạn:{" "}
                <b>
                  {match?.bracket?.name || "—"}{" "}
                  {match?.bracket?.type ? `(${viBracketType(match.bracket.type)})` : ""}
                </b>
              </Typography>
              <Typography variant="body2">
                Định dạng: <b>{viFormat(match)}</b>
              </Typography>
              {match?.pool && (
                <Typography variant="body2">
                  Bảng: <b>{match?.pool?.name || match?.pool?.code || "—"}</b>
                </Typography>
              )}
              <Typography variant="body2">
                Người thắng: <b>{match?.winner || "—"}</b>
              </Typography>
              {typeof match?.ratingDelta === "number" && (
                <Typography variant="body2">
                  Δ rating (|Δ| TB): <b>{(match.ratingDelta || 0).toFixed(4)}</b>
                </Typography>
              )}
            </Stack>

            <Stack spacing={0.5}>
              {match?.courtCluster && (
                <Typography variant="body2">
                  <WorkspacePremiumIcon sx={{ fontSize: 16, mr: 0.5, mb: "-3px" }} />
                  Cụm sân: <b>{match.courtCluster}</b>
                </Typography>
              )}
              <Typography variant="body2">
                <StadiumIcon sx={{ fontSize: 16, mr: 0.5, mb: "-3px" }} />
                Sân: <b>{match?.courtLabel || "—"}</b>
              </Typography>
              <Typography variant="body2">
                <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, mb: "-3px" }} />
                Dự kiến: <b>{fmtDateTime(match?.scheduledAt)}</b>
              </Typography>
              <Typography variant="body2">
                <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, mb: "-3px" }} />
                Bắt đầu: <b>{fmtDateTime(match?.startedAt)}</b>
              </Typography>
              <Typography variant="body2">
                <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, mb: "-3px" }} />
                Kết thúc: <b>{fmtDateTime(match?.finishedAt)}</b>
              </Typography>

              <Tooltip title="Làm mới dữ liệu">
                <Button
                  onClick={() => {
                    refetchMatch();
                    refetchLogs();
                    refetchRating();
                  }}
                  startIcon={<ReplayIcon />}
                  variant="outlined"
                  sx={{ mt: 1 }}
                >
                  Làm mới
                </Button>
              </Tooltip>
              <Button
                onClick={handleApply}
                disabled={!canApply || applying}
                variant="contained"
                startIcon={<BoltIcon />}
              >
                Áp dụng rating
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Logs & Rating */}
        <Paper>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            <Tab label="Nhật ký trực tiếp" />
            <Tab label="Biến động rating" />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>
            {tab === 0 && (
              <AdminMatchLogsPanel
                logs={logs}
                auto={auto}
                setAuto={setAuto}
                onRefresh={() => refetchLogs()}
              />
            )}
            {tab === 1 && <AdminMatchRatingPanel rows={ratingRows} />}
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
