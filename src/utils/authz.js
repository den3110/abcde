const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

export function getUserRoles(user) {
  if (!user) return [];
  const roles = new Set([
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(typeof user.role === "string" ? [user.role] : []),
  ]);

  if (user.isAdmin) roles.add("admin");
  if (user.isSuperUser || user.isSuperAdmin) {
    roles.add("superadmin");
    roles.add("superuser");
    roles.add("admin");
  }

  return Array.from(roles).map(normalizeRole).filter(Boolean);
}

export function hasAnyRole(user, allowed = []) {
  if (!allowed || allowed.length === 0) return true; // route không set roles => ai login cũng vào
  const roles = getUserRoles(user);
  const wanted = allowed.map(normalizeRole).filter(Boolean);
  return wanted.some((r) => roles.includes(r));
}

// chỉ lấy các route hiển thị lên Sidenav theo role
export function filterRoutesForNav(routes, user) {
  return routes
    .filter((r) => r.type === "collapse") // chỉ mục có trên menu
    .filter((r) => r.show !== false) // tôn trọng show: false
    .filter((r) => (r.private ? !!user : true)) // mục private => cần login
    .filter((r) => hasAnyRole(user, r.roles)); // lọc theo roles
}
