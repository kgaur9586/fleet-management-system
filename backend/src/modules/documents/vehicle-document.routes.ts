import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { VehicleDocumentController } from './vehicle-document.controller';
import { createVehicleDocumentSchema, getVehicleDocumentSchema, listVehicleDocumentSchema, uploadVehicleDocumentSchema } from './vehicle-document.validation';
import { isAllowedDocumentMimeType } from './storage/mime';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, isAllowedDocumentMimeType(file.mimetype)),
});

const router = Router();
router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createVehicleDocumentSchema), VehicleDocumentController.create);
router.post('/upload', upload.single('file'), validateResource(uploadVehicleDocumentSchema), VehicleDocumentController.upload);
router.get('/', validateResource(listVehicleDocumentSchema), VehicleDocumentController.list);
router.get('/:id/file', validateResource(getVehicleDocumentSchema), VehicleDocumentController.download);
router.get('/:id', validateResource(getVehicleDocumentSchema), VehicleDocumentController.getById);

export default router;
