/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from "react";
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

function normType(t) {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return s || "double";
}
const PLACE = "";

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
  const paged = useMemo(() => regs.slice((page - 1) * perPage, page * perPage), [regs, page]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const evType = normType(tour?.eventType);
  const isSingles = evType === "single";

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

  const renderAthlete = (pl) => {
    if (!pl)
      return (
        <MDTypography variant="caption" color="text">
          —
        </MDTypography>
      );
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar src={pl.avatar || PLACE} />
        <Box>
          <MDTypography variant="button">{pl.fullName}</MDTypography>
          <div></div>
          <MDTypography variant="caption" color="text">
            {pl.phone}
          </MDTypography>
        </Box>
      </Stack>
    );
  };

  /* ───── DataTable config ───── */
  const columns = useMemo(() => {
    const base = [
      { Header: "#", accessor: "idx", align: "center", width: "6%" },
      { Header: isSingles ? "Athlete" : "Athlete 1", accessor: "ath1" },
    ];
    if (!isSingles) {
      base.push({ Header: "Athlete 2", accessor: "ath2" });
    }
    base.push(
      { Header: "Created", accessor: "created" },
      { Header: "Fee", accessor: "fee", align: "center" },
      { Header: "Actions", accessor: "act", align: "center" }
    );
    return base;
  }, [isSingles]);

  const rows = useMemo(
    () =>
      paged.map((r, i) => ({
        idx: <MDTypography variant="caption">{(page - 1) * perPage + i + 1}</MDTypography>,
        ath1: renderAthlete(r.player1),
        ...(isSingles ? {} : { ath2: renderAthlete(r.player2) }),
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
              title={r.payment.status === "Paid" ? "Mark unpaid" : "Confirm payment"}
            >
              {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
            </IconButton>
            <IconButton color="error" onClick={() => setConfirmDel(r)} title="Delete registration">
              <DeleteIcon />
            </IconButton>
          </>
        ),
      })),
    [paged, page, isSingles]
  );

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
          <Typography variant="caption" color="text.secondary" fontSize={16}>
            {tour.name} • {new Date(tour.startDate).toLocaleDateString()} –{" "}
            {new Date(tour.endDate).toLocaleDateString()} • {isSingles ? "Giải đơn" : "Giải đôi"}
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

                {[r.player1, r.player2].filter(Boolean).map((pl) => (
                  <Stack
                    key={pl.phone || pl.fullName}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    mb={1}
                  >
                    <Avatar src={pl.avatar || PLACE} />
                    <Box>
                      <MDTypography variant="body2">{pl.fullName}</MDTypography>
                      <div></div>
                      <MDTypography variant="caption" color="text">
                        {pl.phone}
                      </MDTypography>
                    </Box>
                  </Stack>
                ))}

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <MDTypography variant="caption">
                    {new Date(r.createdAt).toLocaleString()}
                  </MDTypography>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      color={r.payment.status === "Paid" ? "error" : "success"}
                      onClick={() => handleToggle(r)}
                      title={r.payment.status === "Paid" ? "Mark unpaid" : "Confirm payment"}
                    >
                      {r.payment.status === "Paid" ? <MoneyOff /> : <Paid />}
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => setConfirmDel(r)}
                      title="Delete registration"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
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

      {/* Confirm delete */}
      <Dialog open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <DialogTitle>Delete registration?</DialogTitle>
        <DialogContent>
          {isSingles ? (
            <>
              Bạn chắc chắn xoá đăng ký của <b>{confirmDel?.player1?.fullName}</b>?
            </>
          ) : (
            <>
              Bạn chắc chắn xoá cặp&nbsp;
              <b>{confirmDel?.player1?.fullName}</b>
              {confirmDel?.player2 ? (
                <>
                  {" "}
                  — <b>{confirmDel?.player2?.fullName}</b>?
                </>
              ) : (
                "?"
              )}
            </>
          )}
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
