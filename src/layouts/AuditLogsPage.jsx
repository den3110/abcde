/* eslint-disable react/prop-types */
import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Pagination,
  Collapse,
  Avatar,
  Grid,
  Alert,
  Card,
  CardContent,
  Badge,
  Fade,
  Zoom,
} from "@mui/material";
import { useTheme, alpha, styled } from "@mui/material/styles";

import SearchIcon from "@mui/icons-material/Search";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EditIcon from "@mui/icons-material/Edit";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import FilterListIcon from "@mui/icons-material/FilterList";
import TimelineIcon from "@mui/icons-material/Timeline";
import PersonIcon from "@mui/icons-material/Person";

import { useGetAuditUsersSummaryQuery, useGetUserAuditQuery } from "slices/adminApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

/* ================= Styled Components ================= */
const GradientCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(
    theme.palette.primary.light,
    0.02
  )} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  borderRadius: theme.spacing(2),
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
    borderColor: theme.palette.primary.main,
  },
}));

const StatsCard = styled(Paper)(({ theme, color = "primary" }) => ({
  padding: theme.spacing(2.5),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].dark} 100%)`,
  color: "white",
  boxShadow: `0 4px 20px ${alpha(theme.palette[color].main, 0.3)}`,
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "scale(1.03)",
    boxShadow: `0 8px 30px ${alpha(theme.palette[color].main, 0.4)}`,
  },
}));

const ActionChip = styled(Chip)(({ theme, actiontype }) => {
  const colors = {
    UPDATE: { bg: theme.palette.info.main, color: theme.palette.info.contrastText },
    CREATE: { bg: theme.palette.success.main, color: theme.palette.success.contrastText },
    DELETE: { bg: theme.palette.error.main, color: theme.palette.error.contrastText },
    OTHER: { bg: theme.palette.grey[600], color: theme.palette.common.white },
  };
  const color = colors[actiontype] || colors.OTHER;
  return {
    backgroundColor: color.bg,
    color: color.color,
    fontWeight: 800,
    fontSize: "0.75rem",
    padding: "4px 8px",
    height: "auto",
    "& .MuiChip-icon": { color: color.color },
  };
});

const TimelineCard = styled(Paper)(({ theme }) => ({
  position: "relative",
  padding: theme.spacing(2.5),
  borderRadius: theme.spacing(2),
  background: "white",
  border: `1px solid ${theme.palette.divider}`,
  transition: "all 0.3s ease",
  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
    borderRadius: "4px 0 0 4px",
  },
  "&:hover": {
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
    transform: "translateX(4px)",
  },
}));

/* ================= Helpers ================= */
function stringToColor(string) {
  let hash = 0;
  for (let i = 0; i < String(string || "").length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = String(string || "").charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-bitwise
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
}

function stringAvatar(name) {
  const n = name || "?";
  const parts = String(n).trim().split(" ").filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : String(n).slice(0, 2);
  return {
    sx: { bgcolor: stringToColor(n), fontSize: 16, fontWeight: 900 },
    children: String(letters || "?").toUpperCase(),
  };
}

const fmtTime = (d) =>
  d
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(d))
    : "—";

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(d))
    : "—";

const fmtVal = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "—";
    return s.length > 220 ? `${s.slice(0, 220)}…` : s;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 220 ? `${s.slice(0, 220)}…` : s;
  } catch {
    return String(v);
  }
};

const getActionIcon = (action) => {
  switch (action) {
    case "UPDATE":
      return <EditIcon fontSize="small" />;
    case "CREATE":
      return <AddCircleIcon fontSize="small" />;
    case "DELETE":
      return <DeleteIcon fontSize="small" />;
    default:
      return <MoreHorizIcon fontSize="small" />;
  }
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "Tất cả", icon: "📋" },
  { value: "profile", label: "Profile", icon: "👤" },
  { value: "kyc", label: "KYC", icon: "🆔" },
  { value: "security", label: "Bảo mật", icon: "🔐" },
  { value: "ranking", label: "Xếp hạng", icon: "🏆" },
  { value: "permission", label: "Phân quyền", icon: "🔑" },
];

const ACTION_OPTIONS = [
  { value: "", label: "Tất cả action", icon: "🎯" },
  { value: "UPDATE", label: "UPDATE", icon: "✏️" },
  { value: "CREATE", label: "CREATE", icon: "➕" },
  { value: "DELETE", label: "DELETE", icon: "🗑️" },
  { value: "OTHER", label: "OTHER", icon: "⚡" },
];

export default function AuditLogsPage() {
  const theme = useTheme();

  /* ================= Summary filters ================= */
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const summaryArgs = useMemo(
    () => ({
      page,
      limit: LIMIT,
      q: q.trim() || undefined,
      action: action || undefined,
      category: category || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [page, q, action, category, from, to]
  );

  const {
    data: summary,
    isFetching,
    refetch,
    error,
  } = useGetAuditUsersSummaryQuery(summaryArgs, { refetchOnMountOrArgChange: true });

  /* ================= Detail dialog ================= */
  const [openUser, setOpenUser] = useState(null);
  const [dPage, setDPage] = useState(1);
  const [dAction, setDAction] = useState("");
  const [dCategory, setDCategory] = useState("all");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [dField, setDField] = useState("");
  const [dActorId, setDActorId] = useState("");

  useEffect(() => {
    if (!openUser) {
      setDPage(1);
      setDAction("");
      setDCategory("all");
      setDFrom("");
      setDTo("");
      setDField("");
      setDActorId("");
    }
  }, [openUser]);

  const {
    data: detail,
    isFetching: dFetching,
    refetch: refetchDetail,
    error: dError,
  } = useGetUserAuditQuery(
    openUser
      ? {
          userId: openUser.userId || openUser._id,
          page: dPage,
          limit: 20,
          action: dAction || undefined,
          category: dCategory || undefined,
          from: dFrom || undefined,
          to: dTo || undefined,
          field: dField.trim() || undefined,
          actorId: dActorId.trim() || undefined,
        }
      : { userId: "" },
    { skip: !openUser }
  );

  const items = summary?.items ?? [];
  const pages = summary?.pages ?? 0;

  /* ================= Stats ================= */
  const totalStats = useMemo(() => {
    if (!items.length) return null;
    return {
      totalLogs: items.reduce((acc, item) => acc + (item.total || 0), 0),
      totalUpdates: items.reduce((acc, item) => acc + (item.updateCount || 0), 0),
      totalCreates: items.reduce((acc, item) => acc + (item.createCount || 0), 0),
      totalDeletes: items.reduce((acc, item) => acc + (item.deleteCount || 0), 0),
      totalUsers: items.length,
    };
  }, [items]);

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ mx: "auto", p: { xs: 2, md: 4 }, maxWidth: 1400 }}>
        {/* ================= Header ================= */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          gap={2.5}
          sx={{ mb: 4, mt: 0.5 }}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={950}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 0.75,
              }}
            >
              📊 Audit Logs
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Theo dõi lịch sử thay đổi của người dùng
            </Typography>
          </Box>

          {/* ✅ nút cách ra */}
          <Stack
            direction="row"
            spacing={2}
            sx={{
              ml: 1,
              py: 0.5,
              px: 0.5,
              gap: 1.5,
              borderRadius: 2,
            }}
          >
            <Tooltip title="Tải lại" arrow>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton
                  onClick={() => refetch?.()}
                  disabled={isFetching}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Box>
            </Tooltip>
          </Stack>
        </Stack>

        {/* ================= Stats Overview ================= */}
        {totalStats && (
          <Box
            sx={{
              mb: 4,
              mt: 1,
              px: { xs: 0, md: 0.5 },
              py: { xs: 0.5, md: 1 },
            }}
          >
            {/* ✅ 5 card / hàng ở md bằng columns=15 (MUI v5) */}
            <Grid container spacing={2.5} columns={{ xs: 12, sm: 12, md: 15 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Zoom in timeout={300}>
                  <Box sx={{ pt: 0.25, pb: 0.25 }}>
                    <StatsCard elevation={0} color="primary" sx={{ borderRadius: 3 }}>
                      <Stack spacing={1.25} sx={{ py: 0.25 }}>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700 }}>
                          Tổng logs
                        </Typography>
                        <Typography variant="h4" fontWeight={950}>
                          {totalStats.totalLogs.toLocaleString()}
                        </Typography>
                      </Stack>
                    </StatsCard>
                  </Box>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in timeout={400}>
                  <Box sx={{ pt: 0.25, pb: 0.25 }}>
                    <StatsCard elevation={0} color="info" sx={{ borderRadius: 3 }}>
                      <Stack spacing={1.25} sx={{ py: 0.25 }}>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700 }}>
                          Updates
                        </Typography>
                        <Typography variant="h4" fontWeight={950}>
                          {totalStats.totalUpdates.toLocaleString()}
                        </Typography>
                      </Stack>
                    </StatsCard>
                  </Box>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in timeout={500}>
                  <Box sx={{ pt: 0.25, pb: 0.25 }}>
                    <StatsCard elevation={0} color="success" sx={{ borderRadius: 3 }}>
                      <Stack spacing={1.25} sx={{ py: 0.25 }}>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700 }}>
                          Creates
                        </Typography>
                        <Typography variant="h4" fontWeight={950}>
                          {totalStats.totalCreates.toLocaleString()}
                        </Typography>
                      </Stack>
                    </StatsCard>
                  </Box>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in timeout={600}>
                  <Box sx={{ pt: 0.25, pb: 0.25 }}>
                    <StatsCard elevation={0} color="error" sx={{ borderRadius: 3 }}>
                      <Stack spacing={1.25} sx={{ py: 0.25 }}>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700 }}>
                          Deletes
                        </Typography>
                        <Typography variant="h4" fontWeight={950}>
                          {totalStats.totalDeletes.toLocaleString()}
                        </Typography>
                      </Stack>
                    </StatsCard>
                  </Box>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in timeout={700}>
                  <Box sx={{ pt: 0.25, pb: 0.25 }}>
                    <StatsCard elevation={0} color="secondary" sx={{ borderRadius: 3 }}>
                      <Stack spacing={1.25} sx={{ py: 0.25 }}>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700 }}>
                          Users
                        </Typography>
                        <Typography variant="h4" fontWeight={950}>
                          {totalStats.totalUsers.toLocaleString()}
                        </Typography>
                      </Stack>
                    </StatsCard>
                  </Box>
                </Zoom>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ================= Filter bar ================= */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mt: 1,
            mb: 4,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            borderRadius: 3,
            bgcolor: "white",
            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <FilterListIcon color="primary" />
            <Typography variant="h6" fontWeight={900}>
              Bộ lọc
            </Typography>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          {/* ✅ dùng columns=14 để layout đẹp (vì trước bạn dùng md=1.5) */}
          <Grid container spacing={2.5} columns={{ xs: 12, md: 14 }}>
            <Grid item xs={12} md={6}>
              <TextField
                size="small"
                fullWidth
                placeholder="🔍 Tìm theo tên, email, phone, userId..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                InputProps={{
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  label="Action"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPage(1);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  {ACTION_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{o.icon}</span>
                        <span>{o.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Loại</InputLabel>
                <Select
                  label="Loại"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{o.icon}</span>
                        <span>{o.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                size="small"
                type="date"
                label="Từ ngày"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                fullWidth
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                size="small"
                type="date"
                label="Đến ngày"
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                fullWidth
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }} />
        </Paper>

        {/* ================= Summary list ================= */}
        {isFetching ? (
          <Stack alignItems="center" py={10}>
            <CircularProgress size={48} thickness={4} />
            <Typography variant="body1" color="text.secondary" mt={3} fontWeight={700}>
              Đang tải dữ liệu...
            </Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error?.data?.message || "Không tải được audit summary"}
          </Alert>
        ) : items.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: 3,
              bgcolor: alpha(theme.palette.grey[100], 0.5),
            }}
          >
            <Typography variant="h5" fontWeight={900} gutterBottom>
              📭 Không có dữ liệu
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Thử đổi bộ lọc hoặc khoảng thời gian khác nhé!
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={3} sx={{ mb: 2 }}>
            {items.map((row, index) => (
              <Fade in timeout={300 + index * 50} key={row.userId}>
                <GradientCard elevation={0}>
                  <CardContent
                    sx={{
                      p: { xs: 2.5, md: 3 },
                      "&:last-child": { pb: { xs: 2.5, md: 3 } },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={{ xs: 2.5, md: 3 }}
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        badgeContent={
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              bgcolor: "success.main",
                              border: "2px solid white",
                            }}
                          />
                        }
                      >
                        <Avatar
                          {...stringAvatar(row?.user?.name)}
                          sx={{ width: 56, height: 56, ...stringAvatar(row?.user?.name).sx }}
                        />
                      </Badge>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          mb={0.75}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="h6" fontWeight={950} noWrap>
                            {row?.user?.name || "(User đã bị xoá)"}
                          </Typography>

                          <Chip
                            size="small"
                            label={row?.user?.role || "—"}
                            sx={{
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 800,
                              fontSize: "0.7rem",
                            }}
                          />
                        </Stack>

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={{ xs: 0.75, sm: 2 }}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          mb={2}
                        >
                          <Typography variant="body2" color="text.secondary">
                            📧 {row?.user?.email || "—"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            📱 {row?.user?.phone || "—"}
                          </Typography>
                        </Stack>

                        <Stack
                          direction="row"
                          flexWrap="wrap"
                          useFlexGap
                          rowGap={1}
                          columnGap={1}
                          mb={2}
                        >
                          <Chip
                            icon={<TrendingUpIcon />}
                            size="small"
                            label={`${row.total} logs`}
                            sx={{
                              fontWeight: 900,
                              bgcolor: alpha(theme.palette.grey[900], 0.08),
                            }}
                          />
                          <ActionChip
                            actiontype="UPDATE"
                            size="small"
                            icon={getActionIcon("UPDATE")}
                            label={row.updateCount}
                          />
                          <ActionChip
                            actiontype="CREATE"
                            size="small"
                            icon={getActionIcon("CREATE")}
                            label={row.createCount}
                          />
                          <ActionChip
                            actiontype="DELETE"
                            size="small"
                            icon={getActionIcon("DELETE")}
                            label={row.deleteCount}
                          />
                          <ActionChip
                            actiontype="OTHER"
                            size="small"
                            icon={getActionIcon("OTHER")}
                            label={row.otherCount}
                          />
                        </Stack>

                        {(row.lastFields || []).filter(Boolean).length > 0 && (
                          <Stack
                            direction="row"
                            flexWrap="wrap"
                            useFlexGap
                            rowGap={1}
                            columnGap={1}
                            mb={2}
                          >
                            {(row.lastFields || []).filter(Boolean).map((f) => (
                              <Chip
                                key={f}
                                size="small"
                                label={f}
                                sx={{
                                  bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                  color: theme.palette.secondary.dark,
                                  fontWeight: 800,
                                  fontSize: "0.7rem",
                                }}
                              />
                            ))}
                          </Stack>
                        )}

                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{
                            px: 1.75,
                            py: 0.9,
                            bgcolor: alpha(theme.palette.info.main, 0.08),
                            borderRadius: 1.75,
                            display: "inline-flex",
                            width: "fit-content",
                            gap: 1,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            Gần nhất:
                          </Typography>
                          <Typography variant="caption" fontWeight={950}>
                            {fmtTime(row.lastAt)}
                          </Typography>
                          <Typography variant="caption" fontWeight={800}>
                            {fmtDate(row.lastAt)}
                          </Typography>
                          <Chip
                            size="small"
                            label={row.lastAction || "—"}
                            sx={{
                              height: 18,
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              bgcolor: alpha(theme.palette.primary.main, 0.15),
                            }}
                          />
                        </Stack>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Button
                          variant="contained"
                          startIcon={<HistoryIcon />}
                          onClick={() => setOpenUser(row)}
                          sx={{
                            textTransform: "none",
                            fontWeight: 900,
                            borderRadius: 2,
                            px: 3,
                            py: 1.25,
                            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            "&:hover": {
                              boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                            },
                          }}
                        >
                          Xem chi tiết
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </GradientCard>
              </Fade>
            ))}
          </Stack>
        )}

        {/* ================= Pagination ================= */}
        {pages > 1 && (
          <Box py={4} display="flex" justifyContent="center">
            <Pagination
              page={page}
              count={pages}
              onChange={(_, v) => setPage(v)}
              color="primary"
              shape="rounded"
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        )}

        {/* ================= Detail dialog ================= */}
        <Dialog
          open={!!openUser}
          onClose={() => setOpenUser(null)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          {openUser && (
            <>
              <DialogTitle
                sx={{
                  borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  background: `linear-gradient(135deg, ${alpha(
                    theme.palette.primary.main,
                    0.05
                  )} 0%, white 100%)`,
                  p: { xs: 2.5, md: 3 },
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  gap={2.5}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      {...stringAvatar(openUser?.user?.name)}
                      sx={{ width: 48, height: 48, ...stringAvatar(openUser?.user?.name).sx }}
                    />
                    <Box>
                      <Typography variant="h5" fontWeight={950}>
                        📜 {openUser?.user?.name || openUser?.user?._id || openUser.userId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {openUser?.user?.email || "—"} • ID: {openUser.userId}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Tooltip title="Tải lại" arrow>
                      <IconButton
                        onClick={() => refetchDetail?.()}
                        disabled={dFetching}
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                        }}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>

                    <Button
                      onClick={() => setOpenUser(null)}
                      variant="outlined"
                      sx={{ borderRadius: 2, fontWeight: 800, px: 2.5 }}
                    >
                      Đóng
                    </Button>
                  </Stack>
                </Stack>
              </DialogTitle>

              <DialogContent dividers sx={{ bgcolor: "grey.50", p: { xs: 2.5, md: 3 } }}>
                {/* ===== filters inside dialog ===== */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    mb: 3.5,
                    bgcolor: "white",
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    <FilterListIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={900}>
                      Lọc chi tiết
                    </Typography>
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2.5} columns={{ xs: 12, md: 14 }}>
                    <Grid item xs={12} md={2}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Action</InputLabel>
                        <Select
                          label="Action"
                          value={dAction}
                          onChange={(e) => {
                            setDAction(e.target.value);
                            setDPage(1);
                          }}
                          sx={{ borderRadius: 2 }}
                        >
                          {ACTION_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.icon} {o.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Loại</InputLabel>
                        <Select
                          label="Loại"
                          value={dCategory}
                          onChange={(e) => {
                            setDCategory(e.target.value);
                            setDPage(1);
                          }}
                          sx={{ borderRadius: 2 }}
                        >
                          {CATEGORY_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.icon} {o.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <TextField
                        size="small"
                        label="Field (exact)"
                        placeholder="vd: avatar"
                        value={dField}
                        onChange={(e) => {
                          setDField(e.target.value);
                          setDPage(1);
                        }}
                        fullWidth
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <TextField
                        size="small"
                        label="ActorId"
                        placeholder="lọc theo người sửa (userId)"
                        value={dActorId}
                        onChange={(e) => {
                          setDActorId(e.target.value);
                          setDPage(1);
                        }}
                        fullWidth
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        size="small"
                        type="date"
                        label="Từ ngày"
                        InputLabelProps={{ shrink: true }}
                        value={dFrom}
                        onChange={(e) => {
                          setDFrom(e.target.value);
                          setDPage(1);
                        }}
                        fullWidth
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                      <TextField
                        size="small"
                        type="date"
                        label="Đến ngày"
                        InputLabelProps={{ shrink: true }}
                        value={dTo}
                        onChange={(e) => {
                          setDTo(e.target.value);
                          setDPage(1);
                        }}
                        fullWidth
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 1 }} />
                </Paper>

                {/* ===== detail content ===== */}
                {dFetching ? (
                  <Stack alignItems="center" py={8}>
                    <CircularProgress size={48} />
                    <Typography variant="body1" color="text.secondary" mt={3} fontWeight={700}>
                      Đang tải lịch sử...
                    </Typography>
                  </Stack>
                ) : dError ? (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {dError?.data?.message || "Không tải được lịch sử"}
                  </Alert>
                ) : (detail?.items?.length || 0) === 0 ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 5,
                      textAlign: "center",
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.grey[100], 0.5),
                    }}
                  >
                    <Typography variant="h6" fontWeight={900}>
                      📭 Chưa có log phù hợp
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Thử đổi filter để tìm kiếm
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={2.5}>
                    {detail.items.map((log, idx) => (
                      <Fade in timeout={300 + idx * 30} key={log._id}>
                        <Box>
                          <LogCard log={log} />
                        </Box>
                      </Fade>
                    ))}

                    {(detail?.pages || 0) > 1 && (
                      <Box display="flex" justifyContent="center" pt={2}>
                        <Pagination
                          page={dPage}
                          count={detail.pages}
                          onChange={(_, v) => setDPage(v)}
                          color="primary"
                          shape="rounded"
                          showFirstButton
                          showLastButton
                        />
                      </Box>
                    )}
                  </Stack>
                )}
              </DialogContent>

              <DialogActions
                sx={{
                  px: { xs: 2.5, md: 3 },
                  py: 2,
                  borderTop: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  bgcolor: alpha(theme.palette.grey[50], 0.5),
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  width="100%"
                  gap={2}
                >
                  <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    📊 Tổng: <strong>{detail?.total ?? "—"}</strong> bản ghi
                  </Typography>

                  <Stack direction="row" spacing={2}>
                    <Button
                      onClick={() => setOpenUser(null)}
                      variant="contained"
                      sx={{ borderRadius: 2, fontWeight: 800, px: 3 }}
                    >
                      Đóng
                    </Button>
                  </Stack>
                </Stack>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </DashboardLayout>
  );
}

/* ================= Log Card ================= */
function LogCard({ log }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <TimelineCard elevation={0}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            rowGap={1}
          >
            <Chip
              icon={<TimelineIcon />}
              size="small"
              label={fmtTime(log.createdAt)}
              sx={{
                fontWeight: 950,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.dark,
              }}
            />
            <Typography fontWeight={900} color="text.primary">
              {fmtDate(log.createdAt)}
            </Typography>
            <ActionChip
              actiontype={log.action || "UPDATE"}
              size="small"
              icon={getActionIcon(log.action)}
              label={log.action || "UPDATE"}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            rowGap={1}
          >
            <Chip
              icon={<PersonIcon />}
              size="small"
              label={log?.actor?.kind || "user"}
              sx={{
                fontSize: "0.7rem",
                height: 22,
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: theme.palette.secondary.dark,
                fontWeight: 800,
              }}
            />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              ID: {log?.actor?.id || "—"}
            </Typography>
            {log?.note && (
              <Typography
                variant="caption"
                sx={{
                  px: 1.5,
                  py: 0.6,
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.dark,
                  borderRadius: 1,
                  fontWeight: 700,
                }}
              >
                💬 {log.note}
              </Typography>
            )}
          </Stack>
        </Stack>

        <IconButton
          onClick={() => setOpen((v) => !v)}
          sx={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider sx={{ my: 2.5 }} />

        <Stack spacing={2}>
          {(log.changes || []).map((c, idx) => (
            <Paper
              key={`${log._id}-${idx}`}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.grey[50], 0.55),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: "all 0.2s ease",
                "&:hover": {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              <Stack spacing={1.5}>
                <Chip
                  label={c.field}
                  size="small"
                  sx={{
                    alignSelf: "flex-start",
                    fontWeight: 950,
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: theme.palette.primary.dark,
                    fontSize: "0.75rem",
                  }}
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Stack
                      spacing={0.75}
                      sx={{
                        p: 1.75,
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                        borderRadius: 1.75,
                        border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={950}
                        sx={{ color: theme.palette.error.dark }}
                      >
                        ❌ Trước
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          wordBreak: "break-word",
                          color: theme.palette.error.dark,
                        }}
                      >
                        {fmtVal(c.from)}
                      </Typography>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Stack
                      spacing={0.75}
                      sx={{
                        p: 1.75,
                        bgcolor: alpha(theme.palette.success.main, 0.05),
                        borderRadius: 1.75,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={950}
                        sx={{ color: theme.palette.success.dark }}
                      >
                        ✅ Sau
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          wordBreak: "break-word",
                          color: theme.palette.success.dark,
                        }}
                      >
                        {fmtVal(c.to)}
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Collapse>
    </TimelineCard>
  );
}
