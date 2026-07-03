import * as aws from '@pulumi/aws';
import {githubRepoBranchTrust} from './githubOidcProvider';

// The Serverless Framework deploy permissions. Previously attached to the
// long-lived `serverless` IAM user (created 2019, key from 2021) — now being
// retired in favour of per-repo federated CI roles below. Imported as-is:
//   pulumi import aws:iam/policy:Policy serverless-policy arn:aws:iam::338337944728:policy/serverless-policy
// Broad by design of the original (CloudFormation/Lambda/APIGW/DynamoDB/S3/
// CloudFront + the IAM role verbs serverless needs, all on Resource:*).
// Tightening it is a possible follow-up; importing as-is keeps the migration
// to WIF a pure auth change.
export const serverlessPolicy = new aws.iam.Policy('serverless-policy', {
	name: 'serverless-policy',
	policy: JSON.stringify({
		Statement: [
			{
				Action: [
					'apigateway:*',
					'cloudformation:CancelUpdateStack',
					'cloudformation:ContinueUpdateRollback',
					'cloudformation:CreateChangeSet',
					'cloudformation:CreateStack',
					'cloudformation:CreateUploadBucket',
					'cloudformation:DeleteStack',
					'cloudformation:Describe*',
					'cloudformation:EstimateTemplateCost',
					'cloudformation:Get*',
					'cloudformation:List*',
					'cloudformation:UpdateStack',
					'cloudformation:UpdateTerminationProtection',
					'cloudformation:ValidateTemplate',
					'cloudformation:CreateChangeSet',
					'cloudformation:DeleteChangeSet',
					'cloudformation:DescribeChangeSet',
					'cloudformation:ExecuteChangeSet',
					'cloudfront:*',
					'dynamodb:CreateTable',
					'dynamodb:DeleteTable',
					'dynamodb:DescribeTable',
					'dynamodb:DescribeTimeToLive',
					'dynamodb:UpdateTimeToLive',
					'dynamodb:DescribeContinuousBackups',
					'dynamodb:UpdateContinuousBackups',
					'events:DeleteRule',
					'events:DescribeRule',
					'events:ListRuleNamesByTarget',
					'events:ListRules',
					'events:ListTargetsByRule',
					'events:PutRule',
					'events:PutTargets',
					'events:RemoveTargets',
					'iam:CreateRole',
					'iam:DeleteRole',
					'iam:DeleteRolePolicy',
					'iam:GetRole',
					'iam:PassRole',
					'iam:PutRolePolicy',
					'lambda:*',
					'logs:CreateLogGroup',
					'logs:DeleteLogGroup',
					'logs:DescribeLogGroups',
					'logs:DescribeLogStreams',
					'logs:FilterLogEvents',
					'logs:GetLogEvents',
					's3:CreateBucket',
					's3:DeleteBucket',
					's3:DeleteBucketPolicy',
					's3:DeleteObject',
					's3:DeleteObjectVersion',
					's3:GetObject',
					's3:GetObjectVersion',
					's3:ListAllMyBuckets',
					's3:ListBucket',
					's3:PutBucketNotification',
					's3:PutBucketPolicy',
					's3:PutBucketTagging',
					's3:PutBucketWebsite',
					's3:PutEncryptionConfiguration',
					's3:PutObject',
				],
				Effect: 'Allow',
				Resource: '*',
			},
		],
		Version: '2012-10-17',
	}),
});

// One federated CI role per Serverless-Framework repo. Trust is pinned to the
// repo's master branch via the shared GitHub OIDC provider — no static keys.
function serverlessCiRole(repoName: string): aws.iam.Role {
	const name = `${repoName}-ci`;
	const role = new aws.iam.Role(name, {
		name,
		description: `Assumed by GitHub Actions (domdomegg/${repoName}@master) to run serverless deploy. Federated, no static keys.`,
		assumeRolePolicy: githubRepoBranchTrust(`domdomegg/${repoName}`),
	});
	new aws.iam.RolePolicyAttachment(`${name}-serverless-policy`, {
		role: role.name,
		policyArn: serverlessPolicy.arn,
	});
	return role;
}

export const shrolebotCiRole = serverlessCiRole('shrolebot');
export const odirCiRole = serverlessCiRole('odir');
export const analyticsLambdaCiRole = serverlessCiRole('analytics-lambda');
export const dealerTechCiRole = serverlessCiRole('dealer-tech');
export const pruverCiRole = serverlessCiRole('pruver');
export const postalVoteCiRole = serverlessCiRole('postal-vote');
