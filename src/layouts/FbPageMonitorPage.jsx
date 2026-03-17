/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ErrorIcon from "@mui/icons-material/Error";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useGetFbPageMonitorQuery,
  useCheckOneFbTokenMutation,
  useProbeFbPageLiveStateMutation,
  useCheckAllFbTokensMutation,
  useMarkNeedsReauthMutation,
  useClearBusyFlagMutation,
  useDisableFbTokenMutation,
  useEnableFbTokenMutation,
} from "slices/fbTokensApiSlice";

dayjs.extend(relativeTime);

const LOCAL_STATUS_META = {
  OK: { color: "success", label: "OK" },
  UNKNOWN: { color: "default", label: "Chưa rõ" },
  USER_EXPIRED: { color: "warning", label: "User token hết hạn" },
  EXPIRED: { color: "warning", label: "Page token hết hạn" },
  INVALID: { color: "error", label: "Token lỗi" },
  CHECKPOINT: { color: "error", label: "Checkpoint" },
  MISSING_SCOPES: { color: "warning", label: "Thiếu quyền" },
  NEEDS_REAUTH: { color: "error", label: "Cần reauth" },
  MISSING_PAGE_TOKEN: { color: "error", label: "Thiếu page token" },
  ISSUE: { color: "warning", label: "Có vấn đề" },
  DISABLED: { color: "default", label: "Disabled" },
};

const MONITOR_STATE_META = {
  LIVE: { color: "error", label: "Đang giữ lease" },
  COOLING_DOWN: { color: "warning", label: "Đang cooldown" },
  BUSY: { color: "warning", label: "Busy" },
  NEEDS_REAUTH: { color: "error", label: "Cần reauth" },
  ATTENTION: { color: "warning", label: "Cần kiểm tra" },
  IDLE: { color: "success", label: "Sẵn sàng" },
  DISABLED: { color: "default", label: "Disabled" },
};

function StatusChip({ code, monitor = false }) {
  const meta = (monitor ? MONITOR_STATE_META : LOCAL_STATUS_META)[code] || {
    color: "default",
    label: code || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function formatRelative(ts) {
  if (!ts) return "—";
  return dayjs(ts).fromNow();
}

function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "ngay";
  const total = Math.ceil(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function SnapshotCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Stack spacing={0.75}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {hint}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TargetSummary({ target, emptyLabel = "Chưa có target" }) {
  if (!target) {
    return (
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35}>
      <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "normal" }}>
        {target.participantsLabel || target.label || emptyLabel}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: "normal" }}>
        {target.competitionLabel || "Chưa rõ khuôn khổ"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: "normal" }}>
        Mã trận: {target.code || "—"} • Trạng thái: {target.status || "—"}
      </Typography>
    </Stack>
  );
}

export default function FbPageMonitorPage() {
  const socket = useSocket();
  const [q, setQ] = useState("");
  const [monitorFilter, setMonitorFilter] = useState("ALL");
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [probeDialog, setProbeDialog] = useState({
    open: false,
    row: null,
    data: null,
    loading: false,
    error: "",
  });

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetFbPageMonitorQuery();
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  const [checkOne, { isLoading: checkingOne }] = useCheckOneFbTokenMutation();
  const [probeLive, { isLoading: probingLive }] = useProbeFbPageLiveStateMutation();
  const [checkAll, { isLoading: checkingAll }] = useCheckAllFbTokensMutation();
  const [markReauth, { isLoading: markingReauth }] = useMarkNeedsReauthMutation();
  const [clearBusy, { isLoading: clearingBusy }] = useClearBusyFlagMutation();
  const [disablePage, { isLoading: disabling }] = useDisableFbTokenMutation();
  const [enablePage, { isLoading: enabling }] = useEnableFbTokenMutation();

  useEffect(() => {
    if (initialSnapshot) setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setSocketOn(true);
      try {
        socket.emit("fb-pages:watch");
      } catch (_) {}
      void refetch();
    };
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = (payload) => setSnapshot(payload);

    try {
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("fb-pages:update", handleUpdate);
      if (socket.connected) {
        handleConnect();
      }
    } catch (_) {}

    return () => {
      try {
        socket.emit("fb-pages:unwatch");
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("fb-pages:update", handleUpdate);
      } catch (_) {}
    };
  }, [socket, refetch]);

  const rows = snapshot?.rows || [];
  const summary = snapshot?.summary || {};
  const meta = snapshot?.meta || {};
  const loadingAny =
    isFetching ||
    checkingOne ||
    probingLive ||
    checkingAll ||
    markingReauth ||
    clearingBusy ||
    disabling ||
    enabling;

  const runAction = useCallback(
    async (promiseFactory) => {
      await promiseFactory();
      if (!socket?.connected) {
        await refetch();
      }
    },
    [refetch, socket]
  );

  const handleProbe = useCallback(
    async (row) => {
      setProbeDialog({ open: true, row, data: null, loading: true, error: "" });
      try {
        const data = await probeLive(row._id).unwrap();
        setProbeDialog({ open: true, row, data, loading: false, error: "" });
      } catch (error) {
        setProbeDialog({
          open: true,
          row,
          data: null,
          loading: false,
          error: String(error?.data?.message || error?.message || error),
        });
      }
    },
    [probeLive]
  );

  const filteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (monitorFilter !== "ALL" && row.monitorState?.code !== monitorFilter) {
        return false;
      }
      if (!keyword) return true;
      const haystack = [
        row.pageName,
        row.pageId,
        row.category,
        row.localStatusCode,
        row.monitorState?.code,
        row.busyTarget?.label,
        row.busyTarget?.participantsLabel,
        row.busyTarget?.competitionLabel,
        row.busyTarget?.tournamentName,
        row.busyTarget?.bracketName,
        row.busyTarget?.courtLabel,
        row.latestLease?.target?.label,
        row.latestLease?.target?.participantsLabel,
        row.latestLease?.target?.competitionLabel,
        row.latestLease?.target?.tournamentName,
        row.latestLease?.target?.bracketName,
        row.latestLease?.target?.courtLabel,
        row.busyLiveVideoId,
        row.releasePending?.reason,
        ...(row.tasks || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, q, monitorFilter]);

  const columns = useMemo(
    () => [
      {
        field: "page",
        headerName: "Page",
        minWidth: 260,
        flex: 1.2,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} sx={{ py: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography fontWeight={700}>{row.pageName || "(no name)"}</Typography>
              {row.disabled ? <Chip size="small" label="Disabled" /> : null}
            </Stack>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {row.pageId}
            </Typography>
            {row.category ? (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {row.category}
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        field: "monitorState",
        headerName: "Realtime state",
        minWidth: 210,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} sx={{ py: 1 }}>
            <StatusChip code={row.monitorState?.code} monitor />
            <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: "normal" }}>
              {row.monitorState?.note || "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "localStatusCode",
        headerName: "Token state",
        minWidth: 180,
        flex: 0.8,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} sx={{ py: 1 }}>
            <StatusChip code={row.localStatusCode} />
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Check: {formatRelative(row.lastCheckedAt)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "lease",
        headerName: "Trận đang live / lease",
        minWidth: 320,
        flex: 1.35,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} sx={{ py: 1 }}>
            {row.latestLease ? (
              <>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Chip size="small" color="error" label={`${row.activeLeaseCount} lease`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      row.latestLease.target?.matchKind === "userMatch" ? "User match" : "Match"
                    }
                  />
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    HB {formatRelative(row.latestLease.lastHeartbeatAt)}
                  </Typography>
                </Stack>
                <TargetSummary
                  target={row.latestLease.target}
                  emptyLabel={row.latestLease.clientSessionId || "Có lease nhưng chưa rõ target"}
                />
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Expire {formatRelative(row.latestLease.expiresAt)}
                </Typography>
              </>
            ) : (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Không có lease active
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: "busy",
        headerName: "Busy / khuôn khổ",
        minWidth: 320,
        flex: 1.2,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} sx={{ py: 1 }}>
            {row.busyTarget ? (
              <TargetSummary
                target={row.busyTarget}
                emptyLabel={row.isBusy ? "Busy nhưng chưa rõ target" : "Rảnh"}
              />
            ) : (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {row.isBusy ? "Busy nhưng chưa rõ match" : "Rảnh"}
              </Typography>
            )}
            {row.releasePending ? (
              <Chip
                size="small"
                color="warning"
                label={`Free sau ${formatRemaining(row.releasePending.remainingMs)}`}
              />
            ) : null}
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Busy since: {formatRelative(row.busySince)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 260,
        flex: 1.1,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ py: 1 }}>
            <Tooltip title="Open Facebook page">
              <IconButton
                size="small"
                onClick={() => window.open(`https://facebook.com/${row.pageId}`, "_blank")}
              >
                <OpenInNewIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Check token/permission ngay">
              <span>
                <IconButton
                  size="small"
                  disabled={loadingAny}
                  onClick={() => runAction(() => checkOne(row._id).unwrap())}
                >
                  <RefreshIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Probe live state trên Facebook">
              <span>
                <IconButton size="small" disabled={loadingAny} onClick={() => handleProbe(row)}>
                  <VisibilityIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Đặt cần reauth">
              <span>
                <IconButton
                  size="small"
                  disabled={loadingAny}
                  onClick={() => runAction(() => markReauth(row._id).unwrap())}
                >
                  <ErrorIcon fontSize="inherit" color="error" />
                </IconButton>
              </span>
            </Tooltip>
            {row.isBusy ? (
              <Tooltip title="Clear busy ngay">
                <span>
                  <IconButton
                    size="small"
                    disabled={loadingAny}
                    onClick={() => runAction(() => clearBusy(row._id).unwrap())}
                  >
                    <LinkOffIcon fontSize="inherit" color="warning" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title={row.disabled ? "Enable page" : "Disable page"}>
              <span>
                <IconButton
                  size="small"
                  disabled={loadingAny}
                  onClick={() =>
                    runAction(() => (row.disabled ? enablePage : disablePage)(row._id).unwrap())
                  }
                >
                  {row.disabled ? (
                    <ToggleOffIcon fontSize="inherit" />
                  ) : (
                    <ToggleOnIcon fontSize="inherit" color="success" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [checkOne, clearBusy, disablePage, enablePage, handleProbe, loadingAny, markReauth, runAction]
  );

  const lastPublishMode = meta.lastPublishMode === "reconcile" ? "reconcile" : "event";
  const lastPublishLabel = lastPublishMode === "reconcile" ? "Fallback reconcile" : "Live realtime";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={800}>
                FB Page Monitor
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Theo dõi realtime pool page Facebook, lease heartbeat, busy flag và cooldown free.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                color={socketOn ? "success" : "error"}
                icon={socketOn ? <CheckCircleIcon /> : <WarningAmberIcon />}
                label={socketOn ? "Socket realtime OK" : "Socket disconnected"}
                variant="outlined"
              />
              <Chip
                size="small"
                color={lastPublishMode === "reconcile" ? "warning" : "success"}
                icon={<AutorenewIcon />}
                label={lastPublishLabel}
                variant="outlined"
              />
              <Chip
                size="small"
                icon={<AutorenewIcon />}
                label={`Cập nhật ${snapshot?.ts ? dayjs(snapshot.ts).fromNow() : "—"}`}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`Event: ${meta.lastEventReason || "bootstrap"}`}
                variant="outlined"
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={loadingAny}
              >
                Tải lại
              </Button>
              <Button
                variant="contained"
                startIcon={<LiveTvIcon />}
                onClick={() => runAction(() => checkAll().unwrap())}
                disabled={loadingAny}
              >
                Check all
              </Button>
            </Stack>
          </Stack>

          {isError ? (
            <Alert severity="error">
              Không tải được snapshot monitor ban đầu. Socket realtime vẫn sẽ tự cập nhật nếu kết
              nối còn sống.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SnapshotCard
                title="Tổng page"
                value={summary.totalPages || 0}
                hint={`${summary.healthyPages || 0} page đang sẵn sàng`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SnapshotCard
                title="Lease active"
                value={summary.activeLeases || 0}
                hint={`${summary.activeLeasePages || 0} page đang giữ lease`}
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SnapshotCard
                title="Busy / cooldown"
                value={`${summary.busyPages || 0} / ${summary.releasePendingPages || 0}`}
                hint="Busy hiện tại / page đang chờ free"
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SnapshotCard
                title="Need attention"
                value={`${summary.needsReauthPages || 0} / ${summary.disabledPages || 0}`}
                hint="Cần reauth / đang disabled"
                color="info.main"
              />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Tìm page / pageId / match / live video"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                {[
                  "ALL",
                  "LIVE",
                  "COOLING_DOWN",
                  "BUSY",
                  "NEEDS_REAUTH",
                  "ATTENTION",
                  "IDLE",
                  "DISABLED",
                ].map((code) => (
                  <Chip
                    key={code}
                    label={code === "ALL" ? "Tất cả" : MONITOR_STATE_META[code]?.label || code}
                    color={monitorFilter === code ? "primary" : "default"}
                    variant={monitorFilter === code ? "filled" : "outlined"}
                    onClick={() => setMonitorFilter(code)}
                    size="small"
                  />
                ))}
              </Stack>
            </Stack>
            <Typography variant="caption" sx={{ mt: 1, display: "block", opacity: 0.7 }}>
              Event gần nhất: {formatRelative(meta.lastEventAt)} • publish:{" "}
              {formatRelative(meta.lastPublishAt)} • mode: {lastPublishMode}
            </Typography>
          </Paper>

          <Paper variant="outlined">
            <Box sx={{ width: "100%" }}>
              <DataGrid
                rows={filteredRows}
                columns={columns}
                getRowId={(row) => row._id}
                autoHeight
                disableRowSelectionOnClick
                density="compact"
                loading={loadingAny}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25, page: 0 } },
                }}
                getRowHeight={() => "auto"}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
                }}
                sx={{
                  "& .MuiDataGrid-cell": { alignItems: "flex-start", py: 1 },
                  "& .MuiDataGrid-row": { maxHeight: "fit-content !important" },
                  "& .MuiDataGrid-cellContent": {
                    overflow: "visible",
                    whiteSpace: "normal",
                  },
                }}
              />
            </Box>
          </Paper>
        </Stack>
      </Box>

      <Dialog
        open={probeDialog.open}
        onClose={() =>
          setProbeDialog({ open: false, row: null, data: null, loading: false, error: "" })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Probe live state
          {probeDialog.row ? ` — ${probeDialog.row.pageName || probeDialog.row.pageId}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {probeDialog.loading ? (
            <Alert severity="info">Đang probe live state từ Facebook…</Alert>
          ) : probeDialog.error ? (
            <Alert severity="error">{probeDialog.error}</Alert>
          ) : probeDialog.data ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                <Chip
                  size="small"
                  color={probeDialog.data.busy ? "warning" : "success"}
                  label={probeDialog.data.busy ? "Facebook đang busy" : "Facebook đang idle"}
                />
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Checked {formatRelative(probeDialog.data.checkedAt)}
                </Typography>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Live now ({probeDialog.data.liveNow?.length || 0})
                </Typography>
                {(probeDialog.data.liveNow || []).length ? (
                  <Stack spacing={0.75}>
                    {probeDialog.data.liveNow.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {item.title || item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.75 }}>
                          {item.status} • {item.permalink_url || item.secure_stream_url || "No URL"}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Không có live video nào đang LIVE.
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  Prepared ({probeDialog.data.prepared?.length || 0})
                </Typography>
                {(probeDialog.data.prepared || []).length ? (
                  <Stack spacing={0.75}>
                    {probeDialog.data.prepared.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {item.title || item.id}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.75 }}>
                          {item.status} • {item.permalink_url || item.secure_stream_url || "No URL"}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Không có live video nào ở trạng thái prepared.
                  </Typography>
                )}
              </Box>
            </Stack>
          ) : (
            <Alert severity="warning">Chưa có dữ liệu probe.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setProbeDialog({ open: false, row: null, data: null, loading: false, error: "" })
            }
          >
            Đóng
          </Button>
          {probeDialog.row ? (
            <Button variant="outlined" onClick={() => handleProbe(probeDialog.row)}>
              Probe lại
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
