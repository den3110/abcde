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
import { toast } from "react-toastify";

// ⛔️ Bỏ socket.io-client trực tiếp
// import io from "socket.io-client";

// ✅ Dùng socket từ context app của bạn
import { useSocket } from "../../context/SocketContext"; // <-- chỉnh path nếu khác

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

export default function AdminMatchDetailPage() {
  const { id } = useParams();
  const socket = useSocket(); // ✅ socket chia sẻ toàn app
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

  // ==== Realtime bằng socket từ context ====
  useEffect(() => {
    if (!socket || !id) return;

    // join phòng trận
    socket.emit?.("match:subscribe", { matchId: id });

    const onSnapshot = () => {
      refetchMatch();
      refetchLogs();
      refetchRating();
    };
    const onLog = () => {
      refetchLogs();
    };
    const onRatingUpdated = () => {
      refetchMatch();
      refetchRating();
    };

    socket.on?.("match:snapshot", onSnapshot);
    socket.on?.("match:log", onLog);
    socket.on?.("rating:updated", onRatingUpdated);

    return () => {
      // rời phòng & gỡ listener
      socket.emit?.("match:unsubscribe", { matchId: id });
      socket.off?.("match:snapshot", onSnapshot);
      socket.off?.("match:log", onLog);
      socket.off?.("rating:updated", onRatingUpdated);
    };
    // ⚠️ phụ thuộc vào `socket` và `id` để rebind đúng
  }, [socket, id, refetchMatch, refetchLogs, refetchRating]);

  const statusChip = useMemo(() => {
    if (!match) return null;
    const color =
      match.status === "finished" ? "success" : match.status === "live" ? "warning" : "default";
    const icon =
      match.status === "finished" ? (
        <CheckCircleIcon sx={{ mr: 0.5 }} />
      ) : (
        <PlayArrowIcon sx={{ mr: 0.5 }} />
      );
    return <Chip icon={icon} color={color} label={match.status.toUpperCase()} size="small" />;
  }, [match]);

  const canApply =
    match && match.status === "finished" && !match.ratingApplied && match.pairA && match.pairB;

  const handleApply = async () => {
    try {
      await applyRating(id).unwrap();
      toast.success("Đã áp dụng rating cho trận này");
      refetchMatch();
      refetchRating();
    } catch (e) {
      toast.error(e?.data?.message || "Áp dụng rating thất bại");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button
            component={RouterLink}
            to="/admin/matches"
            startIcon={<ArrowBackIosNewIcon />}
            size="small"
          >
            Danh sách trận
          </Button>
          <Typography variant="h5" sx={{ flex: 1 }}>
            Match {match?.labelKey || match?.code || id}
          </Typography>
          {statusChip}
          <Chip size="small" label={`Round ${match?.round ?? "-"}`} />
          <Chip size="small" label={`Order ${match?.order ?? "-"}`} />
          {match?.ratingApplied && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              icon={<BoltIcon />}
              label="Rating applied"
            />
          )}
          {/* trạng thái socket (tuỳ thích) */}
          <Chip
            size="small"
            variant="outlined"
            color={socket?.connected ? "success" : "default"}
            label={socket?.connected ? "Live" : "Offline"}
          />
        </Stack>

        <Paper sx={{ mb: 2, p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Tournament: <b>{match?.tournament?.name || "-"}</b>
              </Typography>
              <Typography variant="body2">
                Bracket: <b>{match?.bracket?.name || "-"}</b> ({match?.bracket?.type})
              </Typography>
              <Typography variant="body2">
                Winner: <b>{match?.winner || "-"}</b>
              </Typography>
              <Typography variant="body2">
                Rating Δ (avg |abs|): <b>{(match?.ratingDelta ?? 0).toFixed(4)}</b>
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refetch">
                <Button
                  onClick={() => {
                    refetchMatch();
                    refetchLogs();
                    refetchRating();
                  }}
                  startIcon={<ReplayIcon />}
                  variant="outlined"
                >
                  Refresh
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

        <Paper>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            <Tab label="Live log" />
            <Tab label="Rating changes" />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>
            {tab === 0 && (
              <AdminMatchLogsPanel
                logs={logs}
                auto={auto}
                setAuto={setAuto}
                onRefresh={() => {
                  refetchLogs();
                }}
              />
            )}
            {tab === 1 && <AdminMatchRatingPanel rows={ratingRows} />}
          </Box>
        </Paper>
      </Box>
    </DashboardLayout>
  );
}
