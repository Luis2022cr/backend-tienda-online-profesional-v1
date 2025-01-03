// services/r2Service.ts
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '../utils/appError';
import sharp from 'sharp';
import slugify from 'slugify';
import { r2Client } from '../utils/r2';

export const subiryConvetirR2 = async (file: Express.Multer.File, bucketPath: string) => {
    try {
        const slugifiedName = slugify(file.originalname, { lower: true, strict: true });
        const shortUUID = crypto.randomUUID().split('-')[0];
        const fileKey = `${bucketPath}/${shortUUID}-${slugifiedName}.webp`;

        const imagenConvertida = await sharp(file.buffer)
            .webp({ quality: 50 })
            .toBuffer();

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: fileKey,
            Body: imagenConvertida,
            ContentType: 'image/webp',
        });

        await r2Client.send(command);

        return `${process.env.R2_URLPUBLIC}/${fileKey}`;
    } catch (error) {
        console.error('Error uploading to R2:', error);
        throw new AppError('Error uploading to R2', 500);
    }
};

export const borrarR2 = async (fileKey: string) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: fileKey,
        });
        await r2Client.send(command);
    } catch (error) {
        console.error('Error deleting from R2:', error);
        throw new Error('Error deleting from R2');
    }
};
