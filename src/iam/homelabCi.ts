import * as aws from '@pulumi/aws';
import {githubRepoBranchTrust} from './githubOidcProvider';

const ACCOUNT_ID = '338337944728';
const PULUMI_STATE_BUCKET = 'domdomegg-pulumi-backend';

// Permissions boundary = the ceiling on what homelab's app roles can do. A
// boundary allows ONLY what it lists; everything else (all of iam:*, sts:*, …)
// is implicitly denied. So this single SES-send allow is what makes homelab-ci
// safe to hand role-management: whatever inline policy it attaches to an app
// role, the role can never do more than send SES email. No deny rules needed.
export const homelabAppRoleBoundary = new aws.iam.Policy('homelab-app-role-boundary', {
	name: 'homelab-app-role-boundary',
	description: 'Permissions ceiling for app roles managed by homelab-ci (SES send only).',
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Effect: 'Allow',
			Action: ['ses:SendEmail', 'ses:SendRawEmail'],
			Resource: '*',
		}],
	}),
});

// The role homelab's CI assumes to run `pulumi up`. Replaces the long-lived
// AWS_CREDENTIALS/AWS_CONFIG GitHub secrets.
export const homelabCiRole = new aws.iam.Role('homelab-ci', {
	name: 'homelab-ci',
	description: 'Assumed by GitHub Actions (domdomegg/homelab@master) to deploy. Federated, no static keys.',
	assumeRolePolicy: githubRepoBranchTrust('domdomegg/homelab'),
});

// Read/write homelab's Pulumi state prefix.
new aws.iam.RolePolicy('homelab-ci-pulumi-state', {
	role: homelabCiRole.name,
	policy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Action: ['s3:ListBucket'],
				Resource: `arn:aws:s3:::${PULUMI_STATE_BUCKET}`,
				Condition: {StringLike: {'s3:prefix': ['homelab/*']}},
			},
			{
				Effect: 'Allow',
				Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
				Resource: `arn:aws:s3:::${PULUMI_STATE_BUCKET}/homelab/*`,
			},
		],
	}),
});

// Manage the IAM homelab owns: its app roles (named homelab-app-*) and the
// cluster OIDC provider. The homelab-app-* prefix covers app roles but NOT
// homelab-ci itself, so this grant can't be used for self-escalation. Every app
// role MUST carry homelabAppRoleBoundary — enforced by the condition on
// CreateRole. That boundary is the whole safety story: it caps the role's
// effective permissions, so the permission-granting verbs here (PutRolePolicy,
// UpdateAssumeRolePolicy) can't escalate the role beyond SES.
new aws.iam.RolePolicy('homelab-ci-app-iam', {
	role: homelabCiRole.name,
	policy: homelabAppRoleBoundary.arn.apply((boundaryArn) => JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				// Create a role, or (re)set its boundary — but ONLY to our
				// boundary. This condition is the escalation guard: homelab-ci
				// can't create an unbounded role, nor swap in a weaker boundary.
				Effect: 'Allow',
				Action: ['iam:CreateRole', 'iam:PutRolePermissionsBoundary'],
				Resource: `arn:aws:iam::${ACCOUNT_ID}:role/homelab-app-*`,
				Condition: {StringEquals: {'iam:PermissionsBoundary': boundaryArn}},
			},
			{
				Effect: 'Allow',
				Action: [
					'iam:GetRole',
					'iam:DeleteRole',
					'iam:TagRole',
					'iam:UntagRole',
					'iam:ListRoleTags',
					'iam:ListRolePolicies',
					'iam:ListAttachedRolePolicies',
					'iam:GetRolePolicy',
					'iam:PutRolePolicy',
					'iam:DeleteRolePolicy',
					'iam:UpdateAssumeRolePolicy',
				],
				Resource: `arn:aws:iam::${ACCOUNT_ID}:role/homelab-app-*`,
			},
			{
				Effect: 'Allow',
				Action: [
					'iam:GetOpenIDConnectProvider',
					'iam:UpdateOpenIDConnectProviderThumbprint',
					'iam:AddClientIDToOpenIDConnectProvider',
					'iam:RemoveClientIDFromOpenIDConnectProvider',
					'iam:TagOpenIDConnectProvider',
					'iam:UntagOpenIDConnectProvider',
				],
				Resource: `arn:aws:iam::${ACCOUNT_ID}:oidc-provider/k8s-oidc.home.adamjones.me`,
			},
		],
	})),
});

// homelab's ci.yaml assumes this (see PLAN.md step 2).
export const homelabCiRoleArn = homelabCiRole.arn;
