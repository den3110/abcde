// src/layouts/admin/AutoUserPage.jsx
import React, { useMemo, useState } from "react";
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

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// hooks của bạn
import {
  usePreviewAutoUsersMutation,
  useCreateAutoUsersMutation,
} from "slices/tournamentsApiSlice";

// ====== Provinces (VN) ======
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
    province: "", // "" = random; khi chọn sẽ là tên tỉnh
    seed: "",
  });

  const [preview, { isLoading: loadingPreview }] = usePreviewAutoUsersMutation();
  const [createUsers, { isLoading: loadingCreate }] = useCreateAutoUsersMutation();

  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    if (!p.province) delete p.province; // "" => random server
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

  // Lọc trước khi đổ vào DataGrid
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

  // Chuẩn hóa rows cho DataGrid (cần field id)
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
        valueGetter: (v, row, col, id) => gridRows.findIndex((rr) => rr.id === id) + 1,
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
        field: "__plainPassword",
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

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip size="small" color="primary" variant="outlined" label={`Role: ${form.role}`} />
            <Chip size="small" variant="outlined" label={`Verified: ${form.verified}`} />
            <Chip size="small" variant="outlined" label={`Count: ${form.count}`} />
            {isUser && (
              <Chip
                size="small"
                variant="outlined"
                color="success"
                label="Yêu cầu: nickname/phone/dob"
              />
            )}
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
                    columns: { columnVisibilityModel: { _id: false } }, // ẩn _id nếu muốn
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
    </DashboardLayout>
  );
}
