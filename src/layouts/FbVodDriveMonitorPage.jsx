/* eslint-disable react/prop-types */
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  Pagination,
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
import {
  useEnsureFbVodDriveExportMutation,
  useForceLiveRecordingExportMutation,
  useGetFbVodDriveMonitorQuery,
  useRetryLiveRecordingExportMutation,
} from "slices/liveApiSlice";

dayjs.extend(relativeTime);

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "all", label: "Tat ca" },
  { value: "missing_fallback", label: "Chua tao fallback" },
  { value: "failed", label: "That bai" },
  { value: "waiting_facebook_vod", label: "Cho Facebook VOD" },
  { value: "exporting", label: "Dang xu ly" },
  { value: "ready", label: "San sang" },
];
const RANGE_OPTIONS = [
  { value: "7d", label: "7 ngay" },
  { value: "30d", label: "30 ngay" },
  { value: "all", label: "Tat ca" },
];
const STATE_META = {
  missing_fallback: { color: "warning", label: "Chua tao fallback" },
  failed: { color: "error", label: "That bai" },
  waiting_facebook_vod: { color: "secondary", label: "Cho Facebook VOD" },
  exporting: { color: "info", label: "Dang xu ly" },
  ready: { color: "success", label: "San sang" },
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
        Cap nhat: {formatRelative(row.updatedAt)}
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
          Mo Facebook
        </Link>
      ) : (
        <Typography variant="caption" sx={{ opacity: 0.52 }}>
          Khong co link Facebook
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
        {statusBits || "Chua co recording fallback"}
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
          Khong co loi gan day
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
          Chua co link Drive
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function FbVodDriveMonitorPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState("7d");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const [ensuringMatchId, setEnsuringMatchId] = useState(null);
  const [retryingRecordingId, setRetryingRecordingId] = useState(null);
  const [forcingRecordingId, setForcingRecordingId] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, range, statusFilter]);

  const queryArgs = useMemo(
    () => ({
      range,
      status: statusFilter,
      q: deferredSearch.trim(),
      page,
      limit: PAGE_SIZE,
    }),
    [deferredSearch, page, range, statusFilter]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useGetFbVodDriveMonitorQuery(
    queryArgs,
    {
      pollingInterval: 15000,
      refetchOnMountOrArgChange: true,
    }
  );

  const [ensureExport] = useEnsureFbVodDriveExportMutation();
  const [retryExport] = useRetryLiveRecordingExportMutation();
  const [forceExport] = useForceLiveRecordingExportMutation();

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const summary = data?.summary || {};
  const pageCount = Math.max(1, Number(data?.pages || 1));
  const total = Number(data?.count || 0);
  const busy = Boolean(ensuringMatchId || retryingRecordingId || forcingRecordingId);

  const handleEnsureExport = async (matchId) => {
    try {
      setEnsuringMatchId(matchId);
      const response = await ensureExport(matchId).unwrap();
      if (response?.skipped) {
        toast.info(response?.message || "Khong the tao fallback cho tran nay.");
      } else if (response?.created) {
        toast.success("Da tao fallback recording va xep hang export.");
      } else {
        toast.success("Da xep hang lai fallback Facebook VOD.");
      }
      refetch();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Khong the bootstrap fallback.");
    } finally {
      setEnsuringMatchId(null);
    }
  };

  const handleRetryExport = async (recordingId) => {
    try {
      setRetryingRecordingId(recordingId);
      await retryExport(recordingId).unwrap();
      toast.success("Da dua recording vao hang doi retry export.");
      refetch();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Khong the retry export.");
    } finally {
      setRetryingRecordingId(null);
    }
  };

  const handleForceExport = async (recordingId) => {
    try {
      setForcingRecordingId(recordingId);
      await forceExport(recordingId).unwrap();
      toast.success("Da force export ngay.");
      refetch();
    } catch (apiError) {
      toast.error(apiError?.data?.message || apiError?.error || "Khong the force export.");
    } finally {
      setForcingRecordingId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "match",
        headerName: "Tran dau",
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
        headerName: "Trang thai",
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
        headerName: "Tac vu",
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
                  {ensuringThisRow ? "Dang xu ly..." : "Tao + xep hang"}
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
                  {retryingThisRow ? "Dang retry..." : "Xep hang lai"}
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
                  {forcingThisRow ? "Dang force..." : "Xuat ngay"}
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
                Quan ly cac tran chi co Facebook VOD va pipeline dua video hoan chinh len Drive.
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              disabled={isFetching}
              startIcon={
                isFetching ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
              }
            >
              Lam moi
            </Button>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Tong row"
                value={summary.total || 0}
                hint="So tran FB-only trong pham vi da chon"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Chua fallback"
                value={summary.missingFallback || 0}
                hint="Can tao hoac bootstrap fallback"
                color="warning.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Cho Facebook"
                value={summary.waitingFacebookVod || 0}
                hint="Dang doi VOD Facebook hoan tat"
                color="secondary.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="Dang xu ly"
                value={summary.exporting || 0}
                hint="Dang export hoac cho khung gio dem"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={3}>
              <SummaryCard
                title="San sang / Loi"
                value={`${summary.ready || 0} / ${summary.failed || 0}`}
                hint="Ready va failed"
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
                    label="Tim kiem"
                    placeholder="Ma tran, giai dau, videoId, loi..."
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
                    label="Trang thai"
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

                {isError ? (
                  <Alert severity="error">
                    {error?.data?.message || error?.error || "Khong tai duoc FB VOD monitor."}
                  </Alert>
                ) : null}

                <Box sx={{ width: "100%" }}>
                  <DataGrid
                    autoHeight
                    disableColumnMenu
                    disableSelectionOnClick
                    rows={rows}
                    columns={columns}
                    loading={isLoading || isFetching}
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
                    {total} row - page {page}/{pageCount}
                  </Typography>
                  <Pagination
                    color="primary"
                    page={page}
                    count={pageCount}
                    onChange={(_, nextPage) => setPage(nextPage)}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}
