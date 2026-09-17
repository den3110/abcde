// Access analytics — số lượt truy cập gần đây (1/7/30 ngày) + chi tiết ai truy cập.
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import {
  useGetAccessAnalyticsSummaryQuery,
  useGetAccessAnalyticsUsersQuery,
} from "slices/adminApiSlice";

const PAGE_SIZE = 30;

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
};

const fmtRelative = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "-";
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const dy = Math.round(h / 24);
  if (dy < 30) return `${dy} ngày trước`;
  return d.toLocaleDateString("vi-VN");
};

const channelLabel = {
  web: "Web",
  mobile: "App",
  admin: "Admin",
  unknown: "Khác",
};
const channelColor = {
  web: "info",
  mobile: "success",
  admin: "warning",
  unknown: "default",
};

function SummaryCard({ title, subtitle, data, loading, active, onClick }) {
  const total = data?.uniqueUsers ?? 0;
  const logins = data?.totalLogins ?? 0;
  const byChannel = data?.byChannel || {};
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: active ? 6 : 1,
        border: (t) =>
          active ? `2px solid ${t.palette.primary.main}` : "1px solid transparent",
        transition: "box-shadow .2s, border-color .2s",
        height: "100%",
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5, height: "100%" }}>
        <Stack spacing={1.5} sx={{ height: "100%" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
              {title}
            </Typography>
            <Chip
              size="small"
              label="Xem chi tiết"
              color={active ? "primary" : "default"}
              variant={active ? "filled" : "outlined"}
            />
          </Stack>
          <Typography variant="h3" fontWeight={800} lineHeight={1.1}>
            {loading ? "…" : total.toLocaleString("vi-VN")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle} · Tổng lượt đăng nhập: {loading ? "…" : logins.toLocaleString("vi-VN")}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {["web", "mobile", "admin", "unknown"].map((k) => {
              const c = byChannel[k];
              if (!c || (!c.uniqueUsers && !c.totalLogins)) return null;
              return (
                <Chip
                  key={k}
                  size="small"
                  color={channelColor[k]}
                  variant="outlined"
                  label={`${channelLabel[k]}: ${c.uniqueUsers}`}
                />
              );
            })}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function AccessAnalyticsPage() {
  const [selectedDays, setSelectedDays] = useState(0); // 0 = chưa mở chi tiết
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");

  // Debounce keyword
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data: summary,
    isFetching: loadingSummary,
    refetch: refetchSummary,
  } = useGetAccessAnalyticsSummaryQuery();

  const {
    data: usersData,
    isFetching: loadingUsers,
  } = useGetAccessAnalyticsUsersQuery(
    selectedDays
      ? { days: selectedDays, channel, page, pageSize: PAGE_SIZE, keyword }
      : { days: 7 },
    { skip: !selectedDays },
  );

  const items = usersData?.items || [];
  const totalPages = usersData?.totalPages || 1;

  const open = selectedDays > 0;
  const dialogTitle = useMemo(() => {
    if (!selectedDays) return "";
    return `Người truy cập ${selectedDays} ngày gần nhất`;
  }, [selectedDays]);

  const openDetail = (days) => {
    setSelectedDays(days);
    setChannel("");
    setPage(1);
    setSearchInput("");
    setKeyword("");
  };
  const closeDetail = () => setSelectedDays(0);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={3} pb={6} px={{ xs: 2, md: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack>
            <Typography variant="h4" fontWeight={800}>
              Thống kê truy cập
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Số lượng user đăng nhập gần nhất (unique theo tài khoản). Bấm vào ô để xem chi
              tiết ai đã truy cập trong khoảng thời gian đó.
            </Typography>
          </Stack>
          <Tooltip title="Làm mới">
            <IconButton onClick={() => refetchSummary()} disabled={loadingSummary}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <SummaryCard
              title="1 NGÀY GẦN NHẤT"
              subtitle="24 giờ qua"
              data={summary?.windows?.d1}
              loading={loadingSummary}
              active={selectedDays === 1}
              onClick={() => openDetail(1)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <SummaryCard
              title="7 NGÀY GẦN NHẤT"
              subtitle="1 tuần qua"
              data={summary?.windows?.d7}
              loading={loadingSummary}
              active={selectedDays === 7}
              onClick={() => openDetail(7)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <SummaryCard
              title="30 NGÀY GẦN NHẤT"
              subtitle="1 tháng qua"
              data={summary?.windows?.d30}
              loading={loadingSummary}
              active={selectedDays === 30}
              onClick={() => openDetail(30)}
            />
          </Grid>
        </Grid>

        <Dialog open={open} onClose={closeDetail} fullWidth maxWidth="lg">
          <DialogTitle sx={{ pr: 6 }}>
            {dialogTitle}
            <IconButton
              onClick={closeDetail}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
              <TextField
                size="small"
                fullWidth
                placeholder="Tìm theo tên, SĐT, email, IP..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Kênh</InputLabel>
                <Select
                  label="Kênh"
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  <MenuItem value="web">Web</MenuItem>
                  <MenuItem value="mobile">App mobile</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="unknown">Khác</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Typography variant="caption" color="text.secondary" mb={1} display="block">
              {loadingUsers
                ? "Đang tải…"
                : `Tổng ${usersData?.total || 0} tài khoản unique. Xếp theo lần truy cập gần nhất.`}
            </Typography>

            <TableContainer sx={{ borderRadius: 2, border: 1, borderColor: "divider" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Tài khoản</TableCell>
                    <TableCell align="center">Kênh</TableCell>
                    <TableCell align="right">Số lần login</TableCell>
                    <TableCell>Lần cuối</TableCell>
                    <TableCell>IP / UA</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 && !loadingUsers && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary" py={4}>
                          Không có dữ liệu trong khoảng thời gian này.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((r, idx) => {
                    const u = r.user;
                    return (
                      <TableRow key={u?._id || `${idx}-${r.lastLoginAt}`} hover>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar src={u?.avatar || ""} sx={{ width: 34, height: 34 }}>
                              {(u?.nickname || u?.name || u?.phone || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </Avatar>
                            <Stack sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {u?.nickname || u?.name || r.loginKey || "(unknown)"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                              >
                                {[u?.phone, u?.email].filter(Boolean).join(" · ") ||
                                  r.loginKey}
                              </Typography>
                            </Stack>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                            {(r.channels || []).map((c) => (
                              <Chip
                                key={c}
                                size="small"
                                color={channelColor[c] || "default"}
                                variant="outlined"
                                label={channelLabel[c] || c}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700}>
                            {r.loginCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={fmtDate(r.lastLoginAt)}>
                            <Typography variant="body2">
                              {fmtRelative(r.lastLoginAt)}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography variant="caption" color="text.secondary" display="block" noWrap>
                            IP: {r.lastIp || "-"}
                          </Typography>
                          <Tooltip title={r.lastUserAgent || ""}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              noWrap
                            >
                              {r.lastUserAgent || "-"}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {totalPages > 1 && (
              <Stack alignItems="center" mt={2}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, p) => setPage(p)}
                  color="primary"
                  shape="rounded"
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDetail}>Đóng</Button>
          </DialogActions>
        </Dialog>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
