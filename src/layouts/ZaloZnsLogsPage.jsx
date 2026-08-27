import React, { useState } from "react";
import {
  Box,
  Card,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Pagination,
  CircularProgress,
} from "@mui/material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useGetZaloZnsLogsQuery } from "slices/settingsApiSlice";

const PURPOSE_LABEL = {
  register: "Đăng ký",
  activate: "Kích hoạt SĐT",
  login: "Đăng nhập",
  test: "Test",
};

function fmt(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("vi-VN");
  } catch {
    return String(dt);
  }
}

export default function ZaloZnsLogsPage() {
  const [page, setPage] = useState(1);
  const [phone, setPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");

  const { data, isFetching } = useGetZaloZnsLogsQuery({
    page,
    limit: 30,
    phone,
    status,
    purpose,
  });

  const items = data?.items || [];
  const pages = data?.pages || 1;
  const stats = data?.stats || {};

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box py={3}>
        <Card sx={{ p: 2.5 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={1.5}
            mb={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Nhật ký gửi OTP Zalo ZNS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hôm nay: {stats.sentToday ?? 0} thành công · {stats.failedToday ?? 0} thất bại · Tổng: {data?.total ?? 0}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <TextField
                size="small"
                label="SĐT"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setPhone(phoneInput.trim());
                  }
                }}
                placeholder="0987… / Enter"
              />
              <TextField
                select
                size="small"
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="success">Thành công</MenuItem>
                <MenuItem value="failed">Thất bại</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Loại"
                value={purpose}
                onChange={(e) => {
                  setPage(1);
                  setPurpose(e.target.value);
                }}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="register">Đăng ký</MenuItem>
                <MenuItem value="activate">Kích hoạt SĐT</MenuItem>
                <MenuItem value="test">Test</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <TableContainer sx={{ maxHeight: "65vh" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>SĐT</TableCell>
                  <TableCell>Người dùng</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Chi tiết</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      Chưa có nhật ký.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it._id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmt(it.createdAt)}</TableCell>
                      <TableCell>{it.phone}</TableCell>
                      <TableCell>
                        {it.user
                          ? it.user.nickname || it.user.name || it.user.phone || "—"
                          : "—"}
                      </TableCell>
                      <TableCell>{PURPOSE_LABEL[it.purpose] || it.purpose}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={it.status === "success" ? "success" : "error"}
                          label={it.status === "success" ? "Thành công" : "Thất bại"}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="caption" color={it.status === "success" ? "text.secondary" : "error"}>
                          {it.status === "success"
                            ? it.tranId
                              ? `tranId: ${it.tranId}`
                              : ""
                            : it.error || ""}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack alignItems="center" mt={2}>
            <Pagination
              count={pages}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
            />
          </Stack>
        </Card>
      </Box>
    </DashboardLayout>
  );
}
