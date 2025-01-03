import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import client from '../db/turso';

// Crear un nuevo producto con atributos e imágenes
export const crearProducto = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, descripcion, slug, categoria_id, atributos } = req.body;
        const files = req.files as Express.Multer.File[] | undefined;

        // Validar campos obligatorios
        if (!nombre || !descripcion || !slug || !categoria_id) {
            res.status(400).json({ error: 'Todos los campos son obligatorios.' });
            return;
        }

        // Verificar si el producto con el mismo slug ya existe
        const existeProducto = await client.execute({
            sql: "SELECT * FROM productos WHERE slug = ?",
            args: [slug]
        });

        if (existeProducto.rows.length > 0) {
            res.status(400).json({ error: 'Ya existe un producto con ese slug.' });
            return;
        }

        // Insertar el producto en la tabla productos
        const productoId = uuidv4();

        await client.execute({
            sql: "INSERT INTO productos (id, nombre, descripcion, slug, categoria_id, fecha_creacion) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            args: [productoId, nombre, descripcion, slug, categoria_id]
        });

        // Procesar los atributos y guardarlos en valores_atributos
        if (atributos && Array.isArray(atributos)) {
            for (const atributo of atributos) {
                const { atributo_id, valor_texto, valor_numero } = atributo;

                await client.execute({
                    sql: "INSERT INTO valores_atributos (producto_id, atributo_id, valor_texto, valor_numero) VALUES (?, ?, ?, ?)",
                    args: [productoId, atributo_id, valor_texto || null, valor_numero || null]
                });
            }
        }

        // Procesar y subir las imágenes a Cloudinary
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'Debe proporcionar al menos una imagen.' });
            return;
        }

        const imageUrls = [];

        for (const file of files) {
            const arrayBuffer = Buffer.from(file.buffer);

            const response: any = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({
                    tags: ['productos'],
                    upload_preset: 'ml_default',
                }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });

                stream.end(arrayBuffer);
            });

            const imageUrl = response.secure_url;
            imageUrls.push(imageUrl);

            // Insertar la URL de la imagen en la tabla imagenes_producto
            await client.execute({
                sql: "INSERT INTO imagenes_producto (producto_id, imagen_url, fecha_creacion) VALUES (?, ?, CURRENT_TIMESTAMP)",
                args: [productoId, imageUrl]
            });
        }

        res.status(201).json({
            message: 'Producto creado exitosamente',
            productoId,
            imageUrls
        });
    } catch (error) {
        console.error('Error creando el producto:', error);
        res.status(500).json({ error: 'Error al crear el producto' });
    }
};
