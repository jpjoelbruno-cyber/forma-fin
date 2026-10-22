"""Build explicit read-query integrations from canonical SQL; no production execution."""
from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'forma-education.sql';s=p.read_text();s=s.split('-- BEGIN GENERATED REPORTS')[0]
s+='-- BEGIN GENERATED REPORTS\n'
def functions(file,start,end):
 x=(root/file).read_text();return x[x.index(start):x.index(end,x.index(start))]
# Only replace receipt reads. Mutation functions remain canonical and audited.
x=functions('forma-finance-periods.sql','create or replace function forma_private.finance_period_data','create or replace function forma_private.finance_reports')
x=x.replace('forma_private.agenda_payments','forma_private.institution_receipts').replace('select p.*,b.client from','select p.*,coalesce(b.client,p.payer_name) client from').replace(' p join forma_private.agenda_bookings b on b.id=p.booking_id',' p left join forma_private.agenda_bookings b on b.id=p.booking_id')
x=x.replace("'by_activity',coalesce", "'by_stream',coalesce((select jsonb_agg(x order by cents desc) from (select case when p.enrolment_id is not null then 'Cursos / matrículas' when p.booking_id is not null then 'Servicios / agendamientos' else 'Ingresos por conciliar' end label,sum(p.amount_cents) cents from payments p group by 1)x),'[]'::jsonb),'by_activity',coalesce",1)
x=x.replace('method,activity,area,group_name,note,created_at from payments','method,activity,area,group_name,note,created_at,enrolment_id,person_id from payments');x=x.replace("'by_stream',coalesce", "'by_module',coalesce((select jsonb_agg(z order by cents desc) from (select area||' · '||coalesce(nullif(module,''),'Sin asignar a módulo') label,sum(amount_cents) cents from payments where enrolment_id is not null group by 1)z),'[]'::jsonb),'receivables_by_stream',jsonb_build_object('courses_cents',coalesce((select sum(total_cents-paid_cents) from forma_private.education_debts()),0),'services_cents',coalesce((select sum(greatest(0,c.total_cents-coalesce((select sum(p.amount_cents) from forma_private.agenda_payments p where p.booking_id=c.booking_id and p.voided_at is null),0)-coalesce((select sum(w.amount_cents) from forma_private.finance_waivers w where w.booking_id=c.booking_id),0))) from forma_private.agenda_contracts c where c.total_cents is not null and not exists(select 1 from forma_private.education_bookings eb where eb.booking_id=c.booking_id and eb.finance_link)),0)),'by_stream',coalesce",1)
s+=x
x=functions('forma-finance-periods.sql','create or replace function forma_private.finance_reports','notify pgrst')
x=x.replace('c.preferred_method,\n','c.preferred_method,null::uuid enrolment_id,\n').replace('c on c.booking_id=b.id),\n  debts', 'c on c.booking_id=b.id where not exists(select 1 from forma_private.education_bookings eb where eb.booking_id=b.id and eb.finance_link) union all select id,client,phone,activity,area,group_name,cancelled,start_date,total_cents,payment_plan,due_on,preferred_method,enrolment_id,paid_cents,waived_cents from forma_private.education_debts()),\n  debts');s+=x
x=functions('forma-statement.sql','create or replace function forma_private.statement','notify pgrst')
x=x.replace('b.client label,','coalesce(b.client,p.payer_name) label,').replace('p.voided_at,p.void_reason\n','p.voided_at,p.void_reason,p.enrolment_id,p.person_id\n').replace('o.voided_at,o.void_reason\n','o.voided_at,o.void_reason,null::uuid,null::uuid\n').replace('forma_private.agenda_payments','forma_private.institution_receipts').replace('p join forma_private.agenda_bookings b','p left join forma_private.agenda_bookings b');s+=x
x=functions('forma-finance.sql','create or replace function forma_private.agenda_income','create or replace function public.forma_finance')
x=x.replace('ct forma_private.agenda_contracts;', 'ct forma_private.agenda_contracts;result jsonb;linked uuid;')
x=x.replace("if p_action in ('month','detail') then return forma_private.finance(p_action,p_data);end if;", "if p_action in ('month','detail') then result:=forma_private.finance(p_action,p_data);if p_action='detail' then select enrolment_id into linked from forma_private.education_bookings where booking_id=(p_data->>'booking_id')::uuid and finance_link;result:=result||jsonb_build_object('enrolment_id',linked);end if;return result;end if;")
x=x.replace("if p_action in ('payment','total') then", "if p_action in ('payment','total') then if exists(select 1 from forma_private.education_bookings where booking_id=bid and finance_link) then raise exception 'Los cobros de esta reserva se administran en Matrículas. El historial original se conserva.' using errcode='22023';end if;")
s+=x
x=functions('forma-cash.sql','create or replace function forma_private.cash_ledger','notify pgrst')
x=x.replace('forma_private.agenda_payments','forma_private.institution_receipts').replace('p.method,bk.client label','p.method,coalesce(bk.client,p.payer_name) label').replace('p join forma_private.agenda_bookings bk','p left join forma_private.agenda_bookings bk');s+=x
x=functions('forma-monthly.sql','create or replace function forma_private.monthly_type','notify pgrst')
x=x.replace('forma_private.agenda_payments','forma_private.institution_receipts').replace('select p.*,b.client from','select p.*,coalesce(b.client,p.payer_name) client from').replace('p join forma_private.agenda_bookings b','p left join forma_private.agenda_bookings b');x=x.replace('where c.total_cents is not null),',"where c.total_cents is not null and not exists(select 1 from forma_private.education_bookings eb where eb.booking_id=b.id and eb.finance_link) union all select null::uuid,client,'Cursos',area,due_on,total_cents-paid_cents from forma_private.education_debts()),")
x=x.replace('amount_cents\n from forma_private.agenda_bookings b join forma_private.agenda_contracts', 'amount_cents,null::uuid enrolment_id\n from forma_private.agenda_bookings b join forma_private.agenda_contracts')
x=x.replace("select null::uuid,client,'Cursos',area,due_on,total_cents-paid_cents from forma_private.education_debts()", "select null::uuid,client,'Cursos',area,due_on,total_cents-paid_cents,enrolment_id from forma_private.education_debts()")
x=x.replace('attendance,person_id from events', "attendance,person_id,'booking' target,booking_id target_id from events")
x=x.replace('false,null,null::uuid from payments', "false,null,person_id,case when booking_id is null then 'education' else 'booking' end,coalesce(booking_id,enrolment_id) from payments")
x=x.replace('false,null,null::uuid from debt', "false,null,null::uuid,case when booking_id is null then 'education' else 'booking' end,coalesce(booking_id,enrolment_id) from debt")
x=x.replace('false,null,null::uuid from refunds', "false,null,null::uuid,'booking',booking_id from refunds")
s+=x
s+="notify pgrst,'reload schema';\ncommit;\nselect to_regprocedure('public.forma_education(text,jsonb)') is not null as matriculas_activadas;\n"
p.write_text(s)
