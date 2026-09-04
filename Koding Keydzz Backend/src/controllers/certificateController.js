import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as certificates from '../services/certificateService.js';
import { CertificateTemplate } from '../models/CertificateTemplate.js';
import { ApiError } from '../utils/ApiError.js';

/* ---- a pupil's own certificates ---- */

export const myCertificates = asyncHandler(async (req, res) => {
  const items = await certificates.forUser(req.user._id);
  return sendSuccess(res, { items, total: items.length }, 'Your certificates');
});

export const myCertificate = asyncHandler(async (req, res) => {
  const data = await certificates.forUserByCode(req.user._id, req.params.code);
  return sendSuccess(res, data, 'Certificate');
});

/* ---- public verification ---- */

/**
 * PUBLIC. No authentication, by design — a certificate that leaves the school
 * is worthless if only the school can check it.
 *
 * Returns the achievement and nothing else. See the service for why.
 */
export const verifyCertificate = asyncHandler(async (req, res) => {
  const data = await certificates.verifyByCode(req.params.code);
  return sendSuccess(
    res,
    data,
    data.found
      ? data.revoked
        ? 'This certificate was issued and has since been withdrawn'
        : 'Certificate verified'
      : 'No certificate with that code'
  );
});

/* ---- staff ---- */

export const orgCertificates = asyncHandler(async (req, res) => {
  const data = await certificates.listForOrg({
    org: req.user.org,
    classroomScope: req.classroomScope,
    limit: Math.min(500, Number(req.query.limit) || 100),
  });
  return sendSuccess(res, data, 'Certificates');
});

export const revokeCertificate = asyncHandler(async (req, res) => {
  const data = await certificates.revoke({
    org: req.user.org,
    code: req.params.code,
    reason: req.body?.reason || '',
  });
  return sendSuccess(res, data, 'Certificate withdrawn');
});

export const backfillCertificates = asyncHandler(async (req, res) => {
  const data = await certificates.backfillForOrg(req.user.org);
  return sendSuccess(res, data, 'Certificates reconciled');
});

/* ---- templates (superadmin) ---- */

export const listTemplates = asyncHandler(async (_req, res) => {
  const items = await CertificateTemplate.find().sort({ createdAt: -1 }).lean();
  return sendSuccess(res, { items, total: items.length }, 'Certificate templates');
});

export const createTemplate = asyncHandler(async (req, res) => {
  const created = await CertificateTemplate.create(req.body);
  return sendSuccess(res, created.toObject(), 'Template created', 201);
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const updated = await CertificateTemplate.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).lean();
  if (!updated) throw ApiError.notFound('Template not found');
  return sendSuccess(res, updated, 'Template updated');
});

/**
 * Activate one template, deactivating its sibling.
 *
 * Only one template may be active per (org, course), and that is a TRANSITION
 * rather than a constraint — a unique index would simply reject the second
 * activation instead of replacing the first. Done in one step so there is never
 * a moment with no active template, which would make a certificate unrenderable.
 */
export const activateTemplate = asyncHandler(async (req, res) => {
  const template = await CertificateTemplate.findById(req.params.id);
  if (!template) throw ApiError.notFound('Template not found');

  await CertificateTemplate.updateMany(
    {
      _id: { $ne: template._id },
      org: template.org ?? null,
      courseSlug: template.courseSlug ?? null,
      active: true,
    },
    { $set: { active: false } }
  );

  template.active = true;
  await template.save();
  return sendSuccess(res, template.toObject(), 'Template activated');
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await CertificateTemplate.findById(req.params.id);
  if (!template) throw ApiError.notFound('Template not found');
  if (template.active) {
    // Deleting the active template would leave issued certificates unable to
    // render. Deactivate deliberately first.
    throw ApiError.badRequest(
      'That template is active. Activate another one before deleting this.'
    );
  }
  await template.deleteOne();
  return sendSuccess(res, { id: req.params.id }, 'Template deleted');
});

export default {
  myCertificates,
  myCertificate,
  verifyCertificate,
  orgCertificates,
  revokeCertificate,
  backfillCertificates,
  listTemplates,
  createTemplate,
  updateTemplate,
  activateTemplate,
  deleteTemplate,
};
