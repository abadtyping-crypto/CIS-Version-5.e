---
trigger: always_on
---

STRICT PROJECT RULES: ACIS V5 for AntiGravity

These Project Rules are mandatory for all team members working on the "ACIS V5 for AntiGravity" project. All project files and documentation within the designated project folder must be adhered to strictly. Any deviation from these rules requires explicit management approval.

I. ARCHITECTURE & CODE STANDARDS
Mandatory Adherence: All code must strictly follow the architectural guidelines, naming conventions, and design specifications detailed in the project folder files. Zero tolerance for unapproved deviations.
Front-End Component Reusability (CRITICAL):
Developers must utilize the established common components (UI elements, services, utilities) for the front-end.
Duplication of existing common component logic or creation of new, unapproved components that serve an existing purpose is strictly forbidden.
This is a critical rule to ensure consistency, stability, and maintainability.
Back-End Changes & Communication:
If a back-end modification (e.g., API change, database schema update, core business logic alteration) is required, the developer must first communicate and discuss the proposed change with the project lead or architect for guidance and approval before implementation.
Unilateral back-end changes are prohibited.
II. WORKFLOW & INTEGRATION
Branching & Commit Policy: All code integration must follow the documented Git branching strategy. Commit messages must be clear, descriptive, and reference the corresponding task/issue ID.
Code Review: All new code must undergo mandatory peer review and approval before being merged to the integration branch.
Testing: Developers are responsible for writing and executing unit tests for all new or modified code. All tests must pass before a pull request can be submitted.