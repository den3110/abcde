import React from "react";
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  IconButton,
  Grid
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

export default function SystemSettingsAzureEditor({ form, setForm }) {
  const accounts = form.azure?.accounts || [];

  const handleAddAccount = () => {
    const newAccount = {
      id: "az_" + Date.now(),
      label: "Tài khoản Azure mới",
      isActive: true,
      capabilities: { useForVmWorker: true, useForTts: false },
      clientId: "",
      clientSecret: "",
      tenantId: "",
      subscriptionId: "",
      resourceGroup: "",
      vmName: "",
      sshUser: "azureuser",
      sshPrivateKey: "",
      ttsRegion: "",
      ttsApiKey: "",
      ttsVoiceName: "vi-VN-HoaiMyNeural",
    };
    setForm((prev) => ({
      ...prev,
      azure: {
        ...prev.azure,
        accounts: [...(prev.azure?.accounts || []), newAccount],
      },
    }));
  };

  const handleRemoveAccount = (id) => {
    if (!window.confirm("Xóa tài khoản Azure này?")) return;
    setForm((prev) => ({
      ...prev,
      azure: {
        ...prev.azure,
        accounts: prev.azure.accounts.filter((a) => a.id !== id),
      },
    }));
  };

  const handleChangeAccount = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      azure: {
        ...prev.azure,
        accounts: prev.azure.accounts.map((a) =>
          a.id === id ? { ...a, [field]: value } : a
        ),
      },
    }));
  };

  const handleChangeCapability = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      azure: {
        ...prev.azure,
        accounts: prev.azure.accounts.map((a) =>
          a.id === id
            ? { ...a, capabilities: { ...a.capabilities, [field]: value } }
            : a
        ),
      },
    }));
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 3, borderColor: '#007FFF' }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={700} color="primary">
              Tích hợp Microsoft Azure Cloud (Multi-Account)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cấu hình các API Credentials để hệ thống bắn lệnh Start/Stop máy ảo FFMPEG từ xa.
            </Typography>
          </Box>
          <Switch
            checked={!!form.azure?.enabled}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                azure: { ...p.azure, enabled: e.target.checked },
              }))
            }
          />
        </Stack>
        <Divider />

        {form.azure?.enabled && (
          <>
            {accounts.map((acc, index) => (
              <Paper key={acc.id} variant="outlined" sx={{ p: 2, bgcolor: "#fcfcfc" }}>
                <Stack direction="row" justifyContent="space-between" mb={2}>
                  <Typography fontWeight="bold">Account #{index + 1}: {acc.label}</Typography>
                  <IconButton color="error" onClick={() => handleRemoveAccount(acc.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField label="Tên gợi nhớ (Label)" value={acc.label} onChange={(e) => handleChangeAccount(acc.id, "label", e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Stack direction="row" alignItems="center">
                      <Typography variant="body2">Dùng cho VM Worker?</Typography>
                      <Switch checked={!!acc.capabilities?.useForVmWorker} onChange={(e) => handleChangeCapability(acc.id, "useForVmWorker", e.target.checked)} />
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Stack direction="row" alignItems="center">
                      <Typography variant="body2">Dùng cho AI TTS?</Typography>
                      <Switch checked={!!acc.capabilities?.useForTts} onChange={(e) => handleChangeCapability(acc.id, "useForTts", e.target.checked)} />
                    </Stack>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Service Principal (App Registration)</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Client ID" value={acc.clientId} onChange={(e) => handleChangeAccount(acc.id, "clientId", e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Client Secret" type="password" value={acc.clientSecret} onChange={(e) => handleChangeAccount(acc.id, "clientSecret", e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Tenant ID" value={acc.tenantId} onChange={(e) => handleChangeAccount(acc.id, "tenantId", e.target.value)} fullWidth size="small" />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Virtual Machine Specs</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Subscription ID" value={acc.subscriptionId} onChange={(e) => handleChangeAccount(acc.id, "subscriptionId", e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Resource Group" value={acc.resourceGroup} onChange={(e) => handleChangeAccount(acc.id, "resourceGroup", e.target.value)} fullWidth size="small" />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="VM Name" value={acc.vmName} onChange={(e) => handleChangeAccount(acc.id, "vmName", e.target.value)} fullWidth size="small" />
                  </Grid>
                </Grid>
              </Paper>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddAccount}
              sx={{ alignSelf: "flex-start", mt: 2 }}
            >
              Thêm tài khoản Azure
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
}
