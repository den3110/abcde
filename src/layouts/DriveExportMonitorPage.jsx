/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
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
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { DataGrid } from "@mui/x-data-grid";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useGetLiveRecordingMonitorQuery,
  useGetLiveRecordingWorkerHealthQuery,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const STATUS_META = {
  exporting: { color: "info", label: "Exporting" },
  ready: { color: "success", label: "Ready" },
  failed: { color: "error", label: "Failed" },
};

function formatRelative(ts) {
  if (!ts) return "-";
  return dayjs(ts).fromNow();
}

function formatDateTime(ts) {
  if (!ts) return "-";
  return dayjs(ts).format("DD/MM HH:mm:ss");
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function SummaryCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Stack spacing={0.6}>
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

function StatusChip({ status }) {
  const meta = STATUS_META[status] || {
    color: "default",
    label: status || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function WorkerStatusChip({ health }) {
  const status = health?.status || "offline";
  const alive = Boolean(health?.alive);
  const color =
    status === "busy" ? "info" : alive ? "success" : status === "stale" ? "warning" : "default";
  const label =
    status === "busy"
      ? "Worker đang bận"
      : alive
      ? "Worker hoạt động"
      : status === "stale"
      ? "Worker bị treo"
      : "Worker ngoại tuyến";
  return <Chip size="small" color={color} label={label} />;
}

function MatchCell({ row }) {
  return (
    <Stack spacing={0.45} sx={{ py: 0.6 }}>
      <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "normal" }}>
        {row.participantsLabel || "Unknown match"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.8 }}>
        Match: {row.matchCode || row.matchId || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: "normal" }}>
        {row.competitionLabel || "-"}
      </Typography>
    </Stack>
  );
}

function ExportLinks({ row }) {
  const canPlay = row.status === "ready" && Boolean(row.playbackUrl);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.6 }} flexWrap="wrap">
      {canPlay ? (
        <Button
          size="small"
          color="info"
          variant="outlined"
          component={Link}
          href={row.playbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<PlayCircleOutlineIcon />}
          sx={{ minWidth: 0 }}
        >
          Play
        </Button>
      ) : null}
      {row.driveRawUrl ? (
        <Button
          size="small"
          color="success"
          variant="outlined"
          component={Link}
          href={row.driveRawUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<CloudDownloadIcon />}
          sx={{ minWidth: 0 }}
        >
          Raw
        </Button>
      ) : null}
      {row.drivePreviewUrl ? (
        <Button
          size="small"
          color="secondary"
          variant="outlined"
          component={Link}
          href={row.drivePreviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
          sx={{ minWidth: 0 }}
        >
          Preview
        </Button>
      ) : null}
    </Stack>
  );
}

function WorkerHealthPanel({ health }) {
  const worker = health?.worker || null;

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Worker health
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Theo doi heartbeat va job export len Drive theo thoi gian thuc
              </Typography>
            </Box>
            <WorkerStatusChip health={health} />
          </Stack>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Worker
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {worker?.workerName || "-"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Host / PID
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {worker ? `${worker.hostname || "-"} / ${worker.pid || "-"}` : "-"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                TTL / Heartbeat
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {health?.ttlSeconds ?? "-"}s / {formatRelative(health?.lastHeartbeatAt)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Current recording
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {worker?.currentRecordingId || "idle"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Current job started
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDateTime(worker?.currentJobStartedAt)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Last completed
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDateTime(worker?.lastCompletedAt)}
              </Typography>
            </Grid>
          </Grid>

          {worker?.lastFailedReason ? (
            <>
              <Divider />
              <Alert severity="warning">
                Lỗi gần nhất lúc {formatDateTime(worker?.lastFailedAt)}: {worker.lastFailedReason}
              </Alert>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function RecordingDetailDialog({ row, open, onClose }) {
  if (!row) return null;

  const segments = row?.segmentSummary?.segments || [];
  const missingDriveLinks =
    row.status === "ready" && !row.driveRawUrl && !row.drivePreviewUrl && !row.playbackUrl;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={800}>
            Chi tiết export lên Drive
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            {row.participantsLabel || "Unknown match"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {row.competitionLabel || "-"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
            <StatusChip status={row.status} />
            <Chip size="small" variant="outlined" label={`Mode: ${row.modeLabel || "-"}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`Created: ${formatDateTime(row.createdAt)}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Finalized: ${formatDateTime(row.finalizedAt)}`}
            />
            <Chip size="small" variant="outlined" label={`Ready: ${formatDateTime(row.readyAt)}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`Output: ${formatDuration(row.durationSeconds)} / ${formatBytes(
                row.sizeBytes
              )}`}
            />
          </Stack>

          {missingDriveLinks ? (
            <Alert severity="warning">
              Bản ghi đã sẵn sàng trong DB nhưng chưa có đầy đủ link Drive/Phát.
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <ExportLinks row={row} />
          </Stack>

          {row.error ? <Alert severity="error">{row.error}</Alert> : null}

          <Divider />

          <Typography variant="h6" fontWeight={700}>
            Segment summary
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Segments"
                value={row.segmentSummary?.totalSegments || 0}
                hint={`${row.segmentSummary?.uploadedSegments || 0} uploaded`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Duration"
                value={formatDuration(row.durationSeconds)}
                hint="Tổng thời lượng đã ghi"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Output size"
                value={formatBytes(row.sizeBytes)}
                hint="Kích thước file cuối"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Export attempts"
                value={row.exportAttempts || 0}
                hint={`Updated ${formatRelative(row.updatedAt)}`}
              />
            </Grid>
          </Grid>

          <Divider />

          {segments.length === 0 ? (
            <Alert severity="info">Chưa có segment nào được ghi vào DB.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Typography variant="h6" fontWeight={700}>
                Danh sách segment
              </Typography>
              {segments.map((segment) => (
                <Card
                  key={`${row.id}-segment-${segment.index}`}
                  variant="outlined"
                  sx={{ borderRadius: 2.5 }}
                >
                  <CardContent>
                    <Stack spacing={0.8}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Typography variant="subtitle1" fontWeight={700}>
                          Segment #{segment.index}
                          {segment.isFinal ? " (final)" : ""}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={segment.uploadStatus || "unknown"}
                        />
                      </Stack>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {formatBytes(segment.sizeBytes)} - {formatDuration(segment.durationSeconds)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: "normal" }}>
                        {segment.objectKey || "-"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DriveExportMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetLiveRecordingMonitorQuery();
  const {
    data: workerHealth,
    isError: workerHealthError,
    refetch: refetchWorkerHealth,
  } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: 10000,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (initialSnapshot) setSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setSocketOn(true);
      try {
        socket.emit("recordings-v2:watch");
      } catch (_) {}
      void refetch();
    };
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = (payload) => setSnapshot(payload);

    try {
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("recordings-v2:update", handleUpdate);
      if (socket.connected) {
        handleConnect();
      }
    } catch (_) {}

    return () => {
      try {
        socket.emit("recordings-v2:unwatch");
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("recordings-v2:update", handleUpdate);
      } catch (_) {}
    };
  }, [socket, refetch]);

  const rows = useMemo(() => {
    const sourceRows = snapshot?.rows || [];
    return sourceRows.filter((row) => ["exporting", "ready", "failed"].includes(row.status));
  }, [snapshot]);

  const summary = useMemo(() => {
    const exporting = rows.filter((row) => row.status === "exporting");
    const ready = rows.filter((row) => row.status === "ready");
    const failed = rows.filter((row) => row.status === "failed");
    return {
      exporting,
      ready,
      failed,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!keyword) return true;
      const haystack = [
        row.recordingId,
        row.matchId,
        row.matchCode,
        row.participantsLabel,
        row.competitionLabel,
        row.status,
        row.error,
        row.driveFileId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, search, statusFilter]);

  const selectedRow = useMemo(
    () =>
      filteredRows.find((row) => row.id === selectedRowId) ||
      rows.find((row) => row.id === selectedRowId) ||
      null,
    [filteredRows, rows, selectedRowId]
  );

  const currentExportRow = useMemo(() => {
    const currentRecordingId = workerHealth?.worker?.currentRecordingId;
    if (!currentRecordingId) return null;
    return rows.find((row) => row.recordingId === currentRecordingId) || null;
  }, [rows, workerHealth]);

  const workerAlertVisible =
    ["stale", "offline"].includes(workerHealth?.status || "offline") &&
    summary.exporting.length > 0;

  const columns = useMemo(
    () => [
      {
        field: "status",
        headerName: "Trạng thái",
        minWidth: 130,
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      },
      {
        field: "match",
        headerName: "Trận đấu",
        flex: 1.2,
        minWidth: 280,
        sortable: false,
        renderCell: ({ row }) => <MatchCell row={row} />,
      },
      {
        field: "output",
        headerName: "Đầu ra",
        minWidth: 180,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.35} sx={{ py: 0.6 }}>
            <Typography variant="body2" fontWeight={700}>
              {formatDuration(row.durationSeconds)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {formatBytes(row.sizeBytes)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Segments: {row.segmentSummary?.totalSegments || 0}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "drive",
        headerName: "Drive / Phát",
        minWidth: 260,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => <ExportLinks row={row} />,
      },
      {
        field: "updatedAt",
        headerName: "Cập nhật",
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack spacing={0.3} sx={{ py: 0.6 }}>
            <Typography variant="body2">{formatRelative(row.updatedAt)}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {formatDateTime(row.updatedAt)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "error",
        headerName: "Lỗi gần nhất",
        flex: 1,
        minWidth: 240,
        sortable: false,
        renderCell: ({ row }) => (
          <Typography
            variant="caption"
            sx={{
              whiteSpace: "normal",
              color: row.error ? "error.main" : "text.secondary",
              py: 0.6,
            }}
          >
            {row.error ||
              (row.status === "ready" && !row.driveRawUrl && !row.drivePreviewUrl
                ? "Ready but missing Drive links"
                : "-")}
          </Typography>
        ),
      },
    ],
    []
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Drive Export Monitor
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Theo doi worker export, backlog len Drive, va cac recording da san sang phat lai
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket disconnected"}
              />
              <WorkerStatusChip health={workerHealth} />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  refetch();
                  refetchWorkerHealth();
                }}
                disabled={isFetching}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          {workerAlertVisible ? (
            <Alert severity="warning">
              Worker export khong con heartbeat nhung van con recording dang exporting.
            </Alert>
          ) : null}

          {isError ? (
            <Alert severity="error">Failed to load recording export snapshot.</Alert>
          ) : null}
          {workerHealthError ? <Alert severity="error">Failed to load worker health.</Alert> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={2.4}>
              <SummaryCard
                title="Worker"
                value={workerHealth?.status || "offline"}
                hint={`Heartbeat ${formatRelative(workerHealth?.lastHeartbeatAt)}`}
                color={
                  workerHealth?.status === "busy"
                    ? "info.main"
                    : workerHealth?.alive
                    ? "success.main"
                    : workerHealth?.status === "stale"
                    ? "warning.main"
                    : "text.primary"
                }
              />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <SummaryCard
                title="Current job"
                value={
                  currentExportRow?.matchCode || workerHealth?.worker?.currentRecordingId || "idle"
                }
                hint={currentExportRow?.participantsLabel || "Không có job export hiện tại"}
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <SummaryCard
                title="Exporting"
                value={summary.exporting.length}
                hint="Đang ghép và đẩy lên Drive"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <SummaryCard
                title="Ready"
                value={summary.ready.length}
                hint="Đã có file trên Drive"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={2.4}>
              <SummaryCard
                title="Failed"
                value={summary.failed.length}
                hint="Cần kiểm tra lỗi export"
                color="error.main"
              />
            </Grid>
          </Grid>

          <WorkerHealthPanel health={workerHealth} />

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <TextField
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm kiếm bản ghi, trận đấu, giải đấu, tệp drive, lỗi..."
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />,
                    }}
                    fullWidth
                  />

                  <TextField
                    select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={{ width: { xs: "100%", md: 220 } }}
                  >
                    <MenuItem value="ALL">Tất cả trạng thái</MenuItem>
                    <MenuItem value="exporting">Đang xuất</MenuItem>
                    <MenuItem value="ready">Sẵn sàng</MenuItem>
                    <MenuItem value="failed">Lỗi</MenuItem>
                  </TextField>
                </Stack>

                <DataGrid
                  getRowHeight={() => "auto"}
                  autoHeight
                  rows={filteredRows}
                  columns={columns}
                  disableRowSelectionOnClick
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    sorting: { sortModel: [{ field: "updatedAt", sort: "desc" }] },
                  }}
                  onRowClick={(params) => setSelectedRowId(params.row.id)}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      alignItems: "stretch",
                      py: 1,
                      cursor: "pointer",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      borderRadius: 2,
                    },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          <RecordingDetailDialog
            row={selectedRow}
            open={Boolean(selectedRow)}
            onClose={() => setSelectedRowId(null)}
          />
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
