import { BaseRepository } from './BaseRepository.js';
import { Course } from '../models/Course.js';

class CourseRepository extends BaseRepository {
  constructor() {
    super(Course);
  }

  findAllOrdered() {
    return this.model.find().sort({ order: 1 }).populate('world', 'name slug');
  }
}

export const courseRepository = new CourseRepository();
export default courseRepository;
