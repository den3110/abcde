import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
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
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useVerifyQuery } from "slices/authApiSlice";
import {
  useClearAllCachesMutation,
  useClearCacheGroupMutation,
  useGetCacheSummaryQuery,
} from "slices/adminCacheApiSlice";
import { isStrictSuperAdminUser } from "utils/authz";

function extractUser(data) {
  if (!data) return null;
  if (data.user && typeof data.user === "object") return data.user;
  return data;
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatTtl(ttlMs) {
  const value = Number(ttlMs);
  if (!Number.isFinite(value) || value <= 0) return "No TTL";
  if (value < 1000) return `${value} ms`;
  if (value < 60000) return `${Math.round(value / 1000)} s`;
  return `${Math.round(value / 60000)} min`;
}

function formatProcessMb(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0 MB";
  return `${numeric.toFixed(numeric >= 100 ? 0 : 1)} MB`;
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

export default function CacheManagerPage() {
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
  const isAllowed = useMemo(() => isStrictSuperAdminUser(currentUser), [currentUser]);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearingId, setClearingId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const { data, error, isLoading, isFetching, refetch } = useGetCacheSummaryQuery(undefined, {
    skip: !isAllowed,
    pollingInterval: autoRefresh ? 15000 : 0,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });

  const [clearCacheGroup, { isLoading: isClearingGroup }] = useClearCacheGroupMutation();
  const [clearAllCaches, { isLoading: isClearingAll }] = useClearAllCachesMutation();

  const groups = data?.groups || [];
  const totals = data?.totals || {};
  const processInfo = data?.process || {};

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(groups.map((group) => group.category).filter(Boolean)))],
    [groups]
  );
  const scopes = useMemo(
    () => ["ALL", ...Array.from(new Set(groups.map((group) => group.scope).filter(Boolean)))],
    [groups]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups.filter((group) => {
      if (categoryFilter !== "ALL" && group.category !== categoryFilter) return false;
      if (scopeFilter !== "ALL" && group.scope !== scopeFilter) return false;
      if (!keyword) return true;

      const haystack = [group.id, group.label, group.category, group.scope, group.kind]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [groups, search, categoryFilter, scopeFilter]);

  const showSnack = (severity, message) => {
    setSnackbar({ open: true, severity, message });
  };

  const handleClearGroup = async (cacheId) => {
    try {
      setClearingId(cacheId);
      await clearCacheGroup(cacheId).unwrap();
      showSnack("success", `Cleared cache group: ${cacheId}`);
      await refetch();
    } catch (requestError) {
      showSnack("error", requestError?.data?.message || "Failed to clear cache group.");
    } finally {
      setClearingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllCaches().unwrap();
      showSnack("success", "Cleared all registered cache groups.");
      setConfirmOpen(false);
      await refetch();
    } catch (requestError) {
      showSnack("error", requestError?.data?.message || "Failed to clear all cache groups.");
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "label",
        headerName: "Cache Group",
        flex: 1.1,
        minWidth: 260,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.35} sx={{ py: 0.8 }}>
            <Typography variant="body2" fontWeight={700}>
              {row.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.id}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "meta",
        headerName: "Category / Scope",
        minWidth: 220,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" sx={{ py: 0.8 }}>
            <Chip size="small" variant="outlined" label={row.category || "-"} />
            <Chip size="small" variant="outlined" label={row.scope || "-"} />
            <Chip size="small" variant="outlined" color="info" label={row.kind || "-"} />
          </Stack>
        ),
      },
      {
        field: "ttlMs",
        headerName: "TTL",
        minWidth: 110,
        renderCell: ({ row }) => (
          <Typography variant="body2" sx={{ py: 0.8 }}>
            {formatTtl(row.ttlMs)}
          </Typography>
        ),
      },
      {
        field: "entries",
        headerName: "Entries",
        minWidth: 100,
        renderCell: ({ row }) => (
          <Typography variant="body2" fontWeight={700} sx={{ py: 0.8 }}>
            {formatNumber(row.entries)}
          </Typography>
        ),
      },
      {
        field: "traffic",
        headerName: "Hits / Misses",
        minWidth: 160,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 0.8 }}>
            <Typography variant="body2" fontWeight={700}>
              {formatNumber(row.hits)} / {formatNumber(row.misses)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last hit: {formatDateTime(row.lastHitAt)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "timeline",
        headerName: "Last Set / Clear",
        minWidth: 200,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 0.8 }}>
            <Typography variant="caption" color="text.secondary">
              Set: {formatDateTime(row.lastSetAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Clear: {formatDateTime(row.lastClearAt)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "actions",
        headerName: "Action",
        minWidth: 150,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Tooltip title={`Clear ${row.id}`}>
            <span>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={
                  isClearingGroup && clearingId === row.id ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <CleaningServicesIcon />
                  )
                }
                disabled={isClearingAll || (isClearingGroup && clearingId !== row.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  handleClearGroup(row.id);
                }}
              >
                {isClearingGroup && clearingId === row.id ? "Clearing..." : "Clear"}
              </Button>
            </span>
          </Tooltip>
        ),
      },
    ],
    [clearingId, isClearingAll, isClearingGroup]
  );

  if (!hasLocalSession) {
    return <Navigate to="/authentication/sign-in" replace />;
  }

  if (isVerifying && !extractUser(verifyData) && !isStrictSuperAdminUser(userInfo)) {
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
                Cache Manager
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Inspect and clear in-memory application caches only. This page does not manage
                Cloudflare, nginx, or Redis caches.
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
                label="Auto refresh 15s"
              />
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                Refresh
              </Button>
              <Button
                color="warning"
                variant="contained"
                startIcon={<DeleteSweepIcon />}
                onClick={() => setConfirmOpen(true)}
                disabled={isClearingAll || isClearingGroup || groups.length === 0}
              >
                Clear all
              </Button>
            </Stack>
          </Stack>

          {error ? (
            <Alert severity="error">
              {error?.data?.message || "Failed to load cache registry summary."}
            </Alert>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Groups"
                value={formatNumber(totals.groups)}
                hint={`${formatNumber(totals.activeGroups)} active groups`}
                color="info.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Entries"
                value={formatNumber(totals.entries)}
                hint="Total in-memory cache entries"
                color="text.primary"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Hits / Misses"
                value={`${formatNumber(totals.hits)} / ${formatNumber(totals.misses)}`}
                hint={`Updated ${formatDateTime(data?.updatedAt)}`}
                color="success.main"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <SummaryCard
                title="Process"
                value={`PID ${processInfo.pid || "-"}`}
                hint={`RSS ${formatProcessMb(processInfo.rssMb)} · Heap ${formatProcessMb(
                  processInfo.heapUsedMb
                )}`}
                color="warning.main"
              />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      label="Search cache group"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="id, label, category, scope..."
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      select
                      fullWidth
                      label="Category"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                    >
                      {categories.map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      select
                      fullWidth
                      label="Scope"
                      value={scopeFilter}
                      onChange={(event) => setScopeFilter(event.target.value)}
                    >
                      {scopes.map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Stack
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        bgcolor: "grey.100",
                        px: 1.5,
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Uptime
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {formatNumber(processInfo.uptimeSeconds)} s
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>

                {isLoading ? (
                  <Stack alignItems="center" py={6} spacing={1.5}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">
                      Loading cache registry...
                    </Typography>
                  </Stack>
                ) : (
                  <DataGrid
                    autoHeight
                    rows={filteredRows}
                    columns={columns}
                    getRowId={(row) => row.id}
                    getRowHeight={() => "auto"}
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10, page: 0 } },
                      sorting: { sortModel: [{ field: "entries", sort: "desc" }] },
                    }}
                    sx={{
                      border: "none",
                      "& .MuiDataGrid-cell": {
                        alignItems: "stretch",
                        py: 1,
                      },
                    }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Clear all cache groups</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This clears every registered in-memory cache group in the current Node process. It will
            not clear Cloudflare, nginx, or Redis.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isClearingAll}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            onClick={handleClearAll}
            disabled={isClearingAll}
            startIcon={isClearingAll ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {isClearingAll ? "Clearing..." : "Clear all"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2800}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
