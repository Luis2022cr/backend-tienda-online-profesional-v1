import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
    region: 'auto', 
    endpoint: process.env.R2_ENDPOINT as string,
    credentials: {
        accessKeyId: process.env.R2_KEYID as string,
        secretAccessKey: process.env.R2_ACCESSKEY as string,
    },
});
