// src/layouts/tournament/AdminBracketsPage.jsx
import React, { useState, useMemo, useEffect } from "react";
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
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  TableChart as TableChartIcon,
  Edit as EditIcon,
  TravelExplore as ExploreIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { skipToken } from "@reduxjs/toolkit/query";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

/* ===== existing slices ===== */
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
  useResetMatchChainMutation,
} from "slices/tournamentsApiSlice";
import { useGetUsersQuery } from "slices/adminApiSlice";

/* ===== progression slice (mới) ===== */
import {
  useListSourcesForTargetQuery,
  usePreviewAdvancementMutation,
  useCommitAdvancementMutation,
  usePrefillAdvancementMutation,
} from "slices/progressionApiSlice";

/* ===== Helpers cho đơn/đôi ===== */
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

export default function AdminBracketsPage() {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();

  // 1) Thông tin giải
  const {
    data: tournament,
    isLoading: loadingT,
    error: errorT,
  } = useGetTournamentQuery(tournamentId);

  const evType = normType(tournament?.eventType);
  const isSingles = evType === "single";

  // 2) Danh sách trọng tài
  const {
    data: usersData,
    isLoading: refsLoading,
    error: refsError,
  } = useGetUsersQuery({ page: 1, keyword: "", role: "referee" });
  const referees = usersData?.users ?? [];
  const refName = (u) => u?.fullName || u?.name || u?.email || "Referee";

  // 3) Các cặp đăng ký
  const {
    data: registrations = [],
    isLoading: regsLoading,
    error: regsError,
  } = useGetRegistrationsQuery(tournamentId);

  // reg index for fast lookup
  const idOf = (x) => String(x?._id ?? x);
  const regIndex = useMemo(() => {
    const m = new Map();
    (registrations || []).forEach((r) => m.set(idOf(r._id), r));
    return m;
  }, [registrations]);

  // 4) Danh sách bracket
  const {
    data: brackets = [],
    isLoading: loadingB,
    error: errorB,
    refetch: refetchBrackets,
  } = useListBracketsQuery(tournamentId);

  // 5) Matches của đúng giải
  const {
    data: matches = [],
    isLoading: loadingM,
    error: errorM,
    refetch: refetchMatches,
  } = useListAllMatchesQuery({ tournament: tournamentId });

  // Mutations
  const [createBracket] = useCreateBracketMutation();
  const [deleteBracket] = useDeleteBracketMutation();
  const [createMatch] = useCreateMatchMutation();
  const [deleteMatch] = useDeleteMatchMutation();
  const [updateBracket] = useUpdateBracketMutation();
  const [updateMatch] = useUpdateMatchMutation();
  const [resetMatchChain] = useResetMatchChainMutation();

  // Progression mutations
  const [previewAdvancement, { isLoading: loadingPreview }] = usePreviewAdvancementMutation();
  const [commitAdvancement, { isLoading: loadingCommit }] = useCommitAdvancementMutation();
  const [prefillAdvancement, { isLoading: loadingPrefill }] = usePrefillAdvancementMutation();

  /* =====================
   *  Snackbar
   * ===================== */
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  /* =====================
   *  Helpers pow2 + rounds + paid
   * ===================== */
  const floorPow2 = (n) => (n <= 1 ? 1 : 1 << Math.floor(Math.log2(n)));
  const ceilPow2 = (n) => (n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n)));
  const pow2OptionsUpTo = (n) => {
    const arr = [];
    let x = 2;
    const maxN = Math.max(2, n);
    while (x <= maxN) {
      arr.push(x);
      x *= 2;
    }
    if (!arr.length) arr.push(2);
    return arr;
  };
  const toRounds = (drawSize) => Math.max(1, Math.round(Math.log2(Math.max(2, drawSize))));
  const fromRounds = (n) => 1 << Math.max(1, Number(n) || 1);
  const roundsOptionsUpTo = (maxDraw) => {
    const maxN = toRounds(Math.max(2, maxDraw));
    return Array.from({ length: Math.max(1, maxN) }, (_, i) => i + 1);
  };
  const isPaidReg = (r) => {
    const s = String(r?.payment?.status || r?.status || "").toLowerCase();
    return (
      r?.paid === true ||
      r?.payment?.isPaid === true ||
      s === "paid" ||
      s === "completed" ||
      s === "success"
    );
  };
  const regsCount = registrations?.length || 0;
  const paidCount = useMemo(() => (registrations || []).filter(isPaidReg).length, [registrations]);

  /* =====================
   *  STATE: Tạo Bracket
   * ===================== */
  const [bracketDlg, setBracketDlg] = useState(false);
  const [newBracketName, setNewBracketName] = useState("");
  const [newBracketType, setNewBracketType] = useState("knockout");
  const [newBracketStage, setNewBracketStage] = useState(1);
  // Order hiển thị khi tạo mới
  const [newBracketOrder, setNewBracketOrder] = useState(0);
  // Quy mô (2^n) & số vòng (n)
  const [newDrawSize, setNewDrawSize] = useState(0); // 2^n
  const [newMaxRounds, setNewMaxRounds] = useState(1); // n

  // NEW: checkbox “Tự tạo quy mô giải đấu”
  const [useCustomScale, setUseCustomScale] = useState(false);

  // Gợi ý order mỗi khi mở dialog
  useEffect(() => {
    if (!bracketDlg) return;
    const maxOrder = Math.max(0, ...(brackets || []).map((b) => Number(b.order) || 0));
    setNewBracketOrder(maxOrder + 1);
  }, [bracketDlg, brackets]);

  // === auto layout (knockout)
  const [autoLayout, setAutoLayout] = useState(false);
  const [autoMode, setAutoMode] = useState("FROM_GROUPS"); // FROM_GROUPS | MANUAL_SCALE | AUTO_FROM_REGS
  // Option 1 (từ vòng bảng)
  const [autoFromBracketId, setAutoFromBracketId] = useState("");
  const [autoTopPerGroup, setAutoTopPerGroup] = useState(2);
  const [autoSeedMethod, setAutoSeedMethod] = useState("rating"); // rating|random|tiered
  const [autoPairing, setAutoPairing] = useState("standard"); // standard|snake
  const [autoFillMode, setAutoFillMode] = useState("pool"); // pairs|pool
  const [autoTargetScale, setAutoTargetScale] = useState(""); // quy mô mục tiêu (tuỳ chọn)
  // Option 2 (quy mô tay)
  const [manualScale, setManualScale] = useState(() => floorPow2(Math.max(2, regsCount)));

  // Nguồn Group phù hợp cho Option1: stage < stage đang tạo
  const groupSources = useMemo(
    () =>
      (brackets || []).filter(
        (b) => b.type === "group" && (b.stage ?? 1) < Number(newBracketStage)
      ),
    [brackets, newBracketStage]
  );

  /* =====================
   *  STATE: Sửa Bracket
   * ===================== */
  const [editingBracket, setEditingBracket] = useState(null);
  const editBracketOpen = Boolean(editingBracket);
  const [ebId, setEbId] = useState("");
  const [ebName, setEbName] = useState("");
  const [ebType, setEbType] = useState("knockout");
  const [ebStage, setEbStage] = useState(1);
  const [ebOrder, setEbOrder] = useState(0);
  // meta
  const [ebDrawSize, setEbDrawSize] = useState(0); // 2^n
  const [ebMaxRounds, setEbMaxRounds] = useState(1); // n
  // NEW: checkbox “Tự tạo quy mô giải đấu” cho dialog sửa
  const [ebUseCustomScale, setEbUseCustomScale] = useState(false);

  /* =====================
   *  STATE: Tạo Match đơn lẻ
   * ===================== */
  const [matchDlg, setMatchDlg] = useState(false);
  const [selBracket, setSelBracket] = useState("");
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const [rules, setRules] = useState({ bestOf: 3, pointsToWin: 11, winByTwo: true });
  const [newRound, setNewRound] = useState(1);
  const [newOrder, setNewOrder] = useState(0);
  const [newReferee, setNewReferee] = useState("");
  const [newRatingDelta, setNewRatingDelta] = useState(0);

  /* =====================
   *  STATE: Sửa Match
   * ===================== */
  const [editingMatch, setEditingMatch] = useState(null);
  const editMatchOpen = Boolean(editingMatch);
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
  const [emRatingDelta, setEmRatingDelta] = useState(0);
  const [emRatingApplied, setEmRatingApplied] = useState(false);
  const [emRatingAppliedAt, setEmRatingAppliedAt] = useState(null);

  /* =====================
   *  STATE: Tạo vòng sau thủ công
   * ===================== */
  const [nextDlg, setNextDlg] = useState(false);
  const [nextDlgBracket, setNextDlgBracket] = useState(null);
  const [nextRound, setNextRound] = useState(2);
  const [pairs, setPairs] = useState([]);
  const canCreateNext = pairs.some(
    (row) => (row.leftMatch && row.rightMatch) || (row.leftMatch && !row.rightMatch && row.bRegId)
  );

  /* =====================
   *  STATE: Advancement (mới)
   * ===================== */
  const [advDlg, setAdvDlg] = useState(false);
  const [advTarget, setAdvTarget] = useState(null);
  const [advSourceId, setAdvSourceId] = useState("");
  const [advMode, setAdvMode] = useState("GROUP_TOP");
  const [advTopPerGroup, setAdvTopPerGroup] = useState(2);
  const [advRound, setAdvRound] = useState(1);
  const [advLimit, setAdvLimit] = useState(0);
  const [advSeedMethod, setAdvSeedMethod] = useState("rating");
  const [advPairing, setAdvPairing] = useState("standard");
  const [advFillMode, setAdvFillMode] = useState("pairs");
  const [advPreview, setAdvPreview] = useState([]);

  // Nguồn hợp lệ cho bracket đích
  const {
    data: advSourcesResp,
    isLoading: loadingSources,
    error: errorSources,
  } = useListSourcesForTargetQuery(advDlg && advTarget ? advTarget._id : skipToken);
  const advSources = advSourcesResp?.sources || [];

  // Prefill defaults cho create/edit khi mở dialog
  useEffect(() => {
    const roundsFromBracket = Number.isInteger(Number(editingBracket?.drawRounds))
      ? Number(editingBracket?.drawRounds)
      : 0;

    if (roundsFromBracket >= 1) {
      // Nếu bracket đang sửa có drawRounds -> sync state edit
      setEbMaxRounds(roundsFromBracket);
      setEbDrawSize(1 << roundsFromBracket);
      setEbUseCustomScale(true);
      return;
    }

    // Không có drawRounds -> ước lượng theo paidCount/regsCount
    const sz = ceilPow2(Math.max(2, paidCount || regsCount || 2));
    setEbMaxRounds(toRounds(sz));
    setNewDrawSize(sz);
    setEbUseCustomScale(false); // default off cho edit nếu không có scale trước
  }, [bracketDlg, paidCount, regsCount, editingBracket?.drawRounds]); // eslint-disable-line

  /* =====================
   *  GROUPING (hiển thị)
   * ===================== */
  const getGroupKey = (m) => {
    const g = m.group ?? m.groupName ?? m.pool ?? m.table ?? m.groupLabel ?? null;
    if (typeof g === "string" && g.trim()) return g.trim();
    if (g && typeof g === "object") return g.name || g.code || g.label || g._id || "__UNGROUPED__";
    if (typeof m.groupIndex === "number") return String.fromCharCode(65 + m.groupIndex);
    return "__UNGROUPED__";
  };
  const formatGroupTitle = (key) => {
    if (!key || key === "__UNGROUPED__") return "Chưa phân bảng";
    if (/^[A-Za-z]$/.test(key)) return `Bảng ${key.toUpperCase()}`;
    return `Bảng ${key}`;
  };

  const grouped = useMemo(() => {
    const m = {};
    (brackets || []).forEach((b) => (m[idOf(b._id)] = []));
    (matches || []).forEach((mt) => {
      const bid = idOf(mt.bracket);
      if (m[bid]) m[bid].push(mt);
    });
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) => (a.round || 1) - (b.round || 1) || (a.order ?? 0) - (b.order ?? 0))
    );
    return m;
  }, [brackets, matches]);

  const groupedByGroup = useMemo(() => {
    const map = {};
    (brackets || []).forEach((b) => (map[idOf(b._id)] = {}));
    (matches || []).forEach((mt) => {
      const bid = idOf(mt.bracket);
      const gk = getGroupKey(mt);
      if (!map[bid]) map[bid] = {};
      if (!map[bid][gk]) map[bid][gk] = [];
      map[bid][gk].push(mt);
    });
    Object.values(map).forEach((groupMap) => {
      Object.values(groupMap).forEach((arr) =>
        arr.sort((a, b) => (a.round || 1) - (b.round || 1) || (a.order ?? 0) - (b.order ?? 0))
      );
    });
    return map;
  }, [brackets, matches]);

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

  /* =====================
   *  CREATE/EDIT HANDLERS
   * ===================== */
  const handleCreateBracket = async () => {
    if (!newBracketName.trim()) return showSnack("error", "Tên bracket không được để trống");
    try {
      // Base payload
      const bodyBase = {
        name: newBracketName.trim(),
        type: newBracketType,
        stage: newBracketStage,
        order: Number(newBracketOrder),
      };

      // CHỈ gửi drawRounds/meta nếu tick “Tự tạo quy mô giải đấu” & kiểu knockout
      if (newBracketType === "knockout" && useCustomScale) {
        bodyBase.drawRounds = Number(newMaxRounds); // số vòng
        bodyBase.meta = {
          drawSize: Number(newDrawSize) || undefined, // 2^n
          maxRounds: Number(newMaxRounds) || undefined,
          expectedFirstRoundMatches: Number(newDrawSize) > 0 ? Number(newDrawSize) / 2 : undefined,
        };
      }

      const created = await createBracket({
        tourId: tournamentId,
        body: bodyBase,
      }).unwrap();

      // Auto layout (giữ nguyên logic cũ)
      if (newBracketType === "knockout" && autoLayout && created?._id) {
        if (autoMode === "FROM_GROUPS") {
          if (!autoFromBracketId) {
            showSnack("warning", "Chưa chọn bracket nguồn (vòng bảng). Bỏ qua auto layout.");
          } else {
            try {
              const previewBody = {
                fromBracket: autoFromBracketId,
                mode: "GROUP_TOP",
                topPerGroup: Math.max(1, Number(autoTopPerGroup) || 1),
                limit: 0,
                seedMethod: autoSeedMethod,
              };
              const preview = await previewAdvancement({
                targetId: created._id,
                body: previewBody,
              }).unwrap();
              const cnt = Number(preview?.count || (preview?.seeded?.length ?? 0) || 0);

              let targetSlots =
                Number(autoTargetScale) || ceilPow2(Math.max(2, cnt || Number(newDrawSize) || 2));
              if (targetSlots < 2) targetSlots = 2;

              const shortage = Math.max(0, targetSlots - cnt);
              const surplus = Math.max(0, cnt - targetSlots);
              if (surplus > 0) {
                showSnack(
                  "warning",
                  `Nguồn có ${cnt} đội > quy mô ${targetSlots}. Vẫn tiếp tục; đội thừa xử lý sau.`
                );
              }

              if (autoFillMode === "pool" || cnt < 2) {
                const preBody = {
                  fromBracket: autoFromBracketId,
                  mode: "GROUP_TOP",
                  topPerGroup: Math.max(1, Number(autoTopPerGroup) || 1),
                  limit: 0,
                  seedMethod: autoSeedMethod,
                  fillMode: "pool",
                  pairing: autoPairing,
                };
                const preRes = await prefillAdvancement({
                  targetId: created._id,
                  body: preBody,
                }).unwrap();
                if (cnt === 0) {
                  showSnack(
                    "info",
                    "Nguồn chưa có đội đủ điều kiện (vòng bảng chưa kết thúc?). Đã tạo khung, chưa có entrant."
                  );
                } else {
                  showSnack(
                    "success",
                    `Đã tạo khung & nạp ${preRes?.count ?? cnt} đội vào pool. Chưa tạo cặp.`
                  );
                }
                if (shortage > 0)
                  showSnack(
                    "info",
                    `Thiếu ${shortage} slot so với quy mô ${targetSlots} → BYE khi bốc cặp.`
                  );
              } else {
                const commitBody = {
                  fromBracket: autoFromBracketId,
                  mode: "GROUP_TOP",
                  topPerGroup: Math.max(1, Number(autoTopPerGroup) || 1),
                  limit: 0,
                  seedMethod: autoSeedMethod,
                  pairing: autoPairing,
                  fillMode: "pairs",
                };
                try {
                  const commitRes = await commitAdvancement({
                    targetId: created._id,
                    body: commitBody,
                  }).unwrap();
                  if (shortage > 0)
                    showSnack("info", `Thiếu ${shortage} slot so với quy mô ${targetSlots} → BYE.`);
                  showSnack(
                    "success",
                    `Đã commit ${commitRes?.matchesCreated ?? commitRes?.created ?? 0} trận.`
                  );
                } catch (err) {
                  const msg = err?.data?.error || err?.data?.message || String(err);
                  if (/not enough entrants/i.test(msg)) {
                    const preBody = {
                      fromBracket: autoFromBracketId,
                      mode: "GROUP_TOP",
                      topPerGroup: Math.max(1, Number(autoTopPerGroup) || 1),
                      limit: 0,
                      seedMethod: autoSeedMethod,
                      fillMode: "pool",
                      pairing: autoPairing,
                    };
                    const preRes = await prefillAdvancement({
                      targetId: created._id,
                      body: preBody,
                    }).unwrap();
                    showSnack(
                      "info",
                      `Không đủ đội để tạo cặp ngay. Đã nạp ${preRes?.count ?? cnt} đội vào pool.`
                    );
                  } else {
                    throw err;
                  }
                }
              }
            } catch (e) {
              showSnack(
                "error",
                e?.data?.error || e?.data?.message || e.error || "Lỗi auto từ vòng bảng"
              );
            }
          }
        } else if (autoMode === "MANUAL_SCALE") {
          const N = Number(manualScale);
          const isPow2 = N >= 2 && (N & (N - 1)) === 0;
          if (!isPow2) {
            showSnack("error", "Quy mô phải là lũy thừa của 2 (ví dụ 4, 8, 16, 32…).");
          } else {
            const matchesToCreate = N / 2;
            let ok = 0;
            for (let i = 0; i < matchesToCreate; i++) {
              await createMatch({
                bracketId: created._id,
                body: { round: 1, order: i, rules: { bestOf: 3, pointsToWin: 11, winByTwo: true } },
              }).unwrap();
              ok++;
            }
            if (regsCount < N) {
              showSnack(
                "info",
                `Đăng ký ${regsCount} < quy mô ${N} → sẽ có ${N - regsCount} slot BYE ở vòng 1.`
              );
            } else if (regsCount > N) {
              const thua = regsCount - N;
              showSnack(
                "warning",
                `Đăng ký ${regsCount} > quy mô ${N} → thừa ${thua} đội. Cần vòng loại/loại bớt.`
              );
            }
            showSnack("success", `Đã tạo ${ok} cặp (round 1) theo quy mô ${N}.`);
          }
        } else if (autoMode === "AUTO_FROM_REGS") {
          const mainSlots = floorPow2(Math.max(2, regsCount));
          const excess = Math.max(0, regsCount - mainSlots);
          const matchesToCreate = mainSlots / 2;
          let ok = 0;
          for (let i = 0; i < matchesToCreate; i++) {
            await createMatch({
              bracketId: created._id,
              body: { round: 1, order: i, rules: { bestOf: 3, pointsToWin: 11, winByTwo: true } },
            }).unwrap();
            ok++;
          }
          if (excess > 0) {
            showSnack(
              "info",
              `Có ${excess} đội thừa so với main draw ${mainSlots} → cần vòng loại riêng cho ${
                excess * 2
              } đội tranh ${excess} suất.`
            );
          }
          showSnack("success", `Đã tạo ${ok} cặp (round 1) cho main draw ${mainSlots}.`);
        }
      }

      showSnack("success", "Đã tạo mới Bracket");
      setBracketDlg(false);
      setNewBracketName("");
      setNewBracketType("knockout");
      setNewBracketStage(1);
      setNewDrawSize(0);
      setNewMaxRounds(1);
      setNewBracketOrder(0);
      setUseCustomScale(false); // reset checkbox

      // reset auto
      setAutoLayout(false);
      setAutoMode("FROM_GROUPS");
      setAutoFromBracketId("");
      setAutoTopPerGroup(2);
      setAutoSeedMethod("rating");
      setAutoPairing("standard");
      setAutoFillMode("pool");
      setAutoTargetScale("");
      setManualScale(floorPow2(Math.max(2, regsCount)));

      refetchBrackets();
      refetchMatches();
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
    setNewRatingDelta(0);
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
          ratingDelta: Math.max(0, Number(newRatingDelta) || 0),
        },
      }).unwrap();
      showSnack("success", "Đã tạo trận");
      setMatchDlg(false);
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  // ======== “Tạo vòng sau (chọn đội)” — thủ công ========
  const openNextRoundDialog = (br) => {
    try {
      const list = grouped[idOf(br._id)] || [];
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

  const openEditBracket = (br) => {
    setEditingBracket(br);
    setEbId(br._id);
    setEbName(br.name || "");
    setEbType(br.type || "knockout");
    setEbStage(br.stage ?? 1);
    setEbOrder(br.order ?? 0);

    // meta hiện tại
    const ds = Number(br?.meta?.drawSize) || 0;
    const mr = Number(br?.meta?.maxRounds) || (ds ? toRounds(ds) : 1);
    setEbDrawSize(ds);
    setEbMaxRounds(mr);

    // Nếu bracket đã có cấu hình quy mô → bật checkbox
    const hadScale =
      (Number(br?.drawRounds) > 0 || !!br?.meta?.drawSize || !!br?.meta?.maxRounds) &&
      br.type === "knockout";
    setEbUseCustomScale(hadScale);
  };

  const saveEditBracket = async () => {
    if (!ebId) return;
    try {
      // Chỉ gửi phần quy mô nếu bật checkbox và là knockout
      const body = {
        name: ebName.trim(),
        type: ebType,
        stage: Number(ebStage),
        order: Number(ebOrder),
      };

      if (ebType === "knockout" && ebUseCustomScale) {
        body.drawRounds = Number(ebMaxRounds); // số vòng
        body.meta = {
          ...(editingBracket?.meta || {}),
          drawSize: Number(ebDrawSize) || undefined,
          maxRounds: Number(ebMaxRounds) || undefined,
          expectedFirstRoundMatches: Number(ebDrawSize) > 0 ? Number(ebDrawSize) / 2 : undefined,
        };
      }

      await updateBracket({
        tournamentId,
        bracketId: ebId,
        body,
      }).unwrap();
      showSnack("success", "Đã cập nhật Bracket");
      setEditingBracket(null);
      refetchBrackets();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  const openEditMatch = (mt) => {
    setEditingMatch(mt);
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
    setEmRatingDelta(mt.ratingDelta ?? 0);
    setEmRatingApplied(!!mt.ratingApplied);
    setEmRatingAppliedAt(mt.ratingAppliedAt || null);
  };

  const willDowngrade = emOldStatus === "finished" && emStatus !== "finished";
  const willChangeWinner = emStatus === "finished" && emWinner && emWinner !== emOldWinner;

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
          ratingDelta: Math.max(0, Number(emRatingDelta) || 0),
        },
      }).unwrap();

      if (emCascade) {
        await resetMatchChain({ matchId: emId }).unwrap();
      }

      showSnack("success", emCascade ? "Đã lưu & reset chuỗi trận sau" : "Đã lưu");
      setEditingMatch(null);
      refetchMatches();
    } catch (e) {
      showSnack("error", e?.data?.message || e.error);
    }
  };

  /* =====================
   *  Misc handlers
   * ===================== */
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

  /* =====================
   *  RENDER
   * ===================== */
  const loading = loadingT || regsLoading || loadingB || loadingM;
  const errorMsg = errorT || regsError || errorB || errorM;

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
            {/* Thông tin giải */}
            <Typography variant="h6" gutterBottom>
              {tournament.name} ({new Date(tournament.startDate).toLocaleDateString()} –{" "}
              {new Date(tournament.endDate).toLocaleDateString()}) •{" "}
              {isSingles ? "Giải đơn" : "Giải đôi"}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Action buttons */}
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

            {/* Danh sách Brackets & Matches */}
            <Stack spacing={3}>
              {brackets.map((br) => (
                <Card key={br._id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                      {br.name} ({br.type === "group" ? "Vòng bảng" : "Knockout"}, stage {br.stage}
                      {" • "}order {typeof br.order === "number" ? br.order : 0})
                      {br?.meta?.drawSize && br.type === "knockout" && (
                        <Chip
                          size="small"
                          sx={{ ml: 1 }}
                          label={`Quy mô: ${br.meta.drawSize} đội (${
                            br.meta.maxRounds || toRounds(br.meta.drawSize)
                          } vòng)`}
                        />
                      )}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        onClick={() => openMatchDialog(br)}
                        startIcon={<AddIcon />}
                      >
                        Tạo trận
                      </Button>
                      {br.type === "knockout" && (
                        <>
                          <Button size="small" onClick={() => openNextRoundDialog(br)}>
                            Tạo vòng sau (chọn đội)
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setAdvTarget(br);
                              setAdvDlg(true);
                              setAdvSourceId("");
                              setAdvMode("GROUP_TOP");
                              setAdvTopPerGroup(2);
                              setAdvRound(1);
                              setAdvLimit(0);
                              setAdvSeedMethod("rating");
                              setAdvPairing("standard");
                              setAdvFillMode("pairs");
                              setAdvPreview([]);
                            }}
                            startIcon={<ExploreIcon />}
                          >
                            Lấy đội từ vòng trước
                          </Button>
                        </>
                      )}
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditBracket(br);
                        }}
                        title="Sửa bracket"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteBracket(br)} title="Xoá bracket">
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {/* LIST HIỂN THỊ */}
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {br.type === "group" ? (
                      (() => {
                        const byGroup = groupedByGroup[idOf(br._id)] || {};
                        const entries = Object.entries(byGroup).sort((a, b) =>
                          a[0].localeCompare(b[0], "vi", { numeric: true, sensitivity: "base" })
                        );

                        if (!entries.length)
                          return (
                            <Typography variant="body2" color="text.secondary">
                              Chưa có trận nào.
                            </Typography>
                          );

                        return (
                          <Stack spacing={2}>
                            {entries.map(([gk, arr]) => (
                              <Box key={gk} sx={{ p: 1, borderRadius: 1, bgcolor: "#f7f7f7" }}>
                                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                                  {formatGroupTitle(gk)}
                                </Typography>
                                <Stack spacing={1}>
                                  {arr.map((mt, idx) => (
                                    <Stack
                                      key={mt._id}
                                      direction="row"
                                      justifyContent="space-between"
                                      alignItems="center"
                                      sx={{
                                        p: 1,
                                        bgcolor: "#fff",
                                        borderRadius: 1,
                                        border: "1px solid #eee",
                                      }}
                                    >
                                      <Box>
                                        <Typography>
                                          <strong>Trận #{(mt.order ?? idx) + 1}</strong>:{" "}
                                          <strong>{getSideLabel(mt, "A")}</strong> vs{" "}
                                          <strong>{getSideLabel(mt, "B")}</strong>
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          best‐of {mt.rules.bestOf}, tới {mt.rules.pointsToWin}{" "}
                                          {mt.rules.winByTwo ? "(chênh 2)" : ""} — trạng thái:{" "}
                                          {mt.status}
                                          {mt.status === "finished" && mt.winner && (
                                            <> — winner: {mt.winner}</>
                                          )}
                                          {mt.referee && (
                                            <>
                                              {" "}
                                              — ref:{" "}
                                              {typeof mt.referee === "object"
                                                ? refName(mt.referee)
                                                : referees.find((r) => r._id === mt.referee)
                                                    ?.name || mt.referee}
                                            </>
                                          )}
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
                                        <IconButton
                                          onClick={() => openEditMatch(mt)}
                                          title="Sửa trận"
                                        >
                                          <EditIcon />
                                        </IconButton>
                                        <IconButton
                                          onClick={() => handleDeleteMatch(mt)}
                                          title="Xoá trận"
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Stack>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        );
                      })()
                    ) : (
                      <>
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
                                {mt.status === "finished" && mt.winner && (
                                  <> — winner: {mt.winner}</>
                                )}
                                {mt.referee && (
                                  <>
                                    {" "}
                                    — ref:{" "}
                                    {typeof mt.referee === "object"
                                      ? refName(mt.referee)
                                      : referees.find((r) => r._id === mt.referee)?.name ||
                                        mt.referee}
                                  </>
                                )}
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
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditMatch(mt);
                                }}
                                title="Sửa trận"
                              >
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
                      </>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Box>

      {/* Dialog: Tạo Bracket */}
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
            {/* Order khi tạo mới */}
            <TextField
              label="Order (thứ tự hiển thị)"
              type="number"
              fullWidth
              value={newBracketOrder}
              onChange={(e) => setNewBracketOrder(Number(e.target.value))}
              helperText="Dùng để sắp xếp danh sách brackets. Nhỏ hiển thị trước."
            />

            {newBracketType === "knockout" && (
              <>
                <Alert severity="info">
                  Quy mô dùng để vẽ khung & kiểm tra số đội. Mặc định dựa vào{" "}
                  <b>số đội đã thanh toán</b>. Hiện có: <b>{paidCount}</b> đội đã thanh toán.
                </Alert>

                {/* NEW: checkbox bật/tắt self-scale */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useCustomScale}
                      onChange={(e) => setUseCustomScale(e.target.checked)}
                    />
                  }
                  label="Tự tạo quy mô giải đấu"
                />

                {/* NEW: chỉ hiện 2 select khi đã tick */}
                {useCustomScale && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Số vòng tối đa (n)"
                      value={newMaxRounds}
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        setNewMaxRounds(n);
                        setNewDrawSize(fromRounds(n));
                      }}
                      sx={{ minWidth: 200 }}
                    >
                      {roundsOptionsUpTo(Math.max(64, paidCount || regsCount || 16)).map((n) => (
                        <MenuItem key={n} value={n}>
                          {n} vòng (2^{n} = {1 << n} đội)
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      label="Quy mô (2^n đội)"
                      value={newDrawSize}
                      onChange={(e) => {
                        const v = Math.max(2, Number(e.target.value) || 2);
                        const pow2 = ceilPow2(v);
                        setNewDrawSize(pow2);
                        setNewMaxRounds(toRounds(pow2));
                      }}
                      sx={{ minWidth: 240 }}
                      helperText="2^n = số đội tham gia"
                    >
                      {pow2OptionsUpTo(Math.max(128, paidCount || regsCount || 16)).map((n) => (
                        <MenuItem key={n} value={n}>
                          {n} đội (vòng 1 có {n / 2} cặp)
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Auto layout */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={autoLayout}
                      onChange={(e) => setAutoLayout(e.target.checked)}
                    />
                  }
                  label="Tự tạo sơ đồ giải đấu trước (chỉ áp dụng Knockout)"
                />

                {autoLayout && (
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                      select
                      label="Chế độ tạo sơ đồ"
                      value={autoMode}
                      onChange={(e) => setAutoMode(e.target.value)}
                      sx={{ minWidth: 260 }}
                    >
                      <MenuItem value="FROM_GROUPS">
                        Option 1 — Lấy đội đi tiếp từ vòng trước (vòng bảng)
                      </MenuItem>
                      <MenuItem value="MANUAL_SCALE">
                        Option 2 — Tự điền quy mô số đội (2^n: 1/8, 1/16, …)
                      </MenuItem>
                      <MenuItem value="AUTO_FROM_REGS">
                        Option 3 — Tự động theo số cặp đăng ký (nếu thừa → có vòng loại riêng)
                      </MenuItem>
                    </TextField>

                    {autoMode === "FROM_GROUPS" && (
                      <Stack spacing={2}>
                        <TextField
                          select
                          fullWidth
                          label="Bracket nguồn (vòng bảng)"
                          value={autoFromBracketId}
                          onChange={(e) => setAutoFromBracketId(e.target.value)}
                          helperText={
                            groupSources.length
                              ? "Chọn vòng bảng có stage nhỏ hơn stage hiện tại."
                              : "Không tìm thấy vòng bảng phù hợp (hãy tạo vòng bảng trước)."
                          }
                          sx={{
                            mt: 1,
                            "& .MuiInputBase-root": { minHeight: 56 },
                            "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                          }}
                        >
                          <MenuItem value="">
                            <em>— Chưa chọn —</em>
                          </MenuItem>
                          {groupSources.map((b) => (
                            <MenuItem key={b._id} value={b._id}>
                              {b.name} (stage {b.stage ?? 1})
                            </MenuItem>
                          ))}
                        </TextField>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                          <TextField
                            type="number"
                            label="Top mỗi bảng"
                            value={autoTopPerGroup}
                            onChange={(e) =>
                              setAutoTopPerGroup(Math.max(1, Number(e.target.value) || 1))
                            }
                            sx={{ minWidth: 160 }}
                          />
                          <TextField
                            select
                            label="Seed method"
                            value={autoSeedMethod}
                            onChange={(e) => setAutoSeedMethod(e.target.value)}
                            sx={{ minWidth: 200 }}
                          >
                            <MenuItem value="rating">rating</MenuItem>
                            <MenuItem value="random">random</MenuItem>
                            <MenuItem value="tiered">tiered</MenuItem>
                          </TextField>
                          <TextField
                            select
                            label="Ghép cặp"
                            value={autoPairing}
                            onChange={(e) => setAutoPairing(e.target.value)}
                            sx={{ minWidth: 200 }}
                          >
                            <MenuItem value="standard">1–N, 2–N-1, …</MenuItem>
                            <MenuItem value="snake">snake</MenuItem>
                          </TextField>
                          <TextField
                            select
                            label="Prefill mode"
                            value={autoFillMode}
                            onChange={(e) => setAutoFillMode(e.target.value)}
                            helperText="pairs = điền cặp sẵn; pool = đổ danh sách để bốc tay sau"
                            sx={{ minWidth: 200 }}
                          >
                            <MenuItem value="pairs">pairs</MenuItem>
                            <MenuItem value="pool">pool</MenuItem>
                          </TextField>
                        </Stack>

                        <TextField
                          select
                          label="Quy mô mục tiêu (tuỳ chọn)"
                          value={String(autoTargetScale)}
                          onChange={(e) => setAutoTargetScale(e.target.value)}
                          helperText="Để trống = tự làm tròn lên lũy thừa 2 gần nhất."
                          sx={{ minWidth: 260 }}
                        >
                          <MenuItem value="">
                            <em>— Để trống —</em>
                          </MenuItem>
                          {pow2OptionsUpTo(Math.max(64, regsCount || 16)).map((n) => (
                            <MenuItem key={n} value={String(n)}>
                              {n} đội (vòng 1 có {n / 2} cặp)
                            </MenuItem>
                          ))}
                        </TextField>

                        <Alert severity="info">
                          Khi bấm <b>Tạo</b>: hệ thống tạo bracket, <b>commit</b> đội từ vòng bảng
                          đã chọn vào bracket này theo seeding/pairing bạn chọn. Thiếu slot → BYE;
                          thừa → vẫn tạo, đội thừa xử lý sau.
                        </Alert>
                      </Stack>
                    )}

                    {autoMode === "MANUAL_SCALE" && (
                      <Stack spacing={2}>
                        <TextField
                          select
                          label="Chọn quy mô (2^n đội)"
                          value={manualScale}
                          onChange={(e) => setManualScale(Number(e.target.value))}
                          sx={{ minWidth: 260 }}
                        >
                          {pow2OptionsUpTo(Math.max(64, regsCount || 16)).map((n) => (
                            <MenuItem key={n} value={n}>
                              {n} đội (vòng 1 có {n / 2} cặp)
                            </MenuItem>
                          ))}
                        </TextField>
                        <Alert severity="info">
                          Sẽ tạo sẵn <b>{Math.max(1, Number(manualScale) / 2)}</b> trận ở vòng 1 (để
                          trống slot, điền đội sau). Đăng ký hiện có: <b>{regsCount}</b>.
                        </Alert>
                      </Stack>
                    )}

                    {autoMode === "AUTO_FROM_REGS" && (
                      <Stack spacing={2}>
                        {(() => {
                          const mainSlots = floorPow2(Math.max(2, regsCount));
                          const excess = Math.max(0, regsCount - mainSlots);
                          return (
                            <Alert severity={excess > 0 ? "warning" : "info"}>
                              Đăng ký hiện có: <b>{regsCount}</b> • Main draw dự kiến:{" "}
                              <b>{mainSlots}</b> đội (vòng 1 có {mainSlots / 2} cặp).
                              {excess > 0 && (
                                <>
                                  {" "}
                                  Thừa <b>{excess}</b> đội → cần <b>vòng loại</b> cho{" "}
                                  <b>{excess * 2}</b> đội tranh <b>{excess}</b> suất.
                                </>
                              )}
                            </Alert>
                          );
                        })()}
                      </Stack>
                    )}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBracketDlg(false)}>Huỷ</Button>
          <Button
            onClick={handleCreateBracket}
            variant="contained"
            sx={{ color: "white !important" }}
          >
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: SỬA Bracket */}
      <Dialog
        open={editBracketOpen}
        onClose={() => setEditingBracket(null)}
        fullWidth
        maxWidth="sm"
        keepMounted
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

            {/* NEW: Quy mô khi sửa (chỉ knockout) */}
            {ebType === "knockout" && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  Quy mô giải đấu
                </Typography>

                {/* Checkbox bật/tắt self-scale */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ebUseCustomScale}
                      onChange={(e) => setEbUseCustomScale(e.target.checked)}
                    />
                  }
                  label="Tự tạo quy mô giải đấu"
                />

                {/* Chỉ hiện 2 select khi tick */}
                {ebUseCustomScale && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Số vòng tối đa (n)"
                      value={ebMaxRounds}
                      onChange={(e) => {
                        const n = Math.max(1, Number(e.target.value) || 1);
                        setEbMaxRounds(n);
                        setEbDrawSize(fromRounds(n));
                      }}
                      sx={{ minWidth: 200 }}
                    >
                      {roundsOptionsUpTo(
                        Math.max(128, ebDrawSize || paidCount || regsCount || 16)
                      ).map((n) => (
                        <MenuItem key={n} value={n}>
                          {n} vòng (2^{n} = {1 << n} đội)
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      label="Quy mô (2^n đội)"
                      value={ebDrawSize}
                      onChange={(e) => {
                        const v = Math.max(2, Number(e.target.value) || 2);
                        const pow2 = ceilPow2(v);
                        setEbDrawSize(pow2);
                        setEbMaxRounds(toRounds(pow2));
                      }}
                      sx={{ minWidth: 240 }}
                    >
                      {pow2OptionsUpTo(
                        Math.max(128, ebDrawSize || paidCount || regsCount || 16)
                      ).map((n) => (
                        <MenuItem key={n} value={n}>
                          {n} đội (vòng 1 có {n / 2} cặp)
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingBracket(null)}>Huỷ</Button>
          <Button onClick={saveEditBracket} variant="contained" sx={{ color: "white !important" }}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Tạo Match đơn lẻ */}
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

      {/* Dialog: SỬA Match */}
      <Dialog
        open={editMatchOpen}
        onClose={() => setEditingMatch(null)}
        fullWidth
        maxWidth="sm"
        keepMounted
      >
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

            {(willDowngrade || willChangeWinner) && (
              <Alert severity="warning">
                Bạn đang {willDowngrade ? "đổi trạng thái từ finished → " + emStatus : "đổi winner"}
                .
                <br />
                Có thể cần <b>reset các trận sau</b> trong nhánh này để nhất quán.
              </Alert>
            )}

            <Tooltip title="Bật để reset các trận phụ thuộc (nextMatch → …) trong nhánh.">
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
          <Button onClick={() => setEditingMatch(null)}>Huỷ</Button>
          <Button onClick={saveEditMatch} variant="contained">
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Tạo vòng sau thủ công */}
      <Dialog open={nextDlg} onClose={() => setNextDlg(false)} fullWidth maxWidth="md">
        <DialogTitle>Tạo vòng {nextRound} (chọn đội)</DialogTitle>
        <DialogContent>
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
                        {[lm?.pairA, lm?.pairB].filter(Boolean).map((x, i2) => (
                          <MenuItem key={`${lm?._id}-${i2}`} value={x._id}>
                            {regName(x, evType)}
                          </MenuItem>
                        ))}
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
                          ? [rm?.pairA, rm?.pairB].filter(Boolean).map((x, i2) => (
                              <MenuItem key={`${rm?._id}-${i2}`} value={x._id}>
                                {regName(x, evType)}
                              </MenuItem>
                            ))
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNextDlg(false)}>Huỷ</Button>
          <Button
            sx={{ color: "white !important" }}
            variant="contained"
            disabled={!canCreateNext}
            onClick={async () => {
              try {
                if (!nextDlgBracket) return;
                let created = 0;
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

      {/* Dialog: Lấy đội từ vòng trước (Progression) */}
      <Dialog open={advDlg} onClose={() => setAdvDlg(false)} fullWidth maxWidth="md">
        <DialogTitle>
          Lấy đội từ vòng trước → {advTarget ? <b>{advTarget.name}</b> : "—"}
        </DialogTitle>
        <DialogContent>
          {!advTarget ? (
            <Alert severity="warning">Chưa chọn bracket đích.</Alert>
          ) : (
            <Stack spacing={2} mt={1}>
              <Alert severity="info">
                Chọn bracket nguồn, chế độ lấy đội (Top N bảng / Đội thắng vòng KO), phương pháp
                seeding & cách ghép cặp. Có thể <b>Preview</b> trước khi Prefill/Commit.
              </Alert>

              <TextField
                select
                fullWidth
                label="Bracket nguồn"
                value={advSourceId}
                onChange={(e) => setAdvSourceId(e.target.value)}
                disabled={loadingSources}
                helperText={
                  errorSources
                    ? "Lỗi tải danh sách nguồn"
                    : "Chỉ hiển thị các bracket cùng giải & thứ tự trước target."
                }
                sx={{
                  mt: 1,
                  "& .MuiInputBase-root": { minHeight: 56 },
                  "& .MuiSelect-select": { py: 2, display: "flex", alignItems: "center" },
                }}
              >
                <MenuItem value="">
                  <em>— Chưa chọn —</em>
                </MenuItem>
                {advSources.map((b) => (
                  <MenuItem value={b._id} key={b._id}>
                    {b.name} ({b.type}, stage {b.stage ?? "?"})
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Chế độ lấy đội"
                  value={advMode}
                  onChange={(e) => setAdvMode(e.target.value)}
                  sx={{
                    minWidth: 240,
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2 },
                  }}
                >
                  <MenuItem value="GROUP_TOP">TOP mỗi bảng (Group → Playoff)</MenuItem>
                  <MenuItem value="KO_ROUND_WINNERS">Đội thắng vòng KO (Playoff → KO)</MenuItem>
                </TextField>

                {advMode === "GROUP_TOP" ? (
                  <TextField
                    type="number"
                    label="Top mỗi bảng"
                    value={advTopPerGroup}
                    onChange={(e) => setAdvTopPerGroup(Math.max(1, Number(e.target.value) || 1))}
                  />
                ) : (
                  <TextField
                    type="number"
                    label="Round (KO nguồn)"
                    value={advRound}
                    onChange={(e) => setAdvRound(Math.max(1, Number(e.target.value) || 1))}
                    helperText="VD: winners của round 1"
                  />
                )}

                <TextField
                  type="number"
                  label="Giới hạn tổng (tuỳ chọn)"
                  value={advLimit}
                  onChange={(e) => setAdvLimit(Math.max(0, Number(e.target.value) || 0))}
                  helperText="0 = lấy hết"
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Seed method"
                  value={advSeedMethod}
                  onChange={(e) => setAdvSeedMethod(e.target.value)}
                  sx={{
                    minWidth: 220,
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2 },
                  }}
                >
                  <MenuItem value="rating">rating (mặc định)</MenuItem>
                  <MenuItem value="random">random</MenuItem>
                  <MenuItem value="tiered">tiered</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Ghép cặp"
                  value={advPairing}
                  onChange={(e) => setAdvPairing(e.target.value)}
                  sx={{
                    minWidth: 200,
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2 },
                  }}
                >
                  <MenuItem value="standard">1–N, 2–N-1, …</MenuItem>
                  <MenuItem value="snake">snake (1–(N/2+1), 2–(N/2+2), …)</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Prefill mode"
                  value={advFillMode}
                  onChange={(e) => setAdvFillMode(e.target.value)}
                  sx={{
                    minWidth: 200,
                    "& .MuiInputBase-root": { minHeight: 56 },
                    "& .MuiSelect-select": { py: 2 },
                  }}
                  helperText="pairs = điền cặp luôn; pool = đổ danh sách để bốc tay sau"
                >
                  <MenuItem value="pairs">pairs (điền cặp sẵn)</MenuItem>
                  <MenuItem value="pool">pool (để bốc tay)</MenuItem>
                </TextField>
              </Stack>

              {!!advPreview?.length && (
                <Box sx={{ mt: 1, p: 2, border: "1px solid #eee", borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                    Preview seeded ({advPreview.length})
                  </Typography>
                  <Grid container spacing={1}>
                    {advPreview.map((s, i) => {
                      const reg = regIndex.get(idOf(s.regId));
                      return (
                        <Grid key={i} item xs={12} sm={6} md={4}>
                          <Card variant="outlined" sx={{ p: 1 }}>
                            <Typography variant="body2">
                              <b>#{s.seed}</b> — {reg ? regName(reg, evType) : idOf(s.regId)}
                            </Typography>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvDlg(false)}>Đóng</Button>
          <Button
            variant="outlined"
            onClick={async () => {
              if (!advTarget || !advSourceId)
                return showSnack("error", "Chọn bracket nguồn & đích.");
              try {
                const body =
                  advMode === "GROUP_TOP"
                    ? {
                        fromBracket: advSourceId,
                        mode: "GROUP_TOP",
                        topPerGroup: Math.max(1, Number(advTopPerGroup) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                      }
                    : {
                        fromBracket: advSourceId,
                        mode: "KO_ROUND_WINNERS",
                        round: Math.max(1, Number(advRound) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                      };
                const res = await previewAdvancement({ targetId: advTarget._id, body }).unwrap();
                setAdvPreview(res?.seeded || []);
                showSnack("success", `Preview: ${res?.count || 0} đội.`);
              } catch (e) {
                setAdvPreview([]);
                showSnack("error", e?.data?.error || e?.data?.message || e.error);
              }
            }}
            disabled={!advTarget || !advSourceId || loadingPreview}
          >
            {loadingPreview ? "Đang preview..." : "Preview"}
          </Button>
          <Button
            variant="outlined"
            onClick={async () => {
              if (!advTarget || !advSourceId)
                return showSnack("error", "Chọn bracket nguồn & đích.");
              try {
                const body =
                  advMode === "GROUP_TOP"
                    ? {
                        fromBracket: advSourceId,
                        mode: "GROUP_TOP",
                        topPerGroup: Math.max(1, Number(advTopPerGroup) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                        fillMode: advFillMode,
                        pairing: advPairing,
                      }
                    : {
                        fromBracket: advSourceId,
                        mode: "KO_ROUND_WINNERS",
                        round: Math.max(1, Number(advRound) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                        fillMode: advFillMode,
                        pairing: advPairing,
                      };
                const res = await prefillAdvancement({ targetId: advTarget._id, body }).unwrap();
                showSnack(
                  "success",
                  `Đã tạo DrawSession cho "${advTarget.name}". Entrants: ${res?.count || 0}${
                    res?.drawId ? ` (drawId: ${res.drawId})` : ""
                  }`
                );
                setAdvDlg(false);
              } catch (e) {
                showSnack("error", e?.data?.error || e?.data?.message || e.error);
              }
            }}
            disabled={!advTarget || !advSourceId || loadingPrefill}
          >
            {loadingPrefill ? "Đang prefill..." : "Prefill DrawSession"}
          </Button>
          <Button
            variant="contained"
            sx={{ color: "white !important" }}
            onClick={async () => {
              if (!advTarget || !advSourceId)
                return showSnack("error", "Chọn bracket nguồn & đích.");
              try {
                const body =
                  advMode === "GROUP_TOP"
                    ? {
                        fromBracket: advSourceId,
                        mode: "GROUP_TOP",
                        topPerGroup: Math.max(1, Number(advTopPerGroup) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                        pairing: advPairing,
                        validateOnly: false,
                      }
                    : {
                        fromBracket: advSourceId,
                        mode: "KO_ROUND_WINNERS",
                        round: Math.max(1, Number(advRound) || 1),
                        limit: Math.max(0, Number(advLimit) || 0),
                        seedMethod: advSeedMethod,
                        pairing: advPairing,
                        validateOnly: false,
                      };
                const res = await commitAdvancement({ targetId: advTarget._id, body }).unwrap();
                showSnack(
                  "success",
                  `Đã commit vào "${advTarget.name}": tạo ${
                    res?.matchesCreated ?? res?.created ?? 0
                  } trận`
                );
                setAdvDlg(false);
                refetchMatches();
                refetchBrackets();
              } catch (e) {
                showSnack("error", e?.data?.error || e?.data?.message || e.error);
              }
            }}
            disabled={!advTarget || !advSourceId || loadingCommit}
          >
            {loadingCommit ? "Đang commit..." : "Commit tạo trận ngay"}
          </Button>
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
      <Footer />
    </DashboardLayout>
  );
}
