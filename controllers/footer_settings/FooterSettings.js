const { PageModel } = require("../../models");

const FOOTER_SETTINGS_SLUG = "footer-settings-json";
const CONTACT_SETTINGS_SLUG = "contact-info-settings-json";
const TERMS_CONDITIONS_SLUG = "termsconditions";
const PRIVACY_POLICY_SLUG = "privacypolicy";
const REFUND_POLICY_SLUG = "refundpolicy";

const defaultFooterSettings = {
  footerLogoUrl: "",
  brandTitle: "Finance Alumni Association",
  brandDescription:
    "FAA is a social network of ex-students of the Department of Finance, University of Dhaka (DU) Campus, Nilkhet Road, Dhaka - 1000",
  usefulHeading: "Useful Link",
  usefulSubtitle: "Links of Finance Alumni Association in other countries",
  usefulSubtitleUrl: "https://www.facebook.com/groups/376471082747654/",
  helpTitle: "To get help, please call: ( 11AM - 9PM )",
  phones: ["+880 1819-162727", "+8801819214814"],
  phone1: "+880 1819-162727",
  phone2: "+8801819214814",
  facebookUrl: "https://www.facebook.com/groups/135676929841458",
};

const defaultContactSettings = {
  title: "Finance Alumni Association",
  helpTitle: "To get help, please call: ( 11AM - 9PM )",
  phones: ["+880 1819-162727", "+880 1819-214814"],
  phone1: "+880 1819-162727",
  phone2: "+880 1819-214814",
  email: "faa.dubd@outlook.com",
  address:
    "Department of Finance, University of Dhaka (DU) Campus, Nilkhet Road, Dhaka - 1000",
  facebookUrl: "https://www.facebook.com/groups/135676929841458",
  faqItems: [
    {
      question: "Qualifications for Membership",
      answer:
        "General Membership is open to all graduates of the Department of Finance of the University of Dhaka. Life Membership will be awarded to a general member by the Executive Council (EC) of the Association upon fulfilment of conditions set by the EC.",
    },
    {
      question: "Fees and Subscriptions:",
      answer:
        "The annual membership fee for a general member shall be Tk. 1000 (One thousand). The fee for Life Member shall be Tk. 10000 (Ten thousand). These rates are subject to change upon decision in the general meeting of the Association.",
    },
    {
      question: "Rights and Privileges of the Members:",
      answer:
        "To attend general meetings and to move and support motions; to participate in election of the EC and to hold any office of the EC; and to participate in events organized by the Association subject to registration.",
    },
    {
      question: "Termination of Membership:",
      answer:
        "Membership will cease automatically in case of resignation accepted by EC, death, bankruptcy, insanity, punishment by a court of law, or non-payment of membership fees for two consecutive years.",
    },
  ],
};

const defaultPolicySettings = {
  terms: {
    title: "Terms and Conditions",
    details:
      '<p><a href="/about?id=Constitution">Refers to the constitution</a></p>',
  },
  privacy: {
    title: "Privacy Policy",
    details:
      "<p>Finance Alumni Association (FAA) of Dhaka University respects your privacy. We collect only required data to provide membership, donation, sponsorship, and event services.</p>",
  },
  refund: {
    title: "Refund Policy",
    details:
      "<p>All payments are non-refundable unless paid in error. In such cases, the payer may contact the treasurer for review and possible refund on a best effort basis.</p>",
  },
};

const parseJson = (value, fallback) => {
  try {
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return fallback;
    return { ...fallback, ...parsed };
  } catch (error) {
    return fallback;
  }
};

async function findBySlug(slug) {
  return PageModel.findOne({ where: { slug } });
}

async function upsertBySlug(slug, title, details) {
  const current = await findBySlug(slug);
  const payload = { title, slug, details, status: 1 };
  if (current) {
    await PageModel.update(payload, { where: { id: current.id } });
  } else {
    await PageModel.create(payload);
  }
}

async function getPolicyBySlug(slug, fallback) {
  const row = await findBySlug(slug);
  return {
    title: String(row?.title || fallback.title || "").trim(),
    details: String(row?.details || fallback.details || "").trim(),
  };
}

exports.edit_form = async (req, res) => {
  try {
    const footerRow = await findBySlug(FOOTER_SETTINGS_SLUG);
    const footerSettings = parseJson(footerRow?.details, defaultFooterSettings);
    const phoneList = Array.isArray(footerSettings.phones)
      ? footerSettings.phones.filter(Boolean)
      : [footerSettings.phone1, footerSettings.phone2].filter(Boolean);

    return res.render("footer_settings/index", {
      footerSettings: {
        ...footerSettings,
        phones: phoneList.length ? phoneList : defaultFooterSettings.phones,
      },
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.render("footer_settings/index", {
      footerSettings: defaultFooterSettings,
    });
  }
};

exports.edit = async (req, res) => {
  try {
    const existingFooterRow = await findBySlug(FOOTER_SETTINGS_SLUG);
    const existingFooterSettings = parseJson(
      existingFooterRow?.details,
      defaultFooterSettings
    );

    const getValue = (incoming, existingValue, defaultValue) => {
      const next = String(incoming ?? "").trim();
      if (next) return next;
      if (String(existingValue ?? "").trim()) return String(existingValue).trim();
      return defaultValue;
    };

    const phonesInput = Array.isArray(req.body.footerPhones)
      ? req.body.footerPhones
      : [req.body.footerPhones];
    const submittedPhones = phonesInput
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const existingPhones = Array.isArray(existingFooterSettings.phones)
      ? existingFooterSettings.phones.map((item) => String(item || "").trim()).filter(Boolean)
      : [
          existingFooterSettings.phone1,
          existingFooterSettings.phone2,
        ].map((item) => String(item || "").trim()).filter(Boolean);
    const phones = submittedPhones.length
      ? submittedPhones
      : existingPhones.length
      ? existingPhones
      : defaultFooterSettings.phones;

    let resolvedLogoUrl =
      existingFooterSettings.footerLogoUrl ||
      existingFooterSettings.footer_logo_url ||
      "";

    if (req.file && req.file.filename) {
      resolvedLogoUrl = `${req.protocol}://${req.get("host")}/uploads/footer-logos/${req.file.filename}`;
    }

    const footerSettings = {
      footerLogoUrl: resolvedLogoUrl,
      brandTitle: getValue(
        req.body.brandTitle,
        existingFooterSettings.brandTitle || existingFooterSettings.brand_title,
        defaultFooterSettings.brandTitle
      ),
      brandDescription: getValue(
        req.body.brandDescription,
        existingFooterSettings.brandDescription || existingFooterSettings.brand_description,
        defaultFooterSettings.brandDescription
      ),
      usefulHeading: getValue(
        req.body.usefulHeading,
        existingFooterSettings.usefulHeading || existingFooterSettings.useful_title,
        defaultFooterSettings.usefulHeading
      ),
      usefulSubtitle: getValue(
        req.body.usefulSubtitle,
        existingFooterSettings.usefulSubtitle || existingFooterSettings.useful_subtitle,
        defaultFooterSettings.usefulSubtitle
      ),
      usefulSubtitleUrl: getValue(
        req.body.usefulSubtitleUrl,
        existingFooterSettings.usefulSubtitleUrl || existingFooterSettings.useful_url,
        defaultFooterSettings.usefulSubtitleUrl
      ),
      helpTitle: getValue(
        req.body.helpTitle,
        existingFooterSettings.helpTitle || existingFooterSettings.help_title,
        defaultFooterSettings.helpTitle
      ),
      phones,
      phone1: phones[0] || "",
      phone2: phones[1] || "",
      facebookUrl: getValue(
        req.body.facebookUrl,
        existingFooterSettings.facebookUrl || existingFooterSettings.facebook_url,
        defaultFooterSettings.facebookUrl
      ),
    };

    await upsertBySlug(
      FOOTER_SETTINGS_SLUG,
      "Footer Settings JSON",
      JSON.stringify(footerSettings)
    );

    req.flash("success", "Footer settings updated successfully.");
    return res.redirect("/footer-settings");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/footer-settings");
  }
};

exports.contact_form = async (req, res) => {
  try {
    const contactRow = await findBySlug(CONTACT_SETTINGS_SLUG);
    const contactSettings = parseJson(contactRow?.details, defaultContactSettings);
    const phoneList = Array.isArray(contactSettings.phones)
      ? contactSettings.phones.filter(Boolean)
      : [contactSettings.phone1, contactSettings.phone2].filter(Boolean);

    const faqItems = Array.isArray(contactSettings.faqItems)
      ? contactSettings.faqItems
          .map((item) => ({
            question: String(item?.question || "").trim(),
            answer: String(item?.answer || "").trim(),
          }))
          .filter((item) => item.question || item.answer)
      : [];

    return res.render("contact_settings/index", {
      contactSettings: {
        ...contactSettings,
        phones: phoneList.length ? phoneList : defaultContactSettings.phones,
        faqItems: faqItems.length ? faqItems : defaultContactSettings.faqItems,
      },
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.render("contact_settings/index", {
      contactSettings: defaultContactSettings,
    });
  }
};

exports.contact_edit = async (req, res) => {
  try {
    const existingContactRow = await findBySlug(CONTACT_SETTINGS_SLUG);
    const existingContactSettings = parseJson(
      existingContactRow?.details,
      defaultContactSettings
    );

    const phonesInput = Array.isArray(req.body.contactPhones)
      ? req.body.contactPhones
      : [req.body.contactPhones];
    const phones = phonesInput
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const resolvedPhones = phones.length
      ? phones
      : existingContactSettings.phones || defaultContactSettings.phones;

    const contactSettings = {
      title:
        req.body.contactTitle ||
        existingContactSettings.title ||
        defaultContactSettings.title,
      helpTitle:
        req.body.contactHelpTitle ||
        existingContactSettings.helpTitle ||
        defaultContactSettings.helpTitle,
      phones: resolvedPhones,
      phone1: resolvedPhones[0] || "",
      phone2: resolvedPhones[1] || "",
      email:
        req.body.contactEmail ||
        existingContactSettings.email ||
        defaultContactSettings.email,
      address:
        req.body.contactAddress ||
        existingContactSettings.address ||
        defaultContactSettings.address,
      facebookUrl:
        req.body.contactFacebookUrl ||
        existingContactSettings.facebookUrl ||
        defaultContactSettings.facebookUrl,
      faqItems: existingContactSettings.faqItems || defaultContactSettings.faqItems,
    };

    await upsertBySlug(
      CONTACT_SETTINGS_SLUG,
      "Contact Settings JSON",
      JSON.stringify(contactSettings)
    );

    req.flash("success", "Contact settings updated successfully.");
    return res.redirect("/contact-settings");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/contact-settings");
  }
};

exports.faq_form = async (req, res) => {
  try {
    const contactRow = await findBySlug(CONTACT_SETTINGS_SLUG);
    const contactSettings = parseJson(contactRow?.details, defaultContactSettings);

    const faqItems = Array.isArray(contactSettings.faqItems)
      ? contactSettings.faqItems
          .map((item) => ({
            question: String(item?.question || "").trim(),
            answer: String(item?.answer || "").trim(),
          }))
          .filter((item) => item.question || item.answer)
      : [];

    return res.render("faq_settings/index", {
      faqItems: faqItems.length ? faqItems : defaultContactSettings.faqItems,
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.render("faq_settings/index", {
      faqItems: defaultContactSettings.faqItems,
    });
  }
};

exports.faq_edit = async (req, res) => {
  try {
    const existingContactRow = await findBySlug(CONTACT_SETTINGS_SLUG);
    const existingContactSettings = parseJson(
      existingContactRow?.details,
      defaultContactSettings
    );

    const faqQuestionsInput = Array.isArray(req.body.faqQuestion)
      ? req.body.faqQuestion
      : [req.body.faqQuestion];
    const faqAnswersInput = Array.isArray(req.body.faqAnswer)
      ? req.body.faqAnswer
      : [req.body.faqAnswer];

    const maxFaqLen = Math.max(faqQuestionsInput.length, faqAnswersInput.length);
    const faqItems = [];
    for (let i = 0; i < maxFaqLen; i += 1) {
      const question = String(faqQuestionsInput[i] || "").trim();
      const answer = String(faqAnswersInput[i] || "").trim();
      if (question || answer) {
        faqItems.push({ question, answer });
      }
    }

    const contactSettings = {
      ...existingContactSettings,
      faqItems: faqItems.length ? faqItems : defaultContactSettings.faqItems,
    };

    await upsertBySlug(
      CONTACT_SETTINGS_SLUG,
      "Contact Settings JSON",
      JSON.stringify(contactSettings)
    );

    req.flash("success", "FAQ settings updated successfully.");
    return res.redirect("/faq-settings");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/faq-settings");
  }
};

exports.terms_form = async (req, res) => {
  try {
    const terms = await getPolicyBySlug(
      TERMS_CONDITIONS_SLUG,
      defaultPolicySettings.terms
    );
    const privacy = await getPolicyBySlug(
      PRIVACY_POLICY_SLUG,
      defaultPolicySettings.privacy
    );
    const refund = await getPolicyBySlug(
      REFUND_POLICY_SLUG,
      defaultPolicySettings.refund
    );

    return res.render("terms_settings/index", {
      policySettings: { terms, privacy, refund },
    });
  } catch (error) {
    req.flash("error", error.message);
    return res.render("terms_settings/index", {
      policySettings: defaultPolicySettings,
    });
  }
};

exports.terms_edit = async (req, res) => {
  try {
    const termsTitle = String(req.body.termsTitle || "").trim() || defaultPolicySettings.terms.title;
    const termsDetails = String(req.body.termsDetails || "").trim() || defaultPolicySettings.terms.details;
    const privacyTitle = String(req.body.privacyTitle || "").trim() || defaultPolicySettings.privacy.title;
    const privacyDetails = String(req.body.privacyDetails || "").trim() || defaultPolicySettings.privacy.details;
    const refundTitle = String(req.body.refundTitle || "").trim() || defaultPolicySettings.refund.title;
    const refundDetails = String(req.body.refundDetails || "").trim() || defaultPolicySettings.refund.details;

    await upsertBySlug(TERMS_CONDITIONS_SLUG, termsTitle, termsDetails);
    await upsertBySlug(PRIVACY_POLICY_SLUG, privacyTitle, privacyDetails);
    await upsertBySlug(REFUND_POLICY_SLUG, refundTitle, refundDetails);

    req.flash("success", "Terms page settings updated successfully.");
    return res.redirect("/terms-settings");
  } catch (error) {
    req.flash("error", error.message);
    return res.redirect("/terms-settings");
  }
};
