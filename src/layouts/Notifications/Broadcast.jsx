import React, { useMemo, useState, useRef } from "react";
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
  Avatar,
  CircularProgress,
  Autocomplete, // 🆕
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import LinkIcon from "@mui/icons-material/Link";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import { useGlobalBroadcastMutation, useUserBroadcastMutation } from "slices/adminNotifyApi";
import { useLazySearchUsersQuery } from "slices/adminUsersApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function BroadcastPage() {
  /* ========== FORM GỬI TOÀN HỆ THỐNG (GIỮ NGUYÊN) ========== */
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
  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  const [send, { isLoading }] = useGlobalBroadcastMutation();

  /* ========== API GỬI CHO 1 USER + SEARCH USER ========== */
  const [sendToUser, { isLoading: isSendingUser }] = useUserBroadcastMutation();
  const [triggerSearch, { data: searchResults = [], isFetching: isSearching }] =
    useLazySearchUsersQuery();

  /* ========== STATE GỬI CHO 1 USER CỤ THỂ ========== */
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({
    title: "",
    body: "",
    url: "",
    badge: "",
    ttl: "",
  });
  const [userErrors, setUserErrors] = useState({});
  const [userConfirmOpen, setUserConfirmOpen] = useState(false);
  const searchTimerRef = useRef(null);

  const preview = useMemo(
    () => ({
      title: form.title || "(chưa có tiêu đề)",
      body: form.body || "(chưa có nội dung)",
      url: form.url || "",
    }),
    [form]
  );

  const userPreview = useMemo(
    () => ({
      title: userForm.title || "(chưa có tiêu đề)",
      body: userForm.body || "(chưa có nội dung)",
      url: userForm.url || "",
    }),
    [userForm]
  );

  /* ========== HANDLER GLOBAL (GIỮ NGUYÊN) ========== */
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
      setSnack({
        open: true,
        severity: "success",
        msg: `Da xep hang gui push. Dispatch: ${data?.dispatchId || "unknown"} (${
          data?.status || "queued"
        })`,
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

  /* ========== HANDLER SEARCH USER & FORM USER ========== */

  const handleUserInputChange = (_, value) => {
    setUserSearch(value);
    setSelectedUser(null);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const trimmed = value.trim();
    if (!trimmed) return;

    searchTimerRef.current = setTimeout(() => {
      triggerSearch({ q: trimmed, limit: 10 });
    }, 400);
  };

  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setUserForm((s) => ({ ...s, [name]: value }));
  };

  const validateUserForm = () => {
    const next = {};
    if (!selectedUser) next.user = "Chọn 1 user cần gửi thông báo";
    if (!userForm.title?.trim()) next.title = "Bắt buộc";
    if (!userForm.body?.trim()) next.body = "Bắt buộc";
    if (userForm.badge && isNaN(Number(userForm.badge))) next.badge = "Phải là số";
    if (userForm.ttl && (isNaN(Number(userForm.ttl)) || Number(userForm.ttl) < 0))
      next.ttl = "Số ≥ 0";
    setUserErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmitUser = () => {
    if (!validateUserForm()) return;
    setUserConfirmOpen(true);
  };

  const onConfirmSendUser = async () => {
    try {
      const payload = {
        userId: selectedUser._id,
        title: userForm.title.trim(),
        body: userForm.body.trim(),
        url: userForm.url?.trim() || undefined,
        badge: userForm.badge ? Number(userForm.badge) : undefined,
        ttl: userForm.ttl ? Number(userForm.ttl) : undefined,
      };
      const data = await sendToUser(payload).unwrap();
      const sum = data?.summary || {};
      setSnack({
        open: true,
        severity: "success",
        msg: `Đã gửi thông báo tới ${
          selectedUser.nickname || selectedUser.name || selectedUser.phone || "user"
        }! Dispatch: ${data?.dispatchId || "unknown"}, Tokens: ${sum.tokens ?? "?"}, Ticket OK: ${
          sum.ticketOk ?? "?"
        }, Ticket Err: ${sum.ticketError ?? "?"}`,
      });
      setUserForm({
        title: "",
        body: "",
        url: "",
        badge: "",
        ttl: "",
      });
    } catch (e) {
      setSnack({
        open: true,
        severity: "error",
        msg: e?.data?.message || "Gửi thất bại",
      });
    } finally {
      setUserConfirmOpen(false);
    }
  };

  const onResetUser = () => {
    setUserForm({
      title: "",
      body: "",
      url: "",
      badge: "",
      ttl: "",
    });
    setUserErrors({});
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Grid container spacing={2}>
          {/* ==== Form broadcast toàn hệ thống ==== */}
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
                        inputProps={{
                          inputMode: "numeric",
                          pattern: "[0-9]*",
                        }}
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
                        inputProps={{
                          inputMode: "numeric",
                          pattern: "[0-9]*",
                        }}
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

          {/* Preview broadcast */}
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

          {/* ==== Form gửi cho user cụ thể ==== */}
          <Grid item xs={12} md={7}>
            <Card elevation={1}>
              <CardHeader
                avatar={<PersonSearchIcon color="primary" />}
                title="Gửi thông báo tới user cụ thể"
                subheader="Tìm kiếm user theo tên / nickname / số điện thoại / tỉnh rồi gửi push riêng."
              />
              <CardContent>
                <Stack spacing={2}>
                  {/* Tìm user - Autocomplete */}
                  <Autocomplete
                    fullWidth
                    options={searchResults}
                    value={selectedUser}
                    inputValue={userSearch}
                    loading={isSearching}
                    onInputChange={(_, value) => handleUserInputChange(_, value)}
                    onChange={(_, newValue) => {
                      setSelectedUser(newValue);
                      setUserErrors((prev) => ({ ...prev, user: undefined }));
                    }}
                    getOptionLabel={(option) =>
                      option?.nickname || option?.name || option?.phone || ""
                    }
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    noOptionsText={
                      userSearch.trim()
                        ? "Không tìm thấy user phù hợp."
                        : "Nhập từ khoá để tìm user."
                    }
                    renderOption={(props, u) => (
                      <li {...props} key={u._id}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ width: "100%" }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              src={u.avatar}
                              alt={u.nickname || u.name}
                              sx={{ width: 32, height: 32 }}
                            >
                              {(u.nickname || u.name || "?").toString().charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">{u.nickname || u.name}</Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {u.name && u.nickname ? `${u.name} · ` : u.name || ""}
                                {u.phone ? `📱 ${u.phone} · ` : ""}
                                {u.province || ""}
                              </Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ textAlign: "right" }}>
                            {u.score && (
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                S: {u.score.single ?? 0} · D: {u.score.double ?? 0}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Tìm user"
                        placeholder="Nhập tên, nickname, số điện thoại hoặc tỉnh..."
                        error={!!userErrors.user}
                        helperText={userErrors.user || ""}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {isSearching ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  {/* Form nội dung notif cho user */}
                  <Divider />
                  <TextField
                    label="Tiêu đề"
                    name="title"
                    value={userForm.title}
                    onChange={handleUserFormChange}
                    error={!!userErrors.title}
                    helperText={userErrors.title || "Tối đa ~64 ký tự"}
                    inputProps={{ maxLength: 64 }}
                    fullWidth
                    required
                  />
                  <TextField
                    label="Nội dung"
                    name="body"
                    value={userForm.body}
                    onChange={handleUserFormChange}
                    error={!!userErrors.body}
                    helperText={userErrors.body || "Tối đa ~200 ký tự"}
                    inputProps={{ maxLength: 200 }}
                    fullWidth
                    required
                    multiline
                    minRows={3}
                  />
                  <TextField
                    label="Link mở trong app (optional)"
                    name="url"
                    value={userForm.url}
                    onChange={handleUserFormChange}
                    helperText="Ví dụ: /tournament/abc123 (hook của bạn sẽ deep-link bằng data.url)"
                    fullWidth
                    InputProps={{
                      startAdornment: <LinkIcon sx={{ mr: 1, color: "text.secondary" }} />,
                    }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="Badge"
                        name="badge"
                        value={userForm.badge}
                        onChange={handleUserFormChange}
                        error={!!userErrors.badge}
                        helperText={userErrors.badge || ""}
                        placeholder="1"
                        fullWidth
                        inputProps={{
                          inputMode: "numeric",
                          pattern: "[0-9]*",
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label="TTL (giây)"
                        name="ttl"
                        value={userForm.ttl}
                        onChange={handleUserFormChange}
                        error={!!userErrors.ttl}
                        helperText={userErrors.ttl || "Thời gian sống của notif"}
                        placeholder="3600"
                        fullWidth
                        inputProps={{
                          inputMode: "numeric",
                          pattern: "[0-9]*",
                        }}
                      />
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={<SendIcon />}
                      onClick={onSubmitUser}
                      disabled={isSendingUser}
                    >
                      Gửi cho user này
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<RestartAltIcon />}
                      onClick={onResetUser}
                      disabled={isSendingUser}
                    >
                      Xoá
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview notif user */}
          <Grid item xs={12} md={5}>
            <Card elevation={1}>
              <CardHeader
                title="Preview notif cho user"
                subheader={
                  selectedUser
                    ? `Sẽ gửi tới: ${
                        selectedUser.nickname ||
                        selectedUser.name ||
                        selectedUser.phone ||
                        selectedUser._id
                      }`
                    : "Chưa chọn user"
                }
              />
              <CardContent>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Notification preview
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {userPreview.title}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {userPreview.body}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block", mt: 1 }}
                  >
                    Link: {userPreview.url || "(không có)"}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Confirm dialog broadcast toàn hệ thống */}
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

        {/* Confirm dialog gửi cho user */}
        <Dialog
          open={userConfirmOpen}
          onClose={() => setUserConfirmOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Xác nhận gửi cho user</DialogTitle>
          <DialogContent dividers>
            {selectedUser ? (
              <Typography>
                <strong>User:</strong>{" "}
                {selectedUser.nickname || selectedUser.name || selectedUser.phone || "(không tên)"}
              </Typography>
            ) : (
              <Typography color="error">
                Chưa chọn user. Vui lòng chọn 1 user trong danh sách.
              </Typography>
            )}
            <Typography sx={{ mt: 1 }}>
              <strong>Tiêu đề:</strong> {userPreview.title}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              <strong>Nội dung:</strong> {userPreview.body}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              <strong>Link:</strong> {userPreview.url || "(không)"}{" "}
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              Thao tác này chỉ gửi tới duy nhất user được chọn.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserConfirmOpen(false)}>Huỷ</Button>
            <Button
              onClick={onConfirmSendUser}
              variant="contained"
              startIcon={<SendIcon />}
              disabled={isSendingUser || !selectedUser}
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
