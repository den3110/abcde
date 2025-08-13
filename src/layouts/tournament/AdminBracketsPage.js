// src/layouts/tournament/AdminBracketsPage.jsx
import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Select,
  InputLabel,
  FormControl,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  TableChart as TableChartIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useResetMatchChainMutation } from "slices/tournamentsApiSlice";

import {
  useGetTournamentQuery,
  useGetRegistrationsQuery,
  useListBracketsQuery,
  useCreateBracketMutation,
  useDeleteBracketMutation,
  useListAllMatchesQuery,
  useCreateMatchMutation,
  useDeleteMatchMutation,
  useUpdateBracketMutation,
  useUpdateMatchMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";

/* ===== Helpers cho đơn/đôi (giữ nguyên) ===== */
function normType(t) {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return "double";
}
const regName = (reg, evType) => {
  if (!reg) return "—";
  if (evType === "single") return reg.player1?.fullName || "N/A";
  const a = reg.player1?.fullName || "N/A";
  const b = reg.player2?.fullName || "N/A";
  return `${a} & ${b}`;
};

export default function AdminBracketsPage() {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();

  // 1) Thông tin giải (giữ nguyên)
  const {
    data: tournament,
    isLoading: loadingT,
    error: errorT,
  } = useGetTournamentQuery(tournamentId);

  const evType = normType(tournament?.eventType);
  const isSingles = evType === "single";

  // 2b) Danh sách trọng tài (giữ nguyên)
  const {
    data: usersData,
    isLoading: refsLoading,
    error: refsError,
  } = useGetUsersQuery({ page: 1, keyword: "", role: "referee" });
  const referees = usersData?.users ?? [];
  const refName = (u) => u?.fullName || u?.name || u?.email || "Referee";

  // 2) Các cặp đăng ký (giữ nguyên)
  const {
    data: registrations = [],
    isLoading: regsLoading,
    error: regsError,
  } = useGetRegistrationsQuery(tournamentId);

  // 3) Danh sách bracket (giữ nguyên)
  const {
    data: brackets = [],
    isLoading: loadingB,
    error: errorB,
    refetch: refetchBrackets,
  } = useListBracketsQuery(tournamentId);

  // 4) Toàn bộ match (lọc theo giải) (giữ nguyên)
  const {
    data: allMatches = [],
    isLoading: loadingM,
    error: errorM,
    refetch: refetchMatches,
  } = useListAllMatchesQuery();
  const matches = useMemo(
    () =>
      allMatches.filter((m) => String(m.tournament?._id || m.tournament) === String(tournamentId)),
    [allMatches, tournamentId]
  );

  // Mutations (giữ nguyên)
  const [createBracket] = useCreateBracketMutation();
  const [deleteBracket] = useDeleteBracketMutation();
  const [createMatch] = useCreateMatchMutation();
  const [deleteMatch] = useDeleteMatchMutation();
  const [updateBracket] = useUpdateBracketMutation();
  const [updateMatch] = useUpdateMatchMutation();
  const [resetMatchChain] = useResetMatchChainMutation();

  // Snackbar (giữ nguyên)
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // =============== Dialog tạo Bracket (giữ nguyên) ===============
  const [bracketDlg, setBracketDlg] = useState(false);
  const [newBracketName, setNewBracketName] = useState("");
  const [newBracketType, setNewBracketType] = useState("knockout");
  const [newBracketStage, setNewBracketStage] = useState(1);

  // =============== Dialog tạo Match đơn lẻ ===============
  const [matchDlg, setMatchDlg] = useState(false);
  const [selBracket, setSelBracket] = useState("");
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [rules, setRules] = useState({ bestOf: 3, pointsToWin: 11, winByTwo: true });
  const [newRound, setNewRound] = useState(1);
  const [newOrder, setNewOrder] = useState(0);
  const [newReferee, setNewReferee] = useState("");

  const [newRatingDelta, setNewRatingDelta] = useState(0); // NEW: delta khi tạo match

  // =============== Dialog tạo Vòng sau (giữ nguyên) ===============
  const [nextDlg, setNextDlg] = useState(false);
  const [nextDlgBracket, setNextDlgBracket] = useState(null);
  const [nextRound, setNextRound] = useState(2);
  const [pairs, setPairs] = useState([]);

  // =============== Dialog sửa Bracket (giữ nguyên) ===============
  const [editBracketDlg, setEditBracketDlg] = useState(false);
  const [ebId, setEbId] = useState("");
  const [ebName, setEbName] = useState("");
  const [ebType, setEbType] = useState("knockout");
  const [ebStage, setEbStage] = useState(1);
  const [ebOrder, setEbOrder] = useState(0);

  // =============== Dialog sửa Match ===============
  const [editMatchDlg, setEditMatchDlg] = useState(false);
  const [emId, setEmId] = useState("");
  const [emBracketId, setEmBracketId] = useState("");
  const [emRound, setEmRound] = useState(1);
  const [emOrder, setEmOrder] = useState(0);
  const [emPairA, setEmPairA] = useState("");
  const [emPairB, setEmPairB] = useState("");
  const [emRules, setEmRules] = useState({ bestOf: 3, pointsToWin: 11, winByTwo: true });
  const [emStatus, setEmStatus] = useState("scheduled");
  const [emWinner, setEmWinner] = useState("");
  const [emOldStatus, setEmOldStatus] = useState("scheduled");
  const [emOldWinner, setEmOldWinner] = useState("");
  const [emCascade, setEmCascade] = useState(false);
  const [emReferee, setEmReferee] = useState("");

  const [emRatingDelta, setEmRatingDelta] = useState(0); // NEW: delta khi sửa match
  const [emRatingApplied, setEmRatingApplied] = useState(false); // NEW: đã áp dụng?
  const [emRatingAppliedAt, setEmRatingAppliedAt] = useState(null); // NEW: thời điểm áp dụng

  // Nhóm match theo bracket (giữ nguyên)
  const grouped = useMemo(() => {
    const key = (x) => String(x?._id ?? x);
    const m = {};
    brackets.forEach((b) => (m[key(b._id)] = []));
    matches.forEach((mt) => {
      const bid = key(mt.bracket);
      if (m[bid]) m[bid].push(mt);
    });
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) => (a.round || 1) - (b.round || 1) || (a.order ?? 0) - (b.order ?? 0))
    );
    return m;
  }, [brackets, matches]);

  // =============== Handlers tạo/xoá (giữ nguyên ngoài phần NEW) ===============
  const handleCreateBracket = async () => {
    if (!newBracketName.trim()) return showSnack("error", "Tên bracket không được để trống");
    try {
      await createBracket({
        tourId: tournamentId,
        body: {
          name: newBracketName.trim(),
          type: newBracketType,
          stage: newBracketStage,
        },
      }).unwrap();
      showSnack("success", "Đã tạo mới Bracket");
      setBracketDlg(false);
      setNewBracketName("");
      setNewBracketType("knockout");
      setNewBracketStage(1);
      refetchBrackets();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  const handleDeleteBracket = async (br) => {
    if (!window.confirm(`Xoá bracket "${br.name}" kèm toàn bộ trận?`)) return;
    try {
      await deleteBracket({ tournamentId, bracketId: br._id }).unwrap();
      showSnack("success", "Đã xóa Bracket");
      refetchBrackets();
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  const openMatchDialog = (br) => {
    setSelBracket(br._id);
    setPairA("");
    setPairB("");
    setRules({ bestOf: 3, pointsToWin: 11, winByTwo: true });
    setNewRound(1);
    setNewOrder(0);
    setNewReferee("");
    setNewRatingDelta(0); // NEW
    setMatchDlg(true);
  };

  const handleCreateMatch = async () => {
    if (!pairA || !pairB || pairA === pairB) {
      return showSnack("error", "Phải chọn 2 đội khác nhau");
    }
    try {
      await createMatch({
        bracketId: selBracket,
        body: {
          round: newRound,
          order: newOrder,
          pairA,
          pairB,
          rules,
          referee: newReferee || undefined,
          ratingDelta: Math.max(0, Number(newRatingDelta) || 0), // NEW: gửi delta
        },
      }).unwrap();
      showSnack("success", "Đã tạo trận");
      setMatchDlg(false);
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  const handleDeleteMatch = async (mt) => {
    if (!window.confirm("Xoá trận này?")) return;
    try {
      await deleteMatch(mt._id).unwrap();
      showSnack("success", "Đã xóa trận");
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  // ======== “Tạo vòng sau (chọn đội)” (giữ nguyên) ========
  const openNextRoundDialog = (br) => {
    try {
      const k = (x) => String(x?._id ?? x);
      const list = grouped[k(br._id)] || [];
      let lastRound = 1;
      let prev = [];
      if (list.length) {
        lastRound = Math.max(...list.map((m) => m.round || 1));
        prev = list.filter((m) => (m.round || 1) === lastRound);
      }
      const tmp = [];
      for (let i = 0; i < prev.length; i += 2) {
        const leftMatch = prev[i];
        const rightMatch = prev[i + 1] || null;
        const getWinnerRegId = (m) => {
          if (!m || m.status !== "finished") return "";
          if (m.winner === "A") return m.pairA?._id || "";
          if (m.winner === "B") return m.pairB?._id || "";
          return "";
        };
        tmp.push({
          leftMatch,
          rightMatch,
          aRegId: getWinnerRegId(leftMatch),
          bRegId: getWinnerRegId(rightMatch),
        });
      }
      setNextDlgBracket(br);
      setNextRound(list.length ? lastRound + 1 : 2);
      setPairs(tmp);
      setNextDlg(true);
      if (!list.length) {
        showSnack("warning", "Chưa có trận nào ở vòng trước. Hãy tạo trận trước đã.");
      } else if (prev.length < 2) {
        showSnack("warning", "Vòng trước chỉ có 1 trận — cần ≥ 2 trận để ghép.");
      }
    } catch (err) {
      console.error(err);
      showSnack("error", "Không mở được dialog. Kiểm tra console.");
    }
  };

  // ======== Mở/Sửa Bracket (giữ nguyên) ========
  const openEditBracket = (br) => {
    setEbId(br._id);
    setEbName(br.name || "");
    setEbType(br.type || "knockout");
    setEbStage(br.stage ?? 1);
    setEbOrder(br.order ?? 0);
    setEditBracketDlg(true);
  };

  const saveEditBracket = async () => {
    if (!ebId) return;
    try {
      await updateBracket({
        tournamentId,
        bracketId: ebId,
        body: {
          name: ebName.trim(),
          type: ebType,
          stage: Number(ebStage),
          order: Number(ebOrder),
        },
      }).unwrap();
      showSnack("success", "Đã cập nhật Bracket");
      setEditBracketDlg(false);
      refetchBrackets();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  // ======== Mở/Sửa Match (có thêm phần NEW) ========
  const openEditMatch = (mt) => {
    setEmId(mt._id);
    setEmBracketId(mt.bracket?._id || mt.bracket);
    setEmRound(mt.round ?? 1);
    setEmOrder(mt.order ?? 0);
    setEmPairA(mt.pairA?._id || "");
    setEmPairB(mt.pairB?._id || "");
    setEmRules({
      bestOf: mt.rules?.bestOf ?? 3,
      pointsToWin: mt.rules?.pointsToWin ?? 11,
      winByTwo: typeof mt.rules?.winByTwo === "boolean" ? mt.rules.winByTwo : true,
    });
    setEmStatus(mt.status || "scheduled");
    setEmWinner(mt.winner || "");
    setEmOldStatus(mt.status || "scheduled");
    setEmOldWinner(mt.winner || "");
    setEmCascade(false);
    setEmReferee(mt.referee?._id || mt.referee || "");

    setEmRatingDelta(mt.ratingDelta ?? 0); // NEW
    setEmRatingApplied(!!mt.ratingApplied); // NEW
    setEmRatingAppliedAt(mt.ratingAppliedAt || null); // NEW

    setEditMatchDlg(true);
  };

  const willDowngrade = emOldStatus === "finished" && emStatus !== "finished";
  const willChangeWinner = emStatus === "finished" && emWinner && emWinner !== emOldWinner;
  const suggestCascade = willDowngrade || willChangeWinner;

  const saveEditMatch = async () => {
    if (!emId) return;
    if (!emPairA || !emPairB || emPairA === emPairB) {
      return showSnack("error", "Phải chọn 2 đội khác nhau");
    }
    try {
      await updateMatch({
        matchId: emId,
        body: {
          round: Number(emRound),
          order: Number(emOrder),
          pairA: emPairA,
          pairB: emPairB,
          rules: {
            bestOf: Number(emRules.bestOf),
            pointsToWin: Number(emRules.pointsToWin),
            winByTwo: !!emRules.winByTwo,
          },
          status: emStatus,
          winner: emStatus === "finished" ? emWinner : "",
          referee: emReferee || null,
          ratingDelta: Math.max(0, Number(emRatingDelta) || 0), // NEW: cập nhật delta
        },
      }).unwrap();

      if (emCascade) {
        await resetMatchChain({ matchId: emId }).unwrap();
      }

      showSnack("success", emCascade ? "Đã lưu & reset chuỗi trận sau" : "Đã lưu");
      setEditMatchDlg(false);
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  // (giữ nguyên)
  const loading = loadingT || regsLoading || loadingB || loadingM;
  const errorMsg = errorT || regsError || errorB || errorM;
  const idOf = (x) => String(x?._id ?? x);

  // (giữ nguyên)
  const getSideLabel = (mt, side) => {
    const pair = side === "A" ? mt?.pairA : mt?.pairB;
    if (pair) return regName(pair, evType);

    const prevId = side === "A" ? mt?.previousA : mt?.previousB;
    if (!prevId) return "—";

    const prev = matches?.find((m) => idOf(m?._id) === idOf(prevId));
    if (!prev) return "Thắng trận ?";

    if (prev?.status === "finished" && prev?.winner) {
      const reg = prev?.winner === "A" ? prev?.pairA : prev?.pairB;
      return `${regName(reg, evType)} (thắng R${prev?.round}-#${prev?.order ?? 0})`;
    }
    return `Thắng trận R${prev?.round}-#${prev?.order ?? 0} (TBD)`;
  };

  const canCreateNext = pairs.some(
    (row) => (row.leftMatch && row.rightMatch) || (row.leftMatch && !row.rightMatch && row.bRegId)
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Quản lý Brackets & Matches
        </Typography>

        {loading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : errorMsg ? (
          <Alert severity="error">
            {(errorMsg.data?.message || errorMsg.error) ?? "Lỗi khi tải dữ liệu"}
          </Alert>
        ) : (
          <>
            {/* Thông tin giải (giữ nguyên) */}
            <Typography variant="h6" gutterBottom>
              {tournament.name} ({new Date(tournament.startDate).toLocaleDateString()} –{" "}
              {new Date(tournament.endDate).toLocaleDateString()}) •{" "}
              {isSingles ? "Giải đơn" : "Giải đôi"}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Nút tạo Bracket / Xem sơ đồ (giữ nguyên) */}
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setBracketDlg(true)}
              sx={{ mb: 3, color: "white !important" }}
            >
              Tạo Bracket mới
            </Button>
            <Button
              sx={{ mb: 3, ml: 2, color: "white !important" }}
              startIcon={<TableChartIcon />}
              variant="contained"
              onClick={() => navigate(`/admin/tournaments/${tournamentId}/bracket`)}
            >
              Xem Sơ đồ giải
            </Button>

            {/* Danh sách Brackets & Matches (giữ nguyên ngoài phần hiển thị Δ) */}
            <Stack spacing={3}>
              {brackets.map((br) => (
                <Card key={br._id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                      {br.name} ({br.type === "group" ? "Vòng bảng" : "Knockout"}, stage {br.stage})
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => openMatchDialog(br)}
                        startIcon={<AddIcon />}
                      >
                        Tạo trận
                      </Button>
                      {br.type === "knockout" && (
                        <Button size="small" onClick={() => openNextRoundDialog(br)}>
                          Tạo vòng sau (chọn đội)
                        </Button>
                      )}
                      <IconButton onClick={() => openEditBracket(br)} title="Sửa bracket">
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteBracket(br)} title="Xoá bracket">
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {(grouped[idOf(br._id)] || []).map((mt) => (
                      <Stack
                        key={mt._id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ p: 1, backgroundColor: "#fafafa", borderRadius: 1 }}
                      >
                        <Box>
                          <Typography>
                            Vòng {mt.round || 1} — <strong>#{mt.order ?? 0}</strong>:{" "}
                            <strong>{getSideLabel(mt, "A")}</strong> vs{" "}
                            <strong>{getSideLabel(mt, "B")}</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            best‐of {mt.rules.bestOf}, tới {mt.rules.pointsToWin}{" "}
                            {mt.rules.winByTwo ? "(chênh 2)" : ""} — trạng thái: {mt.status}
                            {mt.status === "finished" && mt.winner && <> — winner: {mt.winner}</>}
                            {mt.referee && (
                              <>
                                {" "}
                                — ref:{" "}
                                {typeof mt.referee === "object"
                                  ? refName(mt.referee)
                                  : referees.find((r) => r._id === mt.referee)?.name || mt.referee}
                              </>
                            )}
                            {/* NEW: hiện Δ điểm và trạng thái đã áp dụng */}
                            {typeof mt.ratingDelta !== "undefined" && (
                              <>
                                {" "}
                                — Δ: {mt.ratingDelta ?? 0}
                                {mt.ratingApplied ? " (đã áp dụng)" : ""}
                              </>
                            )}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={0.5}>
                          <IconButton onClick={() => openEditMatch(mt)} title="Sửa trận">
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDeleteMatch(mt)} title="Xoá trận">
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      </Stack>
                    ))}

                    {!grouped[idOf(br._id)]?.length && (
                      <Typography variant="body2" color="text.secondary">
                        Chưa có trận nào.
                      </Typography>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Box>

      {/* Dialog tạo Bracket (giữ nguyên) */}
      <Dialog open={bracketDlg} onClose={() => setBracketDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo Bracket mới</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Tên Bracket"
              fullWidth
              value={newBracketName}
              onChange={(e) => setNewBracketName(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Kiểu Bracket</InputLabel>
              <Select
                value={newBracketType}
                label="Kiểu Bracket"
                onChange={(e) => setNewBracketType(e.target.value)}
                sx={{
                  mt: 1,
                  "& .MuiInputBase-root": { minHeight: 56 },
                  "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                }}
              >
                <MenuItem value="knockout">Knockout</MenuItem>
                <MenuItem value="group">Vòng bảng</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Stage (số thứ tự)"
              type="number"
              fullWidth
              value={newBracketStage}
              onChange={(e) => setNewBracketStage(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBracketDlg(false)}>Huỷ</Button>
          <Button onClick={handleCreateBracket} variant="contained">
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog tạo Match đơn lẻ (thêm ô nhập Δ) */}
      <Dialog open={matchDlg} onClose={() => setMatchDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo trận đấu</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Round"
                type="number"
                value={newRound}
                onChange={(e) => setNewRound(Math.max(1, Number(e.target.value)))}
              />
              <TextField
                label="Order (trong round)"
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(Math.max(0, Number(e.target.value)))}
              />
            </Stack>

            <TextField
              select
              label={isSingles ? "Chọn VĐV A" : "Chọn Đội A"}
              fullWidth
              value={pairA}
              onChange={(e) => setPairA(e.target.value)}
              sx={{
                mt: 1,
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>Chưa chọn</em>
              </MenuItem>
              {registrations.map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {regName(r, evType)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={isSingles ? "Chọn VĐV B" : "Chọn Đội B"}
              fullWidth
              value={pairB}
              onChange={(e) => setPairB(e.target.value)}
              sx={{
                mt: 1,
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>Chưa chọn</em>
              </MenuItem>
              {registrations.map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {regName(r, evType)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Trọng tài"
              value={newReferee}
              onChange={(e) => setNewReferee(e.target.value)}
              sx={{
                mt: 1,
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
              helperText={refsError ? "Lỗi tải danh sách trọng tài" : ""}
            >
              <MenuItem value="">
                <em>— Chưa gán —</em>
              </MenuItem>
              {referees.map((u) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name} {u.nickname ? `(${u.nickname})` : ""}
                </MenuItem>
              ))}
            </TextField>

            <Grid container spacing={2} mt={1} p={2}>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Số ván tối đa"
                  fullWidth
                  value={rules.bestOf}
                  onChange={(e) => setRules((r) => ({ ...r, bestOf: +e.target.value }))}
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  {[1, 3, 5].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n} ván
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Điểm thắng"
                  fullWidth
                  value={rules.pointsToWin}
                  onChange={(e) => setRules((r) => ({ ...r, pointsToWin: +e.target.value }))}
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  {[11, 15, 21].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n} điểm
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Phải chênh 2"
                  fullWidth
                  value={rules.winByTwo ? "yes" : "no"}
                  onChange={(e) => setRules((r) => ({ ...r, winByTwo: e.target.value === "yes" }))}
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  <MenuItem value="yes">Có</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>

              {/* NEW: nhập Δ điểm */}
              <Grid item xs={12}>
                <TextField
                  label="Điểm cộng/trừ (rating delta)"
                  type="number"
                  fullWidth
                  value={newRatingDelta}
                  onChange={(e) => setNewRatingDelta(Math.max(0, Number(e.target.value) || 0))}
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Cộng cho đội thắng, trừ đội thua. 0 = không áp dụng."
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchDlg(false)}>Huỷ</Button>
          <Button
            onClick={handleCreateMatch}
            variant="contained"
            sx={{ color: "white !important" }}
          >
            Tạo trận
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog SỬA Match (thêm ô Δ + cảnh báo áp dụng) */}
      <Dialog open={editMatchDlg} onClose={() => setEditMatchDlg(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sửa trận</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Round"
                type="number"
                value={emRound}
                onChange={(e) => setEmRound(Math.max(1, Number(e.target.value)))}
              />
              <TextField
                label="Order (trong round)"
                type="number"
                value={emOrder}
                onChange={(e) => setEmOrder(Math.max(0, Number(e.target.value)))}
              />
            </Stack>

            <TextField
              select
              fullWidth
              label="Trọng tài"
              value={emReferee}
              onChange={(e) => setEmReferee(e.target.value)}
              sx={{
                mt: 1,
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>— Chưa gán —</em>
              </MenuItem>
              {referees.map((u) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name} {u.nickname ? `(${u.nickname})` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label={isSingles ? "VĐV A" : "Đội A"}
              value={emPairA}
              onChange={(e) => setEmPairA(e.target.value)}
              sx={{
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>— Chưa chọn —</em>
              </MenuItem>
              {registrations.map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {regName(r, evType)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label={isSingles ? "VĐV B" : "Đội B"}
              value={emPairB}
              onChange={(e) => setEmPairB(e.target.value)}
              sx={{
                "& .MuiInputBase-root": { minHeight: 56 },
                "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
              }}
            >
              <MenuItem value="">
                <em>— Chưa chọn —</em>
              </MenuItem>
              {registrations.map((r) => (
                <MenuItem key={r._id} value={r._id}>
                  {regName(r, evType)}
                </MenuItem>
              ))}
            </TextField>

            <Grid container spacing={2} p={2}>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Best of"
                  fullWidth
                  value={emRules.bestOf}
                  onChange={(e) => setEmRules((r) => ({ ...r, bestOf: +e.target.value }))}
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  {[1, 3, 5].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Điểm thắng"
                  fullWidth
                  value={emRules.pointsToWin}
                  onChange={(e) => setEmRules((r) => ({ ...r, pointsToWin: +e.target.value }))}
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  {[11, 15, 21].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField
                  select
                  label="Phải chênh 2"
                  fullWidth
                  value={emRules.winByTwo ? "yes" : "no"}
                  onChange={(e) =>
                    setEmRules((r) => ({ ...r, winByTwo: e.target.value === "yes" }))
                  }
                  sx={{
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                  }}
                >
                  <MenuItem value="yes">Có</MenuItem>
                  <MenuItem value="no">Không</MenuItem>
                </TextField>
              </Grid>

              {/* NEW: nhập & cảnh báo Δ điểm */}
              <Grid item xs={12}>
                <TextField
                  label="Điểm cộng/trừ (rating delta)"
                  type="number"
                  fullWidth
                  value={emRatingDelta}
                  onChange={(e) => setEmRatingDelta(Math.max(0, Number(e.target.value) || 0))}
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Áp dụng khi set trận 'finished' + có 'winner'. 0 = không áp dụng."
                />
                {emRatingApplied && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Điểm đã được áp dụng vào lịch sử (ratingApplied).{" "}
                    {emRatingAppliedAt
                      ? `Thời điểm: ${new Date(emRatingAppliedAt).toLocaleString()}`
                      : ""}
                    . Việc chỉnh “Δ” sau khi đã áp dụng sẽ không tự động sửa lại lịch sử cũ.
                  </Alert>
                )}
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Trạng thái"
                value={emStatus}
                onChange={(e) => setEmStatus(e.target.value)}
                sx={{
                  minWidth: 180,
                  "& .MuiInputBase-root": { minHeight: 56 },
                  "& .MuiSelect-select": { py: 2 },
                }}
              >
                <MenuItem value="scheduled">scheduled</MenuItem>
                <MenuItem value="live">live</MenuItem>
                <MenuItem value="finished">finished</MenuItem>
              </TextField>

              <TextField
                select
                label="Winner"
                value={emWinner}
                onChange={(e) => setEmWinner(e.target.value)}
                disabled={emStatus !== "finished"}
                helperText={emStatus !== "finished" ? "Chỉ chọn khi đã finished" : ""}
                sx={{
                  minWidth: 160,
                  "& .MuiInputBase-root": { minHeight: 56 },
                  "& .MuiSelect-select": { py: 2 },
                }}
              >
                <MenuItem value="">
                  <em>— None —</em>
                </MenuItem>
                <MenuItem value="A">A</MenuItem>
                <MenuItem value="B">B</MenuItem>
              </TextField>
            </Stack>

            {suggestCascade && (
              <Alert severity="warning">
                Bạn đang {willDowngrade ? "đổi trạng thái từ finished → " + emStatus : "đổi winner"}
                .
                <br />
                Có thể cần <b>reset các trận sau</b> trong nhánh này để nhất quán.
              </Alert>
            )}

            <Tooltip
              title="Bật để reset các trận phụ thuộc (nextMatch → …) trong nhánh."
              placement="top-start"
            >
              <span>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={emCascade}
                      onChange={(e) => setEmCascade(e.target.checked)}
                    />
                  }
                  label="Reset chuỗi trận sau (xoá winner đã propagate, đưa các trận sau về TBD)"
                />
                <Typography variant="caption" color="text.secondary">
                  Bật nếu bạn vừa chuyển từ <b>finished</b> về <b>live/scheduled</b> hoặc đổi{" "}
                  <b>winner</b>.
                </Typography>
              </span>
            </Tooltip>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMatchDlg(false)}>Huỷ</Button>
          <Button onClick={saveEditMatch} variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Tạo vòng sau (giữ nguyên) */}
      <Dialog open={nextDlg} onClose={() => setNextDlg(false)} fullWidth maxWidth="md">
        <DialogTitle>Tạo vòng {nextRound} (chọn đội)</DialogTitle>
        <DialogContent>
          {/* ...giữ nguyên toàn bộ nội dung tạo vòng sau... */}
          {/* (Không đổi gì phần logic cũ) */}
          {/* BEGIN giữ nguyên */}
          {!nextDlgBracket ? (
            <Alert severity="warning">Chưa chọn bracket</Alert>
          ) : (
            <>
              {(() => {
                const list = grouped[idOf(nextDlgBracket._id)] || [];
                const hasAny = list.length > 0;
                const lastRound = hasAny ? Math.max(...list.map((m) => m.round || 1)) : 1;
                const prev = hasAny ? list.filter((m) => (m.round || 1) === lastRound) : [];
                const prevCount = prev.length;
                const maxCreatable = Math.floor(prevCount / 2);
                const completePairs = pairs.filter((p) => p.aRegId && p.bRegId).length;

                return (
                  <Alert severity={prevCount >= 2 ? "info" : "warning"} sx={{ mb: 2 }}>
                    {hasAny ? (
                      <>
                        Vòng trước có <b>{prevCount}</b> trận ⇒ tối đa tạo được{" "}
                        <b>{maxCreatable}</b> trận ở vòng {nextRound}. Bạn đã chọn đủ{" "}
                        <b>{completePairs}</b>/<b>{maxCreatable}</b> trận.
                      </>
                    ) : (
                      <>Chưa có trận nào ở vòng trước. Hãy tạo trận trước đã.</>
                    )}
                  </Alert>
                );
              })()}

              <Stack spacing={2}>
                {pairs.map((row, idx) => {
                  const lm = row.leftMatch;
                  const rm = row.rightMatch;

                  const lmLabel = lm
                    ? `R${lm.round}-#${lm.order ?? 0}: ${regName(lm.pairA, evType)} vs ${regName(
                        lm.pairB,
                        evType
                      )}`
                    : "—";
                  const rmLabel = rm
                    ? `R${rm.round}-#${rm.order ?? 0}: ${regName(rm.pairA, evType)} vs ${regName(
                        rm.pairB,
                        evType
                      )}`
                    : "—";

                  const prevList = (grouped[idOf(nextDlgBracket._id)] || []).filter(
                    (m) => (m.round || 1) === nextRound - 1
                  );
                  const otherTeams = !rm
                    ? prevList
                        .filter((pm) => pm._id !== lm?._id)
                        .flatMap((pm) => [pm.pairA, pm.pairB])
                        .filter(Boolean)
                    : [];

                  return (
                    <Card key={idx} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Từ trận trái: {lmLabel}
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        label={isSingles ? "Chọn VĐV cho Slot A" : "Chọn đội cho Slot A"}
                        value={row.aRegId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPairs((ps) => ps.map((p, i) => (i === idx ? { ...p, aRegId: v } : p)));
                        }}
                        sx={{
                          mt: 1,
                          "& .MuiInputBase-root": { minHeight: 56 },
                          "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                        }}
                      >
                        <MenuItem value="">
                          <em>— Chưa chọn —</em>
                        </MenuItem>
                        {[
                          lm?.pairA && (
                            <MenuItem key={`${lm._id}-A`} value={lm.pairA._id}>
                              {regName(lm.pairA, evType)}
                            </MenuItem>
                          ),
                          lm?.pairB && (
                            <MenuItem key={`${lm._id}-B`} value={lm.pairB._id}>
                              {regName(lm.pairB, evType)}
                            </MenuItem>
                          ),
                        ].filter(Boolean)}
                      </TextField>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="body2" color="text.secondary">
                        Từ trận phải: {rmLabel}
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        label={isSingles ? "Chọn VĐV cho Slot B" : "Chọn đội cho Slot B"}
                        value={row.bRegId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPairs((ps) => ps.map((p, i) => (i === idx ? { ...p, bRegId: v } : p)));
                        }}
                        sx={{
                          mt: 1,
                          "& .MuiInputBase-root": { minHeight: 56 },
                          "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                        }}
                        disabled={!rm && otherTeams.length === 0}
                        helperText={
                          rm
                            ? ""
                            : otherTeams.length === 0
                            ? "Vòng trước quá ít đội — chưa có đội khác để ghép B"
                            : "Ghép chéo vì vòng trước lẻ"
                        }
                      >
                        <MenuItem value="">
                          <em>— Chưa chọn —</em>
                        </MenuItem>

                        {rm
                          ? [
                              rm?.pairA && (
                                <MenuItem key={`${rm._id}-A`} value={rm.pairA._id}>
                                  {regName(rm.pairA, evType)}
                                </MenuItem>
                              ),
                              rm?.pairB && (
                                <MenuItem key={`${rm._id}-B`} value={rm.pairB._id}>
                                  {regName(rm.pairB, evType)}
                                </MenuItem>
                              ),
                            ].filter(Boolean)
                          : otherTeams.map((t) => (
                              <MenuItem key={t._id} value={t._id}>
                                {regName(t, evType)}
                              </MenuItem>
                            ))}
                      </TextField>
                    </Card>
                  );
                })}

                <Alert severity="info">
                  Bạn đang <b>chọn trực tiếp Registration</b> đi tiếp (không auto “winner of
                  match”).
                </Alert>
              </Stack>
            </>
          )}
          {/* END giữ nguyên */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNextDlg(false)}>Huỷ</Button>
          <Button
            sx={{ color: "white !important" }}
            variant="contained"
            disabled={!canCreateNext}
            onClick={async () => {
              // (giữ nguyên logic tạo vòng sau)
              try {
                if (!nextDlgBracket) return;
                let created = 0;
                const idOf = (x) => String(x?._id ?? x);

                const prevList = (grouped[idOf(nextDlgBracket._id)] || []).filter(
                  (m) => (m.round || 1) === nextRound - 1
                );
                const regToPrevMatch = new Map();
                prevList.forEach((pm) => {
                  if (pm.pairA?._id) regToPrevMatch.set(String(pm.pairA._id), String(pm._id));
                  if (pm.pairB?._id) regToPrevMatch.set(String(pm.pairB._id), String(pm._id));
                });

                for (let i = 0; i < pairs.length; i++) {
                  const row = pairs[i];
                  const lm = row.leftMatch;
                  const rm = row.rightMatch;

                  if (lm && rm) {
                    await createMatch({
                      bracketId: nextDlgBracket._id,
                      body: {
                        round: nextRound,
                        order: i,
                        previousA: lm._id,
                        previousB: rm._id,
                        rules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
                      },
                    }).unwrap();
                    created++;
                    continue;
                  }

                  if (lm && !rm) {
                    if (!row.bRegId) {
                      showSnack("warning", `Cặp #${i}: chưa chọn đội cho Slot B`);
                      continue;
                    }
                    const prevB = regToPrevMatch.get(String(row.bRegId));
                    if (prevB && String(prevB) === String(lm._id)) {
                      showSnack(
                        "error",
                        "Hai đội đang cùng xuất phát từ 1 trận ở vòng trước. Hãy chọn đội khác cho Slot B."
                      );
                      continue;
                    }

                    await createMatch({
                      bracketId: nextDlgBracket._id,
                      body: {
                        round: nextRound,
                        order: i,
                        previousA: lm._id,
                        pairB: row.bRegId,
                        rules: { bestOf: 3, pointsToWin: 11, winByTwo: true },
                      },
                    }).unwrap();
                    created++;
                    continue;
                  }
                }

                if (!created) {
                  showSnack("warning", "Chưa có trận nào được tạo.");
                } else {
                  showSnack("success", `Đã tạo ${created} trận ở vòng ${nextRound}`);
                  setNextDlg(false);
                  refetchMatches();
                }
              } catch (e) {
                showSnack("error", e?.data?.message || e.error);
              }
            }}
          >
            Tạo trận vòng {nextRound}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Sửa Bracket (giữ nguyên) */}
      <Dialog
        open={editBracketDlg}
        onClose={() => setEditBracketDlg(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Sửa Bracket</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Tên Bracket"
              fullWidth
              value={ebName}
              onChange={(e) => setEbName(e.target.value)}
            />

            <FormControl fullWidth>
              <InputLabel>Kiểu Bracket</InputLabel>
              <Select
                value={ebType}
                label="Kiểu Bracket"
                onChange={(e) => setEbType(e.target.value)}
                sx={{
                  mt: 1,
                  "& .MuiInputBase-root": { minHeight: 56 },
                  "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                }}
              >
                <MenuItem value="knockout">Knockout</MenuItem>
                <MenuItem value="group">Vòng bảng</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Stage (số thứ tự)"
              type="number"
              fullWidth
              value={ebStage}
              onChange={(e) => setEbStage(Number(e.target.value))}
            />

            <TextField
              label="Order (thứ tự hiển thị)"
              type="number"
              fullWidth
              value={ebOrder}
              onChange={(e) => setEbOrder(Number(e.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBracketDlg(false)}>Huỷ</Button>
          <Button onClick={saveEditBracket} variant="contained" sx={{ color: "white !important" }}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar (giữ nguyên) */}
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

      <Footer />
    </DashboardLayout>
  );
}
