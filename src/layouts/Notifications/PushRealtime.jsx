import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import HubIcon from "@mui/icons-material/Hub";
import NotificationImportantIcon from "@mui/icons-material/NotificationImportant";
import { DataGrid } from "@mui/x-data-grid";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useSocket } from "context/SocketContext";
import {
  useGetPushDispatchSummaryQuery,
  useGetPushDispatchesQuery,
  useLazyGetPushDispatchByIdQuery,
} from "slices/pushDispatchApiSlice";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatRelativeTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const suffix = diffMs >= 0 ? "ago" : "from now";
  const diffMinutes = Math.round(Math.abs(diffMs) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ${suffix}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${suffix}`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ${suffix}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function SummaryCard({ title, value, hint, color = "text.primary" }) {
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ opacity: 0.72 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.64 }}>
            {hint}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status }) {
  const colorMap = {
    queued: "warning",
    running: "info",
    completed: "success",
    failed: "error",
    skipped: "default",
  };
  return <Chip size="small" color={colorMap[status] || "default"} label={status || "unknown"} />;
}

function SourceChip({ sourceKind }) {
  const colorMap = {
    admin_broadcast: "primary",
    admin_direct: "secondary",
    system_event: "default",
  };
  return (
    <Chip
      size="small"
      variant="outlined"
      color={colorMap[sourceKind] || "default"}
      label={sourceKind || "unknown"}
    />
  );
}

function KeyValueList({ title, rows = [] }) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Stack spacing={1.2}>
          <Typography variant="h6" fontWeight={800}>
            {title}
          </Typography>
          {rows.length ? (
            rows.map((row) => (
              <Stack
                key={`${title}-${row.label}`}
                direction="row"
                justifyContent="space-between"
                spacing={2}
              >
                <Typography variant="body2" sx={{ opacity: 0.72 }}>
                  {row.label}
                </Typography>
                <Typography variant="body2" fontWeight={700} textAlign="right">
                  {row.value}
                </Typography>
              </Stack>
            ))
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.64 }}>
              No data
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function JsonCard({ title, value }) {
  return (
    <Card sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Stack spacing={1.2}>
          <Typography variant="h6" fontWeight={800}>
            {title}
          </Typography>
          <Box
            component="pre"
            sx={{
              mb: 0,
              p: 1.5,
              borderRadius: 2,
              bgcolor: "grey.100",
              overflow: "auto",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(value || {}, null, 2)}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PushRealtimePage() {
  const socket = useSocket();
  const [socketState, setSocketState] = useState(socket?.connected ? "connected" : "idle");
  const [lastSocketAt, setLastSocketAt] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    sourceKind: "",
    eventName: "",
    platform: "",
    from: "",
    to: "",
  });
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState("");

  const queryArgs = useMemo(
    () => ({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sourceKind ? { sourceKind: filters.sourceKind } : {}),
      ...(filters.eventName ? { eventName: filters.eventName.trim() } : {}),
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    }),
    [filters, paginationModel]
  );

  const {
    data: summary,
    isFetching: isFetchingSummary,
    refetch: refetchSummary,
  } = useGetPushDispatchSummaryQuery();
  const {
    data: dispatches,
    isFetching: isFetchingList,
    refetch: refetchList,
  } = useGetPushDispatchesQuery(queryArgs);
  const [loadDetail, { data: detail, isFetching: isFetchingDetail }] =
    useLazyGetPushDispatchByIdQuery();

  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;

    const queueRefresh = (payload = {}) => {
      if (timer) clearTimeout(timer);
      setLastSocketAt(payload?.ts || new Date().toISOString());
      timer = setTimeout(() => {
        refetchSummary();
        refetchList();
        if (selectedDispatchId) {
          loadDetail(selectedDispatchId, true);
        }
      }, 250);
    };

    const handleConnect = () => {
      setSocketState("connected");
      socket.emit("push-monitor:watch");
    };

    const handleDisconnect = () => {
      setSocketState("disconnected");
    };

    const handleUpdate = (payload) => {
      setSocketState(socket.connected ? "connected" : "disconnected");
      queueRefresh(payload);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("push-monitor:update", handleUpdate);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (timer) clearTimeout(timer);
      socket.emit("push-monitor:unwatch");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("push-monitor:update", handleUpdate);
    };
  }, [socket, refetchSummary, refetchList, loadDetail, selectedDispatchId]);

  const handleRefresh = () => {
    refetchSummary();
    refetchList();
    if (selectedDispatchId) {
      loadDetail(selectedDispatchId, true);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDispatchId("");
  };

  const handleFilterChange = (name, value) => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const rows = (dispatches?.items || []).map((item) => ({
    id: item._id,
    ...item,
    title: item?.payload?.title || "",
    createdAtText: formatDateTime(item.createdAt),
    progressPercent:
      Number(item?.progress?.totalTokens || 0) > 0
        ? Math.round(
            (Number(item?.progress?.processedTokens || 0) /
              Number(item?.progress?.totalTokens || 1)) *
              100
          )
        : 0,
  }));

  const columns = [
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      renderCell: ({ row }) => (
        <Stack sx={{ py: 0.8 }}>
          <Typography variant="body2" fontWeight={700}>
            {row.createdAtText}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.64 }}>
            {formatRelativeTime(row.createdAt)}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    {
      field: "sourceKind",
      headerName: "Source",
      minWidth: 150,
      renderCell: ({ value }) => <SourceChip sourceKind={value} />,
    },
    {
      field: "eventName",
      headerName: "Event",
      minWidth: 190,
      flex: 1,
    },
    {
      field: "title",
      headerName: "Title",
      minWidth: 220,
      flex: 1.2,
    },
    {
      field: "audience",
      headerName: "Audience",
      minWidth: 130,
      renderCell: ({ row }) => formatNumber(row?.target?.audienceCount || 0),
    },
    {
      field: "tokens",
      headerName: "Tokens",
      minWidth: 110,
      renderCell: ({ row }) => formatNumber(row?.summary?.tokens || 0),
    },
    {
      field: "progress",
      headerName: "Progress",
      minWidth: 210,
      flex: 1,
      renderCell: ({ row }) => (
        <Stack spacing={0.7} sx={{ width: "100%", py: 0.8 }}>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, Number(row.progressPercent || 0)))}
            sx={{ height: 8, borderRadius: 999 }}
          />
          <Typography variant="caption" sx={{ opacity: 0.72 }}>
            {formatNumber(row?.progress?.processedTokens || 0)} /{" "}
            {formatNumber(row?.progress?.totalTokens || 0)} tokens
          </Typography>
        </Stack>
      ),
    },
  ];

  const tokenPlatformRows = Object.entries(summary?.tokens?.byPlatform || {}).map(
    ([platform, stats]) => ({
      label: platform,
      value: `${formatNumber(stats?.enabled || 0)} enabled / ${formatNumber(
        stats?.disabled || 0
      )} disabled / ${formatNumber(stats?.active24h || 0)} active 24h`,
    })
  );

  const topVersionRows = (summary?.tokens?.byVersion || []).slice(0, 8).map((item) => ({
    label: `${item.platform} ${item.appVersion}`,
    value: `${formatNumber(item.enabled)} enabled / ${formatNumber(item.total)} total`,
  }));

  const topErrorRows = (summary?.topTokenErrors || []).map((item) => ({
    label: item.error,
    value: formatNumber(item.count),
  }));

  const detailSummaryRows = detail
    ? [
        { label: "Tokens", value: formatNumber(detail?.summary?.tokens || 0) },
        { label: "Ticket OK", value: formatNumber(detail?.summary?.ticketOk || 0) },
        { label: "Ticket Error", value: formatNumber(detail?.summary?.ticketError || 0) },
        { label: "Receipt OK", value: formatNumber(detail?.summary?.receiptOk || 0) },
        { label: "Receipt Error", value: formatNumber(detail?.summary?.receiptError || 0) },
        {
          label: "Disabled Tokens",
          value: formatNumber(detail?.summary?.disabledTokens || 0),
        },
      ]
    : [];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Stack spacing={2}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={2}
              >
                <Stack spacing={0.6}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HubIcon color="primary" />
                    <Typography variant="h5" fontWeight={800}>
                      Push Realtime
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ opacity: 0.72 }}>
                    Monitor all server-side Expo push dispatches, including admin sends and
                    system events.
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    color={socketState === "connected" ? "success" : "warning"}
                    label={`Socket ${socketState}`}
                  />
                  <Typography variant="caption" sx={{ opacity: 0.72 }}>
                    Last event: {lastSocketAt ? formatDateTime(lastSocketAt) : "-"}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={isFetchingSummary || isFetchingList}
                  >
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Dispatch 24h"
                value={formatNumber(summary?.dispatches?.last24h?.total || 0)}
                hint={`completed ${formatNumber(summary?.dispatches?.last24h?.completed || 0)} / failed ${formatNumber(summary?.dispatches?.last24h?.failed || 0)}`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Dispatch 7d"
                value={formatNumber(summary?.dispatches?.last7d?.total || 0)}
                hint={`skipped ${formatNumber(summary?.dispatches?.last7d?.skipped || 0)} / queued ${formatNumber(summary?.dispatches?.queued || 0)}`}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Running"
                value={formatNumber(summary?.dispatches?.running || 0)}
                hint="currently active dispatches"
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Enabled Tokens"
                value={formatNumber(summary?.tokens?.enabled || 0)}
                hint={`disabled ${formatNumber(summary?.tokens?.disabled || 0)} / active 24h ${formatNumber(summary?.tokens?.active24h || 0)}`}
                color="success.main"
              />
            </Grid>
          </Grid>

          {isFetchingSummary ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <KeyValueList
                title="Running Dispatches"
                rows={(summary?.runningDispatches || []).map((item) => ({
                  label: `${item.sourceKind} / ${item.eventName}`,
                  value: `${item.title || "-"} (${formatNumber(
                    item?.progress?.processedTokens || 0
                  )}/${formatNumber(item?.progress?.totalTokens || 0)})`,
                }))}
              />
            </Grid>
            <Grid item xs={12} md={3.5}>
              <KeyValueList title="Token Health By Platform" rows={tokenPlatformRows} />
            </Grid>
            <Grid item xs={12} md={3.5}>
              <KeyValueList title="Top Token Errors" rows={topErrorRows} />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <KeyValueList title="Top App Versions" rows={topVersionRows} />
            </Grid>
            <Grid item xs={12} md={6}>
              <KeyValueList
                title="Inactive Tokens"
                rows={[
                  {
                    label: "Active 7d",
                    value: formatNumber(summary?.tokens?.active7d || 0),
                  },
                  {
                    label: "Inactive > 7d",
                    value: formatNumber(summary?.tokens?.inactive?.olderThan7d || 0),
                  },
                  {
                    label: "Inactive > 30d",
                    value: formatNumber(summary?.tokens?.inactive?.olderThan30d || 0),
                  },
                ]}
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={800}>
                      Dispatch History
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.72 }}>
                      Filter by source, status, event, platform, and time range.
                    </Typography>
                  </Stack>
                </Stack>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="Status"
                      value={filters.status}
                      onChange={(e) => handleFilterChange("status", e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="queued">queued</MenuItem>
                      <MenuItem value="running">running</MenuItem>
                      <MenuItem value="completed">completed</MenuItem>
                      <MenuItem value="failed">failed</MenuItem>
                      <MenuItem value="skipped">skipped</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="Source"
                      value={filters.sourceKind}
                      onChange={(e) => handleFilterChange("sourceKind", e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="system_event">system_event</MenuItem>
                      <MenuItem value="admin_broadcast">admin_broadcast</MenuItem>
                      <MenuItem value="admin_direct">admin_direct</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="Platform"
                      value={filters.platform}
                      onChange={(e) => handleFilterChange("platform", e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="ios">ios</MenuItem>
                      <MenuItem value="android">android</MenuItem>
                      <MenuItem value="web">web</MenuItem>
                      <MenuItem value="unknown">unknown</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2.5}>
                    <TextField
                      fullWidth
                      label="Event Name"
                      value={filters.eventName}
                      onChange={(e) => handleFilterChange("eventName", e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.75}>
                    <TextField
                      fullWidth
                      type="date"
                      label="From"
                      value={filters.from}
                      onChange={(e) => handleFilterChange("from", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={1.75}>
                    <TextField
                      fullWidth
                      type="date"
                      label="To"
                      value={filters.to}
                      onChange={(e) => handleFilterChange("to", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ height: 640 }}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    loading={isFetchingList}
                    disableRowSelectionOnClick
                    paginationMode="server"
                    rowCount={dispatches?.total || 0}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onRowClick={(params) => {
                      setSelectedDispatchId(params.row.id);
                      setDetailOpen(true);
                      loadDetail(params.row.id);
                    }}
                    sx={{
                      border: 0,
                      "& .MuiDataGrid-cell": { alignItems: "center" },
                    }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Dialog open={detailOpen} onClose={handleCloseDetail} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationImportantIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>
                Dispatch Detail
              </Typography>
              {detail ? <StatusChip status={detail.status} /> : null}
            </Stack>
            <Typography variant="body2" sx={{ opacity: 0.72 }}>
              {detail?._id || selectedDispatchId || "-"}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {isFetchingDetail ? <LinearProgress sx={{ borderRadius: 999, mb: 2 }} /> : null}
          {detail ? (
            <Stack spacing={2}>
              <Alert severity={detail.status === "failed" ? "error" : "info"}>
                {detail.eventName} from {detail.sourceKind} at {formatDateTime(detail.createdAt)}
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <KeyValueList title="Summary" rows={detailSummaryRows} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <KeyValueList
                    title="Progress"
                    rows={[
                      {
                        label: "Processed Tokens",
                        value: `${formatNumber(
                          detail?.progress?.processedTokens || 0
                        )} / ${formatNumber(detail?.progress?.totalTokens || 0)}`,
                      },
                      {
                        label: "Processed Batches",
                        value: `${formatNumber(
                          detail?.progress?.processedBatches || 0
                        )} / ${formatNumber(detail?.progress?.totalBatches || 0)}`,
                      },
                      {
                        label: "Last Progress",
                        value: formatDateTime(detail?.lastProgressAt),
                      },
                    ]}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <KeyValueList
                    title="Target"
                    rows={[
                      { label: "Scope", value: detail?.target?.scope || "-" },
                      { label: "Topic Type", value: detail?.target?.topicType || "-" },
                      { label: "Topic Id", value: detail?.target?.topicId || "-" },
                      { label: "User Id", value: detail?.target?.userId || "-" },
                      {
                        label: "Audience Count",
                        value: formatNumber(detail?.target?.audienceCount || 0),
                      },
                    ]}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <JsonCard title="Payload" value={detail?.payload || {}} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <JsonCard title="Filters" value={detail?.target?.filters || {}} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <JsonCard title="Context" value={detail?.context || {}} />
                </Grid>
              </Grid>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <JsonCard
                    title="Error Breakdown"
                    value={detail?.summary?.errorBreakdown || {}}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <JsonCard title="Sample Failures" value={detail?.sampleFailures || []} />
                </Grid>
              </Grid>
            </Stack>
          ) : (
            <Alert severity="info">Select a dispatch to inspect details.</Alert>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
