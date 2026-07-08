const express = require("express");
const { body } = require("express-validator");
const auth = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.post(
  "/register",
  [
    body("fullName").trim().isLength({ min: 2 }).withMessage("Full name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validate,
  auth.register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  validate,
  auth.login
);

router.get("/me", authenticate, auth.me);
router.put(
  "/me",
  authenticate,
  [
    body("fullName").optional().trim().isLength({ min: 2 }).withMessage("Full name is required."),
    body("password").optional().isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validate,
  auth.updateProfile
);
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required.")],
  validate,
  auth.forgotPassword
);
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validate,
  auth.resetPassword
);

module.exports = router;
