/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Grid,
  Card,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Pagination,
  CircularProgress,
} from "@mui/material";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import { useListBookingsAdminQuery } from "slices/venueAdminApiSlice";

const fmtVND = (n) => `${(Number(n) || 0).toLocaleString("vi-VN")}đ`;
const tz = { timeZone: "Asia/Bangkok" };
const dt = (iso) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", ...tz }) : "—";

const BOOKING_STATUS = {
  pending: { label: "Chờ duyệt", color: "warning" },
  confirmed: { label: "Đã xác nhận", color: "success" },
  cancelled: { label: "Đã huỷ", color: "default" },
  completed: { label: "Hoàn tất", color: "info" },
  no_show: { label: "Không đến", color: "error" },
};

export default function BookingListPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const limit = 20;

  const { data, isFetching } = useListBookingsAdminQuery(
    { page: page + 1, limit, status, payment, from, to },
    { refetchOnMountOrArgChange: true },
  );

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const columns = [
    { Header: "Mã", accessor: "code", align: "left" },
    { Header: "Cụm sân", accessor: "venue", align: "left" },
    { Header: "Sân", accessor: "court", align: "left" },
    { Header: "Khách", accessor: "customer", align: "left" },
    { Header: "Thời gian", accessor: "time", align: "left" },
    { Header: "Tiền", accessor: "price", align: "right" },
    { Header: "Trạng thái", accessor: "status", align: "center" },
    { Header: "TT", accessor: "pay", align: "center" },
  ];

  const rows = items.map((b) => {
    const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
    return {
      code: <MDTypography variant="button" fontWeight="medium">{b.code}</MDTypography>,
      venue: <MDTypography variant="button">{b.venue?.name || "—"}</MDTypography>,
      court: <MDTypography variant="button">{b.court?.name || "—"}</MDTypography>,
      customer: (
        <MDBox>
          <MDTypography variant="button" display="block">
            {b.customerName || b.user?.name || "Khách"}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            {b.customerPhone || b.user?.phone || ""}
          </MDTypography>
        </MDBox>
      ),
      time: <MDTypography variant="button">{dt(b.startAt)}</MDTypography>,
      price: <MDTypography variant="button">{fmtVND(b.totalPrice)}</MDTypography>,
      status: <Chip size="small" color={st.color} label={st.label} />,
      pay: (
        <Chip
          size="small"
          variant="outlined"
          color={b.payment?.status === "Paid" ? "success" : "warning"}
          label={b.payment?.status === "Paid" ? "Đã thu" : "Chưa"}
        />
      ),
    };
  });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={3}>
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <MDTypography variant="h5" fontWeight="medium" sx={{ flex: 1 }}>
              Quản lý đặt sân
            </MDTypography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Trạng thái</InputLabel>
              <Select label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="pending">Chờ duyệt</MenuItem>
                <MenuItem value="confirmed">Đã xác nhận</MenuItem>
                <MenuItem value="completed">Hoàn tất</MenuItem>
                <MenuItem value="cancelled">Đã huỷ</MenuItem>
                <MenuItem value="no_show">Không đến</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Thanh toán</InputLabel>
              <Select label="Thanh toán" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(0); }}>
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="Paid">Đã thu</MenuItem>
                <MenuItem value="Unpaid">Chưa thu</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" type="date" label="Từ" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            <TextField size="small" type="date" label="Đến" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </Stack>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              {isFetching ? (
                <MDBox py={6} textAlign="center">
                  <CircularProgress />
                </MDBox>
              ) : (
                <>
                  <DataTable
                    table={{ columns, rows }}
                    isSorted={false}
                    entriesPerPage={false}
                    showTotalEntries={false}
                    noEndBorder
                    canSearch={false}
                  />
                  <MDBox py={2} display="flex" justifyContent="space-between" alignItems="center" px={2}>
                    <MDTypography variant="caption" color="text">
                      Tổng {total} lượt đặt
                    </MDTypography>
                    <Pagination page={page + 1} count={totalPages} color="info" onChange={(_, v) => setPage(v - 1)} />
                  </MDBox>
                </>
              )}
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}
