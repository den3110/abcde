// src/pages/admin/AdminBracketCourtManagerPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "context/SocketContext";
import {
  useUpsertCourtsMutation,
  useBuildGroupsQueueMutation,
  useAssignNextHttpMutation, // (tuỳ chọn) fallback HTTP
} from "slices/adminCourtApiSlice";

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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { DataGrid } from "@mui/x-data-grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { toast } from "react-toastify";

export default function AdminBracketCourtManagerPage() {
  const { bracketId } = useParams(); // route: /admin/brackets/:bracketId/courts
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Lấy tournamentId từ state hoặc query (?tournamentId= / ?t=)
  const searchParams = new URLSearchParams(location.search || "");
  const tournamentId =
    location?.state?.tournamentId || searchParams.get("tournamentId") || searchParams.get("t");

  // ---- Thông tin hiển thị (nếu truyền qua state)
  const bracketName = location?.state?.bracketName || "";
  const tournamentName = location?.state?.tournamentName || "";

  // ---- bracket hiện hành
  const bracket = bracketId;

  // ---------- UI state ----------
  const [mode, setMode] = useState("count"); // "count" | "names"
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
  const notifQueueRef = useRef([]); // giữ log notify (nếu server có phát)
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // ---------- RTKQ mutations ----------
  const [upsertCourts, { isLoading: savingCourts }] = useUpsertCourtsMutation();
  const [buildQueue, { isLoading: buildingQueue }] = useBuildGroupsQueueMutation();
  const [assignNextHttp] = useAssignNextHttpMutation(); // fallback tuỳ chọn

  // ---------- Socket rooms ----------
  useEffect(() => {
    if (!socket || !tournamentId || !bracket) return;

    // tham gia room theo tournament + bracket
    socket.emit("scheduler:join", { tournamentId, bracket });

    const onState = ({ courts, matches }) => {
      setCourts(courts || []);
      setQueue((matches || []).map((m) => ({ id: m._id, ...m })));
    };
    const onNotify = (msg) => {
      notifQueueRef.current = [msg, ...notifQueueRef.current].slice(0, 20);
      setSnackbar({ open: true, message: msg?.message || "", severity: msg?.level || "info" });
    };

    socket.on("scheduler:state", onState);
    socket.on("scheduler:notify", onNotify);

    // yêu cầu trạng thái ban đầu
    socket.emit("scheduler:requestState", { tournamentId, bracket });

    return () => {
      socket.emit("scheduler:leave", { tournamentId, bracket });
      socket.off("scheduler:state", onState);
      socket.off("scheduler:notify", onNotify);
    };
  }, [socket, tournamentId, bracket]);

  // ---------- handlers ----------
  const handleSaveCourts = async (e) => {
    e.preventDefault();
    if (!tournamentId || !bracket) {
      toast.error("Thiếu tournamentId hoặc bracket.");
      return;
    }
    const payload =
      mode === "names"
        ? { tournamentId, bracket, names }
        : { tournamentId, bracket, count: Number(count) || 0 };

    try {
      await upsertCourts(payload).unwrap();
      toast.success("Đã lưu danh sách sân & auto xếp/gán theo hàng đợi");
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lỗi lưu sân");
    }
  };

  const handleBuildQueue = async () => {
    if (!tournamentId || !bracket) {
      toast.error("Thiếu tournamentId hoặc bracket.");
      return;
    }
    try {
      const res = await buildQueue({ tournamentId, bracket }).unwrap();
      toast.success(`Đã xếp ${res?.totalQueued ?? 0} trận`);
    } catch (e) {
      toast.error(e?.data?.message || e?.error || "Xếp hàng đợi thất bại");
    } finally {
      socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
    }
  };

  const handleAssignNext = async (courtId) => {
    if (!tournamentId || !bracket || !courtId) return;
    // Ưu tiên socket (không ack)
    socket?.emit?.("scheduler:assignNext", { tournamentId, courtId, bracket });
    // Fallback HTTP (tuỳ chọn):
    // await assignNextHttp({ tournamentId, courtId, bracket }).unwrap();
  };

  const handleRefresh = () => {
    if (!tournamentId || !bracket) return;
    socket?.emit?.("scheduler:requestState", { tournamentId, bracket });
  };

  const statusLabel = (s) =>
    s === "idle"
      ? "Trống"
      : s === "assigned"
      ? "Chờ vào sân"
      : s === "live"
      ? "Đang thi đấu"
      : s || "";

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
                Điều phối sân (Bracket)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bracket ID: <code>{bracketId}</code>
                {bracketName && (
                  <>
                    {" "}
                    • <strong>{bracketName}</strong>
                  </>
                )}
                {tournamentName && (
                  <>
                    {" "}
                    • <em>{tournamentName}</em>
                  </>
                )}
                {tournamentId ? (
                  <>
                    {" "}
                    • Tournament: <code>{tournamentId}</code>
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
                startIcon={<PlayArrowIcon />}
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
                Cấu hình sân cho bracket
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
                Xếp hàng đợi theo lượt (RR/Group)
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Thuật toán: A1, B1, C1, D1… sau đó A2, B2… (tránh trùng VĐV đang
                &quot;assigned/live&quot;).
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
                <Typography variant="subtitle1">Sân</Typography>
                <Typography variant="caption" color="text.secondary">
                  {courts.length} sân
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
                      <Typography variant="body2">{statusLabel(c.status)}</Typography>
                      {c.currentMatch && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Match: ${String(c.currentMatch).slice(-6)}`}
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
                    Chưa có sân nào cho bracket này.
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
                  columns={[
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
                  ]}
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

        {/* mini log cho notify (nếu server có phát) */}
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
