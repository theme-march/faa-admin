const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

async function getDashboardData() {
  const membershipCategoryCounts = await sequelize.query(
    `
      SELECT
        c.id AS category_id,
        c.category_name,
        COUNT(DISTINCT m.id) AS member_count,
        COALESCE(SUM(CAST(REPLACE(COALESCE(msp.pay_amount, '0'), ',', '') AS DECIMAL(12,2))), 0) AS total_paid_amount
      FROM member_list m
      INNER JOIN category_list c ON m.membership_category_id = c.id
      LEFT JOIN member_ship_payments msp
        ON msp.member_id = m.id
       AND msp.tx_status IN ('VALID', 'CASH_RECEIVED')
      GROUP BY c.id, c.category_name
      ORDER BY member_count DESC
    `,
    { type: QueryTypes.SELECT }
  );

  const eventPaidSummary = await sequelize.query(
    `
      SELECT
        el.id AS event_id,
        el.event_title,
        COALESCE(SUM(CAST(er.pay_amount AS DECIMAL(12,2))), 0) AS total_paid
      FROM event_list el
      LEFT JOIN event_register er
        ON er.event_id = el.id
       AND (
            er.is_pay = 1
            OR er.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED')
          )
      GROUP BY el.id, el.event_title
      ORDER BY total_paid DESC, el.id DESC
      LIMIT 10
    `,
    { type: QueryTypes.SELECT }
  );

  const sponsorPaidSummary = await sequelize.query(
    `
      SELECT
        el.id AS event_id,
        el.event_title,
        COALESCE(SUM(CAST(esr.approximately_amount AS DECIMAL(12,2))), 0) AS sponsor_paid
      FROM event_list el
      LEFT JOIN event_sponsor_register esr
        ON esr.event_id = el.id
       AND (
            esr.is_pay = 1
            OR esr.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED')
          )
      GROUP BY el.id, el.event_title
      ORDER BY sponsor_paid DESC, el.id DESC
      LIMIT 10
    `,
    { type: QueryTypes.SELECT }
  );

  const sponsorPaymentTable = await sequelize.query(
    `
      SELECT
        esr.id,
        el.event_title,
        esr.organization_name AS sponsor_name,
        CAST(esr.approximately_amount AS DECIMAL(12,2)) AS paid_amount,
        COALESCE(esr.tx_status, 'PENDING') AS payment_status,
        DATE_FORMAT(esr.created_at, '%Y-%m-%d') AS created_date
      FROM event_sponsor_register esr
      LEFT JOIN event_list el ON el.id = esr.event_id
      ORDER BY esr.id DESC
      LIMIT 200
    `,
    { type: QueryTypes.SELECT }
  );

  const recentActivities = await sequelize.query(
    `
      SELECT activity_type, activity_title, activity_subtitle, activity_time
      FROM (
        SELECT
          'Event Registration' AS activity_type,
          CONCAT('New registration: ', COALESCE(full_name, 'Unknown')) AS activity_title,
          CONCAT('Event ID: ', event_id, ' | Status: ', COALESCE(tx_status, 'PENDING')) AS activity_subtitle,
          created_at AS activity_time
        FROM event_register
        UNION ALL
        SELECT
          'Sponsor Payment' AS activity_type,
          CONCAT('Sponsor: ', COALESCE(organization_name, 'Unknown')) AS activity_title,
          CONCAT('Event ID: ', event_id, ' | Status: ', COALESCE(tx_status, 'PENDING')) AS activity_subtitle,
          created_at AS activity_time
        FROM event_sponsor_register
      ) act
      ORDER BY activity_time DESC
      LIMIT 5
    `,
    { type: QueryTypes.SELECT }
  );

  const counters = {
    eventRegistrationPending: await sequelize.query(
      `SELECT COUNT(*) AS total FROM event_register WHERE COALESCE(is_pay, 0) = 0`,
      { type: QueryTypes.SELECT }
    ),
    sponsorPaymentPending: await sequelize.query(
      `SELECT COUNT(*) AS total FROM event_sponsor_register WHERE COALESCE(is_pay, 0) = 0`,
      { type: QueryTypes.SELECT }
    ),
    unreadContacts: await sequelize.query(
      `SELECT COUNT(*) AS total FROM contacts WHERE COALESCE(status, 0) = 0`,
      { type: QueryTypes.SELECT }
    ),
  };

  const notificationCounts = {
    eventRegistrationPending: Number(counters.eventRegistrationPending[0]?.total || 0),
    sponsorPaymentPending: Number(counters.sponsorPaymentPending[0]?.total || 0),
    unreadContacts: Number(counters.unreadContacts[0]?.total || 0),
  };

  const dashboardSummaryRow = await sequelize.query(
    `
      SELECT
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(er.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM event_register er
          WHERE (COALESCE(er.is_pay, 0) = 1 OR er.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED'))
            AND LOWER(COALESCE(er.payment_type, '')) <> 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(esr.approximately_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM event_sponsor_register esr
          WHERE (COALESCE(esr.is_pay, 0) = 1 OR esr.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED'))
            AND LOWER(COALESCE(esr.payment_type, '')) <> 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(msp.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM member_ship_payments msp
          WHERE msp.tx_status IN ('VALID', 'CASH_RECEIVED')
            AND LOWER(COALESCE(msp.payment_type, '')) <> 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(dl.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM donation_list dl
          WHERE dl.tx_status IN ('VALID', 'CASH_RECEIVED')
            AND LOWER(COALESCE(dl.payment_type, '')) <> 'cash'
        ), 0) AS total_ssl_payment,

        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(er.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM event_register er
          WHERE (COALESCE(er.is_pay, 0) = 1 OR er.tx_status = 'CASH_RECEIVED')
            AND LOWER(COALESCE(er.payment_type, '')) = 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(esr.approximately_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM event_sponsor_register esr
          WHERE (COALESCE(esr.is_pay, 0) = 1 OR esr.tx_status = 'CASH_RECEIVED')
            AND LOWER(COALESCE(esr.payment_type, '')) = 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(msp.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM member_ship_payments msp
          WHERE msp.tx_status = 'CASH_RECEIVED'
            AND LOWER(COALESCE(msp.payment_type, '')) = 'cash'
        ), 0)
        +
        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(dl.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM donation_list dl
          WHERE dl.tx_status = 'CASH_RECEIVED'
            AND LOWER(COALESCE(dl.payment_type, '')) = 'cash'
        ), 0) AS total_cash_payment,

        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(er.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM event_register er
          WHERE (COALESCE(er.is_pay, 0) = 1 OR er.tx_status IN ('VALID', 'VALIDATED', 'SUCCESS', 'CASH_RECEIVED'))
        ), 0) AS event_total_paid_amount,

        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(msp.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM member_ship_payments msp
          WHERE msp.tx_status IN ('VALID', 'CASH_RECEIVED')
        ), 0) AS membership_total_paid_amount,

        COALESCE((
          SELECT SUM(CAST(REPLACE(COALESCE(dl.pay_amount, '0'), ',', '') AS DECIMAL(12,2)))
          FROM donation_list dl
          WHERE dl.tx_status IN ('VALID', 'CASH_RECEIVED')
        ), 0) AS donation_total_paid_amount,

        COALESCE((
          SELECT COUNT(*)
          FROM donation_list dl
          WHERE dl.tx_status IN ('VALID', 'CASH_RECEIVED')
        ), 0) AS total_paid_donations,

        COALESCE((
          SELECT COUNT(*)
          FROM member_list ml
          WHERE COALESCE(ml.status, 1) = 1
        ), 0) AS total_members,

        COALESCE((
          SELECT COUNT(*)
          FROM member_list ml
          WHERE COALESCE(ml.status, 1) = 1
            AND COALESCE(ml.is_pay, 0) = 1
        ), 0) AS paid_members,

        COALESCE((
          SELECT COUNT(*)
          FROM member_list ml
          WHERE COALESCE(ml.status, 1) = 1
            AND COALESCE(ml.is_pay, 0) = 0
        ), 0) AS unpaid_members,

        COALESCE((
          SELECT COUNT(*)
          FROM member_list ml
          WHERE COALESCE(ml.status, 1) = 1
            AND COALESCE(ml.admin_approval, 0) = 0
        ), 0) AS pending_approval,

        COALESCE((
          SELECT COUNT(*)
          FROM member_ship_payments msp
          WHERE LOWER(COALESCE(msp.payment_type, '')) = 'cash'
            AND msp.tx_status = 'CASH_PENDING'
        ), 0) AS pending_membership_cash,

        COALESCE((
          SELECT COUNT(*)
          FROM event_register er
          WHERE LOWER(COALESCE(er.payment_type, '')) = 'cash'
            AND er.tx_status = 'CASH_PENDING'
        ), 0) AS pending_event_cash,

        COALESCE((
          SELECT COUNT(*)
          FROM donation_list dl
          WHERE LOWER(COALESCE(dl.payment_type, '')) = 'cash'
            AND dl.tx_status = 'CASH_PENDING'
        ), 0) AS pending_donation_cash,

        COALESCE((
          SELECT COUNT(*)
          FROM event_sponsor_register esr
          WHERE LOWER(COALESCE(esr.payment_type, '')) = 'cash'
            AND esr.tx_status = 'CASH_PENDING'
        ), 0) AS pending_sponsor_cash
    `,
    { type: QueryTypes.SELECT }
  );

  const dashboardSummary = dashboardSummaryRow[0] || {};
  const summaryStats = {
    totalSslPayment: Number(dashboardSummary.total_ssl_payment || 0),
    totalCashPayment: Number(dashboardSummary.total_cash_payment || 0),
    eventTotalPaidAmount: Number(dashboardSummary.event_total_paid_amount || 0),
    membershipTotalPaidAmount: Number(dashboardSummary.membership_total_paid_amount || 0),
    donationTotalPaidAmount: Number(dashboardSummary.donation_total_paid_amount || 0),
    totalPaidDonations: Number(dashboardSummary.total_paid_donations || 0),
    totalMembers: Number(dashboardSummary.total_members || 0),
    paidMembers: Number(dashboardSummary.paid_members || 0),
    unpaidMembers: Number(dashboardSummary.unpaid_members || 0),
    pendingApproval: Number(dashboardSummary.pending_approval || 0),
    pendingMembershipCash: Number(dashboardSummary.pending_membership_cash || 0),
    pendingEventCash: Number(dashboardSummary.pending_event_cash || 0),
    pendingDonationCash: Number(dashboardSummary.pending_donation_cash || 0),
    pendingSponsorCash: Number(dashboardSummary.pending_sponsor_cash || 0),
  };

  return {
    membershipCategoryCounts,
    eventPaidSummary,
    sponsorPaidSummary,
    sponsorPaymentTable,
    recentActivities,
    notificationCounts,
    summaryStats,
  };
}

exports.data = async (req, res, next) => {
  try {
    const dashboardData = await getDashboardData();

    res.render("dashboard/index", {
      title: "Dashboard",
      ...dashboardData,
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    next(err);
  }
};

exports.metrics = async (req, res) => {
  try {
    const dashboardData = await getDashboardData();
    return res.status(200).json({ success: true, ...dashboardData });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
