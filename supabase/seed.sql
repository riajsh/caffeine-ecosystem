/*
 * Ecosystem local seed data
 *
 * Exercises org/users/tags, Gmail review queue, and import pipeline states.
 * Sample profiles are not seeded — import real contacts via Admin → Import.
 *
 * Fixed UUIDs are stable across resets so UI and tests can reference them.
 *
 * Local auth (password, optional):
 *   ce@previously.co / password123  (admin)
 *   jh@previously.co / password123  (admin)
 *
 * Password sign-in works for seed users once auth.users exists.
 * Bootstrap reads app_metadata.org_id — no manual users row needed on first login
 * when seed has already inserted public.users.
 *
 * DEFAULT_ORG_SLUG must match: previously-unavailable
 */

begin;

-- ---------------------------------------------------------------------------
-- Stable IDs
-- ---------------------------------------------------------------------------

-- organisation
-- 11111111-1111-1111-1111-111111111111

-- users (auth + public)
-- chris e  22222222-2222-2222-2222-222222222229  admin
-- james     22222222-2222-2222-2222-222222222221  admin
-- henry     22222222-2222-2222-2222-222222222222  member
-- simon     22222222-2222-2222-2222-222222222223  member
-- ed        22222222-2222-2222-2222-222222222224  member
-- chris p   22222222-2222-2222-2222-222222222225  member
-- phoebe s  22222222-2222-2222-2222-222222222226  member
-- phoebe d  22222222-2222-2222-2222-222222222227  member
-- wider pu  22222222-2222-2222-2222-222222222228  member

-- ---------------------------------------------------------------------------
-- Organisation (tenant boundary — only place the PU name lives)
-- ---------------------------------------------------------------------------

insert into public.organisations (id, name, slug, email_access_level)
values (
  '11111111-1111-1111-1111-111111111111',
  'Previously Unavailable',
  'previously-unavailable',
  'restricted_body_access'
);

-- ---------------------------------------------------------------------------
-- Auth users (local dev login + bootstrap metadata)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222229',
    'authenticated',
    'authenticated',
    'ce@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Chris E'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222221',
    'authenticated',
    'authenticated',
    'jh@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'James'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'hk@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Henry'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222223',
    'authenticated',
    'authenticated',
    'sp@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Simon'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222224',
    'authenticated',
    'authenticated',
    'ed@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Ed'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222225',
    'authenticated',
    'authenticated',
    'cp@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Chris P'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222226',
    'authenticated',
    'authenticated',
    'ps@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Phoebe S'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222227',
    'authenticated',
    'authenticated',
    'pd@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Phoebe D'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222228',
    'authenticated',
    'authenticated',
    'team@previously.co',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'org_id', '11111111-1111-1111-1111-111111111111'
    ),
    jsonb_build_object('full_name', 'Wider PU'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '22222222-2222-2222-2222-222222222229',
    '22222222-2222-2222-2222-222222222229',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222229',
      'email', 'ce@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222229',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222221',
    '22222222-2222-2222-2222-222222222221',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222221',
      'email', 'jh@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222221',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222222',
      'email', 'hk@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222222',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    '22222222-2222-2222-2222-222222222223',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222223',
      'email', 'sp@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222223',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    '22222222-2222-2222-2222-222222222224',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222224',
      'email', 'ed@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222224',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222225',
    '22222222-2222-2222-2222-222222222225',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222225',
      'email', 'cp@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222225',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222226',
    '22222222-2222-2222-2222-222222222226',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222226',
      'email', 'ps@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222226',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222227',
    '22222222-2222-2222-2222-222222222227',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222227',
      'email', 'pd@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222227',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222228',
    '22222222-2222-2222-2222-222222222228',
    jsonb_build_object(
      'sub', '22222222-2222-2222-2222-222222222228',
      'email', 'team@previously.co',
      'email_verified', true
    ),
    'email',
    '22222222-2222-2222-2222-222222222228',
    now(),
    now(),
    now()
  );

-- ---------------------------------------------------------------------------
-- Team users
-- ---------------------------------------------------------------------------

insert into public.users (id, org_id, email, full_name, role)
values
  (
    '22222222-2222-2222-2222-222222222229',
    '11111111-1111-1111-1111-111111111111',
    'ce@previously.co',
    'Chris E',
    'admin'
  ),
  (
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    'jh@previously.co',
    'James',
    'admin'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'hk@previously.co',
    'Henry',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111111',
    'sp@previously.co',
    'Simon',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    '11111111-1111-1111-1111-111111111111',
    'ed@previously.co',
    'Ed',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222225',
    '11111111-1111-1111-1111-111111111111',
    'cp@previously.co',
    'Chris P',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222226',
    '11111111-1111-1111-1111-111111111111',
    'ps@previously.co',
    'Phoebe S',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222227',
    '11111111-1111-1111-1111-111111111111',
    'pd@previously.co',
    'Phoebe D',
    'member'
  ),
  (
    '22222222-2222-2222-2222-222222222228',
    '11111111-1111-1111-1111-111111111111',
    'team@previously.co',
    'Wider PU',
    'member'
  );

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

insert into public.tags (id, org_id, name, category)
values
  (
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    'Climate',
    'sector'
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '11111111-1111-1111-1111-111111111111',
    'Founder',
    'role'
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    '11111111-1111-1111-1111-111111111111',
    'London',
    'interest'
  );

-- ---------------------------------------------------------------------------
-- Profiles / graph
-- ---------------------------------------------------------------------------
-- No sample profiles — import real contacts via Admin → Import in local dev.

-- ---------------------------------------------------------------------------
-- Gmail sync fixtures
-- ---------------------------------------------------------------------------

insert into public.gmail_accounts (
  id,
  org_id,
  user_id,
  email,
  refresh_token,
  sync_enabled,
  last_sync_at,
  sync_cursor
)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccc01',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221',
  'jh@previously.co',
  'seed-refresh-token-not-real',
  true,
  '2026-06-19 08:00:00+00',
  'seed-history-id-001'
);

insert into public.email_threads (
  id,
  org_id,
  gmail_thread_id,
  gmail_account_id,
  subject,
  participants,
  project_label,
  last_message_at,
  message_count
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddd02',
  '11111111-1111-1111-1111-111111111111',
  'seed-thread-unknown-participant',
  'cccccccc-cccc-cccc-cccc-cccccccccc01',
  'Intro request — unknown participant',
  jsonb_build_array(
    jsonb_build_object('email', 'jh@previously.co', 'name', 'James', 'role', 'from'),
    jsonb_build_object('email', 'unknown@external-startup.io', 'name', 'Alex Unknown', 'role', 'to')
  ),
  'Projects',
  '2026-06-18 14:00:00+00',
  1
);

insert into public.email_messages (
  id,
  org_id,
  thread_id,
  gmail_message_id,
  sender,
  recipients,
  body,
  sent_at
)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
  '11111111-1111-1111-1111-111111111111',
  'dddddddd-dddd-dddd-dddd-dddddddddd02',
  'seed-message-unknown-001',
  'unknown@external-startup.io',
  jsonb_build_array(jsonb_build_object('email', 'jh@previously.co', 'role', 'to')),
  'Great to meet you at the event — would love to connect.',
  '2026-06-18 14:00:00+00'
);

insert into public.email_participant_reviews (
  id,
  org_id,
  email,
  display_name,
  thread_id,
  status,
  profile_id,
  reviewed_by,
  reviewed_at
)
values (
  'ffffffff-ffff-ffff-ffff-ffffffffff01',
  '11111111-1111-1111-1111-111111111111',
  'unknown@external-startup.io',
  'Alex Unknown',
  'dddddddd-dddd-dddd-dddd-dddddddddd02',
  'pending',
  null,
  null,
  null
);

-- ---------------------------------------------------------------------------
-- Imports (pending, processing, complete, failed) + row-level dedup states
-- ---------------------------------------------------------------------------

insert into public.imports (
  id,
  org_id,
  filename,
  source,
  row_count,
  status,
  created_by,
  metadata
)
values
  (
    '20202020-2020-2020-2020-202020202001',
    '11111111-1111-1111-1111-111111111111',
    'pending-contacts.csv',
    'clay',
    2,
    'pending',
    '22222222-2222-2222-2222-222222222221',
    jsonb_build_object('note', 'Awaiting column mapping')
  ),
  (
    '20202020-2020-2020-2020-202020202002',
    '11111111-1111-1111-1111-111111111111',
    'processing-batch.csv',
    'csv',
    3,
    'processing',
    '22222222-2222-2222-2222-222222222221',
    jsonb_build_object('note', 'Dedup in progress')
  ),
  (
    '20202020-2020-2020-2020-202020202003',
    '11111111-1111-1111-1111-111111111111',
    'complete-batch.csv',
    'clay',
    4,
    'complete',
    '22222222-2222-2222-2222-222222222222',
    jsonb_build_object('committed_at', '2026-06-01T10:00:00Z')
  ),
  (
    '20202020-2020-2020-2020-202020202004',
    '11111111-1111-1111-1111-111111111111',
    'failed-batch.csv',
    'airtable',
    2,
    'failed',
    '22222222-2222-2222-2222-222222222221',
    jsonb_build_object('error', 'Invalid header row')
  );

insert into public.import_rows (
  id,
  org_id,
  import_id,
  row_number,
  raw,
  normalized,
  dedup_status,
  matched_profile_id,
  error
)
values
  (
    '30303030-3030-3030-3030-303030303001',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202001',
    1,
    jsonb_build_object('name', 'New Person', 'email', 'new@example.test'),
    jsonb_build_object('full_name', 'New Person', 'email', 'new@example.test'),
    'pending',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303002',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202001',
    2,
    jsonb_build_object('name', 'Another Person'),
    jsonb_build_object('full_name', 'Another Person'),
    'pending',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303003',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202002',
    1,
    jsonb_build_object('name', 'Existing Contact', 'email', 'existing@example.test'),
    jsonb_build_object('full_name', 'Existing Contact', 'email', 'existing@example.test'),
    'new',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303004',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202002',
    2,
    jsonb_build_object('name', 'Soft Match Candidate', 'company', 'Example Robotics Ltd'),
    jsonb_build_object(
      'full_name',
      'Soft Match Candidate',
      'organisation_name',
      'Example Robotics Ltd'
    ),
    'new',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303005',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202002',
    3,
    jsonb_build_object('name', 'Fresh Contact', 'email', 'fresh@newco.test'),
    jsonb_build_object('full_name', 'Fresh Contact', 'email', 'fresh@newco.test'),
    'new',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303006',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202003',
    1,
    jsonb_build_object('name', 'Committed Contact', 'email', 'committed@example.test'),
    jsonb_build_object('full_name', 'Committed Contact', 'email', 'committed@example.test'),
    'new',
    null,
    null
  ),
  (
    '30303030-3030-3030-3030-303030303007',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202004',
    1,
    jsonb_build_object('bad', 'row'),
    jsonb_build_object(),
    'error',
    null,
    'Missing required column: full_name'
  ),
  (
    '30303030-3030-3030-3030-303030303008',
    '11111111-1111-1111-1111-111111111111',
    '20202020-2020-2020-2020-202020202004',
    2,
    jsonb_build_object('name', 'Broken Row'),
    jsonb_build_object('full_name', 'Broken Row'),
    'error',
    null,
    'Row failed validation'
  );

commit;
