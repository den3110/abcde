import React, { useMemo, useRef, useState } from "react";
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
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
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

/* ============ Helpers ============ */
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
const cryptoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ============ Component ============ */
const FilesManager = () => {
  const fileRef = useRef(null);
  const [picked, setPicked] = useState([]);
  const [category, setCategory] = useState("app");
  const [q, setQ] = useState("");

  // DataGrid pagination model (0-based)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const limit = paginationModel.pageSize;
  const page = paginationModel.page + 1; // API 1-based

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
  const [tasks, setTasks] = useState([]); // [{id,name,pct,bps,eta,status}]

  const onPick = (e) => {
    setError("");
    setOk("");
    const files = [...(e.target.files || [])];
    setPicked(files);
  };

  const pushTask = (name) => {
    const id = cryptoId();
    setTasks((arr) => [{ id, name, pct: 0, bps: 0, eta: Infinity, status: "uploading" }, ...arr]);
    return id;
  };
  const updateTask = (id, patch) =>
    setTasks((arr) => arr.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const cleanupTasksLater = () =>
    setTimeout(() => setTasks((arr) => arr.filter((t) => t.status === "uploading")), 3000);

  /* ===== Chunk upload via slice (song song từng chunk) ===== */
  const uploadOneFile = async (
    file,
    {
      category,
      chunkSize = 8 * 1024 * 1024,
      parallel = 4,
      withChecksum = false,
      onProgress = () => {},
    } = {}
  ) => {
    // 1) init
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

    // 2) chia parts
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

    // chạy song song N worker
    const workers = Array.from({ length: Math.min(parallel, totalParts || 1) }, () => worker());
    await Promise.all(workers);

    // 3) complete
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

      // lần lượt từng file (mỗi file tự song song theo chunk)
      for (const f of picked) {
        const taskId = pushTask(f.name);
        try {
          // eslint-disable-next-line no-await-in-loop
          await uploadOneFile(f, {
            category,
            chunkSize: 8 * 1024 * 1024,
            parallel: 4,
            withChecksum: false, // set true nếu cần bảo toàn dữ liệu tuyệt đối (tốn CPU)
            onProgress: ({ pct, bps, eta }) => updateTask(taskId, { pct, bps, eta }),
          });
          updateTask(taskId, { pct: 100, bps: 0, eta: 0, status: "done" });
          setOk((s) => (s ? `${s}, ${f.name}` : `Đã upload: ${f.name}`));
          // refresh list sau mỗi file
          // eslint-disable-next-line no-await-in-loop
          await refetch();
        } catch (e) {
          updateTask(taskId, { status: "error" });
          setError(e?.data?.message || e?.message || "Upload thất bại");
        }
      }

      setPicked([]);
      if (fileRef.current) fileRef.current.value = "";
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

  // DataGrid columns
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
    <DashboardLayout>
      <DashboardNavbar />
      <Stack spacing={2} sx={{ maxWidth: 1100, mx: "auto", px: 1 }}>
        <Card variant="outlined">
          <CardHeader
            title="Quản lý file public"
            subheader="Upload & tạo link công khai để tải về"
          />
          <CardContent sx={{ position: "relative" }}>
            {/* Scoped linear progress trong Card (fetch/delete) */}
            {/* {(isFetching || isDeleting) && (
              <Box sx={{ position: "absolute", left: 16, right: 16, top: 8 }}>
                <LinearProgress />
              </Box>
            )} */}

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

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              sx={{ pt: isFetching || isDeleting ? 2 : 0 }}
            >
              <TextField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                size="small"
                sx={{ width: { xs: "100%", sm: 200 } }}
                helperText="Ví dụ: app, doc, image"
              />
              <input ref={fileRef} type="file" multiple hidden onChange={onPick} />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileRef.current?.click()}
              >
                Chọn file
              </Button>
              <Button
                variant="contained"
                onClick={onUpload}
                disabled={!picked.length || tasks.some((t) => t.status === "uploading")}
              >
                Upload {picked.length ? `(${picked.length})` : ""}
              </Button>
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

            {/* Tiến độ upload (nằm gọn trong Card) */}
            {tasks.length > 0 && (
              <Stack spacing={1.2} sx={{ mt: 2 }}>
                {tasks.map((t) => (
                  <Card key={t.id} variant="outlined" sx={{ p: 1.2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap title={t.name} sx={{ fontWeight: 600 }}>
                          {t.name}
                        </Typography>
                        <LinearProgress variant="determinate" value={t.pct} sx={{ mt: 0.5 }} />
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

            {picked.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Sắp upload: {picked.map((f) => f.name).join(", ")}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* DataGrid trong Card riêng để overlay loading chỉ ở khu vực lưới */}
        <Card variant="outlined">
          <CardContent sx={{ pt: 1 }}>
            <Box
              sx={{
                width: "100%",
                "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": { outline: "none" },
              }}
            >
              <DataGrid
                autoHeight
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
                sx={{
                  "& .MuiDataGrid-overlayWrapper": { bgcolor: "transparent" },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </DashboardLayout>
  );
};

export default FilesManager;
