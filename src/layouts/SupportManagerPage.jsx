import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import InboxIcon from "@mui/icons-material/Inbox";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReplyIcon from "@mui/icons-material/Reply";
import SearchIcon from "@mui/icons-material/Search";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import {
  useGetAdminSupportTicketDetailQuery,
  useGetAdminSupportTicketsQuery,
  useReplyAdminSupportTicketMutation,
  useUpdateAdminSupportTicketStatusMutation,
  useUploadAdminSupportImageMutation,
} from "slices/supportAdminApiSlice";

const STATUS_META = {
  open: { label: "Đang mở", color: "warning" },
  pending: { label: "Đã phản hồi", color: "info" },
  closed: { label: "Đã đóng", color: "success" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "open", label: "Đang mở" },
  { value: "pending", label: "Đã phản hồi" },
  { value: "closed", label: "Đã đóng" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  { value: "account", label: "Tài khoản" },
  { value: "tournament", label: "Giải đấu" },
  { value: "payment", label: "Thanh toán" },
  { value: "technical", label: "Kỹ thuật" },
  { value: "report", label: "Báo lỗi" },
  { value: "other", label: "Khác" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Tất cả ưu tiên", color: "default" },
  { value: "low", label: "Thấp", color: "default" },
  { value: "normal", label: "Bình thường", color: "primary" },
  { value: "high", label: "Cao", color: "warning" },
  { value: "urgent", label: "Khẩn cấp", color: "error" },
];

const userShape = PropTypes.shape({
  _id: PropTypes.string,
  name: PropTypes.string,
  nickname: PropTypes.string,
  email: PropTypes.string,
  phone: PropTypes.string,
});

const attachmentShape = PropTypes.shape({
  url: PropTypes.string,
  mime: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.number,
});

const fileShape = PropTypes.shape({
  name: PropTypes.string,
  size: PropTypes.number,
  lastModified: PropTypes.number,
});

const ticketShape = PropTypes.shape({
  _id: PropTypes.string,
  title: PropTypes.string,
  status: PropTypes.string,
  category: PropTypes.string,
  priority: PropTypes.string,
  lastMessageAt: PropTypes.string,
  updatedAt: PropTypes.string,
  lastMessagePreview: PropTypes.string,
  assignedTo: userShape,
  user: userShape,
});

const messageShape = PropTypes.shape({
  _id: PropTypes.string,
  senderRole: PropTypes.string,
  senderUser: userShape,
  visibility: PropTypes.string,
  createdAt: PropTypes.string,
  text: PropTypes.string,
  attachments: PropTypes.arrayOf(attachmentShape),
});

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function optionLabel(options, value, fallback = "Khác") {
  return options.find((item) => item.value === value)?.label || fallback;
}

function priorityMeta(value) {
  return (
    PRIORITY_OPTIONS.find((item) => item.value === value) ||
    PRIORITY_OPTIONS[2]
  );
}

function statusMetaOf(status) {
  return STATUS_META[status] || STATUS_META.open;
}

function userLabel(user) {
  if (!user) return "Không rõ user";
  return user.nickname || user.name || user.email || user.phone || user._id || "User";
}

function isUnreadForStaff(ticket) {
  if (!ticket?.lastMessageAt) return false;
  if (!ticket?.staffLastReadAt) return true;
  return (
    new Date(ticket.lastMessageAt).getTime() >
    new Date(ticket.staffLastReadAt).getTime()
  );
}

function attachmentPayload(uploadResult, file) {
  const body = uploadResult || {};
  return {
    url: body.url,
    mime: body.mime || file.type || "image/jpeg",
    name: body.filename || file.name || "attachment",
    size: body.size || file.size || 0,
  };
}

function FileChips({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {files.map((file) => (
        <Chip
          key={`${file.name}-${file.size}-${file.lastModified}`}
          size="small"
          icon={<AttachFileIcon />}
          label={file.name}
          onDelete={() => onRemove(file)}
          sx={{ maxWidth: 260 }}
        />
      ))}
    </Stack>
  );
}

FileChips.propTypes = {
  files: PropTypes.arrayOf(fileShape).isRequired,
  onRemove: PropTypes.func.isRequired,
};

function AttachmentList({ attachments = [] }) {
  if (!Array.isArray(attachments) || !attachments.length) return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {attachments.map((attachment, index) => (
        <Button
          key={`${attachment.url}-${index}`}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="outlined"
          startIcon={<AttachFileIcon />}
          sx={{ textTransform: "none" }}
        >
          {attachment.name || `Tệp ${index + 1}`}
        </Button>
      ))}
    </Stack>
  );
}

AttachmentList.propTypes = {
  attachments: PropTypes.arrayOf(attachmentShape),
};

function TicketRow({ ticket, active, onClick }) {
  const status = statusMetaOf(ticket?.status);
  const priority = priorityMeta(ticket?.priority);
  const unread = isUnreadForStaff(ticket);
  const user = ticket?.user || {};

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: active ? "primary.main" : unread ? "error.main" : "divider",
        bgcolor: active ? "action.selected" : "background.paper",
      }}
    >
      <CardActionArea onClick={onClick}>
        <Stack spacing={1} sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="subtitle2"
              fontWeight={unread ? 900 : 750}
              noWrap
              sx={{ flex: 1, minWidth: 0 }}
            >
              {ticket?.title || "Hỗ trợ"}
            </Typography>
            {unread ? <Chip size="small" color="error" label="Chưa đọc" /> : null}
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap>
            {userLabel(user)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: 40,
            }}
          >
            {ticket?.lastMessagePreview || "Chưa có nội dung"}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" color={status.color} label={status.label} />
            <Chip size="small" color={priority.color} label={priority.label} />
            <Chip
              size="small"
              label={optionLabel(CATEGORY_OPTIONS, ticket?.category)}
            />
            <Typography variant="caption" color="text.secondary">
              {formatDate(ticket?.lastMessageAt || ticket?.updatedAt)}
            </Typography>
          </Stack>
          {ticket?.assignedTo ? (
            <Typography variant="caption" color="text.secondary" noWrap>
              Đang xử lý: {userLabel(ticket.assignedTo)}
            </Typography>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
}

TicketRow.propTypes = {
  ticket: ticketShape.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

function MessageBubble({ message }) {
  const isInternal = message?.visibility === "internal";
  const fromStaff = message?.senderRole === "staff";
  const sender = isInternal
    ? "Ghi chú nội bộ"
    : fromStaff
      ? "Support"
      : userLabel(message?.senderUser);

  return (
    <Stack alignItems={fromStaff ? "flex-end" : "flex-start"} spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {sender} - {formatDate(message?.createdAt)}
      </Typography>
      <Box
        sx={(theme) => ({
          maxWidth: "min(780px, 90%)",
          px: 1.5,
          py: 1.1,
          borderRadius: 2,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          bgcolor: isInternal
            ? alpha(theme.palette.grey[600], 0.14)
            : fromStaff
              ? alpha(theme.palette.info.main, 0.1)
              : alpha(theme.palette.warning.main, 0.1),
          border: "1px solid",
          borderColor: isInternal
            ? alpha(theme.palette.grey[600], 0.3)
            : fromStaff
              ? alpha(theme.palette.info.main, 0.22)
              : alpha(theme.palette.warning.main, 0.22),
        })}
      >
        <Typography variant="body2">{message?.text || "[Đính kèm]"}</Typography>
        <AttachmentList attachments={message?.attachments} />
      </Box>
    </Stack>
  );
}

MessageBubble.propTypes = {
  message: messageShape.isRequired,
};

export default function SupportManagerPage() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 30,
    status: "",
    category: "",
    priority: "",
    assigned: "",
    unread: "",
    keyword: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [internalNote, setInternalNote] = useState("");
  const [closeReason, setCloseReason] = useState("");

  const ticketsQuery = useGetAdminSupportTicketsQuery(filters, {
    refetchOnMountOrArgChange: true,
  });
  const tickets = ticketsQuery.data?.items || [];
  const stats = ticketsQuery.data?.stats || {};
  const total = Number(ticketsQuery.data?.total || 0);
  const totalPages = Math.max(Math.ceil(total / filters.limit), 1);

  const detailQuery = useGetAdminSupportTicketDetailQuery(selectedId || skipToken);
  const detail = detailQuery.data || null;
  const ticket = detail?.ticket || null;
  const messages = Array.isArray(detail?.messages) ? detail.messages : [];

  const [replyTicket, { isLoading: replying }] = useReplyAdminSupportTicketMutation();
  const [updateTicket, { isLoading: updatingTicket }] =
    useUpdateAdminSupportTicketStatusMutation();
  const [uploadImage, { isLoading: uploading }] =
    useUploadAdminSupportImageMutation();

  useEffect(() => {
    if (selectedId || !tickets.length) return;
    setSelectedId(tickets[0]._id);
  }, [selectedId, tickets]);

  useEffect(() => {
    if (!tickets.length) {
      setSelectedId("");
      return;
    }
    if (selectedId && tickets.some((item) => String(item._id) === String(selectedId))) return;
    setSelectedId(tickets[0]._id);
  }, [selectedId, tickets]);

  useEffect(() => {
    setCloseReason(ticket?.closeReason || "");
  }, [ticket?._id, ticket?.closeReason]);

  const selectedStatus = statusMetaOf(ticket?.status);
  const selectedPriority = priorityMeta(ticket?.priority);
  const selectedUser = ticket?.user || null;
  const busy = replying || updatingTicket || uploading;

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const handleRefresh = () => {
    ticketsQuery.refetch();
    if (selectedId) detailQuery.refetch();
  };

  const uploadFiles = async (files) => {
    const attachments = [];
    for (const file of files) {
      const result = await uploadImage({
        file,
        options: {
          format: "webp",
          width: 1280,
          height: 1280,
          quality: 82,
        },
      }).unwrap();
      attachments.push(attachmentPayload(result, file));
    }
    return attachments;
  };

  const onPickFiles = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    setReplyFiles((current) => [...current, ...files].slice(0, 5));
    event.target.value = "";
  };

  const removeReplyFile = (file) => {
    setReplyFiles((current) => current.filter((item) => item !== file));
  };

  const patchTicket = async (body, successMessage) => {
    if (!selectedId) return;
    try {
      await updateTicket({ id: selectedId, ...body }).unwrap();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error?.data?.message || "Không thể cập nhật case.");
    }
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!selectedId || (!text && !replyFiles.length)) return;

    try {
      const attachments = await uploadFiles(replyFiles);
      await replyTicket({ id: selectedId, text, attachments }).unwrap();
      setReplyText("");
      setReplyFiles([]);
      toast.success("Đã gửi phản hồi support.");
    } catch (error) {
      toast.error(error?.data?.message || "Không thể gửi phản hồi.");
    }
  };

  const handleStatus = async (status) => {
    if (!selectedId || !status || ticket?.status === status) return;
    await patchTicket(
      { status, closeReason: status === "closed" ? closeReason : "" },
      "Đã cập nhật trạng thái case.",
    );
  };

  const handleInternalNote = async () => {
    const text = internalNote.trim();
    if (!text) return;
    await patchTicket({ internalNote: text }, "Đã lưu ghi chú nội bộ.");
    setInternalNote("");
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Hỗ trợ user
              </Typography>
              <Typography color="text.secondary">
                Quản lý case support, trả lời user, ghi chú nội bộ và đóng/mở ticket.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip color="error" label={`Chưa đọc: ${stats.unread || 0}`} />
              <Chip color="warning" label={`Mở: ${stats.open || 0}`} />
              <Chip color="info" label={`Đã phản hồi: ${stats.pending || 0}`} />
              <Chip color="success" label={`Đóng: ${stats.closed || 0}`} />
              <Tooltip title="Làm mới">
                <IconButton onClick={handleRefresh} disabled={ticketsQuery.isFetching || detailQuery.isFetching}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "410px minmax(0, 1fr)" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Card sx={{ borderRadius: 3 }}>
              <Stack spacing={1.5} sx={{ p: 2 }}>
                <TextField
                  size="small"
                  value={filters.keyword}
                  onChange={(event) => setFilter("keyword", event.target.value)}
                  placeholder="Tìm tiêu đề, nội dung, email, SĐT"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: filters.keyword ? (
                      <InputAdornment position="end">
                        <IconButton size="small" edge="end" onClick={() => setFilter("keyword", "")}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                  <TextField
                    select
                    size="small"
                    label="Trạng thái"
                    value={filters.status}
                    onChange={(event) => setFilter("status", event.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value || "all"} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Chưa đọc"
                    value={filters.unread}
                    onChange={(event) => setFilter("unread", event.target.value)}
                  >
                    <MenuItem value="">Tất cả</MenuItem>
                    <MenuItem value="1">Chỉ chưa đọc</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Loại"
                    value={filters.category}
                    onChange={(event) => setFilter("category", event.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <MenuItem key={option.value || "all"} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Ưu tiên"
                    value={filters.priority}
                    onChange={(event) => setFilter("priority", event.target.value)}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <MenuItem key={option.value || "all"} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Phân công"
                    value={filters.assigned}
                    onChange={(event) => setFilter("assigned", event.target.value)}
                    sx={{ gridColumn: "1 / -1" }}
                  >
                    <MenuItem value="">Tất cả</MenuItem>
                    <MenuItem value="unassigned">Chưa phân công</MenuItem>
                  </TextField>
                </Box>
              </Stack>
              <Divider />
              <Stack spacing={1} sx={{ p: 1.5, maxHeight: "calc(100vh - 430px)", overflowY: "auto" }}>
                {ticketsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={142} />
                  ))
                ) : ticketsQuery.isError ? (
                  <Alert severity="error">
                    {ticketsQuery.error?.data?.message || "Không thể tải danh sách support."}
                  </Alert>
                ) : tickets.length ? (
                  tickets.map((item) => (
                    <TicketRow
                      key={item._id}
                      ticket={item}
                      active={String(item._id) === String(selectedId)}
                      onClick={() => setSelectedId(item._id)}
                    />
                  ))
                ) : (
                  <Stack alignItems="center" spacing={1.25} sx={{ py: 4 }}>
                    <InboxIcon color="disabled" />
                    <Typography color="text.secondary">Không có case support.</Typography>
                  </Stack>
                )}
              </Stack>
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
                <Pagination
                  page={filters.page}
                  count={totalPages}
                  color="primary"
                  onChange={(_, page) => setFilter("page", page)}
                />
              </Box>
            </Card>

            <Card sx={{ borderRadius: 3, minHeight: "calc(100vh - 220px)", display: "flex", flexDirection: "column" }}>
              {!selectedId ? (
                <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 420, p: 3 }}>
                  <SupportAgentIcon sx={{ fontSize: 52, color: "text.secondary" }} />
                  <Typography variant="h6" fontWeight={800}>
                    Chưa chọn case
                  </Typography>
                  <Typography color="text.secondary" textAlign="center">
                    Chọn một case bên trái để xem thread và trả lời user.
                  </Typography>
                </Stack>
              ) : detailQuery.isError ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  {detailQuery.error?.data?.message || "Không thể tải chi tiết case."}
                </Alert>
              ) : (
                <>
                  <Stack spacing={1.5} sx={{ p: 2 }}>
                    {ticket ? (
                      <>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          alignItems={{ xs: "flex-start", md: "center" }}
                          spacing={1}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h5" fontWeight={900} noWrap>
                              {ticket.title || "Hỗ trợ"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {userLabel(selectedUser)}
                              {selectedUser?.email ? ` - ${selectedUser.email}` : ""}
                              {selectedUser?.phone ? ` - ${selectedUser.phone}` : ""}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip color={selectedStatus.color} label={selectedStatus.label} />
                            <Chip color={selectedPriority.color} label={selectedPriority.label} />
                            <Chip label={optionLabel(CATEGORY_OPTIONS, ticket.category)} />
                          </Stack>
                        </Stack>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 1 }}>
                          <TextField
                            select
                            size="small"
                            label="Loại"
                            value={ticket.category || "other"}
                            onChange={(event) =>
                              patchTicket({ category: event.target.value }, "Đã cập nhật loại case.")
                            }
                            disabled={busy}
                          >
                            {CATEGORY_OPTIONS.filter((item) => item.value).map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            label="Ưu tiên"
                            value={ticket.priority || "normal"}
                            onChange={(event) =>
                              patchTicket({ priority: event.target.value }, "Đã cập nhật ưu tiên.")
                            }
                            disabled={busy}
                          >
                            {PRIORITY_OPTIONS.filter((item) => item.value).map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Stack direction="row" spacing={1}>
                            <Button
                              fullWidth
                              variant={ticket.assignedTo ? "outlined" : "contained"}
                              disabled={busy}
                              onClick={() => patchTicket({ assignToMe: true }, "Đã nhận xử lý case.")}
                            >
                              Nhận xử lý
                            </Button>
                            <Button
                              fullWidth
                              variant="outlined"
                              disabled={busy || !ticket.assignedTo}
                              onClick={() => patchTicket({ assignedTo: null }, "Đã bỏ phân công.")}
                            >
                              Bỏ nhận
                            </Button>
                          </Stack>
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            variant={ticket.status === "open" ? "contained" : "outlined"}
                            color="warning"
                            disabled={busy}
                            onClick={() => handleStatus("open")}
                          >
                            Mở
                          </Button>
                          <Button
                            size="small"
                            variant={ticket.status === "pending" ? "contained" : "outlined"}
                            color="info"
                            disabled={busy}
                            onClick={() => handleStatus("pending")}
                          >
                            Đã phản hồi
                          </Button>
                          <Button
                            size="small"
                            variant={ticket.status === "closed" ? "contained" : "outlined"}
                            color="success"
                            disabled={busy}
                            onClick={() => handleStatus("closed")}
                          >
                            Đóng case
                          </Button>
                          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                            Cập nhật lần cuối {formatDate(ticket.lastMessageAt)}
                          </Typography>
                        </Stack>

                        <TextField
                          size="small"
                          label="Lý do đóng case"
                          value={closeReason}
                          onChange={(event) => setCloseReason(event.target.value)}
                          placeholder="Ví dụ: Đã xử lý xong và user đã xác nhận."
                          disabled={busy}
                          fullWidth
                        />

                        {ticket.ratingScore ? (
                          <Alert severity="success" sx={{ py: 0.5 }}>
                            User đánh giá {ticket.ratingScore}/5
                            {ticket.ratingComment ? ` - ${ticket.ratingComment}` : ""}
                          </Alert>
                        ) : null}
                      </>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography color="text.secondary">Đang tải case...</Typography>
                      </Stack>
                    )}
                  </Stack>
                  <Divider />
                  <Stack
                    spacing={1.75}
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      p: 2,
                      bgcolor: (theme) => alpha(theme.palette.grey[500], 0.06),
                    }}
                  >
                    {detailQuery.isFetching && !messages.length ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} variant="rounded" height={72} sx={{ maxWidth: index % 2 ? "72%" : "86%" }} />
                      ))
                    ) : messages.length ? (
                      messages.map((message) => (
                        <MessageBubble key={message._id} message={message} />
                      ))
                    ) : (
                      <Stack alignItems="center" spacing={1} sx={{ py: 5 }}>
                        <InboxIcon color="disabled" />
                        <Typography color="text.secondary">Case chưa có tin nhắn.</Typography>
                      </Stack>
                    )}
                  </Stack>
                  <Divider />
                  <Stack spacing={1.25} sx={{ p: 2 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <TextField
                        value={internalNote}
                        onChange={(event) => setInternalNote(event.target.value)}
                        placeholder="Ghi chú nội bộ, user không thấy..."
                        multiline
                        minRows={1}
                        maxRows={3}
                        fullWidth
                        disabled={!ticket || busy}
                      />
                      <Button
                        variant="outlined"
                        onClick={handleInternalNote}
                        disabled={!ticket || !internalNote.trim() || busy}
                        sx={{ alignSelf: { xs: "stretch", md: "flex-end" } }}
                      >
                        Lưu note
                      </Button>
                    </Stack>
                    <FileChips files={replyFiles} onRemove={removeReplyFile} />
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <TextField
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Nhập phản hồi cho user..."
                        multiline
                        minRows={1}
                        maxRows={4}
                        fullWidth
                        disabled={!ticket || busy}
                      />
                      <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "stretch", md: "flex-end" } }}>
                        <Button
                          component="label"
                          variant="outlined"
                          startIcon={<UploadFileIcon />}
                          disabled={!ticket || busy}
                        >
                          Ảnh
                          <input hidden type="file" accept="image/*" multiple onChange={onPickFiles} />
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<ReplyIcon />}
                          onClick={handleReply}
                          disabled={!ticket || (!replyText.trim() && !replyFiles.length) || busy}
                        >
                          Trả lời
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </>
              )}
            </Card>
          </Box>
        </Stack>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
