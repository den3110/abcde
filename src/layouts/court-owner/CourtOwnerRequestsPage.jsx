/* eslint-disable react/prop-types */
// layouts/court-owner/CourtOwnerRequestsPage.jsx — Admin duyệt yêu cầu làm chủ sân
import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  LinearProgress,
  Box,
} from "@mui/material";
import { CheckCircle, Cancel } from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import {
  useListOwnerRequestsQuery,
  useApproveOwnerRequestMutation,
  useRejectOwnerRequestMutation,
} from "slices/courtOwnerAdminApiSlice";

const STATUS = {
  pending: { label: "Chờ duyệt", color: "warning" },
  approved: { label: "Đã duyệt", color: "success" },
  rejected: { label: "Từ chối", color: "error" },
};
const TABS = ["pending", "approved", "rejected"];
const uname = (u) => u?.nickname || u?.name || "—";
const fmt = (d) => { try { return new Date(d).toLocaleString("vi-VN"); } catch { return ""; } };

export default function CourtOwnerRequestsPage() {
  const [tab, setTab] = useState(0);
  const status = TABS[tab];
  const { data, isFetching } = useListOwnerRequestsQuery({ status });
  const [approve, { isLoading: approving }] = useApproveOwnerRequestMutation();
  const [reject, { isLoading: rejecting }] = useRejectOwnerRequestMutation();
  const items = data?.items || [];

  const doApprove = async (r) => {
    if (!window.confirm(`Duyệt ${uname(r.user)} thành chủ sân?`)) return;
    try { await approve(r._id).unwrap(); } catch (e) { alert(e?.data?.message || "Lỗi"); }
  };
  const doReject = async (r) => {
    // eslint-disable-next-line no-alert
    const reason = window.prompt("Lý do từ chối:", "");
    if (reason === null) return;
    try { await reject({ id: r._id, reason }).unwrap(); } catch (e) { alert(e?.data?.message || "Lỗi"); }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Yêu cầu làm chủ sân
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Duyệt để cấp quyền chủ sân (courtOwner). Sau khi duyệt, người dùng có thể tạo cụm sân và nhận đặt sân.
          </Typography>

          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="Chờ duyệt" />
            <Tab label="Đã duyệt" />
            <Tab label="Từ chối" />
          </Tabs>
          {isFetching && <LinearProgress sx={{ mb: 1 }} />}

          {items.length === 0 ? (
            <Alert severity="info">Không có yêu cầu nào.</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Người dùng</TableCell>
                    <TableCell>Tên sân / liên hệ</TableCell>
                    <TableCell>Địa chỉ</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell>Thời gian</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar src={r.user?.avatar} sx={{ width: 28, height: 28 }}>{uname(r.user)[0]}</Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{uname(r.user)}</Typography>
                            <Typography variant="caption" color="text.secondary">{r.user?.email || r.user?.phone || ""}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.businessName || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.phone}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption">{r.address || "—"}</Typography></TableCell>
                      <TableCell sx={{ maxWidth: 240 }}><Typography variant="caption">{r.note || "—"}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption">{fmt(r.createdAt)}</Typography>
                        {r.status !== "pending" && (
                          <Chip size="small" label={STATUS[r.status]?.label} color={STATUS[r.status]?.color} sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
                        )}
                        {r.rejectReason ? <Typography variant="caption" color="error" display="block">{r.rejectReason}</Typography> : null}
                      </TableCell>
                      <TableCell align="right">
                        {r.status === "pending" ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="outlined" color="error" startIcon={<Cancel />} disabled={rejecting} onClick={() => doReject(r)}>Từ chối</Button>
                            <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />} disabled={approving} onClick={() => doApprove(r)}>Duyệt</Button>
                          </Stack>
                        ) : (
                          <Chip size="small" label={STATUS[r.status]?.label} color={STATUS[r.status]?.color} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
