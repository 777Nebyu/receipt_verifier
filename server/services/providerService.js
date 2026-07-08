const crypto = require("node:crypto");
const https = require("node:https");

const DEFAULT_TIMEOUT_MS = 15000;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const providers = {
  telebirr: {
    code: "telebirr",
    name: "Telebirr",
    accountDigits: 0,
    buildUrl: (reference) => `https://transactioninfo.ethiotelecom.et/receipt/${reference}`,
  },
  boa: {
    code: "boa",
    name: "Bank of Abyssinia",
    accountDigits: 5,
    buildUrl: (reference, accountNumber) =>
      `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${reference}${(accountNumber || "").slice(-5)}`,
    publicUrl: (reference) => `https://cs.bankofabyssinia.com/slip/?trx=${reference}`,
  },
  cbe: {
    code: "cbe",
    name: "Commercial Bank of Ethiopia",
    accountDigits: 8,
    buildUrl: (reference, accountNumber) =>
      `https://apps.cbe.com.et:100/?id=${reference}${(accountNumber || "").slice(-8)}`,
  },
};

function detectFromUrl(input) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();

    if (host.includes("transactioninfo.ethiotelecom.et")) {
      const parts = url.pathname.split("/").filter(Boolean);
      return { provider: "telebirr", reference: parts.at(-1) };
    }

    if (host.includes("bankofabyssinia.com")) {
      const trx = url.searchParams.get("trx");
      const id = url.searchParams.get("id");
      if (trx) return { provider: "boa", reference: trx };
      if (id && id.length > 5) {
        return { provider: "boa", reference: id.slice(0, -5), accountNumber: id.slice(-5) };
      }
    }

    if (host.includes("apps.cbe.com.et")) {
      const id = url.searchParams.get("id");
      if (id && id.length > 8) {
        return { provider: "cbe", reference: id.slice(0, -8), accountNumber: id.slice(-8) };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function detectFromText(text) {
  const normalized = text || "";
  const lower = normalized.toLowerCase();
  const provider = lower.includes("telebirr")
    ? "telebirr"
    : lower.includes("transaction number") && lower.includes("successful")
      ? "telebirr"
    : lower.includes("abyssinia") || lower.includes("boa")
      ? "boa"
    : lower.includes("commercial bank of ethiopia") || lower.includes("cbe")
        ? "cbe"
        : undefined;

  const reference =
    normalized.match(/transaction\s+(?:id|number)\s*[:#-]?\s*([A-Z0-9]{8,20})/i)?.[1] ||
    normalized.match(/\bFT[A-Z0-9]{8,16}\b/i)?.[0] ||
    normalized.match(/\b(?:DG|CHQ)[A-Z0-9]{6,16}\b/i)?.[0];

  return { provider, reference };
}

async function fetchBuffer(url, options = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, ...(options.headers || {}) },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw httpError(`Provider returned HTTP ${response.status}`, 502);
  }
  return { buffer, contentType, status: response.status };
}

function fetchInsecureBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: { "User-Agent": BROWSER_UA },
        timeout: DEFAULT_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(httpError(`Provider returned HTTP ${res.statusCode}`, 502));
            return;
          }
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers["content-type"] || "",
            status: res.statusCode,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(httpError("Provider request timed out", 504));
    });
  });
}

function normalizeHtml(raw) {
  return raw
    .replace(/<\/td>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function telebirrValue(lines, label) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].toLowerCase().includes(label.toLowerCase())) {
      const sameLine = lines[i].slice(lines[i].toLowerCase().indexOf(label.toLowerCase()) + label.length).trim();
      if (sameLine) return sameLine.replace(/^[.:-]+/, "").trim();
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
        if (!lines[j].includes("/")) return lines[j];
      }
    }
  }
  return undefined;
}

function birrAmountNear(lines, label) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].toLowerCase().includes(label.toLowerCase())) {
      const window = lines.slice(i, i + 4).join(" ");
      const match = window.match(/([0-9,]+\.?\d*)\s*(Birr|ETB)/i);
      if (match) return Number.parseFloat(match[1].replace(/,/g, ""));
    }
  }
  return undefined;
}

function parseTelebirr(raw) {
  if (!raw.toLowerCase().includes("telebirr receipt") || raw.includes("This request is not correct")) {
    return { verified: false };
  }
  const lines = normalizeHtml(raw);
  const bankAccountRaw = telebirrValue(lines, "Bank account number");
  const bankMatch = bankAccountRaw?.match(/^(\d{8,})\s+(.+)$/);
  const date = lines.join(" ").match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/)?.[1];

  return {
    verified: true,
    provider: "telebirr",
    senderName: telebirrValue(lines, "Payer Name"),
    senderAccount: telebirrValue(lines, "Payer telebirr no"),
    receiverName: telebirrValue(lines, "Credited Party name"),
    receiverAccount: telebirrValue(lines, "Credited party account no"),
    bankAccountNumber: bankMatch?.[1],
    bankAccountName: bankMatch?.[2],
    reference: telebirrValue(lines, "Invoice No"),
    date,
    amount: birrAmountNear(lines, "Settled Amount") || birrAmountNear(lines, "Total Paid Amount"),
    currency: "ETB",
    transactionStatus: telebirrValue(lines, "transaction status"),
    paymentMode: telebirrValue(lines, "Payment Mode"),
    reason: telebirrValue(lines, "Payment Reason"),
    paymentChannel: telebirrValue(lines, "Payment channel"),
    rawText: lines.join("\n").slice(0, 4000),
  };
}

function parseBoa(raw) {
  const payload = JSON.parse(raw);
  const row = payload.body?.[0];
  if (!row || row["Payer's Name"] === "Invalid reference number") {
    return { verified: false };
  }
  const amountText = String(row["Transferred Amount"] || "").replace(/[^0-9.]/g, "");
  return {
    verified: true,
    provider: "boa",
    senderName: row["Source Account Name"],
    senderAccount: row["Source Account"],
    receiverName: row["Receiver's Name"],
    receiverAccount: row["Receiver's Account"],
    reference: row["Transaction Reference"],
    date: row["Transaction Date"],
    amount: amountText ? Number.parseFloat(amountText) : undefined,
    currency: row.currency || "ETB",
    rawText: raw.slice(0, 4000),
  };
}

function decryptBoaQr(qrData) {
  const password = "ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=";
  const key = crypto.pbkdf2Sync(password, "salt", 10000, 32, "sha1");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from("1234567890123456"));
  let plaintext = decipher.update(Buffer.from(qrData, "base64"), undefined, "utf8");
  plaintext += decipher.final("utf8");
  const [senderAccount, senderName, amountText, reference, date, receiverAccount, receiverName] = plaintext
    .split(",")
    .map((part) => part.trim());
  return {
    verified: Boolean(reference),
    provider: "boa",
    senderName,
    senderAccount,
    receiverName,
    receiverAccount,
    reference,
    date,
    amount: amountText ? Number.parseFloat(amountText) : undefined,
    currency: "ETB",
    rawText: plaintext,
  };
}

async function parseCbePdf(buffer) {
  if (!buffer.toString("ascii", 0, 4).includes("%PDF")) {
    return { verified: false };
  }
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = extracted.text || "";
  if (!text.includes("Commercial Bank of Ethiopia")) {
    return { verified: false, rawText: text.slice(0, 4000) };
  }

  const accountMatches = Array.from(text.matchAll(/Account\s*([0-9*]+)/g)).map((match) => match[1]);
  const amountMatch = text.match(/Transferred Amount\s*([0-9,]+\.\d{2})\s*ETB/);
  const dateMatch = text.match(/Payment Date & Time\s*(\d{1,2}\/\d{1,2}\/\d{4}),?\s*(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/);
  const payerMatch = text.match(/Payer\s*(?:Mr\s+|Mrs\s+|Ms\s+)?(.+?)(?:\n|Account|Receiver)/);
  const receiverMatch = text.match(/Receiver\s*(.+?)(?:\n|Account|Payment)/);
  const refMatch = text.match(/Reference No\.?\s*\(VAT Invoice No\)?\s*(\S+)/);
  const reasonMatch = text.match(/Reason\s*\/\s*Type of service\s*(.+?)(?:\n|Transferred|$)/);

  return {
    verified: true,
    provider: "cbe",
    senderName: payerMatch?.[1]?.trim(),
    senderAccount: accountMatches[0],
    receiverName: receiverMatch?.[1]?.trim(),
    receiverAccount: accountMatches[1],
    reference: refMatch?.[1],
    date: dateMatch ? `${dateMatch[1]} ${dateMatch[2]}${dateMatch[3] ? ` ${dateMatch[3]}` : ""}` : undefined,
    amount: amountMatch ? Number.parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
    currency: "ETB",
    reason: reasonMatch?.[1]?.trim(),
    rawText: text.slice(0, 4000),
  };
}

async function verifyReceipt({ provider, reference, accountNumber, qrData }) {
  let selectedProvider = provider;
  let selectedReference = reference;
  let selectedAccount = accountNumber;

  if (selectedReference?.startsWith("http")) {
    const detected = detectFromUrl(selectedReference);
    if (detected) {
      selectedProvider = detected.provider;
      selectedReference = detected.reference;
      selectedAccount = selectedAccount || detected.accountNumber;
    }
  }

  if (qrData) {
    try {
      const parsed = decryptBoaQr(qrData);
      return { ...parsed, sourceUrl: "qr://boa", providerName: providers.boa.name };
    } catch {
      throw httpError("Invalid BOA QR payload.", 400);
    }
  }

  const config = providers[selectedProvider];
  if (!config) throw httpError("Unsupported provider.");
  if (!selectedReference) throw httpError("Reference number is required.");
  if (config.accountDigits && !selectedAccount) {
    throw httpError(`${config.name} requires the receiver account number or account suffix.`);
  }

  const url = config.buildUrl(selectedReference.trim(), selectedAccount);
  const response = selectedProvider === "cbe" ? await fetchInsecureBuffer(url) : await fetchBuffer(url);
  const raw = response.buffer.toString("utf8");
  const parsed =
    selectedProvider === "telebirr"
      ? parseTelebirr(raw)
      : selectedProvider === "boa"
        ? parseBoa(raw)
        : await parseCbePdf(response.buffer);

  return {
    ...parsed,
    reference: parsed.reference || selectedReference,
    provider: selectedProvider,
    providerName: config.name,
    sourceUrl: config.publicUrl ? config.publicUrl(selectedReference) : url,
    downloadUrl: url,
    httpStatus: response.status,
    contentType: response.contentType,
  };
}

module.exports = { providers, detectFromText, detectFromUrl, verifyReceipt };
