import { apiSlice } from "./apiSlice";

export const adminApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // =========================
    // USER MANAGEMENT (cũ)
    // =========================
    getUsers: builder.query({
      query: ({ page = 1, keyword = "", role = "", cccdStatus = "", pageSize = 10 }) =>
        `/admin/users?page=${page}&keyword=${encodeURIComponent(
          keyword
        )}&role=${role}&cccdStatus=${cccdStatus}&pageSize=${pageSize}`,
      providesTags: ["User"],
      keepUnusedDataFor: 30,
    }),

    updateUserRole: builder.mutation({
      query: ({ id, role }) => ({
        url: `/admin/users/${id}/role`,
        method: "PUT",
        body: { role },
      }),
      invalidatesTags: ["User"],
    }),

    updateUserSuperAdmin: builder.mutation({
      query: ({ id, isSuperUser }) => ({
        url: `/admin/users/${id}/super-admin`,
        method: "PATCH",
        body: { isSuperUser },
      }),
      invalidatesTags: ["User"],
    }),

    updateUserCoach: builder.mutation({
      query: ({ id, isCoach, coachProfile }) => ({
        url: `/admin/users/${id}/coach`,
        method: "PUT",
        body: { isCoach, coachProfile },
      }),
      invalidatesTags: ["User"],
    }),

    /* ===== Coach applications ===== */
    listCoachApplications: builder.query({
      query: ({ status = "pending", cursor, limit = 20 } = {}) => {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (cursor) p.set("cursor", cursor);
        if (limit) p.set("limit", String(limit));
        return { url: `/admin/coaches/applications?${p.toString()}`, method: "GET" };
      },
      providesTags: ["CoachApp"],
    }),
    approveCoachApplication: builder.mutation({
      query: ({ id, adminNote }) => ({
        url: `/admin/coaches/applications/${id}/approve`,
        method: "POST",
        body: { adminNote },
      }),
      invalidatesTags: ["CoachApp", "CoachAch", "User"],
    }),
    rejectCoachApplication: builder.mutation({
      query: ({ id, adminNote }) => ({
        url: `/admin/coaches/applications/${id}/reject`,
        method: "POST",
        body: { adminNote },
      }),
      invalidatesTags: ["CoachApp"],
    }),

    /* ===== Coach achievements ===== */
    listCoachAchievements: builder.query({
      query: ({ status = "pending", coach, cursor, limit = 20 } = {}) => {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (coach) p.set("coach", coach);
        if (cursor) p.set("cursor", cursor);
        if (limit) p.set("limit", String(limit));
        return { url: `/admin/coaches/achievements?${p.toString()}`, method: "GET" };
      },
      providesTags: ["CoachAch"],
    }),
    approveCoachAchievement: builder.mutation({
      query: ({ id, adminNote }) => ({
        url: `/admin/coaches/achievements/${id}/approve`,
        method: "POST",
        body: { adminNote },
      }),
      invalidatesTags: ["CoachAch"],
    }),
    rejectCoachAchievement: builder.mutation({
      query: ({ id, adminNote }) => ({
        url: `/admin/coaches/achievements/${id}/reject`,
        method: "POST",
        body: { adminNote },
      }),
      invalidatesTags: ["CoachAch"],
    }),
    patchCoachAchievement: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/coaches/achievements/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["CoachAch"],
    }),
    adminCreateCoachAchievement: builder.mutation({
      query: (body) => ({
        url: `/admin/coaches/achievements`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["CoachAch"],
    }),

    deleteUser: builder.mutation({
      query: (id) => ({ url: `/admin/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),

    /** ✨ SỬA hồ sơ (name, phone, …) */
    updateUserInfo: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/users/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["User"],
    }),

    /** ✨ Kích hoạt / bỏ kích hoạt SĐT (không cần OTP) */
    verifyUserPhone: builder.mutation({
      query: ({ id, verified = true }) => ({
        url: `/admin/users/${id}/phone-verify`,
        method: "PATCH",
        body: { verified },
      }),
      invalidatesTags: ["User"],
    }),

    /** ✨ Buộc / bỏ buộc tài khoản này phải xác minh SĐT (Zalo) mới dùng tiếp */
    setUserPhoneRequired: builder.mutation({
      query: ({ id, required = true, reason = "" }) => ({
        url: `/admin/users/${id}/phone-required`,
        method: "PATCH",
        body: { required, reason },
      }),
      invalidatesTags: ["User"],
    }),

    /** ✨ DUYỆT hoặc TỪ CHỐI KYC */
    reviewKyc: builder.mutation({
      query: ({ id, action }) => ({
        url: `/admin/users/${id}/kyc`,
        method: "PUT",
        body: { action }, // "approve" | "reject"
      }),
      invalidatesTags: ["User"],
    }),

    updateRanking: builder.mutation({
      query: ({ id, single, double }) => ({
        url: `/admin/rankings/${id}`,
        method: "PUT",
        body: { single, double },
      }),
      invalidatesTags: ["User"],
    }),
    getSelfAssessments: builder.query({
      query: ({ page = 1, pageSize = 20, keyword = "" } = {}) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (keyword) params.set("keyword", keyword);
        return `/admin/self-assessments?${params.toString()}`;
      },
      providesTags: ["SelfAssessment"],
      keepUnusedDataFor: 10,
    }),
    resetSelfAssessments: builder.mutation({
      query: ({ userIds, keyword } = {}) => ({
        url: "/admin/self-assessments/reset",
        method: "POST",
        body: {
          ...(Array.isArray(userIds) && userIds.length ? { userIds } : {}),
          ...(keyword ? { keyword } : {}),
        },
      }),
      invalidatesTags: ["SelfAssessment", "User"],
    }),
    getAssessmentHistory: builder.query({
      query: (filters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return;
          params.set(key, String(value));
        });
        if (!params.has("page")) params.set("page", "1");
        if (!params.has("pageSize")) params.set("pageSize", "25");
        return `/admin/assessment-history?${params.toString()}`;
      },
      providesTags: ["AssessmentHistory"],
      keepUnusedDataFor: 10,
    }),
    getAuthLogs: builder.query({
      query: ({
        page = 1,
        pageSize = 30,
        keyword = "",
        action = "",
        channel = "",
        status = "",
      } = {}) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (keyword) params.set("keyword", keyword);
        if (action) params.set("action", action);
        if (channel) params.set("channel", channel);
        if (status) params.set("status", status);
        return `/admin/auth-logs?${params.toString()}`;
      },
      providesTags: ["AuthLog"],
      keepUnusedDataFor: 10,
    }),
    getAuthLogDetail: builder.query({
      query: (id) => `/admin/auth-logs/${id}`,
      providesTags: (result, error, id) => [{ type: "AuthLog", id }],
    }),

    // =========================
    // EVALUATOR MANAGEMENT (mới)
    // =========================
    /** Danh sách evaluator + filter */
    getEvaluators: builder.query({
      query: ({ page = 1, keyword = "", province, sport } = {}) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (keyword) params.set("keyword", keyword);
        if (province) params.set("province", province);
        if (sport) params.set("sport", sport);
        return `/admin/evaluators?${params.toString()}`;
      },
      // dùng chung tag "User" để tự động refetch các bảng liên quan
      providesTags: ["User"],
      keepUnusedDataFor: 30,
    }),

    /** Cập nhật phạm vi chấm (nhiều tỉnh + nhiều môn) */
    updateEvaluatorScopes: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/evaluators/${id}/scopes`,
        method: "PATCH",
        body, // { provinces: string[], sports: string[] }
      }),
      invalidatesTags: ["User"],
    }),

    /** Promote user -> evaluator */
    promoteToEvaluator: builder.mutation({
      query: ({ idOrEmail, provinces, sports }) => ({
        url: `/admin/evaluators/promote`,
        method: "POST",
        body: { idOrEmail, provinces, sports },
      }),
      invalidatesTags: ["User"],
    }),

    /** Demote evaluator -> role khác (mặc định: user) */
    demoteEvaluator: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/evaluators/${id}/demote`,
        method: "PATCH",
        body: body ?? { toRole: "user" },
      }),
      invalidatesTags: ["User"],
    }),
    changeUserPassword: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/users/${id}/password`,
        method: "PATCH",
        body, // { newPassword: string }
      }),
    }),
    backfillCccd: builder.mutation({
      query: ({ limit = 10, dryRun = true } = {}) => ({
        // Nếu router backend là: app.use("/api/users", userRoutes);
        // và route là: router.post("/admin/cccd-backfill", ...);
        url: `/admin/users/cccd-backfill?limit=${limit}&dryRun=${dryRun ? 1 : 0}`,
        method: "POST",
      }),
    }),
    // === NEW: auto-fill CCCD cho từng user ===
    fillCccdForUser: builder.mutation({
      query: ({ id, dryRun = false, overwrite = false }) => ({
        url: `/admin/users/${id}/ai-cccd`,
        method: "POST",
        body: { dryRun, overwrite },
      }),
    }),
    batchFillCccdForUsers: builder.mutation({
      query: ({ ids = [], dryRun = false, overwrite = false }) => ({
        url: "/admin/users/ai-cccd-batch",
        method: "POST",
        body: { ids, dryRun, overwrite },
      }),
    }),

    // ✅ Audit: summary nhóm theo user
    getAuditUsersSummary: builder.query({
      query: ({ page = 1, limit = 20, q, action, from, to, category, actorId }) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (q) params.set("q", q);
        if (action) params.set("action", action);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (category) params.set("category", category);
        if (actorId) params.set("actorId", actorId);

        return { url: `/audit/users/summary?${params.toString()}`, method: "GET" };
      },
    }),

    // ✅ Audit: list log của 1 user (mở rộng filter)
    getUserAudit: builder.query({
      query: ({ userId, page = 1, limit = 20, action, from, to, category, actorId, field }) => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (action) params.set("action", action);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (category) params.set("category", category);
        if (actorId) params.set("actorId", actorId);
        if (field) params.set("field", field);

        return { url: `/audit/users/${userId}?${params.toString()}`, method: "GET" };
      },
    }),
    getAvatarOptimizationStatus: builder.query({
      query: () => ({
        url: "/admin/avatar-optimization/status",
        method: "GET",
      }),
      keepUnusedDataFor: 5,
    }),
    runAvatarOptimizationSweep: builder.mutation({
      query: () => ({
        url: "/admin/avatar-optimization/run",
        method: "POST",
      }),
    }),
    runAvatarOptimizationCleanup: builder.mutation({
      query: () => ({
        url: "/admin/avatar-optimization/cleanup",
        method: "POST",
      }),
    }),
  }),
});

export const {
  // users
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserSuperAdminMutation,
  useUpdateUserCoachMutation,
  useListCoachApplicationsQuery,
  useApproveCoachApplicationMutation,
  useRejectCoachApplicationMutation,
  useListCoachAchievementsQuery,
  useApproveCoachAchievementMutation,
  useRejectCoachAchievementMutation,
  usePatchCoachAchievementMutation,
  useAdminCreateCoachAchievementMutation,
  useDeleteUserMutation,
  useReviewKycMutation,
  useUpdateUserInfoMutation,
  useVerifyUserPhoneMutation,
  useSetUserPhoneRequiredMutation,
  useUpdateRankingMutation,
  useGetSelfAssessmentsQuery,
  useResetSelfAssessmentsMutation,
  useGetAssessmentHistoryQuery,
  useGetAuthLogsQuery,
  useGetAuthLogDetailQuery,

  // evaluators
  useGetEvaluatorsQuery,
  useUpdateEvaluatorScopesMutation,
  usePromoteToEvaluatorMutation,
  useDemoteEvaluatorMutation,
  useChangeUserPasswordMutation,
  useBackfillCccdMutation,
  useFillCccdForUserMutation,
  useBatchFillCccdForUsersMutation,
  useGetAuditUsersSummaryQuery,
  useGetUserAuditQuery,
  useGetAvatarOptimizationStatusQuery,
  useRunAvatarOptimizationSweepMutation,
  useRunAvatarOptimizationCleanupMutation,
} = adminApiSlice;
