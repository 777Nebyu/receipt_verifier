const express = require("express");
const multer = require("multer");
const path = require("path");
const { body } = require("express-validator");
const controller = require("../controllers/receiptController");
const authenticate = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed."));
    return cb(null, true);
  },
});

router.use(authenticate);

router.post(
  "/verify",
  [
    body("provider").optional().isIn(["telebirr", "cbe", "boa"]).withMessage("Unsupported provider."),
    body("reference")
      .custom((value, { req }) => {
        if (!value && !req.body.qrData) throw new Error("Reference, receipt URL, or QR data is required.");
        if (value && String(value).trim().length < 3) throw new Error("Reference is too short.");
        return true;
      }),
    body("accountNumber").optional().trim(),
    body("qrData").optional().trim(),
  ],
  validate,
  controller.verify
);

router.post("/upload", upload.single("receipt"), controller.upload);
router.post(
  "/scan",
  [
    body("provider").optional().isIn(["telebirr", "cbe", "boa"]).withMessage("Unsupported provider."),
    body("reference")
      .custom((value, { req }) => {
        if (!value && !req.body.qrData) throw new Error("Reference, receipt URL, or QR data is required.");
        if (value && String(value).trim().length < 3) throw new Error("Reference is too short.");
        return true;
      }),
    body("accountNumber").optional().trim(),
    body("qrData").optional().trim(),
  ],
  validate,
  controller.scan
);
router.get("/history", controller.history);
router.get("/:id/pdf", controller.downloadPdf);

module.exports = router;
