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
import {
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useLazyGetLiveRecordingDriveAssetQuery,
  useGetLiveRecordingMonitorQuery,
  useMoveLiveRecordingDriveAssetMutation,
  useQueueLiveRecordingAiCommentaryMutation,
  useRenameLiveRecordingDriveAssetMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
  useRetryLiveRecordingExportMutation,
  useTrashLiveRecordingDriveAssetMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const STATUS_OPTIONS = [
  { value: "ready", label: "Ready tr?n Drive" },
  { value: "needs_action", label: "C?n x? l?" },
  { value: "all", label: "T?t c?" },
  { value: "failed", label: "Th?t b?i" },
  { value: "pending_export_window", label: "Ch? khung gi?" },
  { value: "exporting", label: "?ang export" },
  { value: "recording", label: "?ang ghi" },
  { value: "uploading", label: "?ang t?i segment" },
];

const COMMENTARY_OPTIONS = [
  { value: "all", label: "BLV AI: T?t c?" },
  { value: "ready", label: "BLV AI: S?n s?ng" },
  { value: "processing", label: "BLV AI: ?ang ch?y" },
  { value: "missing", label: "BLV AI: Ch?a c?" },
  { value: "failed", label: "BLV AI: L?i" },
];

const VIEW_TABS = [
  { value: "ready", label: "Video ready" },
  { value: "needs_action", label: "C?n x? l?" },
  { value: "ai_ready", label: "BLV AI ready" },
  { value: "all", label: "T?t c?" },
];

const STATUS_META = {
  ready: { color: "success", label: "Ready" },
  failed: { color: "error", label: "Th?t b?i" },
  pending_export_window: { color: "secondary", label: "Ch? khung gi?" },
  exporting: { color: "info", label: "?ang export" },
  uploading: { color: "info", label: "?ang t?i l?n" },
  recording: { color: "warning", label: "?ang ghi" },
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

async function copyTextToClipboard(value, successMessage = "?? sao ch?p v?o clipboard.") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    toast.info("Kh?ng c? d? li?u ?? sao ch?p.");
    return false;
  }

  try {
    await navigator.clipboard.writeText(normalized);
    toast.success(successMessage);
    return true;
  } catch (_) {
    toast.error("Kh?ng th? sao ch?p v?o clipboard.");
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
  return target === "ai" ? "video BLV AI" : "video goc";
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
    return <Chip size="small" color="warning" label="C?n retry export" />;
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
      ? { color: "success", label: "BLV AI s?n s?ng" }
      : status === "running"
      ? { color: "info", label: "BLV AI ?ang render" }
      : status === "queued"
      ? { color: "secondary", label: "BLV AI ?ang ch?" }
      : status === "failed"
      ? { color: "error", label: "BLV AI loi" }
      : { color: "default", label: "BLV AI chua co" };
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
          Tep goc
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
          Ch?a c? link video
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
      ? `Chuyen folder ${assetLabel}`
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
              ? "T?n file s? ???c ??i tr?c ti?p tr?n Google Drive."
              : mode === "move"
              ? "Nh?p folder ID ??ch. N?u ?? tr?ng, backend s? d?ng folder Drive recording m?c ??nh."
              : "Action n?y s? ??a file v?o Google Drive Trash v? ??ng b? l?i DB recording."}
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
                ?ang t?i metadata Drive...
              </Typography>
            </Stack>
          ) : null}

          {errorMessage ? <Alert severity="warning">{errorMessage}</Alert> : null}

          {mode === "rename" ? (
            <TextField
              autoFocus
              fullWidth
              label="T?n file m?i"
              value={draftName}
              onChange={(event) => onChangeName(event.target.value)}
              placeholder="Nh?p t?n file m?i..."
              disabled={submitting}
            />
          ) : null}

          {mode === "move" ? (
            <TextField
              autoFocus
              fullWidth
              label="Folder ID dich"
              value={draftFolderId}
              onChange={(event) => onChangeFolderId(event.target.value)}
              placeholder="Folder ID m?i, ?? tr?ng ?? d?ng folder m?c ??nh"
              disabled={submitting}
            />
          ) : null}

          {mode === "trash" ? (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Sau khi trash, {assetLabel} s? kh?ng c?n ???c xem l? s?n s?ng trong h? th?ng.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Huy
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
            ? "?ang x? l?..."
            : mode === "rename"
            ? "L?u t?n m?i"
            : mode === "move"
            ? "Chuyen folder"
            : "Đưa vào thùng rác"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RecordingDetailDialog({ row, open, onClose, onCopyFileId, onOpenDriveAction, driveActionBusy }) {
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
            Chi tiet video Drive
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
              Recording ?? ready trong DB nh?ng ch?a c? ??y ?? link Drive/Playback.
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
                Tep goc
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
                Doi ten goc
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
                Chuyen folder goc
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
                Thung rac goc
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
                Mo BLV AI
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
                Doi ten AI
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
                Chuyen folder AI
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
                Thung rac AI
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
                hint={`${row.segmentSummary?.uploadedSegments || 0} ?? upload`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Export attempts"
                value={row.exportAttempts || 0}
                hint={`C?p nh?t ${formatRelative(row.updatedAt)}`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Drive auth"
                value={row.driveAuthMode || "-"}
                hint={row.driveFileId || "Ch?a c? fileId"}
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
              <InfoBox label="Nguon export" value={row.source?.label || row.source?.type} />
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
                label="Ngon ngu / Voice"
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
            Danh s?ch segment
          </Typography>

          {segments.length === 0 ? (
            <Alert severity="info">Ch?a c? segment n?o trong DB.</Alert>
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
        <Button onClick={onClose}>Dong</Button>
      </DialogActions>
    </Dialog>
  );
}

function buildSearchText(row) {
  return [
    row.matchCode,
    row.matchId,
    row.recordingId,
    row.participantsLabel,
    row.competitionLabel,
    row.courtLabel,
    row.status,
    row.driveFileId,
    row.driveRawUrl,
    row.drivePreviewUrl,
    row.playbackUrl,
    row.rawStatusUrl,
    row.aiCommentary?.status,
    row.aiCommentary?.latestJobId,
    row.aiCommentary?.language,
    row.aiCommentary?.voicePreset,
    row.aiCommentary?.sourceFingerprint,
    row.source?.videoId,
    row.source?.pageId,
    row.error,
    row.exportPipeline?.stage,
    row.exportPipeline?.detail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesStatusFilter(row, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "needs_action") return rowNeedsAction(row);
  return row.status === statusFilter;
}

function matchesCommentaryFilter(row, commentaryFilter) {
  if (commentaryFilter === "all") return true;
  const status = String(row?.aiCommentary?.status || "idle").toLowerCase();
  const ready = Boolean(row?.aiCommentary?.ready);
  if (commentaryFilter === "ready") return ready;
  if (commentaryFilter === "processing") return ["queued", "running"].includes(status);
  if (commentaryFilter === "failed") return status === "failed";
  if (commentaryFilter === "missing") return !ready && !["queued", "running"].includes(status);
  return true;
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

function matchesViewMode(row, viewMode) {
  if (viewMode === "ready") return row?.status === "ready";
  if (viewMode === "needs_action") return rowNeedsAction(row);
  if (viewMode === "ai_ready") return Boolean(row?.aiCommentary?.ready);
  return true;
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

  const { data, isLoading, isFetching, isError, error, refetch } = useGetLiveRecordingMonitorQuery(
    undefined,
    {
      pollingInterval: 15000,
      refetchOnMountOrArgChange: true,
    }
  );
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
  const [renameDriveAsset] = useRenameLiveRecordingDriveAssetMutation();
  const [moveDriveAsset] = useMoveLiveRecordingDriveAssetMutation();
  const [trashDriveAsset] = useTrashLiveRecordingDriveAssetMutation();

  const rows = Array.isArray(data?.rows) ? data.rows : [];
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

  const filteredRows = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    return rows
      .filter((row) => matchesViewMode(row, viewMode))
      .filter((row) => {
        if (!matchesStatusFilter(row, statusFilter)) return false;
        if (!matchesCommentaryFilter(row, commentaryFilter)) return false;
        if (!keyword) return true;
        return buildSearchText(row).includes(keyword);
      })
      .sort(
        (a, b) =>
          new Date(b?.updatedAt || 0).getTime() -
          new Date(a?.updatedAt || 0).getTime()
      );
  }, [commentaryFilter, deferredSearch, rows, statusFilter, viewMode]);

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
    () =>
      filteredRows.find((row) => row.id === selectedRowId) ||
      rows.find((row) => row.id === selectedRowId) ||
      null,
    [filteredRows, rows, selectedRowId]
  );
  const driveActionRow = useMemo(
    () =>
      rows.find((row) => row.id === driveActionDialog.rowId) ||
      filteredRows.find((row) => row.id === driveActionDialog.rowId) ||
      null,
    [driveActionDialog.rowId, filteredRows, rows]
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

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.total += 1;
          if (row.status === "ready") acc.ready += 1;
          if (row.status === "failed") acc.failed += 1;
          if (row.status === "exporting") acc.exporting += 1;
          if (row.status === "pending_export_window") acc.pendingWindow += 1;
          if (row.aiCommentary?.ready) acc.commentaryReady += 1;
          if (rowNeedsAction(row)) acc.needsAction += 1;
          return acc;
        },
        {
          total: 0,
          ready: 0,
          failed: 0,
          exporting: 0,
          pendingWindow: 0,
          commentaryReady: 0,
          needsAction: 0,
        }
      ),
    [rows]
  );

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

  const refreshAll = useCallback(() => {
    refetch();
    refetchCommentaryMonitor();
  }, [refetch, refetchCommentaryMonitor]);

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
        toast.info(`Kh?ng c? row h?p l? cho "${label}".`);
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
        toast.success(`${label}: ${successCount}/${targetRows.length} th?nh c?ng.`);
      }
      if (errorCount > 0) {
        toast.warn(
          `${label}: ${errorCount}/${targetRows.length} l?i.${firstErrorMessage ? ` ${firstErrorMessage}` : ""}`
        );
      }
    },
    [refreshAll]
  );

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      toast.success("?? ??a video v?o h?ng ??i retry export.");
      refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Kh?ng th? retry export.");
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExport = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      toast.success("?? force export ngay.");
      refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Kh?ng th? force export.");
    } finally {
      setForcingRecordingId(null);
    }
  };

  const handleQueueCommentary = async (recordingId, rerender = false) => {
    try {
      if (rerender) {
        setRerenderingCommentaryId(recordingId);
        await rerenderAiCommentary(recordingId).unwrap();
        toast.success("?? ??a job render l?i BLV AI v?o h?ng ??i.");
      } else {
        setQueueingCommentaryId(recordingId);
        await queueAiCommentary(recordingId).unwrap();
        toast.success("?? ??a job BLV AI v?o h?ng ??i.");
      }
      refreshAll();
    } catch (apiError) {
      toast.error(
        apiError?.data?.message ||
          apiError?.error ||
          (rerender ? "Kh?ng th? render l?i BLV AI." : "Kh?ng th? x?p h?ng BLV AI.")
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
        toast.info(`Kh?ng c? ${getDriveAssetLabel(target)} ?? thao t?c.`);
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
              `Kh?ng t?i ???c metadata cho ${getDriveAssetLabel(target)}.`
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
        toast.success(`?? ??i t?n ${assetLabel}.`);
      } else if (driveActionDialog.mode === "move") {
        await moveDriveAsset({
          ...payload,
          folderId: String(driveActionFolderId || "").trim(),
        }).unwrap();
        toast.success(`?? chuy?n folder cho ${assetLabel}.`);
      } else {
        await trashDriveAsset(payload).unwrap();
        toast.success(`?? ??a ${assetLabel} v?o th?ng r?c.`);
      }

      closeDriveActionDialog();
      refreshAll();
    } catch (apiError) {
      toast.error(
        apiError?.data?.message ||
          apiError?.error ||
          `Kh?ng th? x? l? ${getDriveAssetLabel(driveActionDialog.target)}.`
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
        headerName: "Tr?n ??u",
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
                  M? AI
                </Button>
              ) : null}
            </Stack>
            <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
              {!commentaryGlobalEnabled
                ? "Global AI ?ang t?t."
                : row.aiCommentary?.error
                ? row.aiCommentary.error
                : row.aiCommentary?.renderedAt
                ? `Xong ${formatRelative(row.aiCommentary.renderedAt)}`
                : commentaryAutoEnabled
                ? "Auto s? ch?y sau khi video l?n Drive."
                : "Auto ?ang t?t, c? th? ch?y tay."}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "actions",
        headerName: "Tac vu",
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
                  {retryingRecordingId === row.recordingId ? "?ang retry..." : "Retry export"}
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
                  {forcingRecordingId === row.recordingId ? "?ang xu?t..." : "Xu?t ngay"}
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
                {queueingCommentaryId === row.recordingId ? "?ang x?p..." : "L?ng ti?ng AI"}
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
                {rerenderingCommentaryId === row.recordingId ? "?ang render..." : "Render lai"}
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
                    copyTextToClipboard(row.driveFileId, "?? sao ch?p fileId.");
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
                Chi tiet
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
                Qu?n l? video ?? l?n Drive, playback, file g?c, preview v? c?c t?c v? export/BLV AI.
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket m?t k?t n?i"}
              />
              <Button
                variant="outlined"
                onClick={() => {
                  refetch();
                  refetchCommentaryMonitor();
                }}
                disabled={isFetching || commentaryFetching}
                startIcon={
                  isFetching || commentaryFetching ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
              >
                L?m m?i
              </Button>
            </Stack>
          </Stack>

          {isError ? (
            <Alert severity="error">
              {error?.data?.message || error?.error || "Kh?ng t?i ???c danh s?ch video Drive."}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard title="T?ng video" value={summary.total} hint="T?t c? recording trong monitor" />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Ready"
                value={summary.ready}
                hint="?? c? video tr?n Drive"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="C?n x? l?"
                value={summary.needsAction}
                hint="Retry / force / thi?u link"
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="?ang x? l?"
                value={summary.exporting + summary.pendingWindow}
                hint="Exporting v? ch? khung gi?"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="Th?t b?i"
                value={summary.failed}
                hint="C?n retry export"
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryCard
                title="BLV AI ready"
                value={summary.commentaryReady}
                hint="?? c? video l?ng ti?ng"
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
                    label="T?m ki?m"
                    placeholder="M? tr?n, c?p ??u, fileId, link, l?i..."
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
                  Hien {filteredRows.length}/{rows.length} video. Tab dau tien tap trung vao video ready tren Drive de thao tac nhanh.
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
                            <Chip size="small" color="primary" label={`${selectionModel.length} video ?? ch?n`} />
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
                                  "?? sao ch?p danh s?ch fileId c?a c?c video ?? ch?n."
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
                              Xu?t ngay
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
                              L?ng ti?ng AI
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
                              Render lai
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              variant="text"
                              disabled={busy}
                              onClick={() => setSelectionModel([])}
                            >
                              Bo chon
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
                                Chay tuan tu de tranh spam API
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
                  rows={filteredRows}
                  columns={columns}
                  loading={isLoading || isFetching}
                  getRowHeight={() => "auto"}
                  selectionModel={selectionModel}
                  onSelectionModelChange={(nextModel) =>
                    setSelectionModel(Array.isArray(nextModel) ? nextModel : [])
                  }
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10, page: 0 } },
                  }}
                  pageSizeOptions={[10, 25, 50]}
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
              </Stack>
            </CardContent>
          </Card>

          <RecordingDetailDialog
            row={selectedRow}
            open={Boolean(selectedRow)}
            onClose={() => setSelectedRowId(null)}
            onCopyFileId={(fileId) => copyTextToClipboard(fileId, "?? sao ch?p fileId.")}
            onOpenDriveAction={openDriveActionDialog}
            driveActionBusy={driveActionSubmitting}
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
