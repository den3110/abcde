// pages/admin/OTAAdminPage.jsx
import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  LinearProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  CloudUpload,
  Android,
  Apple,
  MoreVert,
  Restore,
  Delete,
  Download,
  Refresh,
  CheckCircle,
  Error,
  Storage,
  BugReport,
} from "@mui/icons-material";
import {
  useGetOtaVersionsQuery,
  useGetOtaAnalyticsQuery,
  useRollbackOtaMutation,
  useDeactivateOtaVersionMutation,
} from "../../slices/otaApiSlice";
import UploadBundleModal from "./components/UploadBundleModal";
import TestUpdateModal from "./components/TestUpdateModal";
import AnalyticsChart from "./components/AnalyticsChart";
import FailedUpdatesTable from "./components/FailedUpdatesTable";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Utils
const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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

const formatNumber = (num) => {
  if (!num) return "0";
  return new Intl.NumberFormat("vi-VN").format(num);
};

// Stats Card Component
const StatsCard = ({ title, value, icon, color = "primary", subtitle }) => (
  <Card
    sx={{
      height: "100%",
      background: `linear-gradient(135deg, ${color}.dark 0%, ${color}.main 100%)`,
      color: "white",
    }}
  >
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            bgcolor: "rgba(255,255,255,0.2)",
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
  color: PropTypes.string,
  subtitle: PropTypes.string,
};

// Version Actions Component
const VersionActions = ({ version, onRollback, onDeactivate, isLoading }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleRollback = () => {
    handleMenuClose();
    onRollback(version.version);
  };

  const handleDeactivate = () => {
    handleMenuClose();
    onDeactivate(version.version);
  };

  return (
    <>
      <IconButton size="small" onClick={handleMenuOpen} disabled={isLoading}>
        <MoreVert />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {!version.isLatest && (
          <MenuItem onClick={handleRollback}>
            <ListItemIcon>
              <Restore fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rollback về version này</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={handleDeactivate}
          sx={{ color: "error.main" }}
          disabled={version.isLatest}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Vô hiệu hóa</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

VersionActions.propTypes = {
  version: PropTypes.object.isRequired,
  onRollback: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

// Main Component
export default function OTAAdminPage() {
  const [platform, setPlatform] = useState("android");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);

  const {
    data: versions = [],
    isLoading: versionsLoading,
    refetch: refetchVersions,
  } = useGetOtaVersionsQuery(platform);

  const { data: analytics, isLoading: analyticsLoading } = useGetOtaAnalyticsQuery({
    platform,
    days: analyticsDays,
  });

  const [rollback, { isLoading: rollbackLoading }] = useRollbackOtaMutation();
  const [deactivate, { isLoading: deactivateLoading }] = useDeactivateOtaVersionMutation();

  const handlePlatformChange = (_, newPlatform) => {
    if (newPlatform) setPlatform(newPlatform);
  };

  const handleRollback = async (version) => {
    if (window.confirm(`Bạn có chắc muốn rollback về version ${version}?`)) {
      try {
        await rollback({ platform, version }).unwrap();
      } catch (error) {
        console.error("Rollback failed:", error);
      }
    }
  };

  const handleDeactivate = async (version) => {
    if (window.confirm(`Bạn có chắc muốn vô hiệu hóa version ${version}?`)) {
      try {
        await deactivate({ platform, version }).unwrap();
      } catch (error) {
        console.error("Deactivate failed:", error);
      }
    }
  };

  const isActionLoading = rollbackLoading || deactivateLoading;

  // DataGrid columns
  const columns = [
    {
      field: "version",
      headerName: "Version",
      width: 160,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Typography fontWeight="medium">{params.value}</Typography>
          {params.row.isLatest && (
            <Chip label="Latest" size="small" color="success" sx={{ fontWeight: "bold" }} />
          )}
          {params.row.mandatory && (
            <Chip label="Bắt buộc" size="small" color="error" variant="outlined" />
          )}
        </Box>
      ),
    },
    {
      field: "description",
      headerName: "Mô tả",
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "minAppVersion",
      headerName: "Min App Version",
      width: 130,
      renderCell: (params) => <Chip label={`≥ ${params.value}`} size="small" variant="outlined" />,
    },
    {
      field: "size",
      headerName: "Kích thước",
      width: 110,
      valueFormatter: (params) => formatBytes(params.value),
    },
    {
      field: "downloads",
      headerName: "Downloads",
      width: 110,
      valueGetter: (params) => params.row?.stats?.downloads || 0,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={0.5}>
          <Download fontSize="small" color="action" />
          {formatNumber(params.value)}
        </Box>
      ),
    },
    {
      field: "successRate",
      headerName: "Tỷ lệ thành công",
      width: 150,
      valueGetter: (params) => {
        const stats = params.row?.stats;
        if (!stats) return null;
        const total = (stats.successfulUpdates || 0) + (stats.failedUpdates || 0);
        return total > 0 ? ((stats.successfulUpdates / total) * 100).toFixed(1) : null;
      },
      renderCell: (params) =>
        params.value !== null ? (
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 60 }}>
              <LinearProgress
                variant="determinate"
                value={parseFloat(params.value)}
                color={parseFloat(params.value) >= 90 ? "success" : "warning"}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
            <Typography variant="body2">{params.value}%</Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            -
          </Typography>
        ),
    },
    {
      field: "createdAt",
      headerName: "Ngày upload",
      width: 160,
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
          onRollback={handleRollback}
          onDeactivate={handleDeactivate}
          isLoading={isActionLoading}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              OTA Update Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Quản lý và phân phối bản cập nhật Over-The-Air cho PickleTour
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

            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setUploadModalOpen(true)}
            >
              Upload Bundle
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Tổng Downloads"
                value={formatNumber(analytics?.totals?.downloading || 0)}
                icon={<Download />}
                color="primary"
                subtitle="7 ngày qua"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Update Thành Công"
                value={formatNumber(analytics?.totals?.success || 0)}
                icon={<CheckCircle />}
                color="success"
                subtitle="7 ngày qua"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Update Thất Bại"
                value={formatNumber(analytics?.totals?.failed || 0)}
                icon={<Error />}
                color="error"
                subtitle="7 ngày qua"
              />
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {analyticsLoading ? (
              <Skeleton variant="rounded" height={120} />
            ) : (
              <StatsCard
                title="Tổng Versions"
                value={versions.length}
                icon={<Storage />}
                color="info"
                subtitle={platform === "android" ? "Android" : "iOS"}
              />
            )}
          </Grid>
        </Grid>

        {/* Failed Updates Alert */}
        {analytics?.failedUpdates?.length > 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Có {analytics.failedUpdates.length} lần update thất bại gần đây. Kiểm tra chi tiết để
            debug.
          </Alert>
        )}

        {/* Analytics Chart & Failed Updates */}
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

        {/* Versions DataGrid */}
        <Paper sx={{ width: "100%" }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            p={2}
            borderBottom={1}
            borderColor="divider"
          >
            <Typography variant="h6">Danh sách Versions</Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={refetchVersions}
              disabled={versionsLoading}
            >
              Làm mới
            </Button>
          </Box>

          <DataGrid
            rows={versions}
            columns={columns}
            getRowId={(row) => row._id || row.version}
            loading={versionsLoading}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            autoHeight
            sx={{
              border: 0,
              "& .MuiDataGrid-cell": {
                py: 1.5,
              },
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "grey.50",
              },
              "& .MuiDataGrid-row:hover": {
                bgcolor: "action.hover",
              },
            }}
            localeText={{
              noRowsLabel: "Chưa có version nào được upload",
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
                  <Typography color="text.secondary" mb={2}>
                    Chưa có version nào được upload
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUpload />}
                    onClick={() => setUploadModalOpen(true)}
                  >
                    Upload Bundle đầu tiên
                  </Button>
                </Box>
              ),
            }}
          />
        </Paper>

        {/* Modals */}
        <UploadBundleModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          platform={platform}
        />
        <TestUpdateModal
          open={testModalOpen}
          onClose={() => setTestModalOpen(false)}
          platform={platform}
        />
      </Container>
    </DashboardLayout>
  );
}
