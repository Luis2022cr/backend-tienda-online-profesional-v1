import { Request, Response } from 'express';
import { executeQuery } from '../services/dbService';
import { AppError } from '../utils/appError';

// Obtener el contenido del carrito de un usuario
export const getCarrito = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id; // Obtener el ID del usuario desde el middleware

    try {
        const query = `
            SELECT 
                carrito.id AS carrito_id,
                productos.nombre AS producto_nombre,
                productos.imagen AS producto_imagen,
                productos.slug AS producto_slug,
                variantes.nombre AS variante_nombre,
                detalles_variantes.valor AS variante_valor,
                carrito.cantidad,
                CASE 
                    WHEN carrito.detalle_variante_id IS NOT NULL THEN detalles_variantes.precio
                    ELSE productos.precio 
                END AS precio_unitario,
                (carrito.cantidad * 
                    CASE 
                        WHEN carrito.detalle_variante_id IS NOT NULL THEN detalles_variantes.precio
                        ELSE productos.precio 
                    END
                ) AS subtotal
            FROM carrito
            LEFT JOIN productos ON carrito.producto_id = productos.id
            LEFT JOIN detalles_variantes ON carrito.detalle_variante_id = detalles_variantes.id
            LEFT JOIN variantes ON detalles_variantes.variante_id = variantes.id
            WHERE carrito.usuario_id = ?;
        `;

        const results = await executeQuery(query, [userId]);
        res.status(200).json(results.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el carrito' });
    }
};

// Agregar un producto al carrito
export const addProductoCarrito = async (req: Request, res: Response) => {
    const { productoId, detalleVarianteId, cantidad } = req.body;
    const userId = (req as any).user?.id; // Obtener el ID del usuario desde el middleware

    try {
        // Verificar si el producto ya está en el carrito
        const checkQuery = `
            SELECT id, cantidad 
            FROM carrito 
            WHERE usuario_id = ? AND producto_id = ? 
            AND (detalle_variante_id IS NULL OR detalle_variante_id = ?);
        `;
        const existing = await executeQuery(checkQuery, [userId, productoId, detalleVarianteId]);

        if (existing.rows.length > 0) {
            // Actualizar cantidad si ya existe
            const carritoId = existing.rows[0].id;
            const nuevaCantidad = existing.rows[0].cantidad + cantidad;

            await executeQuery(
                "UPDATE carrito SET cantidad = ? WHERE id = ?",
                [nuevaCantidad, carritoId]
            );
        } else {
            // Insertar nuevo producto en el carrito
            await executeQuery(
                "INSERT INTO carrito (usuario_id, producto_id, detalle_variante_id, cantidad) VALUES (?, ?, ?, ?)",
                [userId, productoId, detalleVarianteId, cantidad]
            );
        }

        res.status(201).json({ message: 'Producto agregado al carrito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al agregar producto al carrito' });
    }
};

// Actualizar la cantidad de un producto en el carrito
export const updateCantidadCarrito = async (req: Request, res: Response) => {
    const { carritoId } = req.params;
    const { cantidad } = req.body;

    try {
        await executeQuery(
            "UPDATE carrito SET cantidad = ? WHERE id = ?",
            [cantidad, carritoId]
        );

        res.status(200).json({ message: 'Cantidad actualizada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la cantidad' });
    }
};

// Eliminar un producto del carrito
export const deleteProductoCarrito = async (req: Request, res: Response) => {
    const { carritoId } = req.params;

    try {
        await executeQuery("DELETE FROM carrito WHERE id = ?", [carritoId]);
        res.status(200).json({ message: 'Producto eliminado del carrito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto del carrito' });
    }
};

// Vaciar el carrito de un usuario
export const clearCarrito = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id; // Obtener el ID del usuario desde el middleware

    try {
        await executeQuery("DELETE FROM carrito WHERE usuario_id = ?", [userId]);
        res.status(200).json({ message: 'Carrito vaciado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al vaciar el carrito' });
    }
};

export const getTotalCarrito = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id; // Obtener el ID del usuario desde el middleware

    try {
        const query = `
            SELECT 
                SUM(carrito.cantidad * 
                    CASE 
                        WHEN carrito.detalle_variante_id IS NOT NULL THEN detalles_variantes.precio
                        ELSE productos.precio 
                    END
                ) AS total
            FROM carrito
            LEFT JOIN productos ON carrito.producto_id = productos.id
            LEFT JOIN detalles_variantes ON carrito.detalle_variante_id = detalles_variantes.id
            WHERE carrito.usuario_id = ?;
        `;

        const result = await executeQuery(query, [userId]);

        if (result.rows.length > 0) {
            const total = result.rows[0].total || 0; 
            res.status(200).json({ total });
        } else {
            throw new AppError('Carrito no encontrado para el usuario', 404);
        }
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al calcular el total del carrito' });
        }
    }
};