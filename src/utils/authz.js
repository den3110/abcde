export const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

export function isAdminUser(user) {
  if (!user) return false;

  const roles = new Set([
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(typeof user.role === "string" ? [user.role] : []),
  ]);

  if (user.isAdmin) roles.add("admin");

  return Array.from(roles).map(normalizeRole).includes("admin");
}

export function isStrictSuperAdminUser(user) {
  return isAdminUser(user) && Boolean(user?.isSuperUser || user?.isSuperAdmin);
}

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
  if (!allowed || allowed.length === 0) return true;

  const roles = getUserRoles(user);
  const wanted = allowed.map(normalizeRole).filter(Boolean);

  return wanted.some((role) => roles.includes(role));
}

export function filterRoutesForNav(routes, user) {
  return routes
    .filter((route) => route.type === "collapse")
    .filter((route) => route.show !== false)
    .filter((route) => (route.private ? !!user : true))
    .filter((route) => (route.requireAdminAndSuperAdmin ? isStrictSuperAdminUser(user) : true))
    .filter((route) => hasAnyRole(user, route.roles));
}
