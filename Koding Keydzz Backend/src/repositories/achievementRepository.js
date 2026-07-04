import { BaseRepository } from './BaseRepository.js';
import { Achievement } from '../models/Achievement.js';

class AchievementRepository extends BaseRepository {
  constructor() {
    super(Achievement);
  }

  findAll() {
    return this.model.find().sort({ createdAt: 1 });
  }

  findByKey(key) {
    return this.model.findOne({ key });
  }
}

export const achievementRepository = new AchievementRepository();
export default achievementRepository;
