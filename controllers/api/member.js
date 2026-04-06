const {
  sequelize,
  MemberModel,
  MemberApprovalModel,
  AdminLogin,
} = require("../../models");
const { QueryTypes } = require("sequelize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const bcrypt = require("bcryptjs");
// UPDATED
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken: extractAuthBearerToken,
  hashToken,
} = require("../../utils/memberJwt");
const {
  getRegistrationDetails,
  generateEventRegistrationInvoicePdf,
} = require("../../services/eventInvoiceMailer");
const {
  getSettings: getForgotPasswordSmtpSettings,
} = require("../../services/forgotPasswordSmtpSettings");

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function generateEntryPasscode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getPasswordResetSecret() {
  const primary = String(process.env.MEMBER_PASSWORD_RESET_SECRET || "").trim();
  if (primary) return primary;

  const fallback = String(
    process.env.MEMBER_ACCESS_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      ""
  ).trim();
  if (fallback) return fallback;

  if (String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    return "DEV_INSECURE_MEMBER_PASSWORD_RESET_SECRET_CHANGE_ME";
  }

  throw new Error("MEMBER_PASSWORD_RESET_SECRET is missing. Configure it in .env");
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

const BCRYPT_ROUNDS = Math.max(10, Number(process.env.BCRYPT_ROUNDS || 10));

function isBcryptHash(value = "") {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

async function hashMemberPassword(password) {
  return bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);
}

// UPDATED
async function verifyMemberPasswordAndMigrate(member, plainPassword) {
  const storedPassword = String(member?.password || "");
  const candidate = String(plainPassword || "");
  if (!storedPassword || !candidate) return false;

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(candidate, storedPassword);
  }

  const isLegacyMatch = storedPassword === candidate;
  if (isLegacyMatch && member?.id) {
    const hashedPassword = await hashMemberPassword(candidate);
    await MemberModel.update(
      { password: hashedPassword },
      { where: { id: member.id } }
    ).catch(() => {});
    member.password = hashedPassword;
  }

  return isLegacyMatch;
}

function extractBearerToken(req) {
  return extractAuthBearerToken(req);
}
function createPasswordResetToken(member) {
  const expiresInMinutes = 30;
  const exp = Date.now() + expiresInMinutes * 60 * 1000;
  const payloadObject = {
    member_id: Number(member.id),
    exp,
  };
  const payload = encodeBase64Url(JSON.stringify(payloadObject));
  const signature = crypto
    .createHmac("sha256", getPasswordResetSecret())
    .update(`${payload}.${String(member.password || "")}`)
    .digest("hex");

  return `${payload}.${signature}`;
}

function parsePasswordResetToken(token) {
  const tokenValue = String(token || "").trim();
  if (!tokenValue || !tokenValue.includes(".")) return null;

  const parts = tokenValue.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  try {
    const payloadJson = decodeBase64Url(payload);
    const parsed = JSON.parse(payloadJson);
    if (!parsed?.member_id || !parsed?.exp) return null;
    return {
      payload,
      signature,
      member_id: Number(parsed.member_id),
      exp: Number(parsed.exp),
    };
  } catch (error) {
    return null;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function buildResetUrl(appBaseUrl, token) {
  const fallbackBase = "http://localhost:3001";
  const normalizedBase = String(appBaseUrl || "")
    .trim()
    .replace(/\/+$/, "") || fallbackBase;

  return `${normalizedBase}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendMemberPasswordResetEmail(member, resetUrl) {
  const emailSettings = getForgotPasswordSmtpSettings();
  const smtpHost = String(emailSettings.smtp_host || "").trim();
  const smtpUser = String(emailSettings.smtp_user || "").trim();
  const smtpPass = String(emailSettings.smtp_pass || "").trim();

  if (String(emailSettings.status || "0") !== "1") {
    throw new Error("Forgot password SMTP system is inactive.");
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("Forgot password SMTP settings are incomplete.");
  }

  const smtpPort = Number(emailSettings.smtp_port) || 465;
  const smtpSecure = Number(emailSettings.smtp_secure) === 1 || smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const fromName = String(emailSettings.from_name || "FAA Team").trim();
  const fromEmail = String(emailSettings.from_email || smtpUser || "").trim();
  const replyToEmail = String(emailSettings.reply_to_email || fromEmail).trim();
  const memberName = String(member.name || "Member").trim();
  const memberEmail = String(member.email || "").trim();
  const subject = String(emailSettings.email_subject || "Password Reset Request").trim();
  const templateBody = String(emailSettings.email_body || "").trim();
  const renderedTemplateBody = templateBody
    .replace(/{{\s*member_name\s*}}/gi, memberName)
    .replace(/{{\s*member_email\s*}}/gi, memberEmail)
    .replace(/{{\s*reset_url\s*}}/gi, resetUrl);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#1f2937;">
      ${renderedTemplateBody
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${line}</p>`)
        .join("")}
    </div>
  `;

  await transporter.sendMail({
    from: fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to: member.email,
    replyTo: replyToEmail || undefined,
    subject: subject || "Password Reset Request",
    text: renderedTemplateBody || `Hello ${memberName},\n\nReset your password using this link:\n${resetUrl}`,
    html,
  });
}

function buildPrefixFromCategoryName(categoryName = "") {
  const normalizedName = normalizeText(categoryName);

  if (normalizedName.includes("life")) return "LM";
  if (normalizedName.includes("general")) return "GM";
  if (normalizedName.includes("student") || normalizedName.includes("guest")) return "SM";

  const words = String(categoryName || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !["member", "membership", "category"].includes(normalizeText(word)));

  const initials = words
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return initials || "MB";
}

function resolvePrefixFromCategoryMeta(categoryTitle, categoryName) {
  if (!categoryTitle) return buildPrefixFromCategoryName(categoryName);

  try {
    const parsed = typeof categoryTitle === "string" ? JSON.parse(categoryTitle) : categoryTitle;
    const prefix = String(parsed?.membership_number_prefix || "").trim().toUpperCase();
    if (prefix) return prefix;
  } catch (error) {
    const fallbackPrefix = String(categoryTitle || "").trim().toUpperCase();
    if (fallbackPrefix && fallbackPrefix.length <= 10) return fallbackPrefix;
  }

  return buildPrefixFromCategoryName(categoryName);
}

function resolveCategoryMembershipMeta(categoryTitle, categoryName = "") {
  const fallbackDuration = 365;
  const fallback = {
    membership_type: String(categoryName || "").toLowerCase().includes("lifetime")
      ? "lifetime"
      : "time_limited",
    membership_duration_days: fallbackDuration,
  };

  if (!categoryTitle) return fallback;

  try {
    const parsed = typeof categoryTitle === "string" ? JSON.parse(categoryTitle) : categoryTitle;
    const membershipType =
      String(parsed?.membership_type || "").toLowerCase() === "lifetime"
        ? "lifetime"
        : fallback.membership_type;

    const parsedDays = Number(parsed?.membership_duration_days);
    const durationDays =
      Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : fallbackDuration;

    return {
      membership_type: membershipType,
      membership_duration_days: durationDays,
    };
  } catch (error) {
    return fallback;
  }
}

function formatDateYmd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function resolveApprovedAtValue(nextApproval, existingApprovedAt = null) {
  const normalizedApproval = Number(nextApproval) === 1 ? 1 : 0;
  if (normalizedApproval !== 1) return null;
  return existingApprovedAt || new Date();
}

function parseValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveEffectiveApprovedDate({
  adminApproval,
  approvedAt,
  lastPaymentRaw,
  createdAt,
}) {
  if (Number(adminApproval) !== 1) return null;
  const byApprovedAt = parseValidDate(approvedAt);
  if (byApprovedAt) return byApprovedAt;

  const byLastPayment = parseValidDate(lastPaymentRaw);
  if (byLastPayment) return byLastPayment;

  return parseValidDate(createdAt);
}

function deriveLatestPaymentDateFromCollections({
  paidEventRegistrations = [],
  sponsorContributions = [],
  donationContributions = [],
}) {
  const candidates = [
    ...paidEventRegistrations.flatMap((row) => [
      row?.tx_tran_date,
      row?.registration_date,
      row?.created_date,
      row?.created_at,
    ]),
    ...sponsorContributions.flatMap((row) => [
      row?.tx_tran_date,
      row?.created_date,
      row?.created_at,
    ]),
    ...donationContributions.flatMap((row) => [
      row?.tx_tran_date,
      row?.created_date,
      row?.created_at,
    ]),
  ]
    .map(parseValidDate)
    .filter(Boolean);

  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

async function getViewerProfileAccessState(viewerMemberId) {
  if (!viewerMemberId) {
    return {
      canViewOthers: false,
      isNotApproved: true,
      isUnpaid: true,
      isExpired: false,
    };
  }

  try {
    const rows = await sequelize.query(
      `
      SELECT
        ml.id,
        ml.is_pay,
        ml.admin_approval,
        ml.approved_at,
        ml.created_at,
        ml.updated_at,
        cl.category_name,
        cl.category_title,
        COALESCE(
          MAX(
            COALESCE(
              mp.tx_tran_date,
              mp.created_at,
              mp.updated_at,
              er.tx_tran_date,
              er.created_at
            )
          ),
          ml.updated_at,
          ml.created_at
        ) AS last_payment_raw
      FROM member_list ml
      LEFT JOIN member_ship_payments mp
        ON ml.id = mp.member_id
        AND mp.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN event_register er
        ON ml.id = er.member_id
        AND er.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN category_list cl
        ON cl.id = ml.membership_category_id
      WHERE ml.id = :viewer_member_id
      GROUP BY ml.id
      LIMIT 1
      `,
      {
        replacements: { viewer_member_id: viewerMemberId },
        type: QueryTypes.SELECT,
      }
    );

    const row = rows?.[0];
    if (!row) {
      return {
        canViewOthers: false,
        isNotApproved: true,
        isUnpaid: true,
        isExpired: false,
      };
    }

    const isNotApproved = Number(row.admin_approval) !== 1;
    const isUnpaid = Number(row.is_pay) !== 1;
    const categoryMeta = resolveCategoryMembershipMeta(row.category_title, row.category_name);
    const approvedDate = resolveEffectiveApprovedDate({
      adminApproval: row.admin_approval,
      approvedAt: row.approved_at,
      lastPaymentRaw: row.last_payment_raw,
      createdAt: row.created_at,
    });

    let isExpired = false;
    if (!isNotApproved && !isUnpaid && categoryMeta.membership_type !== "lifetime" && approvedDate) {
      const durationMs = Number(categoryMeta.membership_duration_days || 365) * 24 * 60 * 60 * 1000;
      const expireDate = new Date(approvedDate.getTime() + durationMs);
      isExpired = expireDate.getTime() < Date.now();
    }

    return {
      canViewOthers: !isNotApproved && !isUnpaid && !isExpired,
      isNotApproved,
      isUnpaid,
      isExpired,
    };
  } catch (error) {
    return {
      canViewOthers: false,
      isNotApproved: true,
      isUnpaid: true,
      isExpired: false,
    };
  }
}

async function resolveMembershipPrefixByCategoryId(categoryId) {
  if (!categoryId) return "MB";

  try {
    const categoryRows = await sequelize.query(
      `SELECT category_name, category_title FROM category_list WHERE id = :id LIMIT 1`,
      {
        replacements: { id: categoryId },
        type: QueryTypes.SELECT,
      }
    );
    const categoryName = categoryRows?.[0]?.category_name || "";
    const categoryTitle = categoryRows?.[0]?.category_title || "";
    return resolvePrefixFromCategoryMeta(categoryTitle, categoryName);
  } catch (error) {
    return "MB";
  }
}

exports.MemberUpdate = async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/member");
    },
    filename: (req, file, cb) => {
      cb(null, "member_" + Date.now() + path.extname(file.originalname));
    },
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  }).single("_image");

  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };
  const errorHandlerUpload = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };
  upload(req, res, async (err) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if (req.file !== undefined) {
        const resizedImagePath = "public/member/resized_" + req.file.filename;
        await sharp(req.file.path)
          .resize(150, 150) // Resize to 300x300 pixels
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split("public/member/")[1];
      }

      if (req.body.membership_number === "") {
        return res.status(200).json({
          success: false,
          message: "Please enter membership number",
        });
      }
      if (req.body.name === "") {
        return res.status(200).json({
          success: false,
          message: "Please enter name",
        });
      }
      if (req.body.phone_number === "") {
        return res.status(200).json({
          success: false,
          message: "Please enter phone number",
        });
      }

      if (
        req.body.membership_number !== "" &&
        req.body.name !== "" &&
        req.body.phone_number !== ""
      ) {
        const authMemberId = String(req.authMemberId || "").trim();
        if (!authMemberId) {
          return res.status(401).json({ success: false, message: "Unauthorized request." });
        }

        if (String(req.body.id || authMemberId) !== authMemberId) {
          return res.status(403).json({ success: false, message: "You are not allowed to update this profile." });
        }

        let userDetails = await MemberModel.findOne({
          where: { id: authMemberId },
        }).catch(errorHandler);

        let update_data = {
          membership_number: req.body.membership_number,
          name: req.body.name,
          phone_number: req.body.phone_number,
          email: req.body.email,
          address: req.body.address,
          session: req.body.session,
          hsc_passing_year: req.body.hsc_passing_year,
          occupation: req.body.occupation,
          organization_name: req.body.organization_name,
          designation_name: req.body.designation_name,
          status: req.body.status,
          password: userDetails?.password || null,
          admin_approval: req.body.admin_approval,
          approved_at: resolveApprovedAtValue(
            req.body.admin_approval,
            userDetails?.approved_at || null
          ),
          membership_category_id: req.body.membership_category_id,
          linkedin_link: req.body.linkedin_link,
          facebook_link: req.body.facebook_link,
          twitter_link: req.body.twitter_link,
          blood_group: req.body.blood_group,
          gender: req.body.gender,
          date_of_birth: req.body.date_of_birth,
          member_image: image,
        };
        if (req.file !== undefined) {
          update_data.member_image = image;
        }
        if (userDetails !== null) {
          try {
            const userInsertDetails = await MemberModel.update(update_data, {
              where: { id: authMemberId },
            }).catch(errorHandler);
            return res.status(200).json({
              success: true,
              result: userInsertDetails,
            });
          } catch (error) {
            return res.status(200).json({
              success: false,
              error: error,
            });
          }
        } else {
          return res.status(200).json({
            success: false,
            message: "Member fot found",
          });
        }
      } else {
        return res.status(200).json({
          success: false,
          message: "Please fill up required field",
        });
      }
    }
  });
};

exports.Save = async (req, res, next) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/member");
    },
    filename: (req, file, cb) => {
      cb(null, "member_" + Date.now() + path.extname(file.originalname));
    },
  });
  const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  }).single("_image");

  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };
  const errorHandlerUpload = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };
  upload(req, res, async (err) => {
    if (err) {
      await errorHandlerUpload(err);
    } else {
      let image = "";
      if (req.file !== undefined) {
        const resizedImagePath = "public/member/resized_" + req.file.filename;
        await sharp(req.file.path)
          .resize(150, 150) // Resize to 300x300 pixels
          .toFile(resizedImagePath)
          .catch(errorHandler);

        image = resizedImagePath.split("public/member/")[1];
      }

      // image = req.file.filename;

      if (req.body.name === "") {
        return res.status(200).json({
          success: false,
          message: "Please enter name",
        });
      }
      if (req.body.phone_number === "") {
        return res.status(200).json({
          success: false,
          message: "Please enter phone number",
        });
      }

      const prefix = await resolveMembershipPrefixByCategoryId(
        req.body.membership_category_id
      );
      // Get max ID for this category
      const maxEntry = await MemberModel.findOne({
        where: { membership_category_id: req.body.membership_category_id },
        order: [["id", "DESC"]],
        attributes: ["id"],
      });

      const nextId = maxEntry ? maxEntry.id + 1 : 1;
      const membership_number = `${prefix}${nextId}`;

      if (req.body.name !== "" && req.body.phone_number !== "") {
        // UPDATED
        const preparedPassword = req.body.password
          ? await hashMemberPassword(req.body.password)
          : null;

        let insert_data = {
          membership_number: membership_number,
          name: req.body.name,
          phone_number: req.body.phone_number,
          email: req.body.email,
          address: req.body.address,
          session: req.body.session,
          hsc_passing_year: req.body.hsc_passing_year,
          occupation: req.body.occupation,
          organization_name: req.body.organization_name,
          designation_name: req.body.designation_name,
          status: req.body.status,
          password: preparedPassword,
          admin_approval: req.body.admin_approval,
          approved_at: resolveApprovedAtValue(req.body.admin_approval),
          membership_category_id: req.body.membership_category_id,
          member_image: image,
        };

        let userDetails = await MemberModel.findOne({
          where: { email: req.body.email },
        }).catch(errorHandler);
        if (userDetails === null) {
          try {
            const userInsertDetails = await MemberModel.create(
              insert_data
            ).catch(errorHandler);
            return res.status(200).json({
              success: true,
              result: userInsertDetails,
            });
          } catch (error) {
            return res.status(200).json({
              success: false,
              error: error,
            });
          }
        } else {
          return res.status(200).json({
            success: false,
            message: "User email already registered!",
          });
        }
      } else {
        return res.status(200).json({
          success: false,
          message: "Please fill up required field",
        });
      }
    }
  });
};

exports.Check = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };

  if (req.body.email === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter email!",
    });
  } else if (req.body.password === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter password!",
    });
  } else {
    const loginEmail = String(req.body.email || "").trim().toLowerCase();
    let userDetails = await MemberModel.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("email")),
        loginEmail
      ),
    }).catch(errorHandler);

    if (userDetails !== null) {
      const passwordOk = await verifyMemberPasswordAndMigrate(
        userDetails,
        req.body.password
      );

      if (!passwordOk) {
        return res.status(200).json({
          success: false,
          message: "User not found!",
        });
      }

      const plainUser = userDetails?.get
        ? userDetails.get({ plain: true })
        : { ...userDetails };
      delete plainUser.password;
      // UPDATED
      delete plainUser.refresh_token_hash;
      delete plainUser.refresh_token_expires_at;

      // UPDATED
      const access = generateAccessToken({ userId: plainUser.id });
      const refresh = generateRefreshToken({ userId: plainUser.id });

      await MemberModel.update(
        {
          refresh_token_hash: hashToken(refresh.token),
          refresh_token_expires_at: new Date(Date.now() + refresh.expiresInSeconds * 1000),
        },
        { where: { id: plainUser.id } }
      ).catch(() => {});

      return res.status(200).json({
        success: true,
        result: plainUser,
        token: access.token,
        access_token: access.token,
        refresh_token: refresh.token,
        token_type: "Bearer",
        expires_in: access.expiresInSeconds,
        refresh_expires_in: refresh.expiresInSeconds,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "User not found!",
      });
    }
  }
};

// NEW
exports.RefreshToken = async (req, res) => {
  try {
    const refreshToken = String(req.body.refresh_token || "").trim();
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token is required." });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload?.userId) {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
    }

    const member = await MemberModel.findOne({ where: { id: payload.userId } });
    if (!member) {
      return res.status(401).json({ success: false, message: "Invalid refresh token." });
    }

    const tokenHash = hashToken(refreshToken);
    const storedHash = String(member.refresh_token_hash || "");
    const expiresAt = member.refresh_token_expires_at ? new Date(member.refresh_token_expires_at) : null;

    if (!storedHash || storedHash !== tokenHash || !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({ success: false, message: "Refresh token is expired or revoked." });
    }

    const access = generateAccessToken({ userId: member.id });
    const newRefresh = generateRefreshToken({ userId: member.id });

    await MemberModel.update(
      {
        refresh_token_hash: hashToken(newRefresh.token),
        refresh_token_expires_at: new Date(Date.now() + newRefresh.expiresInSeconds * 1000),
      },
      { where: { id: member.id } }
    );

    return res.status(200).json({
      success: true,
      token: access.token,
      access_token: access.token,
      refresh_token: newRefresh.token,
      token_type: "Bearer",
      expires_in: access.expiresInSeconds,
      refresh_expires_in: newRefresh.expiresInSeconds,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not refresh token." });
  }
};

// UPDATED
exports.MemberSession = async (req, res) => {
  try {
    const token = extractBearerToken(req);
    const payload = verifyAccessToken(token);

    if (!payload?.userId) {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }

    const user = await MemberModel.findOne({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }

    const plainUser = user.get ? user.get({ plain: true }) : { ...user };
    delete plainUser.password;
    delete plainUser.refresh_token_hash;
    delete plainUser.refresh_token_expires_at;

    return res.status(200).json({ success: true, result: plainUser });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Session expired. Please login again." });
  }
};

exports.memberForgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    const appBaseUrl = String(req.body.app_base_url || "").trim();

    if (!email) {
      return res.status(200).json({
        success: false,
        message: "Please enter email.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(200).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const member = await MemberModel.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("email")),
        email.toLowerCase()
      ),
    });

    if (!member) {
      return res.status(200).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    const token = createPasswordResetToken(member);
    const resetUrl = buildResetUrl(appBaseUrl, token);
    await sendMemberPasswordResetEmail(member, resetUrl);

    return res.status(200).json({
      success: true,
      message: "Reset link sent successfully. Please check your email.",
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: error?.message || "Could not send reset email. Please try again.",
    });
  }
};

exports.memberResetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.new_password || req.body.password || "");
    const confirmPassword = String(
      req.body.confirm_password || req.body.confirmPassword || req.body.password || ""
    );

    if (!token) {
      return res.status(200).json({
        success: false,
        message: "Invalid reset link.",
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(200).json({
        success: false,
        message: "Please enter new password and confirm password.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(200).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(200).json({
        success: false,
        message: "Confirm password does not match.",
      });
    }

    const parsedToken = parsePasswordResetToken(token);
    if (!parsedToken) {
      return res.status(200).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    if (Date.now() > parsedToken.exp) {
      return res.status(200).json({
        success: false,
        message: "Reset link has expired.",
      });
    }

    const member = await MemberModel.findOne({
      where: { id: parsedToken.member_id },
    });
    if (!member) {
      return res.status(200).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", getPasswordResetSecret())
      .update(`${parsedToken.payload}.${String(member.password || "")}`)
      .digest("hex");

    if (expectedSignature !== parsedToken.signature) {
      return res.status(200).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    const hashedPassword = await hashMemberPassword(newPassword);
    await MemberModel.update(
      { password: hashedPassword, refresh_token_hash: null, refresh_token_expires_at: null },
      { where: { id: member.id } }
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please sign in.",
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: "Could not reset password. Please try again.",
    });
  }
};

function getViewerMemberId(req) {
  if (req?.authMemberId) return String(req.authMemberId);

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return "";

  const payload = verifyAccessToken(bearerToken);
  return payload?.userId ? String(payload.userId) : "";
}

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "");
}

function registrationBelongsToViewer(registration, viewerMember) {
  if (!registration || !viewerMember) return false;

  const registrationMemberId = String(registration.member_id || "").trim();
  const viewerId = String(viewerMember.id || "").trim();
  const viewerMembershipNumber = String(viewerMember.membership_number || "").trim();
  const registrationEmail = String(registration.email_address || "").trim().toLowerCase();
  const viewerEmail = String(viewerMember.email || "").trim().toLowerCase();
  const registrationPhone = normalizePhone(registration.phone_number);
  const viewerPhone = normalizePhone(viewerMember.phone_number);
  const registrationName = String(registration.full_name || "").trim().toLowerCase();
  const viewerName = String(viewerMember.name || "").trim().toLowerCase();

  return (
    (viewerId && registrationMemberId && registrationMemberId === viewerId) ||
    (viewerMembershipNumber && registrationMemberId && registrationMemberId === viewerMembershipNumber) ||
    (viewerEmail && registrationEmail && registrationEmail === viewerEmail) ||
    (viewerPhone && registrationPhone && registrationPhone === viewerPhone) ||
    (viewerName && registrationName && registrationName === viewerName)
  );
}

exports.SaveMemberApproved = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };

  if (req.body.member_id === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter member id!",
    });
  } else if (req.body.register_member_id === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter register member id!",
    });
  } else if (req.body.status === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter status!",
    });
  } else {
    let userDetails = await MemberApprovalModel.findOne({
      where: {
        member_id: req.body.member_id,
        register_member_id: req.body.register_member_id,
      },
    }).catch(errorHandler);

    if (userDetails === null) {
      try {
        const userInsertDetails = await MemberApprovalModel.create(
          req.body
        ).catch(errorHandler);
        return res.status(200).json({
          success: true,
          result: userInsertDetails,
        });
      } catch (error) {
        return res.status(200).json({
          success: false,
          error: error,
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        message: "User already approved!",
      });
    }
  }
};

exports.UserDetails = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };

  if (req.params.user_id === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter user id!",
    });
  } else {
    const viewerMemberId = getViewerMemberId(req);
    if (!viewerMemberId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Login is required.",
      });
    }
    const isSelfProfile = viewerMemberId === String(req.params.user_id);
    if (!isSelfProfile) {
      const viewerState = await getViewerProfileAccessState(viewerMemberId);
      if (!viewerState.canViewOthers) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Expired, unpaid, or not-approved members cannot view other member profiles.",
        });
      }
    }

    let userDetails = await MemberModel.findOne({
      where: { id: req.params.user_id },
    }).catch(errorHandler);
    // let memberApprovalList = await MemberApprovalModel.findAll({ where: {member_id: req.params.user_id}}).catch(errorHandler);
    const memberApprovalList = await sequelize.query(
      `SELECT ml.* FROM member_approval_list mal 
        INNER JOIN member_list ml ON mal.register_member_id=ml.id
        WHERE mal.member_id = ${req.params.user_id};`,
      { type: QueryTypes.SELECT }
    );

    if (userDetails !== null) {
      const memberDetails = userDetails.get
        ? userDetails.get({ plain: true })
        : userDetails;
      const memberId = String(memberDetails.id || "");
      const membershipNumber = String(memberDetails.membership_number || "");
      const email = String(memberDetails.email || "");
      const phoneNumber = String(memberDetails.phone_number || "");
      const organizationName = String(memberDetails.organization_name || "");
      const memberName = String(memberDetails.name || "");

      let paidEventRegistrations = [];
      let sponsorContributions = [];
      let donationContributions = [];

      if (isSelfProfile) {
        paidEventRegistrations = await sequelize
          .query(
          `
            SELECT
              er.id,
              er.event_id,
              el.event_title,
              el.event_type,
              er.participation_type,
              DATE_FORMAT(er.created_at, '%Y-%m-%d') AS registration_date,
              er.enter_date_time,
              CASE
                WHEN er.enter_date_time IS NULL THEN 'NOT_ENTERED'
                ELSE 'ENTERED'
              END AS entry_status,
              er.pay_amount,
              er.tx_status,
              er.payment_type,
              er.tx_tran_id AS transaction_id,
              er.tx_tran_date,
              er.entry_passcode,
              CONCAT('/api/v1/event-registration-invoice/', er.id) AS invoice_url
            FROM event_register er
            LEFT JOIN event_list el ON el.id = er.event_id
            WHERE
              (COALESCE(er.is_pay, 0) = 1 OR er.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED'))
              AND (
                (:memberId <> '' AND CAST(er.member_id AS CHAR) = :memberId)
                OR (:membershipNumber <> '' AND CAST(er.member_id AS CHAR) = :membershipNumber)
                OR (:email <> '' AND LOWER(COALESCE(er.email_address, '')) = LOWER(:email))
                OR (:phoneNumber <> '' AND REPLACE(COALESCE(er.phone_number, ''), ' ', '') = REPLACE(:phoneNumber, ' ', ''))
                OR (:memberName <> '' AND LOWER(COALESCE(er.full_name, '')) = LOWER(:memberName))
              )
            ORDER BY er.id DESC
            LIMIT 200
          `,
          {
            replacements: {
              memberId,
              membershipNumber,
              email,
              phoneNumber,
              memberName,
            },
            type: QueryTypes.SELECT,
          }
        )
          .catch(() => []);

        if (Array.isArray(paidEventRegistrations) && paidEventRegistrations.length) {
          for (const row of paidEventRegistrations) {
            if (String(row?.entry_passcode || "").trim()) continue;
            const generated = generateEntryPasscode();
            await sequelize
              .query(
                `UPDATE event_register SET entry_passcode = :entry_passcode WHERE id = :id`,
                {
                  replacements: {
                    entry_passcode: generated,
                    id: row.id,
                  },
                  type: QueryTypes.UPDATE,
                }
              )
              .catch(() => {});
            row.entry_passcode = generated;
          }
        }

        sponsorContributions = await sequelize
          .query(
          `
            SELECT
              esr.id,
              esr.event_id,
              el.event_title,
              esr.organization_name AS sponsor_name,
              esr.approximately_amount AS paid_amount,
              COALESCE(esr.tx_status, 'PENDING') AS payment_status,
              esr.payment_type,
              esr.tx_tran_date,
              DATE_FORMAT(esr.created_at, '%Y-%m-%d') AS created_date
            FROM event_sponsor_register esr
            LEFT JOIN event_list el ON el.id = esr.event_id
            WHERE
              (
                COALESCE(esr.is_pay, 0) = 1
                OR UPPER(TRIM(COALESCE(esr.tx_status, ''))) IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED')
              )
              AND (
                (:email <> '' AND LOWER(COALESCE(esr.email, '')) = LOWER(:email))
                OR (:phoneNumber <> '' AND REPLACE(COALESCE(esr.phone_number, ''), ' ', '') = REPLACE(:phoneNumber, ' ', ''))
                OR (:organizationName <> '' AND LOWER(COALESCE(esr.organization_name, '')) = LOWER(:organizationName))
              )
            ORDER BY esr.id DESC
            LIMIT 200
          `,
          {
            replacements: { email, phoneNumber, organizationName, memberName },
            type: QueryTypes.SELECT,
          }
        )
          .catch(() => []);

        donationContributions = await sequelize
          .query(
          `
            SELECT
              dl.id,
              dl.name,
              dl.organization_name,
              dl.donation_type,
              dl.program_id,
              p.title AS program_title,
              dl.pay_amount,
              COALESCE(dl.tx_status, 'PENDING') AS payment_status,
              dl.payment_type,
              dl.tx_tran_id AS transaction_id,
              dl.tx_tran_date,
              DATE_FORMAT(dl.created_at, '%Y-%m-%d') AS created_date
            FROM donation_list dl
            LEFT JOIN programs p ON p.id = dl.program_id
            WHERE
              (
                UPPER(TRIM(COALESCE(dl.tx_status, ''))) IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED')
              )
              AND (
                (:memberId <> '' AND CAST(dl.member_id AS CHAR) = :memberId)
                OR (:membershipNumber <> '' AND CAST(dl.member_id AS CHAR) = :membershipNumber)
                OR (:email <> '' AND LOWER(COALESCE(dl.email_address, '')) = LOWER(:email))
                OR (:phoneNumber <> '' AND REPLACE(COALESCE(dl.phone_number, ''), ' ', '') = REPLACE(:phoneNumber, ' ', ''))
                OR (:memberName <> '' AND LOWER(COALESCE(dl.name, '')) = LOWER(:memberName))
              )
            ORDER BY dl.id DESC
            LIMIT 200
          `,
          {
            replacements: {
              memberId,
              membershipNumber,
              email,
              phoneNumber,
              memberName,
            },
            type: QueryTypes.SELECT,
          }
        )
          .catch(() => []);
      }

      const safeMemberDetails = {
        ...memberDetails,
      };
      // UPDATED
      delete safeMemberDetails.password;
      delete safeMemberDetails.refresh_token_hash;
      delete safeMemberDetails.refresh_token_expires_at;

      const derivedLastPaymentDate = deriveLatestPaymentDateFromCollections({
        paidEventRegistrations,
        sponsorContributions,
        donationContributions,
      });
      const effectiveApprovedDate = resolveEffectiveApprovedDate({
        adminApproval: memberDetails?.admin_approval,
        approvedAt: memberDetails?.approved_at,
        lastPaymentRaw: derivedLastPaymentDate,
        createdAt: memberDetails?.created_at,
      });

      safeMemberDetails.approved_date = formatDateYmd(effectiveApprovedDate);

      if (
        Number(memberDetails?.admin_approval) === 1 &&
        !memberDetails?.approved_at &&
        effectiveApprovedDate
      ) {
        await MemberModel.update(
          { approved_at: effectiveApprovedDate },
          { where: { id: memberDetails.id } }
        ).catch(() => {});
      }

      const normalizedResult = {
        ...safeMemberDetails,
        can_view_secure: isSelfProfile,
        paid_event_registrations: paidEventRegistrations || [],
        sponsor_contributions: sponsorContributions || [],
        donation_contributions: donationContributions || [],
      };

      return res.status(200).json({
        success: true,
        result: normalizedResult,
        approval_list: memberApprovalList,
        paid_event_registrations: paidEventRegistrations || [],
        sponsor_contributions: sponsorContributions || [],
        donation_contributions: donationContributions || [],
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "User not found!",
      });
    }
  }
};

exports.UserListForApproved = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };

  if (req.body.user_id === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter user id!",
    });
  } else if (req.body.session === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter session!",
    });
  } else {
    // let userList = await MemberModel.findAll({ where: {session: req.body.session,admin_approval: 0 }}).catch(errorHandler);
    const userList = await sequelize.query(
      `SELECT * FROM member_list ml 
          WHERE ml.session = '${req.body.session}' AND ml.id!=${req.body.user_id} AND ml.admin_approval = 0 
          AND id NOT IN (SELECT member_id FROM member_approval_list WHERE register_member_id = ${req.body.user_id});`,
      { type: QueryTypes.SELECT }
    );

    if (userList) {
      return res.status(200).json({
        success: true,
        result: userList,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "User not found!",
      });
    }
  }
};

exports.ApprovedListForUser = async (req, res, next) => {
  const errorHandler = (err) => {
    return res.status(200).json({
      success: false,
      error: err,
    });
  };

  if (req.body.user_id === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter user id!",
    });
  } else if (req.body.session === "") {
    return res.status(200).json({
      success: false,
      message: "Please enter session!",
    });
  } else {
    // let userList = await MemberModel.findAll({ where: {session: req.body.session,admin_approval: 0 }}).catch(errorHandler);
    const userList = await sequelize.query(
      `SELECT * FROM member_list ml 
          WHERE ml.session = '${req.body.session}' AND ml.id!=${req.body.user_id} 
          AND id NOT IN (SELECT member_id FROM member_approval_list WHERE register_member_id = ${req.body.user_id});`,
      { type: QueryTypes.SELECT }
    );

    if (userList) {
      return res.status(200).json({
        success: true,
        result: userList,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "User not found!",
      });
    }
  }
};

exports.MemberList = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limitInput = Number.parseInt(req.query.limit, 10) || 20;
    const limit = Math.min(50, Math.max(1, limitInput));
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "latest").trim().toLowerCase();
    const membershipType = String(req.query.membership_type || "all")
      .trim()
      .toLowerCase();
    const categoryId = String(req.query.category_id || "").trim();

    const replacements = {
      limit,
      offset,
      searchLike: `%${search}%`,
    };

    const whereParts = ["ml.status = 1", "ml.admin_approval = 1"];

    if (search) {
      whereParts.push(`
        (
          ml.name LIKE :searchLike
          OR ml.membership_number LIKE :searchLike
          OR ml.phone_number LIKE :searchLike
          OR ml.email LIKE :searchLike
          OR ml.session LIKE :searchLike
          OR ml.organization_name LIKE :searchLike
        )
      `);
    }

    if (categoryId) {
      whereParts.push("CAST(ml.membership_category_id AS CHAR) = :categoryId");
      replacements.categoryId = categoryId;
    } else if (membershipType === "general") {
      whereParts.push("LOWER(COALESCE(cl.category_name, '')) LIKE '%general%'");
    } else if (membershipType === "lifetime") {
      whereParts.push("LOWER(COALESCE(cl.category_name, '')) LIKE '%lifetime%'");
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const orderByClause =
      sort === "az"
        ? `ORDER BY LOWER(
            TRIM(
              REPLACE(
                REPLACE(
                  REPLACE(COALESCE(ml.name, ''), CHAR(160), ' '),
                  CHAR(9),
                  ' '
                ),
                CHAR(10),
                ' '
              )
            )
          ) ASC, ml.id DESC`
        : "ORDER BY ml.id DESC";

    const rowsQuery = `
      SELECT
        ml.*,
        cl.category_name
      FROM member_list ml
      LEFT JOIN category_list cl
        ON cl.id = ml.membership_category_id
      ${whereClause}
      ${orderByClause}
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM member_list ml
      LEFT JOIN category_list cl
        ON cl.id = ml.membership_category_id
      ${whereClause}
    `;

    const [rows, countRows] = await Promise.all([
      sequelize.query(rowsQuery, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(countQuery, { replacements, type: QueryTypes.SELECT }),
    ]);

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const safeRows = rows.map((row) => {
      const item = { ...row };
      delete item.password;
      delete item.refresh_token_hash;
      delete item.refresh_token_expires_at;
      return item;
    });

    return res.status(200).json({
      success: true,
      result: {
        rows: safeRows,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    return res.status(200).json({
      success: false,
      message: "Failed to fetch member list.",
      error: String(error?.message || error),
    });
  }
};

exports.CategoryList = async (req, res, next) => {
  const category_list = await sequelize.query(
    `SELECT * FROM category_list WHERE status = 1;`,
    { type: QueryTypes.SELECT }
  );
  if (category_list) {
    const normalized = category_list.map((item) => {
      const meta = resolveCategoryMembershipMeta(item.category_title, item.category_name);
      return {
        ...item,
        membership_type: meta.membership_type,
        membership_duration_days:
          meta.membership_type === "lifetime" ? null : meta.membership_duration_days,
      };
    });
    return res.status(200).json({
      success: true,
      result: normalized,
    });
  } else {
    return res.status(200).json({
      success: false,
      message: "Category not found!",
    });
  }
};

exports.downloadEventRegistrationInvoice = async (req, res) => {
  try {
    const viewerMemberId = getViewerMemberId(req);
    if (!viewerMemberId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized invoice request.",
      });
    }

    const viewerMember = await MemberModel.findOne({
      where: { id: viewerMemberId },
    });
    if (!viewerMember) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized invoice request.",
      });
    }

    const registration = await getRegistrationDetails(req.params.id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found.",
      });
    }

    const viewerMemberPlain = viewerMember.get
      ? viewerMember.get({ plain: true })
      : viewerMember;
    if (!registrationBelongsToViewer(registration, viewerMemberPlain)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to download this invoice.",
      });
    }

    if (Number(registration.is_pay) !== 1) {
      return res.status(400).json({
        success: false,
        message: "Only paid registrations can download invoice.",
      });
    }

    const invoiceFileName = `invoice_${registration.id}.pdf`;
    const savedInvoicePath = path.join(
      __dirname,
      "../../public/invoices",
      invoiceFileName
    );
    const legacyInvoicePath = path.join(
      __dirname,
      "../../public/invoice",
      invoiceFileName
    );

    if (fs.existsSync(savedInvoicePath)) {
      return res.download(savedInvoicePath, invoiceFileName);
    }
    if (fs.existsSync(legacyInvoicePath)) {
      return res.download(legacyInvoicePath, invoiceFileName);
    }

    const pdfPath = await generateEventRegistrationInvoicePdf(registration);
    return res.download(pdfPath, invoiceFileName);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/////Start akash code

exports.expired_only_list = async (req, res) => {
  const requestedMemberId = String(req.query?.member_id || "").trim();
  const viewerMemberId = getViewerMemberId(req) || null;
  const member_id = requestedMemberId || viewerMemberId;
  try {
    const rows = await sequelize.query(
      `
      SELECT 
        ml.id,
        ml.name,
        ml.phone_number,
        ml.email,
        ml.session,
        ml.admin_approval,
        ml.approved_at,
        ml.created_at,
        cl.category_name,
        cl.category_title,
        COALESCE(
          MAX(
            COALESCE(
              mp.tx_tran_date,
              mp.created_at,
              mp.updated_at,
              er.tx_tran_date,
              er.created_at
            )
          ),
          ml.updated_at,
          ml.created_at
        ) AS last_payment_raw
      FROM member_list ml
      LEFT JOIN member_ship_payments mp
        ON ml.id = mp.member_id
        AND mp.tx_status IN ('VALID', 'CASH_RECEIVED')
      LEFT JOIN event_register er
        ON ml.id = er.member_id
        AND er.tx_status IN ('VALID', 'CASH_RECEIVED')
      INNER JOIN category_list cl
        ON cl.id = ml.membership_category_id
      WHERE ml.is_pay = 1
        AND ml.id = :member_id
      GROUP BY ml.id
      ORDER BY ml.id ASC
      `,
      {
        replacements: { member_id },
        type: QueryTypes.SELECT,
      }
    );

    const now = Date.now();
    const query_data = rows.map((row) => {
      const categoryMeta = resolveCategoryMembershipMeta(row.category_title, row.category_name);
      const lastPaymentDate = row.last_payment_raw ? new Date(row.last_payment_raw) : null;
      const approvedDate = resolveEffectiveApprovedDate({
        adminApproval: row.admin_approval,
        approvedAt: row.approved_at,
        lastPaymentRaw: row.last_payment_raw,
        createdAt: row.created_at,
      });
      const isValidApprovedDate = !!approvedDate;

      let expireDate = null;
      if (categoryMeta.membership_type !== "lifetime" && isValidApprovedDate) {
        const durationMs = Number(categoryMeta.membership_duration_days || 365) * 24 * 60 * 60 * 1000;
        expireDate = new Date(approvedDate.getTime() + durationMs);
      }

      const status =
        Number(row.admin_approval) !== 1
          ? "Not Approved"
          : categoryMeta.membership_type === "lifetime"
          ? "Active"
          : expireDate && expireDate.getTime() < now
            ? "Expired"
            : "Active";

      return {
        id: row.id,
        name: row.name,
        phone_number: row.phone_number,
        email: row.email,
        session: row.session,
        approved_date: formatDateYmd(approvedDate),
        last_payment_date: formatDateYmd(lastPaymentDate),
        expire_date:
          categoryMeta.membership_type === "lifetime"
            ? "Lifetime"
            : formatDateYmd(expireDate),
        status,
      };
    });

    await Promise.all(
      query_data
        .filter(
          (row) =>
            row?.id &&
            row?.approved_date &&
            Number(rows.find((r) => r.id === row.id)?.admin_approval) === 1 &&
            !rows.find((r) => r.id === row.id)?.approved_at
        )
        .map((row) =>
          MemberModel.update(
            { approved_at: row.approved_date },
            { where: { id: row.id } }
          ).catch(() => {})
        )
    );

    return res.status(200).json({
      success: true,
      data: query_data,
      totalExpired: query_data.length,
    });
  } catch (err) {
    console.error("Expired data fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
/////End akash code


















