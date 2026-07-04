import { challengeRepository } from '../repositories/challengeRepository.js';

export function listDailyChallenges() {
  return challengeRepository.findDaily();
}

export default { listDailyChallenges };
