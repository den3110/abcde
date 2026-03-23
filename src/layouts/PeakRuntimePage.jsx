import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  LinearProgress,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useVerifyQuery } from "slices/authApiSlice";
import { useGetPeakRuntimeQuery } from "slices/dashboardApiSlice";
import { isAdminUser } from "utils/authz";

function extractUser(data) {
  if (!data) return null;
  if (data.user && typeof data.user === "object") return data.user;
  return data;
}

function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numeric);
}

function formatReqPerSec(reqPerMin) {
  const numeric = Number(reqPerMin);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric / 60, 2)} req/s`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric, 1)}%`;
}

function formatMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric, numeric >= 100 ? 0 : 1)} ms`;
}

function formatMb(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric, numeric >= 100 ? 0 : 1)} MB`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function severityColor(value, warning, danger) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "default";
  if (numeric >= danger) return "error";
  if (numeric >= warning) return "warning";
  return "success";
}

function SummaryCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Stack spacing={0.6}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

SummaryCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  hint: PropTypes.string,
  color: PropTypes.string,
};

export default function PeakRuntimePage() {
  const { userInfo } = useSelector((state) => state.auth || {});
  const hasLocalSession = Boolean(userInfo?.token);
  const { data: verifyData, isFetching: isVerifying } = useVerifyQuery(undefined, {
    skip: !hasLocalSession,
    refetchOnMountOrArgChange: true,
  });
  const currentUser = useMemo(
    () => extractUser(verifyData) || userInfo || null,
    [verifyData, userInfo]
  );
  const isAllowed = useMemo(() => isAdminUser(currentUser), [currentUser]);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, error, isLoading, isFetching, refetch } = useGetPeakRuntimeQuery(undefined, {
    skip: !isAllowed,
    pollingInterval: autoRefresh ? 10000 : 0,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });

  const runtime = data?.runtime || {};
  const totals = runtime?.totals || {};
  const processInfo = runtime?.process || {};
  const hotPaths = runtime?.hotPaths || {};
  const recordingQueue = data?.recordingExport?.queue || {};
  const recordingWorker = data?.recordingExport?.worker || {};

  const endpointRows = useMemo(
    () =>
      (runtime?.endpoints || []).map((row) => ({
        id: row.key,
        ...row,
      })),
    [runtime?.endpoints]
  );

  const hotPathRows = useMemo(
    () =>
      Object.entries(hotPaths).map(([key, value]) => ({
        id: key,
        key,
        ...value,
      })),
    [hotPaths]
  );

  const endpointColumns = useMemo(
    () => [
      { field: "method", headerName: "Method", width: 90 },
      { field: "path", headerName: "Path", flex: 1, minWidth: 260 },
      {
        field: "reqPerMin",
        headerName: "Req/min",
        width: 110,
        renderCell: ({ value }) => (
          <Typography variant="body2">{formatNumber(value, 2)}</Typography>
        ),
      },
      {
        field: "reqPerSec",
        headerName: "Req/s",
        width: 110,
        sortable: false,
        renderCell: ({ row }) => (
          <Typography variant="body2">{formatReqPerSec(row.reqPerMin)}</Typography>
        ),
      },
      {
        field: "avgMs",
        headerName: "Avg",
        width: 110,
        renderCell: ({ value }) => <Typography variant="body2">{formatMs(value)}</Typography>,
      },
      {
        field: "p95Ms",
        headerName: "P95",
        width: 120,
        renderCell: ({ value }) => (
          <Chip size="small" color={severityColor(value, 700, 1000)} label={formatMs(value)} />
        ),
      },
      {
        field: "errors",
        headerName: "4xx / 5xx",
        width: 120,
        sortable: false,
        renderCell: ({ row }) => (
          <Typography variant="body2">
            {formatNumber(row.errors4xx)} / {formatNumber(row.errors5xx)}
          </Typography>
        ),
      },
    ],
    []
  );

  const hotPathColumns = useMemo(
    () => [
      { field: "key", headerName: "Hot Path", flex: 1, minWidth: 220 },
      {
        field: "reqPerMin",
        headerName: "Req/min",
        width: 110,
        renderCell: ({ value }) => (
          <Typography variant="body2">{formatNumber(value, 2)}</Typography>
        ),
      },
      {
        field: "reqPerSec",
        headerName: "Req/s",
        width: 110,
        sortable: false,
        renderCell: ({ row }) => (
          <Typography variant="body2">{formatReqPerSec(row.reqPerMin)}</Typography>
        ),
      },
      {
        field: "avgMs",
        headerName: "Avg",
        width: 110,
        renderCell: ({ value }) => <Typography variant="body2">{formatMs(value)}</Typography>,
      },
      {
        field: "p95Ms",
        headerName: "P95",
        width: 120,
        renderCell: ({ value }) => (
          <Chip size="small" color={severityColor(value, 700, 1000)} label={formatMs(value)} />
        ),
      },
    ],
    []
  );

  if (!hasLocalSession) {
    return <Navigate to="/authentication/sign-in" replace />;
  }

  if (isVerifying && !extractUser(verifyData) && !isAdminUser(userInfo)) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box py={8} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Peak Runtime
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Hot-path telemetry for the current Node process. Use this page to watch req/min,
                req/s, latency, queue depth, and worker health during live tournaments.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.target.checked)}
                  />
                }
                label="Auto refresh 10s"
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          {error ? (
            <Alert severity="error">
              {error?.data?.message || "Failed to load peak runtime metrics."}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Total Throughput"
                value={formatReqPerSec(totals.reqPerMin)}
                hint={`${formatNumber(totals.reqPerMin, 2)} req/min`}
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Global P95"
                value={formatMs(totals.p95Ms)}
                hint={`Avg ${formatMs(totals.avgMs)} · 4xx ${formatNumber(
                  totals.errors4xx
                )} · 5xx ${formatNumber(totals.errors5xx)}`}
                color={
                  severityColor(totals.p95Ms, 700, 1000) === "error" ? "error.main" : "text.primary"
                }
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Process RSS"
                value={formatMb(processInfo.rssMb)}
                hint={`Heap ${formatMb(processInfo.heapUsedMb)} / ${formatMb(
                  processInfo.heapTotalMb
                )}`}
                color={
                  severityColor(processInfo.rssMb, 700, 800) === "error"
                    ? "error.main"
                    : "warning.main"
                }
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Recording Worker"
                value={String(recordingWorker?.status || "unknown")}
                hint={`Queue waiting ${formatNumber(
                  recordingQueue?.counts?.waiting
                )} · active ${formatNumber(recordingQueue?.counts?.active)}`}
                color={recordingWorker?.alive ? "success.main" : "error.main"}
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  Runtime Health
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Updated
                      </Typography>
                      <Typography variant="body1" fontWeight={700}>
                        {formatDateTime(data?.updatedAt || runtime?.capturedAt)}
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Worker Alive
                      </Typography>
                      <Chip
                        size="small"
                        color={recordingWorker?.alive ? "success" : "error"}
                        label={recordingWorker?.alive ? "alive" : "not alive"}
                      />
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Queue Depth
                      </Typography>
                      <Typography variant="body1" fontWeight={700}>
                        waiting {formatNumber(recordingQueue?.counts?.waiting)} · delayed{" "}
                        {formatNumber(recordingQueue?.counts?.delayed)}
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>

                <Stack spacing={0.75}>
                  <Typography variant="body2" color="text.secondary">
                    Guard rails
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total req/s &gt; 25, hot-path p95 &gt; 700-1000ms, or process RSS &gt; 700-800MB
                    means the box is entering the danger zone. If that happens, scale the recording
                    worker to 0 first and stop opening heavy admin pages.
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (Number(processInfo.rssMb || 0) / 800) * 100)}
                  color={
                    severityColor(processInfo.rssMb, 700, 800) === "error"
                      ? "error"
                      : severityColor(processInfo.rssMb, 700, 800) === "warning"
                      ? "warning"
                      : "primary"
                  }
                  sx={{ height: 8, borderRadius: 999 }}
                />
                <Typography variant="caption" color="text.secondary">
                  RSS budget indicator based on 800MB per API process.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  Hot Paths
                </Typography>
                {isLoading ? (
                  <Stack alignItems="center" py={6} spacing={1.5}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">
                      Loading hot-path runtime data...
                    </Typography>
                  </Stack>
                ) : (
                  <DataGrid
                    autoHeight
                    rows={hotPathRows}
                    columns={hotPathColumns}
                    getRowId={(row) => row.id}
                    disableRowSelectionOnClick
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                      sorting: { sortModel: [{ field: "reqPerMin", sort: "desc" }] },
                    }}
                    sx={{ border: "none" }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  Endpoint Breakdown
                </Typography>
                {isLoading ? (
                  <Stack alignItems="center" py={6} spacing={1.5}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">
                      Loading endpoint metrics...
                    </Typography>
                  </Stack>
                ) : (
                  <DataGrid
                    autoHeight
                    rows={endpointRows}
                    columns={endpointColumns}
                    getRowId={(row) => row.id}
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                      sorting: { sortModel: [{ field: "reqPerMin", sort: "desc" }] },
                    }}
                    sx={{ border: "none" }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
