// controllers/bannerController.ts
import { Request, Response } from 'express';
import { executeQuery } from '../services/dbService';
import { subiryConvetirR2, borrarR2 } from '../services/r2Service';
import { validacionesObligatorias } from '../utils/validaciones';
import { AppError } from '../utils/appError';

// Obtener todos los banners
export const getBanners = async (req: Request, res: Response) => {
    try {
        const results = await executeQuery("SELECT * FROM banners ORDER BY id ASC;");
        res.status(200).json(results.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener banners' });
    }
};

// Obtener un banner por ID
export const getBannerPorId = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        // Ejecutar la consulta
        const resultados = await executeQuery(
            "SELECT * FROM banners WHERE id = ?",
            [id]
        );

        // Verificar si se encontró el banner
        if (resultados.rows.length > 0) {
            const banner = resultados.rows[0];
            res.status(200).json({ banner });
        } else {
            throw new AppError("Banner no encontrado", 404);
        }
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al obtener el banner' });
        }
    }
};

// Crear un nuevo banner
export const crearBanner = async (req: Request, res: Response) => {
    const { nombre, link } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    try {
        validacionesObligatorias({ nombre, link, file }, ['nombre', 'link', 'file']);

        if (!file) {
            throw new AppError("No se proporcionó ningún archivo.", 400);
        }

        const imageUrl = await subiryConvetirR2(file, 'banners');

        await executeQuery("INSERT INTO banners (nombre, imagen, link) VALUES (?, ?, ?)", [nombre, imageUrl, link]);

        // await executeQuery(`
        //     CREATE TABLE IF NOT EXISTS authors (
        //         id INTEGER PRIMARY KEY,
        //         name TEXT NOT NULL
        //     )
        // `);

        // await executeQuery(`
        //     CREATE TABLE IF NOT EXISTS books (
        //         id INTEGER PRIMARY KEY,
        //         title TEXT NOT NULL,
        //         author_id INTEGER NOT NULL,
        //         FOREIGN KEY (author_id) REFERENCES authors (id)
        //     )
        // `);

        res.status(201).json({ message: 'Banner creado exitosamente', imageUrl });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al crear el Banner" });
        }
    }
};

// Actualizar un banner existente
export const actualizarBanner = async (req: Request, res: Response): Promise<void> => {
    const bannerId = req.params.id;
    const { nombre, link } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    try {
        validacionesObligatorias({ bannerId, nombre, link }, ['bannerId', 'nombre', 'link']);

        let imageUrl: string | undefined;

        if (file) {
            imageUrl = await subiryConvetirR2(file, 'banners');
        }

        const datosActualizar: { [key: string]: string } = { nombre, link };
        if (imageUrl) {
            datosActualizar.imagen = imageUrl;
        }

        await executeQuery(
            `UPDATE banners SET ${Object.keys(datosActualizar).map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(datosActualizar), bannerId]
        );

        res.status(200).json({ message: 'Banner actualizado exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al actualizar el Banner" });
        }
    }
};

// Eliminar un banner
export const eliminarBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Consultar la imagen asociada al banner
        const result = await executeQuery("SELECT imagen FROM banners WHERE id = ?", [id]);
        const banner = result.rows?.[0];

        if (banner && typeof banner.imagen === 'string') {
            const fileKey = banner.imagen.split(`${process.env.R2_URLPUBLIC}/`)[1];

            // Verificar que se obtuvo el fileKey antes de eliminar la imagen
            if (fileKey) {
                await borrarR2(fileKey); // Asegúrate de implementar esta función para eliminar de R2
            }
        } else {
            throw new AppError('No se encontró la imagen asociada al banner o su formato es inválido.', 400);
        }

        // Eliminar el registro del banner
        await executeQuery("DELETE FROM banners WHERE id = ?", [id]);
        res.status(200).json({ message: 'Banner eliminado exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(500).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error inesperado.' });
        }
    }
};
