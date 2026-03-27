import React from "react";
import PropTypes from "prop-types";
import { Paper, Stack, Typography, Chip, Button } from "@mui/material";

const STATUS_LABEL = {
  draftable: "Chưa khóa",
  locked: "Đã khóa",
};

const STATUS_COLOR = {
  draftable: "success",
  locked: "warning",
};

export default function StageStatusCard({ title, stageKey, runtime, config, onOpenBracket }) {
  const status = runtime?.status || "draftable";
  const matchSummary = runtime?.matchSummary || {};
  const drawSummary = runtime?.drawSummary || {};
  const hasPublishedBracket = !!runtime?.publishedBracketId;

  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <Chip size="small" label={stageKey.toUpperCase()} />
          <Chip
            size="small"
            color={STATUS_COLOR[status] || "default"}
            label={STATUS_LABEL[status] || status}
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {hasPublishedBracket
            ? `Đã publish stage này vào bracket ${runtime.publishedBracketId}.`
            : "Stage này chưa có bracket đã publish."}
        </Typography>

        {!!config && (
          <Typography variant="body2" color="text.secondary">
            {stageKey === "groups" &&
              `Số bảng: ${config.count || config.groupCount || 0} • Top/bảng: ${
                config.qualifiersPerGroup || 0
              }`}
            {stageKey === "po" &&
              `Draw size: ${config.drawSize || 0} • Max rounds: ${config.maxRounds || 1}`}
            {stageKey === "ko" &&
              `Draw size: ${config.drawSize || 0}${
                config.thirdPlaceEnabled || config.thirdPlace ? " • Có trận hạng 3–4" : ""
              }`}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary">
          Draw commit: {drawSummary.committed || 0} • Match: {matchSummary.total || 0}
          {stageKey !== "groups" ? ` • Operational: ${matchSummary.operational || 0}` : ""}
        </Typography>

        {status === "locked" ? (
          <Typography variant="caption" color="info.main">
            Cấu trúc stage đã khóa. Rule và BO vẫn có thể chỉnh ở phần editor bên dưới.
          </Typography>
        ) : null}

        {Array.isArray(runtime?.lockReasons) && runtime.lockReasons.length > 0 && (
          <Stack spacing={0.5}>
            {runtime.lockReasons.map((reason) => (
              <Typography key={reason} variant="caption" color="warning.main">
                {reason}
              </Typography>
            ))}
          </Stack>
        )}

        {hasPublishedBracket && onOpenBracket && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => onOpenBracket(runtime.publishedBracketId)}
            sx={{ alignSelf: "flex-start" }}
          >
            Đi tới bracket
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

StageStatusCard.propTypes = {
  title: PropTypes.string.isRequired,
  stageKey: PropTypes.string.isRequired,
  runtime: PropTypes.shape({
    status: PropTypes.string,
    publishedBracketId: PropTypes.string,
    lockReasons: PropTypes.arrayOf(PropTypes.string),
    matchSummary: PropTypes.object,
    drawSummary: PropTypes.object,
  }),
  config: PropTypes.object,
  onOpenBracket: PropTypes.func,
};

StageStatusCard.defaultProps = {
  runtime: null,
  config: null,
  onOpenBracket: null,
};
