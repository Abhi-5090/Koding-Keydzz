import { BaseRepository } from './BaseRepository.js';
import { Notification } from '../models/Notification.js';

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  findByUser(userId, limit = 50) {
    return this.model.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
  }

  insertMany(docs) {
    return this.model.insertMany(docs);
  }
}

export const notificationRepository = new NotificationRepository();
export default notificationRepository;
