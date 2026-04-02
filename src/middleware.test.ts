import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jwtVerifyMock: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: mocks.jwtVerifyMock,
}));

import { middleware } from "../middleware";

const initialMaintenanceMode = process.env.APP_MAINTENANCE_MODE;

function makeRequest(url: string, token?: string) {
  const headers = token ? new Headers({ cookie: `ege_auth=${token}` }) : new Headers();
  return new NextRequest(url, { headers });
}

afterEach(() => {
  process.env.APP_MAINTENANCE_MODE = initialMaintenanceMode;
});

describe("middleware role guards", () => {
  it("returns 503 for API when maintenance mode is enabled", async () => {
    process.env.APP_MAINTENANCE_MODE = "1";
    const response = await middleware(makeRequest("http://localhost/api/admin/wallets", "token_admin"));
    expect(response.status).toBe(503);
  });

  it("redirects page requests to /maintenance when maintenance mode is enabled", async () => {
    process.env.APP_MAINTENANCE_MODE = "1";
    const response = await middleware(makeRequest("http://localhost/dashboard", "token_student"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/maintenance");
  });

  it("blocks student from /api/admin/wallets", async () => {
    mocks.jwtVerifyMock.mockResolvedValueOnce({
      payload: { role: "student", sub: "u1", email: "student@example.com" },
    });
    const response = await middleware(makeRequest("http://localhost/api/admin/wallets", "token_student"));
    expect(response.status).toBe(403);
  });

  it("allows tutor to /api/admin/tutors", async () => {
    mocks.jwtVerifyMock.mockResolvedValueOnce({
      payload: { role: "tutor", sub: "u2", email: "tutor@ege.local" },
    });
    const response = await middleware(makeRequest("http://localhost/api/admin/tutors", "token_tutor"));
    expect(response.status).toBe(200);
  });

  it("redirects tutor away from /admin page", async () => {
    mocks.jwtVerifyMock.mockResolvedValueOnce({
      payload: { role: "tutor", sub: "u2", email: "tutor@ege.local" },
    });
    const response = await middleware(makeRequest("http://localhost/admin", "token_tutor"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("redirects unauthenticated user to /login for /admin", async () => {
    const response = await middleware(makeRequest("http://localhost/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("blocks student from tutor LMS api", async () => {
    mocks.jwtVerifyMock.mockResolvedValueOnce({
      payload: { role: "student", sub: "u1", email: "student@example.com" },
    });
    const response = await middleware(makeRequest("http://localhost/api/tutor/lms/courses", "token_student"));
    expect(response.status).toBe(403);
  });

  it("allows tutor to /tutor page", async () => {
    mocks.jwtVerifyMock.mockResolvedValueOnce({
      payload: { role: "tutor", sub: "u2", email: "tutor@ege.local" },
    });
    const response = await middleware(makeRequest("http://localhost/tutor", "token_tutor"));
    expect(response.status).toBe(200);
  });
});
