import React from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, Alert, Divider, Chip,
  TextField, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Link, Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useYtLiveTestSessionsQuery,
  useStartYtLiveTestMutation,
  useStopYtLiveTestMutation,
  useStopAllYtLiveTestMutation,
} from "slices/youtubeAdminApiSlice";

const STATUS_META = {
  starting: { color: "warning", label: "Đang khởi tạo" },
  live: { color: "success", label: "LIVE" },
  stopped: { color: "default", label: "Đã dừng" },
  error: { color: "error", label: "Lỗi" },
};

function fmt(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso; }
}

export default function YtLiveTestPage() {
  const { data, isFetching, refetch } = useYtLiveTestSessionsQuery(undefined, { pollingInterval: 4000 });
  const [startTest, { isLoading: starting }] = useStartYtLiveTestMutation();
  const [stopOne] = useStopYtLiveTestMutation();
  const [stopAll, { isLoading: stoppingAll }] = useStopAllYtLiveTestMutation();

  const [count, setCount] = React.useState(2);

  const items = data?.items || [];
  const liveCount = data?.liveCount ?? 0;

  const onStart = async () => {
    try {
      const res = await startTest({ count: Number(count) || 1 }).unwrap();
      const okN = (res.created || []).filter((c) => c.status === "live").length;
      const errN = (res.created || []).filter((c) => c.status === "error").length;
      const firstErr = (res.created || []).find((c) => c.status === "error")?.error;
      toast.success(`Đã bắt đầu ${okN} luồng${errN ? `, ${errN} lỗi` : ""}`);
      if (errN && firstErr) toast.warning(firstErr);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || "Bắt đầu test thất bại");
    }
  };

  const onStopOne = async (sessionId) => {
    try { await stopOne(sessionId).unwrap(); toast.info("Đã dừng 1 luồng."); }
    catch (err) { toast.error(err?.data?.message || "Dừng thất bại"); }
  };

  const onStopAll = async () => {
    if (!window.confirm("Dừng TẤT CẢ luồng test YouTube đang chạy?")) return;
    try { const res = await stopAll().unwrap(); toast.success(`Đã dừng ${res.stopped || 0} luồng.`); }
    catch (err) { toast.error(err?.data?.message || "Dừng tất cả thất bại"); }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <YouTubeIcon color="error" />
          <Typography variant="h5" fontWeight={700}>Test Live YouTube nhiều luồng</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Mỗi luồng tạo 1 broadcast + 1 stream RIÊNG trên kênh YouTube đã kết nối, đẩy
          <b> test pattern</b> (không cần camera). Dùng để kiểm tra kênh chịu được bao nhiêu luồng
          đồng thời + tải VPS.
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          Đây là <b>live THẬT</b> trên kênh YouTube (mặc định quyền riêng tư “unlisted”, đổi bằng
          Config <code>YT_BROADCAST_PRIVACY</code>). Nhớ <b>Dừng tất cả</b> sau khi test; mỗi luồng
          <b> tự dừng sau 15 phút</b>. YouTube có giới hạn số broadcast đồng thời/kênh — nếu vượt sẽ báo lỗi.
        </Alert>

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} flexWrap="wrap">
              <TextField
                type="number"
                label="Số luồng muốn test cùng lúc"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                inputProps={{ min: 1, max: 6 }}
                sx={{ width: 240 }}
                helperText="Mỗi luồng 1 stream riêng (tối đa 6)."
              />
              <Button variant="contained" color="error"
                startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <PlayCircleIcon />}
                onClick={onStart} disabled={starting}>
                {starting ? "Đang bắt đầu…" : `Bắt đầu test ${count} luồng`}
              </Button>
              <Button variant="outlined" color="error" startIcon={<StopCircleIcon />}
                onClick={onStopAll} disabled={stoppingAll || liveCount === 0}>
                Dừng tất cả ({liveCount})
              </Button>
              <Tooltip title="Tải lại danh sách">
                <span>
                  <Button startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}
                    onClick={refetch} disabled={isFetching}>Tải lại</Button>
                </span>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Luồng gần đây (đang live: {liveCount})
            </Typography>
            {items.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có luồng nào. Nhập số luồng rồi bấm “Bắt đầu test”.
              </Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tiêu đề</TableCell>
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
                            <Typography variant="body2" fontWeight={600}>{s.title || s.broadcastId}</Typography>
                            {s.error && (<Typography variant="caption" color="error">{s.error}</Typography>)}
                          </TableCell>
                          <TableCell><Chip size="small" color={meta.color} label={meta.label} /></TableCell>
                          <TableCell><Typography variant="caption">{fmt(s.startedAt)}</Typography></TableCell>
                          <TableCell>
                            {s.permalinkUrl ? (
                              <Link href={s.permalinkUrl} target="_blank" rel="noreferrer"
                                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                Mở <OpenInNewIcon fontSize="inherit" />
                              </Link>
                            ) : "—"}
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" color="error" startIcon={<StopCircleIcon />}
                              disabled={!active} onClick={() => onStopOne(s.sessionId)}>Dừng</Button>
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
          Sau khi bắt đầu ~10–20s, mở link “Xem” để thấy luồng lên hình (YouTube xử lý ingest hơi
          trễ hơn Facebook). Nếu báo lỗi quyền/giới hạn: kênh cần bật livestream + chưa đạt trần
          broadcast đồng thời.
        </Typography>
      </Box>
    </DashboardLayout>
  );
}
