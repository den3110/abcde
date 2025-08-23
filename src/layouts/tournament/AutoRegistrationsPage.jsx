import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Divider,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Button,
  Alert,
  Grid,
  Slider,
  Snackbar,
  CircularProgress,
  Autocomplete,
  IconButton,
  Chip,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import { useSearchParams } from "react-router-dom";
import { skipToken } from "@reduxjs/toolkit/query";

/* ===== RTK Query hooks (đổi lại tên nếu slice của bạn khác) ===== */
import {
  // lấy danh sách giải để chọn
  useListTournamentsQuery, // <-- nếu bạn dùng hook khác, đổi tên import này
  // tải chi tiết giải đã chọn
  useGetTournamentQuery,
  // lấy đăng ký hiện có (để hiển thị đếm)
  useGetRegistrationsQuery,
  // mutation tạo đăng ký tự động (đã thêm ở bước trước)
  useAutoGenerateRegistrationsMutation,
} from "slices/tournamentsApiSlice";

/* ===== Utils ===== */
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));

export default function AutoRegistrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get("t") || "";

  /* =====================
   *  STATE: bộ lọc chọn giải
   * ===================== */
  const [status, setStatus] = useState("all"); // all | upcoming | ongoing | finished
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState(null); // { id, label, raw }

  // nếu URL có t=<id>, khi mount thì “ghim” selected.id (lazy fill sau khi list trả về)
  useEffect(() => {
    if (!initialId) return;
    // chờ list tournaments xong sẽ setSelected dựa theo id
  }, [initialId]);

  // args cho list tournaments (memo hóa để tránh infinite loop)
  const listArg = useMemo(
    () => ({
      page: 1,
      limit: 50, // ✅ tùy bạn
      keyword: keyword.trim(),
      status: status === "all" ? "" : status,
      sort: "-createdAt",
    }),
    [keyword, status]
  );

  const {
    data: listData,
    isLoading: loadingList,
    error: errorList,
  } = useListTournamentsQuery(listArg, { refetchOnMountOrArgChange: true });

  const tournaments = listData?.list ?? [];

  // options cho Autocomplete
  const options = useMemo(
    () =>
      tournaments.map((t) => ({
        id: t._id, // ✅ slice dùng _id trong providesTags
        label: `${t.name} — ${t.location ?? "—"} (${t.eventType ?? "double"})`,
        raw: t,
      })),
    [tournaments]
  );
  // đồng bộ URL <-> lựa chọn
  useEffect(() => {
    const id = selected?.id || "";
    const cur = searchParams.get("t") || "";
    if (id && id !== cur) setSearchParams({ t: id });
    if (!id && cur) setSearchParams({}); // clear
  }, [selected, searchParams, setSearchParams]);

  // nếu có initialId mà selected chưa có, thử map từ options khi list về
  useEffect(() => {
    if (!initialId || selected) return;
    const found = options.find((o) => String(o.id) === String(initialId));
    if (found) setSelected(found);
  }, [initialId, options, selected]);

  const tournamentId = selected?.id || "";

  /* =====================
   *  Load chi tiết giải + đếm đăng ký hiện có
   * ===================== */
  const {
    data: tournament,
    isLoading: loadingT,
    error: errorT,
  } = useGetTournamentQuery(tournamentId ? tournamentId : skipToken, {
    refetchOnMountOrArgChange: true,
  });

  const {
    data: regs = [],
    isLoading: loadingR,
    error: errorR,
    refetch: refetchRegs,
  } = useGetRegistrationsQuery(tournamentId ? tournamentId : skipToken, {
    refetchOnMountOrArgChange: true,
  });

  const [autoGenerate, { isLoading: submitting }] = useAutoGenerateRegistrationsMutation();

  const isSingles = String(tournament?.eventType || "double") === "single";
  const existCount = Array.isArray(regs) ? regs.length : regs?.count || 0;

  /* =====================
   *  STATE: Form tạo tự động
   * ===================== */
  const [count, setCount] = useState(16);
  const [ratingMin, setRatingMin] = useState(2.0);
  const [ratingMax, setRatingMax] = useState(8.0);
  const [requireVerified, setRequireVerified] = useState(false);
  const [province, setProvince] = useState("");
  const [paymentMode, setPaymentMode] = useState("allUnpaid"); // allPaid | allUnpaid | ratio
  const [paidRatio, setPaidRatio] = useState(50);
  const [pairMethod, setPairMethod] = useState("balance"); // random | balance | adjacent
  const [enforceCaps, setEnforceCaps] = useState(true);
  const [dedupeByUser, setDedupeByUser] = useState(true);
  const [dedupeByPhone, setDedupeByPhone] = useState(true);
  const [randomSeed, setRandomSeed] = useState(Date.now());
  const [dryRun, setDryRun] = useState(true);

  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  const capsText = useMemo(() => {
    const parts = [];
    if (!tournament) return "";
    if (isSingles) {
      if (tournament?.singleCap > 0) parts.push(`single ≤ ${tournament.singleCap}`);
    } else {
      if (tournament?.singleCap > 0) parts.push(`mỗi VĐV ≤ ${tournament.singleCap}`);
      if (tournament?.scoreCap > 0) parts.push(`tổng đôi ≤ ${tournament.scoreCap}`);
      if (tournament?.scoreGap > 0) parts.push(`chênh lệch ≤ ${tournament.scoreGap}`);
    }
    return parts.length ? parts.join(" • ") : "Không giới hạn (0 = không áp dụng)";
  }, [tournament, isSingles]);

  const canSubmit = Boolean(tournamentId) && !submitting;

  const handleSubmit = async (previewOnly) => {
    if (!tournamentId) return;
    try {
      const body = {
        count: Math.max(1, Number(count) || 1),
        requireVerified,
        province: province.trim(),
        ratingMin: Number(ratingMin),
        ratingMax: Number(ratingMax),
        paymentMode,
        paidRatio: clamp(paidRatio, 0, 100) / 100,
        dedupeByUser,
        dedupeByPhone,
        pairMethod,
        enforceCaps,
        randomSeed: Number(randomSeed),
        dryRun: !!previewOnly,
      };
      const res = await autoGenerate({ tourId: tournamentId, body }).unwrap();
      if (res?.dryRun) {
        const planned = isSingles ? res.singlesPlanned || 0 : res.pairsPlanned || 0;
        showSnack("info", `Preview: sẽ tạo ${planned} ${isSingles ? "VĐV" : "cặp"}.`);
      } else {
        showSnack("success", `Đã tạo ${res?.created || 0} ${isSingles ? "đăng ký" : "cặp"} mới.`);
        await refetchRegs();
      }
    } catch (e) {
      showSnack("error", e?.data?.message || e?.error || "Lỗi tạo đăng ký tự động");
    }
  };

  const loadingAny = loadingList || (tournamentId && (loadingT || loadingR));

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Typography variant="h4" gutterBottom>
          Đăng ký tự động
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Chọn giải ở bên dưới, sau đó cấu hình bộ lọc & tuỳ chọn để tạo đăng ký hàng loạt.
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {/* CHỌN GIẢI */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardHeader title="Chọn giải" />
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Trạng thái"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  sx={{ width: 220 }}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="upcoming">Sắp diễn ra</MenuItem>
                  <MenuItem value="ongoing">Đang diễn ra</MenuItem>
                  <MenuItem value="finished">Đã kết thúc</MenuItem>
                </TextField>

                <TextField
                  label="Tìm theo tên/địa điểm"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  fullWidth
                />
              </Stack>

              {loadingList ? (
                <Box py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : errorList ? (
                <Alert severity="error">
                  {(errorList?.data?.message || errorList?.error) ?? "Lỗi tải danh sách giải"}
                </Alert>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Autocomplete
                      options={options}
                      value={selected}
                      onChange={(_, v) => setSelected(v)}
                      renderInput={(params) => (
                        <TextField {...params} label="Chọn giải" placeholder="Gõ để lọc..." />
                      )}
                      getOptionLabel={(o) => o?.label ?? ""}
                      isOptionEqualToValue={(o, v) => (o?.id ?? "") === (v?.id ?? "")}
                      fullWidth
                    />
                  </Box>
                  {selected && (
                    <IconButton
                      aria-label="clear"
                      onClick={() => setSelected(null)}
                      title="Bỏ chọn"
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                </Stack>
              )}

              {!!selected && !!tournament && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip label={`Giải: ${tournament?.name ?? "—"}`} />
                  <Chip label={`Loại: ${isSingles ? "Singles" : "Doubles"}`} />
                  <Chip label={`Đăng ký hiện có: ${existCount}`} />
                  {tournament?.location ? (
                    <Chip label={`Địa điểm: ${tournament.location}`} />
                  ) : null}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* FORM CẤU HÌNH & TẠO */}
        <Card variant="outlined">
          <CardHeader title="Cấu hình tạo đăng ký" />
          <CardContent>
            {loadingAny ? (
              <Box py={2}>
                <CircularProgress />
              </Box>
            ) : (errorT || errorR) && tournamentId ? (
              <Alert severity="error">
                {(errorT?.data?.message ||
                  errorT?.error ||
                  errorR?.data?.message ||
                  errorR?.error) ??
                  "Lỗi tải dữ liệu giải"}
              </Alert>
            ) : !tournamentId ? (
              <Alert severity="info">Hãy chọn một giải để cấu hình và tạo đăng ký.</Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        type="number"
                        label={isSingles ? "Số VĐV cần tạo" : "Số cặp cần tạo"}
                        value={count}
                        onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                        sx={{ minWidth: 200 }}
                      />
                      <TextField
                        label="Tỉnh/Thành (tùy chọn)"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="VD: Hồ Chí Minh"
                        sx={{ minWidth: 240 }}
                      />
                    </Stack>

                    <Stack>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Khoảng điểm (localRatings.{isSingles ? "singles" : "doubles"})
                      </Typography>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        alignItems="center"
                      >
                        <TextField
                          type="number"
                          label="Min"
                          value={ratingMin}
                          onChange={(e) => setRatingMin(Number(e.target.value))}
                          sx={{ width: 120 }}
                        />
                        <Slider
                          value={[Number(ratingMin), Number(ratingMax)]}
                          min={0}
                          max={10}
                          step={0.1}
                          valueLabelDisplay="auto"
                          onChange={(_, v) => {
                            setRatingMin(v[0]);
                            setRatingMax(v[1]);
                          }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          type="number"
                          label="Max"
                          value={ratingMax}
                          onChange={(e) => setRatingMax(Number(e.target.value))}
                          sx={{ width: 120 }}
                        />
                      </Stack>
                    </Stack>

                    {!isSingles && (
                      <TextField
                        select
                        label="Cách ghép đôi"
                        value={pairMethod}
                        onChange={(e) => setPairMethod(e.target.value)}
                        sx={{ minWidth: 240 }}
                      >
                        <MenuItem value="balance">Balance — ghép cao với thấp</MenuItem>
                        <MenuItem value="adjacent">Adjacent — (1–2), (3–4)...</MenuItem>
                        <MenuItem value="random">Random — ngẫu nhiên</MenuItem>
                      </TextField>
                    )}

                    <Alert severity="info">
                      Giới hạn của giải: <b>{capsText}</b>
                    </Alert>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={requireVerified}
                            onChange={(e) => setRequireVerified(e.target.checked)}
                          />
                        }
                        label="Chỉ lấy user đã verified"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={enforceCaps}
                            onChange={(e) => setEnforceCaps(e.target.checked)}
                          />
                        }
                        label="Tôn trọng scoreCap / scoreGap / singleCap"
                      />
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={dedupeByUser}
                            onChange={(e) => setDedupeByUser(e.target.checked)}
                          />
                        }
                        label="Không dùng trùng user"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={dedupeByPhone}
                            onChange={(e) => setDedupeByPhone(e.target.checked)}
                          />
                        }
                        label="Không dùng trùng số điện thoại"
                      />
                    </Stack>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack spacing={2}>
                    <TextField
                      select
                      label="Trạng thái thanh toán"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="allUnpaid">Tất cả Unpaid</MenuItem>
                      <MenuItem value="allPaid">Tất cả Paid</MenuItem>
                      <MenuItem value="ratio">% Paid ngẫu nhiên</MenuItem>
                    </TextField>

                    {paymentMode === "ratio" && (
                      <Stack>
                        <Typography variant="body2">Tỉ lệ Paid: {paidRatio}%</Typography>
                        <Slider
                          value={paidRatio}
                          min={0}
                          max={100}
                          step={1}
                          valueLabelDisplay="auto"
                          onChange={(_, v) => setPaidRatio(v)}
                        />
                      </Stack>
                    )}

                    <TextField
                      type="number"
                      label="Random seed"
                      value={randomSeed}
                      onChange={(e) => setRandomSeed(Number(e.target.value))}
                    />

                    <FormControlLabel
                      control={
                        <Checkbox checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                      }
                      label="Preview (không ghi DB)"
                    />

                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="outlined"
                        onClick={() => handleSubmit(true)}
                        disabled={!canSubmit}
                      >
                        {submitting ? "Đang preview..." : "Preview"}
                      </Button>
                      <Button
                        variant="contained"
                        sx={{ color: "white !important" }}
                        onClick={() => handleSubmit(false)}
                        disabled={!canSubmit}
                      >
                        {submitting ? "Đang tạo..." : "Tạo đăng ký"}
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Box>

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
