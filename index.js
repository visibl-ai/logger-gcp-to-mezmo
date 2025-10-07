// Cloud Functions (Gen2) - Pub/Sub trigger (Node.js 20+)
// Preserves ALL GCP log fields nested under meta.gcp (no flattening)

const MEZMO_URL = process.env.MEZMO_URL || "https://logs.logdna.com/logs/ingest";
const MEZMO_KEY = process.env.MEZMO_KEY; // Ingestion key (Basic Auth)

// --- helpers ---
function redactApiKeys(obj) {
  try {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => redactApiKeys(item));
    }

    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith('API_KEY')) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactApiKeys(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  } catch {
    return obj;
  }
}

function toMillis(ts) {
  try {
    return ts ? Date.parse(ts) || Date.now() : Date.now();
  } catch {
    return Date.now();
  }
}

function pickApp(entry) {
  return (
    entry?.resource?.labels?.service_name ||
    entry?.resource?.labels?.function_name ||
    entry?.resource?.type ||
    "gcp"
  );
}

function pickLine(entry) {
  if (entry.textPayload) return String(entry.textPayload);
  if (entry.jsonPayload) return JSON.stringify(entry.jsonPayload);
  if (entry.protoPayload) return JSON.stringify(entry.protoPayload);
  return JSON.stringify(entry);
}

function gcpLogToLine(entry) {
  const redacted = redactApiKeys(entry);
  return {
    timestamp: toMillis(redacted.timestamp || redacted.receiveTimestamp),
    level: redacted.severity || "INFO",
    app: pickApp(redacted),
    line: pickLine(redacted),
    meta: {
      gcp: redacted, // keep original structure with API keys redacted
    },
  };
}

async function postToMezmo(lines) {
  if (!MEZMO_KEY) throw new Error("MEZMO_KEY env var is required");
  const auth = Buffer.from(`${MEZMO_KEY}:`).toString("base64");
  const res = await fetch(MEZMO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mezmo ingest ${res.status}: ${text || res.statusText}`);
  }
}

// Optional: chunk very large batches defensively (Pub/Sub can coalesce)
async function postInChunks(lines, chunkSize = 500) {
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    // simple retry (3 attempts, backoff)
    let tries = 0, lastErr;
    while (tries < 3) {
      try {
        await postToMezmo(chunk);
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, tries)));
        tries++;
      }
    }
    if (tries === 3) throw lastErr;
  }
}

// --- exported handler ---
export const forwardToMezmo = async (message /*, context */) => {
  // Pub/Sub message from Log Router sink is base64 JSON
  const payload = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));

  // Sometimes a single entry, sometimes an array/batch
  const entries = Array.isArray(payload) ? payload : [payload];

  const lines = entries.map(gcpLogToLine);

  await postInChunks(lines);
};