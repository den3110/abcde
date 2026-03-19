import React, { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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

export default function NewsImageMonitorPage() {
  const [filters, setFilters] = useState({
    page: 1,
    imageFilter: "",
    origin: "",
    keyword: "",
  });
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, isFetching, refetch } = useGetNewsImageStatsQuery(filters);

  const [backfillImages, { isLoading: isBackfilling }] = useBackfillNewsImagesMutation();
  const [cleanupImages, { isLoading: isCleaning }] = useCleanupGatewayImagesMutation();

  const summary = data?.summary || {};
  const items = data?.items || [];
  const pages = data?.pages || 1;

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handleSearch = useCallback(() => {
    handleFilterChange("keyword", searchText.trim());
  }, [searchText, handleFilterChange]);

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

        {/* Articles table */}
        <Paper sx={{ overflow: "hidden" }}>
          <TableContainer sx={{ maxHeight: 540 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 80 }}>Ảnh</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Tiêu đề</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>Origin</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 160 }}>Nguồn ảnh</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>Trạng thái</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>Ngày tạo</TableCell>
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
                              maxWidth: 280,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {article.title || "(Không tiêu đề)"}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" color="text.secondary">
                          {article.slug}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={article.origin}
                          color={article.origin === "generated" ? "primary" : "default"}
                          variant="outlined"
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
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={article.status}
                          color={article.status === "published" ? "success" : "warning"}
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
