import React from "react";
import PropTypes from "prop-types";
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

const TYPE_LABEL = {
  unchanged: "Giữ nguyên",
  create: "Tạo mới",
  rebuild: "Dựng lại",
  update_rules: "Cập nhật rules",
  delete: "Xóa",
  locked_conflict: "Bị chặn do khóa",
};

const TYPE_COLOR = {
  unchanged: "text.secondary",
  create: "success.main",
  rebuild: "warning.main",
  update_rules: "info.main",
  delete: "error.main",
  locked_conflict: "error.main",
};

const STAGE_TITLE = {
  groups: "Vòng bảng",
  po: "Play-Off",
  ko: "Knockout",
};

export default function BlueprintPublishStep({
  impact,
  impactError,
  loadingImpact,
  savingDraft,
  publishing,
  onRefreshImpact,
  onSaveDraft,
  onSafeApply,
  onReplaceAll,
  onBack,
}) {
  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        Blueprint sẽ được đối chiếu với structure đã publish. Chỉ các stage chưa khóa mới được
        rebuild bằng chế độ áp dụng an toàn.
      </Alert>

      {impactError ? (
        <Alert severity="error" variant="outlined">
          {impactError}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Kiểm tra tác động
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onRefreshImpact}
              disabled={loadingImpact}
            >
              {loadingImpact ? "Đang phân tích..." : "Làm mới"}
            </Button>
          </Stack>

          {loadingImpact ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Đang phân tích impact...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {(impact?.stages || []).map((stage) => (
                <Paper key={stage.key} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      {STAGE_TITLE[stage.key] || stage.key}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: TYPE_COLOR[stage.type] || "text.primary", fontWeight: 700 }}
                    >
                      {TYPE_LABEL[stage.type] || stage.type}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Locked: {stage.locked ? "Có" : "Không"} • Published:{" "}
                    {stage.publishedExists ? "Có" : "Không"} • Draft:{" "}
                    {stage.draftExists ? "Có" : "Không"}
                  </Typography>
                  {!!stage.reason && (
                    <Typography variant="caption" color="warning.main" display="block">
                      {stage.reason}
                    </Typography>
                  )}
                  {stage.runtime?.lockReasons?.map((reason) => (
                    <Typography key={reason} variant="caption" color="warning.main" display="block">
                      {reason}
                    </Typography>
                  ))}
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {impact?.hasConflicts ? (
        <Alert severity="warning" variant="outlined">
          Draft hiện tại đang chạm vào stage đã khóa. Bạn vẫn có thể lưu bản nháp, nhưng không thể
          áp dụng an toàn cho tới khi bỏ thay đổi ở các stage bị khóa.
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Quay lại thiết kế
        </Button>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={onSaveDraft} disabled={savingDraft || publishing}>
            {savingDraft ? "Đang lưu..." : "Lưu bản nháp"}
          </Button>
          <Button
            variant="contained"
            onClick={onSafeApply}
            disabled={loadingImpact || savingDraft || publishing || !!impact?.hasConflicts}
            sx={{ color: "white !important" }}
          >
            {publishing ? "Đang áp dụng..." : "Áp dụng cho stage chưa mở"}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={onReplaceAll}
            disabled={loadingImpact || savingDraft || publishing || !impact?.canReplaceAll}
            sx={{ color: "white !important" }}
          >
            Thay toàn bộ blueprint
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

BlueprintPublishStep.propTypes = {
  impact: PropTypes.object,
  impactError: PropTypes.string,
  loadingImpact: PropTypes.bool,
  savingDraft: PropTypes.bool,
  publishing: PropTypes.bool,
  onRefreshImpact: PropTypes.func.isRequired,
  onSaveDraft: PropTypes.func.isRequired,
  onSafeApply: PropTypes.func.isRequired,
  onReplaceAll: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

BlueprintPublishStep.defaultProps = {
  impact: null,
  impactError: "",
  loadingImpact: false,
  savingDraft: false,
  publishing: false,
};
