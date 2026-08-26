function normalizedIdentity(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

function normalizedPhone(value) {
  return String(value == null ? "" : value).replace(/[^0-9]/g, "");
}

function registrationBelongsToMember(registration, member) {
  if (!registration || !member) return false;
  const registrationMemberId = normalizedIdentity(registration.member_id);
  const memberId = normalizedIdentity(member.id);
  const membershipNumber = normalizedIdentity(member.membership_number);
  const registrationEmail = normalizedIdentity(registration.email_address);
  const memberEmail = normalizedIdentity(member.email);
  const registrationPhone = normalizedPhone(registration.phone_number);
  const memberPhone = normalizedPhone(member.phone_number);

  return Boolean(
    (registrationMemberId && registrationMemberId === memberId) ||
    (registrationMemberId && membershipNumber && registrationMemberId === membershipNumber) ||
    (registrationEmail && memberEmail && registrationEmail === memberEmail) ||
    (registrationPhone && memberPhone && registrationPhone === memberPhone)
  );
}

module.exports = {
  normalizedIdentity,
  normalizedPhone,
  registrationBelongsToMember,
};
