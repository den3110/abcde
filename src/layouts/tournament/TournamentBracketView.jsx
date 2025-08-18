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

// react-brackets
import { Bracket, Seed, SeedItem, SeedTeam } from "react-brackets";
import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

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
const ceilPow2 = (n) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, n || 1))));

/* ===== Grouping helpers (dò tên bảng từ match) ===== */
const UNGROUPED = "__UNGROUPED__";
const getGroupKey = (m) => {
  const g = m.group ?? m.groupName ?? m.pool ?? m.table ?? m.groupLabel ?? null;
  if (typeof g === "string" && g.trim()) return g.trim();
  if (g && typeof g === "object") return g.name || g.code || g.label || g._id || UNGROUPED;
  if (typeof m.groupIndex === "number") return String.fromCharCode(65 + m.groupIndex); // 0->A
  return UNGROUPED;
};
const formatGroupTitle = (key) => {
  if (!key || key === UNGROUPED) return "Chưa phân bảng";
  if (/^[A-Za-z]$/.test(key)) return `Bảng ${key.toUpperCase()}`;
  return `Bảng ${key}`;
};

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

/* ======== Dựng khung dự kiến từ “Top 1 / Top 2 mỗi bảng” ======== */
/** pairing "standard": 1–N, 2–(N-1), ... */
function pairIndicesStandard(N) {
  const half = N / 2;
  const pairs = [];
  for (let i = 0; i < half; i++) {
    pairs.push([i, N - 1 - i]);
  }
  return pairs;
}

/** labels: mảng tên seed 1..K (K<=N), N = pow2 >= K */
function buildRoundsFromLabels(labels, { emptyLabel = "Chưa có đội/VDV" } = {}) {
  const K = Array.isArray(labels) ? labels.length : 0;
  if (K < 2) return [];

  const N = ceilPow2(K); // scale
  const padded = Array.from({ length: N }, (_, i) => labels[i] || emptyLabel);
  // Round 1 có N/2 trận
  const pairs = pairIndicesStandard(N);
  const round1Seeds = pairs.map(([a, b], idx) => ({
    id: `proj-R1-${idx}`,
    __match: null,
    teams: [{ name: padded[a] }, { name: padded[b] }],
  }));

  const rounds = [{ title: roundTitleByCount(round1Seeds.length), seeds: round1Seeds }];

  // Các round tiếp theo: chỉ tạo khung placeholder TBD
  let matches = round1Seeds.length;
  let r = 2;
  while (matches > 1) {
    matches = Math.floor(matches / 2);
    rounds.push({
      title: roundTitleByCount(matches),
      seeds: Array.from({ length: matches }, (_, i) => ({
        id: `proj-R${r}-${i}`,
        __match: null,
        teams: [{ name: "TBD" }, { name: "TBD" }],
      })),
    });
    r += 1;
  }
  return rounds;
}

/** Lấy danh sách "Top 1 / Top 2" từ các bảng của bracket nguồn (group) */
function makeProjectedLabelsFromGroupMatches(groupMatches, { topPerGroup = 2 } = {}) {
  if (!Array.isArray(groupMatches) || !groupMatches.length) return [];
  // gom theo bảng
  const groups = {};
  groupMatches.forEach((m) => {
    const k = getGroupKey(m);
    if (!groups[k]) groups[k] = true;
  });
  const keys = Object.keys(groups)
    .filter((k) => k !== UNGROUPED)
    .sort((a, b) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }));

  // seed theo thứ tự: Top1 của từng bảng (A..), rồi Top2 của từng bảng (A..)
  const labels = [];
  for (let rank = 1; rank <= Math.max(1, topPerGroup); rank++) {
    keys.forEach((k) => labels.push(`Top ${rank} ${formatGroupTitle(k)}`));
  }
  return labels;
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

  // group và knockout
  const groupStage = useMemo(() => (brackets || []).filter((b) => b.type === "group"), [brackets]);
  const knockout = useMemo(() => (brackets || []).filter((b) => b.type === "knockout"), [brackets]);

  // map bracket -> list matches
  const byBracket = useMemo(() => {
    const m = {};
    (brackets || []).forEach((b) => (m[b._id] = []));
    (matches || []).forEach((mt) => {
      const bid = mt.bracket?._id || mt.bracket;
      if (m[bid]) m[bid].push(mt);
    });
    return m;
  }, [brackets, matches]);

  // BXH group đơn giản (đếm win/loss)
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

  // label hiển thị A/B cho match
  const matchSideLabel = useCallback(
    (m, side /* 'A'|'B' */) => {
      const pair = side === "A" ? m.pairA : m.pairB;
      const prev = side === "A" ? m.previousA : m.previousB;
      if (pair) return safeRegName(pair, evType);
      if (prev) return depLabel(prev);
      return emptyLabel;
    },
    [evType]
  );

  // rounds từ match KO thật (nếu đã commit)
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

  // dự đoán khung KO từ vòng bảng (Top 1/2 mỗi bảng), dùng khi KO chưa có match
  const getProjectedRoundsForKO = useCallback(
    (koBracket) => {
      // chọn bracket group có stage nhỏ hơn KO và lớn nhất (gần nhất)
      const candidates = (groupStage || []).filter(
        (g) =>
          typeof g.stage === "number" &&
          typeof koBracket.stage === "number" &&
          g.stage < koBracket.stage
      );
      const source =
        candidates.sort((a, b) => (b.stage ?? 0) - (a.stage ?? 0))[0] ||
        (groupStage.length ? groupStage[0] : null);
      if (!source) return { rounds: [], sourceName: null };

      const gMatches = byBracket[source._id] || [];
      const labels = makeProjectedLabelsFromGroupMatches(gMatches, { topPerGroup: 2 }); // mặc định Top 2
      const rounds = buildRoundsFromLabels(labels, { emptyLabel });
      return { rounds, sourceName: source.name || "Vòng bảng" };
    },
    [groupStage, byBracket, emptyLabel]
  );

  const winnerPair = (m) => {
    if (!m || m.status !== "finished" || !m.winner) return null;
    return m.winner === "A" ? m.pairA : m.pairB;
  };

  if (loading) {
    return (
      <Box p={3} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error?.data?.message || error?.error || "Lỗi tải dữ liệu."}</Alert>
      </Box>
    );
  }

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
          const brMatches = byBracket[b._id] || [];
          const hasRealKO = brMatches.length > 0;

          // Nếu đã có trận KO thật: build từ match
          // Nếu chưa: dựng khung dự kiến từ Top 1/2 mỗi bảng ở stage trước
          const rounds = hasRealKO
            ? buildRoundsForKnockout(b._id)
            : getProjectedRoundsForKO(b).rounds;

          const { sourceName } = hasRealKO ? { sourceName: null } : getProjectedRoundsForKO(b);

          const finalLike =
            hasRealKO &&
            (brMatches.find((m) => !m?.nextMatch) ||
              brMatches.slice().sort((a, c) => (c.round || 1) - (a.round || 1))[0] ||
              null);

          const champion = hasRealKO ? winnerPair(finalLike) : null;

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
                <>
                  {!hasRealKO && (
                    <Alert severity="info" sx={{ mb: 1 }}>
                      <b>Khung dự kiến</b> (chưa chốt): lấy mặc định <b>Top 1 & Top 2</b> từ{" "}
                      <b>{sourceName || "vòng bảng"}</b>. Khi BXH chốt hoặc bạn Commit Advancement,
                      các ô sẽ tự điền đội thật.
                    </Alert>
                  )}
                  <Card sx={{ p: 2, overflowX: "auto" }}>
                    <Bracket
                      rounds={rounds}
                      renderSeedComponent={makeCustomSeed({ emptyLabel, entityWord })}
                      mobileBreakpoint={0}
                    />
                    <Divider sx={{ mt: 2 }} />
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        * Đậm + viền đỏ: {entityWord.toLowerCase()} thắng. Có vạch đỏ ở mép phải để
                        gợi “đường thắng” sang vòng sau. Ô chung kết có biểu tượng cúp khi đã xác
                        định vô địch.
                      </Typography>
                    </Box>
                  </Card>
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </DashboardLayout>
  );
}
