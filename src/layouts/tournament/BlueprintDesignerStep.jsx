import React from "react";
import PropTypes from "prop-types";
import { Button, Paper, Stack, Tabs, Tab } from "@mui/material";

export default function BlueprintDesignerStep({
  tab,
  onTabChange,
  autoContent,
  manualContent,
  onBack,
  onNext,
}) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, value) => onTabChange(value)} sx={{ mb: 2 }}>
          <Tab label="Option 1: Gợi ý (Auto)" value="auto" />
          <Tab label="Option 2: Tự thiết kế & Seed map" value="manual" />
        </Tabs>

        {tab === "auto" ? autoContent : manualContent}
      </Paper>

      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" onClick={onBack}>
          Quay lại tổng quan
        </Button>
        <Button variant="contained" onClick={onNext} sx={{ color: "white !important" }}>
          Xem tác động & Publish
        </Button>
      </Stack>
    </Stack>
  );
}

BlueprintDesignerStep.propTypes = {
  tab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  autoContent: PropTypes.node.isRequired,
  manualContent: PropTypes.node.isRequired,
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};
