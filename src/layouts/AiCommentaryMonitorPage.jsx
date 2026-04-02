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
  Divider,
  Grid,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "react-toastify";
import { Link as RouterLink } from "react-router-dom";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import useInfinitePagedQuery from "hooks/useInfinitePagedQuery";
import useInfiniteScrollSentinel from "hooks/useInfiniteScrollSentinel";
import {
  useGetLiveRecordingAiCommentaryMonitorQuery,
  useLazyGetLiveRecordingMonitorQuery,
  useQueueLiveRecordingAiCommentaryMutation,
  useRerenderLiveRecordingAiCommentaryMutation,
} from "slices/liveApiSlice";
import {
  useGetSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
} from "slices/settingsApiSlice";

dayjs.extend(relativeTime);

const PAGE_SIZE = 40;

const FILTER_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "processing", label: "Đang chạy / chờ" },
  { value: "ready", label: "Đã xong" },
  { value: "failed", label: "Lỗi" },
  { value: "missing", label: "Ready nhưng chưa có BLV" },
];

const RECORDING_STATUS_META = {
  pending_export_window: { color: "secondary", label: "Chờ khung giờ đêm" },
  exporting: { color: "info", label: "Đang xuất" },
  ready: { color: "success", label: "Drive đã sẵn sàng" },
  failed: { color: "error", label: "Export lỗi" },
};

const AI_COMMENTARY_LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

function normalizeAiGatewayBaseUrl(value = "") {
  let next = String(value || "").trim();
  if (!next) return "";
  next = next.replace(/\/+$/, "");
  next = next.replace(/\/responses$/i, "");
  next = next.replace(/\/models$/i, "");
  next = next.replace(/\/audio\/speech$/i, "");
  return next;
}

function buildAiGatewayModelsUrl(value = "") {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/models` : "";
}

function buildAiGatewayResponsesUrl(value = "") {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/responses` : "";
}

function buildAiGatewaySpeechUrl(value = "") {
  const baseUrl = normalizeAiGatewayBaseUrl(value);
  return baseUrl ? `${baseUrl}/audio/speech` : "";
}

function buildLocalEdgeTtsBaseUrl() {
  if (typeof window === "undefined") return "";
  const origin = String(window.location?.origin || "").trim();
  return origin ? `${origin}/api/ai-tts/v1` : "";
}

function hydrateAiSettings(source) {
  return {
    enabled: source?.liveRecording?.aiCommentary?.enabled ?? false,
    autoGenerateAfterDriveUpload:
      source?.liveRecording?.aiCommentary?.autoGenerateAfterDriveUpload ?? true,
    defaultLanguage: source?.liveRecording?.aiCommentary?.defaultLanguage ?? "vi",
    defaultVoicePreset: source?.liveRecording?.aiCommentary?.defaultVoicePreset ?? "vi_male_pro",
    scriptBaseUrl: source?.liveRecording?.aiCommentary?.scriptBaseUrl ?? "",
    scriptModel: source?.liveRecording?.aiCommentary?.scriptModel ?? "",
    ttsBaseUrl: source?.liveRecording?.aiCommentary?.ttsBaseUrl ?? "",
    ttsModel: source?.liveRecording?.aiCommentary?.ttsModel ?? "",
    defaultTonePreset: source?.liveRecording?.aiCommentary?.defaultTonePreset ?? "professional",
    keepOriginalAudioBed: source?.liveRecording?.aiCommentary?.keepOriginalAudioBed ?? true,
    audioBedLevelDb: source?.liveRecording?.aiCommentary?.audioBedLevelDb ?? -18,
    duckAmountDb: source?.liveRecording?.aiCommentary?.duckAmountDb ?? -12,
  };
}

function formatRelative(ts) {
  if (!ts) return "-";
  return dayjs(ts).fromNow();
}

function formatDateTime(ts) {
  if (!ts) return "-";
  return dayjs(ts).format("DD/MM HH:mm:ss");
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
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

function RecordingStatusChip({ row }) {
  const meta = RECORDING_STATUS_META[row?.status] || {
    color: "default",
    label: row?.status || "Không rõ",
  };
  return <Chip size="small" color={meta.color} label={meta.label} />;
}

function CommentaryStatusChip({ commentary }) {
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

function matchesCommentaryFilter(row, filter) {
  if (filter === "all") return true;

  const status = String(row?.aiCommentary?.status || "").toLowerCase();
  const ready = Boolean(row?.aiCommentary?.ready);

  if (filter === "processing") return ["queued", "running"].includes(status);
  if (filter === "ready") return ready || status === "completed";
  if (filter === "failed") return status === "failed";
  if (filter === "missing") {
    return row?.status === "ready" && !ready && !["queued", "running"].includes(status);
  }

  return true;
}

function getSourcePlaybackUrl(row) {
  return row?.playbackUrl || row?.drivePreviewUrl || row?.driveRawUrl || row?.rawStreamUrl || null;
}

export default function AiCommentaryMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [commentaryFilter, setCommentaryFilter] = useState("all");
  const [aiSettings, setAiSettings] = useState(null);
  const [queueingCommentaryId, setQueueingCommentaryId] = useState(null);
  const [rerenderingCommentaryId, setRerenderingCommentaryId] = useState(null);
  const deferredSearch = useDeferredValue(search);
  const realtimeTimerRef = useRef(null);
  const lastRealtimeRefetchAtRef = useRef(0);
  const [triggerMonitorQuery] = useLazyGetLiveRecordingMonitorQuery();

  const { data: systemSettingsData } = useGetSystemSettingsQuery();
  const [updateSystemSettings, { isLoading: isSavingSettings }] = useUpdateSystemSettingsMutation();

  const queryArgs = useMemo(
    () => ({
      section: "commentary",
      commentary: commentaryFilter,
      q: deferredSearch.trim(),
    }),
    [commentaryFilter, deferredSearch]
  );

  const {
    rows: recordingRows,
    summary,
    count,
    error: recordingError,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refresh: refreshRecordingMonitor,
  } = useInfinitePagedQuery({
    trigger: triggerMonitorQuery,
    baseArgs: queryArgs,
    pageSize: PAGE_SIZE,
    getRowId: (row) => row?.id,
    pollingInterval: socketOn ? 0 : 30000,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    enabled: true,
    hasMore,
    loading: isInitialLoading || isLoadingMore || isRefreshing,
    onLoadMore: loadMore,
  });
  const {
    data: commentaryMonitor,
    isFetching: isCommentaryFetching,
    isError: isCommentaryError,
    refetch: refetchCommentaryMonitor,
  } = useGetLiveRecordingAiCommentaryMonitorQuery(undefined, {
    pollingInterval: 5000,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [queueAiCommentary] = useQueueLiveRecordingAiCommentaryMutation();
  const [rerenderAiCommentary] = useRerenderLiveRecordingAiCommentaryMutation();

  useEffect(() => {
    if (systemSettingsData) {
      setAiSettings(hydrateAiSettings(systemSettingsData));
    }
  }, [systemSettingsData]);

  const scheduleRealtimeRefetch = useCallback(
    (delayMs = 200) => {
      const now = Date.now();
      const gapMs = Math.max(0, 1500 - (now - lastRealtimeRefetchAtRef.current));
      const waitMs = Math.max(delayMs, gapMs);
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeRefetchAtRef.current = Date.now();
        void refreshRecordingMonitor();
        void refetchCommentaryMonitor();
      }, waitMs);
    },
    [refreshRecordingMonitor, refetchCommentaryMonitor]
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
      void refreshRecordingMonitor();
      void refetchCommentaryMonitor();
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
  }, [refreshRecordingMonitor, refetchCommentaryMonitor, scheduleRealtimeRefetch, socket]);

  const recentJobs = Array.isArray(commentaryMonitor?.recentJobs) ? commentaryMonitor.recentJobs : [];
  const activeJob = commentaryMonitor?.activeJob || null;
  const latestJobByRecordingId = useMemo(() => {
    const map = new Map();
    if (activeJob?.recordingId) {
      map.set(activeJob.recordingId, activeJob);
    }
    recentJobs.forEach((job) => {
      if (!job?.recordingId || map.has(job.recordingId)) return;
      map.set(job.recordingId, job);
    });
    return map;
  }, [activeJob, recentJobs]);

  const rows = useMemo(() => {
    return recordingRows
      .filter((row) => {
        const commentaryStatus = String(row?.aiCommentary?.status || "").toLowerCase();
        return (
          row?.status === "ready" ||
          Boolean(row?.aiCommentary?.ready) ||
          ["queued", "running", "failed", "completed"].includes(commentaryStatus)
        );
      })
      .map((row) => ({
        ...row,
        commentaryJob: latestJobByRecordingId.get(row.recordingId) || null,
      }));
  }, [latestJobByRecordingId, recordingRows]);

  const commentaryGlobalEnabled = Boolean(commentaryMonitor?.settings?.enabled);
  const commentaryAutoEnabled = Boolean(commentaryMonitor?.settings?.autoGenerateAfterDriveUpload);
  const gateway = commentaryMonitor?.gatewayHealth || {};
  const commentaryScriptGateway = gateway?.script || {};
  const commentaryTtsGateway = gateway?.tts || {};
  const gatewayOnline = gateway?.overallStatus === "online";
  const gatewayMessage =
    gateway?.overallStatus === "online"
      ? `${gateway?.script?.message || "Script OK"} • ${gateway?.tts?.message || "TTS OK"}`
      : gateway?.script?.message || gateway?.tts?.message || "Gateway chưa sẵn sàng";
  const commentaryScriptModels = Array.isArray(commentaryScriptGateway?.availableModels)
    ? commentaryScriptGateway.availableModels
    : [];
  const commentaryTtsModels = Array.isArray(commentaryTtsGateway?.availableModels)
    ? commentaryTtsGateway.availableModels
    : [];
  const voiceOptions = Array.isArray(commentaryMonitor?.presets?.voice)
    ? commentaryMonitor.presets.voice
    : [];
  const toneOptions = Array.isArray(commentaryMonitor?.presets?.tone)
    ? commentaryMonitor.presets.tone
    : [];

  const refreshAll = () => {
    refreshRecordingMonitor();
    refetchCommentaryMonitor();
  };

  const updateAiSettingsField = (path, value) => {
    setAiSettings((prev) => {
      const next = structuredClone(prev || {});
      const segments = path.split(".");
      let cursor = next;
      for (let i = 0; i < segments.length - 1; i += 1) {
        if (!cursor[segments[i]]) cursor[segments[i]] = {};
        cursor = cursor[segments[i]];
      }
      cursor[segments.at(-1)] = value;
      return next;
    });
  };

  const onAiToggle = (path) => (event) => {
    updateAiSettingsField(path, event.target.checked);
  };

  const onAiChange = (path) => (event) => {
    updateAiSettingsField(path, event.target.value);
  };

  const onAiNumber =
    (path, { min, max, step = 1 } = {}) =>
    (event) => {
      const raw = event.target.value;
      if (raw === "") return;
      let value = Number(raw);
      if (!Number.isFinite(value)) return;
      if (min != null) value = Math.max(min, value);
      if (max != null) value = Math.min(max, value);
      value = Math.round(value / step) * step;
      updateAiSettingsField(path, value);
    };

  const handleSaveAiSettings = async () => {
    try {
      const updated = await updateSystemSettings({
        liveRecording: {
          aiCommentary: aiSettings,
        },
      }).unwrap();
      setAiSettings(hydrateAiSettings(updated));
      toast.success("Đã lưu cấu hình BLV AI.");
      await refetchCommentaryMonitor();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Không thể lưu cấu hình BLV AI.");
    }
  };

  const applyFreeTtsPreset = () => {
    const localBaseUrl = buildLocalEdgeTtsBaseUrl();
    setAiSettings((prev) => ({
      ...(prev || {}),
      ttsBaseUrl: localBaseUrl || prev?.ttsBaseUrl || "",
      ttsModel: "edge-tts-free",
    }));
    toast.success("Đã điền sẵn preset Edge TTS miễn phí. Nhớ bấm Lưu cấu hình.");
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
        field: "match",
        headerName: "Trận đấu",
        minWidth: 320,
        flex: 1.25,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.35} sx={{ py: 0.8 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              {row.matchCode ? (
                <Typography variant="body2" fontWeight={800}>
                  {row.matchCode}
                </Typography>
              ) : null}
              <RecordingStatusChip row={row} />
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
              {row.participantsLabel || "Chưa rõ trận đấu"}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.72 }}>
              {row.competitionLabel || "-"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "commentary",
        headerName: "BLV AI",
        minWidth: 320,
        sortable: false,
        renderCell: ({ row }) => {
          const commentary = row.aiCommentary || {};
          const sourcePlaybackUrl = getSourcePlaybackUrl(row);

          return (
            <Stack spacing={0.6} sx={{ py: 0.8 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                <CommentaryStatusChip commentary={commentary} />
                {commentary?.ready && commentary?.dubbedPlaybackUrl ? (
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
                    Mở BLV
                  </Button>
                ) : null}
                {sourcePlaybackUrl ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    component={Link}
                    href={sourcePlaybackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<OpenInNewIcon />}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Video gốc
                  </Button>
                ) : null}
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: "normal" }}>
                {commentary?.error
                  ? commentary.error
                  : commentary?.renderedAt
                  ? `Xong ${formatRelative(commentary.renderedAt)}`
                  : row?.status !== "ready"
                  ? "Chỉ chạy khi recording đã sẵn sàng trên Drive."
                  : commentaryAutoEnabled
                  ? "Auto đang bật, hệ thống sẽ tự xếp hàng sau khi export xong."
                  : "Auto đang tắt, có thể chạy tay từ tab này."}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "job",
        headerName: "Job realtime",
        minWidth: 300,
        sortable: false,
        renderCell: ({ row }) => {
          const job = row.commentaryJob || null;
          return (
            <Stack spacing={0.55} sx={{ py: 0.8 }}>
              {job ? (
                <>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={job.currentStepLabel || job.status || "Đang xử lý"}
                    />
                    <Chip size="small" variant="outlined" label={`${job.progressPercent || 0}%`} />
                  </Stack>
                  <Typography variant="caption" sx={{ opacity: 0.78, whiteSpace: "normal" }}>
                    {job.lastError
                      ? job.lastError
                      : `${formatDateTime(job.createdAt)} • ${formatRelative(job.updatedAt)}`}
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" sx={{ opacity: 0.72 }}>
                  Chưa có job gần đây cho recording này.
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "actions",
        headerName: "Tác vụ",
        minWidth: 260,
        sortable: false,
        renderCell: ({ row }) => {
          const commentary = row.aiCommentary || {};
          const status = String(commentary?.status || "").toLowerCase();
          const rowReady = row?.status === "ready";
          const busy = Boolean(queueingCommentaryId || rerenderingCommentaryId);
          const queueingThisRow = queueingCommentaryId === row.recordingId;
          const rerenderingThisRow = rerenderingCommentaryId === row.recordingId;
          const canQueue =
            commentaryGlobalEnabled && rowReady && !["queued", "running"].includes(status);
          const canRerender = commentaryGlobalEnabled && rowReady;

          return (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ py: 0.8 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={!canQueue || busy}
                onClick={(event) => {
                  event.stopPropagation();
                  handleQueueCommentary(row.recordingId, false);
                }}
                startIcon={queueingThisRow ? <CircularProgress size={14} color="inherit" /> : null}
              >
                {queueingThisRow ? "Đang xếp..." : "Lồng tiếng AI"}
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
                {rerenderingThisRow ? "Đang render..." : "Render lại"}
              </Button>
            </Stack>
          );
        },
      },
      {
        field: "updatedAt",
        headerName: "Cập nhật",
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack spacing={0.3} sx={{ py: 0.8 }}>
            <Typography variant="body2">{formatRelative(row.updatedAt)}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {formatDateTime(row.updatedAt)}
            </Typography>
          </Stack>
        ),
      },
    ],
    [
      commentaryAutoEnabled,
      commentaryGlobalEnabled,
      queueingCommentaryId,
      rerenderingCommentaryId,
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
                AI bình luận viên realtime
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Tab riêng để theo dõi hàng đợi BLV AI, job đang render và thao tác thủ công theo
                từng recording.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Button
                component={RouterLink}
                to="/admin/live-recording-drive-monitor"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
              >
                Drive Export
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshAll}
                disabled={isInitialLoading || isLoadingMore || isRefreshing || isCommentaryFetching}
              >
                Làm mới
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              color={socketOn ? "success" : "default"}
              label={socketOn ? "Socket recording realtime OK" : "Socket recording mất kết nối"}
            />
            <Chip color="info" variant="outlined" label="Job monitor làm mới mỗi 5 giây" />
            <Chip
              size="small"
              color={commentaryGlobalEnabled ? "success" : "default"}
              label={commentaryGlobalEnabled ? "Global ON" : "Global OFF"}
            />
            <Chip
              size="small"
              color={commentaryAutoEnabled ? "info" : "default"}
              label={commentaryAutoEnabled ? "Auto sau Drive: ON" : "Auto sau Drive: OFF"}
            />
            <Chip
              size="small"
              color={gatewayOnline ? "success" : "warning"}
              label={gatewayMessage}
            />
          </Stack>

          {recordingError ? (
            <Alert severity="error">Không tải được dữ liệu recording để ghép với BLV AI.</Alert>
          ) : null}
          {isCommentaryError ? (
            <Alert severity="error">Không tải được monitor BLV AI realtime.</Alert>
          ) : null}
          {!gatewayOnline ? (
            <Alert severity="warning">
              Gateway BLV AI chưa sẵn sàng. Tab này vẫn cập nhật realtime, nhưng job mới có thể
              không render được cho tới khi gateway ổn định.
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Đang chờ"
                value={commentaryMonitor?.summary?.queued ?? 0}
                hint="Job trong hàng đợi BLV AI"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Đang chạy"
                value={commentaryMonitor?.summary?.running ?? 0}
                hint="Job đang render realtime"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Đã xong"
                value={commentaryMonitor?.summary?.completed ?? 0}
                hint="Tổng job hoàn tất"
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Thất bại"
                value={commentaryMonitor?.summary?.failed ?? 0}
                hint="Job BLV AI lỗi"
                color="error.main"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Recording ready"
                value={summary.ready || 0}
                hint="Nguồn đã sẵn sàng trên Drive"
                color="text.primary"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <SummaryCard
                title="Chưa có BLV"
                value={summary.commentaryMissing || 0}
                hint="Ready nhưng chưa render"
                color="warning.main"
              />
            </Grid>
          </Grid>

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
                      Cấu hình BLV AI
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.72 }}>
                      Chỉnh nhanh ngay tại tab realtime, không cần qua Cài đặt hệ thống.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={handleSaveAiSettings}
                    disabled={!aiSettings || isSavingSettings}
                  >
                    {isSavingSettings ? "Đang lưu..." : "Lưu cấu hình"}
                  </Button>
                </Stack>

                <Alert severity={gatewayOnline ? "success" : "info"}>
                  {isCommentaryFetching
                    ? "Đang tải trạng thái gateway/model..."
                    : `Script: ${commentaryScriptGateway?.message || "-"} | TTS: ${
                        commentaryTtsGateway?.message || "-"
                      }`}
                </Alert>

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={700}>Bật AI lồng tiếng BLV</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Khi tắt, hệ thống sẽ khóa cả auto queue và thao tác render tay.
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!aiSettings?.enabled}
                    onChange={onAiToggle("enabled")}
                    disabled={!aiSettings}
                  />
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={700}>Tự động chạy sau khi video lên Drive</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Chỉ xếp hàng khi recording đã sẵn sàng và trận đấu đã kết thúc.
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!aiSettings?.autoGenerateAfterDriveUpload}
                    onChange={onAiToggle("autoGenerateAfterDriveUpload")}
                    disabled={!aiSettings}
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Ngôn ngữ mặc định"
                    value={aiSettings?.defaultLanguage ?? "vi"}
                    onChange={onAiChange("defaultLanguage")}
                    fullWidth
                  >
                    {AI_COMMENTARY_LANGUAGE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Giọng BLV mặc định"
                    value={aiSettings?.defaultVoicePreset ?? "vi_male_pro"}
                    onChange={onAiChange("defaultVoicePreset")}
                    fullWidth
                  >
                    {voiceOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label || option.id}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Tông giọng mặc định"
                    value={aiSettings?.defaultTonePreset ?? "professional"}
                    onChange={onAiChange("defaultTonePreset")}
                    fullWidth
                  >
                    {toneOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label || option.id}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Script base URL"
                    value={aiSettings?.scriptBaseUrl ?? ""}
                    onChange={onAiChange("scriptBaseUrl")}
                    placeholder="http://localhost:8080/v1"
                    helperText="Danh sách model sẽ được lấy từ `/models`."
                    fullWidth
                  />
                  <TextField
                    label="Script responses URL"
                    value={buildAiGatewayResponsesUrl(aiSettings?.scriptBaseUrl)}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    label="Script models URL"
                    value={buildAiGatewayModelsUrl(aiSettings?.scriptBaseUrl)}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Script model"
                    value={aiSettings?.scriptModel ?? ""}
                    onChange={onAiChange("scriptModel")}
                    helperText={`Effective: ${commentaryScriptGateway?.effectiveModel || "-"}`}
                    fullWidth
                  >
                    <MenuItem value="">Tự động</MenuItem>
                    {commentaryScriptModels.map((modelId) => (
                      <MenuItem key={modelId} value={modelId}>
                        {modelId}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Stack spacing={1.25} sx={{ width: "100%" }}>
                    <Alert severity="info">
                      Nếu chưa có model TTS trả phí, bạn có thể dùng preset miễn phí `Edge TTS`.
                      Máy chạy backend cần có Python package `edge-tts`.
                    </Alert>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button variant="outlined" onClick={applyFreeTtsPreset}>
                        Điền nhanh Edge TTS miễn phí
                      </Button>
                      <Typography variant="caption" sx={{ alignSelf: "center", opacity: 0.72 }}>
                        Preset sẽ điền `TTS model = edge-tts-free` và URL local adapter.
                      </Typography>
                    </Stack>
                    <TextField
                      label="TTS base URL"
                      value={aiSettings?.ttsBaseUrl ?? ""}
                      onChange={onAiChange("ttsBaseUrl")}
                      placeholder="http://localhost:5000/api/ai-tts/v1"
                      helperText="Nếu dùng adapter free local, trỏ vào `/api/ai-tts/v1`. Hệ thống sẽ tự suy ra `/audio/speech` và `/models`."
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    label="TTS speech URL"
                    value={buildAiGatewaySpeechUrl(aiSettings?.ttsBaseUrl)}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="TTS models URL"
                    value={buildAiGatewayModelsUrl(aiSettings?.ttsBaseUrl)}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    select
                    label="TTS model"
                    value={aiSettings?.ttsModel ?? ""}
                    onChange={onAiChange("ttsModel")}
                    helperText={`Effective: ${commentaryTtsGateway?.effectiveModel || "-"}${commentaryTtsModels.includes("edge-tts-free") ? " • Có sẵn Edge TTS miễn phí" : ""}`}
                    fullWidth
                  >
                    <MenuItem value="">Tự động</MenuItem>
                    {commentaryTtsModels.map((modelId) => (
                      <MenuItem key={modelId} value={modelId}>
                        {modelId}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={700}>Giữ tiếng sân làm nền</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Giữ ambience/cổ động ở nền và tự duck xuống khi BLV AI bắt đầu nói.
                    </Typography>
                  </Box>
                  <Switch
                    checked={!!aiSettings?.keepOriginalAudioBed}
                    onChange={onAiToggle("keepOriginalAudioBed")}
                    disabled={!aiSettings}
                  />
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Mức nền gốc (dB)"
                    type="number"
                    inputProps={{ min: -40, max: 0 }}
                    value={aiSettings?.audioBedLevelDb ?? -18}
                    onChange={onAiNumber("audioBedLevelDb", { min: -40, max: 0 })}
                    helperText="Mặc định -18 dB."
                    fullWidth
                  />
                  <TextField
                    label="Mức duck khi BLV nói (dB)"
                    type="number"
                    inputProps={{ min: -30, max: 0 }}
                    value={aiSettings?.duckAmountDb ?? -12}
                    onChange={onAiNumber("duckAmountDb", { min: -30, max: 0 })}
                    helperText="Mặc định -12 dB."
                    fullWidth
                  />
                  <TextField
                    label="Tick worker"
                    value={formatDuration((commentaryMonitor?.meta?.tickMs || 0) / 1000)}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" fontWeight={800}>
                      Job đang hoạt động
                    </Typography>
                    {activeJob ? (
                      <Stack spacing={1.1}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                        >
                          <Stack spacing={0.35}>
                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                              <CommentaryStatusChip commentary={{ status: activeJob.status }} />
                              {activeJob.matchCode ? (
                                <Typography variant="body2" fontWeight={800}>
                                  {activeJob.matchCode}
                                </Typography>
                              ) : null}
                            </Stack>
                            <Typography variant="body2">
                              {activeJob.participantsLabel || "Chưa rõ trận đấu"}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.68 }}>
                              {activeJob.tournamentName || "-"}
                            </Typography>
                          </Stack>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={activeJob.currentStepLabel || activeJob.status || "Đang xử lý"}
                          />
                        </Stack>

                        <LinearProgress
                          variant="determinate"
                          value={Math.max(0, Math.min(100, Number(activeJob.progressPercent) || 0))}
                          sx={{ height: 8, borderRadius: 999 }}
                        />

                        <Grid container spacing={1.2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Bắt đầu
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {formatDateTime(activeJob.startedAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Cập nhật
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {formatRelative(activeJob.updatedAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" sx={{ opacity: 0.65 }}>
                              Worker
                            </Typography>
                            <Typography variant="body2" fontWeight={700}>
                              {activeJob?.worker?.hostname
                                ? `${activeJob.worker.hostname} / ${activeJob.worker.pid || "-"}`
                                : "-"}
                            </Typography>
                          </Grid>
                        </Grid>

                        {activeJob.lastError ? <Alert severity="error">{activeJob.lastError}</Alert> : null}
                        {activeJob.artifacts?.dubbedPlaybackUrl ? (
                          <Button
                            size="small"
                            variant="outlined"
                            component={Link}
                            href={activeJob.artifacts.dubbedPlaybackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<PlayCircleOutlineIcon />}
                          >
                            Mở bản BLV AI
                          </Button>
                        ) : null}
                      </Stack>
                    ) : (
                      <Alert severity="info">
                        Chưa có job BLV AI đang chạy hoặc chờ trong hàng đợi.
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" fontWeight={800}>
                      Job gần đây
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.72 }}>
                      Nhìn nhanh những recording vừa chạy BLV AI để kiểm tra tiến độ và lỗi.
                    </Typography>
                    <Divider />
                    {recentJobs.length ? (
                      <Stack spacing={1}>
                        {recentJobs.slice(0, 6).map((job) => (
                          <Card key={job.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                            <CardContent sx={{ p: 1.2, "&:last-child": { pb: 1.2 } }}>
                              <Stack spacing={0.55}>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                  <CommentaryStatusChip commentary={{ status: job.status }} />
                                  {job.matchCode ? (
                                    <Typography variant="body2" fontWeight={700}>
                                      {job.matchCode}
                                    </Typography>
                                  ) : null}
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${job.progressPercent || 0}%`}
                                  />
                                </Stack>
                                <Typography variant="caption" sx={{ opacity: 0.78 }}>
                                  {job.participantsLabel || "-"}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.72 }}>
                                  {formatDateTime(job.createdAt)} •{" "}
                                  {job.currentStepLabel || job.status || "Đang xử lý"}
                                </Typography>
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
                    ) : (
                      <Alert severity="info">Chưa có lịch sử job BLV AI gần đây.</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

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
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo trận đấu, recording, trạng thái BLV, bước đang chạy..."
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.5 }} />,
                    }}
                    fullWidth
                  />

                  <TextField
                    select
                    value={commentaryFilter}
                    onChange={(event) => setCommentaryFilter(event.target.value)}
                    sx={{ width: { xs: "100%", md: 260 } }}
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <DataGrid
                  getRowHeight={() => "auto"}
                  autoHeight
                  rows={rows}
                  columns={columns}
                  loading={isInitialLoading && rows.length === 0}
                  disableRowSelectionOnClick
                  hideFooter
                  initialState={{
                    sorting: { sortModel: [{ field: "updatedAt", sort: "desc" }] },
                  }}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      alignItems: "stretch",
                      py: 1,
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
                    Hiển thị {rows.length}/{count} recording
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    {hasMore ? "Kéo xuống để tải thêm" : "Đã tải hết dữ liệu"}
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
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
