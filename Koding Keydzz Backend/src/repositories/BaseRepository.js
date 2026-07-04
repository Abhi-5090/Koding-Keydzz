export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  create(data) {
    return this.model.create(data);
  }

  findById(id, projection = null, options = {}) {
    return this.model.findById(id, projection, options);
  }

  findOne(filter = {}, projection = null, options = {}) {
    return this.model.findOne(filter, projection, options);
  }

  find(filter = {}, options = {}) {
    let query = this.model.find(filter);
    if (options.sort) query = query.sort(options.sort);
    if (typeof options.skip === 'number') query = query.skip(options.skip);
    if (typeof options.limit === 'number') query = query.limit(options.limit);
    if (options.populate) query = query.populate(options.populate);
    if (options.select) query = query.select(options.select);
    return query;
  }

  count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  updateById(id, update, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, update, options);
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}

export default BaseRepository;
