/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Grid,
  Card,
  Button,
  TextField,
  Chip,
  Stack,
  Box,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import { useBackfillCccdMutation, useFillCccdForUserMutation } from "slices/adminApiSlice";

const MISSING_FIELD_LABEL = {
  name: "Thiếu họ tên",
  nickname: "Thiếu nickname",
  dob: "Thiếu ngày sinh",
  gender: "Thiếu giới tính",
  province: "Thiếu tỉnh/thành",
  cccd: "Thiếu số CCCD",
};

export default function CccdAiBackfillCard({ showSnack, onRefetch }) {
  const [backfillLimit, setBackfillLimit] = useState(10);
  const [backfillDryRun, setBackfillDryRun] = useState(true);
  const [backfillResult, setBackfillResult] = useState(null);

  const [backfillCccdMut, { isLoading: runningBackfill }] = useBackfillCccdMutation();
  const [fillCccdForUserMut] = useFillCccdForUserMutation();

  const [scanningUserId, setScanningUserId] = useState(null);
  const [fillingUserId, setFillingUserId] = useState(null);
  const [overwritingUserId, setOverwritingUserId] = useState(null);
  const [autoScanningAll, setAutoScanningAll] = useState(false);

  const handle = async (promise, successMsg) => {
    try {
      const res = await promise;
      if (successMsg) {
        showSnack?.("success", successMsg);
      }
      // ❌ KHÔNG gọi lại API user list page nữa
      // if (onRefetch) await onRefetch();
      return res;
    } catch (err) {
      showSnack?.("error", err?.data?.message || err.error || "Đã xảy ra lỗi");
      throw err;
    }
  };

  // helper: loại 1 user khỏi list xem trước (backfillResult.users)
  const removeUserFromPreview = (userId) => {
    setBackfillResult((prev) => {
      if (!prev || !Array.isArray(prev.users)) return prev;
      const newUsers = prev.users.filter((u) => u.id !== userId);
      return {
        ...prev,
        users: newUsers,
        totalCandidates:
          typeof prev.totalCandidates === "number"
            ? Math.max(0, prev.totalCandidates - 1)
            : prev.totalCandidates,
      };
    });
  };

  // chạy backfill CCCD bằng AI (toàn batch)
  const runBackfill = async () => {
    const limit = Math.min(Math.max(Number(backfillLimit) || 10, 1), 50);
    try {
      const res = await handle(
        backfillCccdMut({
          limit,
          dryRun: backfillDryRun,
        }).unwrap(),
        backfillDryRun ? "Đã chạy dry-run backfill CCCD" : "Đã chạy backfill CCCD"
      );
      setBackfillResult(res);
    } catch (err) {
      setBackfillResult(null);
    }
  };

  // Quét AI (dry-run) cho từng user trong danh sách xem trước
  const scanCccdForUser = async (u) => {
    if (!u.hasFront && !u.hasBack) {
      showSnack?.("error", "User này chưa có ảnh CCCD để đọc AI");
      return;
    }
    setScanningUserId(u.id);
    try {
      const res = await fillCccdForUserMut({
        id: u.id,
        dryRun: true,
      }).unwrap();

      const ex = res?.extracted || {};
      const summary =
        `Họ tên (CCCD): ${ex.name || "?"} — ` +
        `Nickname gợi ý: ${ex.nickname || "?"} — ` +
        `CCCD: ${ex.cccd || "?"} — ` +
        `DOB: ${ex.dob || "?"} — ` +
        `Giới tính: ${ex.gender || "?"} — ` +
        `Tỉnh: ${ex.province || "?"}`;

      showSnack?.("info", summary);

      // 👉 Sau khi quét thành công, loại user đó khỏi danh sách xem trước
      removeUserFromPreview(u.id);
    } catch (err) {
      showSnack?.(
        "error",
        err?.data?.message || err.error || "Đã xảy ra lỗi khi quét CCCD bằng AI"
      );
    } finally {
      setScanningUserId(null);
    }
  };

  // Tự động quét hết danh sách xem trước, chạy tuần tự để tránh dồn request AI.
  const scanAllPreviewUsers = async () => {
    const users = Array.isArray(backfillResult?.users) ? [...backfillResult.users] : [];
    if (!users.length) {
      showSnack?.("info", "Không có user nào trong danh sách xem trước để quét");
      return;
    }

    // eslint-disable-next-line no-alert
    const ok = window.confirm(`Tự động quét ${users.length} user trong danh sách xem trước?`);
    if (!ok) return;

    setAutoScanningAll(true);
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const u of users) {
        if (!u.hasFront && !u.hasBack) {
          skippedCount += 1;
          continue;
        }

        setScanningUserId(u.id);
        try {
          await fillCccdForUserMut({
            id: u.id,
            dryRun: true,
          }).unwrap();
          successCount += 1;
          removeUserFromPreview(u.id);
        } catch {
          failedCount += 1;
        }
      }

      showSnack?.(
        failedCount ? "warning" : "success",
        `Đã quét ${successCount} user${
          skippedCount ? `, bỏ qua ${skippedCount} user thiếu ảnh CCCD` : ""
        }${failedCount ? `, lỗi ${failedCount} user` : ""}`
      );
    } finally {
      setScanningUserId(null);
      setAutoScanningAll(false);
    }
  };

  // Tự fill thông tin từ CCCD cho từng user trong danh sách xem trước (chỉ fill field trống)
  const applyCccdForUser = async (u) => {
    if (!u.hasFront && !u.hasBack) {
      showSnack?.("error", "User này chưa có ảnh CCCD để tự fill");
      return;
    }
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      "Tự động điền các trường còn thiếu (trừ nickname) từ CCCD cho user này?"
    );
    if (!ok) return;

    setFillingUserId(u.id);
    try {
      await handle(
        fillCccdForUserMut({
          id: u.id,
          dryRun: false,
          overwrite: false,
        }).unwrap(),
        "Đã tự động điền thông tin từ CCCD cho user này"
      );

      // 👉 Sau khi fill thành công, loại user khỏi danh sách xem trước
      removeUserFromPreview(u.id);
    } finally {
      setFillingUserId(null);
    }
  };

  // Fill ĐÈ: ghi đè các field (name/dob/gender/province/cccd) từ CCCD, kể cả đã có
  const overwriteCccdForUser = async (u) => {
    if (!u.hasFront && !u.hasBack) {
      showSnack?.("error", "User này chưa có ảnh CCCD để fill đè");
      return;
    }
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      "Fill ĐÈ: Ghi đè các trường name/dob/gender/province/cccd từ CCCD, kể cả khi user đã nhập trước đó. Bạn có chắc không?"
    );
    if (!ok) return;

    setOverwritingUserId(u.id);
    try {
      await handle(
        fillCccdForUserMut({
          id: u.id,
          dryRun: false,
          overwrite: true,
        }).unwrap(),
        "Đã fill ĐÈ thông tin từ CCCD cho user này"
      );

      // 👉 Sau khi fill đè thành công, loại user khỏi danh sách xem trước
      removeUserFromPreview(u.id);
    } finally {
      setOverwritingUserId(null);
    }
  };

  return (
    <MDBox px={3} pb={4}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoOutlinedIcon color="primary" fontSize="small" />
                <MDTypography variant="button">Tự động điền thông tin từ CCCD (AI)</MDTypography>
              </Stack>

              {backfillResult && (
                <Stack direction="row" spacing={1}>
                  {"totalCandidates" in backfillResult && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`Ứng viên: ${backfillResult.totalCandidates}`}
                    />
                  )}
                  {!backfillDryRun && typeof backfillResult.updated === "number" && (
                    <Chip
                      size="small"
                      color="success"
                      label={`Đã cập nhật: ${backfillResult.updated}`}
                    />
                  )}
                </Stack>
              )}
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <TextField
                label="Số user tối đa mỗi lần"
                type="number"
                size="small"
                value={backfillLimit}
                onChange={(e) =>
                  setBackfillLimit(
                    e.target.value === "" ? "" : Math.max(1, Number(e.target.value) || 1)
                  )
                }
                sx={{ width: { xs: "100%", sm: 220 } }}
                inputProps={{ min: 1, max: 50 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={backfillDryRun}
                    onChange={(e) => setBackfillDryRun(e.target.checked)}
                  />
                }
                label="Chạy dry-run (không ghi DB)"
              />

              <Box sx={{ flexGrow: 1 }} />

              <Button
                variant="contained"
                color={backfillDryRun ? "secondary" : "primary"}
                onClick={runBackfill}
                disabled={runningBackfill || autoScanningAll}
                startIcon={
                  runningBackfill ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )
                }
              >
                {runningBackfill
                  ? "Đang chạy..."
                  : backfillDryRun
                  ? "Xem trước user sẽ quét"
                  : "Chạy backfill AI"}
              </Button>
            </Stack>

            {backfillResult && (
              <Box sx={{ mt: 2 }}>
                {"message" in backfillResult && (
                  <MDTypography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 0.5 }}
                  >
                    {backfillResult.message}
                  </MDTypography>
                )}

                {backfillDryRun &&
                  Array.isArray(backfillResult.users) &&
                  backfillResult.users.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                        sx={{ mb: 0.5 }}
                      >
                        <MDTypography variant="caption">
                          Ví dụ tối đa 10 user sẽ được gửi cho AI:
                        </MDTypography>
                        <Button
                          size="small"
                          variant="contained"
                          color="info"
                          startIcon={
                            autoScanningAll ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : (
                              <SearchIcon fontSize="small" />
                            )
                          }
                          onClick={scanAllPreviewUsers}
                          disabled={autoScanningAll || runningBackfill}
                        >
                          {autoScanningAll ? "Đang quét hết..." : "Tự động quét hết"}
                        </Button>
                      </Stack>
                      <Stack spacing={0.75}>
                        {backfillResult.users.slice(0, 10).map((u) => {
                          const missingFields = Array.isArray(u.missingFields)
                            ? u.missingFields
                            : [];
                          const isScanning = scanningUserId === u.id;
                          const isFilling = fillingUserId === u.id;
                          const isOverwriting = overwritingUserId === u.id;

                          return (
                            <Box
                              key={u.id}
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                                p: 0.5,
                                borderRadius: 1,
                                border: "1px dashed rgba(0,0,0,0.08)",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <MDTypography
                                  variant="caption"
                                  sx={{
                                    fontFamily: "monospace",
                                    flexGrow: 1,
                                  }}
                                >
                                  • {u.id} —{" "}
                                  {u.nickname ? `nick: ${u.nickname}` : "nick: (chưa có)"} —{" "}
                                  {u.name ? `tên: ${u.name}` : "tên: (chưa có)"} —{" "}
                                  {u.hasFront ? "có ảnh CCCD" : "thiếu ảnh CCCD"}
                                </MDTypography>

                                {/* Quét */}
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={
                                    isScanning ? (
                                      <CircularProgress size={14} />
                                    ) : (
                                      <SearchIcon fontSize="small" />
                                    )
                                  }
                                  onClick={() => scanCccdForUser(u)}
                                  disabled={autoScanningAll || isScanning || isFilling || isOverwriting}
                                >
                                  Quét
                                </Button>

                                {/* Tự fill thiếu */}
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  startIcon={
                                    isFilling ? (
                                      <CircularProgress size={14} color="inherit" />
                                    ) : (
                                      <AutoAwesomeIcon fontSize="small" />
                                    )
                                  }
                                  onClick={() => applyCccdForUser(u)}
                                  disabled={autoScanningAll || isScanning || isFilling || isOverwriting}
                                >
                                  Tự fill
                                </Button>

                                {/* Fill ĐÈ */}
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  startIcon={
                                    isOverwriting ? (
                                      <CircularProgress size={14} color="inherit" />
                                    ) : (
                                      <AutoAwesomeIcon fontSize="small" />
                                    )
                                  }
                                  onClick={() => overwriteCccdForUser(u)}
                                  disabled={autoScanningAll || isScanning || isFilling || isOverwriting}
                                >
                                  Fill đè
                                </Button>
                              </Box>

                              {missingFields.length > 0 && (
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  sx={{ flexWrap: "wrap", pl: 2 }}
                                >
                                  {missingFields.map((f) => (
                                    <Chip
                                      key={f}
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      label={MISSING_FIELD_LABEL[f] || f}
                                    />
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                {!backfillDryRun &&
                  Array.isArray(backfillResult.results) &&
                  backfillResult.results.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <MDTypography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                        Kết quả chi tiết (tối đa 10 user đầu):
                      </MDTypography>
                      <Stack spacing={0.5}>
                        {backfillResult.results.slice(0, 10).map((r) => (
                          <MDTypography
                            key={r.id}
                            variant="caption"
                            sx={{ fontFamily: "monospace" }}
                          >
                            • {r.id}:{" "}
                            {r.error
                              ? `Lỗi: ${r.error}`
                              : r.changed
                              ? "Đã cập nhật từ CCCD"
                              : "Không thay đổi"}
                          </MDTypography>
                        ))}
                      </Stack>
                    </Box>
                  )}
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </MDBox>
  );
}
