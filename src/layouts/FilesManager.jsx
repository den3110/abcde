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
import {
  useDeleteFileMutation,
  useListFilesQuery,
  useUploadFilesMutation,
} from "slices/filesApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

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

const FilesManager = () => {
  const fileRef = useRef(null);
  const [picked, setPicked] = useState([]);
  const [category, setCategory] = useState("app");
  const [q, setQ] = useState("");

  // DataGrid pagination model (0-based page index)
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 20,
  });

  const limit = paginationModel.pageSize;
  const page = paginationModel.page + 1; // API is 1-based

  const { data, isFetching, refetch } = useListFilesQuery({
    q,
    category,
    page,
    limit,
  });

  const [uploadFiles, { isLoading: isUploading }] = useUploadFilesMutation();
  const [deleteFile, { isLoading: isDeleting }] = useDeleteFileMutation();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const items = data?.items || [];
  const total = data?.total || 0;

  const onPick = (e) => {
    setError("");
    setOk("");
    const files = [...(e.target.files || [])];
    setPicked(files);
  };

  const onUpload = async () => {
    try {
      setError("");
      setOk("");
      if (!picked.length) {
        setError("Chưa chọn file nào");
        return;
      }
      const res = await uploadFiles({ files: picked, category }).unwrap();
      setOk(`Đã upload ${res.count} file`);
      setPicked([]);
      if (fileRef.current) fileRef.current.value = "";
      refetch();
    } catch (e) {
      setError(e?.data?.message || "Upload thất bại");
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
      {
        field: "originalName",
        headerName: "Tên hiển thị",
        flex: 1.2,
        minWidth: 200,
      },
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
            subheader="Upload nhiều file và tạo link công khai để tải về"
          />
          <CardContent sx={{ position: "relative" }}>
            {/* Scoped linear just inside this Card */}
            {/* {(isUploading || isFetching || isDeleting) && (
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
              sx={{ pt: isUploading || isFetching || isDeleting ? 2 : 0 }}
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
                disabled={!picked.length || isUploading}
              >
                Upload {picked.length ? `(${picked.length})` : ""}
              </Button>
              <Box flex={1} />
              <TextField
                size="small"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  // reset to first page when query changes
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

            {picked.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Sắp upload: {picked.map((f) => f.name).join(", ")}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Grid in its own card so loading stays scoped */}
        <Card variant="outlined">
          <CardContent sx={{ pt: 1 }}>
            <Box
              sx={{
                width: "100%",
                // autoHeight makes the grid size to rows; remove if you prefer fixed height:
                "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
                  outline: "none",
                },
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
                onPaginationModelChange={(model) => setPaginationModel(model)}
                pageSizeOptions={[10, 20, 50, 100]}
                disableRowSelectionOnClick
                loading={isFetching || isUploading || isDeleting}
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 400 },
                  },
                }}
                sx={{
                  // keep loading feedback INSIDE the grid area
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
