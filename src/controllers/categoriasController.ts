import { Request, Response } from 'express';
import client from '../db/turso';

// Obtener todas las categorías
export const getCategorias = async (req: Request, res: Response): Promise<void> => {
    try {
        const resultSet = await executeQuery("SELECT * FROM categorias ORDER BY id ASC;");

        res.status(200).json(resultSet.rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Error fetching categories' });
    }
};

export const getCategoriaPorSlug = async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    try {
        const resultSet = await executeQuery(
            "SELECT * FROM categorias WHERE slug = ?",
            [slug]
        );

        if (resultSet.rows.length > 0) {
            res.status(200).json(resultSet.rows[0]);
        } else {
            throw new AppError("Categoria no encontrado", 404);
        }
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al obtener el categoria' });
        }
    }
};


// Crear una nueva categoría
export const crearCategoria = async (req: Request, res: Response): Promise<void> => {
    const { nombre, descripcion } = req.body;
    const file = req.files && typeof req.files === 'object' && 'file' in req.files
    ? (req.files['file'] as Express.Multer.File[])[0]
    : undefined; 

    try {
        validacionesObligatorias({ nombre,descripcion, file }, ['nombre', 'descripcion', 'file']);

        if (!file) {
            throw new AppError("No se proporcionó ningún archivo.", 400);
        }

        await verificarExisteEnDb(
            'categorias',
            'nombre',
            nombre,
            'Ya existe una categoría con ese nombre.'
        );
        
        const imageUrl = await subiryConvetirR2(file, 'categorias');
        
         const id = generateId('cat'); // Generar un ID único para la variante
        const slug = generateSlug(nombre);

        await executeQuery(
            "INSERT INTO categorias (id, nombre, descripcion, imagen, slug) VALUES (?, ?, ?, ?, ?)",
            [id, nombre, descripcion, imageUrl, slug]
        );

        res.status(201).json({ message: 'Categoría creada exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al crear el categoria" });
        }
    }
};

// Actualizar una categoría existente
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.id;
    const { nombre, descripcion } = req.body;
    const file = req.files && typeof req.files === 'object' && 'file' in req.files
    ? (req.files['file'] as Express.Multer.File[])[0]
    : undefined; 
    try {
        validacionesObligatorias({ nombre,descripcion }, ['nombre', 'descripcion']);
        
        let imageUrl: string | undefined;
        if (file) {
            imageUrl = await subiryConvetirR2(file, 'categorias');
        }
        const slug = generateSlug(nombre);

        const datosActualizar: { [key: string]: string } = { nombre, descripcion, slug };
        if (imageUrl) {
            datosActualizar.imagen = imageUrl;
        }

        await executeQuery(
            `UPDATE categorias SET ${Object.keys(datosActualizar).map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(datosActualizar), categoryId]
        );

        res.status(200).json({ message: 'Categoría actualizada exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al crear el categoria" });
        }
    }
};

// Eliminar una categoría

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { executeQuery } from '../services/dbService';
import { AppError } from '../utils/appError';
import { validacionesObligatorias } from '../utils/validaciones';
import { subiryConvetirR2 } from '../services/r2Service';
import { verificarExisteEnDb } from '../services/existeDatoEnDb';
import { r2Client } from '../utils/r2';
import { generateSlug } from '../utils/generarSlug';
import { generateId } from '../utils/GenerarIdTexto';

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    const categoryId = req.params.id;

    try {
        // Recuperar el categoria para obtener la URL de la imagen
        const result = await client.execute({
            sql: "SELECT imagen FROM categorias WHERE id = ?",
            args: [categoryId]
        });

        // Verificar si se obtuvo algún resultado
        const categoria = result.rows && result.rows[0];
        const imageUrl = categoria?.imagen;

        if (imageUrl && typeof imageUrl === 'string') {
            // Extraer el file key de la URL de la imagen
            const fileKey = imageUrl.split(`${process.env.R2_URLPUBLIC}/`)[1];

            // Eliminar la imagen del bucket de R2
            if (fileKey) {
                try {
                    const command = new DeleteObjectCommand({
                        Bucket: process.env.R2_BUCKET,
                        Key: fileKey,
                    });
                    await r2Client.send(command);
                } catch (deleteError) {
                    console.error('Error al eliminar la imagen del bucket:', deleteError);
                }
            }
        }

        // Eliminar categoria
        await client.execute({
            sql: "DELETE FROM categorias WHERE id = ?",
            args: [categoryId]
        });

        res.status(200).json({ message: 'categoria eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar el categoria:', error);
        res.status(500).json({ error: 'Error al eliminar el categoria' });
    }
};
