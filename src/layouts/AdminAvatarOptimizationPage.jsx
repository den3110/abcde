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
  if (!value) return "Khong co";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Khong co";

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
          {item?.name || item?.nickname || "Khong co"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {item?.phone || item?.avatar || "Khong co"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {title}:{" "}
          {item?.avatarOptimization?.optimizedAt || item?.updatedAt
            ? formatDateTime(item?.avatarOptimization?.optimizedAt || item?.updatedAt)
            : "Khong co"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          {item?.avatar || "Khong co"}
        </Typography>
      </Stack>
    </Paper>
  );
}

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
        result?.started ? "Da kich hoat sweep avatar." : "Sweep dang chay tu luong khac."
      );
      await refetch();
    } catch (runError) {
      showSnack("error", runError?.data?.message || "Khong chay duoc sweep avatar.");
    }
  };

  const handleRunCleanup = async () => {
    try {
      const result = await runCleanup().unwrap();
      showSnack(
        result?.started ? "success" : "info",
        result?.started ? "Da kich hoat don trash." : "Cleanup dang chay tu luong khac."
      );
      await refetch();
    } catch (runError) {
      showSnack("error", runError?.data?.message || "Khong chay duoc cleanup.");
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
                Avatar Optimization
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Theo doi quet nen, chay tay va kiem tra vung trash cho avatar user.
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
                label="Tu lam moi 5 giay"
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                Lam moi
              </Button>
              <Button
                variant="contained"
                startIcon={<AutorenewIcon />}
                onClick={handleRunSweep}
                disabled={isRunningSweepAction || Boolean(sweep?.running)}
              >
                Chay sweep ngay
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CleaningServicesIcon />}
                onClick={handleRunCleanup}
                disabled={isRunningCleanupAction || Boolean(cleanup?.running)}
              >
                Don trash ngay
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
              <Typography color="text.secondary">Dang tai trang thai...</Typography>
            </Paper>
          ) : error ? (
            <Alert severity="error">
              {error?.data?.message || "Khong tai duoc trang thai avatar optimization."}
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
                  label="User co avatar"
                  value={summary.totalAvatarUsers || 0}
                  caption="Tong user dang co gia tri avatar"
                  tone="info"
                />
                <MetricCard
                  label="Dang cho xu ly"
                  value={summary.pendingUsers || 0}
                  caption="Avatar chua sync xong theo trang thai moi nhat"
                  tone="warning"
                />
                <MetricCard
                  label="Da dong bo"
                  value={summary.upToDateUsers || 0}
                  caption="Avatar da duoc danh dau khop voi model hien tai"
                  tone="success"
                />
                <MetricCard
                  label="Avatar toi uu dang dung"
                  value={summary.activeOptimizedUsers || 0}
                  caption="Model user dang tro toi avatar optimized"
                  tone="info"
                />
                <MetricCard
                  label="File trong trash"
                  value={trash.files || 0}
                  caption={`${formatBytes(trash.totalBytes || 0)} dang nam trong _trash`}
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
                        Sweep avatar
                      </Typography>
                      <StatusChip
                        running={Boolean(sweep?.running)}
                        idleLabel="Dang nghi"
                        runningLabel="Dang chay"
                      />
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Lan bat dau: {formatDateTime(sweep?.lastStartedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lan ket thuc: {formatDateTime(sweep?.lastFinishedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Thoi luong: {formatDuration(sweep?.lastDurationMs)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Ly do: {sweep?.lastReason || "Khong co"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Ket qua:{" "}
                        {sweep?.lastResult
                          ? `${sweep.lastResult.processed || 0} user, ${
                              sweep.lastResult.optimized || 0
                            } avatar toi uu`
                          : "Khong co"}
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
                        Cleanup trash
                      </Typography>
                      <StatusChip
                        running={Boolean(cleanup?.running)}
                        idleLabel="Dang nghi"
                        runningLabel="Dang chay"
                      />
                    </Stack>

                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Lan bat dau: {formatDateTime(cleanup?.lastStartedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lan ket thuc: {formatDateTime(cleanup?.lastFinishedAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Thoi luong: {formatDuration(cleanup?.lastDurationMs)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Ket qua:{" "}
                        {cleanup?.lastResult
                          ? `${cleanup.lastResult.removed || 0} file da don`
                          : "Khong co"}
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
                      User cho xu ly
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
                          <UserSampleCard key={item._id} title="Cap nhat user" item={item} />
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="success">Khong con user nao dang cho toi uu.</Alert>
                    )}
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      User vua toi uu
                    </Typography>
                    {samples?.recentOptimized?.length ? (
                      <Stack spacing={1.5}>
                        {samples.recentOptimized.map((item) => (
                          <UserSampleCard key={item._id} title="Toi uu luc" item={item} />
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">Chua co avatar optimized nao de hien thi.</Alert>
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
                      Cau hinh nen
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Nguong dung luong: {formatBytes(config?.sweep?.thresholdBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Canh toi da: {config?.sweep?.maxDimension || 0}px
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Chat luong webp: {config?.sweep?.quality || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tiet kiem toi thieu: {formatBytes(config?.sweep?.minSavedBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Mui gio: {config?.sweep?.timezone || "Khong co"}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Chip
                        size="small"
                        color={config?.sweep?.deleteOriginals ? "warning" : "default"}
                        label={
                          config?.sweep?.deleteOriginals
                            ? "Anh goc se duoc dua vao _trash sau khi model doi sang anh moi"
                            : "Anh goc dang duoc giu lai sau optimize"
                        }
                        sx={{ alignSelf: "flex-start" }}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                      Vung trash avatar
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Thu muc: {trash?.root || "Khong co"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        So file: {trash?.files || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Dung luong: {formatBytes(trash?.totalBytes || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        File cu nhat: {formatDateTime(trash?.oldestFileAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        File moi nhat: {formatDateTime(trash?.newestFileAt)}
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
