// src/pages/admin/CmsHeroEditor.jsx
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Stack,
  Card,
  Alert,
  Divider,
} from "@mui/material";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useUploadAvatarMutation } from "slices/tournamentsApiSlice";
import { useGetHeroContentQuery } from "slices/cmsApiSlice";
import { useUpdateHeroContentMutation } from "slices/cmsApiSlice";

const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10MB

export default function CmsHeroEditor() {
  const { data, isFetching, error, refetch } = useGetHeroContentQuery();
  const [updateHero, { isLoading: saving }] = useUpdateHeroContentMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const [form, setForm] = useState({
    title: "",
    lead: "",
    imageUrl: "",
    imageAlt: "",
  });

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    // data đã được transform thành { title, lead, imageUrl, imageAlt }
    setForm((f) => ({
      ...f,
      title: data.title ?? f.title,
      lead: data.lead ?? f.lead,
      imageUrl: data.imageUrl ?? f.imageUrl,
      imageAlt: data.imageAlt ?? f.imageAlt,
    }));
  }, [data]);

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const pickFile = () => fileInputRef.current?.click();
  const clearImage = () => setForm((prev) => ({ ...prev, imageUrl: "" }));

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn đúng file ảnh (PNG/JPG/WebP...)");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMG_SIZE) {
      toast.error("Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      // giống TournamentFormPage: mutation nhận file trực tiếp
      const res = await uploadAvatar(file).unwrap();
      const url =
        res?.url || res?.path || res?.secure_url || res?.data?.url || res?.data?.path || "";
      if (!url) throw new Error("Không tìm thấy URL ảnh từ server");

      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Tải ảnh thành công");
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Upload ảnh thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onSave = async () => {
    if (!form.title.trim()) {
      toast.error("Tiêu đề không được để trống");
      return;
    }
    try {
      await updateHero({
        title: form.title.trim(),
        lead: form.lead,
        imageUrl: form.imageUrl,
        imageAlt: form.imageAlt,
      }).unwrap();
      toast.success("Lưu Hero thành công");
      await refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || "Lưu thất bại");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3} sx={{ backgroundColor: "#fff", borderRadius: 1 }}>
        <Typography variant="h4" mb={3}>
          Chỉnh sửa Hero (ảnh upload hoặc URL)
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error?.data?.message || error.error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <TextField
              name="title"
              label="Tiêu đề"
              value={form.title}
              onChange={onChange}
              fullWidth
              required
              margin="normal"
            />
            <TextField
              name="lead"
              label="Mô tả (lead)"
              value={form.lead}
              onChange={onChange}
              fullWidth
              multiline
              rows={3}
              margin="normal"
            />

            <Card variant="outlined" sx={{ p: 2, mt: 2, display: "grid", gap: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Ảnh Hero
              </Typography>

              {form.imageUrl ? (
                <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                  <img
                    src={form.imageUrl}
                    referrerPolicy="no-referrer"
                    alt="preview"
                    style={{
                      width: 240,
                      height: 135,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.12)",
                    }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={pickFile} disabled={uploading}>
                      {uploading ? "Đang tải..." : "Thay ảnh (Upload)"}
                    </Button>
                    <Button variant="text" color="error" onClick={clearImage} disabled={uploading}>
                      Xoá ảnh
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button variant="outlined" onClick={pickFile} disabled={uploading}>
                    {uploading ? "Đang tải..." : "Chọn ảnh từ máy (Upload)"}
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    PNG/JPG/WebP • ≤ 10MB. Sau khi chọn sẽ tự upload.
                  </Typography>
                </Stack>
              )}

              {/* file input ẩn */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {/* Dán URL nếu muốn */}
              <TextField
                name="imageUrl"
                label="Ảnh (URL)"
                value={form.imageUrl}
                onChange={onChange}
                fullWidth
                margin="normal"
                helperText="Có thể dán URL ảnh trực tiếp nếu đã có."
              />
              <TextField
                name="imageAlt"
                label="Mô tả ảnh (alt)"
                value={form.imageAlt}
                onChange={onChange}
                fullWidth
                margin="normal"
              />
            </Card>

            <Stack direction="row" spacing={2} mt={3}>
              <Button
                variant="contained"
                onClick={onSave}
                disabled={saving || uploading || isFetching}
                sx={{ backgroundColor: "#1976d2", "&:hover": { backgroundColor: "#1565c0" } }}
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
              <Button variant="outlined" onClick={() => refetch()} disabled={isFetching || saving}>
                Tải lại
              </Button>
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Typography variant="h6" gutterBottom>
              Preview
            </Typography>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h4" gutterBottom>
                {form.title || "Tiêu đề sẽ hiển thị tại đây"}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {form.lead || "Mô tả (lead) sẽ hiển thị tại đây"}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box
                sx={{
                  width: "100%",
                  aspectRatio: "16/9",
                  overflow: "hidden",
                  borderRadius: 2,
                  boxShadow: 1,
                  bgcolor: "#f5f5f5",
                }}
              >
                {/* eslint-disable-next-line */}
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.imageAlt || "Hero image"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "text.secondary",
                      fontSize: 14,
                    }}
                  >
                    Chưa có ảnh
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
}
