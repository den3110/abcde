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
import {
  useGetLiveRecordingMonitorQuery,
  useGetLiveRecordingWorkerHealthQuery,
} from "slices/liveApiSlice";

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

function formatSegmentUploadStatus(status) {
  switch (status) {
    case "presigned":
      return "Da cap URL upload";
    case "uploading_parts":
      return "Dang upload part";
    case "uploaded":
      return "Da upload";
    case "failed":
      return "That bai";
    case "aborted":
      return "Da huy";
    default:
      return status || "Khong ro";
  }
}

function getRowProgressSummary(row) {
  const summary = row?.segmentSummary || {};
  const activeSegment = summary.activeUploadSegment || null;
  const latestSegment = summary.latestSegment || null;
  const displaySegment = activeSegment || latestSegment || null;
  const totalSegments = Number(summary.totalSegments || 0);
  const uploadedSegments = Number(summary.uploadedSegments || 0);
  const segmentPercent =
    displaySegment?.uploadStatus === "uploaded" ? 100 : Number(displaySegment?.percent || 0);

  let overallPercent = 0;
  if (totalSegments > 0) {
    const fractionalSegment =
      displaySegment && displaySegment.uploadStatus !== "uploaded"
        ? Math.max(0, Math.min(0.999, segmentPercent / 100))
        : 0;
    overallPercent = Math.round(((uploadedSegments + fractionalSegment) / totalSegments) * 100);
  }

  if (uploadedSegments >= totalSegments && totalSegments > 0) {
    overallPercent = 100;
  }

  return {
    displaySegment,
    totalSegments,
    uploadedSegments,
    segmentPercent,
    overallPercent: Math.max(0, Math.min(100, overallPercent)),
  };
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || {
    color: "default",
    label: status || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function ExportStageCell({ row }) {
  const exportPipeline = row?.exportPipeline || {};
  const stageLabel = exportPipeline.label || "-";
  const detail = exportPipeline.detail || "";

  if (row?.status !== "exporting") {
    return (
      <Typography variant="caption" sx={{ py: 0.6, opacity: 0.72 }}>
        {row?.status === "ready" ? "Da xong" : row?.status === "failed" ? "That bai" : "-"}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35} sx={{ py: 0.6 }}>
      <Typography variant="body2" fontWeight={700}>
        {stageLabel}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
        {detail || "Dang doi cap nhat tu worker"}
      </Typography>
    </Stack>
  );
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

function StorageOverviewCard({ storage }) {
  const usedBytes = Number(storage?.usedBytes || 0);
  const remainingBytes =
    storage?.remainingBytes == null ? null : Number(storage.remainingBytes || 0);
  const totalBytes = storage?.totalBytes == null ? null : Number(storage.totalBytes || 0);
  const percentUsed = storage?.percentUsed == null ? null : Number(storage.percentUsed || 0);
  const configured = Boolean(storage?.configured);

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Stack spacing={0.35}>
              <Typography variant="h6" fontWeight={800}>
                R2 Storage
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Chi tinh source segments recording dang con nam tren R2.
              </Typography>
            </Stack>

            <Chip
              size="small"
              color={configured ? "primary" : "warning"}
              variant="outlined"
              label={configured ? `${percentUsed}% da dung` : "Chua cau hinh tong dung luong"}
            />
          </Stack>

          {configured ? (
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, percentUsed))}
              sx={{ height: 10, borderRadius: 999 }}
            />
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Da dung
                </Typography>
                <Typography variant="h5" fontWeight={800} color="warning.main">
                  {formatBytes(usedBytes)}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Con trong
                </Typography>
                <Typography variant="h5" fontWeight={800} color="success.main">
                  {remainingBytes == null ? "Chua biet" : formatBytes(remainingBytes)}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Tong
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {totalBytes == null ? "Chua cau hinh" : formatBytes(totalBytes)}
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Dang co {storage?.recordingsWithSourceOnR2 || 0} recording con giu du lieu nguon tren
            R2.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProgressCell({ row }) {
  const { displaySegment, totalSegments, uploadedSegments, segmentPercent, overallPercent } =
    getRowProgressSummary(row);
  const hasKnownBytes = Number(displaySegment?.totalSizeBytes || 0) > 0;
  const totalParts = Number(displaySegment?.totalParts || 0);
  const partText =
    totalParts > 0
      ? `${displaySegment?.completedPartCount || 0}/${totalParts} parts`
      : `${displaySegment?.completedPartCount || 0} parts`;

  let helperText = "Dang ghi, chua tao segment nao";
  if (displaySegment) {
    if (displaySegment.uploadStatus === "uploading_parts" && !hasKnownBytes) {
      helperText = "Dang cho part dau tien xong de tinh % chinh xac";
    } else if (hasKnownBytes) {
      helperText = `${segmentPercent}% - ${formatBytes(
        displaySegment.completedBytes || 0
      )} / ${formatBytes(displaySegment.totalSizeBytes || 0)} - ${partText}`;
    } else {
      helperText = `${formatSegmentUploadStatus(displaySegment.uploadStatus)} - ${partText}`;
    }
  } else if (totalSegments > 0) {
    helperText = "Chua co segment nao dang upload";
  }

  return (
    <Stack spacing={0.75} sx={{ width: "100%", py: 0.6 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" fontWeight={700}>
          {uploadedSegments}/{totalSegments} segments
        </Typography>
        <Chip
          size="small"
          color={row.status === "failed" ? "error" : "primary"}
          label={`${overallPercent}% tong the`}
          variant="outlined"
        />
        {displaySegment ? (
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            seg #{displaySegment.index} {formatSegmentUploadStatus(displaySegment.uploadStatus)}
          </Typography>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={overallPercent}
        color={row.status === "failed" ? "error" : "primary"}
        sx={{ height: 8, borderRadius: 999 }}
      />
      <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: "normal" }}>
        {helperText}
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

function RecordingDetailDialog({ row, open, onClose }) {
  const segments = row?.segmentSummary?.segments || [];
  const { totalSegments, uploadedSegments, overallPercent } = row
    ? getRowProgressSummary(row)
    : { totalSegments: 0, uploadedSegments: 0, overallPercent: 0 };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={800}>
            Chi tiet recording
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            {row?.participantsLabel || "Unknown match"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {row?.competitionLabel || "-"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
            <StatusChip status={row?.status} />
            <Chip size="small" variant="outlined" label={`Mode: ${row?.modeLabel || "-"}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`Segments: ${uploadedSegments}/${totalSegments}`}
            />
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Tien do: ${overallPercent}%`}
            />
            {row?.exportPipeline?.label ? (
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={`Export: ${row.exportPipeline.label}`}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={`Output: ${formatDuration(row?.durationSeconds)} / ${formatBytes(
                row?.sizeBytes
              )}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`R2 source: ${formatBytes(row?.r2SourceBytes)}`}
            />
            {row?.exportPipeline?.label ? (
              <Chip
                size="small"
                variant="outlined"
                color="info"
                label={`Export: ${row.exportPipeline.label}`}
              />
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {row?.playbackUrl && row?.status === "ready" ? (
              <Button
                size="small"
                color="info"
                variant="outlined"
                component={Link}
                href={row.playbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<PlayCircleOutlineIcon />}
              >
                Play
              </Button>
            ) : null}
            {row?.driveRawUrl ? (
              <Button
                size="small"
                color="success"
                variant="outlined"
                component={Link}
                href={row.driveRawUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<CloudDownloadIcon />}
              >
                Raw
              </Button>
            ) : null}
            {row?.drivePreviewUrl ? (
              <Button
                size="small"
                color="secondary"
                variant="outlined"
                component={Link}
                href={row.drivePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon />}
              >
                Preview
              </Button>
            ) : null}
          </Stack>

          {row?.exportPipeline?.label ? (
            <Alert severity="info">
              {row.exportPipeline.label}
              {row.exportPipeline.detail ? ` - ${row.exportPipeline.detail}` : ""}
            </Alert>
          ) : null}

          {segments.length === 0 ? (
            <Alert severity="info">Chua co segment nao duoc ghi vao DB.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Typography variant="h6" fontWeight={700}>
                Danh sach segment
              </Typography>
              {segments.map((segment) => {
                const percent =
                  segment.uploadStatus === "uploaded" ? 100 : Number(segment.percent || 0);
                const hasKnownBytes = Number(segment.totalSizeBytes || 0) > 0;
                const totalParts = Number(segment.totalParts || 0);
                const partLabel =
                  totalParts > 0
                    ? `${segment.completedPartCount || 0}/${totalParts} parts`
                    : `${segment.completedPartCount || 0} parts`;

                return (
                  <Card
                    key={`${row?.recordingId || "recording"}-segment-${segment.index}`}
                    variant="outlined"
                    sx={{ borderRadius: 2.5 }}
                  >
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Stack spacing={0.35}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              Segment #{segment.index}
                              {segment.isFinal ? " (final)" : ""}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              {formatSegmentUploadStatus(segment.uploadStatus)}
                            </Typography>
                          </Stack>

                          <Stack direction="row" spacing={0.75} flexWrap="wrap">
                            <Chip size="small" variant="outlined" label={`${percent}%`} />
                            <Chip size="small" variant="outlined" label={partLabel} />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${formatDuration(segment.durationSeconds)} / ${formatBytes(
                                segment.sizeBytes
                              )}`}
                            />
                          </Stack>
                        </Stack>

                        <LinearProgress
                          variant="determinate"
                          value={Math.max(0, Math.min(100, percent))}
                          color={segment.uploadStatus === "failed" ? "error" : "primary"}
                          sx={{ height: 8, borderRadius: 999 }}
                        />

                        <Grid container spacing={1.5}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Upload bytes
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {hasKnownBytes
                                ? `${formatBytes(segment.completedBytes || 0)} / ${formatBytes(
                                    segment.totalSizeBytes || 0
                                  )}`
                                : "Dang cho part dau tien"}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Bat dau upload
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.startedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Part gan nhat
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.lastPartUploadedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Uploaded at
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.uploadedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Object key
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ wordBreak: "break-all" }}
                            >
                              {segment.objectKey || "-"}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Dong</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function LiveRecordingMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetLiveRecordingMonitorQuery();
  const { data: workerHealthPoll } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: 10000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
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

  const rows = snapshot?.rows || [];
  const summary = snapshot?.summary || {};
  const meta = snapshot?.meta || {};
  const r2Storage = summary?.r2Storage || {};
  const workerHealth = workerHealthPoll || meta?.workerHealth || null;
  const exportingRows = rows.filter((row) => row.status === "exporting");

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
        row.exportPipeline?.label,
        row.exportPipeline?.detail,
        row.error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, search, statusFilter]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId]
  );

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
        field: "exportPipeline",
        headerName: "Export / Worker",
        minWidth: 250,
        sortable: false,
        renderCell: ({ row }) => <ExportStageCell row={row} />,
      },
      {
        field: "progress",
        headerName: "Upload Progress",
        flex: 1,
        minWidth: 260,
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
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              R2: {formatBytes(row.r2SourceBytes)}
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
                Realtime tracking for recording v2 upload, export, and playback pipeline
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Bam vao tung dong de xem chi tiet segment va link output.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
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
            Last event: <strong>{meta.lastEventReason || "bootstrap"}</strong> -{" "}
            {formatRelative(meta.lastEventAt)} - last publish {formatRelative(meta.lastPublishAt)}
          </Alert>

          {isError ? (
            <Alert severity="error">Failed to load recording monitor snapshot.</Alert>
          ) : null}

          {workerHealth && !workerHealth.alive && exportingRows.length > 0 ? (
            <Alert severity="warning">
              Worker export khong con heartbeat nhung van con {exportingRows.length} recording dang
              exporting.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Active pipeline"
                value={summary.active || 0}
                hint={`${summary.recording || 0} recording - ${
                  summary.uploading || 0
                } uploading - ${summary.exporting || 0} exporting`}
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

          <StorageOverviewCard storage={r2Storage} />

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
                    onRowClick={(params) => setSelectedRowId(params.row.id)}
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
                      "& .MuiDataGrid-row": {
                        cursor: "pointer",
                      },
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <RecordingDetailDialog
        row={selectedRow}
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRowId(null)}
      />
    </DashboardLayout>
  );
}
