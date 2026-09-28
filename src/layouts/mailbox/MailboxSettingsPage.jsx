/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit, Wifi as TestIcon, Refresh } from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useGetMailboxAccountsQuery,
  useCreateMailboxAccountMutation,
  useUpdateMailboxAccountMutation,
  useDeleteMailboxAccountMutation,
  useTestMailboxAccountMutation,
} from "slices/mailboxApiSlice";

const EMPTY = {
  email: "",
  label: "",
  fromName: "",
  username: "",
  password: "",
  imapHost: "imap.hostinger.com",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  smtpSecure: true,
  enabled: true,
};

function MailboxSettingsPage() {
  const { data, isLoading, refetch } = useGetMailboxAccountsQuery();
  const accounts = data?.data || [];

  const [createAccount, { isLoading: creating }] = useCreateMailboxAccountMutation();
  const [updateAccount, { isLoading: updating }] = useUpdateMailboxAccountMutation();
  const [deleteAccount] = useDeleteMailboxAccountMutation();
  const [testAccount, { isLoading: testing }] = useTestMailboxAccountMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState("");

  const onChange = (k) => (e) => {
    const v = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setTestResult(null);
    setError("");
    setOpen(true);
  };

  const openEdit = (acc) => {
    setForm({
      email: acc.email || "",
      label: acc.label || "",
      fromName: acc.fromName || "",
      username: acc.username || "",
      password: "", // để trống = giữ mật khẩu cũ
      imapHost: acc.imapHost || "imap.hostinger.com",
      imapPort: acc.imapPort || 993,
      imapSecure: acc.imapSecure !== false,
      smtpHost: acc.smtpHost || "smtp.hostinger.com",
      smtpPort: acc.smtpPort || 465,
      smtpSecure: acc.smtpSecure !== false,
      enabled: acc.enabled !== false,
    });
    setEditId(acc.id);
    setTestResult(null);
    setError("");
    setOpen(true);
  };

  const doTest = async () => {
    setError("");
    setTestResult(null);
    try {
      const body = { ...form, id: editId || "new" };
      const r = await testAccount(body).unwrap();
      setTestResult(r);
    } catch (e) {
      setError(e?.data?.error || e?.error || "Không kiểm tra được kết nối");
    }
  };

  const save = async () => {
    setError("");
    try {
      const body = { ...form };
      if (editId && !body.password) delete body.password; // giữ mật khẩu cũ
      if (editId) await updateAccount({ id: editId, ...body }).unwrap();
      else await createAccount(body).unwrap();
      setOpen(false);
      refetch();
    } catch (e) {
      setError(e?.data?.error || e?.error || "Lưu thất bại");
    }
  };

  const remove = async (acc) => {
    if (!window.confirm(`Xoá hộp thư ${acc.email}?`)) return;
    await deleteAccount(acc.id).unwrap();
    refetch();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h5" fontWeight="bold">
              Cấu hình hộp thư
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Refresh />} onClick={() => refetch()}>
                Tải lại
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={openNew}>
                Thêm hộp thư
              </Button>
            </Stack>
          </Stack>

          {isLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ display: "table-header-group" }}>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Tên hiển thị</TableCell>
                  <TableCell>IMAP</TableCell>
                  <TableCell>SMTP</TableCell>
                  <TableCell>Mật khẩu</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.email}</TableCell>
                    <TableCell>{a.label || a.fromName || "-"}</TableCell>
                    <TableCell>
                      {a.imapHost}:{a.imapPort}
                    </TableCell>
                    <TableCell>
                      {a.smtpHost}:{a.smtpPort}
                    </TableCell>
                    <TableCell>
                      {a.hasPassword ? (
                        <Chip size="small" color="success" label="Đã lưu" />
                      ) : (
                        <Chip size="small" color="warning" label="Chưa có" />
                      )}
                    </TableCell>
                    <TableCell>
                      {a.enabled ? (
                        <Chip size="small" color="info" label="Bật" />
                      ) : (
                        <Chip size="small" label="Tắt" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Sửa">
                        <IconButton onClick={() => openEdit(a)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá">
                        <IconButton color="error" onClick={() => remove(a)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" py={2}>
                        Chưa có hộp thư nào. Bấm “Thêm hộp thư”.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </MDBox>
      <Footer />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? "Sửa hộp thư" : "Thêm hộp thư"}</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {testResult && (
            <Alert severity={testResult.ok ? "success" : "warning"} sx={{ mb: 2 }}>
              IMAP: {testResult.imap?.ok ? "OK" : `Lỗi — ${testResult.imap?.error}`} · SMTP:{" "}
              {testResult.smtp?.ok ? "OK" : `Lỗi — ${testResult.smtp?.error}`}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                value={form.email}
                onChange={onChange("email")}
                placeholder="support@pickletour.vn"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tên hiển thị (khi gửi)"
                fullWidth
                value={form.fromName}
                onChange={onChange("fromName")}
                placeholder="PickleTour Support"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nhãn (sidebar)"
                fullWidth
                value={form.label}
                onChange={onChange("label")}
                placeholder="Hỗ trợ"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Username (mặc định = email)"
                fullWidth
                value={form.username}
                onChange={onChange("username")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={editId ? "Mật khẩu (để trống nếu giữ nguyên)" : "Mật khẩu"}
                type="password"
                fullWidth
                value={form.password}
                onChange={onChange("password")}
                autoComplete="new-password"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch checked={form.enabled} onChange={onChange("enabled")} />
                }
                label="Bật hộp thư"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" mt={1}>
                IMAP (đọc thư)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="IMAP host" fullWidth value={form.imapHost} onChange={onChange("imapHost")} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="IMAP port" type="number" fullWidth value={form.imapPort} onChange={onChange("imapPort")} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={form.imapSecure} onChange={onChange("imapSecure")} />}
                label="SSL"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" mt={1}>
                SMTP (gửi thư)
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="SMTP host" fullWidth value={form.smtpHost} onChange={onChange("smtpHost")} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="SMTP port" type="number" fullWidth value={form.smtpPort} onChange={onChange("smtpPort")} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControlLabel
                control={<Switch checked={form.smtpSecure} onChange={onChange("smtpSecure")} />}
                label="SSL"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={doTest} startIcon={testing ? <CircularProgress size={16} /> : <TestIcon />} disabled={testing}>
            Kiểm tra kết nối
          </Button>
          <Box flex={1} />
          <Button onClick={() => setOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={save} disabled={creating || updating}>
            {editId ? "Lưu" : "Thêm"}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default MailboxSettingsPage;
