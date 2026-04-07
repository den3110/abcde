import React, { useEffect, useState } from "react";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  Box,
  CircularProgress,
  Fab,
  Stack,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { toast } from "react-toastify";
import {
  useGetSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
} from "slices/settingsApiSlice";

import SystemSettingsAzureEditor from "./SystemSettingsAzureEditor";

export default function AdminAzureConfigPage() {
  const { data: serverSettings, isLoading: isFetching } = useGetSystemSettingsQuery();
  const [updateSystemSettings, { isLoading: isSaving }] = useUpdateSystemSettingsMutation();

  const [form, setForm] = useState(null);
  const [showFab, setShowFab] = useState(false);

  useEffect(() => {
    if (serverSettings) {
      setForm(structuredClone(serverSettings));
    }
  }, [serverSettings]);

  useEffect(() => {
    if (!serverSettings || !form) return;
    const isChanged = JSON.stringify(serverSettings.azure) !== JSON.stringify(form.azure);
    setShowFab(isChanged);
  }, [form, serverSettings]);

  const handleSave = async () => {
    try {
      if (!window.confirm("Lưu cấu hình Azure Credentials? (Hành động này ảnh hưởng đến toàn hệ thống)")) return;
      await updateSystemSettings({ azure: form.azure }).unwrap();
      toast.success("Đã cập nhật cấu hình Azure thành công.");
      setShowFab(false);
    } catch (err) {
      toast.error(err?.data?.message || err.message || "Lỗi cập nhật cấu hình.");
    }
  };

  if (isFetching || !form) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box pt={3} pb={10}>
        <Box mb={3}>
          <Typography variant="h4" fontWeight="bold">
            Cấu hình Azure Credentials
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Chỉ dành cho Super Admin. Khai báo danh sách các tài khoản Microsoft Azure API.
          </Typography>
        </Box>
        
        <Stack spacing={4}>
          <SystemSettingsAzureEditor form={form} setForm={setForm} />
        </Stack>
      </Box>

      <Fab
        color="primary"
        aria-label="save"
        variant="extended"
        onClick={handleSave}
        disabled={isSaving}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          boxShadow: 3,
          px: 3,
          transition: "opacity 0.3s, transform 0.3s",
          opacity: showFab ? 1 : 0,
          transform: showFab ? "translateY(0)" : "translateY(20px)",
          pointerEvents: showFab ? "auto" : "none",
        }}
      >
        {isSaving ? (
          <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
        ) : (
          <SaveIcon sx={{ mr: 1 }} />
        )}
        {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
      </Fab>
    </DashboardLayout>
  );
}
