// src/layouts/match/AdminMatchesListGrouped.jsx
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  Stack,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Grid,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  useListAllMatchesQuery,
  useGetMatchQuery,
  useAssignRefereeMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

export default function AdminMatchesListGrouped() {
  // 1) Lấy toàn bộ trận
  const { data: matches = [], isLoading, error, refetch } = useListAllMatchesQuery();
  // 2) Lấy referees
  const { data: users = { users: [] } } = useGetUsersQuery({
    page: 1,
    keyword: "",
    role: "referee",
  });

  // State dialog
  const [assignDlg, setAssignDlg] = useState(null); // { match, refereeId }
  const [detailId, setDetailId] = useState(null); // match._id
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  // Mutation gán referee
  const [assignReferee, { isLoading: assigning }] = useAssignRefereeMutation();

  useEffect(() => {
    if (error) showSnack("error", error?.data?.message || error.error);
  }, [error]);

  // 3) Gom group theo tournament → bracket
  const grouped = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      const tId = m.tournament._id;
      const tName = m.tournament.name;
      const bId = m.bracket._id;
      const bName = m.bracket.name;
      if (!map[tId]) map[tId] = { tournamentName: tName, brackets: {} };
      if (!map[tId].brackets[bId]) {
        map[tId].brackets[bId] = { bracketName: bName, matches: [] };
      }
      map[tId].brackets[bId].matches.push(m);
    });
    return map;
  }, [matches]);

  // Dialog gán referee
  const openAssign = (m) => setAssignDlg({ match: m, refereeId: m.referee?._id || "" });
  const saveAssign = async () => {
    try {
      await assignReferee({
        matchId: assignDlg.match._id,
        refereeId: assignDlg.refereeId || null,
      }).unwrap();
      showSnack("success", "Gán trọng tài thành công");
      setAssignDlg(null);
      refetch();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error || "Cập nhật thất bại");
    }
  };

  // 4) Lấy chi tiết trận khi mở dialog Info
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
  } = useGetMatchQuery(detailId, { skip: !detailId });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Quản lý trận đấu
        </Typography>

        {isLoading ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          // Render từng tournament
          Object.entries(grouped).map(([tId, tData]) => (
            <Accordion key={tId} defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Giải: {tData.tournamentName}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {/* Render từng bracket */}
                {Object.entries(tData.brackets).map(([bId, bData]) => (
                  <Box key={bId} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      📋 Bảng: {bData.bracketName}
                    </Typography>
                    <Stack spacing={1}>
                      {/* Render từng match */}
                      {bData.matches.map((m) => (
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
                                Trạng thái:{" "}
                                {m.status === "scheduled"
                                  ? "Chưa diễn ra"
                                  : m.status === "live"
                                  ? "Đang diễn ra"
                                  : "Đã kết thúc"}
                                {" • "}best‐of {m.rules.bestOf}, đến {m.rules.pointsToWin} (
                                {m.rules.winByTwo ? "cần chênh 2" : "không cần chênh 2"})
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                Trọng tài: {m.referee?.name || "Chưa phân"}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1}>
                              <IconButton onClick={() => setDetailId(m._id)} size="small">
                                <InfoIcon />
                              </IconButton>
                              <IconButton onClick={() => openAssign(m)} size="small">
                                <EditIcon />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Box>

      {/* Dialog Gán Trọng tài */}
      <Dialog open={!!assignDlg} onClose={() => setAssignDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Gán trọng tài</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 2 }} variant="outlined">
            <InputLabel id="select-referee-label">Chọn trọng tài</InputLabel>
            <Select
              labelId="select-referee-label"
              id="select-referee"
              value={assignDlg?.refereeId || ""}
              onChange={(e) => setAssignDlg((d) => ({ ...d, refereeId: e.target.value }))}
              label="Chọn trọng tài" // 👈 dòng này rất quan trọng
              IconComponent={ArrowDropDownIcon}
              sx={{
                minHeight: 56,
                "& .MuiSelect-select": {
                  display: "flex",
                  alignItems: "center",
                },
              }}
            >
              <MenuItem value="">
                <em>Chưa phân</em>
              </MenuItem>
              {users.users.map((u) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name} ({u.nickname})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDlg(null)} color="error">
            Hủy
          </Button>
          <Button onClick={saveAssign} disabled={assigning} variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Chi tiết trận */}
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết trận đấu</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box textAlign="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : detailError ? (
            <Alert severity="error">{detailError?.data?.message || detailError.error}</Alert>
          ) : detail ? (
            <>
              {/* Header chung */}
              <Typography variant="h6" gutterBottom>
                {detail.tournament.name} • {detail.bracket.name} • Vòng {detail.round}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Info đôi A/B */}
              <Grid container spacing={2}>
                {["pairA", "pairB"].map((key) => {
                  const p = detail[key];
                  return (
                    <Grid item xs={12} sm={6} key={key}>
                      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {key === "pairA" ? "Đôi A" : "Đôi B"}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                          <Avatar sx={{ width: 48, height: 48 }} />
                          <Box>
                            <Typography>
                              {p.player1.fullName} & {p.player2.fullName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.player1.phone} – {p.player2.phone}
                            </Typography>
                          </Box>
                        </Stack>
                        {/* Self scores */}
                        <Typography variant="body2" color="text.secondary">
                          Điểm đăng ký: {p.player1.score} + {p.player2.score} ={" "}
                          {p.player1.score + p.player2.score}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>

              {/* Bảng điểm ván đấu */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Bảng điểm từng ván
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ tableLayout: "fixed", minWidth: 360 }}>
                  <TableHead sx={{ display: "table-header-group" }}>
                    <TableRow>
                      <TableCell sx={{ width: "20%" }}>Ván</TableCell>
                      <TableCell sx={{ width: "40%", textAlign: "center" }}>Đôi A</TableCell>
                      <TableCell sx={{ width: "40%", textAlign: "center" }}>Đôi B</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.gameScores.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>#{i + 1}</TableCell>
                        <TableCell sx={{ textAlign: "center" }}>{g.a}</TableCell>
                        <TableCell sx={{ textAlign: "center" }}>{g.b}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Phần thông tin phụ */}
              <Stack spacing={1} sx={{ mt: 3 }}>
                <Typography>
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
                <Typography>
                  <strong>Trọng tài:</strong> {detail.referee?.name || "Chưa phân"}
                </Typography>
                {detail.note && (
                  <Typography>
                    <strong>Ghi chú:</strong> {detail.note}
                  </Typography>
                )}
              </Stack>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

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
    </DashboardLayout>
  );
}
