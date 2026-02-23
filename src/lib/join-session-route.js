const trimSlashes = (value) => value.replace(/\/+$/, "");

export const normalizePathname = (pathname) => {
  if (typeof pathname !== "string") {
    return "/";
  }

  const trimmed = pathname.trim();

  if (!trimmed) {
    return "/";
  }

  const normalized = trimSlashes(trimmed);
  return normalized || "/";
};

export const isJoinSessionPath = (pathname) =>
  normalizePathname(pathname).endsWith("/join");

export const parseJoinTokenFromHash = (hashValue) => {
  if (typeof hashValue !== "string") {
    return null;
  }

  const normalizedHash = hashValue.startsWith("#")
    ? hashValue.slice(1)
    : hashValue;
  const params = new URLSearchParams(normalizedHash);
  const joinToken = params.get("join");

  if (typeof joinToken !== "string") {
    return null;
  }

  const trimmed = joinToken.trim();
  return trimmed || null;
};

export const getSessionPathFromJoinPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);

  if (!isJoinSessionPath(normalizedPath)) {
    return normalizedPath;
  }

  const withoutJoin = normalizedPath.replace(/\/join$/, "");
  return withoutJoin || "/";
};

export const clearLocationHash = (windowLike = window) => {
  if (
    !windowLike ||
    !windowLike.location ||
    typeof windowLike.location.pathname !== "string"
  ) {
    return;
  }

  const search =
    typeof windowLike.location.search === "string"
      ? windowLike.location.search
      : "";
  const nextUrl = `${windowLike.location.pathname}${search}`;

  if (
    windowLike.history &&
    typeof windowLike.history.replaceState === "function"
  ) {
    windowLike.history.replaceState({}, "", nextUrl);
    return;
  }

  try {
    windowLike.location.hash = "";
  } catch {
    // Best-effort fallback: direct hash mutation may be blocked in tests.
  }
};
