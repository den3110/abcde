/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Search,
  Refresh,
  Delete,
  Reply,
  ReplyAll,
  Forward,
  MarkEmailUnread,
  Edit,
  AttachFile,
  ArrowBack,
  ArrowForward,
} from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useGetMailboxAccountsQuery,
  useGetMailboxFoldersQuery,
  useGetMailboxMessagesQuery,
  useLazyGetMailboxMessageQuery,
  useMarkMailboxMessageMutation,
  useDeleteMailboxMessageMutation,
  useSendMailboxMessageMutation,
} from "slices/mailboxApiSlice";

const API = process.env.REACT_APP_API_URL;
const PAGE_SIZE = 25;

const FOLDER_LABEL = {
  inbox: "Hộp thư đến",
  sent: "Đã gửi",
  drafts: "Nháp",
  spam: "Spam",
  trash: "Thùng rác",
  archive: "Lưu trữ",
  other: null,
};

function fmtAddr(list) {
  if (!Array.isArray(list) || !list.length) return "";
  return list
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(", ");
}
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("vi-VN");
}
function tokenFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("userInfo") || "{}")?.token || "";
  } catch (_) {
    return "";
  }
}

function MailboxPage() {
  const { data: accData } = useGetMailboxAccountsQuery();
  const accounts = useMemo(() => (accData?.data || []).filter((a) => a.enabled !== false), [accData]);

  const [accId, setAccId] = useState("");
  useEffect(() => {
    if (!accId && accounts.length) setAccId(accounts[0].id);
  }, [accounts, accId]);

  const [folder, setFolder] = useState("INBOX");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: foldersData, refetch: refetchFolders } = useGetMailboxFoldersQuery(accId, {
    skip: !accId,
  });
  const folders = foldersData?.data || [];

  const {
    data: msgData,
    isFetching: loadingList,
    refetch: refetchList,
    error: listError,
  } = useGetMailboxMessagesQuery(
    { id: accId, folder, page, pageSize: PAGE_SIZE, search },
    { skip: !accId },
  );
  const messages = msgData?.messages || [];
  const total = msgData?.total || 0;

  const [fetchMessage, { data: openedData, isFetching: loadingMsg }] =
    useLazyGetMailboxMessageQuery();
  const opened = openedData?.data || null;
  const [openedUid, setOpenedUid] = useState(null);

  const [markMsg] = useMarkMailboxMessageMutation();
  const [deleteMsg] = useDeleteMailboxMessageMutation();
  const [sendMsg, { isLoading: sending }] = useSendMailboxMessageMutation();

  const [compose, setCompose] = useState(null); // {to,cc,subject,body,inReplyTo,references}
  const [composeError, setComposeError] = useState("");
  const [banner, setBanner] = useState("");

  // đổi hộp thư -> về INBOX
  useEffect(() => {
    setFolder("INBOX");
    setPage(1);
    setOpenedUid(null);
  }, [accId]);

  const openMessage = async (m) => {
    setOpenedUid(m.uid);
    await fetchMessage({ id: accId, folder, uid: m.uid, markSeen: 1 });
    // cập nhật số chưa đọc + trạng thái list
    setTimeout(() => {
      refetchFolders();
      refetchList();
    }, 400);
  };

  const onSelectFolder = (path) => {
    setFolder(path);
    setPage(1);
    setOpenedUid(null);
    setSearch("");
    setSearchInput("");
  };

  const doSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
    setOpenedUid(null);
  };

  const onDelete = async (m) => {
    if (!window.confirm("Xoá thư này?")) return;
    await deleteMsg({ id: accId, folder, uid: m.uid }).unwrap();
    setOpenedUid(null);
    refetchList();
    refetchFolders();
  };

  const onMarkUnread = async (m) => {
    await markMsg({ id: accId, folder, uid: m.uid, seen: false }).unwrap();
    refetchList();
    refetchFolders();
  };

  const acc = accounts.find((a) => a.id === accId);

  const startCompose = () => {
    setComposeError("");
    setCompose({ to: "", cc: "", subject: "", body: "", inReplyTo: "", references: "" });
  };
  const startReply = (all = false) => {
    if (!opened) return;
    const to = fmtAddr(opened.from);
    const cc = all ? fmtAddr(opened.to) : "";
    const subject = /^re:/i.test(opened.subject) ? opened.subject : `Re: ${opened.subject}`;
    const quoted = `\n\n\n----- Thư gốc từ ${fmtAddr(opened.from)} lúc ${fmtDate(
      opened.date,
    )} -----\n${opened.text || ""}`;
    setComposeError("");
    setCompose({
      to,
      cc,
      subject,
      body: quoted,
      inReplyTo: opened.messageId || "",
      references: opened.messageId || "",
    });
  };
  const startForward = () => {
    if (!opened) return;
    const subject = /^fwd:/i.test(opened.subject) ? opened.subject : `Fwd: ${opened.subject}`;
    const quoted = `\n\n\n----- Thư chuyển tiếp -----\nTừ: ${fmtAddr(opened.from)}\nĐến: ${fmtAddr(
      opened.to,
    )}\nNgày: ${fmtDate(opened.date)}\nTiêu đề: ${opened.subject}\n\n${opened.text || ""}`;
    setComposeError("");
    setCompose({ to: "", cc: "", subject, body: quoted, inReplyTo: "", references: "" });
  };

  const sendCompose = async () => {
    setComposeError("");
    if (!compose.to.trim()) {
      setComposeError("Nhập người nhận");
      return;
    }
    try {
      const html = (compose.body || "")
        .split("\n")
        .map((l) => l || "&nbsp;")
        .join("<br/>");
      await sendMsg({
        id: accId,
        to: compose.to,
        cc: compose.cc || undefined,
        subject: compose.subject || "(không tiêu đề)",
        text: compose.body,
        html,
        inReplyTo: compose.inReplyTo || undefined,
        references: compose.references || undefined,
      }).unwrap();
      setCompose(null);
      setBanner("Đã gửi thư.");
      setTimeout(() => setBanner(""), 4000);
    } catch (e) {
      setComposeError(e?.data?.error || e?.error || "Gửi thất bại");
    }
  };

  const downloadAttachment = async (att) => {
    try {
      const url = `${API}/admin/mailbox/${accId}/attachment?folder=${encodeURIComponent(
        folder,
      )}&uid=${openedUid}&index=${att.index}`;
      const resp = await fetch(url, {
        headers: { authorization: `Bearer ${tokenFromStorage()}` },
      });
      if (!resp.ok) throw new Error("Tải thất bại");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert(e.message || "Không tải được tệp");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={2}>
        {banner && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setBanner("")}>
            {banner}
          </Alert>
        )}

        {accounts.length === 0 ? (
          <Card sx={{ p: 3 }}>
            <Typography>
              Chưa có hộp thư nào. Vào <b>Cấu hình hộp thư</b> để thêm địa chỉ (vd support@pickletour.vn).
            </Typography>
          </Card>
        ) : (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {/* Cột trái: chọn hộp thư + thư mục */}
            <Card sx={{ p: 2, width: { md: 240 }, flexShrink: 0 }}>
              <Select
                fullWidth
                size="small"
                value={accId}
                onChange={(e) => setAccId(e.target.value)}
                sx={{ mb: 2 }}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.label || a.email}
                  </MenuItem>
                ))}
              </Select>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Edit />}
                onClick={startCompose}
                sx={{ mb: 2, color: "#fff" }}
              >
                Soạn thư
              </Button>
              <List dense>
                {folders.map((f) => {
                  const label = FOLDER_LABEL[f.role] || f.name;
                  return (
                    <ListItemButton
                      key={f.path}
                      selected={folder === f.path}
                      onClick={() => onSelectFolder(f.path)}
                    >
                      <ListItemText primary={label} />
                      {f.unseen > 0 && (
                        <Badge badgeContent={f.unseen} color="error" sx={{ mr: 1 }} />
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </Card>

            {/* Cột giữa: danh sách thư */}
            <Card sx={{ p: 0, width: { md: 380 }, flexShrink: 0, maxHeight: "78vh", overflow: "auto" }}>
              <Box p={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tìm thư..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => { refetchList(); refetchFolders(); }}>
                          <Refresh fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Divider />
              {loadingList ? (
                <Box textAlign="center" py={4}>
                  <CircularProgress size={22} />
                </Box>
              ) : listError ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  {listError?.data?.error || "Không tải được thư (kiểm tra cấu hình/kết nối)."}
                </Alert>
              ) : (
                <List dense disablePadding>
                  {messages.map((m) => (
                    <ListItemButton
                      key={m.uid}
                      selected={openedUid === m.uid}
                      onClick={() => openMessage(m)}
                      sx={{ borderBottom: "1px solid rgba(0,0,0,0.06)", alignItems: "flex-start" }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography
                              variant="button"
                              fontWeight={m.seen ? 400 : 700}
                              noWrap
                              sx={{ maxWidth: 200 }}
                            >
                              {folder.toLowerCase().includes("sent")
                                ? fmtAddr(m.to)
                                : fmtAddr(m.from) || "(không rõ)"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {fmtDate(m.date).split(" ")[1] || fmtDate(m.date)}
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {m.hasAttachments && <AttachFile sx={{ fontSize: 14 }} />}
                            <Typography
                              variant="caption"
                              fontWeight={m.seen ? 400 : 700}
                              color={m.seen ? "text.secondary" : "text.primary"}
                              noWrap
                              sx={{ maxWidth: 320 }}
                            >
                              {m.subject}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  ))}
                  {messages.length === 0 && (
                    <Box textAlign="center" py={4}>
                      <Typography color="text.secondary">Không có thư.</Typography>
                    </Box>
                  )}
                </List>
              )}
              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between" p={1}>
                <IconButton size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ArrowBack fontSize="small" />
                </IconButton>
                <Typography variant="caption">
                  Trang {page}/{totalPages} · {total} thư
                </Typography>
                <IconButton
                  size="small"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ArrowForward fontSize="small" />
                </IconButton>
              </Stack>
            </Card>

            {/* Cột phải: nội dung thư */}
            <Card sx={{ p: 2, flex: 1, minWidth: 0, maxHeight: "78vh", overflow: "auto" }}>
              {loadingMsg ? (
                <Box textAlign="center" py={6}>
                  <CircularProgress />
                </Box>
              ) : !opened ? (
                <Box textAlign="center" py={6}>
                  <Typography color="text.secondary">Chọn một thư để đọc.</Typography>
                </Box>
              ) : (
                <>
                  <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                    <Button size="small" startIcon={<Reply />} onClick={() => startReply(false)}>
                      Trả lời
                    </Button>
                    <Button size="small" startIcon={<ReplyAll />} onClick={() => startReply(true)}>
                      Trả lời tất cả
                    </Button>
                    <Button size="small" startIcon={<Forward />} onClick={startForward}>
                      Chuyển tiếp
                    </Button>
                    <Button
                      size="small"
                      startIcon={<MarkEmailUnread />}
                      onClick={() => onMarkUnread({ uid: openedUid })}
                    >
                      Đánh dấu chưa đọc
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => onDelete({ uid: openedUid })}
                    >
                      Xoá
                    </Button>
                  </Stack>

                  <Typography variant="h5" gutterBottom>
                    {opened.subject}
                  </Typography>
                  <Typography variant="body2">
                    <b>Từ:</b> {fmtAddr(opened.from)}
                  </Typography>
                  <Typography variant="body2">
                    <b>Đến:</b> {fmtAddr(opened.to)}
                  </Typography>
                  {opened.cc?.length > 0 && (
                    <Typography variant="body2">
                      <b>Cc:</b> {fmtAddr(opened.cc)}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {fmtDate(opened.date)}
                  </Typography>

                  {opened.attachments?.length > 0 && (
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                      {opened.attachments.map((att) => (
                        <Chip
                          key={att.index}
                          icon={<AttachFile />}
                          label={`${att.filename} (${Math.round((att.size || 0) / 1024)} KB)`}
                          onClick={() => downloadAttachment(att)}
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      ))}
                    </Stack>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {opened.html ? (
                    <Box
                      component="iframe"
                      title="mail-body"
                      sandbox=""
                      srcDoc={opened.html}
                      sx={{ width: "100%", minHeight: "50vh", border: 0 }}
                    />
                  ) : (
                    <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {opened.text}
                    </Typography>
                  )}
                </>
              )}
            </Card>
          </Stack>
        )}
      </MDBox>
      <Footer />

      {/* Soạn / trả lời */}
      <Dialog open={!!compose} onClose={() => setCompose(null)} maxWidth="md" fullWidth>
        <DialogTitle>Soạn thư — từ {acc?.email}</DialogTitle>
        <DialogContent dividers>
          {composeError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {composeError}
            </Alert>
          )}
          {compose && (
            <Stack spacing={2}>
              <TextField
                label="Đến"
                fullWidth
                value={compose.to}
                onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                placeholder="a@x.com, b@y.com"
              />
              <TextField
                label="Cc"
                fullWidth
                value={compose.cc}
                onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))}
              />
              <TextField
                label="Tiêu đề"
                fullWidth
                value={compose.subject}
                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              />
              <TextField
                label="Nội dung"
                fullWidth
                multiline
                minRows={10}
                value={compose.body}
                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompose(null)}>Huỷ</Button>
          <Button variant="contained" onClick={sendCompose} disabled={sending} sx={{ color: "#fff" }}>
            {sending ? "Đang gửi..." : "Gửi"}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default MailboxPage;
