// pages/admin/OTAAdminPage.jsx
import React, { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Tooltip,
  LinearProgress,
} from "@mui/material";
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

// Version Row Component
const VersionRow = ({ version, onRollback, onDeactivate, isLoading }) => {
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

  const successRate =
    version.stats?.successfulUpdates + version.stats?.failedUpdates > 0
      ? (
          (version.stats.successfulUpdates /
            (version.stats.successfulUpdates + version.stats.failedUpdates)) *
          100
        ).toFixed(1)
      : null;

  return (
    <TableRow
      sx={{
        "&:hover": { bgcolor: "action.hover" },
        opacity: isLoading ? 0.5 : 1,
      }}
    >
      <TableCell>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography fontWeight="medium">{version.version}</Typography>
          {version.isLatest && (
            <Chip label="Latest" size="small" color="success" sx={{ fontWeight: "bold" }} />
          )}
          {version.mandatory && (
            <Chip label="Bắt buộc" size="small" color="error" variant="outlined" />
          )}
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {version.description || "-"}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={`≥ ${version.minAppVersion}`} size="small" variant="outlined" />
      </TableCell>
      <TableCell>{formatBytes(version.size)}</TableCell>
      <TableCell>
        <Tooltip title="Downloads">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Download fontSize="small" color="action" />
            {formatNumber(version.stats?.downloads)}
          </Box>
        </Tooltip>
      </TableCell>
      <TableCell>
        {successRate !== null ? (
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 60 }}>
              <LinearProgress
                variant="determinate"
                value={parseFloat(successRate)}
                color={parseFloat(successRate) >= 90 ? "success" : "warning"}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
            <Typography variant="body2">{successRate}%</Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )}
      </TableCell>
      <TableCell>{formatDate(version.createdAt)}</TableCell>
      <TableCell>
        <IconButton size="small" onClick={handleMenuOpen} disabled={isLoading}>
          <MoreVert />
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          {!version.isLatest && (
            <MenuItem onClick={handleRollback}>
              <ListItemIcon><Restore fontSize="small" /></ListItemIcon>
              <ListItemText>Rollback về version này</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={handleDeactivate} sx={{ color: "error.main" }} disabled={version.isLatest}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Vô hiệu hóa</ListItemText>
          </MenuItem>
        </Menu>
      </TableCell>
    </TableRow>
  );
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

  return (
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
          <ToggleButtonGroup value={platform} exclusive onChange={handlePlatformChange} size="small">
            <ToggleButton value="android">
              <Android sx={{ mr: 1 }} /> Android
            </ToggleButton>
            <ToggleButton value="ios">
              <Apple sx={{ mr: 1 }} /> iOS
            </ToggleButton>
          </ToggleButtonGroup>

          <Button variant="outlined" startIcon={<BugReport />} onClick={() => setTestModalOpen(true)}>
            Test Update
          </Button>

          <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadModalOpen(true)}>
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
          Có {analytics.failedUpdates.length} lần update thất bại gần đây. Kiểm tra chi tiết để debug.
        </Alert>
      )}

      {/* Analytics Chart & Failed Updates */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <AnalyticsChart platform={platform} days={analyticsDays} onDaysChange={setAnalyticsDays} />
        </Grid>
        <Grid item xs={12} md={4}>
          <FailedUpdatesTable platform={platform} />
        </Grid>
      </Grid>

      {/* Versions Table */}
      <Paper sx={{ overflow: "hidden" }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" p={2} borderBottom={1} borderColor="divider">
          <Typography variant="h6">Danh sách Versions</Typography>
          <Button size="small" startIcon={<Refresh />} onClick={refetchVersions} disabled={versionsLoading}>
            Làm mới
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Mô tả</TableCell>
                <TableCell>Min App Version</TableCell>
                <TableCell>Kích thước</TableCell>
                <TableCell>Downloads</TableCell>
                <TableCell>Tỷ lệ thành công</TableCell>
                <TableCell>Ngày upload</TableCell>
                <TableCell width={60}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versionsLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : versions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">Chưa có version nào được upload</Typography>
                    <Button variant="contained" startIcon={<CloudUpload />} sx={{ mt: 2 }} onClick={() => setUploadModalOpen(true)}>
                      Upload Bundle đầu tiên
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                versions.map((version) => (
                  <VersionRow
                    key={version.version}
                    version={version}
                    onRollback={handleRollback}
                    onDeactivate={handleDeactivate}
                    isLoading={isActionLoading}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modals */}
      <UploadBundleModal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} platform={platform} />
      <TestUpdateModal open={testModalOpen} onClose={() => setTestModalOpen(false)} platform={platform} />
    </Container>
  );
}