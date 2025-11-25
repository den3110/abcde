// src/pages/admin/parts/FbTokensPage.jsx
/* eslint-disable react/prop-types */
import React, { useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import ErrorIcon from "@mui/icons-material/Error";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WarningIcon from "@mui/icons-material/Warning";
import LinkIcon from "@mui/icons-material/Link";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import {
  useListFbTokensQuery,
  useCheckOneFbTokenMutation,
  useCheckAllFbTokensMutation,
  useMarkNeedsReauthMutation,
  useClearBusyFlagMutation,
  useDisableFbTokenMutation,
  useEnableFbTokenMutation,
} from "slices/fbTokensApiSlice";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

function StatusChip({ code }) {
  const map = {
    OK: { color: "success", label: "OK" },
    UNKNOWN: { color: "default", label: "Chưa rõ" },
    USER_EXPIRED: { color: "warning", label: "User token hết hạn" },
    EXPIRED: { color: "warning", label: "Hết hạn" },
    INVALID: { color: "error", label: "Token lỗi" },
    CHECKPOINT: { color: "error", label: "Checkpoint" },
    MISSING_SCOPES: { color: "warning", label: "Thiếu quyền" },
    NEEDS_REAUTH: { color: "error", label: "Cần reauth" },
    MISSING_PAGE_TOKEN: { color: "error", label: "Thiếu page token" },
    ISSUE: { color: "warning", label: "Có vấn đề" },
    DISABLED: { color: "default", label: "Disabled" }, // ➕ NEW
  };
  const m = map[code] || map.UNKNOWN;
  return <Chip size="small" color={m.color} label={m.label} />;
}

export default function FbTokensPage() {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ busy: "", status: "", enabled: "" });
  const [liveDlg, setLiveDlg] = useState({
    open: false,
    row: null,
    res: null,
    loading: false,
  });

  const { data, isFetching, refetch } = useListFbTokensQuery({ q, ...filters });
  const [checkOne, { isLoading: checkingOne }] = useCheckOneFbTokenMutation();
  const [checkAll, { isLoading: checkingAll }] = useCheckAllFbTokensMutation();
  const [markReauth] = useMarkNeedsReauthMutation();
  const [clearBusy] = useClearBusyFlagMutation();
  const [disablePage, { isLoading: disabling }] = useDisableFbTokenMutation();
  const [enablePage, { isLoading: enabling }] = useEnableFbTokenMutation();

  const rows = data?.rows || [];
  const loading = isFetching || checkingOne || checkingAll || disabling || enabling;

  const copy = useCallback((text) => navigator.clipboard?.writeText(String(text)), []);

  const isNever = useCallback((row) => {
    // ưu tiên computed.hasNever, fallback pageTokenIsNever cho an toàn
    return Boolean(row?.computed?.hasNever ?? row?.pageTokenIsNever);
  }, []);

  const formatPageExpire = useCallback(
    (row) => {
      if (isNever(row)) return "Never";
      const ts = row?.pageTokenExpiresAt;
      if (!ts) return "—";
      return dayjs(ts).fromNow();
    },
    [isNever]
  );

  // ước lượng chiều cao theo số chip tasks để DataGrid đỡ giật khi ảo hoá
  const getEstimatedRowHeight = useCallback((params) => {
    const t = params?.model?.tasks?.length || 0;
    if (t <= 4) return 56;
    if (t <= 8) return 84;
    if (t <= 12) return 112;
    return 140;
  }, []);

  const handleTestLive = useCallback(
    (row) => {
      setLiveDlg({ open: true, row, res: null, loading: true });
      checkOne(row._id)
        .unwrap()
        .then((res) => setLiveDlg((s) => ({ ...s, res, loading: false })))
        .catch((e) =>
          setLiveDlg((s) => ({
            ...s,
            res: { ok: false, error: String(e?.data?.message || e?.message || e) },
            loading: false,
          }))
        );
    },
    [checkOne]
  );

  const columns = useMemo(
    () => [
      {
        field: "pageName",
        headerName: "Page",
        flex: 1.2,
        minWidth: 220,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ overflow: "visible" }}>
            <Typography
              fontWeight={700}
              sx={{
                whiteSpace: "normal",
                lineHeight: 1.2,
                textDecoration: row.disabled ? "line-through" : "none",
                opacity: row.disabled ? 0.8 : 1,
              }}
            >
              {row.pageName || "(no name)"}
            </Typography>
            <IconButton size="small" onClick={() => copy(row.pageName || "")}>
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
            <Tooltip title="Mở Page">
              <IconButton
                size="small"
                onClick={() => window.open(`https://facebook.com/${row.pageId}`, "_blank")}
              >
                <LinkIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
      {
        field: "pageId",
        headerName: "Page ID",
        flex: 0.9,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <code style={{ fontSize: 12, wordBreak: "break-all" }}>{row.pageId}</code>
            <IconButton size="small" onClick={() => copy(row.pageId)}>
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Stack>
        ),
      },
      {
        field: "category",
        headerName: "Category",
        flex: 0.8,
        minWidth: 140,
        valueGetter: ({ row }) => row.category || "—",
      },
      // Tasks: wrap nhiều dòng, không che
      {
        field: "tasks",
        headerName: "Tasks",
        flex: 1.5,
        minWidth: 300,
        sortable: false,
        renderCell: ({ row }) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 0.5 }}>
            {(row.tasks || []).map((t) => (
              <Chip key={t} size="small" label={t} />
            ))}
          </Box>
        ),
      },
      // Status: dùng computed.code + tooltip lastError/lastCheckedAt
      {
        field: "status",
        headerName: "Status",
        flex: 0.9,
        minWidth: 170,
        valueGetter: ({ row }) => row?.computed?.code || "UNKNOWN",
        renderCell: ({ row }) => {
          const code = row?.computed?.code;
          const last = row?.lastCheckedAt ? dayjs(row.lastCheckedAt).fromNow() : null;
          const err = row?.lastError;
          const tip = [
            code ? `Status: ${code}` : "",
            last ? `Last check: ${last}` : "",
            err ? `Error: ${err}` : "",
          ]
            .filter(Boolean)
            .join(" • ");
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <StatusChip code={code} />
              {(row?.lastError || row?.lastCheckedAt) && (
                <Tooltip title={tip}>
                  <ErrorOutlineIcon fontSize="small" sx={{ opacity: 0.7 }} />
                </Tooltip>
              )}
            </Stack>
          );
        },
        sortComparator: (a, b) => String(a).localeCompare(String(b)),
      },
      // Page token (Expire / Never)
      {
        field: "pageTokenExpiresAt",
        headerName: "Page token",
        flex: 1.0,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack spacing={0.5} direction="row" alignItems="center" sx={{ flexWrap: "wrap" }}>
            <Typography variant="body2">Expire: {formatPageExpire(row)}</Typography>
            {isNever(row) && <Chip size="small" color="success" label="Never" />}
          </Stack>
        ),
        valueGetter: ({ row }) => formatPageExpire(row),
      },
      {
        field: "longUserExpiresAt",
        headerName: "User token",
        flex: 0.9,
        minWidth: 140,
        valueGetter: ({ row }) =>
          row.longUserExpiresAt ? dayjs(row.longUserExpiresAt).fromNow() : "—",
      },
      // ➕ NEW: trạng thái Enabled/Disabled
      {
        field: "disabled",
        headerName: "Enabled",
        flex: 0.7,
        minWidth: 130,
        renderCell: ({ row }) =>
          row.disabled ? (
            <Chip size="small" label="Disabled" color="default" />
          ) : (
            <Chip size="small" label="Enabled" color="success" />
          ),
        sortable: false,
      },
      {
        field: "busy",
        headerName: "Busy",
        flex: 0.7,
        minWidth: 120,
        renderCell: ({ row }) =>
          row.isBusy ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WarningIcon color="warning" fontSize="small" />
              <Typography variant="body2">Busy</Typography>
            </Stack>
          ) : (
            "—"
          ),
        sortable: false,
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 260,
        flex: 1.0,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {/* toggle enable/disable */}
            <Tooltip title={row.disabled ? "Enable page" : "Disable page"}>
              <span>
                <IconButton
                  size="small"
                  disabled={loading}
                  onClick={() => {
                    const fn = row.disabled ? enablePage : disablePage;
                    fn(row._id)
                      .unwrap()
                      .then(() => refetch());
                  }}
                >
                  {row.disabled ? (
                    // ❌ đang disable → switch off
                    <ToggleOffIcon fontSize="inherit" sx={{ opacity: 0.8 }} />
                  ) : (
                    // ✅ đang enable → switch on (màu xanh)
                    <ToggleOnIcon fontSize="inherit" color="success" />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            {/* phần còn lại giữ nguyên */}
            <Tooltip title="Check now">
              <span>
                <IconButton
                  size="small"
                  disabled={loading}
                  onClick={() =>
                    checkOne(row._id)
                      .unwrap()
                      .then(() => refetch())
                  }
                >
                  <RefreshIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Đặt cần reauth">
              <IconButton
                size="small"
                onClick={() =>
                  markReauth(row._id)
                    .unwrap()
                    .then(() => refetch())
                }
              >
                <ErrorIcon fontSize="inherit" color="error" />
              </IconButton>
            </Tooltip>
            {row.isBusy && (
              <Tooltip title="Clear busy">
                <IconButton
                  size="small"
                  onClick={() =>
                    clearBusy(row._id)
                      .unwrap()
                      .then(() => refetch())
                  }
                >
                  <CheckCircleIcon fontSize="inherit" color="success" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Test live (không tạo live thật)">
              <span>
                <IconButton size="small" disabled={loading} onClick={() => handleTestLive(row)}>
                  <LiveTvIcon fontSize="inherit" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [
      copy,
      formatPageExpire,
      isNever,
      loading,
      checkOne,
      markReauth,
      clearBusy,
      refetch,
      handleTestLive,
      disablePage,
      enablePage,
    ]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: { xs: 1, md: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Facebook Pages / Tokens
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => refetch()}
            startIcon={<RefreshIcon />}
          >
            Tải lại
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() =>
              checkAll()
                .unwrap()
                .then(() => refetch())
            }
            disabled={checkingAll}
            startIcon={<RefreshIcon />}
          >
            Check all
          </Button>
        </Stack>

        <Paper variant="outlined">
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ p: 1 }}>
            <TextField
              size="small"
              label="Tìm theo pageId / tên"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              fullWidth
            />
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip
                label="Busy"
                color={filters.busy === "1" ? "primary" : "default"}
                onClick={() => setFilters((s) => ({ ...s, busy: s.busy === "1" ? "" : "1" }))}
                variant={filters.busy === "1" ? "filled" : "outlined"}
                size="small"
              />
              <Chip
                label="Not busy"
                color={filters.busy === "0" ? "primary" : "default"}
                onClick={() => setFilters((s) => ({ ...s, busy: s.busy === "0" ? "" : "0" }))}
                variant={filters.busy === "0" ? "filled" : "outlined"}
                size="small"
              />
              <Chip
                label="Status: NEEDS_REAUTH"
                onClick={() =>
                  setFilters((s) => ({
                    ...s,
                    status: s.status === "NEEDS_REAUTH" ? "" : "NEEDS_REAUTH",
                  }))
                }
                color={filters.status === "NEEDS_REAUTH" ? "warning" : "default"}
                variant={filters.status === "NEEDS_REAUTH" ? "filled" : "outlined"}
                size="small"
              />
              {/* ➕ NEW: filter theo enabled/disabled */}
              <Chip
                label="Enabled only"
                color={filters.enabled === "1" ? "primary" : "default"}
                onClick={() =>
                  setFilters((s) => ({
                    ...s,
                    enabled: s.enabled === "1" ? "" : "1",
                  }))
                }
                variant={filters.enabled === "1" ? "filled" : "outlined"}
                size="small"
              />
              <Chip
                label="Disabled only"
                color={filters.enabled === "0" ? "primary" : "default"}
                onClick={() =>
                  setFilters((s) => ({
                    ...s,
                    enabled: s.enabled === "0" ? "" : "0",
                  }))
                }
                variant={filters.enabled === "0" ? "filled" : "outlined"}
                size="small"
              />
            </Stack>
          </Stack>
          <Divider />

          {isFetching && rows.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="info">Đang tải...</Alert>
            </Box>
          ) : (
            <Box sx={{ width: "100%" }}>
              <DataGrid
                rows={rows}
                columns={columns}
                getRowId={(r) => r._id}
                loading={loading}
                autoHeight
                // Hàng tự co giãn theo nội dung
                getRowHeight={() => "auto"}
                getEstimatedRowHeight={getEstimatedRowHeight}
                disableRowSelectionOnClick
                density="compact"
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 25, page: 0 } },
                }}
                getRowClassName={(params) =>
                  params?.row?.disabled ? "fb-token-row--disabled" : ""
                }
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
                }}
                sx={{
                  "& .MuiDataGrid-cell": { alignItems: "flex-start", py: 1 },
                  "& .MuiDataGrid-row": { maxHeight: "fit-content !important" },
                  "& .MuiDataGrid-cellContent": {
                    overflow: "visible",
                    whiteSpace: "normal",
                  },
                  "& .MuiDataGrid-columnHeaders": { fontWeight: 700 },
                  "& .fb-token-row--disabled": {
                    opacity: 0.6,
                  },
                }}
              />
            </Box>
          )}
        </Paper>
      </Box>

      {/* Dialog kết quả Test Live */}
      <Dialog
        open={liveDlg.open}
        onClose={() => setLiveDlg({ open: false, row: null, res: null, loading: false })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Kết quả Test Live — {liveDlg.row?.pageName || liveDlg.row?.pageId}
        </DialogTitle>
        <DialogContent dividers>
          {liveDlg.loading ? (
            <Alert severity="info">Đang kiểm tra…</Alert>
          ) : !liveDlg.res ? (
            <Alert severity="warning">Không có dữ liệu.</Alert>
          ) : liveDlg.res.error ? (
            <Alert severity="error">{liveDlg.res.error}</Alert>
          ) : (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={700}>Status:</Typography>
                <Chip size="small" label={liveDlg.res.status?.code || "UNKNOWN"} />
              </Stack>

              {Array.isArray(liveDlg.res.status?.problems) &&
                liveDlg.res.status.problems.length > 0 && (
                  <Alert severity="warning" sx={{ whiteSpace: "pre-wrap" }}>
                    {liveDlg.res.status.problems.join(" · ")}
                  </Alert>
                )}

              {Array.isArray(liveDlg.res.status?.hints) && liveDlg.res.status.hints.length > 0 && (
                <Alert severity="info" sx={{ whiteSpace: "pre-wrap" }}>
                  {liveDlg.res.status.hints.join(" · ")}
                </Alert>
              )}

              <Divider />

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={700}>Read page:</Typography>
                {liveDlg.res.canRead?.ok ? (
                  <Chip size="small" color="success" label="OK" />
                ) : (
                  <Chip
                    size="small"
                    color="error"
                    label={liveDlg.res.canRead?.reason || "DENIED"}
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={700}>Live capability:</Typography>
                {liveDlg.res.canLive?.ok ? (
                  <Chip size="small" color="success" label="OK" />
                ) : (
                  <Chip
                    size="small"
                    color="error"
                    label={liveDlg.res.canLive?.reason || "DENIED"}
                  />
                )}
              </Stack>

              {!!liveDlg.res.dbgPage && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Token valid: {String(liveDlg.res.dbgPage?.is_valid)} · Expires at:{" "}
                  {liveDlg.res.dbgPage?.expires_at
                    ? new Date(liveDlg.res.dbgPage.expires_at * 1000).toLocaleString()
                    : "—"}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLiveDlg({ open: false, row: null, res: null, loading: false })}>
            Đóng
          </Button>
          {liveDlg.row?._id && (
            <Button variant="outlined" onClick={() => handleTestLive(liveDlg.row)}>
              Test lại
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
