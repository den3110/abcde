import React from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useExchangeLongUserTokenMutation } from "slices/adminFacebookApi";

export default function FbLongUserTokenPage() {
  const [exchangeLong, { data: exchanged, isLoading: exchanging, error: exchangeError }] =
    useExchangeLongUserTokenMutation();

  const [shortToken, setShortToken] = React.useState("");
  const [appId, setAppId] = React.useState("");
  const [appSecret, setAppSecret] = React.useState("");
  const [showSecret, setShowSecret] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const onExchange = React.useCallback(() => {
    if (!shortToken) return;
    const payload = { shortToken: shortToken.trim() };
    if (appId && appId.trim()) payload.appId = appId.trim();
    if (appSecret && appSecret.trim()) payload.appSecret = appSecret.trim();
    exchangeLong(payload);
  }, [shortToken, appId, appSecret, exchangeLong]);

  const copy = React.useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, []);

  const pasteFromClipboard = React.useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setShortToken(t.trim());
    } catch {}
  }, []);

  return (
    <Box p={2} mx="auto">
      <Typography variant="h5" fontWeight={700} mb={1}>
        Lấy Long-Lived User Token (Facebook)
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Bắt buộc: dán <b>short-lived user token</b>. Tuỳ chọn: điền <b>App ID</b> và{" "}
        <b>App Secret</b> nếu muốn dùng app khác với cấu hình server.
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label="Short-lived token (bắt buộc)"
                placeholder="EAAJ... (token user ngắn hạn)"
                value={shortToken}
                onChange={(e) => setShortToken(e.target.value)}
              />
              <Button variant="outlined" onClick={pasteFromClipboard}>
                Dán từ Clipboard
              </Button>
              <Button variant="contained" onClick={onExchange} disabled={!shortToken || exchanging}>
                Đổi sang Long-lived
              </Button>
            </Stack>

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              Tuỳ chọn (override app mặc định trên server)
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label="App ID (tuỳ chọn)"
                placeholder="1234567890"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
              <TextField
                size="small"
                fullWidth
                label="App Secret (tuỳ chọn)"
                placeholder="••••••••••••"
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowSecret((s) => !s)}
                        edge="end"
                        aria-label="toggle secret visibility"
                      >
                        {showSecret ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            {exchangeError && (
              <Alert icon={<ReportGmailerrorredIcon />} severity="error">
                {exchangeError?.data?.message || "Đổi token thất bại"}
              </Alert>
            )}

            {exchanged?.longToken && (
              <>
                <Divider />
                <Typography variant="subtitle1" fontWeight={700}>
                  Long-lived token
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    value={exchanged.longToken}
                    size="small"
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                  <Tooltip title={copied ? "Đã copy!" : "Copy"}>
                    <IconButton onClick={() => copy(exchanged.longToken)}>
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    label={
                      exchanged.expiresAt
                        ? `Hết hạn: ${new Date(exchanged.expiresAt).toLocaleString()}`
                        : "Expires: unknown"
                    }
                  />
                  <Chip label={`Token type: ${exchanged.tokenType || "bearer"}`} />
                </Stack>

                {Array.isArray(exchanged.scopes) && exchanged.scopes.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Scopes</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {exchanged.scopes.map((s) => (
                        <Chip key={s} label={s} size="small" />
                      ))}
                    </Stack>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info">
        Gợi ý: từ long-lived user token, bạn có thể lấy danh sách Pages và tạo page token “không hết
        hạn”.
      </Alert>
    </Box>
  );
}
