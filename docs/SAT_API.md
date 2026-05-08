# Catalyst SAT — API Reference

## Collections

| Collection | Purpose |
|---|---|
| `satquestionbanks` | All SAT questions (math + R&W), tagged with subject/topic/domain/difficulty matching the official SAT taxonomy |
| `satexamconfigs` | Adaptive test configs — `type: 'mock'` (27–27Q) or `type: 'diagnostic'` (11–11 / 9–9Q) |
| `satpracticetestconfigs` | Practice test configs — subject → topic → domain, 10 questions flat, no modules |
| `sattestsessions` | Per-subject session for mock/diagnostic (stores M1 + M2 answers, scores) |
| `satpracticesessions` | Practice test attempts (flat, no modules) |
| `satassignments` | Mentor → student assignment records (`test_type: subject \| practice`) |
| `satstudentquestionhistories` | Tracks which question IDs a student has seen (avoids repeats) |
| `satbulkimportlogs` | Audit log for bulk question uploads |

### SAT Question Bank Taxonomy

Questions must be tagged with exact `topic` and `domain` values from the official taxonomy:

**Math**
| Topic | Domains |
|---|---|
| Advanced Math | Equivalent expressions · Nonlinear equations in one variable and systems of equations in two variables · Nonlinear functions |
| Algebra | Linear equations in one variable · Linear equations in two variables · Linear functions · Linear inequalities in one or two variables · Systems of two linear equations in two variables |
| Geometry and Trigonometry | Area and volume · Circles · Lines, angles, and triangles · Right triangles and trigonometry |
| Problem-Solving and Data Analysis | Evaluating statistical claims: Observational studies and experiments · Inference from sample statistics and margin of error · One-variable data: Distributions and measures of center and spread · Percentages · Probability and conditional probability · Ratios, rates, proportional relationships, and units · Two-variable data: Models and scatterplots |

**Reading & Writing**
| Topic | Domains |
|---|---|
| Craft and Structure | Cross-Text Connections · Text Structure and Purpose · Words in Context |
| Expression of Ideas | Rhetorical Synthesis · Transitions |
| Information and Ideas | Central Ideas and Details · Command of Evidence · Inferences |
| Standard English Conventions | Boundaries · Form, Structure, and Sense |

---

## Auth

All routes require a JWT bearer token (`Authorization: Bearer <token>`).

| Role | Access |
|---|---|
| `operations` | Admin routes (question bank, exam configs, practice configs) |
| `mentor` | Mentor routes (assign tests, view results) |
| `student` | Test routes (start, submit, results, practice) |
| `guest` | Practice routes only (limited to `is_demo_accessible: true` configs) |

---

## Ops — Question Bank (`/api/sat/admin`)

| Method | Endpoint | Body / Params | What it does | Reads/Writes |
|---|---|---|---|---|
| POST | `/question-bank/bulk-upload` | multipart file (CSV/XLSX) | Bulk import questions. Skips duplicates. | Writes `satquestionbanks`, writes `satbulkimportlogs` |
| GET | `/question-bank` | `?subject&difficulty&domain&topic&page&limit` | Paginated question list | Reads `satquestionbanks` |
| GET | `/question-bank/stats` | — | Count by subject × difficulty | Reads `satquestionbanks` |
| PUT | `/question-bank/:id` | question fields | Update a question | Writes `satquestionbanks` |
| DELETE | `/question-bank/:id` | — | Soft-delete (sets `is_active: false`) | Writes `satquestionbanks` |

---

## Ops — Mock & Diagnostic Configs (`/api/sat/admin/exam-configs`)

Stored in `satexamconfigs`. Each config covers **one subject** (math or reading_writing) with 2 adaptive modules.
- `type: 'mock'` — standard mock: Math 22–22Q, R&W 27–27Q per module
- `type: 'diagnostic'` — shorter: Math 9–9Q, R&W 11–11Q per module (same schema, ops enters the smaller counts)

| Method | Endpoint | Body | What it does |
|---|---|---|---|
| POST | `/exam-configs` | `name, subject, type (mock\|diagnostic), module_1, module_2_hard, module_2_medium, module_2_easy, adaptive_threshold, score_bands` | Create mock or diagnostic config |
| GET | `/exam-configs` | `?subject&active` | List all configs |
| GET | `/exam-configs/:id` | — | Get one config |
| PUT | `/exam-configs/:id` | same as POST body | Update config |

---

## Ops — Practice Configs (`/api/sat/admin/practice-configs`)

Stored in `satpracticetestconfigs`. No modules. Subject → Topic → Domain based on official SAT taxonomy.
Questions are pulled from `satquestionbanks` filtered by `{ subject, topic, domain }`.

| Method | Endpoint | Body | What it does |
|---|---|---|---|
| POST | `/practice-configs` | `name, subject, topic, domain, total_questions (default 10), time_limit_minutes (default 15), difficulty_distribution {easy,medium,hard}, is_demo_accessible (default false)` | Create practice test config |
| GET | `/practice-configs` | `?subject&topic&domain&active` | List all practice configs |
| PUT | `/practice-configs/:id` | same as POST | Update config |

**Access control:** `is_demo_accessible: true` → visible to guest/demo users. First 5 seeded configs have this flag. All others require a paid account.

---

## Mentor — Tests & Assignments (`/api/sat/mentor`)

| Method | Endpoint | Body / Params | What it does | Reads/Writes |
|---|---|---|---|---|
| GET | `/exam-configs` | — | List all active tests (subject mock/diagnostic + practice) | Reads `satexamconfigs`, `satpracticetestconfigs` |
| POST | `/assign` | `student_id, test_type (subject\|practice), exam_config_id OR practice_config_id, due_date?` | Assign a test to one student | Writes `satassignments` |
| POST | `/assign/batch` | `student_ids[], test_type, ...config_id, due_date?` | Assign same test to multiple students | Writes `satassignments` |
| GET | `/assignments` | `?status&student_id` | List mentor's assignments (populated) | Reads `satassignments` |
| GET | `/assignments/:id/results` | — | Full results for a completed assignment | Reads session collection based on test_type |

**Results response by test_type:**
- `subject` → reads `sattestsessions` → returns module_1 + module_2 breakdown (applies to both mock and diagnostic)
- `practice` → reads `satpracticesessions` → returns flat breakdown

---

## Student — Mock / Diagnostic Tests (`/api/sat/test`)

Requires `student` role (not guest).

| Method | Endpoint | Body | What it does | Reads/Writes |
|---|---|---|---|---|
| GET | `/assignments` | — | Student's own pending/active assignments | Reads `satassignments` |
| POST | `/start` | `assignment_id` | Start or resume a session. Auto-prefetches all M2 tiers. | Reads `satassignments`, `satexamconfigs`, `satquestionbanks`, `satstudentquestionhistories`; Writes `sattestsessions`, `satfulllengthsessions`, updates `satassignments` |
| POST | `/:sessionId/module/1/submit` | `answers [{question_id, selected}]` | Grade M1, determine adaptive tier, stage M2 | Writes `sattestsessions`, `satstudentquestionhistories` |
| GET | `/:sessionId/module/2` | — | Get M2 questions (starts M2 timer) | Reads `sattestsessions`, `satquestionbanks`; Writes `sattestsessions` |
| POST | `/:sessionId/module/2/submit` | `answers [{question_id, selected}]` | Grade M2, finalize scores, mark assignment complete | Writes `sattestsessions`, `satfulllengthsessions`, `satassignments`, `satstudentquestionhistories` |
| GET | `/:sessionId/results` | — | Full results with per-question breakdown + topic summary | Reads `sattestsessions`, `satquestionbanks` |

**Adaptive logic:**
- M1 score ≥ `adaptive_threshold` (default 60%) → Hard tier M2
- M1 score ≥ `adaptive_threshold_medium` (default 40%) → Medium tier M2
- Below → Easy tier M2

---

## Student — Practice Tests (`/api/sat/test/practice`)

Accessible to both `student` and `guest` roles.
Guest users only see configs where `is_demo_accessible: true`.

| Method | Endpoint | Body | What it does | Reads/Writes |
|---|---|---|---|---|
| GET | `/practice` | — | List available practice configs (filtered by user role) | Reads `satpracticetestconfigs` |
| GET | `/practice/history` | — | Student's past practice sessions | Reads `satpracticesessions` |
| POST | `/practice/start` | `config_id, assignment_id? (optional)` | Start a practice session (or resume existing in-progress). Fetches 10 questions from question bank filtered by topic+domain, avoids questions already seen in completed sessions. | Reads `satpracticetestconfigs`, `satpracticesessions`, `satquestionbanks`; Writes `satpracticesessions` |
| POST | `/practice/:sessionId/submit` | `answers [{question_id, selected}]` | Grade answers, mark session complete, update assignment if applicable | Writes `satpracticesessions`, `satassignments` |
| GET | `/practice/:sessionId/results` | — | Full results with breakdown, explanation, topic summary | Reads `satpracticesessions`, `satquestionbanks` |

---

## Access Control — Demo vs Paid

| What | Demo / Guest | Paid / Student |
|---|---|---|
| Mock tests | ✗ (assigned only via mentor) | ✓ |
| Diagnostic tests | ✗ | ✓ |
| Practice tests | Only `is_demo_accessible: true` configs (first 5 seeded) | All active configs |
| Session history | Always visible (own sessions only) | Always visible |

When a guest converts to paid: their existing practice sessions remain in their history. The test listing just returns more configs after upgrade.

---

## Session Lifecycle

```
Mock / Diagnostic (test_type = subject):
  Assignment (pending)
    → POST /test/start                 → SatTestSession (m1_in_progress)
    → POST /:id/module/1/submit        → SatTestSession (m1_complete), adaptive tier set
    → GET  /:id/module/2               → SatTestSession (m2_in_progress)
    → POST /:id/module/2/submit        → SatTestSession (complete), Assignment (completed)

Practice (test_type = practice):
  (self-serve OR assigned by mentor)
    → POST /practice/start             → SatPracticeSession (in_progress)
    → POST /practice/:id/submit        → SatPracticeSession (complete), Assignment (completed if applicable)
```

---

## Seeding

Run these scripts from the `src/` directory:

```bash
node src/seedSat.js      # Seeds users, sample questions, and mock test configs
node src/seedPractice.js # Seeds 35 practice test configs (first 5 demo-accessible)
```

`seedPractice.js` is idempotent — skips if any practice configs exist.
