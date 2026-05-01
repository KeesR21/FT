-- Demo players + parents for testing Admin → Finance → Invoices (subscriptions end in 0–5 days).
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING.
-- Run: npm run db:seed:invoice-demos  (requires DATABASE_URL)

BEGIN;

INSERT INTO parents (id, parent_name, phone_number, email, address)
VALUES
  (
    'a0000004-0000-4000-8000-000000000001'::uuid,
    'Marie Kayitesi',
    '+250 780 777 888',
    'invoice.demo.parent1@example.com',
    'Kigali, Remera'
  ),
  (
    'a0000005-0000-4000-8000-000000000001'::uuid,
    'Thierry Bizimana',
    '+250 780 888 999',
    'invoice.demo.parent2@example.com',
    'Kigali, Kimironko'
  ),
  (
    'a0000006-0000-4000-8000-000000000001'::uuid,
    'Claudine Mukamazimpaka',
    '+250 780 111 333',
    'invoice.demo.parent3@example.com',
    'Kigali, Gikondo'
  ),
  (
    'a0000007-0000-4000-8000-000000000001'::uuid,
    'Emmanuel Ntawangundi',
    '+250 780 222 444',
    'invoice.demo.parent4@example.com',
    'Kigali, Nyamirambo'
  ),
  (
    'a0000008-0000-4000-8000-000000000001'::uuid,
    'Sandrine Uwera',
    '+250 780 333 555',
    'invoice.demo.parent5@example.com',
    'Kigali, Kacyiru'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO players (
  id,
  parent_id,
  player_name,
  date_of_birth,
  age_group,
  height_cm,
  weight_kg,
  status,
  registration_status,
  development_notes,
  subscription_valid_until
)
VALUES
  (
    'b0000001-0000-4000-8000-000000000001'::uuid,
    'a0000004-0000-4000-8000-000000000001'::uuid,
    'Leo Niyonkuru',
    '2015-06-01',
    'U11',
    145,
    38,
    'active',
    'approved',
    'Seed data for invoice UI testing.',
    (CURRENT_DATE + 3)
  ),
  (
    'b0000002-0000-4000-8000-000000000001'::uuid,
    'a0000005-0000-4000-8000-000000000001'::uuid,
    'Noah Hategekimana',
    '2013-03-15',
    'U13',
    162,
    52,
    'active',
    'approved',
    'Seed data for invoice UI testing.',
    (CURRENT_DATE + 5)
  ),
  (
    'b0000003-0000-4000-8000-000000000001'::uuid,
    'a0000006-0000-4000-8000-000000000001'::uuid,
    'Ivan Mutesi',
    '2018-04-12',
    'U9',
    130,
    27,
    'active',
    'approved',
    'Seed data for invoice UI testing.',
    CURRENT_DATE
  ),
  (
    'b0000004-0000-4000-8000-000000000001'::uuid,
    'a0000007-0000-4000-8000-000000000001'::uuid,
    'Emma Ingabire',
    '2012-09-20',
    'U14A',
    160,
    50,
    'active',
    'approved',
    'Seed data for invoice UI testing.',
    (CURRENT_DATE + 1)
  ),
  (
    'b0000005-0000-4000-8000-000000000001'::uuid,
    'a0000008-0000-4000-8000-000000000001'::uuid,
    'Joel Ndayishimiye',
    '2015-11-03',
    'U11',
    148,
    40,
    'active',
    'approved',
    'Seed data for invoice UI testing.',
    (CURRENT_DATE + 4)
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
