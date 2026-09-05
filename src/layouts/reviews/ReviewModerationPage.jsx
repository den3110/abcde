/* eslint-disable react/prop-types */
// layouts/reviews/ReviewModerationPage.jsx
// Admin: kiểm duyệt đánh giá giải đấu / sân chơi
import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Rating,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Pagination,
  Typography,
  LinearProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useAdminListReviewsQuery,
  useAdminSetReviewHiddenMutation,
} from "slices/reviewAdminApiSlice";

const uname = (u) => u?.nickname || u?.name || "Ẩn danh";
const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return "";
  }
};

export default function ReviewModerationPage() {
  const [tab, setTab] = useState(0); // 0 = đang hiển thị, 1 = đã ẩn
  const [targetType, setTargetType] = useState(""); // "" | tournament | venue
  const [page, setPage] = useState(1);

  const hidden = tab === 1 ? "true" : "false";
  const { data, isFetching } = useAdminListReviewsQuery({
    targetType: targetType || undefined,
    hidden,
    page,
    limit: 20,
  });
  const [setHidden, { isLoading: saving }] = useAdminSetReviewHiddenMutation();

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  const toggleHidden = async (row) => {
    try {
      await setHidden({ id: row._id, hidden: !row.hidden }).unwrap();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.data?.message || "Thao tác thất bại");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Kiểm duyệt đánh giá
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Đánh giá giải đấu &amp; sân chơi từ người dùng. Ẩn các đánh giá vi
            phạm; ẩn rồi vẫn có thể hiện lại.
          </Typography>

          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
            {[
              { v: "", label: "Tất cả" },
              { v: "tournament", label: "Giải đấu" },
              { v: "venue", label: "Sân chơi" },
            ].map((f) => (
              <Chip
                key={f.v || "all"}
                label={f.label}
                color={targetType === f.v ? "info" : "default"}
                onClick={() => {
                  setTargetType(f.v);
                  setPage(1);
                }}
                variant={targetType === f.v ? "filled" : "outlined"}
              />
            ))}
          </Stack>

          <Tabs
            value={tab}
            onChange={(e, v) => {
              setTab(v);
              setPage(1);
            }}
            sx={{ mb: 1 }}
          >
            <Tab label="Đang hiển thị" />
            <Tab label="Đã ẩn" />
          </Tabs>

          {isFetching && <LinearProgress sx={{ mb: 1 }} />}

          {items.length === 0 ? (
            <Alert severity="info">Không có đánh giá nào.</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Người đánh giá</TableCell>
                    <TableCell>Đối tượng</TableCell>
                    <TableCell>Sao</TableCell>
                    <TableCell>Nội dung</TableCell>
                    <TableCell>Thời gian</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar src={r.reviewer?.avatar} sx={{ width: 28, height: 28 }}>
                            {uname(r.reviewer)[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {uname(r.reviewer)}
                            </Typography>
                            {r.verified && (
                              <Chip size="small" label="Đã tham gia" color="success" sx={{ height: 16, fontSize: 10 }} />
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.targetType === "tournament" ? "Giải" : "Sân"}
                          color={r.targetType === "tournament" ? "primary" : "secondary"}
                          sx={{ mr: 0.5 }}
                        />
                        <Typography variant="caption">{r.targetName || r.targetId}</Typography>
                      </TableCell>
                      <TableCell>
                        <Rating value={r.rating} readOnly size="small" />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2">{r.comment || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{fmtDate(r.createdAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          color={r.hidden ? "success" : "error"}
                          startIcon={r.hidden ? <Visibility /> : <VisibilityOff />}
                          disabled={saving}
                          onClick={() => toggleHidden(r)}
                        >
                          {r.hidden ? "Hiện lại" : "Ẩn"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {pages > 1 && (
            <Stack alignItems="center" mt={2}>
              <Pagination count={pages} page={page} onChange={(e, v) => setPage(v)} color="info" />
            </Stack>
          )}
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
