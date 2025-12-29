// pages/admin/components/UploadBundleModal.jsx
import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  LinearProgress,
  IconButton,
  Paper,
} from "@mui/material";
import { Close, CloudUpload, InsertDriveFile } from "@mui/icons-material";
import { useUploadOtaBundleMutation } from "../../../slices/otaApiSlice";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function UploadBundleModal({ open, onClose, platform }) {
  const fileInputRef = useRef(null);
  const [uploadBundle, { isLoading, error }] = useUploadOtaBundleMutation();

  const [formData, setFormData] = useState({
    version: "",
    description: "",
    minAppVersion: "1.0.0",
    mandatory: false,
  });
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      version: "",
      description: "",
      minAppVersion: "1.0.0",
      mandatory: false,
    });
    setFile(null);
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !formData.version) return;

    try {
      await uploadBundle({
        platform,
        ...formData,
        file,
      }).unwrap();
      handleClose();
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const isValid = file && formData.version.trim();

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Upload Bundle - {platform === "android" ? "Android" : "iOS"}
          </Typography>
          <IconButton onClick={handleClose} disabled={isLoading} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.data?.error || "Upload thất bại. Vui lòng thử lại."}
            </Alert>
          )}

          {/* File Drop Zone */}
          <Paper
            variant="outlined"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              p: 3,
              mb: 3,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: dragActive ? "action.hover" : "background.default",
              borderStyle: "dashed",
              borderColor: dragActive ? "primary.main" : "divider",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "primary.main",
              },
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.jsbundle"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            {file ? (
              <Box>
                <InsertDriveFile sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
                <Typography fontWeight="medium">{file.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatBytes(file.size)}
                </Typography>
              </Box>
            ) : (
              <Box>
                <CloudUpload sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                <Typography>Kéo thả file bundle vào đây hoặc click để chọn</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chấp nhận file .js hoặc .jsbundle (tối đa 50MB)
                </Typography>
              </Box>
            )}
          </Paper>

          <TextField
            fullWidth
            label="Version"
            name="version"
            value={formData.version}
            onChange={handleChange}
            placeholder="1.0.1"
            required
            sx={{ mb: 2 }}
            helperText="Sử dụng semantic versioning (major.minor.patch)"
          />

          <TextField
            fullWidth
            label="Mô tả"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Sửa lỗi crash khi live stream..."
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Min App Version"
            name="minAppVersion"
            value={formData.minAppVersion}
            onChange={handleChange}
            placeholder="1.0.0"
            sx={{ mb: 2 }}
            helperText="Phiên bản app tối thiểu để nhận update này"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.mandatory}
                onChange={handleChange}
                name="mandatory"
                color="error"
              />
            }
            label={
              <Box>
                <Typography>Bắt buộc cập nhật</Typography>
                <Typography variant="caption" color="text.secondary">
                  Người dùng phải cập nhật để tiếp tục sử dụng app
                </Typography>
              </Box>
            }
          />
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} disabled={isLoading}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isLoading}
            startIcon={<CloudUpload />}
          >
            {isLoading ? "Đang upload..." : "Upload"}
          </Button>
        </DialogActions>

        {isLoading && <LinearProgress />}
      </form>
    </Dialog>
  );
}
