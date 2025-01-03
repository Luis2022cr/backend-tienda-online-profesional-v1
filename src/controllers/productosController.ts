import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid'; // Importar uuidv4 desde uuid
import client from '../db/turso';

export const getProductosTarjeta = async (req: Request, res: Response): Promise<void> => {
    try {
        // Obtener el parámetro opcional de slug de categoría desde la consulta
        const { categoria_slug } = req.query;

        // Construcción dinámica de la consulta SQL
        const query = `
            SELECT 
                p.nombre, 
                p.slug AS producto_slug, 
                p.precio, 
                p.imagen, 
                c.nombre AS categoria_nombre, 
                c.slug AS categoria_slug
            FROM productos p
            JOIN categorias c ON p.categoria_id = c.id
            ${categoria_slug ? 'WHERE c.slug = ?' : ''}
            ORDER BY p.id ASC;
        `;

        // Ejecutar la consulta con el parámetro opcional
        const params = categoria_slug ? [categoria_slug] : [];
        const resultSet = await executeQuery(query, params);

        // Enviar la respuesta con los datos obtenidos
        res.status(200).json(resultSet.rows);
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al obtener los productos por categoría' });
        }
    }
};


export const getProductos = async (req: Request, res: Response): Promise<void> => {
    try {
        // Consulta para obtener productos junto con sus categorías
        const productosResult = await executeQuery(`
            SELECT p.id, p.categoria_id, p.nombre, p.descripcion, p.stock, p.precio, p.imagen, p.slug, p.fecha_creacion, 
                   c.id AS categoria_id, c.nombre AS categoria_nombre, c.descripcion AS categoria_descripcion, 
                   c.imagen AS categoria_imagen, c.slug AS categoria_slug
            FROM productos p
            JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.id ASC;
        `);

        if (!Array.isArray(productosResult.rows)) {
            res.status(500).json({ error: 'Unexpected data format from database' });
            return;
        }

        // Obtener detalles de productos
        const detallesResult = await client.execute("SELECT * FROM detalles_productos;");

        if (!Array.isArray(detallesResult.rows)) {
            res.status(500).json({ error: 'Unexpected data format from database' });
            return;
        }

        // Mapear los productos y añadir los detalles y categoría correspondiente
        const productos = productosResult.rows.map((row: any) => ({
            id: row.id,
            nombre: row.nombre,
            descripcion: row.descripcion,
            stock: row.stock,
            precio: row.precio,
            imagen: row.imagen,
            slug: row.slug,
            fecha_creacion: row.fecha_creacion,
            detalles: detallesResult.rows.filter((detalle: any) => detalle.producto_id === row.id),
            categoria: {
                id: row.categoria_id,
                nombre: row.categoria_nombre,
                descripcion: row.categoria_descripcion,
                imagen: row.categoria_imagen,
                slug: row.categoria_slug
            }
        }));

        res.status(200).json(productos);
    } catch (error) {
        console.error('Error fetching products with details and category:', error);
        res.status(500).json({ error: 'Error fetching products with details and category' });
    }
};

export const getProductoPorId = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        // Consulta para obtener el producto con su categoría
        const productoResult = await client.execute({
            sql: `
                SELECT p.id, p.categoria_id, p.nombre, p.descripcion, p.stock, p.precio, p.imagen, p.slug, p.fecha_creacion, 
                       c.id AS categoria_id, c.nombre AS categoria_nombre, c.descripcion AS categoria_descripcion, 
                       c.imagen AS categoria_imagen, c.slug AS categoria_slug
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = ?
            `,
            args: [id]
        });

        if (!Array.isArray(productoResult.rows) || productoResult.rows.length === 0) {
            res.status(404).json({ error: 'Producto no encontrado' });
            return;
        }

        const producto = productoResult.rows[0];

        // Obtener detalles del producto
        const detallesResult = await client.execute({
            sql: "SELECT * FROM detalles_productos WHERE producto_id = ?",
            args: [id]
        });

        if (!Array.isArray(detallesResult.rows)) {
            res.status(500).json({ error: 'Unexpected data format from database' });
            return;
        }

        // Formatear los detalles
        const detalles = detallesResult.rows.map((detalle: any) => ({
            id: detalle.id,
            especificacion: detalle.especificacion,
            valor: detalle.valor
        }));

        // Formatear los datos del producto incluyendo detalles y categoría
        const formattedData = {
            id: producto.id,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            stock: producto.stock,
            precio: producto.precio,
            imagen: producto.imagen,
            slug: producto.slug,
            fecha_creacion: producto.fecha_creacion,
            // detalles: detallesResult.rows.filter((detalle: any) => detalle.producto_id ===  producto.id), //obtengo todos los valores de la tabla
            detalles,

            categoria: {
                id: producto.categoria_id,
                nombre: producto.categoria_nombre,
                descripcion: producto.categoria_descripcion,
                imagen: producto.categoria_imagen,
                slug: producto.categoria_slug
            }
        };

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Error fetching product by id with details and category:', error);
        res.status(500).json({ error: 'Error fetching product by id with details and category' });
    }
};


// Función para generar un slug a partir del nombre
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-');
};

export const crearProducto = async (req: Request, res: Response): Promise<void> => {
    const { categoria_id, nombre, descripcion, stock, precio } = req.body;
    const detallesString = req.body.detalles; // Recibir los detalles como string
    const file = req.file as Express.Multer.File | undefined;
    try {

        validacionesObligatorias({ categoria_id,nombre, stock,precio }, ['categoria_id', 'nombre', 'stock','precio']);

        // Comprobar si el producto ya existe
        const existeProducto = await executeQuery(
            "SELECT p.id FROM productos p WHERE nombre = ? AND categoria_id = ?",
            [nombre, categoria_id]
        );
        
        if (existeProducto.rows.length > 0) {
            res.status(400).json({ error: 'Ya existe un producto con ese nombre en esta categoría.' });
            return;
        }
        
        if (!file) {
            throw new AppError("No se proporcionó ningún archivo.", 400);
        }
        const imageUrl = await subiryConvetirR2(file, 'productos');

        // Crear el producto
        const id = uuidv4();
        const slug = generateSlug(nombre);

        await executeQuery(
            "INSERT INTO productos (id, categoria_id, nombre, descripcion, stock, precio, imagen, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [id, categoria_id, nombre, descripcion, stock, precio, imageUrl, slug]
        );

        // Procesar los detalles (convertir string JSON a objeto)
        let detalles = [];
        if (detallesString) {
            try {
                detalles = JSON.parse(detallesString);  // Convertir el string a JSON
            } catch (error) {
                throw new AppError('El formato de los detalles no es válido.', 400);
            }
        }

        // Insertar detalles del producto si existen
        if (detalles && Array.isArray(detalles)) {
            for (const detalle of detalles) {
                const detalleId = uuidv4(); 
                await executeQuery(
                    "INSERT INTO detalles_productos (id, producto_id, especificacion, valor) VALUES (?, ?, ?, ?)",
                    [detalleId, id, detalle.especificacion, detalle.valor]
                );
            }
        }
        res.status(201).json({ message: 'Producto creado exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al crear el prodcuto" });
        }
    }
};

export const actualizarProducto = async (req: Request, res: Response): Promise<void> => {
    const productoId = req.params.id;
    const { categoria_id, nombre, descripcion, stock, precio } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    try {
        validacionesObligatorias({ categoria_id,nombre, stock,precio }, ['categoria_id', 'nombre', 'stock','precio']);

        let imageUrl: string | undefined;
        if (file) {
            imageUrl = await subiryConvetirR2(file, 'productos');
        }

        const slug = generateSlug(nombre);

        const datosActualizar: { [key: string]: string } = { categoria_id,nombre, descripcion,stock,precio, slug };
        if (imageUrl) {
            datosActualizar.imagen = imageUrl;
        }

        await executeQuery(
            `UPDATE productos SET ${Object.keys(datosActualizar).map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(datosActualizar), productoId]
        );
      
        res.status(200).json({ message: 'Producto actualizado exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al actualizar el prodcuto" });
        }
    }
};

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { executeQuery } from '../services/dbService';
import { AppError } from '../utils/appError';
import { validacionesObligatorias } from '../utils/validaciones';
import { subiryConvetirR2 } from '../services/r2Service';
import { r2Client } from '../utils/r2';

export const eliminarProducto = async (req: Request, res: Response): Promise<void> => {
    const productoId = req.params.id;

    try {
        // Recuperar el producto para obtener la URL de la imagen
        const result = await client.execute({
            sql: "SELECT imagen FROM productos WHERE id = ?",
            args: [productoId]
        });

        // Verificar si se obtuvo algún resultado
        const producto = result.rows && result.rows[0];
        const imageUrl = producto?.imagen;

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

        // Eliminar detalles del producto
        await client.execute({
            sql: "DELETE FROM detalles_productos WHERE producto_id = ?",
            args: [productoId]
        });

        // Eliminar producto
        await client.execute({
            sql: "DELETE FROM productos WHERE id = ?",
            args: [productoId]
        });

        res.status(200).json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar el producto:', error);
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
};
