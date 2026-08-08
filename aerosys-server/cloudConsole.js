// lib/cloudConsole.js — Client stub for the "auto-scaling microservice
// containers" side of your console. I could NOT inspect its real API (blocked
// by both my sandbox's egress allowlist and its own cookie/auth gate), so
// this is a best-guess REST wrapper using the most common pattern (Bearer
// token + JSON REST), with every endpoint path clearly marked as a guess.
//
// To make this real: open your console's API docs (or its network tab while
// you click around the UI) and tell me the actual paths/payloads — I'll
// replace the guessed paths below with the real ones in minutes.
//
// Setup (add to .env):
//   CLOUD_CONSOLE_BASE_URL=https://ais-dev-ekjyvpxbhltodm3mm2no4m-666971245372.europe-west2.run.app
//   CLOUD_CONSOLE_API_KEY=xxx        // or CLOUD_CONSOLE_ID_TOKEN if it's IAP/IAM-gated

async function consoleFetch(path, options = {}) {
  const base = process.env.CLOUD_CONSOLE_BASE_URL;
  if (!base) throw new Error('CLOUD_CONSOLE_BASE_URL not set in environment.');

  const authHeader = process.env.CLOUD_CONSOLE_API_KEY
    ? { Authorization: `Bearer ${process.env.CLOUD_CONSOLE_API_KEY}` }
    : process.env.CLOUD_CONSOLE_ID_TOKEN
    ? { Authorization: `Bearer ${process.env.CLOUD_CONSOLE_ID_TOKEN}` }
    : {};

  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers || {}) },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Cloud console request failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return resp.json();
}

// GUESSED endpoint — replace with the real path once known
export async function listContainers() {
  return consoleFetch('/api/v1/containers');
}

// GUESSED endpoint
export async function getContainerStatus(id) {
  return consoleFetch(`/api/v1/containers/${id}/status`);
}

// GUESSED endpoint
export async function deployContainer({ name, image, env }) {
  return consoleFetch('/api/v1/containers', {
    method: 'POST',
    body: JSON.stringify({ name, image, env }),
  });
}

// GUESSED endpoint
export async function scaleContainer(id, replicas) {
  return consoleFetch(`/api/v1/containers/${id}/scale`, {
    method: 'PATCH',
    body: JSON.stringify({ replicas }),
  });
}
