// index.ts
import { Router } from 'express';
import authRouter from './authRoutes';
import { getCategorias, getCategoriaPorSlug, crearCategoria, updateCategory, deleteCategory } from '../controllers/categoriasController';
import { getProductos, getProductoPorId, actualizarProducto, eliminarProducto, crearProducto, getProductosTarjeta } from '../controllers/productosController';
import {  actualizarBanner, crearBanner, eliminarBanner, getBannerPorId, getBanners } from '../controllers/bannerController';
import { actualizarDetalle, crearDetalles, eliminarDetalle } from '../controllers/detallesProductosController';
import { obtenerUsuarioLogueado } from '../controllers/usuarioController';
import { authenticateJWT } from '../Middlewares/authMiddleware';
import { actualizarnegocio, getnegocioPorId, getnegocios, getRedesSocialesNegocio } from '../controllers/negocioController';
import { crearProductoPrueba } from '../controllers/prueba';
import { getCarrito, addProductoCarrito, updateCantidadCarrito, deleteProductoCarrito, clearCarrito, getTotalCarrito } from '../controllers/carrito';

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
router.get('/productos', getProductos);
router.get('/productos_tarjetas', getProductosTarjeta);
router.get('/productos/:id', getProductoPorId);
router.post('/productos', crearProducto);
router.put('/productos/:id', actualizarProducto);
router.delete('/productos/:id', eliminarProducto);

//Endpoint Detalles
router.post('/detalles_productos/:id', crearDetalles);
router.put('/detalles_productos/:id', actualizarDetalle);
router.delete('/detalles_productos/:id', eliminarDetalle);

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

// const upload = multer({
//     storage: multer.memoryStorage(), // Usar almacenamiento en memoria o donde lo necesites
//     limits: { fileSize: 5 * 1024 * 1024 }, // Tamaño máximo de archivo: 5MB
// }).fields([
//     { name: 'imagen_principal', maxCount: 1 }, // Campo para la imagen principal
//     { name: 'imagenes_adicionales[]', maxCount: 10 }, // Hasta 10 imágenes adicionales
// ]);

//prueba

router.post('/prueba', crearProductoPrueba)

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
 