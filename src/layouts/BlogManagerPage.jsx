import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useCreateBlogPostMutation,
  useDeleteBlogPostMutation,
  useGetBlogPostQuery,
  useGetBlogPostsQuery,
  useUpdateBlogPostMutation,
} from "slices/newsAdminApiSlice";

const EMPTY_FORM = {
  title: "",
  slug: "",
  summary: "",
  contentHtml: "",
  tagsText: "",
  status: "draft",
  authorName: "PickleTour",
  heroImageUrl: "",
  publishedAt: "",
  homepageBanner: {
    enabled: false,
    text: "",
    startsAt: "",
    endsAt: "",
    priority: 0,
  },
};

const statusLabelMap = {
  draft: "Nháp",
  published: "Đã xuất bản",
  hidden: "Ẩn",
};

const statusColorMap = {
  draft: "default",
  published: "success",
  hidden: "warning",
};

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toTagsText(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean).join(", ") : "";
}

function parseTags(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function articleToForm(article) {
  if (!article) return EMPTY_FORM;
  const banner = article.homepageBanner || {};

  return {
    title: article.title || "",
    slug: article.slug || "",
    summary: article.summary || "",
    contentHtml: article.contentHtml || "",
    tagsText: toTagsText(article.tags),
    status: article.status || "draft",
    authorName: article.authorName || "PickleTour",
    heroImageUrl: article.heroImageUrl || "",
    publishedAt: toDateTimeInput(article.publishedAt),
    homepageBanner: {
      enabled: !!banner.enabled,
      text: banner.text || "",
      startsAt: toDateTimeInput(banner.startsAt),
      endsAt: toDateTimeInput(banner.endsAt),
      priority: Number(banner.priority || 0),
    },
  };
}

function buildPayload(form) {
  return {
    title: form.title,
    slug: form.slug,
    summary: form.summary,
    contentHtml: form.contentHtml,
    tags: parseTags(form.tagsText),
    status: form.status,
    authorName: form.authorName || "PickleTour",
    heroImageUrl: form.heroImageUrl,
    publishedAt: fromDateTimeInput(form.publishedAt),
    homepageBanner: {
      enabled: !!form.homepageBanner.enabled,
      text: form.homepageBanner.text,
      startsAt: fromDateTimeInput(form.homepageBanner.startsAt),
      endsAt: fromDateTimeInput(form.homepageBanner.endsAt),
      priority: Number(form.homepageBanner.priority || 0),
    },
  };
}

export default function BlogManagerPage() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isCreating, setIsCreating] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useGetBlogPostsQuery({
    keyword,
    status,
    page: 1,
    limit: 80,
  });

  const { data: selectedArticle, isFetching: isLoadingDetail } =
    useGetBlogPostQuery(selectedId, {
      skip: !selectedId,
    });

  const [createArticle, { isLoading: isCreatingArticle }] =
    useCreateBlogPostMutation();
  const [updateArticle, { isLoading: isUpdatingArticle }] =
    useUpdateBlogPostMutation();
  const [deleteArticle, { isLoading: isDeletingArticle }] =
    useDeleteBlogPostMutation();

  const items = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }, [data]);

  useEffect(() => {
    if (!selectedArticle || isCreating) return;
    setForm(articleToForm(selectedArticle));
  }, [isCreating, selectedArticle]);

  const saving = isCreatingArticle || isUpdatingArticle;

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateBannerField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      homepageBanner: {
        ...prev.homepageBanner,
        [key]: value,
      },
    }));
  };

  const handleNew = useCallback(() => {
    setIsCreating(true);
    setSelectedId("");
    setForm(EMPTY_FORM);
  }, []);

  const handleSelect = useCallback((article) => {
    setIsCreating(false);
    setSelectedId(article._id);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const payload = buildPayload(form);
      const saved = isCreating
        ? await createArticle(payload).unwrap()
        : await updateArticle({ id: selectedId, ...payload }).unwrap();

      toast.success(isCreating ? "Đã tạo bài blog." : "Đã lưu bài blog.");
      setIsCreating(false);
      setSelectedId(saved?._id || selectedId);
      setForm(articleToForm(saved));
      refetch();
    } catch (error) {
      toast.error(
        error?.data?.message || error?.error || "Không lưu được bài blog."
      );
    }
  }, [createArticle, form, isCreating, refetch, selectedId, updateArticle]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const confirmed = window.confirm("Xóa bài blog này?");
    if (!confirmed) return;

    try {
      await deleteArticle(selectedId).unwrap();
      toast.success("Đã xóa bài blog.");
      handleNew();
      refetch();
    } catch (error) {
      toast.error(
        error?.data?.message || error?.error || "Không xóa được bài blog."
      );
    }
  }, [deleteArticle, handleNew, refetch, selectedId]);

  const publicSlug = form.slug || selectedArticle?.slug || "";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
          mb={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Blog & Banner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Quản lý bài blog thủ công và banner thông báo trên trang chủ.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={handleNew}>
              Bài mới
            </Button>
            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Tìm bài"
                  size="small"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  fullWidth
                />
                <Tooltip title="Tải lại">
                  <IconButton onClick={refetch}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField
                select
                label="Trạng thái"
                size="small"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="draft">Nháp</MenuItem>
                <MenuItem value="published">Đã xuất bản</MenuItem>
                <MenuItem value="hidden">Ẩn</MenuItem>
              </TextField>

              <Divider />

              {isLoading || isFetching ? (
                <Stack alignItems="center" py={3}>
                  <CircularProgress size={24} />
                </Stack>
              ) : null}

              {!isLoading && !items.length ? (
                <Typography variant="body2" color="text.secondary">
                  Chưa có bài blog thủ công.
                </Typography>
              ) : null}

              <Stack spacing={1}>
                {items.map((item) => {
                  const active = item._id === selectedId;
                  return (
                    <Box
                      key={item._id}
                      component="button"
                      type="button"
                      onClick={() => handleSelect(item)}
                      sx={{
                        width: "100%",
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: active ? "primary.main" : "divider",
                        backgroundColor: active ? "action.selected" : "background.paper",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {item.title}
                      </Typography>
                      <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          color={statusColorMap[item.status] || "default"}
                          label={statusLabelMap[item.status] || item.status}
                        />
                        {item.homepageBanner?.enabled ? (
                          <Chip size="small" color="info" label="Banner" />
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: 2 }}>
            {isLoadingDetail ? (
              <Stack alignItems="center" py={3}>
                <CircularProgress size={24} />
              </Stack>
            ) : null}

            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {isCreating ? "Tạo bài blog" : "Sửa bài blog"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bài published sẽ hiển thị ở trang /blog.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    startIcon={<LaunchIcon />}
                    disabled={!publicSlug}
                    onClick={() => window.open(`/blog/${publicSlug}`, "_blank")}
                  >
                    Mở bài
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    color="error"
                    disabled={isCreating || isDeletingArticle}
                    onClick={handleDelete}
                  >
                    Xóa
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 280px" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Tiêu đề"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Slug"
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  fullWidth
                  helperText="Để trống khi tạo mới để hệ thống tự sinh."
                />
              </Box>

              <TextField
                label="Tóm tắt"
                value={form.summary}
                onChange={(event) => updateField("summary", event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />

              <Box
                sx={{
                  "& .ql-container": {
                    minHeight: 240,
                    backgroundColor: "background.paper",
                  },
                }}
              >
                <Typography variant="subtitle2" mb={0.75}>
                  Nội dung bài viết
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={form.contentHtml}
                  onChange={(value) => updateField("contentHtml", value)}
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 220px 220px" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Tags"
                  value={form.tagsText}
                  onChange={(event) => updateField("tagsText", event.target.value)}
                  fullWidth
                  helperText="Ngăn cách bằng dấu phẩy."
                />
                <TextField
                  select
                  label="Trạng thái"
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="draft">Nháp</MenuItem>
                  <MenuItem value="published">Đã xuất bản</MenuItem>
                  <MenuItem value="hidden">Ẩn</MenuItem>
                </TextField>
                <TextField
                  label="Ngày xuất bản"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) =>
                    updateField("publishedAt", event.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "220px 1fr" },
                  gap: 1.5,
                }}
              >
                <TextField
                  label="Tác giả/đơn vị"
                  value={form.authorName}
                  onChange={(event) => updateField("authorName", event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Ảnh đại diện"
                  value={form.heroImageUrl}
                  onChange={(event) => updateField("heroImageUrl", event.target.value)}
                  fullWidth
                />
              </Box>

              <Divider />

              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.homepageBanner.enabled}
                      onChange={(event) =>
                        updateBannerField("enabled", event.target.checked)
                      }
                    />
                  }
                  label="Bật banner trên trang chủ"
                />
                <TextField
                  label="Nội dung banner"
                  value={form.homepageBanner.text}
                  onChange={(event) => updateBannerField("text", event.target.value)}
                  placeholder="PickleTour đã tạm tắt chế độ chấm trình"
                  fullWidth
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 160px" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    label="Bắt đầu"
                    type="datetime-local"
                    value={form.homepageBanner.startsAt}
                    onChange={(event) =>
                      updateBannerField("startsAt", event.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Kết thúc"
                    type="datetime-local"
                    value={form.homepageBanner.endsAt}
                    onChange={(event) =>
                      updateBannerField("endsAt", event.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Ưu tiên"
                    type="number"
                    value={form.homepageBanner.priority}
                    onChange={(event) =>
                      updateBannerField("priority", event.target.value)
                    }
                    fullWidth
                  />
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
