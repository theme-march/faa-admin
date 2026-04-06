const { sequelize } = require("../models");
const { QueryTypes } = require('sequelize');

exports.participantDetails = async (req, res, next) => {
  const id = req.query.id;
  const enteredPasscode = String(req.query.passcode || req.query.password || "").trim();

  try {
    const [participant] = await sequelize.query(
      `SELECT 
        er.id, 
        er.event_id,
        e.event_title,
        e.event_date,
        e.event_venue, 
        er.full_name, 
        er.email_address,
        er.phone_number,
        er.t_shirt_size,
        er.delivery_option,
        er.is_outside_dhaka,
        er.delivery_charge,
        er.delivery_address,
        er.tx_tran_date, 
        er.payment_type, 
        er.tx_status, 
        er.pay_amount, 
        er.participation_type,
        er.entry_passcode,
        er.enter_date_time,
        er.is_pay
      FROM event_register er 
      INNER JOIN event_list e ON er.event_id = e.id 
      WHERE er.id = :id`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    if (!participant) {
      return res.render('enter_event', {
        layout: false,
        title: 'Event Entry',
        message: 'You are not registered for this event.',
        participant: null,
        showEnterButton: false,
        showResetButton: false,
      });
    }

    let message = '';
    let showEnterButton = false;
    let showResetButton = false;
    let requiresPasscode = false;

    const savedPasscode = String(participant.entry_passcode || "").trim();
    if (savedPasscode && savedPasscode !== enteredPasscode) {
      requiresPasscode = true;
      message = "Enter your Event Entry Password to access this page.";
    } else if (participant.is_pay === 1) {
      if (!participant.enter_date_time) {
        message = 'You have paid for this event. Click the button to enter.';
        showEnterButton = true;
      } else {
        message = 'You have already entered this event.';
      }
    } else {
      message = 'You have not paid for this event.';
    }

    res.render('enter_event', {
      layout: false,
      title: 'Event Entry',
      message,
      participant: requiresPasscode ? { id: participant.id } : participant,
      showEnterButton,
      showResetButton,
      requiresPasscode,
      enteredPasscode,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateEnterDateTime = async (req, res, next) => {
  const id = req.body.id;
  const passcode = String(req.body.passcode || "").trim();

  try {
    const [participant] = await sequelize.query(
      `SELECT id, entry_passcode, is_pay FROM event_register WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    if (!participant) {
      return res.json({ success: false, message: 'Failed to update entry. Participant not found.' });
    }

    const savedPasscode = String(participant.entry_passcode || "").trim();
    if (savedPasscode && savedPasscode !== passcode) {
      return res.json({ success: false, message: 'Invalid Event Entry Password.' });
    }

    if (Number(participant.is_pay) !== 1) {
      return res.json({ success: false, message: 'Payment is pending for this registration.' });
    }

    const [result] = await sequelize.query(
      `UPDATE event_register 
       SET enter_date_time = NOW() 
       WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.UPDATE,
      }
    );

    if (result === 0) {
      return res.json({ success: false, message: 'Failed to update entry. Participant not found.' });
    }

    res.json({ success: true, message: 'Successfully entered the event.' });
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: 'Failed to enter the event.' });
  }
};

exports.resetEnterDateTime = async (req, res, next) => {
  return res.status(403).json({
    success: false,
    message: "Reset entry is disabled on public page. Please ask admin to reset from admin panel.",
  });
};
