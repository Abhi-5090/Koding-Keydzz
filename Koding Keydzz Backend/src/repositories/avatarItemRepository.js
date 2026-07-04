import { BaseRepository } from './BaseRepository.js';
import { AvatarItem } from '../models/AvatarItem.js';

class AvatarItemRepository extends BaseRepository {
  constructor() {
    super(AvatarItem);
  }

  findAll() {
    return this.model.find().sort({ type: 1, requiredLevel: 1, price: 1 });
  }

  findByKey(key) {
    return this.model.findOne({ key });
  }

  findByKeys(keys = []) {
    return this.model.find({ key: { $in: keys } });
  }

  findDefaults() {
    return this.model.find({ isDefault: true });
  }

  findPurchasable() {
    return this.model.find({ isDefault: false }).sort({ price: 1 });
  }
}

export const avatarItemRepository = new AvatarItemRepository();
export default avatarItemRepository;
