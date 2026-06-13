-- =====================================================
-- GAP-TIME — Team Setup
-- Run AFTER creating each person's account
-- (either via Admin → User Management → Create Account,
--  or via Supabase Authentication → Users → Add User)
--
-- Replace each 'xxxxx@gap.com' with that person's real email.
-- =====================================================

-- 1. Kwame Ababio — CEO — Executive Office — Admin access
UPDATE public.profiles SET position = 'CEO', department = 'Executive Office'
WHERE email = 'kwame.ababio@gap.com';
UPDATE public.user_roles SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'kwame.ababio@gap.com');

-- 2. Queenly Obuobisa-Darko — Administrative Lead — Administration — Manager access
UPDATE public.profiles SET position = 'Administrative Lead', department = 'Administration'
WHERE email = 'queenly.obuobisadarko@gap.com';
UPDATE public.user_roles SET role = 'manager'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'queenly.obuobisadarko@gap.com');

-- 3. Asare B. Quansah — Human Resource Manager — Human Resources — Admin access
UPDATE public.profiles SET position = 'Human Resource Manager', department = 'Human Resources'
WHERE email = 'quansah@gap.com';
UPDATE public.user_roles SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'quansah@gap.com');

-- 4. Issaka Abdul Manaff — Operations Officer — Operations — Manager access
UPDATE public.profiles SET position = 'Operations Officer', department = 'Operations'
WHERE email = 'issaka.manaff@gap.com';
UPDATE public.user_roles SET role = 'manager'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'issaka.manaff@gap.com');

-- 5. Dorcas Aba Quansah — Project Lead (SmartFarmer) — SmartFarmer — Manager access
UPDATE public.profiles SET position = 'Project Lead', department = 'SmartFarmer'
WHERE email = 'dorcas.quansah@gap.com';
UPDATE public.user_roles SET role = 'manager'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'dorcas.quansah@gap.com');

-- 6. Amornor Narh Justice — Farms Officer (SmartFarmer) — SmartFarmer — Employee access
UPDATE public.profiles SET position = 'Farms Officer', department = 'SmartFarmer'
WHERE email = 'justice.amornor@gap.com';
UPDATE public.user_roles SET role = 'employee'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'justice.amornor@gap.com');

-- 7. Augustine Acheampong — Capital & Partnership Officer (SmartFarmer) — SmartFarmer — Employee access
UPDATE public.profiles SET position = 'Capital & Partnership Officer', department = 'SmartFarmer'
WHERE email = 'augustine.acheampong@gap.com';
UPDATE public.user_roles SET role = 'employee'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'augustine.acheampong@gap.com');

-- 8. Richard Mensah — Sales Lead (Commercials) — Commercials — Manager access
UPDATE public.profiles SET position = 'Sales Lead', department = 'Commercials'
WHERE email = 'richard.mensah@gap.com';
UPDATE public.user_roles SET role = 'manager'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'richard.mensah@gap.com');

-- 9. Mutawakil Alhassan — Sales Associate (Commercials) — Commercials — Employee access
UPDATE public.profiles SET position = 'Sales Associate', department = 'Commercials'
WHERE email = 'mutawakil.alhassan@gap.com';
UPDATE public.user_roles SET role = 'employee'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mutawakil.alhassan@gap.com');

-- 10. Hannah Duruyeh — Assist. Administrator — Administration — Employee access
UPDATE public.profiles SET position = 'Assist. Administrator', department = 'Administration'
WHERE email = 'hannah.duruyeh@gap.com';
UPDATE public.user_roles SET role = 'employee'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hannah.duruyeh@gap.com');

-- =====================================================
-- Quick check — verify everything saved correctly
-- =====================================================
SELECT p.name, p.email, p.position, p.department, r.role
FROM public.profiles p
LEFT JOIN public.user_roles r ON r.user_id = p.user_id
ORDER BY p.name;
