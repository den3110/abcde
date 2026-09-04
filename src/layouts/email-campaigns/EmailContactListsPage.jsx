/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Delete, People, UploadFile, Visibility, Add } from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useGetContactListsQuery,
  useCreateContactListMutation,
  useDeleteContactListMutation,
  useAddContactsMutation,
  useGetContactsQuery,
  useDeleteContactMutation,
} from "slices/emailCampaignApiSlice";
import { parseContacts } from "utils/parseContacts";

const UPLOAD_BATCH = 3000;

function ImportDialog({ open, onClose, onDone }) {
  const fileRef = useRef(null);
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // {contacts, format}
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(null); // {done,total}
  const [result, setResult] = useState(null);

  const [createList] = useCreateContactListMutation();
  const [addContacts] = useAddContactsMutation();

  const reset = () => {
    setName(""); setFileName(""); setParsed(null); setErr(""); setProgress(null); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e) => {
    setErr(""); setParsed(null); setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    try {
      const text = await f.text();
      const p = parseContacts(text);
      if (!p.contacts.length) {
        setErr("Không tìm thấy email hợp lệ trong file.");
        return;
      }
      setParsed(p);
    } catch (e2) {
      setErr(`Không đọc được file: ${e2?.message || e2}`);
    }
  };

  const doImport = async () => {
    if (!name.trim()) return setErr("Nhập tên danh sách.");
    if (!parsed?.contacts?.length) return setErr("Chưa có liên hệ.");
    try {
      const list = await createList({ name: name.trim(), source: fileName }).unwrap();
      const contacts = parsed.contacts;
      let added = 0;
      let updated = 0;
      setProgress({ done: 0, total: contacts.length });
      for (let i = 0; i < contacts.length; i += UPLOAD_BATCH) {
        const slice = contacts.slice(i, i + UPLOAD_BATCH);
        // eslint-disable-next-line no-await-in-loop
        const r = await addContacts({ id: list._id, contacts: slice }).unwrap();
        added += r.added || 0;
        updated += r.updated || 0;
        setProgress({ done: Math.min(i + UPLOAD_BATCH, contacts.length), total: contacts.length });
      }
      setResult({ added, updated, total: contacts.length });
      onDone?.();
    } catch (e) {
      setErr(e?.data?.message || "Nhập thất bại");
    }
  };

  const preview = parsed?.contacts?.slice(0, 5) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nhập danh sách khách hàng</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Hỗ trợ file JSON (như tệp PickVN), CSV/TSV hoặc text. Hệ thống tự lọc email, tên, avatar,
          số điện thoại. Trùng email sẽ được gộp.
        </Alert>
        <Stack spacing={2}>
          <TextField label="Tên danh sách *" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth placeholder="VD: Khách hàng PickVN" />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" component="label" startIcon={<UploadFile />}>
              Chọn file
              <input ref={fileRef} type="file" hidden accept=".json,.csv,.tsv,.txt" onChange={handleFile} />
            </Button>
            {fileName ? <Chip label={fileName} onDelete={reset} /> : null}
          </Stack>

          {err ? <Alert severity="error">{err}</Alert> : null}

          {parsed ? (
            <>
              <Alert severity="success">
                Đọc được <b>{parsed.contacts.length.toLocaleString("vi-VN")}</b> liên hệ hợp lệ
                (định dạng: {parsed.format}).
              </Alert>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell>Avatar</TableCell><TableCell>Tên</TableCell><TableCell>Email</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((c) => (
                      <TableRow key={c.email}>
                        <TableCell><Avatar src={c.avatar} sx={{ width: 28, height: 28 }} /></TableCell>
                        <TableCell>{c.name || "—"}</TableCell>
                        <TableCell>{c.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          ) : null}

          {progress ? (
            <Box>
              <LinearProgress variant="determinate" value={Math.round((progress.done / progress.total) * 100)} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption">Đang tải {progress.done.toLocaleString("vi-VN")}/{progress.total.toLocaleString("vi-VN")}…</Typography>
            </Box>
          ) : null}

          {result ? (
            <Alert severity="success">
              Đã tạo danh sách · thêm mới <b>{result.added.toLocaleString("vi-VN")}</b>, cập nhật {result.updated.toLocaleString("vi-VN")}.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Đóng</Button>
        {!result ? (
          <Button variant="contained" onClick={doImport} disabled={!parsed || !!progress}>
            {progress ? "Đang nhập…" : "Tạo & nhập"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function ContactsDialog({ list, onClose }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, isFetching } = useGetContactsQuery(
    { id: list?._id, page, limit: 20, q },
    { skip: !list }
  );
  const [delContact] = useDeleteContactMutation();
  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <Dialog open={!!list} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{list?.name} · {total.toLocaleString("vi-VN")} liên hệ</DialogTitle>
      <DialogContent dividers>
        <TextField
          size="small" fullWidth placeholder="Tìm theo tên / email / SĐT"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} sx={{ mb: 2 }}
        />
        {isFetching ? <LinearProgress sx={{ mb: 1 }} /> : null}
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Avatar</TableCell><TableCell>Tên</TableCell><TableCell>Email</TableCell>
                <TableCell>SĐT</TableCell><TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c._id} sx={c.optOut ? { opacity: 0.5 } : null}>
                  <TableCell><Avatar src={c.avatar} sx={{ width: 30, height: 30 }} /></TableCell>
                  <TableCell>{c.name || "—"}{c.optOut ? <Chip size="small" label="Đã hủy nhận" sx={{ ml: 1 }} /> : null}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => delContact({ id: list._id, contactId: c._id })}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">Không có liên hệ.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Box>
        {pages > 1 ? (
          <Stack alignItems="center" mt={2}>
            <Pagination count={pages} page={page} onChange={(e, p) => setPage(p)} size="small" />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
    </Dialog>
  );
}

export default function EmailContactListsPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [viewList, setViewList] = useState(null);
  const { data } = useGetContactListsQuery();
  const [deleteList] = useDeleteContactListMutation();
  const lists = useMemo(() => data?.items || [], [data]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <People color="info" />
            <Typography variant="h4" fontWeight="bold">Danh sách khách hàng</Typography>
          </Stack>
          <Button variant="contained" color="info" startIcon={<Add />} onClick={() => setImportOpen(true)} sx={{ color: "#fff !important" }}>
            Nhập danh sách
          </Button>
        </Stack>
        <Typography variant="body2" color="text" mb={3}>
          Tạo nhiều tệp email khách hàng (VD: Khách hàng PickVN) để dùng khi gửi chiến dịch.
        </Typography>

        <Stack spacing={1.5}>
          {lists.length === 0 ? (
            <Card sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text">Chưa có danh sách nào. Bấm “Nhập danh sách” để tạo.</Typography>
            </Card>
          ) : null}
          {lists.map((l) => (
            <Card key={l._id} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h6">{l.name}</Typography>
                  <Typography variant="caption" color="text">
                    {(l.contactCount || 0).toLocaleString("vi-VN")} liên hệ
                    {l.source ? ` · nguồn: ${l.source}` : ""}
                    {" · "}{new Date(l.createdAt).toLocaleDateString("vi-VN")}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Xem liên hệ">
                    <IconButton onClick={() => setViewList(l)}><Visibility /></IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa danh sách">
                    <IconButton color="error" onClick={() => { if (window.confirm(`Xóa danh sách "${l.name}" và toàn bộ liên hệ?`)) deleteList(l._id); }}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      </MDBox>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => {}} />
      <ContactsDialog list={viewList} onClose={() => setViewList(null)} />

      <Footer />
    </DashboardLayout>
  );
}
