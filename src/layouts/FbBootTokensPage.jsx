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
  Switch,
  FormControlLabel,
  CircularProgress,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FacebookIcon from "@mui/icons-material/Facebook";
import { toast } from "react-toastify";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  useInspectBootTokensQuery,
  useAddBootTokenMutation,
  useDeleteBootTokenMutation,
} from "slices/adminFacebookApi";

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function TokenCard({ item, onDelete, deleting }) {
  const [showPages, setShowPages] = React.useState(false);
  const live = item.valid;

  return (
    <Card variant="outlined" sx={{ borderColor: live ? "success.light" : "error.light" }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            {live ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="error" fontSize="small" />
            )}
            <Typography variant="subtitle1" fontWeight={700}>
              {item.owner?.name || (live ? "Không lấy được tên" : "Token đã chết")}
            </Typography>
            <Chip
              size="small"
              color={live ? "success" : "error"}
              label={live ? "LIVE" : "CHẾT — cần thay"}
            />
            {item.neverExpires && live && (
              <Chip size="small" variant="outlined" label="Không hết hạn" />
            )}
          </Stack>
          <Tooltip title="Xoá token này khỏi danh sách">
            <span>
              <IconButton
                color="error"
                disabled={deleting}
                onClick={() => {
                  if (window.confirm("Xoá token này khỏi FB_BOOT_LONG_USER_TOKEN?")) {
                    onDelete(item.fingerprint);
                  }
                }}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Stack spacing={0.5} mt={1}>
          <Typography variant="body2" color="text.secondary">
            <b>Token:</b> <code>{item.preview}</code>
            {item.owner?.id ? ` · user id: ${item.owner.id}` : ""}
          </Typography>
          {live && (
            <Typography variant="body2" color="text.secondary">
              <b>Hết hạn:</b>{" "}
              {item.neverExpires ? "Không" : fmtDate(item.expiresAt) || "—"}
              {item.dataAccessExpiresAt
                ? ` · Data access đến ${fmtDate(item.dataAccessExpiresAt)}`
                : ""}
            </Typography>
          )}
          {!live && (
            <Alert severity="error" sx={{ py: 0 }}>
              {item.message || "Token không hợp lệ"} — hãy xoá và thêm token mới của cùng tài khoản.
            </Alert>
          )}
          {live && Array.isArray(item.scopes) && item.scopes.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Scopes:
              </Typography>{" "}
              {item.scopes.slice(0, 12).map((s) => (
                <Chip key={s} label={s} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
              ))}
            </Box>
          )}
        </Stack>

        {live && (
          <Box mt={1}>
            <Button
              size="small"
              startIcon={showPages ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowPages((v) => !v)}
            >
              {item.pageCount} page do tài khoản này quản
            </Button>
            {item.pagesError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Không lấy được danh sách page: {item.pagesError}
              </Alert>
            )}
            <Collapse in={showPages}>
              <List dense>
                {item.pages.map((p) => (
                  <ListItem key={p.id} disableGutters>
                    <ListItemText primary={p.name} secondary={`id: ${p.id}`} />
                  </ListItem>
                ))}
                {item.pages.length === 0 && !item.pagesError && (
                  <Typography variant="body2" color="text.secondary">
                    Tài khoản này không quản page nào.
                  </Typography>
                )}
              </List>
            </Collapse>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function FbBootTokensPage() {
  const { data, isFetching, refetch, isError, error } = useInspectBootTokensQuery();
  const [addBootToken, { isLoading: adding }] = useAddBootTokenMutation();
  const [deleteBootToken, { isLoading: deleting }] = useDeleteBootTokenMutation();

  const [tokenInput, setTokenInput] = React.useState("");
  const [isShort, setIsShort] = React.useState(false);
  const [appId, setAppId] = React.useState("");
  const [appSecret, setAppSecret] = React.useState("");

  const onAdd = async () => {
    const val = tokenInput.trim();
    if (!val) return;
    const body = isShort ? { shortToken: val } : { token: val };
    if (isShort && appId.trim()) body.appId = appId.trim();
    if (isShort && appSecret.trim()) body.appSecret = appSecret.trim();
    try {
      const res = await addBootToken(body).unwrap();
      toast.success(
        `Đã thêm token của "${res.owner?.name || "?"}" (${res.pageCount} page). Đang đồng bộ page token…`
      );
      setTokenInput("");
      setAppId("");
      setAppSecret("");
    } catch (err) {
      toast.error(err?.data?.message || "Thêm token thất bại");
    }
  };

  const onDelete = async (fp) => {
    try {
      await deleteBootToken(fp).unwrap();
      toast.success("Đã xoá token. Đang đồng bộ lại…");
    } catch (err) {
      toast.error(err?.data?.message || "Xoá token thất bại");
    }
  };

  const items = data?.items || [];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box p={2}>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <FacebookIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Token đăng nhập Facebook (FB_BOOT_LONG_USER_TOKEN)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Mỗi token là của <b>1 tài khoản Facebook</b> và phủ <b>tất cả page tài khoản đó quản</b>.
          Trang này soi chủ tài khoản + page của từng token, cho biết token nào còn sống, và thêm
          nhanh token mới. Thêm/xoá xong hệ thống tự đồng bộ (đúc lại page token).
        </Typography>

        {/* Tổng quan */}
        <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
          <Chip label={`Tổng: ${data?.count ?? 0}`} />
          <Chip color="success" label={`Live: ${data?.liveCount ?? 0}`} />
          <Chip color="error" label={`Chết: ${data?.deadCount ?? 0}`} />
          <Chip variant="outlined" label={`Page (duy nhất): ${data?.uniquePageCount ?? 0}`} />
          <Tooltip title="Kiểm tra lại tất cả token">
            <span>
              <Button
                size="small"
                startIcon={isFetching ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={refetch}
                disabled={isFetching}
              >
                Kiểm tra lại
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {/* Thêm token */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Thêm token nhanh
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label={isShort ? "Short-lived user token" : "Long-lived user token"}
                placeholder="EAAZA..."
                fullWidth
                multiline
                minRows={2}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <FormControlLabel
                control={<Switch checked={isShort} onChange={(e) => setIsShort(e.target.checked)} />}
                label="Đây là short-lived token — tự đổi sang long-lived trước khi thêm"
              />
              {isShort && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    label="App ID (tuỳ chọn — mặc định dùng FB_APP_ID)"
                    fullWidth
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                  />
                  <TextField
                    label="App Secret (tuỳ chọn)"
                    type="password"
                    fullWidth
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                  />
                </Stack>
              )}
              <Box>
                <Button
                  variant="contained"
                  onClick={onAdd}
                  disabled={adding || !tokenInput.trim()}
                >
                  {adding ? "Đang thêm…" : "Thêm & đồng bộ"}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Token phải của tài khoản có quyền admin trên page. Token chết sẽ bị từ chối. Lấy
                token: Graph API Explorer với quyền pages_show_list, pages_read_engagement,
                pages_manage_posts, pages_manage_metadata, publish_video.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Danh sách */}
        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error?.data?.message || "Không tải được danh sách token."}
          </Alert>
        )}
        {isFetching && !items.length ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Đang soi token qua Facebook…</Typography>
          </Stack>
        ) : items.length === 0 ? (
          <Alert severity="info">
            Chưa có token nào trong FB_BOOT_LONG_USER_TOKEN. Thêm token ở trên.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {items.map((item) => (
              <TokenCard
                key={item.fingerprint || item.index}
                item={item}
                onDelete={onDelete}
                deleting={deleting}
              />
            ))}
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Sau khi thêm/xoá, vào trang “FB Page Tokens” và bấm “Check all” để xác nhận page đã hết
          “Cần reauth”.
        </Typography>
      </Box>
    </DashboardLayout>
  );
}
