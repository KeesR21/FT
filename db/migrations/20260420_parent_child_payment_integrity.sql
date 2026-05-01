BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parents_email_lower ON parents (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_phone_digits ON parents ((regexp_replace(phone_number, '\D', '', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS uq_players_parent_name_dob
  ON players (parent_id, lower(player_name), date_of_birth);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_player_period_open
  ON payments (player_id, lower(payment_for), date_trunc('month', due_date::timestamp))
  WHERE status <> 'paid';

COMMIT;
