import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  Paper,
  Divider,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Close, PlayArrow, CheckCircle, Info } from "@mui/icons-material";
import { useLazyCheckOtaUpdateQuery } from "../../../slices/otaApiSlice";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function TestUpdateModal({ open, onClose, platform }) {
  const [checkUpdate, { data: result, isLoading, error, isFetching }] =
    useLazyCheckOtaUpdateQuery();

  const [formData, setFormData] = useState({
    bundleVersion: "",
    appVersion: "1.0.0",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTest = () => {
    checkUpdate({
      platform,
      bundleVersion: formData.bundleVersion,
      appVersion: formData.appVersion,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Test hot-updater - {platform === "android" ? "Android" : "iOS"}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 3 }}>
          Giả lập request check update từ app để test logic hot-updater thật.
        </Alert>

        <Box display="flex" gap={2} mb={3}>
          <TextField
            fullWidth
            label="Bundle ID hiện tại"
            name="bundleVersion"
            value={formData.bundleVersion}
            onChange={handleChange}
            placeholder="Bỏ trống nếu máy chưa có bundle OTA"
            helperText="ID bundle đang có trên device, không phải version native"
          />
          <TextField
            fullWidth
            label="App Version"
            name="appVersion"
            value={formData.appVersion}
            onChange={handleChange}
            placeholder="1.0.25"
            helperText="Version native app"
          />
        </Box>

        <Button
          fullWidth
          variant="contained"
          onClick={handleTest}
          disabled={isLoading || isFetching}
          startIcon={
            isLoading || isFetching ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />
          }
          sx={{ mb: 3 }}
        >
          {isLoading || isFetching ? "Đang kiểm tra..." : "Kiểm tra update"}
        </Button>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Kết quả:
        </Typography>

        {error && (
          <Alert severity="error">{error.data?.error || "Có lỗi xảy ra khi kiểm tra update"}</Alert>
        )}

        {result && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            {result.updateAvailable ? (
              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <CheckCircle color="success" />
                  <Typography fontWeight="medium" color="success.main">
                    Có bundle mới từ hot-updater
                  </Typography>
                </Box>

                <Box display="flex" flexDirection="column" gap={1.5}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Bundle ID:
                    </Typography>
                    <Chip label={result.bundleId || "-"} size="small" color="primary" />
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Phiên bản app đích:
                    </Typography>
                    <Typography variant="body2">
                      {result.targetAppVersion || result.version || "-"}
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Kênh:
                    </Typography>
                    <Chip label={result.channel || "production"} size="small" variant="outlined" />
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Kích thước:
                    </Typography>
                    <Typography variant="body2">{formatBytes(result.size)}</Typography>
                  </Box>

                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Bắt buộc:
                    </Typography>
                    <Chip
                      label={result.mandatory ? "Có" : "Không"}
                      size="small"
                      color={result.mandatory ? "error" : "default"}
                    />
                  </Box>

                  {result.description && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Mô tả:
                      </Typography>
                      <Typography variant="body2">{result.description}</Typography>
                    </Box>
                  )}

                  {result.hash && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Mã băm file:
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          bgcolor: "action.hover",
                          p: 1,
                          borderRadius: 1,
                          display: "block",
                          wordBreak: "break-all",
                        }}
                      >
                        {result.hash}
                      </Typography>
                    </Box>
                  )}

                  {result.downloadUrl && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Đường dẫn tải:
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          bgcolor: "action.hover",
                          p: 1,
                          borderRadius: 1,
                          display: "block",
                          wordBreak: "break-all",
                        }}
                      >
                        {result.downloadUrl}
                      </Typography>
                    </Box>
                  )}

                  {result.status && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        Trạng thái worker:
                      </Typography>
                      <Typography variant="caption" fontFamily="monospace">
                        {result.status}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={1}>
                <Info color="info" />
                <Typography color="text.secondary">
                  Không có bundle mới phù hợp. App đang ở bản mới nhất hoặc target app version
                  không khớp.
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {!result && !error && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center", bgcolor: "action.hover" }}>
            <Typography color="text.secondary">Nhấn &quot;Kiểm tra update&quot; để test</Typography>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

TestUpdateModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  platform: PropTypes.string.isRequired,
};
