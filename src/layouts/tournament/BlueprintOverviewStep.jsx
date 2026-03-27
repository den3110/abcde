import React from "react";
import PropTypes from "prop-types";
import { Alert, Box, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import StageStatusCard from "./StageStatusCard";

export default function BlueprintOverviewStep({
  tournament,
  paidCount,
  stageCards,
  onOpenBracket,
  onNext,
}) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1}>
          <Typography variant="h5" fontWeight={700}>
            Safe Blueprint Publish
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tournament?.name || "Tournament"} • Paid teams: {paidCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stage đã bốc thăm hoặc đã đi vào vận hành sẽ bị khóa cấu trúc. Bạn chỉ có thể chỉnh và
            publish các stage phía sau chưa mở.
          </Typography>
        </Stack>
      </Paper>

      <Alert severity="info" variant="outlined">
        Overwrite toàn bộ không còn là hành vi mặc định. Flow mới là lưu draft, xem tác động, rồi áp
        dụng an toàn cho các stage chưa mở.
      </Alert>

      <Box>
        <Grid container spacing={2}>
          {stageCards.map((stage) => (
            <Grid key={stage.key} item xs={12} md={4}>
              <StageStatusCard
                title={stage.title}
                stageKey={stage.key}
                runtime={stage.runtime}
                config={stage.config}
                onOpenBracket={onOpenBracket}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={onNext} sx={{ color: "white !important" }}>
          Sang bước thiết kế
        </Button>
      </Stack>
    </Stack>
  );
}

BlueprintOverviewStep.propTypes = {
  tournament: PropTypes.object,
  paidCount: PropTypes.number,
  stageCards: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      runtime: PropTypes.object,
      config: PropTypes.object,
    })
  ).isRequired,
  onOpenBracket: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

BlueprintOverviewStep.defaultProps = {
  tournament: null,
  paidCount: 0,
};
