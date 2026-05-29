import { apiSlice } from "./apiSlice";

export const bracketStoryApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBracketStory: builder.query({
      query: (tournamentId) => `/admin/tournaments/${tournamentId}/bracket-story`,
      providesTags: (result, error, tournamentId) => [
        { type: "BracketStory", id: tournamentId },
      ],
    }),
    generateBracketStory: builder.mutation({
      query: ({ tournamentId }) => ({
        url: `/admin/tournaments/${tournamentId}/bracket-story`,
        method: "POST",
      }),
      invalidatesTags: (result, error, { tournamentId }) => [
        { type: "BracketStory", id: tournamentId },
      ],
    }),
  }),
});

export const { useGetBracketStoryQuery, useGenerateBracketStoryMutation } =
  bracketStoryApiSlice;
