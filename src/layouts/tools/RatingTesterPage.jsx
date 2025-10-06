import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Grid,
  Typography,
  Button,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Card,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Autocomplete,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import CalculateIcon from "@mui/icons-material/Calculate";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useLocation, useNavigate } from "react-router-dom";
import { skipToken } from "@reduxjs/toolkit/query";

/* ===== tournament slices ===== */
import {
  useGetTournamentQuery,
  useListTournamentBracketsQuery,
  useGetRegistrationsQuery,
  useGetRecentTournamentsQuery,
  usePreviewRatingDeltaMutation,
} from "slices/tournamentsApiSlice";

/* ===== Helpers đơn/đôi ===== */
function normType(t) {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return "double";
}
const regName = (reg, evType) => {
  if (!reg) return "—";
  if (evType === "single") return reg?.player1?.fullName || "N/A";
  const a = reg?.player1?.fullName || "N/A";
  const b = reg?.player2?.fullName || "N/A";
  return `${a} & ${b}`;
};

// New: prefer nickname when available
const regNickName = (reg, evType) => {
  if (!reg) return "—";
  // if registration has a team-level nickname / displayName
  if (reg?.nickName) return reg.nickName;
  if (evType === "single") return reg?.player1?.nickName || reg?.player1?.fullName || "N/A";
  const a = reg?.player1?.nickName || reg?.player1?.fullName || "N/A";
  const b = reg?.player2?.nickName || reg?.player2?.fullName || "N/A";
  return `${a} & ${b}`;
};

const idOf = (x) => String(x?._id ?? x);

export default function RatingTesterPage() {
  const navigate = useNavigate();
  const qs = new URLSearchParams(useLocation().search);
  const qsTournament = qs.get("t") || "";
  const qsBracket = qs.get("b") || "";

  /* ====== State chọn lọc ====== */
  const [tournamentId, setTournamentId] = useState(qsTournament);
  const [bracketId, setBracketId] = useState(qsBracket);

  // dữ liệu list tournament để chọn (mặc định 50 gần đây)
  const { data: rec = {}, isLoading: loadingRec } = useGetRecentTournamentsQuery({
    limit: 50,
    sort: "-updatedAt",
  });
  const tournaments = useMemo(() => {
    const items = Array.isArray(rec) ? rec : rec?.items || rec?.tournaments || [];
    return items || [];
  }, [rec]);

  // thông tin tournament & brackets & registrations
  const { data: tournament, isLoading: loadingT } = useGetTournamentQuery(
    tournamentId || skipToken
  );
  const evType = normType(tournament?.eventType);
  const isSingles = evType === "single";

  const { data: brackets = [], isLoading: loadingB } = useListTournamentBracketsQuery(
    tournamentId || skipToken
  );

  useEffect(() => {
    if (brackets?.length && qsBracket) {
      const ok = brackets.some((b) => idOf(b._id) === idOf(qsBracket));
      if (!ok) setBracketId("");
    }
  }, [brackets, qsBracket]);

  const { data: registrations = [], isLoading: loadingRegs } = useGetRegistrationsQuery(
    tournamentId || skipToken
  );

  /* ====== Form test ====== */
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [winner, setWinner] = useState("A");
  const [round, setRound] = useState(1);
  const [forfeit, setForfeit] = useState(false);
  const [gameScores, setGameScores] = useState([{ a: 11, b: 7 }]);

  // khi đổi tournament → reset các selection phụ
  useEffect(() => {
    setBracketId(qsBracket && tournamentId === qsTournament ? qsBracket : "");
    setPairA("");
    setPairB("");
    setWinner("A");
    setRound(1);
    setForfeit(false);
    setGameScores([{ a: 11, b: 7 }]);
  }, [tournamentId]); // eslint-disable-line

  const addGameRow = () => setGameScores((gs) => [...gs, { a: 0, b: 0 }]);
  const removeGameRow = (i) => setGameScores((gs) => gs.filter((_, idx) => idx !== i));
  const setGameVal = (i, k, v) =>
    setGameScores((gs) =>
      gs.map((g, idx) => (idx === i ? { ...g, [k]: Math.max(0, Number(v) || 0) } : g))
    );

  /* ====== Preview call ====== */
  const [previewRatingDelta, { isLoading: previewing }] = usePreviewRatingDeltaMutation();
  const [details, setDetails] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const canCompute = tournamentId && pairA && pairB && winner;

  const onCompute = async () => {
    setErrMsg("");
    setDetails(null);
    if (!canCompute) {
      setErrMsg("Hãy chọn giải, 2 đội và Winner.");
      return;
    }
    try {
      const res = await previewRatingDelta({
        tournamentId,
        bracketId: bracketId || undefined,
        round,
        pairARegId: pairA,
        pairBRegId: pairB,
        winner,
        gameScores,
        forfeit,
      }).unwrap();
      setDetails(res);
    } catch (e) {
      setErrMsg(e?.data?.message || e.error || "Lỗi preview");
    }
  };

  // helpers to find option objects for Autocomplete values
  const findTournamentById = (id) => tournaments.find((t) => idOf(t._id || t.id) === id) || null;
  const findBracketById = (id) => (brackets || []).find((b) => idOf(b._id) === id) || null;
  const findRegById = (id) => (registrations || []).find((r) => idOf(r._id) === id) || null;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h4">Công cụ Test tính điểm (delta)</Typography>
          <Tooltip title="Quay về trang Brackets">
            <Button onClick={() => navigate(-1)}>Quay lại</Button>
          </Tooltip>
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Trang global cho Admin: chọn giải & 2 đội → nhập tỉ số set / winner / forfeit →{" "}
          <b>Tính thử</b>. Không ghi DB; dùng để debug và tinh chỉnh thuật toán.
        </Alert>

        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={tournaments}
                getOptionLabel={(option) => option?.name || ""}
                value={findTournamentById(tournamentId)}
                onChange={(e, val) => setTournamentId(val ? idOf(val._id || val.id) : "")}
                disabled={loadingRec}
                sx={{ "& .MuiInputBase-root": { minHeight: 56 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Giải đấu"
                    fullWidth
                    helperText={
                      loadingRec
                        ? "Đang tải danh sách..."
                        : "Chọn giải để tải brackets/registrations"
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={brackets || []}
                getOptionLabel={(option) => option?.name || ""}
                value={findBracketById(bracketId)}
                onChange={(e, val) => setBracketId(val ? idOf(val._id) : "")}
                disabled={!tournamentId || loadingB}
                sx={{ "& .MuiInputBase-root": { minHeight: 56 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Bracket (tuỳ chọn)"
                    fullWidth
                    helperText="Phục vụ phase multiplier / context"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={registrations || []}
                getOptionLabel={(option) => regNickName(option, evType)}
                value={findRegById(pairA)}
                onChange={(e, val) => setPairA(val ? idOf(val._id) : "")}
                disabled={!tournamentId || loadingRegs}
                sx={{ "& .MuiInputBase-root": { minHeight: 56 } }}
                renderInput={(params) => (
                  <TextField {...params} label={isSingles ? "VĐV A" : "Đội A"} fullWidth />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={registrations || []}
                getOptionLabel={(option) => regNickName(option, evType)}
                value={findRegById(pairB)}
                onChange={(e, val) => setPairB(val ? idOf(val._id) : "")}
                disabled={!tournamentId || loadingRegs}
                sx={{ "& .MuiInputBase-root": { minHeight: 56 } }}
                renderInput={(params) => (
                  <TextField {...params} label={isSingles ? "VĐV B" : "Đội B"} fullWidth />
                )}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Winner"
                value={winner}
                onChange={(e) => setWinner(e.target.value)}
                fullWidth
                sx={{ "& .MuiInputBase-root": { minHeight: 56 }, "& .MuiSelect-select": { py: 2 } }}
              >
                <MenuItem value="A">A</MenuItem>
                <MenuItem value="B">B</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Round"
                type="number"
                value={round}
                onChange={(e) => setRound(Math.max(1, Number(e.target.value) || 1))}
                helperText="Ảnh hưởng phase multiplier"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={3} alignItems="center" display="flex">
              <FormControlLabel
                control={
                  <Checkbox checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
                }
                label="Forfeit"
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ p: 1.5, border: "1px dashed #ddd", borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  Tỉ số các set
                </Typography>
                <Stack spacing={1}>
                  {gameScores.map((g, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField
                        label="A"
                        type="number"
                        value={g.a}
                        onChange={(e) => setGameVal(i, "a", e.target.value)}
                        size="small"
                        sx={{ width: 120 }}
                      />
                      <TextField
                        label="B"
                        type="number"
                        value={g.b}
                        onChange={(e) => setGameVal(i, "b", e.target.value)}
                        size="small"
                        sx={{ width: 120 }}
                      />
                      <IconButton
                        onClick={() => removeGameRow(i)}
                        disabled={gameScores.length <= 1}
                        title="Xoá set"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button size="small" onClick={addGameRow} startIcon={<AddIcon />}>
                    Thêm set
                  </Button>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<CalculateIcon />}
                  sx={{ color: "white !important" }}
                  disabled={!canCompute || previewing}
                  onClick={onCompute}
                >
                  {previewing ? "Đang tính..." : "Tính thử"}
                </Button>
                <Button onClick={() => setDetails(null)}>Xoá kết quả</Button>
              </Stack>
            </Grid>
          </Grid>
        </Card>

        {errMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errMsg}
          </Alert>
        )}

        {/* Kết quả preview */}
        {previewing ? (
          <Box textAlign="center" py={4}>
            <CircularProgress />
          </Box>
        ) : details ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="success" sx={{ mb: 1 }}>
                Δ (mỗi người, sau soft-cap): <b>{details?.delta?.soft}</b> • zero-sum check:{" "}
                <b>{details?.zeroSumCheck}</b> • K_match: <b>{details?.multipliers?.K_match}</b>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Đội hình & Expected
                </Typography>
                <Typography variant="body2">
                  TeamA: <b>{details.teams.teamA}</b> • TeamB: <b>{details.teams.teamB}</b> •
                  diffRaw: <b>{details.teams.diffRaw}</b>
                </Typography>
                <Typography variant="body2">
                  expA: <b>{details.expected.expA}</b> • expB: <b>{details.expected.expB}</b> •
                  E_win: <b>{details.expected.E_win}</b>
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Context / Form
                </Typography>
                <Typography variant="body2">
                  formA: <b>{details.context.formA}</b> • formB: <b>{details.context.formB}</b> •
                  contextDU: <b>{details.context.contextDU}</b>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  (Form từ win%, set-win%, streak, SOS của lịch sử gần đây)
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Hệ số & Upset
                </Typography>
                <Typography variant="body2">
                  baseK: <b>{details.multipliers.baseK}</b> • avgReliability:{" "}
                  <b>{details.multipliers.avgReliability}</b>
                </Typography>
                <Typography variant="body2">
                  marginBoost: <b>{details.multipliers.marginBonus}</b> • phaseMul:{" "}
                  <b>{details.multipliers.phaseMul}</b> • upsetBoost:{" "}
                  <b>{details.multipliers.upsetBoost}</b>
                </Typography>
                <Typography variant="body2">
                  kScale: <b>{details.multipliers.kScale}</b> • K_match:{" "}
                  <b>{details.multipliers.K_match}</b>
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">
                  Δ_raw: <b>{details.delta.raw}</b> → soft-cap (~{details.delta.cap}):{" "}
                  <b>{details.delta.soft}</b>
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Δ từng người
                </Typography>
                <Grid container spacing={1}>
                  {(details.perUser || []).map((u, idx) => (
                    <Grid key={idx} item xs={12} sm={6} md={4}>
                      <Card variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="body2">
                          <b>{u.uid}</b> — side {u.side}
                        </Typography>
                        <Typography variant="body2">
                          trước: {u.before} • Δ: <b>{u.delta}</b> • sau: {u.after}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Box>
      <Footer />
    </DashboardLayout>
  );
}
