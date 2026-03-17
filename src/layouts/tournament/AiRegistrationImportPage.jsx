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
  Divider,
  Grid,
  LinearProgress,
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
import { DataGrid } from "@mui/x-data-grid";
import { skipToken } from "@reduxjs/toolkit/query";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import {
  useCommitAiRegistrationImportMutation,
  useGetTournamentQuery,
  useListTournamentsQuery,
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
  connected: "Da ket noi",
  init: "Dang tai thong tin giai",
  source_loading: "Dang lay du lieu nguon",
  source_parsed: "Da doc xong du lieu nguon",
  document_analysis: "Dang hieu bo cuc file",
  row_grouping: "Dang gom ho so dang ky",
  row_extraction: "Dang tach tung ho so",
  preview_building: "Dang lap bang xem truoc",
  complete: "Da xong xem truoc",
  error: "Co loi khi xem truoc",
};

const API_BASE_URL = String(process.env.REACT_APP_API_URL || "/api").replace(/\/$/, "");

function toCredentialsCsv(rows) {
  if (!rows?.length) return "";
  const cols = ["rowNumber", "name", "nickname", "phone", "email", "password", "userId"];
  const esc = (value) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((row) => cols.map((col) => esc(row[col])).join(","))].join(
    "\n"
  );
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function buildPreviewRequestHeaders(token) {
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };

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
    return data?.message || `Khong the xem truoc (${response.status})`;
  }

  const text = await response.text().catch(() => "");
  return text || `Khong the xem truoc (${response.status})`;
}

async function readSseStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Trinh duyet khong doc duoc stream tu server");
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
  const response = await fetch(
    buildApiUrl(`/admin/tournaments/${tourId}/registrations/ai-import/preview-stream`),
    {
      method: "POST",
      credentials: "include",
      headers: buildPreviewRequestHeaders(token),
      body: JSON.stringify(body),
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
    <Stack spacing={0.25}>
      <Typography variant="body2" fontWeight={700}>
        {player.fullName || "-"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {player.sourcePhone || player.matchedUser?.phone || player.tempDraft?.phone || "-"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {player.action === "match_existing"
          ? `${label}: đã khớp theo ${player.matchedBy}`
          : player.action === "create_temp"
          ? `${label}: sẽ tạo tài khoản @pickletour.vn`
          : `${label}: thiếu dữ liệu`}
      </Typography>
    </Stack>
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
      phone: PropTypes.string,
    }),
  }),
};

PlayerCell.defaultProps = {
  player: null,
};

export default function AiRegistrationImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get("t") || "";
  const authToken = useSelector((state) => state.auth.userInfo?.token || "");

  const [status, setStatus] = useState("all");
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showTournamentPicker, setShowTournamentPicker] = useState(!initialId);
  const [inputMode, setInputMode] = useState("sheet");
  const [sheetUrl, setSheetUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [previewData, setPreviewData] = useState(null);
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

  const gridRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.rowId,
        ...row,
      })),
    [rows]
  );

  const canPreview = Boolean(
    tournamentId && (inputMode === "sheet" ? sheetUrl.trim() : rawText.trim())
  );
  const canCommit = Boolean(tournamentId && selectedRows.length > 0 && !committing);

  const previewSummary = previewData?.summary;
  const previewAnalysis = previewData?.analysis;
  const previewAiDiagnostics = previewData?.aiDiagnostics;
  const credentials = commitResult?.credentials || [];

  const pushPreviewProgress = (payload = {}) => {
    const next = {
      step: payload.step || "working",
      progress: Math.max(0, Math.min(100, Number(payload.progress) || 0)),
      message: payload.message || "He thong dang xu ly du lieu...",
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

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewProgress({
      active: true,
      progress: 1,
      step: "init",
      message: "Dang bat dau xem truoc danh sach.",
      logs: [],
    });

    try {
      const body =
        inputMode === "sheet" ? { sheetUrl: sheetUrl.trim() } : { rawText: rawText.trim() };
      let streamedResult = null;
      let streamedError = "";
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
            streamedError = payload?.message || "Khong doc duoc du lieu de xem truoc";
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
        throw new Error(streamedError);
      }
      if (!finalResult) {
        throw new Error("Khong nhan duoc ket qua xem truoc tu server");
      }

      pushPreviewProgress({
        step: "complete",
        progress: 100,
        message: "Da xong phan xem truoc danh sach.",
      });
      setPreviewData(finalResult);
      setCommitResult(null);
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
          "Khong doc duoc du lieu de xem truoc",
      });
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

  const handleCommit = async () => {
    try {
      const res = await commitImport({
        tourId: tournamentId,
        body: { rows: selectedRows },
      }).unwrap();
      setCommitResult(res);
      setSnack({
        open: true,
        type: "success",
        msg: `Đã tạo ${res.createdRegistrations} lượt đăng ký và ${res.createdUsers} tài khoản tạm`,
      });
    } catch (error) {
      setSnack({
        open: true,
        type: "error",
        msg: error?.data?.message || error?.error || "Không thể lưu danh sách này",
      });
    }
  };

  const previewColumns = useMemo(
    () => [
      {
        field: "sourceRowNumber",
        headerName: "Dòng",
        width: 110,
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 140,
        renderCell: ({ value }) => {
          const meta = STATUS_META[value] || STATUS_META.skip;
          return <Chip size="small" color={meta.color} label={meta.label} />;
        },
      },
      {
        field: "confidence",
        headerName: "Tin cậy",
        width: 100,
        valueFormatter: ({ value }) => `${Math.round((Number(value) || 0) * 100)}%`,
      },
      {
        field: "primary",
        headerName: "VĐV 1",
        flex: 1.1,
        minWidth: 210,
        sortable: false,
        renderCell: ({ row }) => <PlayerCell label="VĐV 1" player={row.primary} />,
      },
      {
        field: "secondary",
        headerName: "VĐV 2",
        flex: 1.1,
        minWidth: 210,
        sortable: false,
        renderCell: ({ row }) =>
          tournament?.eventType === "single" ? (
            <Typography variant="caption">Nội dung đơn</Typography>
          ) : (
            <PlayerCell label="VĐV 2" player={row.secondary} />
          ),
      },
      {
        field: "paymentStatus",
        headerName: "Thanh toán",
        width: 110,
      },
      {
        field: "actionSummary",
        headerName: "Xử lý",
        minWidth: 210,
        flex: 0.8,
      },
      {
        field: "issues",
        headerName: "Lưu ý",
        minWidth: 260,
        flex: 1.4,
        sortable: false,
        valueGetter: ({ row }) => (row.issues || []).join(" | "),
      },
      {
        field: "sourcePreview",
        headerName: "Dữ liệu gốc",
        minWidth: 280,
        flex: 1.6,
      },
    ],
    [tournament?.eventType]
  );

  const credentialColumns = useMemo(
    () => [
      { field: "rowNumber", headerName: "Dòng", width: 80 },
      { field: "name", headerName: "Họ tên", minWidth: 180, flex: 1 },
      { field: "nickname", headerName: "Tên hiển thị", minWidth: 160, flex: 0.8 },
      { field: "phone", headerName: "Số điện thoại", minWidth: 140, flex: 0.7 },
      { field: "email", headerName: "Email", minWidth: 220, flex: 1 },
      { field: "password", headerName: "Mật khẩu", minWidth: 180, flex: 0.8 },
      { field: "userId", headerName: "Mã tài khoản", minWidth: 220, flex: 1 },
    ],
    []
  );

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
              Chọn giải rồi dán danh sách đăng ký hoặc nhập link Google Sheet. Hệ thống sẽ đọc trước
              để bạn kiểm tra, sau đó mới lưu chính thức.
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
                    <MenuItem value="paste">Dán trực tiếp</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Link Google Sheet"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </Grid>
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
                <Grid item xs={12}>
                  <Alert severity="info">
                    Nếu dùng link, bảng cần mở public hoặc cho phép tải CSV. Nếu chưa chắc, bạn cứ
                    copy dữ liệu rồi dán trực tiếp cho ổn định hơn.
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Xem trước" />
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={previewing ? <CircularProgress size={16} /> : <VisibilityIcon />}
                  disabled={!canPreview || previewing}
                  onClick={handlePreview}
                >
                  {previewing ? "Đang đọc dữ liệu..." : "Xem trước danh sách"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={committing ? <CircularProgress size={16} /> : <DoneAllIcon />}
                  disabled={!canCommit}
                  onClick={handleCommit}
                >
                  {committing ? "Đang lưu..." : `Lưu ${selectedRows.length} dòng có thể nhập`}
                </Button>
                {credentials.length ? (
                  <Button
                    variant="text"
                    startIcon={<FileDownloadIcon />}
                    onClick={() => downloadCsv("tai-khoan-tam.csv", toCredentialsCsv(credentials))}
                  >
                    Tải danh sách tài khoản tạm
                  </Button>
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
                        {PREVIEW_STEP_LABELS[previewProgress.step] || "Dang xu ly xem truoc"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Math.round(previewProgress.progress || 0)}%
                      </Typography>
                    </Stack>

                    <Typography variant="body2">
                      {previewProgress.message || "He thong dang xu ly du lieu..."}
                    </Typography>

                    <LinearProgress
                      variant={previewProgress.progress > 0 ? "determinate" : "indeterminate"}
                      value={Math.max(0, Math.min(100, previewProgress.progress || 0))}
                    />

                    {(previewProgress.logs || []).slice(-5).map((item) => (
                      <Typography key={item.id} variant="caption" color="text.secondary">
                        {`${Math.round(item.progress || 0)}% - ${
                          PREVIEW_STEP_LABELS[item.step] || item.step || "Dang xu ly"
                        }: ${item.message}`}
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
                  <Chip label={`Tài khoản tạm: ${previewSummary.tempPlayers}`} />
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
                  . {previewAnalysis.notes}
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
                    <Typography variant="body2">{previewAiDiagnostics.summary}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Model hiện tại: {previewAiDiagnostics.environment?.configuredModel || "-"}
                      {previewAiDiagnostics.environment?.configuredBaseUrl
                        ? ` | Proxy: ${previewAiDiagnostics.environment.configuredBaseUrl}`
                        : " | Proxy: không dùng"}
                      {previewAiDiagnostics.environment?.directFallbackEnabled
                        ? ` | Fallback trực tiếp: ${previewAiDiagnostics.environment.directFallbackModel}`
                        : " | Fallback trực tiếp: không có"}
                    </Typography>
                    {(previewAiDiagnostics.stages || [])
                      .filter((stage) =>
                        previewAiDiagnostics?.hasErrors ? !stage.ok : stage.attempts?.length > 0
                      )
                      .slice(0, 4)
                      .map((stage) => (
                        <Typography key={stage.stage} variant="caption" color="text.secondary">
                          {(AI_STAGE_LABELS[stage.stage] || stage.stage).replace(/_/g, " ")}:{" "}
                          {stage.message || "Lỗi"}
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
                <Box sx={{ height: 520, width: "100%" }}>
                  <DataGrid
                    rows={gridRows}
                    columns={previewColumns}
                    checkboxSelection
                    disableRowSelectionOnClick
                    isRowSelectable={(params) => params.row.status === "ready"}
                    selectionModel={selectionModel}
                    onSelectionModelChange={(value) => setSelectionModel(value)}
                    pageSizeOptions={[10, 25, 50, 100]}
                    initialState={{
                      pagination: { paginationModel: { page: 0, pageSize: 25 } },
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {commitResult ? (
            <Card variant="outlined">
              <CardHeader title="Kết quả lưu" />
              <CardContent>
                <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                  <Chip color="success" label={`Đăng ký: ${commitResult.createdRegistrations}`} />
                  <Chip color="primary" label={`Tài khoản tạm: ${commitResult.createdUsers}`} />
                  <Chip label={`Đã xử lý: ${(commitResult.results || []).length} dòng`} />
                </Stack>

                {!credentials.length ? (
                  <Alert severity="info">Đã lưu xong, không phát sinh tài khoản tạm mới.</Alert>
                ) : (
                  <Box sx={{ height: 360, width: "100%" }}>
                    <DataGrid
                      rows={credentials.map((row, index) => ({
                        id: `${row.userId}-${index}`,
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
                )}
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
      <Footer />
    </DashboardLayout>
  );
}
