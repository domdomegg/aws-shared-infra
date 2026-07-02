import * as aws from '@pulumi/aws';

// Account-level shared S3 buckets — the ones that aren't owned by any single
// project. Imported as-is (their live config is reproduced below so `pulumi up`
// shows no changes). Per-project buckets (serverless deploy buckets, etc.) are
// NOT managed here.

// ---------------------------------------------------------------------------
// Pulumi state backend — holds every project's Pulumi state (including this
// repo's own). Imported:
//   pulumi import aws:s3/bucket:Bucket pulumi-state-bucket domdomegg-pulumi-backend
// ---------------------------------------------------------------------------
export const pulumiStateBucket = new aws.s3.Bucket('pulumi-state-bucket', {
	bucket: 'domdomegg-pulumi-backend',
});

new aws.s3.BucketServerSideEncryptionConfiguration('pulumi-state-bucket-encryption', {
	bucket: pulumiStateBucket.id,
	rules: [{
		applyServerSideEncryptionByDefault: {sseAlgorithm: 'AES256'},
		bucketKeyEnabled: true,
	}],
});

// Locked down — no public access (this holds infrastructure state).
new aws.s3.BucketPublicAccessBlock('pulumi-state-bucket-pab', {
	bucket: pulumiStateBucket.id,
	blockPublicAcls: true,
	ignorePublicAcls: true,
	blockPublicPolicy: true,
	restrictPublicBuckets: true,
});

// ---------------------------------------------------------------------------
// Personal file-sharing bucket — drop a big file in here and hand someone the
// public object URL as a download link. Objects are public-read (see policy
// below); the bucket is otherwise empty by default. Imported:
//   pulumi import aws:s3/bucket:Bucket public-bucket domdomegg
// ---------------------------------------------------------------------------
export const publicBucket = new aws.s3.Bucket('public-bucket', {
	bucket: 'domdomegg',
});

new aws.s3.BucketServerSideEncryptionConfiguration('public-bucket-encryption', {
	bucket: publicBucket.id,
	rules: [{
		applyServerSideEncryptionByDefault: {sseAlgorithm: 'AES256'},
	}],
});

// Public-read on objects (its defining feature — anyone may GET).
new aws.s3.BucketPolicy('public-bucket-policy', {
	bucket: publicBucket.id,
	policy: publicBucket.arn.apply((arn) => JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Sid: 'PublicReadGetObject',
			Effect: 'Allow',
			Principal: '*',
			Action: 's3:GetObject',
			Resource: `${arn}/*`,
		}],
	})),
});
