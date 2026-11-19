# Project Rules & Development Guidelines

Welcome to the **Integrated SSN** project repository. All developers, contributors, and AI assistants working on this codebase must adhere strictly to the rules, architectural patterns, and standards outlined in this document.

---

## 1. Core Principles

1. **Simplicity and Modularity (KISS & DRY):** Keep designs straightforward, modular, and easy to reason about. Avoid premature optimization and unnecessary abstractions.
2. **Defensive Programming & Fail-Safe Defaults:** Always validate inputs at system boundaries. Design components to fail fast and fail gracefully with actionable error details.
3. **Security by Design:** Security is never an afterthought. Treat all external inputs, third-party integrations, and network boundaries as untrusted.
4. **Data Privacy First:** Treat any sensitive data (especially Personally Identifiable Information / SSN / credentials) with strict compliance, masking, and encryption.

---

## 2. Security & Compliance Standards

### 2.1 Sensitive Data & PII (Personally Identifiable Information) Handling
- **Never Log Sensitive Data:** Social Security Numbers (SSN), tokens, passwords, API keys, and PII must **never** appear in plain text in logs, error traces, telemetry, or console outputs.
- **Masking & Tokenization:** When displaying or logging identifiers, apply strict masking (e.g., `***-**-1234`). Use secure tokens or hashes for internal indexing and lookups where possible.
- **Encryption Standards:**
  - Encrypt all sensitive data in transit using modern TLS (TLS 1.3 preferred, minimum TLS 1.2).
  - Encrypt sensitive data at rest using authenticated encryption (e.g., AES-256-GCM).
- **Compliance Awareness:** Maintain strict adherence to applicable privacy laws and regulations (e.g., HIPAA, GDPR, SOC 2, PCI-DSS, depending on system classification).

### 2.2 Credentials & Secret Management
- **Zero Secrets in Code:** Never commit passwords, API keys, private certificates, or `.env` credential files to Git.
- Use environment variables or dedicated secret management services (e.g., Google Secret Manager, HashiCorp Vault, AWS Secrets Manager).
- Maintain an updated `.env.example` file documenting required environment variables with dummy values.

### 2.3 Injection & Vulnerability Prevention
- **Database Access:** Always use parameterized queries or trusted ORM/query builder abstractions. Never concatenate user input into SQL or NoSQL queries.
- **Input Sanitization & Output Encoding:** Sanitize and validate every incoming payload against a strict schema. Encode output to prevent Cross-Site Scripting (XSS).

---

## 3. Architecture & Code Quality

### 3.1 Code Organization & Clean Architecture
- **Separation of Concerns:** Separate business logic (domain), presentation/API layer (controllers/routers), and data access/external services (repositories/adapters).
- **Single Responsibility Principle (SRP):** Each module, class, or function should do one thing well.
- **Explicit Interfaces:** Define typed models, interfaces, or contracts for all API boundaries and inter-service communications.

### 3.2 Error Handling & Logging
- **Standardized Error Structures:** Use structured error objects containing an error code, user-friendly message, and internal tracking ID.
- **Structured Logging:** Emit logs in structured JSON format with standard severity levels (`DEBUG`, `INFO`, `WARN`, `ERROR`).
- **No Swallowed Errors:** Never write empty `catch` blocks or ignore errors silently without logging or rethrowing.

### 3.3 Dependencies
- Keep dependencies minimal, audited, and strictly pinned.
- Avoid introducing heavy third-party packages for trivial tasks that can be accomplished with standard runtime libraries.
- Regularly audit dependencies for known CVEs (`npm audit`, `pip-audit`, `cargo audit`, etc.).

---

## 4. Git Workflow & Version Control

### 4.1 Branching Strategy
- **`main` / `master`:** Production-ready, stable code only. Direct commits are strictly prohibited.
- **`develop`:** Integration branch for ongoing features (if using Git Flow).
- **Feature/Fix Branches:** Name branches descriptively using standard prefixes:
  - `feat/feature-name`
  - `fix/bug-description`
  - `refactor/scope-description`
  - `docs/topic`
  - `chore/task-name`

### 4.2 Commit Message Convention (Conventional Commits)
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```text
<type>(<optional scope>): <short description in imperative mood>

[optional body explaining 'why' and context]

[optional footer(s), e.g., Closes #123]
```
Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `docs`: Documentation changes only
- `chore`: Changes to build process, tooling, or dependencies

### 4.3 Pull Request & Code Review Rules
- PRs must be focused and scoped to a single logical change.
- All automated checks, linters, and tests must pass prior to merge.
- Every PR requires review and approval from at least one peer.

---

## 5. Testing & Quality Assurance

- **Test Pyramid:**
  - **Unit Tests:** High coverage for core business rules, utility functions, and domain logic.
  - **Integration Tests:** Verify interactions between databases, services, and external APIs.
  - **End-to-End (E2E) Tests:** Validate critical user/system journeys.
- **Deterministic Tests:** Tests must not depend on external live networks or flaky environmental state. Mock external third-party services.
- **Coverage Goal:** Maintain a minimum test coverage standard (recommended >80% on business-critical logic).

---

## 6. AI Agent & Automation Operational Rules

When AI assistants (e.g., Antigravity, Copilot, automated bots) interact with or generate code for this repository, they must strictly follow these directives:

1. **Verify Before Editing:** Inspect existing patterns, conventions, and configuration files before adding or refactoring code.
2. **Do Not Break Working Code:** Ensure backwards compatibility unless breaking changes are explicitly requested.
3. **No Phantom Implementations:** Never leave placeholder `// TODO: implement later` comments or half-baked mock implementations in production paths unless explicitly instructed.
4. **Self-Verification:** Run linters, type checks, and relevant test suites to verify modifications before completing tasks.
5. **Concise Documentation:** Document new public APIs, configuration parameters, and architectural decisions cleanly.

---

*Last Updated: 2026-11-18*

