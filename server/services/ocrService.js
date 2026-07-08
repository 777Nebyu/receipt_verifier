const tesseract = require("tesseract.js");
const path = require("path");
const { detectFromText } = require("./providerService");

const serverRoot = path.join(__dirname, "..");

async function extractFromImage(filePath) {
  const result = await tesseract.recognize(filePath, "eng", {
    langPath: serverRoot,
    cachePath: serverRoot,
    cacheMethod: "readOnly",
    gzip: false,
  });
  const text = result.data.text || "";
  const detected = detectFromText(text);
  return {
    text,
    provider: detected.provider,
    reference: detected.reference,
    confidence: Math.round(result.data.confidence || 0),
  };
}

module.exports = { extractFromImage };
