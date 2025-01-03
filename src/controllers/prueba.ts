import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../utils/appError";
import { subiryConvetirR2 } from "../services/r2Service";
import { executeQuery } from "../services/dbService";

// Función para generar un slug a partir del nombre
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-');
};

interface Variante {
    variante_id: string;
    valor: string;
    precio: number;
    stock: number;
  }
  
export const crearProductoPrueba = async (req: Request, res: Response): Promise<void> => {
    const { categoria_id, nombre, descripcion, stock, precio, tiene_variantes } = req.body;
    const rawVariantes:string = req.body.variantes; // Supone que las variantes se envían como string JSON.

    const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
    };
    try {
        // Validaciones
        if (!categoria_id || !nombre || !stock || !precio) {
            throw new AppError("Faltan campos obligatorios.", 400);
        }

        // Subir la imagen principal
        let imageUrl = null;
        if (files.imagen_principal && files.imagen_principal[0]) {
            imageUrl = await subiryConvetirR2(files.imagen_principal[0], "productos");
        } else {
            throw new AppError("Se requiere una imagen principal para el producto.", 400);
        }

        // Crear el producto
        const id = uuidv4();
        const slug = generateSlug(nombre);

        await executeQuery(
            "INSERT INTO productos (id, categoria_id, nombre, descripcion, stock, precio, imagen, slug, tiene_variantes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id, categoria_id, nombre, descripcion, stock, precio, imageUrl, slug, tiene_variantes || 0]
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
                typeof variante.precio === 'number' &&
                typeof variante.stock === 'number'
              );
            }) as Variante[];
        
            // Procesar las variantes
            for (const variante of variantes) {
              try {
                const varianteId = uuidv4();
                await executeQuery(
                  "INSERT INTO detalles_variantes (id, producto_id, variante_id, valor, precio, stock) VALUES (?, ?, ?, ?, ?, ?)",
                  [
                    varianteId,
                    id, // Asegúrate de que este valor esté definido
                    variante.variante_id,
                    variante.valor,
                    variante.precio,
                    variante.stock,
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
