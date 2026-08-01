import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ak_sid";
const PERSONA_COOKIE = "ak_persona";
const VALID_PERSONAS = new Set(["priya", "rohit", "ananya", "vikram"]);

export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const cookiesToSet: { name: string; value: string }[] = [];

  let sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sid) {
    sid = crypto.randomUUID();
    cookiesToSet.push({ name: SESSION_COOKIE, value: sid });
  }

  const deepLinkPersona = req.nextUrl.searchParams.get("persona");
  let personaCookieValue = req.cookies.get(PERSONA_COOKIE)?.value;
  if (deepLinkPersona && VALID_PERSONAS.has(deepLinkPersona) && deepLinkPersona !== personaCookieValue) {
    personaCookieValue = deepLinkPersona;
    cookiesToSet.push({ name: PERSONA_COOKIE, value: deepLinkPersona });
  } else if (!personaCookieValue) {
    personaCookieValue = "priya";
    cookiesToSet.push({ name: PERSONA_COOKIE, value: "priya" });
  }

  // Forward the freshly-generated cookies into THIS request's headers too —
  // otherwise the server components rendering this very request would see
  // no cookie at all (Set-Cookie only reaches the browser for the *next*
  // request).
  if (cookiesToSet.length > 0) {
    const existing = requestHeaders.get("cookie") ?? "";
    const additions = cookiesToSet.map((c) => `${c.name}=${c.value}`).join("; ");
    requestHeaders.set("cookie", existing ? `${existing}; ${additions}` : additions);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const c of cookiesToSet) {
    res.cookies.set(c.name, c.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
