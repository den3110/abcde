/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
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

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useForceLiveRecordingExportMutation,
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useGetLiveRecordingMonitorQuery,
  useGetLiveRecordingWorkerHealthQuery,
  useQueueLiveRecordingAiCommentaryMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
  useRetryLiveRecordingExportMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

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

function RecordingDetailDialog({ row, open, onClose }) {
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
  const [retryingRecordingId, setRetryingRecordingId] = useState(null);
  const [forcingRecordingId, setForcingRecordingId] = useState(null);
  const [queueingCommentaryId, setQueueingCommentaryId] = useState(null);
  const [rerenderingCommentaryId, setRerenderingCommentaryId] = useState(null);

  const { data: initialSnapshot, isFetching, isError, refetch } = useGetLiveRecordingMonitorQuery();
  const [retryExport] = useRetryLiveRecordingExportMutation();
  const [forceExport] = useForceLiveRecordingExportMutation();
  const [queueAiCommentary] = useQueueLiveRecordingAiCommentaryMutation();
  const [rerenderAiCommentary] = useRerenderLiveRecordingAiCommentaryMutation();
  const {
    data: workerHealth,
    isError: workerHealthError,
    refetch: refetchWorkerHealth,
  } = useGetLiveRecordingWorkerHealthQuery(undefined, {
    pollingInterval: 30000,
    refetchOnMountOrArgChange: true,
  });
  const {
    data: commentaryMonitor,
    isFetching: isCommentaryMonitorFetching,
    isError: commentaryMonitorError,
    refetch: refetchCommentaryMonitor,
  } = useGetLiveRecordingAiCommentaryMonitorQuery(undefined, {
    pollingInterval: 15000,
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
      void refetchCommentaryMonitor();
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
  }, [socket, refetch, refetchCommentaryMonitor]);

  const rows = useMemo(() => {
    const sourceRows = snapshot?.rows || [];
    return sourceRows.filter((row) =>
      ["pending_export_window", "exporting", "ready", "failed"].includes(row.status)
    );
  }, [snapshot]);

  const summary = useMemo(() => {
    const pendingWindow = rows.filter((row) => row.status === "pending_export_window");
    const exporting = rows.filter((row) => row.status === "exporting");
    const ready = rows.filter((row) => row.status === "ready");
    const failed = rows.filter((row) => row.status === "failed");
    return {
      pendingWindow,
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
        row.exportPipeline?.label,
        row.exportPipeline?.detail,
        row.error,
        row.driveFileId,
        row.aiCommentary?.status,
        row.aiCommentary?.error,
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
  const commentaryGlobalEnabled = Boolean(commentaryMonitor?.settings?.enabled);
  const commentaryAutoEnabled = Boolean(commentaryMonitor?.settings?.autoGenerateAfterDriveUpload);
  const commentaryCurrentRow = useMemo(() => {
    const activeRecordingId = commentaryMonitor?.activeJob?.recordingId;
    if (!activeRecordingId) return null;
    return rows.find((row) => row.recordingId === activeRecordingId) || null;
  }, [commentaryMonitor, rows]);

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      refetch();
      refetchWorkerHealth();
    } catch (_) {
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExportNow = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      refetch();
      refetchWorkerHealth();
    } catch (_) {
    } finally {
      setForcingRecordingId(null);
    }
  };

  const refreshAll = () => {
    refetch();
    refetchWorkerHealth();
    refetchCommentaryMonitor();
  };

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
      refreshAll();
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
              <WorkerStatusChip health={workerHealth} />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshAll}
                disabled={isFetching || isCommentaryMonitorFetching}
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

          {isError ? (
            <Alert severity="error">Không tải được dữ liệu export bản ghi.</Alert>
          ) : null}
          {workerHealthError ? <Alert severity="error">Không tải được trạng thái worker.</Alert> : null}
          {commentaryMonitorError ? (
            <Alert severity="error">Không tải được monitor AI commentary.</Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
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
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Job hiện tại"
                value={
                  currentExportRow?.matchCode || workerHealth?.worker?.currentRecordingId || "idle"
                }
                hint={currentExportRow?.participantsLabel || "Không có job export hiện tại"}
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Hàng đợi đêm"
                value={summary.pendingWindow.length}
                hint="Đang đợi khung giờ export đêm"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Đang xuất"
                value={summary.exporting.length}
                hint="Đang ghép và đẩy lên Drive"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Sẵn sàng"
                value={summary.ready.length}
                hint="Đã có file trên Drive"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Thất bại"
                value={summary.failed.length}
                hint="Cần kiểm tra lỗi export"
                color="error.main"
              />
            </Grid>
          </Grid>

          <WorkerHealthPanel health={workerHealth} currentExportRow={currentExportRow} />
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
