// Provide dummy env so config/env.js validation passes during unit tests.
// (These tests never connect to MongoDB or sign real tokens.)
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/koding_keydzz_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
process.env.NODE_ENV = 'test';
