const path = require("path");
const Receipt = require("../models/Receipt");
const ocrService = require("../services/ocrService");
const { createReceiptPdf } = require("../services/pdfService");
const { providers, verifyReceipt } = require("../services/providerService");

async function verify(req, res, next) {
  try {
    const startedAt = Date.now();
    const result = await verifyReceipt(req.body);
    const receipt = await Receipt.createReceipt({
      userId: req.user.id,
      providerCode: result.provider,
      referenceCode: result.reference,
      amount: result.amount,
    });
    const verification = await Receipt.saveVerification({
      receiptId: receipt.id,
      isVerified: Boolean(result.verified),
      providerResponse: { ...result, durationMs: Date.now() - startedAt },
    });
    await Receipt.saveLog({
      userId: req.user.id,
      receiptId: receipt.id,
      action: result.verified ? "verified_receipt" : "failed_verification",
      ipAddress: req.ip,
    });
    return res.json({
      receipt,
      verification,
      result: {
        ...result,
        durationMs: Date.now() - startedAt,
        receiptId: receipt.id,
        pdfUrl: `/api/receipt/${receipt.id}/pdf`,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: "Receipt image is required." });

    const ocr = await ocrService.extractFromImage(req.file.path);
    const provider = ocr.provider || req.body.provider;
    const reference = ocr.reference || req.body.reference;
    const accountNumber = req.body.accountNumber;

    let result = null;
    const needsAccountSuffix = providers[provider]?.accountDigits > 0 && !accountNumber;
    if (provider && reference && !needsAccountSuffix) {
      try {
        result = await verifyReceipt({ provider, reference, accountNumber });
      } catch (error) {
        result = {
          verified: false,
          provider,
          reference,
          reason: error.message,
        };
      }
    }

    const receipt = await Receipt.createReceipt({
      userId: req.user.id,
      providerCode: provider || "telebirr",
      imagePath: path.relative(path.join(__dirname, ".."), req.file.path),
      extractedText: ocr.text,
      referenceCode: reference,
      amount: result?.amount,
    });

    let verification = null;
    if (result) {
      verification = await Receipt.saveVerification({
        receiptId: receipt.id,
        isVerified: Boolean(result.verified),
        providerResponse: result,
      });
    }

    await Receipt.saveLog({
      userId: req.user.id,
      receiptId: receipt.id,
      action: "uploaded_receipt",
      ipAddress: req.ip,
    });

    return res.json({
      receipt,
      verification,
      ocr,
      result: result
        ? {
            ...result,
            receiptId: receipt.id,
            pdfUrl: `/api/receipt/${receipt.id}/pdf`,
          }
        : result,
    });
  } catch (error) {
    return next(error);
  }
}

async function scan(req, res, next) {
  try {
    const result = await verifyReceipt(req.body);
    return res.json({ result });
  } catch (error) {
    return next(error);
  }
}

async function history(req, res, next) {
  try {
    const rows = await Receipt.historyForUser(req.user.id, req.user.role);
    return res.json({ history: rows });
  } catch (error) {
    return next(error);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const receipt = await Receipt.findForDownload(req.params.id, req.user.id, req.user.role);
    if (!receipt) return res.status(404).json({ message: "Receipt not found." });
    if (!receipt.is_verified) return res.status(400).json({ message: "Only verified receipts can be downloaded as PDF." });

    const pdf = createReceiptPdf(receipt);
    const safeReference = String(receipt.reference_code || receipt.id).replace(/[^a-z0-9_-]/gi, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${safeReference}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    return res.send(pdf);
  } catch (error) {
    return next(error);
  }
}

module.exports = { verify, upload, scan, history, downloadPdf };
