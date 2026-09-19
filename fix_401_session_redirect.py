"""
Fixes the "my profile disappeared" report: the real cause is that JWT
tokens expire after 7 days, and nothing in the app was handling a 401
("Session expired") response — pages just silently failed and showed
blank state, which looked identical to lost data.

This adds a global handler in the one place all API calls pass through:
on any 401, clear the stale token and send the user back to the login
screen with a clear message, instead of leaving them on a broken page.

Run from O-frontend:
    python3 fix_401_session_redirect.py
"""

with open("src/api.ts") as f:
    content = f.read()

old = '''      if (!res.ok) {
        // 4xx — client error, never retry
        if (res.status >= 400 && res.status < 500) {
          emitStatus("ok"); // server is reachable
          const clientErr = new Error((data as any).error || `Error ${res.status}`);
          (clientErr as any).isClientError = true;
          throw clientErr;
        }
        // 5xx — server error, retry
        throw new Error((data as any).error || `Server error ${res.status}`);
      }'''

new = '''      if (!res.ok) {
        // 401 — the session itself is no longer valid (expired/invalid token).
        // Without this, pages just failed silently and looked like data loss.
        // Clear the stale token and send the user back to log in.
        if (res.status === 401) {
          emitStatus("ok"); // server is reachable — this is an auth issue, not connectivity
          clearToken();
          const authErr = new Error((data as any).error || "Your session has expired. Please log in again.");
          (authErr as any).isClientError = true;
          (authErr as any).isAuthError = true;
          if (typeof window !== "undefined") {
            setTimeout(() => { window.location.href = "/"; }, 400);
          }
          throw authErr;
        }
        // 4xx — client error, never retry
        if (res.status >= 400 && res.status < 500) {
          emitStatus("ok"); // server is reachable
          const clientErr = new Error((data as any).error || `Error ${res.status}`);
          (clientErr as any).isClientError = true;
          throw clientErr;
        }
        // 5xx — server error, retry
        throw new Error((data as any).error || `Server error ${res.status}`);
      }'''

count = content.count(old)
assert count == 1, f"expected 1 match, found {count}"
content = content.replace(old, new)

with open("src/api.ts", "w") as f:
    f.write(content)
print("done")
