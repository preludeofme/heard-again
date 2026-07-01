# Open Source Readiness Guide: Heard Again

This document outlines the requirements and action items needed to transition **Heard Again** into a production-ready open-source project.

## 1. Project Health & Infrastructure

### ⚙️ Environment Configuration
- [ ] **Audit `.env.example`**: Ensure every service has a comprehensive `.env.example` file with no real secrets but clear descriptions of every required variable.
- [ ] **Secret Hardening**: Ensure no fallback secrets are hardcoded in the codebase (e.g., `process.env.SECRET || 'dev-secret'`). All secrets must be mandatory in production builds.
- [ ] **Modular AI Backends**: Ensure the application can run with different AI backends.
    - [ ] Local-only mode (Ollama + local TTS).
    - [ ] Cloud-augmented mode (OpenAI + Azure/Google TTS).
    - [ ] Documentation on how to swap these.

### 📦 Dependency Management
- [ ] **License Audit**: Verify all NPM and Python dependencies have open-source compatible licenses (MIT, Apache 2.0, BSD).
- [ ] **Lockfile Integrity**: Ensure `package-lock.json` and `requirements.txt` are up to date and consistent.
- [ ] **Containerization**: 
    - [ ] Optimize Dockerfiles for production (multi-stage builds, non-root users).
    - [ ] Ensure `docker-compose.yml` is production-ready (resource limits, logging drivers).

### 🤖 CI/CD Pipeline
- [ ] **GitHub Actions**: Implement a robust CI pipeline for:
    - [ ] Linting (ESLint, Ruff).
    - [ ] Type checking (TSC).
    - [ ] Automated Tests (Jest, Pytest, Playwright).
    - [ ] Security scanning (SonarQube/Snyk).

## 2. Security & Compliance

### 🔒 Security Baseline
- [ ] **Security Policy**: Add `SECURITY.md` explaining how to report vulnerabilities.
- [ ] **Data Privacy**: Ensure GDPR/CCPA compliance features (Data export, account deletion, privacy policy links).
- [ ] **Encryption**: Verify that sensitive user data (MFA secrets, etc.) are encrypted at rest using industry standards.

### 👤 Identity & Auth
- [ ] **Provider Documentation**: Provide clear guides on setting up Google, Apple, and other OAuth providers for self-hosters.
- [ ] **MFA**: Ensure MFA is robust and can be disabled via CLI if a user loses access.

## 3. Community & Documentation

### 📖 Documentation
- [ ] **README.md**: Enhance with architectural diagrams and clear "Why Heard Again?" value proposition.
- [ ] **Getting Started**: A foolproof 5-minute setup guide for developers.
- [ ] **Deployment Guide**: Comprehensive guide for:
    - [ ] Bare metal / VPS setup.
    - [ ] Docker Compose (Self-hosted).
    - [ ] Cloud (AWS/Azure).
- [ ] **API Documentation**: OpenAPI/Swagger specs for TTS and Chat services.

### 🤝 Contribution Guidelines
- [ ] **CONTRIBUTING.md**: Detail the development workflow, branch naming, and PR requirements.
- [ ] **CODE_OF_CONDUCT.md**: Establish community standards.
- [ ] **Issue Templates**: Bug reports, feature requests, and AI model feedback templates.

## 4. Branding & Assets
- [ ] **Logo & Assets**: Ensure all logos and icons are either original, licensed, or open-source (e.g., Lucide/MUI Icons).
- [ ] **Branding**: Genericize any hardcoded company names or specific URLs that shouldn't be in the public repo.

## 🚀 Immediate Action Items
1. **Audit `.env` usages** in UI, Chat, and TTS services.
2. **Setup a clean GitHub repository** with initial project structure.
3. **Verify the "Self-hosting" pricing/account logic** is fully functional without external payment dependencies.
4. **Create a "Local-First" toggle** to disable cloud-dependent features easily for pure self-hosters.
