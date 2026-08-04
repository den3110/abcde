/* eslint-disable react/prop-types */
// layouts/ChatManagerPage.jsx — Quản lý nhắn tin
import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useAdminListConversationsQuery,
  useAdminListMessagesQuery,
  useAdminPatchConversationMutation,
  useAdminDeleteMessageMutation,
} from "slices/chatAdminApiSlice";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");
const authorName = (u) => u?.nickname || u?.name || "N/A";

function MessagesPanel({ cid }) {
  const { data, isFetching } = useAdminListMessagesQuery({ cid });
  const [deleteMessage] = useAdminDeleteMessageMutation();
  const items = (data?.items || []).slice().reverse();

  const handleDelete = async (mid) => {
    if (!window.confirm("Xoá cứng tin nhắn này?")) return;
    await deleteMessage(mid).unwrap();
  };

  return (
    <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
      {isFetching && !items.length && <CircularProgress size={20} />}
      {items.map((m) => (
        <Box
          key={m._id}
          sx={{
            display: "flex",
            gap: 1.5,
            alignItems: "flex-start",
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Avatar src={m.sender?.avatar || ""} sx={{ width: 32, height: 32 }}>
            {authorName(m.sender)[0]?.toUpperCase()}
          </Avatar>
          <Box flex={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={700}>
                {authorName(m.sender)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fmt(m.createdAt)}
              </Typography>
              {m.deletedAt && (
                <Chip size="small" label="Đã xoá" color="warning" />
              )}
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {m.deletedAt ? "(nội dung đã xoá)" : m.content}
            </Typography>
            {m.attachments?.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {m.attachments.map((a, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={a.type === "image" ? "🖼️" : a.type === "video" ? "🎬" : "📎"}
                    component="a"
                    clickable
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                  />
                ))}
              </Stack>
            )}
          </Box>
          {!m.deletedAt && (
            <Tooltip title="Xoá cứng">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(m._id)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
      {items.length === 0 && !isFetching && (
        <Typography color="text.secondary">Không có tin nhắn.</Typography>
      )}
    </Box>
  );
}

export default function ChatManagerPage() {
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const { data, isFetching, refetch } = useAdminListConversationsQuery({
    type: type || undefined,
  });
  const [patchConv] = useAdminPatchConversationMutation();

  const toggleBlock = async (c) => {
    await patchConv({ cid: c._id, isBlocked: !c.isBlocked }).unwrap();
    refetch();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
          Quản lý Nhắn tin
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2">Loại:</Typography>
          <Select
            size="small"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="dm">DM (User ↔ User)</MenuItem>
            <MenuItem value="tournament">BTC giải đấu</MenuItem>
          </Select>
          <Button size="small" onClick={() => refetch()}>
            Làm mới
          </Button>
        </Stack>
        <Box
          sx={{
            display: "flex",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            height: "70vh",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: 340,
              borderRight: 1,
              borderColor: "divider",
              overflowY: "auto",
            }}
          >
            {isFetching && <CircularProgress size={20} sx={{ m: 2 }} />}
            {(data?.items || []).map((c) => {
              const title =
                c.type === "tournament"
                  ? `BTC · ${c.tournament?.name || "?"}`
                  : c.participants
                      .map((p) => authorName(p))
                      .join(" ↔ ");
              return (
                <Card
                  key={c._id}
                  onClick={() => setSelected(c)}
                  sx={{
                    cursor: "pointer",
                    p: 1.5,
                    borderRadius: 0,
                    boxShadow: 0,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor:
                      String(selected?._id) === String(c._id)
                        ? "action.selected"
                        : "transparent",
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ flex: 1 }}
                      noWrap
                    >
                      {title}
                    </Typography>
                    <Chip
                      size="small"
                      label={c.type === "tournament" ? "BTC" : "DM"}
                      color={c.type === "tournament" ? "warning" : "default"}
                    />
                    {c.isBlocked && (
                      <Chip size="small" label="Đã khoá" color="error" />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {c.lastMessage?.text || "(chưa có tin)"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block" }}
                  >
                    {fmt(c.lastMessageAt)}
                  </Typography>
                </Card>
              );
            })}
            {(data?.items || []).length === 0 && !isFetching && (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                Không có hội thoại.
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {selected ? (
              <>
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body1" fontWeight={700}>
                    {selected.type === "tournament"
                      ? `BTC · ${selected.tournament?.name || "?"}`
                      : selected.participants
                          .map((p) => authorName(p))
                          .join(" ↔ ")}
                  </Typography>
                  <Button
                    size="small"
                    color={selected.isBlocked ? "success" : "error"}
                    startIcon={
                      selected.isBlocked ? <CheckCircleIcon /> : <BlockIcon />
                    }
                    onClick={() => toggleBlock(selected)}
                  >
                    {selected.isBlocked ? "Mở khoá" : "Khoá hội thoại"}
                  </Button>
                </Box>
                <MessagesPanel cid={selected._id} />
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "text.secondary",
                }}
              >
                Chọn 1 hội thoại để xem nội dung.
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </DashboardLayout>
  );
}
