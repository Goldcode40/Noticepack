-- NoticePack seed: document library + states + coverage matrix (v1)

-- 1) Document types (core launch scope)
insert into public.document_types (slug, name, description) values
('pay_rent_or_quit', 'Pay Rent or Quit', 'Demand for rent payment or possession.'),
('late_rent_reminder', 'Late Rent Reminder', 'Friendly reminder that rent is late.'),
('notice_to_enter', 'Notice to Enter', 'Notice of entry for inspection/repairs.'),
('lease_violation_cure_or_quit', 'Lease Violation / Cure or Quit', 'Cure a lease breach or vacate.'),
('notice_of_non_renewal', 'Notice of Non-Renewal', 'Notice that lease will not be renewed.'),
('termination_notice_to_vacate', 'Termination / Notice to Vacate', 'Terminate tenancy / notice to vacate.'),
('security_deposit_return_letter', 'Security Deposit Return Letter', 'Return of deposit with amounts.'),
('itemized_deductions_statement', 'Itemized Deductions Statement', 'Itemized list of deposit deductions.'),
('rent_increase_notice', 'Rent Increase Notice', 'Notice of rent increase.')
on conflict (slug) do nothing;

-- 2) States (all 50 + DC)
insert into public.states (code, name) values
('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),
('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),
('DC','District of Columbia'),
('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),
('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),('KS','Kansas'),
('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),
('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),
('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),
('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),('OK','Oklahoma'),
('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),
('VT','Vermont'),('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),
('WI','Wisconsin'),('WY','Wyoming')
on conflict (code) do nothing;

-- 3) Coverage matrix
-- v1 rule: mark all docs as GUIDED for all states (we'll upgrade hot states/docs to IMPLEMENTED later)
insert into public.coverage_matrix (state_code, document_type_id, status, notes)
select s.code as state_code, dt.id as document_type_id, 'guided'::text as status,
       'US-wide guided template (v1)'::text as notes
from public.states s
cross join public.document_types dt
on conflict (state_code, document_type_id) do nothing;
