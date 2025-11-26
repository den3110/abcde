/* eslint-disable react/prop-types */
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
  Autocomplete,
  Checkbox,
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
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import {
  useGetSponsorsQuery,
  useCreateSponsorMutation,
  useUpdateSponsorMutation,
  useDeleteSponsorMutation,
} from "slices/sponsorsApiSlice";
import { useGetTournamentsQuery } from "slices/tournamentsApiSlice";
import { useUploadV2Mutation } from "slices/uploadApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

const TIERS = ["Platinum", "Gold", "Silver", "Bronze", "Partner", "Media", "Other"];
const ICON_UNCHECK = <CheckBoxOutlineBlankIcon fontSize="small" />;
const ICON_CHECKED = <CheckBoxIcon fontSize="small" />;

// ⚙️ cấu hình riêng cho logo nhà tài trợ dùng trên live overlay
const SPONSOR_LOGO_MAX_W = 100;
const SPONSOR_LOGO_MAX_H = 80;
const SPONSOR_LOGO_QUALITY = 80;

// Ô logo nhỏ 16:9 cho DataGrid
function LogoCell({ src }) {
  return (
    <Box
      sx={{
        width: 90,
        height: 50,
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
LogoCell.propTypes = { src: PropTypes.string };

export default function AdminSponsorsPage() {
  // ===== Filters & pagination =====
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });

  // ⬇️ filter theo giải
  const [tournamentFilter, setTournamentFilter] = useState(null); // { _id, name }
  const [tSearch, setTSearch] = useState("");

  const queryArgs = useMemo(
    () => ({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      search: search || undefined,
      tier: tier || undefined,
      featured: featuredOnly ? 1 : undefined,
      sort: "weight:desc,createdAt:desc",
      tournamentId: tournamentFilter?._id,
    }),
    [paginationModel, search, tier, featuredOnly, tournamentFilter]
  );

  const { data, isFetching, refetch } = useGetSponsorsQuery(queryArgs, {
    refetchOnMountOrArgChange: true,
  });
  const rows = (data?.items || []).map((r) => ({ id: r._id, ...r }));
  const rowCount = data?.total || 0;

  // tournaments options – slice trả { tournaments: [...] }
  const { data: tRes, isFetching: tLoading } = useGetTournamentsQuery({
    q: tSearch || "",
  });
  const tournamentOptions = useMemo(() => tRes?.tournaments || [], [tRes]);

  // ===== Mutations =====
  const [createSponsor, { isLoading: creating }] = useCreateSponsorMutation();
  const [updateSponsor, { isLoading: updating }] = useUpdateSponsorMutation();
  const [deleteSponsor, { isLoading: deleting }] = useDeleteSponsorMutation();
  const [uploadV2, { isLoading: uploading }] = useUploadV2Mutation();

  // ===== Dialog form =====
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
    tournamentIds: [],
  });
  const [selectedTournaments, setSelectedTournaments] = useState([]); // objects

  // Preview
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const openCreate = useCallback(() => {
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
      tournamentIds: [],
    });
    setSelectedTournaments([]);
    setPreviewUrl("");
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    setEditItem(row);
    const ts = Array.isArray(row.tournaments) ? row.tournaments.filter(Boolean) : [];
    setSelectedTournaments(ts);
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
      tournamentIds: ts.map((x) => x?._id).filter(Boolean),
    });
    setPreviewUrl("");
    setFormOpen(true);
  }, []);

  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const toast = useCallback(
    (message, severity = "success") => setSnack({ open: true, message, severity }),
    []
  );

  const submitForm = useCallback(async () => {
    try {
      const payload = { ...form, tournamentIds: form.tournamentIds || [] };
      if (editItem?.id) {
        await updateSponsor({ id: editItem.id, ...payload }).unwrap();
        toast("Đã cập nhật");
      } else {
        await createSponsor(payload).unwrap();
        toast("Đã tạo mới");
      }
      setFormOpen(false);
      refetch();
    } catch (e) {
      toast(e?.data?.message || e?.message || "Lỗi lưu dữ liệu", "error");
    }
  }, [form, editItem, updateSponsor, createSponsor, toast, refetch]);

  const handleDelete = useCallback(
    async (row) => {
      // eslint-disable-next-line no-alert
      if (!confirm(`Xoá nhà tài trợ "${row.name}"?`)) return;
      try {
        await deleteSponsor(row.id).unwrap();
        toast("Đã xoá");
        refetch();
      } catch (e) {
        toast(e?.data?.message || e?.message || "Lỗi xoá", "error");
      }
    },
    [deleteSponsor, toast, refetch]
  );

  const toggleFeatured = useCallback(
    async (row) => {
      try {
        await updateSponsor({ id: row.id, featured: !row.featured }).unwrap();
        refetch();
      } catch (e) {
        toast(e?.data?.message || e?.message || "Lỗi cập nhật", "error");
      }
    },
    [updateSponsor, toast, refetch]
  );

  const bumpWeight = useCallback(
    async (row, delta) => {
      const newW = (row.weight || 0) + delta;
      try {
        await updateSponsor({ id: row.id, weight: newW }).unwrap();
        toast("Đã cập nhật weight");
        refetch();
      } catch (e) {
        toast(e?.data?.message || e?.message || "Lỗi cập nhật", "error");
      }
    },
    [updateSponsor, toast, refetch]
  );

  // Upload handler – ép logo sponsor nhỏ lại cho overlay (webp 640x360)
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);

    try {
      const res = await uploadV2({
        file,
        format: "webp",
        width: SPONSOR_LOGO_MAX_W,
        height: SPONSOR_LOGO_MAX_H,
        quality: SPONSOR_LOGO_QUALITY,
      }).unwrap();

      const url = res?.url || res?.secure_url || res?.path || res?.data?.url || res?.data?.path;
      if (url) {
        setForm((s) => ({ ...s, logoUrl: url }));
      } else {
        toast("Upload thành công nhưng không nhận được URL", "warning");
      }
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
      {
        field: "name",
        headerName: "Tên",
        flex: 1,
        minWidth: 160,
        renderCell: (p) => (
          <Tooltip title={p.row.name || ""}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.row.name}
            </span>
          </Tooltip>
        ),
      },
      {
        field: "tier",
        headerName: "Tier",
        width: 120,
        renderCell: (p) => <Chip size="small" label={p.value || "Other"} />,
      },
      {
        field: "tournaments",
        headerName: "Giải đấu",
        flex: 1.2,
        minWidth: 260,
        sortable: false,
        renderCell: (p) => {
          const ts = Array.isArray(p.row.tournaments) ? p.row.tournaments.filter(Boolean) : [];
          const visible = ts.slice(0, 2);
          const hidden = ts.slice(2);
          const more = hidden.length;

          return (
            <Stack direction="row" spacing={0.5} sx={{ overflow: "hidden", alignItems: "center" }}>
              {visible.map((t) => (
                <Chip
                  key={t._id}
                  size="small"
                  label={t.name}
                  sx={{
                    maxWidth: 160,
                    "& .MuiChip-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 140,
                    },
                  }}
                  title={t.name}
                />
              ))}

              {more > 0 && (
                <Tooltip
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        Các giải khác:
                      </Typography>
                      <Stack sx={{ mt: 0.5, maxWidth: 320 }}>
                        {hidden.map((t) => (
                          <Typography
                            key={t._id}
                            variant="body2"
                            sx={{ lineHeight: 1.3, wordBreak: "break-word" }}
                          >
                            • {t.name}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  }
                >
                  <Chip size="small" label={`+${more}`} />
                </Tooltip>
              )}
            </Stack>
          );
        },
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
        width: 180,
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
    [toggleFeatured, bumpWeight, openEdit, handleDelete]
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

              {/* filter theo Giải đấu */}
              <Autocomplete
                sx={{ minWidth: 260 }}
                size="small"
                options={tournamentOptions}
                loading={tLoading}
                value={tournamentFilter}
                onChange={(_, v) => setTournamentFilter(v)}
                inputValue={tSearch}
                onInputChange={(_, v) => setTSearch(v)}
                filterOptions={(x) => x} // không lọc client, giữ nguyên list từ server
                openOnFocus
                isOptionEqualToValue={(o, v) => o?._id === v?._id}
                getOptionLabel={(o) => o?.name || ""}
                noOptionsText={tLoading ? "Đang tải..." : "Không có giải nào"}
                renderInput={(params) => <TextField {...params} label="Lọc theo giải đấu" />}
              />
              {tournamentFilter && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<ClearIcon />}
                  onClick={() => setTournamentFilter(null)}
                >
                  Bỏ lọc
                </Button>
              )}

              <FormControlLabel
                sx={{ ml: { xs: 0, sm: "auto" } }}
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

        {/* FORM DIALOG */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{editItem ? "Cập nhật nhà tài trợ" : "Thêm nhà tài trợ"}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {/* Preview 16:9 */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Logo 16:9 (preview) – sẽ được nén về {SPONSOR_LOGO_MAX_W}×{SPONSOR_LOGO_MAX_H}{" "}
                  WebP để dùng trên live
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

              {/* Upload & URL */}
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

              {/* CHỌN NHIỀU GIẢI ĐẤU */}
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={tournamentOptions}
                loading={tLoading}
                value={selectedTournaments}
                onChange={(_, list) => {
                  setSelectedTournaments(list);
                  setForm((s) => ({
                    ...s,
                    tournamentIds: list.map((o) => o?._id).filter(Boolean),
                  }));
                }}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?._id === v?._id}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox icon={ICON_UNCHECK} checkedIcon={ICON_CHECKED} checked={selected} />
                    {option.name}
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Áp dụng cho giải đấu" />}
              />

              {/* Chips đã chọn (xoá nhanh) */}
              {!!selectedTournaments.length && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedTournaments.map((t) => (
                    <Chip
                      key={t._id}
                      label={t.name}
                      onDelete={() => {
                        const list = selectedTournaments.filter((x) => x._id !== t._id);
                        setSelectedTournaments(list);
                        setForm((s) => ({ ...s, tournamentIds: list.map((o) => o._id) }));
                      }}
                    />
                  ))}
                </Stack>
              )}

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
