const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/adminController");
const authenticate = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

router.use(authenticate, requireRole("admin"));

router.get("/users", controller.users);
router.post(
  "/users",
  [
    body("fullName").trim().isLength({ min: 2 }).withMessage("Full name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validate,
  controller.createMerchant
);
router.put(
  "/users/:id",
  [
    body("fullName").optional().trim().isLength({ min: 2 }).withMessage("Full name is required."),
    body("email").optional().isEmail().withMessage("Valid email is required."),
    body("password").optional().isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
    body("role").optional().isIn(["merchant", "admin"]).withMessage("Unsupported role."),
  ],
  validate,
  controller.updateUser
);
router.delete("/users/:id", controller.deleteUser);
router.get("/logs", controller.logs);
router.get("/stats", controller.stats);

module.exports = router;
