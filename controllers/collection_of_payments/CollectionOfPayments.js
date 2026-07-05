const { sequelize } = require("../../models");
const { QueryTypes } = require('sequelize');
const XLSX = require('xlsx');

exports.list = (req, res) => {
  res.render('collection_of_payments/index');
};

function buildWhereClause(source_type, searchValue, start_date, end_date) {
  let whereConditions = [];
  if (source_type) whereConditions.push(`source = '${source_type}'`);
  if (start_date) whereConditions.push(`DATE(created_at) >= '${start_date}'`);
  if (end_date) whereConditions.push(`DATE(created_at) <= '${end_date}'`);
  if (searchValue) whereConditions.push(`phone_number LIKE '%${searchValue}%'`);
  return whereConditions.length ? 'WHERE ' + whereConditions.join(' AND ') : '';
}

function baseUnionQuery() {
  return `
    SELECT * FROM (
      SELECT 'Event' AS source, er.member_id, er.student_id, er.full_name AS name, er.organization_name, er.session, er.member_type, er.phone_number, er.email_address, er.pay_amount, er.created_at
      FROM event_register er WHERE er.is_pay = 1

      UNION ALL

      SELECT 'Event Sponsor' AS source, NULL AS member_id, NULL AS student_id, esr.distributor_name AS name, esr.organization_name, NULL AS session, NULL AS member_type, esr.phone_number, esr.email AS email_address, esr.approximately_amount AS pay_amount, esr.created_at
      FROM event_sponsor_register esr WHERE esr.is_pay = 1

      UNION ALL

      SELECT 
        'Membership Payment' AS source,
        msp.member_id,
        NULL AS student_id,
        COALESCE(ml.name, msp.name) AS name,
        COALESCE(ml.organization_name, msp.organization_name) AS organization_name,
        ml.session,
        cl.category_name AS member_type,
        COALESCE(ml.phone_number, msp.phone_number) AS phone_number,
        COALESCE(ml.email, msp.email_address) AS email_address,
        msp.pay_amount,
        msp.created_at
      FROM member_ship_payments msp
      LEFT JOIN member_list ml ON ml.id = msp.member_id
      LEFT JOIN category_list cl ON cl.id = ml.membership_category_id
      WHERE msp.tx_status IN ('VALID', 'CASH_RECEIVED')

      UNION ALL

      SELECT 'Donation' AS source, NULL AS member_id, NULL AS student_id, dl.name, dl.organization_name, NULL AS session, NULL AS member_type, dl.phone_number, dl.email_address, dl.pay_amount, dl.created_at
      FROM donation_list dl WHERE dl.tx_status IN ('VALID', 'CASH_RECEIVED')
    ) AS combined
  `;
}

exports.getCollectionOfPayments = async (req, res) => {
  const draw = req.query.draw;
  const start = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length) || 10;
  const source_type = req.query.source_type || '';
  const searchValue = req.query.search?.value || '';
  const start_date = req.query.start_date || '';
  const end_date = req.query.end_date || '';

  const whereClause = buildWhereClause(source_type, searchValue, start_date, end_date);
  const baseQuery = `${baseUnionQuery()} ${whereClause} ORDER BY created_at DESC LIMIT ${length} OFFSET ${start};`;
  const countQuery = `SELECT COUNT(*) AS total FROM (${baseUnionQuery()} ${whereClause}) AS counted;`;
  const sumQuery = `
    SELECT COALESCE(SUM(CAST(REPLACE(COALESCE(pay_amount, '0'), ',', '') AS DECIMAL(12,2))), 0) AS total_amount
    FROM (${baseUnionQuery()} ${whereClause}) AS summed;
  `;

  const data = await sequelize.query(baseQuery, { type: QueryTypes.SELECT });
  const countResult = await sequelize.query(countQuery, { type: QueryTypes.SELECT });
  const sumResult = await sequelize.query(sumQuery, { type: QueryTypes.SELECT });
  const total = countResult[0]?.total || 0;
  const totalAmount = Number(sumResult[0]?.total_amount || 0);

  return res.json({
    draw,
    recordsTotal: total,
    recordsFiltered: total,
    totalAmount,
    data,
  });
};

exports.downloadExcel = async (req, res) => {
  const source_type = req.query.source_type || '';
  const start_date = req.query.start_date || '';
  const end_date = req.query.end_date || '';
  const whereClause = buildWhereClause(source_type, '', start_date, end_date);

  const rows = await sequelize.query(
    `${baseUnionQuery()} ${whereClause} ORDER BY created_at DESC;`,
    { type: QueryTypes.SELECT }
  );

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections');

  const filePath = 'collection_of_payments.xlsx';
  XLSX.writeFile(workbook, filePath);
  return res.download(filePath);
};

