import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  TextField,
  MenuItem,
  Grid,
  Stack,
  Button,
  Divider,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Paper,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import LinkIcon from "@mui/icons-material/Link";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useGlobalBroadcastMutation } from "slices/adminNotifyApi";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function BroadcastPage() {
  const [form, setForm] = useState({
    title: "",
    body: "",
    url: "",
    platform: "", // '', 'ios', 'android'
    minVersion: "",
    maxVersion: "",
    badge: "",
    ttl: "",
  });

  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const [send, { isLoading }] = useGlobalBroadcastMutation();

  const preview = useMemo(
    () => ({
      title: form.title || "(chưa có tiêu đề)",
      body: form.body || "(chưa có nội dung)",
      url: form.url || "",
    }),
    [form]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.title?.trim()) next.title = "Bắt buộc";
    if (!form.body?.trim()) next.body = "Bắt buộc";
    if (form.badge && isNaN(Number(form.badge))) next.badge = "Phải là số";
    if (form.ttl && (isNaN(Number(form.ttl)) || Number(form.ttl) < 0)) next.ttl = "Số ≥ 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const onConfirmSend = async () => {
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        url: form.url?.trim() || undefined,
        platform: form.platform || undefined,
        minVersion: form.minVersion?.trim() || undefined,
        maxVersion: form.maxVersion?.trim() || undefined,
        badge: form.badge ? Number(form.badge) : undefined,
        ttl: form.ttl ? Number(form.ttl) : undefined,
      };
      const data = await send(payload).unwrap();
      const sum = data?.summary || {};
      setSnack({
        open: true,
        severity: "success",
        msg: `Đã gửi! Tokens: ${sum.tokens ?? "?"}, OK: ${sum.ok ?? "?"}, Err: ${sum.error ?? "?"}`,
      });
      // reset tối thiểu: giữ filter cho tiện
      setForm((s) => ({ ...s, title: "", body: "", url: "" }));
    } catch (e) {
      setSnack({
        open: true,
        severity: "error",
        msg: e?.data?.message || "Gửi thất bại",
      });
    } finally {
      setConfirmOpen(false);
    }
  };

  const onReset = () => {
    setForm({
      title: "",
      body: "",
      url: "",
      platform: "",
      minVersion: "",
      maxVersion: "",
      badge: "",
      ttl: "",
    });
    setErrors({});
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Grid container spacing={2}>
          {/* Form */}
          <Grid item xs={12} md={7}>
            <Card elevation={1}>
              <CardHeader
                avatar={<CampaignIcon color="primary" />}
                title="Gửi thông báo toàn hệ thống"
                subheader="Admin có thể gửi thông báo tới toàn bộ người dùng (lọc nền tảng/phiên bản)."
              />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Tiêu đề"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    error={!!errors.title}
                    helperText={errors.title || "Tối đa ~64 ký tự"}
                    inputProps={{ maxLength: 64 }}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Nội dung"
                    name="body"
                    value={form.body}
                    onChange={handleChange}
                    error={!!errors.body}
                    helperText={errors.body || "Tối đa ~200 ký tự"}
                    inputProps={{ maxLength: 200 }}
                    fullWidth
                    required
                    multiline
                    minRows={3}
                  />
                  <TextField
                    label="Link mở trong app (optional)"
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    helperText="Ví dụ: /tournament/abc123 (hook của bạn sẽ deep-link bằng data.url)"
                    fullWidth
                    InputProps={{
                      startAdornment: <LinkIcon sx={{ mr: 1, color: "text.secondary" }} />,
                    }}
                  />
                  <Divider />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Nền tảng"
                        name="platform"
                        value={form.platform}
                        onChange={handleChange}
                        select
                        fullWidth
                      >
                        <MenuItem value="">Tất cả</MenuItem>
                        <MenuItem value="ios">iOS</MenuItem>
                        <MenuItem value="android">Android</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Min App Version"
                        name="minVersion"
                        value={form.minVersion}
                        onChange={handleChange}
                        placeholder="1.0.0.1"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Max App Version"
                        name="maxVersion"
                        value={form.maxVersion}
                        onChange={handleChange}
                        placeholder="9.9.9.9"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Badge"
                        name="badge"
                        value={form.badge}
                        onChange={handleChange}
                        error={!!errors.badge}
                        helperText={errors.badge || ""}
                        placeholder="1"
                        fullWidth
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="TTL (giây)"
                        name="ttl"
                        value={form.ttl}
                        onChange={handleChange}
                        error={!!errors.ttl}
                        helperText={errors.ttl || "Thời gian sống của notif"}
                        placeholder="3600"
                        fullWidth
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                      />
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<SendIcon />}
                      onClick={onSubmit}
                      disabled={isLoading}
                    >
                      Gửi thông báo
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<RestartAltIcon />}
                      onClick={onReset}
                      disabled={isLoading}
                    >
                      Xoá
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview */}
          <Grid item xs={12} md={5}>
            <Card elevation={1}>
              <CardHeader title="Preview" />
              <CardContent>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Notification preview
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {preview.title}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {preview.body}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block", mt: 1 }}
                  >
                    Link: {preview.url || "(không có)"}
                  </Typography>
                </Paper>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 2, color: "text.secondary" }}
                >
                  Khi người dùng bấm thông báo, app sẽ điều hướng theo <code>data.url</code> (đã cấu
                  hình trong hook).
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Confirm dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Xác nhận gửi thông báo</DialogTitle>
          <DialogContent dividers>
            <Typography>
              <strong>Tiêu đề:</strong> {preview.title}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              <strong>Nội dung:</strong> {preview.body}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              <strong>Link:</strong> {preview.url || "(không)"}{" "}
            </Typography>
            <Alert severity="warning" sx={{ mt: 2 }}>
              Thao tác này sẽ gửi tới toàn bộ người dùng{" "}
              {form.platform ? `(${form.platform})` : "(tất cả nền tảng)"}.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Huỷ</Button>
            <Button
              onClick={onConfirmSend}
              variant="contained"
              startIcon={<SendIcon />}
              disabled={isLoading}
            >
              Gửi ngay
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            severity={snack.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {snack.msg}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
