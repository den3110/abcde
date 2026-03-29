import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Android,
  Apple,
  BugReport,
  CheckCircle,
  Delete,
  Download,
  MoreVert,
  Refresh,
  Storage,
} from "@mui/icons-material";
import {
  useDeactivateOtaVersionMutation,
  useGetOtaAnalyticsQuery,
  useGetOtaVersionsQuery,
} from "../../slices/otaApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import AnalyticsChart from "./components/AnalyticsChart";
import FailedUpdatesTable from "./components/FailedUpdatesTable";
import TestUpdateModal from "./components/TestUpdateModal";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (num) => new Intl.NumberFormat("vi-VN").format(Number(num) || 0);

const truncateMiddle = (value, head = 10, tail = 8) => {
  const text = String(value || "");
  if (!text) return "-";
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
};

const StatsCard = ({ title, value, icon, subtitle }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <Box
          sx={{
            bgcolor: "action.hover",
            borderRadius: 2,
            p: 1,
            display: "flex",
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

StatsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.node,
  subtitle: PropTypes.string,
};

const DetailRow = ({ label, value, mono = false }) => (
  <Box py={1.25}>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-word",
      }}
    >
      {value || "-"}
    </Typography>
  </Box>
);

DetailRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  mono: PropTypes.bool,
};

const VersionActions = ({ version, onDeactivate, isLoading }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleDeactivate = () => {
    handleMenuClose();
    onDeactivate(version.bundleId);
  };

  if (!version.enabled) {
    return null;
  }

  return (
    <>
      <IconButton size="small" onClick={handleMenuOpen} disabled={isLoading}>
        <MoreVert />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleDeactivate} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Tắt bundle này</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

VersionActions.propTypes = {
  version: PropTypes.object.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default function OTAAdminPage() {
  const [platform, setPlatform] = useState("android");
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [selectedBundle, setSelectedBundle] = useState(null);

  const {
    data: versions = [],
    isLoading: versionsLoading,
    refetch: refetchVersions,
  } = useGetOtaVersionsQuery(platform);

  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useGetOtaAnalyticsQuery({
    platform,
    days: analyticsDays,
  });

  const [deactivate, { isLoading: deactivateLoading }] = useDeactivateOtaVersionMutation();

  const handlePlatformChange = (_, newPlatform) => {
    if (newPlatform) setPlatform(newPlatform);
  };

  const handleDeactivate = async (bundleId) => {
    if (!window.confirm(`Bạn có chắc muốn tắt bundle ${bundleId}?`)) {
      return;
    }

    try {
      await deactivate({ platform, bundleId }).unwrap();
    } catch (error) {
      console.error("Deactivate failed:", error);
    }
  };

  const handleRefresh = () => {
    refetchVersions();
    refetchAnalytics();
  };

  const columns = [
    {
      field: "bundleId",
      headerName: "Bundle ID",
      minWidth: 240,
      flex: 1.15,
      renderCell: (params) => (
        <Box py={0.5}>
          <Typography fontWeight="medium" fontFamily="monospace">
            {truncateMiddle(params.value, 12, 8)}
          </Typography>
          <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
            {params.row.isLatest ? <Chip label="Mới nhất" size="small" color="success" /> : null}
            {params.row.shouldForceUpdate ? (
              <Chip label="Force update" size="small" color="error" variant="outlined" />
            ) : null}
          </Box>
        </Box>
      ),
    },
    {
      field: "targetAppVersion",
      headerName: "App đích",
      width: 140,
      renderCell: (params) => <Chip label={params.value || "-"} size="small" variant="outlined" />,
    },
    {
      field: "channel",
      headerName: "Channel",
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value || "production"} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: "downloads",
      headerName: "Downloads",
      width: 120,
      valueGetter: (params) => params.row?.stats?.downloads || 0,
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      field: "successfulUpdates",
      headerName: "Thành công",
      width: 120,
      valueGetter: (params) => params.row?.stats?.successfulUpdates || 0,
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      field: "failedUpdates",
      headerName: "Thất bại",
      width: 120,
      valueGetter: (params) => params.row?.stats?.failedUpdates || 0,
      valueFormatter: (params) => formatNumber(params.value),
    },
    {
      field: "message",
      headerName: "Ghi chú",
      minWidth: 220,
      flex: 1,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "normal",
            lineHeight: 1.5,
          }}
        >
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "size",
      headerName: "Kích thước",
      width: 120,
      valueFormatter: (params) => formatBytes(params.value),
    },
    {
      field: "gitCommitHash",
      headerName: "Commit",
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {truncateMiddle(params.value, 7, 5)}
        </Typography>
      ),
    },
    {
      field: "enabled",
      headerName: "Trạng thái",
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Đang bật" : "Đã tắt"}
          size="small"
          color={params.value ? "success" : "warning"}
          variant={params.value ? "filled" : "outlined"}
        />
      ),
    },
    {
      field: "createdAt",
      headerName: "Ngày deploy",
      width: 170,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: "actions",
      headerName: "",
      width: 60,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <VersionActions
          version={params.row}
          onDeactivate={handleDeactivate}
          isLoading={deactivateLoading}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              OTA Update Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Trang này đọc bundle thật từ hot-updater và số liệu tải/cài từ telemetry mới.
            </Typography>
          </Box>

          <Box display="flex" gap={2}>
            <ToggleButtonGroup
              value={platform}
              exclusive
              onChange={handlePlatformChange}
              size="small"
            >
              <ToggleButton value="android">
                <Android sx={{ mr: 1 }} /> Android
              </ToggleButton>
              <ToggleButton value="ios">
                <Apple sx={{ mr: 1 }} /> iOS
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              startIcon={<BugReport />}
              onClick={() => setTestModalOpen(true)}
            >
              Test Update
            </Button>

            <Button variant="contained" startIcon={<Refresh />} onClick={handleRefresh}>
              Làm mới
            </Button>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Deploy bundle vẫn đi qua CLI hot-updater. Trang này chỉ đọc dữ liệu thật từ D1/R2 và
          telemetry mới của app mobile.
        </Alert>

        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Tổng lượt tải"
                value={formatNumber(analytics?.totals?.downloads || 0)}
                icon={<Download />}
                subtitle={`${analyticsDays} ngày qua`}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Cập nhật thành công"
                value={formatNumber(analytics?.totals?.success || 0)}
                icon={<CheckCircle />}
                subtitle={`${analyticsDays} ngày qua`}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Cập nhật thất bại"
                value={formatNumber(analytics?.totals?.failed || 0)}
                icon={<BugReport />}
                subtitle={`${analyticsDays} ngày qua`}
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Tổng bundle deploy"
                value={formatNumber(analytics?.totals?.deployments || 0)}
                icon={<Storage />}
                subtitle={`${formatNumber(analytics?.totals?.channels || 0)} channel`}
              />
            )}
          </Grid>
        </Grid>

        {analytics?.recentDisabledBundles?.length > 0 ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Có {analytics.recentDisabledBundles.length} bundle đang ở trạng thái đã tắt trên{" "}
            {platform}.
          </Alert>
        ) : null}

        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={8}>
            <AnalyticsChart
              platform={platform}
              days={analyticsDays}
              onDaysChange={setAnalyticsDays}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FailedUpdatesTable platform={platform} />
          </Grid>
        </Grid>

        <Paper sx={{ width: "100%" }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            p={2}
            borderBottom={1}
            borderColor="divider"
          >
            <Typography variant="h6">Danh sách bundle deploy</Typography>
            <Chip label={`Nguồn: ${analytics?.source || "hot-updater"}`} size="small" variant="outlined" />
          </Box>

          <DataGrid
            rows={versions}
            columns={columns}
            getRowId={(row) => row._id || row.bundleId}
            loading={versionsLoading}
            disableSelectionOnClick
            hideFooterSelectedRowCount
            rowHeight={88}
            headerHeight={56}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            onRowClick={(params) => setSelectedBundle(params.row)}
            autoHeight
            sx={{
              border: 0,
              "& .MuiDataGrid-cell": {
                py: 2,
                alignItems: "center",
                cursor: "pointer",
              },
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "grey.50",
              },
              "& .MuiDataGrid-row:hover": {
                bgcolor: "action.hover",
              },
              "& .MuiDataGrid-footerContainer": {
                minHeight: 60,
              },
            }}
            localeText={{
              noRowsLabel: "Chưa có bundle nào được deploy",
              MuiTablePagination: {
                labelRowsPerPage: "Số dòng:",
                labelDisplayedRows: ({ from, to, count }) =>
                  `${from}-${to} trong ${count !== -1 ? count : `hơn ${to}`}`,
              },
            }}
            slots={{
              noRowsOverlay: () => (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  height="100%"
                  py={8}
                >
                  <Typography color="text.secondary">
                    Chưa có bundle nào được deploy qua hot-updater
                  </Typography>
                </Box>
              ),
            }}
          />
        </Paper>

        <Dialog open={Boolean(selectedBundle)} onClose={() => setSelectedBundle(null)} maxWidth="md" fullWidth>
          <DialogTitle>Chi tiết bundle OTA</DialogTitle>
          <DialogContent dividers>
            {selectedBundle ? (
              <Box>
                <Box
                  display="grid"
                  gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }}
                  gap={2}
                >
                  <DetailRow label="Bundle ID" value={selectedBundle.bundleId} mono />
                  <DetailRow label="Phiên bản app đích" value={selectedBundle.targetAppVersion} />
                  <DetailRow label="Channel" value={selectedBundle.channel} />
                  <DetailRow
                    label="Trạng thái"
                    value={selectedBundle.enabled ? "Đang bật" : "Đã tắt"}
                  />
                  <DetailRow
                    label="Force update"
                    value={selectedBundle.shouldForceUpdate ? "Có" : "Không"}
                  />
                  <DetailRow label="Kích thước" value={formatBytes(selectedBundle.size)} />
                  <DetailRow label="Commit" value={selectedBundle.gitCommitHash} mono />
                  <DetailRow label="Ngày deploy" value={formatDate(selectedBundle.createdAt)} />
                  <DetailRow
                    label="Downloads"
                    value={formatNumber(selectedBundle?.stats?.downloads || 0)}
                  />
                  <DetailRow
                    label="Cập nhật thành công"
                    value={formatNumber(selectedBundle?.stats?.successfulUpdates || 0)}
                  />
                  <DetailRow
                    label="Cập nhật thất bại"
                    value={formatNumber(selectedBundle?.stats?.failedUpdates || 0)}
                  />
                  <DetailRow
                    label="Được thấy bản update"
                    value={formatNumber(selectedBundle?.stats?.updateAvailable || 0)}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                <DetailRow label="Mô tả" value={selectedBundle.message || selectedBundle.description} />
                <DetailRow label="File hash" value={selectedBundle.fileHash} mono />
                <DetailRow label="Fingerprint hash" value={selectedBundle.fingerprintHash} mono />
                <DetailRow label="Storage URI" value={selectedBundle.storageUri} mono />
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setSelectedBundle(null)}>Đóng</Button>
          </DialogActions>
        </Dialog>

        <TestUpdateModal
          open={testModalOpen}
          onClose={() => setTestModalOpen(false)}
          platform={platform}
        />
      </Container>
    </DashboardLayout>
  );
}
