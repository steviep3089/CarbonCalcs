export type AdminAccessRole = "admin" | "user";

type AuthUserLike = {
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
} | null | undefined;

export function getAdminAccessRole(user: AuthUserLike): AdminAccessRole {
  const rawRole = user?.user_metadata?.role ?? user?.app_metadata?.role;

  if (typeof rawRole === "string" && rawRole.trim().toLowerCase() === "user") {
    return "user";
  }

  return "admin";
}

export function canManageAdminData(user: AuthUserLike) {
  return getAdminAccessRole(user) === "admin";
}

export function getAdminAccessLabel(user: AuthUserLike) {
  return getAdminAccessRole(user) === "admin" ? "Admin" : "User";
}
