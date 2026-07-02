# aws-shared-infra

Infrastructure as code (IaC) for **account-level, cross-cutting AWS IAM** in account `338337944728` — the pieces that other things bootstrap off, and that aren't owned by any single app:

- **GitHub Actions OIDC provider** (`token.actions.githubusercontent.com`): the account-singleton that lets any repo federate into AWS keylessly.
- **CI federation roles**: assumed by GitHub Actions to deploy, so those repos need no long-lived AWS keys. Currently `homelab-ci` (`domdomegg/homelab@master`) and `aws-shared-infra-ci` (this repo, self-managing).

Managed with [Pulumi](https://www.pulumi.com/) (AWS provider), conventions from [typescript-library-template](https://github.com/domdomegg/typescript-library-template).

Structure (`src/iam/`):
- `githubOidcProvider.ts` — the generic GitHub OIDC provider + a `githubRepoBranchTrust(repo)` helper for tightly-scoped trust policies.
- `homelabCi.ts` — the `homelab-ci` role, its scoped grants, and the **app-role permissions boundary** (see below).
- `selfCiRole.ts` — this repo's own self-managing CI role.

## Safety: delegated IAM without escalation

`homelab-ci` can create/modify the app roles homelab owns (e.g. `adamcon`) — but only ones carrying the `homelab-app-role-boundary` permissions boundary (enforced via an `iam:PermissionsBoundary` condition, plus an explicit deny on removing the boundary). The boundary is a ceiling that forbids `iam:*`, `sts:AssumeRole`, and other escalation vectors. So homelab-ci stays **flexible** (manage app roles freely) while being **safe** (it cannot turn `adamcon` — or any app role — into an admin). When homelab creates/imports an app role, it must attach this boundary or the deploy is denied.

## What does NOT live here

- **The k3s cluster OIDC provider** (`k8s-oidc.home.adamjones.me`) lives in the **homelab** repo — it belongs next to the cluster and the `adamcon` app that federate through it (homelab-ci is granted scoped OIDC-provider perms to manage it).
- **App-scoped IAM** lives with its app. The `adamcon` SES-send role lives in homelab too, next to the code that assumes it.
- **Other projects' Serverless Framework lambda roles** (`*-lambda-*`, raise/postal-vote/etc.) stay owned by their own `serverless deploy` — importing them here would fight that tooling.

## Local development

1. Install Node.js and the Pulumi CLI.
2. Get admin AWS creds for account `338337944728` (e.g. `aws login --profile adam`; the narrow `serverless` user cannot manage IAM).
3. `pulumi login s3://domdomegg-pulumi-backend/aws-shared-infra`
4. `npm ci`
5. `AWS_PROFILE=adam npm run preview` / `deploy:prod`

## First deploy

All resources here are **created** (the GitHub OIDC provider + the CI roles/policies) — nothing to import. `npm run preview` should show only creates. Because CI can't yet assume its own role, the first `pulumi up` is a human admin apply (see below).

## CI / self-management (bootstrap)

This repo is **self-managing**: its own GitHub Actions (`domdomegg/aws-shared-infra@master`) assume the `aws-shared-infra-ci` role — which this repo itself creates — to run `pulumi up`. No stored AWS secret.

Chicken-and-egg: that role must exist before CI can assume it, so the **first** deploy is a one-time human admin apply:

```bash
aws login --profile adam   # user/Adam; the serverless user has no IAM perms
eval "$(aws configure export-credentials --profile adam --format env)"
export PULUMI_CONFIG_PASSPHRASE=unused
pulumi login s3://domdomegg-pulumi-backend/aws-shared-infra
pulumi up --stack prod
```

After that first apply the `aws-shared-infra-ci` role exists, and pushes to `master` deploy via CI. (If the role is ever missing — e.g. account rebuild — CI's deploy step will fail at `AssumeRoleWithWebIdentity`; re-run the manual apply above to recreate it.)

The CI role is intentionally powerful (it manages the GitHub OIDC provider + CI roles, itself included) — its trust is pinned to this repo's `master` ref, but because it can rewrite its own trust/permissions, the real guardrail is **branch protection requiring review on `master`**. A stricter setup would add a permissions boundary to the CI role itself (documented follow-up).

## Bootstrap ordering (why this repo exists separately)

`homelab`'s CI authenticates to AWS *using* the `homelab-ci` role defined here, so this repo must be deployed **first** (the human apply above) before homelab's `ci.yaml` is switched over to federation. See `PLAN.md` in the homelab repo.
