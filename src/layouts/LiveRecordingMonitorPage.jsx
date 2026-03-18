/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
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
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import { useGetLiveRecordingMonitorQuery } from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const STATUS_META = {
  recording: { color: "error", label: "Recording" },
  uploading: { color: "warning", label: "Uploading" },
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

function StatusChip({ status }) {
  const meta = STATUS_META[status] || {
    color: "default",
    label: status || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
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

function ProgressCell({ row }) {
  const activeSegment = row.segmentSummary?.activeUploadSegment;
  const latestSegment = row.segmentSummary?.latestSegment;
  const progress = activeSegment || latestSegment;
  const percent = progress?.uploadStatus === "uploaded" ? 100 : Number(progress?.percent || 0);
  const totalSegments = row.segmentSummary?.totalSegments || 0;
  const uploadedSegments = row.segmentSummary?.uploadedSegments || 0;

  return (
    <Stack spacing={0.75} sx={{ width: "100%", py: 0.6 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" fontWeight={700}>
          {uploadedSegments}/{totalSegments} segments
        </Typography>
        {progress ? (
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            seg #{progress.index} {progress.uploadStatus}
          </Typography>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.max(0, Math.min(100, percent))}
        color={row.status === "failed" ? "error" : "primary"}
        sx={{ height: 8, borderRadius: 999 }}
      />
      <Typography variant="caption" sx={{ opacity: 0.75 }}>
        {progress
          ? `${percent}% • ${formatBytes(progress.completedBytes || 0)} / ${formatBytes(
              progress.totalSizeBytes || 0
            )}`
          : "No active upload"}
      </Typography>
    </Stack>
  );
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

function ActionsCell({ row }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.6 }}>
      {row.playbackUrl ? (
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

export default function LiveRecordingMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [snapshot, setSnapshot] = useState(null);

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetLiveRecordingMonitorQuery();

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

  const rows = snapshot?.rows || [];
  const summary = snapshot?.summary || {};
  const meta = snapshot?.meta || {};

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!keyword) return true;
      const haystack = [
        row.recordingId,
        row.recordingSessionId,
        row.matchId,
        row.matchCode,
        row.participantsLabel,
        row.competitionLabel,
        row.tournamentName,
        row.bracketName,
        row.courtLabel,
        row.modeLabel,
        row.status,
        row.error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        field: "status",
        headerName: "Status",
        minWidth: 130,
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      },
      {
        field: "modeLabel",
        headerName: "Mode",
        minWidth: 170,
      },
      {
        field: "match",
        headerName: "Match",
        flex: 1.2,
        minWidth: 280,
        sortable: false,
        renderCell: ({ row }) => <MatchCell row={row} />,
      },
      {
        field: "progress",
        headerName: "Upload Progress",
        flex: 1,
        minWidth: 240,
        sortable: false,
        renderCell: ({ row }) => <ProgressCell row={row} />,
      },
      {
        field: "output",
        headerName: "Output",
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
        field: "updatedAt",
        headerName: "Updated",
        minWidth: 150,
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
        headerName: "Error",
        flex: 0.85,
        minWidth: 220,
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
            {row.error || "-"}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "Links",
        minWidth: 240,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => <ActionsCell row={row} />,
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
                Recording Monitor
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Realtime tracking for recording v2 upload/export/playback pipeline
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket disconnected"}
              />
              <Chip
                color={meta.lastPublishMode === "reconcile" ? "warning" : "info"}
                label={
                  meta.lastPublishMode === "reconcile" ? "Fallback reconcile" : "Live realtime"
                }
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          <Alert severity="info">
            Last event: <strong>{meta.lastEventReason || "bootstrap"}</strong> •{" "}
            {formatRelative(meta.lastEventAt)} • last publish {formatRelative(meta.lastPublishAt)}
          </Alert>

          {isError ? (
            <Alert severity="error">Failed to load recording monitor snapshot.</Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Active pipeline"
                value={summary.active || 0}
                hint={`${summary.recording || 0} recording • ${
                  summary.uploading || 0
                } uploading • ${summary.exporting || 0} exporting`}
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Ready"
                value={summary.ready || 0}
                hint={`${formatBytes(summary.totalSizeBytes || 0)} total output`}
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Failed"
                value={summary.failed || 0}
                hint={`${summary.pendingSegments || 0} pending segments`}
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Segments"
                value={`${summary.uploadedSegments || 0}/${summary.totalSegments || 0}`}
                hint={`${formatDuration(summary.totalDurationSeconds || 0)} recorded in DB`}
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                >
                  <TextField
                    fullWidth
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search recording, match, tournament, error..."
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />,
                    }}
                  />
                  <TextField
                    select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="ALL">All statuses</MenuItem>
                    <MenuItem value="recording">Recording</MenuItem>
                    <MenuItem value="uploading">Uploading</MenuItem>
                    <MenuItem value="exporting">Exporting</MenuItem>
                    <MenuItem value="ready">Ready</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                  </TextField>
                </Stack>

                <Divider />

                <Box sx={{ height: 720, width: "100%" }}>
                  <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    loading={isFetching && !snapshot}
                    disableRowSelectionOnClick
                    getRowHeight={() => 112}
                    slots={{ toolbar: GridToolbar }}
                    pageSizeOptions={[25, 50, 100]}
                    initialState={{
                      sorting: {
                        sortModel: [{ field: "updatedAt", sort: "desc" }],
                      },
                      pagination: {
                        paginationModel: { pageSize: 25, page: 0 },
                      },
                    }}
                    sx={{
                      "& .MuiDataGrid-cell": {
                        alignItems: "stretch",
                      },
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
