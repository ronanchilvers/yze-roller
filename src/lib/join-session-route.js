const trimSlashes = (value) => value.replace(/\/+$/, "");
const hasWhitespace = (value) => /\s/.test(value);
const isUrlLikeInput = (value) =>
  /^(https?:)?\/\//i.test(value) || value.startsWith("/") || value.includes("#") ||
  value.includes("?");

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

export const parseJoinTokenFromInviteInput = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const directHashToken = parseJoinTokenFromHash(trimmed);
  if (directHashToken) {
    return directHashToken;
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex >= 0) {
    const tokenFromHash = parseJoinTokenFromHash(trimmed.slice(hashIndex));
    if (tokenFromHash) {
      return tokenFromHash;
    }
  }

  const parseFromUrl = (nextValue) => {
    try {
      const url = new URL(nextValue);
      const hashToken = parseJoinTokenFromHash(url.hash);
      if (hashToken) {
        return hashToken;
      }

      const queryToken = url.searchParams.get("join");
      if (typeof queryToken !== "string") {
        return null;
      }

      const normalized = queryToken.trim();
      return normalized || null;
    } catch {
      return null;
    }
  };

  const absoluteUrlToken = parseFromUrl(trimmed);
  if (absoluteUrlToken) {
    return absoluteUrlToken;
  }

  const relativeUrlToken = parseFromUrl(`https://join-token.invalid${trimmed}`);
  if (relativeUrlToken) {
    return relativeUrlToken;
  }

  if (isUrlLikeInput(trimmed) || hasWhitespace(trimmed)) {
    return null;
  }

  return trimmed;
};

export const getSessionPathFromJoinPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);

  if (!isJoinSessionPath(normalizedPath)) {
    return normalizedPath;
  }

  const withoutJoin = normalizedPath.replace(/\/join$/, "");
  return withoutJoin || "/";
};

export const buildJoinPathWithToken = (pathname, joinToken) => {
  if (typeof joinToken !== "string") {
    return null;
  }

  const normalizedToken = joinToken.trim();
  if (!normalizedToken) {
    return null;
  }

  const sessionPath = getSessionPathFromJoinPath(pathname);
  const joinPath = sessionPath === "/" ? "/join" : `${sessionPath}/join`;
  const encodedToken = encodeURIComponent(normalizedToken);

  return `${joinPath}#join=${encodedToken}`;
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
