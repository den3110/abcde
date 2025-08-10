export function getUserRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) return user.roles;
  if (typeof user.role === "string") return [user.role];
  return [];
}

export function hasAnyRole(user, allowed = []) {
  if (!allowed || allowed.length === 0) return true; // route không set roles => ai login cũng vào
  const roles = getUserRoles(user);
  return roles.some((r) => allowed.includes(r));
}

// chỉ lấy các route hiển thị lên Sidenav theo role
export function filterRoutesForNav(routes, user) {
  return routes
    .filter((r) => r.type === "collapse") // chỉ mục có trên menu
    .filter((r) => r.show !== false) // tôn trọng show: false
    .filter((r) => (r.private ? !!user : true)) // mục private => cần login
    .filter((r) => hasAnyRole(user, r.roles)); // lọc theo roles
}
