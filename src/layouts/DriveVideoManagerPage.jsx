/* eslint-disable react/prop-types */
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
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
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ReplayIcon from "@mui/icons-material/Replay";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import useInfinitePagedQuery from "hooks/useInfinitePagedQuery";
import useInfiniteScrollSentinel from "hooks/useInfiniteScrollSentinel";
import {
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useLazyGetLiveRecordingDriveAssetQuery,
  useLazyGetLiveRecordingMonitorQuery,
  useLazyGetLiveRecordingMonitorRowQuery,
  useMoveLiveRecordingDriveAssetMutation,
  useQueueLiveRecordingAiCommentaryMutation,
  useRenameLiveRecordingDriveAssetMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
  useRetryLiveRecordingExportMutation,
  useTrashLiveRecordingDriveAssetMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const PAGE_SIZE = 0;

const STATUS_OPTIONS = [
  { value: "ready", label: "Ready trên Drive" },
  { value: "needs_action", label: "Cần xử lý" },
  { value: "all", label: "Tất cả" },
  { value: "failed", label: "Thất bại" },
  { value: "pending_export_window", label: "Chờ khung giờ" },
  { value: "exporting", label: "Đang export" },
  { value: "recording", label: "Đang ghi" },
  { value: "uploading", label: "Đang tải segment" },
];

const COMMENTARY_OPTIONS = [
  { value: "all", label: "BLV AI: Tất cả" },
  { value: "ready", label: "BLV AI: Sẵn sàng" },
  { value: "processing", label: "BLV AI: Đang chạy" },
  { value: "missing", label: "BLV AI: Chưa có" },
  { value: "failed", label: "BLV AI: Lỗi" },
];

const VIEW_TABS = [
  { value: "ready", label: "Video ready" },
  { value: "needs_action", label: "Cần xử lý" },
  { value: "ai_ready", label: "BLV AI ready" },
  { value: "all", label: "Tất cả" },
];

const STATUS_META = {
  ready: { color: "success", label: "Ready" },
  failed: { color: "error", label: "Thất bại" },
  pending_export_window: { color: "secondary", label: "Chờ khung giờ" },
  exporting: { color: "info", label: "Đang export" },
  uploading: { color: "info", label: "Đang tải lên" },
  recording: { color: "warning", label: "Đang ghi" },
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "-";
}

function formatRelative(value) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.fromNow() : "-";
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

async function copyTextToClipboard(value, successMessage = "Đã sao chép vào clipboard.") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    toast.info("Không có dữ liệu để sao chép.");
    return false;
  }

  try {
    await navigator.clipboard.writeText(normalized);
    toast.success(successMessage);
    return true;
  } catch (_) {
    toast.error("Không thể sao chép vào clipboard.");
    return false;
  }
}

function hasDriveLinks(row) {
  return Boolean(
    row?.playbackUrl ||
      row?.drivePreviewUrl ||
      row?.driveRawUrl ||
      row?.rawStreamAvailable ||
      row?.rawStreamUrl
  );
}

function getDriveAssetLabel(target) {
  return target === "ai" ? "video BLV AI" : "video gốc";
}

function getDriveAssetFileId(row, target) {
  if (target === "ai") {
    return String(row?.aiCommentary?.dubbedDriveFileId || "").trim();
  }
  return String(row?.driveFileId || "").trim();
}

function rowNeedsAction(row) {
  return (
    row?.status !== "ready" ||
    canRetryExport(row) ||
    canForceExport(row) ||
    (row?.status === "ready" && !hasDriveLinks(row))
  );
}

function canQueueAiCommentary(row, commentaryGlobalEnabled) {
  const status = String(row?.aiCommentary?.status || "idle").toLowerCase();
  return (
    commentaryGlobalEnabled &&
    row?.status === "ready" &&
    !["queued", "running"].includes(status)
  );
}

function canRerenderAiCommentary(row, commentaryGlobalEnabled) {
  return commentaryGlobalEnabled && row?.status === "ready";
}

function SummaryCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ borderRadius: 3, minWidth: 0, height: "100%" }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color}>
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

function InfoBox({ label, value, children }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, height: "100%" }}>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={0.45}>
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {label}
          </Typography>
          {children || (
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "normal" }}>
              {value || "-"}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatusChip({ row }) {
  const stage = String(row?.exportPipeline?.stage || "").trim();
  if (stage === "stale_no_job" || stage === "worker_offline") {
    return <Chip size="small" color="warning" label="Cần retry export" />;
  }
  const meta = STATUS_META[row?.status] || {
    color: "default",
    label: row?.status || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function CommentaryChip({ commentary }) {
  const status = String(commentary?.status || "idle").toLowerCase();
  const meta =
    status === "completed" || commentary?.ready
      ? { color: "success", label: "BLV AI sẵn sàng" }
      : status === "running"
      ? { color: "info", label: "BLV AI đang render" }
      : status === "queued"
      ? { color: "secondary", label: "BLV AI đang chờ" }
      : status === "failed"
      ? { color: "error", label: "BLV AI lỗi" }
      : { color: "default", label: "BLV AI chưa có" };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function MatchCell({ row }) {
  return (
    <Stack spacing={0.45} sx={{ py: 0.75 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" fontWeight={700}>
          {row.matchCode || row.matchId || "-"}
        </Typography>
        {row.courtLabel ? <Chip size="small" variant="outlined" label={row.courtLabel} /> : null}
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
        {row.participantsLabel || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
        {row.competitionLabel || "-"}
      </Typography>
    </Stack>
  );
}

function OutputCell({ row }) {
  return (
    <Stack spacing={0.4} sx={{ py: 0.75 }}>
      <Typography variant="body2" fontWeight={700}>
        {formatDuration(row.durationSeconds)}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72 }}>
        {formatBytes(row.sizeBytes)}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72 }}>
        FileId: {row.driveFileId || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.62 }}>
        Updated: {formatDateTime(row.updatedAt)}
      </Typography>
    </Stack>
  );
}

function DriveLinksCell({ row }) {
  const canPlay =
    Boolean(row.playbackUrl) && (row.status === "ready" || row.temporaryPlaybackReady);
  const rawHref = row.rawStreamAvailable
    ? row.rawStreamUrl || row.driveRawUrl
    : row.driveRawUrl || null;
  const stop = (event) => event.stopPropagation();

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ py: 0.75 }}>
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
          onClick={stop}
        >
          Playback
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
          onClick={stop}
        >
          Tệp gốc
        </Button>
      ) : null}
      {row.drivePreviewUrl ? (
        <Button
          size="small"
          variant="outlined"
          component={Link}
          href={row.drivePreviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
          onClick={stop}
        >
          Preview
        </Button>
      ) : null}
      {!canPlay && !rawHref && !row.drivePreviewUrl ? (
        <Typography variant="caption" sx={{ opacity: 0.55 }}>
          Chưa có link video
        </Typography>
      ) : null}
    </Stack>
  );
}

function DriveAssetActionDialog({
  open,
  row,
  target,
  mode,
  assetQuery,
  draftName,
  draftFolderId,
  submitting,
  onChangeName,
  onChangeFolderId,
  onClose,
  onSubmit,
}) {
  if (!open || !row) return null;

  const assetLabel = getDriveAssetLabel(target);
  const title =
    mode === "rename"
      ? `Đổi tên ${assetLabel}`
      : mode === "move"
      ? `Chuyển folder ${assetLabel}`
      : `Đưa ${assetLabel} vào thùng rác`;
  const file = assetQuery?.data?.file || null;
  const fileId = getDriveAssetFileId(row, target);
  const errorMessage =
    assetQuery?.error?.data?.message || assetQuery?.error?.error || assetQuery?.error?.message || "";

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Alert severity={mode === "trash" ? "warning" : "info"}>
            {mode === "rename"
              ? "Tên file sẽ được đổi trực tiếp trên Google Drive."
              : mode === "move"
              ? "Nhập folder ID đích. Nếu để trống, backend sẽ dùng folder Drive recording mặc định."
              : "Thao tác này sẽ đưa file vào Google Drive Trash và đồng bộ lại DB recording."}
          </Alert>
          <InfoBox label="Match" value={row.matchCode || row.matchId || "-"} />
          <InfoBox label="Asset" value={assetLabel} />
          <InfoBox label="Drive fileId" value={fileId || "-"} />
          <InfoBox label="Tên hiện tại" value={file?.name || "-"} />
          <InfoBox
            label="Folder hiện tại"
            value={Array.isArray(file?.parents) && file.parents.length ? file.parents.join(", ") : "-"}
          />

          {assetQuery?.isFetching ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Đang tải metadata Drive...
              </Typography>
            </Stack>
          ) : null}

          {errorMessage ? <Alert severity="warning">{errorMessage}</Alert> : null}

          {mode === "rename" ? (
            <TextField
              autoFocus
              fullWidth
              label="Tên file mới"
              value={draftName}
              onChange={(event) => onChangeName(event.target.value)}
              placeholder="Nhập tên file mới..."
              disabled={submitting}
            />
          ) : null}

          {mode === "move" ? (
            <TextField
              autoFocus
              fullWidth
              label="Folder ID đích"
              value={draftFolderId}
              onChange={(event) => onChangeFolderId(event.target.value)}
              placeholder="Folder ID mới, để trống để dùng folder mặc định"
              disabled={submitting}
            />
          ) : null}

          {mode === "trash" ? (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Sau khi trash, {assetLabel} sẽ không còn được xem là sẵn sàng trong hệ thống.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button
          onClick={onSubmit}
          color={mode === "trash" ? "error" : "primary"}
          variant="contained"
          disabled={
            submitting ||
            !fileId ||
            (mode === "rename" && !String(draftName || "").trim())
          }
          startIcon={
            submitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : mode === "rename" ? (
              <DriveFileRenameOutlineIcon />
            ) : mode === "move" ? (
              <DriveFileMoveIcon />
            ) : (
              <DeleteOutlineIcon />
            )
          }
        >
          {submitting
            ? "Đang xử lý..."
            : mode === "rename"
            ? "Lưu tên mới"
            : mode === "move"
            ? "Chuyển folder"
            : "Đưa vào thùng rác"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RecordingDetailDialog({
  row,
  open,
  onClose,
  onCopyFileId,
  onOpenDriveAction,
  driveActionBusy,
  loadingDetail = false,
  detailError = null,
}) {
  if (!row) return null;

  const segments = Array.isArray(row?.segmentSummary?.segments) ? row.segmentSummary.segments : [];
  const rawHref = row?.rawStreamAvailable
    ? row?.rawStreamUrl || row?.driveRawUrl
    : row?.driveRawUrl || null;
  const ai = row?.aiCommentary || {};
  const missingDriveLinks =
    row.status === "ready" && !rawHref && !row.drivePreviewUrl && !row.playbackUrl;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={800}>
            Chi tiết video Drive
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.82 }}>
            {row.matchCode || row.matchId || "-"}
            {row.participantsLabel ? ` • ${row.participantsLabel}` : ""}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            {row.competitionLabel || "-"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
            <StatusChip row={row} />
            <CommentaryChip commentary={ai} />
            <Chip size="small" variant="outlined" label={`Mode: ${row.modeLabel || "-"}`} />
            <Chip size="small" variant="outlined" label={`Created: ${formatDateTime(row.createdAt)}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`Finalized: ${formatDateTime(row.finalizedAt)}`}
            />
            <Chip size="small" variant="outlined" label={`Ready: ${formatDateTime(row.readyAt)}`} />
            {row.scheduledExportAt ? (
              <Chip
                size="small"
                color="secondary"
                variant="outlined"
                label={`Scheduled: ${formatDateTime(row.scheduledExportAt)}`}
              />
            ) : null}
          </Stack>

          {missingDriveLinks ? (
            <Alert severity="warning">
              Recording đã ready trong DB nhưng chưa có đầy đủ link Drive/Playback.
            </Alert>
          ) : null}

          {row.error ? <Alert severity="error">{row.error}</Alert> : null}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {row.playbackUrl ? (
              <Button
                size="small"
                variant="outlined"
                color="info"
                component={Link}
                href={row.playbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<PlayCircleOutlineIcon />}
              >
                Playback
              </Button>
            ) : null}
            {rawHref ? (
              <Button
                size="small"
                variant="outlined"
                color="success"
                component={Link}
                href={rawHref}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<CloudDownloadIcon />}
              >
                Tệp gốc
              </Button>
            ) : null}
            {row.drivePreviewUrl ? (
              <Button
                size="small"
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
            {row.rawStatusUrl ? (
              <Button
                size="small"
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
            {row.driveFileId ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={() => onCopyFileId(row.driveFileId)}
              >
                Copy fileId
              </Button>
            ) : null}
            {row.driveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={driveActionBusy}
                startIcon={<DriveFileRenameOutlineIcon />}
                onClick={() => onOpenDriveAction(row, "source", "rename")}
              >
                Đổi tên gốc
              </Button>
            ) : null}
            {row.driveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={driveActionBusy}
                startIcon={<DriveFileMoveIcon />}
                onClick={() => onOpenDriveAction(row, "source", "move")}
              >
                Chuyển folder gốc
              </Button>
            ) : null}
            {row.driveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={driveActionBusy}
                startIcon={<DeleteOutlineIcon />}
                onClick={() => onOpenDriveAction(row, "source", "trash")}
              >
                Thùng rác gốc
              </Button>
            ) : null}
            {ai?.ready && ai?.dubbedPlaybackUrl ? (
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                component={Link}
                href={ai.dubbedPlaybackUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<PlayCircleOutlineIcon />}
              >
                Mở BLV AI
              </Button>
            ) : null}
            {ai?.dubbedDriveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={driveActionBusy}
                startIcon={<DriveFileRenameOutlineIcon />}
                onClick={() => onOpenDriveAction(row, "ai", "rename")}
              >
                Đổi tên AI
              </Button>
            ) : null}
            {ai?.dubbedDriveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={driveActionBusy}
                startIcon={<DriveFileMoveIcon />}
                onClick={() => onOpenDriveAction(row, "ai", "move")}
              >
                Chuyển folder AI
              </Button>
            ) : null}
            {ai?.dubbedDriveFileId ? (
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={driveActionBusy}
                startIcon={<DeleteOutlineIcon />}
                onClick={() => onOpenDriveAction(row, "ai", "trash")}
              >
                Thùng rác AI
              </Button>
            ) : null}
          </Stack>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Output"
                value={formatDuration(row.durationSeconds)}
                hint={formatBytes(row.sizeBytes)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Segments"
                value={row.segmentSummary?.totalSegments || 0}
                hint={`${row.segmentSummary?.uploadedSegments || 0} đã upload`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Export attempts"
                value={row.exportAttempts || 0}
                hint={`Cập nhật ${formatRelative(row.updatedAt)}`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Drive auth"
                value={row.driveAuthMode || "-"}
                hint={row.driveFileId || "Chưa có fileId"}
              />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6" fontWeight={700}>
            Metadata
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <InfoBox label="Recording ID" value={row.recordingId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Match ID" value={row.matchId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Drive fileId" value={row.driveFileId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Nguồn export" value={row.source?.label || row.source?.type} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Source videoId" value={row.source?.videoId} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Source pageId" value={row.source?.pageId} />
            </Grid>
            <Grid item xs={12} md={6}>
              <InfoBox
                label="Export pipeline"
                value={
                  [row.exportPipeline?.label || row.exportPipeline?.stage, row.exportPipeline?.detail]
                    .filter(Boolean)
                    .join(" • ") || "-"
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <InfoBox
                label="R2 target"
                value={[row.r2TargetId, row.r2BucketName].filter(Boolean).join(" • ")}
              />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6" fontWeight={700}>
            BLV AI
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <InfoBox label="Trạng thái" value={ai.status} />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox
                label="Ngôn ngữ / Voice"
                value={[ai.language, ai.voicePreset].filter(Boolean).join(" • ")}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <InfoBox label="Rendered" value={formatDateTime(ai.renderedAt)} />
            </Grid>
            <Grid item xs={12} md={6}>
              <InfoBox
                label="Job ID / Fingerprint"
                value={[ai.latestJobId, ai.sourceFingerprint].filter(Boolean).join(" • ")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <InfoBox label="Dubbed drive fileId" value={ai.dubbedDriveFileId} />
            </Grid>
            {ai.error ? (
              <Grid item xs={12}>
                <Alert severity="error">{ai.error}</Alert>
              </Grid>
            ) : null}
          </Grid>

          <Divider />

          <Typography variant="h6" fontWeight={700}>
            Danh sách segment
          </Typography>

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
            <Alert severity="info">Chưa có segment nào trong DB.</Alert>
          ) : (
            <Stack spacing={1.25}>
              {segments.map((segment) => (
                <Card key={`${row.id}-segment-${segment.index}`} variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent>
                    <Stack spacing={0.9}>
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
                        <Chip size="small" variant="outlined" label={segment.uploadStatus || "unknown"} />
                      </Stack>

                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {formatBytes(segment.sizeBytes)} • {formatDuration(segment.durationSeconds)} •{" "}
                        {segment.completedPartCount || 0}/{segment.totalParts || 0} parts
                      </Typography>

                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.max(0, Math.min(100, Number(segment.percent) || 0))}
                          sx={{ height: 8, borderRadius: 999 }}
                        />
                        <Typography variant="caption" sx={{ opacity: 0.68 }}>
                          {Math.max(0, Math.min(100, Number(segment.percent) || 0))}% • target{" "}
                          {[segment.storageTargetId, segment.bucketName].filter(Boolean).join(" • ") || "-"}
                        </Typography>
                      </Box>

                      <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
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

function canRetryExport(row) {
  const stage = String(row?.exportPipeline?.stage || "").toLowerCase();
  const staleReason = String(row?.exportPipeline?.staleReason || "").toLowerCase();
  return (
    row?.status === "failed" ||
    stage === "stale_no_job" ||
    staleReason === "stale_no_job" ||
    staleReason === "worker_offline"
  );
}

function canForceExport(row) {
  return row?.status === "pending_export_window";
}

export default function DriveVideoManagerPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("ready");
  const [statusFilter, setStatusFilter] = useState("ready");
  const [commentaryFilter, setCommentaryFilter] = useState("all");
  const [selectionModel, setSelectionModel] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [retryingRecordingId, setRetryingRecordingId] = useState(null);
  const [forcingRecordingId, setForcingRecordingId] = useState(null);
  const [queueingCommentaryId, setQueueingCommentaryId] = useState(null);
  const [rerenderingCommentaryId, setRerenderingCommentaryId] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [driveActionDialog, setDriveActionDialog] = useState({
    open: false,
    rowId: null,
    target: "source",
    mode: "rename",
  });
  const [driveActionName, setDriveActionName] = useState("");
  const [driveActionFolderId, setDriveActionFolderId] = useState("");
  const [driveActionSubmitting, setDriveActionSubmitting] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const realtimeTimerRef = useRef(null);
  const lastRealtimeRefetchAtRef = useRef(0);
  const [triggerMonitorQuery] = useLazyGetLiveRecordingMonitorQuery();

  const queryArgs = useMemo(
    () => ({
      section: "all",
      status: statusFilter,
      commentary: commentaryFilter,
      view: viewMode,
      q: deferredSearch.trim(),
    }),
    [commentaryFilter, deferredSearch, statusFilter, viewMode]
  );

  const {
    rows,
    summary,
    count,
    error: queryError,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refresh,
  } = useInfinitePagedQuery({
    trigger: triggerMonitorQuery,
    baseArgs: queryArgs,
    pageSize: PAGE_SIZE,
    getRowId: (row) => row?.id,
    pollingInterval: socketOn ? 0 : 15000,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    enabled: true,
    hasMore,
    loading: isInitialLoading || isLoadingMore || isRefreshing,
    onLoadMore: loadMore,
  });
  const {
    data: commentaryMonitor,
    isFetching: commentaryFetching,
    refetch: refetchCommentaryMonitor,
  } = useGetLiveRecordingAiCommentaryMonitorQuery(undefined, {
    pollingInterval: 15000,
    refetchOnMountOrArgChange: true,
  });

  const [retryExport] = useRetryLiveRecordingExportMutation();
  const [forceExport] = useForceLiveRecordingExportMutation();
  const [queueAiCommentary] = useQueueLiveRecordingAiCommentaryMutation();
  const [rerenderAiCommentary] = useRerenderLiveRecordingAiCommentaryMutation();
  const [loadDriveAsset, driveAssetQuery] = useLazyGetLiveRecordingDriveAssetQuery();
  const [loadMonitorRowDetail, monitorRowDetailQuery] =
    useLazyGetLiveRecordingMonitorRowQuery();
  const [renameDriveAsset] = useRenameLiveRecordingDriveAssetMutation();
  const [moveDriveAsset] = useMoveLiveRecordingDriveAssetMutation();
  const [trashDriveAsset] = useTrashLiveRecordingDriveAssetMutation();
  const commentaryGlobalEnabled = Boolean(commentaryMonitor?.settings?.enabled);
  const commentaryAutoEnabled = Boolean(commentaryMonitor?.settings?.autoGenerateAfterDriveUpload);

  useEffect(() => {
    setSelectionModel((previous) =>
      previous.filter((id) => rows.some((row) => String(row.id) === String(id)))
    );
  }, [rows]);

  useEffect(() => {
    setSelectionModel([]);
  }, [commentaryFilter, deferredSearch, statusFilter, viewMode]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectionModel.includes(row.id)),
    [rows, selectionModel]
  );

  const selectedRetryRows = useMemo(
    () => selectedRows.filter((row) => canRetryExport(row)),
    [selectedRows]
  );
  const selectedForceRows = useMemo(
    () => selectedRows.filter((row) => canForceExport(row)),
    [selectedRows]
  );
  const selectedQueueAiRows = useMemo(
    () => selectedRows.filter((row) => canQueueAiCommentary(row, commentaryGlobalEnabled)),
    [commentaryGlobalEnabled, selectedRows]
  );
  const selectedRerenderAiRows = useMemo(
    () => selectedRows.filter((row) => canRerenderAiCommentary(row, commentaryGlobalEnabled)),
    [commentaryGlobalEnabled, selectedRows]
  );
  const selectedFileIds = useMemo(
    () =>
      [...new Set(selectedRows.map((row) => String(row.driveFileId || "").trim()).filter(Boolean))].join(
        "\n"
      ),
    [selectedRows]
  );

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
  const driveActionRow = useMemo(
    () => rows.find((row) => row.id === driveActionDialog.rowId) || null,
    [driveActionDialog.rowId, rows]
  );
  const activeDriveAssetQuery = useMemo(() => {
    const queryArgs = driveAssetQuery?.originalArgs || {};
    if (!driveActionDialog.open) {
      return {
        data: null,
        error: null,
        isFetching: false,
      };
    }

    const sameRow =
      String(queryArgs.recordingId || "") === String(driveActionRow?.recordingId || "");
    const sameTarget =
      String(queryArgs.target || "source") === String(driveActionDialog.target || "source");

    return {
      data: sameRow && sameTarget ? driveAssetQuery?.data || null : null,
      error: sameRow && sameTarget ? driveAssetQuery?.error || null : null,
      isFetching: Boolean(driveAssetQuery?.isFetching && sameRow && sameTarget),
    };
  }, [
    driveActionDialog.open,
    driveActionDialog.target,
    driveActionRow?.recordingId,
    driveAssetQuery?.data,
    driveAssetQuery?.error,
    driveAssetQuery?.isFetching,
    driveAssetQuery?.originalArgs,
  ]);

  useEffect(() => {
    if (!driveActionDialog.open) return;
    const file = activeDriveAssetQuery?.data?.file || null;
    if (!file) return;

    if (driveActionDialog.mode === "rename") {
      setDriveActionName(file?.name || "");
    } else if (driveActionDialog.mode === "move") {
      setDriveActionFolderId(file?.parentId || "");
    }
  }, [activeDriveAssetQuery?.data, driveActionDialog.mode, driveActionDialog.open]);

  useEffect(() => {
    if (!selectedRow?.recordingId) return;
    void loadMonitorRowDetail(selectedRow.recordingId, true);
  }, [loadMonitorRowDetail, selectedRow?.recordingId]);

  const refreshAll = useCallback(() => {
    refresh();
    refetchCommentaryMonitor();
  }, [refresh, refetchCommentaryMonitor]);

  const scheduleRealtimeRefetch = useCallback(
    (delayMs = 200) => {
      const now = Date.now();
      const gapMs = Math.max(0, 1500 - (now - lastRealtimeRefetchAtRef.current));
      const waitMs = Math.max(delayMs, gapMs);
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeRefetchAtRef.current = Date.now();
        refreshAll();
      }, waitMs);
    },
    [refreshAll]
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

    setSocketOn(Boolean(socket.connected));
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("recordings-v2:update", handleUpdate);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      try {
        socket.emit("recordings-v2:unwatch");
      } catch (_) {}
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("recordings-v2:update", handleUpdate);
    };
  }, [scheduleRealtimeRefetch, socket]);

  const busy = Boolean(
    retryingRecordingId ||
      forcingRecordingId ||
      queueingCommentaryId ||
      rerenderingCommentaryId ||
      driveActionSubmitting ||
      bulkAction
  );

  const runBulkAction = useCallback(
    async ({ rows: targetRows, label, runner }) => {
      if (!targetRows.length) {
        toast.info(`Không có row hợp lệ cho "${label}".`);
        return;
      }

      setBulkAction({ label, total: targetRows.length, done: 0 });
      let successCount = 0;
      let errorCount = 0;
      let firstErrorMessage = "";

      for (let index = 0; index < targetRows.length; index += 1) {
        try {
          await runner(targetRows[index], index);
          successCount += 1;
        } catch (apiError) {
          errorCount += 1;
          if (!firstErrorMessage) {
            firstErrorMessage =
              apiError?.data?.message || apiError?.error || apiError?.message || "Unknown error";
          }
        } finally {
          setBulkAction({ label, total: targetRows.length, done: index + 1 });
        }
      }

      setBulkAction(null);
      refreshAll();

      if (successCount > 0) {
        toast.success(`${label}: ${successCount}/${targetRows.length} thành công.`);
      }
      if (errorCount > 0) {
        toast.warn(
          `${label}: ${errorCount}/${targetRows.length} lỗi.${firstErrorMessage ? ` ${firstErrorMessage}` : ""}`
        );
      }
    },
    [refreshAll]
  );

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      toast.success("Đã đưa video vào hàng đợi retry export.");
      refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể retry export.");
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExport = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      toast.success("Đã force export ngay.");
      refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể force export.");
    } finally {
      setForcingRecordingId(null);
    }
  };

  const handleQueueCommentary = async (recordingId, rerender = false) => {
    try {
      if (rerender) {
        setRerenderingCommentaryId(recordingId);
        await rerenderAiCommentary(recordingId).unwrap();
        toast.success("Đã đưa job render lại BLV AI vào hàng đợi.");
      } else {
        setQueueingCommentaryId(recordingId);
        await queueAiCommentary(recordingId).unwrap();
        toast.success("Đã đưa job BLV AI vào hàng đợi.");
      }
      refreshAll();
    } catch (apiError) {
      toast.error(
        apiError?.data?.message ||
          apiError?.error ||
          (rerender ? "Không thể render lại BLV AI." : "Không thể xếp hàng BLV AI.")
      );
    } finally {
      setQueueingCommentaryId(null);
      setRerenderingCommentaryId(null);
    }
  };

  const closeDriveActionDialog = useCallback(() => {
    setDriveActionDialog({
      open: false,
      rowId: null,
      target: "source",
      mode: "rename",
    });
    setDriveActionName("");
    setDriveActionFolderId("");
  }, []);

  const openDriveActionDialog = useCallback(
    (row, target, mode) => {
      const fileId = getDriveAssetFileId(row, target);
      if (!fileId) {
        toast.info(`Không có ${getDriveAssetLabel(target)} để thao tác.`);
        return;
      }

      setDriveActionDialog({
        open: true,
        rowId: row.id,
        target,
        mode,
      });
      setDriveActionName("");
      setDriveActionFolderId("");

      loadDriveAsset({
        recordingId: row.recordingId,
        target,
      })
        .unwrap()
        .catch((apiError) => {
          toast.warn(
            apiError?.data?.message ||
              apiError?.error ||
              `Không tải được metadata cho ${getDriveAssetLabel(target)}.`
          );
        });
    },
    [loadDriveAsset]
  );

  const handleSubmitDriveAction = useCallback(async () => {
    if (!driveActionRow) return;

    try {
      setDriveActionSubmitting(true);
      const payload = {
        recordingId: driveActionRow.recordingId,
        target: driveActionDialog.target,
      };
      const assetLabel = getDriveAssetLabel(driveActionDialog.target);

      if (driveActionDialog.mode === "rename") {
        await renameDriveAsset({
          ...payload,
          name: String(driveActionName || "").trim(),
        }).unwrap();
        toast.success(`Đã đổi tên ${assetLabel}.`);
      } else if (driveActionDialog.mode === "move") {
        await moveDriveAsset({
          ...payload,
          folderId: String(driveActionFolderId || "").trim(),
        }).unwrap();
        toast.success(`Đã chuyển folder cho ${assetLabel}.`);
      } else {
        await trashDriveAsset(payload).unwrap();
        toast.success(`Đã đưa ${assetLabel} vào thùng rác.`);
      }

      closeDriveActionDialog();
      refreshAll();
    } catch (apiError) {
      toast.error(
        apiError?.data?.message ||
          apiError?.error ||
          `Không thể xử lý ${getDriveAssetLabel(driveActionDialog.target)}.`
      );
    } finally {
      setDriveActionSubmitting(false);
    }
  }, [
    closeDriveActionDialog,
    driveActionDialog.mode,
    driveActionDialog.target,
    driveActionFolderId,
    driveActionName,
    driveActionRow,
    moveDriveAsset,
    refreshAll,
    renameDriveAsset,
    trashDriveAsset,
  ]);

  const handlePresetChange = useCallback((_event, nextValue) => {
    setViewMode(nextValue);
    if (nextValue === "ready") {
      setStatusFilter("ready");
      setCommentaryFilter("all");
      return;
    }
    if (nextValue === "needs_action") {
      setStatusFilter("needs_action");
      setCommentaryFilter("all");
      return;
    }
    if (nextValue === "ai_ready") {
      setStatusFilter("all");
      setCommentaryFilter("ready");
      return;
    }
    setStatusFilter("all");
    setCommentaryFilter("all");
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "status",
        headerName: "Trạng thái",
        minWidth: 150,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.55} sx={{ py: 0.75 }}>
            <StatusChip row={row} />
            <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
              {row.exportPipeline?.label || row.exportPipeline?.detail || row.status}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "match",
        headerName: "Trận đấu",
        minWidth: 320,
        flex: 1.15,
        sortable: false,
        renderCell: ({ row }) => <MatchCell row={row} />,
      },
      {
        field: "output",
        headerName: "Video",
        minWidth: 200,
        sortable: false,
        renderCell: ({ row }) => <OutputCell row={row} />,
      },
      {
        field: "driveLinks",
        headerName: "Drive / Playback",
        minWidth: 320,
        flex: 1,
        sortable: false,
        renderCell: ({ row }) => <DriveLinksCell row={row} />,
      },
      {
        field: "commentary",
        headerName: "BLV AI",
        minWidth: 300,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.55} sx={{ py: 0.75 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <CommentaryChip commentary={row.aiCommentary} />
              {row.aiCommentary?.ready && row.aiCommentary?.dubbedPlaybackUrl ? (
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  href={row.aiCommentary.dubbedPlaybackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<PlayCircleOutlineIcon />}
                  onClick={(event) => event.stopPropagation()}
                >
                  Mở AI
                </Button>
              ) : null}
            </Stack>
            <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
              {!commentaryGlobalEnabled
                ? "Global AI đang tắt."
                : row.aiCommentary?.error
                ? row.aiCommentary.error
                : row.aiCommentary?.renderedAt
                ? `Xong ${formatRelative(row.aiCommentary.renderedAt)}`
                : commentaryAutoEnabled
                ? "Auto sẽ chạy sau khi video lên Drive."
                : "Auto đang tắt, có thể chạy tay."}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "actions",
        headerName: "Tác vụ",
        minWidth: 460,
        flex: 1.35,
        sortable: false,
        renderCell: ({ row }) => {
          const canQueueAi = canQueueAiCommentary(row, commentaryGlobalEnabled);
          const canRerenderAi = canRerenderAiCommentary(row, commentaryGlobalEnabled);
          const stop = (event) => event.stopPropagation();

          return (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ py: 0.75 }}>
              {canRetryExport(row) ? (
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  disabled={busy}
                  onClick={(event) => {
                    stop(event);
                    handleRetryExport(row.recordingId);
                  }}
                  startIcon={
                    retryingRecordingId === row.recordingId ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <ReplayIcon />
                    )
                  }
                >
                  {retryingRecordingId === row.recordingId ? "Đang retry..." : "Retry export"}
                </Button>
              ) : null}
              {canForceExport(row) ? (
                <Button
                  size="small"
                  color="secondary"
                  variant="outlined"
                  disabled={busy}
                  onClick={(event) => {
                    stop(event);
                    handleForceExport(row.recordingId);
                  }}
                  startIcon={
                    forcingRecordingId === row.recordingId ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <RocketLaunchIcon />
                    )
                  }
                >
                  {forcingRecordingId === row.recordingId ? "Đang xuất..." : "Xuất ngay"}
                </Button>
              ) : null}
              <Button
                size="small"
                variant="outlined"
                disabled={!canQueueAi || busy}
                onClick={(event) => {
                  stop(event);
                  handleQueueCommentary(row.recordingId, false);
                }}
                startIcon={
                  queueingCommentaryId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RecordVoiceOverIcon />
                  )
                }
              >
                {queueingCommentaryId === row.recordingId ? "Đang xếp..." : "Lồng tiếng AI"}
              </Button>
              <Button
                size="small"
                color="secondary"
                variant="outlined"
                disabled={!canRerenderAi || busy}
                onClick={(event) => {
                  stop(event);
                  handleQueueCommentary(row.recordingId, true);
                }}
                startIcon={
                  rerenderingCommentaryId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <AutoAwesomeIcon />
                  )
                }
              >
                {rerenderingCommentaryId === row.recordingId ? "Đang render..." : "Render lại"}
              </Button>
              {row.rawStatusUrl ? (
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  href={row.rawStatusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<SearchIcon />}
                  onClick={stop}
                >
                  Raw status
                </Button>
              ) : null}
              {row.driveFileId ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    stop(event);
                    copyTextToClipboard(row.driveFileId, "Đã sao chép fileId.");
                  }}
                  startIcon={<ContentCopyIcon />}
                >
                  Copy fileId
                </Button>
              ) : null}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={(event) => {
                  stop(event);
                  setSelectedRowId(row.id);
                }}
                startIcon={<InfoOutlinedIcon />}
              >
                Chi tiết
              </Button>
            </Stack>
          );
        },
      },
    ],
    [
      busy,
      commentaryAutoEnabled,
      commentaryGlobalEnabled,
      forcingRecordingId,
      queueingCommentaryId,
      rerenderingCommentaryId,
      retryingRecordingId,
    ]
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
            <Stack spacing={0.35}>
              <Typography variant="h4" fontWeight={800}>
                Drive Video Manager
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Quản lý video đã lên Drive, playback, file gốc, preview và các tác vụ export/BLV AI.
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket mất kết nối"}
              />
              <Button
                variant="outlined"
                onClick={refreshAll}
                disabled={isInitialLoading || isLoadingMore || isRefreshing || commentaryFetching}
                startIcon={
                  isInitialLoading || isLoadingMore || isRefreshing || commentaryFetching ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
              >
                Làm mới
              </Button>
            </Stack>
          </Stack>

          {queryError ? (
            <Alert severity="error">
              {queryError?.data?.message ||
                queryError?.error ||
                "Không tải được danh sách video Drive."}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard title="Tổng video" value={summary.total} hint="Tất cả recording trong monitor" />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Ready"
                value={summary.ready}
                hint="Đã có video trên Drive"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Cần xử lý"
                value={summary.needsAction}
                hint="Retry / force / thiếu link"
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Đang xử lý"
                value={(summary.exporting || 0) + (summary.pendingExportWindow || 0)}
                hint="Exporting và chờ khung giờ"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Thất bại"
                value={summary.failed}
                hint="Cần retry export"
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="BLV AI ready"
                value={summary.commentaryReady}
                hint="Đã có video lồng tiếng"
                color="secondary.main"
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Tabs
                  value={viewMode}
                  onChange={handlePresetChange}
                  variant="scrollable"
                  allowScrollButtonsMobile
                >
                  {VIEW_TABS.map((tab) => (
                    <Tab key={tab.value} value={tab.value} label={tab.label} />
                  ))}
                </Tabs>

                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", lg: "center" }}
                >
                  <TextField
                    fullWidth
                    label="Tìm kiếm"
                    placeholder="Mã trận, cặp đấu, fileId, link, lỗi..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    select
                    label="Trạng thái"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="BLV AI"
                    value={commentaryFilter}
                    onChange={(event) => setCommentaryFilter(event.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    {COMMENTARY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                  Hiển thị {rows.length}/{count} video. Tab đầu tiên tập trung vào video ready trên Drive để thao tác nhanh.
                </Typography>

                {selectionModel.length > 0 ? (
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={1.2}>
                        <Stack
                          direction={{ xs: "column", lg: "row" }}
                          spacing={1.25}
                          justifyContent="space-between"
                          alignItems={{ xs: "stretch", lg: "center" }}
                        >
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" color="primary" label={`${selectionModel.length} video đã chọn`} />
                            <Chip size="small" variant="outlined" label={`Retry: ${selectedRetryRows.length}`} />
                            <Chip size="small" variant="outlined" label={`Force: ${selectedForceRows.length}`} />
                            <Chip size="small" variant="outlined" label={`AI queue: ${selectedQueueAiRows.length}`} />
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`AI rerender: ${selectedRerenderAiRows.length}`}
                            />
                          </Stack>

                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ContentCopyIcon />}
                              disabled={!selectedFileIds}
                              onClick={() =>
                                copyTextToClipboard(
                                  selectedFileIds,
                                  "Đã sao chép danh sách fileId của các video đã chọn."
                                )
                              }
                            >
                              Copy fileIds
                            </Button>
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              disabled={busy || !selectedRetryRows.length}
                              onClick={() =>
                                runBulkAction({
                                  rows: selectedRetryRows,
                                  label: "Bulk retry export",
                                  runner: (row) => retryExport(row.recordingId).unwrap(),
                                })
                              }
                            >
                              Retry export
                            </Button>
                            <Button
                              size="small"
                              color="secondary"
                              variant="outlined"
                              disabled={busy || !selectedForceRows.length}
                              onClick={() =>
                                runBulkAction({
                                  rows: selectedForceRows,
                                  label: "Bulk force export",
                                  runner: (row) => forceExport(row.recordingId).unwrap(),
                                })
                              }
                            >
                              Xuất ngay
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={busy || !selectedQueueAiRows.length}
                              onClick={() =>
                                runBulkAction({
                                  rows: selectedQueueAiRows,
                                  label: "Bulk queue AI",
                                  runner: (row) => queueAiCommentary(row.recordingId).unwrap(),
                                })
                              }
                            >
                              Lồng tiếng AI
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              disabled={busy || !selectedRerenderAiRows.length}
                              onClick={() =>
                                runBulkAction({
                                  rows: selectedRerenderAiRows,
                                  label: "Bulk rerender AI",
                                  runner: (row) => rerenderAiCommentary(row.recordingId).unwrap(),
                                })
                              }
                            >
                              Render lại
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              variant="text"
                              disabled={busy}
                              onClick={() => setSelectionModel([])}
                            >
                              Bỏ chọn
                            </Button>
                          </Stack>
                        </Stack>

                        {bulkAction ? (
                          <Box>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              sx={{ mb: 0.75 }}
                            >
                              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                {bulkAction.label}: {bulkAction.done}/{bulkAction.total}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                                Chạy tuần tự để tránh spam API
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={
                                bulkAction.total > 0
                                  ? Math.round((bulkAction.done / bulkAction.total) * 100)
                                  : 0
                              }
                              sx={{ height: 8, borderRadius: 999 }}
                            />
                          </Box>
                        ) : null}
                      </Stack>
                    </CardContent>
                  </Card>
                ) : null}

                <DataGrid
                  autoHeight
                  checkboxSelection
                  disableColumnMenu
                  disableRowSelectionOnClick
                  rows={rows}
                  columns={columns}
                  loading={isInitialLoading && rows.length === 0}
                  getRowHeight={() => "auto"}
                  selectionModel={selectionModel}
                  onSelectionModelChange={(nextModel) =>
                    setSelectionModel(Array.isArray(nextModel) ? nextModel : [])
                  }
                  hideFooter
                  onRowClick={(params) => setSelectedRowId(params.row.id)}
                  sx={{
                    border: 0,
                    "& .MuiDataGrid-columnHeaders": {
                      borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                    },
                    "& .MuiDataGrid-cell": {
                      alignItems: "flex-start",
                      py: 1,
                      cursor: "pointer",
                    },
                  }}
                />

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    {hasMore ? "Kéo xuống để tải thêm" : "Đã tải hết dữ liệu"}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    Chọn hàng chỉ áp dụng trên các video đã tải xuống bảng hiện tại.
                  </Typography>
                </Stack>

                <Box
                  ref={sentinelRef}
                  sx={{
                    minHeight: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isLoadingMore ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="caption" sx={{ opacity: 0.72 }}>
                        Đang tải thêm dữ liệu...
                      </Typography>
                    </Stack>
                  ) : null}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <RecordingDetailDialog
            row={selectedRowForDialog}
            open={Boolean(selectedRow)}
            onClose={() => setSelectedRowId(null)}
            onCopyFileId={(fileId) => copyTextToClipboard(fileId, "Đã sao chép fileId.")}
            onOpenDriveAction={openDriveActionDialog}
            driveActionBusy={driveActionSubmitting}
            loadingDetail={selectedRowDetailLoading}
            detailError={selectedRowDetailError}
          />
          <DriveAssetActionDialog
            open={driveActionDialog.open && Boolean(driveActionRow)}
            row={driveActionRow}
            target={driveActionDialog.target}
            mode={driveActionDialog.mode}
            assetQuery={activeDriveAssetQuery}
            draftName={driveActionName}
            draftFolderId={driveActionFolderId}
            submitting={driveActionSubmitting}
            onChangeName={setDriveActionName}
            onChangeFolderId={setDriveActionFolderId}
            onClose={closeDriveActionDialog}
            onSubmit={handleSubmitDriveAction}
          />
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
