import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateResource } from '../../middleware/validateResource';
import { ContractController } from './contract.controller';
import {
  createContractSchema,
  createVersionSchema,
  getContractSchema,
  queryContractSchema,
  queryVersionSchema,
  versionIdSchema,
  updateContractSchema,
} from './contract.validation';

const router = Router();

router.use(requireAuth, requireRole(['owner', 'admin']));

router.post('/', validateResource(createContractSchema), ContractController.create);
router.get('/', validateResource(queryContractSchema), ContractController.list);
router.get('/:id/versions/effective', validateResource(queryVersionSchema), ContractController.getEffectiveVersion);
router.get('/:id/versions/active', validateResource(getContractSchema), ContractController.getActiveVersion);
router.post('/:id/versions', validateResource(createVersionSchema), ContractController.createVersion);
router.get('/:id/versions', validateResource(getContractSchema), ContractController.listVersions);
router.get('/:id/versions/:versionId', validateResource(versionIdSchema), ContractController.getVersion);
router.get('/:id', validateResource(getContractSchema), ContractController.getById);
router.patch('/:id', validateResource(updateContractSchema), ContractController.update);
router.delete('/:id', validateResource(getContractSchema), ContractController.delete);

export default router;