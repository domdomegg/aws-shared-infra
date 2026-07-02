import * as aws from '@pulumi/aws';
import {githubRepoBranchTrust} from './githubOidcProvider';

const PULUMI_STATE_BUCKET = 'domdomegg-pulumi-backend';

// The CI role for THIS repo. aws-shared-infra IS the account's IAM manager, so
// this role gets full IAM admin (iam:* below) — that's what lets it be fully
// GitOps-managed without editing its own policy every time it manages a new
// role/provider/policy. It can rewrite its own permissions, so its trust
// condition isn't a boundary it can't cross; the guardrail is branch protection
// requiring review on master. Scope is deliberately iam:* (+ its own state),
// NOT AdministratorAccess: a bug or compromise here stays an IAM incident and
// can't reach the account's Lambda/S3/DynamoDB or other projects.
//
// Chicken-and-egg: this role must exist before CI can assume it, so the FIRST
// deploy is a human admin apply (`aws login --profile adam && pulumi up`).
// After that, CI manages everything here, including this role.

export const selfCiRole = new aws.iam.Role('aws-shared-infra-ci', {
	name: 'aws-shared-infra-ci',
	description: 'Assumed by GitHub Actions (domdomegg/aws-shared-infra@master) to deploy this repo. Federated, no static keys. Self-managing.',
	assumeRolePolicy: githubRepoBranchTrust('domdomegg/aws-shared-infra'),
});

// This repo's own Pulumi state prefix.
new aws.iam.RolePolicy('aws-shared-infra-ci-pulumi-state', {
	role: selfCiRole.name,
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Action: ['s3:ListBucket'],
				Resource: `arn:aws:s3:::${PULUMI_STATE_BUCKET}`,
				Condition: {StringLike: {'s3:prefix': ['aws-shared-infra/*']}},
			},
			{
				Effect: 'Allow',
				Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
				Resource: `arn:aws:s3:::${PULUMI_STATE_BUCKET}/aws-shared-infra/*`,
			},
		],
	}),
});

// Full IAM admin: manage every role/policy/provider this repo owns now or adds
// later — including granting itself new permissions — without editing this
// policy again. That self-grant ability is intentional (see note above): it's
// what makes the repo fully self-managing.
new aws.iam.RolePolicy('aws-shared-infra-ci-manage-iam', {
	role: selfCiRole.name,
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Effect: 'Allow',
			Action: 'iam:*',
			Resource: '*',
		}],
	}),
});
