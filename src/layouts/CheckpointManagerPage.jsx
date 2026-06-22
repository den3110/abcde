/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import GavelIcon from "@mui/icons-material/Gavel";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleIcon from "@mui/icons-material/Rule";
import SaveIcon from "@mui/icons-material/Save";
import ScienceIcon from "@mui/icons-material/Science";
import SecurityIcon from "@mui/icons-material/Security";
import TimelineIcon from "@mui/icons-material/Timeline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import { useVerifyQuery } from "slices/authApiSlice";
import {
  useGetCheckpointAdminEventsQuery,
  useGetCheckpointAdminOverviewQuery,
  useGetCheckpointAdminPolicyQuery,
  useGetCheckpointAdminSessionDetailQuery,
  useGetCheckpointAdminSettingsQuery,
  useGetCheckpointAdminSessionsQuery,
  useGetCheckpointSubjectInsightQuery,
  useGetCheckpointMandatesQuery,
  useLazySearchCheckpointUsersQuery,
  useCreateCheckpointMandateMutation,
  useCancelCheckpointMandateMutation,
  useUnlockCheckpointSubjectMutation,
  useResolveCheckpointAdminSessionMutation,
  useSimulateCheckpointRiskMutation,
  useUpdateCheckpointAdminSettingsMutation,
} from "slices/checkpointAdminApiSlice";
import { isStrictSuperAdminUser } from "utils/authz";

const STATUS_OPTIONS = [
  ["", "Tất cả trạng thái"],
  ["pending", "Đang chờ"],
  ["review_required", "Cần review"],
  ["passed", "Đã qua"],
  ["failed", "Thất bại"],
  ["expired", "Hết hạn"],
  ["cancelled", "Đã huỷ"],
];

const CATEGORY_OPTIONS = [
  ["", "Tất cả category"],
  ["auth", "Auth"],
  ["admin_route", "Admin route"],
  ["spam", "Spam"],
  ["abuse", "Abuse"],
  ["checkpoint", "Checkpoint"],
  ["client_signal", "Client signal"],
  ["rate_limit", "Rate limit"],
  ["system", "System"],
];

const OUTCOME_OPTIONS = [
  ["", "Tất cả outcome"],
  ["success", "Success"],
  ["failed", "Failed"],
  ["denied", "Denied"],
  ["blocked", "Blocked"],
  ["rate_limited", "Rate limited"],
  ["suspicious", "Suspicious"],
  ["observed", "Observed"],
];

const SEVERITY_OPTIONS = [
  ["", "Tất cả severity"],
  ["info", "Info"],
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["critical", "Critical"],
];

const MANDATE_STATUS_OPTIONS = [
  ["", "Tất cả mandate"],
  ["active", "Đang áp"],
  ["consumed", "Đã hoàn tất"],
  ["cancelled", "Đã huỷ"],
  ["expired", "Hết hạn"],
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const RULE_LABELS = {
  authFailedDay: "Đăng nhập sai trong ngày",
  authFailedDayBurst: "Burst đăng nhập sai",
  authFailedWeek: "Đăng nhập sai nhiều ngày",
  adminDeniedDay: "Admin route bị từ chối/ngày",
  adminDeniedWeek: "Admin route bị từ chối/tuần",
  spamHour: "Spam thao tác/giờ",
  spamDay: "Spam thao tác/ngày",
  rateLimitedDay: "Rate limit/ngày",
  checkpointFailedWeek: "Sai checkpoint/tuần",
  abuseWeek: "Abuse bị chặn/tuần",
  clientSuspiciousDay: "Client suspicious/ngày",
  criticalMonth: "High/Critical trong tháng",
};

const DAMPENER_LABELS = {
  authSuccessWeek: "Đăng nhập thành công gần đây",
  checkpointPassedMonth: "Đã qua checkpoint gần đây",
  verifiedIdentity: "Đã xác minh CCCD",
  agedAccount: "Tài khoản lâu năm",
};

const COUNTER_FIELDS = [
  ["authFailedDay", "Auth fail 24h"],
  ["authFailedWeek", "Auth fail 7d"],
  ["authSuccessWeek", "Auth success 7d"],
  ["adminDeniedDay", "Admin denied 24h"],
  ["adminDeniedWeek", "Admin denied 7d"],
  ["spamHour", "Spam 1h"],
  ["spamDay", "Spam 24h"],
  ["rateLimitedDay", "Rate limit 24h"],
  ["checkpointFailedWeek", "Checkpoint fail 7d"],
  ["checkpointPassedMonth", "Checkpoint pass 30d"],
  ["abuseWeek", "Abuse 7d"],
  ["clientSuspiciousDay", "Client suspicious 24h"],
  ["criticalMonth", "High/Critical 30d"],
];

const ALLOWLIST_GROUPS = [
  ["users", "User ID"],
  ["emails", "Email"],
  ["phones", "Số điện thoại"],
  ["deviceIds", "Device ID"],
  ["ips", "IP"],
];

const statusLabel = {
  pending: "Đang chờ",
  review_required: "Cần review",
  passed: "Đã qua",
  failed: "Thất bại",
  expired: "Hết hạn",
  cancelled: "Đã huỷ",
};

const factorLabel = {
  email_otp: "Email OTP",
  phone_otp: "Phone OTP",
  cccd_upload: "CCCD",
  face_video: "Face video",
};

const methodLabel = {
  email_otp: "Email",
  zalo_otp: "Phone OTP",
};

const statusColor = (status) => {
  if (status === "passed") return "success";
  if (status === "review_required") return "error";
  if (status === "pending") return "warning";
  if (status === "failed") return "error";
  return "default";
};

const severityColor = (severity) => {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "info") return "info";
  return "default";
};

const outcomeColor = (outcome) => {
  if (outcome === "success") return "success";
  if (["failed", "denied", "blocked", "rate_limited"].includes(outcome)) return "warning";
  if (outcome === "suspicious") return "error";
  return "default";
};

const fmtDate = (value) => {
  if (!value) return "Không có";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Không có";
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
};

const shortId = (value) => {
  const text = String(value || "");
  return text.length > 10 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text || "-";
};

const userOptionId = (user) => String(user?._id || user?.id || "").trim();

const mergeUserOptions = (...groups) => {
  const map = new Map();
  groups
    .flat()
    .filter(Boolean)
    .forEach((user) => {
      const key = userOptionId(user);
      if (key) map.set(key, user);
    });
  return Array.from(map.values());
};

const userSearchOptionLabel = (user) => {
  if (!user) return "";
  const nickname = String(user.nickname || user.nickName || "").trim();
  const name = String(user.name || user.fullName || "").trim();
  const email = String(user.email || "").trim();
  const phone = String(user.phone || "").trim();
  const main = nickname || name || email || phone || shortId(userOptionId(user));
  const tail = [name && name !== main ? name : "", email, phone]
    .filter(Boolean)
    .join(" • ");
  return tail ? `${main} • ${tail}` : main;
};

const jsonPreview = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return String(value || "");
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const apiErrorMessage = (error, fallback = "Thao tác thất bại.") =>
  error?.data?.message ||
  error?.data?.error ||
  error?.error ||
  error?.message ||
  fallback;

const apiErrorKey = (error, fallback = "Thao tác thất bại.") =>
  `${error?.status || error?.originalStatus || "api"}:${apiErrorMessage(error, fallback)}`;

const getPathValue = (target, path, fallback = "") =>
  path.split(".").reduce((acc, key) => acc?.[key], target) ?? fallback;

const setPathValue = (target, path, value) => {
  const keys = path.split(".");
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return target;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function MetricCard({ label, value, caption, icon, color = "primary" }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 900 }} color={`${color}.main`}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ mt: 0.25 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function UserBlock({ user }) {
  if (!user) return <Typography variant="body2">Không có user</Typography>;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={user.name || user.email}>
        {user.name || user.nickname || user.email || shortId(user._id)}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap display="block" title={user.email}>
        {user.email || user.phone || shortId(user._id)}
      </Typography>
    </Box>
  );
}

function FactorChips({ factors }) {
  const items = Array.isArray(factors) ? factors : [];
  if (!items.length) return <Chip size="small" label="Không có factor" />;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {items.map((factor) => (
        <Chip
          key={factor.key}
          size="small"
          color={factor.status === "passed" ? "success" : factor.status === "failed" ? "error" : "default"}
          variant={factor.status === "passed" ? "filled" : "outlined"}
          label={`${factorLabel[factor.key] || factor.key}: ${factor.status}`}
        />
      ))}
    </Stack>
  );
}

function RiskChips({ risk }) {
  const signals = Array.isArray(risk?.signals) ? risk.signals : [];
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        <Chip size="small" color="warning" label={`Score ${risk?.score ?? 0}`} />
        <Chip size="small" variant="outlined" label={`Raw ${risk?.rawScore ?? risk?.score ?? 0}`} />
        <Chip size="small" variant="outlined" label={risk?.confidence || "low"} />
      </Stack>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {signals.slice(0, 4).map((signal) => (
          <Chip
            key={`${signal.key}-${signal.window}`}
            size="small"
            variant="outlined"
            label={signal.reason || signal.key}
          />
        ))}
        {!signals.length ? <Chip size="small" label="Chưa có signal" /> : null}
      </Stack>
    </Stack>
  );
}

function EvidenceLinks({ evidence }) {
  const items = Array.isArray(evidence) ? evidence : [];
  if (!items.length) return <Chip size="small" label="Chưa có bằng chứng" />;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {items.map((item, index) => (
        <Button
          key={`${item.url}-${index}`}
          size="small"
          variant="outlined"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          {factorLabel[item.factor] || item.factor} {item.kind || index + 1}
        </Button>
      ))}
    </Stack>
  );
}

function CountChips({ counts, colorForKey }) {
  const rows = Object.entries(counts || {}).filter(([, count]) => Number(count || 0) > 0);
  if (!rows.length) return <Chip size="small" label="Không có dữ liệu" />;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {rows.map(([key, count]) => (
        <Chip
          key={key}
          size="small"
          color={colorForKey ? colorForKey(key) : "default"}
          variant="outlined"
          label={`${statusLabel[key] || key}: ${count}`}
        />
      ))}
    </Stack>
  );
}

function FilterSelect({ value, onChange, options, minWidth = 180 }) {
  return (
    <Select size="small" value={value} onChange={(event) => onChange(event.target.value)} sx={{ minWidth }}>
      {options.map(([optionValue, label]) => (
        <MenuItem key={optionValue || "all"} value={optionValue}>
          {label}
        </MenuItem>
      ))}
    </Select>
  );
}

function NumberSetting({ label, value, onChange, min = 0, max = 10000, width = 150 }) {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value ?? 0}
      onChange={(event) => onChange(toNumber(event.target.value))}
      inputProps={{ min, max }}
      sx={{ minWidth: width }}
    />
  );
}

function ResolveDialog({ open, session, action, onClose, onConfirm, loading }) {
  const [note, setNote] = useState("");

  const title =
    action === "approve"
      ? "Mở checkpoint"
      : action === "reject"
      ? "Từ chối checkpoint"
      : "Huỷ checkpoint";

  const handleConfirm = async () => {
    try {
      await onConfirm({ id: session?._id, action, note });
      setNote("");
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity={action === "approve" ? "success" : "warning"}>
            {session?.user?.email || session?.user?.phone || shortId(session?._id)}
          </Alert>
          <TextField
            label="Ghi chú review"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Đóng
        </Button>
        <Button
          variant="contained"
          color={action === "approve" ? "success" : action === "reject" ? "warning" : "inherit"}
          onClick={handleConfirm}
          disabled={loading || !session?._id}
        >
          Xác nhận
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SessionDetailDialog({ session, events = [], loadingEvents, open, onClose, onResolve }) {
  if (!session) return null;
  const canUnlock = ["pending", "review_required"].includes(session.status);
  const canStop = ["pending", "review_required"].includes(session.status);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Chi tiết checkpoint {shortId(session._id)}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Người dùng
                </Typography>
                <UserBlock user={session.user} />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  <Chip size="small" color={statusColor(session.status)} label={statusLabel[session.status] || session.status} />
                  <Chip size="small" color={session.level >= 3 ? "error" : session.level >= 2 ? "warning" : "default"} label={`Level ${session.level}`} />
                  <Chip size="small" variant="outlined" label={methodLabel[session.delivery?.method] || session.delivery?.method || "-"} />
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Thời gian
                </Typography>
                <Typography variant="body2">Tạo: {fmtDate(session.createdAt)}</Typography>
                <Typography variant="body2">Hết hạn: {fmtDate(session.expiresAt)}</Typography>
                <Typography variant="body2">Trust tới: {fmtDate(session.trustExpiresAt)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Ngữ cảnh request
                </Typography>
                <Typography variant="body2">IP: {session.request?.ip || "-"}</Typography>
                <Typography variant="body2">Device: {session.request?.deviceName || session.request?.deviceId || "-"}</Typography>
                <Typography variant="body2">Reason: {session.request?.reason || "-"}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
              Factor
            </Typography>
            <FactorChips factors={session.factors} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
              Bằng chứng
            </Typography>
            <EvidenceLinks evidence={session.evidence} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
              Risk engine
            </Typography>
            <RiskChips risk={session.risk} />
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Counters
                </Typography>
                <Box
                  component="pre"
                  sx={{ mt: 0.5, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto" }}
                >
                  {jsonPreview(session.risk?.counters)}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">
                  Dampeners
                </Typography>
                <Box
                  component="pre"
                  sx={{ mt: 0.5, p: 1, bgcolor: "action.hover", borderRadius: 1, overflow: "auto" }}
                >
                  {jsonPreview(session.risk?.dampeners)}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {session.review?.decision ? (
            <Alert severity="info">
              Review: {session.review.decision} bởi{" "}
              {session.review.reviewedBy?.email || session.review.reviewedBy?.name || "admin"} lúc{" "}
              {fmtDate(session.review.reviewedAt)}
              {session.review.note ? ` | ${session.review.note}` : ""}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <SectionTitle icon={<TimelineIcon color="primary" />} title="Timeline liên quan" />
              {loadingEvents ? <LinearProgress /> : null}
              {(events || []).slice(0, 30).map((event) => (
                <Paper key={event._id} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                        {event.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDate(event.createdAt)} | {event.path || event.routeGroup || event.ip || "-"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={event.category} />
                      <Chip size="small" color={outcomeColor(event.outcome)} label={event.outcome} />
                      <Chip size="small" color={severityColor(event.severity)} label={event.severity} />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
              {!events?.length && !loadingEvents ? <Alert severity="info">Chưa có event liên quan.</Alert> : null}
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        {canStop ? (
          <Button color="inherit" startIcon={<CancelIcon />} onClick={() => onResolve(session, "cancel")}>
            Huỷ
          </Button>
        ) : null}
        {canStop ? (
          <Button color="warning" startIcon={<ErrorOutlineIcon />} onClick={() => onResolve(session, "reject")}>
            Từ chối
          </Button>
        ) : null}
        {canUnlock ? (
          <Button color="success" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => onResolve(session, "approve")}>
            Mở checkpoint
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function OverviewTab({ overview, loading, error }) {
  if (loading) {
    return (
      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
        <CircularProgress />
      </Card>
    );
  }

  if (error) {
    return <Alert severity="error">{error?.data?.message || "Không tải được tổng quan checkpoint."}</Alert>;
  }

  const summary = overview?.summary || {};

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} xl={3}>
          <MetricCard
            label="Phiên checkpoint"
            value={summary.totalSessions || 0}
            caption={`${summary.passRate || 0}% đã qua trong cửa sổ hiện tại`}
            icon={<SecurityIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <MetricCard
            label="Cần review"
            value={summary.reviewRequiredSessions || 0}
            caption={`${summary.pendingSessions || 0} phiên đang chờ user`}
            icon={<GavelIcon color="warning" />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <MetricCard
            label="Risk score"
            value={summary.avgRiskScore || 0}
            caption={`Max score ${summary.maxRiskScore || 0}`}
            icon={<RuleIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <MetricCard
            label="Risk events"
            value={summary.totalEvents || 0}
            caption={`${summary.level3Sessions || 0} phiên level 3`}
            icon={<TimelineIcon color="primary" />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<FactCheckIcon color="primary" />} title="Trạng thái phiên" />
                <CountChips counts={overview?.statusCounts} colorForKey={statusColor} />
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  Level
                </Typography>
                <CountChips counts={overview?.levelCounts} />
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  Delivery
                </Typography>
                <CountChips counts={overview?.deliveryCounts} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<TimelineIcon color="primary" />} title="Event breakdown" />
                <CountChips counts={overview?.eventCategoryCounts} />
                <Divider />
                <CountChips counts={overview?.eventOutcomeCounts} colorForKey={outcomeColor} />
                <Divider />
                <CountChips counts={overview?.eventSeverityCounts} colorForKey={severityColor} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<RuleIcon color="primary" />} title="Signal nổi bật" />
                {(overview?.topSignals || []).map((signal) => (
                  <Paper key={signal.key} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {signal.reason}
                      </Typography>
                      <Chip size="small" label={`x${signal.count}`} />
                    </Stack>
                  </Paper>
                ))}
                {!overview?.topSignals?.length ? <Alert severity="info">Chưa có signal trong cửa sổ này.</Alert> : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<GavelIcon color="warning" />} title="Hàng đợi review" />
                {(overview?.latestReviewSessions || []).map((session) => (
                  <Paper key={session._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <UserBlock user={session.user} />
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip size="small" color={statusColor(session.status)} label={statusLabel[session.status] || session.status} />
                        <Chip size="small" color={session.level >= 3 ? "error" : "warning"} label={`Level ${session.level}`} />
                        <Chip size="small" variant="outlined" label={`Score ${session.risk?.score || 0}`} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {!overview?.latestReviewSessions?.length ? <Alert severity="success">Không có phiên cần review.</Alert> : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<TimelineIcon color="primary" />} title="Event mới nhất" />
                {(overview?.recentEvents || []).map((event) => (
                  <Paper key={event._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {event.type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {event.path || event.routeGroup || event.ip || "-"}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={event.category} />
                        <Chip size="small" color={outcomeColor(event.outcome)} label={event.outcome} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {!overview?.recentEvents?.length ? <Alert severity="info">Chưa có event.</Alert> : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

function SessionsTab({
  query,
  filters,
  onFilter,
  onPage,
  onOpenDetail,
  onResolve,
  resolving,
}) {
  const sessions = query.data?.sessions || [];
  const totalPages = query.data?.totalPages || 1;

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems={{ lg: "center" }}>
            <TextField
              size="small"
              label="Tìm user, IP, device"
              value={filters.q}
              onChange={(event) => onFilter("q", event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <FilterSelect value={filters.status} onChange={(value) => onFilter("status", value)} options={STATUS_OPTIONS} />
            <FilterSelect
              value={filters.level}
              onChange={(value) => onFilter("level", value)}
              options={[
                ["", "Tất cả level"],
                ["1", "Level 1"],
                ["2", "Level 2"],
                ["3", "Level 3"],
              ]}
              minWidth={140}
            />
            <FilterSelect
              value={filters.deliveryMethod}
              onChange={(value) => onFilter("deliveryMethod", value)}
              options={[
                ["", "Tất cả kênh"],
                ["email_otp", "Email"],
                ["zalo_otp", "Phone OTP"],
              ]}
              minWidth={150}
            />
            <FilterSelect
              value={filters.pageSize}
              onChange={(value) => onFilter("pageSize", Number(value))}
              options={PAGE_SIZE_OPTIONS.map((value) => [value, `${value}/trang`])}
              minWidth={130}
            />
          </Stack>
        </CardContent>
      </Card>

      {query.isFetching ? <LinearProgress /> : null}
      {query.error ? (
        <Alert severity="error">{query.error?.data?.message || "Không tải được danh sách checkpoint."}</Alert>
      ) : null}

      <Stack spacing={1.25}>
        {sessions.map((session) => {
          const canUnlock = ["pending", "review_required"].includes(session.status);
          const canStop = ["pending", "review_required"].includes(session.status);
          return (
            <Paper key={session._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={2}>
                  <UserBlock user={session.user} />
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(session.createdAt)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip size="small" color={statusColor(session.status)} label={statusLabel[session.status] || session.status} />
                    <Chip size="small" color={session.level >= 3 ? "error" : session.level >= 2 ? "warning" : "default"} label={`Level ${session.level}`} />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FactorChips factors={session.factors} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <RiskChips risk={session.risk} />
                </Grid>
                <Grid item xs={12} md={1}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {methodLabel[session.delivery?.method] || session.delivery?.method || "-"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {session.delivery?.targetMasked || "-"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {session.request?.ip || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Stack direction="row" spacing={0.5} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                    <Tooltip title="Xem chi tiết">
                      <IconButton onClick={() => onOpenDetail(session)}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    {canUnlock ? (
                      <Tooltip title="Mở checkpoint">
                        <span>
                          <IconButton color="success" disabled={resolving} onClick={() => onResolve(session, "approve")}>
                            <CheckCircleIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                    {canStop ? (
                      <Tooltip title="Từ chối">
                        <span>
                          <IconButton color="warning" disabled={resolving} onClick={() => onResolve(session, "reject")}>
                            <ErrorOutlineIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          );
        })}
        {!sessions.length && !query.isFetching ? <Alert severity="info">Không có checkpoint phù hợp bộ lọc.</Alert> : null}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Tổng: {query.data?.total || 0}
        </Typography>
        <Pagination page={filters.page} count={totalPages} onChange={(_, page) => onPage(page)} />
      </Stack>
    </Stack>
  );
}

function EventsTab({ query, filters, onFilter, onPage }) {
  const events = query.data?.events || [];
  const totalPages = query.data?.totalPages || 1;

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", xl: "row" }} spacing={1.25} alignItems={{ xl: "center" }}>
            <TextField
              size="small"
              label="Tìm type, path, IP, user"
              value={filters.q}
              onChange={(event) => onFilter("q", event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <FilterSelect value={filters.category} onChange={(value) => onFilter("category", value)} options={CATEGORY_OPTIONS} />
            <FilterSelect value={filters.outcome} onChange={(value) => onFilter("outcome", value)} options={OUTCOME_OPTIONS} />
            <FilterSelect value={filters.severity} onChange={(value) => onFilter("severity", value)} options={SEVERITY_OPTIONS} />
            <FilterSelect
              value={filters.pageSize}
              onChange={(value) => onFilter("pageSize", Number(value))}
              options={PAGE_SIZE_OPTIONS.map((value) => [value, `${value}/trang`])}
              minWidth={130}
            />
          </Stack>
        </CardContent>
      </Card>

      {query.isFetching ? <LinearProgress /> : null}
      {query.error ? (
        <Alert severity="error">{query.error?.data?.message || "Không tải được checkpoint events."}</Alert>
      ) : null}

      <Stack spacing={1.25}>
        {events.map((event) => (
          <Paper key={event._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={2}>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                  {fmtDate(event.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {shortId(event._id)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <UserBlock user={event.subjectUser || event.user} />
              </Grid>
              <Grid item xs={12} md={2}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={event.category} />
                  <Chip size="small" color={outcomeColor(event.outcome)} label={event.outcome} />
                  <Chip size="small" color={severityColor(event.severity)} label={event.severity} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={event.type}>
                  {event.type}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block" title={event.path}>
                  {event.method ? `${event.method} ` : ""}
                  {event.path || event.routeGroup || "-"}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  IP: {event.ip || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap title={event.deviceId}>
                  Device: {event.deviceName || event.deviceId || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap title={jsonPreview(event.metadata)}>
                  Weight: {event.weight || 0}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        ))}
        {!events.length && !query.isFetching ? <Alert severity="info">Không có event phù hợp bộ lọc.</Alert> : null}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Tổng: {query.data?.total || 0}
        </Typography>
        <Pagination page={filters.page} count={totalPages} onChange={(_, page) => onPage(page)} />
      </Stack>
    </Stack>
  );
}

function ManualCheckpointTab({
  query,
  filters,
  onFilter,
  onPage,
  onCreate,
  onCancel,
  onUnlock,
  creating,
  cancelling,
  unlocking,
}) {
  const userSearchTimerRef = useRef(null);
  const [searchUsers, userSearchQuery] = useLazySearchCheckpointUsersQuery();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [form, setForm] = useState({
    userId: "",
    identifier: "",
    level: 1,
    expiresInHours: 72,
    reason: "",
    note: "",
  });
  const [message, setMessage] = useState("");

  const mandates = query.data?.mandates || [];
  const totalPages = query.data?.totalPages || 1;
  const searchResults = userSearchQuery.data?.users || [];

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    setUserOptions((current) =>
      mergeUserOptions(selectedUser ? [selectedUser] : [], current, searchResults),
    );
  }, [searchResults, selectedUser]);

  useEffect(
    () => () => {
      if (userSearchTimerRef.current) {
        clearTimeout(userSearchTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (userSearchQuery.error) {
      toast.error(apiErrorMessage(userSearchQuery.error, "Không tìm được user checkpoint."));
    }
  }, [userSearchQuery.error]);

  const handleUserSearchInput = (value) => {
    updateForm("identifier", value);
    if (selectedUser && value !== userSearchOptionLabel(selectedUser)) {
      setSelectedUser(null);
      updateForm("userId", "");
    }

    const keyword = String(value || "").trim();
    if (userSearchTimerRef.current) {
      clearTimeout(userSearchTimerRef.current);
      userSearchTimerRef.current = null;
    }
    if (keyword.length < 2) return;

    userSearchTimerRef.current = setTimeout(() => {
      searchUsers({ q: keyword, limit: 12 });
    }, 250);
  };

  const handleUserSelect = (_, user) => {
    setSelectedUser(user || null);
    setForm((current) => ({
      ...current,
      userId: userOptionId(user),
      identifier: user ? userSearchOptionLabel(user) : "",
    }));
  };

  const handleCreate = async () => {
    setMessage("");
    const userId = userOptionId(selectedUser) || String(form.userId || "").trim();
    try {
      const result = await onCreate({
        ...form,
        userId: userId || undefined,
        identifier: userId ? "" : String(form.identifier || "").trim(),
      });
      if (result?.mandate) {
        setSelectedUser(null);
        setUserOptions([]);
        setMessage("Đã áp checkpoint thủ công. Nếu user đang online, web sẽ chuyển sang checkpoint trong vòng polling.");
        setForm((current) => ({
          ...current,
          userId: "",
          identifier: "",
          reason: "",
          note: "",
        }));
      }
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  const handleUnlock = async () => {
    setMessage("");
    const userId = userOptionId(selectedUser) || String(form.userId || "").trim();
    try {
      const result = await onUnlock({
        userId: userId || undefined,
        identifier: userId ? "" : String(form.identifier || "").trim(),
        note: String(form.note || "").trim(),
      });
      if (result?.ok) {
        setSelectedUser(null);
        setUserOptions([]);
        setMessage(
          result.unlocked
            ? "Đã mở checkpoint cho user. Nếu user đang ở trang checkpoint, hệ thống sẽ mở khóa khi trang cập nhật."
            : "User này hiện không có checkpoint hoặc mandate active để mở."
        );
        setForm((current) => ({
          ...current,
          userId: "",
          identifier: "",
          note: "",
        }));
      }
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="success">{message}</Alert> : null}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<GavelIcon color="primary" />}
              title="Áp checkpoint thủ công"
              subtitle="Admin chọn user và level; hệ thống sẽ gửi OTP và mở flow checkpoint khi user đăng nhập tiếp theo."
            />
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={userOptions}
                  value={selectedUser}
                  inputValue={form.identifier}
                  loading={userSearchQuery.isFetching}
                  onChange={handleUserSelect}
                  onInputChange={(_, value, reason) => {
                    if (reason === "input") handleUserSearchInput(value);
                    if (reason === "clear") handleUserSelect(null, null);
                  }}
                  getOptionLabel={userSearchOptionLabel}
                  isOptionEqualToValue={(option, value) =>
                    userOptionId(option) === userOptionId(value)
                  }
                  filterOptions={(options) => options}
                  renderOption={(props, option) => {
                    const { key, ...rest } = props;
                    return (
                      <Box component="li" key={key} {...rest}>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <UserBlock user={option} />
                          <Typography variant="caption" color="text.secondary">
                            ID: {shortId(option._id)}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tìm user"
                      placeholder="Tên, nickname, email, SĐT hoặc User ID"
                      helperText={
                        selectedUser
                          ? `Đã chọn: ${shortId(selectedUser._id)}`
                          : "Nhập ít nhất 2 ký tự; User ID chính xác sẽ hiện."
                      }
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FilterSelect
                  value={form.level}
                  onChange={(value) => updateForm("level", Number(value))}
                  options={[
                    [1, "Level 1"],
                    [2, "Level 2"],
                    [3, "Level 3"],
                  ]}
                  minWidth="100%"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <NumberSetting
                  label="Hiệu lực giờ"
                  value={form.expiresInHours}
                  min={1}
                  max={720}
                  width="100%"
                  onChange={(value) => updateForm("expiresInHours", value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  label="Lý do user-facing"
                  value={form.reason}
                  onChange={(event) => updateForm("reason", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  size="small"
                  label="Ghi chú nội bộ"
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Stack direction="row" justifyContent="flex-end">
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={unlocking ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                  onClick={handleUnlock}
                  disabled={unlocking || !form.identifier.trim()}
                >
                  Mở checkpoint
                </Button>
                <Button
                  variant="contained"
                  startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <GavelIcon />}
                  onClick={handleCreate}
                  disabled={creating || !form.identifier.trim()}
                >
                  Áp checkpoint
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems={{ lg: "center" }}>
            <TextField
              size="small"
              label="Tìm user/lý do"
              value={filters.q}
              onChange={(event) => onFilter("q", event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <FilterSelect value={filters.status} onChange={(value) => onFilter("status", value)} options={MANDATE_STATUS_OPTIONS} />
            <FilterSelect
              value={filters.level}
              onChange={(value) => onFilter("level", value)}
              options={[
                ["", "Tất cả level"],
                ["1", "Level 1"],
                ["2", "Level 2"],
                ["3", "Level 3"],
              ]}
              minWidth={140}
            />
            <FilterSelect
              value={filters.pageSize}
              onChange={(value) => onFilter("pageSize", Number(value))}
              options={PAGE_SIZE_OPTIONS.map((value) => [value, `${value}/trang`])}
              minWidth={130}
            />
          </Stack>
        </CardContent>
      </Card>

      {query.isFetching ? <LinearProgress /> : null}
      {query.error ? (
        <Alert severity="error">{query.error?.data?.message || "Không tải được manual checkpoint."}</Alert>
      ) : null}

      <Stack spacing={1.25}>
        {mandates.map((mandate) => (
          <Paper key={mandate._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={3}>
                <UserBlock user={mandate.user} />
                <Typography variant="caption" color="text.secondary">
                  Tạo: {fmtDate(mandate.createdAt)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color={mandate.status === "active" ? "warning" : mandate.status === "consumed" ? "success" : "default"}
                    label={mandate.status}
                  />
                  <Chip size="small" color={mandate.level >= 3 ? "error" : mandate.level >= 2 ? "warning" : "default"} label={`Level ${mandate.level}`} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={mandate.reason}>
                  {mandate.reason || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Hết hạn: {fmtDate(mandate.expiresAt)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Tạo bởi: {mandate.createdBy?.email || mandate.createdBy?.name || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Session: {mandate.consumedBySession || "-"}
                </Typography>
              </Grid>
              <Grid item xs={12} md={2}>
                <Stack direction="row" spacing={0.75} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                  {mandate.status === "active" ? (
                    <Button
                      color="warning"
                      variant="outlined"
                      disabled={cancelling}
                      onClick={() =>
                        onCancel({ id: mandate._id, note: "Admin huỷ manual checkpoint" }).catch(() => {})
                      }
                    >
                      Huỷ
                    </Button>
                  ) : null}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        ))}
        {!mandates.length && !query.isFetching ? <Alert severity="info">Chưa có manual checkpoint phù hợp.</Alert> : null}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Tổng: {query.data?.total || 0}
        </Typography>
        <Pagination page={filters.page} count={totalPages} onChange={(_, page) => onPage(page)} />
      </Stack>
    </Stack>
  );
}

function SettingsTab({ settingsResponse, loading, error, onSave, saving }) {
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (settingsResponse?.settings) setDraft(clone(settingsResponse.settings));
  }, [settingsResponse]);

  const setValue = (path, value) => {
    setDraft((current) => setPathValue(clone(current), path, value));
    setMessage("");
  };

  const handleReset = () => {
    if (settingsResponse?.defaults) setDraft(clone(settingsResponse.defaults));
    setMessage("");
  };

  const handleSave = async () => {
    try {
      await onSave(draft);
      setMessage("Đã lưu cấu hình checkpoint.");
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  if (loading) {
    return (
      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
        <CircularProgress />
      </Card>
    );
  }

  if (error) {
    return <Alert severity="error">{error?.data?.message || "Không tải được cấu hình checkpoint."}</Alert>;
  }

  if (!draft) return <Alert severity="info">Chưa có cấu hình checkpoint.</Alert>;

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<SecurityIcon color="primary" />}
              title="Runtime"
              subtitle="Các giá trị này áp dụng cho phiên checkpoint mới và resend tiếp theo."
            />
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.enabled !== false}
                    onChange={(event) => setValue("enabled", event.target.checked)}
                  />
                }
                label="Bật engine"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.roleBypassEnabled !== false}
                    onChange={(event) => setValue("roleBypassEnabled", event.target.checked)}
                  />
                }
                label="Bypass admin/referee"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.review?.requireNoteOnReject !== false}
                    onChange={(event) => setValue("review.requireNoteOnReject", event.target.checked)}
                  />
                }
                label="Bắt buộc ghi chú khi reject"
              />
            </Stack>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <NumberSetting label="Session TTL phút" value={draft.sessionTtlMinutes} min={5} max={240} onChange={(value) => setValue("sessionTtlMinutes", value)} />
              <NumberSetting label="OTP TTL phút" value={draft.codeTtlMinutes} min={1} max={60} onChange={(value) => setValue("codeTtlMinutes", value)} />
              <NumberSetting label="Resend giây" value={draft.resendCooldownSeconds} min={10} max={600} onChange={(value) => setValue("resendCooldownSeconds", value)} />
              <NumberSetting label="Trust ngày" value={draft.trustDays} min={1} max={365} onChange={(value) => setValue("trustDays", value)} />
              <NumberSetting label="Max attempts" value={draft.maxAttempts} min={1} max={20} onChange={(value) => setValue("maxAttempts", value)} />
              <NumberSetting label="Manual review từ level" value={draft.manualReviewLevel} min={1} max={4} onChange={(value) => setValue("manualReviewLevel", value)} />
              <NumberSetting label="Gia hạn sau approve phút" value={draft.review?.extendPendingMinutesOnApprove} min={1} max={120} onChange={(value) => setValue("review.extendPendingMinutesOnApprove", value)} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<RuleIcon color="primary" />}
              title="Threshold lên cấp"
              subtitle="Điểm tổng chỉ lên level khi đạt thêm điều kiện số lượng signal/category để giảm false positive."
            />
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <NumberSetting label="Level 1 score" value={draft.thresholds?.level1Score} min={0} max={200} onChange={(value) => setValue("thresholds.level1Score", value)} />
              <NumberSetting label="Level 2 score" value={draft.thresholds?.level2Score} min={0} max={200} onChange={(value) => setValue("thresholds.level2Score", value)} />
              <NumberSetting label="Level 3 score" value={draft.thresholds?.level3Score} min={0} max={240} onChange={(value) => setValue("thresholds.level3Score", value)} />
              <NumberSetting label="Min signal L1" value={draft.thresholds?.minSignalsForLevel1} min={1} max={12} onChange={(value) => setValue("thresholds.minSignalsForLevel1", value)} />
              <NumberSetting label="Min category L2" value={draft.thresholds?.minCategoriesForLevel2} min={1} max={12} onChange={(value) => setValue("thresholds.minCategoriesForLevel2", value)} />
              <NumberSetting label="Min category L3" value={draft.thresholds?.minCategoriesForLevel3} min={1} max={12} onChange={(value) => setValue("thresholds.minCategoriesForLevel3", value)} />
            </Stack>
            <Divider />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              Hard signals
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {Object.keys(draft.hardSignals || {}).map((key) => (
                <NumberSetting
                  key={key}
                  label={key}
                  value={draft.hardSignals?.[key]}
                  min={0}
                  max={1000}
                  width={190}
                  onChange={(value) => setValue(`hardSignals.${key}`, value)}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle icon={<TimelineIcon color="primary" />} title="Rule matrix" />
            {(Object.entries(draft.rules || {})).map(([key, rule]) => (
              <Paper key={key} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={rule.enabled !== false}
                          onChange={(event) => setValue(`rules.${key}.enabled`, event.target.checked)}
                        />
                      }
                      label={RULE_LABELS[key] || key}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={rule.category || "system"} />
                      <Chip size="small" variant="outlined" label={rule.window || "-"} />
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <NumberSetting label="Threshold" value={rule.threshold} onChange={(value) => setValue(`rules.${key}.threshold`, value)} />
                    <NumberSetting label="Points" value={rule.points} min={-200} max={240} onChange={(value) => setValue(`rules.${key}.points`, value)} />
                    <NumberSetting label="Level hint" value={rule.levelHint} min={1} max={3} onChange={(value) => setValue(`rules.${key}.levelHint`, value)} />
                    <TextField
                      size="small"
                      label="Lý do"
                      value={rule.reason || ""}
                      onChange={(event) => setValue(`rules.${key}.reason`, event.target.value)}
                      sx={{ minWidth: 360, flex: 1 }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle icon={<FactCheckIcon color="primary" />} title="Dampener chống false positive" />
            <Grid container spacing={1.5}>
              {Object.entries(draft.dampeners || {}).map(([key, item]) => (
                <Grid key={key} item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, height: "100%" }}>
                    <Stack spacing={1.25}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={item.enabled !== false}
                            onChange={(event) => setValue(`dampeners.${key}.enabled`, event.target.checked)}
                          />
                        }
                        label={DAMPENER_LABELS[key] || key}
                      />
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                        <NumberSetting label="Threshold" value={item.threshold} onChange={(value) => setValue(`dampeners.${key}.threshold`, value)} />
                        <NumberSetting label="Points" value={item.points} min={-200} max={0} onChange={(value) => setValue(`dampeners.${key}.points`, value)} />
                      </Stack>
                      <TextField
                        size="small"
                        label="Lý do"
                        value={item.reason || ""}
                        onChange={(event) => setValue(`dampeners.${key}.reason`, event.target.value)}
                        fullWidth
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button variant="outlined" onClick={handleReset}>
          Khôi phục mặc định
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          Lưu cấu hình
        </Button>
      </Stack>
    </Stack>
  );
}

function AllowlistTab({ settingsResponse, loading, error, onSave, saving }) {
  const [allowlist, setAllowlist] = useState(null);
  const [group, setGroup] = useState("users");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (settingsResponse?.settings?.allowlist) {
      setAllowlist(clone(settingsResponse.settings.allowlist));
    }
  }, [settingsResponse]);

  const addEntry = () => {
    const clean = value.trim();
    if (!clean) return;
    setAllowlist((current) => ({
      ...(current || {}),
      [group]: [
        ...((current?.[group] || [])),
        {
          value: clean,
          reason: reason.trim(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setValue("");
    setReason("");
    setExpiresAt("");
    setMessage("");
  };

  const removeEntry = (targetGroup, index) => {
    setAllowlist((current) => ({
      ...(current || {}),
      [targetGroup]: (current?.[targetGroup] || []).filter((_, idx) => idx !== index),
    }));
    setMessage("");
  };

  const handleSave = async () => {
    try {
      await onSave({ allowlist });
      setMessage("Đã lưu allowlist checkpoint.");
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  if (loading) {
    return (
      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
        <CircularProgress />
      </Card>
    );
  }
  if (error) return <Alert severity="error">{error?.data?.message || "Không tải được allowlist."}</Alert>;
  if (!allowlist) return <Alert severity="info">Chưa có allowlist.</Alert>;

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="success">{message}</Alert> : null}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<SecurityIcon color="primary" />}
              title="Bypass có kiểm soát"
              subtitle="Chỉ dùng cho false positive đã xác minh, luôn kèm lý do và thời hạn nếu có."
            />
            <FormControlLabel
              control={
                <Switch
                  checked={allowlist.enabled !== false}
                  onChange={(event) => setAllowlist((current) => ({ ...(current || {}), enabled: event.target.checked }))}
                />
              }
              label="Bật allowlist"
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              <FilterSelect value={group} onChange={setGroup} options={ALLOWLIST_GROUPS} minWidth={160} />
              <TextField size="small" label="Giá trị" value={value} onChange={(event) => setValue(event.target.value)} sx={{ minWidth: 260 }} />
              <TextField size="small" label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} sx={{ minWidth: 280, flex: 1 }} />
              <TextField
                size="small"
                type="datetime-local"
                label="Hết hạn"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 210 }}
              />
              <Button variant="contained" onClick={addEntry}>
                Thêm
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {ALLOWLIST_GROUPS.map(([key, label]) => (
        <Card key={key} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                {label}
              </Typography>
              {(allowlist[key] || []).map((entry, index) => (
                <Paper key={`${entry.value}-${index}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>
                        {entry.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.reason || "Không có lý do"} | Hết hạn: {fmtDate(entry.expiresAt)}
                      </Typography>
                    </Box>
                    <Button color="warning" onClick={() => removeEntry(key, index)}>
                      Xoá
                    </Button>
                  </Stack>
                </Paper>
              ))}
              {!allowlist[key]?.length ? <Alert severity="info">Chưa có mục nào.</Alert> : null}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          Lưu allowlist
        </Button>
      </Stack>
    </Stack>
  );
}

function SimulatorTab({ onSimulate, result, loading }) {
  const [counters, setCounters] = useState(() =>
    COUNTER_FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: 0 }), {})
  );
  const [user, setUser] = useState({
    hasEmail: true,
    hasPhone: true,
    cccdStatus: "",
    accountAgeDays: 45,
  });

  const run = async () => {
    const accountAgeMs = Number(user.accountAgeDays || 0) * 24 * 60 * 60 * 1000;
    try {
      await onSimulate({
        intent: "login",
        counters,
        user: {
          email: user.hasEmail ? "demo@example.com" : "",
          phone: user.hasPhone ? "0900000000" : "",
          cccdStatus: user.cccdStatus,
          createdAt: new Date(Date.now() - accountAgeMs).toISOString(),
        },
      });
    } catch {
      // Toast đã được hiển thị ở handler cha.
    }
  };

  const decision = result?.decision;

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<ScienceIcon color="primary" />}
              title="Risk simulator"
              subtitle="Thử counters giả lập để xem engine ra level nào trước khi chỉnh policy."
            />
            <Grid container spacing={1.5}>
              {COUNTER_FIELDS.map(([key, label]) => (
                <Grid key={key} item xs={12} sm={6} md={4} lg={3}>
                  <NumberSetting
                    label={label}
                    value={counters[key]}
                    min={0}
                    max={10000}
                    width="100%"
                    onChange={(value) => setCounters((current) => ({ ...current, [key]: value }))}
                  />
                </Grid>
              ))}
            </Grid>
            <Divider />
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={<Switch checked={user.hasEmail} onChange={(event) => setUser((current) => ({ ...current, hasEmail: event.target.checked }))} />}
                label="Có email"
              />
              <FormControlLabel
                control={<Switch checked={user.hasPhone} onChange={(event) => setUser((current) => ({ ...current, hasPhone: event.target.checked }))} />}
                label="Có số điện thoại"
              />
              <FilterSelect
                value={user.cccdStatus}
                onChange={(value) => setUser((current) => ({ ...current, cccdStatus: value }))}
                options={[
                  ["", "CCCD chưa xác minh"],
                  ["verified", "CCCD verified"],
                ]}
                minWidth={190}
              />
              <NumberSetting
                label="Tuổi tài khoản ngày"
                value={user.accountAgeDays}
                min={0}
                max={3000}
                onChange={(value) => setUser((current) => ({ ...current, accountAgeDays: value }))}
              />
              <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ScienceIcon />} onClick={run} disabled={loading}>
                Chạy mô phỏng
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {decision ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <SectionTitle icon={<RuleIcon color="primary" />} title="Kết quả mô phỏng" />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip color={decision.required ? "warning" : "success"} label={decision.required ? "Checkpoint required" : "Không checkpoint"} />
                <Chip color={decision.level >= 3 ? "error" : decision.level >= 2 ? "warning" : "default"} label={`Level ${decision.level || 0}`} />
                <Chip label={`Score ${decision.score || 0}`} />
                <Chip variant="outlined" label={`Raw ${decision.rawScore || 0}`} />
                <Chip variant="outlined" label={decision.confidence || "low"} />
              </Stack>
              <RiskChips risk={decision} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}

function InsightTab({ queryArgs, setQueryArgs, query, onSearch }) {
  const data = query.data;
  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              icon={<ManageSearchIcon color="primary" />}
              title="Subject insight"
              subtitle="Tra theo user, IP hoặc device để xem toàn bộ lịch sử checkpoint/risk liên quan."
            />
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25}>
              <TextField size="small" label="User ID" value={queryArgs.userId} onChange={(event) => setQueryArgs((current) => ({ ...current, userId: event.target.value }))} sx={{ minWidth: 250 }} />
              <TextField size="small" label="IP" value={queryArgs.ip} onChange={(event) => setQueryArgs((current) => ({ ...current, ip: event.target.value }))} sx={{ minWidth: 180 }} />
              <TextField size="small" label="Device ID" value={queryArgs.deviceId} onChange={(event) => setQueryArgs((current) => ({ ...current, deviceId: event.target.value }))} sx={{ minWidth: 240 }} />
              <FilterSelect
                value={queryArgs.days}
                onChange={(value) => setQueryArgs((current) => ({ ...current, days: Number(value) }))}
                options={[
                  [7, "7 ngày"],
                  [30, "30 ngày"],
                  [90, "90 ngày"],
                ]}
                minWidth={130}
              />
              <Button variant="contained" onClick={onSearch}>
                Tra cứu
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {query.isFetching ? <LinearProgress /> : null}
      {query.error ? <Alert severity="error">{query.error?.data?.message || "Không tải được insight."}</Alert> : null}

      {data ? (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Events" value={data.summary?.events || 0} caption={`${data.window?.days || 0} ngày`} icon={<TimelineIcon color="primary" />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Sessions" value={data.summary?.sessions || 0} caption={`${data.summary?.reviewRequired || 0} cần review`} icon={<SecurityIcon color="primary" />} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Passed" value={data.summary?.passed || 0} caption="Phiên đã qua" icon={<CheckCircleIcon color="success" />} color="success" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard label="Failed" value={data.summary?.failed || 0} caption="Failed/expired/cancelled" icon={<ErrorOutlineIcon color="warning" />} color="warning" />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<RuleIcon color="primary" />} title="Top signals" />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(data.topSignals || []).map((signal) => (
                    <Chip key={signal.key} size="small" variant="outlined" label={`${signal.reason} x${signal.count}`} />
                  ))}
                  {!data.topSignals?.length ? <Chip size="small" label="Chưa có signal" /> : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <SectionTitle icon={<SecurityIcon color="primary" />} title="Sessions gần đây" />
                    {(data.sessions || []).slice(0, 10).map((session) => (
                      <Paper key={session._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} justifyContent="space-between">
                          <UserBlock user={session.user} />
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" color={statusColor(session.status)} label={statusLabel[session.status] || session.status} />
                            <Chip size="small" label={`L${session.level}`} />
                            <Chip size="small" variant="outlined" label={`Score ${session.risk?.score || 0}`} />
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <SectionTitle icon={<TimelineIcon color="primary" />} title="Events gần đây" />
                    {(data.events || []).slice(0, 12).map((event) => (
                      <Paper key={event._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                        <Stack direction="row" spacing={1} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                              {event.type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {fmtDate(event.createdAt)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={event.category} />
                            <Chip size="small" color={outcomeColor(event.outcome)} label={event.outcome} />
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      ) : (
        <Alert severity="info">Nhập user ID, IP hoặc device ID rồi bấm tra cứu.</Alert>
      )}
    </Stack>
  );
}

function PolicyTab({ policy, loading, error }) {
  if (loading) {
    return (
      <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
        <CircularProgress />
      </Card>
    );
  }

  if (error) {
    return <Alert severity="error">{error?.data?.message || "Không tải được policy checkpoint."}</Alert>;
  }

  const data = policy || {};

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<SecurityIcon color="primary" />} title="Trạng thái engine" />
                <Chip color={data.enabled ? "success" : "warning"} label={data.enabled ? "Đang bật" : "Đang tắt"} />
                <Chip
                  variant="outlined"
                  color={data.roleBypassEnabled ? "info" : "default"}
                  label={data.roleBypassEnabled ? "Admin/referee bypass" : "Không bypass role"}
                />
                <Typography variant="body2" color="text.secondary">
                  Ưu tiên OTP: {(data.primaryContactPriority || []).join(" -> ") || "email_otp -> phone_otp"}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: "100%", borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<FactCheckIcon color="primary" />} title="Cấp checkpoint" />
                {(data.levels || []).map((level) => (
                  <Paper key={level.level} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>
                        Level {level.level}
                      </Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {(level.factors || []).map((factor) => (
                          <Chip key={factor} size="small" label={factorLabel[factor] || factor} />
                        ))}
                        {level.reviewRequired ? <Chip size="small" color="warning" label="Manual review" /> : null}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<RuleIcon color="primary" />} title="Category quan sát" />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(data.observedCategories || []).map((category) => (
                    <Chip key={category} size="small" variant="outlined" label={category} />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <SectionTitle icon={<TimelineIcon color="primary" />} title="Scoring shape" />
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(data.scoringShape?.windows || []).map((windowName) => (
                    <Chip key={windowName} size="small" label={windowName} />
                  ))}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={data.scoringShape?.usesDampeners ? "Có dampener" : "Không dampener"}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${Math.round((data.scoringShape?.trustedDeviceWindowMs || 0) / 86400000)} ngày trust`}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function CheckpointManagerPage() {
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(30);
  const [selectedSession, setSelectedSession] = useState(null);
  const [resolveState, setResolveState] = useState({ open: false, session: null, action: "" });
  const [simulatorResult, setSimulatorResult] = useState(null);
  const [insightArgs, setInsightArgs] = useState({ userId: "", ip: "", deviceId: "", days: 30 });
  const [activeInsightArgs, setActiveInsightArgs] = useState(null);
  const [sessionFilters, setSessionFilters] = useState({
    page: 1,
    pageSize: 20,
    q: "",
    status: "",
    level: "",
    deliveryMethod: "",
  });
  const [eventFilters, setEventFilters] = useState({
    page: 1,
    pageSize: 30,
    q: "",
    category: "",
    outcome: "",
    severity: "",
  });
  const [mandateFilters, setMandateFilters] = useState({
    page: 1,
    pageSize: 20,
    q: "",
    status: "active",
    level: "",
  });
  const lastApiToastRef = useRef("");

  const { data: verifyData, isLoading: verifying } = useVerifyQuery();
  const isSuperAdmin = isStrictSuperAdminUser(verifyData?.user);

  const overviewQuery = useGetCheckpointAdminOverviewQuery({ days }, { skip: !isSuperAdmin });
  const policyQuery = useGetCheckpointAdminPolicyQuery(undefined, { skip: !isSuperAdmin });
  const settingsQuery = useGetCheckpointAdminSettingsQuery(undefined, { skip: !isSuperAdmin });
  const sessionsQuery = useGetCheckpointAdminSessionsQuery(
    { ...sessionFilters, days },
    { skip: !isSuperAdmin || tab !== "sessions" },
  );
  const eventsQuery = useGetCheckpointAdminEventsQuery(
    { ...eventFilters, days },
    { skip: !isSuperAdmin || tab !== "events" },
  );
  const mandatesQuery = useGetCheckpointMandatesQuery(mandateFilters, {
    skip: !isSuperAdmin || tab !== "manual",
  });
  const sessionDetailQuery = useGetCheckpointAdminSessionDetailQuery(selectedSession?._id, {
    skip: !isSuperAdmin || !selectedSession?._id,
  });
  const insightQuery = useGetCheckpointSubjectInsightQuery(activeInsightArgs || {}, {
    skip:
      !isSuperAdmin ||
      !activeInsightArgs ||
      (!activeInsightArgs.userId && !activeInsightArgs.ip && !activeInsightArgs.deviceId),
  });
  const [resolveSession, { isLoading: resolving }] = useResolveCheckpointAdminSessionMutation();
  const [createMandate, { isLoading: creatingMandate }] = useCreateCheckpointMandateMutation();
  const [cancelMandate, { isLoading: cancellingMandate }] = useCancelCheckpointMandateMutation();
  const [unlockCheckpointSubject, { isLoading: unlockingCheckpoint }] =
    useUnlockCheckpointSubjectMutation();
  const [updateSettings, { isLoading: savingSettings }] =
    useUpdateCheckpointAdminSettingsMutation();
  const [simulateRisk, { isLoading: simulating }] = useSimulateCheckpointRiskMutation();

  useEffect(() => {
    const entry = [
      { error: overviewQuery.error, fallback: "Không tải được tổng quan checkpoint." },
      { error: policyQuery.error, fallback: "Không tải được policy checkpoint." },
      { error: settingsQuery.error, fallback: "Không tải được cấu hình checkpoint." },
      { error: sessionsQuery.error, fallback: "Không tải được danh sách checkpoint." },
      { error: eventsQuery.error, fallback: "Không tải được checkpoint events." },
      { error: mandatesQuery.error, fallback: "Không tải được manual checkpoint." },
      { error: sessionDetailQuery.error, fallback: "Không tải được chi tiết checkpoint." },
      { error: insightQuery.error, fallback: "Không tải được insight checkpoint." },
    ].find((item) => item.error);

    if (!entry) return;
    const key = apiErrorKey(entry.error, entry.fallback);
    if (lastApiToastRef.current === key) return;
    lastApiToastRef.current = key;
    toast.error(apiErrorMessage(entry.error, entry.fallback));
  }, [
    eventsQuery.error,
    insightQuery.error,
    mandatesQuery.error,
    overviewQuery.error,
    policyQuery.error,
    sessionDetailQuery.error,
    sessionsQuery.error,
    settingsQuery.error,
  ]);

  const activeFetching = useMemo(
    () =>
      overviewQuery.isFetching ||
      policyQuery.isFetching ||
      settingsQuery.isFetching ||
      sessionsQuery.isFetching ||
      eventsQuery.isFetching ||
      mandatesQuery.isFetching,
    [
      eventsQuery.isFetching,
      overviewQuery.isFetching,
      policyQuery.isFetching,
      mandatesQuery.isFetching,
      sessionsQuery.isFetching,
      settingsQuery.isFetching,
    ],
  );

  const handleRefresh = () => {
    overviewQuery.refetch();
    policyQuery.refetch();
    settingsQuery.refetch();
    if (tab === "sessions") sessionsQuery.refetch();
    if (tab === "events") eventsQuery.refetch();
    if (tab === "manual") mandatesQuery.refetch();
  };

  const setSessionFilter = (key, value) => {
    setSessionFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const setEventFilter = (key, value) => {
    setEventFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const setMandateFilter = (key, value) => {
    setMandateFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const openResolveDialog = (session, action) => {
    setResolveState({ open: true, session, action });
  };

  const handleResolve = async ({ id, action, note }) => {
    try {
      await resolveSession({ id, action, note }).unwrap();
      setResolveState({ open: false, session: null, action: "" });
      setSelectedSession(null);
      overviewQuery.refetch();
      toast.success(
        action === "approve"
          ? "Đã duyệt checkpoint."
          : action === "reject"
          ? "Đã từ chối checkpoint."
          : "Đã hủy checkpoint.",
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không xử lý được checkpoint."));
      throw error;
    }
  };

  const handleSaveSettings = async (payload) => {
    try {
      await updateSettings(payload).unwrap();
      await settingsQuery.refetch();
      await policyQuery.refetch();
      await overviewQuery.refetch();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không lưu được cấu hình checkpoint."));
      throw error;
    }
  };

  const handleSimulate = async (payload) => {
    try {
      const result = await simulateRisk(payload).unwrap();
      setSimulatorResult(result);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không chạy được mô phỏng checkpoint."));
      throw error;
    }
  };

  const handleCreateMandate = async (payload) => {
    try {
      const result = await createMandate(payload).unwrap();
      await mandatesQuery.refetch();
      await overviewQuery.refetch();
      toast.success("Đã áp checkpoint thủ công.");
      return result;
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không áp được checkpoint thủ công."));
      throw error;
    }
  };

  const handleCancelMandate = async (payload) => {
    try {
      await cancelMandate(payload).unwrap();
      await mandatesQuery.refetch();
      await overviewQuery.refetch();
      toast.success("Đã hủy checkpoint thủ công.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không hủy được checkpoint thủ công."));
      throw error;
    }
  };

  const handleUnlockCheckpointSubject = async (payload) => {
    try {
      const result = await unlockCheckpointSubject(payload).unwrap();
      if (!mandatesQuery.isUninitialized) await mandatesQuery.refetch();
      if (!sessionsQuery.isUninitialized) await sessionsQuery.refetch();
      await overviewQuery.refetch();
      if (result?.unlocked) {
        toast.success("Đã mở checkpoint cho user.");
      } else {
        toast.info("User này hiện không có checkpoint hoặc mandate active để mở.");
      }
      return result;
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không mở được checkpoint cho user."));
      throw error;
    }
  };

  if (verifying) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox py={3}>
          <Card sx={{ py: 8, textAlign: "center", borderRadius: 3 }}>
            <CircularProgress />
          </Card>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Checkpoint Engine
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Quản lý phiên checkpoint, tín hiệu rủi ro, review eKYC và policy đang áp dụng.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select size="small" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                <MenuItem value={1}>24 giờ</MenuItem>
                <MenuItem value={7}>7 ngày</MenuItem>
                <MenuItem value={30}>30 ngày</MenuItem>
                <MenuItem value={90}>90 ngày</MenuItem>
              </Select>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh}>
                Làm mới
              </Button>
            </Stack>
          </Stack>

          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
            <Tab value="overview" label="Tổng quan" />
            <Tab value="sessions" label="Phiên checkpoint" />
            <Tab value="events" label="Sự kiện" />
            <Tab value="manual" label="Manual" />
            <Tab value="settings" label="Rules" />
            <Tab value="allowlist" label="Allowlist" />
            <Tab value="simulator" label="Simulator" />
            <Tab value="insight" label="Insight" />
            <Tab value="policy" label="Chính sách" />
          </Tabs>

          {activeFetching ? <LinearProgress /> : null}

          {tab === "overview" ? (
            <OverviewTab
              overview={overviewQuery.data}
              loading={overviewQuery.isLoading}
              error={overviewQuery.error}
            />
          ) : null}

          {tab === "sessions" ? (
            <SessionsTab
              query={sessionsQuery}
              filters={sessionFilters}
              onFilter={setSessionFilter}
              onPage={(page) => setSessionFilter("page", page)}
              onOpenDetail={setSelectedSession}
              onResolve={openResolveDialog}
              resolving={resolving}
            />
          ) : null}

          {tab === "events" ? (
            <EventsTab
              query={eventsQuery}
              filters={eventFilters}
              onFilter={setEventFilter}
              onPage={(page) => setEventFilter("page", page)}
            />
          ) : null}

          {tab === "manual" ? (
            <ManualCheckpointTab
              query={mandatesQuery}
              filters={mandateFilters}
              onFilter={setMandateFilter}
              onPage={(page) => setMandateFilter("page", page)}
              onCreate={handleCreateMandate}
              onCancel={handleCancelMandate}
              onUnlock={handleUnlockCheckpointSubject}
              creating={creatingMandate}
              cancelling={cancellingMandate}
              unlocking={unlockingCheckpoint}
            />
          ) : null}

          {tab === "settings" ? (
            <SettingsTab
              settingsResponse={settingsQuery.data}
              loading={settingsQuery.isLoading}
              error={settingsQuery.error}
              onSave={handleSaveSettings}
              saving={savingSettings}
            />
          ) : null}

          {tab === "allowlist" ? (
            <AllowlistTab
              settingsResponse={settingsQuery.data}
              loading={settingsQuery.isLoading}
              error={settingsQuery.error}
              onSave={handleSaveSettings}
              saving={savingSettings}
            />
          ) : null}

          {tab === "simulator" ? (
            <SimulatorTab
              onSimulate={handleSimulate}
              result={simulatorResult}
              loading={simulating}
            />
          ) : null}

          {tab === "insight" ? (
            <InsightTab
              queryArgs={insightArgs}
              setQueryArgs={setInsightArgs}
              query={insightQuery}
              onSearch={() => setActiveInsightArgs({ ...insightArgs })}
            />
          ) : null}

          {tab === "policy" ? (
            <PolicyTab
              policy={policyQuery.data || overviewQuery.data?.policy}
              loading={policyQuery.isLoading}
              error={policyQuery.error}
            />
          ) : null}
        </Stack>
      </MDBox>
      <Footer />

      <SessionDetailDialog
        session={sessionDetailQuery.data?.session || selectedSession}
        events={sessionDetailQuery.data?.events || []}
        loadingEvents={sessionDetailQuery.isFetching}
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        onResolve={openResolveDialog}
      />
      <ResolveDialog
        open={resolveState.open}
        session={resolveState.session}
        action={resolveState.action}
        onClose={() => setResolveState({ open: false, session: null, action: "" })}
        onConfirm={handleResolve}
        loading={resolving}
      />
    </DashboardLayout>
  );
}
