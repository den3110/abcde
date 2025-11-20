import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Switch,
  TextField,
  Button,
  Chip,
  FormControlLabel,
  Slider,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import LaunchIcon from "@mui/icons-material/Launch";
import PendingIcon from "@mui/icons-material/Pending";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import BlockIcon from "@mui/icons-material/Block";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { toast } from "react-toastify";

import {
  useGetNewsSettingsQuery,
  useUpdateNewsSettingsMutation,
  useGetNewsCandidatesQuery,
  useRunNewsSyncMutation,
} from "slices/newsAdminApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

const statusColorMap = {
  pending: "warning",
  crawled: "success",
  skipped: "default",
  failed: "error",
};

const statusIconMap = {
  pending: <PendingIcon fontSize="small" />,
  crawled: <DoneAllIcon fontSize="small" />,
  skipped: <BlockIcon fontSize="small" />,
  failed: <ErrorOutlineIcon fontSize="small" />,
};

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(list) {
  return (list || []).join(", ");
}

function normalizeSettings(data) {
  if (!data) return null;
  return {
    enabled: !!data.enabled,
    intervalMinutes: data.intervalMinutes ?? 1440,
    allowedDomains: data.allowedDomains || [],
    blockedDomains: data.blockedDomains || [],
    mainKeywords: data.mainKeywords || ["PickleTour", "pickleball"],
    extraKeywords: data.extraKeywords || [],
    minAiScore: typeof data.minAiScore === "number" ? data.minAiScore : 0.7,
    autoPublish: !!data.autoPublish,
    maxArticlesPerRun: data.maxArticlesPerRun ?? 20,
    maxArticlesPerDay: data.maxArticlesPerDay ?? 60,
    useAiNormalize: typeof data.useAiNormalize === "boolean" ? data.useAiNormalize : true,
  };
}

export default function NewsAdminPage() {
  const {
    data: settingsData,
    isLoading: settingsLoading,
    isError: settingsIsError,
    error: settingsError,
    refetch: refetchSettings,
  } = useGetNewsSettingsQuery();

  const {
    data: candidatesData,
    isLoading: candidatesLoading,
    isError: candidatesIsError,
    error: candidatesError,
    refetch: refetchCandidates,
  } = useGetNewsCandidatesQuery();

  const [updateNewsSettings, { isLoading: isSaving }] = useUpdateNewsSettingsMutation();

  const [runNewsSync, { isLoading: isRunningSync }] = useRunNewsSyncMutation();

  const [form, setForm] = useState(null);

  // dialog xem lý do skip/failed
  const [reasonDialog, setReasonDialog] = useState({
    open: false,
    candidate: null,
  });

  const selectedCand = reasonDialog.candidate;

  // init form
  useEffect(() => {
    if (settingsData && !form) {
      setForm(normalizeSettings(settingsData));
    }
  }, [settingsData, form]);

  // toast cho lỗi load
  useEffect(() => {
    if (settingsIsError) {
      toast.error(settingsError?.data?.message || "Không tải được cấu hình tin tức.");
    }
  }, [settingsIsError, settingsError]);

  useEffect(() => {
    if (candidatesIsError) {
      toast.error(candidatesError?.data?.message || "Không tải được danh sách link ứng viên.");
    }
  }, [candidatesIsError, candidatesError]);

  const onChangeField = (key, value) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onChangeListText = (key, text) => {
    onChangeField(key, parseList(text));
  };

  const handleSave = useCallback(async () => {
    if (!form) return;
    try {
      const payload = {
        enabled: form.enabled,
        intervalMinutes: form.intervalMinutes,
        allowedDomains: form.allowedDomains,
        blockedDomains: form.blockedDomains,
        mainKeywords: form.mainKeywords,
        extraKeywords: form.extraKeywords,
        minAiScore: form.minAiScore,
        autoPublish: form.autoPublish,
        maxArticlesPerRun: form.maxArticlesPerRun,
        maxArticlesPerDay: form.maxArticlesPerDay,
        useAiNormalize: form.useAiNormalize,
      };

      await updateNewsSettings(payload).unwrap();
      toast.success("Đã lưu cấu hình tin tức.");
      refetchSettings();
    } catch (err) {
      console.error(err);
      toast.error(err?.data?.message || err?.error || "Lưu cấu hình thất bại, vui lòng thử lại.");
    }
  }, [form, updateNewsSettings, refetchSettings]);

  const handleRunNow = useCallback(async () => {
    try {
      const id = toast.info("Đang chạy đồng bộ tin tức...", {
        autoClose: false,
      });

      const res = await runNewsSync().unwrap();

      // đóng toast cũ
      toast.dismiss(id);

      const inserted = res?.discovery?.inserted ?? 0;
      const crawled = res?.crawl?.crawled ?? 0;
      const failed = res?.crawl?.failed ?? 0;

      toast.success(
        `Đã chạy xong. Link mới: ${inserted}, bài crawl thành công: ${crawled}${
          failed ? `, lỗi: ${failed}` : ""
        }.`
      );

      refetchCandidates();
    } catch (err) {
      console.error(err);
      toast.error(err?.data?.message || err?.error || "Chạy đồng bộ tin tức thất bại.");
    }
  }, [runNewsSync, refetchCandidates]);

  const handleOpenReason = useCallback((candidate) => {
    if (!candidate) return;
    setReasonDialog({ open: true, candidate });
  }, []);

  const handleCloseReason = useCallback(() => {
    setReasonDialog({ open: false, candidate: null });
  }, []);

  const loading = settingsLoading || !form;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Tin tức PickleTour (AI & Crawl)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Engine tự động chọn link bài báo nổi bật & crawl nội dung. Bạn chỉ cần cấu hình rule,
              có thể chạy tay bất kỳ lúc nào.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => {
                refetchSettings();
                refetchCandidates();
                toast.info("Đã tải lại dữ liệu.");
              }}
            >
              Reload
            </Button>
            <Button
              variant="contained"
              size="small"
              color="success"
              startIcon={<PlayArrowIcon />}
              disabled={isRunningSync}
              onClick={handleRunNow}
            >
              {isRunningSync ? "Đang chạy..." : "Chạy đồng bộ ngay"}
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {/* LEFT: SETTINGS */}
          <Stack flex={1} spacing={2}>
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Cấu hình hệ thống
                </Typography>
                {loading && <CircularProgress size={18} thickness={4} />}
              </Stack>

              {form && (
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.enabled}
                        onChange={(e) => onChangeField("enabled", e.target.checked)}
                      />
                    }
                    label="Bật engine tin tức tự động"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.autoPublish}
                        onChange={(e) => onChangeField("autoPublish", e.target.checked)}
                      />
                    }
                    label="Tự động publish bài đủ điều kiện"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.useAiNormalize}
                        onChange={(e) => onChangeField("useAiNormalize", e.target.checked)}
                      />
                    }
                    label="Dùng AI chuẩn hoá nội dung"
                  />

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ngưỡng điểm tối thiểu (min AI score)
                    </Typography>
                    <Slider
                      value={form.minAiScore}
                      min={0.4}
                      max={0.95}
                      step={0.01}
                      onChange={(_, v) => onChangeField("minAiScore", v)}
                      valueLabelDisplay="on"
                    />
                  </Box>

                  <Stack direction="row" spacing={2}>
                    <TextField
                      fullWidth
                      label="Số bài tối đa / lần chạy"
                      type="number"
                      size="small"
                      value={form.maxArticlesPerRun}
                      onChange={(e) =>
                        onChangeField("maxArticlesPerRun", Number(e.target.value) || 0)
                      }
                    />
                    <TextField
                      fullWidth
                      label="Số bài tối đa / ngày"
                      type="number"
                      size="small"
                      value={form.maxArticlesPerDay}
                      onChange={(e) =>
                        onChangeField("maxArticlesPerDay", Number(e.target.value) || 0)
                      }
                    />
                  </Stack>

                  <Divider />

                  <TextField
                    label="Từ khoá chính"
                    helperText="Phân tách bằng dấu phẩy hoặc xuống dòng. VD: PickleTour, pickleball, tournament"
                    multiline
                    minRows={2}
                    value={joinList(form.mainKeywords)}
                    onChange={(e) => onChangeListText("mainKeywords", e.target.value)}
                  />

                  <TextField
                    label="Từ khoá bổ sung"
                    multiline
                    minRows={2}
                    value={joinList(form.extraKeywords)}
                    onChange={(e) => onChangeListText("extraKeywords", e.target.value)}
                  />

                  <Divider />

                  <TextField
                    label="Allowed domains"
                    placeholder="vd: espn.com, usapickleball.org"
                    multiline
                    minRows={2}
                    value={joinList(form.allowedDomains)}
                    onChange={(e) => onChangeListText("allowedDomains", e.target.value)}
                  />

                  <TextField
                    label="Blocked domains"
                    multiline
                    minRows={2}
                    value={joinList(form.blockedDomains)}
                    onChange={(e) => onChangeListText("blockedDomains", e.target.value)}
                  />

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end" mt={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        setForm(normalizeSettings(settingsData));
                        toast.info("Đã reset theo cấu hình hiện tại.");
                      }}
                      disabled={loading || isSaving}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={loading || isSaving}
                    >
                      {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Paper>
          </Stack>

          {/* RIGHT: CANDIDATES */}
          <Stack flex={1.2} spacing={2}>
            <Paper
              sx={{
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Link ứng viên gần đây
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {candidatesLoading && <CircularProgress size={18} thickness={4} />}
                  <Tooltip title="Tải lại danh sách">
                    <IconButton
                      size="small"
                      onClick={() => {
                        refetchCandidates();
                        toast.info("Đang tải lại link ứng viên...");
                      }}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: 520,
                }}
              >
                {!candidatesLoading &&
                  Array.isArray(candidatesData) &&
                  candidatesData.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Chưa có link ứng viên nào. Hệ thống sẽ sinh link sau khi cron hoặc bạn bấm
                      Chạy đồng bộ ngay.
                    </Typography>
                  )}

                {Array.isArray(candidatesData) &&
                  candidatesData.map((c) => (
                    <Paper
                      key={c._id}
                      variant="outlined"
                      sx={{
                        p: 1.2,
                        mb: 1,
                        borderRadius: 1.5,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ flexGrow: 1, minWidth: 0 }}
                        >
                          <Chip
                            size="small"
                            label={c.status || "pending"}
                            color={statusColorMap[c.status] || "default"}
                            icon={statusIconMap[c.status] || <PendingIcon fontSize="small" />}
                          />
                          <Chip
                            size="small"
                            label={`score: ${c.score != null ? c.score.toFixed(2) : "n/a"}`}
                            color="info"
                            variant="outlined"
                          />
                          {c.publishedAt && (
                            <Chip
                              size="small"
                              label={new Date(c.publishedAt).toLocaleString()}
                              variant="outlined"
                            />
                          )}
                        </Stack>

                        {(c.lastError || c.lastErrorCode || c.reason) && (
                          <Tooltip title="Xem lý do xử lý link">
                            <IconButton size="small" onClick={() => handleOpenReason(c)}>
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>

                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.3 }}>
                        {c.title || "(Không có tiêu đề)"}
                      </Typography>

                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                        {c.sourceName || ""} {c.reason ? `• ${c.reason}` : ""}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box
                          sx={{
                            display: "flex",
                            gap: 0.5,
                            flexWrap: "wrap",
                          }}
                        >
                          {(c.tags || []).slice(0, 4).map((t) => (
                            <Chip key={t} label={t} size="small" variant="outlined" />
                          ))}
                        </Box>
                        {c.url && (
                          <Tooltip title={c.url}>
                            <IconButton
                              size="small"
                              component="a"
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <LaunchIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Paper>
                  ))}
              </Box>

              <Typography variant="caption" color="text.secondary" mt={0.5}>
                * Danh sách này chỉ để giám sát. Bài hiển thị ra app/website được lấy từ bảng
                NewsArticle sau khi engine xử lý.
              </Typography>
            </Paper>
          </Stack>
        </Stack>
      </Box>

      {/* Dialog lý do skip/failed */}
      <Dialog open={reasonDialog.open} onClose={handleCloseReason} maxWidth="sm" fullWidth>
        <DialogTitle>Lý do xử lý link</DialogTitle>
        <DialogContent dividers>
          {selectedCand ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={selectedCand.status || "pending"}
                  color={statusColorMap[selectedCand.status] || "default"}
                  icon={statusIconMap[selectedCand.status] || <PendingIcon fontSize="small" />}
                />
                {selectedCand.score != null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`score: ${selectedCand.score.toFixed(2)}`}
                  />
                )}
              </Stack>

              {selectedCand.lastErrorCode && (
                <Typography variant="body2">
                  <strong>Mã lỗi:</strong> {selectedCand.lastErrorCode}
                </Typography>
              )}

              {selectedCand.lastError && (
                <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                  <strong>Chi tiết:</strong> {selectedCand.lastError}
                </Typography>
              )}

              {!selectedCand.lastError && !selectedCand.lastErrorCode && (
                <Typography variant="body2">
                  Không có mã lỗi từ engine crawl. Dưới đây là ghi chú từ AI (nếu có).
                </Typography>
              )}

              {selectedCand.reason && (
                <Box mt={1}>
                  <Typography variant="subtitle2" gutterBottom>
                    Ghi chú từ AI:
                  </Typography>
                  <Typography variant="body2">{selectedCand.reason}</Typography>
                </Box>
              )}

              {selectedCand.url && (
                <Box mt={1}>
                  <Typography variant="body2">
                    URL:{" "}
                    <a href={selectedCand.url} target="_blank" rel="noopener noreferrer">
                      {selectedCand.url}
                    </a>
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : (
            <Typography variant="body2">Không có dữ liệu lý do.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReason}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
