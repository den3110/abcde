import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetRecentTournamentsQuery,
  useSearchTournamentsQuery,
  useGetTournamentByIdQuery,
  useUpdateTournamentOverlayMutation,
} from "slices/tournamentsApiSlice";

/* ===== Default overlay (khớp ScoreOverlay) ===== */
const DEFAULT_OVERLAY = {
  theme: "dark",
  accentA: "#25C2A0",
  accentB: "#4F46E5",
  corner: "tl",
  rounded: 18,
  shadow: true,
  showSets: true,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
  nameScale: 1,
  scoreScale: 1,
  customCss: "",
  logoUrl: "",
};

/* ---------- Small helpers ---------- */
const ColorField = ({ label, value, onChange }) => (
  <TextField
    label={label}
    type="color"
    value={value}
    onChange={onChange}
    fullWidth
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <ColorLensIcon fontSize="small" />
        </InputAdornment>
      ),
      sx: { height: 48, pl: 1 },
    }}
    sx={{
      "& input[type=color]": {
        p: 0,
        minWidth: 40,
        height: 40,
        cursor: "pointer",
      },
    }}
  />
);

/* ---------- Debounce helper ---------- */
function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------- CSS validity checker (realtime) ---------- */
function useCssValidity(
  css,
  { requireScope = true, scopeSelector = "[data-ovl]", maxLen = 20000 } = {}
) {
  const debounced = useDebouncedValue(css ?? "", 200);
  const [state, setState] = useState({ ok: true, reason: "" });

  useEffect(() => {
    const text = (debounced || "").trim();
    if (!text) {
      setState({ ok: true, reason: "" });
      return;
    }
    if (text.length > maxLen) {
      setState({
        ok: false,
        reason: `CSS quá dài (${text.length}/${maxLen})`,
      });
      return;
    }
    if (
      requireScope &&
      !new RegExp(scopeSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text)
    ) {
      setState({ ok: false, reason: `CSS cần scope bằng ${scopeSelector}` });
      return;
    }

    let ok = true,
      reason = "";
    try {
      if (
        typeof CSSStyleSheet !== "undefined" &&
        CSSStyleSheet.prototype &&
        "replaceSync" in CSSStyleSheet.prototype
      ) {
        // Parse qua constructable stylesheet
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text); // throw nếu sai cú pháp
      } else {
        // Fallback: inject tạm và đọc cssRules
        const el = document.createElement("style");
        el.setAttribute("data-test", "css-validate");
        el.textContent = text;
        document.head.appendChild(el);
        try {
          // eslint-disable-next-line no-unused-expressions
          el.sheet && el.sheet.cssRules;
        } catch (e) {
          ok = false;
          reason = "Sai cú pháp CSS";
        }
        document.head.removeChild(el);
      }
    } catch {
      ok = false;
      reason = "Sai cú pháp CSS";
    }
    setState({ ok, reason });
  }, [debounced, requireScope, scopeSelector, maxLen]);

  return state; // { ok: boolean, reason: string }
}

/* ---------- Live preview (mini) ---------- */
function OverlayPreview({ form }) {
  const {
    theme,
    accentA,
    accentB,
    rounded,
    shadow,
    nameScale,
    scoreScale,
    fontFamily,
    showSets,
    customCss,
  } = form || DEFAULT_OVERLAY;

  const cssOK = useCssValidity(customCss); // ✅ kiểm tra realtime

  const cssVars = {
    "--bg": theme === "light" ? "#ffffffcc" : "#0b0f14cc",
    "--fg": theme === "light" ? "#0b0f14" : "#E6EDF3",
    "--muted": theme === "light" ? "#5c6773" : "#9AA4AF",
    "--accent-a": accentA,
    "--accent-b": accentB,
    "--radius": `${rounded}px`,
    "--shadow": shadow ? "0 8px 24px rgba(0,0,0,.25)" : "none",
    "--name": `calc(16px * ${nameScale || 1})`,
    "--score": `calc(24px * ${scoreScale || 1})`,
    "--meta": "11px",
    "--badge": "10px",
    "--table": "11px",
    "--table-cell": "22px",
    "--font": fontFamily || DEFAULT_OVERLAY.fontFamily,
  };

  const card = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 6,
    background: "var(--bg)",
    color: "var(--fg)",
    backdropFilter: "blur(8px)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow)",
    padding: "12px 14px",
    minWidth: 320,
    fontFamily: "var(--font)",
  };

  const meta = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "var(--meta)",
    color: "var(--muted)",
    paddingTop: 2,
    gap: 8,
  };

  const row = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 12,
  };

  const team = { display: "flex", alignItems: "center", gap: 10, minWidth: 0 };
  const pill = { width: 10, height: 10, borderRadius: 999 };
  const nameStyle = {
    fontWeight: 600,
    letterSpacing: 0.2,
    fontSize: "var(--name)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
  };
  const score = { fontWeight: 800, lineHeight: 1, fontSize: "var(--score)" };
  const badge = {
    fontWeight: 700,
    fontSize: "var(--badge)",
    padding: "2px 6px",
    borderRadius: 999,
    background: "#ef4444",
    color: "#fff",
  };

  const tableWrap = {
    display: "grid",
    gap: 4,
    fontSize: "var(--table)",
    marginTop: 4,
  };
  const th = {
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    color: "var(--muted)",
  };
  const td = {
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    textAlign: "center",
    minWidth: 24,
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: theme === "light" ? "#f8fafc" : "#0b0f14",
      }}
    >
      {/* ✅ Vùng preview có scope [data-ovl] + biến CSS */}
      <Box id="ovl-preview" data-ovl sx={{ ...cssVars }}>
        {/* ✅ Chỉ inject khi CSS hợp lệ */}
        {cssOK.ok && !!(customCss || "").trim() ? <style>{customCss}</style> : null}

        <div style={card} data-theme={theme}>
          <div style={meta}>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Vietnam Open 2025
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--muted)" }}>Vòng Chung kết</span>
              <span style={badge}>LIVE</span>
            </span>
          </div>

          <div style={row}>
            <div style={team}>
              <span style={{ ...pill, background: "var(--accent-a)" }} />
              <span style={nameStyle} title="Nguyen A & Tran B">
                Nguyen A & Tran B
              </span>
            </div>
            <div style={score}>10</div>
          </div>

          <div style={row}>
            <div style={team}>
              <span style={{ ...pill, background: "var(--accent-b)" }} />
              <span style={nameStyle} title="Le C & Pham D">
                Le C & Pham D
              </span>
            </div>
            <div style={score}>11</div>
          </div>

          {showSets && (
            <div style={tableWrap}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px repeat(3, 1fr)",
                  gap: 4,
                }}
              >
                <div style={{ visibility: "hidden" }}>.</div>
                <div style={th}>S1</div>
                <div style={th}>S2</div>
                <div style={th}>S3</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px repeat(3, 1fr)",
                  gap: 4,
                }}
              >
                <div style={{ textAlign: "center", color: "var(--muted)" }}>A</div>
                <div
                  style={{
                    ...td,
                    background: "var(--accent-a)",
                    color: "#fff",
                    borderColor: "transparent",
                  }}
                >
                  11
                </div>
                <div style={{ ...td, borderColor: "#94a3b8" }}>9</div>
                <div style={{ ...td, borderColor: "#94a3b8" }}>–</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px repeat(3, 1fr)",
                  gap: 4,
                }}
              >
                <div style={{ textAlign: "center", color: "var(--muted)" }}>B</div>
                <div style={{ ...td, borderColor: "#94a3b8" }}>9</div>
                <div
                  style={{
                    ...td,
                    background: "var(--accent-b)",
                    color: "#fff",
                    borderColor: "transparent",
                  }}
                >
                  11
                </div>
                <div style={{ ...td, borderColor: "#94a3b8" }}>–</div>
              </div>
            </div>
          )}
        </div>
      </Box>

      {/* Thông báo nhẹ nếu CSS không hợp lệ */}
      {!cssOK.ok && (customCss || "").trim() && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
          CSS không hợp lệ, không áp dụng vào preview. {cssOK.reason}
        </Typography>
      )}
    </Box>
  );
}

/* ---------- Main page ---------- */
export default function AdminOverlayPage() {
  /* ---- list hiện có ---- */
  const {
    data: recentData,
    isFetching: listLoading,
    refetch: refetchRecent,
  } = useGetRecentTournamentsQuery({ limit: 50, sort: "-updatedAt" });

  const recentList = useMemo(() => {
    const arr = Array.isArray(recentData)
      ? recentData
      : recentData?.items || recentData?.tournaments || [];
    return Array.isArray(arr) ? arr : [];
  }, [recentData]);

  /* ---- search & select ---- */
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 300);

  const { data: searchData, isFetching: searching } = useSearchTournamentsQuery(
    debounced ? { keyword: debounced, limit: 20 } : skipToken
  );

  const searchList = useMemo(() => {
    const arr = Array.isArray(searchData)
      ? searchData
      : searchData?.items || searchData?.tournaments || [];
    return Array.isArray(arr) ? arr : [];
  }, [searchData]);

  const options = debounced ? searchList : recentList;

  const [selected, setSelected] = useState(null);
  const selId = selected?._id || selected?.id;

  /* ---- form ---- */
  const [form, setForm] = useState(DEFAULT_OVERLAY);

  /* ---- detail for selected ---- */
  const { data: detailData } = useGetTournamentByIdQuery(selId ?? skipToken);

  // Khi có detail hoặc chọn mới -> fill overlay
  useEffect(() => {
    if (!selId) return;
    const ovl = detailData?.overlay || selected?.overlay || {};
    setForm({ ...DEFAULT_OVERLAY, ...ovl });
  }, [selId, detailData, selected]);

  const onField = (k) => (e) => {
    const val = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
  };

  const resetToDefault = () => setForm(DEFAULT_OVERLAY);

  const [updateOverlay, { isLoading: saving }] = useUpdateTournamentOverlayMutation();

  const [snack, setSnack] = useState({
    open: false,
    type: "success",
    msg: "",
  });

  const save = async () => {
    if (!selId) return;
    try {
      await updateOverlay({ id: selId, body: form }).unwrap();
      setSnack({ open: true, type: "success", msg: "Đã lưu overlay" });
    } catch (e) {
      setSnack({
        open: true,
        type: "error",
        msg: "Lưu thất bại. Kiểm tra quyền/endpoint.",
      });
    }
  };

  const copyObsUrl = async () => {
    if (!selId) return;
    const url = `${window.location.origin}/overlay?matchId=<MATCH_ID>&theme=${encodeURIComponent(
      form.theme
    )}&accentA=${encodeURIComponent(form.accentA)}&accentB=${encodeURIComponent(form.accentB)}`;
    try {
      await navigator.clipboard.writeText(url);
      setSnack({ open: true, type: "success", msg: "Đã copy URL overlay" });
    } catch {
      setSnack({ open: true, type: "error", msg: "Copy URL thất bại" });
    }
  };

  const onPickFromList = (t) => {
    setSelected(t);
    setInput(t?.name || "");
  };

  const canEdit = !!selId;

  const cssCheck = useCssValidity(form.customCss); // ✅ validate để hiển thị trạng thái ở TextField

  return (
    <DashboardLayout>
      <DashboardNavbar />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <PaletteIcon />
          <Typography variant="h6" fontWeight={700}>
            Cấu hình Overlay theo giải
          </Typography>
          {canEdit && (
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleIcon />}
              label={selected?.name}
              sx={{ ml: 1, maxWidth: 320 }}
            />
          )}
        </Stack>

        <GridLike>
          {/* LEFT: List & search */}
          <Box sx={{ flex: 5, minWidth: 280 }}>
            <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <CardHeader
                title="Tìm & chọn giải đấu"
                subheader="Gõ để tìm hoặc chọn từ danh sách gần đây"
                action={
                  <Tooltip title="Tải lại danh sách">
                    <span>
                      <IconButton onClick={() => refetchRecent()} disabled={listLoading}>
                        <RefreshIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                }
              />
              <CardContent sx={{ pt: 0 }}>
                <Autocomplete
                  value={selected}
                  onChange={(_e, v) => setSelected(v)}
                  inputValue={input}
                  onInputChange={(_e, v) => setInput(v)}
                  options={options}
                  loading={searching}
                  getOptionLabel={(o) => o?.name || ""}
                  filterOptions={(x) => x}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Nhập tên giải…"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                        endAdornment: (
                          <>
                            {searching ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option._id || option.id}>
                      <Stack width="100%">
                        <Typography fontWeight={600} noWrap>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {option._id || option.id}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={input ? "Không có kết quả" : "Nhập để tìm kiếm"}
                />

                <Typography variant="subtitle2" mt={2} mb={1}>
                  Gần đây
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    maxHeight: 380,
                    overflow: "auto",
                    borderRadius: 1.5,
                  }}
                >
                  {listLoading ? (
                    <Box sx={{ p: 2 }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Stack
                          key={i}
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          sx={{ py: 1 }}
                        >
                          <Skeleton variant="circular" width={18} height={18} />
                          <Skeleton variant="text" width="60%" />
                        </Stack>
                      ))}
                    </Box>
                  ) : recentList.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      Chưa có giải đấu nào.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {recentList.map((t, idx) => {
                        const id = t._id || t.id;
                        const selectedItem = selId && selId === id;
                        return (
                          <Box key={id}>
                            <ListItemButton
                              onClick={() => onPickFromList(t)}
                              selected={!!selectedItem}
                              sx={{ "&.Mui-selected": { bgcolor: "action.selected" } }}
                            >
                              <ListItemText
                                primary={
                                  <Typography fontWeight={600} noWrap title={t.name}>
                                    {t.name}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    {id}
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                            {idx < recentList.length - 1 && <Divider component="li" />}
                          </Box>
                        );
                      })}
                    </List>
                  )}
                </Paper>
              </CardContent>
            </Card>
          </Box>

          {/* RIGHT: Form + preview */}
          <Box sx={{ flex: 7, minWidth: 320 }}>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardHeader title="Giao diện & Vị trí" />
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id="theme-lbl">Theme</InputLabel>
                      <Select
                        labelId="theme-lbl"
                        label="Theme"
                        value={form.theme}
                        onChange={onField("theme")}
                      >
                        <MenuItem value="dark">Dark</MenuItem>
                        <MenuItem value="light">Light</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel id="corner-lbl">Vị trí</InputLabel>
                      <Select
                        labelId="corner-lbl"
                        label="Vị trí"
                        value={form.corner}
                        onChange={onField("corner")}
                      >
                        <MenuItem value="tl">Trên trái</MenuItem>
                        <MenuItem value="tr">Trên phải</MenuItem>
                        <MenuItem value="bl">Dưới trái</MenuItem>
                        <MenuItem value="br">Dưới phải</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      type="number"
                      label="Bo góc"
                      inputProps={{ min: 0, max: 40, step: 1 }}
                      value={form.rounded}
                      onChange={onField("rounded")}
                      fullWidth
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={2}>
                    <ColorField
                      label="Accent A"
                      value={form.accentA}
                      onChange={onField("accentA")}
                    />
                    <ColorField
                      label="Accent B"
                      value={form.accentB}
                      onChange={onField("accentB")}
                    />
                  </Stack>

                  <Stack direction="row" spacing={3} mt={2}>
                    <FormControlLabel
                      label="Hiện bảng set"
                      control={<Switch checked={!!form.showSets} onChange={onField("showSets")} />}
                    />
                    <FormControlLabel
                      label="Đổ bóng"
                      control={<Switch checked={!!form.shadow} onChange={onField("shadow")} />}
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardHeader title="Kiểu chữ & Tỷ lệ" />
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Font family"
                      value={form.fontFamily}
                      onChange={onField("fontFamily")}
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={2}>
                    <TextField
                      label="Name x scale"
                      type="number"
                      inputProps={{ step: 0.05, min: 0.5, max: 3 }}
                      value={form.nameScale}
                      onChange={onField("nameScale")}
                      fullWidth
                    />
                    <TextField
                      label="Score x scale"
                      type="number"
                      inputProps={{ step: 0.05, min: 0.5, max: 3 }}
                      value={form.scoreScale}
                      onChange={onField("scoreScale")}
                      fullWidth
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardHeader title="Logo & CSS tuỳ chỉnh" />
                <CardContent>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Logo URL"
                      value={form.logoUrl}
                      onChange={onField("logoUrl")}
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label="Custom CSS (scope [data-ovl])"
                    value={form.customCss}
                    onChange={onField("customCss")}
                    multiline
                    minRows={6}
                    fullWidth
                    sx={{ mt: 2 }}
                    placeholder={`/* ví dụ:
[data-ovl] .name { text-transform: uppercase; }
[data-ovl] .card { border: 2px solid #fff3; }
*/`}
                    error={!cssCheck.ok && !!form.customCss}
                    helperText={
                      form.customCss
                        ? cssCheck.ok
                          ? "CSS hợp lệ – áp dụng ngay ở phần Preview."
                          : cssCheck.reason || "CSS không hợp lệ."
                        : " "
                    }
                    InputProps={{
                      endAdornment: form.customCss ? (
                        <InputAdornment position="end" sx={{ alignSelf: "flex-start", mt: 1 }}>
                          {cssCheck.ok ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorOutlineIcon color="error" fontSize="small" />
                          )}
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardHeader title="Preview" subheader="Xem thử overlay với cấu hình hiện tại" />
                <CardContent>
                  <OverlayPreview form={form} />
                </CardContent>
              </Card>

              {/* Sticky action bar */}
              <Paper
                elevation={3}
                sx={{
                  position: "sticky",
                  bottom: 16,
                  borderRadius: 999,
                  p: 1,
                  ml: "auto",
                  width: "fit-content",
                  bgcolor: "background.paper",
                }}
              >
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={resetToDefault}
                    disabled={!canEdit}
                  >
                    Về mặc định
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyObsUrl}
                    disabled={!canEdit}
                  >
                    Copy URL Overlay
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={save}
                    disabled={!canEdit || saving}
                  >
                    {saving ? "Đang lưu..." : "Lưu"}
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </GridLike>

        <Snackbar
          open={snack.open}
          autoHideDuration={2800}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={snack.type}
            variant="filled"
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
          >
            {snack.msg}
          </Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  );
}

/* Simple responsive grid without importing Grid to keep code tight */
function GridLike({ children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
        gap: 2,
        alignItems: "start",
      }}
    >
      {children}
    </Box>
  );
}

// PropTypes
ColorField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

OverlayPreview.propTypes = {
  form: PropTypes.shape({
    theme: PropTypes.oneOf(["dark", "light"]),
    accentA: PropTypes.string,
    accentB: PropTypes.string,
    corner: PropTypes.oneOf(["tl", "tr", "bl", "br"]),
    rounded: PropTypes.number,
    shadow: PropTypes.bool,
    showSets: PropTypes.bool,
    fontFamily: PropTypes.string,
    nameScale: PropTypes.number,
    scoreScale: PropTypes.number,
    customCss: PropTypes.string,
    logoUrl: PropTypes.string,
  }).isRequired,
};

GridLike.propTypes = {
  children: PropTypes.node.isRequired,
};
