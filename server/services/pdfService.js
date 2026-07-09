function escapePdfText(value) {
  return String(value ?? "Not found")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function cleanValue(value) {
  if (value === undefined || value === null || value === "") return "Not found";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") return "Not found";
  return `${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

function wrapText(text, maxLength = 76) {
  const words = cleanValue(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : ["Not found"];
}

function addText(commands, text, x, y, size = 11) {
  commands.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function addRow(commands, label, value, y) {
  addText(commands, label, 52, y, 10);
  const lines = wrapText(value, 68);
  lines.forEach((line, index) => addText(commands, line, 190, y - index * 14, 10));
  return y - Math.max(lines.length, 1) * 18;
}

function buildPdf(objects) {
  const header = "%PDF-1.4\n";
  const offsets = [];
  let body = "";

  objects.forEach((object, index) => {
    offsets.push(header.length + body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(header + body + xref + trailer, "binary");
}

function createReceiptPdf(receipt) {
  const response = receipt.provider_response || {};
  const commands = [
    "0.94 0.97 0.96 rg 0 792 595 50 re f",
    "0.10 0.42 0.35 rg 0 788 595 4 re f",
  ];

  addText(commands, "Receipt Verification System", 52, 812, 18);
  addText(commands, "Verified Payment Receipt", 52, 770, 13);
  addText(commands, `Generated: ${new Date().toLocaleString("en-US")}`, 360, 812, 9);

  let y = 742;
  y = addRow(commands, "Verification status", receipt.is_verified ? "Verified" : "Not verified", y);
  y = addRow(commands, "Provider", response.providerName || receipt.provider || response.provider, y);
  y = addRow(commands, "Reference", response.reference || receipt.reference_code, y);
  y = addRow(commands, "Amount", formatAmount(response.amount || receipt.amount), y);
  y = addRow(commands, "Sender", response.senderName, y);
  y = addRow(commands, "Sender account", response.senderAccount, y);
  y = addRow(commands, "Receiver", response.receiverName || response.bankAccountName, y);
  y = addRow(commands, "Receiver account", response.receiverAccount || response.bankAccountNumber, y);
  y = addRow(commands, "Transaction date", response.date, y);
  y = addRow(commands, "Transaction status", response.transactionStatus || response.reason || "Completed", y);
  y = addRow(commands, "Verified at", receipt.verified_at ? new Date(receipt.verified_at).toLocaleString("en-US") : "Not found", y);

  if (response.sourceUrl) y = addRow(commands, "Provider source", response.sourceUrl, y - 4);


  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
  ];

  return buildPdf(objects);
}

module.exports = { createReceiptPdf };
