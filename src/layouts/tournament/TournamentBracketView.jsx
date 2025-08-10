// src/layouts/tournament/TournamentBracketView.jsx
import { useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Card,
  Alert,
  TableContainer,
  Paper,
  Divider,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon, EmojiEvents as TrophyIcon } from "@mui/icons-material";
import { useParams } from "react-router-dom";
import {
  useListBracketsQuery,
  useListAllMatchesQuery,
  useGetTournamentQuery,
} from "slices/tournamentsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

// react-brackets
import { Bracket, Seed, SeedItem, SeedTeam } from "react-brackets";
import PropTypes from "prop-types";

/* ================= Helpers ================= */
function normType(t) {
  const s = String(t || "").toLowerCase();
  if (s === "single" || s === "singles") return "single";
  if (s === "double" || s === "doubles") return "double";
  return "double";
}
function safeRegName(pair, evType) {
  if (!pair) return "—";
  if (evType === "single") return pair.player1?.fullName || "N/A";
  const p1 = pair.player1?.fullName || "N/A";
  const p2 = pair.player2?.fullName || "N/A";
  return `${p1} & ${p2}`;
}
function depLabel(prev) {
  if (!prev) return "TBD";
  const r = prev.round ?? "?";
  const idx = (prev.order ?? 0) + 1;
  return `Winner of R${r} #${idx}`;
}
function resultLabel(m, entityWord /* 'VĐV' | 'Đôi' */) {
  if (m?.status === "finished") {
    if (m?.winner === "A") return `${entityWord} A thắng`;
    if (m?.winner === "B") return `${entityWord} B thắng`;
    return "Hoà/Không xác định";
  }
  if (m?.status === "live") return "Đang diễn ra";
  return "Chưa diễn ra";
}
function roundTitleByCount(cnt) {
  if (cnt === 1) return "Chung kết";
  if (cnt === 2) return "Bán kết";
  if (cnt === 4) return "Tứ kết";
  if (cnt === 8) return "Vòng 1/8";
  if (cnt === 16) return "Vòng 1/16";
  return `Vòng (${cnt} trận)`;
}

/* ======== Build rounds (có placeholder) cho react-brackets ======== */
function placeholderSeed(r, idx, emptyLabel) {
  return {
    id: `placeholder-${r}-${idx}`,
    __match: null,
    teams: [{ name: emptyLabel }, { name: emptyLabel }],
  };
}

function buildRoundsWithPlaceholders(
  brMatches,
  { minRounds = 3, matchSideLabelFn = () => "—", emptyLabel = "Chưa có đội/VDV" } = {}
) {
  const real = (brMatches || [])
    .slice()
    .sort((a, b) => (a.round || 1) - (b.round || 1) || (a.order || 0) - (b.order || 0));

  const roundsHave = Array.from(new Set(real.map((m) => m.round || 1))).sort((a, b) => a - b);
  const lastRound = roundsHave.length ? Math.max(...roundsHave) : 1;

  let firstRound = roundsHave.length ? Math.min(...roundsHave) : 1;
  if (minRounds != null) {
    const haveCols = lastRound - firstRound + 1;
    if (haveCols < minRounds) firstRound = Math.max(1, lastRound - (minRounds - 1));
  }

  const countByRoundReal = {};
  real.forEach((m) => {
    const r = m.round || 1;
    countByRoundReal[r] = (countByRoundReal[r] || 0) + 1;
  });

  const seedsCount = {};
  seedsCount[lastRound] = countByRoundReal[lastRound] || 1;
  for (let r = lastRound - 1; r >= firstRound; r--) {
    seedsCount[r] = countByRoundReal[r] || seedsCount[r + 1] * 2;
  }

  const roundNums = Object.keys(seedsCount)
    .map(Number)
    .sort((a, b) => a - b);

  return roundNums.map((r) => {
    const need = seedsCount[r];
    const seeds = Array.from({ length: need }, (_, i) => placeholderSeed(r, i, emptyLabel));

    const ms = real
      .filter((m) => (m.round || 1) === r)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

    ms.forEach((m, idx) => {
      let i = Number.isInteger(m.order) ? m.order : seeds.findIndex((s) => s.__match === null);
      if (i < 0 || i >= seeds.length) i = Math.min(idx, seeds.length - 1);

      seeds[i] = {
        id: m._id || `${r}-${i}`,
        date: m?.scheduledAt ? new Date(m.scheduledAt).toDateString() : undefined,
        __match: m,
        teams: [{ name: matchSideLabelFn(m, "A") }, { name: matchSideLabelFn(m, "B") }],
      };
    });

    return { title: roundTitleByCount(need), seeds };
  });
}

/* ========== Custom seed (local theo eventType) ========== */
const RED = "#F44336";

function makeCustomSeed({ emptyLabel, entityWord }) {
  const CustomSeedLocal = ({ seed, breakpoint }) => {
    const m = seed.__match || null;
    const nameA = seed.teams?.[0]?.name || emptyLabel;
    const nameB = seed.teams?.[1]?.name || emptyLabel;

    const winA = m?.status === "finished" && m?.winner === "A";
    const winB = m?.status === "finished" && m?.winner === "B";
    const isPlaceholder = !m && nameA === emptyLabel && nameB === emptyLabel;
    const isFinal = Boolean(m && !m?.nextMatch);

    const RightTick = (props) => (
      <span
        {...props}
        style={{
          position: "absolute",
          right: -8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 8,
          height: 2,
          background: RED,
          opacity: 0.9,
        }}
      />
    );

    return (
      <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 13 }}>
        <SeedItem>
          <div style={{ position: "relative", display: "grid", gap: 4 }}>
            {isFinal && (winA || winB) && (
              <TrophyIcon
                sx={{ position: "absolute", right: -22, top: -12, fontSize: 20, color: RED }}
              />
            )}

            <SeedTeam
              style={{
                fontWeight: winA ? 700 : 400,
                borderLeft: winA ? `4px solid ${RED}` : "4px solid transparent",
                paddingLeft: 6,
                opacity: isPlaceholder ? 0.7 : 1,
                fontStyle: isPlaceholder ? "italic" : "normal",
              }}
            >
              {nameA}
            </SeedTeam>
            <SeedTeam
              style={{
                fontWeight: winB ? 700 : 400,
                borderLeft: winB ? `4px solid ${RED}` : "4px solid transparent",
                paddingLeft: 6,
                opacity: isPlaceholder ? 0.7 : 1,
                fontStyle: isPlaceholder ? "italic" : "normal",
              }}
            >
              {nameB}
            </SeedTeam>

            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {m ? resultLabel(m, entityWord) : isPlaceholder ? emptyLabel : "Chưa diễn ra"}
            </div>

            {(winA || winB) && <RightTick />}
          </div>
        </SeedItem>
      </Seed>
    );
  };

  CustomSeedLocal.propTypes = {
    seed: PropTypes.shape({
      __match: PropTypes.shape({
        status: PropTypes.string,
        winner: PropTypes.string,
      }),
      teams: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string })),
    }).isRequired,
    breakpoint: PropTypes.number,
  };

  return CustomSeedLocal;
}

/* ================= Component ================= */
export default function TournamentBracketView() {
  const { id: tourId } = useParams();
  const { data: tour, isLoading: l1, error: e1 } = useGetTournamentQuery(tourId);
  const { data: brackets = [], isLoading: l2, error: e2 } = useListBracketsQuery(tourId);
  const { data: allMatches = [], isLoading: l3, error: e3 } = useListAllMatchesQuery();

  const loading = l1 || l2 || l3;
  const error = e1 || e2 || e3;

  const evType = normType(tour?.eventType);
  const isSingles = evType === "single";
  const entityWord = isSingles ? "VĐV" : "Đôi";
  const emptyLabel = isSingles ? "Chưa có VĐV" : "Chưa có đội";

  const matches = useMemo(
    () =>
      (allMatches || []).filter(
        (m) => String(m.tournament?._id || m.tournament) === String(tourId)
      ),
    [allMatches, tourId]
  );

  const byBracket = useMemo(() => {
    const m = {};
    (brackets || []).forEach((b) => (m[b._id] = []));
    (matches || []).forEach((mt) => {
      const bid = mt.bracket?._id || mt.bracket;
      if (m[bid]) m[bid].push(mt);
    });
    return m;
  }, [brackets, matches]);

  const groupStandings = useMemo(() => {
    const map = {};
    (brackets || [])
      .filter((b) => b.type === "group")
      .forEach((b) => {
        const rows = {};
        (byBracket[b._id] || []).forEach((m) => {
          const aId = m.pairA?._id;
          const bId = m.pairB?._id;
          if (!aId || !bId) return;

          rows[aId] ||= { pair: m.pairA, win: 0, loss: 0 };
          rows[bId] ||= { pair: m.pairB, win: 0, loss: 0 };

          if (m.winner === "A") {
            rows[aId].win += 1;
            rows[bId].loss += 1;
          } else if (m.winner === "B") {
            rows[bId].win += 1;
            rows[aId].loss += 1;
          }
        });

        map[b._id] = Object.values(rows).sort(
          (x, y) =>
            y.win - x.win ||
            x.loss - y.loss ||
            (x.pair?.player1?.fullName || "").localeCompare(y.pair?.player1?.fullName || "")
        );
      });
    return map;
  }, [brackets, byBracket]);

  const matchSideLabel = useCallback(
    (m, side /* 'A'|'B' */) => {
      const pair = side === "A" ? m.pairA : m.pairB;
      const prev = side === "A" ? m.previousA : m.previousB;
      if (pair) return safeRegName(pair, evType);
      if (prev) return depLabel(prev);
      return emptyLabel;
    },
    [evType] // emptyLabel is static per render
  );

  const buildRoundsForKnockout = useCallback(
    (bracketId) => {
      const brMatches = (byBracket[bracketId] || [])
        .slice()
        .sort((a, c) => (a.round || 1) - (c.round || 1) || (a.order || 0) - (c.order || 0));

      const uniqueRounds = new Set(brMatches.map((m) => m.round ?? 1));
      return buildRoundsWithPlaceholders(brMatches, {
        minRounds: Math.max(3, uniqueRounds.size),
        matchSideLabelFn: matchSideLabel,
        emptyLabel,
      });
    },
    [byBracket, matchSideLabel, emptyLabel]
  );

  const winnerPair = (m) => {
    if (!m || m.status !== "finished" || !m.winner) return null;
    return m.winner === "A" ? m.pairA : m.pairB;
    // (pair object; render bằng safeRegName ở dưới)
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box textAlign="center" py={6}>
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box p={3}>
          <Alert severity="error">
            {error?.data?.message || error?.error || "Lỗi tải dữ liệu."}
          </Alert>
        </Box>
      </DashboardLayout>
    );
  }

  const groupStage = (brackets || []).filter((b) => b.type === "group");
  const knockout = (brackets || []).filter((b) => b.type === "knockout");

  const CustomSeedLocal = makeCustomSeed({ emptyLabel, entityWord });

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Sơ đồ giải: {tour?.name}
        </Typography>

        {/* ====== VÒNG BẢNG ====== */}
        {groupStage.map((b) => {
          const brMatches = byBracket[b._id] || [];
          const standings = groupStandings[b._id] || [];
          return (
            <Accordion key={b._id} defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Vòng bảng: {b.name}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="subtitle1" gutterBottom>
                  Bảng xếp hạng
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small" sx={{ tableLayout: "fixed", minWidth: 480 }}>
                    <TableHead style={{ display: "table-header-group" }}>
                      <TableRow>
                        <TableCell sx={{ width: 56, fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{isSingles ? "VĐV" : "Cặp"}</TableCell>
                        <TableCell align="center" sx={{ width: 90, fontWeight: 700 }}>
                          Thắng
                        </TableCell>
                        <TableCell align="center" sx={{ width: 90, fontWeight: 700 }}>
                          Thua
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {standings.length ? (
                        standings.map((row, idx) => (
                          <TableRow key={row.pair?._id || idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{safeRegName(row.pair, evType)}</TableCell>
                            <TableCell align="center">{row.win}</TableCell>
                            <TableCell align="center">{row.loss}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            Chưa có dữ liệu BXH.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="subtitle1" gutterBottom>
                  Các trận trong bảng
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ tableLayout: "fixed", minWidth: 640 }}>
                    <TableHead style={{ display: "table-header-group" }}>
                      <TableRow>
                        <TableCell sx={{ width: 80, fontWeight: 700 }}>Vòng</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {isSingles ? "VĐV A" : "Đôi A"}
                        </TableCell>
                        <TableCell align="center" sx={{ width: 72, fontWeight: 700 }}>
                          vs
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {isSingles ? "VĐV B" : "Đôi B"}
                        </TableCell>
                        <TableCell align="center" sx={{ width: 180, fontWeight: 700 }}>
                          Kết quả
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {brMatches.length ? (
                        brMatches
                          .slice()
                          .sort(
                            (a, b) =>
                              (a.round || 1) - (b.round || 1) || (a.order || 0) - (b.order || 0)
                          )
                          .map((m) => (
                            <TableRow key={m._id}>
                              <TableCell>R{m.round || 1}</TableCell>
                              <TableCell>{matchSideLabel(m, "A")}</TableCell>
                              <TableCell align="center">vs</TableCell>
                              <TableCell>{matchSideLabel(m, "B")}</TableCell>
                              <TableCell align="center">{resultLabel(m, entityWord)}</TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            Chưa có trận nào.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* ====== KNOCKOUT (react-brackets) ====== */}
        {knockout.map((b) => {
          const rounds = buildRoundsForKnockout(b._id);
          const brMatches = byBracket[b._id] || [];

          const finalLike =
            brMatches.find((m) => !m?.nextMatch) ||
            brMatches.slice().sort((a, c) => (c.round || 1) - (a.round || 1))[0] ||
            null;

          const champion = winnerPair(finalLike);

          return (
            <Box key={b._id} mb={4}>
              <Typography variant="h6" gutterBottom>
                Nhánh loại trực tiếp: {b.name}
              </Typography>

              {champion && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  Vô địch: <b>{safeRegName(champion, evType)}</b>
                  {finalLike ? (
                    <>
                      {" "}
                      — (thắng R{finalLike.round || "?"} #{(finalLike.order ?? 0) + 1})
                    </>
                  ) : null}
                </Alert>
              )}

              {!rounds.length ? (
                <Alert severity="info">Chưa có trận nào.</Alert>
              ) : (
                <Card sx={{ p: 2, overflowX: "auto" }}>
                  <Bracket
                    rounds={rounds}
                    renderSeedComponent={CustomSeedLocal}
                    mobileBreakpoint={0}
                  />
                  <Divider sx={{ mt: 2 }} />
                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary">
                      * Đậm + viền đỏ: {entityWord.toLowerCase()} thắng. Có vạch đỏ ở mép phải để
                      gợi “đường thắng” sang vòng sau. Ô chung kết có biểu tượng cúp khi đã xác định
                      vô địch.
                    </Typography>
                  </Box>
                </Card>
              )}
            </Box>
          );
        })}
      </Box>
      <Footer />
    </DashboardLayout>
  );
}
