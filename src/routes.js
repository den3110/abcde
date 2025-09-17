// src/routes.js
import Dashboard from "layouts/dashboard";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import UserManagement from "layouts/user/UserListPage";

// 🆕 Trang quản trị giải đấu
import TournamentsListPage from "layouts/tournament/TournamentsListPage";
import TournamentFormPage from "layouts/tournament/TournamentFormPage";
import AdminTournamentRegistrations from "layouts/tournament/AdminTournamentRegistrations";
import AdminBracketsPage from "layouts/tournament/AdminBracketsPage";

// 🆕 Trận đấu (admin)
import AdminMatchesList from "layouts/match/AdminMatchesList";

// 🆕 Trọng tài
import Icon from "@mui/material/Icon";
import AdminTournamentMatches from "layouts/tournament/AdminTournamentMatches";
import TournamentBracketView from "layouts/tournament/TournamentBracketView";
import AdminRefereeConsole from "layouts/tournament/referee/AdminRefereeConsole";
import RefereeMatches from "layouts/tournament/referee/RefereeMatches";

// 🆕 Cấu hình thuật toán bốc thăm (Admin)
import AlgoSettingsPage from "layouts/tournament/AlgoSettingsPage"; // <— THÊM DÒNG NÀY
import AutoUserPage from "layouts/auto/AutoUserPage";
import CmsHeroEditor from "layouts/CmsHeroEditor";
import CmsContactEditor from "layouts/CmsContactEditor";
import AdminRefereeMatches from "layouts/tournament/referee/AdminRefereeMatches";
import TournamentBlueprintPage from "layouts/tournament/TournamentBlueprintPage";
import AutoRegistrationsPage from "layouts/tournament/AutoRegistrationsPage";
import AdminOverlayPage from "layouts/tournament/OverlayTab";
import GlobalMatchViewerPage from "layouts/match/GlobalMatchViewerPage";
import AdminMatchDetailPage from "layouts/match/AdminMatchDetailPage";
import AdminCourtManagerPage from "layouts/tournament/AdminCourtManagerPage";
import AdminBracketCourtManagerPage from "layouts/tournament/AdminBracketCourtManagerPage";
import RatingTesterPage from "layouts/tools/RatingTesterPage";
import AdminEvaluatorManagement from "layouts/tournament/AdminEvaluatorManagement";
import GroupPreassignBoard from "layouts/tournament/GroupPreassignBoard";
import BroadcastPage from "layouts/Notifications/Broadcast";
import AdminInsertIntoGroupPage from "layouts/tournament/AdminInsertIntoGroupPage";
import AdminAppVersionPage from "layouts/AdminAppVersionPage";
// nếu bạn đặt file ở "pages/admin/AlgoSettingsPage.jsx" thì đổi import cho đúng

const routes = [
  // Dashboard
  {
    type: "collapse",
    name: "Bảng điều khiển",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
    roles: ["admin"],
    private: true,
  },

  // Xác thực (ẩn)
  {
    show: false,
    type: "collapse",
    name: "Đăng nhập",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    show: false,
    type: "collapse",
    name: "Đăng ký",
    key: "sign-up",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/authentication/sign-up",
    component: <SignUp />,
  },

  // Quản lý người dùng (Admin)
  {
    type: "collapse",
    name: "Quản lý người dùng",
    key: "user-management",
    icon: <Icon fontSize="small">people</Icon>,
    route: "/users",
    component: <UserManagement />,
    private: true,
    roles: ["admin"],
  },

  // 🆕 Người chấm trình (Admin)
  {
    type: "collapse",
    name: "Người chấm trình",
    key: "evaluator-management",
    icon: <Icon fontSize="small">how_to_reg</Icon>,
    route: "/admin/evaluators",
    component: <AdminEvaluatorManagement />,
    private: true,
    roles: ["admin"],
  },

  // Giải đấu (Admin)
  {
    type: "collapse",
    name: "Giải đấu",
    key: "tournaments",
    icon: <Icon fontSize="small">emoji_events</Icon>,
    route: "/admin/tournaments",
    component: <TournamentsListPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Tạo giải đấu",
    key: "tournament-new",
    route: "/admin/tournaments/new",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Sửa giải đấu",
    key: "tournament-edit",
    route: "/admin/tournaments/:id/edit",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Danh sách đăng ký",
    key: "tournament-registrations",
    route: "/admin/tournaments/:id/registrations",
    component: <AdminTournamentRegistrations />,
    private: true,
    roles: ["admin"],
  },

  // Nhánh/Bảng đấu theo giải (Admin)
  {
    show: false,
    type: "collapse",
    name: "Nhánh/Bảng đấu",
    key: "tournament-brackets",
    route: "/admin/tournaments/:id/brackets",
    component: <AdminBracketsPage />,
    private: true,
    roles: ["admin"],
  },

  // Trận đấu (Admin)
  {
    type: "collapse",
    name: "Trận đấu",
    key: "admin-matches",
    icon: <Icon fontSize="small">sports_tennis</Icon>,
    route: "/admin/matches",
    component: <AdminMatchesList />,
    private: true,
    roles: ["admin"],
  },

  // 🆕 GLOBAL VIEWER – xuất hiện trên sidebar để click vào
  {
    type: "collapse",
    name: "Xem trận (Global)",
    key: "match-viewer",
    icon: <Icon fontSize="small">visibility</Icon>,
    route: "/match-viewer",
    component: <GlobalMatchViewerPage />,
    private: true, // hoặc false nếu muốn public
    roles: ["admin"], // ai được thấy trên sidebar
  },

  // 🆕 CHI TIẾT TRẬN – ẩn khỏi sidebar (đi từ viewer hoặc list)
  {
    show: false,
    type: "collapse",
    name: "Chi tiết trận",
    key: "admin-match-detail",
    route: "/admin/matches/:id",
    component: <AdminMatchDetailPage />,
    private: true,
    roles: ["admin"],
  },

  {
    type: "collapse",
    name: "Cấu hình phiên bản app",
    key: "admin-app-version",
    icon: <Icon fontSize="small">system_update</Icon>,
    route: "/admin/app-version",
    component: <AdminAppVersionPage />,
    private: true,
    roles: ["admin"],
  },

  // 🆕 Tham số thuật toán (Admin)
  {
    type: "collapse",
    name: "Tham số thuật toán",
    key: "algo-settings",
    icon: <Icon fontSize="small">tune</Icon>,
    route: "/admin/algo-settings",
    component: <AlgoSettingsPage />,
    private: true,
    roles: ["admin"],
  },
  {
    type: "collapse",
    name: "Cấu hình Overlay",
    key: "overlay-index",
    icon: <Icon fontSize="small">palette</Icon>,
    route: "/admin/overlay",
    component: <AdminOverlayPage />,
    private: true,
    roles: ["admin"],
    show: true, // hiện trên sidebar
  },
  // 🆕 Tạo user tự động (Admin)
  {
    type: "collapse",
    name: "Tạo user tự động",
    key: "auto-users",
    icon: <Icon fontSize="small">person_add</Icon>,
    route: "/admin/auto-users",
    component: <AutoUserPage />,
    private: true,
    roles: ["admin"],
  },
  // Màn hình cho trọng tài và các view liên quan
  {
    show: false,
    type: "collapse",
    name: "Trận đấu của giải",
    key: "tournament-matches",
    route: "/admin/tournaments/:id/matches",
    component: <AdminTournamentMatches />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Xem sơ đồ nhánh",
    key: "tournament-bracket-view",
    route: "/admin/tournaments/:id/bracket",
    component: <TournamentBracketView />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Cơ cấu vòng bảng",
    key: "bracket-preassign",
    route: "/admin/brackets/:bracketId/preassign",
    component: <GroupPreassignBoard />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Bảng điều khiển trọng tài (Trận)",
    key: "admin-referee-console-match",
    route: "/admin/referee/matches/:matchId",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  {
    show: false,
    type: "collapse",
    name: "Bảng điều khiển trọng tài",
    key: "admin-referee-console",
    route: "/admin/referee/console",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  // 🆕 Trang admin: danh sách trận đã gán trọng tài (có lọc & autocomplete trọng tài)
  {
    type: "collapse",
    name: "Trận trọng tài (Admin)",
    key: "admin-referee-matches",
    icon: <Icon fontSize="small">assignment_ind</Icon>,
    route: "/admin/referee/matches",
    component: <AdminRefereeMatches />,
    private: true,
    roles: ["admin"],
  },
  {
    type: "collapse",
    name: "Trọng tài",
    key: "referee-matches",
    icon: <Icon fontSize="small">sports_score</Icon>,
    route: "/referee/matches",
    component: <RefereeMatches />,
    private: true,
    roles: ["referee"],
  },
  {
    type: "collapse",
    name: "CMS Hero",
    key: "cms-hero",
    icon: <Icon fontSize="small">image</Icon>,
    route: "/admin/cms/hero",
    component: <CmsHeroEditor />,
    private: true,
    roles: ["admin"],
  },
  {
    type: "collapse",
    name: "CMS Contact",
    key: "cms-contact",
    icon: <Icon fontSize="small">contact_mail</Icon>,
    route: "/admin/cms/contact",
    component: <CmsContactEditor />,
    private: true,
    roles: ["admin"],
  },
  // 🆕 Tạo sơ đồ giải đấu theo quy mô (Admin)
  {
    show: false,
    type: "collapse",
    name: "Tạo sơ đồ giải",
    key: "tournament-blueprint",
    route: "/admin/tournaments/:id/blueprint",
    component: <TournamentBlueprintPage />,
    private: true,
    roles: ["admin"],
  },
  // 🆕 Đăng ký tự động (hiện trên sidebar) — chỉ 1 route
  {
    type: "collapse",
    name: "Đăng ký tự động",
    key: "auto-registrations",
    icon: <Icon fontSize="small">how_to_reg</Icon>,
    route: "/admin/auto-registrations",
    component: <AutoRegistrationsPage />,
    private: true,
    roles: ["admin"],
  },
  // {
  //   show: false,
  //   type: "collapse",
  //   name: "Quản lý sân & hàng đợi",
  //   key: "admin-courts-scheduler",
  //   route: "/admin/tournaments/:tournamentId/courts",
  //   component: <AdminCourtManagerPage />,
  //   private: true,
  //   roles: ["admin"],
  // },
  {
    show: false,
    type: "collapse",
    name: "Quản lý sân (Bracket)",
    key: "admin-bracket-courts",
    route: "/admin/brackets/:bracketId/courts",
    component: <AdminBracketCourtManagerPage />,
    private: true,
    roles: ["admin"],
  },
  {
    type: "collapse",
    name: "Test tính điểm",
    key: "rating-tester",
    icon: <Icon fontSize="small">calculate</Icon>,
    route: "/admin/tools/rating-tester",
    component: <RatingTesterPage />,
    private: true,
    roles: ["admin"],
  },
  {
    type: "collapse",
    name: "Gửi thông báo",
    key: "admin-broadcast",
    icon: <Icon fontSize="small">campaign</Icon>,
    route: "/admin/notifications/broadcast",
    component: <BroadcastPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Chèn đội & bù trận (Vòng bảng)",
    key: "bracket-group-insert",
    route: "/admin/brackets/:bracketId/groups/insert",
    component: <AdminInsertIntoGroupPage />,
    private: true,
    roles: ["admin"],
  },
];

export default routes;
