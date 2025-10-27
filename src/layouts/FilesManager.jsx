// src/pages/admin/FilesManager.jsx
// Full rewrite: File Public Manager + khu "Cập nhật dữ liệu SPC (.txt)" với UI đẹp hơn

import React, { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Stack,
  Card,
  CardHeader,
  CardContent,
  Button,
  TextField,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Chip,
  InputAdornment,
  Typography,
  Divider,
  CircularProgress,
  Grid,
} from "@mui/material";

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import StorageIcon from "@mui/icons-material/Storage";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import UpdateIcon from "@mui/icons-material/Update";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";

import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

import {
  useListFilesQuery,
  useDeleteFileMutation,
  useMultipartInitMutation,
  useMultipartUploadPartMutation,
  useMultipartCompleteMutation,
} from "slices/filesApiSlice";

// === SPC hooks (đã tạo ở slices/spcApiSlice.js) ===
import { useGetSpcMetaQuery, useGetSpcSampleQuery, useUploadSpcMutation } from "slices/spcApiSlice";

/* ================= Helpers chung ================= */
function sizeFmt(n) {
  if (!n && n !== 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)} ${units[i]}`;
}
const speedFmt = (bytesPerSec) => {
  if (!bytesPerSec) return "—";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let i = 0;
  let v = bytesPerSec;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};
const etaFmt = (sec) => {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
};
const dt = (s) => (s ? new Date(s).toLocaleString("vi-VN") : "—");
const cryptoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ================= Reusable DropZone ================= */
function DropZone({
  accept = "*/*",
  multiple = false,
  onFiles = () => {},
  placeholder = "Kéo & thả file vào đây, hoặc bấm để chọn…",
  subtext = "",
  icon = <CloudUploadIcon sx={{ fontSize: 36 }} />,
  sx = {},
  inputRefExternal,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => (inputRefExternal?.current || inputRef.current)?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!multiple && files.length > 1) {
      onFiles([files[0]]);
    } else {
      onFiles(files);
    }
  };
  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!multiple && files.length > 1) {
      onFiles([files[0]]);
    } else {
      onFiles(files);
    }
  };

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={openPicker}
      sx={{
        borderRadius: 2,
        border: "1.5px dashed",
        borderColor: dragOver ? "primary.main" : "divider",
        bgcolor: dragOver ? "action.hover" : "background.default",
        p: 2.5,
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s ease",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        ...sx,
      }}
    >
      <Stack alignItems="center" spacing={1}>
        {icon}
        <Typography variant="body1" fontWeight={600}>
          {placeholder}
        </Typography>
        {subtext ? (
          <Typography variant="caption" color="text.secondary">
            {subtext}
          </Typography>
        ) : null}
      </Stack>

      {/* hidden input */}
      <input
        ref={inputRefExternal || inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={handleChange}
      />
    </Box>
  );
}

DropZone.propTypes = {
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  onFiles: PropTypes.func,
  placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subtext: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  icon: PropTypes.node,
  // sx của MUI có thể là object/array/function — nới lỏng cho tiện:
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
  // ref có thể là callback hoặc object có { current }
  inputRefExternal: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

DropZone.defaultProps = {
  accept: "*/*",
  multiple: false,
  onFiles: () => {},
  placeholder: "Kéo & thả file vào đây, hoặc bấm để chọn…",
  subtext: "",
  icon: null, // nếu null sẽ dùng icon mặc định khi truyền vào DropZone
  sx: {},
  inputRefExternal: null,
};

/* =====================================================================
   KHU 1 — QUẢN LÝ FILE PUBLIC (polish UI)
===================================================================== */
const PublicFilesSection = () => {
  const pickerRef = useRef(null);
  const [picked, setPicked] = useState([]); // File[]
  const [category, setCategory] = useState("app");
  const [q, setQ] = useState("");

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const limit = paginationModel.pageSize;
  const page = paginationModel.page + 1;

  const { data, isFetching, refetch } = useListFilesQuery({ q, category, page, limit });
  const [deleteFile, { isLoading: isDeleting }] = useDeleteFileMutation();

  const [multipartInit] = useMultipartInitMutation();
  const [multipartUploadPart] = useMultipartUploadPartMutation();
  const [multipartComplete] = useMultipartCompleteMutation();

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const items = data?.items || [];
  const total = data?.total || 0;

  // upload task UI
  const [tasks, setTasks] = useState([]); // [{id,name,pct,bps,eta,status,size}]

  const onPickFiles = (files) => {
    setError("");
    setOk("");
    setPicked(files);
  };

  const pushTask = (name, size) => {
    const id = cryptoId();
    setTasks((arr) => [
      { id, name, size, pct: 0, bps: 0, eta: Infinity, status: "uploading" },
      ...arr,
    ]);
    return id;
  };
  const updateTask = (id, patch) =>
    setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const cleanupTasksLater = () =>
    setTimeout(() => setTasks((arr) => arr.filter((t) => t.status === "uploading")), 2500);

  /* ===== Chunk upload via slice ===== */
  const uploadOneFile = async (
    file,
    { category, chunkSize = 8 * 1024 * 1024, parallel = 4, withChecksum = false, onProgress }
  ) => {
    const init = await multipartInit({
      fileName: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      category,
      chunkSize,
    }).unwrap();

    const uploadId = init.uploadId;
    const useChunk = init.chunkSize || chunkSize;
    const totalParts = init.totalParts;

    const parts = [];
    for (let p = 1; p <= totalParts; p++) {
      const start = (p - 1) * useChunk;
      const end = Math.min(file.size, start + useChunk);
      parts.push({ p, start, end });
    }

    let uploadedBytes = 0;
    let lastBytes = 0;
    let lastTick = performance.now();

    const sha256Base64 = (blob) =>
      new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = reject;
        fr.onload = async () => {
          const h = await crypto.subtle.digest("SHA-256", fr.result);
          const b64 = btoa(String.fromCharCode(...new Uint8Array(h)));
          resolve(`sha256-${b64}`);
        };
        fr.readAsArrayBuffer(blob);
      });

    const worker = async () => {
      while (parts.length) {
        const job = parts.shift();
        if (!job) break;
        const { p, start, end } = job;
        const blob = file.slice(start, end);
        const contentRange = `bytes ${start}-${end - 1}/${file.size}`;
        const checksum = withChecksum ? await sha256Base64(blob) : undefined;

        let attempts = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await multipartUploadPart({
              uploadId,
              partNo: p,
              blob,
              contentRange,
              checksum,
              onUploadProgress: (e) => {
                const curNow = performance.now();
                const curBytes = uploadedBytes + (e.loaded || 0);
                const dt = (curNow - lastTick) / 1000;
                const dbytes = Math.max(0, curBytes - lastBytes);
                const bps = dt > 0 ? dbytes / dt : 0;
                const pct = Math.min(99, Math.floor((curBytes / file.size) * 100));
                onProgress({ pct, bps, eta: bps > 0 ? (file.size - curBytes) / bps : Infinity });
              },
            }).unwrap();

            uploadedBytes += blob.size;
            const curNow = performance.now();
            const dt = (curNow - lastTick) / 1000;
            const dbytes = Math.max(0, uploadedBytes - lastBytes);
            const bps = dt > 0 ? dbytes / dt : 0;
            lastTick = curNow;
            lastBytes = uploadedBytes;
            const pct = Math.min(99, Math.floor((uploadedBytes / file.size) * 100));
            onProgress({ pct, bps, eta: bps > 0 ? (file.size - uploadedBytes) / bps : Infinity });
            break;
          } catch (err) {
            attempts += 1;
            if (attempts >= 5) throw err;
            await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempts)));
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(parallel, totalParts || 1) }, () => worker());
    await Promise.all(workers);

    await multipartComplete(uploadId).unwrap();
    onProgress({ pct: 100, bps: 0, eta: 0 });
  };

  const onUpload = async () => {
    try {
      setError("");
      setOk("");
      if (!picked.length) {
        setError("Chưa chọn file nào");
        return;
      }

      // upload lần lượt từng file (mỗi file tự song song theo chunk)
      for (const f of picked) {
        const taskId = pushTask(f.name, f.size);
        try {
          // eslint-disable-next-line no-await-in-loop
          await uploadOneFile(f, {
            category,
            chunkSize: 8 * 1024 * 1024,
            parallel: 4,
            withChecksum: false,
            onProgress: ({ pct, bps, eta }) => updateTask(taskId, { pct, bps, eta }),
          });
          updateTask(taskId, { pct: 100, bps: 0, eta: 0, status: "done" });
          setOk((s) => (s ? `${s}, ${f.name}` : `Đã upload: ${f.name}`));
          // eslint-disable-next-line no-await-in-loop
          await refetch();
        } catch (e) {
          updateTask(taskId, { status: "error" });
          setError(e?.data?.message || e?.message || "Upload thất bại");
        }
      }

      setPicked([]);
      pickerRef.current && (pickerRef.current.value = "");
      cleanupTasksLater();
    } catch (e) {
      setError(e?.data?.message || e?.message || "Upload thất bại");
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Xoá file này?")) return;
    try {
      await deleteFile(id).unwrap();
      refetch();
    } catch (e) {
      setError(e?.data?.message || "Xoá thất bại");
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const columns = useMemo(
    () => [
      { field: "originalName", headerName: "Tên hiển thị", flex: 1.2, minWidth: 200 },
      {
        field: "mime",
        headerName: "Loại",
        width: 120,
        renderCell: (params) => (
          <Chip size="small" label={params.value?.split?.("/")?.[1] || params.value || "—"} />
        ),
        sortable: false,
        filterable: false,
      },
      {
        field: "size",
        headerName: "Kích thước",
        width: 120,
        valueGetter: (p) => sizeFmt(p.row.size),
        sortable: false,
        filterable: false,
      },
      {
        field: "createdAt",
        headerName: "Ngày tạo",
        width: 180,
        valueGetter: (p) => new Date(p.row.createdAt).toLocaleString(),
        sortComparator: (v1, v2) => new Date(v1).getTime() - new Date(v2).getTime(),
      },
      {
        field: "publicUrl",
        headerName: "Link",
        flex: 1.6,
        minWidth: 320,
        renderCell: (params) => {
          const url = params.value;
          return (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0, width: "100%" }}
            >
              <Typography variant="body2" noWrap sx={{ minWidth: 0, flex: 1 }} title={url}>
                {url}
              </Typography>
              <Tooltip title="Copy link">
                <IconButton size="small" onClick={() => copy(url)}>
                  <ContentCopyIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Mở link">
                <IconButton
                  size="small"
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNewIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        },
        sortable: false,
        filterable: false,
      },
      {
        field: "actions",
        headerName: "Hành động",
        width: 100,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Tooltip title="Xoá">
            <IconButton color="error" size="small" onClick={() => onDelete(params.row._id)}>
              <DeleteOutlineIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        ),
        sortable: false,
        filterable: false,
      },
    ],
    [] // stable
  );

  return (
    <Card variant="outlined">
      <CardHeader title="Quản lý file public" subheader="Upload & tạo link công khai để tải về" />
      <CardContent sx={{ position: "relative" }}>
        {(isFetching || isDeleting) && (
          <Box sx={{ position: "absolute", left: 16, right: 16, top: 8 }}>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {ok && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {ok}
          </Alert>
        )}

        {/* Upload area - đẹp hơn */}
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={7}>
            <DropZone
              inputRefExternal={pickerRef}
              multiple
              accept="*/*"
              onFiles={onPickFiles}
              placeholder="Kéo & thả nhiều file vào đây, hoặc bấm để chọn…"
              subtext="Các file sẽ được tải theo từng phần để ổn định."
              icon={<CloudUploadIcon sx={{ fontSize: 40 }} />}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={1}>
              <TextField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                size="small"
                helperText="Ví dụ: app, doc, image"
              />

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={onUpload}
                  disabled={!picked.length || tasks.some((t) => t.status === "uploading")}
                  startIcon={
                    tasks.some((t) => t.status === "uploading") ? (
                      <CircularProgress size={18} />
                    ) : (
                      <CloudUploadIcon />
                    )
                  }
                >
                  Upload {picked.length ? `(${picked.length})` : ""}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    setPicked([]);
                    if (pickerRef.current) pickerRef.current.value = "";
                  }}
                >
                  Xoá danh sách
                </Button>
                <Button variant="text" startIcon={<RefreshIcon />} onClick={() => refetch()}>
                  Làm mới danh sách
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>

        {/* Files picked preview */}
        {!!picked.length && (
          <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Sẽ tải lên:</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {picked.map((f) => (
                <Chip
                  key={f.name + f.size}
                  icon={<DescriptionIcon />}
                  label={`${f.name} • ${sizeFmt(f.size)}`}
                />
              ))}
            </Stack>
          </Stack>
        )}

        {/* Progress list */}
        {tasks.length > 0 && (
          <Stack spacing={1.2} sx={{ mt: 2 }}>
            {tasks.map((t) => (
              <Card key={t.id} variant="outlined" sx={{ p: 1.2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {t.status === "done" ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : t.status === "error" ? (
                        <ErrorOutlineIcon color="error" fontSize="small" />
                      ) : (
                        <CloudUploadIcon fontSize="small" />
                      )}
                      <Typography variant="body2" noWrap title={t.name} sx={{ fontWeight: 600 }}>
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        • {sizeFmt(t.size)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={t.pct}
                      sx={{ mt: 0.75, height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t.status === "uploading"
                        ? `Đang tải… ${t.pct}% • ${speedFmt(t.bps)} • ETA ${etaFmt(t.eta)}`
                        : t.status === "done"
                        ? "Hoàn tất"
                        : t.status === "cancelled"
                        ? "Đã huỷ"
                        : "Lỗi"}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        {/* DataGrid */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
          sx={{ mb: 1 }}
        >
          <Box flex={1} />
          <TextField
            size="small"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPaginationModel((m) => ({ ...m, page: 0 }));
            }}
            placeholder="Tìm theo tên"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        <Box
          sx={{
            width: "100%",
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": { outline: "none" },
          }}
        >
          <DataGrid
            autoHeight
            density="compact"
            rows={items}
            getRowId={(row) => row._id}
            columns={columns}
            rowCount={total}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 20, 50, 100]}
            disableRowSelectionOnClick
            loading={isFetching || isDeleting}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 400 } },
            }}
            sx={{ "& .MuiDataGrid-overlayWrapper": { bgcolor: "transparent" } }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

/* =====================================================================
   KHU 2 — CẬP NHẬT DỮ LIỆU SPC (.txt) — UI đẹp hơn
===================================================================== */
const SpcUploaderSection = () => {
  const spcPickerRef = useRef(null);
  const [spcFile, setSpcFile] = useState(null);
  const [spcMsg, setSpcMsg] = useState("");
  const [spcErr, setSpcErr] = useState("");

  const { data: meta, isFetching: loadingMeta, refetch: refetchMeta } = useGetSpcMetaQuery();
  const {
    data: sample,
    isFetching: loadingSample,
    refetch: refetchSample,
  } = useGetSpcSampleQuery(20);
  const [uploadSpc, { isLoading: uploading }] = useUploadSpcMutation();

  const onPickSpc = (files) => {
    setSpcErr("");
    setSpcMsg("");
    const f = files?.[0];
    if (!f) return setSpcFile(null);
    const okExt = /\.txt$/i.test(f.name);
    const okMime = /text\/plain|application\/json/.test(f.type || "");
    if (!okExt && !okMime) {
      setSpcErr("Chỉ chấp nhận file .txt chứa mảng JSON!");
      setSpcFile(null);
      return;
    }
    setSpcFile(f);
  };

  const onUploadSpc = async () => {
    if (!spcFile) {
      setSpcErr("Chưa chọn file .txt");
      return;
    }
    try {
      setSpcErr("");
      setSpcMsg("");
      const fd = new FormData();
      fd.append("file", spcFile);
      const res = await uploadSpc(fd).unwrap();
      setSpcMsg(`Đã cập nhật SPC: ${res?.meta?.count ?? "?"} dòng • ${sizeFmt(res?.meta?.size)}.`);
      setSpcFile(null);
      if (spcPickerRef.current) spcPickerRef.current.value = "";
      await refetchMeta();
      await refetchSample();
    } catch (e) {
      setSpcErr(e?.data?.message || e?.message || "Upload thất bại");
    }
  };

  const spcCols = useMemo(
    () => [
      { field: "ID", headerName: "ID", width: 100 },
      { field: "HoVaTen", headerName: "Họ và tên", flex: 1.2, minWidth: 200 },
      { field: "Phone", headerName: "SĐT", width: 140 },
      { field: "TinhThanh", headerName: "Tỉnh/TP", width: 160 },
      {
        field: "DiemDon",
        headerName: "Single",
        width: 110,
        valueGetter: (p) => p.row?.DiemDon ?? "—",
      },
      {
        field: "DiemDoi",
        headerName: "Double",
        width: 110,
        valueGetter: (p) => p.row?.DiemDoi ?? "—",
      },
      {
        field: "ThoiGianThamGia",
        headerName: "Tham gia",
        width: 180,
        valueGetter: (p) =>
          p.row?.ThoiGianThamGia
            ? new Date(p.row.ThoiGianThamGia).toLocaleDateString("vi-VN")
            : "—",
      },
    ],
    []
  );

  return (
    <Card variant="outlined">
      <CardHeader
        title="Cập nhật dữ liệu SportConnect (SPC)"
        subheader="Chỉ nhận file .txt (nội dung là mảng JSON các object)"
      />
      <CardContent>
        {(loadingMeta || uploading) && <LinearProgress sx={{ mb: 2 }} />}

        {spcErr && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {spcErr}
          </Alert>
        )}
        {spcMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {spcMsg}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <DropZone
              inputRefExternal={spcPickerRef}
              multiple={false}
              accept=".txt,text/plain,application/json"
              onFiles={onPickSpc}
              placeholder="Kéo & thả file SPC (.txt) vào đây, hoặc bấm để chọn…"
              subtext="Định dạng: mảng JSON các object như mẫu phía dưới."
              icon={<CloudUploadIcon sx={{ fontSize: 40 }} />}
            />

            {/* File đã chọn */}
            <Stack spacing={1} sx={{ mt: 1 }}>
              {spcFile ? (
                <Chip
                  icon={<DescriptionIcon />}
                  label={`${spcFile.name} • ${sizeFmt(spcFile.size)}`}
                  onDelete={() => {
                    setSpcFile(null);
                    spcPickerRef.current && (spcPickerRef.current.value = "");
                  }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Chưa chọn file
                </Typography>
              )}
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button
                variant="contained"
                onClick={onUploadSpc}
                disabled={!spcFile || uploading}
                startIcon={uploading ? <CircularProgress size={18} /> : <CloudUploadIcon />}
              >
                Tải lên & cập nhật
              </Button>

              <Tooltip title="Làm mới meta & sample">
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    refetchMeta();
                    refetchSample();
                  }}
                >
                  Làm mới
                </Button>
              </Tooltip>

              <Button
                variant="text"
                startIcon={<DownloadIcon />}
                component="a"
                href="/api/admin/spc/sample?limit=50"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tải sample JSON
              </Button>
            </Stack>
          </Grid>

          {/* Meta đẹp hơn */}
          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardHeader title="Thông tin dữ liệu" />
              <CardContent>
                <Stack spacing={1.25} flexWrap="wrap">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StorageIcon fontSize="small" />
                    <Typography variant="body2">
                      Bản ghi: <b>{meta?.count ?? 0}</b>
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DescriptionIcon fontSize="small" />
                    <Typography variant="body2">
                      Kích thước: <b>{sizeFmt(meta?.size || 0)}</b>
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <UpdateIcon fontSize="small" />
                    <Typography variant="body2">
                      Cập nhật: <b>{dt(meta?.updatedAt)}</b>
                    </Typography>
                  </Stack>
                  {meta?.sha256 ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FingerprintIcon fontSize="small" />
                      <Typography variant="body2" title={meta.sha256}>
                        SHA256: <b>{meta.sha256.slice(0, 12)}…</b>
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Sample grid */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Mẫu dữ liệu (20 dòng đầu)
        </Typography>
        <Box sx={{ width: "100%" }}>
          <DataGrid
            autoHeight
            density="compact"
            rows={sample?.items || []}
            getRowId={(r) => r.ID}
            columns={spcCols}
            disableRowSelectionOnClick
            loading={loadingSample}
            sx={{
              "& .MuiDataGrid-overlayWrapper": { bgcolor: "transparent" },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

/* =====================================================================
   PAGE WRAPPER — render 2 khu trong 1 trang
===================================================================== */
const FilesManager = () => {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Stack spacing={2} sx={{ maxWidth: 1100, mx: "auto", px: 1 }}>
        <PublicFilesSection />
        <SpcUploaderSection />
      </Stack>
    </DashboardLayout>
  );
};

export default FilesManager;
