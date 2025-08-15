import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  FormHelperText,
  Tooltip,
  Chip,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";
import ReplayIcon from "@mui/icons-material/Replay";
import CalculateIcon from "@mui/icons-material/Calculate";

import {
  useGetDrawSettingsSchemaQuery,
  useGetGlobalDrawSettingsQuery,
  useUpdateGlobalDrawSettingsMutation,
  useGetTournamentDrawSettingsQuery,
  useUpdateTournamentDrawSettingsMutation,
  useGetBracketDrawSettingsQuery,
  useUpdateBracketDrawSettingsMutation,
  useGetEffectiveDrawSettingsQuery,
  usePreviewDrawPlanMutation,
} from "../../slices/drawSettingsApiSlice";
import PropTypes from "prop-types";

import {
  useGetTournamentsQuery,
  useListTournamentBracketsQuery,
} from "../../slices/tournamentsApiSlice";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { toast } from "react-toastify";

function deepGet(obj, path, def) {
  return String(path)
    .split(".")
    .reduce((acc, k) => acc?.[k] ?? def, obj);
}
function deepSet(obj, path, value) {
  const parts = String(path).split(".");
  const draft = structuredClone(obj || {});
  let cur = draft;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return draft;
}

function FieldInput({ field, value, onChange }) {
  const { type, label, help, options, min, max, step } = field;

  if (type === "boolean") {
    return (
      <FormControlLabel
        control={<Switch checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />}
        label={label}
      />
    );
  }

  if (type === "select") {
    return (
      <FormControl fullWidth>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {(options || []).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
        {help && <FormHelperText>{help}</FormHelperText>}
      </FormControl>
    );
  }

  if (type === "number") {
    return (
      <TextField
        fullWidth
        type="number"
        label={label}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
        inputProps={{ min, max, step }}
        helperText={help || ""}
      />
    );
  }

  return (
    <TextField
      fullWidth
      label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      helperText={help || ""}
    />
  );
}

export default function AlgoSettingsPage() {
  // scope: 0=Global, 1=Tournament, 2=Bracket
  const [tab, setTab] = useState(0);
  const [tournamentId, setTournamentId] = useState("");
  const [bracketId, setBracketId] = useState("");

  // schema
  const { data: schemaRes, isLoading: lSchema, error: eSchema } = useGetDrawSettingsSchemaQuery();

  // global
  const {
    data: globalRes,
    isLoading: lGlobal,
    error: eGlobal,
  } = useGetGlobalDrawSettingsQuery(undefined, { skip: tab !== 0 });
  const [updateGlobal, { isLoading: savingGlobal }] = useUpdateGlobalDrawSettingsMutation();

  // tournaments & brackets for selectors
  const { data: tourListRes, error: eTours } = useGetTournamentsQuery(
    { sportType: undefined, groupId: undefined },
    { skip: tab === 0 }
  );
  const {
    data: bracketListRes,
    isLoading: lBr,
    error: eBr,
  } = useListTournamentBracketsQuery(tournamentId, { skip: tab !== 2 || !tournamentId });

  // tournament settings
  const {
    data: tRes,
    isLoading: lT,
    error: eT,
  } = useGetTournamentDrawSettingsQuery(tournamentId, { skip: tab !== 1 || !tournamentId });
  const [updateTournament, { isLoading: savingT }] = useUpdateTournamentDrawSettingsMutation();

  // bracket settings
  const {
    data: bRes,
    isLoading: lB,
    error: eB,
  } = useGetBracketDrawSettingsQuery(bracketId, {
    skip: tab !== 2 || !bracketId,
  });
  const [updateBracket, { isLoading: savingB }] = useUpdateBracketDrawSettingsMutation();

  // effective settings preview (for the current scope selection)
  const effArgs = useMemo(() => {
    if (tab === 0) return {}; // global only
    if (tab === 1 && tournamentId) return { tournamentId };
    if (tab === 2 && (bracketId || tournamentId)) return { tournamentId, bracketId };
    return {};
  }, [tab, tournamentId, bracketId]);
  const {
    data: effRes,
    isLoading: lEff,
    error: eEff,
  } = useGetEffectiveDrawSettingsQuery(effArgs, {
    skip: tab === 0 && !tournamentId && !bracketId,
  });

  // local editable state
  const initialSettings =
    tab === 0
      ? globalRes?.drawSettings
      : tab === 1
      ? tRes?.drawSettings
      : tab === 2
      ? bRes?.drawSettings
      : {};

  const [form, setForm] = useState(initialSettings || {});
  useEffect(() => {
    setForm(initialSettings || {});
  }, [tab, initialSettings]);

  const handleFieldChange = (path, v) => setForm((old) => deepSet(old, path, v));

  // preview plan
  const [previewPlan, { data: planRes, isLoading: lPlan, error: ePlan }] =
    usePreviewDrawPlanMutation();
  const [planOverrides, setPlanOverrides] = useState({ groupSize: "", groupCount: "" });

  const schema = schemaRes?.schema;
  const saving = savingGlobal || savingT || savingB;

  const canSave = tab === 0 || (tab === 1 && tournamentId) || (tab === 2 && bracketId);

  const parseErr = (e, fallback = "Có lỗi xảy ra") =>
    e?.data?.message || e?.error || e?.message || fallback;

  const onSave = async () => {
    if (!canSave) {
      toast.error(
        tab === 1
          ? "Chọn Tournament trước khi lưu"
          : tab === 2
          ? "Chọn Bracket trước khi lưu"
          : "Không thể lưu"
      );
      return;
    }

    try {
      if (tab === 0) {
        const p = updateGlobal({ drawSettings: form }).unwrap();
        await toast.promise(p, {
          loading: "Đang lưu Global...",
          success: "Đã lưu Global settings",
          error: (e) => parseErr(e, "Lưu Global thất bại"),
        });
      } else if (tab === 1) {
        const p = updateTournament({ tournamentId, drawSettings: form }).unwrap();
        await toast.promise(p, {
          loading: "Đang lưu cho giải...",
          success: "Đã lưu tham số cho giải",
          error: (e) => parseErr(e, "Lưu cho giải thất bại"),
        });
      } else {
        const p = updateBracket({ bracketId, drawSettings: form }).unwrap();
        await toast.promise(p, {
          loading: "Đang lưu cho bracket...",
          success: "Đã lưu tham số cho bracket",
          error: (e) => parseErr(e, "Lưu cho bracket thất bại"),
        });
      }
    } catch (e) {
      // toast.promise already handled error toast
    }
  };

  const onReset = () => {
    setForm(initialSettings || {});
    toast.success("Đã khôi phục giá trị đã lưu");
  };

  const runPreviewPlan = async () => {
    const base = {
      override: form,
      groupSize: planOverrides.groupSize === "" ? undefined : Number(planOverrides.groupSize),
      groupCount: planOverrides.groupCount === "" ? undefined : Number(planOverrides.groupCount),
    };
    try {
      if (tab === 2 && bracketId) {
        const p = previewPlan({ bracketId, ...base }).unwrap();
        await toast.promise(p, {
          loading: "Đang tính preview...",
          success: "Đã tính xong preview",
          error: (e) => parseErr(e, "Preview lỗi"),
        });
      } else if ((tab === 1 || tab === 0) && tournamentId) {
        const p = previewPlan({ tournamentId, ...base }).unwrap();
        await toast.promise(p, {
          loading: "Đang tính preview...",
          success: "Đã tính xong preview",
          error: (e) => parseErr(e, "Preview lỗi"),
        });
      } else {
        toast.error("Hãy chọn Tournament (hoặc Bracket) để preview");
      }
    } catch (e) {
      // handled in toast.promise
    }
  };

  // Error toasts for queries (load-time)
  useEffect(() => {
    if (eSchema) toast.error(parseErr(eSchema, "Không tải được schema"));
  }, [eSchema]);
  useEffect(() => {
    if (eGlobal && tab === 0) toast.error(parseErr(eGlobal, "Không tải được Global settings"));
  }, [eGlobal, tab]);
  useEffect(() => {
    if (eTours && tab !== 0) toast.error(parseErr(eTours, "Không tải được danh sách giải"));
  }, [eTours, tab]);
  useEffect(() => {
    if (eT && tab === 1) toast.error(parseErr(eT, "Không tải được settings của giải"));
  }, [eT, tab]);
  useEffect(() => {
    if (eBr && tab === 2) toast.error(parseErr(eBr, "Không tải được danh sách brackets"));
  }, [eBr, tab]);
  useEffect(() => {
    if (eB && tab === 2) toast.error(parseErr(eB, "Không tải được settings của bracket"));
  }, [eB, tab]);
  useEffect(() => {
    if (eEff) toast.error(parseErr(eEff, "Không lấy được effective settings"));
  }, [eEff]);
  useEffect(() => {
    if (ePlan) toast.error(parseErr(ePlan, "Preview lỗi"));
  }, [ePlan]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      {/* Toast container (có thể đặt ở App root, nhưng để đây cũng OK) */}
      <Box p={2} sx={{ maxWidth: 1200, mx: "auto" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <TuneIcon />
          <Typography variant="h5" fontWeight={700}>
            Tham số thuật toán bốc thăm
          </Typography>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Global (mặc định)" />
            <Tab label="Theo giải (Tournament)" />
            <Tab label="Theo bảng/nhánh (Bracket)" />
          </Tabs>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
            {tab === 1 && (
              <FormControl fullWidth>
                <InputLabel>Chọn Tournament</InputLabel>
                <Select
                  label="Chọn Tournament"
                  value={tournamentId}
                  onChange={(e) => {
                    setTournamentId(e.target.value);
                    setBracketId("");
                    toast("Đã chọn tournament");
                  }}
                >
                  {(tourListRes?.tournaments || tourListRes || []).map((t) => (
                    <MenuItem key={t._id || t.id} value={t._id || t.id}>
                      {t.name || t.title}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Override tham số cho giải này</FormHelperText>
              </FormControl>
            )}

            {tab === 2 && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Chọn Tournament</InputLabel>
                  <Select
                    label="Chọn Tournament"
                    value={tournamentId}
                    onChange={(e) => {
                      setTournamentId(e.target.value);
                      setBracketId("");
                      toast("Đã chọn tournament");
                    }}
                  >
                    {(tourListRes?.tournaments || tourListRes || []).map((t) => (
                      <MenuItem key={t._id || t.id} value={t._id || t.id}>
                        {t.name || t.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth disabled={!tournamentId || lBr}>
                  <InputLabel>Chọn Bracket</InputLabel>
                  <Select
                    label="Chọn Bracket"
                    value={bracketId}
                    onChange={(e) => {
                      setBracketId(e.target.value);
                      toast("Đã chọn bracket");
                    }}
                  >
                    {(Array.isArray(bracketListRes) ? bracketListRes : []).map((b) => (
                      <MenuItem key={b._id} value={b._id}>
                        {b.name} — {b.type}
                      </MenuItem>
                    ))}
                  </Select>
                  {eBr && <FormHelperText error>Lỗi tải brackets</FormHelperText>}
                </FormControl>
              </>
            )}
          </Stack>
        </Paper>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {/* LEFT: form */}
          <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Thiết lập
              </Typography>
              {saving && <CircularProgress size={16} />}
            </Stack>

            {lSchema || (tab === 0 && lGlobal) || (tab === 1 && lT) || (tab === 2 && lB) ? (
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : eSchema ? (
              <Alert severity="error">Không tải được schema.</Alert>
            ) : (
              <Stack spacing={2}>
                {(schema?.sections || []).map((sec) => (
                  <Box key={sec.key}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography fontWeight={700}>{sec.title}</Typography>
                      {sec.key === "seed" && <Chip size="small" label="Reproducible" />}
                    </Stack>
                    <Stack spacing={2}>
                      {(sec.fields || []).map((f) => {
                        const val = deepGet(form, f.path, "");
                        return (
                          <Tooltip key={f.path} title={f.help || ""} placement="top-start" arrow>
                            <Box>
                              <FieldInput
                                field={f}
                                value={val}
                                onChange={(v) => {
                                  handleFieldChange(f.path, v);
                                }}
                              />
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                  </Box>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!canSave || saving}
                onClick={onSave}
                sx={{ color: "white !important" }}
              >
                Lưu
              </Button>
              <Button
                variant="outlined"
                startIcon={<ReplayIcon />}
                disabled={saving}
                onClick={onReset}
              >
                Khôi phục giá trị đã lưu
              </Button>
            </Stack>
          </Paper>

          {/* RIGHT: effective + preview */}
          <Paper variant="outlined" sx={{ p: 2, width: { md: 420 } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <PreviewIcon />
              <Typography fontWeight={700}>Effective settings</Typography>
            </Stack>

            {lEff ? (
              <Box textAlign="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <Box
                component="pre"
                sx={{
                  fontSize: 12,
                  bgcolor: "grey.50",
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(
                  effRes?.effective || (tab === 0 ? globalRes?.drawSettings : {}),
                  null,
                  2
                )}
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <CalculateIcon />
              <Typography fontWeight={700}>Preview chia bảng</Typography>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                label="groupSize (override)"
                type="number"
                value={planOverrides.groupSize}
                onChange={(e) => setPlanOverrides((s) => ({ ...s, groupSize: e.target.value }))}
                fullWidth
              />
              <TextField
                label="groupCount (override)"
                type="number"
                value={planOverrides.groupCount}
                onChange={(e) => setPlanOverrides((s) => ({ ...s, groupCount: e.target.value }))}
                fullWidth
              />
            </Stack>

            <Button fullWidth variant="outlined" onClick={runPreviewPlan} disabled={lPlan}>
              Tính thử (không tạo phiên)
            </Button>

            {lPlan && (
              <Box textAlign="center" py={1}>
                <CircularProgress size={18} />
              </Box>
            )}
            {ePlan && (
              <Alert sx={{ mt: 1 }} severity="error">
                Preview lỗi.
              </Alert>
            )}

            {planRes?.planned && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={700}>
                  Kết quả:
                </Typography>
                <Typography variant="body2">Đội đăng ký: {planRes.regCount}</Typography>
                <Typography variant="body2">
                  groupSizes: {JSON.stringify(planRes.planned.groupSizes)}
                </Typography>
                <Typography variant="body2">byes: {planRes.planned.byes}</Typography>
              </Box>
            )}
          </Paper>
        </Stack>
      </Box>
    </DashboardLayout>
  );
}

FieldInput.propTypes = {
  field: PropTypes.shape({
    type: PropTypes.oneOf(["boolean", "select", "number", "text"]).isRequired,
    label: PropTypes.string.isRequired,
    help: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    // nếu bạn có dùng field.path ở ngoài, có thể khai báo thêm:
    path: PropTypes.string,
  }).isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
};

FieldInput.defaultProps = {
  value: "",
};
