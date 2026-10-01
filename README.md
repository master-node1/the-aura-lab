# The Aura Lab

## Local quality checks

Install the repository's linting tools and enable its Git hooks:

```sh
npm install
npm run hooks:install
```

The pre-commit hook checks whitespace and lints staged TypeScript files. The
pre-push hook runs ESLint across the TypeScript services and checks Python
syntax in `services/ai-service`. Run the full checks manually with
`npm run quality`.