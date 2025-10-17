// ConfigManager.jsx (MUI X Data Grid version) — Resync + Delete + Export/Import
import * as React from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  InputAdornment,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress as MUILinearProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import LockIcon from "@mui/icons-material/Lock";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";

import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

import {
  useGetConfigsQuery,
  useGetConfigQuery,
  useLazyGetConfigQuery,
  useUpsertConfigMutation,
  useTriggerFbResyncMutation,
  useDeleteConfigMutation,
} from "slices/configApiSlice";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";

const RESERVED_ENV_ONLY = new Set(["LIVE_ENCRYPTION", "LIVE_SECRET_KEY_BASE64"]);

export default function ConfigManager() {
  const { data, isFetching, refetch, error } = useGetConfigsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [preview, setPreview] = React.useState(null); // { key, value }
  const [edit, setEdit] = React.useState(null); // { key, isNew? }
  const [err, setErr] = React.useState("");
  const [okSnack, setOkSnack] = React.useState(""); // success snackbar

  const [deleteKey, setDeleteKey] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);

  const [triggerResync, { isLoading: resyncing }] = useTriggerFbResyncMutation();
  const [doDelete] = useDeleteConfigMutation();
  const [getOne] = useLazyGetConfigQuery(); // dùng cho export
  const [saveCfg] = useUpsertConfigMutation(); // dùng cho import

  // Import states
  const fileInputRef = React.useRef(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importFileName, setImportFileName] = React.useState("");
  const [importItems, setImportItems] = React.useState([]); // [{key, value, isSecret, status}]
  const [importing, setImporting] = React.useState(false);
  const [importDone, setImportDone] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);

  const rows = React.useMemo(() => {
    const items = data?.items || [];
    return items.map((r) => ({ id: r.key, ...r }));
  }, [data]);

  const columns = React.useMemo(
    () => [
      {
        field: "key",
        headerName: "Key",
        width: 320,
        renderCell: (params) => {
          const val = params.value;
          const isReserved = RESERVED_ENV_ONLY.has(val);
          return (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              {isReserved && <LockIcon fontSize="small" color="action" />}
              <Typography fontWeight={600} noWrap title={val}>
                {val}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "value",
        headerName: "Value",
        flex: 1,
        minWidth: 320,
        sortable: false,
        renderCell: (params) => {
          const v = params.value;
          return (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: "100%",
              }}
              title={v || "—"}
            >
              {v || <i style={{ opacity: 0.6 }}>—</i>}
            </Typography>
          );
        },
      },
      {
        field: "isSecret",
        headerName: "Secret?",
        width: 120,
        type: "boolean",
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.value ? "Yes" : "No"}
            color={params.value ? "warning" : "default"}
            variant={params.value ? "filled" : "outlined"}
          />
        ),
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: 220,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : "—"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 260,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const r = params.row;
          const isReserved = RESERVED_ENV_ONLY.has(r.key);
          return (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Xem đầy đủ (chỉ secret)">
                <span>
                  <PreviewSecretButton
                    disabled={!r.isSecret}
                    k={r.key}
                    onError={setErr}
                    onPreview={(val) => setPreview({ key: r.key, value: String(val ?? "") })}
                  />
                </span>
              </Tooltip>
              <Tooltip title={isReserved ? "Key chỉ đổi qua ENV" : "Sửa"}>
                <span>
                  <IconButton onClick={() => setEdit({ key: r.key })} disabled={isReserved}>
                    <EditIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isReserved ? "Key ENV — không thể xoá" : "Xoá key"}>
                <span>
                  <IconButton
                    color="error"
                    disabled={isReserved}
                    onClick={() => setDeleteKey(r.key)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    []
  );

  async function handleResyncNow() {
    try {
      const r = await triggerResync("now").unwrap();
      setOkSnack(
        r?.resync?.mode === "now"
          ? "Resync chạy ngay: prune + sync + sweep (xem logs server)."
          : "Đã lên lịch resync."
      );
      refetch();
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Resync failed");
    }
  }

  async function confirmDelete() {
    if (!deleteKey) return;
    setDeleting(true);
    try {
      await doDelete(deleteKey).unwrap();
      setOkSnack(`Đã xoá key: ${deleteKey}`);
      setDeleteKey(null);
      refetch();
    } catch (e) {
      setErr(e?.data?.message || e?.error || e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // ------- EXPORT -------
  async function handleExport() {
    try {
      const items = data?.items || [];
      if (!items.length) {
        setErr("Không có config để export.");
        return;
      }
      // Lấy full value (không mask) qua /admin/config/:key
      const out = [];
      for (const it of items) {
        try {
          const full = await getOne(it.key, { preferCacheValue: false }).unwrap();
          out.push({
            key: it.key,
            value: full?.value ?? "",
            isSecret: !!it.isSecret,
            updatedAt: it.updatedAt || null,
          });
        } catch (e) {
          // fallback nếu lỗi
          out.push({
            key: it.key,
            value: "",
            isSecret: !!it.isSecret,
            error: e?.data?.message || e?.error || e?.message || "fetch failed",
          });
        }
      }
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), items: out }, null, 2)],
        {
          type: "application/json;charset=utf-8",
        }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `config-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOkSnack("Đã export file cấu hình.");
    } catch (e) {
      setErr(e?.data?.message || e?.error || e?.message || "Export failed");
    }
  }

  // ------- IMPORT -------
  function pickImportFile() {
    fileInputRef.current?.click();
  }
  async function onPickFile(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportFileName(file.name);
      const txt = await file.text();
      let json = null;
      try {
        json = JSON.parse(txt);
      } catch {
        throw new Error("File không phải JSON hợp lệ.");
      }

      let items = [];
      if (Array.isArray(json)) {
        items = json;
      } else if (json && Array.isArray(json.items)) {
        items = json.items;
      } else {
        // có thể là object map
        items = Object.entries(json || {}).map(([k, v]) => ({
          key: k,
          value: typeof v === "object" && v !== null && "value" in v ? v.value : v,
          isSecret: typeof v === "object" && v !== null && "isSecret" in v ? !!v.isSecret : false,
        }));
      }

      // normalize + lọc
      const norm = items
        .map((x) => ({
          key: String(x.key || "").trim(),
          value: String(x.value ?? ""),
          isSecret: !!x.isSecret,
          status: "pending",
          note: "",
          skipped: RESERVED_ENV_ONLY.has(String(x.key || "").trim()),
        }))
        .filter((x) => !!x.key);

      if (!norm.length) throw new Error("Không có item hợp lệ trong file.");

      setImportItems(norm);
      setImportOpen(true);
      setImportDone(false);
      setImportProgress(0);
      e.target.value = "";
    } catch (er) {
      setErr(er?.message || "Import: đọc file thất bại");
    }
  }

  async function runImport() {
    if (!importItems.length) return;
    setImporting(true);
    setImportDone(false);
    try {
      let done = 0;
      const total = importItems.length;
      const next = [...importItems];

      for (let i = 0; i < next.length; i++) {
        const item = next[i];
        if (item.skipped) {
          item.status = "skipped";
          item.note = "ENV only – bỏ qua";
          done++;
          setImportProgress(Math.round((done / total) * 100));
          setImportItems([...next]);
          continue;
        }
        try {
          await saveCfg({ key: item.key, value: item.value, isSecret: item.isSecret }).unwrap();
          item.status = "ok";
          item.note = "";
        } catch (e) {
          item.status = "error";
          item.note = e?.data?.message || e?.error || e?.message || "Save failed";
        }
        done++;
        setImportProgress(Math.round((done / total) * 100));
        setImportItems([...next]);
      }

      setImportDone(true);
      setOkSnack("Import xong. Đã upsert các key hợp lệ.");
      // refetch bảng
      refetch();
    } catch (e) {
      setErr(e?.data?.message || e?.error || e?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box>
        {/* Header actions */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h5">System Config</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Export tất cả config (bao gồm secret, không mask)">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExport}
                  disabled={isFetching}
                >
                  Export
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Import từ file JSON (upsert)">
              <span>
                <Button variant="outlined" startIcon={<FileUploadIcon />} onClick={pickImportFile}>
                  Import
                </Button>
              </span>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={onPickFile}
            />

            <Tooltip title="Resync FB Tokens (prune + sync + sweep)">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<AutorenewIcon />}
                  onClick={handleResyncNow}
                  disabled={resyncing}
                >
                  {resyncing ? "Resync…" : "Resync FB"}
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEdit({ key: "", isNew: true })}
            >
              Thêm key
            </Button>
            <Tooltip title="Reload">
              <IconButton onClick={refetch}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Paper sx={{ overflow: "hidden" }}>
          {isFetching && <LinearProgress />}
          <DataGrid
            rows={rows}
            columns={columns}
            loading={isFetching}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
              density: "standard",
            }}
            slots={{ toolbar: QuickToolbar }}
            slotProps={{
              toolbar: {
                onAdd: () => setEdit({ key: "", isNew: true }),
                onReload: refetch,
              },
            }}
            sx={{
              "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
                outline: "none",
              },
            }}
          />
        </Paper>

        {edit && (
          <EditDialog
            open
            onClose={() => setEdit(null)}
            isNew={!!edit.isNew}
            keyName={edit.key}
            onSaved={refetch}
            onError={setErr}
          />
        )}

        {/* Delete confirm dialog */}
        <Dialog open={Boolean(deleteKey)} onClose={() => setDeleteKey(null)}>
          <DialogTitle>Xoá key cấu hình</DialogTitle>
          <DialogContent>
            <Typography>
              Bạn có chắc chắn muốn xoá key <b>{deleteKey}</b>? Hành động này không thể hoàn tác.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteKey(null)}>Huỷ</Button>
            <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Đang xoá…" : "Xoá"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Import dialog */}
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          fileName={importFileName}
          items={importItems}
          progress={importProgress}
          importing={importing}
          done={importDone}
          onImport={runImport}
        />

        {/* Preview secret value */}
        {preview && (
          <Snackbar
            open
            onClose={() => setPreview(null)}
            autoHideDuration={8000}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setPreview(null)}
              severity="info"
              variant="filled"
              sx={{ whiteSpace: "pre-wrap", maxWidth: 800 }}
            >
              <b>{preview.key}</b>: {preview.value}
            </Alert>
          </Snackbar>
        )}

        {/* Success snackbar */}
        <Snackbar open={!!okSnack} autoHideDuration={4000} onClose={() => setOkSnack("")}>
          <Alert severity="success" variant="filled" onClose={() => setOkSnack("")}>
            {okSnack}
          </Alert>
        </Snackbar>

        {/* Error snackbar */}
        <Snackbar open={!!error || !!err} autoHideDuration={4000} onClose={() => setErr("")}>
          <Alert severity="error" variant="filled" onClose={() => setErr("")}>
            {error?.data?.message || error?.error || err}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}

/** Toolbar tuỳ biến */
function QuickToolbar(props) {
  return (
    <GridToolbarContainer
      sx={{
        px: 1,
        py: 0.5,
        gap: 1,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
      <Box sx={{ flex: 1 }} />
      <GridToolbarQuickFilter
        quickFilterParser={(input) =>
          input
            .split(" ")
            .map((v) => v.trim())
            .filter((v) => v !== "")
        }
        quickFilterProps={{ debounceMs: 300, placeholder: "Tìm kiếm key/value…" }}
      />
      <Tooltip title="Reload">
        <IconButton onClick={props.onReload}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={props.onAdd}>
        Thêm key
      </Button>
    </GridToolbarContainer>
  );
}
QuickToolbar.propTypes = {
  onReload: PropTypes.func,
  onAdd: PropTypes.func,
};

/** Nút preview secret */
function PreviewSecretButton({ k, disabled, onPreview, onError }) {
  const [trigger, { isFetching }] = useLazyGetConfigQuery();

  const handle = async () => {
    try {
      const data = await trigger(k, { preferCacheValue: false }).unwrap();
      onPreview?.(data?.value);
    } catch (e) {
      onError?.(e?.data?.message || e?.message || "Preview failed");
    }
  };
  return (
    <IconButton onClick={handle} disabled={disabled || isFetching}>
      {isFetching ? <CircularProgress size={18} /> : <VisibilityIcon />}
    </IconButton>
  );
}
PreviewSecretButton.propTypes = {
  k: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  onPreview: PropTypes.func,
  onError: PropTypes.func,
};

/** Dialog thêm/sửa */
function EditDialog({ open, onClose, isNew, keyName, onSaved, onError }) {
  const [form, setForm] = React.useState({ key: keyName || "", value: "", isSecret: false });
  const { data, isFetching } = useGetConfigQuery(keyName, { skip: isNew || !keyName });
  const [save, { isLoading: saving }] = useUpsertConfigMutation();
  const isReserved = RESERVED_ENV_ONLY.has((form.key || keyName || "").trim());

  React.useEffect(() => {
    if (isNew || !keyName) return;
    setForm((f) => ({ ...f, key: keyName, value: String(data?.value ?? ""), isSecret: false }));
  }, [isNew, keyName, data]);

  async function handleSave() {
    try {
      const k = (form.key || "").trim();
      if (!k) throw new Error("Key không được trống");
      if (RESERVED_ENV_ONLY.has(k)) throw new Error(`${k} chỉ đổi qua ENV và cần restart server.`);
      await save({ key: k, value: form.value ?? "", isSecret: !!form.isSecret }).unwrap();
      onSaved?.();
      onClose?.();
    } catch (e) {
      onError?.(e?.data?.message || e?.message || "Save failed");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isNew ? "Thêm cấu hình" : `Sửa: ${keyName}`}</DialogTitle>
      {isFetching && <LinearProgress />}
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Key"
            fullWidth
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            disabled={!isNew}
            InputProps={
              RESERVED_ENV_ONLY.has((form.key || "").trim())
                ? {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }
                : undefined
            }
          />
          <TextField
            label="Value"
            fullWidth
            multiline
            minRows={3}
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            placeholder="Giá trị. Nếu chọn Secret, server sẽ mã hoá khi lưu."
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!form.isSecret}
                onChange={(e) => setForm((f) => ({ ...f, isSecret: e.target.checked }))}
              />
            }
            label="Lưu dưới dạng Secret (mã hoá & mask ở danh sách)"
          />
          {isReserved && (
            <Alert severity="warning">
              Key này chỉ được cấu hình qua biến môi trường (ENV) và cần restart server.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <Button onClick={handleSave} disabled={saving || isReserved} variant="contained">
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
EditDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  isNew: PropTypes.bool,
  keyName: PropTypes.string,
  onSaved: PropTypes.func,
  onError: PropTypes.func,
};

/** Dialog import */
function ImportDialog({ open, onClose, fileName, items, progress, importing, done, onImport }) {
  const total = items.length;
  const ok = items.filter((x) => x.status === "ok").length;
  const skipped = items.filter((x) => x.status === "skipped").length;
  const failed = items.filter((x) => x.status === "error").length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Import config từ file</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            File: <b>{fileName || "—"}</b>
          </Typography>
          {!!total && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Tổng {total} key. Những key thuộc nhóm ENV-only sẽ bị bỏ qua tự động.
            </Typography>
          )}
          {importing && (
            <>
              <MUILinearProgress variant="determinate" value={progress} />
              <Typography variant="caption">{progress}%</Typography>
            </>
          )}
          {!importing && !!total && (
            <Box
              sx={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 1,
                p: 1,
                maxHeight: 240,
                overflow: "auto",
                fontFamily: "monospace",
                fontSize: 12,
                background: "#fafafa",
              }}
            >
              {items.slice(0, 200).map((x, idx) => (
                <div key={idx}>
                  {x.key} — {x.isSecret ? "secret" : "plain"} {x.skipped ? "(skip ENV-only)" : ""}
                  {x.status === "ok" && "  ✅"}
                  {x.status === "error" && `  ❌ ${x.note || ""}`}
                </div>
              ))}
              {items.length > 200 && <div>… ({items.length - 200} more)</div>}
            </Box>
          )}
          {done && (
            <Typography variant="body2">
              Kết quả: <b>{ok} OK</b>
              {skipped ? `, ${skipped} skipped` : ""}
              {failed ? `, ${failed} lỗi` : ""}.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importing}>
          Đóng
        </Button>
        <Button onClick={onImport} variant="contained" disabled={importing || !items.length}>
          {importing ? "Đang import…" : "Bắt đầu import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
ImportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  fileName: PropTypes.string,
  items: PropTypes.array.isRequired,
  progress: PropTypes.number.isRequired,
  importing: PropTypes.bool.isRequired,
  done: PropTypes.bool.isRequired,
  onImport: PropTypes.func.isRequired,
};
