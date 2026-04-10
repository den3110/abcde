import { useMemo, useState } from "react";
import PropTypes from "prop-types";
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
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useGetObserverOverviewQuery } from "slices/observerAdminApiSlice";

function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numeric);
}

function formatMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatNumber(numeric, numeric >= 100 ? 0 : 1)} ms`;
}

function formatBytes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return "-";
  if (numeric === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1);
  const scaled = numeric / 1024 ** exponent;
  return `${formatNumber(scaled, scaled >= 100 ? 0 : 1)} ${units[exponent]}`;
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

function formatSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (numeric < 60) return `${formatNumber(numeric)} giây`;
  const minutes = Math.floor(numeric / 60);
  const seconds = numeric % 60;
  return `${minutes} phút ${seconds} giây`;
}

function chipColorFromSeverity(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "default";
  if (["critical", "error"].includes(normalized)) return "error";
  if (["warn", "warning", "degraded"].includes(normalized)) return "warning";
  if (["info", "recovering"].includes(normalized)) return "info";
  return "success";
}

function chipColorFromStream(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "default";
  if (normalized === "live") return "success";
  if (["connecting", "reconnecting"].includes(normalized)) return "warning";
  if (["error", "ended", "stopped"].includes(normalized)) return "error";
  return "default";
}

function chipColorFromBackupStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["ok", "done", "completed", "success"].includes(normalized)) return "success";
  if (["running", "pending", "queued"].includes(normalized)) return "warning";
  if (["error", "failed"].includes(normalized)) return "error";
  return "default";
}

function pickText(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function extractEventText(item) {
  const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
  return (
    pickText(
      payload.reasonText,
      payload.message,
      payload.summary,
      payload.error,
      payload.note,
      item?.type
    ) || "-"
  );
}

function MetricCard({ title, value, hint, color = "text.primary" }) {
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

function SectionCard({ title, subtitle, children, action = null }) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            {action}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ObserverEventList({ items = [], emptyText }) {
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {items.map((item) => {
        const payload = item?.payload && typeof item.payload === "object" ? item.payload : {};
        const reasonCode = pickText(payload.reasonCode, item?.type);
        const meta = [
          pickText(payload.deviceId),
          pickText(payload.courtName),
          pickText(payload.matchCode),
        ].filter(Boolean);

        return (
          <Box
            key={item.id}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 1.5,
              backgroundColor: "background.paper",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip size="small" color={chipColorFromSeverity(item?.level)} label={item?.level || "info"} />
                  <Chip size="small" variant="outlined" label={reasonCode || "event"} />
                </Stack>
                <Typography variant="body2" fontWeight={700}>
                  {extractEventText(item)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {meta.length ? meta.join(" • ") : "Không có metadata bổ sung"}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(item?.occurredAt || item?.receivedAt)}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function LiveDeviceGrid({ items = [] }) {
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chưa có heartbeat nào từ app live.
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      {items.map((item) => {
        const batteryLevel = item?.battery?.levelPercent ?? item?.battery?.level;
        const thermalState = pickText(item?.thermal?.state, item?.thermal?.pressure);
        const networkState = pickText(
          item?.network?.effectiveType,
          item?.network?.type,
          item?.network?.transport
        );
        const diagnostics = Array.isArray(item?.diagnostics) ? item.diagnostics : [];
        const warnings = Array.isArray(item?.warnings) ? item.warnings : [];

        return (
          <Grid item xs={12} md={6} xl={4} key={item.id || item.deviceId}>
            <Card sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Stack spacing={1.2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        {pickText(item.deviceName, item.deviceId, "Thiết bị không tên")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pickText(item.platform, "-")} • {pickText(item.deviceModel, "-")}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={item.isOnline ? "success" : "default"}
                      label={item.isOnline ? "Đang online" : "Mất heartbeat"}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      color={chipColorFromStream(item.streamState)}
                      label={pickText(item.streamState, "unknown")}
                    />
                    {item.overlayIssue ? (
                      <Chip size="small" color="error" label={`Overlay: ${item.overlayIssue}`} />
                    ) : (
                      <Chip size="small" color="success" label="Overlay ổn" />
                    )}
                    {item.recoverySeverity ? (
                      <Chip
                        size="small"
                        color={chipColorFromSeverity(item.recoverySeverity)}
                        label={`Recovery: ${item.recoverySeverity}`}
                      />
                    ) : null}
                  </Stack>

                  <Divider />

                  <Stack spacing={0.6}>
                    <Typography variant="body2">
                      <strong>Operator:</strong> {pickText(item.operatorName, item.operatorUserId, "-")}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Sân:</strong> {pickText(item.courtName, item.courtId, "-")}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Trận:</strong> {pickText(item.matchCode, item.matchId, "-")}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Màn hình:</strong> {pickText(item.routeLabel, item.screenState, "-")}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Pin / nhiệt / mạng:</strong>{" "}
                      {batteryLevel !== undefined && batteryLevel !== null
                        ? `${formatNumber(batteryLevel)}%`
                        : "-"}{" "}
                      • {thermalState || "-"} • {networkState || "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Cập nhật cuối:</strong> {formatDateTime(item.lastSeenAt)}
                    </Typography>
                  </Stack>

                  {warnings.length ? (
                    <Box>
                      <Typography variant="caption" color="warning.main" fontWeight={700}>
                        Cảnh báo
                      </Typography>
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {warnings.map((warning) => (
                          <Chip key={warning} size="small" variant="outlined" color="warning" label={warning} />
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  {diagnostics.length ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        Chẩn đoán
                      </Typography>
                      <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                        {diagnostics.slice(0, 4).map((diagnostic) => (
                          <Typography key={diagnostic} variant="caption" color="text.secondary">
                            • {diagnostic}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

MetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  hint: PropTypes.string,
  color: PropTypes.string,
};

SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  action: PropTypes.node,
};

ObserverEventList.propTypes = {
  items: PropTypes.array,
  emptyText: PropTypes.string.isRequired,
};

LiveDeviceGrid.propTypes = {
  items: PropTypes.array,
};

export default function ObserverVpsPage() {
  const [source, setSource] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const queryArgs = useMemo(
    () => ({
      source: source.trim(),
      minutes: Number(minutes || 60),
      onlineOnly,
      deviceLimit: 60,
      deviceEventLimit: 40,
      errorLimit: 24,
    }),
    [minutes, onlineOnly, source]
  );

  const { data, error, isLoading, isFetching, refetch } = useGetObserverOverviewQuery(queryArgs, {
    pollingInterval: autoRefresh ? 10000 : 0,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });

  const health = data?.observerHealth || {};
  const summary = data?.summary || {};
  const runtime = summary?.runtime || {};
  const totals = runtime?.totals || {};
  const processInfo = runtime?.process || {};
  const recordingExport = runtime?.recordingExport || {};
  const recordingQueue = recordingExport?.queue || {};
  const recordingWorker = recordingExport?.worker || {};
  const liveDevices = data?.liveDevices?.items || [];
  const liveCounts = data?.liveDevices?.counts || summary?.liveDevices?.counts || {};
  const deviceEvents = data?.deviceEvents?.items || [];
  const errorEvents = data?.errorEvents?.items || [];
  const backups = summary?.backups || [];
  const eventBuckets = summary?.events?.buckets || [];

  const topEndpoints = useMemo(() => {
    const rows = Array.isArray(runtime?.endpoints) ? [...runtime.endpoints] : [];
    return rows.sort((a, b) => Number(b?.reqPerMin || 0) - Number(a?.reqPerMin || 0)).slice(0, 8);
  }, [runtime?.endpoints]);

  const topHotPaths = useMemo(() => {
    return Object.entries(runtime?.hotPaths || {})
      .map(([key, value]) => ({ key, ...(value || {}) }))
      .sort((a, b) => Number(b?.reqPerMin || 0) - Number(a?.reqPerMin || 0))
      .slice(0, 8);
  }, [runtime?.hotPaths]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", lg: "center" }}
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Observer VPS
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Admin PickleTour đọc dữ liệu từ Observer VPS thông qua server chính. Không cần mở
                dashboard trực tiếp trên VPS nữa.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
              <TextField
                size="small"
                label="Source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Ví dụ: pickletour-api-main"
              />
              <TextField
                size="small"
                select
                label="Cửa sổ"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="15">15 phút</MenuItem>
                <MenuItem value="60">60 phút</MenuItem>
                <MenuItem value="180">3 giờ</MenuItem>
                <MenuItem value="720">12 giờ</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={onlineOnly}
                    onChange={(event) => setOnlineOnly(event.target.checked)}
                  />
                }
                label="Chỉ máy online"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.target.checked)}
                  />
                }
                label="Tự làm mới 10s"
              />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
                Làm mới
              </Button>
            </Stack>
          </Stack>

          {isFetching && data ? <LinearProgress sx={{ borderRadius: 999, height: 6 }} /> : null}

          {error ? (
            <Alert severity="error">
              {error?.data?.message || "Không thể đọc dữ liệu Observer VPS qua server chính."}
            </Alert>
          ) : null}

          {isLoading && !data ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack py={8} spacing={1.5} alignItems="center">
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    Đang tải dữ liệu Observer VPS...
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Observer"
                    value={health?.ok ? "Đã kết nối" : "Chưa rõ"}
                    hint={`Khởi động: ${formatDateTime(health?.startedAt)}`}
                    color={health?.ok ? "success.main" : "warning.main"}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Thiết bị online"
                    value={`${formatNumber(liveCounts?.online)} / ${formatNumber(
                      liveCounts?.total
                    )}`}
                    hint={`${formatNumber(liveCounts?.live)} máy đang live`}
                    color="info.main"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Overlay đang lỗi"
                    value={formatNumber(liveCounts?.overlayIssues)}
                    hint={`${formatNumber(liveCounts?.criticalRecoveries)} recovery mức critical`}
                    color={
                      Number(liveCounts?.overlayIssues || 0) > 0 ? "error.main" : "success.main"
                    }
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Sự kiện gần đây"
                    value={formatNumber(summary?.events?.totalRecentEvents)}
                    hint={`${formatNumber(summary?.events?.errorRecentEvents)} sự kiện lỗi`}
                    color="text.primary"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Req/min"
                    value={formatNumber(totals?.reqPerMin, 2)}
                    hint={`P95 ${formatMs(totals?.p95Ms)}`}
                    color="text.primary"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Process RSS"
                    value={formatBytes((Number(processInfo?.rssMb || 0) || 0) * 1024 * 1024)}
                    hint={`Heap ${formatNumber(processInfo?.heapUsedMb, 1)} / ${formatNumber(
                      processInfo?.heapTotalMb,
                      1
                    )} MB`}
                    color={
                      Number(processInfo?.rssMb || 0) >= 800 ? "error.main" : "warning.main"
                    }
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Queue export"
                    value={`${formatNumber(recordingQueue?.counts?.waiting)} / ${formatNumber(
                      recordingQueue?.counts?.active
                    )}`}
                    hint={`Worker: ${pickText(recordingWorker?.status, "unknown")}`}
                    color={recordingWorker?.alive ? "success.main" : "warning.main"}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <MetricCard
                    title="Snapshot runtime"
                    value={formatDateTime(runtime?.capturedAt)}
                    hint={`Uptime API: ${formatSeconds(processInfo?.uptimeSeconds)}`}
                    color="text.primary"
                  />
                </Grid>
              </Grid>

              <SectionCard
                title="Máy live hiện tại"
                subtitle="Thiết bị đang giữ sân, trạng thái stream, overlay, recovery, pin, nhiệt và chẩn đoán tại hiện trường."
                action={
                  <Chip
                    size="small"
                    color="info"
                    label={`${formatNumber(liveDevices.length)} máy hiển thị`}
                  />
                }
              >
                <LiveDeviceGrid items={liveDevices} />
              </SectionCard>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <SectionCard
                    title="Sự kiện thiết bị"
                    subtitle="Overlay detach, memory pressure, thermal warning, socket stale, recovery stage."
                  >
                    <ObserverEventList
                      items={deviceEvents}
                      emptyText="Chưa có sự kiện thiết bị nào trong khoảng thời gian đang xem."
                    />
                  </SectionCard>
                </Grid>
                <Grid item xs={12} lg={6}>
                  <SectionCard
                    title="Lỗi hệ thống gần đây"
                    subtitle="Các error event mới nhất mà Observer VPS đang lưu."
                  >
                    <ObserverEventList
                      items={errorEvents}
                      emptyText="Chưa có error event nào trong khoảng thời gian đang xem."
                    />
                  </SectionCard>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <SectionCard
                    title="Top endpoint"
                    subtitle="Endpoint có lưu lượng lớn nhất từ snapshot runtime mới nhất."
                  >
                    {topEndpoints.length ? (
                      <Stack spacing={1.2}>
                        {topEndpoints.map((item) => (
                          <Box
                            key={item.key}
                            sx={{
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                              p: 1.5,
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", md: "center" }}
                            >
                              <Box>
                                <Typography variant="body2" fontWeight={700}>
                                  {pickText(item.method, "GET")} {pickText(item.path, "-")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Avg {formatMs(item.avgMs)} • P95 {formatMs(item.p95Ms)} • 4xx{" "}
                                  {formatNumber(item.errors4xx)} • 5xx {formatNumber(item.errors5xx)}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                color="info"
                                label={`${formatNumber(item.reqPerMin, 2)} req/min`}
                              />
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Chưa có snapshot runtime đủ dữ liệu.
                      </Typography>
                    )}
                  </SectionCard>
                </Grid>
                <Grid item xs={12} lg={6}>
                  <SectionCard
                    title="Hot path và backup"
                    subtitle="Nhóm path nóng nhất và metadata backup gần đây từ Observer VPS."
                  >
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                          Hot path
                        </Typography>
                        {topHotPaths.length ? (
                          <Stack spacing={1}>
                            {topHotPaths.map((item) => (
                              <Stack
                                key={item.key}
                                direction={{ xs: "column", md: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                sx={{
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 2,
                                  px: 1.5,
                                  py: 1,
                                }}
                              >
                                <Typography variant="body2" fontWeight={700}>
                                  {item.key}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatNumber(item.reqPerMin, 2)} req/min • P95 {formatMs(item.p95Ms)}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Chưa có hot path nào.
                          </Typography>
                        )}
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                          Backup gần đây
                        </Typography>
                        {backups.length ? (
                          <Stack spacing={1}>
                            {backups.map((item) => (
                              <Box
                                key={item.id}
                                sx={{
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 2,
                                  p: 1.5,
                                }}
                              >
                                <Stack
                                  direction={{ xs: "column", md: "row" }}
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems={{ xs: "flex-start", md: "center" }}
                                >
                                  <Box>
                                    <Typography variant="body2" fontWeight={700}>
                                      {pickText(item.scope, "generic")} •{" "}
                                      {pickText(item.backupType, "backup")}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatDateTime(item.capturedAt)} • {formatBytes(item.sizeBytes)}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    size="small"
                                    color={chipColorFromBackupStatus(item.status)}
                                    label={pickText(item.status, "unknown")}
                                  />
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Chưa có bản ghi backup nào.
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </SectionCard>
                </Grid>
              </Grid>

              <SectionCard
                title="Nhóm sự kiện"
                subtitle="Top bucket theo category, level và type trong cửa sổ đang chọn."
              >
                {eventBuckets.length ? (
                  <Grid container spacing={1.5}>
                    {eventBuckets.map((bucket) => (
                      <Grid item xs={12} md={6} xl={4} key={`${bucket.category}-${bucket.level}-${bucket.type}`}>
                        <Box
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            p: 1.5,
                            height: "100%",
                          }}
                        >
                          <Stack spacing={0.6}>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip size="small" variant="outlined" label={pickText(bucket.category, "generic")} />
                              <Chip size="small" color={chipColorFromSeverity(bucket.level)} label={pickText(bucket.level, "info")} />
                            </Stack>
                            <Typography variant="body2" fontWeight={700}>
                              {pickText(bucket.type, "event")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatNumber(bucket.count)} sự kiện • mới nhất {formatDateTime(bucket.latestAt)}
                            </Typography>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có bucket nào để hiển thị.
                  </Typography>
                )}
              </SectionCard>
            </>
          )}
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
