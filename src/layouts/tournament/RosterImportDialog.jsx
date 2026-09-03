/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import * as XLSX from "xlsx";
import { useImportRosterMutation } from "slices/tournamentsApiSlice";

const NONE = "-1";

function guessCol(headers, keywords) {
  for (let i = 0; i < headers.length; i += 1) {
    const h = String(headers[i] || "").toLowerCase();
    if (keywords.some((k) => h.includes(k))) return String(i);
  }
  return NONE;
}

// Đoán cột: name (theo thứ tự xuất hiện), phone, score
function autoMap(headers, singles) {
  const nameCols = [];
  headers.forEach((h, i) => {
    const s = String(h || "").toLowerCase();
    if (s.includes("tên") || s.includes("name") || s.includes("họ")) nameCols.push(String(i));
  });
  const phoneCols = [];
  headers.forEach((h, i) => {
    const s = String(h || "").toLowerCase();
    if (s.includes("sđt") || s.includes("sdt") || s.includes("phone") || s.includes("điện thoại"))
      phoneCols.push(String(i));
  });
  const scoreCols = [];
  headers.forEach((h, i) => {
    const s = String(h || "").toLowerCase();
    if (s.includes("điểm") || s.includes("trình") || s.includes("score")) scoreCols.push(String(i));
  });
  return {
    p1Name: nameCols[0] ?? guessCol(headers, ["tên", "name"]),
    p1Phone: phoneCols[0] ?? NONE,
    p1Score: scoreCols[0] ?? NONE,
    p2Name: singles ? NONE : nameCols[1] ?? NONE,
    p2Phone: singles ? NONE : phoneCols[1] ?? NONE,
    p2Score: singles ? NONE : scoreCols[1] ?? NONE,
  };
}

const cellAt = (row, colStr) => {
  const c = Number(colStr);
  if (!Number.isInteger(c) || c < 0) return "";
  const v = row[c];
  return v === undefined || v === null ? "" : String(v).trim();
};

export default function RosterImportDialog({ open, onClose, tournamentId, eventType, onDone }) {
  const singles = String(eventType || "").toLowerCase().startsWith("single");
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]); // array of arrays (raw)
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState(null);
  const [markInternal, setMarkInternal] = useState(true);
  const [preview, setPreview] = useState(null);
  const [parseErr, setParseErr] = useState("");

  const [importRoster, { isLoading }] = useImportRosterMutation();
  const [result, setResult] = useState(null);

  const headers = rows[0] || [];
  const maxCols = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.length), 0),
    [rows]
  );
  const colOptions = useMemo(() => {
    const opts = [{ v: NONE, label: "— (bỏ qua)" }];
    for (let i = 0; i < maxCols; i += 1) {
      const label = hasHeader ? String(headers[i] || `Cột ${i + 1}`) : `Cột ${i + 1}`;
      opts.push({ v: String(i), label: `${i + 1}. ${label}` });
    }
    return opts;
  }, [maxCols, headers, hasHeader]);

  const reset = () => {
    setRows([]);
    setFileName("");
    setMap(null);
    setPreview(null);
    setResult(null);
    setParseErr("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e) => {
    setParseErr("");
    setPreview(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
      const clean = aoa.filter((r) => r.some((c) => String(c).trim() !== ""));
      if (!clean.length) {
        setParseErr("File rỗng hoặc không đọc được.");
        return;
      }
      setRows(clean);
      setMap(autoMap(clean[0] || [], singles));
    } catch (err) {
      setParseErr(`Không đọc được file: ${err?.message || err}`);
    }
  };

  const buildPairs = () => {
    const body = hasHeader ? rows.slice(1) : rows;
    return body
      .map((r) => ({
        p1: {
          name: cellAt(r, map.p1Name),
          phone: cellAt(r, map.p1Phone),
          score: cellAt(r, map.p1Score),
        },
        p2: singles
          ? { name: "", phone: "", score: "" }
          : {
              name: cellAt(r, map.p2Name),
              phone: cellAt(r, map.p2Phone),
              score: cellAt(r, map.p2Score),
            },
      }))
      .filter((p) => p.p1.name || p.p2.name);
  };

  const runDry = async () => {
    setResult(null);
    try {
      const pairs = buildPairs();
      const res = await importRoster({ tourId: tournamentId, pairs, dryRun: true, markInternal }).unwrap();
      setPreview(res.summary);
    } catch (err) {
      setParseErr(err?.data?.message || err?.error || "Lỗi kiểm tra dữ liệu");
    }
  };

  const runImport = async () => {
    try {
      const pairs = buildPairs();
      const res = await importRoster({ tourId: tournamentId, pairs, dryRun: false, markInternal }).unwrap();
      setResult(res.summary);
      onDone?.(res.summary);
    } catch (err) {
      setParseErr(err?.data?.message || err?.error || "Lỗi import");
    }
  };

  const downloadTemplate = () => {
    const header = singles
      ? ["Họ tên VĐV", "SĐT", "Điểm trình"]
      : ["Họ tên VĐV 1", "SĐT VĐV 1", "Điểm trình 1", "Họ tên VĐV 2", "SĐT VĐV 2", "Điểm trình 2"];
    const sample = singles
      ? ["Nguyễn Văn A", "0901234567", "3.5"]
      : ["Nguyễn Văn A", "0901234567", "3.5", "Trần Thị B", "", "3.0"];
    const ws = XLSX.utils.aoa_to_sheet([header, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
    XLSX.writeFile(wb, "mau-danh-sach-vdv.xlsx");
  };

  const MapSelect = ({ label, field }) => (
    <TextField
      select
      size="small"
      label={label}
      value={map?.[field] ?? NONE}
      onChange={(e) => setMap((m) => ({ ...m, [field]: e.target.value }))}
      sx={{ minWidth: 200 }}
    >
      {colOptions.map((o) => (
        <MenuItem key={o.v} value={o.v}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );

  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const previewRows = bodyRows.slice(0, 5);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import danh sách VĐV (Excel/CSV)</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Dành cho giải nội bộ/công đoàn: VĐV chưa có tài khoản sẽ được tạo tài khoản “khách”.
          VĐV có SĐT sẽ được ghép với tài khoản đã có (nếu trùng). Khi bật “giải nội bộ”, kết quả
          sẽ <b>không cộng điểm vào BXH</b>.
        </Alert>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button variant="outlined" component="label">
            Chọn file Excel/CSV
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
            />
          </Button>
          <Button variant="text" onClick={downloadTemplate}>
            Tải file mẫu
          </Button>
          {fileName ? <Chip label={fileName} onDelete={reset} /> : null}
        </Stack>

        {parseErr ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {parseErr}
          </Alert>
        ) : null}

        {rows.length > 0 && map ? (
          <>
            <FormControlLabel
              control={
                <Checkbox checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              }
              label="Dòng đầu tiên là tiêu đề (bỏ qua khi import)"
            />

            <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
              Ghép cột dữ liệu {singles ? "(giải đơn)" : "(giải đôi)"}
            </Typography>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <MapSelect label="VĐV 1 · Họ tên *" field="p1Name" />
                <MapSelect label="VĐV 1 · SĐT" field="p1Phone" />
                <MapSelect label="VĐV 1 · Điểm trình" field="p1Score" />
              </Stack>
              {!singles ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <MapSelect label="VĐV 2 · Họ tên *" field="p2Name" />
                  <MapSelect label="VĐV 2 · SĐT" field="p2Phone" />
                  <MapSelect label="VĐV 2 · Điểm trình" field="p2Score" />
                </Stack>
              ) : null}
            </Stack>

            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Checkbox checked={markInternal} onChange={(e) => setMarkInternal(e.target.checked)} />
              }
              label="Giải nội bộ — không cộng điểm vào BXH (khuyến nghị)"
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Xem trước {bodyRows.length} dòng (hiển thị 5 dòng đầu)
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>VĐV 1</TableCell>
                    <TableCell>SĐT 1</TableCell>
                    <TableCell>Điểm 1</TableCell>
                    {!singles ? <TableCell>VĐV 2</TableCell> : null}
                    {!singles ? <TableCell>SĐT 2</TableCell> : null}
                    {!singles ? <TableCell>Điểm 2</TableCell> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{cellAt(r, map.p1Name)}</TableCell>
                      <TableCell>{cellAt(r, map.p1Phone)}</TableCell>
                      <TableCell>{cellAt(r, map.p1Score)}</TableCell>
                      {!singles ? <TableCell>{cellAt(r, map.p2Name)}</TableCell> : null}
                      {!singles ? <TableCell>{cellAt(r, map.p2Phone)}</TableCell> : null}
                      {!singles ? <TableCell>{cellAt(r, map.p2Score)}</TableCell> : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            {preview ? (
              <Alert severity={preview.invalidPairs > 0 ? "warning" : "success"} sx={{ mt: 2 }}>
                <div>
                  Hợp lệ: <b>{preview.validPairs}</b> cặp · Lỗi: <b>{preview.invalidPairs}</b> · Sẽ
                  tạo mới <b>{preview.guestsToCreate}</b> tài khoản khách · Ghép tài khoản có sẵn:{" "}
                  <b>{preview.reusedAccounts}</b>
                </div>
                {preview.errors?.length ? (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {preview.errors.slice(0, 8).map((er) => (
                      <div key={er.row}>· Dòng {er.row}: {er.reason}</div>
                    ))}
                    {preview.errors.length > 8 ? <div>… và {preview.errors.length - 8} lỗi khác</div> : null}
                  </div>
                ) : null}
              </Alert>
            ) : null}

            {result ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                Đã import: <b>{result.registrationsCreated}</b> đăng ký · tạo{" "}
                <b>{result.guestsCreated}</b> tài khoản khách
                {result.skipped?.length ? ` · bỏ qua ${result.skipped.length}` : ""}.
              </Alert>
            ) : null}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        {rows.length > 0 && !result ? (
          <Button onClick={runDry} disabled={isLoading || !map?.p1Name || map.p1Name === NONE}>
            Kiểm tra
          </Button>
        ) : null}
        {rows.length > 0 && !result ? (
          <Button
            variant="contained"
            onClick={runImport}
            disabled={isLoading || !preview || preview.validPairs === 0}
          >
            {isLoading ? "Đang import…" : `Import ${preview?.validPairs || ""} cặp`}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
