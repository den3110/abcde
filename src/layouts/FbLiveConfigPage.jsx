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
      setToast({ open: true, msg: "?? l?u c?u h?nh.", type: "success" });
    } catch (e) {
      setToast({
        open: true,
        msg: e?.data?.message || "L?i l?u c?u h?nh",
        type: "error",
      });
    }
  };

  if (isLoading) return <Box p={3}>?ang t?i...</Box>;
  if (isError) return <Box p={3}>L?i t?i c?u h?nh</Box>;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3} maxWidth={760} mx="auto">
        <Card>
          <CardHeader
            title="Cau hinh Facebook Live"
            subheader="Qu?n l? status, visibility l?c t?o live v? timing quay l?i pool c?a Facebook Page."
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
                  <MenuItem value="LIVE_NOW">LIVE_NOW (ph?t ngay)</MenuItem>
                  <MenuItem value="SCHEDULED_UNPUBLISHED">SCHEDULED_UNPUBLISHED (hen gio)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="privacy-label">Ph?m vi l?c t?o</InputLabel>
                <Select
                  labelId="privacy-label"
                  label="Ph?m vi l?c t?o"
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
                label="Cho ph?p nh?ng (embeddable)"
              />

              <FormControl fullWidth>
                <InputLabel id="after-label">Ph?m vi sau khi k?t th?c</InputLabel>
                <Select
                  labelId="after-label"
                  label="Ph?m vi sau khi k?t th?c"
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
                helperText={`D?ng cho case end fail/skip. Hi?n t?i: ${formatMs(
                  pagePool.safeFreeDelayMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Fast free delay (ms)"
                value={pagePool.fastFreeDelayMs}
                onChange={handlePoolChange("fastFreeDelayMs")}
                helperText={`D?ng khi Facebook end live th?nh c?ng. Hi?n t?i: ${formatMs(
                  pagePool.fastFreeDelayMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <TextField
                fullWidth
                label="Stale idle free delay (ms)"
                value={pagePool.staleIdleFreeDelayMs}
                onChange={handlePoolChange("staleIdleFreeDelayMs")}
                helperText={`Khi cron th?y page stale nh?ng Facebook ?? idle, nh? sau ${formatMs(
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
                helperText={`Qu? ng??ng n?y kh?ng c? heartbeat th?nh c?ng th? backend s? expire lease. Hi?n t?i: ${formatMs(
                  pagePool.leaseTimeoutMs
                )}`}
                inputProps={{ inputMode: "numeric", min: 0 }}
              />

              <Box>
                <Button variant="contained" onClick={handleSave} disabled={saving || !canSave}>
                  {saving ? "?ang l?u..." : "L?u c?u h?nh"}
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
