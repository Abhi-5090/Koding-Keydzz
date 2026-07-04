import { BaseRepository } from './BaseRepository.js';
import { Purchase } from '../models/Purchase.js';

class PurchaseRepository extends BaseRepository {
  constructor() {
    super(Purchase);
  }

  findByUser(userId) {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('item');
  }
}

export const purchaseRepository = new PurchaseRepository();
export default purchaseRepository;
