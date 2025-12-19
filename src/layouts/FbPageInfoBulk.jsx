// src/layouts/youtube/FbPageInfoBulk.jsx
import * as React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  TextField,
  Divider,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  LinearProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/ErrorOutline";
import PropTypes from "prop-types";

import { useFbPageInfoBulkMutation } from "slices/facebookAdminApiSlice";

const DEFAULT_FIELDS = "id,name,link,category,fan_count,followers_count,picture{url},cover";

const parseTokens = (input) =>
  String(input || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const getPicUrl = (data) => data?.picture?.data?.url || data?.picture?.url || "";

const maskToken = (t = "") => {
  const s = String(t || "");
  if (!s) return "";
  if (s.length <= 16) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(String(value || ""));
    return true;
  } catch {
    return false;
  }
}

function CopyIconButton({ value, onCopied, title = "Copy" }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          onClick={async () => {
            const ok = await copyToClipboard(value);
            if (ok) onCopied?.();
          }}
          disabled={!value}
          size="small"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function FbPageInfoBulk() {
  const [tokensText, setTokensText] = React.useState("");
  const [fields, setFields] = React.useState(DEFAULT_FIELDS);

  const [rows, setRows] = React.useState([]);
  const [err, setErr] = React.useState("");
  const [snack, setSnack] = React.useState({ open: false, message: "", severity: "success" });

  const tokens = React.useMemo(() => parseTokens(tokensText), [tokensText]);

  const [fbPageInfoBulk, { isLoading }] = useFbPageInfoBulkMutation();

  const run = async () => {
    try {
      setErr("");
      setRows([]);

      if (!tokens.length) {
        setErr("Bạn chưa nhập token nào.");
        return;
      }

      const data = await fbPageInfoBulk({ tokens: tokensText, fields }).unwrap();
      setRows(Array.isArray(data?.results) ? data.results : []);

      setSnack({
        open: true,
        severity: "success",
        message: `Đã tra cứu ${data?.count || (data?.results || []).length} token.`,
      });
    } catch (e) {
      setErr(e?.data?.message || e?.error || e?.message || "Fetch failed");
    }
  };

  const stats = React.useMemo(() => {
    const okCount = rows.filter((x) => x?.ok).length;
    const failCount = rows.filter((x) => !x?.ok).length;
    const userCount = rows.filter((x) => x?.kind === "user").length;
    const pageCount = rows.filter((x) => x?.kind === "page").length;
    const unknownCount = rows.filter((x) => x?.kind === "unknown").length;
    const totalPages = rows.reduce(
      (acc, r) => acc + (Array.isArray(r?.pages) ? r.pages.length : 0),
      0
    );
    return { okCount, failCount, userCount, pageCount, unknownCount, totalPages };
  }, [rows]);

  const openUrl = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderPageRow = (page, key) => {
    const pageId = page?.id || "";
    const pageName = page?.name || "(no name)";
    const category = page?.category || "";
    const pic = getPicUrl(page);
    const pageToken = page?.access_token || "";
    const fbLink = pageId ? `https://www.facebook.com/${pageId}` : "";

    return (
      <Paper key={key} variant="outlined" sx={{ p: 1.25 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems="center">
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <Avatar src={pic} alt={pageName} />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {pageName}
                </Typography>
                {category && <Chip size="small" label={category} variant="outlined" />}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Page ID: {pageId || "—"}
                </Typography>
                <CopyIconButton
                  value={pageId}
                  title="Copy Page ID"
                  onCopied={() =>
                    setSnack({ open: true, severity: "success", message: "Copied Page ID!" })
                  }
                />

                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Page Token: {maskToken(pageToken) || "—"}
                </Typography>
                <CopyIconButton
                  value={pageToken}
                  title="Copy Page Access Token"
                  onCopied={() =>
                    setSnack({
                      open: true,
                      severity: "success",
                      message: "Copied Page Access Token!",
                    })
                  }
                />
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Mở Page">
              <span>
                <IconButton onClick={() => openUrl(fbLink)} disabled={!fbLink}>
                  <OpenInNewIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Facebook Page – Tra cứu thông tin token
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Chip label={`Tokens: ${tokens.length}`} variant="outlined" />
          {!!rows.length && (
            <Chip icon={<CheckCircleIcon />} label={`OK: ${stats.okCount}`} color="success" />
          )}
          {!!rows.length && (
            <Chip icon={<ErrorIcon />} label={`Fail: ${stats.failCount}`} color="warning" />
          )}
          {!!rows.length && <Chip label={`Users: ${stats.userCount}`} variant="outlined" />}
          {!!rows.length && <Chip label={`Pages: ${stats.totalPages}`} variant="outlined" />}
        </Stack>

        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Nhập nhiều token, phân cách bằng dấu <b>,</b> hoặc <b>xuống dòng</b>.
        </Typography>

        <TextField
          label="Danh sách token (User/Page)"
          value={tokensText}
          onChange={(e) => setTokensText(e.target.value)}
          multiline
          minRows={4}
          placeholder={"token1\ntoken2, token3"}
          fullWidth
        />

        <TextField
          label="Fields (Graph API) — chỉ áp dụng khi kind=page"
          value={fields}
          onChange={(e) => setFields(e.target.value)}
          size="small"
          fullWidth
          helperText="Với kind=user, backend sẽ dùng /me/accounts để lấy pages + page access_token."
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={run}
            disabled={isLoading || !tokens.length}
          >
            {isLoading ? "Đang tra cứu..." : "Tra cứu"}
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              setTokensText("");
              setRows([]);
              setErr("");
            }}
            disabled={isLoading}
          >
            Clear
          </Button>
        </Stack>

        {isLoading && <LinearProgress />}

        {!!err && (
          <Alert severity="error" variant="filled" onClose={() => setErr("")}>
            {err}
          </Alert>
        )}

        {!!rows.length && <Divider />}

        {!!rows.length && (
          <Stack spacing={1}>
            {rows.map((r, idx) => {
              const kind = r?.kind || "unknown";
              const tokenPreview = r?.tokenPreview || "—";

              // ===== kind=user =====
              if (kind === "user") {
                const meName = r?.me?.name || "(no name)";
                const meId = r?.me?.id || "";
                const pages = Array.isArray(r?.pages) ? r.pages : [];

                return (
                  <Paper key={`${tokenPreview}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack spacing={1}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        alignItems="center"
                      >
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          <Avatar>{(meName || "U").slice(0, 1).toUpperCase()}</Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography sx={{ fontWeight: 800 }} noWrap>
                                {meName}
                              </Typography>

                              <Chip
                                size="small"
                                label="USER TOKEN"
                                variant="outlined"
                                color="info"
                              />

                              <Chip
                                size="small"
                                icon={r?.ok ? <CheckCircleIcon /> : <ErrorIcon />}
                                label={r?.ok ? "OK" : "FAIL"}
                                color={r?.ok ? "success" : "warning"}
                                variant={r?.ok ? "filled" : "outlined"}
                              />

                              <Chip
                                size="small"
                                label={`Pages: ${pages.length}`}
                                variant="outlined"
                              />
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                User ID: {meId || "—"}
                              </Typography>
                              <CopyIconButton
                                value={meId}
                                title="Copy User ID"
                                onCopied={() =>
                                  setSnack({
                                    open: true,
                                    severity: "success",
                                    message: "Copied User ID!",
                                  })
                                }
                              />

                              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                Token: {tokenPreview}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Stack>

                      {r?.note && (
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                          {r.note}
                        </Typography>
                      )}

                      {pages.length === 0 ? (
                        <Alert severity="warning" variant="outlined">
                          Token user này không thấy Page nào trong <b>/me/accounts</b> (hoặc user
                          không quản trị page / thiếu quyền).
                        </Alert>
                      ) : (
                        <Stack spacing={1}>
                          {pages.map((p, pIdx) => renderPageRow(p, `${tokenPreview}-p-${pIdx}`))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                );
              }

              // ===== kind=page =====
              if (kind === "page") {
                const d = r?.data || {};
                const link = d?.link || "";
                const name = d?.name || "(no name)";
                const id = d?.id || "";
                const pic = getPicUrl(d);

                return (
                  <Paper key={`${tokenPreview}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems="center"
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        <Avatar src={pic} alt={name} />
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {name}
                            </Typography>

                            <Chip
                              size="small"
                              label="PAGE TOKEN"
                              variant="outlined"
                              color="success"
                            />

                            <Chip
                              size="small"
                              icon={r?.ok ? <CheckCircleIcon /> : <ErrorIcon />}
                              label={r?.ok ? "OK" : "FAIL"}
                              color={r?.ok ? "success" : "warning"}
                              variant={r?.ok ? "filled" : "outlined"}
                            />

                            {d?.category && (
                              <Chip size="small" label={d.category} variant="outlined" />
                            )}
                            {typeof d?.fan_count === "number" && (
                              <Chip
                                size="small"
                                label={`Likes: ${d.fan_count}`}
                                variant="outlined"
                              />
                            )}
                            {typeof d?.followers_count === "number" && (
                              <Chip
                                size="small"
                                label={`Followers: ${d.followers_count}`}
                                variant="outlined"
                              />
                            )}
                          </Stack>

                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              Page ID: {id || "—"}
                            </Typography>
                            <CopyIconButton
                              value={id}
                              title="Copy Page ID"
                              onCopied={() =>
                                setSnack({
                                  open: true,
                                  severity: "success",
                                  message: "Copied Page ID!",
                                })
                              }
                            />
                            <Typography variant="caption" sx={{ opacity: 0.75 }}>
                              Token: {tokenPreview}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Mở Page">
                          <span>
                            <IconButton onClick={() => openUrl(link)} disabled={!link}>
                              <OpenInNewIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              }

              // ===== kind=unknown / error =====
              const emsg = r?.error?.message || "Unknown error";
              const ecode = r?.error?.code;
              const esub = r?.error?.subcode;

              return (
                <Paper key={`${tokenPreview}-${idx}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontWeight: 800 }}>Token: {tokenPreview}</Typography>
                      <Chip size="small" label="UNKNOWN" variant="outlined" />
                      <Chip
                        size="small"
                        icon={<ErrorIcon />}
                        label="FAIL"
                        color="warning"
                        variant="outlined"
                      />
                      {typeof ecode !== "undefined" && (
                        <Chip size="small" label={`code: ${ecode}`} variant="outlined" />
                      )}
                      {typeof esub !== "undefined" && (
                        <Chip size="small" label={`sub: ${esub}`} variant="outlined" />
                      )}
                    </Stack>

                    <Alert severity="error" variant="outlined">
                      {emsg}
                    </Alert>

                    {ecode === 190 && esub === 459 && (
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        Gợi ý: token bị checkpoint/chặn → đăng nhập Facebook trên web để xác minh
                        theo hướng dẫn, rồi thử lại.
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}

        <Snackbar
          open={snack.open}
          autoHideDuration={2500}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          <Alert
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            severity={snack.severity}
            variant="filled"
          >
            {snack.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Paper>
  );
}

// ✅ thêm propTypes + defaultProps
CopyIconButton.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCopied: PropTypes.func,
  title: PropTypes.string,
};

CopyIconButton.defaultProps = {
  value: "",
  onCopied: undefined,
  title: "Copy",
};
