/* eslint-disable react/prop-types */
// src/pages/admin/AdminMonitorPage.jsx
// Realtime presence monitor for Admin site
// - Shows unique users online (total) + breakdown by client (web/app/admin/referee)
// - Loads initial snapshot via RTK Query
// - Subscribes to Socket.IO presence:watch for realtime updates
// - Lists online users; supports searching any user and showing their latest online time

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleIcon from "@mui/icons-material/People";
import WifiIcon from "@mui/icons-material/Wifi";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import ShieldIcon from "@mui/icons-material/Shield";
import SportsIcon from "@mui/icons-material/Sports";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";

import { useGetPresenceSummaryQuery } from "slices/adminStatsApiSlice"; // snapshot totals
import {
  useListPresenceUsersQuery,
  useLazySearchPresenceUsersQuery,
  useLazyGetPresenceOfUserQuery,
} from "slices/adminStatsApiSlice"; // users
import { useSocket } from "context/SocketContext"; // returns instance
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function AdminMonitorPage() {
  const socket = useSocket();

  // Totals
  const { data: initial, isFetching, error, refetch } = useGetPresenceSummaryQuery();
  const [summary, setSummary] = useState(initial);

  // Online users list
  const {
    data: listData,
    refetch: refetchList,
    isFetching: fetchingList,
  } = useListPresenceUsersQuery();

  // Search state
  const [q, setQ] = useState("");
  const [triggerSearch, { data: searchData, isFetching: searching }] =
    useLazySearchPresenceUsersQuery();

  // Detail dialog
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [fetchUserPresence, { data: userPresence }] = useLazyGetPresenceOfUserQuery();

  const [socketOn, setSocketOn] = useState(!!socket?.connected);

  // Helpers
  const updatedAt = useMemo(() => (summary?.ts ? new Date(summary.ts) : null), [summary?.ts]);
  const total = summary?.total ?? 0;
  const byClient = summary?.byClient ?? { web: 0, app: 0, admin: 0, referee: 0 };

  // Apply snapshot
  useEffect(() => {
    if (initial) setSummary(initial);
  }, [initial]);

  // Subscribe realtime via socket
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setSocketOn(true);
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = (payload) => {
      setSummary(payload);
      // danh sách có thể thay đổi -> refetch
      refetchList();
      // nếu đang xem chi tiết, refetch user đó
      if (selectedUser?._id) fetchUserPresence(selectedUser._id);
    };

    try {
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("presence:update", handleUpdate);
      socket.emit("presence:watch");
    } catch (_) {}

    return () => {
      try {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("presence:update", handleUpdate);
      } catch (_) {}
    };
  }, [socket, selectedUser, fetchUserPresence, refetchList]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (q && q.trim().length >= 2) triggerSearch(q.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [q, triggerSearch]);

  const usersToShow = q.trim().length >= 2 ? searchData?.items || [] : listData?.items || [];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Stack spacing={2} sx={{ p: { xs: 1, md: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>
            Theo dõi realtime
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <SocketStatus connected={socketOn} />
            <Tooltip title="Lấy lại snapshot">
              <span>
                <IconButton
                  onClick={() => {
                    refetch();
                    refetchList();
                  }}
                  disabled={isFetching || fetchingList}
                >
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {error ? (
          <Alert severity="error">Không tải được snapshot ban đầu. Hãy thử bấm làm mới.</Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PeopleIcon />
                    <Typography variant="h6">Tổng online</Typography>
                  </Stack>
                  <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1 }}>
                    {total}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      icon={<AccessTimeIcon />}
                      label={`Cập nhật: ${updatedAt ? updatedAt.toLocaleTimeString() : "—"}`}
                      variant="outlined"
                      size="small"
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Theo loại client
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <StatBox icon={<WifiIcon />} label="Web" value={byClient.web} />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <StatBox icon={<PhoneIphoneIcon />} label="App" value={byClient.app} />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <StatBox icon={<ShieldIcon />} label="Admin" value={byClient.admin} />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <StatBox icon={<SportsIcon />} label="Referee" value={byClient.referee} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search & Online users list */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                label="Tìm kiếm user (tên, email, phone, nickname)"
                placeholder="Nhập ≥ 2 ký tự để tìm..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                fullWidth
              />

              <Divider />

              <List dense>
                {usersToShow.map((u) => (
                  <ListItemButton
                    key={u._id}
                    onClick={async () => {
                      setSelectedUser(u);
                      setOpen(true);
                      try {
                        await fetchUserPresence(u._id);
                      } catch (_) {}
                    }}
                  >
                    <Avatar src={u.avatar} sx={{ width: 32, height: 32, mr: 1.2 }}>
                      {(u.nickname || u.name || "?").slice(0, 1).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body1" fontWeight={600}>
                            {u.nickname || u.name || u.fullName || u.email || u._id}
                          </Typography>
                          {u.online ? (
                            <Chip size="small" color="success" variant="outlined" label="ONLINE" />
                          ) : (
                            <Chip size="small" variant="outlined" label="OFFLINE" />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" spacing={1}>
                          {u.byClient?.web ? <Chip size="small" label="Web" /> : null}
                          {u.byClient?.app ? <Chip size="small" label="App" /> : null}
                          {u.byClient?.admin ? <Chip size="small" label="Admin" /> : null}
                          {u.byClient?.referee ? <Chip size="small" label="Referee" /> : null}
                          <Chip
                            size="small"
                            icon={<AccessTimeIcon />}
                            label={u.lastSeen ? new Date(u.lastSeen).toLocaleString() : "—"}
                          />
                        </Stack>
                      }
                    />
                  </ListItemButton>
                ))}
                {usersToShow.length === 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Không có dữ liệu.
                  </Typography>
                )}
              </List>
            </Stack>
          </CardContent>
        </Card>

        <UserPresenceDialog
          open={open}
          onClose={() => setOpen(false)}
          user={selectedUser}
          presence={userPresence}
        />
      </Stack>
    </DashboardLayout>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <Stack
      sx={{ px: 2, py: 1.5, borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)", height: "100%" }}
      spacing={0.5}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Typography variant="subtitle2">{label}</Typography>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function SocketStatus({ connected }) {
  return connected ? (
    <Chip
      icon={<CheckCircleIcon />}
      color="success"
      variant="outlined"
      size="small"
      label="Socket connected"
    />
  ) : (
    <Chip
      icon={<CancelIcon />}
      color="error"
      variant="outlined"
      size="small"
      label="Socket disconnected"
    />
  );
}

function UserPresenceDialog({ open, onClose, user, presence }) {
  const lastSeen = presence?.lastSeen ? new Date(presence.lastSeen).toLocaleString() : "—";
  const isOnline = Boolean(presence?.online);
  const bc = presence?.byClient || {};
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Trạng thái người dùng</DialogTitle>
      <DialogContent>
        {user ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={user.avatar} sx={{ width: 48, height: 48 }}>
                {(user.nickname || user.name || "?").slice(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {user.nickname || user.name || user.fullName || user.email || user._id}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  {user.email || user.phone || ""}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              {isOnline ? <Chip color="success" label="ĐANG ONLINE" /> : <Chip label="OFFLINE" />}
              <Chip icon={<AccessTimeIcon />} label={`Lần cuối: ${lastSeen}`} />
            </Stack>

            <Divider />
            <Typography variant="subtitle2">Đang hoạt động trên:</Typography>
            <Stack direction="row" spacing={1}>
              {bc.web ? <Chip label="Web" /> : null}
              {bc.app ? <Chip label="App" /> : null}
              {bc.admin ? <Chip label="Admin" /> : null}
              {bc.referee ? <Chip label="Referee" /> : null}
              {!bc.web && !bc.app && !bc.admin && !bc.referee && (
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Không hoạt động trên client nào.
                </Typography>
              )}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2">Chọn một người dùng để xem chi tiết.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
