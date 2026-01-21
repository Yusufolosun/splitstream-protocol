# Contributing to SplitStream Protocol

Thank you for your interest in contributing to SplitStream! We welcome contributions from developers of all experience levels. This document provides guidelines to help you contribute effectively.

## 🎉 Welcome

We're excited to have you here! Whether you're fixing a bug, adding a feature, improving documentation, or suggesting ideas, your contribution is valuable. This project aims to provide a secure, efficient, and easy-to-use payment splitting solution on Base.

## 📋 Table of Contents

- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Conventions](#commit-message-conventions)
- [Code of Conduct](#code-of-conduct)

## 🐛 Reporting Bugs

If you find a bug, please create an issue with the following information:

### Bug Report Template

```markdown
**Description**
A clear and concise description of the bug.

**To Reproduce**
Steps to reproduce the behavior:
1. Deploy contract with '...'
2. Call function '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Environment**
- Network: [e.g., Base Mainnet, Hardhat Local]
- Hardhat Version: [e.g., 2.28.3]
- Node Version: [e.g., 18.17.0]

**Additional Context**
Any other relevant information, error messages, or screenshots.
```

### Security Vulnerabilities

⚠️ **Please do not create public issues for security vulnerabilities.** Instead, email the maintainers directly with details.

## 💡 Suggesting Features

We love new ideas! To suggest a feature:

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with the label `enhancement`
3. **Describe the feature** clearly:
   - What problem does it solve?
   - How should it work?
   - Are there any alternatives you've considered?
4. **Be open to discussion** - we may suggest modifications or alternatives

## 🛠️ Development Setup

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Git

### Setup Steps

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/splitstream-protocol.git
cd splitstream-protocol

# 3. Add upstream remote
git remote add upstream https://github.com/Yusufolosun/splitstream-protocol.git

# 4. Install dependencies
npm install

# 5. Copy environment template
cp .env.example .env

# 6. Run tests to verify setup
npx hardhat test
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## 📝 Code Style Guidelines

### Solidity Style

Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html):

- **Indentation**: 4 spaces
- **Line Length**: Maximum 120 characters
- **Naming Conventions**:
  - Contracts: `PascalCase` (e.g., `SplitStream`)
  - Functions: `camelCase` (e.g., `release`, `totalShares`)
  - Variables: `camelCase` for local, `_camelCase` for private/internal
  - Constants: `UPPER_CASE_WITH_UNDERSCORES`
  - Events: `PascalCase` (e.g., `PaymentReleased`)

**Example:**

```solidity
// Good
function release(address payable account) public override {
    require(_shares[account] > 0, "SplitStream: account has no shares");
    // ...
}

// Bad
function Release(address payable Account) public override {
    require(_shares[Account]>0,"no shares");
    // ...
}
```

### JavaScript/TypeScript Style

- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Always use semicolons
- **Naming**: `camelCase` for variables and functions, `PascalCase` for classes

**Example:**

```javascript
// Good
const payees = [payee1.address, payee2.address];
const shares = [50, 30];

// Bad
const Payees=[payee1.address,payee2.address]
const shares=[50,30]
```

### Documentation

- **NatSpec Comments**: All public functions must have NatSpec documentation
- **Inline Comments**: Use for complex logic
- **README Updates**: Update documentation for new features

```solidity
/**
 * @dev Releases the owed payment to a payee.
 * @param account The address of the payee
 */
function release(address payable account) public override {
    // Implementation
}
```

## ✅ Testing Requirements

All contributions must include appropriate tests and pass the existing test suite.

### Running Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/SplitStream.test.js

# Run with coverage
npx hardhat coverage
```

### Test Requirements

- **New Features**: Must include comprehensive tests
- **Bug Fixes**: Must include a test that would have caught the bug
- **All Tests Must Pass**: No PR will be merged with failing tests
- **Coverage**: Aim for high test coverage (>90%)

### Writing Tests

```javascript
describe("Feature Name", function () {
  it("Should do something specific", async function () {
    // Arrange
    const setup = await setupTest();
    
    // Act
    await setup.contract.someFunction();
    
    // Assert
    expect(await setup.contract.someValue()).to.equal(expectedValue);
  });
});
```

## 🔄 Pull Request Process

### Before Submitting

1. ✅ Ensure all tests pass
2. ✅ Update documentation if needed
3. ✅ Follow code style guidelines
4. ✅ Write clear commit messages
5. ✅ Rebase on latest `main` branch

### Submitting a PR

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them

3. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference to related issues (e.g., "Fixes #123")
   - Screenshots/examples if applicable

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged
- Thank you for your contribution! 🎉

## 📝 Commit Message Conventions

Use clear, descriptive commit messages following this format:

```
<type>: <subject>

<body (optional)>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `style`: Code style changes (formatting, etc.)
- `chore`: Maintenance tasks

### Examples

```bash
# Good
git commit -m "feat: Add support for ERC20 token splitting"
git commit -m "fix: Prevent reentrancy in release function"
git commit -m "docs: Update deployment instructions for Base"
git commit -m "test: Add edge case tests for zero shares"

# Bad
git commit -m "fixed stuff"
git commit -m "updates"
git commit -m "WIP"
```

### Multi-line Commits

```bash
git commit -m "feat: Add batch release function

Allows releasing payments to multiple payees in a single transaction.
This reduces gas costs for contract administrators.

Closes #42"
```

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Experience level
- Gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Body size
- Race
- Ethnicity
- Age
- Religion
- Nationality

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them learn
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct inappropriate in a professional setting

### Enforcement

Violations may result in temporary or permanent ban from the project. Report issues to the project maintainers.

## 🙏 Thank You

Your contributions make this project better! We appreciate your time and effort in helping improve SplitStream Protocol.

## 📚 Additional Resources

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Base Documentation](https://docs.base.org/)

## 💬 Questions?

If you have questions:
- Check existing [issues](https://github.com/Yusufolosun/splitstream-protocol/issues)
- Create a new issue with the `question` label
- Join our community discussions

---

**Happy Contributing! 🚀**
