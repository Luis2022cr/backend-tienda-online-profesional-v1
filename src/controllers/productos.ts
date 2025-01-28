import { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { subiryConvetirR2 } from "../services/r2Service";
import { executeQuery } from "../services/dbService";
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { validacionesObligatorias } from '../utils/validaciones';
import { r2Client } from '../utils/r2';
import client from "../db/turso";
import { generateSlug } from "../utils/generarSlug";
import { generateId } from "../utils/GenerarIdTexto";
import { v4 as uuidv4 } from 'uuid';
import { verificarExisteEnDb } from "../services/existeDatoEnDb";
interface Variante {
  variante_id: string;
  valor: string;
  precio: number;
  stock: number;
  codigo_referencia: string;
}


export const crearProducto = async (req: Request, res: Response): Promise<void> => {
  const { categoria_id, nombre, descripcion, stock, precio, tiene_variantes, codigo_referencia } = req.body;
  const rawVariantes: string = req.body.variantes; // Supone que las variantes se envían como string JSON.

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  try {
    // Validaciones
    if (!categoria_id || !nombre || !stock || !precio) {
      throw new AppError("Faltan campos obligatorios.", 400);
    }

    const slug = generateSlug(nombre);

    await verificarExisteEnDb(
      'productos',
      'nombre',
      nombre,
      'Ya existe una producto con ese nombre.'
    );

    // Subir la imagen principal
    let imageUrl = null;
    if (files.imagen_principal && files.imagen_principal[0]) {
      imageUrl = await subiryConvetirR2(files.imagen_principal[0], "productos");
    } else {
      throw new AppError("Se requiere una imagen principal para el producto.", 400);
    }

    // Crear el producto

    const id = uuidv4();

    await executeQuery(
      "INSERT INTO productos (id, categoria_id, nombre, descripcion, stock, precio, imagen, slug, codigo_referencia, tiene_variantes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, categoria_id, nombre, descripcion, stock, precio, imageUrl, slug, codigo_referencia, tiene_variantes || 0]
    );

    // Insertar variantes si existen
    if (tiene_variantes && rawVariantes) {
      let variantes: Variante[];

      try {
        variantes = JSON.parse(rawVariantes) as Variante[];
      } catch (error) {
        res.status(400).json({ error: "El campo 'variantes' no tiene un formato JSON válido." });
        return;
      }

      // Validar que sea un array
      if (!Array.isArray(variantes)) {
        res.status(400).json({ error: "El campo 'variantes' debe ser un array." });
        return;
      }
      // Filtrar y limpiar datos inesperados en el array
      variantes = variantes.filter((variante: Partial<Variante>) => {
        return (
          typeof variante === 'object' &&
          !!variante.variante_id &&
          !!variante.valor &&
          (variante.codigo_referencia || variante.codigo_referencia === '') &&  // Permite código de referencia vacío
          typeof variante.precio === 'number' &&
          typeof variante.stock === 'number'
        );
      }) as Variante[];

      // Procesar las variantes
      for (const variante of variantes) {
        try {

          const varianteId = uuidv4(); // Combinación del timestamp y el sufijo aleatorio

          await executeQuery(
            "INSERT INTO detalles_variantes (id, producto_id, variante_id, valor, precio, stock, codigo_referencia) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              varianteId,
              id, // Asegúrate de que este valor esté definido
              variante.variante_id,
              variante.valor,
              variante.precio,
              variante.stock,
              variante.codigo_referencia
            ]
          );
        } catch (error) {
          console.error("Error al insertar la variante:", error);
          res.status(500).json({ error: "Error al guardar las variantes en la base de datos." });
          return;
        }
      }
    }


    // Subir imágenes adicionales y guardar en la base de datos
    const additionalFiles = files['imagenes_adicionales[]'];
    // console.log("imagen adicional:", additionalFiles);
    if (additionalFiles) {
      for (const additionalFile of additionalFiles) {
        const additionalImageUrl = await subiryConvetirR2(additionalFile, "productos");
        await executeQuery(
          "INSERT INTO imagenes_productos (producto_id, url_imagen, descripcion) VALUES (?, ?, ?)",
          [id, additionalImageUrl, 'prueba'] // Cambiar `null` si necesitas agregar descripción
        );
      }
    }


    res.status(201).json({ message: "Producto creado exitosamente" });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error(error);
      res.status(500).json({ error: "Error al crear el producto" });
    }
  }
};

export const obtenerProductos = async (req: Request, res: Response): Promise<void> => {
  try {
    // Consulta para obtener todos los productos y su categoría
    const queryProductos = `
    SELECT 
        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.descripcion AS producto_descripcion,
        p.stock AS producto_stock,
        p.precio AS producto_precio,
        p.imagen AS imagen_principal,
        p.slug AS producto_slug,
        p.tiene_variantes,
        p.codigo_referencia,
        p.fecha_creacion AS producto_fecha_creacion,
        c.nombre AS categoria_nombre,
        c.descripcion AS categoria_descripcion,
        c.slug AS categoria_slug
    FROM productos p
    INNER JOIN categorias c ON p.categoria_id = c.id
    `;

    const productos = await executeQuery(queryProductos, []);
    const productoss = productos.rows;

    if (productoss.length === 0) {
      res.status(404).json({ error: "No se encontraron productos" });
      return;
    }

    // Consulta para obtener las variantes de todos los productos
    const queryVariantes = `
    SELECT 
        dv.id AS variante_id,
        dv.valor AS variante_valor,
        dv.precio AS variante_precio,
        dv.stock AS variante_stock,
        dv.codigo_referencia AS variante_codigo
        v.nombre AS variante_nombre,
        dv.producto_id
    FROM detalles_variantes dv
    LEFT JOIN variantes v ON dv.variante_id = v.id
    `;

    const variantesResult = await executeQuery(queryVariantes, []);
    const variantes = variantesResult.rows;

    // Consulta para obtener las imágenes adicionales de todos los productos
    const queryImagenes = `
    SELECT 
        ip.id AS imagen_id,
        ip.url_imagen AS imagen_url,
        ip.descripcion AS imagen_descripcion,
        ip.producto_id
    FROM imagenes_productos ip
    `;

    const imagenesResult = await executeQuery(queryImagenes, []);
    const imagenes = imagenesResult.rows;

    // Reorganizar los datos
    const productosMap = new Map();

    // Primero asignamos los productos con sus categorías
    productoss.forEach(row => {
      if (!productosMap.has(row.producto_id)) {
        productosMap.set(row.producto_id, {
          id: row.producto_id,
          nombre: row.producto_nombre,
          descripcion: row.producto_descripcion,
          stock: row.producto_stock,
          precio: row.producto_precio,
          imagen_principal: row.imagen_principal,
          slug: row.producto_slug,
          tiene_variantes: row.tiene_variantes,
          fecha_creacion: row.producto_fecha_creacion,
          categoria: {
            nombre: row.categoria_nombre,
            descripcion: row.categoria_descripcion,
            slug: row.categoria_slug
          },
          variantes: [],
          imagenes_adicionales: []
        });
      }
    });

    // Ahora asignamos las variantes
    variantes.forEach(varianta => {
      const producto = productosMap.get(varianta.producto_id);
      if (producto) {
        producto.variantes.push({
          id: varianta.variante_id,
          nombre: varianta.variante_nombre,
          valor: varianta.variante_valor,
          precio: varianta.variante_precio,
          stock: varianta.variante_stock
        });
      }
    });

    // Ahora asignamos las imágenes
    imagenes.forEach(imagen => {
      const producto = productosMap.get(imagen.producto_id);
      if (producto) {
        producto.imagenes_adicionales.push({
          id: imagen.imagen_id,
          url: imagen.imagen_url,
          descripcion: imagen.imagen_descripcion
        });
      }
    });

    // Devolver todos los productos con sus variantes e imágenes
    res.status(200).json([...productosMap.values()]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los productos" });
  }
};


export const obtenerProductoPorSlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params; // Obtén el slug de los parámetros de la URL

    // Consulta para obtener el producto principal
    const queryProducto = `
    SELECT 
        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.descripcion AS producto_descripcion,
        p.stock AS producto_stock,
        p.precio AS producto_precio,
        p.imagen AS imagen_principal,
        p.slug AS producto_slug,
        p.tiene_variantes,
        p.codigo_referencia,
        p.fecha_creacion AS producto_fecha_creacion
    FROM productos p
    WHERE p.slug = ?
    `;

    const productos = await executeQuery(queryProducto, [slug]); // Pasa el slug como parámetro
    const productoss = productos.rows;

    if (productoss.length === 0) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    // Consulta para obtener la categoría
    const queryCategoria = `
    SELECT 
        c.nombre AS categoria_nombre,
        c.descripcion AS categoria_descripcion,
        c.slug AS categoria_slug
    FROM categorias c
    INNER JOIN productos p ON p.categoria_id = c.id
    WHERE p.slug = ?
    `;

    const categoriaResult = await executeQuery(queryCategoria, [slug]);
    const categoria = categoriaResult.rows[0];

    // Consulta para obtener las variantes del producto
    const queryVariantes = `
    SELECT 
        dv.id AS variante_id,
        dv.valor AS variante_valor,
        dv.precio AS variante_precio,
        dv.stock AS variante_stock,
        dv.codigo_referencia AS variante_codigo,
        v.nombre AS variante_nombre
    FROM detalles_variantes dv
    LEFT JOIN variantes v ON dv.variante_id = v.id
    WHERE dv.producto_id = (SELECT id FROM productos WHERE slug = ?)
    `;

    const variantesResult = await executeQuery(queryVariantes, [slug]);
    const variantes = variantesResult.rows;

    // Consulta para obtener las imágenes adicionales del producto
    const queryImagenes = `
    SELECT 
        ip.id AS imagen_id,
        ip.url_imagen AS imagen_url,
        ip.descripcion AS imagen_descripcion
    FROM imagenes_productos ip
    WHERE ip.producto_id = (SELECT id FROM productos WHERE slug = ?)
    `;

    const imagenesResult = await executeQuery(queryImagenes, [slug]);
    const imagenes = imagenesResult.rows;

    // Estructura final del producto con sus variantes e imágenes
    const producto = {
      id: productoss[0].producto_id,
      nombre: productoss[0].producto_nombre,
      descripcion: productoss[0].producto_descripcion,
      stock: productoss[0].producto_stock,
      precio: productoss[0].producto_precio,
      imagen_principal: productoss[0].imagen_principal,
      slug: productoss[0].producto_slug,
      tiene_variantes: productoss[0].tiene_variantes,
      fecha_creacion: productoss[0].producto_fecha_creacion,
      categoria: {
        nombre: categoria.categoria_nombre,
        descripcion: categoria.categoria_descripcion,
        slug: categoria.categoria_slug
      },
      variantes: variantes.map(variant => ({
        id: variant.variante_id,
        nombre: variant.variante_nombre,
        valor: variant.variante_valor,
        precio: variant.variante_precio,
        stock: variant.variante_stock,
        variante_codigo: variant.variante_codigo
      })),
      imagenes_adicionales: imagenes.map(image => ({
        id: image.imagen_id,
        url: image.imagen_url,
        descripcion: image.imagen_descripcion
      }))
    };

    // Responder con el producto completo
    res.status(200).json(producto);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el producto" });
  }
};

export const getProductosTarjetaPublic = async (req: Request, res: Response): Promise<void> => {
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

export const getProductosTarjetaPrivado = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtener el parámetro opcional de slug de categoría desde la consulta
    const { categoria_slug } = req.query;

    // Construcción dinámica de la consulta SQL
    const query = `
          SELECT 
              p.id, 
              p.nombre, 
              p.descripcion, 
              p.slug AS producto_slug, 
              p.precio, 
              p.stock, 
              p.imagen, 
              p.codigo_referencia,
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

export const actualizarProducto = async (req: Request, res: Response): Promise<void> => {
  const productoId = req.params.id;
  const { categoria_id, nombre, descripcion, stock, precio, variante_codigo } = req.body;
  const file = req.file as Express.Multer.File | undefined;

  try {
    validacionesObligatorias({ categoria_id, nombre, stock, precio }, ['categoria_id', 'nombre', 'stock', 'precio']);

    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await subiryConvetirR2(file, 'productos');
    }

    const slug = generateSlug(nombre);

    const datosActualizar: { [key: string]: string } = { categoria_id, nombre, descripcion, stock, precio, slug, variante_codigo };
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

export const eliminarProducto = async (req: Request, res: Response): Promise<void> => {
  const productoId = req.params.id;

  try {
    // Recuperar las imágenes asociadas al producto
    const result = await client.execute({
      sql: `
              SELECT 
                  p.imagen AS imagen_principal, 
                  ip.url_imagen AS imagen_adicional
              FROM productos p
              LEFT JOIN imagenes_productos ip ON ip.producto_id = p.id
              WHERE p.id = ?
          `,
      args: [productoId]
    });

    // Obtener todas las imágenes del producto
    const images = result.rows || [];
    const imageUrls = images.flatMap(row => [row.imagen_principal, row.imagen_adicional].filter(url => url));

    // Eliminar las imágenes del bucket de R2
    for (const imageUrl of imageUrls) {
      if (imageUrl && typeof imageUrl === 'string') {
        const fileKey = imageUrl.split(`${process.env.R2_URLPUBLIC}/`)[1];
        if (fileKey) {
          try {
            const command = new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET,
              Key: fileKey,
            });
            await r2Client.send(command);
          } catch (deleteError) {
            console.error(`Error al eliminar la imagen del bucket (${fileKey}):`, deleteError);
          }
        }
      }
    }

    // Eliminar las imágenes adicionales del producto
    await client.execute({
      sql: "DELETE FROM imagenes_productos WHERE producto_id = ?",
      args: [productoId]
    });

    // Eliminar variantes asociadas al producto
    await client.execute({
      sql: "DELETE FROM detalles_variantes WHERE producto_id = ?",
      args: [productoId]
    });

    // Eliminar el producto
    await client.execute({
      sql: "DELETE FROM productos WHERE id = ?",
      args: [productoId]
    });

    res.status(200).json({ message: 'Producto eliminado exitosamente, junto con sus imágenes y variantes' });
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};
