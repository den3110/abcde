// src/layouts/admin/AutoUserPage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Divider,
  Alert,
  Snackbar,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Tooltip,
  IconButton,
  FormControl,
  FormHelperText,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PreviewIcon from "@mui/icons-material/Preview";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import CloseIcon from "@mui/icons-material/Close";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

import {
  usePreviewAutoUsersMutation,
  useCreateAutoUsersMutation,
} from "slices/tournamentsApiSlice";
import PropTypes from "prop-types";
// Upload avatar: mutation nhận trực tiếp File/Blob, field "avatar" được append trong slice
import { useUploadAvatarMutation } from "slices/tournamentsApiSlice";
// Admin tạo user
import { useAdminCreateUserMutation } from "slices/adminUsersApiSlice";

/* ====== Provinces (VN) ====== */
const PROVINCES = [
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cần Thơ",
  "Cao Bằng",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "TP. Hồ Chí Minh",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

function toCSV(rows) {
  if (!rows?.length) return "";
  const cols = [
    "name",
    "email",
    "role",
    "verified",
    "gender",
    "province",
    "nickname",
    "phone",
    "dob",
    "cccd",
    "cccdStatus",
    "plainPassword",
    "_id",
    "createdAt",
  ];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))];
  return lines.join("\n");
}

/* ------------------ Utils ------------------ */
const randFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const genPassword = (len = 12) => {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const L = "abcdefghijkmnopqrstuvwxyz";
  const D = "23456789";
  const S = "!@#$%^&*()-_=+[]{}";
  const all = U + L + D + S;
  const base = [randFrom(U), randFrom(L), randFrom(D), randFrom(S)];
  while (base.length < len) base.push(randFrom(all));
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
};

/* ------------------ Dialog: Tạo user thủ công ------------------ */
function ManualCreateUserDialog({ open, onClose, onCreated }) {
  const [uploadAvatar, { isLoading: uploading }] = useUploadAvatarMutation();
  const [adminCreateUser, { isLoading: creating }] = useAdminCreateUserMutation();

  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    phone: "",
    password: genPassword(12),
    avatarFile: null,
    avatarPreview: "",
    avatarUrl: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [toast, setToast] = useState("");

  // Reset & random lại khi mở
  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        nickname: "",
        phone: "",
        password: genPassword(12),
        avatarFile: null,
        avatarPreview: "",
        avatarUrl: "",
      });
      setShowPass(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  // Thu hồi objectURL khi thay đổi hoặc unmount để tránh leak
  useEffect(() => {
    return () => {
      if (form.avatarPreview) URL.revokeObjectURL(form.avatarPreview);
    };
  }, [form.avatarPreview]);

  const onPickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setToast("File không phải ảnh.");
      return;
    }
    const preview = URL.createObjectURL(f);
    // Thu hồi preview cũ nếu có
    if (form.avatarPreview) URL.revokeObjectURL(form.avatarPreview);
    setForm((s) => ({ ...s, avatarFile: f, avatarPreview: preview }));
  };

  const clearAvatar = () => {
    if (form.avatarPreview) URL.revokeObjectURL(form.avatarPreview);
    setForm((s) => ({ ...s, avatarFile: null, avatarPreview: "", avatarUrl: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const clearAll = () => {
    clearAvatar();
    setForm({
      name: "",
      nickname: "",
      phone: "",
      password: genPassword(12),
      avatarFile: null,
      avatarPreview: "",
      avatarUrl: "",
    });
    setShowPass(false);
  };

  const canSubmit = Boolean(form.name?.trim() && form.nickname?.trim() && form.password);

  const handleCreate = async () => {
    try {
      // 1) Upload avatar nếu có file (slice nhận trực tiếp File)
      let avatarUrl = (form.avatarUrl || "").trim();
      if (form.avatarFile instanceof File || form.avatarFile instanceof Blob) {
        const up = await uploadAvatar(form.avatarFile).unwrap();
        avatarUrl =
          up?.url ||
          up?.avatar ||
          up?.path ||
          up?.Location ||
          up?.secure_url ||
          up?.data?.url ||
          "";
      }

      // 2) Payload tạo user
      const payload = {
        role: "user",
        name: String(form.name || "").trim(),
        nickname: String(form.nickname || "").trim(),
        phone: String(form.phone || "").trim(),
        password: String(form.password || "").trim() || genPassword(12),
        verified: "pending",
        gender: "unspecified",
      };
      if (avatarUrl) payload.avatar = avatarUrl;

      // 3) Tạo user
      const res = await adminCreateUser(payload).unwrap();

      setToast("Tạo user thành công");
      onCreated?.(res?.user || res);

      // 4) Clear & đóng popup
      clearAll();
      onClose?.();
    } catch (e) {
      setToast(e?.data?.message || e?.error || "Tạo user thất bại");
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 3 }}>
          <PersonAddAlt1Icon />
          Tạo user thủ công
        </DialogTitle>
        <DialogContent dividers sx={{ px: 3, pt: 2, pb: 1, pr: 3 }}>
          <Stack spacing={2}>
            {/* Avatar chọn/preview */}
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar
                src={form.avatarPreview || form.avatarUrl || ""}
                alt={form.name || form.nickname || "avatar"}
                sx={{ width: 72, height: 72 }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  disabled={uploading || creating}
                >
                  Chọn ảnh
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={onPickAvatar}
                  />
                </Button>
                {!!(form.avatarPreview || form.avatarUrl) && (
                  <Button
                    color="error"
                    variant="text"
                    startIcon={<CloseIcon />}
                    onClick={clearAvatar}
                    disabled={uploading || creating}
                  >
                    Bỏ ảnh
                  </Button>
                )}
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Họ tên"
                  fullWidth
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nickname"
                  fullWidth
                  value={form.nickname}
                  onChange={(e) => setForm((s) => ({ ...s, nickname: e.target.value }))}
                  required
                  helperText="Bắt buộc với role user (unique)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Số điện thoại"
                  fullWidth
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Mật khẩu"
                  fullWidth
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  type={showPass ? "text" : "password"}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                          <IconButton onClick={() => setShowPass((v) => !v)} edge="end">
                            {showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Random lại mật khẩu">
                          <IconButton
                            onClick={() => setForm((s) => ({ ...s, password: genPassword(12) }))}
                            edge="end"
                          >
                            <ShuffleIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Có thể nhập tay hoặc bấm random lại."
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {(uploading || creating) && (
            <Box sx={{ mr: 2, minWidth: 160 }}>
              <LinearProgress />
            </Box>
          )}
          <Button onClick={onClose} disabled={uploading || creating}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!canSubmit || uploading || creating}
            startIcon={creating ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          >
            Tạo user
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
      />
    </>
  );
}

ManualCreateUserDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
};
ManualCreateUserDialog.defaultProps = {
  onCreated: () => {},
};

/* ------------------ Trang chính ------------------ */
export default function AutoUserPage() {
  const [form, setForm] = useState({
    count: 10,
    role: "user",
    emailDomain: "example.com",
    passwordMode: "random",
    fixedPassword: "P@ssw0rd!",
    randomLength: 10,
    verified: "pending",
    withCCCD: false,
    cccdStatus: "unverified",
    gender: "unspecified",
    province: "",
    seed: "",
  });

  const [preview, { isLoading: loadingPreview }] = usePreviewAutoUsersMutation();
  const [createUsers, { isLoading: loadingCreate }] = useCreateAutoUsersMutation();

  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [openManual, setOpenManual] = useState(false);

  const isUser = form.role === "user";

  const handleChange = (key) => (e, valFromToggle) => {
    let val =
      e && e.target !== undefined
        ? e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value
        : valFromToggle;

    if (["count", "randomLength"].includes(key)) val = Number(val);
    setForm((s) => ({ ...s, [key]: val }));
  };

  const payload = useMemo(() => {
    const p = { ...form };
    if (!p.seed) delete p.seed;
    if (!p.province) delete p.province;
    if (p.passwordMode !== "fixed") delete p.fixedPassword;
    return p;
  }, [form]);

  const doPreview = async () => {
    try {
      const res = await preview(payload).unwrap();
      setRows(res.users || []);
      setToast(`Xem trước ${res.count} user`);
    } catch (e) {
      setToast(e?.data?.message || "Preview lỗi");
    }
  };

  const doCreate = async () => {
    try {
      const res = await createUsers(payload).unwrap();
      setRows(res.users || []);
      setToast(`Tạo thành công ${res.created} user`);
    } catch (e) {
      setToast(e?.data?.message || "Tạo user lỗi");
    }
  };

  const downloadCSV = () => {
    const csv = toCSV(filteredRowsRaw);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auto-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRowsRaw = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.nickname?.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  const gridRows = useMemo(
    () =>
      filteredRowsRaw.map((r, i) => ({
        id: r._id || `${r.email || "row"}-${i}`,
        ...r,
      })),
    [filteredRowsRaw]
  );

  const columns = useMemo(
    () => [
      {
        field: "idx",
        headerName: "#",
        width: 70,
        sortable: false,
        valueGetter: (params) => gridRows.findIndex((rr) => rr.id === params.id) + 1,
      },
      { field: "name", headerName: "name", flex: 1, minWidth: 160 },
      { field: "email", headerName: "email", flex: 1.2, minWidth: 220 },
      { field: "role", headerName: "role", width: 110 },
      { field: "verified", headerName: "verified", width: 120 },
      { field: "gender", headerName: "gender", width: 120 },
      { field: "province", headerName: "province", width: 150 },
      { field: "nickname", headerName: "nickname", width: 150 },
      { field: "phone", headerName: "phone", width: 150 },
      {
        field: "dob",
        headerName: "dob",
        width: 120,
        valueFormatter: ({ value }) => (value ? new Date(value).toISOString().slice(0, 10) : ""),
      },
      { field: "cccd", headerName: "cccd", width: 150 },
      { field: "cccdStatus", headerName: "cccdStatus", width: 140 },
      {
        field: "plainPassword",
        headerName: "plainPassword",
        width: 160,
        renderCell: (params) =>
          params.value ? (
            <span style={{ fontFamily: "monospace" }}>
              {showPassword ? params.value : "••••••••"}
            </span>
          ) : (
            ""
          ),
        sortable: false,
        filterable: false,
      },
      { field: "_id", headerName: "_id", flex: 1, minWidth: 220 },
    ],
    [showPassword, gridRows]
  );

  const LoadingBar = (loadingPreview || loadingCreate) && (
    <Box mt={1}>
      <LinearProgress />
    </Box>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2} sx={{ display: "grid", gap: 16 }}>
        {/* Header */}
        <Box
          sx={{
            p: 2.5,
            bgcolor: "background.paper",
            borderRadius: 3,
            boxShadow: (t) => t.shadows[1],
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={800} display="flex" alignItems="center" gap={1}>
              <PersonAddAlt1Icon fontSize="medium" />
              Tự tạo user (Admin)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sinh nhanh tài khoản hợp lệ theo role • Tự xử lý trùng lặp • Xuất CSV
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Chip size="small" color="primary" variant="outlined" label={`Role: ${form.role}`} />
            <Chip size="small" variant="outlined" label={`Verified: ${form.verified}`} />
            <Chip size="small" variant="outlined" label={`Count: ${form.count}`} />

            <Button
              variant="contained"
              color="secondary"
              startIcon={<PersonAddAlt1Icon />}
              onClick={() => setOpenManual(true)}
            >
              Tạo user thủ công
            </Button>
          </Stack>
        </Box>

        {/* Config */}
        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent>
            <Grid container spacing={2}>
              {/* Role */}
              <Grid item xs={12} md={6}>
                <Typography fontWeight={700} gutterBottom>
                  Role
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={form.role}
                  onChange={(_, v) => v && handleChange("role")(null, v)}
                >
                  <ToggleButton value="user">User</ToggleButton>
                  <ToggleButton value="referee">Referee</ToggleButton>
                  <ToggleButton value="admin">Admin</ToggleButton>
                </ToggleButtonGroup>
                {isUser && (
                  <FormHelperText sx={{ ml: 0, mt: 0.5 }}>
                    User bắt buộc có <b>nickname</b>, <b>phone</b>, <b>dob</b>.
                  </FormHelperText>
                )}
              </Grid>

              {/* Verified & Gender */}
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <Box>
                    <Typography fontWeight={700} gutterBottom>
                      Trạng thái xác thực
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={form.verified}
                      onChange={(_, v) => v && handleChange("verified")(null, v)}
                    >
                      <ToggleButton value="pending">Pending</ToggleButton>
                      <ToggleButton value="verified">Verified</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  <Box>
                    <Typography fontWeight={700} gutterBottom>
                      Giới tính
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={form.gender}
                      onChange={(_, v) => v && handleChange("gender")(null, v)}
                    >
                      <ToggleButton value="unspecified">Unspecified</ToggleButton>
                      <ToggleButton value="male">Male</ToggleButton>
                      <ToggleButton value="female">Female</ToggleButton>
                      <ToggleButton value="other">Other</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </Stack>
              </Grid>

              {/* Count + domain */}
              <Grid item xs={12} md={6}>
                <Typography fontWeight={700} gutterBottom>
                  Số lượng <Chip size="small" label={form.count} sx={{ ml: 1 }} />
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Slider
                    min={1}
                    max={1000}
                    value={form.count}
                    onChange={(_, v) => handleChange("count")(null, v)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    type="number"
                    size="small"
                    value={form.count}
                    onChange={handleChange("count")}
                    inputProps={{ min: 1, max: 1000 }}
                    sx={{ width: 110 }}
                  />
                </Stack>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <Typography fontWeight={700} gutterBottom>
                    Email domain
                  </Typography>
                  <TextField
                    placeholder="example.com"
                    value={form.emailDomain}
                    onChange={handleChange("emailDomain")}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">@</InputAdornment>,
                    }}
                  />
                  <FormHelperText>Domain để sinh email (vd: yourclub.vn)</FormHelperText>
                </FormControl>
              </Grid>

              {/* Password */}
              <Grid item xs={12} md={6}>
                <Typography fontWeight={700} gutterBottom>
                  Mật khẩu
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={form.passwordMode}
                  onChange={(_, v) => v && handleChange("passwordMode")(null, v)}
                >
                  <ToggleButton value="random">
                    <ShuffleIcon fontSize="small" style={{ marginRight: 6 }} /> Random
                  </ToggleButton>
                  <ToggleButton value="fixed">Cố định</ToggleButton>
                </ToggleButtonGroup>

                {form.passwordMode === "fixed" ? (
                  <Box mt={1.5}>
                    <TextField
                      label="Fixed password"
                      fullWidth
                      value={form.fixedPassword}
                      onChange={handleChange("fixedPassword")}
                    />
                    <FormHelperText>Mật khẩu cố định áp dụng cho tất cả tài khoản.</FormHelperText>
                  </Box>
                ) : (
                  <Box mt={1.5}>
                    <TextField
                      label="Random length"
                      type="number"
                      value={form.randomLength}
                      onChange={handleChange("randomLength")}
                      sx={{ width: 200 }}
                    />
                    <FormHelperText>Độ dài mật khẩu ngẫu nhiên.</FormHelperText>
                  </Box>
                )}
              </Grid>

              {/* Advanced */}
              <Grid item xs={12}>
                <Accordion disableGutters sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TuneIcon fontSize="small" />
                      <Typography fontWeight={700}>Tùy chọn nâng cao</Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          select
                          label="Province (optional)"
                          fullWidth
                          value={form.province}
                          onChange={handleChange("province")}
                        >
                          <MenuItem value="">— Random —</MenuItem>
                          {PROVINCES.map((p) => (
                            <MenuItem key={p} value={p}>
                              {p}
                            </MenuItem>
                          ))}
                        </TextField>
                        <FormHelperText>Để “Random” nếu muốn hệ thống tự chọn.</FormHelperText>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Seed (optional)"
                          fullWidth
                          value={form.seed}
                          onChange={handleChange("seed")}
                        />
                        <FormHelperText>Cố định kết quả random (nếu cần).</FormHelperText>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControlLabel
                          control={
                            <Checkbox checked={form.withCCCD} onChange={handleChange("withCCCD")} />
                          }
                          label="Kèm CCCD"
                        />
                        {form.withCCCD && (
                          <TextField
                            select
                            label="CCCD Status"
                            fullWidth
                            sx={{ mt: 1 }}
                            value={form.cccdStatus}
                            onChange={handleChange("cccdStatus")}
                          >
                            <MenuItem value="unverified">unverified</MenuItem>
                            <MenuItem value="pending">pending</MenuItem>
                            <MenuItem value="verified">verified</MenuItem>
                            <MenuItem value="rejected">rejected</MenuItem>
                          </TextField>
                        )}
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>

            {(loadingPreview || loadingCreate) && (
              <Box mt={1}>
                <LinearProgress />
              </Box>
            )}

            {/* Sticky action bar */}
            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                mt: 2,
                py: 1.5,
                px: 2,
                bgcolor: "background.paper",
                borderTop: (t) => `1px solid ${t.palette.divider}`,
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
                borderRadius: "0 0 12px 12px",
              }}
            >
              <Button
                variant="outlined"
                onClick={doPreview}
                disabled={loadingPreview}
                startIcon={loadingPreview ? <CircularProgress size={16} /> : <PreviewIcon />}
              >
                Xem trước
              </Button>
              <Button
                variant="contained"
                onClick={doCreate}
                disabled={loadingCreate}
                startIcon={loadingCreate ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              >
                Tạo user
              </Button>
              <Tooltip title={gridRows.length ? "Xuất CSV" : "Chưa có dữ liệu"}>
                <span>
                  <Button
                    variant="text"
                    startIcon={<FileDownloadIcon />}
                    onClick={downloadCSV}
                    disabled={!gridRows.length}
                  >
                    Export CSV
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>

        {/* Result */}
        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
              mb={1}
            >
              <Typography fontWeight={700} display="flex" gap={1} alignItems="center">
                <AutoModeIcon fontSize="small" />
                Kết quả ({gridRows.length}/{rows.length})
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Lọc theo tên/email/nickname…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <Tooltip title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                  <IconButton onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Divider sx={{ mb: 1 }} />

            {!rows.length ? (
              <Alert severity="info">Chưa có dữ liệu. Hãy Xem trước hoặc Tạo user.</Alert>
            ) : (
              <Box sx={{ height: 520, width: "100%" }}>
                <DataGrid
                  rows={gridRows}
                  columns={columns}
                  disableRowSelectionOnClick
                  density="compact"
                  pageSizeOptions={[25, 50, 100]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25, page: 0 } },
                    columns: { columnVisibilityModel: { _id: false } },
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        <Snackbar
          open={!!toast}
          autoHideDuration={3000}
          onClose={() => setToast("")}
          message={toast}
        />
      </Box>

      {/* Popup tạo user thủ công */}
      <ManualCreateUserDialog
        open={openManual}
        onClose={() => setOpenManual(false)}
        onCreated={(u) => {
          if (u) setRows((prev) => [u, ...prev]);
          setToast("Đã tạo 1 user thủ công");
        }}
      />
    </DashboardLayout>
  );
}
