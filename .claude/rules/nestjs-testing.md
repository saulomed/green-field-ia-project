---
paths:
  - 'nestjs-project/**/*.spec.ts'
  - 'nestjs-project/**/*.e2e-spec.ts'
  - 'nestjs-project/test/**'
description: 'Testing conventions for NestJS unit and e2e tests'
---

# Testing Rules

## Unit Tests (`*.spec.ts`)

- Use `Test.createTestingModule()` from `@nestjs/testing` to set up the test module
- Follow the naming pattern: `describe('ClassName')` with descriptive `it('should ...')` blocks
- Place unit tests next to the source file they test (e.g., `users.service.ts` -> `users.service.spec.ts`)


## Integration Tests (`*.integration.spec.ts`)

- Place integration tests next to the source file they test, same directory as unit tests
- Use a real database — connect to the Docker `db` service (env vars from `.env` are available inside the container)
- **Table cleanup:** `repository.delete({})` throws `Empty criteria(s) are not allowed`. Use `dataSource.query('DELETE FROM table_name')` or `repository.clear()` to wipe tables between tests

### Transactional logic REQUIRES an integration test

Any method whose correctness depends on **commit/rollback semantics** MUST have an integration test against the real Postgres — a unit test with mocked `dataSource.transaction`/`EntityManager` gives a false green because the mock executes the callback directly, with no real commit or rollback.

This bit hard once: `SessionService.rotate` threw its exception *inside* `dataSource.transaction(...)`, so TypeORM rolled the whole transaction back and the family revocation (the entire point of the SI) was silently never persisted — yet every mocked unit test passed. The regression was only caught by an integration test against real Postgres.

Triggers that make an integration test mandatory:

- Persisting state and then conditionally throwing in the same transaction (rollback may undo the persist you intended to keep)
- Session/token rotation, bulk revocation, reuse detection
- Relying on a **unique constraint** (e.g. `23505`) to arbitrate concurrent inserts — mocks never enforce constraints
- Any behavior asserted purely by "the exception was thrown" when the durable side effect is what actually matters

To confirm the test really covers the bug class, temporarily revert the fix and watch it fail, then restore.

## E2E Tests (`*.e2e-spec.ts`)

- Place e2e tests in the `test/` directory
- Use `supertest` to make HTTP requests against the running app
- Test complete request/response cycles including status codes, response shape, and error cases
- Test authentication and authorization flows (valid token, invalid token, missing token)
- Use a real test database — do not mock the database layer in e2e tests
- **Reproduce `main.ts` global config manually:** `Test.createTestingModule()` does not execute `main.ts`. Global pipes, filters, and interceptors must be applied explicitly in `beforeAll`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`

## General

- Run only related tests during development; run the full suite before finishing
- All test commands run inside the container: `docker compose -f nestjs-project/compose.yaml exec nestjs-api npm test`

## Test Data

- Use factories or builders to create test data objects
- Avoid hardcoding values in tests; use variables or helper functions to generate test data
- Use realistic data that reflects actual use cases to catch edge cases and ensure test reliability
- Clean up test data after each test to maintain isolation and prevent side effects
- For e2e tests, consider using a separate test database to avoid conflicts with development data

## Test Structure

- Follow the Arrange-Act-Assert (AAA) pattern in test cases:
  - **Arrange:** Set up the necessary preconditions and inputs
  - **Act:** Execute the code being tested
  - **Assert:** Verify that the outcome is as expected
- Use descriptive test names that clearly indicate the expected behavior being tested
- Group related tests together using `describe()` blocks for better organization and readability
- Avoid testing multiple behaviors in a single test case; each test should focus on one specific aspect
- Use `beforeAll` and `afterAll` for setup and teardown that applies to all tests in a suite, and `beforeEach` and `afterEach` for setup and teardown that applies to individual tests

