/* eslint-disable react/prop-types */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingMonitorOverviewQuery,
  useGetLiveRecordingMonitorRowsQuery,
  useGetLiveRecordingWorkerHealthQuery,
  useLazyGetLiveRecordingMonitorRowQuery,
  useTrashLiveRecordingR2AssetsMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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

function canCleanR2Row(row) {
  if (!row?.recordingId) return false;

  const status = String(row?.status || "").trim().toLowerCase();
  if (["recording", "uploading", "exporting"].includes(status)) {
    return false;
  }

  if (Number(row?.r2SourceBytes) > 0) {
    return true;
  }

  if (Number(row?.segmentSummary?.totalSegments || 0) > 0) {
    return true;
  }

  return Boolean(String(row?.error || "").trim());
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || {
    color: "default",
    label: status || "Không rõ",
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
                  ? "Đo trực tiếp bucket recording targets trên R2 (cache ngắn)."
                  : "Đang fallback theo ước lượng DB vì chưa quét được R2."}
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
                  Đã dùng
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
                  Tổng
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {totalBytes == null ? "Chưa cấu hình" : formatBytes(totalBytes)}
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Đang có {storage?.recordingsWithSourceOnR2 || 0} recording còn giữ dữ liệu nguồn trên
            R2. {storage?.scannedAt ? `Quét lúc ${formatDateTime(storage.scannedAt)}.` : ""}
          </Typography>
          {scanError ? (
            <Alert severity="warning" sx={{ py: 0 }}>
              Không quét trực tiếp được R2: {scanError}
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
                Chi tiết theo từng target
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.68 }}>
                {measuredTargetCount}/{configuredTargetCount} target đã có số liệu quét.
              </Typography>
            </Stack>

            {targetBreakdown.length === 0 ? (
              <Alert severity="info" sx={{ py: 0 }}>
                Chưa có target nào trong `R2_RECORDINGS_TARGETS_JSON` hoặc fallback recording target.
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
                                label={targetMeasured ? "Đã quét R2" : "Chưa quét"}
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
                                  Đã dùng
                                </Typography>
                                <Typography variant="body1" fontWeight={800} color="warning.main">
                                  {targetUsedBytes == null ? "-" : formatBytes(targetUsedBytes)}
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  Còn trống
                                </Typography>
                                <Typography variant="body1" fontWeight={800} color="success.main">
                                  {targetRemainingBytes == null
                                    ? "-"
                                    : formatBytes(targetRemainingBytes)}
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                  Tổng
                                </Typography>
                                <Typography variant="body1" fontWeight={800}>
                                  {targetCapacityBytes == null
                                    ? "Chưa giới hạn"
                                    : formatBytes(targetCapacityBytes)}
                                </Typography>
                              </Grid>
                            </Grid>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Object: ${target?.objectCount ?? "-"}`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Nguồn: ${target?.recordingsWithSourceOnR2 ?? "-"}`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Đã dùng: ${formatPercent(targetPercentUsed)}`}
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

function ActionsCell({ row, onForceExport, forceExportingId, onCleanR2, cleaningR2Id }) {
  const canPlay = row.status === "ready" && Boolean(row.playbackUrl);
  const rawHref = row.rawStreamAvailable
    ? row.rawStreamUrl || row.driveRawUrl
    : row.driveRawUrl || null;
  const canForceExport = canForceRowToExport(row);
  const canCleanR2 = canCleanR2Row(row);
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
          {forcingThisRow ? "Đang chuyển..." : "Chuyển sang export"}
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
          Phát
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
          Tệp gốc
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
          Xem trước
        </Button>
      ) : null}
      {canCleanR2 ? (
        <Button
          size="small"
          color="error"
          variant="outlined"
          onClick={(event) => {
            event.stopPropagation();
            onCleanR2?.(row);
          }}
          disabled={cleaningR2Id === row.recordingId}
          startIcon={<DeleteOutlineIcon />}
          sx={{ minWidth: 0 }}
        >
          {cleaningR2Id === row.recordingId ? "Đang xóa..." : "Xóa R2"}
        </Button>
      ) : null}
    </Stack>
  );
}

function RecordingDetailDialog({
  row,
  open,
  onClose,
  loadingDetail = false,
  detailError = null,
}) {
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
            Chi tiết bản ghi
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
                Phát
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
                Tệp gốc
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
                Trạng thái raw
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
                Xem trước
              </Button>
            ) : null}
          </Stack>

          {row?.exportPipeline?.label ? (
            <Alert severity="info">
              {row.exportPipeline.label}
              {row.exportPipeline.detail ? ` - ${row.exportPipeline.detail}` : ""}
            </Alert>
          ) : null}

          {loadingDetail ? (
            <Alert severity="info">Đang tải danh sách segment chi tiết...</Alert>
          ) : null}

          {detailError ? (
            <Alert severity="warning">
              Không tải được chi tiết segment mới nhất. Đang hiển thị dữ liệu tóm tắt hiện có.
            </Alert>
          ) : null}

          {segments.length === 0 && loadingDetail ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Đang tải segment...
              </Typography>
            </Stack>
          ) : segments.length === 0 ? (
            <Alert severity="info">Chưa có đoạn cắt nào được lưu vào DB.</Alert>
          ) : (
            <Stack spacing={1.25}>
              <Typography variant="h6" fontWeight={700}>
                Danh sách segment
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
                              Bắt đầu upload
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.startedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Part gần nhất
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.lastPartUploadedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Thời điểm upload
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {formatDateTime(segment.uploadedAt)}
                            </Typography>
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Khóa object
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
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [forceExportingId, setForceExportingId] = useState(null);
  const [cleaningR2Id, setCleaningR2Id] = useState(null);
  const [actionError, setActionError] = useState("");
  const deferredSearch = useDeferredValue(search);
  const monitorPollingInterval = socketOn ? 0 : 15000;
  const realtimeTimerRef = useRef(null);
  const lastRealtimeRefetchAtRef = useRef(0);
  const [loadMonitorRowDetail, monitorRowDetailQuery] =
    useLazyGetLiveRecordingMonitorRowQuery();

  const overviewQueryArgs = useMemo(
    () => ({
      section: "all",
      status: statusFilter,
      q: deferredSearch.trim(),
      tournament: tournamentFilter || "",
    }),
    [deferredSearch, statusFilter, tournamentFilter]
  );

  const rowsQueryArgs = useMemo(
    () => ({
      section: "all",
      status: statusFilter,
      q: deferredSearch.trim(),
      tournament: tournamentFilter || "",
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    }),
    [deferredSearch, paginationModel.page, paginationModel.pageSize, statusFilter, tournamentFilter]
  );

  const {
    data: overviewData,
    error: overviewError,
    isLoading: isOverviewInitialLoading,
    isFetching: isOverviewFetching,
    refetch: refetchOverview,
  } = useGetLiveRecordingMonitorOverviewQuery(overviewQueryArgs, {
    pollingInterval: monitorPollingInterval,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const {
    data: rowsData,
    error: rowsError,
    isLoading: isRowsInitialLoading,
    isFetching: isRowsFetching,
    refetch: refetchRows,
  } = useGetLiveRecordingMonitorRowsQuery(rowsQueryArgs, {
    pollingInterval: monitorPollingInterval,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const rows = useMemo(() => {
    return Array.isArray(rowsData?.rows) ? rowsData.rows : [];
  }, [rowsData?.rows]);
  const summary = overviewData?.summary || {};
  const meta = overviewData?.meta || {};
  const count = Number(rowsData?.count || 0);
  const queryError = rowsError || overviewError;
  const isInitialLoading = isRowsInitialLoading || isOverviewInitialLoading;
  const isRefreshing =
    (isRowsFetching && !isRowsInitialLoading) ||
    (isOverviewFetching && !isOverviewInitialLoading);

  const [forceLiveRecordingExport] = useForceLiveRecordingExportMutation();
  const [trashLiveRecordingR2Assets] = useTrashLiveRecordingR2AssetsMutation();
  const { data: workerHealthPoll } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: 30000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const refresh = useCallback(async () => {
    await Promise.allSettled([refetchOverview(), refetchRows()]);
  }, [refetchOverview, refetchRows]);

  useEffect(() => {
    setPaginationModel((current) =>
      current.page === 0 ? current : { ...current, page: 0 }
    );
  }, [deferredSearch, statusFilter, tournamentFilter]);

  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(count / paginationModel.pageSize) - 1);
    if (paginationModel.page <= lastPage) return;
    setPaginationModel((current) => {
      const safeLastPage = Math.max(0, Math.ceil(count / current.pageSize) - 1);
      return current.page <= safeLastPage
        ? current
        : { ...current, page: safeLastPage };
    });
  }, [count, paginationModel.page, paginationModel.pageSize]);

  const scheduleRealtimeRefetch = useCallback(
    (delayMs = 200) => {
      const now = Date.now();
      const gapMs = Math.max(0, 1500 - (now - lastRealtimeRefetchAtRef.current));
      const waitMs = Math.max(delayMs, gapMs);
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeRefetchAtRef.current = Date.now();
        void refresh();
      }, waitMs);
    },
    [refresh]
  );

  useEffect(
    () => () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setSocketOn(true);
      try {
        socket.emit("recordings-v2:watch");
      } catch (_) {}
      scheduleRealtimeRefetch(100);
    };
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = () => scheduleRealtimeRefetch();

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
  }, [scheduleRealtimeRefetch, socket]);

  const r2Storage = summary?.r2Storage || {};
  const workerHealth = workerHealthPoll || meta?.workerHealth || null;

  const tournamentOptions = useMemo(() => {
    return Array.isArray(meta?.tournaments) ? meta.tournaments : [];
  }, [meta?.tournaments]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId]
  );
  const selectedRowDetail = useMemo(() => {
    const requestedRecordingId = String(monitorRowDetailQuery?.originalArgs || "").trim();
    const detailRow = monitorRowDetailQuery?.data?.row || null;
    if (!selectedRow?.recordingId || !detailRow) return null;
    return requestedRecordingId === String(selectedRow.recordingId) ? detailRow : null;
  }, [
    monitorRowDetailQuery?.data?.row,
    monitorRowDetailQuery?.originalArgs,
    selectedRow?.recordingId,
  ]);
  const selectedRowDetailError = useMemo(() => {
    const requestedRecordingId = String(monitorRowDetailQuery?.originalArgs || "").trim();
    if (!selectedRow?.recordingId) return null;
    return requestedRecordingId === String(selectedRow.recordingId)
      ? monitorRowDetailQuery?.error || null
      : null;
  }, [monitorRowDetailQuery?.error, monitorRowDetailQuery?.originalArgs, selectedRow?.recordingId]);
  const selectedRowForDialog = selectedRowDetail || selectedRow;
  const selectedRowDetailLoading = Boolean(
    selectedRow && !selectedRowDetail && monitorRowDetailQuery?.isFetching
  );

  useEffect(() => {
    if (!selectedRow?.recordingId) return;
    void loadMonitorRowDetail(selectedRow.recordingId, true);
  }, [loadMonitorRowDetail, selectedRow?.recordingId]);

  const handleForceExport = useCallback(
    async (row) => {
      if (!row?.recordingId || forceExportingId || !canForceRowToExport(row)) {
        return;
      }

      setActionError("");
      setForceExportingId(row.recordingId);
      try {
        await forceLiveRecordingExport(row.recordingId).unwrap();
        await refresh();
      } catch (error) {
        setActionError(
          error?.data?.message ||
            error?.error ||
            "Không thể chuyển recording sang trạng thái exporting."
        );
      } finally {
        setForceExportingId(null);
      }
    },
    [forceExportingId, forceLiveRecordingExport, refresh]
  );

  const handleCleanR2 = React.useCallback(
    async (row) => {
      if (!row?.recordingId || cleaningR2Id) return;
      if (!window.confirm("Bạn có chắc chắn muốn xoá toàn bộ dữ liệu R2 của trận này? Dữ liệu không thể phục hồi!")) return;

      setActionError("");
      setCleaningR2Id(row.recordingId);
      try {
        await trashLiveRecordingR2Assets(row.recordingId).unwrap();
        await refresh();
      } catch (error) {
        setActionError(
          error?.data?.message || error?.error || "Không thể dọn dẹp R2."
        );
      } finally {
        setCleaningR2Id(null);
      }
    },
    [cleaningR2Id, trashLiveRecordingR2Assets, refresh]
  );

  const columns = React.useMemo(
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
              Segment: {row.segmentSummary?.totalSegments || 0}
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
        headerName: "Liên kết / Thao tác",
        minWidth: 380,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <ActionsCell
            row={row}
            onForceExport={handleForceExport}
            forceExportingId={forceExportingId}
            onCleanR2={handleCleanR2}
            cleaningR2Id={cleaningR2Id}
          />
        ),
      },
    ],
    [forceExportingId, handleForceExport, cleaningR2Id, handleCleanR2]
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
                Giám sát bản ghi
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Theo dõi realtime cho pipeline upload, export và phát lại của recording v2
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Bấm vào từng dòng để xem chi tiết segment và link output.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "warning"}
                label={
                  socketOn
                    ? "Socket realtime OK"
                    : `Socket mất kết nối - HTTP poll ${Math.round(
                        monitorPollingInterval / 1000
                      )}s`
                }
              />
              <Chip
                color={meta.lastPublishMode === "reconcile" ? "warning" : "info"}
                label={
                  meta.lastPublishMode === "reconcile" ? "Đồng bộ fallback" : "Realtime trực tiếp"
                }
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => void refresh()}
                disabled={isInitialLoading || isRefreshing}
              >
                Làm mới
              </Button>
            </Stack>
          </Stack>

          <Alert severity="info">
            Sự kiện gần nhất: <strong>{meta.lastEventReason || "bootstrap"}</strong> -{" "}
            {formatRelative(meta.lastEventAt)} - publish cuối {formatRelative(meta.lastPublishAt)}
          </Alert>

          {queryError ? (
            <Alert severity="error">Không tải được dữ liệu monitor bản ghi.</Alert>
          ) : null}

          {actionError ? <Alert severity="error">{actionError}</Alert> : null}

          {workerHealth && !workerHealth.alive && Number(summary.exporting || 0) > 0 ? (
            <Alert severity="warning">
              Worker export không còn heartbeat nhưng vẫn còn {summary.exporting || 0} recording đang
              xuất.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Pipeline hoạt động"
                value={summary.active || 0}
                hint={`${summary.recording || 0} đang ghi - ${
                  summary.uploading || 0
                } đang tải - ${summary.exporting || 0} đang xuất`}
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Sẵn sàng"
                value={summary.ready || 0}
                hint={`${formatBytes(summary.totalSizeBytes || 0)} tổng đầu ra`}
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Thất bại"
                value={summary.failed || 0}
                hint={`${summary.pendingSegments || 0} segment đang chờ`}
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Phân đoạn"
                value={`${summary.uploadedSegments || 0}/${summary.totalSegments || 0}`}
                hint={`${formatDuration(summary.totalDurationSeconds || 0)} đã ghi trong DB`}
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
                    placeholder="Tìm bản ghi, trận đấu, giải đấu, lỗi..."
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
                    <MenuItem value="ALL">Tất cả trạng thái</MenuItem>
                    <MenuItem value="recording">Đang ghi</MenuItem>
                    <MenuItem value="uploading">Đang tải lên</MenuItem>
                    <MenuItem value="exporting">Đang xuất</MenuItem>
                    <MenuItem value="ready">Sẵn sàng</MenuItem>
                    <MenuItem value="failed">Thất bại</MenuItem>
                  </TextField>
                </Stack>

                <Divider />

                <Box sx={{ width: "100%" }}>
                  <DataGrid
                    autoHeight
                    rows={rows}
                    columns={columns}
                    loading={isInitialLoading || isRefreshing}
                    disableRowSelectionOnClick
                    onRowClick={(params) => setSelectedRowId(params.row.id)}
                    getRowHeight={() => 112}
                    slots={{ toolbar: GridToolbar }}
                    pagination
                    paginationMode="server"
                    rowCount={count}
                    page={paginationModel.page}
                    pageSize={paginationModel.pageSize}
                    rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                    onPageChange={(nextPage) => {
                      setPaginationModel((current) =>
                        current.page === nextPage
                          ? current
                          : { ...current, page: nextPage }
                      );
                    }}
                    onPageSizeChange={(nextPageSize) => {
                      setPaginationModel({
                        page: 0,
                        pageSize: nextPageSize,
                      });
                    }}
                    hideFooterSelectedRowCount
                    initialState={{
                      sorting: {
                        sortModel: [{ field: "updatedAt", sort: "desc" }],
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

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    Hiển thị {rows.length}/{count} bản ghi
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    Trang {Math.max(1, paginationModel.page + 1)}/
                    {Math.max(1, Math.ceil(count / paginationModel.pageSize) || 1)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <RecordingDetailDialog
        row={selectedRowForDialog}
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRowId(null)}
        loadingDetail={selectedRowDetailLoading}
        detailError={selectedRowDetailError}
      />
    </DashboardLayout>
  );
}
