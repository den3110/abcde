import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import BoltIcon from "@mui/icons-material/Bolt";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useGetAvatarOptimizationStatusQuery,
  useRunAvatarOptimizationCleanupMutation,
  useRunAvatarOptimizationSweepMutation,
} from "slices/adminApiSlice";
import { useVerifyQuery } from "slices/authApiSlice";
import { isStrictSuperAdminUser } from "utils/authz";

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(ms = 0) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "0s";
  if (value < 1000) return `${value}ms`;

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDateTime(value) {
  if (!value) return "Không có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không có";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function MetricCard({ label, value, caption, tone = "default" }) {
  const accent =
    tone === "warning"
      ? "warning.main"
      : tone === "success"
      ? "success.main"
      : tone === "info"
      ? "info.main"
      : "text.primary";

  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: accent }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

function StatusChip({ running, idleLabel, runningLabel }) {
  return (
    <Chip
      size="small"
      color={running ? "warning" : "success"}
      label={running ? runningLabel : idleLabel}
      icon={running ? <AutorenewIcon /> : <BoltIcon />}
      sx={{
        "& .MuiChip-icon": running
          ? { animation: "avatar-opt-spin 1.4s linear infinite" }
          : undefined,
        "@keyframes avatar-opt-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      }}
    />
  );
}

function UserSampleCard({ title, item }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack spacing={0.5}>
        <Typography fontWeight={700} noWrap>
          {item?.name || item?.nickname || "Không có"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {item?.phone || item?.avatar || "Không có"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {title}:{" "}
          {item?.avatarOptimization?.optimizedAt || item?.updatedAt
            ? formatDateTime(item?.avatarOptimization?.optimizedAt || item?.updatedAt)
            : "Không có"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          {item?.avatar || "Không có"}
        </Typography>
      </Stack>
    </Paper>
  );
}

MetricCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  caption: PropTypes.node,
  tone: PropTypes.oneOf(["default", "warning", "success", "info"]),
};

MetricCard.defaultProps = {
  caption: null,
  tone: "default",
};

StatusChip.propTypes = {
  running: PropTypes.bool,
  idleLabel: PropTypes.string.isRequired,
  runningLabel: PropTypes.string.isRequired,
};

StatusChip.defaultProps = {
  running: false,
};

UserSampleCard.propTypes = {
  title: PropTypes.string.isRequired,
  item: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    nickname: PropTypes.string,
    phone: PropTypes.string,
    avatar: PropTypes.string,
    updatedAt: PropTypes.string,
    avatarOptimization: PropTypes.shape({
      optimizedAt: PropTypes.string,
    }),
  }),
};

UserSampleCard.defaultProps = {
  item: null,
};

export default function AdminAvatarOptimizationPage() {
  const { data: verifyData } = useVerifyQuery();
  const currentUser = useMemo(() => {
    if (verifyData?.user && typeof verifyData.user === "object") return verifyData.user;
    return verifyData || null;
  }, [verifyData]);
  const isAllowed = useMemo(() => isStrictSuperAdminUser(currentUser), [currentUser]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const { data, error, isLoading, isFetching, refetch } = useGetAvatarOptimizationStatusQuery(
    undefined,
    {
      skip: !isAllowed,
      pollingInterval: autoRefresh ? 5000 : 0,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const [runSweep, { isLoading: isRunningSweepAction }] = useRunAvatarOptimizationSweepMutation();
  const [runCleanup, { isLoading: isRunningCleanupAction }] =
    useRunAvatarOptimizationCleanupMutation();

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  const summary = data?.summary || {};
  const jobs = data?.jobs || {};
  const sweep = jobs.sweep || {};
  const cleanup = jobs.cleanup || {};
  const trash = data?.trash || {};
  const config = data?.config || {};
  const samples = data?.samples || {};
  const hasBusyJob = Boolean(sweep?.running || cleanup?.running);

  const showSnack = (severity, message) => {
    setSnack({ open: true, severity, message });
  };

  const handleRunSweep = async () => {
    try {
      const result = await runSweep().unwrap();
      showSnack(
        result?.started ? "success" : "info",
        result?.started ? "Đã kích hoạt quét ảnh đại diện." : "Tác vụ quét đang chạy ở luồng khác."
      );
      await refetch();
    } catch (runError) {
      showSnack("error", runError?.data?.message || "Không chạy được tác vụ quét ảnh đại diện.");
    }
  };

  const handleRunCleanup = async () => {
    try {
      const result = await runCleanup().unwrap();
      showSnack(
        result?.started ? "success" : "info",
        result?.started ? "Đã kích hoạt dọn thùng rác." : "Tác vụ dọn đang chạy ở luồng khác."
      );
      await refetch();
    } catch (runError) {
      showSnack("error", runError?.data?.message || "Không chạy được tác vụ dọn dẹp.");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box sx={{ px: { xs: 0, md: 1 }, pb: 3 }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Tối ưu Ảnh Đại Diện
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Theo dõi quét nền, chạy thủ công và kiểm tra thùng rác cho ảnh đại diện người dùng.
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.target.checked)}
                  />
                }
                label="Tự làm mới mỗi 5 giây"
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                Làm mới
              </Button>
              <Button
                variant="contained"
                startIcon={<AutorenewIcon />}
                onClick={handleRunSweep}
                disabled={isRunningSweepAction || Boolean(sweep?.running)}
              >
                Chạy quét ngay
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CleaningServicesIcon />}
                onClick={handleRunCleanup}
                disabled={isRunningCleanupAction || Boolean(cleanup?.running)}
              >
                Dọn thùng rác ngay
              </Button>
            </Stack>
          </Stack>

          {(isFetching || hasBusyJob) && <LinearProgress />}

          {isLoading ? (
            <Paper
              variant="outlined"
              sx={{
                py: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                borderRadius: 3,
              }}
            >
              <CircularProgress />
              <Typography color="text.secondary">Đang tải trạng thái...</Typography>
            </Paper>
          ) : error ? (
            <Alert severity="error">
              {error?.data?.message || "Không tải được trạng thái tối ưu ảnh đại diện."}
            </Alert>
          ) : (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(5, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <MetricCard
                  label="Người dùng có ảnh đại diện"
                  value={summary.totalAvatarUsers || 0}
                  caption="Tổng số người dùng đang có ảnh đại diện"
                  tone="info"
                />
                <MetricCard
                  label="Đang chờ xử lý"
                  value={summary.pendingUsers || 0}
                  caption="Ảnh đại diện chưa đồng bộ xong theo trạng thái mới nhất"
                  tone="warning"
                />
                <MetricCard
                  label="Đã đồng bộ"
                  value={summary.upToDateUsers || 0}
                  caption="Ảnh đại diện đã được đánh dấu khớp với dữ liệu hiện tại"
                  tone="success"
                />
                <MetricCard
                  label="Ảnh tối ưu đang dùng"
                  value={summary.activeOptimizedUsers || 0}
                  caption="Tài khoản người dùng đang trỏ tới ảnh đã tối ưu"
                  tone="info"
                />
                <MetricCard
                  label="Tệp trong thùng rác"
                  value={trash.files || 0}
                  caption={`${formatBytes(trash.totalBytes || 0)} đang nằm trong thùng rác`}
                  tone="warning"
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                  gap: 2,
                }}
              >
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={1.5}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Quét ảnh đại diện
                      </Typography>
                      <StatusChip
                        running={Boolean(sweep?.running)}
                        idleLabel="Đang nghỉ"
                        runningLabel="Đang chạy"
                      />
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Lần bắt đầu: {formatDateTime(sweep?.lastStartedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lần kết thúc: {formatDateTime(sweep?.lastFinishedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Thời lượng: {formatDuration(sweep?.lastDurationMs)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lý do: {sweep?.lastReason || "Không có"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Kết quả:{" "}
                        {sweep?.lastResult
                          ? `${sweep.lastResult.processed || 0} người dùng, ${
                              sweep.lastResult.optimized || 0
                            } ảnh tối ưu`
                          : "Không có"}
                      </Typography>
                      {sweep?.lastError ? (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {sweep.lastError}
                        </Alert>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={1.5}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Dọn thùng rác
                      </Typography>
                      <StatusChip
                        running={Boolean(cleanup?.running)}
                        idleLabel="Đang nghỉ"
                        runningLabel="Đang chạy"
                      />
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Lần bắt đầu: {formatDateTime(cleanup?.lastStartedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lần kết thúc: {formatDateTime(cleanup?.lastFinishedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Thời lượng: {formatDuration(cleanup?.lastDurationMs)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Kết quả:{" "}
                        {cleanup?.lastResult
                          ? `${cleanup.lastResult.removed || 0} tệp đã dọn`
                          : "Không có"}
                      </Typography>
                      {cleanup?.lastError ? (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {cleanup.lastError}
                        </Alert>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", xl: "1.25fr 1fr" },
                  gap: 2,
                }}
              >
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Người dùng chờ xử lý
                    </Typography>
                    {samples?.pending?.length ? (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                          gap: 1.5,
                        }}
                      >
                        {samples.pending.map((item) => (
                          <UserSampleCard key={item._id} title="Cập nhật lúc" item={item} />
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="success">Không còn người dùng nào đang chờ tối ưu.</Alert>
                    )}
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Người dùng vừa tối ưu
                    </Typography>
                    {samples?.recentOptimized?.length ? (
                      <Stack spacing={1.5}>
                        {samples.recentOptimized.map((item) => (
                          <UserSampleCard key={item._id} title="Tối ưu lúc" item={item} />
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">Chưa có ảnh tối ưu nào để hiển thị.</Alert>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
                  gap: 2,
                }}
              >
                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Cấu hình nền
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Ngưỡng dung lượng: {formatBytes(config?.sweep?.thresholdBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cạnh tối đa: {config?.sweep?.maxDimension || 0}px
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Chất lượng WebP: {config?.sweep?.quality || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tiết kiệm tối thiểu: {formatBytes(config?.sweep?.minSavedBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Múi giờ: {config?.sweep?.timezone || "Không có"}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Chip
                        size="small"
                        color={config?.sweep?.deleteOriginals ? "warning" : "default"}
                        label={
                          config?.sweep?.deleteOriginals
                            ? "Ảnh gốc sẽ được đưa vào thùng rác sau khi đổi sang ảnh mới"
                            : "Ảnh gốc đang được giữ lại sau khi tối ưu"
                        }
                        sx={{ alignSelf: "flex-start" }}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Thùng rác ảnh đại diện
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Thư mục: {trash?.root || "Không có"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Số tệp: {trash?.files || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Dung lượng: {formatBytes(trash?.totalBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tệp cũ nhất: {formatDateTime(trash?.oldestFileAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tệp mới nhất: {formatDateTime(trash?.newestFileAt)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2800}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
