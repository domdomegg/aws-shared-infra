import * as aws from '@pulumi/aws';

// Generic GitHub Actions OIDC provider — lets GitHub-issued tokens be federated
// into AWS, so any repo's CI can assume a role without long-lived access keys.
// Account-singleton, shared by every per-repo CI role.
// https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
export const githubOidcProvider = new aws.iam.OpenIdConnectProvider('github-actions-oidc', {
	url: 'https://token.actions.githubusercontent.com',
	clientIdLists: ['sts.amazonaws.com'],
	// No thumbprintLists: AWS validates GitHub's OIDC against its own trusted-CA
	// library and ignores configured thumbprints for known IdPs, so IAM derives
	// one automatically. (Field is optional in the provider.)
});

const ACCOUNT_ID = '338337944728';

// Build the trust policy for a role assumable ONLY by a specific repo's given
// branch ref via this provider. StringEquals (not StringLike) on both aud and
// sub — no wildcards, so forks/PRs/tags/other-branches/other-repos are excluded.
export function githubRepoBranchTrust(repo: string, branch = 'master'): aws.iam.Role['assumeRolePolicy'] {
	return githubOidcProvider.arn.apply((providerArn) => JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Effect: 'Allow',
			Principal: {Federated: providerArn},
			Action: 'sts:AssumeRoleWithWebIdentity',
			Condition: {
				StringEquals: {
					'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
					'token.actions.githubusercontent.com:sub': `repo:${repo}:ref:refs/heads/${branch}`,
				},
			},
		}],
	}));
}

// The GitHub OIDC provider's ARN, for policies that scope to it.
export const githubOidcProviderArn = `arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com`;
