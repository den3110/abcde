import React from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  Card,
  Grid,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SettingsIcon from "@mui/icons-material/Settings";

import {
  useGetAzureVmStatusesQuery,
  useGetAzureBillingQuery,
  useToggleAzureVmMutation,
} from "slices/azureAdminApiSlice";

export default function AzureManagerPage() {
  const { data: vmsData, isLoading: loadingVms, refetch: refetchVms } = useGetAzureVmStatusesQuery();
  const { data: billingData, isLoading: loadingBilling, refetch: refetchBilling } = useGetAzureBillingQuery();
  const [toggleVm, { isLoading: isToggling }] = useToggleAzureVmMutation();

  const statuses = vmsData?.vms || [];
  const billing = billingData?.billing || [];
  const loading = loadingVms || loadingBilling || isToggling;

  const handleRefresh = () => {
    refetchVms();
    refetchBilling();
  };

  const handleToggleVm = async (accountId, action) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toUpperCase()} máy ảo này?`)) return;
    
    try {
      const res = await toggleVm({ accountId, action }).unwrap();
      alert("Thành công: " + res.message);
    } catch (err) {
      alert("Lỗi: " + (err?.data?.message || err.message || "Kết nối thất bại."));
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box pt={3} pb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="bold">Quản lý Đa Tài Khoản Azure (Pool)</Typography>
          <Box>
            <Button
              variant="contained"
              color="info"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
              sx={{ mr: 2, color: 'white' }}
            >
              Làm mới trạng thái
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SettingsIcon />}
              href="/admin/settings"
            >
              Cấu hình Secret Keys
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {statuses.length === 0 && !loading && (
            <Grid item xs={12}>
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="textSecondary">Chưa có tài khoản VM Worker nào được cấu hình trong System Settings.</Typography>
              </Card>
            </Grid>
          )}

          {statuses.map((vm, index) => {
            const billInfo = billing.find(b => b.accountId === vm.accountId) || {};
            const isRunning = String(vm.powerState).toLowerCase().includes("running");
            
            return (
              <Grid item xs={12} md={6} lg={4} key={vm.accountId || index}>
                <Card sx={{ p: 3, position: 'relative', overflow: 'visible' }}>
                  {isRunning && (
                    <Box sx={{
                      position: 'absolute', top: -10, right: -10,
                      width: 20, height: 20, borderRadius: '50%',
                      backgroundColor: '#4CAF50',
                      boxShadow: '0 0 10px #4CAF50',
                      animation: 'pulse 1.5s infinite'
                    }} />
                  )}
                  <Typography variant="h5" fontWeight="medium" mb={1}>
                    {vm.label}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" mb={2}>
                    <strong>VM Name:</strong> {vm.vmName} <br />
                    <strong>Trạng thái:</strong> <Chip size="small" label={vm.powerState || "Loading..."} color={isRunning ? "success" : "default"} />
                  </Typography>
                  
                  <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary">Tiền tiêu kỳ này (Cost API)</Typography>
                    <Typography variant="h4" color="error" fontWeight="bold">
                      {billInfo.totalCost ? `${billInfo.totalCost} ${billInfo.currency || 'USD'}` : (loadingBilling ? "Đang tính..." : "?")} 
                    </Typography>
                  </Box>

                  <Box display="flex" gap={2}>
                    <Button 
                      variant="contained" 
                      color="success" 
                      fullWidth 
                      startIcon={<PlayArrowIcon />}
                      disabled={isRunning || isToggling}
                      onClick={() => handleToggleVm(vm.accountId, "start")}
                    >
                      Start VM
                    </Button>
                    <Button 
                      variant="contained" 
                      color="error" 
                      fullWidth 
                      startIcon={<StopIcon />}
                      disabled={!isRunning || isToggling}
                      onClick={() => handleToggleVm(vm.accountId, "deallocate")}
                    >
                      Deallocate
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box mt={4}>
          <Card sx={{ p: 3, backgroundColor: "#1e1e1e", color: "#00ff00", minHeight: 300, fontFamily: 'monospace' }}>
            <Typography variant="h6" color="white" mb={2}>&gt;_ Livestream & FFMPEG Log Terminal (SSH/Socket)</Typography>
            <Typography variant="body2">Waiting for connection to Azure SSH instances...</Typography>
            <Typography variant="body2" color="gray">[Tính năng stream websocket trực tiếp vào xterm sẽ được móc nối khi Azure Worker có job rendering]</Typography>
          </Card>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
