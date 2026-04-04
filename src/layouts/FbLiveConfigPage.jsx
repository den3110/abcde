import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useGetFbLiveConfigQuery,
  useUpdateFbLiveConfigMutation,
} from "slices/fbLiveConfigApiSlice";

const DEFAULT_PAGE_POOL_FORM = {
  safeFreeDelayMs: "180000",
  fastFreeDelayMs: "45000",
  staleIdleFreeDelayMs: "60000",
  staleBusyMs: "900000",
  leaseHeartbeatMs: "15000",
  leaseTimeoutMs: "120000",
};

function formatMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1000) return `${n} ms`;

  const sec = n / 1000;
  if (sec < 60) return `${sec} giây`;

  const min = sec / 60;
  if (Number.isInteger(min)) return `${min} phút`;
  return `${min.toFixed(1)} phút`;
}

export default function FbLiveConfigPage() {
  const { data, isLoading, isError } = useGetFbLiveConfigQuery();
  const [updateCfg, { isLoading: saving }] = useUpdateFbLiveConfigMutation();

  const [status, setStatus] = useState("LIVE_NOW");
  const [privacyValueOnCreate, setPrivacy] = useState("EVERYONE");
  const [embeddable, setEmbeddable] = useState(true);
  const [ensurePrivacyAfterEnd, setEnsureAfterEnd] = useState("EVERYONE");
  const [pagePool, setPagePool] = useState(DEFAULT_PAGE_POOL_FORM);

  const [toast, setToast] = useState({ open: false, msg: "", type: "success" });

  useEffect(() => {
    if (!data) return;

    setStatus(data.status ?? "LIVE_NOW");
    setPrivacy(data.privacyValueOnCreate ?? "EVERYONE");
    setEmbeddable(data.embeddable ?? true);
    setEnsureAfterEnd(data.ensurePrivacyAfterEnd ?? "EVERYONE");
    setPagePool({
      safeFreeDelayMs: String(data.safeFreeDelayMs ?? DEFAULT_PAGE_POOL_FORM.safeFreeDelayMs),
      fastFreeDelayMs: String(data.fastFreeDelayMs ?? DEFAULT_PAGE_POOL_FORM.fastFreeDelayMs),
      staleIdleFreeDelayMs: String(
        data.staleIdleFreeDelayMs ?? DEFAULT_PAGE_POOL_FORM.staleIdleFreeDelayMs,
      ),
      staleBusyMs: String(data.staleBusyMs ?? DEFAULT_PAGE_POOL_FORM.staleBusyMs),
      leaseHeartbeatMs: String(data.leaseHeartbeatMs ?? DEFAULT_PAGE_POOL_FORM.leaseHeartbeatMs),
      leaseTimeoutMs: String(data.leaseTimeoutMs ?? DEFAULT_PAGE_POOL_FORM.leaseTimeoutMs),
    });
  }, [data]);

  const handlePoolChange = (field) => (e) => {
    const next = e.target.value.replace(/[^\d]/g, "");
    setPagePool((prev) => ({ ...prev, [field]: next }));
  };

  const canSave = Object.values(pagePool).every((value) => value !== "");

  const handleSave = async () => {
    try {
      await updateCfg({
        status,
        privacyValueOnCreate,
        embeddable,
        ensurePrivacyAfterEnd,
        safeFreeDelayMs: Number(pagePool.safeFreeDelayMs || 0),
        fastFreeDelayMs: Number(pagePool.fastFreeDelayMs || 0),
        staleIdleFreeDelayMs: Number(pagePool.staleIdleFreeDelayMs || 0),
        staleBusyMs: Number(pagePool.staleBusyMs || 0),
        leaseHeartbeatMs: Number(pagePool.leaseHeartbeatMs || 0),
        leaseTimeoutMs: Number(pagePool.leaseTimeoutMs || 0),
      }).unwrap();
      setToast({ open: true, msg: "Đã lưu cấu hình.", type: "success" });
    } catch (e) {
      setToast({
        open: true,
        msg: e?.data?.message || "Lỗi lưu cấu hình",
        type: "error",
      });
    }
  };

  if (isLoading) return <Box p={3}>Đang tải...</Box>;
  if (isError) return <Box p={3}>Lỗi tải cấu hình</Box>;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3} maxWidth={760} mx="auto">
        <Card>
          <CardHeader
            title="Cấu hình Facebook Live"
            subheader="Quản lý trạng thái, phạm vi khi tạo live và thời gian quay lại pool của Facebook Page."
          />
          <CardContent>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel id="status-label">Trạng thái mặc định</InputLabel>
                <Select
                  labelId="status-label"
                  label="Trạng thái mặc định"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="LIVE_NOW">LIVE_NOW (phát ngay)</MenuItem>
                  <MenuItem value="SCHEDULED_UNPUBLISHED">SCHEDULED_UNPUBLISHED (hẹn giờ)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="privacy-label">Phạm vi lúc tạo</InputLabel>
                <Select
                  labelId="privacy-label"
                  label="Phạm vi lúc tạo"
                  value={privacyValueOnCreate}
                  onChange={(e) => setPrivacy(e.target.value)}
                >
                  <MenuItem value="EVERYONE">EVERYONE (Public)</MenuItem>
                  <MenuItem value="FRIENDS">FRIENDS</MenuItem>
                  <MenuItem value="ALL_FRIENDS">ALL_FRIENDS</MenuItem>
                  <MenuItem value="SELF">SELF (Only me)</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch checked={embeddable} onChange={(e) => setEmbeddable(e.target.checked)} />
                }
                label="Cho phép nhúng (embeddable)"
              />

              <FormControl fullWidth>
                <InputLabel id="after-label">Phạm vi sau khi kết thúc</InputLabel>
                <Select
                  labelId="after-label"
                  label="Phạm vi sau khi kết thúc"
                  value={ensurePrivacyAfterEnd}
                  onChange={(e) => setEnsureAfterEnd(e.target.value)}
                >
                  <MenuItem value="EVERYONE">EVERYONE (Public)</MenuItem>
                  <MenuItem value="FRIENDS">FRIENDS</MenuItem>
                  <MenuItem value="ALL_FRIENDS">ALL_FRIENDS</MenuItem>
                  <MenuItem value="SELF">SELF (Only me)</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>
                  Page Pool Timing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Các giá trị này điều khiển việc Facebook Page quay lại pool sau khi kết thúc
                  live. Đơn vị là milliseconds.
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Safe free delay (ms)"
                value={pagePool.safeFreeDelayMs}
                onChange={handlePoolChange("safeFreeDelayMs")}
                helperText={`Dùng cho trường hợp end fail/skip. Hiện tại: ${formatMs(
                  pagePool.safeFreeDelayMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Fast free delay (ms)"
                value={pagePool.fastFreeDelayMs}
                onChange={handlePoolChange("fastFreeDelayMs")}
                helperText={`Dùng khi Facebook end live thành công. Hiện tại: ${formatMs(
                  pagePool.fastFreeDelayMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Stale idle free delay (ms)"
                value={pagePool.staleIdleFreeDelayMs}
                onChange={handlePoolChange("staleIdleFreeDelayMs")}
                helperText={`Khi cron thấy page stale nhưng Facebook đã idle, nhả sau ${formatMs(
                  pagePool.staleIdleFreeDelayMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Stale busy threshold (ms)"
                value={pagePool.staleBusyMs}
                onChange={handlePoolChange("staleBusyMs")}
                helperText={`Qua ngưỡng này backend mới bắt đầu probe stale page. Hiện tại: ${formatMs(
                  pagePool.staleBusyMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Lease heartbeat interval (ms)"
                value={pagePool.leaseHeartbeatMs}
                onChange={handlePoolChange("leaseHeartbeatMs")}
                helperText={`Native app sẽ ping lease theo nhịp này. Hiện tại: ${formatMs(
                  pagePool.leaseHeartbeatMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Lease timeout (ms)"
                value={pagePool.leaseTimeoutMs}
                onChange={handlePoolChange("leaseTimeoutMs")}
                helperText={`Quá ngưỡng này không có heartbeat thành công thì backend sẽ expire lease. Hiện tại: ${formatMs(
                  pagePool.leaseTimeoutMs,
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <Box>
                <Button variant="contained" onClick={handleSave} disabled={saving || !canSave}>
                  {saving ? "Đang lưu..." : "Lưu cấu hình"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Snackbar
          open={toast.open}
          autoHideDuration={3000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            severity={toast.type}
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          >
            {toast.msg}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
