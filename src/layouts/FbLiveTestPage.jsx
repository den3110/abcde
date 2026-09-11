import React from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Alert,
  Divider,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Link,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Grid,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useFbLiveTestPagesQuery,
  useFbLiveTestSessionsQuery,
  useStartFbLiveTestMutation,
  useStopFbLiveTestMutation,
  useStopAllFbLiveTestMutation,
} from "slices/adminFacebookApi";

const STATUS_META = {
  starting: { color: "warning", label: "Đang khởi tạo" },
  live: { color: "success", label: "LIVE" },
  stopped: { color: "default", label: "Đã dừng" },
  error: { color: "error", label: "Lỗi" },
};

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export default function FbLiveTestPage() {
  // Poll 4s để thấy trạng thái cập nhật.
  const { data, isFetching, refetch } = useFbLiveTestSessionsQuery(undefined, {
    pollingInterval: 4000,
  });
  const {
    data: pagesData,
    isFetching: pagesFetching,
    refetch: refetchPages,
  } = useFbLiveTestPagesQuery(undefined, { pollingInterval: 6000 });
  const [startTest, { isLoading: starting }] = useStartFbLiveTestMutation();
  const [stopOne] = useStopFbLiveTestMutation();
  const [stopAll, { isLoading: stoppingAll }] = useStopAllFbLiveTestMutation();

  const [selected, setSelected] = React.useState(() => new Set());

  const items = data?.items || [];
  const liveCount = data?.liveCount ?? 0;
  const pages = pagesData?.pages || [];
  const testablePages = pages.filter((p) => p.testable);

  const toggle = (pageId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };
  const selectAllFree = () =>
    setSelected(new Set(testablePages.map((p) => p.pageId)));
  const clearSelection = () => setSelected(new Set());

  const onStart = async () => {
    const pageIds = [...selected];
    if (!pageIds.length) {
      toast.info("Chọn ít nhất 1 page để test.");
      return;
    }
    try {
      const res = await startTest({ pageIds }).unwrap();
      const okN = (res.created || []).filter((c) => c.status === "live").length;
      const errN = (res.created || []).filter((c) => c.status === "error").length;
      toast.success(
        `Đã bắt đầu ${okN} page live${errN ? `, ${errN} lỗi` : ""}${
          res.stoppedReason ? ` · ${res.stoppedReason}` : ""
        }`
      );
      clearSelection();
      refetch();
      refetchPages();
    } catch (err) {
      toast.error(err?.data?.message || "Bắt đầu test thất bại");
    }
  };

  const onStopOne = async (sessionId) => {
    try {
      await stopOne(sessionId).unwrap();
      toast.info("Đã dừng 1 phiên.");
      refetchPages();
    } catch (err) {
      toast.error(err?.data?.message || "Dừng thất bại");
    }
  };

  const onStopAll = async () => {
    if (!window.confirm("Dừng TẤT CẢ phiên test live đang chạy?")) return;
    try {
      const res = await stopAll().unwrap();
      toast.success(`Đã dừng ${res.stopped || 0} phiên.`);
      refetchPages();
    } catch (err) {
      toast.error(err?.data?.message || "Dừng tất cả thất bại");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <LiveTvIcon color="error" />
          <Typography variant="h5" fontWeight={700}>
            Test Live nhiều page cùng lúc
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Mỗi phiên chiếm 1 page rảnh trong pool, tạo 1 live video và đẩy 1 luồng
          <b> test pattern</b> (không cần camera) để kiểm tra hệ thống chịu được bao nhiêu
          luồng đồng thời. Dùng để thử “5 trận / 5 page” cùng lúc.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          Đây là <b>live THẬT</b> lên page thật (tiêu đề có “🔴 TEST LIVE”). Nhớ bấm
          <b> Dừng tất cả</b> sau khi test. Mỗi phiên <b>tự dừng sau 15 phút</b> để an toàn.
          Chạy nhiều luồng tốn CPU/băng thông VPS — theo dõi tải máy.
        </Alert>

        {/* Chọn page + điều khiển */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              spacing={1}
              mb={1}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Chọn page để test ({selected.size} đã chọn / {testablePages.length} rảnh)
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={selectAllFree} disabled={!testablePages.length}>
                  Chọn tất cả rảnh
                </Button>
                <Button size="small" onClick={clearSelection} disabled={!selected.size}>
                  Bỏ chọn
                </Button>
                <Tooltip title="Tải lại danh sách page">
                  <span>
                    <Button
                      size="small"
                      startIcon={pagesFetching ? <CircularProgress size={12} /> : <RefreshIcon />}
                      onClick={refetchPages}
                      disabled={pagesFetching}
                    >
                      Tải lại
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>

            {pages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {pagesFetching ? "Đang tải danh sách page…" : "Không có page nào trong pool."}
              </Typography>
            ) : (
              <Grid container spacing={0.5}>
                {pages.map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.pageId}>
                    <FormControlLabel
                      sx={{ m: 0 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={selected.has(p.pageId)}
                          disabled={!p.testable}
                          onChange={() => toggle(p.pageId)}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2">{p.pageName}</Typography>
                          {!p.testable && (
                            <Chip
                              size="small"
                              color={p.needsReauth ? "error" : "warning"}
                              variant="outlined"
                              label={p.reason}
                            />
                          )}
                        </Stack>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            <Divider sx={{ my: 1.5 }} />
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap">
              <Button
                variant="contained"
                color="error"
                startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <PlayCircleIcon />}
                onClick={onStart}
                disabled={starting || selected.size === 0}
              >
                {starting ? "Đang bắt đầu…" : `Bắt đầu test ${selected.size} page đã chọn`}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopCircleIcon />}
                onClick={onStopAll}
                disabled={stoppingAll || liveCount === 0}
              >
                Dừng tất cả ({liveCount})
              </Button>
              <Tooltip title="Tải lại phiên">
                <span>
                  <Button
                    startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={refetch}
                    disabled={isFetching}
                  >
                    Tải lại phiên
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>

        {/* Danh sách phiên */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Phiên gần đây (đang live: {liveCount})
            </Typography>
            {items.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có phiên nào. Nhập số page rồi bấm “Bắt đầu test”.
              </Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Page</TableCell>
                      <TableCell>Trạng thái</TableCell>
                      <TableCell>Bắt đầu</TableCell>
                      <TableCell>Xem</TableCell>
                      <TableCell align="right">Hành động</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((s) => {
                      const meta = STATUS_META[s.status] || STATUS_META.stopped;
                      const active = ["starting", "live"].includes(s.status);
                      return (
                        <TableRow key={s.sessionId}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {s.pageName || s.pageId}
                            </Typography>
                            {s.error && (
                              <Typography variant="caption" color="error">
                                {s.error}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" color={meta.color} label={meta.label} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{fmt(s.startedAt)}</Typography>
                          </TableCell>
                          <TableCell>
                            {s.permalinkUrl ? (
                              <Link
                                href={s.permalinkUrl}
                                target="_blank"
                                rel="noreferrer"
                                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                              >
                                Mở <OpenInNewIcon fontSize="inherit" />
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              color="error"
                              startIcon={<StopCircleIcon />}
                              disabled={!active}
                              onClick={() => onStopOne(s.sessionId)}
                            >
                              Dừng
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Sau khi bắt đầu ~5–10s, mở link “Xem” để thấy page đang phát test pattern. Nếu page
          không lên hình: kiểm tra token page ở “FB Page Tokens”, hoặc CPU VPS quá tải.
        </Typography>
      </Box>
    </DashboardLayout>
  );
}
