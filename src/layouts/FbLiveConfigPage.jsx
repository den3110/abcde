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
  if (sec < 60) return `${sec} giay`;

  const min = sec / 60;
  if (Number.isInteger(min)) return `${min} phut`;
  return `${min.toFixed(1)} phut`;
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
        data.staleIdleFreeDelayMs ?? DEFAULT_PAGE_POOL_FORM.staleIdleFreeDelayMs
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
      setToast({ open: true, msg: "Da luu cau hinh.", type: "success" });
    } catch (e) {
      setToast({
        open: true,
        msg: e?.data?.message || "Loi luu cau hinh",
        type: "error",
      });
    }
  };

  if (isLoading) return <Box p={3}>Dang tai...</Box>;
  if (isError) return <Box p={3}>Loi tai cau hinh</Box>;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3} maxWidth={760} mx="auto">
        <Card>
          <CardHeader
            title="Cau hinh Facebook Live"
            subheader="Quan ly status, visibility luc tao live va timing quay lai pool cua Facebook Page."
          />
          <CardContent>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel id="status-label">Trang thai mac dinh</InputLabel>
                <Select
                  labelId="status-label"
                  label="Trang thai mac dinh"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="LIVE_NOW">LIVE_NOW (phat ngay)</MenuItem>
                  <MenuItem value="SCHEDULED_UNPUBLISHED">SCHEDULED_UNPUBLISHED (hen gio)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="privacy-label">Pham vi luc tao</InputLabel>
                <Select
                  labelId="privacy-label"
                  label="Pham vi luc tao"
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
                label="Cho phep nhung (embeddable)"
              />

              <FormControl fullWidth>
                <InputLabel id="after-label">Pham vi sau khi ket thuc</InputLabel>
                <Select
                  labelId="after-label"
                  label="Pham vi sau khi ket thuc"
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
                  Cac gia tri nay dieu khien viec Facebook Page quay lai pool sau khi end live. Don
                  vi la milliseconds.
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Safe free delay (ms)"
                value={pagePool.safeFreeDelayMs}
                onChange={handlePoolChange("safeFreeDelayMs")}
                helperText={`Dung cho case end fail/skip. Hien tai: ${formatMs(
                  pagePool.safeFreeDelayMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Fast free delay (ms)"
                value={pagePool.fastFreeDelayMs}
                onChange={handlePoolChange("fastFreeDelayMs")}
                helperText={`Dung khi Facebook end live thanh cong. Hien tai: ${formatMs(
                  pagePool.fastFreeDelayMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Stale idle free delay (ms)"
                value={pagePool.staleIdleFreeDelayMs}
                onChange={handlePoolChange("staleIdleFreeDelayMs")}
                helperText={`Khi cron thay page stale nhung Facebook da idle, nha sau ${formatMs(
                  pagePool.staleIdleFreeDelayMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Stale busy threshold (ms)"
                value={pagePool.staleBusyMs}
                onChange={handlePoolChange("staleBusyMs")}
                helperText={`Qua nguong nay backend moi bat dau probe stale page. Hien tai: ${formatMs(
                  pagePool.staleBusyMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Lease heartbeat interval (ms)"
                value={pagePool.leaseHeartbeatMs}
                onChange={handlePoolChange("leaseHeartbeatMs")}
                helperText={`Native app se ping lease theo nhip nay. Hien tai: ${formatMs(
                  pagePool.leaseHeartbeatMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Lease timeout (ms)"
                value={pagePool.leaseTimeoutMs}
                onChange={handlePoolChange("leaseTimeoutMs")}
                helperText={`Qua nguong nay khong co heartbeat thanh cong thi backend se expire lease. Hien tai: ${formatMs(
                  pagePool.leaseTimeoutMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <Box>
                <Button variant="contained" onClick={handleSave} disabled={saving || !canSave}>
                  {saving ? "Dang luu..." : "Luu cau hinh"}
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
