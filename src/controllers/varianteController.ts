import client from "../db/turso";
import { Request, Response } from 'express';
import { executeQuery } from "../services/dbService";
import { generateSlug } from "../utils/generarSlug";
import { generateId } from "../utils/GenerarIdTexto";

// Obtener todas las variantes (solo campos importantes)
export const getVariantes = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await client.execute(
      "SELECT id, nombre, slug FROM variantes"
    );
    res.status(200).json(result.rows );
  } catch (error) {
    console.error("Error al obtener las variantes:", error);
    res.status(500).json({ error: "Error al obtener las variantes" });
  }
};

// Obtener variante por slug (solo campos importantes)
export const getVariantePorSlug = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  try {
    const result = await executeQuery(
      "SELECT id, nombre, slug FROM variantes WHERE slug = ?", 
      [slug]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }
    
    res.status(200).json({ variante: result.rows[0] });
  } catch (error) {
    console.error("Error al obtener la variante por slug:", error);
    res.status(500).json({ error: "Error al obtener la variante por slug" });
  }
};

// Crear nueva variante
export const crearVariante = async (req: Request, res: Response): Promise<void> => {
  const { nombre } = req.body;

  try {
    // Validar que ambos campos sean proporcionados
    if (!nombre) {
      res.status(400).json({ error: "Los campos 'nombre' y 'slug' son obligatorios" });
      return;
    }
    const slug = generateSlug(nombre); 
    // Verificar si ya existe una variante con el mismo slug
    const existingVariante = await executeQuery("SELECT 1 FROM variantes WHERE slug = ?", [slug]);

    if (existingVariante.rows.length > 0) {
      res.status(400).json({ error: "Ya existe una variante con ese slug" });
      return;
    }

    const id = generateId('var'); // Generar un ID único para la variante

    // Insertar nueva variante en la base de datos
    await executeQuery("INSERT INTO variantes (id, nombre, slug) VALUES (?, ?, ?)", [id, nombre, slug]);

    res.status(201).json({ message: "Variante creada exitosamente", id });
  } catch (error) {
    console.error("Error al crear la variante:", error);
    res.status(500).json({ error: "Error al crear la variante" });
  }
};

// Actualizar variante por slug
export const actualizarVariante = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { nombre } = req.body;

  try {
    // Verificar si la variante existe
    const variante = await executeQuery("SELECT id FROM variantes WHERE slug = ?", [slug]);

    if (variante.rows.length === 0) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }
    
    // Validar que los campos 'nombre' y 'slug' sean proporcionados
    if (!nombre) {
        res.status(400).json({ error: "Los campos 'nombre' y 'nuevoSlug' son obligatorios" });
        return;
    }
    
    const nuevoSlug = generateSlug(nombre); 
    // Verificar si ya existe una variante con el nuevo slug
    const existingVariante = await executeQuery("SELECT 1 FROM variantes WHERE slug = ?", [nuevoSlug]);

    if (existingVariante.rows.length > 0) {
      res.status(400).json({ error: "Ya existe una variante con ese nuevo slug" });
      return;
    }

    // Actualizar variante en la base de datos
    await executeQuery("UPDATE variantes SET nombre = ?, slug = ? WHERE slug = ?", [nombre, nuevoSlug, slug]);

    res.status(200).json({ message: "Variante actualizada exitosamente" });
  } catch (error) {
    console.error("Error al actualizar la variante:", error);
    res.status(500).json({ error: "Error al actualizar la variante" });
  }
};
