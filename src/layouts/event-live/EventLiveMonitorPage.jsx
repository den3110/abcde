/* eslint-disable react/prop-types */
// layouts/event-live/EventLiveMonitorPage.jsx
// Admin: theo dõi chat live + viewer real-time
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Pagination,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Chat,
  Delete,
  People,
  Visibility,
  TrendingUp,
} from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useGetEventLiveCommentsQuery,
  useDeleteEventLiveCommentMutation,
  useGetEventLiveCommentStatsQuery,
  useGetEventLiveViewerHistoryQuery,
} from "slices/eventLiveAdminApiSlice";
import { useSocket } from "context/SocketContext";

const fmtTime = (d) => {
  try {
    return new Date(d).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
};

const fmtDuration = (sec) => {
  if (!sec || sec <= 0) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
};

const platformColor = { web: "info", ios: "primary", android: "success" };

// ──────────────────── Tab 1: Chat Moderation ────────────────────

function ChatModeration() {
  const socket = useSocket();
  const { data: statsData } = useGetEventLiveCommentStatsQuery(7);
  const { data: initial } = useGetEventLiveCommentsQuery({ limit: 100 });
  const [deleteComment] = useDeleteEventLiveCommentMutation();
  const [comments, setComments] = useState([]);

  // Hydrate initial
  useEffect(() => {
    if (initial?.comments) setComments(initial.comments);
  }, [initial]);

  // Socket real-time
  useEffect(() => {
    if (!socket) return;
    socket.emit("event-live:chat:subscribe");

    const onNew = (c) => {
      setComments((prev) => {
        if (prev.some((x) => x._id === c._id)) return prev;
        return [...prev, c].slice(-200); // giữ 200 gần nhất
      });
    };
    const onDeleted = ({ _id }) => {
      setComments((prev) => prev.filter((c) => c._id !== _id));
    };

    socket.on("event-live:comment:new", onNew);
    socket.on("event-live:comment:deleted", onDeleted);

    return () => {
      socket.emit("event-live:chat:unsubscribe");
      socket.off("event-live:comment:new", onNew);
      socket.off("event-live:comment:deleted", onDeleted);
    };
  }, [socket]);

  const handleDelete = async (id) => {
    if (!window.confirm("Xoá bình luận này?")) return;
    try {
      await deleteComment(id).unwrap();
    } catch {
      /* handled by rtk */
    }
  };

  return (
    <Stack spacing={2}>
      {/* Stats */}
      {statsData && (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Card sx={{ p: 1.5, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Tổng (7 ngày)</Typography>
            <Typography variant="h5" fontWeight="bold">{statsData.total}</Typography>
          </Card>
          <Card sx={{ p: 1.5, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Đang hiện</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">{statsData.active}</Typography>
          </Card>
          <Card sx={{ p: 1.5, minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Đã xoá</Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">{statsData.deleted}</Typography>
          </Card>
        </Stack>
      )}

      {/* Live feed */}
      <Card sx={{ p: 2, maxHeight: 500, overflow: "auto" }}>
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          💬 Bình luận real-time
        </Typography>
        {comments.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={3}>
            Chưa có bình luận nào.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {comments.map((c) => (
              <Stack
                key={c._id}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{
                  p: 0.75,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Avatar src={c.user?.avatar} sx={{ width: 28, height: 28, mt: 0.3 }}>
                  {(c.user?.name || "?")[0]}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.5} alignItems="baseline">
                    <Typography variant="caption" fontWeight="bold" color="info.main">
                      {c.user?.nickName || c.user?.nickname || c.user?.fullName || c.user?.name || "Ẩn danh"}
                    </Typography>
                    <Chip
                      label={c.platform || "?"}
                      size="small"
                      color={platformColor[c.platform] || "default"}
                      sx={{ height: 16, fontSize: 9 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                      {fmtTime(c.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                    {c.content}
                  </Typography>
                </Box>
                <Tooltip title="Xoá bình luận">
                  <IconButton size="small" color="error" onClick={() => handleDelete(c._id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

// ──────────────────── Tab 2: Viewer Dashboard ────────────────────

function ViewerDashboard() {
  const socket = useSocket();
  const [viewers, setViewers] = useState({ total: 0, viewers: [], peakToday: 0 });
  const [histPage, setHistPage] = useState(1);
  const { data: histData, isFetching: histFetching } = useGetEventLiveViewerHistoryQuery({
    days: 7,
    page: histPage,
    limit: 30,
  });

  // Socket real-time viewer updates
  useEffect(() => {
    if (!socket) return;
    socket.emit("event-live:viewers:watch");

    const onUpdate = (data) => setViewers(data);
    socket.on("event-live:viewers:update", onUpdate);

    return () => {
      socket.emit("event-live:viewers:unwatch");
      socket.off("event-live:viewers:update", onUpdate);
    };
  }, [socket]);

  const analytics = histData?.analytics || {};

  return (
    <Stack spacing={2}>
      {/* Real-time stats */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Card sx={{ p: 1.5, minWidth: 130 }}>
          <Typography variant="caption" color="text.secondary">Đang xem</Typography>
          <Typography variant="h4" fontWeight="bold" color="success.main">{viewers.total}</Typography>
        </Card>
        <Card sx={{ p: 1.5, minWidth: 130 }}>
          <Typography variant="caption" color="text.secondary">Peak hôm nay</Typography>
          <Typography variant="h4" fontWeight="bold" color="info.main">{viewers.peakToday}</Typography>
        </Card>
        <Card sx={{ p: 1.5, minWidth: 130 }}>
          <Typography variant="caption" color="text.secondary">Tổng phiên (7 ngày)</Typography>
          <Typography variant="h5" fontWeight="bold">{analytics.totalSessions || 0}</Typography>
        </Card>
        <Card sx={{ p: 1.5, minWidth: 130 }}>
          <Typography variant="caption" color="text.secondary">Unique users</Typography>
          <Typography variant="h5" fontWeight="bold">{analytics.uniqueUsers || 0}</Typography>
        </Card>
        <Card sx={{ p: 1.5, minWidth: 130 }}>
          <Typography variant="caption" color="text.secondary">TB thời lượng</Typography>
          <Typography variant="h5" fontWeight="bold">{fmtDuration(analytics.avgDurationSec)}</Typography>
        </Card>
      </Stack>

      {/* Current viewers */}
      {viewers.total > 0 && (
        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1}>
            👁 Đang xem ({viewers.total})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {viewers.viewers?.map((u) => (
              <Chip
                key={u._id}
                avatar={<Avatar src={u.avatar}>{(u.name || "?")[0]}</Avatar>}
                label={u.nickName || u.nickname || u.fullName || u.name || "Ẩn danh"}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Card>
      )}

      {/* History */}
      <Card sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>
          📋 Lịch sử phiên xem (7 ngày)
        </Typography>
        {histFetching && <LinearProgress sx={{ mb: 1 }} />}
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Người xem</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Bắt đầu</TableCell>
                <TableCell>Kết thúc</TableCell>
                <TableCell align="right">Thời lượng</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(histData?.sessions || []).map((s) => (
                <TableRow key={s._id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={s.user?.avatar} sx={{ width: 24, height: 24 }}>
                        {(s.user?.name || "?")[0]}
                      </Avatar>
                      <Typography variant="body2" noWrap>
                        {s.user?.nickName || s.user?.nickname || s.user?.fullName || s.user?.name || "—"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={s.platform} size="small" color={platformColor[s.platform] || "default"} sx={{ height: 20, fontSize: 10 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtTime(s.joinedAt)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{s.leftAt ? fmtTime(s.leftAt) : <Chip label="đang xem" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtDuration(s.durationSec)}</TableCell>
                </TableRow>
              ))}
              {(histData?.sessions || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">Chưa có dữ liệu.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        {(histData?.totalPages || 0) > 1 && (
          <Stack alignItems="center" mt={2}>
            <Pagination
              count={histData.totalPages}
              page={histPage}
              onChange={(e, p) => setHistPage(p)}
              size="small"
            />
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

// ──────────────────── Main Page ────────────────────

export default function EventLiveMonitorPage() {
  const [tab, setTab] = useState(0);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
          <Visibility color="info" />
          <Typography variant="h4" fontWeight="bold">
            Live Event Monitor
          </Typography>
        </Stack>
        <Typography variant="body2" color="text" mb={3}>
          Theo dõi bình luận trực tiếp và người xem event live YouTube.
        </Typography>

        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab icon={<Chat />} iconPosition="start" label="Chat moderation" />
          <Tab icon={<People />} iconPosition="start" label="Viewer dashboard" />
        </Tabs>

        {tab === 0 && <ChatModeration />}
        {tab === 1 && <ViewerDashboard />}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
