/* eslint-disable react/prop-types */
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { DataGrid } from "@mui/x-data-grid";
import { toast } from "react-toastify";
import { Link as RouterLink } from "react-router-dom";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useGetLiveRecordingMonitorExportQueueQuery,
  useGetLiveRecordingMonitorRowQuery,
  useGetLiveRecordingMonitorRowsQuery,
  useGetLiveRecordingMonitorSummaryQuery,
  useGetLiveRecordingWorkerHealthQuery,
  useQueueLiveRecordingAiCommentaryMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
  useRetryLiveRecordingExportMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const STATUS_META = {
  pending_export_window: { color: "secondary", label: "Chờ khung giờ đêm" },
  exporting: { color: "info", label: "Đang xuất" },
  ready: { color: "success", label: "Sẵn sàng" },
  failed: { color: "error", label: "Thất bại" },
};

const PIPELINE_STATUS_META = {
  awaiting_queue_sync: { color: "info", label: "Đang đồng bộ" },
  stale_no_job: { color: "warning", label: "Export treo — mất job" },
  worker_offline: { color: "warning", label: "Worker offline" },
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

function getTimestampMs(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function buildQueueSnapshotItems(entriesByRecordingId = {}, rowsByRecordingId = new Map(), kind = "waiting") {
  return Object.entries(entriesByRecordingId || {}).map(([recordingId, entry]) => ({
    kind,
    recordingId: String(recordingId || ""),
    position:
      Number.isFinite(Number(entry?.position)) && Number(entry.position) > 0
        ? Number(entry.position)
        : null,
    jobId: entry?.jobId ? String(entry.jobId) : null,
    scheduledAt: entry?.scheduledAt || null,
    row: rowsByRecordingId.get(String(recordingId || "")) || null,
  }));
}

function buildFallbackQueueItem(row, kind = "waiting") {
  if (!row?.recordingId) return null;
  return {
    kind,
    recordingId: String(row.recordingId),
    position:
      Number.isFinite(Number(row?.exportPipeline?.queuePosition)) &&
      Number(row.exportPipeline.queuePosition) > 0
        ? Number(row.exportPipeline.queuePosition)
        : null,
    jobId: row?.exportPipeline?.jobId || null,
    scheduledAt: row?.scheduledExportAt || row?.exportPipeline?.scheduledExportAt || null,
    row,
  };
}

function dedupeQueueItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.recordingId || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortQueueItemsByPosition(items = []) {
  return [...items].sort((a, b) => {
    const aPos = Number.isFinite(Number(a?.position)) ? Number(a.position) : Number.MAX_SAFE_INTEGER;
    const bPos = Number.isFinite(Number(b?.position)) ? Number(b.position) : Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;

    const aUpdatedAt = getTimestampMs(a?.row?.updatedAt || a?.scheduledAt);
    const bUpdatedAt = getTimestampMs(b?.row?.updatedAt || b?.scheduledAt);
    if (aUpdatedAt !== bUpdatedAt) return aUpdatedAt - bUpdatedAt;

    return String(a?.recordingId || "").localeCompare(String(b?.recordingId || ""));
  });
}

function sortQueueItemsBySchedule(items = []) {
  return [...items].sort((a, b) => {
    const aScheduledAt = getTimestampMs(
      a?.scheduledAt || a?.row?.scheduledExportAt || a?.row?.exportPipeline?.scheduledExportAt
    );
    const bScheduledAt = getTimestampMs(
      b?.scheduledAt || b?.row?.scheduledExportAt || b?.row?.exportPipeline?.scheduledExportAt
    );
    if (aScheduledAt !== bScheduledAt) return aScheduledAt - bScheduledAt;

    const aUpdatedAt = getTimestampMs(a?.row?.updatedAt);
    const bUpdatedAt = getTimestampMs(b?.row?.updatedAt);
    if (aUpdatedAt !== bUpdatedAt) return aUpdatedAt - bUpdatedAt;

    return String(a?.recordingId || "").localeCompare(String(b?.recordingId || ""));
  });
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

function StatusChip({ status, pipelineStage }) {
  const meta = PIPELINE_STATUS_META[pipelineStage] ||
    STATUS_META[status] || {
      color: "default",
      label: status || "Không rõ",
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

function CommentaryStatusChip({ commentary }) {
  const status = String(commentary?.status || "idle").toLowerCase();
  const meta =
    status === "completed"
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

function formatTimecode(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ScenePreviewBlock({ job }) {
  const summary = job?.summary || {};
  const analysisPreview = job?.analysisPreview || {};
  const sceneWindows = Array.isArray(analysisPreview?.sceneWindows)
    ? analysisPreview.sceneWindows
    : [];
  const transcriptSnippets = Array.isArray(analysisPreview?.transcriptSnippets)
    ? analysisPreview.transcriptSnippets
    : [];
  const scriptPreview = Array.isArray(analysisPreview?.scriptPreview)
    ? analysisPreview.scriptPreview
    : [];

  if (!sceneWindows.length && !transcriptSnippets.length && !scriptPreview.length) return null;

  return (
    <Stack spacing={1.1}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap">
        <Chip size="small" variant="outlined" label={`Scenes: ${summary.sceneCount ?? 0}`} />
        <Chip
          size="small"
          variant="outlined"
          label={`Aligned: ${summary.alignedSceneCount ?? 0}`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`Transcript: ${summary.transcriptSnippetCount ?? 0}`}
        />
        <Chip size="small" variant="outlined" label={`Segments: ${summary.segmentCount ?? 0}`} />
      </Stack>

      {sceneWindows.length ? (
        <Stack spacing={0.75}>
          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Scene windows
          </Typography>
          <Grid container spacing={1}>
            {sceneWindows.slice(0, 4).map((scene) => (
              <Grid item xs={12} md={6} key={`scene-${scene.sceneIndex}-${scene.startSec}`}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                    {(() => {
                      const sceneSegments = scriptPreview
                        .filter(
                          (segment) =>
                            Number(segment?.sceneIndex) === Number(scene?.sceneIndex) &&
                            segment?.text
                        )
                        .slice(0, 2);
                      return (
                        <Stack spacing={0.45}>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                            <Chip
                              size="small"
                              color="info"
                              variant="outlined"
                              label={`#${scene.sceneIndex + 1} ${scene.kind || "scene"}`}
                            />
                            <Typography variant="caption" sx={{ opacity: 0.72 }}>
                              {formatTimecode(scene.startSec)} - {formatTimecode(scene.endSec)}
                            </Typography>
                          </Stack>
                          {scene.visualSummary ? (
                            <Typography variant="caption" sx={{ whiteSpace: "normal" }}>
                              {scene.visualSummary}
                            </Typography>
                          ) : null}
                          {scene.audioSnippet ? (
                            <Typography
                              variant="caption"
                              sx={{ opacity: 0.74, whiteSpace: "normal" }}
                            >
                              Audio: {scene.audioSnippet}
                            </Typography>
                          ) : null}
                          {sceneSegments.length ? (
                            <Stack spacing={0.35}>
                              <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                Script preview
                              </Typography>
                              {sceneSegments.map((segment) => (
                                <Typography
                                  key={`scene-script-${scene.sceneIndex}-${segment.segmentIndex}`}
                                  variant="caption"
                                  sx={{ opacity: 0.82, whiteSpace: "normal" }}
                                >
                                  {formatTimecode(segment.startSec)} -{" "}
                                  {formatTimecode(segment.endSec)}: {segment.text}
                                </Typography>
                              ))}
                            </Stack>
                          ) : null}
                        </Stack>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      ) : null}

      {transcriptSnippets.length ? (
        <Stack spacing={0.45}>
          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Transcript snippets
          </Typography>
          {transcriptSnippets.slice(0, 3).map((snippet) => (
            <Typography
              key={`snippet-${snippet.startSec}-${snippet.endSec}`}
              variant="caption"
              sx={{ opacity: 0.76, whiteSpace: "normal" }}
            >
              {formatTimecode(snippet.startSec)} - {formatTimecode(snippet.endSec)}: {snippet.text}
            </Typography>
          ))}
        </Stack>
      ) : null}

      {scriptPreview.length ? (
        <Stack spacing={0.45}>
          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            Script segments
          </Typography>
          {scriptPreview.slice(0, 4).map((segment) => (
            <Typography
              key={`script-preview-${segment.segmentIndex}-${segment.startSec}`}
              variant="caption"
              sx={{ opacity: 0.8, whiteSpace: "normal" }}
            >
              {segment.sceneIndex !== null ? `Scene ${segment.sceneIndex + 1} • ` : ""}
              {formatTimecode(segment.startSec)} - {formatTimecode(segment.endSec)}: {segment.text}
            </Typography>
          ))}
        </Stack>
      ) : null}
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
        Trận: {row.matchCode || row.matchId || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: "normal" }}>
        {row.competitionLabel || "-"}
      </Typography>
    </Stack>
  );
}

function ExportLinks({ row }) {
  const canPlay =
    Boolean(row.playbackUrl) && (row.status === "ready" || row.temporaryPlaybackReady);
  const rawHref = row.rawStreamAvailable
    ? row.rawStreamUrl || row.driveRawUrl
    : row.driveRawUrl || null;
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
          {row.status === "ready" ? "Phát" : "Tạm"}
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
    </Stack>
  );
}

function canRetryExport(row) {
  const stage = row?.exportPipeline?.stage || "";
  const staleReason = row?.exportPipeline?.staleReason || "";
  return (
    row?.status === "failed" ||
    stage === "stale_no_job" ||
    staleReason === "stale_no_job" ||
    staleReason === "worker_offline"
  );
}

function canForceExportNow(row) {
  return row?.status === "pending_export_window";
}

const PIPELINE_STAGE_LABELS = {
  delayed_until_window: "Đang chờ khung giờ đêm",
  queued: "Đang chờ worker nhận job",
  queued_retry: "Đang chờ thử lại",
  awaiting_queue_sync: "Đang đồng bộ trạng thái hàng đợi",
  downloading: "Tải segment từ R2",
  merging: "Đang ghép video",
  uploading_drive: "Đang upload lên Drive",
  cleaning_r2: "Đang dọn segment trên R2",
  completed: "Hoàn tất",
  failed: "Export thất bại",
  stale_no_job: "Export treo — không có job",
  worker_offline: "Worker ngoại tuyến",
};

const PIPELINE_STAGE_PERCENT = {
  delayed_until_window: 10,
  queued: 5,
  queued_retry: 5,
  awaiting_queue_sync: 8,
  downloading: 25,
  merging: 55,
  uploading_drive: 80,
  cleaning_r2: 95,
  completed: 100,
};

const ACTIVE_QUEUE_STAGES = new Set([
  "downloading",
  "downloading_facebook_vod",
  "merging",
  "uploading_drive",
  "cleaning_r2",
]);

const SCHEDULED_QUEUE_STAGES = new Set([
  "queued_retry",
  "delayed_until_window",
  "waiting_facebook_vod",
]);

function WorkerHealthPanel({ health, currentExportRow }) {
  const worker = health?.worker || null;
  const pipeline = currentExportRow?.exportPipeline || null;
  const pipelineStage = pipeline?.stage || null;
  const isBusy = health?.alive && worker?.currentRecordingId;
  const stageLabel = pipelineStage ? PIPELINE_STAGE_LABELS[pipelineStage] || pipelineStage : null;
  const stagePercent = pipelineStage ? PIPELINE_STAGE_PERCENT[pipelineStage] ?? null : null;
  const matchLabel = currentExportRow?.participantsLabel || "";
  const matchCode = currentExportRow?.matchCode || "";
  const jobElapsed = worker?.currentJobStartedAt
    ? dayjs(worker.currentJobStartedAt).fromNow(true)
    : null;

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
                Tình trạng Worker
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Theo dõi heartbeat và tiến trình đẩy lên Drive theo thời gian thực
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
                Bản ghi hiện tại
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {worker?.currentRecordingId || "idle"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Job hiện tại bắt đầu
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDateTime(worker?.currentJobStartedAt)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Hoàn tất gần nhất
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDateTime(worker?.lastCompletedAt)}
              </Typography>
            </Grid>
          </Grid>

          {isBusy && pipelineStage ? (
            <>
              <Divider />
              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={stageLabel}
                      color="info"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                    {matchCode ? (
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {matchCode}
                        {matchLabel ? ` — ${matchLabel}` : ""}
                      </Typography>
                    ) : null}
                  </Stack>
                  {jobElapsed ? (
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      {jobElapsed}
                    </Typography>
                  ) : null}
                </Stack>
                <LinearProgress
                  variant={stagePercent != null ? "determinate" : "indeterminate"}
                  value={stagePercent ?? undefined}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: "action.hover",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 4,
                      background: "linear-gradient(90deg, #3b82f6, #6366f1)",
                    },
                  }}
                />
                {stagePercent != null ? (
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.55, mt: 0.25, display: "block", textAlign: "right" }}
                  >
                    ~{stagePercent}%
                  </Typography>
                ) : null}
              </Box>
            </>
          ) : null}

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

function AiCommentaryPanel({ monitor, currentRow }) {
  const settings = monitor?.settings || {};
  const activeJob = monitor?.activeJob || null;
  const gateway = monitor?.gatewayHealth || {};
  const gatewayOnline = gateway?.overallStatus === "online";
  const gatewayMessage =
    gateway?.overallStatus === "online"
      ? `${gateway?.script?.message || "Script OK"} • ${gateway?.tts?.message || "TTS OK"}`
      : gateway?.script?.message || gateway?.tts?.message || "Gateway chưa sẵn sàng";
  const globalEnabled = Boolean(settings?.enabled);
  const autoEnabled = Boolean(settings?.autoGenerateAfterDriveUpload);
  const activeRowCommentary = currentRow?.aiCommentary || null;

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
                AI bình luận video trận
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Hàng đợi riêng cho BLV AI sau khi recording đã lên Drive. Công tắc global nằm ở Cài
                đặt
                hệ thống.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                size="small"
                color={globalEnabled ? "success" : "default"}
                label={globalEnabled ? "Global ON" : "Global OFF"}
              />
              <Chip
                size="small"
                color={autoEnabled ? "info" : "default"}
                label={autoEnabled ? "Auto sau Drive: ON" : "Auto sau Drive: OFF"}
              />
              <Chip
                size="small"
                color={gatewayOnline ? "success" : "warning"}
                label={gatewayMessage}
              />
            </Stack>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Voice mặc định
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {settings?.defaultVoicePreset || "-"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Ngôn ngữ
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {settings?.defaultLanguage || "-"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Tông giọng
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {settings?.defaultTonePreset || "-"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Đang chờ
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {monitor?.summary?.queued ?? 0}
              </Typography>
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Đang chạy
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {monitor?.summary?.running ?? 0}
              </Typography>
            </Grid>
            <Grid item xs={12} md={1.5}>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Thất bại
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {monitor?.summary?.failed ?? 0}
              </Typography>
            </Grid>
          </Grid>

          {activeJob ? (
            <>
              <Divider />
              <Stack spacing={1.2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <CommentaryStatusChip commentary={{ status: activeJob.status }} />
                    {activeJob.matchCode ? (
                      <Typography variant="body2" fontWeight={700}>
                        {activeJob.matchCode}
                      </Typography>
                    ) : null}
                    {activeJob.participantsLabel ? (
                      <Typography variant="body2" sx={{ opacity: 0.82 }}>
                        {activeJob.participantsLabel}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={activeJob.currentStepLabel || activeJob.status}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${activeJob.progressPercent || 0}%`}
                    />
                  </Stack>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, activeJob.progressPercent || 0))}
                  sx={{ height: 8, borderRadius: 999 }}
                />

                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Bắt đầu {formatDateTime(activeJob.startedAt)} • cập nhật{" "}
                  {formatRelative(activeJob.updatedAt)}
                </Typography>

                {activeJob.lastError ? <Alert severity="error">{activeJob.lastError}</Alert> : null}
                <ScenePreviewBlock job={activeJob} />
              </Stack>
            </>
          ) : (
            <Alert severity="info">
              Chưa có job AI commentary đang chạy hoặc chờ trong hàng đợi.
            </Alert>
          )}

          {activeRowCommentary?.ready && activeRowCommentary?.dubbedPlaybackUrl ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Bản ghi hiện tại của worker đã có bản BLV AI:
              </Typography>
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href={activeRowCommentary.dubbedPlaybackUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<PlayCircleOutlineIcon />}
              >
                Mở bản BLV AI
              </Button>
            </Stack>
          ) : null}
          {Array.isArray(monitor?.recentJobs) && monitor.recentJobs.length ? (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Job gần đây
                </Typography>
                {monitor.recentJobs.slice(0, 4).map((job) => (
                  <Card key={job.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                      <Stack spacing={0.8}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                            <CommentaryStatusChip commentary={{ status: job.status }} />
                            {job.matchCode ? (
                              <Typography variant="body2" fontWeight={700}>
                                {job.matchCode}
                              </Typography>
                            ) : null}
                            {job.participantsLabel ? (
                              <Typography variant="caption" sx={{ opacity: 0.76 }}>
                                {job.participantsLabel}
                              </Typography>
                            ) : null}
                          </Stack>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap">
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${job.progressPercent || 0}%`}
                            />
                            {job.artifacts?.dubbedPlaybackUrl ? (
                              <Button
                                size="small"
                                variant="outlined"
                                component={Link}
                                href={job.artifacts.dubbedPlaybackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                startIcon={<PlayCircleOutlineIcon />}
                              >
                                Mo
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                        <Typography variant="caption" sx={{ opacity: 0.68 }}>
                          {formatDateTime(job.createdAt)} • {job.currentStepLabel || job.status}
                        </Typography>
                        <ScenePreviewBlock job={job} />
                        {job.lastError ? (
                          <Typography variant="caption" color="error">
                            {job.lastError}
                          </Typography>
                        ) : null}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function RecordingDetailDialog({
  row,
  open,
  onClose,
  loadingDetail = false,
  detailError = null,
  onForceExportNow,
  onRetryExport,
  forcingRecordingId,
  retryingRecordingId,
}) {
  if (!row) return null;

  const segments = row?.segmentSummary?.segments || [];
  const rawHref = row?.rawStreamAvailable
    ? row?.rawStreamUrl || row?.driveRawUrl
    : row?.driveRawUrl || null;
  const missingDriveLinks =
    row.status === "ready" && !rawHref && !row.drivePreviewUrl && !row.playbackUrl;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={800}>
            Chi tiết export lên Drive
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            {row.participantsLabel || "Chưa rõ trận đấu"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            {row.competitionLabel || "-"}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
            <StatusChip status={row.status} pipelineStage={row.exportPipeline?.stage} />
            <Chip size="small" variant="outlined" label={`Mode: ${row.modeLabel || "-"}`} />
            <Chip
              size="small"
              variant="outlined"
              label={`Tạo lúc: ${formatDateTime(row.createdAt)}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Hoàn tất: ${formatDateTime(row.finalizedAt)}`}
            />
            {row.scheduledExportAt ? (
              <Chip
                size="small"
                variant="outlined"
                color="secondary"
                label={`Lên lịch: ${formatDateTime(row.scheduledExportAt)}`}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={`Sẵn sàng: ${formatDateTime(row.readyAt)}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Đầu ra: ${formatDuration(row.durationSeconds)} / ${formatBytes(
                row.sizeBytes
              )}`}
            />
          </Stack>

          {missingDriveLinks ? (
            <Alert severity="warning">
              Bản ghi đã sẵn sàng trong DB nhưng chưa có đầy đủ link Drive/Phát.
            </Alert>
          ) : null}

          {["awaiting_queue_sync", "stale_no_job", "worker_offline"].includes(
            row?.exportPipeline?.stage
          ) && row?.exportPipeline?.detail ? (
            <Alert
              severity={row.exportPipeline.stage === "awaiting_queue_sync" ? "info" : "warning"}
            >
              {row.exportPipeline.detail}
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <ExportLinks row={row} />
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
            {canForceExportNow(row) ? (
              <Button
                size="small"
                color="secondary"
                variant="outlined"
                disabled={Boolean(forcingRecordingId) || Boolean(retryingRecordingId)}
                onClick={() => onForceExportNow?.(row.recordingId)}
                startIcon={
                  forcingRecordingId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                {forcingRecordingId === row.recordingId ? "Đang xuất..." : "Export ngay"}
              </Button>
            ) : null}
            {canRetryExport(row) ? (
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={Boolean(forcingRecordingId) || Boolean(retryingRecordingId)}
                onClick={() => onRetryExport?.(row.recordingId)}
                startIcon={
                  retryingRecordingId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                {retryingRecordingId === row.recordingId ? "Đang thử lại..." : "Thử lại export"}
              </Button>
            ) : null}
          </Stack>

          {row.error ? <Alert severity="error">{row.error}</Alert> : null}

          <Divider />

          <Typography variant="h6" fontWeight={700}>
            Tổng quan segment
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Segments"
                value={row.segmentSummary?.totalSegments || 0}
                hint={`${row.segmentSummary?.uploadedSegments || 0} đã upload`}
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
                title="Kích thước đầu ra"
                value={formatBytes(row.sizeBytes)}
                hint="Kích thước file cuối"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Số lần export"
                value={row.exportAttempts || 0}
                hint={`Cập nhật ${formatRelative(row.updatedAt)}`}
              />
            </Grid>
          </Grid>

          <Divider />

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

function ExportQueueItemCard({ item, onOpenDetail, onForceExportNow, onRetryExport, forcingRecordingId, retryingRecordingId }) {
  const row = item?.row || null;
  const stage = row?.exportPipeline?.stage || "";
  const isWindowGate =
    item?.kind === "delayed" &&
    (stage === "delayed_until_window" || row?.status === "pending_export_window");
  const stageLabel =
    PIPELINE_STAGE_LABELS[stage] ||
    row?.exportPipeline?.label ||
    (item?.kind === "delayed" ? "Chờ đến lượt" : "Đang chờ xử lý");
  const scheduledAt =
    item?.scheduledAt || row?.scheduledExportAt || row?.exportPipeline?.scheduledExportAt || null;
  const title = row?.participantsLabel || `Recording ${item?.recordingId || "-"}`;
  const subtitle = row?.competitionLabel || item?.recordingId || "-";
  const showForce = canForceExportNow(row);
  const showRetry = canRetryExport(row);
  const busy = Boolean(forcingRecordingId) || Boolean(retryingRecordingId);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "flex-start" }}
          >
            <Stack spacing={0.45}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ whiteSpace: "normal" }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
                {row?.matchCode ? `${row.matchCode} • ${subtitle}` : subtitle}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {item?.position ? (
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label={`Queue #${item.position}`}
                />
              ) : null}
              <StatusChip status={row?.status} pipelineStage={stage} />
            </Stack>
          </Stack>

          <Typography variant="body2" sx={{ opacity: 0.84, whiteSpace: "normal" }}>
            {row?.exportPipeline?.detail ||
              (scheduledAt
                ? isWindowGate
                  ? `Mở queue lúc ${formatDateTime(
                      scheduledAt
                    )}. Sau đó worker chạy tuần tự theo thứ tự chờ.`
                  : `Dự kiến xử lý lúc ${formatDateTime(scheduledAt)}`
                : "Đang chờ worker nhận job.")}
          </Typography>

          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={stageLabel} />
            {scheduledAt ? (
              <Chip
                size="small"
                variant="outlined"
                color="secondary"
                label={`${isWindowGate ? "Mở queue" : "Lịch"}: ${formatDateTime(scheduledAt)}`}
              />
            ) : null}
            {item?.jobId ? (
              <Chip
                size="small"
                variant="outlined"
                label={`Job: ${String(item.jobId).slice(0, 24)}`}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={`Cập nhật: ${formatRelative(row?.updatedAt)}`}
            />
          </Stack>

          {isWindowGate && item?.position ? (
            <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
              {`00:00 là mốc mở hàng chờ, không phải giờ tất cả video cùng chạy. Video này sẽ đợi tới lượt Queue #${item.position}.`}
            </Typography>
          ) : null}

          {row ? (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button size="small" variant="outlined" onClick={() => onOpenDetail?.(row)}>
                Xem chi tiết
              </Button>
              {showForce ? (
                <Button
                  size="small"
                  color="secondary"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onForceExportNow?.(row.recordingId)}
                  startIcon={
                    forcingRecordingId === row.recordingId ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : null
                  }
                >
                  {forcingRecordingId === row.recordingId ? "Đang xuất..." : "Export ngay"}
                </Button>
              ) : null}
              {showRetry ? (
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  disabled={busy}
                  onClick={() => onRetryExport?.(row.recordingId)}
                  startIcon={
                    retryingRecordingId === row.recordingId ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : null
                  }
                >
                  {retryingRecordingId === row.recordingId ? "Đang thử lại..." : "Thử lại export"}
                </Button>
              ) : null}
              {row?.playbackUrl && (row?.status === "ready" || row?.temporaryPlaybackReady) ? (
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  href={row.playbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở phát lại
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ExportQueueSection({
  title,
  hint,
  items,
  emptyMessage,
  onOpenDetail,
  onForceExportNow,
  onRetryExport,
  forcingRecordingId,
  retryingRecordingId,
}) {
  return (
    <Stack spacing={1.1}>
      <Box>
        <Typography variant="h6" fontWeight={800}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.72 }}>
          {hint}
        </Typography>
      </Box>

      {!items.length ? (
        <Alert severity="info">{emptyMessage}</Alert>
      ) : (
        <Stack spacing={1.1}>
          {items.map((item) => (
            <ExportQueueItemCard
              key={`${item.kind}-${item.recordingId}`}
              item={item}
              onOpenDetail={onOpenDetail}
              onForceExportNow={onForceExportNow}
              onRetryExport={onRetryExport}
              forcingRecordingId={forcingRecordingId}
              retryingRecordingId={retryingRecordingId}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ExportQueueDialog({
  open,
  onClose,
  onRefresh,
  onOpenDetail,
  onForceExportNow,
  onRetryExport,
  forcingRecordingId,
  retryingRecordingId,
  rows = [],
  currentExportRow = null,
  queueSnapshot = null,
  generatedAt = null,
}) {
  const queueData = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const rowsByRecordingId = new Map(
      safeRows
        .filter((row) => row?.recordingId)
        .map((row) => [String(row.recordingId), row])
    );

    const activeItems = dedupeQueueItems(
      [
        ...buildQueueSnapshotItems(queueSnapshot?.activeByRecordingId, rowsByRecordingId, "active"),
        ...(currentExportRow ? [buildFallbackQueueItem(currentExportRow, "active")] : []),
        ...safeRows
          .filter(
            (row) =>
              row?.exportPipeline?.inWorker ||
              ACTIVE_QUEUE_STAGES.has(String(row?.exportPipeline?.stage || ""))
          )
          .map((row) => buildFallbackQueueItem(row, "active")),
      ].filter(Boolean)
    );

    const waitingItems = sortQueueItemsByPosition(
      dedupeQueueItems(
        [
          ...buildQueueSnapshotItems(
            queueSnapshot?.waitingByRecordingId,
            rowsByRecordingId,
            "waiting"
          ),
          ...safeRows
            .filter((row) => String(row?.exportPipeline?.stage || "") === "queued")
            .map((row) => buildFallbackQueueItem(row, "waiting")),
        ].filter(Boolean)
      )
    );

    const delayedItems = sortQueueItemsBySchedule(
      dedupeQueueItems(
        [
          ...buildQueueSnapshotItems(
            queueSnapshot?.delayedByRecordingId,
            rowsByRecordingId,
            "delayed"
          ),
          ...safeRows
            .filter(
              (row) =>
                row?.status === "pending_export_window" ||
                SCHEDULED_QUEUE_STAGES.has(String(row?.exportPipeline?.stage || ""))
            )
            .map((row) => buildFallbackQueueItem(row, "delayed")),
        ].filter(Boolean)
      )
    );

    const syncingItems = dedupeQueueItems(
      safeRows
        .filter((row) => String(row?.exportPipeline?.stage || "") === "awaiting_queue_sync")
        .map((row) => buildFallbackQueueItem(row, "sync"))
        .filter(Boolean)
    ).sort((a, b) => getTimestampMs(b?.row?.updatedAt) - getTimestampMs(a?.row?.updatedAt));

    const attentionItems = dedupeQueueItems(
      safeRows
        .filter((row) => canRetryExport(row))
        .map((row) => buildFallbackQueueItem(row, "attention"))
        .filter(Boolean)
    ).sort((a, b) => getTimestampMs(b?.row?.updatedAt) - getTimestampMs(a?.row?.updatedAt));

    return {
      activeItems,
      waitingItems,
      delayedItems,
      syncingItems,
      attentionItems,
    };
  }, [currentExportRow, queueSnapshot, rows]);

  const activeCount = Math.max(
    queueData.activeItems.length,
    Number(queueSnapshot?.activeCount) || 0
  );
  const waitingCount = Math.max(
    queueData.waitingItems.length,
    Number(queueSnapshot?.waitingCount) || 0
  );
  const delayedCount = Math.max(
    queueData.delayedItems.length,
    Number(queueSnapshot?.delayedCount) || 0
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={800}>
            Hàng chờ export Drive
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            Theo dõi job đang chạy, thứ tự chờ worker và các job đang hẹn giờ theo queue hiện tại.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.62 }}>
            Snapshot: {formatDateTime(generatedAt)}
            {queueSnapshot?.queueName ? ` • ${queueSnapshot.queueName}` : ""}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Đang chạy"
                value={activeCount}
                hint="Job worker đang xử lý"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Chờ worker"
                value={waitingCount}
                hint="Sẽ chạy tuần tự theo thứ tự queue"
                color="primary.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Hẹn giờ / retry"
                value={delayedCount}
                hint="Đang chờ đến khung giờ hoặc lần thử lại"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Đồng bộ queue"
                value={queueData.syncingItems.length}
                hint="Đợi queue và worker đồng bộ lại"
                color="warning.main"
              />
            </Grid>
          </Grid>

          {queueData.attentionItems.length ? (
            <Alert severity="warning">
              Có {queueData.attentionItems.length} bản ghi đang lỗi hoặc treo, chưa nằm trong hàng chờ hợp lệ.
            </Alert>
          ) : null}

          {delayedCount > 0 ? (
            <Alert severity="info">
              00:00 là mốc mở hàng chờ theo khung giờ đêm, không phải tất cả video cùng bắt đầu export lúc 00:00.
              Worker vẫn chạy tuần tự từng video theo đúng thứ tự queue.
            </Alert>
          ) : null}

          <ExportQueueSection
            title="Job đang chạy"
            hint="Worker export chỉ xử lý một job tại một thời điểm."
            items={queueData.activeItems}
            emptyMessage="Hiện chưa có job export nào đang chạy."
            onOpenDetail={onOpenDetail}
            onForceExportNow={onForceExportNow}
            onRetryExport={onRetryExport}
            forcingRecordingId={forcingRecordingId}
            retryingRecordingId={retryingRecordingId}
          />

          <Divider />

          <ExportQueueSection
            title="Đang chờ worker"
            hint="Các bản ghi này sẽ lần lượt được worker nhận theo đúng thứ tự queue."
            items={queueData.waitingItems}
            emptyMessage="Hiện không có job nào đang chờ worker."
            onOpenDetail={onOpenDetail}
            onForceExportNow={onForceExportNow}
            onRetryExport={onRetryExport}
            forcingRecordingId={forcingRecordingId}
            retryingRecordingId={retryingRecordingId}
          />

          <Divider />

          <ExportQueueSection
            title="Hẹn giờ / chờ retry"
            hint="Bao gồm bản ghi chờ đến khung giờ export hoặc đang delay để thử lại."
            items={queueData.delayedItems}
            emptyMessage="Hiện không có job delayed nào trong queue."
            onOpenDetail={onOpenDetail}
            onForceExportNow={onForceExportNow}
            onRetryExport={onRetryExport}
            forcingRecordingId={forcingRecordingId}
            retryingRecordingId={retryingRecordingId}
          />

          {queueData.syncingItems.length ? (
            <>
              <Divider />
              <ExportQueueSection
                title="Đang đồng bộ queue"
                hint="Các bản ghi này vừa chuyển trạng thái và đang chờ queue phản ánh đầy đủ."
                items={queueData.syncingItems}
                emptyMessage="Không có bản ghi nào đang chờ đồng bộ queue."
                onOpenDetail={onOpenDetail}
                onForceExportNow={onForceExportNow}
                onRetryExport={onRetryExport}
                forcingRecordingId={forcingRecordingId}
                retryingRecordingId={retryingRecordingId}
              />
            </>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onRefresh} startIcon={<RefreshIcon />}>
          Làm mới
        </Button>
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
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);
  const [retryingRecordingId, setRetryingRecordingId] = useState(null);
  const [forcingRecordingId, setForcingRecordingId] = useState(null);
  const [queueingCommentaryId, setQueueingCommentaryId] = useState(null);
  const [rerenderingCommentaryId, setRerenderingCommentaryId] = useState(null);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const deferredSearch = useDeferredValue(search);
  const monitorPollingInterval = socketOn ? 0 : 15000;
  const realtimeTimerRef = useRef(null);
  const lastRealtimeRefetchAtRef = useRef(0);

  const rowsQueryArgs = useMemo(
    () => ({
      section: "export",
      status: statusFilter,
      q: deferredSearch.trim(),
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
    }),
    [deferredSearch, paginationModel.page, paginationModel.pageSize, statusFilter]
  );

  const {
    data: summaryData,
    error: summaryError,
    isLoading: isSummaryInitialLoading,
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
  } = useGetLiveRecordingMonitorSummaryQuery(
    {
      section: "export",
    },
    {
      pollingInterval: monitorPollingInterval,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
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
  const {
    data: exportQueueData,
    error: exportQueueError,
    isFetching: isExportQueueFetching,
    refetch: refetchExportQueue,
  } = useGetLiveRecordingMonitorExportQueueQuery(undefined, {
    pollingInterval: monitorPollingInterval,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [retryExport] = useRetryLiveRecordingExportMutation();
  const [forceExport] = useForceLiveRecordingExportMutation();
  const [queueAiCommentary] = useQueueLiveRecordingAiCommentaryMutation();
  const [rerenderAiCommentary] = useRerenderLiveRecordingAiCommentaryMutation();
  const {
    data: workerHealth,
    isError: workerHealthError,
    refetch: refetchWorkerHealth,
  } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: socketOn ? 60000 : 30000,
    refetchOnMountOrArgChange: true,
  });
  const {
    data: commentaryMonitor,
    isFetching: isCommentaryMonitorFetching,
    isError: commentaryMonitorError,
    refetch: refetchCommentaryMonitor,
  } = useGetLiveRecordingAiCommentaryMonitorQuery(undefined, {
    pollingInterval: socketOn ? 0 : 15000,
    refetchOnMountOrArgChange: true,
  });

  const rows = useMemo(() => {
    return Array.isArray(rowsData?.rows) ? rowsData.rows : [];
  }, [rowsData?.rows]);
  const summary = summaryData?.summary || {};
  const count = Number(rowsData?.count || 0);
  const exportQueueRows = useMemo(() => {
    return Array.isArray(exportQueueData?.rows) ? exportQueueData.rows : [];
  }, [exportQueueData?.rows]);
  const isInitialLoading = isRowsInitialLoading || isSummaryInitialLoading;
  const isRefreshing =
    (isRowsFetching && !isRowsInitialLoading) ||
    (isSummaryFetching && !isSummaryInitialLoading) ||
    isExportQueueFetching;
  const queryError = rowsError || summaryError;

  const refreshRealtime = useCallback(async () => {
    await Promise.allSettled([
      refetchRows(),
      refetchSummary(),
      refetchExportQueue(),
      refetchWorkerHealth(),
      refetchCommentaryMonitor(),
    ]);
  }, [
    refetchCommentaryMonitor,
    refetchExportQueue,
    refetchRows,
    refetchSummary,
    refetchWorkerHealth,
  ]);

  const refreshAll = useCallback(async () => {
    await refreshRealtime();
  }, [refreshRealtime]);

  const scheduleRealtimeRefetch = useCallback(
    (delayMs = 200) => {
      const now = Date.now();
      const gapMs = Math.max(0, 1500 - (now - lastRealtimeRefetchAtRef.current));
      const waitMs = Math.max(delayMs, gapMs);
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeRefetchAtRef.current = Date.now();
        void refreshRealtime();
      }, waitMs);
    },
    [refreshRealtime]
  );
  const selectedRowRecordingIdRef = useRef("");
  const selectedRowDetailRefetchRef = useRef(() => Promise.resolve());

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
    setPaginationModel((current) =>
      current.page === 0 ? current : { ...current, page: 0 }
    );
  }, [deferredSearch, statusFilter]);

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

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setSocketOn(true);
      try {
        socket.emit("recordings-v2:watch");
      } catch (_) {}
      void refreshAll();
    };
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = (payload = {}) => {
      const changedRecordingIds = Array.isArray(payload?.recordingIds)
        ? payload.recordingIds.map((value) => String(value || "").trim())
        : [];
      if (
        selectedRowRecordingIdRef.current &&
        changedRecordingIds.includes(selectedRowRecordingIdRef.current)
      ) {
        void selectedRowDetailRefetchRef.current?.();
      }
      scheduleRealtimeRefetch();
    };

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
  }, [
    socket,
    refreshAll,
    scheduleRealtimeRefetch,
  ]);

  const selectedRow = useMemo(
    () =>
      rows.find((row) => row.id === selectedRowId) ||
      exportQueueRows.find((row) => row.id === selectedRowId) ||
      null,
    [exportQueueRows, rows, selectedRowId]
  );
  const {
    data: selectedRowDetailData,
    error: selectedRowDetailError,
    isFetching: isSelectedRowDetailFetching,
    refetch: refetchSelectedRowDetail,
  } = useGetLiveRecordingMonitorRowQuery(selectedRow?.recordingId, {
    skip: !selectedRow?.recordingId,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const selectedRowDetail = selectedRowDetailData?.row || null;
  const selectedRowForDialog = selectedRowDetail || selectedRow;
  const selectedRowDetailLoading = Boolean(
    selectedRow && !selectedRowDetail && isSelectedRowDetailFetching
  );

  useEffect(() => {
    selectedRowRecordingIdRef.current = String(selectedRow?.recordingId || "").trim();
    selectedRowDetailRefetchRef.current = refetchSelectedRowDetail;
  }, [refetchSelectedRowDetail, selectedRow?.recordingId]);

  const effectiveWorkerHealth = workerHealth || null;

  const currentExportRow = useMemo(() => {
    const currentRecordingId = effectiveWorkerHealth?.worker?.currentRecordingId;
    if (!currentRecordingId) return null;
    return exportQueueRows.find((row) => row.recordingId === currentRecordingId) || null;
  }, [effectiveWorkerHealth, exportQueueRows]);
  const queueSnapshot = exportQueueData?.queueSnapshot || null;

  const workerAlertVisible =
    ["stale", "offline"].includes(effectiveWorkerHealth?.status || "offline") &&
    Number(summary.exporting || 0) > 0;
  const commentaryGlobalEnabled = Boolean(commentaryMonitor?.settings?.enabled);
  const commentaryAutoEnabled = Boolean(commentaryMonitor?.settings?.autoGenerateAfterDriveUpload);
  const activeCommentaryRecordingId = String(
    commentaryMonitor?.activeJob?.recordingId || ""
  ).trim();
  const { data: commentaryCurrentRowData } = useGetLiveRecordingMonitorRowQuery(
    activeCommentaryRecordingId,
    {
      skip: !activeCommentaryRecordingId,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
  const commentaryCurrentRow = commentaryCurrentRowData?.row || null;

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      toast.success("Đã đưa video vào hàng đợi retry export.");
      await refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể retry export.");
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExportNow = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      toast.success("Đã force export ngay.");
      await refreshAll();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể force export.");
    } finally {
      setForcingRecordingId(null);
    }
  };

  const handleOpenQueueDetail = useCallback((row) => {
    if (!row?.id) return;
    setQueueDialogOpen(false);
    setSelectedRowId(row.id);
  }, []);

  const handleQueueCommentary = async (recordingId, forceRerender = false) => {
    try {
      if (forceRerender) {
        setRerenderingCommentaryId(recordingId);
        await rerenderAiCommentary(recordingId).unwrap();
        toast.success("Đã đưa job render lại BLV AI vào hàng đợi.");
      } else {
        setQueueingCommentaryId(recordingId);
        await queueAiCommentary(recordingId).unwrap();
        toast.success("Đã đưa job BLV AI vào hàng đợi.");
      }
      await refreshAll();
    } catch (error) {
      toast.error(
        error?.data?.message ||
          error?.error ||
          (forceRerender
            ? "Không thể render lại BLV AI."
            : "Không thể đưa job BLV AI vào hàng đợi.")
      );
    } finally {
      setQueueingCommentaryId(null);
      setRerenderingCommentaryId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "status",
        headerName: "Trạng thái",
        minWidth: 130,
        renderCell: ({ row }) => (
          <StatusChip status={row.status} pipelineStage={row.exportPipeline?.stage} />
        ),
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
        field: "pipeline",
        headerName: "Export / Worker",
        minWidth: 280,
        sortable: false,
        renderCell: ({ row }) => {
          const stage = row.exportPipeline?.stage || "";
          const isStale = ["stale_no_job", "worker_offline"].includes(stage);
          const wasAutoRequeued = row.exportPipeline?.forceReason === "stale_reconciliation";
          const stageLabel =
            PIPELINE_STAGE_LABELS[stage] ||
            row.exportPipeline?.label ||
            row.statusMeta?.label ||
            row.status;
          return (
            <Stack spacing={0.35} sx={{ py: 0.6 }}>
              <Typography
                variant="body2"
                fontWeight={700}
                color={isStale ? "warning.main" : "text.primary"}
              >
                {stageLabel}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: "normal" }}>
                {row.exportPipeline?.detail ||
                  (row.scheduledExportAt
                    ? `Lên lịch ${formatDateTime(row.scheduledExportAt)}`
                    : "-")}
              </Typography>
              {wasAutoRequeued ? (
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label="Tự động xếp lại hàng đợi"
                  sx={{ width: "fit-content" }}
                />
              ) : null}
              {isStale ? (
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                  ⚠ Job BullMQ bị mất, cần thử lại
                </Typography>
              ) : null}
            </Stack>
          );
        },
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
          </Stack>
        ),
      },
      {
        field: "drive",
        headerName: "Drive / Phát",
        minWidth: 360,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ py: 0.6 }}
            flexWrap="wrap"
          >
            <ExportLinks row={row} />
            {canRetryExport(row) ? (
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={Boolean(retryingRecordingId) || Boolean(forcingRecordingId)}
                onClick={(event) => {
                  event.stopPropagation();
                  handleRetryExport(row.recordingId);
                }}
                startIcon={
                  retryingRecordingId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                {retryingRecordingId === row.recordingId ? "Đang thử lại..." : "Thử lại export"}
              </Button>
            ) : null}
            {canForceExportNow(row) ? (
              <Button
                size="small"
                color="secondary"
                variant="outlined"
                disabled={Boolean(retryingRecordingId) || Boolean(forcingRecordingId)}
                onClick={(event) => {
                  event.stopPropagation();
                  handleForceExportNow(row.recordingId);
                }}
                startIcon={
                  forcingRecordingId === row.recordingId ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                {forcingRecordingId === row.recordingId ? "Đang xuất..." : "Xuất ngay"}
              </Button>
            ) : null}
          </Stack>
        ),
      },
      {
        field: "aiCommentary",
        headerName: "BLV AI",
        minWidth: 330,
        sortable: false,
        renderCell: ({ row }) => {
          const commentary = row.aiCommentary || {};
          const queueingThisRow = queueingCommentaryId === row.recordingId;
          const rerenderingThisRow = rerenderingCommentaryId === row.recordingId;
          const rowReady = row.status === "ready";
          const busy = Boolean(
            retryingRecordingId ||
              forcingRecordingId ||
              queueingCommentaryId ||
              rerenderingCommentaryId
          );
          const canQueue =
            commentaryGlobalEnabled &&
            rowReady &&
            !["queued", "running"].includes(String(commentary.status || "").toLowerCase());
          const canRerender = commentaryGlobalEnabled && rowReady;

          return (
            <Stack spacing={0.6} sx={{ py: 0.7 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                <CommentaryStatusChip commentary={commentary} />
                {commentary.ready && commentary.dubbedPlaybackUrl ? (
                  <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={commentary.dubbedPlaybackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<PlayCircleOutlineIcon />}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Mở
                  </Button>
                ) : null}
              </Stack>

              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canQueue || busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleQueueCommentary(row.recordingId, false);
                  }}
                  startIcon={
                    queueingThisRow ? <CircularProgress size={14} color="inherit" /> : null
                  }
                >
                  {queueingThisRow ? "Đang xếp hàng..." : "Lồng tiếng AI"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  disabled={!canRerender || busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleQueueCommentary(row.recordingId, true);
                  }}
                  startIcon={
                    rerenderingThisRow ? <CircularProgress size={14} color="inherit" /> : null
                  }
                >
                  {rerenderingThisRow ? "Đang render lại..." : "Render lại"}
                </Button>
              </Stack>

              <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
                {!commentaryGlobalEnabled
                  ? "Đang tắt global trong Cài đặt hệ thống."
                  : !rowReady
                  ? "Chỉ chạy khi recording đã ready."
                  : commentary.error || commentary.renderedAt
                  ? commentary.error || `Xong ${formatRelative(commentary.renderedAt)}`
                  : commentaryAutoEnabled
                  ? "Auto sẽ tự đưa vào hàng đợi khi video lên Drive."
                  : "Auto đang tắt, có thể chạy tay."}
              </Typography>
            </Stack>
          );
        },
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
              row.exportPipeline?.detail ||
              (row.status === "ready" && !row.driveRawUrl && !row.drivePreviewUrl
                ? "Đã sẵn sàng nhưng thiếu link Drive"
                : "-")}
          </Typography>
        ),
      },
    ],
    [
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
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Giám sát Máy chủ Ghi hình - Drive
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Theo dõi tiến trình worker export, backlog lên Drive, và các bản ghi đã sẵn sàng
                phát lại
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket mất kết nối"}
              />
              <WorkerStatusChip health={effectiveWorkerHealth} />
              <Button variant="outlined" onClick={() => setQueueDialogOpen(true)}>
                Hàng chờ export
              </Button>
              <Button
                component={RouterLink}
                to="/admin/live-recording-ai-commentary-monitor"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
              >
                BLV AI realtime
              </Button>
              <Button
                variant="outlined"
                startIcon={
                  isRefreshing || isCommentaryMonitorFetching ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
                onClick={refreshAll}
                disabled={isInitialLoading}
              >
                Làm mới
              </Button>
            </Stack>
          </Stack>

          {workerAlertVisible ? (
            <Alert severity="warning">
              Worker export không còn heartbeat nhưng vẫn còn recording đang xuất.
            </Alert>
          ) : null}

          {queryError ? (
            <Alert severity="error">Không tải được dữ liệu export bản ghi.</Alert>
          ) : null}
          {exportQueueError ? (
            <Alert severity="warning">
              Không tải được snapshot hàng chờ export. Bảng chính vẫn tiếp tục hoạt động.
            </Alert>
          ) : null}
          {workerHealthError && !effectiveWorkerHealth ? (
            <Alert severity="error">Không tải được trạng thái worker.</Alert>
          ) : null}
          {commentaryMonitorError ? (
            <Alert severity="error">Không tải được monitor AI commentary.</Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Worker"
                value={effectiveWorkerHealth?.status || "offline"}
                hint={`Heartbeat ${formatRelative(effectiveWorkerHealth?.lastHeartbeatAt)}`}
                color={
                  effectiveWorkerHealth?.status === "busy"
                    ? "info.main"
                    : effectiveWorkerHealth?.alive
                    ? "success.main"
                    : effectiveWorkerHealth?.status === "stale"
                    ? "warning.main"
                    : "text.primary"
                }
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Job hiện tại"
                value={
                  currentExportRow?.matchCode ||
                  effectiveWorkerHealth?.worker?.currentRecordingId ||
                  "idle"
                }
                hint={currentExportRow?.participantsLabel || "Không có job export hiện tại"}
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Hàng đợi đêm"
                value={summary.pendingExportWindow || 0}
                hint="Đang đợi khung giờ export đêm"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Đang xuất"
                value={summary.exporting || 0}
                hint="Đang ghép và đẩy lên Drive"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Sẵn sàng"
                value={summary.ready || 0}
                hint="Đã có file trên Drive"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Thất bại"
                value={summary.failed || 0}
                hint="Cần kiểm tra lỗi export"
                color="error.main"
              />
            </Grid>
          </Grid>

          <WorkerHealthPanel health={effectiveWorkerHealth} currentExportRow={currentExportRow} />
          <AiCommentaryPanel monitor={commentaryMonitor} currentRow={commentaryCurrentRow} />

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
                    <MenuItem value="pending_export_window">Hàng đợi đêm</MenuItem>
                    <MenuItem value="ALL">Tất cả trạng thái</MenuItem>
                    <MenuItem value="exporting">Đang xuất</MenuItem>
                    <MenuItem value="ready">Sẵn sàng</MenuItem>
                    <MenuItem value="failed">Lỗi</MenuItem>
                  </TextField>
                </Stack>

                <DataGrid
                  getRowHeight={() => "auto"}
                  autoHeight
                  rows={rows}
                  columns={columns}
                  loading={isRowsInitialLoading && rows.length === 0}
                  disableRowSelectionOnClick
                  pagination
                  paginationMode="server"
                  rowCount={count}
                  page={paginationModel.page}
                  pageSize={paginationModel.pageSize}
                  rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                  initialState={{
                    sorting: { sortModel: [{ field: "updatedAt", sort: "desc" }] },
                  }}
                  onRowClick={(params) => setSelectedRowId(params.row.id)}
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
                    {`Trang ${paginationModel.page + 1}/${Math.max(
                      1,
                      Math.ceil(count / paginationModel.pageSize)
                    )}`}
                  </Typography>
                </Stack>

              </Stack>
            </CardContent>
          </Card>

          <ExportQueueDialog
            open={queueDialogOpen}
            onClose={() => setQueueDialogOpen(false)}
            onRefresh={refreshAll}
            onOpenDetail={handleOpenQueueDetail}
            onForceExportNow={handleForceExportNow}
            onRetryExport={handleRetryExport}
            forcingRecordingId={forcingRecordingId}
            retryingRecordingId={retryingRecordingId}
            rows={exportQueueRows}
            currentExportRow={currentExportRow}
            queueSnapshot={queueSnapshot}
            generatedAt={exportQueueData?.generatedAt}
          />

          <RecordingDetailDialog
            row={selectedRowForDialog}
            open={Boolean(selectedRow)}
            onClose={() => setSelectedRowId(null)}
            onForceExportNow={handleForceExportNow}
            onRetryExport={handleRetryExport}
            forcingRecordingId={forcingRecordingId}
            retryingRecordingId={retryingRecordingId}
            loadingDetail={selectedRowDetailLoading}
            detailError={selectedRowDetailError}
          />
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
