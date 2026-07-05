const express = require("express");
const router = express.Router();

const menu = require("../controllers/api/menu");
const homePage = require("../controllers/api/home_page");
const member = require("../controllers/api/member");
const page = require("../controllers/api/page");
const eventList = require("../controllers/api/event_list");
const publication = require("../controllers/api/news_list");
const noticeList = require("../controllers/api/notice_list");
const jobList = require("../controllers/api/job_list");
const donation = require("../controllers/api/donation");
const others = require("../controllers/api/others");
const gallery = require("../controllers/api/gallery");
const contact = require("../controllers/api/contact");
const home_slider = require("../controllers/api/home_slider");
const home_popup = require("../controllers/api/home_popup");
const about_us_message = require("../controllers/api/about_us_message");
const programs = require("../controllers/api/programs");
const youtubeVideo = require("../controllers/api/youtube_video");
const executiveCommittee = require("../controllers/api/executive_committee");
const Payment = require("../controllers/payment");
const PaymentSettings = require("../controllers/payment_settings/PaymentSettings");
const PasswordChange = require("../controllers/api/change_password");
// NEW
const { requireMemberAuth } = require("../middleware/memberAuth");

router.get("/v1/status", function (req, res, next) {
  Payment.sslPaymentStatus(req, res, next);
});
router.get("/v1/payment_settings", function (req, res, next) {
  PaymentSettings.public_info(req, res, next);
});
router.post("/v1/payment", function (req, res, next) {
  Payment.sslPayment(req, res, next);
});
router.post("/v1/payment_membership", function (req, res, next) {
  Payment.sslPaymentMembership(req, res, next);
});

// UPDATED
router.post("/v1/change_password", requireMemberAuth, function (req, res, next) {
  PasswordChange.changePassword(req, res, next);
});

router.get("/v1/programs_list", function (req, res, next) {
  programs.List(req, res, next);
});
router.get("/v1/programs_details", function (req, res, next) {
  programs.Details(req, res, next);
});

router.post("/v1/contact_save", function (req, res, next) {
  contact.Insert(req, res, next);
});

router.get("/v1/about_us_message", function (req, res, next) {
  about_us_message.List(req, res, next);
});
router.get("/v1/gallery", function (req, res, next) {
  gallery.List(req, res, next);
});
router.get("/v1/home_popup", function (req, res, next) {
  home_popup.List(req, res, next);
});
router.get("/v1/youtube_video", function (req, res, next) {
  youtubeVideo.List(req, res, next);
});
router.get("/v1/executive_committee", function (req, res, next) {
  executiveCommittee.List(req, res, next);
});
router.get("/v1/executive_committee/:id", function (req, res, next) {
  executiveCommittee.Details(req, res, next);
});
router.get("/v1/home_slider", function (req, res, next) {
  home_slider.List(req, res, next);
});
router.get("/v1/batch_session_list", function (req, res, next) {
  others.batch_session_list(req, res, next);
});
router.get("/v1/occupation_list", function (req, res, next) {
  others.occupation_list_list(req, res, next);
});

router.get("/v1/scrolling_news_list", function (req, res, next) {
  publication.ScrollingNewsList(req, res, next);
});
router.get("/v1/category_list", function (req, res, next) {
  member.CategoryList(req, res, next);
});
router.get("/v1/job_list", function (req, res, next) {
  jobList.List(req, res, next);
});
router.get("/v1/notice_list", function (req, res, next) {
  noticeList.List(req, res, next);
});
router.get("/v1/member_list", function (req, res, next) {
  member.MemberList(req, res, next);
});

router.get("/v1/news_details/:id", function (req, res, next) {
  publication.NewsDetails(req, res, next);
});
router.get("/v1/publication", function (req, res, next) {
  publication.List(req, res, next);
});

router.get("/v1/event_details/:id", function (req, res, next) {
  eventList.Details(req, res, next);
});

router.post("/v1/event_register", function (req, res, next) {
  eventList.Save(req, res, next);
});
router.post("/v1/event_sponsor_register", function (req, res, next) {
  eventList.EventSponsorSave(req, res, next);
});

router.get("/v1/event_list", function (req, res, next) {
  eventList.List(req, res, next);
});

router.post("/v1/member_list_for_approved", function (req, res, next) {
  member.UserListForApproved(req, res, next);
});
router.get("/v1/user_details/:user_id", requireMemberAuth, function (req, res, next) {
  member.UserDetails(req, res, next);
});
router.get("/v1/event-registration-invoice/:id", requireMemberAuth, function (req, res, next) {
  member.downloadEventRegistrationInvoice(req, res, next);
});
router.get("/v1/membership-payment-invoice/:id", requireMemberAuth, function (req, res, next) {
  member.downloadMembershipPaymentInvoice(req, res, next);
});
router.post("/v1/member_approved", function (req, res, next) {
  member.SaveMemberApproved(req, res, next);
});
router.post("/v1/page_details", function (req, res, next) {
  page.pageDetails(req, res, next);
});

router.post("/v1/member_login", function (req, res, next) {
  member.Check(req, res, next);
});
// NEW
router.post("/v1/auth/refresh", function (req, res, next) {
  member.RefreshToken(req, res, next);
});
router.get("/v1/member_session", requireMemberAuth, function (req, res, next) {
  member.MemberSession(req, res, next);
});
router.post("/v1/member_forgot_password", function (req, res, next) {
  member.memberForgotPassword(req, res, next);
});
router.post("/v1/member_reset_password", function (req, res, next) {
  member.memberResetPassword(req, res, next);
});
router.post("/v1/member_register", member.Save);
router.post("/v1/member_update", requireMemberAuth, member.MemberUpdate);
router.post("/v1/donation_register", donation.Save);

router.get("/v1/home_page", function (req, res, next) {
  homePage.home_page(req, res, next);
});

router.get("/v1/menu_list", function (req, res, next) {
  menu.menu_list(req, res, next);
});

router.get("/v1/expired-only", requireMemberAuth, function (req, res, next) {
  member.expired_only_list(req, res, next);
});

module.exports = router;




