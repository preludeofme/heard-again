# Contributing to Heard Again

Thank you for your interest in contributing to Heard Again! This document outlines guidelines for contributing code, documentation, and issues.

## Development Setup

To set up a local development environment, follow these steps:

### Prerequisites
* **Node.js**: `v18.0.0` or higher
* **npm**: `v9.0.0` or higher
* **Docker & Docker Compose**: Required for running PostgreSQL, Redis, Ollama, and ChromaDB.
* **Python 3.10+** (Optional): Only required if you want to run the local GPU/CPU voice synthesis (TTS) worker.

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/heard-again.git
   cd heard-again
   ```

2. **Install all workspace dependencies**:
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables**:
   * Copy the `.env.example` in the root (or service folders) to `.env`.
   * For local dev, you can usually start with the defaults.
   * See the [Setup Guide](docs/SETUP_GUIDE.md) for detailed configuration details.

4. **Spin up local infrastructure (Docker)**:
   ```bash
   # Starts Postgres, Redis, ChromaDB, Ollama, and ClamAV
   npm run docker:up
   ```

5. **Generate and seed the Database**:
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

6. **Start the development servers**:
   ```bash
   # Starts UI, Chat, and background workers simultaneously
   npm run dev
   ```

## Development Standards

### Branch Naming Conventions
Use descriptive names prefixed by change type:
* `feature/` for new features (e.g., `feature/gedcom-parser`)
* `bugfix/` for bug fixes (e.g., `bugfix/session-timeout`)
* `docs/` for documentation updates (e.g., `docs/trigger-dev`)
* `refactor/` for code refactoring (e.g., `refactor/api-routes`)

### Commit Messages
We follow **Conventional Commits**:
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation changes
* `style`: Styling changes (whitespace, formatting, semicolons, etc.)
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `test`: Adding missing tests or correcting existing tests
* `chore`: Build tasks, package updates, etc.

*Example*: `feat(ui): add memories lens grid view`

### Pull Request Process
1. Ensure all code compiles and passes tests (`npm run verify` at the root).
2. Avoid checking in local environment secrets, log files, or media assets.
3. Keep pull requests focused on a single change.
4. Update relevant documentation if you add or modify features.
