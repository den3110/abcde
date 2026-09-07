/* eslint-disable react/prop-types */
// layouts/reconciliation/ReconciliationPage.jsx — Đối soát hoa hồng nền tảng
import { useState } from "react";
import {
  Box, Card, Grid, TextField, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, LinearProgress, Alert, Stack, IconButton, Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

import { useGetReconciliationQuery, useSetVenueCommissionMutation } from "slices/reconciliationApiSlice";

const fmtVND = (n) => `${(Number(n) || 0).toLocaleString("vi-VN")}đ`;
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`; };

export default function ReconciliationPage() {
  const [to, setTo] = useState(todayStr());
  const [from, setFrom] = useState(addDays(todayStr(), -29));
  const { data, isFetching } = useGetReconciliationQuery({ from, to });
  const [setCommission] = useSetVenueCommissionMutation();

  const rows = data?.rows || [];
  const totals = data?.totals || { gross: 0, commission: 0, net: 0 };

  const editCommission = async (r) => {
    // eslint-disable-next-line no-alert
    const v = window.prompt(`Hoa hồng (%) cho ${r.venueName}:`, String(r.commissionPercent || 0));
    if (v === null) return;
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    try { await setCommission({ id: r.venueId, commissionPercent: pct }).unwrap(); } catch (e) { alert(e?.data?.message || "Lỗi"); }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>Đối soát hoa hồng</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Doanh thu đã thu (tiền sân + bán hàng), hoa hồng nền tảng và số tiền phải trả cho từng chủ sân.
          </Typography>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Từ" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Đến" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}>
              <Stack direction="row" spacing={2} justifyContent={{ sm: "flex-end" }} alignItems="center" height="100%">
                <Box textAlign="right"><Typography variant="caption" color="text.secondary">Tổng thu</Typography><Typography fontWeight={800}>{fmtVND(totals.gross)}</Typography></Box>
                <Box textAlign="right"><Typography variant="caption" color="text.secondary">Hoa hồng</Typography><Typography fontWeight={800} color="warning.main">{fmtVND(totals.commission)}</Typography></Box>
                <Box textAlign="right"><Typography variant="caption" color="text.secondary">Trả chủ sân</Typography><Typography fontWeight={800} color="success.main">{fmtVND(totals.net)}</Typography></Box>
              </Stack>
            </Grid>
          </Grid>

          {isFetching && <LinearProgress sx={{ mb: 1 }} />}
          {rows.length === 0 ? (
            <Alert severity="info">Không có dữ liệu trong khoảng thời gian này.</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead sx={{ display: "table-header-group" }}>
                  <TableRow>
                    <TableCell>Cụm sân</TableCell>
                    <TableCell align="right">Tiền sân</TableCell>
                    <TableCell align="right">Bán hàng</TableCell>
                    <TableCell align="right">Tổng thu</TableCell>
                    <TableCell align="center">HH %</TableCell>
                    <TableCell align="right">Hoa hồng</TableCell>
                    <TableCell align="right">Trả chủ sân</TableCell>
                    <TableCell>Tài khoản nhận</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.venueId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.venueName}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.owner?.name || r.owner?.nickname || ""}{r.province ? ` · ${r.province}` : ""}</Typography>
                      </TableCell>
                      <TableCell align="right">{fmtVND(r.bookingsPaid)}</TableCell>
                      <TableCell align="right">{fmtVND(r.salesRevenue)}</TableCell>
                      <TableCell align="right"><b>{fmtVND(r.grossRevenue)}</b></TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={`${r.commissionPercent}%`} />
                        <Tooltip title="Đổi %"><IconButton size="small" onClick={() => editCommission(r)}><EditIcon fontSize="inherit" /></IconButton></Tooltip>
                      </TableCell>
                      <TableCell align="right" style={{ color: "#ed6c02" }}>{fmtVND(r.commission)}</TableCell>
                      <TableCell align="right" style={{ color: "#2e7d32", fontWeight: 700 }}>{fmtVND(r.netPayout)}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{r.bank?.bankShortName} {r.bank?.bankAccountNumber}</Typography>
                        {r.bank?.bankAccountName ? <Typography variant="caption" display="block" color="text.secondary">{r.bank.bankAccountName}</Typography> : null}
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
