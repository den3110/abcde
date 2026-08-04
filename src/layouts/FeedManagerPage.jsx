/* eslint-disable react/prop-types */
// layouts/FeedManagerPage.jsx — Quản lý Bảng tin (posts + reports)
import { useState } from "react";
import {
  Box,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import GavelIcon from "@mui/icons-material/Gavel";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useAdminListFeedPostsQuery,
  useAdminPatchFeedPostMutation,
  useAdminDeleteFeedPostMutation,
  useAdminListFeedReportsQuery,
  useAdminResolveFeedReportMutation,
} from "slices/feedAdminApiSlice";

const REASON_LABEL = {
  spam: "Spam",
  harassment: "Quấy rối",
  hate: "Ngôn từ thù ghét",
  nudity: "Khiêu dâm",
  violence: "Bạo lực",
  misinformation: "Sai lệch",
  impersonation: "Mạo danh",
  other: "Khác",
};

const fmtTime = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN");
};
const authorName = (u) => u?.nickname || u?.name || "N/A";

/* ─────────── POSTS TAB ─────────── */
function PostsTab() {
  const [filter, setFilter] = useState("all");
  const [cursor, setCursor] = useState(null);
  const { data, isFetching, refetch } = useAdminListFeedPostsQuery({
    filter,
    cursor,
  });
  const [patchPost] = useAdminPatchFeedPostMutation();
  const [deletePost] = useAdminDeleteFeedPostMutation();

  const items = data?.items || [];

  const handleHide = async (post) => {
    await patchPost({ id: post._id, isHidden: !post.isHidden }).unwrap();
  };
  const handlePin = async (post) => {
    await patchPost({ id: post._id, isPinned: !post.isPinned }).unwrap();
  };
  const handleDelete = async (post) => {
    if (!window.confirm(`Xoá cứng bài viết của ${authorName(post.author)}?`))
      return;
    await deletePost(post._id).unwrap();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2">Lọc:</Typography>
        <Select
          size="small"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCursor(null);
          }}
        >
          <MenuItem value="all">Tất cả (chưa xoá)</MenuItem>
          <MenuItem value="reported">Bị báo cáo</MenuItem>
          <MenuItem value="hidden">Đã ẩn</MenuItem>
          <MenuItem value="deleted">Đã xoá</MenuItem>
        </Select>
        <Button size="small" onClick={() => refetch()}>
          Làm mới
        </Button>
      </Stack>
      {isFetching && !data && <CircularProgress />}
      <Stack spacing={1.5}>
        {items.length === 0 && !isFetching && (
          <Typography color="text.secondary">Không có bài viết.</Typography>
        )}
        {items.map((p) => (
          <Card key={p._id} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2}>
              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={700}>
                    {authorName(p.author)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtTime(p.createdAt)}
                  </Typography>
                  {p.isPinned && (
                    <Chip size="small" color="primary" label="Ghim" />
                  )}
                  {p.isHidden && (
                    <Chip size="small" color="warning" label="Đã ẩn" />
                  )}
                  {p.reportCount > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      label={`${p.reportCount} báo cáo`}
                    />
                  )}
                </Stack>
                <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                  {p.content || "(không có nội dung)"}
                </Typography>
                {p.tags?.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    {p.tags.map((t) => (
                      <Chip
                        key={t}
                        size="small"
                        variant="outlined"
                        label={`#${t}`}
                      />
                    ))}
                  </Stack>
                )}
                {p.media?.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1, flexWrap: "wrap" }}
                  >
                    {p.media.slice(0, 4).map((m, i) =>
                      m.type === "image" ? (
                        <img
                          key={i}
                          src={m.url}
                          alt=""
                          style={{
                            maxWidth: 120,
                            maxHeight: 120,
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <Chip key={i} label="🎬 Video" variant="outlined" />
                      )
                    )}
                  </Stack>
                )}
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}
                >
                  <span>{p.reactionCount || 0} 💬</span>
                  <span>{p.commentCount || 0} cmt</span>
                </Stack>
              </Box>
              <Stack spacing={0.5}>
                <Tooltip title={p.isHidden ? "Bỏ ẩn" : "Ẩn khỏi feed"}>
                  <IconButton onClick={() => handleHide(p)} size="small">
                    {p.isHidden ? (
                      <VisibilityIcon />
                    ) : (
                      <VisibilityOffIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title={p.isPinned ? "Bỏ ghim" : "Ghim"}>
                  <IconButton onClick={() => handlePin(p)} size="small">
                    {p.isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Xoá cứng">
                  <IconButton
                    onClick={() => handleDelete(p)}
                    size="small"
                    color="error"
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
      {data?.hasMore && (
        <Box textAlign="center" mt={2}>
          <Button onClick={() => setCursor(data.nextCursor)}>Tải thêm</Button>
        </Box>
      )}
    </Box>
  );
}

/* ─────────── REPORTS TAB ─────────── */
function ReportsTab() {
  const [status, setStatus] = useState("pending");
  const { data, isFetching, refetch } = useAdminListFeedReportsQuery({
    status,
  });
  const [resolve] = useAdminResolveFeedReportMutation();
  const items = data?.items || [];

  const act = async (rid, action) => {
    const note =
      action === "dismiss" ? "" : window.prompt("Ghi chú (tuỳ chọn):") || "";
    await resolve({ rid, action, note }).unwrap();
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2">Trạng thái:</Typography>
        <Select
          size="small"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="pending">Chờ xử lý</MenuItem>
          <MenuItem value="actioned">Đã xử lý</MenuItem>
          <MenuItem value="dismissed">Đã bỏ qua</MenuItem>
        </Select>
        <Button size="small" onClick={() => refetch()}>
          Làm mới
        </Button>
      </Stack>
      {isFetching && !data && <CircularProgress />}
      <Stack spacing={1.5}>
        {items.length === 0 && !isFetching && (
          <Typography color="text.secondary">Không có báo cáo.</Typography>
        )}
        {items.map((r) => (
          <Card key={r._id} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2}>
              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    color="error"
                    icon={<GavelIcon />}
                    label={REASON_LABEL[r.reason] || r.reason}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={r.targetType === "post" ? "Bài viết" : "Bình luận"}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {fmtTime(r.createdAt)} · reporter{" "}
                    <strong>{authorName(r.reporter)}</strong>
                  </Typography>
                </Stack>
                {r.note && (
                  <Typography sx={{ mt: 0.5 }} variant="body2">
                    “{r.note}”
                  </Typography>
                )}
                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "pre-wrap",
                      opacity: r.postId?.isHidden ? 0.5 : 1,
                    }}
                  >
                    {r.postId?.content || "(target không còn nội dung hoặc là comment)"}
                  </Typography>
                </Box>
              </Box>
              {status === "pending" && (
                <Stack spacing={0.5}>
                  <Button size="small" onClick={() => act(r._id, "dismiss")}>
                    Bỏ qua
                  </Button>
                  <Button
                    size="small"
                    color="warning"
                    onClick={() => act(r._id, "hide")}
                  >
                    Ẩn
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => act(r._id, "delete")}
                  >
                    Xoá
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

/* ─────────── PAGE ─────────── */
export default function FeedManagerPage() {
  const [tab, setTab] = useState(0);
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
          Quản lý Bảng tin
        </Typography>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Bài viết" />
          <Tab label="Báo cáo" />
        </Tabs>
        {tab === 0 && <PostsTab />}
        {tab === 1 && <ReportsTab />}
      </Box>
    </DashboardLayout>
  );
}
