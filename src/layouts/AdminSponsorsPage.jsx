import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Box,
  Stack,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Edit,
  Link as LinkIcon,
  Refresh,
  ArrowUpward,
  ArrowDownward,
  Upload as UploadIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import {
  useGetSponsorsQuery,
  useCreateSponsorMutation,
  useUpdateSponsorMutation,
  useDeleteSponsorMutation,
} from "slices/sponsorsApiSlice";
import { useUploadAvatarMutation } from "slices/uploadApiSlice"; // ⬅️ dùng api slice upload có sẵn
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

const TIERS = ["Platinum", "Gold", "Silver", "Bronze", "Partner", "Media", "Other"];

// Ô logo nhỏ 16:9 cho DataGrid
function LogoCell({ src }) {
  return (
    <Box
      sx={{
        width: 90,
        height: 50, // gần 16:9
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      {src ? (
        // eslint-disable-next-line
        <img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <ImageIcon fontSize="small" />
      )}
    </Box>
  );
}

LogoCell.propTypes = {
  src: PropTypes.string,
};

export default function AdminSponsorsPage() {
  // Filters & pagination
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });

  const queryArgs = useMemo(
    () => ({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      search: search || undefined,
      tier: tier || undefined,
      featured: featuredOnly ? 1 : undefined,
      sort: "weight:desc,createdAt:desc",
    }),
    [paginationModel, search, tier, featuredOnly]
  );

  const { data, isFetching, refetch } = useGetSponsorsQuery(queryArgs, {
    refetchOnMountOrArgChange: true,
  });
  const rows = (data?.items || []).map((r) => ({ id: r._id, ...r }));
  const rowCount = data?.total || 0;

  // Mutations
  const [createSponsor, { isLoading: creating }] = useCreateSponsorMutation();
  const [updateSponsor, { isLoading: updating }] = useUpdateSponsorMutation();
  const [deleteSponsor, { isLoading: deleting }] = useDeleteSponsorMutation();
  const [uploadAvatar, { isLoading: uploading }] = useUploadAvatarMutation();

  // Dialog form state (single-file)
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    websiteUrl: "",
    refLink: "",
    tier: "Other",
    description: "",
    featured: false,
    weight: 0,
  });

  // Preview tạm bằng blob URL khi vừa chọn file
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      name: "",
      slug: "",
      logoUrl: "",
      websiteUrl: "",
      refLink: "",
      tier: "Other",
      description: "",
      featured: false,
      weight: 0,
    });
    setPreviewUrl("");
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      name: row.name || "",
      slug: row.slug || "",
      logoUrl: row.logoUrl || "",
      websiteUrl: row.websiteUrl || "",
      refLink: row.refLink || "",
      tier: row.tier || "Other",
      description: row.description || "",
      featured: !!row.featured,
      weight: row.weight ?? 0,
    });
    setPreviewUrl("");
    setFormOpen(true);
  };

  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const toast = (message, severity = "success") => setSnack({ open: true, message, severity });

  const submitForm = async () => {
    try {
      if (editItem?.id) {
        await updateSponsor({ id: editItem.id, ...form }).unwrap();
        toast("Đã cập nhật");
      } else {
        await createSponsor(form).unwrap();
        toast("Đã tạo mới");
      }
      setFormOpen(false);
    } catch (e) {
      toast(e?.data?.message || e?.message || "Lỗi lưu dữ liệu", "error");
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Xoá nhà tài trợ \"${row.name}\"?`)) return;
    try {
      await deleteSponsor(row.id).unwrap();
      toast("Đã xoá");
    } catch (e) {
      toast(e?.data?.message || e?.message || "Lỗi xoá", "error");
    }
  };

  const toggleFeatured = async (row) => {
    try {
      await updateSponsor({ id: row.id, featured: !row.featured }).unwrap();
    } catch (e) {
      toast(e?.data?.message || e?.message || "Lỗi cập nhật", "error");
    }
  };

  const bumpWeight = async (row, delta) => {
    const newW = (row.weight || 0) + delta;
    try {
      await updateSponsor({ id: row.id, weight: newW }).unwrap();
      toast("Đã cập nhật weight");
    } catch (e) {
      toast(e?.data?.message || e?.message || "Lỗi cập nhật", "error");
    }
  };

  // Upload handler (dùng RTK Query uploadAvatar)
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);
    try {
      const res = await uploadAvatar(file).unwrap();
      const url = res?.url || res?.secure_url || res?.path || res?.data?.url || res?.data?.path;
      if (url) setForm((s) => ({ ...s, logoUrl: url }));
      else toast("Upload thành công nhưng không nhận được URL", "warning");
    } catch (err) {
      toast(err?.data?.message || err?.message || "Upload thất bại", "error");
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "logo",
        headerName: "Logo",
        width: 110,
        sortable: false,
        renderCell: (p) => <LogoCell src={p.row.logoUrl} />,
      },
      { field: "name", headerName: "Tên", flex: 1, minWidth: 160 },
      {
        field: "tier",
        headerName: "Tier",
        width: 120,
        renderCell: (p) => <Chip size="small" label={p.value || "Other"} />,
      },
      {
        field: "featured",
        headerName: "Featured",
        width: 120,
        sortable: false,
        renderCell: (p) => (
          <FormControlLabel
            control={<Switch checked={!!p.row.featured} onChange={() => toggleFeatured(p.row)} />}
          />
        ),
      },
      { field: "weight", headerName: "Weight", width: 110 },
      {
        field: "links",
        headerName: "Link",
        width: 80,
        sortable: false,
        renderCell: (p) => (
          <Tooltip title={p.row.refLink || p.row.websiteUrl || ""}>
            <span>
              {(p.row.refLink || p.row.websiteUrl) && (
                <IconButton
                  size="small"
                  component="a"
                  href={p.row.refLink || p.row.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LinkIcon fontSize="inherit" />
                </IconButton>
              )}
            </span>
          </Tooltip>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        sortable: false,
        renderCell: (p) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Ưu tiên ↑">
              <IconButton size="small" onClick={() => bumpWeight(p.row, +1)}>
                <ArrowUpward fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Giảm ưu tiên ↓">
              <IconButton size="small" onClick={() => bumpWeight(p.row, -1)}>
                <ArrowDownward fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sửa">
              <IconButton size="small" onClick={() => openEdit(p.row)}>
                <Edit fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Xoá">
              <IconButton size="small" color="error" onClick={() => handleDelete(p.row)}>
                <Delete fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    []
  );

  const saving = creating || updating || deleting;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" fontWeight={800}>
              Quản lý nhà tài trợ
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()}>
                Refresh
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
                Thêm nhà tài trợ
              </Button>
            </Stack>
          </Stack>

          <Paper sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <TextField
                label="Tìm kiếm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <TextField
                label="Tier"
                select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                size="small"
                sx={{ width: 200 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {TIERS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={featuredOnly}
                    onChange={(e) => setFeaturedOnly(e.target.checked)}
                  />
                }
                label="Featured only"
              />
            </Stack>
            <Divider sx={{ my: 2 }} />
            <div style={{ width: "100%" }}>
              <DataGrid
                autoHeight
                rows={rows}
                columns={columns}
                loading={isFetching}
                rowCount={rowCount}
                pagination
                paginationMode="server"
                pageSizeOptions={[10, 20, 50, 100]}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                rowHeight={64}
                disableRowSelectionOnClick
              />
            </div>
          </Paper>
        </Stack>

        {/* SINGLE-FILE FORM DIALOG */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editItem ? "Cập nhật nhà tài trợ" : "Thêm nhà tài trợ"}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {/* Preview 16:9 */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Logo 16:9 (preview)
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    border: (t) => `1px dashed ${t.palette.divider}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {previewUrl || form.logoUrl ? (
                    // eslint-disable-next-line
                    <img
                      src={previewUrl || form.logoUrl}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <Stack spacing={1} alignItems="center">
                      <ImageIcon />
                      <Typography variant="caption" color="text.secondary">
                        Chưa có ảnh
                      </Typography>
                    </Stack>
                  )}
                </Box>
              </Box>

              {/* Upload & URL controls */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  component="label"
                  disabled={uploading}
                >
                  {uploading ? "Đang upload…" : "Tải ảnh từ máy"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onPickFile}
                  />
                </Button>
                <TextField
                  label="Logo URL"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  fullWidth
                  placeholder="https://..."
                />
              </Stack>
              {uploading && <LinearProgress />}

              <TextField
                label="Tên"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Slug (tuỳ chọn)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                fullWidth
              />
              <TextField
                label="Website URL"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                fullWidth
              />
              <TextField
                label="Link ref (ưu tiên)"
                value={form.refLink}
                onChange={(e) => setForm({ ...form, refLink: e.target.value })}
                fullWidth
              />
              <TextField
                label="Tier"
                select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                fullWidth
              >
                {TIERS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Mô tả"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    />
                  }
                  label="Featured"
                />
                <TextField
                  label="Weight (ưu tiên)"
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 0 })}
                  sx={{ width: 200 }}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Huỷ</Button>
            <Button
              onClick={submitForm}
              variant="contained"
              disabled={!form.name?.trim() || saving}
            >
              {saving ? "Đang lưu…" : editItem ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={2500}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          <Alert severity={snack.severity} variant="filled">
            {snack.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
