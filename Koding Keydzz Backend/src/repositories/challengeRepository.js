import { BaseRepository } from './BaseRepository.js';
import { Challenge } from '../models/Challenge.js';

class ChallengeRepository extends BaseRepository {
  constructor() {
    super(Challenge);
  }

  findDaily() {
    return this.model.find({ daily: true }).sort({ createdAt: -1 });
  }
}

export const challengeRepository = new ChallengeRepository();
export default challengeRepository;
