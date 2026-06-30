-- ============================================================
-- BACKFILL: Historical Pay Periods + Expenses
-- Run this AFTER schema.sql in Supabase SQL Editor.
-- ============================================================

insert into pay_periods (start_date, end_date, paycheck_amount, gross_amount, roth_401k, brokerage_amount, savings_amount, is_locked, locked_at)
values
  ('2026-04-01', '2026-04-15', 1614.86, 4386.56, 745.72, 248.44, 621.10, true, now()),
  ('2026-04-16', '2026-04-30', 1614.86, 4386.56, 745.72, 248.44, 621.10, true, now()),
  ('2026-05-01', '2026-05-15', 1614.86, 4386.56, 745.72, 248.44, 621.10, true, now()),
  ('2026-05-16', '2026-05-31', 1614.86, 4386.56, 745.72, 248.44, 621.10, true, now()),
  ('2026-06-01', '2026-06-15', 1614.86, 4386.56, 745.72, 248.44, 621.10, true, now());

-- ============================================================
-- PAY PERIOD: Apr 1 - Apr 15, 2026
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Auto (service/misc)', 10.00, 'Autobell Car Wash', '2026-03-28'),
  ('Groceries',            4.11, 'Wal-Mart', '2026-03-30'),
  ('Dining Out',          14.62, 'Chipotle', '2026-04-01'),
  ('Golf',                58.40, 'Glf*Redwing', '2026-04-01'),
  ('Groceries',            6.05, 'Trader Joe''s', '2026-04-02'),
  ('Dining Out',           1.32, 'Papa John''s', '2026-04-03'),
  ('Dining Out',           3.17, 'Long Bay Pointe Bar', '2026-04-03'),
  ('Dining Out',           5.75, 'Long Bay Pointe Bar', '2026-04-03'),
  ('Dining Out',          23.51, 'Papa John''s', '2026-04-03'),
  ('Gas & Fuel',          65.20, '7-Eleven', '2026-04-04'),
  ('Groceries',           56.24, 'Lowe''s Foods', '2026-04-06'),
  ('Auto (service/misc)',  7.00, 'Grand Slam Car Wash', '2026-04-08'),
  ('Groceries',          113.74, 'Sam''s Club', '2026-04-09'),
  ('Groceries',           17.62, 'Trader Joe''s', '2026-04-08'),
  ('Shopping',            10.59, 'Target', '2026-04-09'),
  ('Gas & Fuel',          54.50, '7-Eleven', '2026-04-09'),
  ('Shopping',            10.58, 'Amazon', '2026-04-10'),
  ('Dining Out',          54.59, 'The Lucky Penny', '2026-04-10'),
  ('Dining Out',          19.08, 'Philly Cold Cuts', '2026-04-10'),
  ('Shopping',            17.11, 'SP Figs Inc', '2026-04-12'),
  ('Groceries',            5.14, 'Food Lion', '2026-04-13'),
  ('Golf',                62.39, 'Glf*Honeybee Golf Club', '2026-04-13'),
  ('Dining Out',          15.64, 'Taco Bell', '2026-04-14'),
  ('Shopping',            11.19, 'Target', '2026-04-15'),
  ('Auto (service/misc)', 32.84, 'West Marine', '2026-04-14'),
  ('Gas & Fuel',          43.16, '7-Eleven', '2026-04-16')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-04-01' and pp.end_date = '2026-04-15';

-- ============================================================
-- PAY PERIOD: Apr 16 - Apr 30, 2026
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Gas & Fuel',           8.20, 'Royal Farms', '2026-04-15'),
  ('Groceries',            14.09, 'Publix', '2026-04-15'),
  ('Dining Out',           11.70, 'Chipotle', '2026-04-15'),
  ('Entertainment',       727.13, 'Nova Armory (one-time)', '2026-04-17'),
  ('Subscriptions',        12.99, 'Spotify', '2026-04-17'),
  ('Dining Out',          139.91, 'El Rey', '2026-04-16'),
  ('Transportation',      10.35, 'Parking.com', '2026-04-17'),
  ('Gas & Fuel',          25.54, '7-Eleven', '2026-04-16'),
  ('Transportation',       2.30, 'ParkMobile', '2026-04-17'),
  ('Transportation',       2.30, 'ParkMobile', '2026-04-17'),
  ('Dining Out',          18.86, 'Natural Cafe', '2026-04-17'),
  ('Transportation',      10.35, 'Parking.com', '2026-04-18'),
  ('Dining Out',           3.85, 'Java Works Cafe', '2026-04-17'),
  ('Dining Out',         167.09, 'Jose Tequila Mexican Grill', '2026-04-18'),
  ('Gas & Fuel',           2.92, 'Sheetz', '2026-04-18'),
  ('Gas & Fuel',          63.40, 'Sheetz', '2026-04-18'),
  ('Personal Care',        5.93, 'CVS Pharmacy', '2026-04-18'),
  ('Groceries',            2.21, 'Trader Joe''s', '2026-04-19'),
  ('Groceries',           27.60, 'Wegmans', '2026-04-19'),
  ('Subscriptions',       13.99, 'Apple.com/bill', '2026-04-19'),
  ('Subscriptions',        2.99, 'Apple.com/bill', '2026-04-19'),
  ('Dining Out',          15.79, 'Chipotle', '2026-04-20'),
  ('Auto (service/misc)', 57.51, 'Priority Lexus (service)', '2026-04-21'),
  ('Transportation',      35.00, 'EZPass Auto Replenish', '2026-04-22'),
  ('Gas & Fuel',           2.34, 'Royal Farms', '2026-04-22'),
  ('Groceries',            5.75, 'Food Lion', '2026-04-23'),
  ('Dining Out',          15.29, 'Philly Cold Cuts', '2026-04-22'),
  ('Dining Out',          40.80, 'Virginia Legends Walk', '2026-04-25'),
  ('Dining Out',          11.70, 'Chipotle', '2026-04-23'),
  ('Dining Out',          19.20, 'Virginia Legends Walk', '2026-04-25'),
  ('Dining Out',          49.06, 'Smartmouth Brewing Co', '2026-04-24'),
  ('Auto (service/misc)', 12.00, 'Grand Slam Car Wash', '2026-04-25'),
  ('Dining Out',           2.90, 'Chick-fil-A', '2026-04-25'),
  ('Gas & Fuel',           4.53, 'Citgo', '2026-04-24'),
  ('Shopping',             5.29, 'AutoZone', '2026-04-25'),
  ('Shopping',            44.50, 'Old Navy', '2026-04-25'),
  ('Gas & Fuel',          59.25, '7-Eleven', '2026-04-26'),
  ('Dining Out',          73.79, 'TST* Lucky Oyster', '2026-04-26'),
  ('Groceries',           16.61, 'Trader Joe''s', '2026-04-26'),
  ('Subscriptions',        8.00, 'OpenAI ChatGPT', '2026-04-26'),
  ('Personal Care',       25.00, 'Town Center Barber Shop', '2026-04-27'),
  ('Golf',                 6.00, 'Virginia Beach National', '2026-04-29'),
  ('Groceries',            4.48, 'Sam''s Club', '2026-04-30'),
  ('Groceries',          161.10, 'Sam''s Club', '2026-04-30'),
  ('Dining Out',          11.70, 'Chipotle', '2026-04-29'),
  ('Dining Out',          10.23, 'Chick-fil-A', '2026-04-30')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-04-16' and pp.end_date = '2026-04-30';

-- ============================================================
-- PAY PERIOD: May 1 - May 15, 2026
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Groceries',           11.12, 'Wegmans', '2026-04-30'),
  ('Dining Out',          37.45, 'The Lucky Penny', '2026-05-01'),
  ('Gas & Fuel',           6.08, 'Royal Farms', '2026-05-01'),
  ('Transportation',      12.93, 'Uber', '2026-05-02'),
  ('Gas & Fuel',          37.11, '7-Eleven', '2026-05-02'),
  ('Dining Out',          12.04, 'Sandbridge Seaside Market', '2026-05-02'),
  ('Golf',                 9.00, 'Virginia Beach National', '2026-05-03'),
  ('Entertainment',       26.40, 'Freedom Outdoors', '2026-05-03'),
  ('Gas & Fuel',           6.56, '7-Eleven', '2026-05-02'),
  ('Dining Out',          40.13, 'Las Palmas', '2026-05-02'),
  ('Groceries',           19.75, 'Trader Joe''s', '2026-05-04'),
  ('Groceries',            2.75, 'Publix', '2026-05-04'),
  ('Entertainment',       32.12, 'Freedom Outdoors', '2026-05-05'),
  ('Dining Out',           5.59, 'Dairy Queen', '2026-05-05'),
  ('Dining Out',          11.26, 'Chipotle', '2026-05-05'),
  ('Golf',                 9.00, 'Virginia Beach National', '2026-05-06'),
  ('Dining Out',          11.70, 'Chipotle', '2026-05-06'),
  ('Groceries',            3.34, 'Sam''s Club', '2026-05-07'),
  ('Groceries',           31.76, 'Sam''s Club', '2026-05-07'),
  ('Gas & Fuel',          72.37, '7-Eleven', '2026-05-08'),
  ('Gas & Fuel',           3.73, '7-Eleven', '2026-05-08'),
  ('Gas & Fuel',           9.88, '7-Eleven', '2026-05-08'),
  ('Golf',                13.99, 'Glf*BlueMash eCommerce', '2026-05-09'),
  ('Golf',                 6.99, 'Glf*BlueMash', '2026-05-09'),
  ('Dining Out',          10.66, 'Taco Bell', '2026-05-08'),
  ('Gas & Fuel',          13.55, '7-Eleven', '2026-05-09'),
  ('Transportation',      35.00, 'EZPass Auto Replenish', '2026-05-11'),
  ('Gas & Fuel',           8.27, '7-Eleven', '2026-05-11'),
  ('Groceries',            2.49, 'Safeway', '2026-05-11'),
  ('Golf',                54.30, 'Glf*BlueMash eCommerce', '2026-05-13'),
  ('Subscriptions',        2.99, 'Apple.com/bill', '2026-05-14'),
  ('Golf',                88.08, 'Rattlewood Golf Course', '2026-05-15'),
  ('Entertainment',       31.02, 'Shady Grove Rd', '2026-05-14')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-05-01' and pp.end_date = '2026-05-15';

-- ============================================================
-- PAY PERIOD: May 16 - May 31, 2026
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Dining Out',          18.82, 'Taco Bell', '2026-05-15'),
  ('Subscriptions',       13.99, 'Apple.com/bill', '2026-05-16'),
  ('Golf',                 7.08, 'Rattlewood Golf Course', '2026-05-15'),
  ('Entertainment',       80.87, 'Redland Liberty', '2026-05-16'),
  ('Subscriptions',       12.99, 'Spotify', '2026-05-17'),
  ('Dining Out',          46.26, 'Wawa', '2026-05-17'),
  ('Transportation',      35.00, 'EZPass Auto Replenish', '2026-05-17'),
  ('Gas & Fuel',          70.97, '7-Eleven', '2026-05-21'),
  ('Dining Out',           7.67, 'TST* Sandbridge Island', '2026-05-22'),
  ('Gas & Fuel',          72.29, 'Wawa', '2026-05-22'),
  ('Dining Out',          27.96, 'Baja Restaurant', '2026-05-23'),
  ('Groceries',           10.37, 'Trader Joe''s', '2026-05-23'),
  ('Groceries',           25.00, 'Sam''s Club', '2026-05-25'),
  ('Groceries',           31.77, 'Wal-Mart Supercenter', '2026-05-25'),
  ('Groceries',           16.32, 'Trader Joe''s', '2026-05-25'),
  ('Groceries',            6.74, 'Wegmans', '2026-05-25'),
  ('Dining Out',          35.02, 'TST* Taste - Town Center', '2026-05-25'),
  ('Auto (service/misc)', 27.54, 'Taylor''s Hardware', '2026-05-26'),
  ('Dining Out',          29.71, 'Pungo Sports Bar Grill', '2026-05-28'),
  ('Shopping',            73.14, 'Apple Store', '2026-05-27'),
  ('Dining Out',          27.13, 'Chick-fil-A', '2026-05-29'),
  ('Gas & Fuel',           6.56, '7-Eleven', '2026-05-28'),
  ('Dining Out',          19.30, 'Kelly''s Tavern', '2026-05-28'),
  ('Transportation',      17.94, 'Uber', '2026-05-30'),
  ('Transportation',      26.98, 'Uber', '2026-05-30'),
  ('Dining Out',          16.56, 'Del Taco', '2026-05-29'),
  ('Auto (service/misc)', 26.50, 'Taylor''s Hardware', '2026-05-30'),
  ('Gas & Fuel',          75.08, 'Wawa', '2026-05-30'),
  ('Shopping',            14.31, 'Target', '2026-05-31'),
  ('Dining Out',          39.60, 'TST* Aslin - VA Beach', '2026-05-31'),
  ('Entertainment',       24.01, 'First Landing State Park', '2026-05-30')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-05-16' and pp.end_date = '2026-05-31';

-- ============================================================
-- PAY PERIOD: Jun 1 - Jun 15, 2026
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Groceries',            9.80, 'Trader Joe''s', '2026-05-31'),
  ('Shopping',              5.03, 'Target', '2026-06-02'),
  ('Auto (service/misc)', 214.95, 'VIOC Oil Change', '2026-06-02'),
  ('Dining Out',          11.70, 'Chipotle', '2026-06-02'),
  ('Groceries',            8.04, 'Trader Joe''s', '2026-06-02'),
  ('Gas & Fuel',          15.05, 'ExxonMobil', '2026-06-03'),
  ('Dining Out',          30.62, 'Starz Restaurant & Lounge', '2026-06-04'),
  ('Dining Out',          13.83, 'Chipotle', '2026-06-04'),
  ('Groceries',            5.66, 'Food Lion', '2026-06-06'),
  ('Dining Out',          29.06, 'Starz Restaurant & Lounge', '2026-06-05'),
  ('Groceries',           29.02, 'Trader Joe''s', '2026-06-05'),
  ('Dining Out',         106.76, 'Pungo Sports Bar Grill', '2026-06-06'),
  ('Groceries',          126.54, 'Sam''s Club', '2026-06-07'),
  ('Groceries',            0.99, 'Sam''s Club', '2026-06-07'),
  ('Dining Out',          68.90, 'Kelly''s Tavern', '2026-06-07'),
  ('Golf',                13.00, 'Glf*Cypress Point CC', '2026-06-08'),
  ('Groceries',            7.15, 'Food Lion', '2026-06-08'),
  ('Dining Out',          95.47, 'Mi Casita Mexican Grill', '2026-06-09'),
  ('Groceries',            7.35, 'Trader Joe''s', '2026-06-08'),
  ('Golf',                29.34, 'Glf*Kempsville', '2026-06-10'),
  ('Golf',                65.36, '4UP*VA Beach National', '2026-06-10'),
  ('Gas & Fuel',          61.22, 'Citgo', '2026-06-09'),
  ('Gas & Fuel',          22.19, 'Shell Service Station', '2026-06-10'),
  ('Gas & Fuel',           9.61, 'Shell Service Station', '2026-06-10'),
  ('Dining Out',          11.23, 'Taco Bell', '2026-06-10'),
  ('Subscriptions',        2.99, 'Apple.com/bill', '2026-06-14'),
  ('Dining Out',          11.98, 'Starbucks', '2026-06-14'),
  ('Dining Out',          12.63, 'Taco Bell', '2026-06-14'),
  ('Gas & Fuel',          51.55, 'Shell Service Station', '2026-06-14')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-06-01' and pp.end_date = '2026-06-15';

-- ============================================================
-- PAY PERIOD: Jun 16 - Jul 7, 2026  (created already by schema.sql seed)
-- ============================================================
insert into expenses (pay_period_id, category_id, amount, description, expense_date)
select pp.id, c.id, v.amount, v.description, v.expense_date::date
from (values
  ('Dining Out',          46.10, 'Hot Tuna Bar & Grill', '2026-06-15'),
  ('Subscriptions',       12.99, 'Spotify', '2026-06-17'),
  ('Dining Out',          41.10, 'Starz Restaurant & Lounge', '2026-06-17'),
  ('Golf',                 9.00, 'Virginia Beach National', '2026-06-17'),
  ('Dining Out',          56.04, 'Chicks Oyster Bar', '2026-06-18'),
  ('Dining Out',          16.44, 'ORFDB Tin Cup & Bar', '2026-06-18'),
  ('Groceries',            8.16, 'Wegmans', '2026-06-18'),
  ('Entertainment',       99.08, 'The Mag Shack', '2026-06-19'),
  ('Groceries',           15.06, 'Food Lion', '2026-06-19'),
  ('Gas & Fuel',          29.30, 'Wawa', '2026-06-19'),
  ('Gas & Fuel',          67.86, 'Wawa', '2026-06-19'),
  ('Dining Out',          36.05, 'Chicho''s Pizza', '2026-06-19'),
  ('Personal Care',       25.00, 'Town Center Barber Shop', '2026-06-19'),
  ('Dining Out',          65.91, 'The Lucky Penny', '2026-06-19'),
  ('Transportation',      36.96, 'Uber', '2026-06-21'),
  ('Dining Out',          47.31, 'TST* Taste - Bayville Farms', '2026-06-20'),
  ('Transportation',      10.00, 'City of Norfolk', '2026-06-21'),
  ('Dining Out',          12.20, 'Chick-fil-A', '2026-06-23'),
  ('Dining Out',         112.70, 'El Rey', '2026-06-22'),
  ('Gas & Fuel',          27.22, 'Citgo', '2026-06-22'),
  ('Gas & Fuel',           9.48, 'Citgo', '2026-06-22'),
  ('Dining Out',          11.31, 'Chipotle', '2026-06-22'),
  ('Gas & Fuel',          44.62, 'Sheetz', '2026-06-23'),
  ('Dining Out',          15.71, 'TST* District Taco', '2026-06-24'),
  ('Dining Out',          28.00, 'Mexico Palace', '2026-06-23'),
  ('Groceries',           21.68, 'Trader Joe''s', '2026-06-24'),
  ('Dining Out',           7.77, 'McDonald''s', '2026-06-25'),
  ('Auto (service/misc)', 12.00, 'Grand Slam Car Wash', '2026-06-25'),
  ('Shopping',             7.41, 'Target', '2026-06-25')
) as v(category_name, amount, description, expense_date)
join categories c on c.name = v.category_name
join pay_periods pp on pp.start_date = '2026-06-16' and pp.end_date = '2026-07-07';

-- VERIFY (optional, run after the above):
-- select pp.start_date, pp.end_date, c.name as category, sum(e.amount) as total
-- from expenses e
-- join pay_periods pp on pp.id = e.pay_period_id
-- join categories c on c.id = e.category_id
-- group by pp.start_date, pp.end_date, c.name
-- order by pp.start_date, total desc;