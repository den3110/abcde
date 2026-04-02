/* eslint-disable react/prop-types */
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReplayIcon from "@mui/icons-material/Replay";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { toast } from "react-toastify";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import useInfinitePagedQuery from "hooks/useInfinitePagedQuery";
import useInfiniteScrollSentinel from "hooks/useInfiniteScrollSentinel";
import {
  useEnsureFbVodDriveExportMutation,
  useForceLiveRecordingExportMutation,
  useLazyGetFbVodDriveMonitorQuery,
  useRetryLiveRecordingExportMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const PAGE_SIZE = 0;
const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "missing_fallback", label: "Chưa tạo fallback" },
  { value: "failed", label: "Thất bại" },
  { value: "waiting_facebook_vod", label: "Chờ Facebook VOD" },
  { value: "exporting", label: "Đang xử lý" },
  { value: "ready", label: "Sẵn sàng" },
];
const RANGE_OPTIONS = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
];
const STATE_META = {
  missing_fallback: { color: "warning", label: "Chưa tạo fallback" },
  failed: { color: "error", label: "Thất bại" },
  waiting_facebook_vod: { color: "secondary", label: "Chờ Facebook VOD" },
  exporting: { color: "info", label: "Đang xử lý" },
  ready: { color: "success", label: "Sẵn sàng" },
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "-";
}

function formatRelative(value) {
  if (!value) return "-";
  const date = dayjs(value);
  return date.isValid() ? date.fromNow() : "-";
}

function SummaryCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ opacity: 0.72 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.68 }}>
            {hint}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StateChip({ row }) {
  const meta = STATE_META[row.state] || {
    color: "default",
    label: row.stateLabel || row.state || "Unknown",
  };
  return <Chip size="small" color={meta.color} label={row.stateLabel || meta.label} />;
}

function MatchCell({ row }) {
  return (
    <Stack spacing={0.45} sx={{ py: 0.75 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" fontWeight={700}>
          {row.matchCode || "-"}
        </Typography>
        {row.courtLabel ? <Chip size="small" variant="outlined" label={row.courtLabel} /> : null}
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
        {row.participantsLabel || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.74, whiteSpace: "normal" }}>
        {[row.tournamentName, row.bracketName].filter(Boolean).join(" - ") || "-"}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.62 }}>
        Cập nhật: {formatRelative(row.updatedAt)}
      </Typography>
    </Stack>
  );
}

function FacebookCell({ row }) {
  return (
    <Stack spacing={0.45} sx={{ py: 0.75 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
        <Chip size="small" variant="outlined" label={row.facebook?.status || "ENDED"} />
        {row.facebook?.videoId ? (
          <Typography variant="caption" sx={{ opacity: 0.74 }}>
            videoId: {row.facebook.videoId}
          </Typography>
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ opacity: 0.72 }}>
        Ended: {formatDateTime(row.facebook?.endedAt)}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72 }}>
        Next retry: {formatDateTime(row.nextAttemptAt)}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.72 }}>
        Deadline: {formatDateTime(row.deadlineAt)}
      </Typography>
      {row.facebook?.watchUrl ? (
        <Link
          href={row.facebook.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ fontSize: 12, width: "fit-content" }}
        >
          Mở Facebook
        </Link>
      ) : (
        <Typography variant="caption" sx={{ opacity: 0.52 }}>
          Không có link Facebook
        </Typography>
      )}
    </Stack>
  );
}

function ExportCell({ row }) {
  const statusBits = [row.recordingStatus, row.pipelineStage].filter(Boolean).join(" / ");
  return (
    <Stack spacing={0.45} sx={{ py: 0.75 }}>
      <StateChip row={row} />
      <Typography variant="caption" sx={{ opacity: 0.72, whiteSpace: "normal" }}>
        {statusBits || "Chưa có recording fallback"}
      </Typography>
      {row.lastError ? (
        <Typography variant="caption" color="error" sx={{ whiteSpace: "normal" }}>
          {row.lastError}
        </Typography>
      ) : row.pipelineDetail ? (
        <Typography variant="caption" sx={{ opacity: 0.62, whiteSpace: "normal" }}>
          {row.pipelineDetail}
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ opacity: 0.55 }}>
          Không có lỗi gần đây
        </Typography>
      )}
    </Stack>
  );
}

function LinksCell({ row }) {
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ py: 0.75 }}>
      {row.playbackUrl ? (
        <Button
          size="small"
          variant="outlined"
          color="success"
          component="a"
          href={row.playbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
        >
          Playback
        </Button>
      ) : null}
      {row.drivePreviewUrl ? (
        <Button
          size="small"
          variant="outlined"
          component="a"
          href={row.drivePreviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
        >
          Preview
        </Button>
      ) : null}
      {row.driveRawUrl ? (
        <Button
          size="small"
          variant="outlined"
          component="a"
          href={row.driveRawUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
        >
          Raw URL
        </Button>
      ) : null}
      {row.rawStreamUrl ? (
        <Button
          size="small"
          variant="outlined"
          component="a"
          href={row.rawStreamUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
        >
          Raw stream
        </Button>
      ) : null}
      {!row.playbackUrl && !row.drivePreviewUrl && !row.driveRawUrl && !row.rawStreamUrl ? (
        <Typography variant="caption" sx={{ opacity: 0.55 }}>
          Chưa có link Drive
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function FbVodDriveMonitorPage() {
  const socket = useSocket();
  const [socketOn, setSocketOn] = useState(Boolean(socket?.connected));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState("7d");
  const deferredSearch = useDeferredValue(search);
  const [ensuringMatchId, setEnsuringMatchId] = useState(null);
  const [retryingRecordingId, setRetryingRecordingId] = useState(null);
  const [forcingRecordingId, setForcingRecordingId] = useState(null);
  const realtimeTimerRef = useRef(null);
  const lastRealtimeRefetchAtRef = useRef(0);
  const [triggerMonitorQuery] = useLazyGetFbVodDriveMonitorQuery();

  const queryArgs = useMemo(
    () => ({
      range,
      status: statusFilter,
      q: deferredSearch.trim(),
    }),
    [deferredSearch, range, statusFilter]
  );

  const {
    rows,
    summary,
    count: total,
    error: queryError,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    refresh,
  } = useInfinitePagedQuery({
    trigger: triggerMonitorQuery,
    baseArgs: queryArgs,
    pageSize: PAGE_SIZE,
    getRowId: (row) => row?.id,
    pollingInterval: socketOn ? 0 : 15000,
  });
  const sentinelRef = useInfiniteScrollSentinel({
    enabled: true,
    hasMore,
    loading: isInitialLoading || isLoadingMore || isRefreshing,
    onLoadMore: loadMore,
  });

  const [ensureExport] = useEnsureFbVodDriveExportMutation();
  const [retryExport] = useRetryLiveRecordingExportMutation();
  const [forceExport] = useForceLiveRecordingExportMutation();

  const scheduleRealtimeRefetch = useCallback(
    (delayMs = 200) => {
      const now = Date.now();
      const gapMs = Math.max(0, 1500 - (now - lastRealtimeRefetchAtRef.current));
      const waitMs = Math.max(delayMs, gapMs);
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        lastRealtimeRefetchAtRef.current = Date.now();
        void refresh();
      }, waitMs);
    },
    [refresh]
  );

  useEffect(
    () => () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setSocketOn(true);
      try {
        socket.emit("recordings-v2:watch");
        socket.emit("fb-vod-monitor:watch");
      } catch (_) {}
      scheduleRealtimeRefetch(100);
    };
    const handleDisconnect = () => setSocketOn(false);
    const handleUpdate = () => scheduleRealtimeRefetch();

    setSocketOn(Boolean(socket.connected));
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("recordings-v2:update", handleUpdate);
    socket.on("fb-vod-monitor:update", handleUpdate);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      try {
        socket.emit("recordings-v2:unwatch");
        socket.emit("fb-vod-monitor:unwatch");
      } catch (_) {}
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("recordings-v2:update", handleUpdate);
      socket.off("fb-vod-monitor:update", handleUpdate);
    };
  }, [scheduleRealtimeRefetch, socket]);

  const busy = Boolean(ensuringMatchId || retryingRecordingId || forcingRecordingId);

  const handleEnsureExport = async (matchId) => {
    try {
      setEnsuringMatchId(matchId);
      const response = await ensureExport(matchId).unwrap();
      if (response?.skipped) {
        toast.info(response?.message || "Không thể tạo fallback cho trận này.");
      } else if (response?.created) {
        toast.success("Đã tạo fallback recording và xếp hàng export.");
      } else {
        toast.success("Đã xếp hàng lại fallback Facebook VOD.");
      }
      await refresh();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể bootstrap fallback.");
    } finally {
      setEnsuringMatchId(null);
    }
  };

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      toast.success("Đã đưa recording vào hàng đợi retry export.");
      await refresh();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể retry export.");
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExport = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      toast.success("Đã force export ngay.");
      await refresh();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Không thể force export.");
    } finally {
      setForcingRecordingId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "match",
        headerName: "Trận đấu",
        flex: 1.25,
        minWidth: 280,
        sortable: false,
        renderCell: (params) => <MatchCell row={params.row} />,
      },
      {
        field: "facebook",
        headerName: "Facebook VOD",
        flex: 1.05,
        minWidth: 245,
        sortable: false,
        renderCell: (params) => <FacebookCell row={params.row} />,
      },
      {
        field: "exportState",
        headerName: "Trạng thái",
        flex: 0.95,
        minWidth: 230,
        sortable: false,
        renderCell: (params) => <ExportCell row={params.row} />,
      },
      {
        field: "links",
        headerName: "Drive / Playback",
        flex: 1.05,
        minWidth: 260,
        sortable: false,
        renderCell: (params) => <LinksCell row={params.row} />,
      },
      {
        field: "actions",
        headerName: "Tác vụ",
        flex: 1.1,
        minWidth: 290,
        sortable: false,
        renderCell: (params) => {
          const row = params.row;
          const ensuringThisRow = ensuringMatchId === row.matchId;
          const retryingThisRow = retryingRecordingId === row.recordingId;
          const forcingThisRow = forcingRecordingId === row.recordingId;

          return (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ py: 0.75 }}>
              {row.canEnsureExport ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  disabled={busy}
                  onClick={() => handleEnsureExport(row.matchId)}
                  startIcon={
                    ensuringThisRow ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <CloudUploadIcon />
                    )
                  }
                >
                  {ensuringThisRow ? "Đang xử lý..." : "Tạo + xếp hàng"}
                </Button>
              ) : null}
              {row.canRetryExport ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  disabled={busy || !row.recordingId}
                  onClick={() => handleRetryExport(row.recordingId)}
                  startIcon={
                    retryingThisRow ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <ReplayIcon />
                    )
                  }
                >
                  {retryingThisRow ? "Đang retry..." : "Xếp hàng lại"}
                </Button>
              ) : null}
              {row.canForceExport ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  disabled={busy || !row.recordingId}
                  onClick={() => handleForceExport(row.recordingId)}
                  startIcon={
                    forcingThisRow ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <RocketLaunchIcon />
                    )
                  }
                >
                  {forcingThisRow ? "Đang force..." : "Xuất ngay"}
                </Button>
              ) : null}
              {row.facebook?.watchUrl ? (
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  component="a"
                  href={row.facebook.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon />}
                >
                  FB
                </Button>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [busy, ensuringMatchId, forcingRecordingId, retryingRecordingId]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.35}>
              <Typography variant="h4" fontWeight={800}>
                FB VOD {"->"} Drive
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Quản lý các trận chỉ có Facebook VOD và pipeline đưa video hoàn chỉnh lên Drive.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                color={socketOn ? "success" : "default"}
                label={socketOn ? "Socket realtime OK" : "Socket mất kết nối"}
              />
              <Button
                variant="outlined"
                onClick={() => void refresh()}
                disabled={isInitialLoading || isLoadingMore || isRefreshing}
                startIcon={
                  isInitialLoading || isLoadingMore || isRefreshing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
              >
                Làm mới
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Tổng row"
                value={summary.total || 0}
                hint="Số trận FB-only trong phạm vi đã chọn"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Chưa fallback"
                value={summary.missingFallback || 0}
                hint="Cần tạo hoặc bootstrap fallback"
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Chờ Facebook"
                value={summary.waitingFacebookVod || 0}
                hint="Đang đợi VOD Facebook hoàn tất"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Đang xử lý"
                value={summary.exporting || 0}
                hint="Đang export hoặc chờ khung giờ đêm"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Sẵn sàng / Lỗi"
                value={`${summary.ready || 0} / ${summary.failed || 0}`}
                hint="Ready và failed"
                color="success.main"
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", lg: "center" }}
                >
                  <TextField
                    fullWidth
                    label="Tìm kiếm"
                    placeholder="Mã trận, giải đấu, videoId, lỗi..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    select
                    label="Range"
                    value={range}
                    onChange={(event) => setRange(event.target.value)}
                    sx={{ minWidth: 160 }}
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Trạng thái"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    sx={{ minWidth: 220 }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                {queryError ? (
                  <Alert severity="error">
                    {queryError?.data?.message ||
                      queryError?.error ||
                      "Không tải được FB VOD monitor."}
                  </Alert>
                ) : null}

                <Box sx={{ width: "100%" }}>
                  <DataGrid
                    autoHeight
                    disableColumnMenu
                    disableSelectionOnClick
                    rows={rows}
                    columns={columns}
                    loading={isInitialLoading && rows.length === 0}
                    hideFooter
                    getRowHeight={() => "auto"}
                    sx={{
                      border: 0,
                      "& .MuiDataGrid-columnHeaders": {
                        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                      },
                      "& .MuiDataGrid-cell": {
                        alignItems: "flex-start",
                        py: 1,
                      },
                    }}
                  />
                </Box>

                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    Hiển thị {rows.length}/{total} dòng
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.68 }}>
                    {hasMore ? "Kéo xuống để tải thêm" : "Đã tải hết dữ liệu"}
                  </Typography>
                </Stack>

                <Box
                  ref={sentinelRef}
                  sx={{
                    minHeight: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isLoadingMore ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="caption" sx={{ opacity: 0.72 }}>
                        Đang tải thêm dữ liệu...
                      </Typography>
                    </Stack>
                  ) : null}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
