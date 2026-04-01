import React, { useState, useCallback, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ImageIcon from "@mui/icons-material/Image";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { toast } from "react-toastify";

import {
  useGetNewsImageStatsQuery,
  useBackfillNewsImagesMutation,
  useCleanupGatewayImagesMutation,
  useQueueNewsImageRegenerationJobMutation,
  useUpdateSeoNewsImageSettingsMutation,
} from "slices/newsImageAdminApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const IMAGE_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chưa có ảnh" },
  { value: "has-image", label: "Đã có ảnh" },
  { value: "ai-generated", label: "AI Generated" },
];

const ORIGIN_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "external", label: "External (crawl)" },
  { value: "generated", label: "Generated (AI)" },
];

const originChipColor = {
  "generated-gateway": "success",
  external: "info",
  none: "default",
  other: "warning",
};

const NEWS_IMAGE_TABLE_MIN_WIDTH = 1210;

const TABLE_HEADER_CELL_SX = {
  fontWeight: 600,
  whiteSpace: "nowrap",
  wordBreak: "keep-all",
};

function SummaryCard({ label, value, icon, color }) {
  return (
    <Paper
      sx={{
        p: 2,
        flex: 1,
        minWidth: 150,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Avatar
        sx={{
          bgcolor: `${color || "primary"}.main`,
          width: 42,
          height: 42,
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="h5" fontWeight={700} lineHeight={1.1}>
          {value ?? "—"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

SummaryCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  icon: PropTypes.node.isRequired,
  color: PropTypes.string.isRequired,
};

function resolveMonitorImageUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) {
    const base = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_URL || "";
    return `${base.replace(/\/api\/?$/, "")}${url}`;
  }
  return url;
}

function ImageThumb({ url, alt = "thumb", onClick }) {
  const [broken, setBroken] = useState(false);
  const resolvedUrl = useMemo(() => resolveMonitorImageUrl(url), [url]);

  if (!resolvedUrl || broken) {
    return (
      <Box
        sx={{
          width: 56,
          height: 36,
          borderRadius: 1,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrokenImageIcon fontSize="small" color="disabled" />
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={resolvedUrl}
      alt={alt}
      onError={() => setBroken(true)}
      onClick={onClick}
      sx={{
        width: 56,
        height: 36,
        objectFit: "cover",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        cursor: onClick ? "zoom-in" : "default",
      }}
    />
  );
}

ImageThumb.propTypes = {
  alt: PropTypes.string,
  onClick: PropTypes.func,
  url: PropTypes.string,
};

function ImagePreviewDialog({ open, imageUrl, title, subtitle, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title || "Xem ảnh"}</DialogTitle>
      <DialogContent dividers>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        ) : null}
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={title || "preview"}
            sx={{
              width: "100%",
              maxHeight: "75vh",
              objectFit: "contain",
              borderRadius: 1,
              bgcolor: "grey.100",
            }}
          />
        ) : (
          <Alert severity="info">Không có ảnh để xem.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

ImagePreviewDialog.propTypes = {
  imageUrl: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  subtitle: PropTypes.string,
  title: PropTypes.string,
};

function classifyImageOrigin(heroImageUrl) {
  if (!heroImageUrl || /^data:image\//i.test(heroImageUrl)) return "none";
  if (/^\/uploads\/public\/seo-news\//.test(heroImageUrl)) return "generated-gateway";
  if (/^https?:\/\//i.test(heroImageUrl)) return "external";
  return "other";
}

function formatRelativeTime(value) {
  if (!value) return "-";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "-";
  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (absMs < minute) return diffMs >= 0 ? "ngay bây giờ" : "vừa xong";
  if (absMs < hour) {
    const minutes = Math.round(absMs / minute);
    return diffMs >= 0 ? `${minutes}p nữa` : `${minutes}p trước`;
  }
  const hours = Math.round(absMs / hour);
  return diffMs >= 0 ? `${hours}h nữa` : `${hours}h trước`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

function formatDurationMs(value) {
  const totalSeconds = Math.max(0, Math.round((Number(value) || 0) / 1000));
  if (!totalSeconds) return "0s";
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds && !hours) parts.push(`${seconds}s`);

  return parts.join(" ");
}

function getLatestGeneratedJobItem(job) {
  const completedItems = Array.isArray(job?.items)
    ? job.items.filter((item) => item?.status === "completed" && item?.resultHeroImageUrl)
    : [];

  if (!completedItems.length) return null;

  return completedItems.sort((a, b) => {
    const aTime = new Date(a?.completedAt || 0).getTime();
    const bTime = new Date(b?.completedAt || 0).getTime();
    return bTime - aTime;
  })[0];
}

function FailedJobItemsDialog({ job, open, onClose }) {
  if (!job) return null;
  const failedItems = (job.items || []).filter((i) => i.status === "failed");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Danh sách ảnh lỗi (Job {job.id.slice(-6)})</DialogTitle>
      <DialogContent dividers>
        {failedItems.length === 0 ? (
          <Typography variant="body2">Không có ảnh nào bị lỗi trong job này.</Typography>
        ) : (
          <Stack spacing={2}>
            {failedItems.map((item, idx) => (
              <Alert severity="error" key={idx} sx={{ alignItems: "flex-start" }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {item.title}
                </Typography>
                <Typography variant="caption" sx={{ display: "block", mb: 0.5, opacity: 0.8 }}>
                  Slug: {item.slug}
                </Typography>
                <Typography variant="body2">
                  <strong>Lỗi:</strong> {item.error || "Không có chi tiết lỗi"}
                </Typography>
              </Alert>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

FailedJobItemsDialog.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.string,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        slug: PropTypes.string,
        status: PropTypes.string,
        error: PropTypes.string,
      })
    ),
  }),
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default function NewsImageMonitorPage() {
  const [filters, setFilters] = useState({
    page: 1,
    imageFilter: "",
    origin: "",
    keyword: "",
  });
  const [searchText, setSearchText] = useState("");
  const [viewFailedJob, setViewFailedJob] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedModelDirty, setSelectedModelDirty] = useState(false);
  const [delaySecondsInput, setDelaySecondsInput] = useState("");
  const [delayDirty, setDelayDirty] = useState(false);
  const [refreshHealthKey, setRefreshHealthKey] = useState(0);

  const { data, isLoading, isFetching, refetch } = useGetNewsImageStatsQuery(
    { ...filters, refreshHealth: refreshHealthKey },
    {
      pollingInterval: 15000,
      refetchOnMountOrArgChange: true,
    }
  );

  const [backfillImages, { isLoading: isBackfilling }] = useBackfillNewsImagesMutation();
  const [cleanupImages, { isLoading: isCleaning }] = useCleanupGatewayImagesMutation();
  const [queueImageRegenerationJob, { isLoading: isQueueingRegeneration }] =
    useQueueNewsImageRegenerationJobMutation();
  const [updateSeoNewsImageSettings, { isLoading: isSavingModel }] =
    useUpdateSeoNewsImageSettingsMutation();

  const summary = data?.summary || {};
  const items = data?.items || [];
  const pages = data?.pages || 1;
  const regeneration = data?.regeneration || {};
  const activeRegenJob = regeneration.activeJob || null;
  const recentRegenJobs = Array.isArray(regeneration.recentJobs) ? regeneration.recentJobs : [];
  const aiHealth = regeneration.aiHealth || null;
  const isRegenPaused = regeneration?.summary?.isPaused === true;
  const hasOpenRegenerationJob =
    Boolean(activeRegenJob) ||
    Number(regeneration?.summary?.queued || 0) > 0 ||
    Number(regeneration?.summary?.running || 0) > 0;
  const availableModels = Array.isArray(aiHealth?.availableModels) ? aiHealth.availableModels : [];
  const selectedRemoteModel = aiHealth?.selectedModel || "";
  const effectiveModel = aiHealth?.effectiveModel || "";
  const configuredIntervalMs = Number(regeneration?.summary?.intervalMs) || 0;
  const configuredIntervalSeconds =
    Number(regeneration?.summary?.intervalSeconds) ||
    Math.max(0, Math.round(configuredIntervalMs / 1000));
  const configuredIntervalLabel = formatDurationMs(configuredIntervalMs);
  const activeJobIntervalMs =
    Number(activeRegenJob?.request?.itemIntervalMs) || configuredIntervalMs;
  const activeJobIntervalLabel = formatDurationMs(activeJobIntervalMs);
  const activeJobLatestGeneratedItem = getLatestGeneratedJobItem(activeRegenJob);
  const activeJobDisplayState =
    isRegenPaused && activeRegenJob?.state !== "processing" ? "paused" : activeRegenJob?.state;
  const selectValue = availableModels.includes(selectedModel) ? selectedModel : "";
  const parsedDelaySeconds = Number(delaySecondsInput);
  const normalizedDelaySeconds = Number.isFinite(parsedDelaySeconds)
    ? Math.max(5, Math.floor(parsedDelaySeconds))
    : null;
  const delayInputInvalid =
    delayDirty && (!Number.isFinite(parsedDelaySeconds) || parsedDelaySeconds < 5);
  const hasModelChange = selectedModelDirty && selectedModel !== selectedRemoteModel;
  const hasDelayChange =
    delayDirty &&
    normalizedDelaySeconds !== null &&
    normalizedDelaySeconds !== configuredIntervalSeconds;
  const hasGatewayConfigChanges = hasModelChange || hasDelayChange;

  useEffect(() => {
    if (selectedModelDirty) return;
    setSelectedModel(selectedRemoteModel || effectiveModel || "");
  }, [effectiveModel, selectedModelDirty, selectedRemoteModel]);

  useEffect(() => {
    if (delayDirty) return;
    setDelaySecondsInput(configuredIntervalSeconds ? String(configuredIntervalSeconds) : "");
  }, [configuredIntervalSeconds, delayDirty]);

  const openImagePreview = useCallback((url, title, subtitle = "") => {
    const resolvedUrl = resolveMonitorImageUrl(url);
    if (!resolvedUrl) return;

    setImagePreview({
      url: resolvedUrl,
      title: title || "Xem ảnh",
      subtitle: subtitle || "",
    });
  }, []);

  const closeImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handleSearch = useCallback(() => {
    handleFilterChange("keyword", searchText.trim());
  }, [searchText, handleFilterChange]);

  const handleQueueRegeneration = useCallback(async () => {
    try {
      const id = toast.info("Đang tạo hàng chờ gen lại ảnh AI...", { autoClose: false });
      const res = await queueImageRegenerationJob({
        imageFilter: filters.imageFilter,
        origin: filters.origin,
        keyword: filters.keyword,
        limit: summary.total || items.length || 30,
      }).unwrap();
      toast.dismiss(id);
      toast.success(
        `Đã tạo job ${res?.job?.id || ""} với ${res?.selectedCount || 0} ảnh trong hàng chờ.`
      );
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || "Tạo hàng chờ gen lại ảnh thất bại.");
    }
  }, [
    filters.imageFilter,
    filters.keyword,
    filters.origin,
    items.length,
    queueImageRegenerationJob,
    refetch,
    summary.total,
  ]);

  const handleBackfill = useCallback(async () => {
    try {
      const id = toast.info("Đang backfill ảnh AI...", { autoClose: false });
      const res = await backfillImages({ count: 5, publish: false }).unwrap();
      toast.dismiss(id);
      toast.success(
        `Backfill xong! Tạo: ${res?.generated ?? 0}, Published: ${res?.published ?? 0}`
      );
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || "Backfill thất bại.");
    }
  }, [backfillImages, refetch]);

  const handleCleanup = useCallback(async () => {
    try {
      const id = toast.info("Đang cleanup source images...", { autoClose: false });
      const res = await cleanupImages({ olderThanMinutes: 30, limit: 100 }).unwrap();
      toast.dismiss(id);
      toast.success(`Cleanup xong! Đã xóa: ${res?.deleted ?? 0}, Bỏ qua: ${res?.skipped ?? 0}`);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || "Cleanup thất bại.");
    }
  }, [cleanupImages, refetch]);

  const handleToggleRegenerationPause = useCallback(async () => {
    const nextPaused = !isRegenPaused;

    try {
      await updateSeoNewsImageSettings({
        imageRegenerationPaused: nextPaused,
      }).unwrap();
      refetch();
      toast.success(
        nextPaused
          ? activeRegenJob?.state === "processing"
            ? "?? b?t t?m d?ng. Worker s? d?ng sau ?nh hi?n t?i."
            : "?? t?m d?ng gen ?nh AI."
          : "?? ti?p t?c gen ?nh AI."
      );
    } catch (err) {
      toast.error(err?.data?.message || "Cập nhật trạng thái gen ảnh thất bại.");
    }
  }, [activeRegenJob?.state, isRegenPaused, refetch, updateSeoNewsImageSettings]);

  const triggerHealthRefresh = useCallback(() => {
    setRefreshHealthKey(Date.now());
  }, []);

  const handleSaveGatewayConfig = useCallback(async () => {
    const payload = {};

    if (hasModelChange) {
      if (!selectedModel) {
        toast.error("Chưa có model để lưu.");
        return;
      }
      payload.imageGenerationModel = selectedModel;
    }

    if (delayDirty) {
      if (!Number.isFinite(parsedDelaySeconds) || parsedDelaySeconds < 5) {
        toast.error("Delay giữa 2 lần gen phải từ 5 giây trở lên.");
        return;
      }
      payload.imageGenerationDelaySeconds = normalizedDelaySeconds;
    }

    if (!Object.keys(payload).length) {
      toast.info("Không có thay đổi để lưu.");
      return;
    }

    try {
      await updateSeoNewsImageSettings(payload).unwrap();
      setSelectedModelDirty(false);
      setDelayDirty(false);
      triggerHealthRefresh();
      refetch();
      toast.success("Đã lưu cấu hình gateway.");
    } catch (err) {
      toast.error(err?.data?.message || "Lưu cấu hình gateway thất bại.");
    }
  }, [
    delayDirty,
    hasModelChange,
    normalizedDelaySeconds,
    parsedDelaySeconds,
    refetch,
    selectedModel,
    triggerHealthRefresh,
    updateSeoNewsImageSettings,
  ]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Quản lý Ảnh AI — Tin tức
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Giám sát trạng thái ảnh bài viết: AI tự gen, crawl OG, chưa có ảnh, v.v.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => {
                triggerHealthRefresh();
                refetch();
                toast.info("Đã tải lại.");
              }}
              disabled={isFetching}
            >
              Reload
            </Button>
            <Button
              variant="contained"
              size="small"
              color="info"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleQueueRegeneration}
              disabled={isQueueingRegeneration}
            >
              {isQueueingRegeneration ? "Đang xếp hàng..." : "Gen lại ảnh AI"}
            </Button>
            <Button
              variant={isRegenPaused ? "contained" : "outlined"}
              size="small"
              color={isRegenPaused ? "success" : "warning"}
              startIcon={isRegenPaused ? <PlayArrowIcon /> : <PauseCircleOutlineIcon />}
              onClick={handleToggleRegenerationPause}
              disabled={isSavingModel || (!hasOpenRegenerationJob && !isRegenPaused)}
            >
              {isSavingModel ? "?ang l?u..." : isRegenPaused ? "Ti?p t?c gen" : "T?m ng?ng gen"}
            </Button>
            <Button
              variant="contained"
              size="small"
              color="secondary"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleBackfill}
              disabled={isBackfilling}
            >
              {isBackfilling ? "Đang chạy..." : "Backfill ảnh AI"}
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              startIcon={<CleaningServicesIcon />}
              onClick={handleCleanup}
              disabled={isCleaning}
            >
              {isCleaning ? "Đang dọn..." : "Cleanup source"}
            </Button>
          </Stack>
        </Stack>

        {/* Summary cards */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
          <SummaryCard
            label="Tổng bài viết"
            value={summary.total}
            icon={<PhotoLibraryIcon />}
            color="primary"
          />
          <SummaryCard
            label="Đã có ảnh"
            value={summary.hasImage}
            icon={<CloudDoneIcon />}
            color="success"
          />
          <SummaryCard
            label="Chưa có ảnh"
            value={summary.pendingImage}
            icon={<HourglassEmptyIcon />}
            color="warning"
          />
          <SummaryCard
            label="AI Generated"
            value={summary.byOrigin?.["generated-gateway"] ?? 0}
            icon={<AutoAwesomeIcon />}
            color="info"
          />
        </Stack>

        {/* Origin breakdown chips */}
        {summary.byOrigin && (
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" alignSelf="center">
              Phân bổ nguồn ảnh:
            </Typography>
            {Object.entries(summary.byOrigin).map(([key, count]) => (
              <Chip
                key={key}
                label={`${key}: ${count}`}
                size="small"
                color={originChipColor[key] || "default"}
                variant="outlined"
              />
            ))}
          </Stack>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Gateway config
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  SEO News image generation đang dùng route image riêng và model global.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Delay hiện tại: {configuredIntervalLabel}.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip variant="outlined" label={`Selected: ${selectedRemoteModel || "-"}`} />
                <Chip
                  color={effectiveModel ? "info" : "default"}
                  label={`Effective: ${effectiveModel || "-"}`}
                />
                <Chip variant="outlined" label={`Delay: ${configuredIntervalLabel}`} />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Connection URL"
                value={aiHealth?.baseUrl || ""}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Models URL"
                value={aiHealth?.modelsUrl || ""}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
              />
            </Stack>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <FormControl
                fullWidth
                size="small"
                disabled={!availableModels.length || isSavingModel}
              >
                <InputLabel>SEO image model</InputLabel>
                <Select
                  value={selectValue}
                  label="SEO image model"
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setSelectedModelDirty(true);
                  }}
                >
                  <MenuItem value="">
                    {availableModels.length ? "Chọn model" : "No model available"}
                  </MenuItem>
                  {availableModels.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="number"
                label="Delay giữa 2 lần gen (giây)"
                value={delaySecondsInput}
                onChange={(e) => {
                  setDelaySecondsInput(e.target.value);
                  setDelayDirty(true);
                }}
                error={delayInputInvalid}
                helperText={
                  delayInputInvalid ? "Tối thiểu 5 giây." : "Áp dụng cho job mới để tránh spam API."
                }
                inputProps={{ min: 5, step: 1 }}
                sx={{ minWidth: { xs: "100%", md: 240 } }}
                disabled={isSavingModel}
              />

              <Button
                variant="contained"
                size="small"
                onClick={handleSaveGatewayConfig}
                disabled={isSavingModel || delayInputInvalid || !hasGatewayConfigChanges}
              >
                {isSavingModel ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </Stack>

            {aiHealth?.selectedModel && aiHealth?.selectedModelAvailable === false ? (
              <Alert severity="warning">
                Saved model &quot;{aiHealth.selectedModel}&quot; không còn nằm trong danh sách
                gateway.
              </Alert>
            ) : null}

            {aiHealth?.modelsMessage ? (
              <Alert
                severity={
                  aiHealth?.modelsStatus === "online"
                    ? "success"
                    : aiHealth?.modelsStatus === "degraded"
                    ? "warning"
                    : "info"
                }
              >
                {aiHealth.modelsMessage}
              </Alert>
            ) : null}
          </Stack>
        </Paper>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Trạng thái ảnh</InputLabel>
              <Select
                value={filters.imageFilter}
                label="Trạng thái ảnh"
                onChange={(e) => handleFilterChange("imageFilter", e.target.value)}
              >
                {IMAGE_FILTERS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Loại bài</InputLabel>
              <Select
                value={filters.origin}
                label="Loại bài"
                onChange={(e) => handleFilterChange("origin", e.target.value)}
              >
                {ORIGIN_FILTERS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Tìm kiếm"
              placeholder="Slug hoặc tiêu đề"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              sx={{ minWidth: 200 }}
            />
            <Button size="small" variant="outlined" onClick={handleSearch}>
              Tìm
            </Button>

            {isFetching && <CircularProgress size={20} thickness={4} />}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Hàng chờ gen lại ảnh AI
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mỗi ảnh được xử lý lần lượt. Sau khi xong 1 ảnh, worker sẽ chờ 2 phút trước khi
                  tới ảnh tiếp theo.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {isRegenPaused ? <Chip color="warning" label="?ang t?m d?ng" /> : null}
                <Chip
                  color={aiHealth?.status === "online" ? "success" : "warning"}
                  label={
                    aiHealth?.status === "online"
                      ? "AI image online"
                      : aiHealth?.status === "misconfigured"
                      ? "AI image chưa cấu hình"
                      : "AI image đang lỗi"
                  }
                />
                <Chip variant="outlined" label={`Latency: ${aiHealth?.latencyMs ?? 0}ms`} />
                <Chip variant="outlined" label={`Delay: ${configuredIntervalLabel}`} />
                <Chip variant="outlined" label={`Queued: ${regeneration?.summary?.queued ?? 0}`} />
                <Chip
                  variant="outlined"
                  label={`Running: ${regeneration?.summary?.running ?? 0}`}
                />
              </Stack>
            </Stack>

            {aiHealth?.message ? (
              <Alert severity={aiHealth?.status === "online" ? "success" : "warning"}>
                {aiHealth.message}
                {aiHealth?.baseUrl ? ` - ${aiHealth.baseUrl}` : ""}
              </Alert>
            ) : null}

            {isRegenPaused ? (
              <Alert severity="info">
                H?ng ch? gen ?nh AI ?ang t?m d?ng. B?m &quot;Ti?p t?c gen&quot; ?? worker ti?p t?c
                xu ly.
              </Alert>
            ) : null}

            {activeRegenJob ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.25}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Job đang hoạt động
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activeRegenJob.currentItem?.title
                          ? `Đang xử lý: ${activeRegenJob.currentItem.title}`
                          : activeRegenJob.nextRunAt
                          ? `Ảnh tiếp theo sẽ vào lúc ${formatDateTime(activeRegenJob.nextRunAt)}`
                          : "Đang đợi worker bắt đầu"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        color={activeJobDisplayState === "processing" ? "info" : "warning"}
                        label={
                          activeJobDisplayState === "processing"
                            ? "Đang gen ảnh"
                            : activeJobDisplayState === "paused"
                            ? "Đang tạm dừng"
                            : activeJobDisplayState === "cooldown"
                            ? "Đang chờ lượt tiếp theo"
                            : "Đang xếp hàng"
                        }
                      />
                      <Chip
                        variant="outlined"
                        label={`${activeRegenJob.completedItems}/${activeRegenJob.totalItems} xong`}
                      />
                      <Chip variant="outlined" label={`Delay: ${activeJobIntervalLabel}`} />
                      {activeRegenJob.cooldownRemainingMs > 0 ? (
                        <Chip
                          variant="outlined"
                          label={`Còn ${formatRelativeTime(activeRegenJob.nextRunAt)}`}
                        />
                      ) : null}
                    </Stack>
                  </Stack>

                  {activeJobLatestGeneratedItem ? (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        bgcolor: "success.50",
                      }}
                    >
                      <ImageThumb
                        url={activeJobLatestGeneratedItem.resultHeroImageUrl}
                        alt={
                          activeJobLatestGeneratedItem.title || activeJobLatestGeneratedItem.slug
                        }
                        onClick={() =>
                          openImagePreview(
                            activeJobLatestGeneratedItem.resultHeroImageUrl,
                            activeJobLatestGeneratedItem.title ||
                              activeJobLatestGeneratedItem.slug ||
                              "Ảnh đã gen gần nhất",
                            activeJobLatestGeneratedItem.completedAt
                              ? `Xong lúc ${formatDateTime(
                                  activeJobLatestGeneratedItem.completedAt
                                )}`
                              : activeJobLatestGeneratedItem.resultImageOrigin ||
                                  "generated-gateway"
                          )
                        }
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          Ảnh đã gen gần nhất
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {activeJobLatestGeneratedItem.title || activeJobLatestGeneratedItem.slug}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activeJobLatestGeneratedItem.completedAt
                            ? `Xong lúc ${formatDateTime(activeJobLatestGeneratedItem.completedAt)}`
                            : activeJobLatestGeneratedItem.resultImageOrigin || "generated-gateway"}
                        </Typography>
                      </Box>
                    </Paper>
                  ) : null}

                  <LinearProgress
                    variant="determinate"
                    value={activeRegenJob.progressPercent || 0}
                    sx={{ height: 8, borderRadius: 999 }}
                  />

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Typography variant="caption" color="text.secondary">
                      Progress: {activeRegenJob.progressPercent || 0}% • Completed{" "}
                      {activeRegenJob.completedItems || 0} •{" "}
                      {activeRegenJob.failedItems > 0 ? (
                        <Box
                          component="span"
                          sx={{
                            color: "error.main",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 600,
                          }}
                          onClick={() => setViewFailedJob(activeRegenJob)}
                        >
                          Failed {activeRegenJob.failedItems}
                        </Box>
                      ) : (
                        `Failed 0`
                      )}{" "}
                      • Pending {activeRegenJob.queuedItems || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tạo lúc: {formatDateTime(activeRegenJob.createdAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lần cập nhật cuối: {formatRelativeTime(activeRegenJob.lastProcessedAt)}
                    </Typography>
                  </Stack>

                  {activeRegenJob.lastError ? (
                    <Alert severity="warning">{activeRegenJob.lastError}</Alert>
                  ) : null}
                </Stack>
              </Paper>
            ) : (
              <Alert severity="info">
                Hiện chưa có job gen lại ảnh AI nào đang chạy. Bấm &quot;Gen lại ảnh AI&quot; để đưa
                các bài generated trong bộ lọc hiện tại vào hàng chờ.
              </Alert>
            )}

            {recentRegenJobs.length ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Job gần đây
                </Typography>
                {recentRegenJobs.map((job) => (
                  <Paper key={job.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.35}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Chip
                            size="small"
                            color={
                              job.status === "completed"
                                ? "success"
                                : job.status === "failed"
                                ? "error"
                                : job.state === "processing"
                                ? "info"
                                : "warning"
                            }
                            label={job.status}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {job.completedItems}/{job.totalItems} đã xử lý
                          </Typography>
                          {job.failedItems > 0 && (
                            <Chip
                              size="small"
                              color="error"
                              variant="outlined"
                              label={`${job.failedItems} lỗi`}
                              onClick={() => setViewFailedJob(job)}
                              sx={{ cursor: "pointer" }}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Tạo: {formatDateTime(job.createdAt)} • Cập nhật:{" "}
                          {formatRelativeTime(job.updatedAt)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {job.lastError ||
                          (job.nextRunAt ? `Next run ${formatRelativeTime(job.nextRunAt)}` : "-")}
                      </Typography>
                    </Stack>
                    {getLatestGeneratedJobItem(job) ? (
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 1.25,
                          p: 1.25,
                          display: "flex",
                          alignItems: "center",
                          gap: 1.25,
                        }}
                      >
                        <ImageThumb
                          url={getLatestGeneratedJobItem(job)?.resultHeroImageUrl}
                          alt={
                            getLatestGeneratedJobItem(job)?.title ||
                            getLatestGeneratedJobItem(job)?.slug
                          }
                          onClick={() =>
                            openImagePreview(
                              getLatestGeneratedJobItem(job)?.resultHeroImageUrl,
                              getLatestGeneratedJobItem(job)?.title ||
                                getLatestGeneratedJobItem(job)?.slug ||
                                "Ảnh đã gen gần nhất",
                              getLatestGeneratedJobItem(job)?.completedAt
                                ? `Xong lúc ${formatDateTime(
                                    getLatestGeneratedJobItem(job)?.completedAt
                                  )}`
                                : getLatestGeneratedJobItem(job)?.resultImageOrigin ||
                                    "generated-gateway"
                            )
                          }
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary">
                            Ảnh đã gen gần nhất
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getLatestGeneratedJobItem(job)?.title ||
                              getLatestGeneratedJobItem(job)?.slug}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getLatestGeneratedJobItem(job)?.completedAt
                              ? `Xong lúc ${formatDateTime(
                                  getLatestGeneratedJobItem(job)?.completedAt
                                )}`
                              : getLatestGeneratedJobItem(job)?.resultImageOrigin ||
                                "generated-gateway"}
                          </Typography>
                        </Box>
                      </Paper>
                    ) : null}
                  </Paper>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        {/* Articles table */}
        <Paper sx={{ overflow: "hidden" }}>
          <TableContainer
            sx={{
              maxHeight: 540,
              overflowX: "auto",
              "& .MuiTableCell-root": {
                verticalAlign: "top",
              },
            }}
          >
            <Table
              stickyHeader
              size="small"
              sx={{
                width: "100%",
                minWidth: NEWS_IMAGE_TABLE_MIN_WIDTH,
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: 96 }} />
                <col style={{ width: 540 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <TableHead
                sx={{
                  "& .MuiTableCell-root": TABLE_HEADER_CELL_SX,
                }}
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Ảnh</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tiêu đề</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Origin</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nguồn ảnh</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Ngày tạo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Không có bài viết nào phù hợp.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((article) => {
                  const imgOrigin = classifyImageOrigin(article.heroImageUrl);
                  return (
                    <TableRow key={article._id} hover>
                      <TableCell>
                        <ImageThumb
                          url={article.heroImageUrl}
                          alt={article.title || article.slug || "thumb"}
                          onClick={() =>
                            openImagePreview(
                              article.heroImageUrl,
                              article.title || article.slug || "Ảnh bài viết",
                              article.slug || ""
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={article.slug || ""}>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            {article.title || "(Không tiêu đề)"}
                          </Typography>
                        </Tooltip>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "block",
                            width: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {article.slug}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={article.origin}
                          color={article.origin === "generated" ? "primary" : "default"}
                          variant="outlined"
                          sx={{ justifyContent: "center" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={
                            imgOrigin === "generated-gateway" ? (
                              <AutoAwesomeIcon fontSize="small" />
                            ) : imgOrigin === "none" ? (
                              <BrokenImageIcon fontSize="small" />
                            ) : (
                              <ImageIcon fontSize="small" />
                            )
                          }
                          label={imgOrigin}
                          color={originChipColor[imgOrigin] || "default"}
                          variant="outlined"
                          sx={{ justifyContent: "center" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={article.status}
                          color={article.status === "published" ? "success" : "warning"}
                          sx={{ justifyContent: "center" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {article.createdAt
                            ? new Date(article.createdAt).toLocaleDateString("vi-VN")
                            : "—"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {pages > 1 && (
            <Stack alignItems="center" py={1.5}>
              <Pagination
                count={pages}
                page={filters.page}
                onChange={(_, p) => setFilters((prev) => ({ ...prev, page: p }))}
                color="primary"
                size="small"
              />
            </Stack>
          )}
        </Paper>

        <ImagePreviewDialog
          open={Boolean(imagePreview?.url)}
          imageUrl={imagePreview?.url || ""}
          title={imagePreview?.title || "Xem ảnh"}
          subtitle={imagePreview?.subtitle || ""}
          onClose={closeImagePreview}
        />

        <FailedJobItemsDialog
          job={viewFailedJob}
          open={Boolean(viewFailedJob)}
          onClose={() => setViewFailedJob(null)}
        />
      </Box>
    </DashboardLayout>
  );
}
