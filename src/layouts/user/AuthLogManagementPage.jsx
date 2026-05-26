import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import {
  useGetAuthLogDetailQuery,
  useGetAuthLogsQuery,
} from "slices/adminApiSlice";

const PAGE_SIZE = 30;

const fmtDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
};

const userLabel = (user, fallback = "") =>
  user?.nickname || user?.name || user?.phone || user?.email || fallback || "-";

const statusColor = (status) => (status === "success" ? "success" : "error");

const tableCellSx = {
  py: 1.5,
  px: 2,
  verticalAlign: "top",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const ellipsisSx = {
  display: "block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function AuthLogManagementPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isFetching, refetch } = useGetAuthLogsQuery({
    page,
    pageSize: PAGE_SIZE,
    keyword,
    action,
    channel,
    status,
  });
  const { data: detail } = useGetAuthLogDetailQuery(selectedId, {
    skip: !selectedId,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, data?.totalPages || Math.ceil(total / PAGE_SIZE));

  const summary = useMemo(() => {
    const success = logs.filter((l) => l.status === "success").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    return { success, failed };
  }, [logs]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Tổng log theo bộ lọc
              </Typography>
              <Typography variant="h4">{total}</Typography>
            </Card>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Thành công trên trang này
              </Typography>
              <Typography variant="h4">{summary.success}</Typography>
            </Card>
            <Card sx={{ flex: 1, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Thất bại trên trang này
              </Typography>
              <Typography variant="h4">{summary.failed}</Typography>
            </Card>
          </Stack>

          <Card>
            <MDBox p={3}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                alignItems={{ xs: "stretch", lg: "center" }}
                justifyContent="space-between"
                spacing={2}
                mb={2}
              >
                <Box>
                  <Typography variant="h5">Log đăng ký / đăng nhập</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Theo dõi toàn bộ API đăng ký, đăng nhập web, app mobile và admin.
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    size="small"
                    label="Tìm kiếm"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Email, SĐT, IP, user id"
                    sx={{ minWidth: 240 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Loại</InputLabel>
                    <Select
                      value={action}
                      label="Loại"
                      onChange={(e) => {
                        setAction(e.target.value);
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="login">Đăng nhập</MenuItem>
                      <MenuItem value="register">Đăng ký</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Kênh</InputLabel>
                    <Select
                      value={channel}
                      label="Kênh"
                      onChange={(e) => {
                        setChannel(e.target.value);
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="web">Web</MenuItem>
                      <MenuItem value="mobile">Mobile</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Trạng thái</InputLabel>
                    <Select
                      value={status}
                      label="Trạng thái"
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">Tất cả</MenuItem>
                      <MenuItem value="success">Thành công</MenuItem>
                      <MenuItem value="failed">Thất bại</MenuItem>
                    </Select>
                  </FormControl>
                  <Button variant="outlined" onClick={() => refetch()} disabled={isFetching}>
                    Tải lại
                  </Button>
                </Stack>
              </Stack>

              {isFetching && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Đang tải log...
                </Typography>
              )}

              <TableContainer sx={{ overflowX: "hidden" }}>
                <Table
                  size="small"
                  sx={{
                    width: "100%",
                    tableLayout: "fixed",
                    "& .MuiTableCell-root": tableCellSx,
                  }}
                >
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell sx={{ width: "15%", fontWeight: 700 }}>Thời gian</TableCell>
                      <TableCell sx={{ width: "23%", fontWeight: 700 }}>User</TableCell>
                      <TableCell sx={{ width: "22%", fontWeight: 700 }}>API</TableCell>
                      <TableCell sx={{ width: "24%", fontWeight: 700 }}>IP / Thiết bị</TableCell>
                      <TableCell align="center" sx={{ width: "10%", fontWeight: 700 }}>
                        Trạng thái
                      </TableCell>
                      <TableCell align="right" sx={{ width: "6%", fontWeight: 700 }}>
                        Chi tiết
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <Typography variant="body2">{fmtDate(log.createdAt)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            HTTP {log.statusCode || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            sx={{ minWidth: 0 }}
                          >
                            <Avatar src={log.user?.avatar || ""}>
                              {userLabel(log.user, log.loginKey).charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="button" sx={ellipsisSx}>
                                {userLabel(log.user, log.loginKey)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={ellipsisSx}>
                                {log.email || log.phone || log.loginKey || "-"}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} mb={0.5}>
                            <Chip size="small" label={log.action} />
                            <Chip size="small" variant="outlined" label={log.channel} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={ellipsisSx}>
                            {log.method} {log.path}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{log.ip || "-"}</Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={ellipsisSx}
                          >
                            {log.userAgent || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={statusColor(log.status)}
                            label={log.status === "success" ? "Thành công" : "Thất bại"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setSelectedId(log._id)}>
                            Xem
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!logs.length && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Alert severity="info">Chưa có log trong bộ lọc này.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Grid container alignItems="center" justifyContent="space-between" mt={2}>
                <Grid item>
                  <Typography variant="caption" color="text.secondary">
                    Tổng {total} log
                  </Typography>
                </Grid>
                <Grid item>
                  <Pagination
                    page={page}
                    count={totalPages}
                    color="primary"
                    onChange={(_, nextPage) => setPage(nextPage)}
                  />
                </Grid>
              </Grid>
            </MDBox>
          </Card>
        </Stack>
      </MDBox>
      <Footer />

      <Dialog open={!!selectedId} onClose={() => setSelectedId("")} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết log</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: "grey.100",
              borderRadius: 1,
              overflow: "auto",
              fontSize: 13,
            }}
          >
            {JSON.stringify(detail || {}, null, 2)}
          </Box>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
