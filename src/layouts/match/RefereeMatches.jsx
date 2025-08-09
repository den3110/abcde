import { useState } from "react";
import { Box, Card, Stack, TextField, Button, Chip, Typography } from "@mui/material";
import { useListMatchesQuery, useUpdateMatchScoreMutation } from "slices/tournamentsApiSlice";
// bạn có thể cần thêm 1 endpoint list-by-referee nếu muốn lọc theo refereeId
import PropTypes from "prop-types";

export default function RefereeMatches({ bracketId }) {
  const { data: matches = [], refetch } = useListMatchesQuery(bracketId);
  const [updateScore] = useUpdateMatchScoreMutation();
  const [editing, setEditing] = useState({}); // {matchId: [{a,b},...]}

  const submit = async (m) => {
    await updateScore({
      matchId: m._id,
      body: {
        gameScores: editing[m._id] || m.gameScores,
        status: "finished",
        winner: calcWinner(editing[m._id] || m.gameScores),
      },
    }).unwrap();
    refetch();
  };

  const calcWinner = (games = []) => {
    let a = 0,
      b = 0;
    games.forEach((g) => {
      if ((g?.a || 0) > (g?.b || 0)) a++;
      else if ((g?.b || 0) > (g?.a || 0)) b++;
    });
    return a > b ? "A" : b > a ? "B" : "";
  };

  return (
    <Box p={2}>
      <Typography variant="h6" mb={2}>
        Matches to Referee
      </Typography>
      <Stack spacing={2}>
        {matches.map((m) => (
          <Card key={m._id} style={{ padding: 16 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography fontWeight={600}>
                {m.pairA.player1.fullName} & {m.pairA.player2.fullName} vs{" "}
                {m.pairB.player1.fullName} & {m.pairB.player2.fullName}
              </Typography>
              <Chip size="small" label={m.status} />
            </Stack>

            <Stack spacing={1}>
              {Array.from({ length: m.rules.bestOf }).map((_, idx) => {
                const cur = editing[m._id]?.[idx] ?? m.gameScores?.[idx] ?? { a: 0, b: 0 };
                return (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" width={60}>
                      Game {idx + 1}
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      label="A"
                      value={cur.a}
                      onChange={(e) => {
                        const next = [...(editing[m._id] || m.gameScores || [])];
                        next[idx] = { ...cur, a: Number(e.target.value || 0) };
                        setEditing({ ...editing, [m._id]: next });
                      }}
                      sx={{ width: 100 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="B"
                      value={cur.b}
                      onChange={(e) => {
                        const next = [...(editing[m._id] || m.gameScores || [])];
                        next[idx] = { ...cur, b: Number(e.target.value || 0) };
                        setEditing({ ...editing, [m._id]: next });
                      }}
                      sx={{ width: 100 }}
                    />
                  </Stack>
                );
              })}
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setEditing({ ...editing, [m._id]: m.gameScores })}
              >
                Reset
              </Button>
              <Button size="small" variant="contained" onClick={() => submit(m)}>
                Save
              </Button>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

RefereeMatches.propTypes = {
  bracketId: PropTypes.string.isRequired,
};
