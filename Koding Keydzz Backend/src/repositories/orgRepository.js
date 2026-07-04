import { BaseRepository } from './BaseRepository.js';
import { Organization } from '../models/Organization.js';

class OrgRepository extends BaseRepository {
  constructor() {
    super(Organization);
  }

  findByName(name) {
    return this.model.findOne({ name: String(name).trim() });
  }

  findBySlug(slug) {
    return this.model.findOne({ slug: String(slug).toLowerCase() });
  }

  findByCode(code) {
    return this.model.findOne({ code: String(code).toUpperCase() });
  }

  listAll() {
    return this.model.find({}).sort({ createdAt: -1 }).populate('adminUser', 'name email');
  }

  incStudentCount(id, delta = 1) {
    return this.model.findByIdAndUpdate(id, { $inc: { studentCount: delta } }, { new: true });
  }

  setStudentCount(id, count) {
    return this.model.findByIdAndUpdate(id, { studentCount: count }, { new: true });
  }
}

export const orgRepository = new OrgRepository();
export default orgRepository;
