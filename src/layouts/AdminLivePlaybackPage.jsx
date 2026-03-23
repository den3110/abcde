import * as React from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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

function normalizeStorageTargetsForForm(targets = []) {
  return (Array.isArray(targets) ? targets : []).map((target) => ({
    id: target.id || "",
    label: target.label || "",
    enabled: target.enabled !== false,
    endpoint: target.endpoint || "",
    accessKeyId: target.accessKeyId || "",
    secretAccessKey: target.secretAccessKey || "",
    bucketName: target.bucketName || "",
    capacityBytes:
      target.capacityBytes == null || Number(target.capacityBytes || 0) <= 0
        ? ""
        : String(target.capacityBytes),
    publicBaseUrl: target.configuredPublicBaseUrl || "",
  }));
}

function buildNextTargetId(targets = []) {
  const existing = new Set((targets || []).map((target) => String(target.id || "")));
  for (let index = 1; index <= 999; index += 1) {
    const candidate = `r2-${String(index).padStart(2, "0")}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `r2-${Date.now()}`;
}

function createEmptyStorageTarget(targets = []) {
  return {
    id: buildNextTargetId(targets),
    label: "",
    enabled: true,
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucketName: "",
    capacityBytes: "",
    publicBaseUrl: "",
  };
}

function validateStorageTargetDraft(target, existingTargets = []) {
  const trimmedId = String(target?.id || "").trim();
  const trimmedEndpoint = String(target?.endpoint || "").trim();
  const trimmedAccessKeyId = String(target?.accessKeyId || "").trim();
  const trimmedSecretAccessKey = String(target?.secretAccessKey || "").trim();
  const trimmedBucketName = String(target?.bucketName || "").trim();
  const idTaken = existingTargets.some(
    (existingTarget) => String(existingTarget?.id || "").trim() === trimmedId
  );

  return {
    trimmedId,
    idTaken,
    canSubmit:
      Boolean(trimmedId) &&
      Boolean(trimmedEndpoint) &&
      Boolean(trimmedAccessKeyId) &&
      Boolean(trimmedSecretAccessKey) &&
      Boolean(trimmedBucketName) &&
      !idTaken,
  };
}

export default function AdminLivePlaybackPage() {
  const { data, isFetching, refetch } = useGetAdminLivePlaybackConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateAdminLivePlaybackConfigMutation();

  const [form, setForm] = React.useState({
    enabled: false,
    delaySeconds: 60,
    manifestName: "live-manifest.json",
    globalPublicBaseUrl: "",
    storageTargets: [],
  });
  const [snack, setSnack] = React.useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [createDialog, setCreateDialog] = React.useState({
    open: false,
    target: createEmptyStorageTarget(),
  });
  const createTargetValidation = React.useMemo(
    () => validateStorageTargetDraft(createDialog.target, form.storageTargets),
    [createDialog.target, form.storageTargets]
  );

  React.useEffect(() => {
    if (!data?.config) return;
    setForm({
      enabled: Boolean(data.config.enabled),
      delaySeconds: Number(data.config.delaySeconds || 60),
      manifestName: data.config.manifestName || "live-manifest.json",
      globalPublicBaseUrl: data.config.globalPublicBaseUrl || "",
      storageTargets: normalizeStorageTargetsForForm(data.storageTargets),
    });
  }, [data]);

  const onStorageTargetChange = React.useCallback((targetId, field, value) => {
    setForm((prev) => ({
      ...prev,
      storageTargets: prev.storageTargets.map((target) =>
        target.id === targetId ? { ...target, [field]: value } : target
      ),
    }));
  }, []);

  const handleAddTarget = React.useCallback(() => {
    setCreateDialog({
      open: true,
      target: createEmptyStorageTarget(form.storageTargets),
    });
  }, [form.storageTargets]);

  const handleCloseCreateDialog = React.useCallback(() => {
    setCreateDialog((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const handleCreateTargetFieldChange = React.useCallback((field, value) => {
    setCreateDialog((prev) => ({
      ...prev,
      target: {
        ...prev.target,
        [field]: value,
      },
    }));
  }, []);

  const handleConfirmCreateTarget = React.useCallback(() => {
    if (!createTargetValidation.canSubmit) {
      setSnack({
        open: true,
        message: "Dien du ID, endpoint, access key, secret key, bucket va khong trung ID.",
        severity: "error",
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      storageTargets: [
        ...prev.storageTargets,
        {
          ...createDialog.target,
          id: createTargetValidation.trimmedId,
          endpoint: String(createDialog.target.endpoint || "").trim(),
          accessKeyId: String(createDialog.target.accessKeyId || "").trim(),
          secretAccessKey: String(createDialog.target.secretAccessKey || "").trim(),
          bucketName: String(createDialog.target.bucketName || "").trim(),
          label: String(createDialog.target.label || "").trim(),
          publicBaseUrl: String(createDialog.target.publicBaseUrl || "").trim(),
        },
      ],
    }));
    setCreateDialog({
      open: false,
      target: createEmptyStorageTarget(form.storageTargets),
    });
  }, [createDialog.target, createTargetValidation, form.storageTargets]);

  const handleDeleteTarget = React.useCallback((targetId) => {
    setForm((prev) => ({
      ...prev,
      storageTargets: prev.storageTargets.filter((target) => target.id !== targetId),
    }));
  }, []);

  const handleSave = React.useCallback(async () => {
    try {
      await updateConfig({
        enabled: Boolean(form.enabled),
        delaySeconds: Number(form.delaySeconds || 60),
        manifestName: form.manifestName,
        globalPublicBaseUrl: form.globalPublicBaseUrl,
        storageTargets: form.storageTargets.map((target, index) => ({
          id: String(target.id || "").trim() || `r2-${String(index + 1).padStart(2, "0")}`,
          label: String(target.label || "").trim(),
          enabled: Boolean(target.enabled),
          endpoint: String(target.endpoint || "").trim(),
          accessKeyId: String(target.accessKeyId || "").trim(),
          secretAccessKey: String(target.secretAccessKey || "").trim(),
          bucketName: String(target.bucketName || "").trim(),
          capacityBytes:
            Number(target.capacityBytes || 0) > 0 ? Number(target.capacityBytes) : null,
          publicBaseUrl: String(target.publicBaseUrl || "").trim(),
        })),
      }).unwrap();
      setSnack({
        open: true,
        message: "Đã lưu cấu hình live playback và R2 recording targets.",
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
                  Quản lý Server 2 và danh sách recording storage targets thay cho
                  `R2_RECORDINGS_TARGETS_JSON`. Chỉ dành cho admin + super user.
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
                  <Typography variant="h4">{data?.summary?.enabled ? "ON" : "OFF"}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Delay
                  </Typography>
                  <Typography variant="h4">{data?.summary?.delaySeconds || 60}s</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Configured Targets
                  </Typography>
                  <Typography variant="h4">{data?.summary?.targetCount || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Source: {data?.summary?.storageTargetsSource || "env"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Runtime Targets
                  </Typography>
                  <Typography variant="h4">{data?.summary?.runtimeTargetCount || 0}</Typography>
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
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography variant="h6">Recording Storage Targets</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Quản lý trực tiếp danh sách target thay cho `R2_RECORDINGS_TARGETS_JSON`.
                  </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddTarget}>
                  Thêm target
                </Button>
              </Stack>

              <Alert severity="info">
                Nếu lưu danh sách target tại đây, backend sẽ ưu tiên cấu hình DB thay cho env. Xóa
                hết target rồi lưu sẽ quay về fallback từ env.
              </Alert>

              {(data?.storageTargets || []).length === 0 && form.storageTargets.length === 0 ? (
                <Alert severity="warning">
                  Chưa có target nào trong DB hoặc env. Hãy thêm target đầu tiên tại đây.
                </Alert>
              ) : null}

              {form.storageTargets.map((target) => {
                const runtimeTarget =
                  (data?.storageTargets || []).find((item) => item.id === target.id) || null;
                const effectivePublicBaseUrl =
                  runtimeTarget?.effectivePublicBaseUrl ||
                  target.publicBaseUrl ||
                  form.globalPublicBaseUrl ||
                  "";
                return (
                  <Box key={target.id} sx={{ border: "1px solid #eee", borderRadius: 2, p: 2 }}>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {target.label || target.id || "New target"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            `{target.id || "no-id"}` • bucket `{target.bucketName || "—"}` •{" "}
                            {capacityLabel(target.capacityBytes)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            label={target.enabled ? "Enabled" : "Disabled"}
                            color={target.enabled ? "success" : "default"}
                          />
                          <Chip
                            size="small"
                            label={runtimeTarget?.runtimeUsable ? "Runtime usable" : "Draft"}
                            color={runtimeTarget?.runtimeUsable ? "info" : "default"}
                          />
                          <Button
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => handleDeleteTarget(target.id)}
                          >
                            Xóa
                          </Button>
                        </Stack>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="ID"
                            value={target.id}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "id", event.target.value)
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="Label"
                            value={target.label}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "label", event.target.value)
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="Bucket name"
                            value={target.bucketName}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "bucketName", event.target.value)
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="Capacity bytes"
                            type="number"
                            value={target.capacityBytes}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "capacityBytes", event.target.value)
                            }
                            helperText="Ví dụ: 10737418240"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Endpoint"
                            value={target.endpoint}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "endpoint", event.target.value)
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="Access key ID"
                            value={target.accessKeyId}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "accessKeyId", event.target.value)
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="Secret access key"
                            type="password"
                            value={target.secretAccessKey}
                            onChange={(event) =>
                              onStorageTargetChange(
                                target.id,
                                "secretAccessKey",
                                event.target.value
                              )
                            }
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={9}>
                          <TextField
                            label="publicBaseUrl"
                            value={target.publicBaseUrl}
                            onChange={(event) =>
                              onStorageTargetChange(target.id, "publicBaseUrl", event.target.value)
                            }
                            helperText="Ví dụ: https://pickletour.vn/cdn/r2-01"
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <FormRow
                            label="Enabled"
                            control={
                              <Switch
                                checked={Boolean(target.enabled)}
                                onChange={(event) =>
                                  onStorageTargetChange(target.id, "enabled", event.target.checked)
                                }
                              />
                            }
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Effective publicBaseUrl
                          </Typography>
                          <Typography variant="body2">{effectivePublicBaseUrl || "—"}</Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Manifest preview
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                            {runtimeTarget?.manifestExampleUrl || "—"}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" color="text.secondary">
                            Runtime status
                          </Typography>
                          <Typography variant="body2">
                            {runtimeTarget?.runtimeUsable
                              ? "Đang usable trong runtime"
                              : "Chưa đủ field hoặc đang disabled"}
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
      <Dialog open={createDialog.open} onClose={handleCloseCreateDialog} fullWidth maxWidth="md">
        <DialogTitle>Thêm Recording Storage Target</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Alert severity="info">
              Target mới sẽ chỉ có hiệu lực sau khi bạn bấm `Lưu cấu hình` ở trang này.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  label="ID"
                  value={createDialog.target.id}
                  onChange={(event) => handleCreateTargetFieldChange("id", event.target.value)}
                  error={Boolean(createDialog.target.id) && createTargetValidation.idTaken}
                  helperText={
                    createTargetValidation.idTaken ? "ID already exists" : "Example: r2-02"
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Label"
                  value={createDialog.target.label}
                  onChange={(event) => handleCreateTargetFieldChange("label", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Bucket name"
                  value={createDialog.target.bucketName}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("bucketName", event.target.value)
                  }
                  helperText="Required"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Capacity bytes"
                  type="number"
                  value={createDialog.target.capacityBytes}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("capacityBytes", event.target.value)
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Endpoint"
                  value={createDialog.target.endpoint}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("endpoint", event.target.value)
                  }
                  helperText="Example: https://xxx.r2.cloudflarestorage.com"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Access key ID"
                  value={createDialog.target.accessKeyId}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("accessKeyId", event.target.value)
                  }
                  helperText="Required"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Secret access key"
                  type="password"
                  value={createDialog.target.secretAccessKey}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("secretAccessKey", event.target.value)
                  }
                  helperText="Required"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={9}>
                <TextField
                  label="publicBaseUrl"
                  value={createDialog.target.publicBaseUrl}
                  onChange={(event) =>
                    handleCreateTargetFieldChange("publicBaseUrl", event.target.value)
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormRow
                  label="Enabled"
                  control={
                    <Switch
                      checked={Boolean(createDialog.target.enabled)}
                      onChange={(event) =>
                        handleCreateTargetFieldChange("enabled", event.target.checked)
                      }
                    />
                  }
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleConfirmCreateTarget}
            disabled={!createTargetValidation.canSubmit}
          >
            Thêm target
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

function FormRow({ label, control }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Typography variant="body1">{label}</Typography>
      {control}
    </Stack>
  );
}

FormRow.propTypes = {
  label: PropTypes.string.isRequired,
  control: PropTypes.node.isRequired,
};
