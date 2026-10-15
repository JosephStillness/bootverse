export function authConfigured() {
  const { DATABASE_URL, AUTH_SECRET, AUTH_URL, EMAIL_SERVER, EMAIL_FROM } =
    process.env;
  if (
    !DATABASE_URL ||
    !AUTH_SECRET ||
    AUTH_SECRET.length < 32 ||
    !AUTH_URL ||
    !EMAIL_SERVER ||
    !EMAIL_FROM
  )
    return false;
  try {
    const smtp = new URL(EMAIL_SERVER);
    if (
      !["smtp:", "smtps:"].includes(smtp.protocol) ||
      !smtp.hostname ||
      (smtp.hostname === "smtp.resend.com" &&
        (smtp.username !== "resend" || !smtp.password))
    )
      return false;
    const url = new URL(AUTH_URL);
    return (
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

export function sameOriginRequest(request: Request) {
  try {
    const origin = new URL(process.env.AUTH_URL ?? "").origin;
    return (
      new URL(request.url).origin === origin &&
      request.headers.get("origin") === origin
    );
  } catch {
    return false;
  }
}
