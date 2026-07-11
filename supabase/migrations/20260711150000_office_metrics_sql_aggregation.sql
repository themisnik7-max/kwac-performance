-- lib/officeMetrics.ts fetched agents' ENTIRE weekly_submissions/
-- demand_profiles/showings history into JS on every call and reduced it
-- there, on every load of Monitor's "Παραγωγή" tab and Intelligence OP's
-- "Παραγωγή"/"GPS Γραφείου" tabs — no SQL-side aggregation, no cache, no
-- date window. Fine at today's row counts; the first thing that visibly
-- degrades as history accumulates, and it multiplies with concurrent admin
-- page loads. These two RPCs push the actual SUM/COUNT down to Postgres —
-- the wire transfer becomes O(agent count) instead of O(every row ever
-- submitted), and the reduction becomes a single indexed GROUP BY instead
-- of an unbounded per-row JS loop.

create or replace function get_agent_activity_totals(p_agency_id uuid)
returns table (
  agent_id             uuid,
  calls                bigint,
  second_appointments  bigint,
  mandates             bigint,
  offers               bigint,
  deposits             bigint,
  closings             bigint,
  weeks_submitted      bigint,
  xp_total             bigint,
  demand               bigint,
  showings             bigint
)
language sql stable as $$
  select
    a.id,
    coalesce(sum(coalesce(ws.cold_calls, 0)), 0),
    coalesce(sum(coalesce(ws.meet2_seller, 0)), 0),
    coalesce(sum(coalesce(ws.excl_listing_sale, 0) + coalesce(ws.simple_listing_sale, 0)
                + coalesce(ws.excl_rental_high, 0) + coalesce(ws.excl_rental_low, 0) + coalesce(ws.simple_rental, 0)), 0),
    coalesce(sum(coalesce(ws.offer_buyer, 0) + coalesce(ws.offer_tenant, 0)), 0),
    coalesce(sum(coalesce(ws.deposit_office, 0) + coalesce(ws.deposit_client, 0)), 0),
    coalesce(sum(coalesce(ws.contract_seller, 0) + coalesce(ws.contract_buyer, 0)), 0),
    count(ws.id),
    coalesce(sum(coalesce(ws.xp_earned, 0)), 0),
    (select count(*) from demand_profiles dp where dp.agent_id = a.id and dp.agency_id = p_agency_id),
    (select count(*) from showings sh where sh.agent_id = a.id)
  from agents a
  left join weekly_submissions ws on ws.agent_id = a.id and ws.agency_id = p_agency_id
  where a.agency_id = p_agency_id and a.is_active = true
  group by a.id
$$;

create or replace function get_office_conversion_totals(p_agency_id uuid)
returns table (
  tot_calls bigint, tot_appt1 bigint, tot_appt2 bigint, tot_list bigint, tot_deals bigint, weeks_of_data bigint
)
language sql stable as $$
  select
    coalesce(sum(coalesce(cold_calls, 0) + coalesce(follow_up, 0)), 0),
    coalesce(sum(coalesce(meet1_seller_live, 0) + coalesce(meet1_seller_phone, 0)
                + coalesce(meet1_buyer_live, 0) + coalesce(meet1_buyer_phone, 0)
                + coalesce(meet1_tenant_live, 0) + coalesce(meet1_tenant_phone, 0)), 0),
    coalesce(sum(coalesce(meet2_seller, 0)), 0),
    coalesce(sum(coalesce(excl_listing_sale, 0) + coalesce(simple_listing_sale, 0)
                + coalesce(excl_rental_high, 0) + coalesce(excl_rental_low, 0) + coalesce(simple_rental, 0)), 0),
    coalesce(sum(coalesce(contract_seller, 0) + coalesce(contract_buyer, 0)), 0),
    count(*)
  from weekly_submissions
  where agency_id = p_agency_id
$$;

select 'get_agent_activity_totals + get_office_conversion_totals installed' as status;
