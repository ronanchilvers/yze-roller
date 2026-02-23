import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ApiClientError,
  apiFetch,
  apiPost,
  parseApiErrorEnvelope,
} from "./api-client.js";

const createJsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

test("apiFetch composes URLs and parses successful JSON responses", async () => {
  let capturedUrl = "";
  let capturedInit = null;

  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return createJsonResponse({ ok: true, value: 3 }, 200);
  };

  const result = await apiFetch("/session", {
    token: "abc123",
    fetchImpl,
    env: {
      VITE_API_BASE_URL: "https://api.example.com/api/",
    },
  });

  assert.equal(capturedUrl, "https://api.example.com/api/session");
  assert.equal(capturedInit.method, "GET");
  assert.equal(capturedInit.headers.Authorization, "Bearer abc123");
  assert.deepEqual(result.data, { ok: true, value: 3 });
  assert.equal(result.status, 200);
});

test("apiPost sends JSON body and content type", async () => {
  let capturedInit = null;

  const fetchImpl = async (_url, init) => {
    capturedInit = init;
    return createJsonResponse({ created: true }, 201);
  };

  const payload = {
    type: "roll",
    payload: {
      successes: 1,
      banes: 0,
    },
  };

  const result = await apiPost("/events", payload, {
    fetchImpl,
    env: {},
  });

  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(capturedInit.body), payload);
  assert.equal(result.status, 201);
  assert.deepEqual(result.data, { created: true });
});

test("apiFetch handles 204 responses without JSON body", async () => {
  const fetchImpl = async () => new Response(null, { status: 204 });

  const result = await apiFetch("/events?since_id=10", {
    fetchImpl,
    env: {},
  });

  assert.equal(result.status, 204);
  assert.equal(result.data, null);
});

test("apiFetch throws ApiClientError using contract envelope", async () => {
  const fetchImpl = async () =>
    createJsonResponse(
      {
        error: {
          code: "TOKEN_REVOKED",
          message: "Session token is revoked.",
          details: {
            token_id: 31,
          },
        },
      },
      403,
    );

  await assert.rejects(
    () =>
      apiFetch("/session", {
        fetchImpl,
        env: {},
      }),
    (error) => {
      assert.equal(error instanceof ApiClientError, true);
      assert.equal(error.status, 403);
      assert.equal(error.code, "TOKEN_REVOKED");
      assert.equal(error.message, "Session token is revoked.");
      assert.deepEqual(error.details, { token_id: 31 });
      return true;
    },
  );
});

test(
  "apiFetch falls back to HTTP_<status> when error envelope is missing",
  async () => {
    const fetchImpl = async () =>
      createJsonResponse(
        {
          status: "error",
        },
        500,
      );

    await assert.rejects(
      () =>
        apiFetch("/session", {
          fetchImpl,
          env: {},
        }),
      (error) => {
        assert.equal(error instanceof ApiClientError, true);
        assert.equal(error.status, 500);
        assert.equal(error.code, "HTTP_500");
        assert.equal(error.message, "Request failed with status 500.");
        return true;
      },
    );
  },
);

test(
  "apiFetch falls back to HTTP_<status> when error body is non-json",
  async () => {
    const fetchImpl = async () =>
      new Response("upstream unavailable", {
        status: 503,
        headers: {
          "Content-Type": "text/plain",
        },
      });

    await assert.rejects(
      () =>
        apiFetch("/session", {
          fetchImpl,
          env: {},
        }),
      (error) => {
        assert.equal(error instanceof ApiClientError, true);
        assert.equal(error.status, 503);
        assert.equal(error.code, "HTTP_503");
        assert.equal(error.message, "Request failed with status 503.");
        return true;
      },
    );
  },
);

test("apiFetch throws RESPONSE_INVALID when body is malformed JSON", async () => {
  const fetchImpl = async () =>
    new Response("{broken-json", {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  await assert.rejects(
    () =>
      apiFetch("/session", {
        fetchImpl,
        env: {},
      }),
    (error) => {
      assert.equal(error instanceof ApiClientError, true);
      assert.equal(error.code, "RESPONSE_INVALID");
      assert.equal(error.status, 200);
      return true;
    },
  );
});

test("parseApiErrorEnvelope returns null for malformed payloads", () => {
  assert.equal(parseApiErrorEnvelope(null), null);
  assert.equal(parseApiErrorEnvelope({}), null);
  assert.equal(
    parseApiErrorEnvelope({ error: { code: "", message: "x" } }),
    null,
  );
  assert.equal(
    parseApiErrorEnvelope({ error: { code: "TOKEN_INVALID", message: "" } }),
    null,
  );
});
