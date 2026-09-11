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
  TextField,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Link,
  Tooltip,
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
  const [startTest, { isLoading: starting }] = useStartFbLiveTestMutation();
  const [stopOne] = useStopFbLiveTestMutation();
  const [stopAll, { isLoading: stoppingAll }] = useStopAllFbLiveTestMutation();

  const [count, setCount] = React.useState(3);

  const items = data?.items || [];
  const liveCount = data?.liveCount ?? 0;

  const onStart = async () => {
    try {
      const res = await startTest({ count: Number(count) || 1 }).unwrap();
      const okN = (res.created || []).filter((c) => c.status === "live").length;
      const errN = (res.created || []).filter((c) => c.status === "error").length;
      toast.success(
        `Đã bắt đầu ${okN} page live${errN ? `, ${errN} lỗi` : ""}${
          res.stoppedReason ? ` · ${res.stoppedReason}` : ""
        }`
      );
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || "Bắt đầu test thất bại");
    }
  };

  const onStopOne = async (sessionId) => {
    try {
      await stopOne(sessionId).unwrap();
      toast.info("Đã dừng 1 phiên.");
    } catch (err) {
      toast.error(err?.data?.message || "Dừng thất bại");
    }
  };

  const onStopAll = async () => {
    if (!window.confirm("Dừng TẤT CẢ phiên test live đang chạy?")) return;
    try {
      const res = await stopAll().unwrap();
      toast.success(`Đã dừng ${res.stopped || 0} phiên.`);
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

        {/* Điều khiển */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <TextField
                type="number"
                label="Số page muốn test cùng lúc"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                inputProps={{ min: 1, max: 10 }}
                sx={{ width: 240 }}
                helperText="Sẽ chọn lần lượt các page rảnh (tối đa 10)."
              />
              <Button
                variant="contained"
                color="error"
                startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <PlayCircleIcon />}
                onClick={onStart}
                disabled={starting}
              >
                {starting ? "Đang bắt đầu…" : `Bắt đầu test ${count} page`}
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
              <Tooltip title="Tải lại danh sách">
                <span>
                  <Button
                    startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={refetch}
                    disabled={isFetching}
                  >
                    Tải lại
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
