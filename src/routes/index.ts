// index.ts
import { Router } from 'express';
import authRouter from './authRoutes';
import { getCategorias, getCategoriaPorSlug, crearCategoria, updateCategory, deleteCategory } from '../controllers/categoriasController';
import {  actualizarBanner, crearBanner, eliminarBanner, getBannerPorId, getBanners } from '../controllers/bannerController';
import { obtenerUsuarioLogueado } from '../controllers/usuarioController';
import { authenticateJWT } from '../Middlewares/authMiddleware';
import { actualizarnegocio, getnegocioPorId, getnegocios, getRedesSocialesNegocio } from '../controllers/negocioController';
import { actualizarProducto, crearProducto, eliminarProducto, getProductosTarjetaPrivado, getProductosTarjetaPublic, obtenerProductoPorSlug, obtenerProductos } from '../controllers/productos';
import { getCarrito, addProductoCarrito, updateCantidadCarrito, deleteProductoCarrito, clearCarrito, getTotalCarrito } from '../controllers/carrito';
import { modificarVariantesProducto } from '../controllers/variantes';
import { modificarImagenesProducto } from '../controllers/imagenesController';
import { getVariantes, getVariantePorSlug, crearVariante, actualizarVariante } from '../controllers/varianteController';

const router: Router = Router();

// Rutas de autenticación
router.use('/auth', authRouter);

//Endpoint de Categorias
router.get('/categorias', getCategorias);
router.get('/categorias/:slug', getCategoriaPorSlug);
router.post('/categorias', crearCategoria);
router.put('/categorias/:id', updateCategory);
router.delete('/categorias/:id', deleteCategory);

//Endpoint Productos
router.get('/productos', obtenerProductos);
router.get('/productos/:slug', obtenerProductoPorSlug);
router.get('/productos_tarjetas', getProductosTarjetaPublic);
router.get('/productos_tarjetas_privado', getProductosTarjetaPrivado);
router.post('/productos', crearProducto)
router.put('/productos/:id', actualizarProducto);
router.delete('/productos/:id', eliminarProducto);

//Endpoint de detalles variantes
router.put("/productos/:slug/variantes", modificarVariantesProducto);


//Endpoint imagenes adicionales
router.post('/productos/:slug/imagenes', modificarImagenesProducto);  // Para crear o eliminar imagen

//Endpoint varainte
// Rutas para las variantes
router.get('/variantes', getVariantes);                  // Obtener todas las variantes
router.get('/variantes/:slug', getVariantePorSlug);      // Obtener variante por slug
router.post('/variantes', crearVariante);                // Crear nueva variante
router.put('/variantes/:slug', actualizarVariante);

//Endpoint Banners
router.get('/banners', getBanners);
router.get('/banners/:id', getBannerPorId);
router.post('/banners', crearBanner);
router.put('/banners/:id', actualizarBanner);
router.delete('/banners/:id', eliminarBanner);

//Endpoint Banners
router.get('/negocio', getnegocios);
router.get('/negocio/:id', getnegocioPorId);
router.get('/negocio-redes-sociales', getRedesSocialesNegocio);
router.put('/negocio/:id', actualizarnegocio);

//Endpoint de usario
router.get('/usuario/perfil',authenticateJWT, obtenerUsuarioLogueado);

// Obtener el contenido del carrito
router.get('/carrito',authenticateJWT, getCarrito);
// Obtener el total del carrito
router.get('/carrito/total',authenticateJWT, getTotalCarrito);
// Agregar un producto al carrito
router.post('/carrito',authenticateJWT, addProductoCarrito);
// Actualizar la cantidad de un producto en el carrito
router.patch('/carrito/:carritoId', updateCantidadCarrito);
// Eliminar un producto del carrito
router.delete('/carrito/:carritoId', deleteProductoCarrito);
// Vaciar el carrito
router.delete('/carritos/borrar',authenticateJWT, clearCarrito);

export default router;
 