import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  LinearProgress,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { DataGrid } from "@mui/x-data-grid";
import { skipToken } from "@reduxjs/toolkit/query";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import {
  useCommitAiRegistrationImportMutation,
  useGetTournamentQuery,
  useListTournamentsQuery,
  useQuickImportAiRegistrationJsonMutation,
} from "slices/tournamentsApiSlice";

const STATUS_META = {
  ready: { label: "Có thể nhập", color: "success" },
  needs_review: { label: "Cần xem lại", color: "warning" },
  skip: { label: "Bỏ qua", color: "default" },
};

const LAYOUT_LABELS = {
  tabular: "Bảng cột",
  sectioned: "Nhiều vùng dữ liệu",
  free_text: "Ghi chú tự do",
  mixed: "Trộn nhiều kiểu",
  unknown: "Chưa rõ",
};

const REGISTRATION_STYLE_LABELS = {
  one_row_one_registration: "Mỗi dòng là một đăng ký",
  one_row_contains_pair: "Một dòng có thể chứa cả cặp",
  grouped_rows: "Một đăng ký trải trên nhiều dòng",
  mixed: "Không cố định",
  unknown: "Chưa rõ",
};

const AI_STAGE_LABELS = {
  document_analysis: "Phân tích bố cục file",
  row_grouping: "Nhóm các dòng thành hồ sơ",
};

const PREVIEW_STEP_LABELS = {
  connected: "Đã kết nối",
  init: "Đang tải thông tin giải",
  source_loading: "Đang lấy dữ liệu nguồn",
  source_parsed: "Đã đọc xong dữ liệu nguồn",
  document_analysis: "Đang hiểu bố cục file",
  row_grouping: "Đang gom hồ sơ đăng ký",
  row_extraction: "Đang tách từng hồ sơ",
  preview_building: "Đang lập bảng xem trước",
  complete: "Đã xong xem trước",
  error: "Có lỗi khi xem trước",
};

const EXTENDED_AI_STAGE_LABELS = {
  ...AI_STAGE_LABELS,
  gateway_uploading: "Gửi file sang Pikora",
  gateway_analyzing: "Pikora đang phân tích file",
  gateway_parsing: "Đang đọc kết quả Pikora",
};

const EXTENDED_PREVIEW_STEP_LABELS = {
  ...PREVIEW_STEP_LABELS,
  source_materialized: "Đang chuẩn bị file gửi AI",
  gateway_uploading: "Đang gửi file sang Pikora",
  gateway_analyzing: "Pikora đang phân tích file",
  gateway_parsing: "Đang đọc kết quả Pikora",
};

const API_BASE_URL = String(process.env.REACT_APP_API_URL || "/api").replace(/\/$/, "");

const CREDENTIAL_FIELD_PRIORITY = [
  "rowId",
  "rowNumber",
  "userId",
  "name",
  "nickname",
  "phone",
  "email",
  "password",
];

const CREDENTIAL_LABELS = {
  rowId: "Mã dòng",
  rowNumber: "Dòng",
  userId: "Mã tài khoản",
  name: "Họ tên",
  nickname: "Tên hiển thị",
  phone: "Số điện thoại",
  email: "Email",
  password: "Mật khẩu",
};

function serializeExportValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.log("Cannot serialize export value", error);
      return String(value);
    }
  }
  return String(value);
}

function prettifyFieldLabel(field) {
  if (!field) return "-";
  return String(field)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function buildCredentialExportModel(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const columns = [];
  const pushColumn = (field) => {
    if (!field || seen.has(field)) return;
    seen.add(field);
    columns.push(field);
  };

  CREDENTIAL_FIELD_PRIORITY.forEach((field) => {
    if (list.some((row) => Object.prototype.hasOwnProperty.call(row || {}, field))) {
      pushColumn(field);
    }
  });

  list.forEach((row) => {
    Object.keys(row || {}).forEach(pushColumn);
  });

  return {
    columns,
    rows: list.map((row) =>
      columns.reduce((acc, field) => {
        acc[field] = serializeExportValue(row?.[field]);
        return acc;
      }, {})
    ),
  };
}

function toCsvFromTable(columns, rows) {
  if (!columns?.length) return "";
  const esc = (value) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((col) => esc(row[col])).join(",")),
  ].join("\n");
}

function toCredentialsCsv(rows) {
  const exportModel = buildCredentialExportModel(rows);
  return toCsvFromTable(exportModel.columns, exportModel.rows);
}

function buildExportFilename(prefix, extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}

function downloadTextFile(
  filename,
  content,
  mimeType = "text/plain;charset=utf-8",
  withBom = false
) {
  const normalized = String(content || "");
  const blob = new Blob([withBom ? `\uFEFF${normalized}` : normalized], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, csv) {
  downloadTextFile(filename, csv, "text/csv;charset=utf-8", true);
}

function downloadXlsx(filename, rows) {
  const exportModel = buildCredentialExportModel(rows);
  const worksheet = XLSX.utils.json_to_sheet(exportModel.rows, { header: exportModel.columns });
  worksheet["!cols"] = exportModel.columns.map((field) => ({
    wch: Math.max((CREDENTIAL_LABELS[field] || prettifyFieldLabel(field)).length + 4, 16),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
  XLSX.writeFile(workbook, filename, { compression: true });
}

function getExportButtonLabel(item) {
  switch (item?.key) {
    case "analysis_csv":
      return "CSV đã phân tích";
    case "analysis_txt":
      return "Ghi chú phân tích";
    case "analysis_json":
      return "JSON AI";
    case "gateway_raw_text":
      return "Phản hồi gốc Pikora";
    default:
      return item?.label || "Tải file";
  }
}

function downloadPreviewExport(item) {
  const filename = item?.filename || "ai-import.txt";
  const content = item?.content || "";
  const mimeType = item?.mimeType || "text/plain;charset=utf-8";

  if (
    item?.key === "analysis_csv" ||
    /\.csv$/i.test(filename) ||
    String(mimeType).toLowerCase().includes("csv")
  ) {
    downloadCsv(filename, content);
    return;
  }

  downloadTextFile(filename, content, mimeType);
}

function brandAiCopy(value) {
  return String(value || "")
    .replace(/Pikora Gateway/gi, "Pikora")
    .replace(/CatGPT-Gateway/gi, "Pikora")
    .replace(/ChatGPT/gi, "Pikora")
    .replace(/\bGateway đang\b/gi, "Pikora đang")
    .replace(/\bGateway status\b/gi, "Trạng thái Pikora");
}

function formatAiStageMessage(stage) {
  return brandAiCopy(
    `${(EXTENDED_AI_STAGE_LABELS[stage?.stage] || stage?.stage || "unknown").replace(/_/g, " ")}: ${
      stage?.message || "Lỗi"
    }`
  );
}

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

async function buildImportFileSnapshot(file) {
  if (!file) return "";

  const name = String(file.name || "").toLowerCase();
  const isSpreadsheet = /\.(xlsx|xls)$/i.test(name);

  if (isSpreadsheet) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames.find((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return false;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
      return Boolean(csv);
    });

    if (!firstSheetName) return "";
    return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], { blankrows: false }).trim();
  }

  return (await file.text()).replace(/^\uFEFF/, "").trim();
}

async function parseQuickJsonTeamsFile(file) {
  if (!file) {
    throw new Error("Hãy chọn file JSON trước");
  }

  if (!/\.json$/i.test(String(file.name || ""))) {
    throw new Error("Chức năng này chỉ nhận file JSON");
  }

  const raw = (await file.text()).replace(/^\uFEFF/, "").trim();
  const parsed = JSON.parse(raw);
  const teams = Array.isArray(parsed) ? parsed : parsed?.teams;

  if (!Array.isArray(teams) || !teams.length) {
    throw new Error("File JSON phải là một mảng đội");
  }

  return teams.map((item, index) => ({
    rowId: String(item?.rowId || `quick-json-${index + 1}`),
    rowNumber: Number(item?.rowNumber) || index + 1,
    fullName1: String(item?.fullName1 || item?.name1 || item?.player1 || "").trim(),
    fullName2: String(item?.fullName2 || item?.name2 || item?.player2 || "").trim(),
  }));
}

function buildPreviewRequestHeaders(token, options = {}) {
  const { isFormData = false } = options;
  const headers = {
    accept: "text/event-stream",
  };

  if (!isFormData) headers["content-type"] = "application/json";

  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) headers["X-Timezone"] = tz;

    const offsetMinutes = new Date().getTimezoneOffset();
    headers["X-Timezone-Offset"] = String(offsetMinutes);

    const absTotalMinutes = Math.abs(offsetMinutes);
    const absHours = Math.floor(absTotalMinutes / 60);
    const absMinutes = absTotalMinutes % 60;
    const pad = (n) => String(n).padStart(2, "0");
    const sign = offsetMinutes <= 0 ? "+" : "-";
    headers["X-Timezone-Gmt"] = `GMT${sign}${pad(absHours)}:${pad(absMinutes)}`;
  } catch (error) {
    console.log("Cannot resolve timezone for preview stream", error);
  }

  return headers;
}

async function parsePreviewError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null);
    return data?.message || `Không thể xem trước (${response.status})`;
  }

  const text = await response.text().catch(() => "");
  return text || `Không thể xem trước (${response.status})`;
}

async function readSseStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Trình duyệt không đọc được stream từ server");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const flushBuffer = () => {
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = rawEvent.split("\n");
      let eventName = "message";
      const dataLines = [];

      lines.forEach((line) => {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      });

      if (dataLines.length) {
        const rawData = dataLines.join("\n");
        let payload = rawData;
        try {
          payload = JSON.parse(rawData);
        } catch {
          // keep raw string
        }
        onEvent(eventName, payload);
      }

      boundary = buffer.indexOf("\n\n");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushBuffer();
  }

  buffer += decoder.decode();
  flushBuffer();
}

async function streamPreviewImport({ tourId, body, token, onEvent }) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(
    buildApiUrl(`/admin/tournaments/${tourId}/registrations/ai-import/preview-stream`),
    {
      method: "POST",
      credentials: "include",
      headers: buildPreviewRequestHeaders(token, { isFormData }),
      body: isFormData ? body : JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(await parsePreviewError(response));
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  await readSseStream(response, onEvent);
  return null;
}

function PlayerCell({ label, player }) {
  if (!player) return <Typography variant="caption">-</Typography>;
  return (
    <Stack spacing={0.25} sx={{ width: "100%", minWidth: 0, py: 0.75 }}>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ whiteSpace: "normal", lineHeight: 1.35, overflowWrap: "anywhere" }}
      >
        {player.fullName || "-"}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: "normal", lineHeight: 1.35, overflowWrap: "anywhere" }}
      >
        {player.sourcePhone || player.matchedUser?.phone || player.tempDraft?.phone || "-"}
      </Typography>
      {player.action === "create_temp" && player.tempDraft?.email ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: "normal", lineHeight: 1.35, overflowWrap: "anywhere" }}
        >
          {player.tempDraft.email}
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: "normal", lineHeight: 1.35, overflowWrap: "anywhere" }}
      >
        {player.action === "match_existing"
          ? `${label}: đã khớp theo ${player.matchedBy}`
          : player.action === "create_temp"
          ? `${label}: sẽ tạo tài khoản tạm`
          : `${label}: thiếu dữ liệu`}
      </Typography>
    </Stack>
  );
}

function WrappedCell({ value, fontWeight, color, variant }) {
  return (
    <Box sx={{ width: "100%", py: 0.75 }}>
      <Typography
        variant={variant}
        color={color}
        fontWeight={fontWeight}
        sx={{ whiteSpace: "normal", lineHeight: 1.35, overflowWrap: "anywhere" }}
      >
        {value || "-"}
      </Typography>
    </Box>
  );
}

PlayerCell.propTypes = {
  label: PropTypes.string.isRequired,
  player: PropTypes.shape({
    action: PropTypes.string,
    fullName: PropTypes.string,
    matchedBy: PropTypes.string,
    matchedUser: PropTypes.shape({
      phone: PropTypes.string,
    }),
    sourcePhone: PropTypes.string,
    tempDraft: PropTypes.shape({
      email: PropTypes.string,
      phone: PropTypes.string,
    }),
  }),
};

PlayerCell.defaultProps = {
  player: null,
};

WrappedCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  fontWeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  variant: PropTypes.string,
};

WrappedCell.defaultProps = {
  value: "-",
  fontWeight: 400,
  color: "text.primary",
  variant: "body2",
};

export default function AiRegistrationImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get("t") || "";
  const authToken = useSelector((state) => state.auth.userInfo?.token || "");
  const resultSectionRef = useRef(null);

  const [status, setStatus] = useState("all");
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showTournamentPicker, setShowTournamentPicker] = useState(!initialId);
  const [inputMode, setInputMode] = useState("sheet");
  const [sheetUrl, setSheetUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importFileSnapshot, setImportFileSnapshot] = useState("");
  const [adminPrompt, setAdminPrompt] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [previewErrorDiagnostics, setPreviewErrorDiagnostics] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState({
    active: false,
    progress: 0,
    step: "",
    message: "",
    logs: [],
  });
  const [selectionModel, setSelectionModel] = useState([]);
  const [commitResult, setCommitResult] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paidRowIds, setPaidRowIds] = useState([]);
  const [quickJsonDialogOpen, setQuickJsonDialogOpen] = useState(false);
  const [quickJsonTeams, setQuickJsonTeams] = useState([]);
  const [quickJsonPaidRowIds, setQuickJsonPaidRowIds] = useState([]);
  const [userExportAnchorEl, setUserExportAnchorEl] = useState(null);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const listArg = useMemo(
    () => ({
      page: 1,
      limit: 50,
      status: status === "all" ? "" : status,
      sort: "-createdAt",
    }),
    [status]
  );

  const { data: listData, isLoading: loadingList } = useListTournamentsQuery(listArg, {
    refetchOnMountOrArgChange: true,
  });
  const [commitImport, { isLoading: committing }] = useCommitAiRegistrationImportMutation();
  const [quickImportJson, { isLoading: quickImporting }] =
    useQuickImportAiRegistrationJsonMutation();

  const options = useMemo(
    () =>
      (listData?.list || []).map((t) => ({
        id: t._id,
        label: `${t.name} — ${t.location || "—"} (${t.eventType === "single" ? "đơn" : "đôi"})`,
      })),
    [listData]
  );

  useEffect(() => {
    if (!initialId || selectedTournament) return;
    const found = options.find((item) => String(item.id) === String(initialId));
    if (found) setSelectedTournament(found);
  }, [initialId, options, selectedTournament]);

  useEffect(() => {
    const nextId = selectedTournament?.id || "";
    if (!nextId) {
      if (searchParams.get("t")) setSearchParams({});
      return;
    }
    if (searchParams.get("t") !== nextId) {
      setSearchParams({ t: nextId });
    }
  }, [searchParams, selectedTournament, setSearchParams]);

  const tournamentId = selectedTournament?.id || "";
  const shouldShowTournamentPicker = showTournamentPicker || !selectedTournament;
  const { data: tournament } = useGetTournamentQuery(tournamentId ? tournamentId : skipToken, {
    refetchOnMountOrArgChange: true,
  });

  const rows = previewData?.rows || [];
  const readyRows = rows.filter((row) => row.status === "ready");
  const selectedRows = rows.filter(
    (row) => selectionModel.includes(row.rowId) && row.status === "ready"
  );

  useEffect(() => {
    setSelectionModel(readyRows.map((row) => row.rowId));
  }, [previewData]);

  useEffect(() => {
    setPaymentDialogOpen(false);
    setPaidRowIds([]);
  }, [previewData]);

  useEffect(() => {
    if (!commitResult || !resultSectionRef.current) return;
    resultSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [commitResult]);

  const gridRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.rowId,
        ...row,
      })),
    [rows]
  );

  const canPreview = Boolean(
    tournamentId &&
      (inputMode === "sheet" ? sheetUrl.trim() : inputMode === "file" ? importFile : rawText.trim())
  );
  const canCommit = Boolean(tournamentId && selectedRows.length > 0 && !committing);
  const canCommitAllReady = Boolean(tournamentId && readyRows.length > 0 && !committing);

  const previewSummary = previewData?.summary;
  const previewAnalysis = previewData?.analysis;
  const previewAiDiagnostics = previewData?.aiDiagnostics || previewErrorDiagnostics;
  const previewExports = previewData?.exports || [];
  const previewProvider = previewAiDiagnostics?.environment?.provider || "legacy";
  const usingCatgptGateway = previewProvider === "catgpt";
  const credentials = commitResult?.credentials || [];
  const credentialExportModel = useMemo(
    () => buildCredentialExportModel(credentials),
    [credentials]
  );
  const paidRowIdSet = useMemo(() => new Set(paidRowIds), [paidRowIds]);
  const allReadyRowIds = useMemo(() => readyRows.map((row) => row.rowId), [readyRows]);
  const allReadyPaid =
    readyRows.length > 0 && readyRows.every((row) => paidRowIdSet.has(row.rowId));
  const partiallyPaid =
    paidRowIds.length > 0 && paidRowIds.length < Math.max(allReadyRowIds.length, 1);
  const quickJsonPaidRowIdSet = useMemo(() => new Set(quickJsonPaidRowIds), [quickJsonPaidRowIds]);
  const allQuickJsonRowIds = useMemo(
    () => quickJsonTeams.map((row) => row.rowId),
    [quickJsonTeams]
  );
  const allQuickJsonPaid =
    quickJsonTeams.length > 0 &&
    quickJsonTeams.every((row) => quickJsonPaidRowIdSet.has(row.rowId));
  const partiallyQuickJsonPaid =
    quickJsonPaidRowIds.length > 0 &&
    quickJsonPaidRowIds.length < Math.max(allQuickJsonRowIds.length, 1);

  const pushPreviewProgress = (payload = {}) => {
    const next = {
      step: payload.step || "working",
      progress: Math.max(0, Math.min(100, Number(payload.progress) || 0)),
      message: payload.message || "Hệ thống đang xử lý dữ liệu...",
    };

    setPreviewProgress((prev) => ({
      active: next.step !== "complete" && next.step !== "error",
      ...prev,
      ...next,
      logs: [
        ...prev.logs,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...next,
        },
      ].slice(-8),
    }));
  };

  const handleImportFileChange = async (event) => {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = "";

    if (!nextFile) {
      setImportFile(null);
      setImportFileSnapshot("");
      return;
    }

    try {
      const snapshot = await buildImportFileSnapshot(nextFile);
      setImportFile(nextFile);
      setImportFileSnapshot(snapshot);
      setSnack({
        open: true,
        type: "success",
        msg: `Đã nạp file ${nextFile.name}`,
      });
    } catch (error) {
      setImportFile(null);
      setImportFileSnapshot("");
      setSnack({
        open: true,
        type: "error",
        msg: error?.message || "Không đọc được file này",
      });
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewData(null);
    setPreviewErrorDiagnostics(null);
    setCommitResult(null);
    setPreviewProgress({
      active: true,
      progress: 1,
      step: "init",
      message: "Đang bắt đầu xem trước danh sách.",
      logs: [],
    });

    try {
      let body;
      if (inputMode === "sheet") {
        body = { sheetUrl: sheetUrl.trim(), adminPrompt: adminPrompt.trim() };
      } else if (inputMode === "file") {
        if (!importFile) {
          throw new Error("Hãy chọn file đăng ký trước khi xem trước");
        }
        body = new FormData();
        body.append("file", importFile);
        body.append("rawText", importFileSnapshot || "");
        body.append("adminPrompt", adminPrompt.trim());
      } else {
        body = { rawText: rawText.trim(), adminPrompt: adminPrompt.trim() };
      }
      let streamedResult = null;
      let streamedError = "";
      let streamedErrorDiagnostics = null;
      const res = await streamPreviewImport({
        tourId: tournamentId,
        body,
        token: authToken,
        onEvent: (eventName, payload) => {
          if (eventName === "progress") {
            pushPreviewProgress(payload);
            return;
          }

          if (eventName === "complete") {
            streamedResult = payload;
            return;
          }

          if (eventName === "error") {
            streamedErrorDiagnostics = payload?.aiDiagnostics || null;
            setPreviewErrorDiagnostics(streamedErrorDiagnostics);
            streamedError = payload?.message || "Không đọc được dữ liệu để xem trước";
            pushPreviewProgress({
              step: "error",
              progress: 100,
              message: streamedError,
            });
          }
        },
      });
      const finalResult = res || streamedResult;
      if (streamedError) {
        const streamedException = new Error(streamedError);
        streamedException.aiDiagnostics = streamedErrorDiagnostics;
        throw streamedException;
      }
      if (!finalResult) {
        throw new Error("Không nhận được kết quả xem trước từ server");
      }

      pushPreviewProgress({
        step: "complete",
        progress: 100,
        message: "Đã xong phần xem trước danh sách.",
      });
      setPreviewData(finalResult);
      setPreviewErrorDiagnostics(null);
      setSnack({
        open: true,
        type: "success",
        msg: `Đã đọc xong danh sách: ${finalResult.summary.readyRows} dòng có thể nhập, ${finalResult.summary.reviewRows} dòng cần xem lại`,
      });
    } catch (error) {
      pushPreviewProgress({
        step: "error",
        progress: 100,
        message:
          error?.data?.message ||
          error?.message ||
          error?.error ||
          "Không đọc được dữ liệu để xem trước",
      });
      setPreviewData(null);
      setPreviewErrorDiagnostics(error?.aiDiagnostics || null);
      setSnack({
        open: true,
        type: "error",
        msg:
          error?.data?.message ||
          error?.message ||
          error?.error ||
          "Không đọc được dữ liệu để xem trước",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const commitRows = async (rowsToCommit, options = {}) => {
    try {
      const body = { rows: rowsToCommit };
      if (Object.prototype.hasOwnProperty.call(options, "paidRowIds")) {
        body.paidRowIds = options.paidRowIds;
      }
      const res = await commitImport({
        tourId: tournamentId,
        body,
      }).unwrap();
      setCommitResult(res);
      setSnack({
        open: true,
        type: "success",
        msg: `Đã tạo ${res.createdRegistrations} đội/cặp đăng ký và ${res.createdUsers} tài khoản VĐV`,
      });
      return true;
    } catch (error) {
      setSnack({
        open: true,
        type: "error",
        msg: error?.data?.message || error?.error || "Không thể lưu danh sách này",
      });
      return false;
    }
  };

  const handleCommit = async () => commitRows(selectedRows);

  const handleCommitAllReady = () => {
    setPaidRowIds([]);
    setPaymentDialogOpen(true);
  };

  const handleTogglePaidRow = (rowId) => {
    setPaidRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((value) => value !== rowId) : [...prev, rowId]
    );
  };

  const handleToggleAllPaidRows = (checked) => {
    setPaidRowIds(checked ? allReadyRowIds : []);
  };

  const handleConfirmCommitAllReady = async () => {
    const ok = await commitRows(readyRows, { paidRowIds });
    if (ok) {
      setPaymentDialogOpen(false);
      setPaidRowIds([]);
    }
  };

  const handleQuickImportJsonTeams = async () => {
    try {
      if (!tournamentId) {
        throw new Error("Hãy chọn giải trước");
      }
      if (String(tournament?.eventType || "double") === "single") {
        throw new Error("Nhập nhanh JSON này chỉ áp dụng cho giải đôi");
      }

      const teams = await parseQuickJsonTeamsFile(importFile);
      setQuickJsonTeams(teams);
      setQuickJsonPaidRowIds([]);
      setQuickJsonDialogOpen(true);
    } catch (error) {
      setSnack({
        open: true,
        type: "error",
        msg:
          error?.data?.message ||
          error?.message ||
          error?.error ||
          "Không nhập nhanh được file JSON này",
      });
    }
  };

  const handleQuickJsonFileChange = async (event) => {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = "";

    if (!nextFile) return;

    try {
      if (!tournamentId) {
        throw new Error("Hãy chọn giải trước");
      }
      if (String(tournament?.eventType || "double") === "single") {
        throw new Error("Nhập nhanh JSON này chỉ áp dụng cho giải đôi");
      }

      const snapshot = await buildImportFileSnapshot(nextFile);
      const teams = await parseQuickJsonTeamsFile(nextFile);

      setInputMode("file");
      setImportFile(nextFile);
      setImportFileSnapshot(snapshot);
      setQuickJsonTeams(teams);
      setQuickJsonPaidRowIds([]);
      setQuickJsonDialogOpen(true);
    } catch (error) {
      setSnack({
        open: true,
        type: "error",
        msg:
          error?.data?.message ||
          error?.message ||
          error?.error ||
          "Không nhập nhanh được file JSON này",
      });
    }
  };

  const handleToggleQuickJsonPaidRow = (rowId) => {
    setQuickJsonPaidRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((value) => value !== rowId) : [...prev, rowId]
    );
  };

  const handleToggleAllQuickJsonPaidRows = (checked) => {
    setQuickJsonPaidRowIds(checked ? allQuickJsonRowIds : []);
  };

  const handleConfirmQuickJsonImport = async () => {
    try {
      const teams = quickJsonTeams.map((team) => ({
        ...team,
        paid: quickJsonPaidRowIdSet.has(team.rowId),
      }));
      const res = await quickImportJson({
        tourId: tournamentId,
        body: { teams },
      }).unwrap();

      setCommitResult(res);
      setQuickJsonDialogOpen(false);
      setQuickJsonTeams([]);
      setQuickJsonPaidRowIds([]);
      setSnack({
        open: true,
        type: "success",
        msg: `Đã nhập nhanh ${res.createdRegistrations} đội/cặp và tạo ${res.createdUsers} tài khoản VĐV`,
      });
    } catch (error) {
      setSnack({
        open: true,
        type: "error",
        msg:
          error?.data?.message ||
          error?.message ||
          error?.error ||
          "Không nhập nhanh được file JSON này",
      });
    }
  };

  const previewColumns = useMemo(
    () => [
      {
        field: "sourceRowNumber",
        headerName: "Dòng",
        width: 120,
        renderCell: ({ value }) => <WrappedCell value={value} color="text.secondary" />,
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 150,
        renderCell: ({ value }) => {
          const meta = STATUS_META[value] || STATUS_META.skip;
          return (
            <Box sx={{ py: 1 }}>
              <Chip size="small" color={meta.color} label={meta.label} />
            </Box>
          );
        },
      },
      {
        field: "confidence",
        headerName: "Tin cậy",
        width: 100,
        renderCell: ({ value }) => (
          <WrappedCell
            value={`${Math.round((Number(value) || 0) * 100)}%`}
            color="text.secondary"
          />
        ),
      },
      {
        field: "primary",
        headerName: "VĐV 1",
        flex: 1.1,
        minWidth: 230,
        sortable: false,
        renderCell: ({ row }) => <PlayerCell label="VĐV 1" player={row.primary} />,
      },
      {
        field: "secondary",
        headerName: "VĐV 2",
        flex: 1.1,
        minWidth: 230,
        sortable: false,
        renderCell: ({ row }) =>
          tournament?.eventType === "single" ? (
            <WrappedCell value="Nội dung đơn" color="text.secondary" variant="caption" />
          ) : (
            <PlayerCell label="VĐV 2" player={row.secondary} />
          ),
      },
      {
        field: "paymentStatus",
        headerName: "Thanh toán",
        width: 130,
        renderCell: ({ value }) => <WrappedCell value={value} color="text.secondary" />,
      },
      {
        field: "actionSummary",
        headerName: "Xử lý",
        minWidth: 260,
        flex: 1,
        renderCell: ({ value }) => <WrappedCell value={value} />,
      },
      {
        field: "issues",
        headerName: "Lưu ý",
        minWidth: 320,
        flex: 1.4,
        sortable: false,
        renderCell: ({ row }) => (
          <WrappedCell value={(row.issues || []).join(" | ")} color="text.secondary" />
        ),
      },
      {
        field: "sourcePreview",
        headerName: "Dữ liệu gốc",
        minWidth: 340,
        flex: 1.6,
        renderCell: ({ value }) => <WrappedCell value={value} color="text.secondary" />,
      },
    ],
    [tournament?.eventType]
  );

  const credentialColumns = useMemo(
    () =>
      credentialExportModel.columns.map((field) => ({
        field,
        headerName: CREDENTIAL_LABELS[field] || prettifyFieldLabel(field),
        minWidth:
          field === "email" || field === "userId"
            ? 220
            : field === "password"
            ? 180
            : field === "rowNumber"
            ? 90
            : 160,
        flex: field === "rowNumber" ? 0.45 : 1,
        renderCell: ({ value }) => <WrappedCell value={value} color="text.secondary" />,
      })),
    [credentialExportModel.columns]
  );

  const handleDownloadCreatedUsersCsv = () => {
    downloadCsv(
      buildExportFilename("tai-khoan-vua-tao", "csv"),
      toCsvFromTable(credentialExportModel.columns, credentialExportModel.rows)
    );
  };

  const handleDownloadCreatedUsersJson = () => {
    downloadTextFile(
      buildExportFilename("tai-khoan-vua-tao", "json"),
      JSON.stringify(credentials, null, 2),
      "application/json;charset=utf-8",
      true
    );
  };

  const handleDownloadCreatedUsersExcel = () => {
    downloadXlsx(buildExportFilename("tai-khoan-vua-tao", "xlsx"), credentials);
  };

  const handleOpenUserExportMenu = (event) => {
    setUserExportAnchorEl(event.currentTarget);
  };

  const handleCloseUserExportMenu = () => {
    setUserExportAnchorEl(null);
  };

  const handleExportCreatedUsers = (type) => {
    if (type === "excel") handleDownloadCreatedUsersExcel();
    if (type === "csv") handleDownloadCreatedUsersCsv();
    if (type === "json") handleDownloadCreatedUsersJson();
    handleCloseUserExportMenu();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={3}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} display="flex" alignItems="center" gap={1}>
              <SmartToyIcon />
              Nhập đăng ký
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chọn giải rồi nạp file đăng ký, dán danh sách hoặc nhập link Google Sheet. Hệ thống sẽ
              đọc trước để bạn kiểm tra, sau đó mới lưu chính thức.
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardHeader title="Danh sách cần nhập" />
            <CardContent>
              <Grid container spacing={2}>
                {shouldShowTournamentPicker ? (
                  <>
                    <Grid item xs={12} md={5}>
                      <TextField
                        select
                        fullWidth
                        label="Tình trạng giải"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <MenuItem value="all">Tất cả</MenuItem>
                        <MenuItem value="upcoming">Sắp diễn ra</MenuItem>
                        <MenuItem value="ongoing">Đang diễn ra</MenuItem>
                        <MenuItem value="finished">Đã kết thúc</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={7}>
                      <Autocomplete
                        options={options}
                        loading={loadingList}
                        value={selectedTournament}
                        onChange={(_, value) => {
                          setSelectedTournament(value);
                          setShowTournamentPicker(!value);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Chọn giải"
                            placeholder="Chọn giải muốn nhập danh sách"
                          />
                        )}
                      />
                    </Grid>
                  </>
                ) : (
                  <Grid item xs={12}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label={selectedTournament?.label || "Giải đã chọn"} />
                      </Stack>
                      <Button variant="text" onClick={() => setShowTournamentPicker(true)}>
                        Chọn giải khác
                      </Button>
                    </Stack>
                  </Grid>
                )}
                {tournament ? (
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={tournament.name} />
                      <Chip
                        label={`Nội dung: ${tournament.eventType === "single" ? "Đơn" : "Đôi"}`}
                      />
                      <Chip label={`Địa điểm: ${tournament.location || "-"}`} />
                    </Stack>
                  </Grid>
                ) : null}
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    label="Cách nhập"
                    value={inputMode}
                    onChange={(e) => setInputMode(e.target.value)}
                  >
                    <MenuItem value="sheet">Dùng link Google Sheet</MenuItem>
                    <MenuItem value="file">Nạp file đăng ký</MenuItem>
                    <MenuItem value="paste">Dán trực tiếp</MenuItem>
                  </TextField>
                </Grid>
                {inputMode === "sheet" ? (
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      label="Link Google Sheet"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </Grid>
                ) : null}
                {inputMode === "file" ? (
                  <Grid item xs={12} md={8}>
                    <Stack spacing={1.25}>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Chọn file đăng ký
                        <input
                          hidden
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt,.json"
                          onChange={handleImportFileChange}
                        />
                      </Button>
                      <Typography variant="body2" color="text.secondary">
                        {importFile
                          ? `Đã chọn: ${importFile.name}`
                          : "Hỗ trợ XLSX, XLS, CSV, TXT, JSON"}
                      </Typography>
                    </Stack>
                  </Grid>
                ) : null}
                {inputMode === "paste" ? (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={8}
                      label="Dữ liệu đăng ký"
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={
                        "Dán nội dung copy từ Google Sheets, Excel hoặc file CSV vào đây nếu không dùng link"
                      }
                    />
                  </Grid>
                ) : null}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Ghi chú thêm cho AI"
                    value={adminPrompt}
                    onChange={(e) => setAdminPrompt(e.target.value)}
                    placeholder='Ví dụ: "Các dòng có ghi HỦY thì bỏ qua", "Nếu có ghi chú ô đỏ / red cell thì đừng cho vào đăng ký".'
                    helperText="Dùng để thêm rule riêng cho đợt import này. Nếu file thiếu email, số điện thoại, nickname hoặc mật khẩu mà vẫn còn tên người chơi thì hệ thống sẽ tự tạo tài khoản tạm để giữ suất đăng ký. Lưu ý: CSV/text thuần không giữ màu ô, nên các rule kiểu “ô đỏ” chỉ có tác dụng khi nguồn thực sự chứa dấu hiệu đó."
                  />
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="info">
                    Nếu dùng link, bảng cần mở public hoặc cho phép tải CSV. Nếu có file sẵn, bạn có
                    thể nạp thẳng file đăng ký để Pikora tự phân tích, sau đó xác nhận thanh toán
                    rồi tạo đăng ký.
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Xem trước" />
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: "column", xl: "row" }}
                  spacing={1.5}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems={{ xs: "stretch", xl: "center" }}
                >
                  <Button
                    variant={inputMode === "file" ? "contained" : "outlined"}
                    color="secondary"
                    component="label"
                    startIcon={<CloudUploadIcon />}
                    sx={{ minWidth: { xl: 220 } }}
                  >
                    Nạp file đăng ký
                    <input
                      hidden
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt,.json"
                      onChange={(event) => {
                        setInputMode("file");
                        handleImportFileChange(event);
                      }}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={previewing ? <CircularProgress size={16} /> : <VisibilityIcon />}
                    disabled={!canPreview || previewing}
                    onClick={handlePreview}
                    sx={{ minWidth: { xl: 200 } }}
                  >
                    {previewing ? "Đang đọc dữ liệu..." : "Xem trước danh sách"}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={committing ? <CircularProgress size={16} /> : <DoneAllIcon />}
                    disabled={!canCommit}
                    onClick={handleCommit}
                    sx={{ minWidth: { xl: 210 } }}
                  >
                    {committing ? "Đang lưu..." : `Lưu ${selectedRows.length} dòng đã chọn`}
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={committing ? <CircularProgress size={16} /> : <DoneAllIcon />}
                    disabled={!canCommitAllReady}
                    onClick={handleCommitAllReady}
                    sx={{ minWidth: { xl: 280 } }}
                  >
                    {committing
                      ? "Đang tạo đăng ký..."
                      : `Tạo tài khoản + đăng ký giải (${readyRows.length})`}
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    component="label"
                    startIcon={quickImporting ? <CircularProgress size={16} /> : <DoneAllIcon />}
                    disabled={!tournamentId || quickImporting}
                    sx={{ minWidth: { xl: 250 } }}
                  >
                    {quickImporting ? "Đang nhập nhanh JSON..." : "Nhập nhanh JSON đội đôi"}
                    <input hidden type="file" accept=".json" onChange={handleQuickJsonFileChange} />
                  </Button>
                </Stack>

                {importFile ? (
                  <Typography variant="body2" color="text.secondary">
                    File đang chọn: {importFile.name}
                  </Typography>
                ) : null}

                {previewExports.length ? (
                  <Stack
                    direction={{ xs: "column", lg: "row" }}
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    alignItems={{ xs: "stretch", lg: "center" }}
                  >
                    {previewExports.map((item) => (
                      <Button
                        key={`${item.source || "local"}-${item.key}`}
                        variant="text"
                        startIcon={<FileDownloadIcon />}
                        onClick={() => downloadPreviewExport(item)}
                      >
                        {getExportButtonLabel(item)}
                      </Button>
                    ))}
                  </Stack>
                ) : null}
              </Stack>

              {previewing || previewProgress.logs.length ? (
                <Alert
                  severity={
                    previewProgress.step === "error" ? "error" : previewing ? "info" : "success"
                  }
                  sx={{ mt: 2 }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                    >
                      <Typography variant="body2" fontWeight={700}>
                        {EXTENDED_PREVIEW_STEP_LABELS[previewProgress.step] ||
                          "Đang xử lý xem trước"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(previewProgress.progress || 0)}%
                      </Typography>
                    </Stack>

                    <Typography variant="body2">
                      {brandAiCopy(previewProgress.message || "Hệ thống đang xử lý dữ liệu...")}
                    </Typography>

                    <LinearProgress
                      variant={previewProgress.progress > 0 ? "determinate" : "indeterminate"}
                      value={Math.max(0, Math.min(100, previewProgress.progress || 0))}
                    />

                    {(previewProgress.logs || []).slice(-5).map((item) => (
                      <Typography key={item.id} variant="caption" color="text.secondary">
                        {brandAiCopy(
                          `${Math.round(item.progress || 0)}% - ${
                            EXTENDED_PREVIEW_STEP_LABELS[item.step] || item.step || "Đang xử lý"
                          }: ${item.message}`
                        )}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}

              {previewSummary ? (
                <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                  <Chip color="success" label={`Có thể nhập: ${previewSummary.readyRows}`} />
                  <Chip color="warning" label={`Cần xem lại: ${previewSummary.reviewRows}`} />
                  <Chip label={`Bỏ qua: ${previewSummary.skippedRows}`} />
                  <Chip label={`Cụm hồ sơ: ${previewSummary.candidateGroups || rows.length}`} />
                  <Chip label={`Đã khớp sẵn: ${previewSummary.matchedPlayers}`} />
                  <Chip label={`VĐV cần tạo tài khoản: ${previewSummary.tempPlayers}`} />
                  <Chip
                    icon={<CloudUploadIcon />}
                    label={
                      previewSummary.truncated
                        ? `Nguồn: ${previewSummary.sourceRows} dòng, đang hiển thị ${rows.length} dòng`
                        : `Nguồn: ${previewSummary.sourceRows} dòng`
                    }
                  />
                </Stack>
              ) : null}

              {previewAnalysis ? (
                <Alert
                  severity={previewAnalysis.confidence >= 0.65 ? "info" : "warning"}
                  sx={{ mt: 2 }}
                >
                  AI đang hiểu file này là dạng{" "}
                  <strong>{LAYOUT_LABELS[previewAnalysis.layoutType] || "Chưa rõ"}</strong>, cách
                  ghi đăng ký là{" "}
                  <strong>
                    {REGISTRATION_STYLE_LABELS[previewAnalysis.registrationStyle] || "Chưa rõ"}
                  </strong>
                  . {brandAiCopy(previewAnalysis.notes)}
                  {usingCatgptGateway ? (
                    <Typography component="div" variant="caption" sx={{ mt: 1, fontWeight: 700 }}>
                      Đang đọc file qua Pikora.
                    </Typography>
                  ) : null}
                </Alert>
              ) : null}

              {previewAiDiagnostics?.hasErrors || previewAiDiagnostics?.hasWarnings ? (
                <Alert
                  severity={previewAiDiagnostics?.hasErrors ? "error" : "warning"}
                  sx={{ mt: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="body2" fontWeight={700}>
                      {previewAiDiagnostics?.hasErrors ? "Lỗi kết nối AI" : "Cảnh báo cấu hình AI"}
                    </Typography>
                    <Typography variant="body2">
                      {brandAiCopy(previewAiDiagnostics.summary)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Provider: {usingCatgptGateway ? "Pikora" : "Legacy AI"}
                      {previewAiDiagnostics.environment?.configuredBaseUrl
                        ? ` | Endpoint: ${previewAiDiagnostics.environment.configuredBaseUrl}`
                        : ""}
                      {previewAiDiagnostics?.fileType
                        ? ` | File: ${previewAiDiagnostics.fileType}`
                        : ""}
                      {previewAiDiagnostics?.responseMode
                        ? ` | Kết quả: ${previewAiDiagnostics.responseMode}`
                        : ""}
                      {previewAiDiagnostics?.artifactSource
                        ? ` | Artifact: ${previewAiDiagnostics.artifactSource}`
                        : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Model hiện tại: {previewAiDiagnostics.environment?.configuredModel || "-"}
                      {previewAiDiagnostics.environment?.configuredBaseUrl
                        ? ` | Proxy: ${previewAiDiagnostics.environment.configuredBaseUrl}`
                        : " | Proxy: không dùng"}
                      {previewAiDiagnostics.environment?.directFallbackEnabled
                        ? ` | Fallback trực tiếp: ${previewAiDiagnostics.environment.directFallbackModel}`
                        : " | Fallback trực tiếp: không có"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Completion: {previewAiDiagnostics?.completionId || "-"}
                      {typeof previewAiDiagnostics?.artifactManifestAvailable === "boolean"
                        ? ` | Có manifest: ${
                            previewAiDiagnostics.artifactManifestAvailable ? "có" : "không"
                          }`
                        : ""}
                      {previewAiDiagnostics?.availableModels?.length
                        ? ` | Models: ${previewAiDiagnostics.availableModels.join(", ")}`
                        : ""}
                    </Typography>
                    {previewAiDiagnostics?.environment?.gatewayStatusUrl ? (
                      <Typography variant="caption" color="text.secondary">
                        Trạng thái Pikora:{" "}
                        {previewAiDiagnostics.environment.gatewayReachable === false
                          ? "không kết nối được"
                          : previewAiDiagnostics.environment.gatewayLoggedIn === false
                          ? "chưa đăng nhập Pikora"
                          : previewAiDiagnostics.environment.gatewayHealthy === false
                          ? "đang không ổn định"
                          : previewAiDiagnostics.environment.gatewayStatusChecked
                          ? "đang phản hồi"
                          : "chưa kiểm tra"}
                        {` | ${previewAiDiagnostics.environment.gatewayStatusUrl}`}
                        {previewAiDiagnostics.environment.gatewayStatusSummary
                          ? ` | ${brandAiCopy(
                              previewAiDiagnostics.environment.gatewayStatusSummary
                            )}`
                          : ""}
                      </Typography>
                    ) : null}
                    {(previewAiDiagnostics.stages || [])
                      .filter((stage) =>
                        previewAiDiagnostics?.hasErrors ? !stage.ok : stage.attempts?.length > 0
                      )
                      .slice(0, 4)
                      .map((stage) => (
                        <Typography key={stage.stage} variant="caption" color="text.secondary">
                          {formatAiStageMessage(stage)}
                        </Typography>
                      ))}
                  </Stack>
                </Alert>
              ) : null}

              <Divider sx={{ my: 2 }} />

              {!previewData ? (
                <Alert severity="info">
                  Chưa có dữ liệu xem trước. Chọn giải rồi bấm Xem trước danh sách.
                </Alert>
              ) : (
                <Box sx={{ height: 620, width: "100%" }}>
                  <DataGrid
                    rows={gridRows}
                    columns={previewColumns}
                    checkboxSelection
                    disableRowSelectionOnClick
                    columnHeaderHeight={64}
                    getRowHeight={() => "auto"}
                    getEstimatedRowHeight={() => 112}
                    isRowSelectable={(params) => params.row.status === "ready"}
                    selectionModel={selectionModel}
                    onSelectionModelChange={(value) => setSelectionModel(value)}
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{
                      pagination: { paginationModel: { page: 0, pageSize: 25 } },
                    }}
                    sx={{
                      "& .MuiDataGrid-columnHeaderTitle": {
                        whiteSpace: "normal",
                        lineHeight: 1.25,
                      },
                      "& .MuiDataGrid-columnHeader": {
                        py: 1,
                      },
                      "& .MuiDataGrid-row": {
                        maxHeight: "none !important",
                      },
                      "& .MuiDataGrid-cell": {
                        alignItems: "flex-start",
                        py: 0.5,
                      },
                      "& .MuiDataGrid-cellContent": {
                        whiteSpace: "normal",
                        lineHeight: 1.35,
                      },
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {commitResult ? (
            <Card variant="outlined" ref={resultSectionRef}>
              <CardHeader title="Kết quả lưu" />
              <CardContent>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  mb={2}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      color="success"
                      label={`Đội/cặp đăng ký: ${commitResult.createdRegistrations}`}
                    />
                    <Chip
                      color="primary"
                      label={`Tài khoản VĐV tạo mới: ${commitResult.createdUsers}`}
                    />
                    <Chip label={`Đã xử lý: ${(commitResult.results || []).length} dòng`} />
                  </Stack>
                  {credentials.length ? (
                    <Button
                      variant="contained"
                      startIcon={<FileDownloadIcon />}
                      endIcon={<ArrowDropDownIcon />}
                      onClick={handleOpenUserExportMenu}
                    >
                      Xuất thông tin user vừa tạo
                    </Button>
                  ) : null}
                </Stack>

                <Alert severity="info" sx={{ mb: 2 }}>
                  Mỗi dòng đăng ký hợp lệ tạo ra 1 đội/cặp đăng ký. Nếu là nội dung đôi thì 1 dòng
                  có thể phát sinh 2 tài khoản VĐV mới, nên số tài khoản thường lớn hơn số đội/cặp.
                </Alert>

                {!credentials.length ? (
                  <Alert severity="info">Đã lưu xong, không phát sinh tài khoản VĐV mới.</Alert>
                ) : (
                  <Stack spacing={2}>
                    <Menu
                      anchorEl={userExportAnchorEl}
                      open={Boolean(userExportAnchorEl)}
                      onClose={handleCloseUserExportMenu}
                    >
                      <MenuItem onClick={() => handleExportCreatedUsers("excel")}>
                        Xuất Excel
                      </MenuItem>
                      <MenuItem onClick={() => handleExportCreatedUsers("csv")}>Xuất CSV</MenuItem>
                      <MenuItem onClick={() => handleExportCreatedUsers("json")}>
                        Xuất JSON
                      </MenuItem>
                    </Menu>

                    <Box sx={{ height: 360, width: "100%" }}>
                      <DataGrid
                        rows={credentialExportModel.rows.map((row, index) => ({
                          id: `${row.userId || row.rowId || "user"}-${index}`,
                          ...row,
                        }))}
                        columns={credentialColumns}
                        disableRowSelectionOnClick
                        pageSizeOptions={[10, 25, 50]}
                        initialState={{
                          pagination: { paginationModel: { page: 0, pageSize: 10 } },
                        }}
                      />
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Box>

      <Dialog
        open={paymentDialogOpen}
        onClose={() => {
          if (!committing) setPaymentDialogOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Xác nhận thanh toán cho đội/cặp đăng ký</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Tick các đội/cặp đã xác nhận thanh toán. Mỗi dòng trong danh sách này tương ứng với 1
              đội/cặp đăng ký. Dòng được chọn sẽ lưu là đã thanh toán, dòng còn lại sẽ lưu là chưa
              thanh toán.
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={allReadyPaid}
                  indeterminate={partiallyPaid}
                  onChange={(event) => handleToggleAllPaidRows(event.target.checked)}
                />
              }
              label={`Tất cả ${readyRows.length} đội/cặp`}
            />

            <Stack spacing={1} sx={{ maxHeight: 420, overflowY: "auto", pr: 1 }}>
              {readyRows.map((row) => (
                <Box
                  key={row.rowId}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <FormControlLabel
                    sx={{ m: 0, alignItems: "flex-start", width: "100%" }}
                    control={
                      <Checkbox
                        checked={paidRowIdSet.has(row.rowId)}
                        onChange={() => handleTogglePaidRow(row.rowId)}
                        sx={{ mt: 0.25 }}
                      />
                    }
                    label={
                      <Stack spacing={0.25} sx={{ py: 0.25 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {`Dòng ${row.sourceRowNumber}: ${row.primary?.fullName || "-"}${
                            tournament?.eventType === "single"
                              ? ""
                              : ` • ${row.secondary?.fullName || "-"}`
                          }`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Trạng thái thanh toán hiện tại: {row.paymentStatus || "Chưa rõ"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {paidRowIdSet.has(row.rowId)
                            ? "Đội/cặp này sẽ được lưu là đã thanh toán"
                            : "Đội/cặp này sẽ được lưu là chưa thanh toán"}
                        </Typography>
                      </Stack>
                    }
                  />
                </Box>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={committing} onClick={() => setPaymentDialogOpen(false)}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={committing ? <CircularProgress size={16} /> : <DoneAllIcon />}
            disabled={!readyRows.length || committing}
            onClick={handleConfirmCommitAllReady}
          >
            {committing
              ? "Đang tạo đăng ký..."
              : `Xác nhận tạo ${readyRows.length} đội/cặp đăng ký`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={quickJsonDialogOpen}
        onClose={() => {
          if (!quickImporting) setQuickJsonDialogOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Xác nhận thanh toán cho JSON đội đôi</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              File JSON này sẽ được nhập theo kiểu 1 object = 1 đội/cặp. Tick các đội/cặp đã thanh
              toán trước khi tạo user và đăng ký giải.
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={allQuickJsonPaid}
                  indeterminate={partiallyQuickJsonPaid}
                  onChange={(event) => handleToggleAllQuickJsonPaidRows(event.target.checked)}
                />
              }
              label={`Tất cả ${quickJsonTeams.length} đội/cặp`}
            />

            <Stack spacing={1} sx={{ maxHeight: 420, overflowY: "auto", pr: 1 }}>
              {quickJsonTeams.map((row) => (
                <Box
                  key={row.rowId}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <FormControlLabel
                    sx={{ m: 0, alignItems: "flex-start", width: "100%" }}
                    control={
                      <Checkbox
                        checked={quickJsonPaidRowIdSet.has(row.rowId)}
                        onChange={() => handleToggleQuickJsonPaidRow(row.rowId)}
                        sx={{ mt: 0.25 }}
                      />
                    }
                    label={
                      <Stack spacing={0.25} sx={{ py: 0.25 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {`Dòng ${row.rowNumber}: ${row.fullName1 || "-"} • ${
                            row.fullName2 || "-"
                          }`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {quickJsonPaidRowIdSet.has(row.rowId)
                            ? "Đội/cặp này sẽ được lưu là đã thanh toán"
                            : "Đội/cặp này sẽ được lưu là chưa thanh toán"}
                        </Typography>
                      </Stack>
                    }
                  />
                </Box>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={quickImporting} onClick={() => setQuickJsonDialogOpen(false)}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={quickImporting ? <CircularProgress size={16} /> : <DoneAllIcon />}
            disabled={!quickJsonTeams.length || quickImporting}
            onClick={handleConfirmQuickJsonImport}
          >
            {quickImporting
              ? "Đang nhập nhanh JSON..."
              : `Xác nhận tạo ${quickJsonTeams.length} đội/cặp từ JSON`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snack.type} variant="filled">
          {brandAiCopy(snack.msg)}
        </Alert>
      </Snackbar>
      <Footer />
    </DashboardLayout>
  );
}
