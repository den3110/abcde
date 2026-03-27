/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingMonitorQuery,
  useGetLiveRecordingWorkerHealthQuery,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const STATUS_META = {
  recording: { color: "error", label: "Đang ghi" },
  uploading: { color: "warning", label: "Đang tải lên" },
  exporting: { color: "info", label: "Đang xuất" },
  ready: { color: "success", label: "Sẵn sàng" },
  failed: { color: "error", label: "Lỗi" },
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

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${Math.max(0, Math.min(100, Math.round(numeric)))}%`;
}

function formatSegmentUploadStatus(status) {
  switch (status) {
    case "presigned":
      return "Đã cấp URL";
    case "uploading_parts":
      return "Đang upload part";
    case "uploaded":
      return "Đã upload";
    case "failed":
      return "Thất bại";
    case "aborted":
      return "Đã hủy";
    default:
      return status || "Không rõ";
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

function canForceRowToExport(row) {
  const totalSegments = Number(row?.segmentSummary?.totalSegments || 0);
  const uploadedSegments = Number(row?.segmentSummary?.uploadedSegments || 0);
  return row?.status === "uploading" && totalSegments > 0 && uploadedSegments === totalSegments;
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
        {row?.status === "ready" ? "Đã xong" : row?.status === "failed" ? "Thất bại" : "-"}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35} sx={{ py: 0.6 }}>
      <Typography variant="body2" fontWeight={700}>
        {stageLabel}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
        {detail || "Đang đợi cập nhật từ worker"}
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
  const measuredFromR2 = storage?.source === "r2_scan";
  const scanError = String(storage?.scanError || "").trim();
  const targetBreakdown = Array.isArray(storage?.targetBreakdown)
    ? [...storage.targetBreakdown].sort((a, b) =>
        String(a?.label || a?.id || "").localeCompare(String(b?.label || b?.id || ""))
      )
    : [];
  const configuredTargetCount = Number(
    storage?.configuredTargetCount || targetBreakdown.length || 0
  );
  const measuredTargetCount = targetBreakdown.filter((target) => target?.measured !== false).length;

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
                {measuredFromR2
                  ? "Do truc tiep bucket recording targets tren R2 (cache ngan)."
                  : "Dang fallback theo DB estimate vi chua quet duoc R2."}
              </Typography>
            </Stack>

            <Chip
              size="small"
              color={configured ? "primary" : "warning"}
              variant="outlined"
              label={configured ? `${percentUsed}% đã dùng` : "Chưa cấu hình dung lượng"}
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
                  {remainingBytes == null ? "Chưa rõ" : formatBytes(remainingBytes)}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Tong
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {totalBytes == null ? "Chưa cấu hình" : formatBytes(totalBytes)}
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Dang co {storage?.recordingsWithSourceOnR2 || 0} recording con giu du lieu nguon tren
            R2. {storage?.scannedAt ? `Scan at ${formatDateTime(storage.scannedAt)}.` : ""}
          </Typography>
          {scanError ? (
            <Alert severity="warning" sx={{ py: 0 }}>
              Khong quet duoc R2 truc tiep: {scanError}
            </Alert>
          ) : null}

          <Divider />

          <Stack spacing={1}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Typography variant="subtitle1" fontWeight={800}>
                Per-target usage
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.68 }}>
                {measuredTargetCount}/{configuredTargetCount} target da co so lieu scan.
              </Typography>
            </Stack>

            {targetBreakdown.length === 0 ? (
              <Alert severity="info" sx={{ py: 0 }}>
                Chua co target nao trong R2_RECORDINGS_TARGETS_JSON hoac fallback recording target.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {targetBreakdown.map((target) => {
                  const targetUsedBytes =
                    target?.usedBytes == null ? null : Number(target.usedBytes || 0);
                  const targetRemainingBytes =
                    target?.remainingBytes == null ? null : Number(target.remainingBytes || 0);
                  const targetCapacityBytes =
                    target?.capacityBytes == null ? null : Number(target.capacityBytes || 0);
                  const targetPercentUsed =
                    target?.percentUsed == null ? null : Number(target.percentUsed || 0);
                  const targetMeasured = target?.measured !== false;

                  return (
                    <Grid item xs={12} md={6} xl={4} key={target?.id || target?.label}>
                      <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                        <CardContent>
                          <Stack spacing={1.2}>
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="space-between"
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                  {target?.label || target?.id || "Target"}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  {target?.id || "-"} - {target?.bucketName || "-"}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                color={targetMeasured ? "success" : "warning"}
                                variant="outlined"
                                label={targetMeasured ? "R2 scan" : "Unscanned"}
                              />
                            </Stack>

                            {targetCapacityBytes != null && targetMeasured ? (
                              <LinearProgress
                                variant="determinate"
                                value={Math.max(0, Math.min(100, targetPercentUsed || 0))}
                                sx={{ height: 8, borderRadius: 999 }}
                              />
                            ) : null}

                            <Grid container spacing={1.5}>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  Used
                                </Typography>
                                <Typography variant="body1" fontWeight={800} color="warning.main">
                                  {targetUsedBytes == null ? "-" : formatBytes(targetUsedBytes)}
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  Free
                                </Typography>
                                <Typography variant="body1" fontWeight={800} color="success.main">
                                  {targetRemainingBytes == null
                                    ? "-"
                                    : formatBytes(targetRemainingBytes)}
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  Total
                                </Typography>
                                <Typography variant="body1" fontWeight={800}>
                                  {targetCapacityBytes == null
                                    ? "No cap"
                                    : formatBytes(targetCapacityBytes)}
                                </Typography>
                              </Grid>
                            </Grid>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Objects: ${target?.objectCount ?? "-"}`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Sources: ${target?.recordingsWithSourceOnR2 ?? "-"}`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Used: ${formatPercent(targetPercentUsed)}`}
                              />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Stack>
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

  let helperText = "Đang ghi, chưa có đoạn cắt nào";
  if (displaySegment) {
    if (displaySegment.uploadStatus === "uploading_parts" && !hasKnownBytes) {
      helperText = "Đang đợi part đầu tiên";
    } else if (hasKnownBytes) {
      helperText = `${segmentPercent}% - ${formatBytes(
        displaySegment.completedBytes || 0
      )} / ${formatBytes(displaySegment.totalSizeBytes || 0)} - ${partText}`;
    } else {
      helperText = `${formatSegmentUploadStatus(displaySegment.uploadStatus)} - ${partText}`;
    }
  } else if (totalSegments > 0) {
    helperText = "Chưa có đoạn cắt tải lên";
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
          label={`Tổng ${overallPercent}%`}
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
        {row.participantsLabel || "Chưa rõ trận đấu"}
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

function ActionsCell({ row, onForceExport, forceExportingId }) {
  const canPlay = row.status === "ready" && Boolean(row.playbackUrl);
  const rawHref = row.rawStreamAvailable
    ? row.rawStreamUrl || row.driveRawUrl
    : row.driveRawUrl || null;
  const canForceExport = canForceRowToExport(row);
  const forcingThisRow = forceExportingId === row.recordingId;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.6 }} flexWrap="wrap">
      {row.status === "uploading" ? (
        <Button
          size="small"
          color="warning"
          variant={canForceExport ? "contained" : "outlined"}
          disabled={!canForceExport || forcingThisRow}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (canForceExport && onForceExport) {
              onForceExport(row);
            }
          }}
          sx={{ minWidth: 0 }}
        >
          {forcingThisRow ? "Dang chuyen..." : "Chuyen exporting"}
        </Button>
      ) : null}
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
      {rawHref ? (
        <Button
          size="small"
          color="success"
          variant="outlined"
          component={Link}
          href={rawHref}
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
  const rawHref = row?.rawStreamAvailable
    ? row?.rawStreamUrl || row?.driveRawUrl
    : row?.driveRawUrl || null;
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
            {row?.participantsLabel || "Chưa rõ trận đấu"}
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
              label={`Tiến độ: ${overallPercent}%`}
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
            {rawHref ? (
              <Button
                size="small"
                color="success"
                variant="outlined"
                component={Link}
                href={rawHref}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<CloudDownloadIcon />}
              >
                Raw
              </Button>
            ) : null}
            {row?.rawStatusUrl ? (
              <Button
                size="small"
                color="primary"
                variant="outlined"
                component={Link}
                href={row.rawStatusUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<SearchIcon />}
              >
                Raw status
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
            <Alert severity="info">Chưa có đoạn cắt nào được lưu vào DB.</Alert>
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
                                : "Đang đợi part đầu tiên"}
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
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function LiveRecordingMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tournamentFilter, setTournamentFilter] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [forceExportingId, setForceExportingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const monitorPollingInterval = socketOn ? 0 : 15000;

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetLiveRecordingMonitorQuery(
    undefined,
    {
      pollingInterval: monitorPollingInterval,
      skipPollingIfUnfocused: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );
  const [forceLiveRecordingExport] = useForceLiveRecordingExportMutation();
  const { data: workerHealthPoll } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: 30000,
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

  const tournamentOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const name = row.tournamentName;
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, { name, status: row.tournamentStatus || "", count: 0 });
      }
      map.get(name).count += 1;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (tournamentFilter && row.tournamentName !== tournamentFilter) return false;
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
  }, [rows, search, statusFilter, tournamentFilter]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId]
  );

  const handleForceExport = useCallback(
    async (row) => {
      if (!row?.recordingId || forceExportingId || !canForceRowToExport(row)) {
        return;
      }

      setActionError("");
      setForceExportingId(row.recordingId);
      try {
        await forceLiveRecordingExport(row.recordingId).unwrap();
        await refetch();
      } catch (error) {
        setActionError(
          error?.data?.message || error?.error || "Khong the chuyen recording sang exporting."
        );
      } finally {
        setForceExportingId(null);
      }
    },
    [forceExportingId, forceLiveRecordingExport, refetch]
  );

  const columns = useMemo(
    () => [
      {
        field: "status",
        headerName: "Trạng thái",
        minWidth: 130,
        renderCell: ({ row }) => <StatusChip status={row.status} />,
      },
      {
        field: "modeLabel",
        headerName: "Chế độ",
        minWidth: 170,
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
        field: "exportPipeline",
        headerName: "Xuất / Worker",
        minWidth: 250,
        sortable: false,
        renderCell: ({ row }) => <ExportStageCell row={row} />,
      },
      {
        field: "progress",
        headerName: "Tiến độ tải lên",
        flex: 1,
        minWidth: 260,
        sortable: false,
        renderCell: ({ row }) => <ProgressCell row={row} />,
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
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              R2: {formatBytes(row.r2SourceBytes)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "updatedAt",
        headerName: "Cập nhật",
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
        headerName: "Lỗi",
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
        headerName: "Links / Actions",
        minWidth: 380,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <ActionsCell
            row={row}
            onForceExport={handleForceExport}
            forceExportingId={forceExportingId}
          />
        ),
      },
    ],
    [forceExportingId, handleForceExport]
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
                color={socketOn ? "success" : "warning"}
                label={
                  socketOn
                    ? "Socket realtime OK"
                    : `Socket disconnected - HTTP poll ${Math.round(
                        monitorPollingInterval / 1000
                      )}s`
                }
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

          {actionError ? <Alert severity="error">{actionError}</Alert> : null}

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
                  <Autocomplete
                    value={tournamentFilter}
                    onChange={(_, newValue) => setTournamentFilter(newValue)}
                    options={tournamentOptions.map((t) => t.name)}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Tất cả giải đấu" />
                    )}
                    renderOption={(props, option) => {
                      const tourInfo = tournamentOptions.find((t) => t.name === option);
                      const statusColor =
                        tourInfo?.status === "ongoing"
                          ? "warning"
                          : tourInfo?.status === "finished"
                          ? "success"
                          : tourInfo?.status === "upcoming"
                          ? "info"
                          : "default";
                      const statusLabel =
                        tourInfo?.status === "ongoing"
                          ? "Đang diễn ra"
                          : tourInfo?.status === "finished"
                          ? "Đã kết thúc"
                          : tourInfo?.status === "upcoming"
                          ? "Sắp diễn ra"
                          : tourInfo?.status || "";
                      return (
                        <li {...props} key={option}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ width: "100%" }}
                          >
                            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                              {option}
                            </Typography>
                            {statusLabel ? (
                              <Chip
                                size="small"
                                label={statusLabel}
                                color={statusColor}
                                sx={{ fontWeight: 600, fontSize: 11 }}
                              />
                            ) : null}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={tourInfo?.count || 0}
                              sx={{ minWidth: 28, fontWeight: 700 }}
                            />
                          </Stack>
                        </li>
                      );
                    }}
                    sx={{ minWidth: 300 }}
                    clearOnEscape
                    disablePortal={false}
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
