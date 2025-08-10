// src/layouts/tournament/AdminTournamentMatches.jsx
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  Stack,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  Alert,
  IconButton,
  Divider,
  Grid,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
} from "@mui/material";
import { ArrowBack, Info as InfoIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import {
  useListAllMatchesQuery, // fetch all matches
  useGetTournamentQuery, // get tournament info
  useGetMatchQuery, // get one match detail
} from "slices/tournamentsApiSlice";

/* ---------------- helpers ---------------- */
const idOf = (x) => String(x?._id ?? x ?? "");
const normType = (t) => {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return "double";
};
const maskPhone = (p) => {
  const s = String(p || "");
  if (s.length < 6) return s || "—";
  const head = s.slice(0, 3);
  const tail = s.slice(-3);
  return `${s}`;
};
const statusChip = (s) =>
  s === "live"
    ? { color: "warning", label: "Đang diễn ra" }
    : s === "finished"
    ? { color: "success", label: "Đã kết thúc" }
    : { color: "default", label: "Chưa diễn ra" };

const pairLabel = (reg, eventType = "double") => {
  if (!reg) return "—";
  const p1 = reg.player1?.fullName || reg.player1?.name || "N/A";
  const p2 = reg.player2?.fullName || reg.player2?.name || "";
  return eventType === "single" || !p2 ? p1 : `${p1} & ${p2}`;
};

const sideLabel = (m, side, eventType) => {
  const pair = side === "A" ? m?.pairA : m?.pairB;
  if (pair) return pairLabel(pair, eventType);
  const prev = side === "A" ? m?.previousA : m?.previousB;
  if (prev) {
    const r = prev.round ?? "?";
    const idx = (prev.order ?? 0) + 1;
    return `Winner of R${r} #${idx}`;
  }
  return "—";
};

/* ---------------- component ---------------- */
export default function AdminTournamentMatches() {
  const { id: tournamentId } = useParams();
  const nav = useNavigate();

  // 1. Tournament info
  const {
    data: tour,
    isLoading: tourLoading,
    error: tourError,
  } = useGetTournamentQuery(tournamentId);

  const eventType = normType(tour?.eventType);

  // 2. All matches (client-filter by tournamentId)
  const {
    data: allMatches = [],
    isLoading: mtsLoading,
    error: mtsError,
    refetch: refetchAll,
  } = useListAllMatchesQuery();

  // 3. Dialog for match detail
  const [detailId, setDetailId] = useState(null);
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useGetMatchQuery(detailId, { skip: !detailId });

  // 4. Snackbar
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // errors
  useEffect(() => {
    if (tourError)
      showSnack("error", tourError?.data?.message || tourError.message || "Không tải được giải");
  }, [tourError]);
  useEffect(() => {
    if (mtsError)
      showSnack(
        "error",
        mtsError?.data?.message || mtsError.message || "Không tải được danh sách trận"
      );
  }, [mtsError]);

  // 5. Filter & group matches by bracket within this tournament
  const grouped = useMemo(() => {
    const filtered = (allMatches || []).filter((m) => idOf(m?.tournament) === idOf(tournamentId));
    // sort by bracket.order, then round, then order
    filtered.sort(
      (a, b) =>
        (a?.bracket?.order ?? 0) - (b?.bracket?.order ?? 0) ||
        (a?.round ?? 1) - (b?.round ?? 1) ||
        (a?.order ?? 0) - (b?.order ?? 0)
    );
    const map = {};
    filtered.forEach((m) => {
      const bId = idOf(m.bracket);
      if (!map[bId]) {
        map[bId] = {
          bracketName: m?.bracket?.name || "—",
          bracketType: m?.bracket?.type || "-",
          stage: m?.bracket?.stage ?? "-",
          matches: [],
        };
      }
      map[bId].matches.push(m);
    });
    return map;
  }, [allMatches, tournamentId]);

  const refresh = () => {
    refetchAll();
    if (detailId) refetchDetail();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Box p={3}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <IconButton onClick={() => nav(-1)}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ mr: 1 }}>
            Trận đấu – {tour?.name || ""}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={eventType === "single" ? "Giải đơn" : "Giải đôi"}
            color={eventType === "single" ? "default" : "primary"}
          />
          <Box flexGrow={1} />
          <IconButton onClick={refresh} title="Làm mới">
            <RefreshIcon />
          </IconButton>
        </Stack>

        {/* Body */}
        {tourLoading || mtsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : Object.keys(grouped).length === 0 ? (
          <Alert severity="info">Chưa có trận đấu nào.</Alert>
        ) : (
          Object.entries(grouped).map(([bId, { bracketName, bracketType, stage, matches }]) => (
            <Box key={bId} mb={3}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <Typography variant="h6">📋 {bracketName}</Typography>
                <Chip size="small" label={bracketType === "group" ? "Vòng bảng" : "Knockout"} />
                <Chip size="small" variant="outlined" label={`Stage ${stage}`} />
              </Stack>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1}>
                {matches.map((m) => {
                  const chip = statusChip(m?.status);
                  return (
                    <Card key={m._id} sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              R{m.round ?? 1} • #{m.order ?? 0}
                            </Typography>
                            <Chip size="small" color={chip.color} label={chip.label} />
                          </Stack>
                          <Typography>
                            <strong>{sideLabel(m, "A", eventType)}</strong>
                            <span style={{ opacity: 0.6 }}> &nbsp;vs&nbsp; </span>
                            <strong>{sideLabel(m, "B", eventType)}</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Best-of {m?.rules?.bestOf ?? "-"}, tới {m?.rules?.pointsToWin ?? "-"}{" "}
                            {m?.rules?.winByTwo ? "(chênh 2)" : ""}
                            {m?.referee?.name
                              ? ` • Trọng tài: ${m.referee.name}`
                              : " • Trọng tài: —"}
                          </Typography>
                        </Box>
                        <IconButton onClick={() => setDetailId(m._id)}>
                          <InfoIcon />
                        </IconButton>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))
        )}
      </Box>

      {/* Chi tiết trận đấu */}
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết trận</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : detailError ? (
            <Alert severity="error">
              {detailError?.data?.message || detailError?.error || "Không tải được chi tiết trận"}
            </Alert>
          ) : detail ? (
            <>
              <Typography variant="h6" gutterBottom>
                {detail?.tournament?.name} • {detail?.bracket?.name} (
                {detail?.bracket?.type === "group" ? "Vòng bảng" : "Knockout"}) • Stage{" "}
                {detail?.bracket?.stage ?? "-"} • Vòng {detail?.round ?? "-"} • #
                {detail?.order ?? 0}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                {/* Đội A */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight="bold" gutterBottom>
                      Đội A
                    </Typography>
                    <Typography>{pairLabel(detail?.pairA, eventType)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {eventType === "single"
                        ? maskPhone(detail?.pairA?.player1?.phone)
                        : `${maskPhone(detail?.pairA?.player1?.phone)} • ${maskPhone(
                            detail?.pairA?.player2?.phone
                          )}`}
                    </Typography>
                    <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
                      Điểm đăng ký:{" "}
                      {eventType === "single"
                        ? detail?.pairA?.player1?.score ?? "—"
                        : `${detail?.pairA?.player1?.score ?? "—"} + ${
                            detail?.pairA?.player2?.score ?? "—"
                          }`}
                    </Typography>
                  </Card>
                </Grid>

                {/* Đội B */}
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight="bold" gutterBottom>
                      Đội B
                    </Typography>
                    <Typography>{pairLabel(detail?.pairB, eventType)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {eventType === "single"
                        ? maskPhone(detail?.pairB?.player1?.phone)
                        : `${maskPhone(detail?.pairB?.player1?.phone)} • ${maskPhone(
                            detail?.pairB?.player2?.phone
                          )}`}
                    </Typography>
                    <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
                      Điểm đăng ký:{" "}
                      {eventType === "single"
                        ? detail?.pairB?.player1?.score ?? "—"
                        : `${detail?.pairB?.player1?.score ?? "—"} + ${
                            detail?.pairB?.player2?.score ?? "—"
                          }`}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* Bảng điểm các ván */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Điểm từng ván
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: "fixed", minWidth: 360 }}>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell sx={{ width: 80, fontWeight: 700 }}>Ván</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Đội A</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Đội B</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.gameScores || []).length ? (
                      detail.gameScores.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell>#{i + 1}</TableCell>
                          <TableCell align="center">{g?.a ?? "—"}</TableCell>
                          <TableCell align="center">{g?.b ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          Chưa có điểm ván nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Thông tin bổ sung */}
              <Stack spacing={0.5} sx={{ mt: 2 }}>
                <Typography>
                  <strong>Trạng thái:</strong>{" "}
                  {detail?.status === "scheduled"
                    ? "Chưa diễn ra"
                    : detail?.status === "live"
                    ? "Đang diễn ra"
                    : "Đã kết thúc"}
                </Typography>
                <Typography>
                  <strong>Người thắng:</strong>{" "}
                  {detail?.winner === "A"
                    ? "Đội A"
                    : detail?.winner === "B"
                    ? "Đội B"
                    : "Chưa xác định"}
                </Typography>
                <Typography>
                  <strong>Trọng tài:</strong> {detail?.referee?.name || "—"}
                </Typography>
              </Stack>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Footer />

      {/* Snackbar chung */}
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
    </DashboardLayout>
  );
}
