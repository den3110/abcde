// src/pages/admin/AdminCourtManagerPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useUpsertCourtsMutation,
  useBuildGroupsQueueMutation,
  // Nếu muốn fallback HTTP thay vì socket, mở 2 dòng dưới:
  // useAssignNextHttpMutation,
  // useFreeCourtHttpMutation,
} from "../../slices/adminCourtApiSlice";
import { useSocket } from "context/SocketContext";

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
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import QueuePlayNextIcon from "@mui/icons-material/QueuePlayNext";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// ===== helper =====
const viStatus = (s) =>
  s === "idle"
    ? "Trống"
    : s === "assigned"
    ? "Chờ vào sân"
    : s === "live"
    ? "Đang thi đấu"
    : s || "";

const matchLabel = (m) => {
  const parts = [];
  if (m?.pool?.name) parts.push(`Bảng ${m.pool.name}`);
  if (Number.isInteger(m?.rrRound)) parts.push(`Lượt ${m.rrRound}`);
  if (Number.isInteger(m?.round)) parts.push(`Vòng ${m.round}`);
  if (Number.isInteger(m?.order)) parts.push(`#${m.order}`);
  return parts.join(" • ") || `Match ${String(m?._id || "").slice(0, 6)}`;
};

export default function AdminCourtManagerPage() {
  const { tournamentId } = useParams();
  const socket = useSocket();

  // ---------- form state ----------
  const [cluster, setCluster] = useState("Main");
  const [mode, setMode] = useState("count"); // "count" | "names"
  const [count, setCount] = useState(3);
  const [namesText, setNamesText] = useState("Sân 1\nSân 2\nSân 3");

  const names = useMemo(
    () =>
      namesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [namesText]
  );

  // ---------- RTKQ mutations ----------
  const [upsertCourts, { isLoading: savingCourts }] = useUpsertCourtsMutation();
  const [buildQueue, { isLoading: buildingQueue, data: buildInfo }] = useBuildGroupsQueueMutation();

  // ---------- realtime state (socket) ----------
  const [courts, setCourts] = useState([]);
  const [queue, setQueue] = useState([]);

  // ---------- notifications ----------
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [notices, setNotices] = useState([]); // panel list
  const prevCourtsRef = useRef([]);
  const prevMatchesRef = useRef(new Map()); // id -> match snapshot

  const pushNotice = (message, severity = "info") => {
    const item = { id: Date.now() + Math.random(), ts: new Date(), message, severity };
    setNotices((arr) => [item, ...arr].slice(0, 200)); // keep last 200
    setSnack({ open: true, message, severity });
  };

  // diff logic for courts
  const diffCourts = (prev = [], next = []) => {
    const prevMap = new Map(prev.map((c) => [String(c._id), c]));
    next.forEach((c) => {
      const old = prevMap.get(String(c._id));
      if (!old) {
        pushNotice(`Thêm sân ${c.name} (${viStatus(c.status)})`, "info");
        return;
      }
      if (old.status !== c.status) {
        pushNotice(`Sân ${c.name}: ${viStatus(old.status)} → ${viStatus(c.status)}`, "info");
      }
      if (String(old.currentMatch || "") !== String(c.currentMatch || "")) {
        if (c.currentMatch) {
          pushNotice(`Gán trận vào ${c.name} • ${String(c.currentMatch).slice(0, 6)}…`, "success");
        } else if (old.currentMatch) {
          pushNotice(`Giải phóng ${c.name} (hết trận)`, "info");
        }
      }
    });
  };

  // diff logic for matches (queue/assigned/live)
  const diffMatches = (prevMap, nextArr) => {
    const nextMap = new Map(nextArr.map((m) => [String(m._id), m]));
    // appeared or status changed
    nextArr.forEach((m) => {
      const key = String(m._id);
      const old = prevMap.get(key);
      if (!old) {
        if (m.status === "queued") pushNotice(`Vào hàng đợi: ${matchLabel(m)}`, "info");
        if (m.status === "assigned") pushNotice(`Đã gán sân: ${matchLabel(m)}`, "success");
        if (m.status === "live") pushNotice(`Bắt đầu: ${matchLabel(m)}`, "success");
      } else if (old.status !== m.status) {
        if (old.status === "queued" && m.status === "assigned")
          pushNotice(`Đã gán sân: ${matchLabel(m)}`, "success");
        if (m.status === "live") pushNotice(`Bắt đầu: ${matchLabel(m)}`, "success");
        if (old.status === "live" && m.status !== "live")
          pushNotice(`Tạm dừng/kết thúc: ${matchLabel(m)}`, "warning");
      }
    });
    // removed (likely finished)
    prevMap.forEach((old, key) => {
      if (
        !nextMap.has(key) &&
        (old.status === "assigned" || old.status === "live" || old.status === "queued")
      ) {
        pushNotice(`Rời hàng đợi/Kết thúc: ${matchLabel(old)}`, "info");
      }
    });
    return nextMap;
  };

  useEffect(() => {
    if (!socket || !tournamentId) return;

    socket.emit("scheduler:join", { tournamentId, cluster });

    const onState = ({ courts, matches }) => {
      // diffs → notifications
      diffCourts(prevCourtsRef.current, courts || []);
      const newMap = diffMatches(
        prevMatchesRef.current,
        (matches || []).map((m) => ({ id: m._id, ...m }))
      );
      prevCourtsRef.current = courts || [];
      prevMatchesRef.current = newMap;

      setCourts(courts || []);
      setQueue((matches || []).map((m) => ({ id: m._id, ...m })));
    };

    const onMatchSnapshot = (payload) => {
      // server gửi snapshot khi join match:* — mình vẫn log nhẹ nếu cần
      if (payload?.code || payload?.labelKey) {
        pushNotice(`Cập nhật trận: ${payload.labelKey || payload.code}`, "info");
      }
    };

    socket.on("scheduler:state", onState);
    socket.on("match:snapshot", onMatchSnapshot);

    socket.emit("scheduler:requestState", { tournamentId, cluster });

    return () => {
      socket.emit("scheduler:leave", { tournamentId, cluster });
      socket.off("scheduler:state", onState);
      socket.off("match:snapshot", onMatchSnapshot);
    };
  }, [socket, tournamentId, cluster]);

  // ---------- handlers ----------
  const handleSaveCourts = async (e) => {
    e.preventDefault();
    if (!tournamentId) return;

    const payload =
      mode === "names"
        ? { tournamentId, cluster, names }
        : { tournamentId, cluster, count: Number(count) || 0 };

    try {
      await upsertCourts(payload).unwrap();
      pushNotice("Đã lưu danh sách sân", "success");
      socket?.emit?.("scheduler:requestState", { tournamentId, cluster });
    } catch (err) {
      pushNotice(err?.data?.message || "Lưu sân thất bại", "error");
    }
  };

  const handleBuildQueue = async () => {
    if (!tournamentId) return;
    try {
      const res = await buildQueue({ tournamentId, cluster }).unwrap();
      pushNotice(
        `Đã xếp hàng đợi: ${res?.totalQueued ?? 0} trận • ${res?.pools ?? 0} bảng`,
        "success"
      );
      socket?.emit?.("scheduler:requestState", { tournamentId, cluster });
    } catch (err) {
      pushNotice(err?.data?.message || "Xếp hàng đợi thất bại", "error");
    }
  };

  const handleAssignNext = (courtId) => {
    if (!tournamentId || !courtId) return;
    socket?.emit?.("scheduler:assignNext", { tournamentId, courtId, cluster });
    // thông báo sẽ hiển thị khi state cập nhật về; nhưng vẫn báo nhẹ để phản hồi ngay
    pushNotice("Yêu cầu gán trận kế tiếp…", "info");
  };

  const handleRefresh = () => {
    if (!tournamentId) return;
    socket?.emit?.("scheduler:requestState", { tournamentId, cluster });
    pushNotice("Làm mới trạng thái", "info");
  };

  const queueColumns = [
    { field: "status", headerName: "Trạng thái", width: 120 },
    { field: "queueOrder", headerName: "Thứ tự", width: 90 },
    {
      field: "pool",
      headerName: "Bảng",
      width: 90,
      valueGetter: (p) => p.row?.pool?.name || "",
    },
    { field: "rrRound", headerName: "Lượt (RR)", width: 110 },
    { field: "round", headerName: "Vòng", width: 90 },
    { field: "order", headerName: "#", width: 70 },
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ mx: "auto", p: 2 }}>
        {/* Header */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <NotificationsActiveIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>
                  Điều phối sân & hàng đợi
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Tournament ID: <code>{tournamentId}</code>
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="Cụm"
                value={cluster}
                onChange={(e) => setCluster(e.target.value)}
                placeholder="Main"
              />
              <Tooltip title="Làm mới">
                <IconButton onClick={handleRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        {/* Config + Build + Notices */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper component="form" onSubmit={handleSaveCourts} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Cấu hình sân
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
                  inputProps={{ min: 1 }}
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
                Xếp hàng đợi vòng bảng
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Thuật toán: A1, B1, C1, D1… sau đó A2, B2…
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

                {buildInfo && (
                  <Chip
                    color="default"
                    variant="outlined"
                    label={`Xếp ${buildInfo?.totalQueued ?? 0} trận • ${
                      buildInfo?.pools ?? 0
                    } bảng`}
                  />
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* Notices panel */}
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
                <Typography variant="subtitle1">Sân</Typography>
                <Typography variant="caption" color="text.secondary">
                  {courts.length} sân • cụm {cluster}
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {courts.map((c) => (
                  <Paper
                    key={c._id}
                    sx={{
                      p: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={c.name}
                        color={
                          c.status === "idle" ? "default" : c.status === "live" ? "success" : "info"
                        }
                      />
                      <Typography variant="body2">{viStatus(c.status)}</Typography>
                      {c.currentMatch && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Match: ${String(c.currentMatch).slice(0, 6)}…`}
                        />
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
                ))}

                {courts.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có sân nào trong cụm này.
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
                <Typography variant="subtitle1">Hàng đợi</Typography>
                <Tooltip title="Làm mới">
                  <IconButton onClick={handleRefresh} size="small">
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <div style={{ height: 520, width: "100%" }}>
                <DataGrid
                  rows={queue}
                  columns={queueColumns}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                  }}
                />
              </div>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* Snackbar (popup) */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
