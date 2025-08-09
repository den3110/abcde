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
} from "@mui/material";
import { ArrowBack, Info as InfoIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import { useListAllMatchesQuery } from "slices/tournamentsApiSlice"; // fetch all matches
import { useGetTournamentQuery } from "slices/tournamentsApiSlice"; // get tournament info
import { useGetMatchQuery } from "slices/tournamentsApiSlice"; // get one match detail

export default function AdminTournamentMatches() {
  const { id: tournamentId } = useParams();
  const nav = useNavigate();

  // 1. Tournament info
  const {
    data: tour,
    isLoading: tourLoading,
    error: tourError,
  } = useGetTournamentQuery(tournamentId);

  // 2. All matches (we'll client‐filter by tournamentId)
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
  } = useGetMatchQuery(detailId, { skip: !detailId });

  // 4. Snackbar
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // combine loading & error
  useEffect(() => {
    if (tourError) showSnack("error", tourError.message || "Không tải được giải");
  }, [tourError]);
  useEffect(() => {
    if (mtsError) showSnack("error", mtsError.message || "Không tải được trận");
  }, [mtsError]);

  // 5. Filter & group matches by bracket within this tournament
  const grouped = useMemo(() => {
    const filtered = allMatches.filter((m) => m.tournament._id === tournamentId);
    const map = {};
    filtered.forEach((m) => {
      const bId = m.bracket._id;
      const bName = m.bracket.name;
      if (!map[bId]) map[bId] = { bracketName: bName, matches: [] };
      map[bId].matches.push(m);
    });
    return map;
  }, [allMatches, tournamentId]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
          <IconButton onClick={() => nav(-1)}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5">Trận đấu – {tour?.name || ""}</Typography>
        </Stack>

        {tourLoading || mtsLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          Object.entries(grouped).map(([bId, { bracketName, matches }]) => (
            <Box key={bId} mb={3}>
              <Typography variant="h6" gutterBottom>
                📋 Bảng: {bracketName}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                {matches.map((m) => (
                  <Card key={m._id} sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography>
                          Vòng {m.round}:{" "}
                          <strong>
                            {m.pairA.player1.fullName} & {m.pairA.player2.fullName}
                          </strong>{" "}
                          vs{" "}
                          <strong>
                            {m.pairB.player1.fullName} & {m.pairB.player2.fullName}
                          </strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.status === "scheduled"
                            ? "Chưa diễn ra"
                            : m.status === "live"
                            ? "Đang diễn ra"
                            : "Đã kết thúc"}{" "}
                          • best-of {m.rules.bestOf}, tới {m.rules.pointsToWin}
                        </Typography>
                      </Box>
                      <IconButton onClick={() => setDetailId(m._id)}>
                        <InfoIcon />
                      </IconButton>
                    </Stack>
                  </Card>
                ))}
                {matches.length === 0 && (
                  <Typography color="text.secondary">Chưa có trận đấu nào.</Typography>
                )}
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
            <Alert severity="error">{detailError.message}</Alert>
          ) : detail ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                {detail.bracket.name} • Vòng {detail.round}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {/* Đôi A */}
                <Grid item xs={12} sm={6}>
                  <Typography fontWeight="bold">Đôi A</Typography>
                  <Typography>
                    {detail.pairA.player1.fullName} & {detail.pairA.player2.fullName}
                  </Typography>
                  <Typography variant="caption">
                    {detail.pairA.player1.phone}, {detail.pairA.player2.phone}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>
                    Điểm khóa: {detail.pairA.player1.score} + {detail.pairA.player2.score}
                  </Typography>
                </Grid>
                {/* Đôi B */}
                <Grid item xs={12} sm={6}>
                  <Typography fontWeight="bold">Đôi B</Typography>
                  <Typography>
                    {detail.pairB.player1.fullName} & {detail.pairB.player2.fullName}
                  </Typography>
                  <Typography variant="caption">
                    {detail.pairB.player1.phone}, {detail.pairB.player2.phone}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>
                    Điểm khóa: {detail.pairB.player1.score} + {detail.pairB.player2.score}
                  </Typography>
                </Grid>
              </Grid>

              {/* Bảng điểm các ván */}
              <Typography variant="subtitle1" sx={{ mt: 3 }}>
                Điểm từng ván
              </Typography>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  mt: 1,
                  "& th, td": { border: "1px solid #ddd", p: 1, textAlign: "center" },
                }}
              >
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th">Ván</Box>
                    <Box component="th">Đôi A</Box>
                    <Box component="th">Đôi B</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {detail.gameScores.map((g, i) => (
                    <Box component="tr" key={i}>
                      <Box component="td">#{i + 1}</Box>
                      <Box component="td">{g.a}</Box>
                      <Box component="td">{g.b}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Thông tin bổ sung */}
              <Typography sx={{ mt: 3 }}>
                <strong>Trạng thái:</strong>{" "}
                {detail.status === "scheduled"
                  ? "Chưa diễn ra"
                  : detail.status === "live"
                  ? "Đang diễn ra"
                  : "Đã kết thúc"}
              </Typography>
              <Typography>
                <strong>Người thắng:</strong>{" "}
                {detail.winner === "A"
                  ? "Đôi A"
                  : detail.winner === "B"
                  ? "Đôi B"
                  : "Chưa xác định"}
              </Typography>
            </Box>
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
