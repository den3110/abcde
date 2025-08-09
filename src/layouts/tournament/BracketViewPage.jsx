// src/layouts/tournament/BracketViewPage.jsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Paper,
} from "@mui/material";
import { useGetBracketQuery, useListMatchesQuery } from "slices/tournamentsApiSlice";

export default function BracketViewPage() {
  const { bracketId } = useParams();
  // 1️⃣ Lấy thông tin bracket
  const { data: bracket, isLoading: bLoading, error: bError } = useGetBracketQuery(bracketId);
  // 2️⃣ Lấy match của bracket
  const { data: matches = [], isLoading: mLoading, error: mError } = useListMatchesQuery(bracketId);

  if (bLoading || mLoading) return <CircularProgress />;
  if (bError || mError)
    return (
      <Alert severity="error">{(bError || mError).error?.data?.message || "Lỗi tải dữ liệu"}</Alert>
    );
  if (!bracket) return null;

  // Nếu vòng bảng: tính standings
  const standings = useMemo(() => {
    const stats = {};
    matches.forEach((m) => {
      const a = m.pairA._id,
        b = m.pairB._id;
      stats[a] = stats[a] || { pair: m.pairA, win: 0, loss: 0 };
      stats[b] = stats[b] || { pair: m.pairB, win: 0, loss: 0 };
      if (m.winner === "A") {
        stats[a].win++;
        stats[b].loss++;
      } else if (m.winner === "B") {
        stats[b].win++;
        stats[a].loss++;
      }
    });
    return Object.values(stats).sort((x, y) => y.win - x.win || x.loss - y.loss);
  }, [matches]);

  // Nếu knockout: nhóm theo vòng
  const rounds = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      map[m.round] = map[m.round] || [];
      map[m.round].push(m);
    });
    return map; // { 1: [...], 2: [...], ... }
  }, [matches]);

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        {bracket.name} ({bracket.type === "group" ? "Vòng bảng" : "Knockout"})
      </Typography>

      {bracket.type === "group" ? (
        // === GROUP STANDINGS ===
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Cặp</TableCell>
              <TableCell align="center">Thắng</TableCell>
              <TableCell align="center">Thua</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {standings.map((s, i) => (
              <TableRow key={s.pair._id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  {s.pair.player1.fullName} & {s.pair.player2.fullName}
                </TableCell>
                <TableCell align="center">{s.win}</TableCell>
                <TableCell align="center">{s.loss}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        // === KNOCKOUT BRACKET ===
        <Stack direction="row" spacing={4} alignItems="flex-start">
          {Object.keys(rounds)
            .sort((a, b) => a - b)
            .map((roundNum) => (
              <Box key={roundNum}>
                <Typography variant="subtitle1" align="center" gutterBottom>
                  Vòng {roundNum}
                </Typography>
                <Stack spacing={2}>
                  {rounds[roundNum].map((m) => (
                    <Paper key={m._id} sx={{ p: 1 }}>
                      <Typography variant="body2">
                        {m.pairA.player1.fullName} & {m.pairA.player2.fullName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" align="center">
                        vs
                      </Typography>
                      <Typography variant="body2">
                        {m.pairB.player1.fullName} & {m.pairB.player2.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {m.status === "finished"
                          ? `KQ: ${m.winner === "A" ? "Đôi A" : "Đôi B"}`
                          : m.status === "live"
                          ? "Đang diễn ra"
                          : "Chưa diễn ra"}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            ))}
        </Stack>
      )}
    </Box>
  );
}
