/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
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
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
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
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleIcon from "@mui/icons-material/Rule";
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
  useGetCheckpointAdminSessionsQuery,
  useResolveCheckpointAdminSessionMutation,
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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

const jsonPreview = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return String(value || "");
  }
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

function ResolveDialog({ open, session, action, onClose, onConfirm, loading }) {
  const [note, setNote] = useState("");

  const title =
    action === "approve"
      ? "Duyệt checkpoint"
      : action === "reject"
      ? "Từ chối checkpoint"
      : "Huỷ checkpoint";

  const handleConfirm = async () => {
    await onConfirm({ id: session?._id, action, note });
    setNote("");
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

function SessionDetailDialog({ session, open, onClose, onResolve }) {
  if (!session) return null;
  const canApprove = session.status === "review_required";
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
        {canApprove ? (
          <Button color="success" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => onResolve(session, "approve")}>
            Duyệt
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
          const canApprove = session.status === "review_required";
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
                    {canApprove ? (
                      <Tooltip title="Duyệt">
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

  const { data: verifyData, isLoading: verifying } = useVerifyQuery();
  const isSuperAdmin = isStrictSuperAdminUser(verifyData?.user);

  const overviewQuery = useGetCheckpointAdminOverviewQuery({ days }, { skip: !isSuperAdmin });
  const policyQuery = useGetCheckpointAdminPolicyQuery(undefined, { skip: !isSuperAdmin });
  const sessionsQuery = useGetCheckpointAdminSessionsQuery(
    { ...sessionFilters, days },
    { skip: !isSuperAdmin || tab !== "sessions" },
  );
  const eventsQuery = useGetCheckpointAdminEventsQuery(
    { ...eventFilters, days },
    { skip: !isSuperAdmin || tab !== "events" },
  );
  const [resolveSession, { isLoading: resolving }] = useResolveCheckpointAdminSessionMutation();

  const activeFetching = useMemo(
    () =>
      overviewQuery.isFetching ||
      policyQuery.isFetching ||
      sessionsQuery.isFetching ||
      eventsQuery.isFetching,
    [eventsQuery.isFetching, overviewQuery.isFetching, policyQuery.isFetching, sessionsQuery.isFetching],
  );

  const handleRefresh = () => {
    overviewQuery.refetch();
    policyQuery.refetch();
    if (tab === "sessions") sessionsQuery.refetch();
    if (tab === "events") eventsQuery.refetch();
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

  const openResolveDialog = (session, action) => {
    setResolveState({ open: true, session, action });
  };

  const handleResolve = async ({ id, action, note }) => {
    await resolveSession({ id, action, note }).unwrap();
    setResolveState({ open: false, session: null, action: "" });
    setSelectedSession(null);
    overviewQuery.refetch();
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
        session={selectedSession}
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
