import { BaseRepository } from './BaseRepository.js';
import { World } from '../models/World.js';

class WorldRepository extends BaseRepository {
  constructor() {
    super(World);
  }

  findAllOrdered() {
    return this.model.find().sort({ order: 1 });
  }

  findBySlug(slug) {
    return this.model.findOne({ slug });
  }
}

export const worldRepository = new WorldRepository();
export default worldRepository;
