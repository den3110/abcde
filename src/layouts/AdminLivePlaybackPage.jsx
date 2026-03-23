import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useGetAdminLivePlaybackConfigQuery,
  useUpdateAdminLivePlaybackConfigMutation,
} from "slices/adminLivePlaybackApiSlice";

function capacityLabel(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function normalizeTargetsForForm(targets = []) {
  return (Array.isArray(targets) ? targets : []).map((target) => ({
    id: target.id,
    publicBaseUrl: target.overridePublicBaseUrl || "",
  }));
}

export default function AdminLivePlaybackPage() {
  const { data, isFetching, refetch } = useGetAdminLivePlaybackConfigQuery();
  const [updateConfig, { isLoading: isSaving }] =
    useUpdateAdminLivePlaybackConfigMutation();

  const [form, setForm] = React.useState({
    enabled: false,
    delaySeconds: 60,
    manifestName: "live-manifest.json",
    globalPublicBaseUrl: "",
    targets: [],
  });
  const [snack, setSnack] = React.useState({ open: false, message: "", severity: "success" });

  React.useEffect(() => {
    if (!data?.config) return;
    setForm({
      enabled: Boolean(data.config.enabled),
      delaySeconds: Number(data.config.delaySeconds || 60),
      manifestName: data.config.manifestName || "live-manifest.json",
      globalPublicBaseUrl: data.config.globalPublicBaseUrl || "",
      targets: normalizeTargetsForForm(data.targets),
    });
  }, [data]);

  const onTargetChange = React.useCallback((targetId, value) => {
    setForm((prev) => ({
      ...prev,
      targets: prev.targets.map((target) =>
        target.id === targetId ? { ...target, publicBaseUrl: value } : target
      ),
    }));
  }, []);

  const handleSave = React.useCallback(async () => {
    try {
      await updateConfig({
        enabled: Boolean(form.enabled),
        delaySeconds: Number(form.delaySeconds || 60),
        manifestName: form.manifestName,
        globalPublicBaseUrl: form.globalPublicBaseUrl,
        targets: form.targets,
      }).unwrap();
      setSnack({
        open: true,
        message: "Đã lưu cấu hình live playback CDN.",
        severity: "success",
      });
    } catch (error) {
      setSnack({
        open: true,
        message: error?.data?.message || error?.message || "Lưu cấu hình thất bại",
        severity: "error",
      });
    }
  }, [form, updateConfig]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h4">Live Playback CDN</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Quản lý Server 2 đa nguồn cho public viewer. Chỉ dùng cho admin + super user.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  Lưu cấu hình
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Multi-source
                  </Typography>
                  <Typography variant="h4">
                    {data?.summary?.enabled ? "ON" : "OFF"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Delay
                  </Typography>
                  <Typography variant="h4">
                    {data?.summary?.delaySeconds || 60}s
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    R2 Targets
                  </Typography>
                  <Typography variant="h4">
                    {data?.summary?.targetCount || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Effective CDN Targets
                  </Typography>
                  <Typography variant="h4">
                    {data?.summary?.targetWithEffectivePublicBaseCount || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Global Settings</Typography>
              <FormRow
                label="Bật multi-source playback"
                control={
                  <Switch
                    checked={Boolean(form.enabled)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                  />
                }
              />
              <TextField
                label="Delay seconds"
                type="number"
                value={form.delaySeconds}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, delaySeconds: event.target.value }))
                }
                inputProps={{ min: 15, max: 600 }}
              />
              <TextField
                label="Manifest name"
                value={form.manifestName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, manifestName: event.target.value }))
                }
                helperText="Ví dụ: live-manifest.json"
              />
              <TextField
                label="Global public CDN base URL"
                value={form.globalPublicBaseUrl}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    globalPublicBaseUrl: event.target.value,
                  }))
                }
                helperText="Fallback chung nếu target chưa có publicBaseUrl riêng. Ví dụ: https://pickletour.vn/cdn"
              />
              <Alert severity="info">
                Nếu bạn đang xoay nhiều R2 account free, nên set publicBaseUrl riêng theo từng target, ví dụ
                <strong> https://pickletour.vn/cdn/r2-01</strong>, <strong>.../r2-02</strong>.
              </Alert>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Per-Target Public CDN</Typography>
              {(data?.targets || []).map((target) => {
                const formTarget = form.targets.find((item) => item.id === target.id) || {
                  id: target.id,
                  publicBaseUrl: "",
                };
                return (
                  <Box
                    key={target.id}
                    sx={{ border: "1px solid #eee", borderRadius: 2, p: 2 }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {target.label || target.id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            `{target.id}` • bucket `{target.bucketName}` • {capacityLabel(target.capacityBytes)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={
                              target.effectivePublicBaseUrl ? "CDN ready" : "No public base"
                            }
                            color={target.effectivePublicBaseUrl ? "success" : "default"}
                          />
                        </Stack>
                      </Stack>

                      <TextField
                        label={`Override publicBaseUrl for ${target.id}`}
                        value={formTarget.publicBaseUrl}
                        onChange={(event) =>
                          onTargetChange(target.id, event.target.value)
                        }
                        helperText="Để trống để dùng env publicBaseUrl của target hoặc global fallback."
                        fullWidth
                      />

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Env publicBaseUrl
                          </Typography>
                          <Typography variant="body2">
                            {target.envPublicBaseUrl || "—"}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Effective publicBaseUrl
                          </Typography>
                          <Typography variant="body2">
                            {target.effectivePublicBaseUrl || "—"}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Manifest preview
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                            {target.manifestExampleUrl || "—"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Stack>
      </Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={2600}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

function FormRow({ label, control }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
    >
      <Typography variant="body1">{label}</Typography>
      {control}
    </Stack>
  );
}
