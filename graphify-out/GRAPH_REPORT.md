# Graph Report - kurukshetra hackathon  (2026-10-16)

## Corpus Check
- Corpus is ~7,989 words - fits in a single context window. You may not need a graph.

## Summary
- 118 nodes · 115 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend Setup
- TypeScript Configuration
- Role Dashboards
- Development Dependencies
- Build Scripts
- Frontend Runtime
- Service Architecture
- Approvals and Messaging
- FastAPI Starter
- Security and Access
- Trustworthy Copilot
- Product Concept
- Timetable Optimization

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 9 edges
3. `next` - 8 edges
4. `OpsCopilot project` - 4 edges
5. `dotenv` - 3 edges
6. `Action proposal and human approval workflow` - 3 edges
7. `Role-based access control` - 3 edges
8. `health_check()` - 2 edges
9. `@prisma/adapter-pg` - 2 edges
10. `@prisma/client` - 2 edges

## Surprising Connections (you probably didn't know these)
- `FastAPI dependency` --semantically_similar_to--> `FastAPI service`  [INFERRED] [semantically similar]
  ai-backend/requirements.txt → README.md
- `localhostdb PostgreSQL service` --shares_data_with--> `Prisma schema and migrations`  [INFERRED]
  compose.yaml → README.md
- `Local PostgreSQL Compose service` --references--> `localhostdb PostgreSQL service`  [EXTRACTED]
  README.md → compose.yaml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trustworthy copilot read and action flow** — ps1_institute_operations_copilot_prd_policy_engine, ps1_institute_operations_copilot_prd_read_only_query_gateway, ps1_institute_operations_copilot_prd_action_proposal_approval, ps1_institute_operations_copilot_prd_audit_trail [EXTRACTED 1.00]

## Communities (13 total, 3 thin omitted)

### Community 0 - "Frontend Setup"
Cohesion: 0.09
Nodes (22): eslintConfig, name, private, version, adapter, globalForPrisma, prisma, dotenv (+14 more)

### Community 1 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "Role Dashboards"
Cohesion: 0.11
Nodes (4): metadata, roles, nextConfig, next

### Community 3 - "Development Dependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node, @types/pg, @types/react (+2 more)

### Community 4 - "Build Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:deploy, db:generate, db:migrate, db:studio, dev, lint (+1 more)

### Community 5 - "Frontend Runtime"
Cohesion: 0.25
Nodes (8): dependencies, dotenv, next, pg, @prisma/adapter-pg, @prisma/client, react, react-dom

### Community 6 - "Service Architecture"
Cohesion: 0.33
Nodes (7): FastAPI dependency, localhostdb PostgreSQL service, FastAPI service, Local PostgreSQL Compose service, Next.js frontend, OpsCopilot project, Prisma schema and migrations

### Community 7 - "Approvals and Messaging"
Cohesion: 0.40
Nodes (5): Action proposal and human approval workflow, Append-only audit trail, Idempotent action executor, Phase 3: approvals and messaging, WhatsApp messaging adapter

### Community 9 - "Security and Access"
Cohesion: 0.50
Nodes (4): OWASP authorization guidance, PostgreSQL row-level security, PostgreSQL row-security model, Role-based access control

### Community 10 - "Trustworthy Copilot"
Cohesion: 0.67
Nodes (4): Phase 2: trustworthy copilot, Policy engine, Read-only query gateway, Typed query plan

## Knowledge Gaps
- **20 isolated node(s):** `pg`, `react`, `react-dom`, `@types/node`, `@types/pg` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 81 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Role Dashboards` to `Frontend Setup`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **What connects `pg`, `react`, `react-dom` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.08923076923076922 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `Development Dependencies` to `Frontend Setup`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `Build Scripts` to `Frontend Setup`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Role Dashboards` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._