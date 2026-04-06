-- Run this SQL on the faaw_db database to add missing columns
-- Safe to run multiple times (uses IF NOT EXISTS logic via ALTER IGNORE)

-- Add member_participation_options if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS member_participation_options TEXT NULL DEFAULT NULL AFTER student_spouse_fees;

-- Add guest_participation_options if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS guest_participation_options TEXT NULL DEFAULT NULL AFTER member_participation_options;

-- Add t_shirt_size_options if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS t_shirt_size_options TEXT NULL DEFAULT NULL AFTER t_shirt_gift_status;

-- Add t_shirt_gift_status if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS t_shirt_gift_status TINYINT(1) NULL DEFAULT 0 AFTER student_spouse_fees;

-- Add membership_renew_status if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS membership_renew_status TINYINT(1) NULL DEFAULT 1 AFTER membership_renew_fees;

-- Add registration_access_mode if not exists
ALTER TABLE event_list
  ADD COLUMN IF NOT EXISTS registration_access_mode VARCHAR(50) NULL DEFAULT 'both' AFTER membership_renew_status;

-- Set default values for existing rows where columns are null
UPDATE event_list
SET
  member_participation_options = COALESCE(
    NULLIF(member_participation_options, ''),
    CONCAT('Single|', COALESCE(member_single_fees, 2000), '\nWith Spouse|', COALESCE(CAST(member_single_fees AS UNSIGNED) + CAST(COALESCE(member_spouse_fees, 0) AS UNSIGNED), 4000))
  )
WHERE member_participation_options IS NULL OR member_participation_options = '';

UPDATE event_list
SET
  guest_participation_options = COALESCE(
    NULLIF(guest_participation_options, ''),
    CONCAT('Student- BBA/MBA|', COALESCE(student_single_fees, 500), '\nStudent- EMBA/MPF|', COALESCE(student_spouse_fees, 2000))
  )
WHERE guest_participation_options IS NULL OR guest_participation_options = '';

UPDATE event_list
SET
  t_shirt_size_options = 'S|T- Shirt: S - Length 26" chest 36".\nM|T- Shirt: M - Length 27" chest 38".\nL|T- Shirt: L - Length 28" chest: 40".\nXL|T- Shirt: XL - Length 29" chest 42"\n2XL|T- Shirt: 2XL - Length 30" chest 44"\n3XL|T- Shirt: 3XL - Length 31" chest 46"\n4XL|T- Shirt: 4XL - Length 32" chest 48"\n5XL|T- Shirt: 5XL - Length 33" chest 50"'
WHERE t_shirt_size_options IS NULL OR t_shirt_size_options = '';

UPDATE event_list
SET registration_access_mode = 'both'
WHERE registration_access_mode IS NULL OR registration_access_mode = '';

SELECT 'Migration complete!' AS status;
