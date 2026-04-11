import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
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
  Divider,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SettingsIcon from "@mui/icons-material/Settings";

import { Link } from "react-router-dom";

import {
  useGetAzureVmStatusesQuery,
  useGetAzureBillingQuery,
  useToggleAzureVmMutation,
} from "slices/azureAdminApiSlice";

function formatCurrency(amount, currency = "USD") {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return `? ${currency}`.trim();
  }

  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch (error) {
    return `${numeric.toFixed(2)} ${currency}`.trim();
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getBillingChipColor(key) {
  switch (key) {
    case "compute":
      return "error";
    case "storage":
      return "warning";
    case "network":
      return "info";
    case "monitoring":
      return "secondary";
    case "backup":
      return "success";
    default:
      return "default";
  }
}

function BillingRows({ rows = [], currency = "USD", emptyText = "Chưa có dữ liệu chi tiết." }) {
  if (!rows.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return rows.map((row) => (
    <Box
      key={`${row.key}-${row.label}`}
      display="flex"
      justifyContent="space-between"
      alignItems="flex-start"
      gap={2}
      py={0.75}
      borderBottom="1px dashed rgba(0,0,0,0.08)"
    >
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight="medium" noWrap title={row.label}>
          {row.label}
        </Typography>
        {(row.resourceGroup || row.serviceName) ? (
          <Typography variant="caption" color="text.secondary">
            {[row.serviceName, row.resourceGroup ? `RG ${row.resourceGroup}` : ""]
              .filter(Boolean)
              .join(" • ")}
          </Typography>
        ) : null}
      </Box>
      <Box textAlign="right" flexShrink={0}>
        <Typography variant="body2" fontWeight="bold">
          {formatCurrency(row.totalCost, currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {row.sharePercent}% • {row.itemCount} dòng
        </Typography>
      </Box>
    </Box>
  ));
}

BillingRows.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      totalCost: PropTypes.number,
      sharePercent: PropTypes.number,
      itemCount: PropTypes.number,
      resourceGroup: PropTypes.string,
      serviceName: PropTypes.string,
    }),
  ),
  currency: PropTypes.string,
  emptyText: PropTypes.string,
};

export default function AzureManagerPage() {
  const { data: vmsData, isLoading: loadingVms, refetch: refetchVms } = useGetAzureVmStatusesQuery(undefined, { pollingInterval: 5000 });
  const { data: billingData, isLoading: loadingBilling, refetch: refetchBilling } = useGetAzureBillingQuery();
  const [toggleVm, { isLoading: isToggling }] = useToggleAzureVmMutation();
  const [pendingActions, setPendingActions] = useState({});

  useEffect(() => {
    if (vmsData?.vms) {
      setPendingActions(prev => {
        const next = { ...prev };
        let changed = false;
        vmsData.vms.forEach(vm => {
          const pStateLower = String(vm.powerState).toLowerCase();
          // If Azure recognized the transition, or it reached the final state, clear optimistic state
          if (next[vm.accountId] && (pStateLower.includes("starting") || pStateLower.includes("deallocating") || pStateLower.includes("running") || pStateLower === "vm deallocated")) {
            // Azure is aware, so we can drop the local optimistic override
            delete next[vm.accountId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [vmsData]);

  const statuses = vmsData?.vms || [];
  const billing = billingData?.billing || [];
  const loading = loadingVms || loadingBilling || isToggling;

  const handleRefresh = () => {
    refetchVms();
    refetchBilling();
  };

  const handleToggleVm = async (accountId, action) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${action.toUpperCase()} máy ảo này?`)) return;
    
    setPendingActions(prev => ({
      ...prev,
      [accountId]: action === "start" ? "VM starting" : "VM deallocating"
    }));

    try {
      await toggleVm({ accountId, action }).unwrap();
      refetchVms();
    } catch (err) {
      alert("Lỗi: " + (err?.data?.message || err.message || "Kết nối thất bại."));
      setPendingActions(prev => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
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
              component={Link}
              to="/admin/azure-config"
              variant="outlined"
              color="primary"
              startIcon={<SettingsIcon />}
            >
              Cấu hình Secret Keys
            </Button>
          </Box>
        </Box>

        <Card sx={{ p: 2.5, mb: 3, background: "linear-gradient(135deg, #eef4ff 0%, #f9fbff 100%)" }}>
          <Typography variant="subtitle1" fontWeight="bold" color="info.main" mb={0.5}>
            Chi tiết chi phí Azure
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chi phí bên dưới là số lũy kế trong kỳ hiện tại do Azure Cost API trả về. Nó không phải số realtime,
            nên khi VM đã tắt vẫn có thể còn phí Disk, Public IP, Network hoặc dữ liệu cost đang cập nhật chậm.
          </Typography>
        </Card>

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
            
            // Mix with local optimistic state
            const currentPowerState = pendingActions[vm.accountId] || vm.powerState || "unknown";
            const pStateLower = String(currentPowerState).toLowerCase();
            
            const isRunning = pStateLower.includes("running");
            const isTransitioning = pStateLower.includes("starting") || pStateLower.includes("deallocating") || pStateLower.includes("stopping");
            
            let chipColor = "default";
            if (isRunning) chipColor = "success";
            else if (isTransitioning) chipColor = "warning";

            return (
              <Grid item xs={12} lg={6} key={vm.accountId || index}>
                <Card sx={{ p: 3, position: 'relative', overflow: 'visible' }}>
                  {(isRunning || isTransitioning) && (
                    <Box sx={{
                      position: 'absolute', top: -10, right: -10,
                      width: 20, height: 20, borderRadius: '50%',
                      backgroundColor: isTransitioning ? '#FF9800' : '#4CAF50',
                      boxShadow: `0 0 10px ${isTransitioning ? '#FF9800' : '#4CAF50'}`,
                      animation: 'pulse 1.5s infinite'
                    }} />
                  )}
                  <Typography variant="h5" fontWeight="medium" mb={1}>
                    {vm.label}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" mb={2}>
                    <strong>VM Name:</strong> {vm.vmName} <br />
                    <strong>Trạng thái:</strong> <Chip size="small" label={currentPowerState} color={chipColor} />
                  </Typography>
                  
                  <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary">Chi phí kỳ này (Cost API)</Typography>
                    <Typography variant="h4" color="error" fontWeight="bold">
                      {billInfo.totalCost ? formatCurrency(billInfo.totalCost, billInfo.currency || "USD") : (loadingBilling ? "Đang tính..." : "?")}
                    </Typography>
                    {!billInfo.error ? (
                      <>
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                          {billInfo.note || "Chi phí được lấy từ Azure Cost API."}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                          Đã tổng hợp {billInfo.usageDetailCount || 0}/{billInfo.usageDetailLimit || 0} dòng usage
                          {billInfo.usageDetailLimitReached ? " đầu tiên" : ""} • Cập nhật usage gần nhất: {formatDateTime(billInfo.latestUsageAt)}
                        </Typography>
                      </>
                    ) : null}
                    {billInfo.error ? (
                      <Typography variant="caption" color="error.main" display="block" mt={1}>
                        {billInfo.error}
                      </Typography>
                    ) : null}
                    {!!billInfo?.breakdown?.categories?.length && !billInfo.error ? (
                      <Box mt={1.5} display="flex" flexWrap="wrap" gap={1}>
                        {billInfo.breakdown.categories.map((row) => (
                          <Chip
                            key={`${row.key}-${row.label}`}
                            size="small"
                            color={getBillingChipColor(row.key)}
                            variant="outlined"
                            label={`${row.label}: ${formatCurrency(row.totalCost, billInfo.currency || "USD")}`}
                          />
                        ))}
                      </Box>
                    ) : null}
                  </Box>

                  <Box mb={2}>
                    <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                      Top dịch vụ đang tính phí
                    </Typography>
                    <BillingRows
                      rows={billInfo?.breakdown?.services || []}
                      currency={billInfo.currency || "USD"}
                      emptyText="Chưa có dữ liệu breakdown theo dịch vụ."
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box mb={2}>
                    <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                      Top resource đang ăn tiền
                    </Typography>
                    <BillingRows
                      rows={billInfo?.breakdown?.resources || []}
                      currency={billInfo.currency || "USD"}
                      emptyText="Chưa có dữ liệu breakdown theo resource."
                    />
                  </Box>

                  <Box display="flex" gap={2}>
                    <Button 
                      variant="contained" 
                      color="success" 
                      fullWidth 
                      startIcon={pendingActions[vm.accountId] === "VM starting" ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                      disabled={isRunning || isTransitioning || isToggling}
                      onClick={() => handleToggleVm(vm.accountId, "start")}
                    >
                      Start VM
                    </Button>
                    <Button 
                      variant="contained" 
                      color="error" 
                      fullWidth 
                      startIcon={pendingActions[vm.accountId] === "VM deallocating" ? <CircularProgress size={20} color="inherit" /> : <StopIcon />}
                      disabled={!isRunning || isTransitioning || isToggling}
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
