import React, { useState, useCallback, useMemo } from "react";
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ImageIcon from "@mui/icons-material/Image";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { toast } from "react-toastify";

import {
  useGetNewsImageStatsQuery,
  useBackfillNewsImagesMutation,
  useCleanupGatewayImagesMutation,
  useQueueNewsImageRegenerationJobMutation,
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

function ImageThumb({ url }) {
  const [broken, setBroken] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/")) {
      const base = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
      return `${base.replace(/\/api\/?$/, "")}${url}`;
    }
    return url;
  }, [url]);

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
      alt="thumb"
      onError={() => setBroken(true)}
      sx={{
        width: 56,
        height: 36,
        objectFit: "cover",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
      }}
    />
  );
}

ImageThumb.propTypes = {
  url: PropTypes.string,
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

export default function NewsImageMonitorPage() {
  const [filters, setFilters] = useState({
    page: 1,
    imageFilter: "",
    origin: "",
    keyword: "",
  });
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, isFetching, refetch } = useGetNewsImageStatsQuery(filters, {
    pollingInterval: 15000,
    refetchOnMountOrArgChange: true,
  });

  const [backfillImages, { isLoading: isBackfilling }] = useBackfillNewsImagesMutation();
  const [cleanupImages, { isLoading: isCleaning }] = useCleanupGatewayImagesMutation();
  const [queueImageRegenerationJob, { isLoading: isQueueingRegeneration }] =
    useQueueNewsImageRegenerationJobMutation();

  const summary = data?.summary || {};
  const items = data?.items || [];
  const pages = data?.pages || 1;
  const regeneration = data?.regeneration || {};
  const activeRegenJob = regeneration.activeJob || null;
  const recentRegenJobs = Array.isArray(regeneration.recentJobs) ? regeneration.recentJobs : [];
  const aiHealth = regeneration.aiHealth || null;

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
                        color={activeRegenJob.state === "processing" ? "info" : "warning"}
                        label={
                          activeRegenJob.state === "processing"
                            ? "Đang gen ảnh"
                            : activeRegenJob.state === "cooldown"
                            ? "Đang chờ lượt tiếp theo"
                            : "Đang xếp hàng"
                        }
                      />
                      <Chip
                        variant="outlined"
                        label={`${activeRegenJob.completedItems}/${activeRegenJob.totalItems} xong`}
                      />
                      {activeRegenJob.cooldownRemainingMs > 0 ? (
                        <Chip
                          variant="outlined"
                          label={`Còn ${formatRelativeTime(activeRegenJob.nextRunAt)}`}
                        />
                      ) : null}
                    </Stack>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={activeRegenJob.progressPercent || 0}
                    sx={{ height: 8, borderRadius: 999 }}
                  />

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <Typography variant="caption" color="text.secondary">
                      Progress: {activeRegenJob.progressPercent || 0}% • Completed{" "}
                      {activeRegenJob.completedItems || 0} • Failed{" "}
                      {activeRegenJob.failedItems || 0} • Pending {activeRegenJob.queuedItems || 0}
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
                        <ImageThumb url={article.heroImageUrl} />
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
      </Box>
    </DashboardLayout>
  );
}
