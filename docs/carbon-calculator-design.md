Carbon Calculator – System Design v1.0
Purpose

This system replaces a complex Excel-based CO₂ calculation spreadsheet with a centralised, auditable, and extensible digital system.

The goal is to:

Reproduce existing Excel calculations exactly

Reduce manual input and human error

Provide transparency, traceability, and commentary

Enable future automation (published plant data, distance lookups, etc.)

Scope (v1.0)

Included

Lifecycle modules A2–A5

Hot / Warm / Cold mixes

Plant-specific CO₂ factors

One-way transport distances

Scheme-level totals and per-tonne values

Operator review via a web portal

Excluded (future phases)

Automatic distance calculation

External APIs / plant system integration

Expo mobile app

Advanced reporting / exports

C/D lifecycle modules

Technology Stack
Backend

Supabase (Postgres)

Primary data store

Calculation engine via Postgres functions

Single source of truth

API

Supabase Edge Functions

Thin wrapper around Postgres calculations

Safe invocation from web / app clients

Frontend

Next.js (App Router) on Vercel

Internal review & operator portal

Read-only for most data in v1

Conceptual Model

The original spreadsheet combines:

Inputs

Reference data

Calculations

Outputs

This system separates those concerns cleanly.

Key Dimensions

Plant (e.g. Moorcroft, Sheffield)

Product

Mix type (Hot / Warm / Cold)

Lifecycle stage (A2–A5)

Transport mode

Scheme (job / project)

Data Model Overview
Reference Tables

plants

products

mix_types

transport_modes

lifecycle_stages

Carbon Factor Tables

plant_mix_carbon_factors

kgCO₂e / tonne

Versioned by date

installation_carbon_factors

Scheme Data

schemes

scheme_material_demands

scheme_transport_legs

Calculated Outputs

scheme_carbon_results

scheme_carbon_summaries

Commentary

scheme_notes

Lifecycle Logic (Excel Parity)
A2 – Raw Materials Transport

Applied only to products flagged as requiring it.

Formula

distance_km (one way)
× transport_kgCO2e_per_km
× tonnage

A3 – Manufacturing

Uses plant-specific mix factors.

Formula

tonnage
× plant_mix_kgCO2e_per_tonne

A4 – Transport to Site

Formula

distance_km (one way)
× transport_kgCO2e_per_km
× tonnage

A5 – Installation

Uses a scheme-selected installation factor.

Formula

tonnage
× installation_kgCO2e_per_tonne

Totals

Total kgCO₂e = sum of A2–A5

kgCO₂e / tonne = total ÷ total tonnage

Calculation Engine
Location

Implemented as a Postgres function:

calculate_scheme_carbon(p_scheme_id uuid)

Characteristics

Deletes and regenerates results on each run

Deterministic (same inputs = same outputs)

Auditable (all intermediate stages stored)

Returns a boolean to satisfy Supabase RPC requirements

Helper Functions

get_active_plant_mix_factor

Retrieves the correct factor based on plant, mix, and date

API Layer (Edge Function)
Function

calculate-scheme-carbon

Responsibilities

Accept scheme_id

Call Postgres calculation function

Return success / error

Future home for auth & validation

No calculation logic exists in the Edge Function.

Portal (Next.js) – v1 Design
Primary Users

Carbon / technical reviewers

System operators

Key Screens
Schemes List

Scheme name

Plant

Total kgCO₂e

kgCO₂e / tonne

View action

Scheme Detail (Core Screen)

Scheme header

Lifecycle breakdown (A2–A5)

Totals

Recalculate button

Notes / comments

Read-only input snapshot

Commentary & Notes

Each scheme supports timestamped notes to capture:

Assumptions

Clarifications

Data caveats

Review comments

This replaces informal email chains and spreadsheet annotations.

Design Principles

Excel parity first

Clarity over cleverness

Server-side calculations only

Separation of concerns

Auditability built-in

Future Roadmap (High-Level)
Phase 2

Expo mobile app

Role-based access (RLS)

Editable schemes

Real plant data publication

Phase 3

Automated distance calculation

External system integration

Reporting & exports

Additional lifecycle modules

Status

✔ Calculation engine validated
✔ Portal foundations implemented
✔ Ready for controlled rollout and real data validation

If you want, next I can:

Split this into multiple docs (architecture.md, calculations.md, etc.)

Add ER diagrams

Add a developer onboarding section

Add Excel-to-system traceability tables