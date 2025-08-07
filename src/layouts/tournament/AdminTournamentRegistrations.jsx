/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import {
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Pagination,
  Snackbar,
  Alert,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { ArrowBack, Paid, MoneyOff, Delete as DeleteIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DataTable from "examples/Tables/DataTable";

import {
  useGetTournamentQuery,
  useGetRegistrationsQuery,
  useUpdatePaymentMutation,
  useDeleteRegistrationMutation,
} from "slices/tournamentsApiSlice";

export default function AdminTournamentRegistrations() {
  const { id } = useParams();
  const nav = useNavigate();

  /* ───── queries ───── */
  const { data: tour, error: tourError } = useGetTournamentQuery(id);
  const {
    data: regs = [],
    isLoading: regsLoading,
    error: regsError,
    refetch,
  } = useGetRegistrationsQuery(id);

  /* ───── mutation ───── */
  const [updatePay] = useUpdatePaymentMutation();
  const [deleteReg] = useDeleteRegistrationMutation();
  const [confirmDel, setConfirmDel] = useState(null); // reg obj or null
  /* ───── snackbar ───── */
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  /* ───── pagination ───── */
  const [page, setPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.ceil(regs.length / perPage);
  const paged = regs.slice((page - 1) * perPage, page * perPage);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  /* ───── side-effects ───── */
  useEffect(() => {
    if (tourError) showSnack("error", tourError?.data?.message || tourError.error);
  }, [tourError]);

  useEffect(() => {
    if (regsError) {
      showSnack("error", regsError?.data?.message || regsError.error);
    } else if (!regsLoading) {
      showSnack("info", `Loaded ${regs.length} registration${regs.length === 1 ? "" : "s"}`);
    }
  }, [regsLoading, regsError, regs.length]);

  /* ───── helpers ───── */
  const handleToggle = async (reg) => {
    const next = reg.payment.status === "Paid" ? "Unpaid" : "Paid";
    try {
      await updatePay({ regId: reg._id, status: next }).unwrap();
      showSnack("success", next === "Paid" ? "Payment confirmed" : "Payment undone");
      refetch(); // refresh list
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Update failed");
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteReg(confirmDel._id).unwrap();
      showSnack("success", "Registration deleted");
      setConfirmDel(null);
      refetch();
    } catch (err) {
      showSnack("error", err?.data?.message || err.error || "Delete failed");
    }
  };

  const renderAthlete = (pl) => (
    <Stack direction="row" spacing={1} alignItems="center">
      <Avatar src={pl.avatar} />
      <Box>
        <MDTypography variant="button">{pl.fullName}</MDTypography>
        <Box></Box>
        <MDTypography variant="caption" color="text">
          {pl.phone}
        </MDTypography>
      </Box>
    </Stack>
  );

  /* ───── DataTable config ───── */
  const columns = [
    { Header: "#", accessor: "idx", align: "center", width: "6%" },
    { Header: "Athlete 1", accessor: "ath1" },
    { Header: "Athlete 2", accessor: "ath2" },
    { Header: "Created", accessor: "created" },
    { Header: "Fee", accessor: "fee", align: "center" },
    { Header: "Action", accessor: "act", align: "center" },
  ];

  const rows = paged.map((r, i) => ({
    idx: <MDTypography variant="caption">{(page - 1) * perPage + i + 1}</MDTypography>,
    ath1: renderAthlete(r.player1),
    ath2: renderAthlete(r.player2),
    created: (
      <MDTypography variant="caption">{new Date(r.createdAt).toLocaleString()}</MDTypography>
    ),
    fee: (
      <Chip
        size="small"
        color={r.payment.status === "Paid" ? "success" : "default"}
        label={r.payment.status}
      />
    ),
    act: (
      <>
        <IconButton
          color={r.payment.status === "Paid" ? "error" : "success"}
          onClick={() => handleToggle(r)}
        >
          {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
        </IconButton>
        <IconButton color="error" onClick={() => setConfirmDel(r)}>
          <DeleteIcon />
        </IconButton>
      </>
    ),
  }));

  /* ───── render ───── */
  return (
    <DashboardLayout>
      <DashboardNavbar />

      {/* header */}
      <MDBox px={3} pt={3}>
        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <IconButton onClick={() => nav(-1)}>
            <ArrowBack />
          </IconButton>
          <MDTypography variant="h5">Registrations</MDTypography>
        </Stack>
        {tour && (
          <Typography variant="caption" color="text.secondary">
            {tour.name} • {new Date(tour.startDate).toLocaleDateString()} –{" "}
            {new Date(tour.endDate).toLocaleDateString()} •{" "}
            {tour.playType === "double" ? "Double" : "Single"}
          </Typography>
        )}
      </MDBox>

      {/* content */}
      <MDBox px={3} pb={3}>
        {regsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          /* mobile cards */
          <Stack spacing={2}>
            {paged.map((r, i) => (
              <Card key={r._id} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  <MDTypography variant="subtitle2">#{(page - 1) * perPage + i + 1}</MDTypography>
                  <Chip
                    size="small"
                    color={r.payment.status === "Paid" ? "success" : "default"}
                    label={r.payment.status}
                  />
                </Stack>
                {[r.player1, r.player2].map((pl) => (
                  <Stack key={pl.phone} direction="row" spacing={1} alignItems="center" mb={1}>
                    <Avatar src={pl.avatar} />
                    <Box>
                      <MDTypography variant="body2">{pl.fullName}</MDTypography>
                      <MDTypography variant="caption" color="text">
                        {pl.phone}
                      </MDTypography>
                    </Box>
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="space-between">
                  <MDTypography variant="caption">
                    {new Date(r.createdAt).toLocaleString()}
                  </MDTypography>
                  <IconButton
                    color={r.payment.status === "Paid" ? "error" : "success"}
                    onClick={() => handleToggle(r)}
                  >
                    {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
                  </IconButton>
                </Stack>
              </Card>
            ))}
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, v) => setPage(v)}
                size="small"
              />
            </Box>
          </Stack>
        ) : (
          /* desktop table */
          <Card>
            <DataTable
              table={{ columns, rows }}
              isSorted={false}
              entriesPerPage={false}
              showTotalEntries={false}
              noEndBorder
              canSearch={false}
            />
            <MDBox py={2} display="flex" justifyContent="center">
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} />
            </MDBox>
          </Card>
        )}
      </MDBox>

      <Footer />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <DialogTitle>Delete registration?</DialogTitle>
        <DialogContent>
          Bạn chắc chắn xoá cặp&nbsp;
          <b>{confirmDel?.player1.fullName}</b> — <b>{confirmDel?.player2.fullName}</b>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDel(null)}>Huỷ</Button>
          <Button color="error" onClick={handleDelete}>
            Xoá
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
