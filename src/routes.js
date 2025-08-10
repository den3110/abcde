// src/routes.js
import Dashboard from "layouts/dashboard";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";
import SignIn from "layouts/authentication/sign-in";
import SignUp from "layouts/authentication/sign-up";
import UserManagement from "layouts/user/UserListPage";

// 🆕 Admin tournament pages
import TournamentsListPage from "layouts/tournament/TournamentsListPage";
import TournamentFormPage from "layouts/tournament/TournamentFormPage";
import AdminTournamentRegistrations from "layouts/tournament/AdminTournamentRegistrations";
import AdminBracketsPage from "layouts/tournament/AdminBracketsPage";

// 🆕 Matches (admin)
import AdminMatchesList from "layouts/match/AdminMatchesList";

// 🆕 Referee

import Icon from "@mui/material/Icon";
import AdminTournamentMatches from "layouts/tournament/AdminTournamentMatches";
import BracketViewPage from "layouts/tournament/BracketViewPage";
import TournamentBracketView from "layouts/tournament/TournamentBracketView";
import AdminRefereeConsole from "layouts/tournament/referee/AdminRefereeConsole";
import RefereeMatches from "layouts/tournament/referee/RefereeMatches";

const routes = [
  // Dashboard
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
    private: true,
  },

  // Auth (ẩn)
  {
    show: false,
    type: "collapse",
    name: "Sign In",
    key: "sign-in",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    show: false,
    type: "collapse",
    name: "Sign Up",
    key: "sign-up",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/authentication/sign-up",
    component: <SignUp />,
  },

  // User management (Admin)
  {
    type: "collapse",
    name: "User Management",
    key: "user-management",
    icon: <Icon fontSize="small">people</Icon>,
    route: "/users",
    component: <UserManagement />,
    private: true,
    roles: ["admin"],
  },

  // Tournaments (Admin)
  {
    type: "collapse",
    name: "Tournaments",
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
    name: "Create Tournament",
    key: "tournament-new",
    route: "/admin/tournaments/new",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Edit Tournament",
    key: "tournament-edit",
    route: "/admin/tournaments/:id/edit",
    component: <TournamentFormPage />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Registrations",
    key: "tournament-registrations",
    route: "/admin/tournaments/:id/registrations",
    component: <AdminTournamentRegistrations />,
    private: true,
    roles: ["admin"],
  },

  // Brackets per tournament (Admin)
  {
    show: false,
    type: "collapse",
    name: "Brackets",
    key: "tournament-brackets",
    route: "/admin/tournaments/:id/brackets",
    component: <AdminBracketsPage />,
    private: true,
    roles: ["admin"],
  },

  // Matches (Admin)
  {
    type: "collapse",
    name: "Matches",
    key: "admin-matches",
    icon: <Icon fontSize="small">sports_tennis</Icon>,
    route: "/admin/matches",
    component: <AdminMatchesList />,
    private: true,
    roles: ["admin"],
  },

  // Referee view
  // {
  //   type: "collapse",
  //   name: "Referee",
  //   key: "referee-matches",
  //   icon: <Icon fontSize="small">sports_score</Icon>,
  //   route: "/referee/matches",
  //   component: <RefereeMatches />,
  //   private: true,
  //   roles: ["referee", "admin"],
  // },
  {
    show: false,
    type: "collapse",
    name: "Tournament Matches",
    key: "tournament-matches",
    route: "/admin/tournaments/:id/matches",
    component: <AdminTournamentMatches />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Bracket View",
    key: "tournament-bracket-view",
    route: "/admin/tournaments/:id/bracket",
    component: <TournamentBracketView />,
    private: true,
    roles: ["admin"],
  },
  {
    show: false,
    type: "collapse",
    name: "Referee Console (Match)",
    key: "admin-referee-console-match",
    route: "/admin/referee/matches/:matchId",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  {
    show: false,
    type: "collapse",
    name: "Referee Console",
    key: "admin-referee-console",
    route: "/admin/referee/console",
    component: <AdminRefereeConsole />,
    private: true,
    roles: ["admin", "referee"],
  },
  {
    type: "collapse",
    name: "Referee",
    key: "referee-matches",
    icon: <Icon fontSize="small">sports_score</Icon>,
    route: "/referee/matches",
    component: <RefereeMatches />,
    private: true,
    roles: ["referee"], // chỉ trọng tài thấy
  },
];

export default routes;
